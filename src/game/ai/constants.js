/**
 * AI System Constants
 * Extracted magic numbers for better maintainability
 */

// Biome teleportation search
export const BIOME_SEARCH_MAX_RADIUS = 2000;
export const BIOME_SEARCH_STEP = 50;
export const BIOME_SEARCH_ANGLES = 16; // divisions of 2π

// Creature detection and spawning
export const CREATURE_DETECTION_RADIUS = 150;
export const MAX_SPAWN_COUNT = 10;

// AI conversation limits
export const MAX_TOOL_CALL_TURNS = 5;
export const MAX_CONVERSATION_HISTORY = 50;

// Audio processing (Hz)
export const AUDIO_SAMPLE_RATE_INPUT = 16000;
export const AUDIO_SAMPLE_RATE_OUTPUT = 24000;
export const AUDIO_BUFFER_SIZE = 2048;

// Polling intervals (ms)
export const TASK_POLL_INTERVAL = 2000;
export const VOICE_RECONNECT_DELAY = 500;

// Gemini models
export const GEMINI_MODEL_VOICE = "gemini-2.5-flash-native-audio-preview-12-2025"
export const GEMINI_MODEL_TEXT = "gemini-3-flash-preview";
export const GEMINI_MODEL_CODE = "gemini-3-flash-preview";

// WebSocket
export const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

// Default voice
export const DEFAULT_VOICE = "Puck";

// Biome name aliases (for teleportation)
export const BIOME_ALIASES = {
    'desert': 'DESERT',
    'dessert': 'DESERT', // Common typo
    'ocean': 'OCEAN',
    'sea': 'OCEAN',
    'water': 'OCEAN',
    'forest': 'FOREST',
    'woods': 'FOREST',
    'jungle': 'JUNGLE',
    'mountain': 'MOUNTAIN',
    'mountains': 'MOUNTAIN',
    'peak': 'MOUNTAIN',
    'snow': 'SNOW',
    'snowy': 'SNOW',
    'tundra': 'SNOW',
    'arctic': 'SNOW',
    'plains': 'PLAINS',
    'grassland': 'PLAINS'
};

// Creature name aliases
export const CREATURE_ALIASES = {
    'rabbit': 'Bunny',
    'hare': 'Bunny',
    'dog': 'GoldenRetriever',
    'pup': 'GoldenRetriever',
    'puppy': 'GoldenRetriever',
    'bird': 'Toucan',
    'ducky': 'Duck'
};
