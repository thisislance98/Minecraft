/**
 * Admin Socket Event Handlers
 *
 * Handles admin-only operations like deleting creatures, items, and announcements.
 * All handlers require Firebase auth token verification.
 */

import { Socket, Server } from 'socket.io';
import { Auth } from 'firebase-admin/auth';
import { deleteCreature, archiveAllCreatures, createCreature, getAllCreatures, updateCreature, getCreature } from '../services/DynamicCreatureService';
import { deleteItem, getAllItems, updateItem, getItem } from '../services/DynamicItemService';

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

    // Archive all creatures (move from dynamic_creatures to dynamic_creatures_archive)
    socket.on('admin:archive_creatures', async (data: { token: string }) => {
        console.log(`[Admin] Received admin:archive_creatures event from ${socket.id}`);
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} archiving all creatures`);

            const result = await archiveAllCreatures();
            console.log('[Admin] Archive creatures result:', result);

            socket.emit('admin:archive_creatures:result', result);

            if (result.errors.length > 0) {
                socket.emit('admin:error', { message: `Archive completed with ${result.errors.length} errors` });
            }
        } catch (error: any) {
            console.error('[Admin] Archive creatures failed:', error);
            socket.emit('admin:archive_creatures:result', { archived: 0, errors: [error.message] });
            socket.emit('admin:error', { message: error.message });
        }
    });

    // Create new creature
    socket.on('admin:create_creature', async (data: { definition: any; token: string }) => {
        console.log(`[Admin] Received admin:create_creature event from ${socket.id}`);
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} creating creature: ${data.definition.name}`);

            const result = await createCreature(data.definition);
            console.log('[Admin] Create creature result:', result);

            socket.emit('admin:create_creature:result', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Create creature failed:', error);
            socket.emit('admin:create_creature:result', { success: false, error: error.message });
            socket.emit('admin:error', { message: error.message });
        }
    });

    // List all creatures (for editing)
    socket.on('admin:list_creatures', async (data: { worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:list_creatures event from ${socket.id}`);
        try {
            await verifyAdmin(auth, data.token, adminEmail);
            const creatures = getAllCreatures(data.worldId);
            // Return simplified list for selection (without full code)
            const list = creatures.map(c => ({
                name: c.name,
                description: c.description,
                worldId: c.worldId,
                createdAt: c.createdAt
            }));
            socket.emit('admin:list_creatures:result', { success: true, creatures: list });
        } catch (error: any) {
            console.error('[Admin] List creatures failed:', error);
            socket.emit('admin:list_creatures:result', { success: false, error: error.message });
        }
    });

    // Get single creature with full code (for editing)
    socket.on('admin:get_creature', async (data: { name: string; worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:get_creature event from ${socket.id}:`, { name: data.name });
        try {
            await verifyAdmin(auth, data.token, adminEmail);
            const creature = getCreature(data.name, data.worldId);
            if (creature) {
                socket.emit('admin:get_creature:result', { success: true, creature });
            } else {
                socket.emit('admin:get_creature:result', { success: false, error: 'Creature not found' });
            }
        } catch (error: any) {
            console.error('[Admin] Get creature failed:', error);
            socket.emit('admin:get_creature:result', { success: false, error: error.message });
        }
    });

    // Update existing creature
    socket.on('admin:update_creature', async (data: { name: string; updates: any; worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:update_creature event from ${socket.id}:`, { name: data.name });
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} updating creature: ${data.name}`);

            const result = await updateCreature(data.name, data.updates, data.worldId);
            console.log('[Admin] Update creature result:', result);

            socket.emit('admin:update_creature:result', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Update creature failed:', error);
            socket.emit('admin:update_creature:result', { success: false, error: error.message });
            socket.emit('admin:error', { message: error.message });
        }
    });

    // List all items (for editing)
    socket.on('admin:list_items', async (data: { worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:list_items event from ${socket.id}`);
        try {
            await verifyAdmin(auth, data.token, adminEmail);
            const items = getAllItems(data.worldId);
            // Return simplified list for selection (without full code)
            const list = items.map(i => ({
                name: i.name,
                description: i.description,
                worldId: i.worldId,
                createdAt: i.createdAt
            }));
            socket.emit('admin:list_items:result', { success: true, items: list });
        } catch (error: any) {
            console.error('[Admin] List items failed:', error);
            socket.emit('admin:list_items:result', { success: false, error: error.message });
        }
    });

    // Get single item with full code (for editing)
    socket.on('admin:get_item', async (data: { name: string; worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:get_item event from ${socket.id}:`, { name: data.name });
        try {
            await verifyAdmin(auth, data.token, adminEmail);
            const item = getItem(data.name, data.worldId);
            if (item) {
                socket.emit('admin:get_item:result', { success: true, item });
            } else {
                socket.emit('admin:get_item:result', { success: false, error: 'Item not found' });
            }
        } catch (error: any) {
            console.error('[Admin] Get item failed:', error);
            socket.emit('admin:get_item:result', { success: false, error: error.message });
        }
    });

    // Update existing item
    socket.on('admin:update_item', async (data: { name: string; updates: any; worldId?: string; token: string }) => {
        console.log(`[Admin] Received admin:update_item event from ${socket.id}:`, { name: data.name });
        try {
            const email = await verifyAdmin(auth, data.token, adminEmail);
            console.log(`[Admin] User ${email} updating item: ${data.name}`);

            const result = await updateItem(data.name, data.updates, data.worldId);
            console.log('[Admin] Update item result:', result);

            socket.emit('admin:update_item:result', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Update item failed:', error);
            socket.emit('admin:update_item:result', { success: false, error: error.message });
            socket.emit('admin:error', { message: error.message });
        }
    });
}
