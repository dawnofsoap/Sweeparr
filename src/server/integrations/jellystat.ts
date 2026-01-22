import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

// Convert technical errors to user-friendly messages
function formatConnectionError(error: any, url: string): string {
  if (error.code === 'ENOTFOUND') {
    const hostname = new URL(url).hostname;
    return `Unable to resolve hostname "${hostname}". Please check the URL is correct and the server is accessible.`;
  }
  if (error.code === 'ECONNREFUSED') {
    return `Connection refused. Please verify Jellystat is running and the port is correct.`;
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
    return `Connection timed out. Jellystat may be unreachable or responding slowly.`;
  }
  if (error.code === 'ECONNRESET') {
    return `Connection was reset. Jellystat may have closed the connection unexpectedly.`;
  }
  if (error.response?.status === 401) {
    return `Authentication failed. Please check your API key is correct.`;
  }
  if (error.response?.status === 403) {
    return `Access forbidden. The API key may not have sufficient permissions.`;
  }
  if (error.response?.status === 404) {
    return `Endpoint not found. Please verify the Jellystat URL is correct.`;
  }
  if (error.response?.status >= 500) {
    return `Server error (${error.response.status}). Jellystat may be experiencing issues.`;
  }
  if (error.message?.includes('timeout')) {
    return `Request timed out. Jellystat may be slow or unreachable.`;
  }
  
  return error.message || 'Connection failed for an unknown reason.';
}

// ============================================
// Configuration
// ============================================

export interface JellystatConfig {
  url: string;
  apiKey: string;
}

// ============================================
// API Response Types
// ============================================

export interface JellystatLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
  archived?: boolean;
}

export interface JellystatLibraryItem {
  Id: string;
  Name: string;
  ParentId?: string;
  Type: string;
  ProductionYear?: number;
  Archived?: boolean;
}

export interface JellystatPlaybackHistory {
  UserName: string;
  NowPlayingItemName: string;
  PlaybackDuration: number;
  ActivityDateInserted: string;
}

export interface JellystatItemHistory {
  results: JellystatPlaybackHistory[];
  totalCount?: number;
}

export interface JellystatItemHistoryParams {
  size?: number;
  page?: number;
  search?: string;
  sort?: string;
  desc?: boolean;
  filters?: string;
}

export interface JellystatLastPlayedInfo {
  ItemID: string;
  ItemName: string;
  ItemType: string;
  LastPlayed?: string;
  LastUser?: string;
  PlayCount: number;
  TotalRuntime?: number;
}

export interface JellystatUser {
  Id: string;
  Name: string;
  IsAdministrator?: boolean;
  LastActivityDate?: string;
}

export interface JellystatStats {
  totalPlays?: number;
  totalPlaytime?: number;
  uniqueUsers?: number;
  lastActivityDate?: string;
}

export interface JellystatGlobalStats {
  TotalWatchTime: number;
  TotalPlays: number;
  UniqueViewers: number;
  Movies?: {
    TotalPlays: number;
    TotalWatchTime: number;
  };
  Series?: {
    TotalPlays: number;
    TotalWatchTime: number;
  };
}

// ============================================
// Jellystat Client
// ============================================

export class JellystatClient {
  private client: AxiosInstance;
  private config: JellystatConfig;

