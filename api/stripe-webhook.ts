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
const SMARTBILL_TOKEN = process.env.SMARTBILL_TOKEN!
const SMARTBILL_COMPANY_VAT = process.env.SMARTBILL_COMPANY_VAT! // e.g. RO12345678 (CUI)
const SMARTBILL_SERIES = process.env.SMARTBILL_SERIES ?? 'FP'
const SMARTBILL_API_BASE = process.env.SMARTBILL_API_BASE ?? 'https://ws.smartbill.ro/SBORO/api'

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

        // --- Create SmartBill invoice (VAT 0%, SmartBill emails the PDF) ---
        try {
            // Expand line items to build invoice products
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] })

            const customer = session.customer_details
            const clientEmail = customer?.email || session.customer_email || undefined

            const invoicePayload = {
                companyVatCode: SMARTBILL_COMPANY_VAT,
                seriesName: SMARTBILL_SERIES,
                issueDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
                isDraft: false,
                sendEmail: true, // SmartBill will email the PDF to the client
                client: {
                    name: customer?.name || clientEmail || 'Client',
                    email: clientEmail,
                    address: [customer?.address?.line1, customer?.address?.line2].filter(Boolean).join(', ') || undefined,
                    city: customer?.address?.city || undefined,
                    country: customer?.address?.country || undefined,
                },
                currency: session.currency?.toUpperCase(),
                products: lineItems.data.map((li) => {
                    const qty = li.quantity || 1
                    const unitGross = (li.amount_total ?? 0) / 100 / qty // Stripe amounts are in minor units

                    // Safely extract product name/code from Stripe types: string | Product | DeletedProduct
                    let nameFromProduct: string | undefined
                    let codeFromProduct: string | undefined
                    const prod = li.price?.product
                    if (prod && typeof prod !== 'string') {
                        // prod is Product | DeletedProduct
                        if ('deleted' in prod && (prod as Stripe.DeletedProduct).deleted) {
                            // Deleted products don't have a name
                            codeFromProduct = prod.id
                        } else {
                            nameFromProduct = (prod as Stripe.Product).name
                            codeFromProduct = prod.id
                        }
                    }

                    return {
                        name: li.description || nameFromProduct || 'Item',
                        code: codeFromProduct,
                        quantity: qty,
                        price: unitGross,
                        isTaxIncluded: true,
                        vatPercent: 0, // you are not VAT-registered yet
                    }
                }),
            }

            const sbResp = await fetch(`${SMARTBILL_API_BASE}/invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SMARTBILL_TOKEN}`,
                },
                body: JSON.stringify(invoicePayload),
            })

            if (!sbResp.ok) {
                const txt = await sbResp.text()
                console.error('SmartBill error:', sbResp.status, txt)
                return res.status(502).json({ ok: false, smartbill_error: txt })
            }

            const sbData = await sbResp.json().catch(() => null)

            return res.status(200).json({ received: true, smartbill: sbData })
        } catch (e: any) {
            console.error('SmartBill invocation failed:', e?.message || e)
            return res.status(502).json({ ok: false, error: 'smartbill_call_failed', message: e?.message })
        }
    }

    return res.status(200).json({ received: true })
}
