import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
// Use process.cwd() since ts-node runs from the server directory
// Try to load from current directory first (for container), then parent (for local dev)
const localEnvPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '../.env');
dotenv.config({ path: localEnvPath });
dotenv.config({ path: parentEnvPath });
console.log('[Config] Tried loading .env from:', localEnvPath, 'and', parentEnvPath);

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Initialize Firebase
try {
    const firebaseConfig: admin.AppOptions = {
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        databaseURL: process.env.FIREBASE_DATABASE_URL
    };

    if (serviceAccountPath) {
        // Use explicit key if provided
        console.log('[Config] Using provided service account key');
        firebaseConfig.credential = admin.credential.cert(serviceAccountPath);
    } else {
        // Fallback to Application Default Credentials (GCP/Cloud Run)
        console.log('[Config] Using Application Default Credentials');
        firebaseConfig.credential = admin.credential.applicationDefault();
    }

    admin.initializeApp(firebaseConfig);
    console.log('[Config] Firebase Admin initialized');
} catch (error) {
    console.error('[Config] Failed to initialize Firebase Admin:', error);
}

export const db = admin.apps.length ? admin.firestore() : null;

// Only initialize Realtime Database if URL is configured
const databaseUrl = process.env.FIREBASE_DATABASE_URL;
export const realtimeDb = admin.apps.length && databaseUrl ? admin.database() : null;
if (!databaseUrl) {
    console.warn('[Config] FIREBASE_DATABASE_URL not set - world persistence disabled');
}

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
