/**
 * UndoSystem - Tracks changes for undo/redo operations
 *
 * @description Tracks spawned entities, registered types, items given, and blocks placed
 * for each task. Allows undoing changes made by a specific task.
 */

import { Result, ErrorCodes } from './Result.js';

/**
 * @typedef {Object} UndoRecord
 * @property {string} taskId - The task ID
 * @property {number} timestamp - When the task started
 * @property {Array} spawned - Entities spawned during this task
 * @property {string[]} registered - Object types registered
 * @property {Array<{id: string, count: number}>} itemsGiven - Items given to player
 * @property {Array<{x: number, y: number, z: number, oldType: string|number}>} blocksPlaced - Blocks modified
 */

export class UndoSystem {
    constructor() {
        /** @type {UndoRecord[]} */
        this._undoStack = [];
        /** @type {string|null} */
        this._currentTaskId = null;
        /** @type {UndoRecord|null} */
        this._currentRecord = null;
    }

    /**
     * Start tracking changes for a task
     * @param {string} taskId - Unique task identifier
     */
    beginTracking(taskId) {
        this._currentTaskId = taskId;
        this._currentRecord = {
            taskId,
            timestamp: Date.now(),
            spawned: [],
            registered: [],
            itemsGiven: [],
            blocksPlaced: []
        };
        console.log(`[UndoSystem] Started tracking: ${taskId}`);
    }

    /**
     * End tracking and save the undo record
     * @returns {UndoRecord|null} The completed record, or null if no changes
     */
    endTracking() {
        if (!this._currentRecord) return null;

        const record = this._currentRecord;
        const hasChanges =
            record.spawned.length > 0 ||
            record.registered.length > 0 ||
            record.itemsGiven.length > 0 ||
            record.blocksPlaced.length > 0;

        if (hasChanges) {
            this._undoStack.push(record);
            console.log(`[UndoSystem] Saved record for ${record.taskId}:`, {
                spawned: record.spawned.length,
                registered: record.registered.length,
                items: record.itemsGiven.length,
                blocks: record.blocksPlaced.length
            });
        }

        this._currentTaskId = null;
        this._currentRecord = null;
        return record;
    }

    /**
     * Track a spawned entity
     * @param {Object} entity - The spawned entity
     */
    trackSpawn(entity) {
        if (this._currentRecord && entity) {
            this._currentRecord.spawned.push(entity);
        }
    }

    /**
     * Track a registered type
     * @param {string} typeId - The type ID
     */
    trackRegister(typeId) {
        if (this._currentRecord && typeId) {
            this._currentRecord.registered.push(typeId);
        }
    }

    /**
     * Track an item given to player
     * @param {string} id - Item ID
     * @param {number} count - Item count
     */
    trackItemGiven(id, count) {
        if (this._currentRecord) {
            this._currentRecord.itemsGiven.push({ id, count });
        }
    }

    /**
     * Track a block placement
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {string|number} oldType - Previous block type
     */
    trackBlockPlaced(x, y, z, oldType) {
        if (this._currentRecord) {
            this._currentRecord.blocksPlaced.push({ x, y, z, oldType });
        }
    }

    /**
     * Get undo record for a task
     * @param {string} taskId
     * @returns {UndoRecord|null}
     */
    getRecord(taskId) {
        return this._undoStack.find(r => r.taskId === taskId) || null;
    }

    /**
     * Get list of undoable task IDs
     * @returns {string[]}
     */
    getUndoableTaskIds() {
        return this._undoStack.map(r => r.taskId);
    }

    /**
     * Check if currently tracking
     * @returns {boolean}
     */
    isTracking() {
        return this._currentRecord !== null;
    }

    /**
     * Get the current undo record being built
     * @returns {UndoRecord|null}
     */
    getCurrentRecord() {
        return this._currentRecord;
    }

    /**
     * Undo a specific task
     * @param {string} taskId - Task to undo
     * @param {Object} callbacks - Callback functions for undo operations
     * @param {Function} callbacks.destroyEntity - (entity) => void
     * @param {Function} callbacks.unregisterType - (typeId) => void
     * @param {Function} callbacks.removeItem - (id, count) => void
     * @param {Function} callbacks.setBlock - (x, y, z, type) => void
     * @returns {Result}
     */
    undoTask(taskId, callbacks) {
        const index = this._undoStack.findIndex(r => r.taskId === taskId);
        if (index === -1) {
            return Result.error('No undo record found for this task', ErrorCodes.NOT_FOUND);
        }

        const record = this._undoStack[index];
        const undone = { entities: 0, types: 0, items: 0, blocks: 0 };

        // Destroy spawned entities
        if (record.spawned.length > 0 && callbacks.destroyEntity) {
            for (const entity of record.spawned) {
                try {
                    callbacks.destroyEntity(entity);
                    undone.entities++;
                } catch (e) {
                    console.warn('[UndoSystem] Failed to destroy entity:', e);
                }
            }
        }

        // Unregister types
        if (record.registered.length > 0 && callbacks.unregisterType) {
            for (const typeId of record.registered) {
                try {
                    callbacks.unregisterType(typeId);
                    undone.types++;
                } catch (e) {
                    console.warn('[UndoSystem] Failed to unregister type:', e);
                }
            }
        }

        // Remove items
        if (record.itemsGiven.length > 0 && callbacks.removeItem) {
            for (const item of record.itemsGiven) {
                try {
                    callbacks.removeItem(item.id, item.count);
                    undone.items++;
                } catch (e) {
                    console.warn('[UndoSystem] Failed to remove item:', e);
                }
            }
        }

        // Restore blocks
        if (record.blocksPlaced.length > 0 && callbacks.setBlock) {
            for (const block of record.blocksPlaced) {
                try {
                    callbacks.setBlock(block.x, block.y, block.z, block.oldType);
                    undone.blocks++;
                } catch (e) {
                    console.warn('[UndoSystem] Failed to restore block:', e);
                }
            }
        }

        // Remove from stack
        this._undoStack.splice(index, 1);

        console.log(`[UndoSystem] Undid task ${taskId}:`, undone);
        return Result.ok({ taskId, undone });
    }

    /**
     * Undo the most recent task
     * @param {Object} callbacks - Same as undoTask
     * @returns {Result}
     */
    undoLast(callbacks) {
        if (this._undoStack.length === 0) {
            return Result.error('Nothing to undo', ErrorCodes.NOT_FOUND);
        }
        const lastRecord = this._undoStack[this._undoStack.length - 1];
        return this.undoTask(lastRecord.taskId, callbacks);
    }

    /**
     * Clear all undo history
     */
    clear() {
        this._undoStack = [];
        this._currentTaskId = null;
        this._currentRecord = null;
    }
}

export default UndoSystem;
