// Songs and rivals for Rhythm Battle.
//
// Every battle is call-and-response: the rival sings a phrase (8 beats),
// then the player copies it (8 beats). Each phrase is written on a 16th-note
// grid, one character per 16th, four characters per beat:
//
//   0 1 2 3   a single note in that lane (← ↓ ↑ →)
//   a b c d   two notes at once: a=←→  b=↓↑  c=←↓  d=↑→
//   .         rest (spaces and | are ignored, they're just for reading)
//
// Easy keeps only notes on the beat, Medium keeps 8th notes, Hard keeps all.
// A note's pitch comes from the chord playing at that moment: lanes go
// root, 3rd, 5th, octave, so every melody is in harmony with the band.

const PAIRS = { a: [0, 3], b: [1, 2], c: [0, 1], d: [2, 3] };

const RIVALS = [
    {
        id: 'melody',
        name: 'Melody',
        title: 'The Pop Star',
        bio: 'Sunny, bouncy and always humming a tune.',
        look: { skin: '#FFE0C8', hair: '#FFA8D2', style: 'ponytail', accent: '#FF4FB8' },
        intro: "Hi hi! Let's sing together — copy me if you can!",
        winLine: 'Wow, you really copied every note! Best duet ever!',
        loseLine: "Aww, don't worry! Warm up and try again!",
        song: {
            title: 'Bubblegum Beat',
            bpm: 96,
            chords: ['C', 'G', 'Am', 'F'],
            drums: {
                kick:  'x.......x.......',
                snare: '....x.......x...',
                hat:   'x.x.x.x.x.x.x.x.'
            },
            bass: 'x.....x.x.......',
            phrases: [
                '0... .... 1... .... | 2... .... 3... ....',
                '0... 1... 2..3 .... | 3... 2... 1..0 ....',
                '0... 0.12 2... .... | 3... 3.21 1... ....',
                '3... 2... 1... 0.1. | 1... ..2. 2..3 ....',
                '0... 2... 1... 3... | 0.1. 2.3. 3.21 ....',
                '3... 1... 2... 0... | 0... 3... a... ....'
            ]
        }
    },
    {
        id: 'tempo',
        name: 'Tempo',
        title: 'The Electro Kid',
        bio: 'Never takes the headphones off. Loves a synth solo.',
        look: { skin: '#F1C9A5', hair: '#28E0FF', style: 'spiky', accent: '#1B1B2F' },
        intro: 'Beep boop. Think you can keep up with my beat?',
        winLine: 'No way... your rhythm is off the charts!',
        loseLine: 'Ha! Reboot and come back for a rematch.',
        song: {
            title: 'Electric Dreams',
            bpm: 110,
            chords: ['Am', 'F', 'C', 'G'],
            drums: {
                kick:  'x.....x...x.....',
                snare: '....x.......x...',
                hat:   'x.xxx.x.x.xxx.x.'
            },
            bass: 'x.x.x.x.x.x.x.xo',
            phrases: [
                '0... ..1. 2... 3... | 2... ..1. 0... ....',
                '0.0. 1... 2.2. 3... | 3... 2.1. 0... ....',
                '3... ..3. 2... ..2. | 1.0. 1.2. 3... ....',
                '0.1. 2.1. 0.1. 2... | 3.2. 1.2. 3... ....',
                '0... 3... 0.3. 1.2. | b... .... a... ....',
                '0.12 3... 3.21 0... | 0.1. 2.3. d... ....',
                '1... 1.2. 3... 3.2. | 1.0. 1.2. 0... ....',
                '0.1. 2.3. 3.2. 1.0. | a... b... a... ....'
            ]
        }
    },
    {
        id: 'harmony',
        name: 'Harmony',
        title: 'The Rhythm Master',
        bio: 'Has never missed a note. Ever. (Supposedly.)',
        look: { skin: '#E8B894', hair: '#9D5CFF', style: 'long', accent: '#FFE14D' },
        intro: 'So you beat Tempo? Cute. Now face a real master.',
        winLine: 'Impossible... you are the new Rhythm Master!',
        loseLine: 'Practice makes perfect. Come back stronger.',
        song: {
            title: 'Harmonic Clash',
            bpm: 124,
            chords: ['Dm', 'Bb', 'C', 'A'],
            drums: {
                kick:  'x..x..x...x..x..',
                snare: '....x.......x..x',
                hat:   'xxxxxxxxxxxxxxxx'
            },
            bass: 'x.xox.xox.xox.xo',
            phrases: [
                '0.1. 2.3. 2.1. 0... | 3.2. 1.0. 1... ....',
                '0..1 ..2. 3... 3.2. | 1..0 ..1. 2... ....',
                '0123 3... 3210 0... | 0.2. 1.3. a... ....',
                '0.0. 3.3. 1.1. 2.2. | 0.12 3.21 0... ....',
                'b... 0.1. a... 3.2. | 1.2. 1.2. 0123 ....',
                '3.2. 1.0. 0.1. 2.3. | 0.3. 1.2. d... c...',
                '0.1. 0.2. 0.3. 0.2. | 3.2. 3.1. 3.0. ....',
                '0123 2103 0123 2103 | a... b... a... ....'
            ]
        }
    },
    {
        id: 'grandmaster',
        name: 'Maestro J',
        title: 'The Secret Boss',
        bio: 'Taught {name} everything. Well... almost everything.',
        look: { skin: '#F3CFB0', hair: '#E6E6F0', style: 'swoop', accent: '#111111', shades: true, bar: '#8f7bff' },
        intro: "So, {name}, you want to battle ME? Let's see what you've learned!",
        winLine: "Ha! The student has become the master. I'm so proud of you, {name}!",
        loseLine: "Not bad, kiddo! Want to go again? I've got all day.",
        song: {
            title: 'Grand Finale',
            bpm: 116,
            chords: ['F', 'Dm', 'Gm', 'C'],
            drums: {
                kick:  'x.....x.x.....x.',
                snare: '....x.......x...',
                hat:   'x.xxx.xxx.xxx.xx'
            },
            bass: 'x..x..x.x..x..xo',
            phrases: [
                '0... 2... 1... 3... | 2.1. 0... 1... ....',
                '0.1. 2.3. 3... 0... | 1.2. 1.0. 2... ....',
                '3.3. 0.0. 2.2. 1.1. | 0.12 3... 3.21 0...',
                'a... 1.2. b... 0.3. | 0123 3210 a... ....',
                '0..1 ..2. ..3. 3.2. | 1..0 ..1. ..2. ....',
                '0.12 3.21 0.12 3... | 3.21 0.12 3.21 0...',
                '1.2. 0.3. 1.2. 0.3. | a... b... 0123 ....',
                '0123 3210 0123 3210 | a... b... d... c...'
            ]
        }
    }
];

