// 1. Retrieve saved settings from LocalStorage
const loadedText = localStorage.getItem('savedTypingText') || "No text was loaded.";
const timeLimit = parseInt(localStorage.getItem('savedTimeLimit')) || 0; 

// Web Audio Context (For zero-latency key clicks)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// DOM Elements
const textDisplay = document.getElementById('textDisplay');
const typeInput = document.getElementById('typeinput');
const timerDisplay = document.getElementById('timerDisplay');
const wpmDisplay = document.getElementById('wpmDisplay');
const accuracyDisplay = document.getElementById('accuracyDisplay');

// State Variables
let timeLeft = timeLimit;
let timeElapsed = 0; 
let startTime = null;
let timerStarted = false;
let timerInterval;
let previousTypedLength = 0;

// Initialize Timer Display
timerDisplay.innerText = timeLimit > 0 ? `Time: ${timeLeft}s` : `Time: 0s`;

// 2. Break target text into individual character spans
const targetChars = loadedText.split('');
targetChars.forEach(char => {
    const span = document.createElement('span');
    span.innerText = char;
    textDisplay.appendChild(span);
});

// 3. Map word boundaries (start & end character indices for actual word count WPM)
const wordMap = [];
let currentWord = { start: -1, end: -1 };

targetChars.forEach((char, index) => {
    const isWhitespace = /\s/.test(char);

    if (!isWhitespace) {
        if (currentWord.start === -1) {
            currentWord.start = index;
        }
        currentWord.end = index;
    } else if (currentWord.start !== -1) {
        wordMap.push({ ...currentWord });
        currentWord = { start: -1, end: -1 };
    }
});
if (currentWord.start !== -1) {
    wordMap.push(currentWord);
}

// Manual scroll sync fallback
typeInput.addEventListener('scroll', () => {
    textDisplay.scrollTop = typeInput.scrollTop;
});

// 4. Calculate WPM (Actual Correct Words) and Accuracy
function updateStats() {
    const typedChars = typeInput.value.split('');
    const totalTyped = typedChars.length;
    let correctChars = 0;

    const spans = textDisplay.querySelectorAll('span');
    spans.forEach((span, index) => {
        if (typedChars[index] != null && typedChars[index] === targetChars[index]) {
            correctChars++;
        }
    });

    // Accuracy %
    const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
    accuracyDisplay.innerText = `Accuracy: ${accuracy}%`;

    // Count fully correctly spelled words
    let correctWordCount = 0;

    wordMap.forEach(word => {
        if (typedChars.length >= word.end + 1) {
            let isWordCorrect = true;

            for (let i = word.start; i <= word.end; i++) {
                if (typedChars[i] !== targetChars[i]) {
                    isWordCorrect = false;
                    break;
                }
            }

            if (isWordCorrect) {
                correctWordCount++;
            }
        }
    });

    // Calculate elapsed time precisely in seconds
    const seconds = startTime ? (Date.now() - startTime) / 1000 : 0;

    if (seconds > 0) {
        const elapsedMinutes = seconds / 60;
        const wpm = Math.round(correctWordCount / elapsedMinutes);
        wpmDisplay.innerText = `WPM: ${wpm}`;
    } else {
        wpmDisplay.innerText = `WPM: 0`;
    }
}

// 5. Timer Logic
function startTimer() {
    startTime = Date.now();

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeElapsed = elapsed;

        if (timeLimit > 0) {
            timeLeft = timeLimit - elapsed;

            if (timeLeft <= 0) {
                timeLeft = 0;
                timerDisplay.innerText = `Time: 0s`;
                endTest("Time's up!");
                return;
            }
            timerDisplay.innerText = `Time: ${timeLeft}s`;
        } else {
            timerDisplay.innerText = `Time: ${elapsed}s`;
        }

        updateStats();
    }, 200);
}

