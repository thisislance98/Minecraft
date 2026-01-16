/**
 * BehavioralTests - Define and run automated tests for created entities
 * Tests verify that entities exhibit expected behaviors (glowing, floating, following, etc.)
 */

export interface BehavioralTest {
    trait: string;
    description: string;
    // JavaScript code to run in the browser context
    // Should return { pass: boolean, reason: string }
    testCode: string;
}

// Behavioral tests for common creature traits
export const BEHAVIORAL_TESTS: Record<string, BehavioralTest> = {
    glow: {
        trait: 'glow',
        description: 'Entity should have emissive material (glowing effect)',
        testCode: `
            (function(entityName) {
                const entity = game.animals.find(a => a.constructor.name === entityName);
                if (!entity) return { pass: false, reason: 'Entity not found' };
                
                let hasEmissive = false;
                entity.mesh.traverse(child => {
                    if (child.material) {
                        const mat = child.material;
                        if (mat.emissive && (mat.emissiveIntensity > 0 || mat.emissive.getHex() !== 0)) {
                            hasEmissive = true;
                        }
                    }
                });
                
                return { 
                    pass: hasEmissive, 
                    reason: hasEmissive ? 'Has emissive material' : 'No emissive material found' 
                };
            })('{{ENTITY_NAME}}')
        `
    },

    float: {
        trait: 'float',
        description: 'Entity should stay airborne (not affected by gravity)',
        testCode: `
            (async function(entityName) {
                const entity = game.animals.find(a => a.constructor.name === entityName);
                if (!entity) return { pass: false, reason: 'Entity not found' };
                
                const startY = entity.position.y;
                await new Promise(r => setTimeout(r, 2000));
                const endY = entity.position.y;
                
                // If it fell more than 2 blocks, it's not floating
                const fell = startY - endY > 2;
                return { 
                    pass: !fell, 
                    reason: fell ? 'Entity fell (gravity active)' : 'Entity stayed airborne' 
                };
            })('{{ENTITY_NAME}}')
        `
    },

    follow: {
        trait: 'follow',
        description: 'Entity should move towards the player',
        testCode: `
            (async function(entityName) {
                const entity = game.animals.find(a => a.constructor.name === entityName);
                if (!entity) return { pass: false, reason: 'Entity not found' };
                
                const startDist = entity.position.distanceTo(game.player.position);
                await new Promise(r => setTimeout(r, 3000));
                const endDist = entity.position.distanceTo(game.player.position);
                
                // Should have moved closer (or stayed close if already near)
                const approached = endDist < startDist || endDist < 5;
                return { 
                    pass: approached, 
                    reason: approached ? 'Entity moved towards player' : 'Entity did not follow' 
                };
            })('{{ENTITY_NAME}}')
        `
    },

    swim: {
        trait: 'swim',
        description: 'Entity should have swimming behavior (moves in water, flops on land)',
        testCode: `
            (function(entityName) {
                const entity = game.animals.find(a => a.constructor.name === entityName);
                if (!entity) return { pass: false, reason: 'Entity not found' };
                
                // Check for water-related properties
                const hasWaterBehavior = 
                    entity.canSwim === true ||
                    entity.isAquatic === true ||
                    (entity.updatePhysics && entity.updatePhysics.toString().includes('water'));
                
                return { 
                    pass: hasWaterBehavior, 
                    reason: hasWaterBehavior ? 'Has aquatic behavior' : 'No swimming behavior detected' 
                };
            })('{{ENTITY_NAME}}')
        `
    },

    transparent: {
        trait: 'transparent',
        description: 'Entity should have transparent/translucent materials',
        testCode: `
            (function(entityName) {
                const entity = game.animals.find(a => a.constructor.name === entityName);
                if (!entity) return { pass: false, reason: 'Entity not found' };
                
                let hasTransparency = false;
                entity.mesh.traverse(child => {
                    if (child.material) {
                        const mat = child.material;
                        if (mat.transparent === true && mat.opacity < 1) {
                            hasTransparency = true;
                        }
                    }
                });
                
                return { 
                    pass: hasTransparency, 
                    reason: hasTransparency ? 'Has transparent material' : 'No transparency found' 
                };
            })('{{ENTITY_NAME}}')
        `
    }
};

/**
 * Detect which traits an entity should have based on its name/description
 */
export function detectTraits(entityName: string, description?: string): string[] {
    const searchText = `${entityName} ${description || ''}`.toLowerCase();
    const traits: string[] = [];

    const traitKeywords: Record<string, string[]> = {
        glow: ['glow', 'glowing', 'emissive', 'bright', 'luminous', 'light'],
        float: ['float', 'floating', 'hover', 'flying', 'airborne', 'levitate'],
        follow: ['follow', 'pet', 'companion', 'loyal', 'tame', 'friend'],
        swim: ['swim', 'swimming', 'aquatic', 'fish', 'shark', 'water', 'sea'],
        transparent: ['ghost', 'ghostly', 'spectral', 'transparent', 'ethereal', 'spirit']
    };

    for (const [trait, keywords] of Object.entries(traitKeywords)) {
        if (keywords.some(kw => searchText.includes(kw))) {
            traits.push(trait);
        }
    }

    return traits;
}

/**
 * Generate the verification code for a specific entity and traits
 */
export function generateVerificationCode(entityName: string, traits: string[]): string {
    if (traits.length === 0) return '';

    const tests = traits
        .filter(t => BEHAVIORAL_TESTS[t])
        .map(t => {
            const test = BEHAVIORAL_TESTS[t];
            return test.testCode.replace(/\{\{ENTITY_NAME\}\}/g, entityName);
        });

    return tests.join('\n\n');
}

/**
 * Format behavioral test results for logging
 */
export function formatTestResults(
    entityName: string,
    results: Array<{ trait: string; pass: boolean; reason: string }>
): string {
    let output = `[BehavioralTests] Results for ${entityName}:\n`;

    for (const r of results) {
        const icon = r.pass ? '✅' : '❌';
        output += `  ${icon} ${r.trait}: ${r.reason}\n`;
    }

    const passed = results.filter(r => r.pass).length;
    output += `  Total: ${passed}/${results.length} passed`;

    return output;
}
