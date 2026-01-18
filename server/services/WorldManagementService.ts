/**
 * WorldManagementService
 *
 * Handles per-user world management - creating, loading, sharing, and managing
 * individual worlds that users can own and invite others to.
 */

import { db, realtimeDb } from '../config';
import { nanoid } from 'nanoid';

// ============ Types ============

export type WorldVisibility = 'public' | 'private' | 'unlisted';

export type BuildPermission = 'all' | 'owner' | 'none';
export type SpawnPermission = 'all' | 'owner' | 'none';

export interface LandscapeSettings {
    enableRivers: boolean;
    seaLevel: number;        // 10-100, default 30
    terrainScale: number;    // 0.5-2.0, multiplier
    enableVillages: boolean;
}

export interface WorldSettings {
    spawnPoint: { x: number; y: number; z: number };
    timeOfDay: number; // 0.0 to 1.0 (0.25 = noon)
    timeFrozen: boolean; // If true, time doesn't advance
    allowPvP: boolean;
    allowBuilding: BuildPermission;
    allowCreatureSpawn: SpawnPermission;
    maxVisitors: number;
    enabledWorlds: string[]; // ['earth', 'moon', 'crystal', 'lava', 'soccer']
    allowedCreatures?: string[] | null;  // null = all, [] = none, [...] = whitelist
}

export interface WorldCustomizations {
    skyColor?: string; // Hex color
    fogDistance?: number;
    gravity?: number;
    welcomeMessage?: string;
    landscapeSettings?: LandscapeSettings;
}

export interface World {
    id: string;
    ownerId: string;
    ownerName: string;
    name: string;
    description: string;
    seed: number;
    visibility: WorldVisibility;
    settings: WorldSettings;
    customizations: WorldCustomizations;
    createdAt: number;
    updatedAt: number;
    playerCount: number; // Current online players (not persisted, just for listings)
    totalVisits: number;
    thumbnailUrl?: string;
}

export interface CreateWorldOptions {
    name: string;
    description?: string;
    seed?: number;
    visibility?: WorldVisibility;
    settings?: Partial<WorldSettings>;
    customizations?: Partial<WorldCustomizations>;
}

export interface WorldListItem {
    id: string;
    name: string;
    ownerName: string;
    description: string;
    visibility: WorldVisibility;
    playerCount: number;
    totalVisits: number;
    thumbnailUrl?: string;
}

// ============ Constants ============

const WORLDS_COLLECTION = 'user_worlds';
const DEFAULT_WORLD_ID = 'global'; // Fallback for users without URL routing

const DEFAULT_SETTINGS: WorldSettings = {
    spawnPoint: { x: 0, y: 100, z: 0 },
    timeOfDay: 0.25, // Noon
    timeFrozen: false,
    allowPvP: false,
    allowBuilding: 'all',
    allowCreatureSpawn: 'all',
    maxVisitors: 20,
    enabledWorlds: ['earth', 'moon', 'crystal', 'lava', 'soccer']
};

const DEFAULT_CUSTOMIZATIONS: WorldCustomizations = {
    skyColor: '#87CEEB',
    fogDistance: 100,
    gravity: 1.0,
    welcomeMessage: 'Welcome to my world!',
    landscapeSettings: {
        enableRivers: true,
        seaLevel: 30,
        terrainScale: 1.0,
        enableVillages: true
    }
};

// ============ Service Class ============

class WorldManagementServiceClass {
    // In-memory cache of active worlds (for quick lookups)
    private worldCache: Map<string, World> = new Map();
    // Track online players per world
    private worldPlayerCounts: Map<string, number> = new Map();

