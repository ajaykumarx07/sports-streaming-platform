/**
 * STREAM PLAYER ENGINE (player.html)
 * Initializes Shaka Player (DASH + ClearKey DRM) or HLS.js (HLS/Native),
 * binding both to the Plyr UI. Implements auto-retry, overlays, share and Telegram modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const videoElement = document.getElementById('player-video');
  const loadingOverlay = document.getElementById('loading-overlay');
  const errorOverlay = document.getElementById('error-overlay');
  const errorDesc = document.getElementById('error-desc');
  const retryBtn = document.getElementById('retry-btn');
  const reconnectBanner = document.getElementById('reconnect-banner');
  const backBtn = document.getElementById('back-btn');
  
  // Details Panel elements
  const streamTitle = document.getElementById('stream-title');
  const streamBadge = document.getElementById('stream-badge');
  const streamChannelInfo = document.getElementById('stream-channel-info');
  const shareBtn = document.getElementById('share-btn');
  
  // Telegram popup elements
  const telegramPopup = document.getElementById('telegram-popup');
  const telegramClose = document.getElementById('telegram-close');
  const telegramJoin = document.getElementById('telegram-join');

  // Query Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');
  const channelId = urlParams.get('channelId');

  // State Variables
  let plyrInstance = null;
  let shakaPlayerInstance = null;
  let shakaUiInstance = null;
  let hlsInstance = null;
  let streamConfig = null;
  let eventConfig = null;
  
  let retryAttempts = 0;
  const MAX_RETRIES = 3;
  let isReconnecting = false;
  let videoErrorListenerBound = false;

  // Verify parameters
  if (!eventId || !channelId) {
    showErrorScreen('Invalid Request parameters', 'Missing eventId or channelId. Returning to homepage.');
    setTimeout(() => { window.location.href = 'index.html'; }, 4000);
    return;
  }

  // Back Button
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Share Button
  shareBtn.addEventListener('click', () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      UI.showToast('Stream link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Share error:', err);
      UI.showToast('Failed to copy link.', 'error');
    });
  });

  // Error screen retry button
  retryBtn.addEventListener('click', () => {
    retryAttempts = 0;
    errorOverlay.classList.remove('active');
    loadStreamAndPlay();
  });

  // Telegram Popup Close
  telegramClose.addEventListener('click', () => {
    telegramPopup.classList.remove('active');
  });

  telegramJoin.addEventListener('click', () => {
    window.open('https://t.me/+6H0lhRBbr702OTY1', '_blank'); // Replace with actual Telegram link
    telegramPopup.classList.remove('active');
  });

  // Triggers Telegram popup after 15 seconds of watch time
  function startTelegramTimer() {
    setTimeout(() => {
      if (telegramPopup && !errorOverlay.classList.contains('active')) {
        telegramPopup.classList.add('active');
      }
    }, 15000);
  }

  /**
   * Main setup coordinator
   */
  async function loadStreamAndPlay() {
    showLoader(true);
    await destroyPlayers();

    try {
      // 1. Fetch metadata details concurrently
      const [stream, event] = await Promise.all([
        API.getStreamUrl(eventId, channelId),
        API.getEventDetail(eventId)
      ]);

      streamConfig = stream;
      eventConfig = event;

      // 2. Render metadata info below the player
      renderMetadata();

      // 3. Attach stream engine first, then Plyr UI (Shaka/HLS must own the video before Plyr wraps it)
      const engineData = await setupStreamEngine();
      if (engineData && engineData.usePlyr) {
        initPlyrUI(engineData.qualities, engineData.onQualityChange);
      } else {
        if (!videoErrorListenerBound) {
          videoElement.addEventListener('error', onVideoElementError);
          videoErrorListenerBound = true;
        }
      }
      retryAttempts = 0;
      
      startTelegramTimer();
    } catch (err) {
      console.error('Playback setup failed:', err);
      handlePlaybackFailure(err.message || 'Network connectivity issues.');
    }
  }

  /**
   * Inject stream labels and channel indicators below viewport
   */
  function renderMetadata() {
    if (eventConfig && streamConfig) {
      streamTitle.innerText = eventConfig.title;
      
      // Update Live / Upcoming / Highlights badge
      streamBadge.className = 'stream-badge';
      streamBadge.removeAttribute('style');
      
      if (channelId === 'highlights') {
        streamBadge.classList.add('highlights');
        streamBadge.innerText = 'HIGHLIGHTS';
        streamBadge.style.backgroundColor = 'var(--upcoming-color)';
        streamBadge.style.color = 'var(--bg-primary)';
      } else if (eventConfig.status === 'LIVE') {
        streamBadge.classList.add('live');
        streamBadge.innerText = 'LIVE';
      } else {
        streamBadge.innerText = eventConfig.status;
      }

      // Channel details
      const currentChannel = eventConfig.channels ? eventConfig.channels.find(c => c.id === channelId) : null;
      const chName = channelId === 'highlights' ? 'Match Highlights' : (currentChannel ? currentChannel.name : 'Primary Channel');
      streamChannelInfo.innerText = `${chName} • ${streamConfig.type.toUpperCase()} Format`;
    }
  }

  /**
   * Initialize Plyr controls
   */
  function initPlyrUI(qualityOptions = [], onQualityChange = null) {
    if (plyrInstance) return;

    const plyrConfig = {
      controls: [
        'play-large', 'play', 'fast-forward', 'progress', 'current-time', 
        'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      settings: ['quality', 'speed'],
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true }
    };

    if (qualityOptions && qualityOptions.length > 0) {
      const defaultQuality = qualityOptions.includes(720) ? 720 : qualityOptions[0];
      plyrConfig.quality = {
        default: defaultQuality,
        options: qualityOptions,
        forced: true,
        onChange: (quality) => {
          if (onQualityChange) {
            onQualityChange(quality);
          }
        }
      };

      if (onQualityChange) {
        onQualityChange(defaultQuality);
      }
    }

    plyrInstance = new Plyr(videoElement, plyrConfig);

    // Handle native video errors after Plyr is active
    if (!videoErrorListenerBound) {
      videoElement.addEventListener('error', onVideoElementError);
      videoErrorListenerBound = true;
    }
  }

  function onVideoElementError(e) {
    console.error('HTML5 Video Error event fired:', e);
    if (!isReconnecting) {
      attemptAutoReconnect();
    }
  }

  /**
   * Stream Engine router (DASH or HLS)
   */
  async function setupStreamEngine() {
    const streamType = streamConfig.type.toLowerCase();
    const streamUrl = streamConfig.url;

    if (streamType === 'mpd') {
      return await initShakaPlayer(streamUrl, streamConfig.drm);
    } else if (streamType === 'm3u8') {
      return await initHlsPlayer(streamUrl);
    } else {
      throw new Error(`Unsupported stream format: ${streamType}`);
    }
  }

  /**
   * Normalize ClearKey hex ids for Shaka (lowercase, no dashes)
   */
  function normalizeClearKeyHex(value) {
    return String(value).replace(/-/g, '').toLowerCase();
  }

  /**
   * DASH Playback engine using Google Shaka Player
   */
  async function initShakaPlayer(url, drm) {
    if (typeof shaka === 'undefined') {
      throw new Error('Shaka Player library failed to load. Check your network connection.');
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      throw new Error('Shaka Player is not supported by this browser.');
    }

    if (!shakaPlayerInstance) {
      shakaPlayerInstance = new shaka.Player(videoElement);
    }

    const container = videoElement.parentElement;
    if (!shakaUiInstance) {
      shakaUiInstance = new shaka.ui.Overlay(shakaPlayerInstance, container, videoElement);
    }

    shakaPlayerInstance.addEventListener('error', (ev) => onShakaError(ev.detail));
    if (shakaUiInstance && shakaUiInstance.getControls()) {
      shakaUiInstance.getControls().addEventListener('error', (ev) => onShakaError(ev.detail));
    }

    shakaUiInstance.configure({
      controlPanelElements: ["play_pause", "mute", "volume", "spacer", "time_and_duration", "overflow_menu", "fullscreen"]
    });

    const clearKeys = {};
    if (drm) {
      const kid = String(drm.kid || "").toLowerCase().replace(/[^0-9a-f]/g, "");
      const key = String(drm.key || "").toLowerCase().replace(/[^0-9a-f]/g, "");
      if (kid.length === 32 && key.length === 32) {
        clearKeys[kid] = key;
      }
    }

    shakaPlayerInstance.configure({
      drm: { clearKeys },
      streaming: { bufferingGoal: 20, rebufferingGoal: 2, bufferBehind: 20 }
    });

    await shakaPlayerInstance.load(url);
    console.log('Shaka Player loaded stream successfully.');
    showLoader(false);

    try {
      videoElement.muted = false;
      await videoElement.play();
    } catch (e) {
      console.warn('Auto-play blocked by browser. User gesture needed.', e);
    }

    return {
      usePlyr: false
    };
  }

  /**
   * Shaka error callback
   */
  function onShakaError(event) {
    const error = event.detail || event;
    console.error('Shaka Player Error:', error.code, error.message, error);

    const networkCodes = new Set([1001, 1002, 1003, 3014, 3016]);
    if (networkCodes.has(error.code)) {
      attemptAutoReconnect();
    } else {
      handlePlaybackFailure(error.message || `Shaka playback error (${error.code})`);
    }
  }

  /**
   * HLS Playback engine using HLS.js or native HTML5
   */
  function initHlsPlayer(url) {
    return new Promise((resolve, reject) => {
      // 1. Browser supports native HLS (Safari/iOS)
      if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Using native Safari HLS engine.');
        const onReady = () => {
          videoElement.removeEventListener('loadedmetadata', onReady);
          showLoader(false);
          videoElement.play().catch(err => {
            console.warn('Native Autoplay blocked:', err);
          });
          resolve({
            usePlyr: true,
            qualities: [],
            onQualityChange: () => {}
          });
        };
        videoElement.addEventListener('loadedmetadata', onReady);
        videoElement.addEventListener('error', () => {
          reject(new Error('Native HLS playback failed.'));
        }, { once: true });
        videoElement.src = url;
        return;
      }

      // 2. Browser supports MSE (Chrome, Firefox, Edge, etc.) - use Hls.js
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        console.log('Initializing HLS.js playback engine.');
        hlsInstance = new Hls({
          maxMaxBufferLength: 15,
          backBufferLength: 10,
          lowLatencyMode: true
        });

        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(videoElement);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          showLoader(false);
          videoElement.play().catch(err => {
            console.warn('HLS.js Autoplay blocked:', err);
          });
          
          const levels = hlsInstance.levels;
          const heights = Array.from(new Set(levels.map(l => l.height))).filter(Boolean).sort((a, b) => b - a);

          resolve({
            usePlyr: true,
            qualities: heights,
            onQualityChange: (quality) => {
              const targetHeight = Number(quality);
              const levelIndex = levels.findIndex(l => l.height === targetHeight);
              if (levelIndex !== -1) {
                hlsInstance.currentLevel = levelIndex;
              }
            }
          });
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS.js error event:', data.type, data.details, data.fatal);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('HLS Network error. Attempting recovery...');
                hlsInstance.startLoad();
                attemptAutoReconnect();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('HLS Media error. Attempting recovery...');
                hlsInstance.recoverMediaError();
                break;
              default:
                reject(new Error(`HLS fatal error: ${data.details}`));
                break;
            }
          }
        });
        return;
      }

      reject(new Error('HLS is not supported on this browser.'));
    });
  }

  /**
   * Auto reconnect loop with exponential backoff
   */
  function attemptAutoReconnect() {
    if (retryAttempts >= MAX_RETRIES) {
      handlePlaybackFailure('Network failure. Maximum reconnect attempts reached.');
      return;
    }

    isReconnecting = true;
    retryAttempts++;
    
    // Show reconnect overlay banner
    reconnectBanner.classList.add('show');
    
    const delay = Math.pow(2, retryAttempts) * 1000;
    console.log(`Retrying playback connection (Attempt ${retryAttempts}/${MAX_RETRIES}) in ${delay}ms...`);
    
    UI.showToast(`Network interrupted. Reconnecting (Attempt ${retryAttempts}/${MAX_RETRIES})...`, 'error');

    setTimeout(() => {
      reconnectBanner.classList.remove('show');
      isReconnecting = false;
      loadStreamAndPlay();
    }, delay);
  }

  /**
   * Handle complete failures
   */
  async function handlePlaybackFailure(msg) {
    await destroyPlayers();
    showLoader(false);
    showErrorScreen('Playback Error', msg);
  }

  /**
   * Clean up players on page transitions or restarts
   */
  async function destroyPlayers() {
    if (videoErrorListenerBound) {
      videoElement.removeEventListener('error', onVideoElementError);
      videoErrorListenerBound = false;
    }
    if (shakaUiInstance) {
      try {
        await shakaUiInstance.destroy();
      } catch (err) {
        console.warn('Shaka UI destroy warning:', err);
      }
      shakaUiInstance = null;
    }
    if (shakaPlayerInstance) {
      try {
        await shakaPlayerInstance.destroy();
      } catch (err) {
        console.warn('Shaka destroy warning:', err);
      }
      shakaPlayerInstance = null;
    }
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    if (plyrInstance) {
      plyrInstance.destroy();
      plyrInstance = null;
    }
    videoElement.removeAttribute('src');
    videoElement.load();
  }

  /**
   * Toggle Loader Screen
   */
  function showLoader(show) {
    if (show) {
      loadingOverlay.classList.add('active');
    } else {
      loadingOverlay.classList.remove('active');
    }
  }

  /**
   * Trigger Error Screen
   */
  function showErrorScreen(title, details) {
    errorOverlay.classList.add('active');
    errorDesc.innerHTML = `<strong>${title}</strong><br>${details}`;
    UI.showToast(title, 'error');
  }

  // Launch initial playback loop
  loadStreamAndPlay();
});
