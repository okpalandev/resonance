const soundOptions = resonance.sound({
    baseURL: 'fixtures/',
    audioPaths: ['./whoosh.mp3']
});

const mySound = new resonance.sound(soundOptions);
const playButton = document.getElementById('btn');
playButton.addEventListener('click', async () => {
    try {
        mySound.play();
    } catch (error) {
        console.error('Error playing sound:', error.message);
    }
});