    /**
     * Create a new world for a user
     */
    async createWorld(ownerId: string, ownerName: string, options: CreateWorldOptions): Promise<World> {
        if (!db) {
            throw new Error('Firestore not initialized');
        }

        // Generate a short, URL-friendly ID
        const worldId = nanoid(10); // e.g., "V1StGXR8_Z"

        const world: World = {
            id: worldId,
            ownerId,
            ownerName,
            name: options.name,
            description: options.description || '',
            seed: options.seed ?? Math.floor(Math.random() * 1000000),
            visibility: options.visibility || 'unlisted',
            settings: {
                ...DEFAULT_SETTINGS,
                ...options.settings
            },
            customizations: {
                ...DEFAULT_CUSTOMIZATIONS,
                ...options.customizations
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            playerCount: 0,
            totalVisits: 0
        };

        // Save to Firestore
        await db.collection(WORLDS_COLLECTION).doc(worldId).set(world);

        // Initialize Realtime Database structure for this world
        if (realtimeDb) {
            await realtimeDb.ref(`worlds/${worldId}`).set({
                metadata: {
                    worldSeed: world.seed,
                    createdAt: world.createdAt
                }
                // blocks, entities, signs will be created as needed
            });
        }

        // Cache it
        this.worldCache.set(worldId, world);

        console.log(`[WorldManagement] Created world "${world.name}" (${worldId}) for user ${ownerId}`);
        return world;
    }

    /**
     * Get a world by ID
     */
    async getWorld(worldId: string): Promise<World | null> {
        // Check cache first
        if (this.worldCache.has(worldId)) {
            return this.worldCache.get(worldId)!;
        }

        if (!db) {
            return null;
        }

        try {
            const doc = await db.collection(WORLDS_COLLECTION).doc(worldId).get();
            if (!doc.exists) {
                return null;
            }

            const world = doc.data() as World;
            // Update with current player count
            world.playerCount = this.worldPlayerCounts.get(worldId) || 0;

            // Cache it
            this.worldCache.set(worldId, world);
            return world;
        } catch (error) {
            console.error(`[WorldManagement] Failed to get world ${worldId}:`, error);
            return null;
        }
    }

    /**
     * Update world settings
     */
    async updateWorld(worldId: string, userId: string, updates: Partial<Omit<World, 'id' | 'ownerId' | 'createdAt'>>): Promise<World | null> {
        const world = await this.getWorld(worldId);
        if (!world) {
            throw new Error('World not found');
        }

        // Only owner can update
        if (world.ownerId !== userId) {
            throw new Error('Only the world owner can update settings');
        }

        if (!db) {
            throw new Error('Firestore not initialized');
        }

        const updateData = {
            ...updates,
            updatedAt: Date.now()
        };

        await db.collection(WORLDS_COLLECTION).doc(worldId).update(updateData);

        // Update cache
        const updatedWorld = { ...world, ...updateData };
        this.worldCache.set(worldId, updatedWorld);

        console.log(`[WorldManagement] Updated world ${worldId}`);
        return updatedWorld;
    }

    /**
     * Delete a world
     */
    async deleteWorld(worldId: string, userId: string): Promise<void> {
        const world = await this.getWorld(worldId);
        if (!world) {
            throw new Error('World not found');
        }

        if (world.ownerId !== userId) {
            throw new Error('Only the world owner can delete it');
        }

        if (!db) {
            throw new Error('Firestore not initialized');
        }

        // Delete from Firestore
        await db.collection(WORLDS_COLLECTION).doc(worldId).delete();

        // Delete world data from Realtime Database
        if (realtimeDb) {
            await realtimeDb.ref(`worlds/${worldId}`).remove();
        }

        // Remove from cache
        this.worldCache.delete(worldId);
        this.worldPlayerCounts.delete(worldId);

        console.log(`[WorldManagement] Deleted world ${worldId}`);
    }

    /**
     * List worlds owned by a user
     */
    async listUserWorlds(userId: string): Promise<WorldListItem[]> {
        if (!db) {
            return [];
        }

        try {
            console.log(`[WorldManagement] Listing worlds for user: ${userId}`);

            // Simple query without orderBy to avoid needing composite index
            // Sort client-side instead
            const snapshot = await db.collection(WORLDS_COLLECTION)
                .where('ownerId', '==', userId)
                .get();

            console.log(`[WorldManagement] Found ${snapshot.docs.length} worlds for user ${userId}`);

            const worlds = snapshot.docs.map(doc => {
                const world = doc.data() as World;
                return {
                    id: world.id,
                    name: world.name,
                    ownerName: world.ownerName,
                    description: world.description,
                    visibility: world.visibility,
                    playerCount: this.worldPlayerCounts.get(world.id) || 0,
                    totalVisits: world.totalVisits,
                    thumbnailUrl: world.thumbnailUrl,
                    createdAt: world.createdAt // Include for sorting
                };
            });

            // Sort by createdAt descending (newest first)
            worlds.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            // Remove createdAt from response (not in WorldListItem type)
            return worlds.map(({ createdAt, ...rest }) => rest);
        } catch (error) {
            console.error(`[WorldManagement] Failed to list user worlds:`, error);
            return [];
        }
    }

    /**
     * List public worlds (for world browser)
     */
    async listPublicWorlds(limit: number = 20, offset: number = 0): Promise<WorldListItem[]> {
        if (!db) {
            return [];
        }

        try {
            const snapshot = await db.collection(WORLDS_COLLECTION)
                .where('visibility', '==', 'public')
                .orderBy('totalVisits', 'desc')
                .limit(limit)
                .offset(offset)
                .get();

            return snapshot.docs.map(doc => {
                const world = doc.data() as World;
                return {
                    id: world.id,
                    name: world.name,
                    ownerName: world.ownerName,
                    description: world.description,
                    visibility: world.visibility,
                    playerCount: this.worldPlayerCounts.get(world.id) || 0,
                    totalVisits: world.totalVisits,
                    thumbnailUrl: world.thumbnailUrl
                };
            });
        } catch (error) {
            console.error(`[WorldManagement] Failed to list public worlds:`, error);
            return [];
        }
    }

    /**
     * Check if a user can access a world
     */
    async canUserAccess(worldId: string, userId: string | null): Promise<boolean> {
        const world = await this.getWorld(worldId);
        if (!world) {
            return false;
        }

        // Public and unlisted worlds are accessible to anyone
        if (world.visibility === 'public' || world.visibility === 'unlisted') {
            return true;
        }

        // Private worlds require being the owner (or invited - TODO: implement invites)
        if (world.visibility === 'private') {
            return world.ownerId === userId;
        }

        return false;
    }

    /**
     * Check if a user can perform a specific action in a world
     */
    async canUserPerformAction(
        worldId: string,
        userId: string | null,
        action: 'build' | 'spawn' | 'pvp'
    ): Promise<boolean> {
        const world = await this.getWorld(worldId);
        if (!world) {
            return false;
        }

        const isOwner = world.ownerId === userId;

        switch (action) {
            case 'build':
                if (world.settings.allowBuilding === 'all') return true;
                if (world.settings.allowBuilding === 'owner') return isOwner;
                return false;

            case 'spawn':
                if (world.settings.allowCreatureSpawn === 'all') return true;
                if (world.settings.allowCreatureSpawn === 'owner') return isOwner;
                return false;

            case 'pvp':
                return world.settings.allowPvP;

            default:
                return false;
        }
    }

    /**
     * Increment visit count and track player joining
     */
    async playerJoined(worldId: string): Promise<void> {
        const currentCount = this.worldPlayerCounts.get(worldId) || 0;
        this.worldPlayerCounts.set(worldId, currentCount + 1);

        // Update total visits in Firestore (debounced/batched in production)
        if (db) {
            try {
                await db.collection(WORLDS_COLLECTION).doc(worldId).update({
                    totalVisits: (await this.getWorld(worldId))?.totalVisits ?? 0 + 1
                });
            } catch (error) {
                // Non-critical, just log
                console.error(`[WorldManagement] Failed to update visit count:`, error);
            }
        }
    }

    /**
     * Track player leaving
     */
    playerLeft(worldId: string): void {
        const currentCount = this.worldPlayerCounts.get(worldId) || 0;
        this.worldPlayerCounts.set(worldId, Math.max(0, currentCount - 1));
    }

    /**
     * Get current player count for a world
     */
    getPlayerCount(worldId: string): number {
        return this.worldPlayerCounts.get(worldId) || 0;
    }

    /**
     * Get or create the default global world
     * Used for backward compatibility when no world ID is specified
     */
    async getOrCreateDefaultWorld(): Promise<World> {
        let world = await this.getWorld(DEFAULT_WORLD_ID);

        if (!world) {
            // Create the default global world
            world = {
                id: DEFAULT_WORLD_ID,
                ownerId: 'system',
                ownerName: 'System',
                name: 'Global World',
                description: 'The default shared world for all players',
                seed: 1337, // Keep the original seed for backward compatibility
                visibility: 'public',
                settings: DEFAULT_SETTINGS,
                customizations: DEFAULT_CUSTOMIZATIONS,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                playerCount: 0,
                totalVisits: 0
            };

            if (db) {
                await db.collection(WORLDS_COLLECTION).doc(DEFAULT_WORLD_ID).set(world);
            }

            this.worldCache.set(DEFAULT_WORLD_ID, world);
            console.log(`[WorldManagement] Created default global world`);
        }

        return world;
    }

    /**
     * Generate a shareable link for a world
     */
    getShareableLink(worldId: string, baseUrl: string): string {
        return `${baseUrl}/world/${worldId}`;
    }
}

// Export singleton instance
export const worldManagementService = new WorldManagementServiceClass();

// Export types for use elsewhere
export type { World as WorldType };
