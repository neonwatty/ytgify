/**
 * Mock YouTube Player
 * Simulates YouTube's video player behavior for testing the YTgify extension
 */

class MockYouTubePlayer {
  constructor() {
    this.video = null;
    this.player = null;
    this.controls = null;
    this.isInitialized = false;
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPlayer());
    } else {
      this.setupPlayer();
    }
  }

  setupPlayer() {
    console.log('[Mock YouTube Player] Initializing...');

    // Get player elements
    this.video = document.getElementById('video-player');
    this.player = document.getElementById('movie_player');
    this.playButton = document.querySelector('.ytp-play-button');
    this.currentTimeDisplay = document.querySelector('.ytp-time-current');
    this.durationDisplay = document.querySelector('.ytp-time-duration');
    this.progressBar = document.querySelector('.ytp-play-progress');
    this.scrubberButton = document.querySelector('.ytp-scrubber-button');
    this.muteButton = document.querySelector('.ytp-mute-button');
    this.fullscreenButton = document.querySelector('.ytp-fullscreen-button');
    this.theaterButton = document.querySelector('.ytp-size-button');

    if (!this.video) {
      console.error('[Mock YouTube Player] Video element not found!');
      return;
    }

    // Load video metadata explicitly
    console.log('[Mock YouTube Player] Loading video from:', this.video.src);
    this.video.load(); // Trigger metadata loading

    // Set up event listeners
    this.setupVideoEventListeners();
    this.setupControlEventListeners();
    this.setupProgressBarInteraction();

    // Expose API for extension compatibility
    this.exposePlayerAPI();

    this.isInitialized = true;
    console.log('[Mock YouTube Player] Initialized successfully');

    // Dispatch a custom event to notify that player is ready
    window.dispatchEvent(new CustomEvent('mock-youtube-ready', {
      detail: { player: this }
    }));
  }

  setupVideoEventListeners() {
    // Video metadata loaded
    this.video.addEventListener('loadedmetadata', () => {
      console.log('[Mock YouTube Player] Metadata loaded', {
        duration: this.video.duration,
        dimensions: `${this.video.videoWidth}x${this.video.videoHeight}`
      });
      this.updateDuration();
      this.dispatchPlayerEvent('loadedmetadata');
    });

    // Video can play
    this.video.addEventListener('canplay', () => {
      console.log('[Mock YouTube Player] Can play');
      this.dispatchPlayerEvent('canplay');
    });

    // Time update
    this.video.addEventListener('timeupdate', () => {
      this.updateCurrentTime();
      this.updateProgressBar();
    });

    // Play event
    this.video.addEventListener('play', () => {
      console.log('[Mock YouTube Player] Playing');
      this.updatePlayButtonState(true);
      this.player.classList.add('playing-mode');
      this.player.classList.remove('paused-mode');
      this.dispatchPlayerEvent('play');
    });

    // Pause event
    this.video.addEventListener('pause', () => {
      console.log('[Mock YouTube Player] Paused');
      this.updatePlayButtonState(false);
      this.player.classList.remove('playing-mode');
      this.player.classList.add('paused-mode');
      this.dispatchPlayerEvent('pause');
    });

    // Ended event
    this.video.addEventListener('ended', () => {
      console.log('[Mock YouTube Player] Ended');
      this.updatePlayButtonState(false);
      this.dispatchPlayerEvent('ended');
    });

    // Seeking events
    this.video.addEventListener('seeking', () => {
      console.log('[Mock YouTube Player] Seeking to', this.video.currentTime);
      this.dispatchPlayerEvent('seeking');
    });

    this.video.addEventListener('seeked', () => {
      console.log('[Mock YouTube Player] Seeked to', this.video.currentTime);
      this.dispatchPlayerEvent('seeked');
    });

    // Volume change
    this.video.addEventListener('volumechange', () => {
      this.updateVolumeButtonState();
      this.dispatchPlayerEvent('volumechange');
    });

    // Error handling
    this.video.addEventListener('error', (e) => {
      console.error('[Mock YouTube Player] Video error:', e);
      this.dispatchPlayerEvent('error');
    });
  }

  setupControlEventListeners() {
    // Play/pause button
    if (this.playButton) {
      this.playButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.togglePlay();
      });
    }

    // Mute button
    if (this.muteButton) {
      this.muteButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMute();
      });
    }

    // Fullscreen button
    if (this.fullscreenButton) {
      this.fullscreenButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleFullscreen();
      });
    }

    // Theater button
    if (this.theaterButton) {
      this.theaterButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleTheaterMode();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcut(e);
    });
  }

  setupProgressBarInteraction() {
    const progressBarContainer = document.querySelector('.ytp-progress-bar-container');
    if (!progressBarContainer) return;

    progressBarContainer.addEventListener('click', (e) => {
      const rect = progressBarContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * this.video.duration;
      this.seekTo(newTime);
    });
  }

  // Player control methods
  togglePlay() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  play() {
    return this.video.play();
  }

  pause() {
    this.video.pause();
  }

  seekTo(timeInSeconds) {
    this.video.currentTime = timeInSeconds;
    console.log('[Mock YouTube Player] Seeked to:', timeInSeconds);
  }

  toggleMute() {
    this.video.muted = !this.video.muted;
  }

  setVolume(volume) {
    this.video.volume = Math.max(0, Math.min(1, volume));
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.player.requestFullscreen().catch(err => {
        console.error('[Mock YouTube Player] Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  toggleTheaterMode() {
    this.player.classList.toggle('ytp-big-mode');
    this.player.classList.toggle('ytp-small-mode');
    console.log('[Mock YouTube Player] Theater mode toggled');
  }

  // UI update methods
  updateCurrentTime() {
    if (this.currentTimeDisplay) {
      this.currentTimeDisplay.textContent = this.formatTime(this.video.currentTime);
    }
  }

  updateDuration() {
    if (this.durationDisplay) {
      this.durationDisplay.textContent = this.formatTime(this.video.duration);
    }
  }

  updateProgressBar() {
    if (this.progressBar && this.video.duration) {
      const percentage = (this.video.currentTime / this.video.duration) * 100;
      this.progressBar.style.width = `${percentage}%`;
    }
  }

  updatePlayButtonState(isPlaying) {
    if (!this.playButton) return;

    const playIcon = this.playButton.querySelector('.ytp-play-icon');
    const pauseIcon = this.playButton.querySelector('.ytp-pause-icon');

    if (isPlaying) {
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
      this.playButton.setAttribute('aria-label', 'Pause');
      this.playButton.setAttribute('title', 'Pause (k)');
    } else {
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      this.playButton.setAttribute('aria-label', 'Play');
      this.playButton.setAttribute('title', 'Play (k)');
    }
  }

  updateVolumeButtonState() {
    if (!this.muteButton) return;

    const volumeIcon = this.muteButton.querySelector('.ytp-volume-icon');
    if (this.video.muted || this.video.volume === 0) {
      this.muteButton.setAttribute('aria-label', 'Unmute');
      this.muteButton.setAttribute('title', 'Unmute (m)');
    } else {
      this.muteButton.setAttribute('aria-label', 'Mute');
      this.muteButton.setAttribute('title', 'Mute (m)');
    }
  }

  // Keyboard shortcuts
  handleKeyboardShortcut(e) {
    // Don't handle if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'k':
      case ' ':
        e.preventDefault();
        this.togglePlay();
        break;
      case 'm':
        e.preventDefault();
        this.toggleMute();
        break;
      case 'f':
        e.preventDefault();
        this.toggleFullscreen();
        break;
      case 't':
        e.preventDefault();
        this.toggleTheaterMode();
        break;
      case 'arrowleft':
        e.preventDefault();
        this.seekTo(Math.max(0, this.video.currentTime - 5));
        break;
      case 'arrowright':
        e.preventDefault();
        this.seekTo(Math.min(this.video.duration, this.video.currentTime + 5));
        break;
      case 'j':
        e.preventDefault();
        this.seekTo(Math.max(0, this.video.currentTime - 10));
        break;
      case 'l':
        e.preventDefault();
        this.seekTo(Math.min(this.video.duration, this.video.currentTime + 10));
        break;
      case '0':
      case 'home':
        e.preventDefault();
        this.seekTo(0);
        break;
      case 'end':
        e.preventDefault();
        this.seekTo(this.video.duration);
        break;
    }
  }

  // Utility methods
  formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  dispatchPlayerEvent(eventName) {
    window.dispatchEvent(new CustomEvent(`mock-youtube-player-${eventName}`, {
      detail: {
        currentTime: this.video.currentTime,
        duration: this.video.duration,
        paused: this.video.paused,
        muted: this.video.muted,
        volume: this.video.volume
      }
    }));
  }

  // Expose player API for extension compatibility
  exposePlayerAPI() {
    // Add player reference to window for testing
    window.ytPlayer = this;

    // Add methods that extension might use
    window.getVideoElement = () => this.video;
    window.getPlayerState = () => ({
      currentTime: this.video.currentTime,
      duration: this.video.duration,
      paused: this.video.paused,
      ended: this.video.ended,
      muted: this.video.muted,
      volume: this.video.volume,
      playbackRate: this.video.playbackRate,
      readyState: this.video.readyState
    });

    console.log('[Mock YouTube Player] API exposed on window.ytPlayer');
  }

  // Getters for test access
  getCurrentTime() {
    return this.video.currentTime;
  }

  getDuration() {
    return this.video.duration;
  }

  isPaused() {
    return this.video.paused;
  }

  getVolume() {
    return this.video.volume;
  }

  isMuted() {
    return this.video.muted;
  }

  getPlaybackRate() {
    return this.video.playbackRate;
  }

  setPlaybackRate(rate) {
    this.video.playbackRate = rate;
  }
}

// Initialize player when script loads
let playerInstance = null;

function initMockYouTubePlayer() {
  if (!playerInstance) {
    playerInstance = new MockYouTubePlayer();
  }
  return playerInstance;
}

// Auto-initialize
initMockYouTubePlayer();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockYouTubePlayer, initMockYouTubePlayer };
}
