import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buffer } from 'micro'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const sig = req.headers['stripe-signature']!
    const buf = await buffer(req)

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

        const { data: allLedger } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamId)

        const oldBalance = allLedger?.reduce((sum, row) => sum + row.amount, 0) ?? 0

        await supabase.from('ff_ledger').insert([
            {
                steam_id: steamId,
                amount: Number(ffAmount),
                type: 'deposit',
                refrence: 'deposit',
            },
        ])

        await supabase.from('transactions').insert([
            {
                steam_id: steamId,
                type: 'deposit',
                ff_before: oldBalance,
                ff_after: oldBalance + Number(ffAmount),
            },
        ])
    }

    res.status(200).json({ received: true })
}
