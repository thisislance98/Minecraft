/**
 * ElevenLabs API Wrapper
 * Handles all API communication with ElevenLabs
 */

const BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Get API key from environment
 */
function getApiKey() {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
        throw new Error('ELEVENLABS_API_KEY environment variable is not set.\nCreate a .env file with: ELEVENLABS_API_KEY=your_key_here');
    }
    return key;
}

/**
 * Make authenticated request to ElevenLabs API
 */
async function apiRequest(endpoint, options = {}) {
    const apiKey = getApiKey();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
    }

    return response;
}

/**
 * List all available voices
 */
export async function listVoices() {
    const response = await apiRequest('/voices');
    const data = await response.json();
    return data.voices;
}

/**
 * Convert text to speech
 * @param {string} text - Text to convert
 * @param {string} voiceId - Voice ID to use
 * @param {object} options - Additional options
 */
export async function textToSpeech(text, voiceId, options = {}) {
    const {
        modelId = 'eleven_multilingual_v2',
        outputFormat = 'mp3_44100_128',
        stability = 0.5,
        similarityBoost = 0.75,
    } = options;

    const response = await apiRequest(`/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
        method: 'POST',
        body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
                stability,
                similarity_boost: similarityBoost,
            },
        }),
    });

    return response.arrayBuffer();
}

/**
 * Generate sound effect from text description
 * @param {string} prompt - Description of the sound effect
 * @param {object} options - Additional options
 */
export async function generateSoundEffect(prompt, options = {}) {
    const {
        durationSeconds = null,
        promptInfluence = 0.3,
        outputFormat = 'mp3_44100_128',
        loop = false,
    } = options;

    const body = {
        text: prompt,
        model_id: 'eleven_text_to_sound_v2',
        prompt_influence: promptInfluence,
    };

    if (durationSeconds) {
        body.duration_seconds = durationSeconds;
    }

    if (loop) {
        body.loop = true;
    }

    const response = await apiRequest(`/sound-generation?output_format=${outputFormat}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    return response.arrayBuffer();
}

/**
 * Generate music from text description
 * @param {string} prompt - Description of the music
 * @param {object} options - Additional options
 */
export async function generateMusic(prompt, options = {}) {
    const {
        durationSeconds = 30,
        promptInfluence = 0.3,
        outputFormat = 'mp3_44100_128',
        loop = false,
    } = options;

    // Music generation uses the same endpoint but with music-focused prompts
    const body = {
        text: prompt,
        model_id: 'eleven_text_to_sound_v2',
        prompt_influence: promptInfluence,
        duration_seconds: durationSeconds,
    };

    if (loop) {
        body.loop = true;
    }

    const response = await apiRequest(`/sound-generation?output_format=${outputFormat}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    return response.arrayBuffer();
}
