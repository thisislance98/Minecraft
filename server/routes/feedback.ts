import { Router, Request, Response } from 'express';
import { db } from '../config';
import * as admin from 'firebase-admin';

const router = Router();

interface FeedbackItem {
    id?: string;
    type: 'bug' | 'feature';
    title: string;
    description?: string;
    userId: string;
    votes: number;
    votedBy: string[];
    status: 'open' | 'in-progress' | 'completed';
    createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

// Get all feedback items
router.get('/', async (req: Request, res: Response) => {
    try {
        if (!db) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        const snapshot = await db.collection('feedback')
            .orderBy('votes', 'desc')
            .limit(50)
            .get();

        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ items });
    } catch (error: any) {
        console.error('[Feedback] Get feedback error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// Submit new feedback
router.post('/', async (req: Request, res: Response) => {
    try {
        const { type, title, description, userId } = req.body;

        if (!db) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        if (!title || !type) {
            return res.status(400).json({ error: 'Missing title or type' });
        }

        if (!['bug', 'feature'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be "bug" or "feature"' });
        }

        const feedbackItem: Omit<FeedbackItem, 'id'> = {
            type,
            title: title.trim(),
            description: description?.trim() || '',
            userId: userId || 'anonymous',
            votes: 1,
            votedBy: userId ? [userId] : [],
            status: 'open',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('feedback').add(feedbackItem);

        res.json({
            success: true,
            id: docRef.id,
            message: 'Feedback submitted successfully'
        });
    } catch (error: any) {
        console.error('[Feedback] Submit feedback error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// Vote/Unvote on feedback
router.post('/:id/vote', async (req: Request, res: Response) => {
    try {
        const feedbackId = req.params.id;
        const { userId } = req.body;

        if (!db) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }

        if (!userId) {
            return res.status(401).json({ error: 'Must be logged in to vote' });
        }

        const feedbackRef = db.collection('feedback').doc(feedbackId);
        const doc = await feedbackRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const data = doc.data() as FeedbackItem;
        const votedBy = data.votedBy || [];

        if (votedBy.includes(userId)) {
            // User already voted, remove vote
            await feedbackRef.update({
                votes: admin.firestore.FieldValue.increment(-1),
                votedBy: admin.firestore.FieldValue.arrayRemove(userId)
            });
            res.json({ success: true, action: 'unvoted' });
        } else {
            // Add vote
            await feedbackRef.update({
                votes: admin.firestore.FieldValue.increment(1),
                votedBy: admin.firestore.FieldValue.arrayUnion(userId)
            });
            res.json({ success: true, action: 'voted' });
        }
    } catch (error: any) {
        console.error('[Feedback] Vote error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

export const feedbackRoutes = router;
