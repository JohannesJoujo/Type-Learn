// --- 1. Retrieve Saved Preferences & State Variables ---
const loadedText = localStorage.getItem('savedTypingText') || "No text was loaded.";
const timeLimit = parseInt(localStorage.getItem('savedTimeLimit'), 10) || 0; 
let ignoreCase = localStorage.getItem('savedIgnoreCase') === 'true';

// Web Audio Context (For zero-latency key clicks)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// DOM Elements
const textDisplay = document.getElementById('textDisplay');
const typeInput = document.getElementById('typeinput');
const timerDisplay = document.getElementById('timerDisplay');
const wpmDisplay = document.getElementById('wpmDisplay');
const accuracyDisplay = document.getElementById('accuracyDisplay');
const caseToggleBtn = document.getElementById('caseToggle');
const soundToggleBtn = document.getElementById('soundToggle');

// Core Test State Variables
let timeLeft = timeLimit;
let timeElapsed = 0; 
let startTime = null;
let timerStarted = false;
let timerInterval;
let previousTypedLength = 0;
let lastActiveLineOffset = -1;

// Initialize Timer Display
timerDisplay.innerText = timeLimit > 0 ? `Time: ${timeLeft}s` : `Time: 0s`;

// --- 2. Case-Insensitive Helper & Live Toggle ---
function charsMatch(charA, charB) {
    if (charA == null || charB == null) return false;
    return ignoreCase ? charA.toLowerCase() === charB.toLowerCase() : charA === charB;
}

function updateCaseButton() {
    if (caseToggleBtn) {
        caseToggleBtn.innerText = ignoreCase ? '🔤 Ignore Case: ON' : '🔤 Ignore Case: OFF';
        caseToggleBtn.classList.toggle('active', ignoreCase);
    }
}
updateCaseButton();

function toggleCaseSensitivity() {
    ignoreCase = !ignoreCase;
    localStorage.setItem('savedIgnoreCase', ignoreCase);
    updateCaseButton();

    // Re-evaluate green/red highlights for all typed characters in real-time
    const typedChars = typeInput.value.split('');
    spans.forEach((span, index) => {
        if (typedChars[index] != null) {
            span.className = '';
            if (charsMatch(typedChars[index], targetChars[index])) {
                span.classList.add('correct');
            } else {
                span.classList.add('incorrect');
            }
        }
    });

    // Retain active block cursor position
    const currentLength = typedChars.length;
    if (spans[currentLength]) {
        spans[currentLength].classList.add('active-char');
    }

    // Recalculate WPM and Accuracy immediately
    updateStats();
}

if (caseToggleBtn) {
    caseToggleBtn.addEventListener('click', toggleCaseSensitivity);
}

// --- 3. Break Target Text into Spans & Cache Reference Array ---
const targetChars = loadedText.split('');
const spans = targetChars.map(char => {
    const span = document.createElement('span');
    span.innerText = char;
    textDisplay.appendChild(span);
    return span;
});

// Highlight first letter on load
if (spans.length > 0) {
    spans[0].classList.add('active-char');
}

// --- 4. Map Word Boundaries (Actual Word Count WPM) ---
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

// --- 5. Calculate WPM & Accuracy ---
function updateStats() {
    const typedChars = typeInput.value.split('');
    const totalTyped = typedChars.length;
    let correctChars = 0;

    spans.forEach((span, index) => {
        if (typedChars[index] != null && charsMatch(typedChars[index], targetChars[index])) {
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
                if (!charsMatch(typedChars[i], targetChars[i])) {
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

// --- 6. Timer Logic ---
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

// --- 7. Stop Test Handler & Celebration ---
function endTest(message) {
    clearInterval(timerInterval);
    typeInput.disabled = true;
    timerDisplay.innerText = message;
    updateStats();

    // Remove active cursor highlight
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

    // Show Modal Overlay
    if (modalEl) {
        setTimeout(() => {
            modalEl.classList.add('active');
        }, 400);
    }
}

// --- 8. Audio Keypress Event Listener ---
typeInput.addEventListener('keydown', (e) => {
    const ignoredKeys = [
        'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 
        'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    if (!ignoredKeys.includes(e.key)) {
        playKeySound();
    }
});

// --- 9. Optimized Typing Input Handler ---
typeInput.addEventListener('input', () => {
    if (!timerStarted) {
        startTimer();
        timerStarted = true;
    }

    const typedChars = typeInput.value.split('');
    const currentLength = typedChars.length;

    if (currentLength > previousTypedLength) {
        // Typing forward (handles single keys, fast typing, or paste)
        for (let i = previousTypedLength; i < currentLength; i++) {
            const targetSpan = spans[i];
            if (targetSpan) {
                targetSpan.className = '';
                if (charsMatch(typedChars[i], targetChars[i])) {
                    targetSpan.classList.add('correct');
                } else {
                    targetSpan.classList.add('incorrect');
                    if (i === currentLength - 1) {
                        playErrorSound();
                    }
                }
            }
        }
    } else if (currentLength < previousTypedLength) {
        // Multi-character erase fix (Cmd+Backspace, Ctrl+Backspace, or text selection delete)
        for (let i = currentLength; i < spans.length; i++) {
            spans[i].className = '';
        }
    }

    previousTypedLength = currentLength;

    // Reset active cursor highlight across all spans
    spans.forEach(span => span.classList.remove('active-char'));

    // Move cursor to the new current position
    if (spans[currentLength]) {
        const activeSpan = spans[currentLength];
        activeSpan.classList.add('active-char');

        // Scroll ONLY when line offset changes to prevent layout thrashing
        if (activeSpan.offsetTop !== lastActiveLineOffset) {
            activeSpan.scrollIntoView({
                block: 'center',
                behavior: 'instant'
            });
            lastActiveLineOffset = activeSpan.offsetTop;
            typeInput.scrollTop = textDisplay.scrollTop;
        }
    }

    updateStats();

    // Check completion
    if (typedChars.length >= targetChars.length) {
        endTest("Finished!");
    }
});

// --- 10. Web Audio Sound Engine ---
let isMuted = localStorage.getItem('typingSoundMuted') === 'true';

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

    const currentSoundStyle = localStorage.getItem('savedSoundStyle') || 'mechanical';
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentSoundStyle === 'soft') {
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

    const currentErrorStyle = localStorage.getItem('savedErrorSoundStyle') || 'buzz';
    if (currentErrorStyle === 'none') return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentErrorStyle === 'thud') {
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

// --- 11. Modal Controls & Navigation ---
function closeModal() {
    const modalEl = document.getElementById('resultModal');
    if (modalEl) {
        modalEl.classList.remove('active');
    }
}

function returnToHomePage() {
    window.location = "index.html";
}

// --- Font Style Handler ---
const fontSelect = document.getElementById('fontSelect');
const savedFont = localStorage.getItem('savedFontStyle') || 'monospace';

function applyFont(fontKey) {
    // Remove old font classes from body
    document.body.classList.remove('font-jetbrains', 'font-fira', 'font-roboto', 'font-space');
    
    if (fontKey !== 'monospace') {
        document.body.classList.add(`font-${fontKey}`);
    }

    if (fontSelect) {
        fontSelect.value = fontKey;
    }
}

// Load saved font on page start
applyFont(savedFont);

// Handle user dropdown selection
if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        const selectedFont = e.target.value;
        localStorage.setItem('savedFontStyle', selectedFont);
        applyFont(selectedFont);
    });
}