import { Router, Request, Response } from 'express';
import { db } from '../config';
import * as admin from 'firebase-admin';

const router = Router();

// Create a new destination
router.post('/', async (req: Request, res: Response) => {
    try {
        const { x, y, z, userId } = req.body;

        if (!db) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        if (x === undefined || y === undefined || z === undefined) {
            return res.status(400).json({ error: 'Missing coordinates' });
        }

        const docRef = await db.collection('destinations').add({
            x,
            y,
            z,
            userId: userId || 'anonymous',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ id: docRef.id });
    } catch (error: any) {
        console.error('[Destinations] Create error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get a destination by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!db) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        const doc = await db.collection('destinations').doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Destination not found' });
        }

        const data = doc.data();
        res.json({ x: data?.x, y: data?.y, z: data?.z });
    } catch (error: any) {
        console.error('[Destinations] Get error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export const destinationRoutes = router;
