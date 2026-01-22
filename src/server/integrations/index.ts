// Media Server Integrations
export { JellyfinClient, type JellyfinConfig, type JellyfinMediaItem, type JellyfinLibrary } from './jellyfin.js';
export { EmbyClient, type EmbyConfig, type EmbyMediaItem, type EmbyLibrary } from './emby.js';

// Statistics Integrations
export { 
  JellystatClient, 
  type JellystatConfig, 
  type JellystatLibrary,
  type JellystatLibraryItem,
  type JellystatPlaybackHistory,
  type JellystatItemHistory,
  type JellystatLastPlayedInfo,
  type JellystatUser,
  type JellystatStats,
  type JellystatGlobalStats,
} from './jellystat.js';

// *arr Integrations
export { RadarrClient, type RadarrConfig, type RadarrMovie, type RadarrTag } from './radarr.js';
export { SonarrClient, type SonarrConfig, type SonarrSeries, type SonarrEpisode, type SonarrTag } from './sonarr.js';

// Storage Integrations
export { 
  TrueNASClient, 
  type TrueNASConfig, 
  type TrueNASPool, 
  type TrueNASDataset, 
  type TrueNASDisk,
  type TrueNASSystemInfo,
  type StorageStats as TrueNASStorageStats,
} from './truenas.js';
export { 
  StorageClient, 
  type StorageConfig, 
  type StorageStats, 
  type MountInfo,
} from './storage.js';

// Factory functions
import { JellyfinClient, JellyfinConfig } from './jellyfin.js';
import { EmbyClient, EmbyConfig } from './emby.js';
import { RadarrClient, RadarrConfig } from './radarr.js';
import { SonarrClient, SonarrConfig } from './sonarr.js';
import { JellystatClient, JellystatConfig } from './jellystat.js';
import { TrueNASClient, TrueNASConfig } from './truenas.js';
import { StorageClient, StorageConfig } from './storage.js';

export type MediaServerType = 'jellyfin' | 'emby' | 'plex';
export type ArrType = 'radarr' | 'sonarr' | 'lidarr';
export type StatisticsType = 'jellystat' | 'tautulli';
export type StorageType = 'local' | 'smb' | 'nfs' | 'truenas';

export interface MediaServerConnection {
  type: MediaServerType;
  url: string;
  apiKey: string;
}

export interface ArrConnection {
  type: ArrType;
  url: string;
  apiKey: string;
}

export interface StatisticsConnection {
  type: StatisticsType;
  url: string;
  apiKey: string;
}

export interface StorageConnection {
  type: StorageType;
  // Local/SMB/NFS
  path?: string;
  // TrueNAS
  url?: string;
  apiKey?: string;
  pool?: string;
  dataset?: string;
  // SMB
  host?: string;
  share?: string;
  username?: string;
  password?: string;
  // NFS
  export?: string;
}

/**
 * Create a media server client based on type
 */
export function createMediaServerClient(connection: MediaServerConnection) {
  switch (connection.type) {
    case 'jellyfin':
      return new JellyfinClient({ url: connection.url, apiKey: connection.apiKey });
    case 'emby':
      return new EmbyClient({ url: connection.url, apiKey: connection.apiKey });
    case 'plex':
      throw new Error('Plex support not yet implemented');
    default:
      throw new Error(`Unknown media server type: ${connection.type}`);
  }
}

/**
 * Create an *arr client based on type
 */
export function createArrClient(connection: ArrConnection) {
  switch (connection.type) {
    case 'radarr':
      return new RadarrClient({ url: connection.url, apiKey: connection.apiKey });
    case 'sonarr':
      return new SonarrClient({ url: connection.url, apiKey: connection.apiKey });
    case 'lidarr':
      throw new Error('Lidarr support not yet implemented');
    default:
      throw new Error(`Unknown arr type: ${connection.type}`);
  }
}

/**
 * Create a statistics client based on type
 */
export function createStatisticsClient(connection: StatisticsConnection) {
  switch (connection.type) {
    case 'jellystat':
      return new JellystatClient({ url: connection.url, apiKey: connection.apiKey });
    case 'tautulli':
      throw new Error('Tautulli support not yet implemented');
    default:
      throw new Error(`Unknown statistics type: ${connection.type}`);
  }
}

/**
 * Create a storage client based on type
 */
export function createStorageClient(connection: StorageConnection): TrueNASClient | StorageClient {
  switch (connection.type) {
    case 'truenas':
      if (!connection.url || !connection.apiKey) {
        throw new Error('TrueNAS requires URL and API key');
      }
      return new TrueNASClient({ url: connection.url, apiKey: connection.apiKey });
    case 'local':
    case 'smb':
    case 'nfs':
      if (!connection.path) {
        throw new Error('Local/SMB/NFS storage requires a path');
      }
      return new StorageClient({
        type: connection.type,
        path: connection.path,
        host: connection.host,
        share: connection.share,
        username: connection.username,
        password: connection.password,
        export: connection.export,
      });
    default:
      throw new Error(`Unknown storage type: ${connection.type}`);
  }
}
