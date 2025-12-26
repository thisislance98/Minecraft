// Assuming civitai package usage or just exporting the key for now if package not found/clear
import dotenv from 'dotenv';
dotenv.config();

const civitaiApiKey = process.env.CIVITAI_API_KEY;

if (!civitaiApiKey) {
    console.warn('CIVITAI_API_KEY not set.');
}

export const CIVITAI_API_KEY = civitaiApiKey;
// If there is a client:
// import { Civitai } from 'civitai';
// export const civitai = new Civitai({ auth: civitaiApiKey });