const COUNT_IN_BEATS = 4;
const PHRASE_BEATS = 8;
const OUTRO_BEATS = 4;

const NOTE_NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'Bb' -> { root: 10, minor: false }, 'Am' -> { root: 9, minor: true }
function parseChord(name) {
    let root = NOTE_NAMES[name[0]];
    let i = 1;
    if (name[i] === '#') { root++; i++; }
    else if (name[i] === 'b') { root--; i++; }
    return { root: (root + 12) % 12, minor: name[i] === 'm' };
}

function chordTones(chord) {
    return chord.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
}

// Which chord is playing at this beat (chords change every bar, starting after the count-in).
function chordAtBeat(song, beat) {
    const bar = Math.max(0, Math.floor((beat - COUNT_IN_BEATS) / 4));
    return parseChord(song.chords[bar % song.chords.length]);
}

// Lead melody pitch for a lane at a given beat (MIDI note number, around C4–C6).
function laneMidi(song, beat, lane) {
    const chord = chordAtBeat(song, beat);
    return 60 + chord.root + chordTones(chord)[lane];
}

function parsePhrase(text) {
    const steps = [];
    for (const ch of text) {
        if (ch === ' ' || ch === '|') continue;
        steps.push(ch);
    }
    return steps;
}

// Build the full note chart for a rival's song at a difficulty.
// Returns { notes, totalBeats, rounds } where each note is
// { beat, time, lane, midi, side: 'opp'|'player', round }.
function buildChart(rival, difficulty) {
    const song = rival.song;
    const spb = 60 / song.bpm;
    const notes = [];
    const rounds = [];

    song.phrases.forEach((phrase, r) => {
        const steps = parsePhrase(phrase);
        const oppStart = COUNT_IN_BEATS + r * PHRASE_BEATS * 2;
        const playerStart = oppStart + PHRASE_BEATS;
        rounds.push({ oppStart, playerStart, end: playerStart + PHRASE_BEATS });

        steps.forEach((ch, step) => {
            if (ch === '.') return;
            if (difficulty === 'easy' && step % 4 !== 0) return;
            if (difficulty === 'medium' && step % 2 !== 0) return;

            let lanes = PAIRS[ch] || [Number(ch)];
            if (difficulty === 'easy') lanes = lanes.slice(0, 1);

            lanes.forEach(lane => {
                [['opp', oppStart], ['player', playerStart]].forEach(([side, start]) => {
                    const beat = start + step / 4;
                    notes.push({
                        beat,
                        time: beat * spb,
                        lane,
                        midi: laneMidi(song, beat, lane),
                        side,
                        round: r
                    });
                });
            });
        });
    });

    notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
    const totalBeats = COUNT_IN_BEATS + song.phrases.length * PHRASE_BEATS * 2 + OUTRO_BEATS;
    return { notes, totalBeats, rounds };
}
