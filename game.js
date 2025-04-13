// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = 100;
const NOTE_SPEED = 5;
const TARGET_Y = 100;  // Changed from 500 to flip vertically
const TARGET_HEIGHT = 20;
const NOTE_HEIGHT = 20;
const PERFECT_RANGE = 15;
const GOOD_RANGE = 30;
const OKAY_RANGE = 45;

// Game variables
let canvas, ctx;
let score = 0;
let combo = 0;
let maxCombo = 0;
let hits = 0;
let misses = 0;
let totalNotes = 0;
let gameRunning = false;
let lastTime = 0;
let currentSong = null;
let audioContext = null;
let judgmentTexts = []; // Array to store judgment text animations

// Lanes and keys
const lanes = [
    { key: 'ArrowLeft', x: 200, color: '#FF5555', active: false, notes: [] },
    { key: 'ArrowDown', x: 300, color: '#55FF55', active: false, notes: [] },
    { key: 'ArrowUp', x: 400, color: '#5555FF', active: false, notes: [] },
    { key: 'ArrowRight', x: 500, color: '#FFFF55', active: false, notes: [] }
];

// Timing judgments
const judgments = {
    PERFECT: { score: 100, text: 'PERFECT!', class: 'perfect', color: '#FF5555' },
    GOOD: { score: 75, text: 'GOOD!', class: 'good', color: '#55FF55' },
    OKAY: { score: 50, text: 'OKAY', class: 'okay', color: '#5555FF' },
    MISS: { score: 0, text: 'MISS', class: 'miss', color: '#AAAAAA' }
};

// Initialize the game
function init() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');
    
    // Set up event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('restartButton').addEventListener('click', restartGame);
    document.getElementById('muteButton').addEventListener('click', toggleMute);
    
    // Draw the initial screen
    drawGame();
}

// Toggle mute function
function toggleMute() {
    const isMuted = audioManager.toggleMute();
    document.getElementById('muteButton').textContent = isMuted ? '🔇' : '🔊';
}

// Start the game
function startGame() {
    document.getElementById('menu').classList.add('hidden');
    resetGame();
    gameRunning = true;
    
    // Play start sound and background music
    audioManager.playSound('start');
    audioManager.playMusic();
    
    // Load a demo song pattern (would be replaced with actual song data)
    loadDemoSong();
    
    // Start the game loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Restart the game
function restartGame() {
    document.getElementById('gameOver').classList.add('hidden');
    startGame();
}

// Reset game variables
function resetGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    misses = 0;
    totalNotes = 0;
    judgmentTexts = [];
    
    // Clear all notes
    lanes.forEach(lane => {
        lane.notes = [];
        lane.active = false;
    });
    
    // Update UI
    updateScore();
    updateCombo();
    updateAccuracy();
}

// Load a demo song pattern
function loadDemoSong() {
    // This would be replaced with actual song data loaded from a file
    // For now, we'll create a simple pattern
    const demoPattern = [
        { lane: 0, time: 1000 },
        { lane: 1, time: 1500 },
        { lane: 2, time: 2000 },
        { lane: 3, time: 2500 },
        { lane: 0, time: 3000 },
        { lane: 1, time: 3500 },
        { lane: 2, time: 4000 },
        { lane: 3, time: 4500 },
        { lane: 0, time: 5000 },
        { lane: 1, time: 5250 },
        { lane: 2, time: 5500 },
        { lane: 3, time: 5750 },
        { lane: 0, time: 6000 },
        { lane: 1, time: 6250 },
        { lane: 2, time: 6500 },
        { lane: 3, time: 6750 },
        { lane: 0, time: 7000 },
        { lane: 3, time: 7000 },
        { lane: 1, time: 7500 },
        { lane: 2, time: 7500 },
        { lane: 0, time: 8000 },
        { lane: 1, time: 8250 },
        { lane: 2, time: 8500 },
        { lane: 3, time: 8750 },
        { lane: 0, time: 9000 },
        { lane: 1, time: 9250 },
        { lane: 2, time: 9500 },
        { lane: 3, time: 9750 },
        { lane: 0, time: 10000 },
        { lane: 1, time: 10000 },
        { lane: 2, time: 10000 },
        { lane: 3, time: 10000 },
        { lane: 0, time: 11000 },
        { lane: 1, time: 11500 },
        { lane: 2, time: 12000 },
        { lane: 3, time: 12500 },
        { lane: 0, time: 13000 },
        { lane: 1, time: 13500 },
        { lane: 2, time: 14000 },
        { lane: 3, time: 14500 },
    ];
    
    totalNotes = demoPattern.length;
    
    // Convert the pattern to notes
    demoPattern.forEach(note => {
        lanes[note.lane].notes.push({
            y: CANVAS_HEIGHT + NOTE_HEIGHT + (note.time / 1000 * 60 * NOTE_SPEED), // Changed to start from bottom
            hit: false,
            missed: false,
            time: note.time
        });
    });
    
    // Sort notes by time for each lane
    lanes.forEach(lane => {
        lane.notes.sort((a, b) => a.time - b.time);
    });
    
    // In a real game, we would also load and play the music here
    // For now, we'll just simulate the timing
}

