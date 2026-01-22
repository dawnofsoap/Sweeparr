import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger.js';

// Convert technical errors to user-friendly messages
function formatConnectionError(error: any, url: string): string {
  if (error.code === 'ENOTFOUND') {
    const hostname = new URL(url).hostname;
    return `Unable to resolve hostname "${hostname}". Please check the URL is correct and the server is accessible.`;
  }
  if (error.code === 'ECONNREFUSED') {
    return `Connection refused. Please verify the server is running and the port is correct.`;
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
    return `Connection timed out. The server may be unreachable or responding slowly.`;
  }
  if (error.code === 'ECONNRESET') {
    return `Connection was reset. The server may have closed the connection unexpectedly.`;
  }
  if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return `SSL certificate error. The server's certificate may be invalid or expired.`;
  }
  if (error.response?.status === 401) {
    return `Authentication failed. Please check your API key is correct.`;
  }
  if (error.response?.status === 403) {
    return `Access forbidden. The API key may not have sufficient permissions.`;
  }
  if (error.response?.status === 404) {
    return `Server endpoint not found. Please verify the URL is correct.`;
  }
  if (error.response?.status >= 500) {
    return `Server error (${error.response.status}). The media server may be experiencing issues.`;
  }
  if (error.message?.includes('timeout')) {
    return `Request timed out. The server may be slow or unreachable.`;
  }
  
  return error.message || 'Connection failed for an unknown reason.';
}

export interface JellyfinConfig {
  url: string;
  apiKey: string;
}

export interface JellyfinLibrary {
  Id: string;
  Name: string;
  CollectionType: string;
  ItemCount: number;
}

export interface JellyfinMediaItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  PremiereDate?: string;
  DateCreated?: string;
  Path?: string;
  RunTimeTicks?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  Studios?: { Name: string }[];
  People?: { Name: string; Role: string; Type: string }[];
  UserData?: {
    PlayCount: number;
    IsFavorite: boolean;
    Played: boolean;
    LastPlayedDate?: string;
    PlaybackPositionTicks?: number;
  };
  MediaSources?: {
    Id: string;
    Path: string;
    Size: number;
    Bitrate: number;
    Container: string;
    MediaStreams: {
      Type: string;
      Codec: string;
      Width?: number;
      Height?: number;
    }[];
  }[];
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin: boolean;
}

export interface JellyfinSystemInfo {
  ServerName: string;
  Version: string;
  Id: string;
  OperatingSystem: string;
  HasUpdateAvailable: boolean;
}

export class JellyfinClient {
  private client: AxiosInstance;
  private config: JellyfinConfig;

