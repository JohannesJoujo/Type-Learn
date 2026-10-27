// --- 1. PDF.js Setup & DOM References ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFileInput');
const pdfViewer = document.getElementById('pdfViewer');
const pdfPreviewSection = document.getElementById('pdfPreviewSection');
const togglePdfBtn = document.getElementById('togglePdfBtn');

const textDisplay = document.getElementById('textDisplay');
const typeInput = document.getElementById('typeinput');
const timerDisplay = document.getElementById('timerDisplay');
const wpmDisplay = document.getElementById('wpmDisplay');
const accuracyDisplay = document.getElementById('accuracyDisplay');
const caseToggleBtn = document.getElementById('caseToggle');
const soundToggleBtn = document.getElementById('soundToggle');

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// State Variables
let targetChars = [];
let spans = [];
let wordMap = [];
let ignoreCase = localStorage.getItem('savedIgnoreCase') === 'true';
let isMuted = localStorage.getItem('typingSoundMuted') === 'true';
let isPdfVisible = false;

let timeElapsed = 0;
let startTime = null;
let timerStarted = false;
let timerInterval;
let previousTypedLength = 0;
let lastActiveLineOffset = -1;

// --- 2. Toggle PDF Preview Button Handler ---
if (togglePdfBtn && pdfPreviewSection) {
    togglePdfBtn.addEventListener('click', () => {
        isPdfVisible = !isPdfVisible;
        pdfPreviewSection.classList.toggle('visible', isPdfVisible);
        togglePdfBtn.innerText = isPdfVisible ? '📖 Hide PDF' : '📖 Show PDF';
    });
}

// --- 3. Case Sensitivity Helper & Toggle ---
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

    if (spans[typedChars.length]) {
        spans[typedChars.length].classList.add('active-char');
    }
    updateStats();
}

if (caseToggleBtn) {
    caseToggleBtn.addEventListener('click', toggleCaseSensitivity);
}

// --- 4. Render PDF Preview & Extract Text ---
if (pdfFileInput) {
    pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        // Clear placeholder immediately to prevent text overlap on line 1
        typeInput.placeholder = '';

        pdfViewer.innerHTML = '<div class="pdf-placeholder"><p>⏳ Loading PDF pages...</p></div>';
        textDisplay.innerHTML = '';
        typeInput.value = '';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        pdfViewer.innerHTML = ''; // Clear placeholder
        let extractedRawText = '';

        // Render pages onto canvases for right-pane preview & collect text
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            pdfViewer.appendChild(canvas);

            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedRawText += pageText + ' ';
        }

        const cleanText = extractedRawText.replace(/\s+/g, ' ').trim();
        initTypingEngine(cleanText);
    });
}

// --- 5. Initialize Typing Engine ---
function initTypingEngine(text) {
    clearInterval(timerInterval);
    timerStarted = false;
    startTime = null;
    previousTypedLength = 0;
    lastActiveLineOffset = -1;
    typeInput.disabled = false;
    typeInput.value = '';
    typeInput.placeholder = ''; // Clear placeholder completely
    textDisplay.innerHTML = '';
    
    timerDisplay.innerText = 'Time: 0s';
    wpmDisplay.innerText = 'WPM: 0';
    accuracyDisplay.innerText = 'Accuracy: 100%';

    targetChars = text.split('');

    spans = targetChars.map(char => {
        const span = document.createElement('span');
        span.innerText = char;
        textDisplay.appendChild(span);
        return span;
    });

    if (spans.length > 0) {
        spans[0].classList.add('active-char');
    }

    // Build Word Boundaries Map
    wordMap = [];
    let currentWord = { start: -1, end: -1 };

    targetChars.forEach((char, index) => {
        const isWhitespace = /\s/.test(char);
        if (!isWhitespace) {
            if (currentWord.start === -1) currentWord.start = index;
            currentWord.end = index;
        } else if (currentWord.start !== -1) {
            wordMap.push({ ...currentWord });
            currentWord = { start: -1, end: -1 };
        }
    });
    if (currentWord.start !== -1) wordMap.push(currentWord);

    typeInput.focus();
}

typeInput.addEventListener('scroll', () => {
    textDisplay.scrollTop = typeInput.scrollTop;
});

// --- 6. Stats & Timer Engines ---
function updateStats() {
    const typedChars = typeInput.value.split('');
    const totalTyped = typedChars.length;
    let correctChars = 0;

    spans.forEach((span, index) => {
        if (typedChars[index] != null && charsMatch(typedChars[index], targetChars[index])) {
            correctChars++;
        }
    });

    const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
    accuracyDisplay.innerText = `Accuracy: ${accuracy}%`;

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
            if (isWordCorrect) correctWordCount++;
        }
    });

    const seconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    if (seconds > 0) {
        const elapsedMinutes = seconds / 60;
        const wpm = Math.round(correctWordCount / elapsedMinutes);
        wpmDisplay.innerText = `WPM: ${wpm}`;
    } else {
        wpmDisplay.innerText = `WPM: 0`;
    }
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeElapsed = elapsed;
        timerDisplay.innerText = `Time: ${elapsed}s`;
        updateStats();
    }, 200);
}