// Game loop
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Update game state
    update(deltaTime);
    
    // Draw the game
    drawGame();
    
    // Continue the loop if the game is running
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// Update game state
function update(deltaTime) {
    // Move notes
    lanes.forEach(lane => {
        lane.notes.forEach(note => {
            note.y -= NOTE_SPEED; // Changed from += to -= to move upward
            
            // Check for missed notes
            if (!note.hit && !note.missed && note.y < TARGET_Y - TARGET_HEIGHT - OKAY_RANGE) { // Changed from > to <
                note.missed = true;
                missNote();
            }
        });
        
        // Remove notes that are off-screen
        lane.notes = lane.notes.filter(note => note.y > -NOTE_HEIGHT); // Changed from < CANVAS_HEIGHT + NOTE_HEIGHT
    });
    
    // Update judgment text animations
    for (let i = judgmentTexts.length - 1; i >= 0; i--) {
        const text = judgmentTexts[i];
        text.life -= deltaTime;
        if (text.life <= 0) {
            judgmentTexts.splice(i, 1);
        }
    }
    
    // Check if all notes are gone
    const remainingNotes = lanes.reduce((total, lane) => total + lane.notes.length, 0);
    if (remainingNotes === 0 && totalNotes > 0) {
        endGame();
    }
}

// Draw the game
function drawGame() {
    // Clear the canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw lanes
    lanes.forEach(lane => {
        // Draw lane
        ctx.fillStyle = lane.active ? lane.color : '#333333';
        ctx.fillRect(lane.x - LANE_WIDTH / 2, 0, LANE_WIDTH, CANVAS_HEIGHT);
        
        // Draw lane key
        ctx.fillStyle = '#000000';
        ctx.fillRect(lane.x - LANE_WIDTH / 2 + 10, 10, LANE_WIDTH - 20, 50); // Changed from CANVAS_HEIGHT - 60 to 10
        
        // Draw arrow key symbols
        ctx.fillStyle = lane.active ? '#FFFFFF' : '#AAAAAA';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        
        // Draw appropriate arrow symbol based on lane
        let arrowSymbol = '';
        switch(lane.key) {
            case 'ArrowLeft': arrowSymbol = '←'; break;
            case 'ArrowDown': arrowSymbol = '↓'; break;
            case 'ArrowUp': arrowSymbol = '↑'; break;
            case 'ArrowRight': arrowSymbol = '→'; break;
        }
        ctx.fillText(arrowSymbol, lane.x, 45); // Changed from CANVAS_HEIGHT - 25 to 45
        
        // Draw target zone
        ctx.fillStyle = lane.active ? lane.color : '#555555';
        ctx.fillRect(lane.x - LANE_WIDTH / 2, TARGET_Y, LANE_WIDTH, TARGET_HEIGHT);
        
        // Draw notes
        lane.notes.forEach(note => {
            if (!note.hit && !note.missed) {
                ctx.fillStyle = lane.color;
                ctx.fillRect(lane.x - LANE_WIDTH / 2 + 10, note.y, LANE_WIDTH - 20, NOTE_HEIGHT);
            }
        });
    });
    
    // Draw judgment texts
    judgmentTexts.forEach(text => {
        const opacity = Math.min(1, text.life / 500);
        ctx.globalAlpha = opacity;
        ctx.font = '24px Arial';
        ctx.fillStyle = text.color;
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
    });
    ctx.globalAlpha = 1;
    
    // Draw dividers between lanes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    lanes.forEach(lane => {
        ctx.beginPath();
        ctx.moveTo(lane.x - LANE_WIDTH / 2, 0);
        ctx.lineTo(lane.x - LANE_WIDTH / 2, CANVAS_HEIGHT);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(lane.x + LANE_WIDTH / 2, 0);
        ctx.lineTo(lane.x + LANE_WIDTH / 2, CANVAS_HEIGHT);
        ctx.stroke();
    });
}

