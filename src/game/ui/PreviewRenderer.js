
import * as THREE from 'three';

export class PreviewRenderer {
    constructor(container, width = 200, height = 200) {
        this.container = container;
        this.width = width;
        this.height = height;
        this.frameId = null;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222); // Dark gray background

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.set(0, 1, 3);
        this.camera.lookAt(0, 0, 0);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight = dirLight;
        dirLight.position.set(2, 5, 2);
        this.scene.add(dirLight);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.currentMesh = null;
        this.animate = this.animate.bind(this);
    }

    setObject(object) {
        // Clear previous object
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            // Dispose logic if needed, but usually we just remove from scene here and let GC handle if unique
        }

        if (!object) return;

        this.currentMesh = object;
        this.scene.add(this.currentMesh);

        // Center and scale object to fit
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Offset object to center
        object.position.x += (object.position.x - center.x);
        object.position.y += (object.position.y - center.y);
        object.position.z += (object.position.z - center.z);

        // Adjust camera based on size
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5; // Heuristic
        this.camera.position.set(distance, distance * 0.5, distance);
        this.camera.lookAt(0, 0, 0);

        // Start animation loop if not running
        if (!this.frameId) {
            this.animate();
        }
    }

    animate() {
        this.frameId = requestAnimationFrame(this.animate);

        if (this.currentMesh) {
            this.currentMesh.rotation.y += 0.01;
        }

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
