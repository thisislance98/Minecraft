import { Router, Request, Response } from 'express';
import { auth, db } from '../config';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

import * as admin from 'firebase-admin';
import { logError } from '../utils/logger';

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;

        console.log('[Auth] Login request received');

        if (!auth || !db) {
            console.error('[Auth] Service unavailable: auth or db is null');
            return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        if (!idToken) {
            console.warn('[Auth] Missing ID Token');
            return res.status(400).json({ error: 'Missing ID Token' });
        }

        // Verify the ID token
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            console.error('[Auth] Token verification failed:', e);
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { uid, email, picture, name } = decodedToken;
        console.log(`[Auth] User verified: ${uid} (${email})`);

        // Create reference
        const userRef = db.collection('users').doc(uid);

        // Check if user exists to determine if we need to give initial tokens
        const userDocRef = await userRef.get();
        const userData = userDocRef.data();
        let currentTokens = userData?.tokens;

        // Give 1000 tokens to new users OR existing users with no token field
        if (currentTokens === undefined) {
            console.log(`[Auth] Initializing user ${uid} with 1000 tokens (New/Retroactive)`);
            currentTokens = 1000;
            // logic below will merge this
        }

        try {
            await userRef.set({
                email,
                displayName: name || '',
                photoURL: picture || '',
                tokens: currentTokens, // Persist the determined token count
                lastLogin: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error('[Auth] Firestore set failed:', e);
            throw e;
        }

        // Get current tokens (should be what we just set/read)
        const tokens = currentTokens;

        res.json({
            status: 'success',
            uid,
            email,
            tokens
        });

    } catch (error: any) {
        console.error('[Auth] Unexpected error during login processing:', error);
        console.error('[Auth] Error stack:', error.stack);
        if (error.code) console.error('[Auth] Error code:', error.code);
        logError('Auth:Login', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});

// Debug endpoint to check user tokens (no auth required for debugging)
router.get('/tokens/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }

        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.json({
                found: false,
                tokens: 0,
                message: 'User not found in database'
            });
        }

        const userData = userDoc.data();
        res.json({
            found: true,
            tokens: userData?.tokens || 0,
            lastLogin: userData?.lastLogin?._seconds ? new Date(userData.lastLogin._seconds * 1000).toISOString() : null,
            email: userData?.email
        });
    } catch (error: any) {
        console.error('[Auth] Token lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to list recent transactions
router.get('/transactions/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }

        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const transactions = transactionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?._seconds
                ? new Date(doc.data().createdAt._seconds * 1000).toISOString()
                : null
        }));

        res.json({
            count: transactions.length,
            transactions
        });
    } catch (error: any) {
        console.error('[Auth] Transactions lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const authRoutes = router;
