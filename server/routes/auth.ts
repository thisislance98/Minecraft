import { Router, Request, Response } from 'express';
import { auth, db } from '../config';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;
        if (!auth || !db) {
            return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        if (!idToken) {
            return res.status(400).json({ error: 'Missing ID Token' });
        }

        // Verify the ID token
        const decodedToken = await auth.verifyIdToken(idToken);
        const { uid, email, picture, name } = decodedToken;

        // Create or update user in Firestore
        const userRef = db.collection('users').doc(uid);

        await userRef.set({
            email,
            displayName: name || '',
            photoURL: picture || '',
            lastLogin: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

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
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

export const authRoutes = router;
