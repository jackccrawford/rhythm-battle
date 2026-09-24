'use strict';

// ============================================================================
// Rhythm Battle
//
// A call-and-response rhythm game: the rival sings a pattern on the left,
// then you copy it on the right. All timing is driven by the Web Audio clock
// (see audio.js), so notes, music and your hits always line up — no matter
// how fast the screen refreshes.
// ============================================================================

// ---------- Constants ----------

const LANE_COLORS = ['#ff4fb8', '#28e0ff', '#b36bff', '#ffe14d'];
// Arrows are drawn pointing up, then rotated: ← ↓ ↑ →
const LANE_ANGLES = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
const KEY_TO_LANE = {
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3
};

// lead = seconds a note is visible before it must be hit.
// windows = [perfect, good, okay] in seconds either side of the note.
const DIFFICULTY = {
    easy:   { lead: 1.7,  windows: [0.075, 0.135, 0.20],  missDamage: 3, canFail: false },
    medium: { lead: 1.25, windows: [0.055, 0.10, 0.15],   missDamage: 6, canFail: true },
    hard:   { lead: 0.95, windows: [0.042, 0.08, 0.125],  missDamage: 8, canFail: true }
};

const JUDGMENTS = [
    { key: 'perfect', text: 'PERFECT!', color: '#ffe14d', score: 350, heal: 2.5, weight: 1 },
    { key: 'good',    text: 'GOOD!',    color: '#5dff8f', score: 200, heal: 1.6, weight: 0.75 },
    { key: 'okay',    text: 'OKAY',     color: '#28e0ff', score: 100, heal: 0.6, weight: 0.4 }
];
const MISS = { key: 'miss', text: 'MISS', color: '#ff5a6e' };

const PLAYER_LOOK = { skin: '#FFE4CF', hair: '#ff4fb8', style: 'buns', accent: '#28e0ff' };
const PLAYER_BAR = '#5dff8f';
const INK = '#1a0f2e';
const DISPLAY_FONT = '"Bungee", "Arial Black", sans-serif';
const BODY_FONT = '"Baloo 2", "Trebuchet MS", sans-serif';

// ---------- Save data ----------

const SAVE_KEY = 'rhythmBattle.save.v2';
const prefersReducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SAVE_DEFAULTS = {
    name: 'Evalyn',
    rival: 0,
    difficulty: 'easy',
    unlocked: 1,
    musicVol: 0.8,
    sfxVol: 0.8,
    muted: false,
    scroll: 'down',
    shake: !prefersReducedMotion,
    offsetMs: 0,
    best: {}
};

function loadSave() {
    try {
        return { ...SAVE_DEFAULTS, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
    } catch (e) {
        return { ...SAVE_DEFAULTS };
    }
}

function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
}

const save = loadSave();

function playerName() {
    return save.name || 'Player';
}

function withName(text) {
    return text.replace(/\{name\}/g, playerName());
}

// ---------- State ----------

const $ = id => document.getElementById(id);
let canvas, ctx;
const view = { W: 960, H: 600, scale: 1, dpr: 1, portrait: false };
let layout = null;

let state = 'title'; // title | menu | playing | paused | resuming | ending | results
let run = null;      // the battle in progress
let schedulerId = null;
let lastFrame = 0;
let menuClock = 0;
let halftone = null;

const held = [false, false, false, false];
const pointerLanes = new Map();

const fx = {
    particles: [],
    popups: [],
    rings: [],
    flash: { opp: [0, 0, 0, 0], player: [0, 0, 0, 0] },
    shake: 0,
    decor: []
};
const chars = {
    opp: { lane: -1, sing: 0, oops: 0 },
    player: { lane: -1, sing: 0, oops: 0 }
};

// ============================================================================
// Layout
// ============================================================================

function computeLayout() {
    const aspect = window.innerWidth / window.innerHeight;
    const portrait = aspect < 0.85;
    view.portrait = portrait;
    // One dimension is fixed; the other stretches (within limits) to fill the screen.
    const W = portrait ? 600 : Math.round(Math.min(1180, Math.max(900, 600 * aspect)));
    const H = portrait ? Math.round(Math.min(1300, Math.max(900, 600 / aspect))) : 600;
    view.W = W;
    view.H = H;
    view.scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const cssW = Math.floor(W * view.scale);
    const cssH = Math.floor(H * view.scale);
    const stage = $('stage');
    stage.style.width = cssW + 'px';
    stage.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * view.dpr);
    canvas.height = Math.round(cssH * view.dpr);

    if (portrait) {
        const play = H - 480; // height of the player's area
        layout = {
            strums: {
                opp: { x0: 150, laneW: 75, top: 242, bottom: 470, margin: 38 },
                player: { x0: 16, laneW: 142, top: 480, bottom: H, margin: 100 }
            },
            chars: { opp: { x: 96, y: 128, r: 40 }, player: { x: 504, y: 128, r: 40 } },
            health: { x: 300, y: 64, w: 250 },
            score: { x: 300, y: 104 },
            banner: { x: 300, y: 170 },
            judge: { x: 300, y: 480 + play * 0.33 },
            countdown: { x: 300, y: 480 + play * 0.27 },
            progress: { x: 20, y: 234, w: 560 },
            pause: { x: 10, y: 10 },
            muteRight: W - 10
        };
    } else {
        const px0 = W - 362;             // player strum on the right edge
        const cx = (296 + px0) / 2;      // middle of the space between the strums
        layout = {
            strums: {
                opp: { x0: 32, laneW: 66, top: 0, bottom: H, margin: 78 },
                player: { x0: px0, laneW: 88, top: 0, bottom: H, margin: 84 }
            },
            chars: { opp: { x: cx - 59, y: 318, r: 44 }, player: { x: cx + 61, y: 318, r: 44 } },
            health: { x: cx, y: 88, w: 250 },
            score: { x: cx, y: 128 },
            banner: { x: cx, y: 200 },
            judge: { x: cx, y: 470 },
            countdown: { x: cx, y: 300 },
            progress: { x: cx - 135, y: 586, w: 270 },
            pause: { x: 306, y: 12 },
            muteRight: px0 - 10
        };
    }

    for (const side of ['opp', 'player']) {
        const s = layout.strums[side];
        s.width = s.laneW * 4;
        s.noteSize = s.laneW * 0.74;
        s.down = save.scroll !== 'up';
        s.receptorY = s.down ? s.bottom - s.margin : s.top + s.margin;
        s.travel = s.down ? s.receptorY - s.top + s.noteSize : s.bottom - s.receptorY + s.noteSize;
    }

    positionButtons();
}

// HTML buttons live in CSS pixels on top of the canvas. During a battle they sit
// in the gap between the strums; in menus the mute button goes in the corner.
function positionButtons() {
    const hud = $('hudButtons');
    hud.style.left = layout.pause.x * view.scale + 'px';
    hud.style.top = layout.pause.y * view.scale + 'px';
    const mute = $('muteButton');
    const right = run ? layout.muteRight * view.scale : view.W * view.scale - 10;
    mute.style.left = (right - 44) + 'px';
    mute.style.right = 'auto';
    mute.style.top = (run ? layout.pause.y * view.scale : 10) + 'px';
}

function laneX(strum, lane) {
    return strum.x0 + strum.laneW * (lane + 0.5);
}

