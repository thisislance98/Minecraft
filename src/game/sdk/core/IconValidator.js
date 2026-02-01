/**
 * IconValidator - Just validates SVG strings
 */

/**
 * Validate an SVG icon string
 * @param {string} svg - The SVG string
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateIcon(svg) {
    const errors = [];

    if (!svg || typeof svg !== 'string') {
        errors.push('Icon must be a non-empty string');
        return { valid: false, errors };
    }

    if (!svg.includes('<svg')) {
        errors.push('Icon must contain an <svg> element');
    }

    if (!svg.includes('viewBox')) {
        errors.push('SVG must have a viewBox attribute');
    }

    // Check viewBox is 64x64
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].split(/\s+/);
        if (parts.length === 4) {
            const width = parseInt(parts[2]);
            const height = parseInt(parts[3]);
            if (width !== 64 || height !== 64) {
                errors.push(`ViewBox should be "0 0 64 64", got "${viewBoxMatch[1]}"`);
            }
        }
    }

    if (!svg.includes('</svg>') && !svg.includes('/>')) {
        errors.push('SVG must have a closing tag');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Generate a simple colored circle icon (fallback)
 */
export function simpleIcon(color = '#888888') {
    return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="${color}"/></svg>`;
}

export default { validateIcon, simpleIcon };