// 6. Stop Test Handler & Celebration
function endTest(message) {
    clearInterval(timerInterval);
    typeInput.disabled = true;
    timerDisplay.innerText = message;
    updateStats();

    // Remove active cursor highlight from text
    const spans = textDisplay.querySelectorAll('span');
    spans.forEach(span => span.classList.remove('active-char'));

    // Trigger Confetti Blast
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
        });
    }

    // Populate Modal Scores safely
    const finalWpmEl = document.getElementById('finalWpm');
    const finalAccEl = document.getElementById('finalAcc');
    const finalTimeEl = document.getElementById('finalTime');
    const modalEl = document.getElementById('resultModal');

    const exactElapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : timeElapsed;

    if (finalWpmEl) finalWpmEl.innerText = wpmDisplay.innerText.replace('WPM: ', '');
    if (finalAccEl) finalAccEl.innerText = accuracyDisplay.innerText.replace('Accuracy: ', '');
    if (finalTimeEl) finalTimeEl.innerText = `${exactElapsed}s`;

    // Show Modal Overlay after a brief delay
    if (modalEl) {
        setTimeout(() => {
            modalEl.classList.add('active');
        }, 400);
    }
}

// 7. Audio Keypress Triggers
typeInput.addEventListener('keydown', (e) => {
    const ignoredKeys = [
        'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 
        'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    if (!ignoredKeys.includes(e.key)) {
        playKeySound();
    }
});

// 8. Typing Input Handler
typeInput.addEventListener('input', () => {
    if (!timerStarted) {
        startTimer();
        timerStarted = true;
    }

    const typedChars = typeInput.value.split('');
    const currentLength = typedChars.length;
    const isTypingForward = currentLength > previousTypedLength;
    previousTypedLength = currentLength;

    const spans = textDisplay.querySelectorAll('span');

    // Color correct/incorrect letters
    spans.forEach((span, index) => {
        const typedChar = typedChars[index];
        span.className = ''; 

        if (typedChar == null) {
            // Not typed yet
        } else if (typedChar === targetChars[index]) {
            span.classList.add('correct');
        } else {
            span.classList.add('incorrect');
            
            // Play error sound ONLY on freshly typed incorrect character (not when backspacing)
            if (isTypingForward && index === currentLength - 1) {
                playErrorSound();
            }
        }
    });

    // Move active marker & auto-scroll current line to vertical center
    const nextCharIndex = typedChars.length;
    if (spans[nextCharIndex]) {
        const activeSpan = spans[nextCharIndex];
        activeSpan.classList.add('active-char');

        // Scroll current active line to vertical center
        activeSpan.scrollIntoView({
            block: 'center',
            behavior: 'instant'
        });

        // Sync hidden textarea scroll position
        typeInput.scrollTop = textDisplay.scrollTop;
    }

    updateStats();

    // Check for test completion
    if (typedChars.length >= targetChars.length) {
        endTest("Finished!");
    }
});

// Initialize active block cursor on the first letter when page loads
const allSpans = textDisplay.querySelectorAll('span');
if (allSpans.length > 0) {
    allSpans[0].classList.add('active-char');
}

// --- Sound Controls ---
let isMuted = localStorage.getItem('typingSoundMuted') === 'true';
const soundToggleBtn = document.getElementById('soundToggle');

function updateSoundButton() {
    if (soundToggleBtn) {
        soundToggleBtn.innerText = isMuted ? '🔇 Sound Off' : '🔊 Sound On';
    }
}
updateSoundButton();

function toggleSound() {
    isMuted = !isMuted;
    localStorage.setItem('typingSoundMuted', isMuted);
    updateSoundButton();
}

function playKeySound() {
    if (isMuted) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Fetch latest saved style from LocalStorage
    const currentSoundStyle = localStorage.getItem('savedSoundStyle') || 'mechanical';

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentSoundStyle === 'soft') {
        // Soft: Very deep, low-frequency sine wave
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);

    } else if (currentSoundStyle === 'digital') {
        // Digital: High-pitched square wave
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.025);

        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.025);

    } else {
        // Mechanical: Mid-frequency triangle wave
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    }
}

function playErrorSound() {
    if (isMuted) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Retrieve saved error sound preference
    const currentErrorStyle = localStorage.getItem('savedErrorSoundStyle') || 'buzz';
    if (currentErrorStyle === 'none') return; // User chose silent errors

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentErrorStyle === 'thud') {
        // 1. LOW THUD: Deep sine wave frequency drop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);

    } else if (currentErrorStyle === 'retro') {
        // 2. RETRO BEEP: Square wave pitch step down
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);

    } else {
        // 3. CLASSIC BUZZ (Default): Low sawtooth drop
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
}
// Close modal overlay to view typed passage
function closeModal() {
    const modalEl = document.getElementById('resultModal');
    if (modalEl) {
        modalEl.classList.remove('active');
    }
}
// Home Page Navigation
function returnToHomePage() {
    window.location = "index.html";
}