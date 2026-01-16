/**
 * TraitExtractor - Extract creature/item traits from natural language prompts
 * Used by the RAG pipeline to find relevant templates and codebase examples
 */

// Trait keywords mapping - each trait has multiple keywords that trigger it
const TRAIT_KEYWORDS: Record<string, string[]> = {
    // Visual traits
    glow: ['glow', 'glowing', 'emissive', 'bright', 'luminous', 'neon', 'radiant', 'shiny', 'lit', 'light'],
    transparent: ['transparent', 'translucent', 'ghost', 'ghostly', 'spectral', 'ethereal', 'see-through', 'invisible'],

    // Movement traits
    float: ['float', 'floating', 'hover', 'hovering', 'levitate', 'levitating', 'airborne'],
    fly: ['fly', 'flying', 'wing', 'winged', 'bird', 'soar', 'soaring', 'aerial'],
    swim: ['swim', 'swimming', 'aquatic', 'fish', 'water', 'underwater', 'marine', 'ocean', 'sea'],
    bounce: ['bounce', 'bouncing', 'bouncy', 'hop', 'hopping', 'jump', 'jumping', 'spring'],

    // Behavior traits
    follow: ['follow', 'following', 'pet', 'companion', 'loyal', 'tame', 'friendly', 'friend'],
    hunt: ['hunt', 'hunting', 'chase', 'chasing', 'predator', 'attack', 'aggressive', 'hostile', 'enemy'],
    flee: ['flee', 'fleeing', 'scared', 'shy', 'timid', 'run away', 'escape'],

    // Body type traits
    quadruped: ['dog', 'cat', 'wolf', 'horse', 'pig', 'cow', 'fox', 'deer', 'four legs', 'four-legged', 'mammal'],
    biped: ['human', 'humanoid', 'person', 'villager', 'zombie', 'two legs', 'walking'],
    serpent: ['snake', 'serpent', 'worm', 'slither', 'legless'],
    insect: ['bug', 'insect', 'spider', 'ant', 'bee', 'butterfly', 'moth', 'fly'],

    // Size traits
    tiny: ['tiny', 'small', 'little', 'mini', 'miniature', 'baby'],
    giant: ['giant', 'huge', 'large', 'big', 'massive', 'enormous', 'colossal'],

    // Special traits
    fire: ['fire', 'flame', 'burning', 'fiery', 'inferno', 'hot', 'ember'],
    ice: ['ice', 'icy', 'frozen', 'frost', 'frosty', 'cold', 'snow', 'winter'],
    electric: ['electric', 'lightning', 'spark', 'shocking', 'thunder', 'zap'],
    magic: ['magic', 'magical', 'mystical', 'enchanted', 'arcane', 'wizard', 'fairy', 'spirit'],
    mechanical: ['robot', 'mechanical', 'machine', 'cyber', 'android', 'metal'],
};

// Priority order for traits (more specific traits first)
const TRAIT_PRIORITY = [
    'quadruped', 'biped', 'serpent', 'insect',  // Body type first
    'glow', 'transparent', 'fire', 'ice', 'electric',  // Visual effects
    'fly', 'float', 'swim', 'bounce',  // Movement
    'follow', 'hunt', 'flee',  // Behavior
    'tiny', 'giant',  // Size
    'magic', 'mechanical'  // Special
];

export interface ExtractedTraits {
    traits: string[];
    keywords: Record<string, string[]>;  // Which keywords triggered each trait
    prompt: string;
}

/**
 * Extract traits from a natural language prompt
 */
export function extractTraits(prompt: string): ExtractedTraits {
    const lower = prompt.toLowerCase();
    const traits: string[] = [];
    const keywords: Record<string, string[]> = {};

    // Check each trait's keywords
    for (const trait of TRAIT_PRIORITY) {
        const traitKeywords = TRAIT_KEYWORDS[trait];
        const matchedKeywords = traitKeywords.filter(kw => lower.includes(kw));

        if (matchedKeywords.length > 0) {
            traits.push(trait);
            keywords[trait] = matchedKeywords;
        }
    }

    return { traits, keywords, prompt };
}

/**
 * Check if a prompt looks like a creation request
 */
export function isCreationRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const creationVerbs = [
        'create', 'make', 'spawn', 'summon', 'conjure', 'generate',
        'build', 'craft', 'design', 'give me', 'i want', 'can you make'
    ];

    return creationVerbs.some(verb => lower.includes(verb));
}

/**
 * Generate search queries for knowledge base based on traits
 */
export function generateSearchQueries(traits: string[]): string[] {
    const queries: string[] = [];

    // Single trait queries
    for (const trait of traits) {
        queries.push(trait);
    }

    // Trait combination queries (pairs)
    for (let i = 0; i < traits.length; i++) {
        for (let j = i + 1; j < traits.length; j++) {
            queries.push(`${traits[i]} ${traits[j]}`);
        }
    }

    return queries;
}

// Export the trait keywords for use in codebase indexing
export { TRAIT_KEYWORDS };