  constructor(config: JellystatConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url.replace(/\/$/, ''),
      headers: {
        'x-api-token': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ============================================
  // Connection Testing
  // ============================================

  /**
   * Test the connection to Jellystat
   */
  async testConnection(): Promise<{ success: boolean; message: string; stats?: JellystatGlobalStats }> {
    try {
      // Jellystat doesn't have a dedicated system info endpoint,
      // so we test by fetching library metadata which requires auth
      const response = await this.client.get('/api/getLibraries');
      
      logger.info(`Connected to Jellystat at ${this.config.url}`);
      return {
        success: true,
        message: `Connected to Jellystat (${response.data?.length || 0} libraries found)`,
      };
    } catch (error: any) {
      const friendlyMessage = formatConnectionError(error, this.config.url);
      logger.error(`Jellystat connection failed: ${friendlyMessage}`);
      return {
        success: false,
        message: friendlyMessage,
      };
    }
  }

  // ============================================
  // Libraries
  // ============================================

  /**
   * Get all libraries from Jellystat
   */
  async getLibraries(): Promise<JellystatLibrary[]> {
    try {
      const response = await this.client.get('/api/getLibraries');
      return response.data || [];
    } catch (error: any) {
      logger.error(`Failed to get Jellystat libraries: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get items in a specific library
   */
  async getLibraryItems(libraryId: string): Promise<JellystatLibraryItem[]> {
    try {
      const response = await this.client.post('/api/getLibraryItems', {
        libraryid: libraryId,
      });
      return response.data || [];
    } catch (error: any) {
      logger.error(`Failed to get library items from Jellystat: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Playback History
  // ============================================

  /**
   * Get global playback history
   */
  async getHistory(params?: JellystatItemHistoryParams): Promise<JellystatItemHistory> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sort) queryParams.append('sort', params.sort);
      if (params?.desc !== undefined) queryParams.append('desc', params.desc.toString());
      if (params?.filters) queryParams.append('filters', params.filters);

      const url = `/api/getHistory${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.client.get(url);
      return {
        results: response.data?.results || response.data || [],
        totalCount: response.data?.totalCount,
      };
    } catch (error: any) {
      logger.error(`Failed to get Jellystat history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get playback history for a specific item
   */
  async getItemHistory(itemId: string, params?: JellystatItemHistoryParams): Promise<JellystatItemHistory> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sort) queryParams.append('sort', params.sort);
      if (params?.desc !== undefined) queryParams.append('desc', params.desc.toString());

      const url = `/api/getItemHistory${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.client.post(url, {
        itemid: itemId,
      });
      return {
        results: response.data?.results || response.data || [],
        totalCount: response.data?.totalCount,
      };
    } catch (error: any) {
      logger.error(`Failed to get item history from Jellystat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get playback history for a specific library
   */
  async getLibraryHistory(libraryId: string, params?: JellystatItemHistoryParams): Promise<JellystatItemHistory> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sort) queryParams.append('sort', params.sort);
      if (params?.desc !== undefined) queryParams.append('desc', params.desc.toString());

      const url = `/api/getLibraryHistory${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.client.post(url, {
        libraryid: libraryId,
      });
      return {
        results: response.data?.results || response.data || [],
        totalCount: response.data?.totalCount,
      };
    } catch (error: any) {
      logger.error(`Failed to get library history from Jellystat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get playback history for a specific user
   */
  async getUserHistory(userId: string, params?: JellystatItemHistoryParams): Promise<JellystatItemHistory> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.size) queryParams.append('size', params.size.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sort) queryParams.append('sort', params.sort);
      if (params?.desc !== undefined) queryParams.append('desc', params.desc.toString());

      const url = `/api/getUserHistory${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await this.client.post(url, {
        userid: userId,
      });
      return {
        results: response.data?.results || response.data || [],
        totalCount: response.data?.totalCount,
      };
    } catch (error: any) {
      logger.error(`Failed to get user history from Jellystat: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Last Played Information
  // ============================================

  /**
   * Get last played information for an item
   * This is crucial for Sweeparr to determine when media was last watched
   */
  async getLastPlayed(itemId: string): Promise<JellystatLastPlayedInfo | null> {
    try {
      // Get item history sorted by date descending to find last play
      const history = await this.getItemHistory(itemId, {
        size: 1,
        sort: 'ActivityDateInserted',
        desc: true,
      });

      if (!history.results || history.results.length === 0) {
        return null;
      }

      const lastPlay = history.results[0];
      
      // Get all history to calculate play count and total runtime
      const fullHistory = await this.getItemHistory(itemId, {
        size: 1000, // Get a large batch
      });

      const playCount = fullHistory.results?.length || 0;
      const totalRuntime = fullHistory.results?.reduce(
        (sum, h) => sum + (h.PlaybackDuration || 0),
        0
      ) || 0;

      return {
        ItemID: itemId,
        ItemName: lastPlay.NowPlayingItemName,
        ItemType: 'unknown', // Jellystat doesn't provide type in history
        LastPlayed: lastPlay.ActivityDateInserted,
        LastUser: lastPlay.UserName,
        PlayCount: playCount,
        TotalRuntime: totalRuntime,
      };
    } catch (error: any) {
      logger.error(`Failed to get last played info from Jellystat: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if an item has been played
   */
  async hasBeenPlayed(itemId: string): Promise<boolean> {
    try {
      const history = await this.getItemHistory(itemId, { size: 1 });
      return (history.results?.length || 0) > 0;
    } catch (error: any) {
      logger.error(`Failed to check if item was played: ${error.message}`);
      return false;
    }
  }

  /**
   * Get items that haven't been played since a specific date
   * Useful for cleanup rules based on watch activity
   */
  async getItemsNotPlayedSince(
    libraryId: string,
    sinceDate: Date
  ): Promise<JellystatLibraryItem[]> {
    try {
      // Get all items in the library
      const items = await this.getLibraryItems(libraryId);
      const unwatchedItems: JellystatLibraryItem[] = [];

      // Check each item's last played date
      for (const item of items) {
        const lastPlayed = await this.getLastPlayed(item.Id);
        
        if (!lastPlayed || !lastPlayed.LastPlayed) {
          // Never played
          unwatchedItems.push(item);
        } else {
          const lastPlayedDate = new Date(lastPlayed.LastPlayed);
          if (lastPlayedDate < sinceDate) {
            unwatchedItems.push(item);
          }
        }
      }

      return unwatchedItems;
    } catch (error: any) {
      logger.error(`Failed to get unwatched items from Jellystat: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get statistics for an item
   */
  async getItemStats(itemId: string): Promise<JellystatStats> {
    try {
      const history = await this.getItemHistory(itemId, { size: 10000 });
      const results = history.results || [];
      
      const uniqueUsers = new Set(results.map(h => h.UserName)).size;
      const totalPlays = results.length;
      const totalPlaytime = results.reduce((sum, h) => sum + (h.PlaybackDuration || 0), 0);
      
      const lastActivity = results.length > 0
        ? results.reduce((latest, h) => {
            const date = new Date(h.ActivityDateInserted);
            return date > new Date(latest) ? h.ActivityDateInserted : latest;
          }, results[0].ActivityDateInserted)
        : undefined;

      return {
        totalPlays,
        totalPlaytime,
        uniqueUsers,
        lastActivityDate: lastActivity,
      };
    } catch (error: any) {
      logger.error(`Failed to get item stats from Jellystat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get global statistics from Jellystat
   */
  async getGlobalStats(days: number = 30): Promise<JellystatGlobalStats | null> {
    try {
      // This endpoint may vary based on Jellystat version
      const response = await this.client.get('/api/getGlobalStats', {
        params: { days },
      });
      return response.data;
    } catch (error: any) {
      // Some Jellystat versions may not have this endpoint
      logger.warn(`Failed to get global stats from Jellystat: ${error.message}`);
      return null;
    }
  }

  // ============================================
  // Users
  // ============================================

  /**
   * Get all users from Jellystat
   */
  async getUsers(): Promise<JellystatUser[]> {
    try {
      const response = await this.client.get('/api/getUsers');
      return response.data || [];
    } catch (error: any) {
      logger.error(`Failed to get users from Jellystat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user activity stats
   */
  async getUserStats(userId: string): Promise<JellystatStats> {
    try {
      const history = await this.getUserHistory(userId, { size: 10000 });
      const results = history.results || [];
      
      const totalPlays = results.length;
      const totalPlaytime = results.reduce((sum, h) => sum + (h.PlaybackDuration || 0), 0);
      
      const lastActivity = results.length > 0
        ? results.reduce((latest, h) => {
            const date = new Date(h.ActivityDateInserted);
            return date > new Date(latest) ? h.ActivityDateInserted : latest;
          }, results[0].ActivityDateInserted)
        : undefined;

      return {
        totalPlays,
        totalPlaytime,
        uniqueUsers: 1,
        lastActivityDate: lastActivity,
      };
    } catch (error: any) {
      logger.error(`Failed to get user stats from Jellystat: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // Utility Methods for Sweeparr Integration
  // ============================================

  /**
   * Get days since item was last played
   * Returns null if never played
   */
  async getDaysSinceLastPlayed(itemId: string): Promise<number | null> {
    const lastPlayed = await this.getLastPlayed(itemId);
    
    if (!lastPlayed || !lastPlayed.LastPlayed) {
      return null;
    }

    const lastPlayedDate = new Date(lastPlayed.LastPlayed);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastPlayedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Batch check multiple items for last played dates
   * More efficient than checking one by one
   */
  async batchGetLastPlayed(
    itemIds: string[]
  ): Promise<Map<string, JellystatLastPlayedInfo | null>> {
    const results = new Map<string, JellystatLastPlayedInfo | null>();
    
    // Process in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < itemIds.length; i += concurrency) {
      const batch = itemIds.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(id => this.getLastPlayed(id))
      );
      
      batch.forEach((id, index) => {
        results.set(id, batchResults[index]);
      });
    }

    return results;
  }
}

export default JellystatClient;
