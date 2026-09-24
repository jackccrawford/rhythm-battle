// Audio engine for Rhythm Battle.
//
// Everything is synthesized with the Web Audio API, so the music and the notes
// share one clock and stay in perfect sync. The AudioContext is created on the
// first click/tap (browsers block audio before that).

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.musicVolume = 0.8;
        this.sfxVolume = 0.8;
        this.songBus = null;
        this.lastOutputTime = 0;
        this.paused = false; // true while the game is paused, so a stray key press can't wake the audio
    }

    get available() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    // Create (or wake up) the audio context. Call from a user gesture.
    unlock() {
        if (!this.available) return null;
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx({ latencyHint: 'interactive' });

            const compressor = this.ctx.createDynamicsCompressor();
            compressor.threshold.value = -14;
            compressor.ratio.value = 4;
            compressor.connect(this.ctx.destination);

            this.master = this.ctx.createGain();
            this.master.connect(compressor);
            this.musicBus = this.ctx.createGain();
            this.musicBus.connect(this.master);
            this.sfxBus = this.ctx.createGain();
            this.sfxBus.connect(this.master);
            this.applyVolumes();

            // One second of white noise, shared by all drum sounds.
            const len = this.ctx.sampleRate;
            this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
        return this.ctx;
    }

    get now() {
        return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
    }

    // The context time of the sound currently leaving the speakers. This is what
    // the visuals and hit timing are measured against, so latency is accounted for.
    outputTime() {
        const ctx = this.ctx;
        if (!ctx) return performance.now() / 1000;
        let t = NaN;
        if (ctx.getOutputTimestamp) {
            const ts = ctx.getOutputTimestamp();
            if (ts.contextTime > 0 && ts.performanceTime > 0) {
                t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
            }
        }
        const fallback = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
        if (!(t > ctx.currentTime - 0.5 && t < ctx.currentTime + 0.05)) t = fallback;
        // Never run backwards between frames.
        if (t < this.lastOutputTime && this.lastOutputTime - t < 0.05) t = this.lastOutputTime;
        this.lastOutputTime = t;
        return t;
    }

    suspend() {
        this.paused = true;
        if (this.ctx && this.ctx.state === 'running') return this.ctx.suspend();
        return Promise.resolve();
    }

    resume() {
        this.paused = false;
        if (this.ctx && this.ctx.state !== 'running') return this.ctx.resume();
        return Promise.resolve();
    }

    applyVolumes() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
        this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.9, t, 0.02);
        this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.02);
    }

    setMuted(muted) { this.muted = muted; this.applyVolumes(); }
    setMusicVolume(v) { this.musicVolume = v; this.applyVolumes(); }
    setSfxVolume(v) { this.sfxVolume = v; this.applyVolumes(); }

    // Each song gets its own bus so quitting can silence notes already scheduled.
    startSongBus() {
        this.stopSongBus();
        if (!this.ctx) return;
        this.songBus = this.ctx.createGain();
        this.songBus.connect(this.musicBus);
    }

    stopSongBus() {
        if (!this.songBus || !this.ctx) return;
        const bus = this.songBus;
        bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
        setTimeout(() => bus.disconnect(), 400);
        this.songBus = null;
    }

    // ---- Building blocks -------------------------------------------------

    envGain(dest, t, peak, attack, decay, sustain = 0) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
        g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
        g.connect(dest);
        return g;
    }

    osc(type, freq, t, dur, dest) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.05);
        return o;
    }

    noiseBurst(t, dur, dest, filterType, freq, q = 1) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq;
        f.Q.value = q;
        src.connect(f);
        f.connect(dest);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }

    // ---- Band (routed through the song bus) -----------------------------

    kick(t) {
        const bus = this.songBus; if (!bus) return;
        const g = this.envGain(bus, t, 0.9, 0.002, 0.28);
        const o = this.osc('sine', 150, t, 0.3, g);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    }

    snare(t) {
        const bus = this.songBus; if (!bus) return;
        this.noiseBurst(t, 0.18, this.envGain(bus, t, 0.45, 0.002, 0.16), 'bandpass', 1800, 0.8);
        this.osc('triangle', 190, t, 0.1, this.envGain(bus, t, 0.35, 0.002, 0.08));
    }

    hat(t, accent) {
        const bus = this.songBus; if (!bus) return;
        this.noiseBurst(t, 0.05, this.envGain(bus, t, accent ? 0.16 : 0.09, 0.001, 0.04), 'highpass', 7500);
    }

    bass(midi, t, dur) {
        const bus = this.songBus; if (!bus) return;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(900, t);
        f.frequency.exponentialRampToValueAtTime(220, t + dur);
        f.connect(this.envGain(bus, t, 0.4, 0.005, dur, 0.001));
        this.osc('sawtooth', midiToFreq(midi), t, dur, f);
    }

    pad(midis, t, dur) {
        const bus = this.songBus; if (!bus) return;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
        g.gain.setValueAtTime(0.06, t + dur - 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        g.connect(bus);
        midis.forEach(m => {
            this.osc('triangle', midiToFreq(m), t, dur, g);
            this.osc('sine', midiToFreq(m) * 1.004, t, dur, g);
        });
    }

    // Count-in click on beats before the song starts.
    tick(t, high) {
        const bus = this.songBus; if (!bus) return;
        this.osc('square', high ? 1568 : 1046, t, 0.06, this.envGain(bus, t, 0.12, 0.002, 0.06));
    }

    // ---- Voices ----------------------------------------------------------

    // The rival's chiptune voice.
    rivalVoice(midi, t) {
        const bus = this.songBus; if (!bus) return;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2600;
        f.connect(this.envGain(bus, t, 0.2, 0.005, 0.3, 0.001));
        this.osc('square', midiToFreq(midi), t, 0.32, f);
    }

    // The player's bright bell voice — plays on the sfx bus the instant a note is hit.
    playerVoice(midi) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = this.envGain(this.sfxBus, t, 0.32, 0.004, 0.42, 0.001);
        this.osc('triangle', midiToFreq(midi), t, 0.45, g);
        this.osc('sine', midiToFreq(midi + 12), t, 0.3, this.envGain(this.sfxBus, t, 0.08, 0.003, 0.25, 0.001));
    }

    // ---- Sound effects ---------------------------------------------------

    miss() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = this.envGain(this.sfxBus, t, 0.18, 0.004, 0.18, 0.001);
        const o = this.osc('sawtooth', 220, t, 0.2, g);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    }

    click() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('square', 880, t, 0.04, this.envGain(this.sfxBus, t, 0.08, 0.002, 0.04));
    }

    select() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [72, 79].forEach((m, i) => {
            this.osc('triangle', midiToFreq(m), t + i * 0.06, 0.12, this.envGain(this.sfxBus, t + i * 0.06, 0.2, 0.004, 0.12));
        });
    }

    countdown(go) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('square', go ? 1046 : 523, t, 0.1, this.envGain(this.sfxBus, t, 0.12, 0.003, go ? 0.25 : 0.1));
    }

    jingle(win) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = win ? [60, 64, 67, 72, 76, 79, 84] : [67, 63, 60, 55];
        const step = win ? 0.08 : 0.2;
        notes.forEach((m, i) => {
            const at = t + i * step;
            const len = i === notes.length - 1 ? 0.8 : 0.2;
            this.osc(win ? 'square' : 'triangle', midiToFreq(m), at, len,
                this.envGain(this.sfxBus, at, win ? 0.12 : 0.22, 0.005, len, 0.001));
        });
    }
}

const audio = new AudioEngine();
