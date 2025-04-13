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
let currentDifficulty = 'easy'; // Default difficulty

// Difficulty settings
const difficulties = {
    easy: {
        noteSpeed: 4,
        noteFrequency: 1.0, // Multiplier for note frequency
        perfectRange: 20,
        goodRange: 35,
        okayRange: 50
    },
    medium: {
        noteSpeed: 5,
        noteFrequency: 1.5,
        perfectRange: 15,
        goodRange: 30,
        okayRange: 45
    },
    hard: {
        noteSpeed: 6.5,
        noteFrequency: 2.0,
        perfectRange: 10,
        goodRange: 25,
        okayRange: 40
    }
};

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
    
    // Set up difficulty selection on main menu
    document.getElementById('easyButton').addEventListener('click', () => setDifficulty('easy'));
    document.getElementById('mediumButton').addEventListener('click', () => setDifficulty('medium'));
    document.getElementById('hardButton').addEventListener('click', () => setDifficulty('hard'));
    
    // Set up difficulty selection on game over screen
    document.getElementById('easyButtonGameOver').addEventListener('click', () => setDifficultyGameOver('easy'));
    document.getElementById('mediumButtonGameOver').addEventListener('click', () => setDifficultyGameOver('medium'));
    document.getElementById('hardButtonGameOver').addEventListener('click', () => setDifficultyGameOver('hard'));
    
    // Draw the initial screen
    drawGame();
}

// Set the game difficulty from main menu
function setDifficulty(difficulty) {
    // Update selected button UI
    document.querySelectorAll('#menu .difficulty-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`${difficulty}Button`).classList.add('selected');
    
    // Set the difficulty
    currentDifficulty = difficulty;
    
    // Play click sound
    audioManager.playSound('click');
}

// Set the game difficulty from game over screen
function setDifficultyGameOver(difficulty) {
    // Update selected button UI on game over screen
    document.querySelectorAll('#gameOver .difficulty-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`${difficulty}ButtonGameOver`).classList.add('selected');
    
    // Update selected button UI on main menu to keep them in sync
    document.querySelectorAll('#menu .difficulty-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`${difficulty}Button`).classList.add('selected');
    
    // Set the difficulty
    currentDifficulty = difficulty;
    
    // Update the difficulty text
    document.getElementById('finalDifficulty').textContent = `Difficulty: ${currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1)}`;
    
    // Play click sound
    audioManager.playSound('click');
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
    const basePattern = [
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
    
    // Adjust pattern based on difficulty
    let demoPattern = [];
    const diffSettings = difficulties[currentDifficulty];
    
    if (currentDifficulty === 'easy') {
        // For easy, use a subset of the pattern
        demoPattern = basePattern.filter((_, index) => index % 2 === 0);
    } else if (currentDifficulty === 'medium') {
        // For medium, use the full pattern
        demoPattern = basePattern;
    } else if (currentDifficulty === 'hard') {
        // For hard, use the full pattern and add some additional notes
        demoPattern = [...basePattern];
        
        // Add some additional notes for hard difficulty
        const additionalNotes = [
            { lane: 2, time: 1250 },
            { lane: 3, time: 1750 },
            { lane: 0, time: 2250 },
            { lane: 1, time: 2750 },
            { lane: 2, time: 3250 },
            { lane: 3, time: 3750 },
            { lane: 0, time: 4250 },
            { lane: 1, time: 4750 },
            { lane: 0, time: 5125 },
            { lane: 3, time: 5375 },
            { lane: 0, time: 5625 },
            { lane: 3, time: 5875 },
            { lane: 1, time: 6125 },
            { lane: 2, time: 6375 },
            { lane: 1, time: 6625 },
            { lane: 2, time: 6875 }
        ];
        
        demoPattern = [...demoPattern, ...additionalNotes];
        
        // Sort by time
        demoPattern.sort((a, b) => a.time - b.time);
    }
    
    totalNotes = demoPattern.length;
    
    // Convert the pattern to notes
    demoPattern.forEach(note => {
        lanes[note.lane].notes.push({
            y: CANVAS_HEIGHT + NOTE_HEIGHT + (note.time / 1000 * 60 * diffSettings.noteSpeed), // Changed to start from bottom
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
    const diffSettings = difficulties[currentDifficulty];
    
    // Move notes
    lanes.forEach(lane => {
        lane.notes.forEach(note => {
            note.y -= diffSettings.noteSpeed; // Changed from += to -= to move upward
            
            // Check for missed notes
            if (!note.hit && !note.missed && note.y < TARGET_Y - TARGET_HEIGHT - diffSettings.okayRange) { // Changed from > to <
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
    
    // Draw staff lines (for musical appearance)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = 150 + i * 30;
        ctx.beginPath();
        ctx.moveTo(150, y);
        ctx.lineTo(650, y);
        ctx.stroke();
    }
    
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
        
        // Draw notes as musical notes
        lane.notes.forEach(note => {
            if (!note.hit && !note.missed) {
                // Draw note body
                ctx.fillStyle = lane.color;
                
                // Draw note head (circle)
                ctx.beginPath();
                ctx.ellipse(lane.x, note.y + NOTE_HEIGHT/2, 12, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw note stem
                ctx.fillRect(lane.x + 8, note.y - 20, 2, 30);
                
                // Draw note flag
                ctx.beginPath();
                ctx.moveTo(lane.x + 10, note.y - 20);
                ctx.quadraticCurveTo(lane.x + 20, note.y - 15, lane.x + 20, note.y - 5);
                ctx.lineTo(lane.x + 10, note.y - 10);
                ctx.fill();
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
    const diffSettings = difficulties[currentDifficulty];
    
    if (!note) return;
    
    // Calculate distance from target
    const distance = Math.abs(note.y - TARGET_Y);
    
    // Determine judgment based on distance
    let judgment;
    if (distance <= diffSettings.perfectRange) {
        judgment = judgments.PERFECT;
        audioManager.playSound('perfect');
    } else if (distance <= diffSettings.goodRange) {
        judgment = judgments.GOOD;
        audioManager.playSound('good');
    } else if (distance <= diffSettings.okayRange) {
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
    document.getElementById('finalDifficulty').textContent = `Difficulty: ${currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1)}`;
    
    // Sync difficulty buttons on game over screen with current difficulty
    document.querySelectorAll('#gameOver .difficulty-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`${currentDifficulty}ButtonGameOver`).classList.add('selected');
    
    // Show game over screen
    document.getElementById('gameOver').classList.remove('hidden');
}

// Initialize the game when the page loads
window.addEventListener('load', init);