// ============================================================================
// Screens & menus
// ============================================================================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('hidden', el.id !== id));
    if (!id) return;
    const el = $(id);
    const focusTarget = el.querySelector('[data-autofocus]') || el.querySelector('.btn-big');
    if (focusTarget && !matchMedia('(pointer: coarse)').matches) focusTarget.focus({ preventScroll: true });
}

function currentScreen() {
    const el = document.querySelector('.screen:not(.hidden)');
    return el ? el.id : null;
}

function goTitle() {
    state = 'title';
    showScreen('titleScreen');
    $('hudButtons').classList.add('hidden');
}

function goSelect() {
    state = 'menu';
    renderRivalCards();
    updateDifficultyButtons();
    showScreen('selectScreen');
    $('hudButtons').classList.add('hidden');
}

function renderRivalCards() {
    const wrap = $('rivalCards');
    wrap.innerHTML = '';
    RIVALS.forEach((rival, i) => {
        const locked = i >= save.unlocked;
        const btn = document.createElement('button');
        btn.className = 'rival-card' + (locked ? ' locked' : '');
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(i === save.rival));
        btn.setAttribute('aria-label', locked ? `${rival.name} (locked)` : `${rival.name}: ${rival.song.title}`);

        const art = document.createElement('canvas');
        art.width = 200;
        art.height = 200;
        drawCardPortrait(art, rival);
        btn.appendChild(art);

        const best = save.best[`${rival.id}:${save.difficulty}`];
        btn.insertAdjacentHTML('beforeend', `
            <div class="r-name">${rival.name}</div>
            <div class="r-song">${locked ? '???' : '♪ ' + rival.song.title}</div>
            <div class="r-best">${best ? starText(best.stars) + ' ' + best.grade : ''}</div>
            ${locked ? '<div class="lock">🔒</div>' : ''}`);

        btn.addEventListener('click', () => {
            if (locked) {
                audio.miss();
                $('rivalIntro').textContent = `Beat ${RIVALS[i - 1].name} to unlock!`;
                return;
            }
            selectRival(i);
        });
        wrap.appendChild(btn);
    });
    updateRivalIntro();
}

function selectRival(i) {
    if (i < 0 || i >= save.unlocked || i === save.rival) return;
    save.rival = i;
    persist();
    audio.click();
    document.querySelectorAll('.rival-card').forEach((el, j) => el.setAttribute('aria-checked', String(j === i)));
    updateRivalIntro();
}

function updateRivalIntro() {
    const rival = RIVALS[save.rival];
    $('rivalIntro').textContent = `${rival.name}: “${withName(rival.intro)}”`;
}

function updateDifficultyButtons() {
    document.querySelectorAll('.diff-btn').forEach(b => {
        b.setAttribute('aria-checked', String(b.dataset.diff === save.difficulty));
    });
}

function starText(n) {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
}

function drawCardPortrait(cv, rival) {
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(100, 90, 10, 100, 100, 100);
    g.addColorStop(0, rival.look.hair);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 200, 200);
    drawCharacter(c, 100, 92, 50, rival.look, { lane: -1, sing: 0, mood: 'neutral', bob: 0 });
}

function syncSettingsUI() {
    $('musicVol').value = save.musicVol;
    $('sfxVol').value = save.sfxVol;
    $('offsetInput').value = save.offsetMs;
    $('offsetLabel').textContent = `${save.offsetMs > 0 ? '+' : ''}${save.offsetMs} ms`;
    document.querySelectorAll('[data-scroll]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.scroll === save.scroll)));
    document.querySelectorAll('[data-shake]').forEach(b => b.setAttribute('aria-checked', String((b.dataset.shake === 'on') === save.shake)));
}

function updateName() {
    $('titleName').textContent = playerName();
}

function setupMenus() {
    const nameInput = $('nameInput');
    nameInput.value = save.name;
    updateName();
    nameInput.addEventListener('input', () => {
        save.name = nameInput.value.trim().slice(0, 12);
        updateName();
        persist();
    });

    $('playButton').addEventListener('click', goSelect);
    $('howButton').addEventListener('click', () => showScreen('howScreen'));
    $('settingsButton').addEventListener('click', () => { syncSettingsUI(); showScreen('settingsScreen'); });
    $('backFromHow').addEventListener('click', goTitle);
    $('backFromSettings').addEventListener('click', goTitle);
    $('backFromSelect').addEventListener('click', goTitle);
    $('startButton').addEventListener('click', startBattle);

    document.querySelectorAll('.diff-btn').forEach(b => b.addEventListener('click', () => {
        save.difficulty = b.dataset.diff;
        persist();
        updateDifficultyButtons();
        renderRivalCards();
    }));

    $('musicVol').addEventListener('input', e => { save.musicVol = +e.target.value; audio.setMusicVolume(save.musicVol); persist(); });
    $('sfxVol').addEventListener('input', e => { save.sfxVol = +e.target.value; audio.setSfxVolume(save.sfxVol); audio.click(); persist(); });
    $('offsetInput').addEventListener('input', e => { save.offsetMs = +e.target.value; syncSettingsUI(); persist(); });
    document.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => {
        save.scroll = b.dataset.scroll; persist(); syncSettingsUI(); computeLayout();
    }));
    document.querySelectorAll('[data-shake]').forEach(b => b.addEventListener('click', () => {
        save.shake = b.dataset.shake === 'on'; persist(); syncSettingsUI();
    }));
    $('resetProgress').addEventListener('click', () => {
        if (!confirm('Reset unlocked rivals and best scores?')) return;
        save.unlocked = 1;
        save.rival = 0;
        save.best = {};
        persist();
        audio.miss();
    });

    $('pauseButton').addEventListener('click', pauseGame);
    $('resumeButton').addEventListener('click', resumeGame);
    $('restartButton').addEventListener('click', () => { stopRun(); startBattle(); });
    $('quitButton').addEventListener('click', () => { stopRun(); goSelect(); });
    $('retryButton').addEventListener('click', () => { stopRun(); startBattle(); });
    $('menuFromResults').addEventListener('click', () => { stopRun(); goSelect(); });
    $('nextButton').addEventListener('click', () => {
        stopRun();
        save.rival = Math.min(save.rival + 1, save.unlocked - 1);
        persist();
        startBattle();
    });

    $('muteButton').addEventListener('click', () => {
        save.muted = !save.muted;
        persist();
        audio.setMuted(save.muted);
        updateMuteButton();
    });
    updateMuteButton();

    // A little click on every button press.
    document.querySelectorAll('.btn, .diff-btn, .toggle-btn').forEach(b => {
        b.addEventListener('pointerdown', () => { audio.unlock(); audio.click(); });
    });
}

function updateMuteButton() {
    const b = $('muteButton');
    b.textContent = save.muted ? '🔇' : '🔊';
    b.setAttribute('aria-label', save.muted ? 'Unmute sound' : 'Mute sound');
}

// ============================================================================
// Battle flow
// ============================================================================

