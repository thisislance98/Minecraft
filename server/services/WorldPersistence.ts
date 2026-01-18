/**
 * WorldPersistence Service
 *
 * Handles persistent storage of world block changes using Firebase Realtime Database.
 * Only stores diffs from the seed-generated terrain, not the entire world.
 *
 * Now supports per-world persistence by worldId.
 */

import { realtimeDb } from '../config';

// Batch writes to avoid Firebase rate limits
interface PendingWrite {
    worldId: string;
    key: string;
    blockType: string | null;
}

interface PendingEntityWrite {
    worldId: string;
    entityId: string;
    data: any | null; // null for deletion
}

interface PendingSignWrite {
    worldId: string;
    key: string;
    text: string;
}

// Default world ID for backward compatibility (legacy global world)
const DEFAULT_WORLD_ID = 'global';

class WorldPersistenceService {
    private writeQueue: PendingWrite[] = [];
    private entityWriteQueue: PendingEntityWrite[] = [];
    private signWriteQueue: PendingSignWrite[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL_MS = 500; // Batch writes every 500ms

    private flushPromise: Promise<void> | null = null;
    private isResetting: Map<string, boolean> = new Map(); // Per-world reset tracking

    /**
     * Save a block change to Firebase RTDB
     * @param worldId - The world ID for persistence
     * @param x - Block X coordinate
     * @param y - Block Y coordinate
     * @param z - Block Z coordinate
     * @param blockType - The block type (null for air/deleted)
     */
    async saveBlockChange(worldId: string, x: number, y: number, z: number, blockType: string | null): Promise<void> {
        const targetId = worldId || DEFAULT_WORLD_ID;

        // If this world is resetting, ignore new writes
        if (this.isResetting.get(targetId)) return;

        if (!realtimeDb) {
            return;
        }

        const key = `${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)}`;
        this.writeQueue.push({ worldId: targetId, key, blockType });

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    /**
     * Flush pending writes to Firebase in a batch
     */
    private async flushWrites(): Promise<void> {
        this.flushTimer = null;

        // Track this flush operation
        let resolveFlush: () => void;
        this.flushPromise = new Promise(resolve => { resolveFlush = resolve; });

        try {
            await this.flushBlockWrites();
            await this.flushEntityWrites();
            await this.flushSignWrites();
        } finally {
            this.flushPromise = null;
            if (resolveFlush!) resolveFlush();
        }
    }

    private async flushBlockWrites(): Promise<void> {
        if (this.writeQueue.length === 0) return;

        const writes = [...this.writeQueue];
        this.writeQueue = [];

        // Group by world for efficient batching
        const byWorld = new Map<string, Map<string, string | null>>();
        for (const { worldId, key, blockType } of writes) {
            // Skip writes for worlds that are resetting
            if (this.isResetting.get(worldId)) continue;

            if (!byWorld.has(worldId)) {
                byWorld.set(worldId, new Map());
            }
            byWorld.get(worldId)!.set(key, blockType);
        }

        // Execute batched writes per world
        for (const [worldId, blocks] of byWorld) {
            try {
                const updates: Record<string, string | null> = {};
                for (const [key, blockType] of blocks) {
                    // Use worlds/{worldId}/blocks path
                    updates[`worlds/${worldId}/blocks/${key}`] = blockType === null ? 'AIR' : blockType;
                }

                await realtimeDb!.ref().update(updates);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save blocks for world ${worldId}:`, error);
            }
        }
    }

    /**
     * Get all block changes for a world
     * @param worldId - The world ID
     * @returns Map of "x_y_z" -> blockType
     */
    async getBlockChanges(worldId: string): Promise<Map<string, string | null>> {
        const targetId = worldId || DEFAULT_WORLD_ID;
        const result = new Map<string, string | null>();

        if (!realtimeDb) {
            return result;
        }

        try {
            const snapshot = await realtimeDb.ref(`worlds/${targetId}/blocks`).get();

            if (snapshot.exists()) {
                const data = snapshot.val() as Record<string, string | null>;
                for (const [key, blockType] of Object.entries(data)) {
                    if (blockType === 'AIR') {
                        result.set(key, null);
                    } else {
                        result.set(key, blockType);
                    }
                }
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to load blocks for world ${targetId}:`, error);
        }

        return result;
    }

    /**
     * Save room metadata (world seed, created time, etc.)
     */
    async saveRoomMetadata(roomId: string, worldSeed: number): Promise<void> {
        if (!realtimeDb) return;

        try {
            await realtimeDb.ref(`rooms/${roomId}/metadata`).set({
                worldSeed,
                createdAt: Date.now()
            });
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
     * @param worldId - The world ID
     * @param entityId - The entity's unique ID
     * @param data - Entity data (null for deletion)
     */
    async saveEntity(worldId: string, entityId: string, data: any): Promise<void> {
        const targetId = worldId || DEFAULT_WORLD_ID;

        if (this.isResetting.get(targetId)) return;
        if (!realtimeDb) return;

        this.entityWriteQueue.push({ worldId: targetId, entityId, data });

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    private async flushEntityWrites(): Promise<void> {
        if (this.entityWriteQueue.length === 0) return;

        const writes = [...this.entityWriteQueue];
        this.entityWriteQueue = [];

        const byWorld = new Map<string, Map<string, any>>();
        for (const { worldId, entityId, data } of writes) {
            if (this.isResetting.get(worldId)) continue;

            if (!byWorld.has(worldId)) {
                byWorld.set(worldId, new Map());
            }
            byWorld.get(worldId)!.set(entityId, data);
        }

        for (const [worldId, entities] of byWorld) {
            try {
                const updates: Record<string, any> = {};
                for (const [entityId, data] of entities) {
                    updates[`worlds/${worldId}/entities/${entityId}`] = data;
                }
                await realtimeDb!.ref().update(updates);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save entities for world ${worldId}:`, error);
            }
        }
    }

    /**
     * Get all entities for a world
     * @param worldId - The world ID
     */
    async getEntities(worldId: string): Promise<Map<string, any>> {
        const targetId = worldId || DEFAULT_WORLD_ID;
        const result = new Map<string, any>();
        if (!realtimeDb) return result;

        try {
            const snapshot = await realtimeDb.ref(`worlds/${targetId}/entities`).get();
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const [id, entityData] of Object.entries(data)) {
                    result.set(id, entityData);
                }
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to load entities for world ${targetId}:`, error);
        }
        return result;
    }

    /**
     * Save sign text
     * @param worldId - The world ID
     */
    async saveSignText(worldId: string, x: number, y: number, z: number, text: string): Promise<void> {
        const targetId = worldId || DEFAULT_WORLD_ID;

        if (this.isResetting.get(targetId)) return;
        if (!realtimeDb) return;

        const key = `${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)}`;
        this.signWriteQueue.push({ worldId: targetId, key, text });

        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flushWrites(), this.FLUSH_INTERVAL_MS);
        }
    }

    private async flushSignWrites(): Promise<void> {
        if (this.signWriteQueue.length === 0) return;

        const writes = [...this.signWriteQueue];
        this.signWriteQueue = [];

        const byWorld = new Map<string, Map<string, string>>();
        for (const { worldId, key, text } of writes) {
            if (this.isResetting.get(worldId)) continue;

            if (!byWorld.has(worldId)) byWorld.set(worldId, new Map());
            byWorld.get(worldId)!.set(key, text);
        }

        for (const [worldId, signs] of byWorld) {
            try {
                const updates: Record<string, string> = {};
                for (const [key, text] of signs) {
                    updates[`worlds/${worldId}/signs/${key}`] = text;
                }
                await realtimeDb!.ref().update(updates);
            } catch (error) {
                console.error(`[WorldPersistence] Failed to save signs for world ${worldId}:`, error);
            }
        }
    }

    /**
     * Get all signs for a world
     * @param worldId - The world ID
     */
    async getSignTexts(worldId: string): Promise<Map<string, string>> {
        const targetId = worldId || DEFAULT_WORLD_ID;
        const result = new Map<string, string>();
        if (!realtimeDb) return result;

        try {
            const snapshot = await realtimeDb.ref(`worlds/${targetId}/signs`).get();
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const [key, text] of Object.entries(data)) {
                    result.set(key, text as string);
                }
            }
        } catch (error) {
            console.error(`[WorldPersistence] Failed to get signs for world ${targetId}:`, error);
        }
        return result;
    }

    /**
     * Reset a specific world - clears all blocks, entities, and signs
     * @param worldId - The world ID to reset (defaults to global)
     * @returns Promise that resolves when reset is complete
     */
    async resetWorld(worldId: string = DEFAULT_WORLD_ID): Promise<void> {
        if (!realtimeDb) {
            console.log('[WorldPersistence] No database configured, skipping reset');
            return;
        }

        // Mark this world as resetting
        this.isResetting.set(worldId, true);

        try {
            // Clear pending queues for this world
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }
            this.writeQueue = this.writeQueue.filter(w => w.worldId !== worldId);
            this.entityWriteQueue = this.entityWriteQueue.filter(w => w.worldId !== worldId);
            this.signWriteQueue = this.signWriteQueue.filter(w => w.worldId !== worldId);

            // Wait for any active flush to complete
            if (this.flushPromise) {
                console.log('[WorldPersistence] Waiting for active flush before reset...');
                await this.flushPromise;
            }

            // Clear world data
            console.log(`[WorldPersistence] Executing world reset for ${worldId}...`);
            await realtimeDb.ref(`worlds/${worldId}/blocks`).remove();
            await realtimeDb.ref(`worlds/${worldId}/entities`).remove();
            await realtimeDb.ref(`worlds/${worldId}/signs`).remove();

            console.log(`[WorldPersistence] World ${worldId} reset complete`);

            // Grace period before re-enabling writes
            setTimeout(() => {
                this.isResetting.delete(worldId);
                console.log(`[WorldPersistence] World ${worldId} reset grace period ended`);
            }, 5000);

        } catch (error) {
            console.error(`[WorldPersistence] Failed to reset world ${worldId}:`, error);
            this.isResetting.delete(worldId);
            throw error;
        }
    }
}

// Singleton instance
export const worldPersistence = new WorldPersistenceService();
