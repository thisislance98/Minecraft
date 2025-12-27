/**
 * WorldPersistence Service
 * 
 * Handles persistent storage of world block changes using Firebase Realtime Database.
 * Only stores diffs from the seed-generated terrain, not the entire world.
 */

import { realtimeDb } from '../config';

// Batch writes to avoid Firebase rate limits
interface PendingWrite {
    roomId: string;
    key: string;
    blockType: string | null;
}

interface PendingEntityWrite {
    roomId: string;
    entityId: string;
    data: any | null; // null for deletion
}

interface PendingSignWrite {
    roomId: string;
    key: string;
    text: string;
}

// Hardcode a global world ID so all rooms share the same persistent world
const GLOBAL_WORLD_ID = 'global-world';

class WorldPersistenceService {
    private writeQueue: PendingWrite[] = [];
    private entityWriteQueue: PendingEntityWrite[] = [];
    private signWriteQueue: PendingSignWrite[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL_MS = 500; // Batch writes every 500ms

    /**
     * Save a block change to Firebase RTDB
     * @param roomId - The room ID (IGNORED - using global world)
     * @param x - Block X coordinate
     * @param y - Block Y coordinate
     * @param z - Block Z coordinate
     * @param blockType - The block type (null for air/deleted)
     */
    async saveBlockChange(roomId: string, x: number, y: number, z: number, blockType: string | null): Promise<void> {
        // Use global ID
        const targetId = GLOBAL_WORLD_ID;

        console.log(`[WorldPersistence DEBUG] saveBlockChange called for room ${roomId} (mapped to ${targetId}), block at (${x},${y},${z}) type:${blockType}`);
        if (!realtimeDb) {
            // Silently skip when RTDB not configured (warning is logged once at startup)
            console.log(`[WorldPersistence DEBUG] realtimeDb is NULL - skipping save`);
            return;
        }

        const key = `${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)}`;

        // Add to write queue using globally shared ID
        this.writeQueue.push({ roomId: targetId, key, blockType });

        // Schedule flush if not already scheduled
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    /**
     * Flush pending writes to Firebase in a batch
     */
    private async flushWrites(): Promise<void> {
        this.flushTimer = null;

        await this.flushBlockWrites();
        await this.flushEntityWrites();
        await this.flushSignWrites();
    }

    private async flushBlockWrites(): Promise<void> {
        if (this.writeQueue.length === 0) return;

        const writes = [...this.writeQueue];
        this.writeQueue = [];

        // Group by room for efficient batching
        const byRoom = new Map<string, Map<string, string | null>>();
        for (const { roomId, key, blockType } of writes) {
            if (!byRoom.has(roomId)) {
                byRoom.set(roomId, new Map());
            }
            byRoom.get(roomId)!.set(key, blockType);
        }

        // Execute batched writes per room
        for (const [roomId, blocks] of byRoom) {
            try {
                const updates: Record<string, string | null> = {};
                for (const [key, blockType] of blocks) {
                    // Convert null (air/deletion) to explicit "AIR" string so we persist the removal
                    // Otherwise Firebase just deletes the key, and we fall back to seed terrain
                    updates[`rooms/${roomId}/blocks/${key}`] = blockType === null ? 'AIR' : blockType;
                }

                await realtimeDb!.ref().update(updates);
                console.log(`[WorldPersistence] Saved ${blocks.size} block(s) for room ${roomId}`);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save blocks for room ${roomId}:`, error);
            }
        }
    }

    /**
     * Get all block changes for a room
     * @param roomId - The room ID (IGNORED - using global world)
     * @returns Map of "x_y_z" -> blockType
     */
    async getBlockChanges(roomId: string): Promise<Map<string, string | null>> {
        // Use global ID
        const targetId = GLOBAL_WORLD_ID;

        const result = new Map<string, string | null>();

        if (!realtimeDb) {
            // Silently return empty when RTDB not configured (warning is logged once at startup)
            return result;
        }

        try {
            const snapshot = await realtimeDb.ref(`rooms/${targetId}/blocks`).get();

            if (snapshot.exists()) {
                const data = snapshot.val() as Record<string, string | null>;
                for (const [key, blockType] of Object.entries(data)) {
                    // Convert stored "AIR" back to null (what client expects)
                    if (blockType === 'AIR') {
                        result.set(key, null);
                    } else {
                        result.set(key, blockType);
                    }
                }
                console.log(`[WorldPersistence] Loaded ${result.size} block change(s) for room ${roomId} (from ${targetId})`);
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to load blocks for room ${roomId} (target: ${targetId}):`, error);
        }

        return result;
    }

    /**
     * Save room metadata (world seed, created time, etc.)
     */
    async saveRoomMetadata(roomId: string, worldSeed: number): Promise<void> {
        // Metadata might still differ per room?
        // User said "all room should have the same world".
        // But players are distinct per room.
        // Let's keep metadata per room for now as it tracks room creation, 
        // but blocks are global.
        if (!realtimeDb) return;

        try {
            await realtimeDb.ref(`rooms/${roomId}/metadata`).set({
                worldSeed,
                createdAt: Date.now()
            });
            console.log(`[WorldPersistence] Saved metadata for room ${roomId}`);
        } catch (error) {
            console.error(`[WorldPersistence] Failed to save room metadata:`, error);
        }
    }

    /**
     * Get room metadata including world seed
     */
    async getRoomMetadata(roomId: string): Promise<{ worldSeed: number; createdAt: number } | null> {
        if (!realtimeDb) return null;

        try {
            const snapshot = await realtimeDb.ref(`rooms/${roomId}/metadata`).get();
            if (snapshot.exists()) {
                return snapshot.val();
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to get room metadata:`, error);
        }

        return null;
    }

    /**
     * Delete room data (for cleanup)
     */
    async deleteRoom(roomId: string): Promise<void> {
        if (!realtimeDb) return;

        try {
            await realtimeDb.ref(`rooms/${roomId}`).remove();
            console.log(`[WorldPersistence] Deleted data for room ${roomId}`);
        } catch (error) {
            console.error(`[WorldPersistence] Failed to delete room:`, error);
        }
    }

    /**
     * Save/Update an entity
     */
    async saveEntity(roomId: string, entityId: string, data: any): Promise<void> {
        const targetId = GLOBAL_WORLD_ID;
        // console.log(`[WorldPersistence] saveEntity called for ${entityId}`);
        if (!realtimeDb) return;

        this.entityWriteQueue.push({ roomId: targetId, entityId, data });

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    private async flushEntityWrites(): Promise<void> {
        if (this.entityWriteQueue.length === 0) return;

        const writes = [...this.entityWriteQueue];
        this.entityWriteQueue = [];

        const byRoom = new Map<string, Map<string, any>>();
        for (const { roomId, entityId, data } of writes) {
            if (!byRoom.has(roomId)) {
                byRoom.set(roomId, new Map());
            }
            byRoom.get(roomId)!.set(entityId, data);
        }

        for (const [roomId, entities] of byRoom) {
            try {
                const updates: Record<string, any> = {};
                for (const [entityId, data] of entities) {
                    updates[`rooms/${roomId}/entities/${entityId}`] = data;
                }
                await realtimeDb!.ref().update(updates);
                console.log(`[WorldPersistence] Saved ${entities.size} entity updates for room ${roomId}`);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save entities for room ${roomId}:`, error);
            }
        }
    }

    /**
     * Get all entities for a room
     */
    async getEntities(roomId: string): Promise<Map<string, any>> {
        const targetId = GLOBAL_WORLD_ID;
        const result = new Map<string, any>();
        if (!realtimeDb) return result;

        try {
            const snapshot = await realtimeDb.ref(`rooms/${targetId}/entities`).get();
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const [id, entityData] of Object.entries(data)) {
                    result.set(id, entityData);
                }
                console.log(`[WorldPersistence] Loaded ${result.size} entities for room ${roomId}`);
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to load entities:`, error);
        }
        return result;
    }
    async saveSignText(roomId: string, x: number, y: number, z: number, text: string): Promise<void> {
        const targetId = GLOBAL_WORLD_ID;
        if (!realtimeDb) return;

        const key = `${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)}`;
        this.signWriteQueue.push({ roomId: targetId, key, text });

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    private async flushSignWrites(): Promise<void> {
        if (this.signWriteQueue.length === 0) return;

        const writes = [...this.signWriteQueue];
        this.signWriteQueue = [];

        const byRoom = new Map<string, Map<string, string>>();
        for (const { roomId, key, text } of writes) {
            if (!byRoom.has(roomId)) byRoom.set(roomId, new Map());
            byRoom.get(roomId)!.set(key, text);
        }

        for (const [roomId, signs] of byRoom) {
            try {
                const updates: Record<string, string> = {};
                for (const [key, text] of signs) {
                    updates[`rooms/${roomId}/signs/${key}`] = text;
                }
                await realtimeDb!.ref().update(updates);
                console.log(`[WorldPersistence] Saved ${signs.size} signs for room ${roomId}`);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save signs:`, error);
            }
        }
    }

    async getSignTexts(roomId: string): Promise<Map<string, string>> {
        const targetId = GLOBAL_WORLD_ID;
        const result = new Map<string, string>();
        if (!realtimeDb) return result;

        try {
            const snapshot = await realtimeDb.ref(`rooms/${targetId}/signs`).get();
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const [key, text] of Object.entries(data)) {
                    result.set(key, text as string);
                }
            }
        } catch (error) {
            console.error('Failed to get signs:', error);
        }
        return result;
    }

    /**
     * Reset the entire world - clears all blocks, entities, and signs
     * @returns Promise that resolves when reset is complete
     */
    async resetWorld(): Promise<void> {
        if (!realtimeDb) {
            console.log('[WorldPersistence] No database configured, skipping reset');
            return;
        }

        try {
            // Clear the global world data (blocks, entities, signs)
            await realtimeDb.ref(`rooms/${GLOBAL_WORLD_ID}/blocks`).remove();
            await realtimeDb.ref(`rooms/${GLOBAL_WORLD_ID}/entities`).remove();
            await realtimeDb.ref(`rooms/${GLOBAL_WORLD_ID}/signs`).remove();

            // Clear any pending writes
            this.writeQueue = [];
            this.entityWriteQueue = [];
            this.signWriteQueue = [];

            console.log('[WorldPersistence] World reset complete - cleared all blocks, entities, and signs');
        } catch (error) {
            console.error('[WorldPersistence] Failed to reset world:', error);
            throw error;
        }
    }
}

// Singleton instance
export const worldPersistence = new WorldPersistenceService();
