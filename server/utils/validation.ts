/**
 * Lightweight input validation utilities for Socket.IO events
 * No external dependencies required
 */

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

// Type guard helpers
const isNumber = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Coordinate validation with reasonable bounds
const isValidCoord = (v: unknown, min = -100000, max = 100000): v is number =>
    isNumber(v) && v >= min && v <= max;

// Position object validation
const isValidPosition = (v: unknown): v is { x: number; y: number; z: number } =>
    isObject(v) && isValidCoord(v.x) && isValidCoord(v.y, -1000, 10000) && isValidCoord(v.z);

// Velocity validation (smaller bounds)
const isValidVelocity = (v: unknown): v is { x: number; y: number; z: number } =>
    isObject(v) && isValidCoord(v.x, -1000, 1000) && isValidCoord(v.y, -1000, 1000) && isValidCoord(v.z, -1000, 1000);

// String with max length
const isValidString = (v: unknown, maxLength = 1000): v is string =>
    isString(v) && v.length <= maxLength;

// ============ Validation Schemas ============

export interface PlayerMoveData {
    pos: { x: number; y: number; z: number };
    rotY: number;
}

export function validatePlayerMove(data: unknown): ValidationResult<PlayerMoveData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidPosition(data.pos)) return { success: false, error: 'Invalid position' };
    if (!isNumber(data.rotY)) return { success: false, error: 'Invalid rotation' };
    return { success: true, data: { pos: data.pos as { x: number; y: number; z: number }, rotY: data.rotY as number } };
}

export interface BlockChangeData {
    x: number;
    y: number;
    z: number;
    type: string | null;
}

export function validateBlockChange(data: unknown): ValidationResult<BlockChangeData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidCoord(data.x)) return { success: false, error: 'Invalid x coordinate' };
    if (!isValidCoord(data.y, 0, 512)) return { success: false, error: 'Invalid y coordinate' };
    if (!isValidCoord(data.z)) return { success: false, error: 'Invalid z coordinate' };
    if (data.type !== null && !isValidString(data.type, 100)) return { success: false, error: 'Invalid block type' };
    return { success: true, data: { x: data.x as number, y: data.y as number, z: data.z as number, type: data.type as string | null } };
}

export interface ProjectileSpawnData {
    type: string;
    pos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
}

export function validateProjectileSpawn(data: unknown): ValidationResult<ProjectileSpawnData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidString(data.type, 50)) return { success: false, error: 'Invalid projectile type' };
    if (!isValidPosition(data.pos)) return { success: false, error: 'Invalid position' };
    if (!isValidVelocity(data.vel)) return { success: false, error: 'Invalid velocity' };
    return { success: true, data: {
        type: data.type as string,
        pos: data.pos as { x: number; y: number; z: number },
        vel: data.vel as { x: number; y: number; z: number }
    }};
}

export interface SignUpdateData {
    x: number;
    y: number;
    z: number;
    text: string;
}

export function validateSignUpdate(data: unknown): ValidationResult<SignUpdateData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidCoord(data.x)) return { success: false, error: 'Invalid x coordinate' };
    if (!isValidCoord(data.y, 0, 512)) return { success: false, error: 'Invalid y coordinate' };
    if (!isValidCoord(data.z)) return { success: false, error: 'Invalid z coordinate' };
    if (!isValidString(data.text, 500)) return { success: false, error: 'Sign text too long (max 500 chars)' };
    return { success: true, data: { x: data.x as number, y: data.y as number, z: data.z as number, text: data.text as string } };
}

export interface PlayerHoldData {
    itemType: string | null;
}

export function validatePlayerHold(data: unknown): ValidationResult<PlayerHoldData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (data.itemType !== null && data.itemType !== undefined && !isValidString(data.itemType, 100)) return { success: false, error: 'Invalid item type' };
    return { success: true, data: { itemType: (data.itemType as string | null) ?? null } };
}

export interface PlayerDamageData {
    targetId: string;
    amount: number;
}

export function validatePlayerDamage(data: unknown): ValidationResult<PlayerDamageData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidString(data.targetId, 100)) return { success: false, error: 'Invalid target ID' };
    if (!isNumber(data.amount) || data.amount < 0 || data.amount > 1000) return { success: false, error: 'Invalid damage amount' };
    return { success: true, data: { targetId: data.targetId as string, amount: data.amount as number } };
}

export interface PlayerColorData {
    shirtColor: number;
}

export function validatePlayerColor(data: unknown): ValidationResult<PlayerColorData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isNumber(data.shirtColor) || data.shirtColor < 0 || data.shirtColor > 0xFFFFFF) return { success: false, error: 'Invalid color' };
    return { success: true, data: { shirtColor: data.shirtColor as number } };
}

export interface EntityRemoveData {
    id: string;
}

export function validateEntityRemove(data: unknown): ValidationResult<EntityRemoveData> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidString(data.id, 100)) return { success: false, error: 'Invalid entity ID' };
    return { success: true, data: { id: data.id as string } };
}

export interface JoinWorldPayload {
    worldId: string;
    name?: string;
    shirtColor?: number;
    userId?: string;
}

export function validateJoinWorld(data: unknown): ValidationResult<JoinWorldPayload> {
    if (!isObject(data)) return { success: false, error: 'Invalid data format' };
    if (!isValidString(data.worldId, 100)) return { success: false, error: 'Invalid world ID' };
    if (data.name !== undefined && !isValidString(data.name, 50)) return { success: false, error: 'Invalid player name' };
    if (data.shirtColor !== undefined && (!isNumber(data.shirtColor) || data.shirtColor < 0 || data.shirtColor > 0xFFFFFF)) {
        return { success: false, error: 'Invalid shirt color' };
    }
    if (data.userId !== undefined && !isValidString(data.userId, 200)) return { success: false, error: 'Invalid user ID' };
    return {
        success: true,
        data: {
            worldId: data.worldId as string,
            name: data.name as string | undefined,
            shirtColor: data.shirtColor as number | undefined,
            userId: data.userId as string | undefined
        }
    };
}

// Generic validator wrapper for socket handlers
export function withValidation<T>(
    validator: (data: unknown) => ValidationResult<T>,
    handler: (data: T) => void | Promise<void>
): (data: unknown) => void | Promise<void> {
    return (data: unknown) => {
        const result = validator(data);
        if (!result.success) {
            console.warn(`[Validation] Rejected invalid data: ${result.error}`);
            return;
        }
        return handler(result.data);
    };
}