function startBattle() {
    audio.unlock();
    audio.setMuted(save.muted);
    audio.setMusicVolume(save.musicVol);
    audio.setSfxVolume(save.sfxVol);

    const rival = RIVALS[save.rival];
    const cfg = DIFFICULTY[save.difficulty];
    const chart = buildChart(rival, save.difficulty);
    const spb = 60 / rival.song.bpm;

    const laneNotes = [[], [], [], []];
    const oppNotes = [];
    for (const n of chart.notes) {
        n.judged = false;
        n.done = false;
        if (n.side === 'player') laneNotes[n.lane].push(n);
        else oppNotes.push(n);
    }

    run = {
        rival,
        difficulty: save.difficulty,
        cfg,
        chart,
        spb,
        startAt: audio.now + 0.6,
        endTime: chart.totalBeats * spb,
        oppNotes,
        laneNotes,
        laneIdx: [0, 0, 0, 0],
        playerTotal: laneNotes.reduce((sum, l) => sum + l.length, 0),
        oppIdx: 0,
        schedStep: 0,
        schedOpp: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        counts: { perfect: 0, good: 0, okay: 0, miss: 0 },
        weightSum: 0,
        judgedCount: 0,
        health: 50,
        frozenPos: null,
        pausedWall: 0,
        resumeCount: 0,
        finished: false
    };

    resetFx();
    releaseAllLanes();
    computeLayout();
    audio.startSongBus();
    showScreen(null);
    $('hudButtons').classList.remove('hidden');
    state = 'playing';

    clearInterval(schedulerId);
    schedulerId = setInterval(scheduleAudio, 25);
    scheduleAudio();
}

function stopRun() {
    clearInterval(schedulerId);
    schedulerId = null;
    audio.stopSongBus();
    audio.resume();
    run = null;
    releaseAllLanes();
    positionButtons();
}

function resetFx() {
    fx.particles.length = 0;
    fx.popups.length = 0;
    fx.rings.length = 0;
    fx.flash.opp.fill(0);
    fx.flash.player.fill(0);
    fx.shake = 0;
    chars.opp.sing = chars.player.sing = 0;
    chars.opp.oops = chars.player.oops = 0;
}

// Song position in seconds (0 = first count-in beat), as heard through the speakers.
function songPos() {
    if (!run) return 0;
    if (run.frozenPos !== null) return run.frozenPos;
    return audio.outputTime() - run.startAt - save.offsetMs / 1000;
}

// Schedules the band and the rival's voice slightly ahead of time.
function scheduleAudio() {
    if (!run || !audio.ctx || audio.ctx.state !== 'running') return;
    const now = audio.ctx.currentTime;
    const horizon = now + 0.15;
    const stepDur = run.spb / 4;
    const totalSteps = run.chart.totalBeats * 4;

    while (run.schedStep < totalSteps) {
        const t = run.startAt + run.schedStep * stepDur;
        if (t > horizon) break;
        if (t >= now - 0.03) scheduleStep(run.schedStep, t);
        run.schedStep++;
    }

    while (run.schedOpp < run.oppNotes.length) {
        const n = run.oppNotes[run.schedOpp];
        const t = run.startAt + n.time;
        if (t > horizon) break;
        if (t >= now - 0.03) audio.rivalVoice(n.midi, t);
        run.schedOpp++;
    }
}

function scheduleStep(step, t) {
    const song = run.rival.song;
    const beat = step / 4;
    const countSteps = COUNT_IN_BEATS * 4;

    if (step < countSteps) {
        if (step % 4 === 0) audio.tick(t, step === countSteps - 4);
        return;
    }

    const outroBeat = run.chart.totalBeats - OUTRO_BEATS;
    const barStep = (step - countSteps) % 16;
    const chord = chordAtBeat(song, beat);

    if (beat >= outroBeat) {
        // One big final chord.
        if (beat === outroBeat) {
            const tonic = parseChord(song.chords[0]);
            audio.kick(t);
            audio.snare(t);
            audio.pad([48, 52 - (tonic.minor ? 1 : 0), 55, 60].map(m => m + tonic.root), t, run.spb * 3);
            audio.bass(36 + tonic.root, t, run.spb * 2);
        }
        return;
    }

    const d = song.drums;
    if (d.kick[barStep] === 'x') audio.kick(t);
    if (d.snare[barStep] === 'x') audio.snare(t);
    if (d.hat[barStep] === 'x') audio.hat(t, barStep % 4 === 0);

    const b = song.bass[barStep];
    if (b === 'x' || b === 'o') audio.bass(36 + chord.root + (b === 'o' ? 12 : 0), t, run.spb * 0.45);

    if (barStep === 0) {
        const tones = chordTones(chord);
        audio.pad([48 + chord.root + tones[0], 48 + chord.root + tones[1], 48 + chord.root + tones[2]], t, run.spb * 4);
    }
}

function pauseGame() {
    if (state !== 'playing' || !run) return;
    run.frozenPos = songPos();
    run.pausedWall = performance.now();
    state = 'paused';
    releaseAllLanes();
    audio.suspend();
    $('hudButtons').classList.add('hidden');
    showScreen('pauseScreen');
}

function resumeGame() {
    if (state !== 'paused' || !run) return;
    state = 'resuming';
    showScreen(null);
    run.resumeCount = 3;
    const tick = () => {
        if (state !== 'resuming' || !run) return;
        run.resumeCount--;
        if (run.resumeCount > 0) {
            setTimeout(tick, 450);
            return;
        }
        // Without Web Audio the clock is wall time, so skip over the pause.
        if (!audio.ctx) run.startAt += (performance.now() - run.pausedWall) / 1000;
        audio.resume().then(() => {
            if (!run || state !== 'resuming') return;
            audio.lastOutputTime = 0;
            run.frozenPos = null;
            state = 'playing';
            $('hudButtons').classList.remove('hidden');
        });
    };
    setTimeout(tick, 450);
}

// ============================================================================
// Input
// ============================================================================

function releaseAllLanes() {
    held.fill(false);
    pointerLanes.clear();
}

function inBattle() {
    return state === 'playing' || state === 'resuming';
}

function pressLane(lane) {
    held[lane] = true;
    if (state !== 'playing' || !run) return;

    const pos = songPos();
    const notes = run.laneNotes[lane];
    let i = run.laneIdx[lane];
    while (i < notes.length && notes[i].judged) i++;
    const note = notes[i];
    if (!note) return;

    const err = pos - note.time;
    const w = run.cfg.windows;
    if (Math.abs(err) > w[2]) return; // pressing between notes is fine — no penalty

    const j = Math.abs(err) <= w[0] ? JUDGMENTS[0] : Math.abs(err) <= w[1] ? JUDGMENTS[1] : JUDGMENTS[2];
    hitNote(note, j, err);
}

function releaseLane(lane) {
    held[lane] = false;
}

function onKeyDown(e) {
    const inInput = e.target && e.target.tagName === 'INPUT' && e.target.type === 'text';
    audio.unlock();

    if (e.code === 'Escape' || (e.code === 'KeyP' && !inInput)) {
        e.preventDefault();
        if (state === 'playing') pauseGame();
        else if (state === 'paused') resumeGame();
        else if (['howScreen', 'settingsScreen', 'selectScreen'].includes(currentScreen())) goTitle();
        return;
    }

    const lane = KEY_TO_LANE[e.code];
    if (inBattle() && lane !== undefined) {
        e.preventDefault();
        if (!e.repeat && !held[lane]) pressLane(lane);
        return;
    }

    const onTitle = state === 'title' && currentScreen() === 'titleScreen';
    if (onTitle && e.code === 'Enter' && (inInput || e.target === document.body)) {
        e.preventDefault();
        goSelect();
        return;
    }

    if (currentScreen() === 'selectScreen' && !inInput) {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            e.preventDefault();
            selectRival(save.rival + (e.code === 'ArrowLeft' ? -1 : 1));
        }
    }
}

