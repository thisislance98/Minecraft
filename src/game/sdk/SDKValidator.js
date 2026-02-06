/**
 * SDKValidator - Static analysis for VoxelWorld SDK code
 * Catches common mistakes BEFORE runtime execution
 */

// Common mistakes and their fixes
const SDK_VALIDATION_RULES = [
    {
        pattern: /gameObject\.parts/,
        error: 'gameObject.parts does not exist',
        fix: 'Use this.gameObject.mesh.getObjectByName("part_name") to find mesh parts'
    },
    {
        pattern: /this\.gameObject\.parts/,
        error: 'gameObject.parts does not exist',
        fix: 'Use this.gameObject.mesh.getObjectByName("part_name") to find mesh parts'
    },
    {
        pattern: /\.updateMesh\s*\(/,
        error: 'updateMesh() does not exist',
        fix: 'Remove updateMesh() - THREE.js mesh position/rotation changes are immediate'
    },
    {
        pattern: /gameObject\.position\s*=/,
        error: 'Cannot assign directly to gameObject.position',
        fix: 'Use this.gameObject.transform.position.set(x, y, z) or .copy(vector)'
    },
    {
        pattern: /this\.position\s*=/,
        error: 'Cannot assign directly to this.position in a script',
        fix: 'Use this.transform.position.set(x, y, z) or this.gameObject.transform.position'
    },
    {
        pattern: /gameObject\.rotation\s*=/,
        error: 'Cannot assign directly to gameObject.rotation',
        fix: 'Use this.gameObject.transform.rotation.set(x, y, z)'
    },
    {
        pattern: /VoxelWorld\.createEntity/,
        error: 'VoxelWorld.createEntity does not exist',
        fix: 'Use VoxelWorld.createObject(name).attach("entity", config).register()'
    },
    {
        pattern: /VoxelWorld\.createItem/,
        error: 'VoxelWorld.createItem does not exist',
        fix: 'Use VoxelWorld.createObject(name).attach("item", config).register()'
    },
    {
        pattern: /new\s+VoxelWorld/,
        error: 'VoxelWorld is already instantiated as a singleton',
        fix: 'Use the global VoxelWorld object directly (e.g., VoxelWorld.spawn(...))'
    },
    {
        pattern: /Time\.time(?![A-Za-z])/,
        error: 'Time.time returns total time, not deltaTime',
        fix: 'Use Time.deltaTime for frame-based calculations (e.g., this.time += Time.deltaTime)'
    }
];

// Valid GameObject/script properties for suggestions
const GAMEOBJECT_PROPERTIES = ['mesh', 'transform', 'position', 'name', 'id', 'game', 'tag', 'layer'];
const TRANSFORM_PROPERTIES = ['position', 'rotation', 'scale', 'Translate', 'Rotate', 'LookAt'];
const MESH_METHODS = ['getObjectByName', 'add', 'remove', 'traverse', 'children'];
const SCRIPT_LIFECYCLE = ['Start', 'Update', 'OnDestroy', 'OnCollisionEnter', 'OnTriggerEnter', 'OnUse', 'OnDamage', 'OnDeath'];

/**
 * Validate SDK code before execution
 * @param {string} code - JavaScript code to validate
 * @returns {{ valid: boolean, errors: Array, warnings: Array }}
 */
export function validateSDKCode(code) {
    const errors = [];
    const warnings = [];

    if (!code || typeof code !== 'string') {
        return { valid: false, errors: [{ error: 'No code provided' }], warnings: [] };
    }

    // Check each validation rule
    for (const rule of SDK_VALIDATION_RULES) {
        if (rule.pattern.test(code)) {
            errors.push({
                pattern: rule.pattern.toString(),
                error: rule.error,
                fix: rule.fix
            });
        }
    }

    // Check for potential typos in common method names
    const typoPatterns = [
        { wrong: /\.addscript\(/i, correct: 'addScript' },
        { wrong: /\.getscript\(/i, correct: 'getScript' },
        { wrong: /\.hasscript\(/i, correct: 'hasScript' },
        { wrong: /\.synctransform\(/i, correct: 'syncTransform' },
        { wrong: /\.getobjectbyname\(/i, correct: 'getObjectByName' },
        { wrong: /voxelworld\./i, correct: 'VoxelWorld' }, // Case sensitivity
        { wrong: /deltatime/i, correct: 'deltaTime' },
    ];

    for (const { wrong, correct } of typoPatterns) {
        if (wrong.test(code) && !code.includes(correct)) {
            warnings.push({
                warning: `Possible typo: Did you mean ${correct}?`,
                suggestion: `JavaScript is case-sensitive. Use ${correct}`
            });
        }
    }

    // Check for async issues
    if (code.includes('await ') && !code.includes('async ')) {
        warnings.push({
            warning: 'Using await without async function',
            suggestion: 'Wrap your code in an async IIFE: (async () => { ... })() or remove await'
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Get helpful SDK hints for a runtime error
 * @param {string} errorMessage - The error message from catch block
 * @returns {string[]} Array of helpful hints
 */
export function getSDKHintsForError(errorMessage) {
    const hints = [];
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('cannot read') && lowerError.includes('undefined')) {
        hints.push('An object or property is undefined. Check that:');
        hints.push('- The mesh exists before accessing it (this.gameObject.mesh)');
        hints.push('- You cached parts in Start() not Update()');
        hints.push('- The part name matches exactly what was defined in the mesh config');
    }

    if (lowerError.includes('parts') || lowerError.includes('find')) {
        hints.push('To find mesh parts, use: this.gameObject.mesh.getObjectByName("part_name")');
        hints.push('gameObject.parts does not exist - parts are THREE.js children of the mesh');
    }

    if (lowerError.includes('updatemesh') || lowerError.includes('update mesh')) {
        hints.push('updateMesh() does not exist - THREE.js updates automatically');
        hints.push('Just modify mesh.position.x/y/z directly and it will render');
    }

    if (lowerError.includes('not a function')) {
        hints.push('Check method spelling and capitalization');
        hints.push('Common methods: addScript, getScript, hasScript, syncTransform');
        hints.push('THREE.js methods: getObjectByName, add, remove');
    }

    if (lowerError.includes('not defined')) {
        hints.push('Available globals: VoxelWorld, game, player, THREE, Time, Vec3');
        hints.push('In scripts, use: this.gameObject, this.transform');
    }

    return hints;
}

/**
 * Format validation result for AI consumption
 * @param {Object} validation - Result from validateSDKCode
 * @returns {string} Formatted message for the AI
 */
export function formatValidationResult(validation) {
    if (validation.valid && validation.warnings.length === 0) {
        return null; // All good
    }

    let message = '';

    if (validation.errors.length > 0) {
        message += 'SDK VALIDATION ERRORS (must fix before running):\n';
        for (const err of validation.errors) {
            message += `\n❌ ${err.error}\n   Fix: ${err.fix}\n`;
        }
    }

    if (validation.warnings.length > 0) {
        message += '\nSDK WARNINGS (potential issues):\n';
        for (const warn of validation.warnings) {
            message += `\n⚠️ ${warn.warning}\n   ${warn.suggestion}\n`;
        }
    }

    return message;
}

export default {
    validateSDKCode,
    getSDKHintsForError,
    formatValidationResult
};
