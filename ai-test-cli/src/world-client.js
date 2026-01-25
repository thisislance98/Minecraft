/**
 * World Client - HTTP client for world management API
 */

const CLI_SECRET = process.env.CLI_SECRET || 'asdf123';
const BASE_URL = process.env.API_URL || 'http://localhost:2567';

export class WorldClient {
    constructor(baseUrl = BASE_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Make an authenticated request to the world API
     */
    async request(method, path, body = null) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'x-antigravity-client': 'cli',
            'x-antigravity-secret': CLI_SECRET,
            'Content-Type': 'application/json'
        };

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    /**
     * Create a new world
     */
    async createWorld(options) {
        console.log(`[WorldClient] Creating world: ${options.name}`);
        const result = await this.request('POST', '/api/worlds', options);
        return result.world;
    }

    /**
     * List public worlds
     */
    async listPublicWorlds(limit = 20, offset = 0) {
        console.log(`[WorldClient] Listing public worlds (limit=${limit}, offset=${offset})`);
        const result = await this.request('GET', `/api/worlds?limit=${limit}&offset=${offset}`);
        return result.worlds;
    }

    /**
     * List user's own worlds
     */
    async listMyWorlds() {
        console.log(`[WorldClient] Listing my worlds`);
        const result = await this.request('GET', '/api/worlds/mine');
        return result.worlds;
    }

    /**
     * Get a specific world by ID
     */
    async getWorld(worldId) {
        console.log(`[WorldClient] Getting world: ${worldId}`);
        const result = await this.request('GET', `/api/worlds/${worldId}`);
        return result;
    }

    /**
     * Update world settings
     */
    async updateWorld(worldId, updates) {
        console.log(`[WorldClient] Updating world: ${worldId}`);
        const result = await this.request('PATCH', `/api/worlds/${worldId}`, updates);
        return result.world;
    }

    /**
     * Delete a world
     */
    async deleteWorld(worldId) {
        console.log(`[WorldClient] Deleting world: ${worldId}`);
        const result = await this.request('DELETE', `/api/worlds/${worldId}`);
        return result;
    }

    /**
     * Get shareable link for a world
     */
    async getShareLink(worldId) {
        console.log(`[WorldClient] Getting share link for world: ${worldId}`);
        const result = await this.request('GET', `/api/worlds/${worldId}/share`);
        return result;
    }
}
