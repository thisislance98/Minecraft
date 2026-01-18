import { Router, Request, Response } from 'express';
import { stripe, stripeWebhookSecret, config, db } from '../config';
import { addTokens } from '../services/tokenService';
import { FieldValue } from 'firebase-admin/firestore';
import express from 'express';
import { logError } from '../utils/logger';

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
        logError('Stripe:Checkout', error);
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
        console.log(`[Stripe Webhook] Event type: ${event.type}`);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any;
            const { userId, packageId } = session.metadata || {};

            console.log(`[Stripe Webhook] Checkout completed - userId: ${userId}, packageId: ${packageId}`);
            console.log(`[Stripe Webhook] Session payment_status: ${session.payment_status}`);

            if (userId && packageId) {
                const tokenPackage = TOKEN_PACKAGES[packageId];
                const subscriptionTier = SUBSCRIPTION_TIERS[packageId];

                if (tokenPackage) {
                    // One-time token purchase
                    console.log(`[Stripe Webhook] Adding ${tokenPackage.tokens} tokens to user ${userId}`);
                    await addTokens(userId, tokenPackage.tokens, 'purchase', `Purchased ${tokenPackage.name}`);
                    console.log(`[Stripe Webhook] Tokens added successfully`);
                } else if (subscriptionTier) {
                    // Subscription - tokens are added on invoice.paid, but grant initial tokens on trial start
                    console.log(`[Stripe Webhook] Subscription ${packageId} started for user ${userId}`);
                    // If this is a trial, grant tokens immediately
                    if (session.subscription) {
                        console.log(`[Stripe Webhook] Subscription ID: ${session.subscription}`);
                    }
                }
            } else {
                console.warn(`[Stripe Webhook] Missing metadata - userId: ${userId}, packageId: ${packageId}`);
            }
        } else if (event.type === 'invoice.paid') {
            // Handle subscription invoice payment (recurring billing)
            const invoice = event.data.object as any;
            console.log(`[Stripe Webhook] Invoice paid for customer: ${invoice.customer}`);

            // Look up user by Stripe customer ID
            if (db && invoice.customer) {
                const usersSnapshot = await db.collection('users')
                    .where('subscription.stripeCustomerId', '==', invoice.customer)
                    .limit(1)
                    .get();

                if (!usersSnapshot.empty) {
                    const userDoc = usersSnapshot.docs[0];
                    const userId = userDoc.id;

                    // Get subscription tier from line items or metadata
                    const lineItem = invoice.lines?.data?.[0];
                    const productName = lineItem?.description || '';

                    // Match the product name to our tiers
                    let tokensToAdd = 0;
                    for (const [, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
                        if (productName.includes(tier.name.split(' - ')[0])) {
                            tokensToAdd = tier.monthlyTokens;
                            break;
                        }
                    }

                    if (tokensToAdd > 0) {
                        console.log(`[Stripe Webhook] Adding ${tokensToAdd} subscription tokens to user ${userId}`);
                        await addTokens(userId, tokensToAdd, 'subscription', `Monthly subscription tokens`);
                    }
                } else {
                    console.warn(`[Stripe Webhook] No user found for customer: ${invoice.customer}`);
                }
            }
        } else if (event.type === 'customer.subscription.trial_will_end') {
            console.log(`[Stripe Webhook] Trial ending soon`);
        } else if (event.type === 'customer.subscription.deleted') {
            console.log(`[Stripe Webhook] Subscription cancelled`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Stripe Webhook] Handler error:', error);
        logError('Stripe:Webhook', error);
        res.status(500).send('Webhook handler error');
    }
});

export const stripeRoutes = router;
