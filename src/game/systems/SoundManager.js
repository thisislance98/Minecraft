import * as THREE from 'three';
import music1 from '../audio/roblox-minecraft-fortnite-video-game-music-299145.mp3';
import music2 from '../audio/roblox-minecraft-fortnite-video-game-music-358426.mp3';

export class SoundManager {
    constructor(game) {
        this.game = game;
        this.audioContext = null;
        this.listener = new THREE.AudioListener();
        this.game.camera.add(this.listener);

        this.backgroundMusic = new THREE.Audio(this.listener);
        this.audioLoader = new THREE.AudioLoader();
        this.isInitialized = false;
        this.musicVolume = 0.5;
        this.sfxVolume = 1.0;

        this.currentTrack = null;
        this.playlist = [music1, music2];

        // Sound Registry
        this.sounds = new Map();
        this.soundRegistry = {
            'click': '/sounds/click.mp3',
            'pig_oink': '/sounds/pig_oink.mp3',
            'cow_moo': '/sounds/cow_moo.mp3',
            // ElevenLabs generated sounds
            'footstep_grass': '/sounds/footstep_grass.mp3',
            'footstep_stone': '/sounds/footstep_stone.mp3',
            'block_break': '/sounds/block_break.mp3',
            'block_place': '/sounds/block_place.mp3',
            'item_pickup': '/sounds/item_pickup.mp3',
            'jump': '/sounds/jump.mp3',
            'damage': '/sounds/damage.mp3',
            'levelup': '/sounds/levelup.mp3',
            'teleport': '/sounds/teleport.mp3',
            'rumble': '/sounds/rumble.mp3',
            'splash': '/sounds/splash.mp3'
        };

        // Load mute preference - default to unmuted (music on)
        this.isMuted = localStorage.getItem('isMuted') === 'true';
        this.listener.setMasterVolume(this.isMuted ? 0 : 1);
    }

    init() {
        if (this.isInitialized) return;

        const startAudio = () => {
            if (this.listener.context.state === 'suspended') {
                this.listener.context.resume().then(() => {
                    console.log('AudioContext resumed');
                    this.playMusic();
                });
            } else {
                this.playMusic();
            }
            this.isInitialized = true;
            document.removeEventListener('click', startAudio);
            document.removeEventListener('keydown', startAudio);

            // Preload sounds
            this.preloadSounds();
        };

        document.addEventListener('click', startAudio);
        document.addEventListener('keydown', startAudio);
    }

    preloadSounds() {
        for (const [name, path] of Object.entries(this.soundRegistry)) {
            this.audioLoader.load(path, (buffer) => {
                this.sounds.set(name, buffer);
            }, undefined, (err) => {
                console.warn(`Failed to load sound: ${name} at ${path}`, err);
            });
        }
    }

    playMusic() {
        if (this.backgroundMusic.isPlaying) return;

        // Pick a random track
        const track = this.playlist[Math.floor(Math.random() * this.playlist.length)];
        console.log('Playing track:', track);

        this.audioLoader.load(track, (buffer) => {
            this.backgroundMusic.setBuffer(buffer);
            this.backgroundMusic.setLoop(true);
            this.backgroundMusic.setVolume(this.musicVolume);
            this.backgroundMusic.play();
            console.log('Background music playing');
        },
            // onProgress
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // onError
            (err) => {
                console.error('An error happened loading music', err);
            });
    }

    playSound(soundName, position = null, volume = 1.0) {
        if (this.isMuted) return;

        const buffer = this.sounds.get(soundName);
        if (!buffer) {
            // Try loading it on the fly if not preloaded (or if it failed earlier)
            if (this.soundRegistry[soundName]) {
                this.audioLoader.load(this.soundRegistry[soundName], (buff) => {
                    this.sounds.set(soundName, buff);
                    this._playSoundBuffer(buff, position, volume);
                });
            } else {
                // If it's not in registry, maybe just log or ignore
                // console.warn(`Sound not found: ${soundName}`);
            }
            return;
        }

        this._playSoundBuffer(buffer, position, volume);
    }

    _playSoundBuffer(buffer, position, volume) {
        if (position) {
            // Positional Audio
            const sound = new THREE.PositionalAudio(this.listener);
            sound.setBuffer(buffer);
            sound.setRefDistance(5);
            sound.setVolume(volume * this.sfxVolume);

            // We need to attach it to a mesh/object or set its position
            // Since we might not have the mesh reference passed easily, setting position directly
            sound.position.copy(position);

            // We need to add it to the scene or a parent to update its matrix world
            // Ideally attached to the animal mesh, but 'position' argument suggests coordinate.
            // If position is a Vector3, we just place it in the scene temporarily?
            // Audio works best when added to the scene graph.
            this.game.scene.add(sound);

            sound.play();

            // Clean up after playing
            sound.onEnded = () => {
                this.game.scene.remove(sound);
            };
        } else {
            // Global Audio
            const sound = new THREE.Audio(this.listener);
            sound.setBuffer(buffer);
            sound.setVolume(volume * this.sfxVolume);
            sound.play();
        }
    }

    stopMusic() {
        if (this.backgroundMusic.isPlaying) {
            this.backgroundMusic.stop();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.listener.setMasterVolume(this.isMuted ? 0 : 1);
        localStorage.setItem('isMuted', this.isMuted);
        return this.isMuted;
    }
}
