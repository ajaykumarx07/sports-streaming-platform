/**
 * ADMIN CONSOLE CONTROLLER (admin.html)
 * Manages token state, sidebar listings, editor loading, dynamic additions, and CRUD requests.
 */

// Base URL of the backend API. Change this to your deployed backend URL (e.g. 'https://your-backend.vercel.app')
const API_BASE_URL = '';

// Strict Owner Authentication Redirection Guard
if (localStorage.getItem('user_email') !== 'gwajay73@gmail.com') {
  window.location.replace('index.html');
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const eventsListContainer = document.getElementById('events-list-container');
  const eventEditorForm = document.getElementById('event-editor-form');
  const tokenInput = document.getElementById('auth-token-input');
  
  const formActionTitle = document.getElementById('form-action-title');
  const eventDbId = document.getElementById('event-db-id');
  const eventTitle = document.getElementById('event-title');
  const eventIdSlug = document.getElementById('event-id-slug');
  const eventStatus = document.getElementById('event-status');
  const eventPoster = document.getElementById('event-poster');
  const eventStartTime = document.getElementById('event-starttime');
  
  const streamsContainer = document.getElementById('streams-container');
  const addStreamBtn = document.getElementById('add-stream-btn');
  const deleteEventBtn = document.getElementById('delete-event-btn');
  const newEventBtn = document.getElementById('new-event-btn');
  
  const highlightsGroup = document.getElementById('highlights-group');
  const eventHighlights = document.getElementById('event-highlights');

  let dbEvents = {};
  
  // Set default token if stored, or fallback to default
  tokenInput.value = localStorage.getItem('elite_admin_token') || 'admin-secret-2026';
  
  tokenInput.addEventListener('change', () => {
    localStorage.setItem('elite_admin_token', tokenInput.value);
    loadDb();
  });

  // Toggle Highlights Field on Status Change
  eventStatus.addEventListener('change', () => {
    if (eventStatus.value === 'COMPLETED') {
      highlightsGroup.style.display = 'block';
    } else {
      highlightsGroup.style.display = 'none';
      eventHighlights.value = '';
    }
  });

  /**
   * Fetch entire database (requires auth header credentials)
   */
  async function loadDb() {
    const token = tokenInput.value.trim();
    if (!token) {
      eventsListContainer.innerHTML = '<p style="color: var(--text-secondary); text-align:center; font-size:13px;">Enter admin token to load data.</p>';
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin`, {
        headers: {
          'x-admin-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Unauthorized: Invalid credentials token.' : `Server Error: ${response.status}`);
      }
      
      dbEvents = await response.json();
      renderSidebarList();
    } catch (err) {
      console.error(err);
      eventsListContainer.innerHTML = `<p style="color: var(--live-color); text-align:center; font-size:13px;">${err.message}</p>`;
      UI.showToast(err.message, 'error');
    }
  }

  /**
   * Inject sidebar event selector items
   */
  function renderSidebarList() {
    eventsListContainer.innerHTML = '';
    const keys = Object.keys(dbEvents);
    
    if (keys.length === 0) {
      eventsListContainer.innerHTML = '<p style="color: var(--text-muted); text-align:center; font-size: 13px;">No events in database.</p>';
      return;
    }
    
    keys.forEach(key => {
      const e = dbEvents[key];
      const item = document.createElement('div');
      item.className = 'event-item';
      
      let statusColor = 'var(--text-secondary)';
      if (e.status === 'LIVE') statusColor = 'var(--live-color)';
      else if (e.status === 'UPCOMING') statusColor = 'var(--upcoming-color)';
      
      item.innerHTML = `
        <span class="event-item-name">${e.title}</span>
        <span class="event-item-status" style="background: rgba(255,255,255,0.05); color: ${statusColor};">${e.status}</span>
      `;
      
      item.addEventListener('click', () => {
        document.querySelectorAll('.event-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        populateEditor(key, e);
      });
      
      eventsListContainer.appendChild(item);
    });
  }

  /**
   * Render edit fields for an existing event
   */
  function populateEditor(id, data) {
    formActionTitle.innerText = 'Edit Event Configuration';
    eventDbId.value = id;
    eventIdSlug.value = id;
    eventIdSlug.disabled = true; // Protect key slug
    
    eventTitle.value = data.title;
    eventStatus.value = data.status;
    eventPoster.value = data.poster;

    if (data.status === 'COMPLETED') {
      highlightsGroup.style.display = 'block';
      eventHighlights.value = data.highlights || '';
    } else {
      highlightsGroup.style.display = 'none';
      eventHighlights.value = '';
    }
    
    // Format timestamp to HTML5 datetime-local compatible string
    if (data.startTime) {
      const date = new Date(data.startTime);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
      eventStartTime.value = localISOTime;
    } else {
      eventStartTime.value = '';
    }
    
    streamsContainer.innerHTML = '';
    if (data.streams && data.streams.length > 0) {
      data.streams.forEach(stream => {
        addStreamBlock(stream);
      });
    }
    
    deleteEventBtn.style.display = 'block';
  }

  /**
   * Reset editor fields back to defaults for creating a new event
   */
  function resetEditor() {
    formActionTitle.innerText = 'Create New Event';
    eventEditorForm.reset();
    eventDbId.value = '';
    eventIdSlug.value = '';
    eventIdSlug.disabled = false;
    streamsContainer.innerHTML = '';
    deleteEventBtn.style.display = 'none';
    document.querySelectorAll('.event-item').forEach(el => el.classList.remove('active'));
    
    highlightsGroup.style.display = 'none';
    eventHighlights.value = '';
    
    // Load one stream block by default for convenience
    addStreamBlock();
  }

  newEventBtn.addEventListener('click', resetEditor);

  /**
   * Add a channel stream dynamic configuration block
   */
  function addStreamBlock(data = null) {
    const block = document.createElement('div');
    block.className = 'stream-block';
    
    const channelId = data ? data.channelId : '';
    const name = data ? data.name : '';
    const type = data ? data.type : 'mpd';
    const url = data ? data.url : '';
    
    const hasDrm = !!(data && data.drm);
    const kid = (data && data.drm) ? data.drm.kid : '';
    const key = (data && data.drm) ? data.drm.key : '';

    block.innerHTML = `
      <span class="remove-stream-btn" title="Remove Channel"><i class="fa-solid fa-trash-can"></i></span>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Channel ID Slug</label>
          <input type="text" class="form-control stream-channel-id" value="${channelId}" placeholder="e.g. en, hin" required>
        </div>
        <div class="form-group">
          <label class="form-label">Channel Label Name</label>
          <input type="text" class="form-control stream-name" value="${name}" placeholder="e.g. English HD" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Stream Format Type</label>
          <select class="form-control stream-type" required>
            <option value="mpd" ${type === 'mpd' ? 'selected' : ''}>MPEG-DASH (.mpd)</option>
            <option value="m3u8" ${type === 'm3u8' ? 'selected' : ''}>HLS (.m3u8)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Stream Playback URL</label>
          <input type="url" class="form-control stream-url" value="${url}" placeholder="https://domain.com/path/manifest.mpd" required>
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" class="stream-drm-toggle" ${hasDrm ? 'checked' : ''}>
          <span>Configure ClearKey DRM protection</span>
        </label>
      </div>
      <div class="drm-fields ${hasDrm ? 'active' : ''}">
        <div class="form-group">
          <label class="form-label">DRM Key ID (KID)</label>
          <input type="text" class="form-control stream-drm-kid" value="${kid}" placeholder="32-char hex KID">
        </div>
        <div class="form-group">
          <label class="form-label">DRM Content Key</label>
          <input type="text" class="form-control stream-drm-key" value="${key}" placeholder="32-char hex Key">
        </div>
      </div>
    `;

    // Remove block event listener
    block.querySelector('.remove-stream-btn').addEventListener('click', () => {
      block.remove();
    });

    // Toggle DRM Fields
    const drmToggle = block.querySelector('.stream-drm-toggle');
    const drmFields = block.querySelector('.drm-fields');
    
    const toggleDrmRequirements = () => {
      const kidInput = block.querySelector('.stream-drm-kid');
      const keyInput = block.querySelector('.stream-drm-key');
      if (drmToggle.checked && !drmToggle.disabled) {
        drmFields.classList.add('active');
        kidInput.required = true;
        keyInput.required = true;
      } else {
        drmFields.classList.remove('active');
        kidInput.required = false;
        keyInput.required = false;
      }
    };

    drmToggle.addEventListener('change', toggleDrmRequirements);

    // Format type listener (HLS doesn't use EME ClearKey config in our frontend)
    const typeSelect = block.querySelector('.stream-type');
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'm3u8') {
        drmToggle.checked = false;
        drmToggle.disabled = true;
      } else {
        drmToggle.disabled = false;
      }
      toggleDrmRequirements();
    });
    
    if (type === 'm3u8') {
      drmToggle.disabled = true;
    }

    streamsContainer.appendChild(block);
  }

  addStreamBtn.addEventListener('click', () => addStreamBlock());

  // Form Submit Action
  eventEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = tokenInput.value.trim();
    if (!token) {
      UI.showToast('Access secret token is required!', 'error');
      return;
    }

    const id = eventIdSlug.value.trim().toLowerCase();
    if (!id) {
      UI.showToast('Event ID Slug is required!', 'error');
      return;
    }
    
    const streamsList = [];
    const streamBlocks = streamsContainer.querySelectorAll('.stream-block');
    
    if (streamBlocks.length === 0) {
      UI.showToast('At least one streaming channel must be added!', 'error');
      return;
    }

    let streamsValid = true;
    streamBlocks.forEach(block => {
      const channelId = block.querySelector('.stream-channel-id').value.trim();
      const name = block.querySelector('.stream-name').value.trim();
      const type = block.querySelector('.stream-type').value;
      const url = block.querySelector('.stream-url').value.trim();
      const drmChecked = block.querySelector('.stream-drm-toggle').checked;
      
      const streamObj = { channelId, name, type, url };
      
      if (drmChecked) {
        const kid = block.querySelector('.stream-drm-kid').value.trim();
        const key = block.querySelector('.stream-drm-key').value.trim();
        if (!kid || !key) {
          streamsValid = false;
        } else {
          streamObj.drm = { kid, key };
        }
      }
      
      streamsList.push(streamObj);
    });

    if (!streamsValid) {
      UI.showToast('Please specify DRM KID and Key values.', 'error');
      return;
    }

    const dateInput = eventStartTime.value;
    const isoDateString = new Date(dateInput).toISOString();

    const payload = {
      id: id,
      eventData: {
        title: eventTitle.value.trim(),
        poster: eventPoster.value.trim(),
        status: eventStatus.value,
        startTime: isoDateString,
        streams: streamsList,
        highlights: eventStatus.value === 'COMPLETED' ? eventHighlights.value.trim() : ''
      }
    };

    try {
      UI.showToast('Saving details...', 'info');
      const response = await fetch(`${API_BASE_URL}/api/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save event parameters.');
      }

      UI.showToast('Stream config saved successfully!', 'success');
      await loadDb();
      resetEditor();
    } catch (err) {
      console.error(err);
      UI.showToast(err.message, 'error');
    }
  });

  // Delete event action
  deleteEventBtn.addEventListener('click', async () => {
    const id = eventDbId.value;
    const token = tokenInput.value.trim();
    
    if (!id) return;
    
    if (!confirm(`Are you sure you want to delete event "${id}"? This cannot be undone.`)) {
      return;
    }

    try {
      UI.showToast('Deleting match...', 'info');
      const response = await fetch(`${API_BASE_URL}/api/admin?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': token
        }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete event.');
      }

      UI.showToast('Event removed from database.', 'success');
      await loadDb();
      resetEditor();
    } catch (err) {
      console.error(err);
      UI.showToast(err.message, 'error');
    }
  });

  // Seed db initially
  loadDb();
  resetEditor();
});
