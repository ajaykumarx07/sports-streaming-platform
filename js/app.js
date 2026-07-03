/**
 * MAIN APP CONTROLLER (index.html)
 * Coordinates data fetches, search queries, filter states, and click event callbacks.
 */

document.addEventListener('DOMContentLoaded', () => {
  const cardsGrid = document.getElementById('cards-grid');
  const heroSection = document.getElementById('hero-section');
  const searchInput = document.getElementById('search-input');
  const filterChips = document.querySelectorAll('.filter-chip');
  
  // Authenticated Owner Checks
  const userAuthContainer = document.getElementById('user-auth-container');
  const navAdminLink = document.getElementById('nav-admin-link');
  const headerAdminBtn = document.getElementById('header-admin-btn');

  // Render auth state widget
  UI.renderAuthWidget(userAuthContainer, () => {
    localStorage.removeItem('user_email');
    window.location.reload();
  });

  // Toggle admin console visibility exclusively for the owner
  const userEmail = localStorage.getItem('user_email');
  if (userEmail === 'gwajay73@gmail.com') {
    if (navAdminLink) navAdminLink.style.display = 'block';
    if (headerAdminBtn) headerAdminBtn.style.display = 'flex';
  } else {
    if (navAdminLink) navAdminLink.style.display = 'none';
    if (headerAdminBtn) headerAdminBtn.style.display = 'none';
  }

  let allEvents = [];
  let activeFilter = 'all';
  let searchQuery = '';

  // Show skeleton loaders during initialization
  UI.showSkeletons(cardsGrid, 6);

  // Debounced Search Input Handler
  let searchDebounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
      }, 250);
    });
  }

  // Bind Chip Filters
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      filterAndRender();
    });
  });

  /**
   * Action when watch button is clicked. Gets detailed event and shows channel picker.
   */
  const handleWatchClick = async (event) => {
    try {
      UI.showToast('Fetching channels...', 'info');
      const eventDetails = await API.getEventDetail(event.id);
      
      UI.openChannelModal(eventDetails, (eventId, channelId) => {
        window.location.href = `player.html?eventId=${encodeURIComponent(eventId)}&channelId=${encodeURIComponent(channelId)}`;
      });
    } catch (err) {
      console.error(err);
      UI.showToast('Failed to load channel list. Please check your internet connection.', 'error');
    }
  };

  /**
   * Filter in-memory database items and call UI renderer
   */
  function filterAndRender() {
    let filtered = allEvents;

    // 1. Apply category filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(e => e.status.toLowerCase() === activeFilter);
    }

    // 2. Apply search text filter
    if (searchQuery) {
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(searchQuery) || 
        e.status.toLowerCase().includes(searchQuery)
      );
    }

    UI.renderCards(cardsGrid, filtered, handleWatchClick);
  }

  /**
   * Initial page load and setup
   */
  async function init() {
    try {
      allEvents = await API.getEvents();
      
      // Elect featured event for hero component
      // Priority: LIVE -> UPCOMING -> COMPLETED
      let featured = allEvents.find(e => e.status === 'LIVE');
      if (!featured) featured = allEvents.find(e => e.status === 'UPCOMING');
      if (!featured) featured = allEvents[0];

      UI.renderHero(heroSection, featured, handleWatchClick);
      filterAndRender();
    } catch (error) {
      console.error('App initialization error:', error);
      if (cardsGrid) {
        cardsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--live-color);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 50px; margin-bottom: 20px;"></i>
            <h3 style="font-size: 22px; margin-bottom: 10px; color: white;">Connection Interrupted</h3>
            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 24px auto; font-size: 14px;">
              Could not communicate with the stream scheduler database. Check your network adapter.
            </p>
            <button class="btn btn-primary" id="retry-init-btn" style="padding: 10px 24px; font-size: 14px;">
              <i class="fa-solid fa-arrow-rotate-right"></i> Retry Connection
            </button>
          </div>
        `;
        document.getElementById('retry-init-btn')?.addEventListener('click', () => {
          UI.showSkeletons(cardsGrid, 6);
          init();
        });
      }
    }
  }

  // Run initial loading
  init();
});
