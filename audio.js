// Audio Manager for Rhythm Battle
class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.isMuted = false;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        
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
        if (this.isMuted || !this.sounds[name]) return;
        
        try {
            // Clone the audio to allow overlapping sounds
            const sound = this.sounds[name].cloneNode();
            sound.volume = this.sfxVolume;
            sound.play().catch(e => console.warn('Audio play failed:', e));
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }
    
    // Play background music
    playMusic() {
        if (this.isMuted || !this.music) return;
        
        try {
            this.music.currentTime = 0;
            this.music.volume = this.musicVolume;
            this.music.play().catch(e => console.warn('Music play failed:', e));
        } catch (e) {
            console.warn('Error playing music:', e);
        }
    }
    
    // Pause background music
    pauseMusic() {
        if (!this.music) return;
        
        try {
            this.music.pause();
        } catch (e) {
            console.warn('Error pausing music:', e);
        }
    }
    
    // Stop background music
    stopMusic() {
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
