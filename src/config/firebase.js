import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config();

let firebaseApp = null;

export async function initFirebase() {
    if (firebaseApp) return firebaseApp;

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountPath) {
        console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set. Firebase not initialized.');
        return null;
    }

    try {
        const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
        console.log('Firebase initialized successfully.');
        return firebaseApp;
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        return null;
    }
}

export const getFirebase = () => firebaseApp;
