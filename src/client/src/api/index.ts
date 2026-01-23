export type {
  ApiResponse,
  HealthStatus,
  ReadyStatus,
  MediaServer,
  ConnectionTestResult,
  Library,
  ArrApp,
  Rule,
  RuleHistory,
  RuleCondition,
  Collection,
  CollectionItem,
  Settings,
  NotificationService,
  NotificationServiceType,
  NotificationTestResult,
  ActivityLog,
  StatisticsService,
  StatisticsServiceType,
  JellystatLibrary,
  JellystatLastPlayed,
  JellystatStats,
  ScheduledTask,
  CleanupResult,
  LogEntry,
  StorageSource,
  StorageSourceType,
  StorageStats,
  StorageSummary,
  TrueNASPool,
  TrueNASDataset,
  LeavingSoonSettings,
  LeavingSoonItem,
  LeavingSoonItemsResponse,
  SymlinkStats,
  LeavingSoonStatus,
  SymlinkSyncResult,
  LibraryRefreshResult,
} from './types';

import { get, post, put, del } from './client';
import type {
  ApiResponse,
  MediaServer,
  ConnectionTestResult,
  Library,
  ArrApp,
  Rule,
  RuleHistory,
  Collection,
  Settings,
  NotificationService,
  NotificationTestResult,
  StatisticsService,
  JellystatLibrary,
  JellystatLastPlayed,
  JellystatStats,
  ScheduledTask,
  CleanupResult,
  LogEntry,
  HealthStatus,
  ReadyStatus,
  StorageSource,
  StorageSummary,
  TrueNASPool,
  TrueNASDataset,
} from './types';

// Setup
export const setup = {
  status: () => get<ApiResponse<{ setupComplete: boolean }>>('/setup/status'),
  complete: (data: { instanceName: string; username?: string; password?: string; authentication: string }) =>
    post<ApiResponse<{ message: string; instanceName: string; apiKey: string }>>('/setup/complete', data),
};

// Health
export const health = {
  get: () => get<HealthStatus>('/health'),
  ready: () => get<ReadyStatus>('/health/ready'),
};

// Media Servers
export const mediaServers = {
  list: () => get<ApiResponse<MediaServer[]>>('/media-servers'),
  get: (id: number) => get<ApiResponse<MediaServer>>(`/media-servers/${id}`),
  create: (data: Partial<MediaServer>) => post<ApiResponse<MediaServer>>('/media-servers', data),
  update: (id: number, data: Partial<MediaServer>) => put<ApiResponse<MediaServer>>(`/media-servers/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/media-servers/${id}`),
  test: (id: number) => post<ApiResponse<ConnectionTestResult>>(`/media-servers/${id}/test`),
  testConnection: (data: { type: string; url: string; apiKey: string }) => post<ApiResponse<ConnectionTestResult>>('/media-servers/test', data),
  syncLibraries: (id: number) => post<ApiResponse<{ synced: boolean; libraryCount: number; libraries: Library[] }>>(`/media-servers/${id}/sync-libraries`),
};

// Arr Apps
export const arrApps = {
  list: () => get<ApiResponse<ArrApp[]>>('/arr'),
  get: (id: number) => get<ApiResponse<ArrApp>>(`/arr/${id}`),
  create: (data: Partial<ArrApp>) => post<ApiResponse<ArrApp>>('/arr', data),
  update: (id: number, data: Partial<ArrApp>) => put<ApiResponse<ArrApp>>(`/arr/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/arr/${id}`),
  test: (id: number) => post<ApiResponse<ConnectionTestResult>>(`/arr/${id}/test`),
  testConnection: (data: { type: string; url: string; apiKey: string }) => post<ApiResponse<ConnectionTestResult>>('/arr/test', data),
};

// Rules Preview Types
export interface RulePreviewItem {
  id: number;
  title: string;
  year: number;
  added: string;
  addedDaysAgo: number;
  size: number;
  sizeFormatted: string;
  hasFile: boolean;
  monitored: boolean;
  genres: string[];
  tags: number[];
  posterUrl: string | null;
  lastWatched?: string | null;
  lastWatchedDaysAgo?: number | null;
  matchedConditions: string[];
}

