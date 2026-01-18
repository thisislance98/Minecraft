/**
 * World Management Routes
 *
 * API endpoints for creating, managing, and listing user worlds.
 */

import { Router, Request, Response } from 'express';
import { auth } from '../config';
import { worldManagementService, CreateWorldOptions, WorldVisibility } from '../services/WorldManagementService';

const router = Router();

// Middleware to verify Firebase auth token (with CLI bypass)
async function verifyAuth(req: Request, res: Response, next: Function) {
    // CLI bypass for testing
    const cliSecret = req.headers['x-antigravity-secret'];
    const cliClient = req.headers['x-antigravity-client'];
    if (cliSecret === 'asdf123' && cliClient === 'cli') {
        (req as any).userId = 'cli-test-user';
        (req as any).userName = 'CLI Tester';
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        if (!auth) {
            return res.status(500).json({ error: 'Auth not initialized' });
        }

        const decodedToken = await auth.verifyIdToken(token);
        (req as any).userId = decodedToken.uid;
        (req as any).userName = decodedToken.name || decodedToken.email || 'Anonymous';
        next();
    } catch (error) {
        console.error('[WorldRoutes] Auth verification failed:', error);
        return res.status(401).json({ error: 'Invalid authorization token' });
    }
}

// Optional auth - doesn't require login but extracts user if present
async function optionalAuth(req: Request, res: Response, next: Function) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        (req as any).userId = null;
        (req as any).userName = null;
        return next();
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        if (auth) {
            const decodedToken = await auth.verifyIdToken(token);
            (req as any).userId = decodedToken.uid;
            (req as any).userName = decodedToken.name || decodedToken.email || 'Anonymous';
        }
    } catch (error) {
        // Token invalid but that's OK for optional auth
        (req as any).userId = null;
        (req as any).userName = null;
    }
    next();
}

/**
 * POST /api/worlds - Create a new world
 */
router.post('/', verifyAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const userName = (req as any).userName;

        const { name, description, seed, visibility, settings, customizations } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'World name is required' });
        }

        if (name.length > 50) {
            return res.status(400).json({ error: 'World name must be 50 characters or less' });
        }

        const options: CreateWorldOptions = {
            name: name.trim(),
            description: description?.trim() || '',
            seed: typeof seed === 'number' ? seed : undefined,
            visibility: ['public', 'private', 'unlisted'].includes(visibility) ? visibility : 'unlisted',
            settings,
            customizations
        };

        const world = await worldManagementService.createWorld(userId, userName, options);

        console.log(`[WorldRoutes] Created world "${world.name}" (${world.id}) for user ${userId}`);
        res.status(201).json({ world });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to create world:', error);
        res.status(500).json({ error: error.message || 'Failed to create world' });
    }
});

/**
 * GET /api/worlds - List public worlds (world browser)
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const offset = parseInt(req.query.offset as string) || 0;

        const worlds = await worldManagementService.listPublicWorlds(limit, offset);

        res.json({ worlds });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to list public worlds:', error);
        res.status(500).json({ error: error.message || 'Failed to list worlds' });
    }
});

/**
 * GET /api/worlds/mine - List current user's worlds
 */
router.get('/mine', verifyAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const worlds = await worldManagementService.listUserWorlds(userId);

        res.json({ worlds });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to list user worlds:', error);
        res.status(500).json({ error: error.message || 'Failed to list your worlds' });
    }
});

/**
 * GET /api/worlds/:worldId - Get a specific world
 */
router.get('/:worldId', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { worldId } = req.params;
        const userId = (req as any).userId;

        const world = await worldManagementService.getWorld(worldId);

        if (!world) {
            return res.status(404).json({ error: 'World not found' });
        }

        // Check access
        const canAccess = await worldManagementService.canUserAccess(worldId, userId);
        if (!canAccess) {
            return res.status(403).json({ error: 'You do not have access to this world' });
        }

        // Add permissions info for the requesting user
        const isOwner = world.ownerId === userId;
        const permissions = {
            isOwner,
            canBuild: await worldManagementService.canUserPerformAction(worldId, userId, 'build'),
            canSpawnCreatures: await worldManagementService.canUserPerformAction(worldId, userId, 'spawn'),
            canPvP: await worldManagementService.canUserPerformAction(worldId, userId, 'pvp')
        };

        res.json({ world, permissions });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to get world:', error);
        res.status(500).json({ error: error.message || 'Failed to get world' });
    }
});

