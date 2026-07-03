/**
 * API SERVICE MODULE
 * Handles network requests, caching, timeouts, and fallback parameters.
 */

// Base URL of the backend API. Change this to your deployed backend URL (e.g. 'https://your-backend.vercel.app')
const API_BASE_URL = 'https://backeeeennddddddd.onrender.com'; 

const API = {
  cache: {
    events: null,
    cacheTime: null
  },
  
  // Cache lifetime: 30 seconds
  CACHE_DURATION: 30000,

  /**
   * Fetch wrapper with timeout and AbortController support
   */
  async fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  },

  /**
   * Fetch all safe events list
   */
  async getEvents(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cache.events && this.cache.cacheTime && (now - this.cache.cacheTime < this.CACHE_DURATION)) {
      return this.cache.events;
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/events`);
      if (!response.ok) {
        throw new Error(`Failed to retrieve events: Status ${response.status}`);
      }
      const data = await response.json();
      
      // Store in memory cache
      this.cache.events = data;
      this.cache.cacheTime = now;
      return data;
    } catch (error) {
      console.error('API Error: [getEvents]', error);
      // Serve stale cache if present
      if (this.cache.events) {
        console.warn('Network issue occurred. Serving stale event cache.');
        return this.cache.events;
      }
      throw error;
    }
  },

  /**
   * Fetch safe single event details + channel metadata
   */
  async getEventDetail(id) {
    if (!id) throw new Error('Event ID is required');
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/event?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch event info: Status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error: [getEventDetail] for ${id}`, error);
      throw error;
    }
  },

  /**
   * Fetch stream parameters for a single channel (strictly limited by ID pair)
   */
  async getStreamUrl(eventId, channelId) {
    if (!eventId || !channelId) {
      throw new Error('Both eventId and channelId parameters are required');
    }
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/stream?eventId=${encodeURIComponent(eventId)}&channelId=${encodeURIComponent(channelId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stream details: Status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error: [getStreamUrl]', error);
      throw error;
    }
  }
};
