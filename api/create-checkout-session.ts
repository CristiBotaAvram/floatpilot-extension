import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { steamId, ffAmount } = req.body

    if (!steamId || !ffAmount) return res.status(400).json({ error: 'Missing data' })

    const priceInUSD = ffAmount / 10  // example: 50 FF = $5

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    unit_amount: priceInUSD * 100, // in cents
                    product_data: {
                        name: `${ffAmount} Credits`,
                    },
                },
                quantity: 1,
            },
        ],
        mode: 'payment',

        // ✅ Collect who is paying (so SmartBill has name/email/address)
        customer_creation: 'always',                // creates a Customer and stores details
        billing_address_collection: 'required',     // forces full billing address
        phone_number_collection: { enabled: true }, // optional but useful
        allow_promotion_codes: true,
        success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/pricing`,
        metadata: { steamId, ffAmount }
    })

    res.status(200).json({ url: session.url })
}
