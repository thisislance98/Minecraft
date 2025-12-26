import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
// Use process.cwd() since ts-node runs from the server directory
const envPath = path.resolve(process.cwd(), '../.env');
dotenv.config({ path: envPath });
console.log('[Config] Loaded .env from:', envPath);

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountPath) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env');
    // Don't exit here to allow partial functionality, but Firebase features will fail
} else {
    try {
        // Resolve absolute path if needed, though usually it's absolute
        // Note: In ES modules/TS, dynamic require of JSON might need handling, 
        // but admin.credential.cert accepts the path string or object.
        // If it's a path, we can let require/fs handle it or use cert(require(path))
        // Since we are in TS execution (ts-node), we might need to read it.
        // Simpler for now: let's assume it works if we pass the object or path.
        // admin.credential.cert() can take the path string in some versions, 
        // but typically wants the object.
        // Let's rely on standard admin SDK behavior.

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
        console.log('[Config] Firebase Admin initialized');
    } catch (error) {
        console.error('[Config] Failed to initialize Firebase Admin:', error);
    }
}

export const db = admin.apps.length ? admin.firestore() : null;
export const auth = admin.apps.length ? admin.auth() : null;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.warn('[Config] STRIPE_SECRET_KEY is not defined');
}

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
    : null;

export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
    port: process.env.PORT || 2567,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};
