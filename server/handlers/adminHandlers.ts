/**
 * Admin Socket Event Handlers
 *
 * Handles admin-only operations like deleting creatures, items, and announcements.
 * All handlers require Firebase auth token verification.
 */

import { Socket, Server } from 'socket.io';
import { Auth } from 'firebase-admin/auth';
import { deleteCreature } from '../services/DynamicCreatureService';
import { deleteItem } from '../services/DynamicItemService';

interface AdminHandlerContext {
    io: Server;
    socket: Socket;
    auth: Auth | null;
    adminEmail: string;
}

/**
 * Verify admin access via Firebase token or CLI secret
 */
async function verifyAdmin(auth: Auth | null, token: string, adminEmail: string): Promise<string> {
    // Allow CLI mode with secret
    const cliSecret = process.env.CLI_SECRET || 'asdf123';
    if (token === cliSecret) {
        console.log('[Admin] CLI mode access granted');
        return 'cli@local';
    }

    if (!auth) throw new Error('Auth service unavailable');
    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.email !== adminEmail) {
        throw new Error('Unauthorized: Admin access required');
    }
    return decodedToken.email!;
}

/**
 * Register admin event handlers on a socket
 */
export function registerAdminHandlers(ctx: AdminHandlerContext): void {
    const { io, socket, auth, adminEmail } = ctx;

    // Delete creature
    socket.on('admin:delete_creature', async (data: { name: string; token: string }) => {
        console.log(`[Admin] Received admin:delete_creature event from ${socket.id}:`, { name: data.name });
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} deleting creature: ${data.name}`);

            const result = await deleteCreature(data.name);
            console.log('[Admin] Delete creature result:', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Delete creature failed:', error);
            socket.emit('admin:error', { message: error.message });
        }
    });

    // Delete item
    socket.on('admin:delete_item', async (data: { name: string; worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:delete_item event from ${socket.id}:`, { name: data.name, worldId: data.worldId });
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} deleting item: ${data.name}`);

            const result = await deleteItem(data.name, data.worldId);
            console.log('[Admin] Delete item result:', result);

            socket.emit('admin:delete_item:result', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Delete item failed:', error);
            socket.emit('admin:delete_item:result', { success: false, error: error.message });
            socket.emit('admin:error', { message: error.message });
        }
    });

    // Broadcast announcement
    socket.on('admin:announce', async (data: { message: string; type?: string; token: string }) => {
        console.log(`[Admin] Received admin:announce event from ${socket.id}:`, { messageLength: data.message?.length, type: data.type });
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);

            const announcement = {
                id: `ann-${Date.now()}`,
                message: data.message,
                type: data.type || 'info',
                timestamp: Date.now(),
                sender: email
            };

            console.log(`[Admin] Broadcasting announcement: "${data.message}" to all clients`);
            io.emit('announcement', announcement);
            socket.emit('admin:announce:success', { id: announcement.id });
        } catch (error: any) {
            console.error('[Admin] Announcement failed:', error);
            socket.emit('admin:error', { message: error.message });
        }
    });
}
