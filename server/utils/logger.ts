import * as fs from 'fs';
import * as path from 'path';

export const logError = (context: string, error: any) => {
    try {
        const logPath = '/tmp/debug_error.log';
        const timestamp = new Date().toISOString();
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : 'No stack trace';

        const logEntry = `[${timestamp}] [${context}] ${errorMessage}\n${stack}\n---\n`;

        fs.appendFileSync(logPath, logEntry);
        console.error(`[${context}] Error logged to ${logPath}`);
    } catch (e) {
        console.error('Failed to write to debug log:', e);
        console.error(error);
    }
};