// Validation helpers
function isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function validateCustomizations(customizations: any): string | null {
    if (customizations.skyColor !== undefined) {
        if (typeof customizations.skyColor !== 'string' || !isValidHexColor(customizations.skyColor)) {
            return 'Sky color must be a valid hex color (#RRGGBB)';
        }
    }

    if (customizations.gravity !== undefined) {
        const gravity = parseFloat(customizations.gravity);
        if (isNaN(gravity) || gravity < 0.1 || gravity > 3.0) {
            return 'Gravity must be between 0.1 and 3.0';
        }
    }

    if (customizations.landscapeSettings !== undefined) {
        const ls = customizations.landscapeSettings;
        if (ls.seaLevel !== undefined) {
            const seaLevel = parseInt(ls.seaLevel);
            if (isNaN(seaLevel) || seaLevel < 10 || seaLevel > 100) {
                return 'Sea level must be between 10 and 100';
            }
        }
        if (ls.terrainScale !== undefined) {
            const terrainScale = parseFloat(ls.terrainScale);
            if (isNaN(terrainScale) || terrainScale < 0.5 || terrainScale > 2.0) {
                return 'Terrain scale must be between 0.5 and 2.0';
            }
        }
    }

    return null; // No errors
}

function validateSettings(settings: any): string | null {
    if (settings.allowedCreatures !== undefined) {
        // Must be null (all allowed), or an array of strings
        if (settings.allowedCreatures !== null && !Array.isArray(settings.allowedCreatures)) {
            return 'Allowed creatures must be null or an array of creature names';
        }
        if (Array.isArray(settings.allowedCreatures)) {
            for (const creature of settings.allowedCreatures) {
                if (typeof creature !== 'string') {
                    return 'Each allowed creature must be a string';
                }
            }
        }
    }

    return null; // No errors
}

/**
 * PATCH /api/worlds/:worldId - Update world settings
 */
router.patch('/:worldId', verifyAuth, async (req: Request, res: Response) => {
    try {
        const { worldId } = req.params;
        const userId = (req as any).userId;

        const { name, description, visibility, settings, customizations } = req.body;

        const updates: any = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ error: 'World name cannot be empty' });
            }
            if (name.length > 50) {
                return res.status(400).json({ error: 'World name must be 50 characters or less' });
            }
            updates.name = name.trim();
        }

        if (description !== undefined) {
            updates.description = (description || '').trim();
        }

        if (visibility !== undefined) {
            if (!['public', 'private', 'unlisted'].includes(visibility)) {
                return res.status(400).json({ error: 'Invalid visibility setting' });
            }
            updates.visibility = visibility;
        }

        if (settings !== undefined) {
            const settingsError = validateSettings(settings);
            if (settingsError) {
                return res.status(400).json({ error: settingsError });
            }
            updates.settings = settings;
        }

        if (customizations !== undefined) {
            const customError = validateCustomizations(customizations);
            if (customError) {
                return res.status(400).json({ error: customError });
            }
            updates.customizations = customizations;
        }

        const world = await worldManagementService.updateWorld(worldId, userId, updates);

        console.log(`[WorldRoutes] Updated world ${worldId}`);
        res.json({ world });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to update world:', error);
        if (error.message === 'World not found') {
            return res.status(404).json({ error: 'World not found' });
        }
        if (error.message === 'Only the world owner can update settings') {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to update world' });
    }
});

/**
 * DELETE /api/worlds/:worldId - Delete a world
 */
router.delete('/:worldId', verifyAuth, async (req: Request, res: Response) => {
    try {
        const { worldId } = req.params;
        const userId = (req as any).userId;

        // Prevent deleting the global world
        if (worldId === 'global') {
            return res.status(403).json({ error: 'Cannot delete the global world' });
        }

        await worldManagementService.deleteWorld(worldId, userId);

        console.log(`[WorldRoutes] Deleted world ${worldId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to delete world:', error);
        if (error.message === 'World not found') {
            return res.status(404).json({ error: 'World not found' });
        }
        if (error.message === 'Only the world owner can delete it') {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Failed to delete world' });
    }
});

/**
 * GET /api/worlds/:worldId/share - Get shareable link for a world
 */
router.get('/:worldId/share', verifyAuth, async (req: Request, res: Response) => {
    try {
        const { worldId } = req.params;
        const userId = (req as any).userId;

        const world = await worldManagementService.getWorld(worldId);

        if (!world) {
            return res.status(404).json({ error: 'World not found' });
        }

        // Only owner can get share link (for now)
        if (world.ownerId !== userId) {
            return res.status(403).json({ error: 'Only the world owner can get the share link' });
        }

        // Construct the base URL from request headers
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
        const baseUrl = `${protocol}://${host}`;

        const shareLink = worldManagementService.getShareableLink(worldId, baseUrl);

        res.json({ shareLink, worldId });
    } catch (error: any) {
        console.error('[WorldRoutes] Failed to get share link:', error);
        res.status(500).json({ error: error.message || 'Failed to get share link' });
    }
});

export const worldRoutes = router;