function onKeyUp(e) {
    // Always release, even while paused, so keys never get stuck.
    const lane = KEY_TO_LANE[e.code];
    if (lane !== undefined) releaseLane(lane);
}

function pointerToLogical(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / rect.width * view.W,
        y: (e.clientY - rect.top) / rect.height * view.H
    };
}

function onPointerDown(e) {
    audio.unlock();
    if (!inBattle()) return;
    e.preventDefault();
    const p = pointerToLogical(e);
    const s = layout.strums.player;
    if (p.x < s.x0 || p.x > s.x0 + s.width || p.y < s.top) return;
    const lane = Math.min(3, Math.floor((p.x - s.x0) / s.laneW));
    pointerLanes.set(e.pointerId, lane);
    pressLane(lane);
}

function onPointerUp(e) {
    const lane = pointerLanes.get(e.pointerId);
    if (lane === undefined) return;
    pointerLanes.delete(e.pointerId);
    if (![...pointerLanes.values()].includes(lane)) releaseLane(lane);
}

// ============================================================================
// Judging
// ============================================================================

function hitNote(note, j, err) {
    note.judged = true;
    note.result = j.key;
    run.counts[j.key]++;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.weightSum += j.weight;
    run.judgedCount++;
    run.score += Math.round(j.score * (1 + Math.min(run.combo, 50) / 50));
    run.health = Math.min(100, run.health + j.heal);

    audio.playerVoice(note.midi);

    const s = layout.strums.player;
    const x = laneX(s, note.lane);
    fx.flash.player[note.lane] = 1;
    chars.player.lane = note.lane;
    chars.player.sing = 1;
    fx.rings.push({ x, y: s.receptorY, age: 0, life: 0.35, color: j.color, size: s.noteSize });
    burst(x, s.receptorY, LANE_COLORS[note.lane], j.key === 'perfect' ? 14 : 8);
    if (j.key === 'perfect' && run.combo % 4 === 0) singNote(layout.chars.player, note.lane);

    const sub = j.key === 'perfect' ? '' : err < 0 ? 'early' : 'late';
    popup(j.text, j.color, sub);
}

function missNote(note) {
    note.judged = true;
    note.result = 'miss';
    run.counts.miss++;
    run.combo = 0;
    run.judgedCount++;
    run.health = Math.max(run.cfg.canFail ? 0 : 2, run.health - run.cfg.missDamage);

    audio.miss();
    chars.player.oops = 0.6;
    if (save.shake) fx.shake = Math.max(fx.shake, 6);
    popup(MISS.text, MISS.color, '');

    if (run.health <= 0 && run.cfg.canFail) finishRun(false);
}

function popup(text, color, sub) {
    // Only keep the newest judgment on screen, like a scoreboard.
    fx.popups.length = 0;
    fx.popups.push({ text, color, sub, age: 0, life: 0.6 });
}

function accuracy() {
    return run.judgedCount ? run.weightSum / run.judgedCount * 100 : 100;
}

function gradeFor(acc, counts, total) {
    if (counts.perfect === total && total > 0) return { grade: 'S+', color: '#ffe14d' };
    if (acc >= 95) return { grade: 'S', color: '#ffe14d' };
    if (acc >= 88) return { grade: 'A', color: '#5dff8f' };
    if (acc >= 78) return { grade: 'B', color: '#28e0ff' };
    if (acc >= 65) return { grade: 'C', color: '#b36bff' };
    return { grade: 'D', color: '#ff5a6e' };
}

function finishRun(won) {
    if (!run || run.finished) return;
    run.finished = true;
    run.frozenPos = songPos();
    state = 'ending';
    clearInterval(schedulerId);
    schedulerId = null;
    releaseAllLanes();
    $('hudButtons').classList.add('hidden');

    if (won) {
        audio.jingle(true);
        celebrate();
    } else {
        audio.stopSongBus();
        audio.jingle(false);
    }

    const acc = accuracy();
    const { grade, color } = gradeFor(acc, run.counts, run.playerTotal);
    const stars = won ? 1 + (acc >= 80 ? 1 : 0) + (acc >= 93 ? 1 : 0) : 0;
    const fullCombo = won && run.counts.miss === 0;

    const key = `${run.rival.id}:${run.difficulty}`;
    const prev = save.best[key];
    const newBest = won && (!prev || run.score > prev.score);
    if (newBest) save.best[key] = { score: run.score, grade, stars: Math.max(stars, prev ? prev.stars : 0) };
    else if (won && prev && stars > prev.stars) prev.stars = stars;

    const idx = RIVALS.indexOf(run.rival);
    let unlockedName = null;
    if (won && idx + 1 < RIVALS.length && save.unlocked < idx + 2) {
        save.unlocked = idx + 2;
        unlockedName = RIVALS[idx + 1].name;
    }
    persist();

    const result = { won, acc, grade, color, stars, fullCombo, newBest, unlockedName, idx };
    const thisRun = run;
    setTimeout(() => { if (run === thisRun) showResults(result); }, won ? 900 : 1300);
}