export interface RulePreviewResult {
  items: RulePreviewItem[];
  totalMatches: number;
  totalSize?: number;
  totalSizeFormatted?: string;
  hasWatchHistory?: boolean;
  message: string;
}

// Rules
export const rules = {
  list: () => get<ApiResponse<Rule[]>>('/rules'),
  get: (id: number) => get<ApiResponse<Rule>>(`/rules/${id}`),
  create: (data: Partial<Rule>) => post<ApiResponse<Rule>>('/rules', data),
  update: (id: number, data: Partial<Rule>) => put<ApiResponse<Rule>>(`/rules/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/rules/${id}`),
  run: (id: number) => post<ApiResponse<{ executed: boolean; message: string }>>(`/rules/${id}/run`),
  history: (id: number) => get<ApiResponse<RuleHistory[]>>(`/rules/${id}/history`),
  export: (id: number) => get<ApiResponse<unknown>>(`/rules/${id}/export`),
  import: (data: unknown) => post<ApiResponse<Rule>>('/rules/import', data),
  preview: (data: { arrAppId: number; conditions: unknown[]; limit?: number }) => 
    post<ApiResponse<RulePreviewResult>>('/rules/preview', data),
};

// Collections
export const collections = {
  list: () => get<ApiResponse<Collection[]>>('/collections'),
  get: (id: number) => get<ApiResponse<Collection>>(`/collections/${id}`),
  create: (data: Partial<Collection>) => post<ApiResponse<Collection>>('/collections', data),
  update: (id: number, data: Partial<Collection>) => put<ApiResponse<Collection>>(`/collections/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/collections/${id}`),
  excludeItem: (collectionId: number, itemId: number) => post<ApiResponse<void>>(`/collections/${collectionId}/items/${itemId}/exclude`),
  removeItem: (collectionId: number, itemId: number) => del<ApiResponse<void>>(`/collections/${collectionId}/items/${itemId}`),
  sync: (id: number) => post<ApiResponse<{ synced: boolean; message: string }>>(`/collections/${id}/sync`),
};

// Settings
export const settings = {
  list: () => get<ApiResponse<Settings>>('/settings'),
  getGroup: (group: string) => get<ApiResponse<Settings>>(`/settings/group/${group}`),
  get: (key: string) => get<ApiResponse<{ key: string; value: string }>>(`/settings/${key}`),
  set: (key: string, value: string) => put<ApiResponse<{ key: string; value: string }>>(`/settings/${key}`, { value }),
  setBulk: (settings: Record<string, any>) => put<ApiResponse<{ message: string }>>('/settings', settings),
  delete: (key: string) => del<ApiResponse<void>>(`/settings/${key}`),
};

// Statistics Services
export const statisticsServices = {
  list: () => get<ApiResponse<StatisticsService[]>>('/statistics-services'),
  get: (id: number) => get<ApiResponse<StatisticsService>>(`/statistics-services/${id}`),
  create: (data: Partial<StatisticsService>) => post<ApiResponse<StatisticsService>>('/statistics-services', data),
  update: (id: number, data: Partial<StatisticsService>) => put<ApiResponse<StatisticsService>>(`/statistics-services/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/statistics-services/${id}`),
  test: (id: number) => post<ApiResponse<ConnectionTestResult>>(`/statistics-services/${id}/test`),
  testConnection: (data: { type: string; url: string; apiKey: string }) => post<ApiResponse<ConnectionTestResult>>('/statistics-services/test', data),
  // Jellystat-specific endpoints
  getLibraries: (id: number) => get<ApiResponse<JellystatLibrary[]>>(`/statistics-services/${id}/libraries`),
  getHistory: (id: number, params?: { size?: number; page?: number }) => 
    get<ApiResponse<{ results: unknown[]; totalCount?: number }>>(`/statistics-services/${id}/history${params ? `?size=${params.size || 50}&page=${params.page || 1}` : ''}`),
  getLastPlayed: (id: number, itemId: string) => 
    get<ApiResponse<JellystatLastPlayed>>(`/statistics-services/${id}/item/${itemId}/last-played`),
  batchGetLastPlayed: (id: number, itemIds: string[]) => 
    post<ApiResponse<Record<string, JellystatLastPlayed>>>(`/statistics-services/${id}/batch-last-played`, { itemIds }),
  getUsers: (id: number) => get<ApiResponse<unknown[]>>(`/statistics-services/${id}/users`),
  getStats: (id: number, days?: number) => 
    get<ApiResponse<JellystatStats>>(`/statistics-services/${id}/stats${days ? `?days=${days}` : ''}`),
};

