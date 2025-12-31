/**
 * MazeGenerator.js
 * Generates a maze layout using Recursive Backtracker algorithm.
 * Returns a 2D array where 1 is wall, 0 is path.
 */
export class MazeGenerator {
    constructor(seed = Math.random()) {
        this.seed = seed;
    }

    random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    generate(width, height) {
        // Ensure odd dimensions for walls to surround paths correctly
        if (width % 2 === 0) width++;
        if (height % 2 === 0) height++;

        const maze = Array(height).fill().map(() => Array(width).fill(1)); // 1 = Wall

        const stack = [];
        const startX = 1;
        const startY = 1;

        maze[startY][startX] = 0; // 0 = Path
        stack.push({ x: startX, y: startY });

        const directions = [
            { dx: 0, dy: -2 }, // Up
            { dx: 0, dy: 2 },  // Down
            { dx: -2, dy: 0 }, // Left
            { dx: 2, dy: 0 }   // Right
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];

            // Shuffle directions
            for (let i = directions.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }

            let found = false;
            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;

                if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx] === 1) {
                    maze[ny][nx] = 0; // Carve path to new cell
                    maze[current.y + dir.dy / 2][current.x + dir.dx / 2] = 0; // Carve path between
                    stack.push({ x: nx, y: ny });
                    found = true;
                    break;
                }
            }

            if (!found) {
                stack.pop();
            }
        }

        return maze;
    }
}
