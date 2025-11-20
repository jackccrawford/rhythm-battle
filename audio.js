// Audio Manager for Rhythm Battle
class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.isMuted = false;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;

        // Procedural music state
        this.isPlayingProceduralMusic = false;
        this.musicSchedulerId = null;
        this.musicStartTime = 0;

        // Initialize audio context
        this.audioContext = null;
        this.initAudioContext();

        // Preload sounds
        this.preloadSounds();
    }
    
    // Initialize audio context (must be called after user interaction)
    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.error('Web Audio API is not supported in this browser', e);
        }
    }
    
    // Preload all sound effects
    preloadSounds() {
        // Hit sounds
        this.loadSound('perfect', 'assets/sounds/perfect.wav');
        this.loadSound('good', 'assets/sounds/good.wav');
        this.loadSound('okay', 'assets/sounds/okay.wav');
        this.loadSound('miss', 'assets/sounds/miss.wav');
        
        // UI sounds
        this.loadSound('click', 'assets/sounds/click.wav');
        this.loadSound('start', 'assets/sounds/start.wav');
        this.loadSound('gameover', 'assets/sounds/gameover.wav');
        
        // Try to load background music if available
        try {
            this.loadMusic('bgm', 'assets/sounds/bgm.wav');
        } catch (e) {
            console.warn('Background music not available. Using a placeholder.');
            // Create a silent audio element as fallback for background music
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            silentAudio.loop = true;
            this.music = silentAudio;
        }
    }
    
    // Load a sound effect
    loadSound(name, url) {
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        
        // Handle loading errors gracefully
        audio.onerror = () => {
            console.warn(`Failed to load sound: ${name} from ${url}`);
            // Create a silent audio element as fallback
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            this.sounds[name] = silentAudio;
        };
        
        this.sounds[name] = audio;
    }
    
    // Load background music
    loadMusic(name, url) {
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = this.musicVolume;
        
        // Handle loading errors gracefully
        audio.onerror = () => {
            console.warn(`Failed to load music: ${name} from ${url}`);
            // Create a silent audio element as fallback
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            silentAudio.loop = true;
            this.music = silentAudio;
        };
        
        this.music = audio;
    }
    
    // Play a sound effect
    playSound(name) {
        if (this.isMuted) return;

        // Try to play loaded sound, fall back to procedural
        if (this.sounds[name]) {
            try {
                const sound = this.sounds[name].cloneNode();
                sound.volume = this.sfxVolume;
                sound.play().catch(e => {
                    console.warn('Audio play failed, using procedural sound:', e);
                    this.playProceduralSound(name);
                });
                return;
            } catch (e) {
                console.warn(`Error playing sound ${name}:`, e);
            }
        }

        // Play procedural sound as fallback
        this.playProceduralSound(name);
    }

    // Play procedural sound effect
    playProceduralSound(name) {
        if (!this.audioContext || this.isMuted) return;

        const now = this.audioContext.currentTime;

        switch(name) {
            case 'perfect':
                this.playPerfectSound(now);
                break;
            case 'good':
                this.playGoodSound(now);
                break;
            case 'okay':
                this.playOkaySound(now);
                break;
            case 'miss':
                this.playMissSound(now);
                break;
            case 'click':
                this.playClickSound(now);
                break;
            case 'start':
                this.playStartSound(now);
                break;
            case 'gameover':
                this.playGameOverSound(now);
                break;
        }
    }

    // Perfect hit sound - ascending sparkly tones
    playPerfectSound(startTime) {
        const frequencies = [523.25, 659.25, 783.99];
        frequencies.forEach((freq, i) => {
            this.playProceduralNote(freq, startTime + i * 0.05, 0.15, 'sine', 0.8);
        });
    }

    // Good hit sound - pleasant chord
    playGoodSound(startTime) {
        const frequencies = [440.00, 554.37];
        frequencies.forEach((freq, i) => {
            this.playProceduralNote(freq, startTime + i * 0.03, 0.12, 'sine', 0.6);
        });
    }

    // Okay hit sound - single tone
    playOkaySound(startTime) {
        this.playProceduralNote(349.23, startTime, 0.1, 'triangle', 0.5);
    }

    // Miss sound - descending dissonant tones
    playMissSound(startTime) {
        const frequencies = [200, 150, 100];
        frequencies.forEach((freq, i) => {
            this.playProceduralNote(freq, startTime + i * 0.05, 0.1, 'sawtooth', 0.4);
        });
    }

    // Click sound - short blip
    playClickSound(startTime) {
        this.playProceduralNote(800, startTime, 0.05, 'square', 0.3);
    }

    // Start sound - ascending fanfare
    playStartSound(startTime) {
        const frequencies = [261.63, 329.63, 392.00, 523.25];
        frequencies.forEach((freq, i) => {
            this.playProceduralNote(freq, startTime + i * 0.1, 0.2, 'sine', 0.7);
        });
    }

    // Game over sound - descending sequence
    playGameOverSound(startTime) {
        const frequencies = [392.00, 329.63, 261.63, 196.00];
        frequencies.forEach((freq, i) => {
            this.playProceduralNote(freq, startTime + i * 0.15, 0.3, 'sine', 0.6);
        });
    }
    
    // Play background music
    playMusic() {
        if (this.isMuted) return;

        // Stop any existing procedural music
        this.stopProceduralMusic();

        // Start procedural music generation
        this.startProceduralMusic();
    }

    // Start procedural music generation
    startProceduralMusic() {
        if (!this.audioContext) return;

        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlayingProceduralMusic = true;
        this.musicStartTime = this.audioContext.currentTime;

        // Schedule notes for the procedural music
        this.scheduleProceduralMusic();
    }

    // Stop procedural music
    stopProceduralMusic() {
        this.isPlayingProceduralMusic = false;
        if (this.musicSchedulerId) {
            clearTimeout(this.musicSchedulerId);
        }
    }

    // Schedule procedural music notes
    scheduleProceduralMusic() {
        if (!this.isPlayingProceduralMusic) return;

        const now = this.audioContext.currentTime;
        const tempo = 120; // BPM
        const beatDuration = 60 / tempo;

        // Simple melody pattern (C major scale notes)
        const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        const bassNotes = [130.81, 146.83, 164.81, 174.61];

        // Play melody note
        const melodyNote = melody[Math.floor(Math.random() * melody.length)];
        this.playProceduralNote(melodyNote, now, beatDuration * 0.3, 'sine');

        // Play bass note every 2 beats
        if (Math.random() > 0.5) {
            const bassNote = bassNotes[Math.floor(Math.random() * bassNotes.length)];
            this.playProceduralNote(bassNote, now, beatDuration * 0.5, 'square', 0.3);
        }

        // Play percussion (kick and hi-hat)
        if (Math.random() > 0.3) {
            this.playKick(now);
        }
        if (Math.random() > 0.6) {
            this.playHiHat(now);
        }

        // Schedule next notes
        this.musicSchedulerId = setTimeout(() => {
            this.scheduleProceduralMusic();
        }, beatDuration * 500); // Schedule next beat
    }

    // Play a procedural note
    playProceduralNote(frequency, startTime, duration, waveType = 'sine', volumeMultiplier = 1.0) {
        if (!this.audioContext || this.isMuted) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(frequency, startTime);

        // ADSR envelope
        const volume = this.musicVolume * volumeMultiplier * 0.3;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, startTime + duration * 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    // Play kick drum
    playKick(startTime) {
        if (!this.audioContext || this.isMuted) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(150, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        gainNode.gain.setValueAtTime(this.musicVolume * 0.5, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.5);
    }

    // Play hi-hat
    playHiHat(startTime) {
        if (!this.audioContext || this.isMuted) return;

        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }

        const noise = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        noise.buffer = buffer;
        noise.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        gainNode.gain.setValueAtTime(this.musicVolume * 0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

        noise.start(startTime);
    }
    
    // Pause background music
    pauseMusic() {
        this.stopProceduralMusic();

        if (!this.music) return;

        try {
            this.music.pause();
        } catch (e) {
            console.warn('Error pausing music:', e);
        }
    }

    // Stop background music
    stopMusic() {
        this.stopProceduralMusic();

        if (!this.music) return;

        try {
            this.music.pause();
            this.music.currentTime = 0;
        } catch (e) {
            console.warn('Error stopping music:', e);
        }
    }
    
    // Toggle mute for all audio
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.music) {
            this.music.muted = this.isMuted;
        }
        
        return this.isMuted;
    }
    
    // Set music volume (0.0 to 1.0)
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.music) {
            this.music.volume = this.musicVolume;
        }
    }
    
    // Set sound effects volume (0.0 to 1.0)
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }
}

// Create a global audio manager instance
const audioManager = new AudioManager();
