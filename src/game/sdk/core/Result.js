/**
 * Result - Standardized result type for SDK operations
 *
 * @description Provides consistent success/error handling across the SDK.
 * All SDK methods that can fail should return a Result object.
 *
 * @example
 * // Success
 * return Result.ok({ entity: newEntity, count: 5 });
 *
 * // Failure
 * return Result.error('Entity not found', 'NOT_FOUND');
 *
 * // Usage
 * const result = VoxelWorld.spawn('pig');
 * if (result.success) {
 *   console.log('Spawned:', result.data.entity);
 * } else {
 *   console.error('Error:', result.error);
 * }
 */

/**
 * @typedef {Object} ResultData
 * @property {boolean} success - Whether the operation succeeded
 * @property {*} [data] - Data returned on success
 * @property {string} [error] - Error message on failure
 * @property {string} [code] - Error code for programmatic handling
 */

/**
 * Result class for standardized operation outcomes
 */
export class Result {
    /**
     * Create a Result instance
     * @param {boolean} success - Whether operation succeeded
     * @param {*} [data] - Success data
     * @param {string} [error] - Error message
     * @param {string} [code] - Error code
     */
    constructor(success, data = null, error = null, code = null) {
        /** @type {boolean} */
        this.success = success;
        /** @type {*} */
        this.data = data;
        /** @type {string|null} */
        this.error = error;
        /** @type {string|null} */
        this.code = code;
    }

    /**
     * Create a successful result
     * @param {*} [data] - Success data
     * @returns {Result}
     */
    static ok(data = null) {
        return new Result(true, data, null, null);
    }

    /**
     * Create a failed result
     * @param {string} error - Error message
     * @param {string} [code] - Error code
     * @returns {Result}
     */
    static error(error, code = 'ERROR') {
        return new Result(false, null, error, code);
    }

    /**
     * Check if result is successful
     * @returns {boolean}
     */
    isOk() {
        return this.success;
    }

    /**
     * Check if result is an error
     * @returns {boolean}
     */
    isError() {
        return !this.success;
    }

    /**
     * Get data or throw if error
     * @returns {*}
     * @throws {Error}
     */
    unwrap() {
        if (!this.success) {
            throw new Error(this.error || 'Operation failed');
        }
        return this.data;
    }

    /**
     * Get data or return default value
     * @param {*} defaultValue - Value to return if error
     * @returns {*}
     */
    unwrapOr(defaultValue) {
        return this.success ? this.data : defaultValue;
    }

    /**
     * Map success data to new value
     * @param {Function} fn - Transform function
     * @returns {Result}
     */
    map(fn) {
        if (this.success) {
            return Result.ok(fn(this.data));
        }
        return this;
    }

    /**
     * Convert to plain object (for JSON serialization)
     * @returns {ResultData}
     */
    toJSON() {
        if (this.success) {
            return { success: true, data: this.data };
        }
        return { success: false, error: this.error, code: this.code };
    }
}

/**
 * Common error codes
 * @enum {string}
 */
export const ErrorCodes = {
    /** Item/entity not found */
    NOT_FOUND: 'NOT_FOUND',
    /** Invalid parameters provided */
    INVALID_PARAMS: 'INVALID_PARAMS',
    /** Game not initialized */
    NOT_INITIALIZED: 'NOT_INITIALIZED',
    /** Operation not permitted */
    NOT_PERMITTED: 'NOT_PERMITTED',
    /** Internal error */
    INTERNAL: 'INTERNAL',
    /** Missing required dependency */
    MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
    /** Rate limited */
    RATE_LIMITED: 'RATE_LIMITED',
    /** Resource already exists */
    ALREADY_EXISTS: 'ALREADY_EXISTS'
};

export default Result;
