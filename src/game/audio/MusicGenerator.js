import * as THREE from 'three';

export class MusicGenerator {
    constructor(listener) {
        this.listener = listener;
        this.isPlaying = false;
        this.timer = null;

        // Pentatonic C Major: C D E G A
        // Octaves 3, 4, 5
        this.notes = [
            130.81, 146.83, 164.81, 196.00, 220.00, // C3 - A3
            261.63, 293.66, 329.63, 392.00, 440.00, // C4 - A4
            523.25, 587.33, 659.25, 783.99, 880.00  // C5 - A5
        ];
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.scheduleNextNote();
    }

    stop() {
        this.isPlaying = false;
        if (this.timer) clearTimeout(this.timer);
    }

    scheduleNextNote() {
        if (!this.isPlaying) return;

        // Play a random note
        this.playNote();

        // Schedule next note randomly between 2s and 6s for ambient feel
        const delay = 2000 + Math.random() * 4000;
        this.timer = setTimeout(() => this.scheduleNextNote(), delay);
    }

    playNote() {
        if (!this.listener.context) return;

        const oscillator = this.listener.context.createOscillator();
        const gainNode = this.listener.context.createGain();

        const frequency = this.notes[Math.floor(Math.random() * this.notes.length)];

        oscillator.type = 'sine'; // Sine is soft and ambient
        oscillator.frequency.value = frequency;

        // Envelope for soft attack and release
        const now = this.listener.context.currentTime;
        const duration = 2 + Math.random() * 2; // Each note lasts 2-4 seconds

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 1); // Fade in over 1s
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Fade out

        oscillator.connect(gainNode);
        gainNode.connect(this.listener.context.destination); // Connect directly to master (or through listener)

        oscillator.start(now);
        oscillator.stop(now + duration);
    }
}
