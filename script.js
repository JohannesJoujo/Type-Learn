const userinputtext = document.getElementById('userinputtext');
const timeLimit = document.getElementById('timeLimit');
const soundStyle = document.getElementById('soundStyle');
const errorSoundStyle = document.getElementById('errorSoundStyle'); // NEW
const form = document.getElementById('form');
const errorElement = document.getElementById('error');

// Preset Sample Text Library
const sampleTexts = {
    short: "The quick brown fox jumps over the lazy dog.",
    medium: "Programming is the art of telling a computer what to do. Consistent practice is the secret to building typing speed and precision.",
    quote: "Life is what happens when you're busy making other plans. - John Lennon"
};

function loadSample(type) {
    if (userinputtext && sampleTexts[type]) {
        userinputtext.value = sampleTexts[type];
        if (errorElement) errorElement.innerText = '';
    }
}

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        errorElement.innerText = '';

        if (userinputtext.value.trim() === '') {
            errorElement.innerText = 'Text is required';
            return;
        }

        // Save preferences to localStorage
        localStorage.setItem('savedTypingText', userinputtext.value);
        localStorage.setItem('savedTimeLimit', timeLimit.value);
        localStorage.setItem('savedSoundStyle', soundStyle ? soundStyle.value : 'mechanical');
        localStorage.setItem('savedErrorSoundStyle', errorSoundStyle ? errorSoundStyle.value : 'buzz'); // NEW
        
        window.location = "typingPage.html";
    });
}