function showResults(r) {
    state = 'results';

    const title = $('resultTitle');
    title.textContent = r.won ? 'YOU WIN!' : 'SO CLOSE!';
    title.classList.toggle('lose', !r.won);
    $('resultLine').textContent = `${run.rival.name}: “${withName(r.won ? run.rival.winLine : run.rival.loseLine)}”`;

    const grade = $('resultGrade');
    grade.textContent = r.grade;
    grade.style.color = r.color;
    grade.style.textShadow = `4px 4px 0 ${INK}, 0 0 24px ${r.color}`;

    $('resultStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('');
    $('resultScore').textContent = run.score.toLocaleString();

    const badges = [];
    if (r.fullCombo) badges.push('FULL COMBO!');
    if (r.newBest) badges.push('NEW BEST!');
    if (r.unlockedName) badges.push(`${r.unlockedName} unlocked!`);
    $('resultBadges').innerHTML = badges.map(b => `<span class="badge">${b}</span>`).join('');

    $('statPerfect').textContent = run.counts.perfect;
    $('statGood').textContent = run.counts.good;
    $('statOkay').textContent = run.counts.okay;
    $('statMiss').textContent = run.counts.miss;
    $('statCombo').textContent = run.maxCombo;
    $('statAcc').textContent = r.acc.toFixed(1) + '%';

    const hasNext = r.won && r.idx + 1 < RIVALS.length;
    const next = $('nextButton');
    next.classList.toggle('hidden', !hasNext);
    const retry = $('retryButton');
    retry.classList.toggle('btn-big', !hasNext);
    retry.classList.toggle('btn-alt', hasNext);

    showScreen('resultsScreen');
}

// ============================================================================
// Per-frame update
// ============================================================================

function update(dt) {
    updateFx(dt);
    if (state !== 'playing' || !run) return;

    const pos = songPos();

    // The rival "hits" their notes automatically (the sound is already scheduled).
    while (run.oppIdx < run.oppNotes.length && run.oppNotes[run.oppIdx].time <= pos) {
        const n = run.oppNotes[run.oppIdx++];
        n.done = true;
        fx.flash.opp[n.lane] = 1;
        chars.opp.lane = n.lane;
        chars.opp.sing = 1;
        if (Math.random() < 0.35) singNote(layout.chars.opp, n.lane);
    }

    // Notes that slid past the okay window are misses.
    const late = run.cfg.windows[2];
    for (let lane = 0; lane < 4; lane++) {
        const notes = run.laneNotes[lane];
        let i = run.laneIdx[lane];
        while (i < notes.length) {
            const n = notes[i];
            if (!n.judged) {
                if (pos - n.time <= late) break;
                missNote(n);
                if (!run || run.finished) return;
            }
            i++;
        }
        run.laneIdx[lane] = i;
    }

    if (pos >= run.endTime) finishRun(true);
}

function updateFx(dt) {
    for (let i = fx.particles.length - 1; i >= 0; i--) {
        const p = fx.particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity || 0) * dt;
        p.rot += (p.spin || 0) * dt;
        if (p.age >= p.life) fx.particles.splice(i, 1);
    }
    for (const list of [fx.popups, fx.rings]) {
        for (let i = list.length - 1; i >= 0; i--) {
            list[i].age += dt;
            if (list[i].age >= list[i].life) list.splice(i, 1);
        }
    }
    for (const side of ['opp', 'player']) {
        const f = fx.flash[side];
        for (let i = 0; i < 4; i++) f[i] = Math.max(0, f[i] - dt * 5);
        chars[side].sing = Math.max(0, chars[side].sing - dt * 3);
        chars[side].oops = Math.max(0, chars[side].oops - dt);
    }
    fx.shake = Math.max(0, fx.shake - dt * 30);

    // Floating arrows behind the menus.
    if (!run) {
        if (fx.decor.length < 14 && Math.random() < dt * 3) {
            fx.decor.push({
                x: Math.random() * view.W,
                y: view.H + 40,
                vy: -(40 + Math.random() * 60),
                lane: Math.floor(Math.random() * 4),
                size: 30 + Math.random() * 40,
                wobble: Math.random() * Math.PI * 2
            });
        }
        for (let i = fx.decor.length - 1; i >= 0; i--) {
            const d = fx.decor[i];
            d.y += d.vy * dt;
            d.wobble += dt;
            if (d.y < -60) fx.decor.splice(i, 1);
        }
    }
}

function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 220;
        fx.particles.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            gravity: 300,
            age: 0,
            life: 0.35 + Math.random() * 0.3,
            size: 3 + Math.random() * 4,
            color,
            shape: Math.random() < 0.4 ? 'star' : 'dot',
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 10
        });
    }
}

function singNote(pos, lane) {
    fx.particles.push({
        x: pos.x + (Math.random() - 0.5) * pos.r,
        y: pos.y - pos.r * 0.2,
        vx: (Math.random() - 0.5) * 50,
        vy: -70 - Math.random() * 40,
        age: 0,
        life: 1.1,
        size: 22,
        color: LANE_COLORS[lane],
        shape: 'note',
        rot: (Math.random() - 0.5) * 0.6,
        spin: 0
    });
}

function celebrate() {
    for (let i = 0; i < 90; i++) {
        fx.particles.push({
            x: Math.random() * view.W,
            y: -20 - Math.random() * 200,
            vx: (Math.random() - 0.5) * 80,
            vy: 120 + Math.random() * 160,
            gravity: 60,
            age: 0,
            life: 3,
            size: 5 + Math.random() * 5,
            color: LANE_COLORS[i % 4],
            shape: i % 3 === 0 ? 'star' : 'confetti',
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 12
        });
    }
}

// ============================================================================
// Drawing
// ============================================================================

function render() {
    const k = canvas.width / view.W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, view.W, view.H);

    const pos = run ? songPos() : 0;
    const beat = run ? pos / run.spb : menuClock / 0.6;

    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

    drawBackground(beat);

    if (run) {
        drawCharacters(beat);
        drawStrum('opp', pos, beat);
        drawStrum('player', pos, beat);
        drawHud(pos, beat);
    } else {
        drawDecor();
    }

    drawParticles();
    ctx.restore();

    if (run) drawOverlayText(pos, beat);
}

function drawBackground(beat) {
    const accent = run ? run.rival.look.hair : '#ff4fb8';
    const g = ctx.createLinearGradient(0, 0, 0, view.H);
    g.addColorStop(0, '#2a1150');
    g.addColorStop(1, '#0d0620');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.W, view.H);

    // Beat pulse glow from the middle.
    const frac = beat - Math.floor(beat);
    const pulse = beat >= 0 ? Math.pow(1 - frac, 3) : 0;
    const cx = run ? (layout.chars.opp.x + layout.chars.player.x) / 2 : view.W / 2;
    const cy = run ? layout.chars.opp.y : view.H / 2;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, view.W * 0.6);
    glow.addColorStop(0, hexA(accent, 0.22 + pulse * 0.18));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.W, view.H);

    // Manga screentone dots.
    ctx.fillStyle = halftone;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(0, 0, view.W, view.H);
    ctx.globalAlpha = 1;

    // Speed lines when you're on a roll.
    if (run && run.combo >= 16) {
        const strength = Math.min(1, (run.combo - 16) / 30);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(beat * 0.05);
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + strength * 0.12})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 140, Math.sin(a) * 140);
            ctx.lineTo(Math.cos(a) * 900, Math.sin(a) * 900);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function drawDecor() {
    for (const d of fx.decor) {
        drawArrow(ctx, d.x + Math.sin(d.wobble) * 12, d.y, d.size, d.lane, 0.25);
    }
}

// Who is "on" right now: 'opp', 'player' or null (count-in / outro).
function currentTurn(beat) {
    for (const r of run.chart.rounds) {
        if (beat >= r.oppStart - 2 && beat < r.playerStart - 2) return { side: 'opp', round: r };
        if (beat >= r.playerStart - 2 && beat < r.end - 1) return { side: 'player', round: r };
    }
    return { side: null, round: null };
}

