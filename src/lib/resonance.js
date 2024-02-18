(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], () => root.resonance = factory());
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.resonance = factory();
    }
}(typeof this !== 'undefined' ? this : self, function () {
    'use strict';

    const makeAudioContext = function () {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        return new AudioContext();
    };

    async function makeAudioBuffer(arrayBuffer, audioContext) {
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    const makeAudioSource = function (buffer, volume = 1, audioContext) {
        let audioSource = audioContext.createBufferSource();
        let gainNode = audioContext.createGain();

        audioSource.buffer = buffer;
        gainNode.gain.value = volume;
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        return { data: audioSource, gainNode, audioContext };
    };

    const path = {
        parse: (base = window.location.origin, path, searchParams = {}) => {
            const url = new URL(path, new URL(base, path ? window.location.origin + '/' + path : ''));
            for (const [key, value] of Object.entries(searchParams)) {
                url.searchParams.set(key, value);
            }
            return url.href;
        },
        getFileName: (filePath = '') => {
            if (typeof filePath !== 'string' || filePath.trim() === '') {
                return filePath;
            }

            const parts = filePath.split('/');
            const fileName = parts.pop();
            const nameParts = fileName.split('.');

            if (nameParts.length > 1) {
                nameParts.pop();
            }

            return nameParts.join('.');
        }
    };

    async function makeHTTPRequest(url) {
        try {
            const timestamp = Date.now();
            const cacheBustedURL = path.parse(window.location.origin, url, { timestamp });
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', cacheBustedURL, true);

                // Set default headers
                xhr.setRequestHeader('Content-Type', 'audio/*');
                xhr.setRequestHeader('Accept', 'audio/*');
                xhr.setRequestHeader('Range', '0-*');

                xhr.responseType = 'arraybuffer';

                xhr.onload = function () {
                    if (xhr.status === 200 || xhr.status === 206) {
                        // 206 Partial Content is expected for range requests
                        resolve(xhr.response);
                    } else {
                        reject(new Error('Request failed with status: ' + xhr.status));
                    }
                };

                xhr.onerror = function () {
                    reject(new Error('Network error occurred'));
                };

                xhr.send(null);
            });
        } catch (error) {
            console.error('Failed to load audio file:', error.message);
            throw error;
        }
    }

    function Enum(...values) {
        return values.reduce((acc, value) => {
            acc[value] = value;
            return acc;
        }, {});
    }

    const SOUND_PLAY_STATES = Enum('SOUND_CREATED', 'SOUND_PAUSED', 'SOUND_PLAYING', 'SOUND_RESUMED', 'SOUND_STOPPED');
    const SOUND_PRELOAD_STATES = Enum('SOUND_LOADING', 'SOUND_LOADED', 'SOUND_ERROR');
    const audioContext = makeAudioContext();

    function sound(options) {
        if (!(this instanceof sound)) {
            return new sound(options);
        }
        this.audioContext = audioContext;
        this.baseURL = options.baseURL;
        this.searchParams = options.searchParams || {};
        this.playTime = 0;
        this.currentSoundIndex = 0;
        this.loadedSounds = [];
        this.states = {
            PRELOAD: SOUND_PRELOAD_STATES.SOUND_LOADING,
            PLAY: SOUND_PLAY_STATES.SOUND_CREATED
        };

        if (Array.isArray(options.audioPaths)) {
            this.audioPaths = options.audioPaths.map(url => path.parse(options.baseURL, url, options.searchParams));
        } else if (typeof options.audioPaths === 'string') {
            this.audioPaths = [path.parse(options.baseURL, options.audioPaths, options.searchParams)];
        } else {
            this.audioPaths = [];
        }

        this.audioContext.onstatechange = () => {
            console.log('Audio context state changed:', this.audioContext.state);
        };

        return this;
    }

    sound.prototype[Symbol.iterator] = function () {
        this.iteratorIndex = 0;
        return {
            next: () => {
                if (this.iteratorIndex < this.loadedSounds.length) {
                    const data = this.loadedSounds[this.iteratorIndex++];
                    return { value: data, done: false };
                } else {
                    this.iteratorIndex = 0;
                    return { done: true };
                }
            }
        };
    };

    sound.prototype.load = async function (filePaths) {
        if (!Array.isArray(filePaths)) {
            filePaths = [filePaths];
        }

        try {
            const promises = filePaths.map(async filePath => {
                const audioPaths = path.parse(this.baseURL, filePath, {});
                const arrayBuffer = await makeHTTPRequest(audioPaths);
                const audioBuffer = await makeAudioBuffer(arrayBuffer, this.audioContext);
                const audioSource = makeAudioSource(audioBuffer, 1, this.audioContext);
                return { filePath, audioSource };
            });

            this.loadedSounds = await Promise.all(promises);
            this.states.PRELOAD = SOUND_PRELOAD_STATES.SOUND_LOADED;
        } catch (error) {
            console.error(`Failed to load audio: ${error.message}`);
            this.states.PRELOAD = SOUND_PRELOAD_STATES.SOUND_ERROR;
        }
        return this;
    };

    sound.prototype.prev = async function () {
        if (this.loadedSounds.length === 0) {
            console.warn("No loaded sounds available.");
            return null;
        }

        if (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PLAYING) {
            await this.stop();
        }

        this.iteratorIndex = (this.iteratorIndex - 1 + this.loadedSounds.length) % this.loadedSounds.length;
        const prevSound = this.loadedSounds[this.iteratorIndex];
        return prevSound;
    };

    sound.prototype.next = function () {
        if (this.loadedSounds.length === 0) {
            console.warn("No loaded sounds available.");
            return this;
        }

        if (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PLAYING) {
            this.stop();
        }

        this.iteratorIndex = (this.iteratorIndex + 1) % this.loadedSounds.length;
        const nextSound = this.loadedSounds[this.iteratorIndex];
        return nextSound;
    };

    sound.prototype.play = async function (volume = 1, autoplay = true) {
        await this.load(this.audioPaths);
        if (this.states.PRELOAD !== SOUND_PRELOAD_STATES.SOUND_LOADED) {
            console.warn("No loaded sounds available. Use the load method to load sounds.");
            return this;
        }

        switch (this.states.PLAY) {
            case SOUND_PLAY_STATES.SOUND_CREATED:
            case SOUND_PLAY_STATES.SOUND_PAUSED:
            case SOUND_PLAY_STATES.SOUND_STOPPED:
                const firstSound = this.loadedSounds[0];
                if (firstSound) {
                    const { audioSource } = firstSound;
                    // Stop any previously playing sound
                    if (this.audioSource && (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PLAYING || this.states.PLAY === SOUND_PLAY_STATES.SOUND_RESUMED)) {
                        this.stop();
                    }
                    // Pass autoplay as an argument to makeAudioSource
                    this.audioSource = makeAudioSource(audioSource.data.buffer, volume, makeAudioContext());
                    this.audioSource.data.start(0);
                    this.states.PLAY = SOUND_PLAY_STATES.SOUND_PLAYING;
                }
                break;

            default:
                console.warn("Unexpected play state.");
                break;
        }

        return this;
    };

    sound.prototype.resume = function (resumeTime = this.playTime || 0) {
        if (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PAUSED) {
            if (this.audioSource) {
                try {
                    if (this.audioContext.state === 'suspended') {
                        this.audioSource.data.start(0, resumeTime);
                        this.states.PLAY = SOUND_PLAY_STATES.SOUND_RESUMED;
                        this.playTime = resumeTime;
                    } else {
                        console.warn("Cannot resume when AudioContext state is not 'suspended'.");
                    }
                } catch (error) {
                    console.error('Error during resume:', error.message);
                }
            } else {
                console.warn("No audio source available to resume.");
            }
        } else {
            console.warn("Cannot resume when the sound is not paused.");
        }

        return this;
    };

    sound.prototype.pause = function () {
        switch (this.states.PLAY) {
            case SOUND_PLAY_STATES.SOUND_RESUMED:
                if (this.audioSource) {
                    this.audioSource.data.stop();
                    this.playTime = this.audioSource.audioContext.currentTime - this.playTime;
                    this.states.PLAY = SOUND_PLAY_STATES.SOUND_PAUSED;
                }
                break;
        }
        return this;
    };

    sound.prototype.stop = function () {
        if (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PLAYING || this.states.PLAY === SOUND_PLAY_STATES.SOUND_RESUMED) {
            if (this.audioSource) {
                this.audioSource.data.stop();
                this.states.PLAY = SOUND_PLAY_STATES.SOUND_STOPPED;
            }
        }
        return this;
    };

    sound.prototype.dispose = function () {
        if (this.states.PLAY === SOUND_PLAY_STATES.SOUND_PLAYING || this.states.PLAY === SOUND_PLAY_STATES.SOUND_RESUMED) {
            this.stop();
        }
        if (this.audioSource) {
            this.audioSource.data.disconnect();
        }
    };
    
    sound.prototype.setVolume = function (volume) {
        if (this.audioSource) {
            this.audioSource.gainNode.gain.value = volume;
        }
        return this;
    };

    sound.prototype.getCurrentState = function () {
        return this.states.PLAY;
    };

    sound.prototype.getCurrentTime = function () {
        if (this.audioSource) {
            return this.audioSource.audioContext.currentTime;
        }
        return 0;
    };

    sound.prototype.getTotalDuration = function () {
        if (this.audioSource) {
            return this.audioSource.data.buffer.duration;
        }
        return 0;
    };

    sound.prototype.getCurrentSoundIndex = function () {
        return this.currentSoundIndex;
    };

    return {
        sound
    };
}));
