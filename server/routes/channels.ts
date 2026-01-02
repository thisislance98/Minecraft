import { Router, Request, Response } from 'express';
import { db } from '../config';
import { io } from '../index';
import * as admin from 'firebase-admin';

const router = Router();

// --- Types ---
interface Channel {
    id: string;
    name: string;
    description: string;
    type: 'public' | 'read-only';
    order: number;
}

interface Message {
    id?: string;
    channelId: string;
    userId: string;
    displayName?: string; // Custom display name set by user
    content: string;
    threadId?: string; // If part of a thread
    replyCount?: number; // For top-level messages
    createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
    reactions: Record<string, string[]>; // emoji -> [userIds]
}

// --- Constants ---
const DEFAULT_CHANNELS: Channel[] = [
    { id: 'general', name: 'general', description: 'General discussion', type: 'public', order: 0 },
    { id: 'announcements', name: 'announcements', description: 'Game updates and news', type: 'read-only', order: 1 },
    { id: 'ideas', name: 'ideas', description: 'Share your ideas and feature requests', type: 'public', order: 2 },
    { id: 'bugs', name: 'bugs', description: 'Report bugs and glitches', type: 'public', order: 3 },
];

// --- Routes ---

// GET /api/channels
// List all available channels
router.get('/', async (req: Request, res: Response) => {
    try {
        // For now, we return static channels. 
        // In the future, we could fetch dynamic ones from DB.
        res.json({ channels: DEFAULT_CHANNELS });
    } catch (error: any) {
        console.error('[Channels] Get channels error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/channels/:channelId/messages
// Fetch messages for a channel (or thread)
router.get('/:channelId/messages', async (req: Request, res: Response) => {
    try {
        const { channelId } = req.params;
        const { threadId, limit = '50', before } = req.query;

        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        let query = db.collection('messages')
            .where('channelId', '==', channelId)
            .orderBy('createdAt', 'desc')
            .limit(Number(limit));

        if (threadId) {
            query = query.where('threadId', '==', threadId);
        } else {
            // Only fetch top-level messages if no threadId specified
            // Note: This requires a composite index: channelId ASC, threadId ASC, createdAt DESC? 
            // OR simply store 'isReply' flag.
            // For simplicity in Firestore, we often just check for existence of threadId.
            // But 'threadId' == null query is tricky in Firestore. 
            // Easier: check current logic. 
            // We should filter for where threadId is MISSING for main channel view.
            // But Firestore doesn't support 'where field is null' easily with other filters.
            // Instead, we'll assume the client filters or we use a separate 'root' collection or a flag.
            // Let's rely on 'threadId' being absent or empty string?
            // Actually, best practice: store 'threadId': null explicitly? No.
            // Let's add a 'isReply' boolean to the message.
        }

        // TEMPORARY HACK: Just fetch all and filter in memory if volume is low, 
        // OR better: use a 'isReply' field in the future.
        // For now, let's assume all messages in a channel are fetched, client nests them?
        // No, that's bad for perf.

        // Let's refine the query:
        // We will store 'threadId' only for replies. 
        // Queries for main channel: where('channelId', '==', cid).where('threadId', '==', null) ??
        // Firestore doesn't do '== null'. 
        // Solution: Top level messages have `threadId: 'main'` or similar? 
        // OR we just index everything by channel and client sorts it out for MVP.
        // Let's use `threadId` is UNSET for main messages. 
        // But we can't query "field doesn't exist".
        // SO: We will require top-level messages to have `threadId: null` field explicitly? No.
        // We will just return ALL messages for now (sorted by time) and client filters replies?
        // No, that breaks pagination.

        // CORRECT APPROACH:
        // Top level messages: `threadId` is NOT set.
        // Replies: `threadId` IS set.
        // Query for top level: We need a field `parentId` (or threadId).
        // Let's add `parentId: 'root'` for top level? 

        // Let's stick to: We filter by channelId. We DO NOT filter by threadId in the backend query for V1, 
        // unless provided. 
        // If the user asks for a specific thread, we filter by that threadId.
        // If looking at main channel, we might get replies too. Ideally we filter them out.
        // Let's just return everything for the channel for this MVP step 
        // and let the client organize threads visually if they load them all.
        // Optimization: Add 'isReply': false to top level messages.

        if (before) {
            const beforeDoc = await db.collection('messages').doc(String(before)).get();
            if (beforeDoc.exists) {
                query = query.startAfter(beforeDoc);
            }
        }

        const snapshot = await query.get();
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as admin.firestore.Timestamp)?.toMillis() || Date.now()
        }));

        res.json({ messages: messages.reverse() }); // Return oldest first for chat flow? Usually UI wants newest at bottom.
    } catch (error: any) {
        console.error('[Channels] Get messages error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/channels/:channelId/messages
// Post a message or reply
router.post('/:channelId/messages', async (req: Request, res: Response) => {
    try {
        const { channelId } = req.params;
        const { userId, content, threadId, displayName } = req.body;

        if (!db) return res.status(503).json({ error: 'Database service unavailable' });
        if (!content || !userId) return res.status(400).json({ error: 'Missing content or userId' });

        const newMessage: Message = {
            channelId,
            userId,
            displayName: displayName || undefined, // Store display name if provided
            content: content.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            reactions: {}
        };

        if (threadId) {
            newMessage.threadId = threadId;
            // Optionally update parent message reply count here
        }

        const docRef = await db.collection('messages').add(newMessage);

        // If it's a thread reply, update the parent message's reply count
        if (threadId) {
            await db.collection('messages').doc(threadId).update({
                replyCount: admin.firestore.FieldValue.increment(1)
            }).catch(e => console.warn('Failed to update reply count', e));
        }

        // Broadcast the full message object so clients can append it directly
        // We need to construct the full object or refetch it. 
        // Constructing is faster.
        const msgToBroadcast: Message = {
            id: docRef.id,
            ...newMessage,
            // @ts-ignore - Timestamp handling (client expects millis usually, or raw object)
            // Firestore timestamp to millis for client consistency
            createdAt: Date.now()
        };

        io.to(`channel:${channelId}`).emit('chat:message', msgToBroadcast);

        res.json({ success: true, id: docRef.id });
    } catch (error: any) {
        console.error('[Channels] Post message error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/messages/:messageId/react
// Toggle reaction
router.post('/messages/:messageId/react', async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        // userId and emoji in body
        // emoji might be ':thumbsup:' etc.
        const { userId, emoji } = req.body;

        if (!db) return res.status(503).json({ error: 'Database service unavailable' });

        const msgRef = db.collection('messages').doc(messageId);
        const msg = await msgRef.get();

        if (!msg.exists) return res.status(404).json({ error: 'Message not found' });

        const data = msg.data() as Message;
        const currentReactions = data.reactions || {};
        const userList = currentReactions[emoji] || [];

        let action = 'added';
        if (userList.includes(userId)) {
            // Remove
            const newList = userList.filter(u => u !== userId);
            if (newList.length === 0) {
                delete currentReactions[emoji];
            } else {
                currentReactions[emoji] = newList;
            }
            action = 'removed';
        } else {
            // Add
            if (!currentReactions[emoji]) currentReactions[emoji] = [];
            currentReactions[emoji].push(userId);
        }

        await msgRef.update({ reactions: currentReactions });

        res.json({ success: true, action, reactions: currentReactions });

    } catch (error: any) {
        console.error('[Channels] Reaction error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export const channelRoutes = router;