// Notifications
export const notifications = {
  list: () => get<ApiResponse<NotificationService[]>>('/notifications'),
  get: (id: number) => get<ApiResponse<NotificationService>>(`/notifications/${id}`),
  create: (data: Partial<NotificationService>) => post<ApiResponse<NotificationService>>('/notifications', data),
  update: (id: number, data: Partial<NotificationService>) => put<ApiResponse<NotificationService>>(`/notifications/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/notifications/${id}`),
  test: (id: number) => post<ApiResponse<NotificationTestResult>>(`/notifications/${id}/test`),
};

// System
export const system = {
  getTasks: () => get<ScheduledTask[]>('/system/tasks'),
  runCleanup: (dryRun: boolean = true) => post<CleanupResult>('/system/run-cleanup', { dryRun }),
  clearCache: () => post<{ success: boolean; message: string; timestamp: string }>('/system/clear-cache'),
  getLogs: (limit?: number, level?: string) => get<{ logs: LogEntry[]; total: number; hasMore: boolean }>(`/system/logs?limit=${limit || 100}${level ? `&level=${level}` : ''}`),
  clearLogs: () => post<{ success: boolean; message: string; timestamp: string }>('/system/clear-logs'),
};

// Storage Sources
export const storageSources = {
  list: () => get<ApiResponse<StorageSource[]>>('/storage-sources'),
  get: (id: number) => get<ApiResponse<StorageSource>>(`/storage-sources/${id}`),
  create: (data: Partial<StorageSource>) => post<ApiResponse<StorageSource>>('/storage-sources', data),
  update: (id: number, data: Partial<StorageSource>) => put<ApiResponse<StorageSource>>(`/storage-sources/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/storage-sources/${id}`),
  test: (id: number) => post<ApiResponse<ConnectionTestResult>>(`/storage-sources/${id}/test`),
  testConnection: (data: { 
    type: string; 
    path?: string; 
    host?: string; 
    apiKey?: string; 
    pool?: string; 
    dataset?: string;
    useSsl?: boolean;
  }) => post<ApiResponse<ConnectionTestResult>>('/storage-sources/test', data),
  refresh: (id: number) => post<ApiResponse<StorageSource>>(`/storage-sources/${id}/refresh`),
  refreshAll: () => post<ApiResponse<{ total: number; refreshed: number; failed: number; results: any[] }>>('/storage-sources/refresh-all'),
  getSummary: () => get<ApiResponse<StorageSummary>>('/storage-sources/summary'),
  // For saved sources
  getPools: (id: number) => get<ApiResponse<TrueNASPool[]>>(`/storage-sources/${id}/pools`),
  getDatasets: (id: number, pool?: string) => get<ApiResponse<TrueNASDataset[]>>(`/storage-sources/${id}/datasets${pool ? `?pool=${pool}` : ''}`),
  // For unsaved sources (testing before save)
  fetchPools: (data: { host: string; apiKey: string; useSsl?: boolean }) => 
    post<ApiResponse<TrueNASPool[]>>('/storage-sources/pools', data),
  fetchDatasets: (data: { host: string; apiKey: string; useSsl?: boolean; pool?: string }) => 
    post<ApiResponse<TrueNASDataset[]>>('/storage-sources/datasets', data),
};

