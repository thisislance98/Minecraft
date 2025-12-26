import { db } from '../config';

/**
 * World data structure stored in Firestore
 * With fixed seed, we only persist block changes (deltas from generated terrain)
 */
export interface WorldData {
    blockChanges: BlockChangeData[];
    createdAt: number;
    updatedAt: number;
}

export interface BlockChangeData {
    x: number;
    y: number;
    z: number;
    blockType: string;
    timestamp: number;
}

// Fixed world seed - same for everyone, terrain is deterministic
export const WORLD_SEED = 42;

// Single world ID for all users
const WORLD_ID = 'shared_world';
const WORLDS_COLLECTION = 'worlds';

/**
 * Save block changes to Firestore
 * Only stores deltas from the deterministically generated terrain
 * @param blockChanges - Array of block changes
 */
export async function saveBlockChanges(
    blockChanges: BlockChangeData[]
): Promise<void> {
    if (!db) {
        console.warn('[WorldService] Firestore not initialized, skipping save');
        return;
    }

    try {
        const worldData: WorldData = {
            blockChanges,
            createdAt: Date.now(), // Will be overwritten on update if exists
            updatedAt: Date.now()
        };

        const docRef = db.collection(WORLDS_COLLECTION).doc(WORLD_ID);
        const doc = await docRef.get();

        if (doc.exists) {
            // Update existing - preserve createdAt
            await docRef.update({
                blockChanges,
                updatedAt: Date.now()
            });
        } else {
            // Create new
            await docRef.set(worldData);
        }

        console.log(`[WorldService] Saved world with ${blockChanges.length} block changes`);
    } catch (error) {
        console.error('[WorldService] Failed to save world:', error);
        throw error;
    }
}

/**
 * Load block changes from Firestore
 * @returns Block changes array or empty array if not found
 */
export async function loadBlockChanges(): Promise<BlockChangeData[]> {
    if (!db) {
        console.warn('[WorldService] Firestore not initialized, returning empty');
        return [];
    }

    try {
        const docRef = db.collection(WORLDS_COLLECTION).doc(WORLD_ID);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.log('[WorldService] No saved block changes found');
            return [];
        }

        const data = doc.data() as WorldData;
        console.log(`[WorldService] Loaded ${data.blockChanges?.length || 0} block changes`);
        return data.blockChanges || [];
    } catch (error) {
        console.error('[WorldService] Failed to load block changes:', error);
        throw error;
    }
}

/**
 * Delete the saved world
 */
export async function deleteWorld(): Promise<void> {
    if (!db) {
        console.warn('[WorldService] Firestore not initialized, skipping delete');
        return;
    }

    try {
        await db.collection(WORLDS_COLLECTION).doc(WORLD_ID).delete();
        console.log('[WorldService] World deleted');
    } catch (error) {
        console.error('[WorldService] Failed to delete world:', error);
        throw error;
    }
}

/**
 * Check if a saved world exists
 */
export async function worldExists(): Promise<boolean> {
    if (!db) {
        return false;
    }

    try {
        const doc = await db.collection(WORLDS_COLLECTION).doc(WORLD_ID).get();
        return doc.exists;
    } catch (error) {
        console.error('[WorldService] Failed to check world existence:', error);
        return false;
    }
}
