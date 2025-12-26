import { Router, Request, Response } from 'express';
import { stripe, stripeWebhookSecret, config, db } from '../config';
import { addTokens } from '../services/tokenService';
import { FieldValue } from 'firebase-admin/firestore';
import express from 'express';

const router = Router();

// Token packages available for purchase ($1 = 1000 tokens)
const TOKEN_PACKAGES: Record<string, { tokens: number; price: number; name: string }> = {
    'tokens_1000': { tokens: 1000, price: 100, name: '1,000 Tokens' },      // $1.00
    'tokens_5000': { tokens: 5000, price: 500, name: '5,000 Tokens' },      // $5.00
    'tokens_10000': { tokens: 10000, price: 1000, name: '10,000 Tokens' },  // $10.00
};

// Subscription tiers ($1 = 1000 tokens)
const SUBSCRIPTION_TIERS: Record<string, { monthlyTokens: number; price: number; name: string; trialDays?: number }> = {
    'sub_starter': { monthlyTokens: 5000, price: 500, name: 'Starter - 5,000/month' },       // $5/mo = 5000 tokens
    'sub_pro': { monthlyTokens: 10000, price: 900, name: 'Pro - 10,000/month', trialDays: 30 }, // $9/mo = 10000 tokens - 30 day free trial
    'sub_ultra': { monthlyTokens: 30000, price: 2500, name: 'Ultra - 30,000/month' }, // $25/mo = 30000 tokens
};

router.post('/checkout', async (req: Request, res: Response) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe not initialized' });

    try {
        const { userId, packageId, successUrl, cancelUrl } = req.body;

        if (!userId || !packageId) {
            return res.status(400).json({ error: 'Missing userId or packageId' });
        }

        const tokenPackage = TOKEN_PACKAGES[packageId];
        const subscriptionTier = SUBSCRIPTION_TIERS[packageId];

        if (!tokenPackage && !subscriptionTier) {
            return res.status(400).json({ error: 'Invalid packageId' });
        }

        // Get customer ID
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        let customerId = userDoc.data()?.subscription?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({ metadata: { userId } });
            customerId = customer.id;
            await userRef.set({ subscription: { stripeCustomerId: customerId } }, { merge: true });
        }

        const sessionParams: any = {
            customer: customerId,
            payment_method_types: ['card'],
            success_url: successUrl || `${config.clientUrl}?success=true`,
            cancel_url: cancelUrl || `${config.clientUrl}?canceled=true`,
            metadata: { userId, packageId }
        };

        if (subscriptionTier) {
            sessionParams.mode = 'subscription';
            sessionParams.line_items = [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: subscriptionTier.name, description: `${subscriptionTier.monthlyTokens} tokens per month` },
                    unit_amount: subscriptionTier.price,
                    recurring: { interval: 'month' }
                },
                quantity: 1
            }];
            if (subscriptionTier.trialDays) {
                sessionParams.subscription_data = { trial_period_days: subscriptionTier.trialDays };
            }
        } else {
            sessionParams.mode = 'payment';
            sessionParams.line_items = [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: tokenPackage.name, description: `${tokenPackage.tokens} tokens` },
                    unit_amount: tokenPackage.price
                },
                quantity: 1
            }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        res.json({ sessionId: session.id, url: session.url });

    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    if (!stripe || !stripeWebhookSecret) return res.status(500).send('Stripe unconfigured');

    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any;
            const { userId, packageId } = session.metadata || {};

            if (userId && packageId) {
                const tokenPackage = TOKEN_PACKAGES[packageId];
                if (tokenPackage) {
                    await addTokens(userId, tokenPackage.tokens, 'purchase', `Purchased ${tokenPackage.name}`);
                }
            }
        }
        // Add other event handlers (invoice.paid etc) as needed following the original file

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).send('Webhook handler error');
    }
});

export const stripeRoutes = router;