  constructor(config: JellyfinConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url.replace(/\/$/, ''),
      headers: {
        'X-Emby-Token': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ============================================
  // Connection & System
  // ============================================

  async testConnection(): Promise<{ success: boolean; message: string; serverInfo?: JellyfinSystemInfo }> {
    try {
      const response = await this.client.get<JellyfinSystemInfo>('/System/Info');
      logger.info(`Connected to Jellyfin server: ${response.data.ServerName} (v${response.data.Version})`);
      return {
        success: true,
        message: `Connected to ${response.data.ServerName}`,
        serverInfo: response.data,
      };
    } catch (error: any) {
      const friendlyMessage = formatConnectionError(error, this.config.url);
      logger.error(`Jellyfin connection failed: ${friendlyMessage}`);
      return {
        success: false,
        message: friendlyMessage,
      };
    }
  }

  async getSystemInfo(): Promise<JellyfinSystemInfo> {
    const response = await this.client.get<JellyfinSystemInfo>('/System/Info');
    return response.data;
  }

  // ============================================
  // Libraries
  // ============================================

  async getLibraries(): Promise<JellyfinLibrary[]> {
    const response = await this.client.get('/Library/VirtualFolders');
    return response.data.map((lib: any) => ({
      Id: lib.ItemId,
      Name: lib.Name,
      CollectionType: lib.CollectionType || 'unknown',
      ItemCount: lib.LibraryOptions?.EnablePhotos ? 0 : 0, // Will need separate count call
    }));
  }

  async getLibraryItemCount(libraryId: string): Promise<number> {
    const response = await this.client.get('/Items', {
      params: {
        ParentId: libraryId,
        Recursive: true,
        IncludeItemTypes: 'Movie,Series,Episode',
        Limit: 0,
      },
    });
    return response.data.TotalRecordCount;
  }

  // ============================================
  // Media Items
  // ============================================

  async getItems(params: {
    libraryId?: string;
    includeTypes?: string[];
    sortBy?: string;
    sortOrder?: 'Ascending' | 'Descending';
    limit?: number;
    startIndex?: number;
    recursive?: boolean;
    filters?: string[];
    searchTerm?: string;
    userId?: string;
  }): Promise<{ items: JellyfinMediaItem[]; totalCount: number }> {
    const response = await this.client.get('/Items', {
      params: {
        ParentId: params.libraryId,
        IncludeItemTypes: params.includeTypes?.join(','),
        SortBy: params.sortBy || 'SortName',
        SortOrder: params.sortOrder || 'Ascending',
        Limit: params.limit || 100,
        StartIndex: params.startIndex || 0,
        Recursive: params.recursive ?? true,
        Filters: params.filters?.join(','),
        SearchTerm: params.searchTerm,
        UserId: params.userId,
        Fields: 'Path,MediaSources,DateCreated,PremiereDate,CommunityRating,OfficialRating,Genres,Studios,People,UserData,Overview',
      },
    });

    return {
      items: response.data.Items,
      totalCount: response.data.TotalRecordCount,
    };
  }

  async getItem(itemId: string, userId?: string): Promise<JellyfinMediaItem> {
    const response = await this.client.get(`/Items/${itemId}`, {
      params: {
        UserId: userId,
        Fields: 'Path,MediaSources,DateCreated,PremiereDate,CommunityRating,OfficialRating,Genres,Studios,People,UserData,Overview',
      },
    });
    return response.data;
  }

  async getMovies(libraryId?: string, userId?: string): Promise<JellyfinMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Movie'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getSeries(libraryId?: string, userId?: string): Promise<JellyfinMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Series'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getSeasons(seriesId: string, userId?: string): Promise<JellyfinMediaItem[]> {
    const response = await this.client.get(`/Shows/${seriesId}/Seasons`, {
      params: {
        UserId: userId,
        Fields: 'Path,DateCreated,PremiereDate,UserData,Overview',
      },
    });
    return response.data.Items;
  }

  async getEpisodes(seriesId: string, seasonId?: string, userId?: string): Promise<JellyfinMediaItem[]> {
    const response = await this.client.get(`/Shows/${seriesId}/Episodes`, {
      params: {
        UserId: userId,
        SeasonId: seasonId,
        Fields: 'Path,MediaSources,DateCreated,PremiereDate,UserData,Overview',
      },
    });
    return response.data.Items;
  }

  // ============================================
  // Users
  // ============================================

  async getUsers(): Promise<JellyfinUser[]> {
    const response = await this.client.get('/Users');
    return response.data;
  }

  async getUser(userId: string): Promise<JellyfinUser> {
    const response = await this.client.get(`/Users/${userId}`);
    return response.data;
  }

  // ============================================
  // User Data & Watch Status
  // ============================================

  async getUserData(itemId: string, userId: string): Promise<JellyfinMediaItem['UserData']> {
    const item = await this.getItem(itemId, userId);
    return item.UserData;
  }

  async getWatchedItems(libraryId: string, userId: string): Promise<JellyfinMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Movie', 'Episode'],
      filters: ['IsPlayed'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getUnwatchedItems(libraryId: string, userId: string): Promise<JellyfinMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Movie', 'Episode'],
      filters: ['IsUnplayed'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  // ============================================
  // Deletion
  // ============================================

  async deleteItem(itemId: string): Promise<void> {
    await this.client.delete(`/Items/${itemId}`);
    logger.info(`Deleted item ${itemId} from Jellyfin`);
  }

  async deleteItems(itemIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of itemIds) {
      try {
        await this.deleteItem(id);
        success.push(id);
      } catch (error: any) {
        logger.error(`Failed to delete item ${id}: ${error.message}`);
        failed.push(id);
      }
    }

    return { success, failed };
  }

  // ============================================
  // Collections
  // ============================================

  async getCollections(): Promise<JellyfinMediaItem[]> {
    const result = await this.getItems({
      includeTypes: ['BoxSet'],
      recursive: true,
    });
    return result.items;
  }

  async createCollection(name: string, itemIds?: string[]): Promise<{ Id: string }> {
    const response = await this.client.post('/Collections', null, {
      params: {
        Name: name,
        Ids: itemIds?.join(','),
      },
    });
    logger.info(`Created collection: ${name}`);
    return response.data;
  }

  async addToCollection(collectionId: string, itemIds: string[]): Promise<void> {
    await this.client.post(`/Collections/${collectionId}/Items`, null, {
      params: {
        Ids: itemIds.join(','),
      },
    });
    logger.info(`Added ${itemIds.length} items to collection ${collectionId}`);
  }

  async removeFromCollection(collectionId: string, itemIds: string[]): Promise<void> {
    await this.client.delete(`/Collections/${collectionId}/Items`, {
      params: {
        Ids: itemIds.join(','),
      },
    });
    logger.info(`Removed ${itemIds.length} items from collection ${collectionId}`);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.deleteItem(collectionId);
    logger.info(`Deleted collection ${collectionId}`);
  }

  // ============================================
  // Activity & Playback
  // ============================================

  async getPlaybackInfo(itemId: string, userId: string): Promise<any> {
    const response = await this.client.get(`/Items/${itemId}/PlaybackInfo`, {
      params: { UserId: userId },
    });
    return response.data;
  }

  async getSessions(): Promise<any[]> {
    const response = await this.client.get('/Sessions');
    return response.data;
  }

  // ============================================
  // Library Scanning & Refresh
  // ============================================

  /**
   * Trigger a library scan/refresh
   * @param libraryId Optional - specific library ID to scan, or all libraries if not provided
   */
  async refreshLibrary(libraryId?: string): Promise<void> {
    try {
      if (libraryId) {
        await this.client.post(`/Items/${libraryId}/Refresh`, null, {
          params: {
            Recursive: true,
            MetadataRefreshMode: 'Default',
            ImageRefreshMode: 'Default',
          },
        });
        logger.info(`Triggered library refresh for library ${libraryId}`);
      } else {
        // Refresh all libraries
        await this.client.post('/Library/Refresh');
        logger.info('Triggered full library refresh');
      }
    } catch (error: any) {
      logger.error(`Failed to trigger library refresh: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger a metadata scan for a specific item
   */
  async refreshItem(itemId: string): Promise<void> {
    try {
      await this.client.post(`/Items/${itemId}/Refresh`, null, {
        params: {
          Recursive: false,
          MetadataRefreshMode: 'Default',
          ImageRefreshMode: 'Default',
        },
      });
      logger.info(`Triggered item refresh for ${itemId}`);
    } catch (error: any) {
      logger.error(`Failed to refresh item ${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get items by external provider ID (TMDB, TVDB, IMDB)
   * @param providerId The external ID
   * @param providerName The provider name (Tmdb, Tvdb, Imdb)
   */
  async getItemByProviderId(
    providerId: string,
    providerName: 'Tmdb' | 'Tvdb' | 'Imdb'
  ): Promise<JellyfinMediaItem | null> {
    try {
      const result = await this.getItems({
        recursive: true,
        limit: 10,
      });

      // Search through items for matching provider ID
      // Note: This is a workaround since Jellyfin doesn't have a direct provider ID search
      // In a production environment, you might want to cache this mapping
      for (const item of result.items) {
        const fullItem = await this.getItem(item.Id);
        const providerIds = (fullItem as any).ProviderIds || {};
        if (providerIds[providerName] === providerId) {
          return fullItem;
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`Failed to find item by provider ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the collection's items
   */
  async getCollectionItems(collectionId: string): Promise<JellyfinMediaItem[]> {
    const response = await this.client.get(`/Items`, {
      params: {
        ParentId: collectionId,
        Fields: 'Path,MediaSources,DateCreated,PremiereDate,ProviderIds',
      },
    });
    return response.data.Items || [];
  }

  /**
   * Update collection with a new set of items (replace all)
   * This removes all existing items and adds the new ones
   */
  async syncCollectionItems(collectionId: string, itemIds: string[]): Promise<void> {
    try {
      // Get current items in collection
      const currentItems = await this.getCollectionItems(collectionId);
      const currentIds = currentItems.map(item => item.Id);

      // Calculate what to add and remove
      const toAdd = itemIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !itemIds.includes(id));

      // Remove items no longer needed
      if (toRemove.length > 0) {
        await this.removeFromCollection(collectionId, toRemove);
      }

      // Add new items
      if (toAdd.length > 0) {
        await this.addToCollection(collectionId, toAdd);
      }

      logger.info(`Synced collection ${collectionId}: +${toAdd.length}, -${toRemove.length}`);
    } catch (error: any) {
      logger.error(`Failed to sync collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get item by path
   */
  async getItemByPath(itemPath: string): Promise<JellyfinMediaItem | null> {
    try {
      const result = await this.getItems({
        recursive: true,
        limit: 5000,
      });

      // Normalize paths for comparison
      const normalizedPath = itemPath.toLowerCase().replace(/\\/g, '/');
      
      for (const item of result.items) {
        if (item.Path) {
          const itemNormalizedPath = item.Path.toLowerCase().replace(/\\/g, '/');
          if (itemNormalizedPath === normalizedPath || itemNormalizedPath.includes(normalizedPath)) {
            return item;
          }
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`Failed to find item by path: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all items with their provider IDs for matching
   */
  async getAllItemsWithProviderIds(mediaType: 'Movie' | 'Series'): Promise<Map<string, { id: string; tmdbId?: string; tvdbId?: string; imdbId?: string }>> {
    const itemMap = new Map();
    
    try {
      let startIndex = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const result = await this.getItems({
          includeTypes: [mediaType],
          recursive: true,
          limit,
          startIndex,
        });

        for (const item of result.items) {
          // Get full item details including ProviderIds
          try {
            const fullItem = await this.client.get(`/Items/${item.Id}`, {
              params: { Fields: 'ProviderIds' },
            });
            
            const providerIds = fullItem.data.ProviderIds || {};
            
            itemMap.set(item.Id, {
              id: item.Id,
              tmdbId: providerIds.Tmdb,
              tvdbId: providerIds.Tvdb,
              imdbId: providerIds.Imdb,
            });
          } catch {}
        }

        startIndex += limit;
        hasMore = result.items.length === limit && startIndex < result.totalCount;
      }
    } catch (error: any) {
      logger.error(`Failed to get items with provider IDs: ${error.message}`);
    }

    return itemMap;
  }
}

export default JellyfinClient;
