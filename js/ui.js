/**
 * UI CONTROLLER & RENDERING ENGINE
 * Handles HTML injection, loading screens, toast alerts, modals, and countdown timers.
 */

const UI = {
  activeTimers: [],

  /**
   * Inject skeleton templates into card grids
   */
  showSkeletons(gridElement, count = 4) {
    if (!gridElement) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-poster"></div>
          <div class="skeleton-info">
            <div class="skeleton-text title-1"></div>
            <div class="skeleton-text title-2"></div>
            <div class="skeleton-text meta"></div>
          </div>
        </div>
      `;
    }
    gridElement.innerHTML = html;
  },

  /**
   * Helper to format ISO Date to readable format
   */
  formatDateTime(isoString) {
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleDateString('en-US', options);
  },

  /**
   * Render Match Cards based on event objects
   */
  renderCards(gridElement, eventsList, onWatchClick) {
    this.clearAllTimers();
    if (!gridElement) return;

    if (!eventsList || eventsList.length === 0) {
      gridElement.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--text-secondary);">
          <i class="fa-solid fa-circle-question" style="font-size: 40px; margin-bottom: 12px; color: var(--text-muted);"></i>
          <p style="font-size: 16px; font-weight: 500;">No matching events found</p>
        </div>
      `;
      return;
    }

    gridElement.innerHTML = '';

    eventsList.forEach(event => {
      const card = document.createElement('div');
      card.className = 'match-card';
      card.setAttribute('data-id', event.id);
      card.setAttribute('data-status', event.status.toLowerCase());

      // Badge markup
      let badgeHtml = '';
      if (event.status === 'LIVE') {
        badgeHtml = `<span class="card-badge live"><i class="fa-solid fa-circle"></i> Live</span>`;
      } else if (event.status === 'UPCOMING') {
        badgeHtml = `<span class="card-badge upcoming">Upcoming</span>`;
      } else {
        badgeHtml = `<span class="card-badge completed">Completed</span>`;
      }

      // Timing footer
      const timerId = `timer-${event.id}`;
      let footerHtml = '';
      
      if (event.status === 'LIVE') {
        footerHtml = `
          <div class="timer-box live-timer" id="${timerId}">
            <i class="fa-solid fa-circle-play"></i>
            <span class="timer-text">LIVE</span>
          </div>
        `;
      } else if (event.status === 'UPCOMING') {
        footerHtml = `
          <div class="timer-box upcoming-timer" id="${timerId}">
            <i class="fa-regular fa-clock"></i>
            <span class="timer-text">--:--:--</span>
          </div>
        `;
      } else {
        footerHtml = `
          <div class="timer-box" style="color: var(--text-muted)">
            <i class="fa-solid fa-circle-check"></i>
            <span>Full Replay</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-poster">
          ${badgeHtml}
          <img src="${event.poster}" alt="${event.title}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80';">
        </div>
        <div class="card-info">
          <h3 class="card-title">${event.title}</h3>
          <div class="card-footer">
            ${footerHtml}
            <span class="watch-action">
              ${event.status === 'COMPLETED' ? 'Watch Replay' : 'Watch Live'} 
              <i class="fa-solid fa-chevron-right"></i>
            </span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        onWatchClick(event);
      });

      gridElement.appendChild(card);

      // Start live countdown or timers
      if (event.status === 'UPCOMING') {
        this.setupUpcomingCountdown(timerId, event.startTime);
      } else if (event.status === 'LIVE') {
        this.setupLiveTimer(timerId, event.startTime);
      }
    });
  },

  /**
   * Set up relative countdown for upcoming matches
   */
  setupUpcomingCountdown(elementId, startTimeString) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const targetDate = new Date(startTimeString).getTime();

    const updateTimer = () => {
      const el = document.getElementById(elementId);
      if (!el) return;

      const now = Date.now();
      const distance = targetDate - now;

      if (distance < 0) {
        el.innerHTML = `<i class="fa-solid fa-circle-play" style="color: var(--live-color);"></i> <span class="timer-text" style="color: var(--live-color);">LIVE</span>`;
        // Refresh grid list
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      let text = '';
      if (days > 0) {
        text = `${days}d ${hours}h`;
      } else {
        text = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      const span = el.querySelector('.timer-text');
      if (span) span.innerText = text;
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    this.activeTimers.push({ id: elementId, interval });
  },

  /**
   * Set up live elapsed time stopwatch
   */
  setupLiveTimer(elementId, startTimeString) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const startDate = new Date(startTimeString).getTime();

    const updateTimer = () => {
      const el = document.getElementById(elementId);
      if (!el) return;

      const now = Date.now();
      const elapsedMs = now - startDate;

      if (elapsedMs < 0) {
        const span = el.querySelector('.timer-text');
        if (span) span.innerText = 'LIVE';
        return;
      }

      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
      
      let text = 'LIVE';
      if (elapsedMinutes > 0 && elapsedMinutes < 300) {
        text = `LIVE • ${elapsedMinutes}'`;
      }

      const span = el.querySelector('.timer-text');
      if (span) span.innerText = text;
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    this.activeTimers.push({ id: elementId, interval });
  },

  /**
   * Stop and clear all active intervals
   */
  clearAllTimers() {
    this.activeTimers.forEach(t => clearInterval(t.interval));
    this.activeTimers = [];
  },

  /**
   * Render Hero Banner Component with featured match
   */
  renderHero(heroElement, featuredEvent, onWatchClick) {
    if (!heroElement) return;

    if (!featuredEvent) {
      heroElement.style.display = 'none';
      return;
    }

    heroElement.style.display = 'flex';

    // Status badges HTML
    let badgeHtml = '';
    if (featuredEvent.status === 'LIVE') {
      badgeHtml = `
        <div class="hero-live-badge">
          <i class="fa-solid fa-circle"></i> LIVE
        </div>
      `;
    } else {
      badgeHtml = `
        <div class="hero-status-tag">
          ${featuredEvent.status}
        </div>
      `;
    }

    // Update Ambient Page Background Poster
    const bodyBg = document.getElementById('body-bg-poster');
    if (bodyBg) {
      bodyBg.style.backgroundImage = `url('${featuredEvent.poster}')`;
    }

    heroElement.innerHTML = `
      <div class="hero-bg">
        <img src="${featuredEvent.poster}" alt="${featuredEvent.title}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80';">
      </div>
      <div class="hero-overlay"></div>
      <div class="container" style="width: 100%;">
        <div class="hero-content">
          <div class="hero-badge-container">
            ${badgeHtml}
            <div class="hero-status-tag">
              <i class="fa-regular fa-calendar-days"></i> ${this.formatDateTime(featuredEvent.startTime)}
            </div>
          </div>
          <h1 class="hero-title">${featuredEvent.title}</h1>
          <p class="hero-meta">
            Experience premium delay-free bufferless streaming with multiple language channels. Available in Ultra HD.
          </p>
          <div class="hero-actions-row">
            <button class="btn btn-primary" id="hero-watch-btn">
              <i class="fa-solid fa-play"></i> Watch Now
            </button>
            <button class="btn btn-secondary" id="hero-details-btn">
              <i class="fa-solid fa-circle-info"></i> More Details
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('hero-watch-btn').addEventListener('click', () => {
      onWatchClick(featuredEvent);
    });

    document.getElementById('hero-details-btn').addEventListener('click', () => {
      onWatchClick(featuredEvent);
    });
  },

  /**
   * Display Custom Glass Modal with Channel choices
   */
  openChannelModal(eventDetailObj, onChannelSelect) {
    // Check if modal container exists, if not construct it
    let overlay = document.getElementById('channel-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'channel-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    let channelsHtml = '';
    if (eventDetailObj.highlights) {
      channelsHtml += `
        <button class="channel-btn highlights-btn" data-channel-id="highlights" style="border-color: var(--upcoming-color); background: rgba(0, 255, 135, 0.05); margin-bottom: 12px;">
          <div class="channel-btn-info">
            <i class="fa-solid fa-star" style="color: var(--upcoming-color);"></i>
            <span class="channel-name" style="font-weight: 700; color: #fff;">Match Highlights</span>
          </div>
          <span class="channel-btn-action" style="color: var(--upcoming-color);">Watch Highlights <i class="fa-solid fa-chevron-right"></i></span>
        </button>
      `;
    }

    if (eventDetailObj.channels && eventDetailObj.channels.length > 0) {
      eventDetailObj.channels.forEach(channel => {
        channelsHtml += `
          <button class="channel-btn" data-channel-id="${channel.id}">
            <div class="channel-btn-info">
              <i class="fa-solid fa-circle-nodes"></i>
              <span class="channel-name">${channel.name}</span>
            </div>
            <span class="channel-btn-action">Select Stream <i class="fa-solid fa-chevron-right"></i></span>
          </button>
        `;
      });
    } else if (!eventDetailObj.highlights) {
      channelsHtml = `
        <div style="text-align: center; padding: 20px 0; color: var(--text-secondary)">
          No live streaming links configured yet.
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">Select Channel</h2>
          <button class="modal-close" id="modal-close-btn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-event-title">${eventDetailObj.title}</p>
          <div class="channels-list-container">
            ${channelsHtml}
          </div>
        </div>
      </div>
    `;

    // Bind events
    overlay.classList.add('open');

    const closeBtn = overlay.querySelector('#modal-close-btn');
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });

    const channelButtons = overlay.querySelectorAll('.channel-btn');
    channelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const channelId = btn.getAttribute('data-channel-id');
        overlay.classList.remove('open');
        onChannelSelect(eventDetailObj.id, channelId);
      });
    });
  },

  /**
   * Display Custom Toast notification banner
   */
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') {
      iconHtml = '<i class="fa-solid fa-circle-check"></i>';
    } else if (type === 'error') {
      iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }

    toast.innerHTML = `
      ${iconHtml}
      <span>${message}</span>
    `;

    container.appendChild(toast);
    
    // Animate display
    setTimeout(() => toast.classList.add('show'), 50);

    // Fade out and remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3500);
  },

  /**
   * Render User Authentication widget in header
   */
  renderAuthWidget(containerElement, onSignOutClick) {
    if (!containerElement) return;
    
    const email = localStorage.getItem('user_email');
    
    if (email) {
      // User is logged in: render profile badge and dropdown options
      const initial = email.charAt(0).toUpperCase();
      
      containerElement.innerHTML = `
        <div class="profile-badge" id="profile-badge-btn">
          <div class="profile-avatar">${initial}</div>
          <span class="profile-email">${email}</span>
          <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-secondary)"></i>
        </div>
        
        <div class="profile-dropdown" id="profile-dropdown-menu">
          <div class="dropdown-header">Account Panel</div>
          <div class="dropdown-item" style="cursor: default; pointer-events: none;">
            <i class="fa-regular fa-envelope"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${email}</span>
          </div>
          <button class="dropdown-item signout-item" id="dropdown-signout-btn">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
          </button>
        </div>
      `;
      
      // Bind click triggers
      const badge = containerElement.querySelector('#profile-badge-btn');
      const dropdown = containerElement.querySelector('#profile-dropdown-menu');
      
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      
      document.addEventListener('click', () => {
        dropdown.classList.remove('open');
      });
      
      containerElement.querySelector('#dropdown-signout-btn').addEventListener('click', () => {
        onSignOutClick();
      });
    } else {
      // Guest: render Sign In button
      containerElement.innerHTML = `
        <button class="btn-signin" id="header-signin-btn">
          <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In
        </button>
      `;
      
      containerElement.querySelector('#header-signin-btn').addEventListener('click', () => {
        this.openSignInModal((signedInEmail) => {
          localStorage.setItem('user_email', signedInEmail);
          window.location.reload();
        });
      });
    }
  },

  /**
   * Display Glassmorphic Sign In Modal
   */
  openSignInModal(onSuccess) {
    let overlay = document.getElementById('signin-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'signin-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 400px;">
        <div class="modal-header">
          <h2 class="modal-title"><i class="fa-solid fa-circle-user" style="color: var(--accent-color);"></i> Sign In</h2>
          <button class="modal-close" id="signin-modal-close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-event-title" style="margin-bottom: 20px;">Sign in to sync your preferences and access private portals.</p>
          <form id="signin-modal-form">
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label" style="font-size: 13px;">Email Address</label>
              <input type="email" id="signin-email" class="form-control" placeholder="user@example.com" style="background: var(--bg-tertiary);" required>
            </div>
            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label" style="font-size: 13px;">Password</label>
              <input type="password" id="signin-password" class="form-control" placeholder="••••••••" style="background: var(--bg-tertiary);" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius: var(--border-radius-sm);">Sign In</button>
          </form>
        </div>
      </div>
    `;

    overlay.classList.add('open');

    // Close actions
    const closeBtn = overlay.querySelector('#signin-modal-close');
    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    const form = overlay.querySelector('#signin-modal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value.trim();

      // Check if it's the owner's email
      if (email === 'gwajay73@gmail.com') {
        if (password !== 'admin-secret-2026' && password !== 'owner123') {
          UI.showToast('Invalid password for owner email!', 'error');
          return;
        }
      }

      overlay.classList.remove('open');
      UI.showToast('Signed in successfully!', 'success');
      onSuccess(email);
    });
  }
};
