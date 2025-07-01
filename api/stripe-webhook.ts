import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const sig = req.headers['stripe-signature']!
    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${(err as any).message}`)
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const { steamId, ffAmount } = session.metadata

        // Get last FF from ledger
        const { data: lastLedger } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamId);

        const oldBalance = lastLedger?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

        // Add ledger + transaction entries
        await supabase.from('ff_ledger').insert([
            {
                steam_id: steamId,
                amount: Number(ffAmount),
                type: 'deposit',
                refrence: 'deposit'
            },
        ])

        await supabase.from('transactions').insert([
            {
                steam_id: steamId,
                type: 'deposit',
                ff_before: oldBalance || 0,
                ff_after: oldBalance + Number(ffAmount),
            },
        ])
    }

    res.status(200).json({ received: true })
}
