import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn('STRIPE_SECRET_KEY not set. Stripe will not function.');
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
