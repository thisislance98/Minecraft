import { Router, Request, Response } from 'express';
import { db, auth } from '../config';
import * as admin from 'firebase-admin';
import { logError } from '../utils/logger';

const router = Router();

// Admin email for authorization
const ADMIN_EMAIL = 'thisislance98@gmail.com';

// --- Types ---
interface Announcement {
    id?: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'update';
    title?: string;
    active: boolean;
    createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
    expiresAt?: admin.firestore.Timestamp | number | null;
}

// GET /api/announcements - Fetch active announcements
router.get('/', async (req: Request, res: Response) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        // Get all announcements (simple query without composite index requirement)
        // Then filter and sort in memory
        const snapshot = await db.collection('announcements')
            .limit(50)
            .get();

        const now = Date.now();
        const announcements = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as admin.firestore.Timestamp)?.toMillis() || Date.now()
            }))
            .filter(ann => {
                // Only active announcements
                if (!ann.active) return false;
                // Filter out expired announcements
                if (ann.expiresAt && typeof ann.expiresAt === 'number' && ann.expiresAt < now) {
                    return false;
                }
                return true;
            })
            // Sort by createdAt descending (newest first)
            .sort((a, b) => (b.createdAt as number) - (a.createdAt as number))
            .slice(0, 10); // Limit to 10

        res.json({ announcements });

    } catch (error: any) {
        console.error('[Announcements] Get announcements error:', error);
        logError('Announcements:Get', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/announcements - Create a new announcement (admin only)
router.post('/', async (req: Request, res: Response) => {
    try {
        const { message, type = 'info', title, expiresInHours } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.split('Bearer ')[1];

        if (!auth) return res.status(503).json({ error: 'Auth service unavailable' });
        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        // Verify token and check admin
        const decodedToken = await auth.verifyIdToken(token);
        if (decodedToken.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const newAnnouncement: Announcement = {
            message: message.trim(),
            type: type as Announcement['type'],
            title: title?.trim() || null,
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresInHours ? Date.now() + (expiresInHours * 60 * 60 * 1000) : null
        };

        const docRef = await db.collection('announcements').add(newAnnouncement);

        console.log(`[Announcements] Admin ${decodedToken.email} created announcement: ${docRef.id}`);

        res.json({
            success: true,
            id: docRef.id,
            announcement: { id: docRef.id, ...newAnnouncement, createdAt: Date.now() }
        });

    } catch (error: any) {
        console.error('[Announcements] Create announcement error:', error);
        logError('Announcements:Create', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/announcements/:id - Deactivate an announcement (admin only)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.split('Bearer ')[1];

        if (!auth) return res.status(503).json({ error: 'Auth service unavailable' });
        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        // Verify token and check admin
        const decodedToken = await auth.verifyIdToken(token);
        if (decodedToken.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        // Soft delete - just set active to false
        await db.collection('announcements').doc(id).update({ active: false });

        console.log(`[Announcements] Admin ${decodedToken.email} deactivated announcement: ${id}`);

        res.json({ success: true });

    } catch (error: any) {
        console.error('[Announcements] Delete announcement error:', error);
        logError('Announcements:Delete', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export const announcementRoutes = router;
