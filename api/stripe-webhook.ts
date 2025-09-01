import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buffer } from 'micro'
import fetch from 'node-fetch'

export const config = {
    api: {
        bodyParser: false,
    },
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

// SmartBill env
const SMARTBILL_USER = process.env.SMARTBILL_USER! // SmartBill login (email/username) for Basic auth
const SMARTBILL_TOKEN = process.env.SMARTBILL_TOKEN! // API token/key
const SMARTBILL_COMPANY_VAT = process.env.SMARTBILL_COMPANY_VAT! // e.g. RO12345678 (CUI)
const SMARTBILL_SERIES = process.env.SMARTBILL_SERIES ?? 'FP'
const SMARTBILL_API_BASE = process.env.SMARTBILL_API_BASE ?? 'https://ws.smartbill.ro/SBORO/api'
function escapeXml(input: string) {
    return input.replace(/[<>&'\"]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','\"':'&quot;'} as any)[c])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const sig = req.headers['stripe-signature']!
    const buf = await buffer(req)
    const now = new Date();
    const nowIso = now.toISOString();
    let event: Stripe.Event
    try {
        event = stripe.webhooks.constructEvent(buf, sig, endpointSecret)
    } catch (err) {
        console.error('Webhook Error:', (err as Error).message)
        return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const { steamId, ffAmount } = session.metadata ?? {}

        if (!steamId || !ffAmount) {
            console.warn('Missing metadata:', session.metadata)
            return res.status(400).send('Missing steamId or ffAmount')
        }

        // --- Log full Stripe session for debugging ---
        console.log('Stripe session:', JSON.stringify(session, null, 2))

        // --- Update FF in Supabase (existing logic) ---
        const { data: allLedger, error: ledgerFetchErr } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamId)

        if (ledgerFetchErr) {
            console.error('Supabase ledger fetch error:', ledgerFetchErr)
            return res.status(500).json({ error: 'supabase_ledger_fetch_failed' })
        }

        const oldBalance = allLedger?.reduce((sum, row) => sum + row.amount, 0) ?? 0

        const { error: ledgerInsertErr } = await supabase.from('ff_ledger').insert([
            {
                steam_id: steamId,
                amount: Number(ffAmount),
                type: 'deposit',
                reference: 'deposit',
                created_at: nowIso,
            },
        ])
        if (ledgerInsertErr) {
            console.error('Supabase ledger insert error:', ledgerInsertErr)
            return res.status(500).json({ error: 'supabase_ledger_insert_failed' })
        }

        const { error: txInsertErr } = await supabase.from('transactions').insert([
            {
                steam_id: steamId,
                type: 'deposit',
                ff_before: oldBalance,
                ff_after: oldBalance + Number(ffAmount),
                created_at: nowIso,
            },
        ])
        if (txInsertErr) {
            console.error('Supabase tx insert error:', txInsertErr)
            return res.status(500).json({ error: 'supabase_tx_insert_failed' })
        }

        // --- Create SmartBill invoice (Basic Auth + XML) ---
        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] })
            console.log('Stripe line items:', JSON.stringify(lineItems, null, 2))

            const customer = session.customer_details
            const clientEmail = customer?.email || session.customer_email || undefined

            const productsXML = lineItems.data.map((li) => {
                const qty = li.quantity || 1
                const unitGross = (li.amount_total ?? 0) / 100 / qty

                let nameFromProduct: string | undefined
                const prod = li.price?.product
                if (prod && typeof prod !== 'string' && !('deleted' in prod)) {
                    nameFromProduct = (prod as Stripe.Product).name
                }

                const name = li.description || nameFromProduct || 'Item'

                return `
      <product>
        <name>${escapeXml(name)}</name>
        <quantity>${qty}</quantity>
        <price>${unitGross.toFixed(2)}</price>
        <isTaxIncluded>true</isTaxIncluded>
        <vatPercent>0</vatPercent>
      </product>`
            }).join('\n')

            const clientXML = `
      <client>
        <name>${escapeXml(customer?.name || clientEmail || 'Client')}</name>
        ${clientEmail ? `<email>${escapeXml(clientEmail)}</email>` : ''}
        ${customer?.address?.line1 || customer?.address?.line2 ? `<address>${escapeXml([customer?.address?.line1, customer?.address?.line2].filter(Boolean).join(', '))}</address>` : ''}
        ${customer?.address?.city ? `<city>${escapeXml(customer?.address?.city)}</city>` : ''}
        ${customer?.address?.country ? `<country>${escapeXml(customer?.address?.country)}</country>` : ''}
      </client>`

            const issueDateRO = new Date().toLocaleDateString('ro-RO') // e.g. "01.09.2025"

            const invoiceXML = `<?xml version="1.0" encoding="UTF-8"?>
<invoice>
  <companyVatCode>${escapeXml(SMARTBILL_COMPANY_VAT)}</companyVatCode>
  <seriesName>${escapeXml(SMARTBILL_SERIES)}</seriesName>
  <issueDate>${issueDateRO}</issueDate>
  <isDraft>false</isDraft>
  <sendEmail>true</sendEmail>
  <currency>${(session.currency || 'RON').toUpperCase()}</currency>
  ${clientXML}
  <products>
    ${productsXML}
  </products>
</invoice>`

            console.log('Invoice XML being sent to SmartBill:', invoiceXML)
            const authHeader = 'Basic ' + Buffer.from(`${SMARTBILL_USER}:${SMARTBILL_TOKEN}`).toString('base64')

            const sbResp = await fetch(`${SMARTBILL_API_BASE}/invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Authorization': authHeader,
                },
                body: invoiceXML,
            })

            const txt = await sbResp.text()
            if (!sbResp.ok) {
                console.error('SmartBill error:', sbResp.status, txt)
                return res.status(502).json({ ok: false, smartbill_error: txt })
            }

            return res.status(200).json({ received: true, smartbill: txt.slice(0, 500) })
        } catch (e: any) {
            console.error('SmartBill invocation failed:', e?.message || e)
            return res.status(502).json({ ok: false, error: 'smartbill_call_failed', message: e?.message })
        }
    }

    return res.status(200).json({ received: true })
}

