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

        this.currentTrack = null;
        this.playlist = [music1, music2];

        // Load mute preference
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
        };

        document.addEventListener('click', startAudio);
        document.addEventListener('keydown', startAudio);
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
