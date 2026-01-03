import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:2567';
const socket = io(serverUrl);

const playerId = 'SimulatedPlayer_' + Math.floor(Math.random() * 1000);
let health = 20;
const maxHealth = 20;

socket.on('connect', () => {
    console.log('Simulated player connected:', playerId);
    socket.emit('join_game', { name: 'Victim' });

    // Initial position near spawn (assuming 0, 80, 0 is safe-ish, or near player default)
    // We'll move in a circle
    let angle = 0;
    const center = { x: 32, y: 80, z: 32 }; // Default spawn area
    const radius = 5;

    const interval = setInterval(() => {
        angle += 0.1;
        const x = center.x + Math.sin(angle) * radius;
        const z = center.z + Math.cos(angle) * radius;

        // Decrease health occasionally
        if (Math.random() < 0.1) {
            health -= 2;
            console.log(`Taking damage! Health: ${health}`);
        }

        if (health <= 0) {
            console.log('Dying...');
            socket.emit('player:death');
            clearInterval(interval);
            setTimeout(() => {
                console.log('Disconnecting.');
                socket.disconnect();
                process.exit(0);
            }, 3000); // Wait for death animation
        } else {
            socket.emit('player:move', {
                pos: { x, y: center.y, z },
                rotY: angle + Math.PI,
                isCrouching: false,
                health: health,
                maxHealth: maxHealth
            });
        }

    }, 100);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});