// Handle key down events
function handleKeyDown(event) {
    if (!gameRunning) return;
    
    const key = event.key;
    const lane = lanes.find(lane => lane.key === key);
    
    if (lane && !lane.active) {
        lane.active = true;
        checkHit(lane);
    }
}

// Handle key up events
function handleKeyUp(event) {
    if (!gameRunning) return;
    
    const key = event.key;
    const lane = lanes.find(lane => lane.key === key);
    
    if (lane) {
        lane.active = false;
    }
}

// Check if a hit is valid
function checkHit(lane) {
    // Find the closest unhit note in the lane
    const note = lane.notes.find(note => !note.hit && !note.missed);
    
    if (!note) return;
    
    // Calculate distance from target
    const distance = Math.abs(note.y - TARGET_Y);
    
    // Determine judgment based on distance
    let judgment;
    if (distance <= PERFECT_RANGE) {
        judgment = judgments.PERFECT;
        audioManager.playSound('perfect');
    } else if (distance <= GOOD_RANGE) {
        judgment = judgments.GOOD;
        audioManager.playSound('good');
    } else if (distance <= OKAY_RANGE) {
        judgment = judgments.OKAY;
        audioManager.playSound('okay');
    } else {
        // Too far from target, no hit
        return;
    }
    
    // Mark the note as hit
    note.hit = true;
    
    // Update score and combo
    score += judgment.score * (1 + combo * 0.1);
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    hits++;
    
    // Update UI
    updateScore();
    updateCombo();
    updateAccuracy();
    
    // Show judgment text
    judgmentTexts.push({
        text: judgment.text,
        color: judgment.color,
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        life: 500
    });
}

// Handle missed notes
function missNote() {
    combo = 0;
    misses++;
    
    // Play miss sound
    audioManager.playSound('miss');
    
    // Update UI
    updateCombo();
    updateAccuracy();
    
    // Show miss text
    judgmentTexts.push({
        text: judgments.MISS.text,
        color: judgments.MISS.color,
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        life: 500
    });
}

// Update the score display
function updateScore() {
    document.getElementById('score').textContent = `Score: ${Math.floor(score)}`;
}

// Update the combo display
function updateCombo() {
    document.getElementById('combo').textContent = `Combo: ${combo}`;
}

// Update the accuracy display
function updateAccuracy() {
    const total = hits + misses;
    const accuracy = total > 0 ? (hits / total) * 100 : 0;
    document.getElementById('accuracy').textContent = `Accuracy: ${accuracy.toFixed(2)}%`;
}

// End the game
function endGame() {
    gameRunning = false;
    
    // Play game over sound and stop music
    audioManager.stopMusic();
    audioManager.playSound('gameover');
    
    // Update final score display
    document.getElementById('finalScore').textContent = `Score: ${Math.floor(score)}`;
    document.getElementById('finalAccuracy').textContent = `Accuracy: ${((hits / totalNotes) * 100).toFixed(2)}%`;
    
    // Show game over screen
    document.getElementById('gameOver').classList.remove('hidden');
}

// Initialize the game when the page loads
window.addEventListener('load', init);