// Preset Types
export interface PresetCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  category: 'cleanup' | 'organization' | 'storage' | 'monitoring';
  mediaType: 'movie' | 'series' | 'both';
  action: 'delete' | 'unmonitor' | 'unmonitor_delete' | 'tag';
  gracePeriodDays: number;
  conditions: PresetCondition[];
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface PresetCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface PresetsResponse {
  presets: RulePreset[];
  categories: PresetCategory[];
  total: number;
}

// Presets
export const presets = {
  list: (params?: { category?: string; mediaType?: string; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.mediaType) queryParams.append('mediaType', params.mediaType);
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    return get<ApiResponse<PresetsResponse>>(`/presets${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => get<ApiResponse<RulePreset>>(`/presets/${id}`),
  categories: () => get<ApiResponse<PresetCategory[]>>('/presets/categories'),
};

// Leaving Soon Types
export interface LeavingSoonSettings {
  'leavingSoon.enabled': string;
  'leavingSoon.movies.path': string;
  'leavingSoon.tvShows.path': string;
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
  path: string;
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

// Leaving Soon API
export const leavingSoon = {
  // Settings
  getSettings: () => get<ApiResponse<LeavingSoonSettings>>('/leaving-soon/settings'),
  updateSettings: (settings: Partial<LeavingSoonSettings>) => 
    put<ApiResponse<LeavingSoonSettings>>('/leaving-soon/settings', settings),
  
  // Status & Items
  getStatus: () => get<ApiResponse<LeavingSoonStatus>>('/leaving-soon/status'),
  getItems: () => get<ApiResponse<LeavingSoonItemsResponse>>('/leaving-soon/items'),
  
  // Symlinks
  getSymlinkStats: () => get<ApiResponse<SymlinkStats>>('/leaving-soon/symlinks'),
  sync: () => post<ApiResponse<SymlinkSyncResult>>('/leaving-soon/sync'),
  clearSymlinks: () => del<ApiResponse<{ removed: number; errors: string[] }>>('/leaving-soon/symlinks'),
  
  // Auto-sync control
  startAutoSync: () => post<ApiResponse<{ message: string; timestamp: string }>>('/leaving-soon/auto-sync/start'),
  stopAutoSync: () => post<ApiResponse<{ message: string; timestamp: string }>>('/leaving-soon/auto-sync/stop'),
  
  // Library refresh
  refreshAll: () => post<ApiResponse<{ results: LibraryRefreshResult[]; successful: number; failed: number; message: string }>>('/leaving-soon/refresh'),
  refreshMediaServer: (mediaServerId: number) => 
    post<ApiResponse<LibraryRefreshResult>>(`/leaving-soon/refresh/${mediaServerId}`),
};

// Media Path Types
export interface MediaPath {
  id: number;
  path: string;
  label: string | null;
  mediaType: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaPathTestResult {
  exists: boolean;
  isDirectory: boolean;
  isReadable: boolean;
  isWritable: boolean;
  message: string;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  directories: Array<{ name: string; path: string }>;
}

// Media Paths API
export const mediaPaths = {
  list: () => get<ApiResponse<MediaPath[]>>('/media-paths'),
  get: (id: number) => get<ApiResponse<MediaPath>>(`/media-paths/${id}`),
  create: (data: { path: string; label?: string; mediaType?: string }) => 
    post<ApiResponse<MediaPath>>('/media-paths', data),
  update: (id: number, data: Partial<MediaPath>) => 
    put<ApiResponse<MediaPath>>(`/media-paths/${id}`, data),
  delete: (id: number) => del<ApiResponse<void>>(`/media-paths/${id}`),
  test: (id: number) => post<ApiResponse<MediaPathTestResult>>(`/media-paths/${id}/test`),
  testPath: (path: string) => post<ApiResponse<MediaPathTestResult>>('/media-paths/test', { path }),
  browse: (currentPath?: string) => post<ApiResponse<BrowseResult>>('/media-paths/browse', { currentPath }),
};

// Export all as default
export default {
  health,
  mediaServers,
  arrApps,
  statisticsServices,
  storageSources,
  rules,
  collections,
  settings,
  notifications,
  system,
  presets,
  leavingSoon,
  mediaPaths,
};
