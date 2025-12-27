import { Router, Request, Response } from 'express';
import { auth, db } from '../config';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

import * as admin from 'firebase-admin';

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

        // Create or update user in Firestore
        const userRef = db.collection('users').doc(uid);

        try {
            await userRef.set({
                email,
                displayName: name || '',
                photoURL: picture || '',
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error('[Auth] Firestore set failed:', e);
            // Don't fail the login if DB write fails, but log it.
            // Or should we fail? Better to fail.
            // checking if we can at least get the user
            // If set fails, likely get will fail too.
            throw e;
        }

        // Get current tokens
        const userDoc = await userRef.get();
        const tokens = userDoc.data()?.tokens || 0;

        res.json({
            status: 'success',
            uid,
            email,
            tokens
        });

    } catch (error: any) {
        console.error('[Auth] Unexpected error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});

export const authRoutes = router;