function drawStrum(side, pos, beat) {
    const s = layout.strums[side];
    const turn = currentTurn(beat).side;
    const active = turn === side || turn === null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x0 - 10, s.top, s.width + 20, s.bottom - s.top);
    ctx.clip();

    // Lane backgrounds.
    for (let lane = 0; lane < 4; lane++) {
        const x = s.x0 + lane * s.laneW;
        ctx.fillStyle = lane % 2 ? 'rgba(10,4,24,0.5)' : 'rgba(10,4,24,0.38)';
        ctx.fillRect(x + 2, s.top, s.laneW - 4, s.bottom - s.top);
        if (side === 'player' && held[lane]) {
            const g = ctx.createLinearGradient(0, s.receptorY, 0, s.down ? s.top : s.bottom);
            g.addColorStop(0, hexA(LANE_COLORS[lane], 0.35));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x + 2, s.top, s.laneW - 4, s.bottom - s.top);
        }
    }

    // Receptors.
    for (let lane = 0; lane < 4; lane++) {
        const x = laneX(s, lane);
        const flash = fx.flash[side][lane];
        const pressed = side === 'player' && held[lane];
        const size = s.noteSize * (pressed ? 0.9 : 1) * (1 + flash * 0.12);
        drawReceptor(ctx, x, s.receptorY, size, lane, pressed, flash);
    }

    // Notes.
    const speed = s.travel / run.cfg.lead;
    const dir = s.down ? -1 : 1;
    const notes = side === 'opp' ? run.oppNotes : null;
    const drawOne = n => {
        const dt = n.time - pos;
        if (dt > run.cfg.lead + 0.1) return false;
        const y = s.receptorY + dir * dt * speed;
        if (y < s.top - s.noteSize || y > s.bottom + s.noteSize) return true;
        const alpha = n.result === 'miss' ? 0.3 : 1;
        drawArrow(ctx, laneX(s, n.lane), y, s.noteSize, n.lane, alpha);
        return true;
    };
    if (notes) {
        for (let i = run.oppIdx; i < notes.length; i++) if (drawOne(notes[i]) === false) break;
    } else {
        for (let lane = 0; lane < 4; lane++) {
            const list = run.laneNotes[lane];
            // Start a few notes back so missed notes keep sliding off-screen.
            for (let i = Math.max(0, run.laneIdx[lane] - 4); i < list.length; i++) {
                const n = list[i];
                if (n.result && n.result !== 'miss') continue;
                if (drawOne(n) === false) break;
            }
        }
    }

    ctx.restore();

    // Dim the side that's waiting.
    if (!active) {
        ctx.fillStyle = 'rgba(8,3,20,0.35)';
        ctx.fillRect(s.x0 - 4, s.top, s.width + 8, s.bottom - s.top);
    }

    // Splash rings for this side.
    if (side === 'player') {
        for (const r of fx.rings) {
            const t = r.age / r.life;
            ctx.strokeStyle = hexA(r.color, 1 - t);
            ctx.lineWidth = 6 * (1 - t) + 1;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.size * (0.5 + t * 0.6), 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawCharacters(beat) {
    const bob = beat >= 0 ? Math.pow(1 - (beat - Math.floor(beat)), 2) : 0;
    const h = run.health;

    const oppMood = h < 25 ? 'happy' : h > 75 ? 'worried' : 'neutral';
    const oc = layout.chars.opp;
    drawCharacter(ctx, oc.x, oc.y, oc.r, run.rival.look, {
        lane: chars.opp.lane, sing: chars.opp.sing, mood: oppMood, bob
    });

    let playerMood = h > 70 ? 'happy' : h < 25 ? 'worried' : 'neutral';
    if (chars.player.oops > 0) playerMood = 'oops';
    const pc = layout.chars.player;
    drawCharacter(ctx, pc.x, pc.y, pc.r, PLAYER_LOOK, {
        lane: chars.player.lane, sing: chars.player.sing, mood: playerMood, bob
    });

    // Name tags.
    ctx.font = `800 ${view.portrait ? 18 : 16}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const [p, name, color] of [[oc, run.rival.name, run.rival.look.hair], [pc, playerName(), PLAYER_LOOK.hair]]) {
        const y = p.y + p.r * 2.25;
        outlinedText(name, p.x, y, color, 4);
    }
}

function drawHud(pos, beat) {
    // Health "tug of war" bar: rival on the left, you on the right.
    const { x, y, w } = layout.health;
    const h = 20;
    const left = x - w / 2;
    const split = left + w * (1 - run.health / 100);

    ctx.save();
    roundRect(ctx, left - 3, y - h / 2 - 3, w + 6, h + 6, 12);
    ctx.fillStyle = INK;
    ctx.fill();
    roundRect(ctx, left, y - h / 2, w, h, 9);
    ctx.clip();
    ctx.fillStyle = run.rival.look.bar || run.rival.look.hair;
    ctx.fillRect(left, y - h / 2, split - left, h);
    ctx.fillStyle = PLAYER_BAR;
    ctx.fillRect(split, y - h / 2, left + w - split, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(left, y - h / 2, w, h / 3);
    ctx.restore();

    const danger = run.health < 25 && run.cfg.canFail;
    const iconR = 15 * (1 + (beat >= 0 ? Math.pow(1 - (beat % 1), 3) * 0.12 : 0));
    drawCharacter(ctx, split - 17, y, iconR, run.rival.look, { lane: -1, sing: 0, mood: run.health > 75 ? 'worried' : 'neutral', bob: 0, headOnly: true });
    drawCharacter(ctx, split + 17, y, iconR, PLAYER_LOOK, { lane: -1, sing: 0, mood: danger ? 'worried' : 'happy', bob: 0, headOnly: true });

    // Score line.
    ctx.textAlign = 'center';
    ctx.font = `800 ${view.portrait ? 22 : 18}px ${BODY_FONT}`;
    const sc = layout.score;
    outlinedText(`Score ${run.score.toLocaleString()}   ·   ${accuracy().toFixed(1)}%`, sc.x, sc.y, '#ffffff', 4);

    // Song progress.
    const pr = layout.progress;
    const t = Math.max(0, Math.min(1, pos / run.endTime));
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, pr.x, pr.y - 3, pr.w, 6, 3);
    ctx.fill();
    ctx.fillStyle = PLAYER_LOOK.hair;
    roundRect(ctx, pr.x, pr.y - 3, pr.w * t, 6, 3);
    ctx.fill();

    // Whose turn is it?
    const turn = currentTurn(beat);
    if (turn.side) {
        const start = turn.side === 'opp' ? turn.round.oppStart - 2 : turn.round.playerStart - 2;
        const since = beat - start;
        const b = layout.banner;
        const pop = since < 0.4 ? 0.6 + since : 1;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(pop, pop);
        ctx.textAlign = 'center';
        if (turn.side === 'opp') {
            ctx.font = `${view.portrait ? 26 : 22}px ${DISPLAY_FONT}`;
            outlinedText('WATCH!', 0, 0, run.rival.look.hair, 6);
            ctx.font = `700 ${view.portrait ? 18 : 15}px ${BODY_FONT}`;
            outlinedText(view.portrait ? `${run.rival.name} sings ↑` : `← ${run.rival.name} sings`, 0, 24, '#ffffff', 4);
        } else {
            ctx.font = `${view.portrait ? 30 : 26}px ${DISPLAY_FONT}`;
            outlinedText('YOUR TURN!', 0, 0, PLAYER_LOOK.hair, 6);
            ctx.font = `700 ${view.portrait ? 18 : 15}px ${BODY_FONT}`;
            outlinedText(view.portrait ? 'copy it below ↓' : 'copy it →', 0, 24, '#ffffff', 4);
        }
        ctx.restore();
    }

    // Judgment + combo.
    const jd = layout.judge;
    for (const p of fx.popups) {
        const t = p.age / p.life;
        const scale = t < 0.15 ? 0.7 + t * 3 : 1.15 - (t - 0.15) * 0.2;
        ctx.save();
        ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        ctx.translate(jd.x, jd.y - t * 10);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.font = `${view.portrait ? 40 : 30}px ${DISPLAY_FONT}`;
        outlinedText(p.text, 0, 0, p.color, 7);
        if (p.sub) {
            ctx.font = `800 ${view.portrait ? 20 : 16}px ${BODY_FONT}`;
            outlinedText(p.sub, 0, 22, '#ffffff', 4);
        }
        ctx.restore();
    }
    if (run.combo >= 5) {
        ctx.textAlign = 'center';
        ctx.font = `${view.portrait ? 30 : 24}px ${DISPLAY_FONT}`;
        outlinedText(`${run.combo}`, jd.x, jd.y + (view.portrait ? 62 : 52), '#ffffff', 6);
        ctx.font = `800 ${view.portrait ? 16 : 13}px ${BODY_FONT}`;
        outlinedText('COMBO', jd.x, jd.y + (view.portrait ? 82 : 68), '#ffe14d', 4);
    }
}

function drawOverlayText(pos, beat) {
    const c = layout.countdown;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let text = null;
    let frac = 0;
    if (state === 'resuming') {
        text = String(run.resumeCount);
    } else if (state === 'playing' && beat < COUNT_IN_BEATS) {
        if (beat < 0) text = 'READY?';
        else {
            const b = Math.floor(beat);
            text = ['3', '2', '1', 'GO!'][b];
            frac = beat - b;
        }
    }
    if (text) {
        ctx.save();
        ctx.translate(c.x, c.y);
        const s = 1.3 - frac * 0.3;
        ctx.scale(s, s);
        ctx.globalAlpha = 1 - frac * 0.5;
        ctx.font = `${text.length > 2 ? 54 : 84}px ${DISPLAY_FONT}`;
        outlinedText(text, 0, 0, text === 'GO!' ? '#5dff8f' : '#ffe14d', 10);
        ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
}

function drawParticles() {
    for (const p of fx.particles) {
        const t = p.age / p.life;
        ctx.save();
        ctx.globalAlpha = p.shape === 'confetti' ? 1 : 1 - t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'star') {
            star(ctx, p.size * 1.6);
            ctx.fill();
        } else if (p.shape === 'confetti') {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'note') {
            ctx.font = `800 ${p.size}px ${BODY_FONT}`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = INK;
            ctx.strokeText('♪', 0, 0);
            ctx.fillText('♪', 0, 0);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * (1 - t * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// ---------- Drawing helpers ----------

function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (w <= 0) return;
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function outlinedText(text, x, y, color, width) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function star(c, size) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
        const r = i % 2 ? size * 0.35 : size;
        const a = i / 8 * Math.PI * 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
}

// Arrow pointing up, centered on 0,0, about `s` wide.
function arrowPath(c, s) {
    const h = s / 2;
    c.beginPath();
    c.moveTo(0, -h);
    c.lineTo(h, 0);
    c.lineTo(h * 0.45, 0);
    c.lineTo(h * 0.45, h * 0.9);
    c.lineTo(-h * 0.45, h * 0.9);
    c.lineTo(-h * 0.45, 0);
    c.lineTo(-h, 0);
    c.closePath();
}

function drawArrow(c, x, y, s, lane, alpha) {
    c.save();
    c.translate(x, y);
    c.rotate(LANE_ANGLES[lane]);
    c.globalAlpha = alpha;
    arrowPath(c, s);
    c.lineJoin = 'round';
    c.lineWidth = s * 0.16;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = LANE_COLORS[lane];
    c.fill();
    c.scale(0.55, 0.55);
    c.translate(0, -s * 0.1);
    arrowPath(c, s);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fill();
    c.restore();
}

function drawReceptor(c, x, y, s, lane, pressed, flash) {
    c.save();
    c.translate(x, y);
    c.rotate(LANE_ANGLES[lane]);
    arrowPath(c, s);
    c.lineJoin = 'round';
    c.lineWidth = s * 0.16;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = pressed ? hexA(LANE_COLORS[lane], 0.45) : 'rgba(255,255,255,0.1)';
    c.fill();
    c.lineWidth = s * 0.06;
    c.strokeStyle = pressed ? LANE_COLORS[lane] : 'rgba(255,255,255,0.7)';
    c.stroke();
    if (flash > 0) {
        c.globalAlpha = flash;
        c.fillStyle = LANE_COLORS[lane];
        c.fill();
        c.scale(0.6, 0.6);
        arrowPath(c, s);
        c.fillStyle = '#ffffff';
        c.fill();
    }
    c.restore();
}

// A chibi manga character. `st` = { lane, sing (0..1), mood, bob (0..1), headOnly }
function drawCharacter(c, x, y, r, look, st) {
    c.save();
    c.translate(x, y);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = Math.max(1.5, r * 0.07);

    // Lean toward the direction being sung.
    let ox = 0, oy = -st.bob * r * 0.08, sy = 1;
    if (st.sing > 0 && st.lane >= 0) {
        const k = st.sing;
        if (st.lane === 0) ox = -r * 0.2 * k;
        if (st.lane === 3) ox = r * 0.2 * k;
        if (st.lane === 1) { oy += r * 0.12 * k; sy = 1 - 0.08 * k; }
        if (st.lane === 2) oy -= r * 0.16 * k;
    }

    if (!st.headOnly) {
        // Body / shirt.
        c.save();
        c.translate(ox * 0.4, oy * 0.3);
        c.beginPath();
        c.moveTo(-r * 0.95, r * 2.0);
        c.quadraticCurveTo(-r * 0.95, r * 0.95, 0, r * 0.9);
        c.quadraticCurveTo(r * 0.95, r * 0.95, r * 0.95, r * 2.0);
        c.closePath();
        c.fillStyle = look.accent;
        c.fill();
        c.stroke();
        c.restore();
    }

    c.translate(ox, oy);
    c.scale(1, sy);

    // Hair behind the head.
    c.fillStyle = look.hair;
    if (look.style === 'long') {
        roundRect(c, -r * 1.12, -r * 0.6, r * 2.24, r * 2.0, r * 0.6);
        c.fill(); c.stroke();
    } else if (look.style === 'ponytail') {
        c.beginPath();
        c.ellipse(r * 1.0, r * 0.1, r * 0.38, r * 0.85, -0.35, 0, Math.PI * 2);
        c.fill(); c.stroke();
    } else if (look.style === 'buns') {
        for (const sx of [-1, 1]) {
            c.beginPath();
            c.arc(sx * r * 0.8, -r * 0.78, r * 0.4, 0, Math.PI * 2);
            c.fill(); c.stroke();
        }
    }

    // Head.
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = look.skin;
    c.fill();
    c.stroke();

    // Blush.
    c.fillStyle = 'rgba(255,110,150,0.45)';
    for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(sx * r * 0.6, r * 0.38, r * 0.17, r * 0.1, 0, 0, Math.PI * 2);
        c.fill();
    }

    drawFace(c, r, look, st);

    // Bangs.
    c.fillStyle = look.hair;
    c.beginPath();
    c.moveTo(-r * 1.04, r * 0.1);
    c.arc(0, -r * 0.02, r * 1.05, Math.PI * 1.03, Math.PI * 1.97);
    c.lineTo(r * 1.0, r * 0.05);
    c.lineTo(r * 0.62, -r * 0.34);
    c.lineTo(r * 0.36, -r * 0.1);
    c.lineTo(r * 0.05, -r * 0.42);
    c.lineTo(-r * 0.3, -r * 0.12);
    c.lineTo(-r * 0.62, -r * 0.4);
    c.lineTo(-r * 0.9, -r * 0.02);
    c.closePath();
    c.fill();
    c.stroke();

    // Style extras.
    if (look.style === 'spiky') {
        c.fillStyle = look.hair;
        for (let i = -2; i <= 2; i++) {
            const a = -Math.PI / 2 + i * 0.42;
            c.beginPath();
            c.moveTo(Math.cos(a - 0.2) * r * 0.9, Math.sin(a - 0.2) * r * 0.9);
            c.lineTo(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55);
            c.lineTo(Math.cos(a + 0.2) * r * 0.9, Math.sin(a + 0.2) * r * 0.9);
            c.fill(); c.stroke();
        }
        // Headphones.
        c.lineWidth = r * 0.14;
        c.strokeStyle = look.accent;
        c.beginPath();
        c.arc(0, 0, r * 1.12, Math.PI * 1.08, Math.PI * 1.92);
        c.stroke();
        c.lineWidth = Math.max(1.5, r * 0.07);
        c.strokeStyle = INK;
        for (const sx of [-1, 1]) {
            roundRect(c, sx * r * 1.05 - r * 0.2, -r * 0.3, r * 0.4, r * 0.6, r * 0.15);
            c.fillStyle = '#28e0ff';
            c.fill(); c.stroke();
        }
    } else if (look.style === 'ponytail') {
        c.fillStyle = look.accent;
        c.save();
        c.translate(r * 0.72, -r * 0.72);
        for (const sx of [-1, 1]) {
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(sx * r * 0.38, -r * 0.2);
            c.lineTo(sx * r * 0.38, r * 0.22);
            c.closePath();
            c.fill(); c.stroke();
        }
        c.beginPath();
        c.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        c.fill(); c.stroke();
        c.restore();
    } else if (look.style === 'long') {
        c.save();
        c.translate(-r * 0.6, -r * 0.6);
        c.fillStyle = look.accent;
        star(c, r * 0.28);
        c.fill(); c.stroke();
        c.restore();
    } else if (look.style === 'buns') {
        c.fillStyle = look.accent;
        for (const sx of [-1, 1]) {
            c.beginPath();
            c.ellipse(sx * r * 0.58, -r * 0.55, r * 0.14, r * 0.09, sx * 0.6, 0, Math.PI * 2);
            c.fill(); c.stroke();
        }
    } else if (look.style === 'swoop') {
        c.fillStyle = look.hair;
        c.beginPath();
        c.ellipse(r * 0.15, -r * 0.88, r * 0.95, r * 0.42, -0.15, 0, Math.PI * 2);
        c.fill(); c.stroke();
    }

    c.restore();
}

function drawFace(c, r, look, st) {
    const ex = r * 0.36, ey = r * 0.12;
    const mood = st.mood;
    const singing = st.sing > 0.05;

    c.strokeStyle = INK;
    c.fillStyle = INK;
    c.lineWidth = Math.max(1.5, r * 0.08);

    if (look.shades && mood !== 'oops') {
        // Cool shades.
        for (const sx of [-1, 1]) {
            roundRect(c, sx * ex - r * 0.27, ey - r * 0.17, r * 0.54, r * 0.32, r * 0.1);
            c.fillStyle = '#111';
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.55)';
            c.fillRect(sx * ex - r * 0.16, ey - r * 0.1, r * 0.1, r * 0.08);
        }
        c.beginPath();
        c.moveTo(-ex + r * 0.27, ey - r * 0.05);
        c.lineTo(ex - r * 0.27, ey - r * 0.05);
        c.stroke();
        if (mood === 'worried') {
            // A single bead of sweat.
            c.fillStyle = '#7fd8ff';
            c.beginPath();
            c.ellipse(r * 0.85, -r * 0.2, r * 0.08, r * 0.13, 0, 0, Math.PI * 2);
            c.fill();
        }
    } else if (mood === 'oops') {
        for (const sx of [-1, 1]) {
            c.beginPath();
            c.moveTo(sx * ex - r * 0.12, ey - r * 0.12);
            c.lineTo(sx * ex + r * 0.12 * sx, ey);
            c.lineTo(sx * ex - r * 0.12, ey + r * 0.12);
            c.stroke();
        }
    } else if (mood === 'happy' && !singing) {
        for (const sx of [-1, 1]) {
            c.beginPath();
            c.arc(sx * ex, ey + r * 0.06, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
            c.stroke();
        }
    } else {
        const eh = mood === 'worried' ? r * 0.2 : r * 0.26;
        for (const sx of [-1, 1]) {
            c.fillStyle = INK;
            c.beginPath();
            c.ellipse(sx * ex, ey, r * 0.15, eh, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = hexA(look.hair, 0.9);
            c.beginPath();
            c.ellipse(sx * ex, ey + eh * 0.35, r * 0.1, eh * 0.45, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(sx * ex + r * 0.05, ey - eh * 0.4, r * 0.06, 0, Math.PI * 2);
            c.fill();
        }
        if (mood === 'worried') {
            c.beginPath();
            c.moveTo(-ex - r * 0.15, ey - r * 0.38);
            c.lineTo(-ex + r * 0.12, ey - r * 0.46);
            c.moveTo(ex + r * 0.15, ey - r * 0.38);
            c.lineTo(ex - r * 0.12, ey - r * 0.46);
            c.stroke();
        }
    }

    // Mouth.
    const my = r * 0.55;
    c.lineWidth = Math.max(1.2, r * 0.07);
    if (singing) {
        c.fillStyle = '#7a1f3d';
        c.beginPath();
        c.ellipse(0, my, r * 0.14, r * (0.08 + 0.12 * st.sing), 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
    } else if (mood === 'happy') {
        c.fillStyle = '#7a1f3d';
        c.beginPath();
        c.arc(0, my - r * 0.06, r * 0.17, 0.1, Math.PI - 0.1);
        c.closePath();
        c.fill();
        c.stroke();
    } else if (mood === 'worried') {
        c.beginPath();
        c.moveTo(-r * 0.14, my + r * 0.02);
        c.quadraticCurveTo(-r * 0.07, my - r * 0.06, 0, my + r * 0.02);
        c.quadraticCurveTo(r * 0.07, my + r * 0.1, r * 0.14, my + r * 0.02);
        c.stroke();
    } else if (mood === 'oops') {
        c.beginPath();
        c.arc(0, my, r * 0.08, 0, Math.PI * 2);
        c.stroke();
    } else {
        c.beginPath();
        c.arc(0, my - r * 0.1, r * 0.13, 0.3, Math.PI - 0.3);
        c.stroke();
    }
}

function makeHalftone() {
    const p = document.createElement('canvas');
    p.width = p.height = 10;
    const c = p.getContext('2d');
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(2.5, 2.5, 1.4, 0, Math.PI * 2);
    c.arc(7.5, 7.5, 1.4, 0, Math.PI * 2);
    c.fill();
    return ctx.createPattern(p, 'repeat');
}

// ============================================================================
// Main loop & setup
// ============================================================================

function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    menuClock += dt;
    update(dt);
    render();
    requestAnimationFrame(frame);
}

function init() {
    canvas = $('gameCanvas');
    ctx = canvas.getContext('2d');
    halftone = makeHalftone();

    audio.muted = save.muted;
    audio.musicVolume = save.musicVol;
    audio.sfxVolume = save.sfxVol;

    computeLayout();
    setupMenus();

    window.addEventListener('resize', computeLayout);
    window.addEventListener('orientationchange', () => setTimeout(computeLayout, 200));
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('blur', () => { releaseAllLanes(); pauseGame(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

    goTitle();
    requestAnimationFrame(frame);
}

window.addEventListener('load', init);
