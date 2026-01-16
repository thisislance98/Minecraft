
import * as THREE from 'three';

export class Studio {
    constructor(game) {
        this.game = game;
        this.isActive = false;

        // Studio Location (far away)
        this.position = new THREE.Vector3(0, 5000, 0);

        // Create Studio Scene Elements
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.visible = false;
        this.game.scene.add(this.group);

        this.setupEnvironment();
        this.setupUI();
    }

    setupEnvironment() {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(50, 50);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.group.add(floor);

        // Grid helper
        const grid = new THREE.GridHelper(50, 50, 0x444444, 0x333333);
        grid.position.y = 0.01;
        this.group.add(grid);

        // Pedestal
        const pedGeo = new THREE.CylinderGeometry(2, 2.2, 1, 32);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pedestal = new THREE.Mesh(pedGeo, pedMat);
        pedestal.position.y = 0.5;
        this.group.add(pedestal);

        // Ambient Light for Studio
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.group.add(ambientLight);

        // Spotlight for the subject
        const spotLight = new THREE.SpotLight(0xffffff, 1);
        spotLight.position.set(5, 10, 5);
        spotLight.lookAt(0, 1, 0); // Local to group? No, world. 
        // Since group is at 5000, we need to adjust
        // Actually, let's keep lights local if possible, but Three.js lights work in world space usually or need to be added to scene. 
        // Adding to group works for transform hierarchy but target needs care.
        // Let's just use a point light relative to the platform.
        const pointLight = new THREE.PointLight(0xffffff, 1, 20);
        pointLight.position.set(0, 5, 5);
        this.group.add(pointLight);
    }

    setupUI() {
        // Main Entry Button
        const btn = document.createElement('button');
        btn.id = 'studio-btn';
        btn.textContent = '🎨 Studio';
        btn.style.cssText = `
            position: fixed;
            top: 55px;
            left: 100px; /* Next to chat button */
            background: rgba(0, 0, 0, 0.8);
            padding: 8px 14px;
            border: 2px solid #ff00cc;
            border-radius: 4px;
            color: #ff00cc;
            font-size: 18px;
            font-family: 'VT323', monospace;
            z-index: 100;
            cursor: pointer;
            text-shadow: 0 0 5px #ff00cc;
            transition: all 0.2s ease;
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        document.body.appendChild(btn);

        // Studio Overlay (Exit button, instructions)
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            pointer-events: none;
            display: none;
            z-index: 99;
        `;

        const exitBtn = document.createElement('button');
        exitBtn.textContent = 'EXIT STUDIO';
        exitBtn.style.cssText = `
            position: absolute;
            top: 20px; right: 20px;
            background: #ff0000;
            color: white;
            border: 2px solid white;
            padding: 10px 20px;
            font-family: 'VT323', monospace;
            font-size: 24px;
            cursor: pointer;
            pointer-events: auto;
        `;
        exitBtn.onclick = () => this.exit();

        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <h1>DESIGN STUDIO</h1>
            <p>Use Voice (V) to design:</p>
            <p>"Create a blue robot"</p>
            <p>"Make it bigger"</p>
        `;
        instructions.style.cssText = `
            position: absolute;
            bottom: 40px; left: 40px;
            color: white;
            font-family: 'VT323', monospace;
            font-size: 24px;
            text-shadow: 2px 2px 0 #000;
        `;

        this.overlay.appendChild(exitBtn);
        this.overlay.appendChild(instructions);
        document.body.appendChild(this.overlay);
    }

    toggle() {
        if (this.isActive) this.exit();
        else this.enter();
    }

    enter() {
        if (this.isActive) return;
        this.isActive = true;
        this.group.visible = true;
        this.overlay.style.display = 'block';

        // Save previous state
        this.savedPosition = this.game.player.position.clone();
        this.savedRotation = this.game.camera.rotation.clone(); // Rough save

        // Move player/camera to studio
        // We'll just teleport the player here for simplicity, 
        // assuming the game loop uses player position for camera.
        this.game.player.position.copy(this.position).add(new THREE.Vector3(0, 2, 8));
        this.game.player.velocity.set(0, 0, 0);

        // Face the pedestal
        this.game.camera.lookAt(this.position.clone().add(new THREE.Vector3(0, 1, 0)));
        // (Note: Player controls might fight this if not handled, but let's see)

        // Hide main HUD?
        document.getElementById('hud').style.display = 'none';

        // Notify Agent?
        console.log("Entered Studio");
    }

    exit() {
        if (!this.isActive) return;
        this.isActive = false;
        this.group.visible = false;
        this.overlay.style.display = 'none';

        // Restore position
        if (this.savedPosition) {
            this.game.player.position.copy(this.savedPosition);
            this.game.player.velocity.set(0, 0, 0);
        }

        // Show HUD
        document.getElementById('hud').style.display = 'flex';
    }

    update() {
        // Rotate the pedestal or object?
        if (this.isActive) {
            // Keep player bounded or just let them fly?
            // For now, let standard controls apply.
        }
    }
}
