import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface EmbyConfig {
  url: string;
  apiKey: string;
}

export interface EmbyLibrary {
  Id: string;
  Name: string;
  CollectionType: string;
  ItemCount: number;
}

export interface EmbyMediaItem {
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

export interface EmbyUser {
  Id: string;
  Name: string;
  ServerId: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin: boolean;
}

export interface EmbySystemInfo {
  ServerName: string;
  Version: string;
  Id: string;
  OperatingSystem: string;
  HasUpdateAvailable: boolean;
}

/**
 * Emby Client
 * 
 * Note: Emby's API is very similar to Jellyfin's (Jellyfin forked from Emby)
 * The main differences are in authentication headers and some endpoint variations.
 */
export class EmbyClient {
  private client: AxiosInstance;
  private config: EmbyConfig;

  constructor(config: EmbyConfig) {
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

  async testConnection(): Promise<{ success: boolean; message: string; serverInfo?: EmbySystemInfo }> {
    try {
      const response = await this.client.get<EmbySystemInfo>('/System/Info');
      logger.info(`Connected to Emby server: ${response.data.ServerName} (v${response.data.Version})`);
      return {
        success: true,
        message: `Connected to ${response.data.ServerName}`,
        serverInfo: response.data,
      };
    } catch (error: any) {
      logger.error(`Emby connection failed: ${error.message}`);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  async getSystemInfo(): Promise<EmbySystemInfo> {
    const response = await this.client.get<EmbySystemInfo>('/System/Info');
    return response.data;
  }

  // ============================================
  // Libraries
  // ============================================

  async getLibraries(): Promise<EmbyLibrary[]> {
    const response = await this.client.get('/Library/VirtualFolders');
    return response.data.map((lib: any) => ({
      Id: lib.ItemId,
      Name: lib.Name,
      CollectionType: lib.CollectionType || 'unknown',
      ItemCount: 0, // Will need separate count call
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
  }): Promise<{ items: EmbyMediaItem[]; totalCount: number }> {
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

  async getItem(itemId: string, userId?: string): Promise<EmbyMediaItem> {
    const response = await this.client.get(`/Items/${itemId}`, {
      params: {
        UserId: userId,
        Fields: 'Path,MediaSources,DateCreated,PremiereDate,CommunityRating,OfficialRating,Genres,Studios,People,UserData,Overview',
      },
    });
    return response.data;
  }

  async getMovies(libraryId?: string, userId?: string): Promise<EmbyMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Movie'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getSeries(libraryId?: string, userId?: string): Promise<EmbyMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Series'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getSeasons(seriesId: string, userId?: string): Promise<EmbyMediaItem[]> {
    const response = await this.client.get(`/Shows/${seriesId}/Seasons`, {
      params: {
        UserId: userId,
        Fields: 'Path,DateCreated,PremiereDate,UserData,Overview',
      },
    });
    return response.data.Items;
  }

  async getEpisodes(seriesId: string, seasonId?: string, userId?: string): Promise<EmbyMediaItem[]> {
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

  async getUsers(): Promise<EmbyUser[]> {
    const response = await this.client.get('/Users');
    return response.data;
  }

  async getUser(userId: string): Promise<EmbyUser> {
    const response = await this.client.get(`/Users/${userId}`);
    return response.data;
  }

  // ============================================
  // User Data & Watch Status
  // ============================================

  async getUserData(itemId: string, userId: string): Promise<EmbyMediaItem['UserData']> {
    const item = await this.getItem(itemId, userId);
    return item.UserData;
  }

  async getWatchedItems(libraryId: string, userId: string): Promise<EmbyMediaItem[]> {
    const result = await this.getItems({
      libraryId,
      includeTypes: ['Movie', 'Episode'],
      filters: ['IsPlayed'],
      recursive: true,
      userId,
    });
    return result.items;
  }

  async getUnwatchedItems(libraryId: string, userId: string): Promise<EmbyMediaItem[]> {
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
    logger.info(`Deleted item ${itemId} from Emby`);
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

  async getCollections(): Promise<EmbyMediaItem[]> {
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
        logger.info(`Triggered Emby library refresh for library ${libraryId}`);
      } else {
        // Refresh all libraries
        await this.client.post('/Library/Refresh');
        logger.info('Triggered full Emby library refresh');
      }
    } catch (error: any) {
      logger.error(`Failed to trigger Emby library refresh: ${error.message}`);
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
      logger.info(`Triggered Emby item refresh for ${itemId}`);
    } catch (error: any) {
      logger.error(`Failed to refresh Emby item ${itemId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get items by external provider ID (TMDB, TVDB, IMDB)
   */
  async getItemByProviderId(
    providerId: string,
    providerName: 'Tmdb' | 'Tvdb' | 'Imdb'
  ): Promise<EmbyMediaItem | null> {
    try {
      const result = await this.getItems({
        recursive: true,
        limit: 10,
      });

      for (const item of result.items) {
        const fullItem = await this.getItem(item.Id);
        const providerIds = (fullItem as any).ProviderIds || {};
        if (providerIds[providerName] === providerId) {
          return fullItem;
        }
      }

      return null;
    } catch (error: any) {
      logger.error(`Failed to find Emby item by provider ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the collection's items
   */
  async getCollectionItems(collectionId: string): Promise<EmbyMediaItem[]> {
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
   */
  async syncCollectionItems(collectionId: string, itemIds: string[]): Promise<void> {
    try {
      const currentItems = await this.getCollectionItems(collectionId);
      const currentIds = currentItems.map(item => item.Id);

      const toAdd = itemIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !itemIds.includes(id));

      if (toRemove.length > 0) {
        await this.removeFromCollection(collectionId, toRemove);
      }

      if (toAdd.length > 0) {
        await this.addToCollection(collectionId, toAdd);
      }

      logger.info(`Synced Emby collection ${collectionId}: +${toAdd.length}, -${toRemove.length}`);
    } catch (error: any) {
      logger.error(`Failed to sync Emby collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get item by path
   */
  async getItemByPath(itemPath: string): Promise<EmbyMediaItem | null> {
    try {
      const result = await this.getItems({
        recursive: true,
        limit: 5000,
      });

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
      logger.error(`Failed to find Emby item by path: ${error.message}`);
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
      logger.error(`Failed to get Emby items with provider IDs: ${error.message}`);
    }

    return itemMap;
  }
}

export default EmbyClient;