function endTest(message) {
    clearInterval(timerInterval);
    typeInput.disabled = true;
    timerDisplay.innerText = message;
    updateStats();

    spans.forEach(span => span.classList.remove('active-char'));

    if (typeof confetti === 'function') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }

    const finalWpmEl = document.getElementById('finalWpm');
    const finalAccEl = document.getElementById('finalAcc');
    const finalTimeEl = document.getElementById('finalTime');
    const modalEl = document.getElementById('resultModal');

    const exactElapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : timeElapsed;

    if (finalWpmEl) finalWpmEl.innerText = wpmDisplay.innerText.replace('WPM: ', '');
    if (finalAccEl) finalAccEl.innerText = accuracyDisplay.innerText.replace('Accuracy: ', '');
    if (finalTimeEl) finalTimeEl.innerText = `${exactElapsed}s`;

    if (modalEl) {
        setTimeout(() => modalEl.classList.add('active'), 400);
    }
}

// --- 7. Audio & Input Handlers ---
typeInput.addEventListener('keydown', (e) => {
    const ignoredKeys = [
        'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 
        'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    if (!ignoredKeys.includes(e.key)) playKeySound();
});

typeInput.addEventListener('input', () => {
    if (!timerStarted && targetChars.length > 0) {
        startTimer();
        timerStarted = true;
    }

    const typedChars = typeInput.value.split('');
    const currentLength = typedChars.length;

    if (currentLength > previousTypedLength) {
        for (let i = previousTypedLength; i < currentLength; i++) {
            const targetSpan = spans[i];
            if (targetSpan) {
                targetSpan.className = '';
                if (charsMatch(typedChars[i], targetChars[i])) {
                    targetSpan.classList.add('correct');
                } else {
                    targetSpan.classList.add('incorrect');
                    if (i === currentLength - 1) playErrorSound();
                }
            }
        }
    } else if (currentLength < previousTypedLength) {
        // Multi-character bulk erase fix (Cmd+Backspace / Ctrl+Backspace)
        for (let i = currentLength; i < spans.length; i++) {
            spans[i].className = '';
        }
    }

    previousTypedLength = currentLength;
    spans.forEach(span => span.classList.remove('active-char'));

    if (spans[currentLength]) {
        const activeSpan = spans[currentLength];
        activeSpan.classList.add('active-char');

        if (activeSpan.offsetTop !== lastActiveLineOffset) {
            activeSpan.scrollIntoView({ block: 'center', behavior: 'instant' });
            lastActiveLineOffset = activeSpan.offsetTop;
            typeInput.scrollTop = textDisplay.scrollTop;
        }
    }

    updateStats();

    if (typedChars.length >= targetChars.length && targetChars.length > 0) {
        endTest("Finished!");
    }
});

// --- 8. Sound Engine & Navigation ---
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
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const currentSoundStyle = localStorage.getItem('savedSoundStyle') || 'mechanical';
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentSoundStyle === 'soft') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    } else if (currentSoundStyle === 'digital') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.025);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);
    } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function playErrorSound() {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

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
    } else if (currentErrorStyle === 'retro') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function closeModal() {
    const modalEl = document.getElementById('resultModal');
    if (modalEl) modalEl.classList.remove('active');
}

function returnToHomePage() {
    window.location = "index.html";
}


// ==========================================
// PURE TWO-FINGER PINCH-TO-ZOOM FOR PDF
// ==========================================
let pdfZoomScale = 1.0;
let initialTouchDistance = null;

if (pdfViewer) {
    // 1. Two-Finger Trackpad Pinch (Pinch-to-zoom gesture on laptops)
    pdfViewer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            applyPdfZoom(pdfZoomScale + delta);
        }
    }, { passive: false });

    // 2. Touchscreen Two-Finger Pinch Gesture
    pdfViewer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialTouchDistance = getTouchDistance(e.touches);
        }
    });

    pdfViewer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialTouchDistance) {
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches);
            const scaleFactor = currentDistance / initialTouchDistance;
            applyPdfZoom(pdfZoomScale * scaleFactor);
            initialTouchDistance = currentDistance; // Continuously update reference
        }
    }, { passive: false });

    pdfViewer.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialTouchDistance = null;
        }
    });
}

// Calculate distance between two touch points
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

// Apply smooth canvas scaling
function applyPdfZoom(newScale) {
    // Increased max zoom limit from 2.5x to 5.0x (500% zoom)
    pdfZoomScale = Math.min(Math.max(newScale, 0.6), 5.0);

    const canvases = pdfViewer.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        canvas.style.width = `${pdfZoomScale * 100}%`;
        canvas.style.height = 'auto';
        canvas.style.transition = 'width 0.08s ease-out';
    });
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