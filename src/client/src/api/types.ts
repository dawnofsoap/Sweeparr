// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

// Health
export interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
}

export interface ReadyStatus {
  status: string;
  checks: {
    database: boolean;
    mediaServer: boolean;
    arrApps: boolean;
  };
}

// Media Server
export interface MediaServer {
  id: number;
  name: string;
  type: 'jellyfin' | 'emby' | 'plex';
  url: string;
  apiKey: string;
  isDefault: boolean;
  isEnabled: boolean;
  // Leaving Soon paths
  leavingSoonMoviesPath?: string | null;
  leavingSoonTvPath?: string | null;
  leavingSoonMoviesMediaPath?: string | null;
  leavingSoonTvMediaPath?: string | null;
  createdAt: string;
  updatedAt: string;
  libraries?: Library[];
}

export interface Library {
  id: number;
  externalId: string;
  name: string;
  type: 'movies' | 'tvshows' | 'music' | 'unknown';
  mediaServerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  message: string;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

// Arr Apps
export interface ArrApp {
  id: number;
  name: string;
  type: 'radarr' | 'sonarr' | 'lidarr';
  url: string;
  apiKey: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Rules
export interface Rule {
  id: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  isActive: boolean;
  mediaServerId?: number;
  mediaServer?: MediaServer;
  libraryId?: number;
  library?: Library;
  arrAppId?: number;
  arrApp?: ArrApp;
  mediaType: 'movies' | 'shows' | 'seasons' | 'episodes';
  action: 'delete' | 'unmonitor' | 'unmonitor_delete' | 'tag';
  gracePeriodDays: number;
  showInCollection: boolean;
  collectionName?: string;
  conditions: string; // JSON string
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    collectionItems: number;
  };
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface RuleHistory {
  id: number;
  ruleId: number;
  action: 'matched' | 'deleted' | 'unmonitored' | 'excluded' | 'error';
  mediaId: string;
  mediaTitle: string;
  details?: string;
  createdAt: string;
}

// Collections
export interface Collection {
  id: number;
  name: string;
  description?: string;
  externalId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: CollectionItem[];
  _count?: {
    items: number;
  };
}

export interface CollectionItem {
  id: number;
  mediaId: string;
  mediaType: 'movie' | 'show' | 'season' | 'episode';
  title: string;
  addedAt: string;
  expiresAt: string;
  isExcluded: boolean;
  collectionId: number;
  ruleId: number;
  rule?: Rule;
}

// Settings
export type Settings = Record<string, string>;

// Notification Services
export type NotificationServiceType = 'discord' | 'email' | 'slack' | 'telegram' | 'pushover' | 'gotify';

export interface NotificationService {
  id: number;
  name: string;
  type: NotificationServiceType;
  config: Record<string, string>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTestResult {
  success: boolean;
  message: string;
}

// Activity
export interface ActivityLog {
  id: number;
  type: string;
  message: string;
  details?: string;
  level: 'info' | 'warning' | 'error';
  createdAt: string;
}

// Statistics Services
export type StatisticsServiceType = 'jellystat' | 'tautulli';

export interface StatisticsService {
  id: number;
  name: string;
  type: StatisticsServiceType;
  url: string;
  apiKey?: string;
  hasApiKey: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  mediaServers?: MediaServer[];
}

export interface JellystatLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
}

export interface JellystatLastPlayed {
  itemId: string;
  hasBeenPlayed: boolean;
  ItemID?: string;
  ItemName?: string;
  ItemType?: string;
  LastPlayed?: string;
  LastUser?: string;
  PlayCount?: number;
  TotalRuntime?: number;
}

export interface JellystatStats {
  TotalWatchTime?: number;
  TotalPlays?: number;
  UniqueViewers?: number;
}

// System
export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  interval: string;
  time: string;
  dryRun: boolean;
  nextRun: string | null;
  lastRun: string | null;
  activeRules: number;
}

export interface CleanupResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  rulesProcessed: number;
  results: {
    ruleId: number;
    ruleName: string;
    itemsFound: number;
    itemsProcessed: number;
    dryRun: boolean;
    status: string;
    message: string;
  }[];
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  category?: string;
}

// Storage Sources
export type StorageSourceType = 'local' | 'smb' | 'nfs' | 'truenas';

export interface StorageSource {
  id: number;
  name: string;
  type: StorageSourceType;
  path?: string;
  host?: string;
  share?: string;
  export?: string;
  dataset?: string;
  pool?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  port?: number;
  useSsl?: boolean;
  isEnabled: boolean;
  thresholdPct: number;
  autoCleanup: boolean;
  lastChecked?: string;
  lastSize?: number;
  lastUsed?: number;
  lastFree?: number;
  lastSizeFormatted?: string;
  lastUsedFormatted?: string;
  lastFreeFormatted?: string;
  usedPercent?: string;
  isAboveThreshold?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
  freePercent: number;
}

export interface StorageSummary {
  totalSources: number;
  sourcesAboveThreshold: number;
  totalSize: number;
  totalUsed: number;
  totalFree: number;
  totalSizeFormatted: string;
  totalUsedFormatted: string;
  totalFreeFormatted: string;
  overallUsedPercent: string;
}

export interface TrueNASPool {
  name: string;
  status: string;
  healthy: boolean;
  size: number;
  allocated: number;
  free: number;
  sizeFormatted: string;
  allocatedFormatted: string;
  freeFormatted: string;
  usedPercent: string;
}

export interface TrueNASDataset {
  id: string;
  name: string;
  pool: string;
  type: string;
  mountpoint: string;
  used: number;
  available: number;
  usedFormatted: string;
  availableFormatted: string;
  compression: string;
}

// Leaving Soon
export interface LeavingSoonSettings {
  'leavingSoon.enabled': string;
  'leavingSoon.syncIntervalMinutes': string;
  'leavingSoon.autoSync': string;
  'leavingSoon.refreshLibraryAfterSync': string;
}

export interface LeavingSoonItem {
  id: number;
  title: string;
  year: number;
  mediaType: 'movie' | 'series';
  externalId: string;
  arrPath: string;    // Path as reported by Radarr/Sonarr
  localPath: string;  // Path as mapped to local filesystem
  arrAppId: number;
  ruleId: number;
  ruleName: string;
  expiresAt: string;
  addedAt: string;
  daysUntilExpiry: number;
}

export interface LeavingSoonItemsResponse {
  items: LeavingSoonItem[];
  movies: LeavingSoonItem[];
  series: LeavingSoonItem[];
  totalCount: number;
  movieCount: number;
  seriesCount: number;
  expiringSoonCount: number;
}

export interface SymlinkStats {
  moviesPath: string;
  tvShowsPath: string;
  movieCount: number;
  tvShowCount: number;
  totalCount: number;
}

export interface LeavingSoonStatus {
  enabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  symlinkStats: SymlinkStats;
  targetedItemCount: number;
}

export interface SymlinkSyncResult {
  success: boolean;
  message: string;
  created: number;
  removed: number;
  failed: number;
  totalActive: number;
  errors: string[];
}

export interface LibraryRefreshResult {
  success: boolean;
  message: string;
  serverName: string;
}
