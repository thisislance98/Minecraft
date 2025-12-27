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

// Hardcode a global world ID so all rooms share the same persistent world
const GLOBAL_WORLD_ID = 'global-world';

class WorldPersistenceService {
    private writeQueue: PendingWrite[] = [];
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
}

// Singleton instance
export const worldPersistence = new WorldPersistenceService();
