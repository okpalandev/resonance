Resonance
=========
### Simple DOM Event Driven Sound Abstraction Library

Installation
------------

```bash 
$ npm install @koodu-platform/resonance
```
## Usage
-----

```javascript 
const soundOptions ={
    baseURL: 'fixtures/',
    audioPaths: ['./whoosh.mp3']
}

const mySound = new resonance.sound(soundOptions);
const playButton = document.getElementById('btn');
playButton.addEventListener('click', async (ev) => {
    
    try {
        await mySound.play(1);
    } catch (error) {
        console.error('Error playing sound:', error.message);
    }
});
```
---
API
---

### `resonance.sound(options)`
Creates a new Resonance sound instance.

* `options`: An object with the following properties:
  * `baseURL`: Base URL for audio file paths.
  * `audioPaths`: Array or string of audio file paths.
  * `searchParams`: Optional search parameters for audio file URLs.

#### Instance Methods

##### `load(filePaths)`
Load audio files.
* `filePaths`: Array or string of file paths to audio files.

##### `play(volume)`
Play the loaded audio.
* `volume`: Volume level (default is 1).

##### `resume(resumeTime)`
- R esume playing from a specified time.
* `resumeTime`: Time to resume from.

##### `pause()`
- Pause the currently playing audio.


##### `stop()`
- Stop the currently playing audio.

##### `dispose()`
- Dispose of the sound instance.

##### `prev()`
- Load and play the previous loaded sound.

##### `next()`
- Load and play the next loaded sound.

### Enums
#### `SOUND_PLAY_STATES`
* `SOUND_CREATED`
* `SOUND_PAUSED`
* `SOUND_PLAYING`
* `SOUND_RESUMED`
* `SOUND_STOPPED`

#### `SOUND_PRELOAD_STATES`
* `SOUND_LOADING`
* `SOUND_LOADED`
* `SOUND_ERROR`

