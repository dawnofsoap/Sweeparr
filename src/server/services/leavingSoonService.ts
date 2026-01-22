import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { JellyfinClient } from '../integrations/jellyfin.js';
import { EmbyClient } from '../integrations/emby.js';
import { RadarrClient } from '../integrations/radarr.js';
import { SonarrClient } from '../integrations/sonarr.js';
import { JellystatClient } from '../integrations/jellystat.js';
import { pathMappingService } from './pathMappingService.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface TargetedItem {
  id: number;
  title: string;
  year: number;
  mediaType: 'movie' | 'series';
  externalId: string; // TMDB ID for movies, TVDB ID for series
  arrPath: string; // Path as reported by Radarr/Sonarr
  localPath: string; // Path as mounted in Sweeparr container
  arrAppId: number;
  ruleId: number;
  ruleName: string;
  expiresAt: Date;
  addedAt: Date;
  daysUntilExpiry: number;
}

interface SymlinkSyncResult {
  success: boolean;
  message: string;
  created: number;
  removed: number;
  failed: number;
  totalActive: number;
  errors: string[];
}

interface MediaServerSyncResult {
  mediaServerId: number;
  mediaServerName: string;
  success: boolean;
  moviesCreated: number;
  moviesRemoved: number;
  tvCreated: number;
  tvRemoved: number;
  errors: string[];
}

interface LibraryRefreshResult {
  success: boolean;
  message: string;
  serverName: string;
}

// ============================================
// Settings Keys
// ============================================

const SETTINGS_KEYS = {
  enabled: 'leavingSoon.enabled',
  syncIntervalMinutes: 'leavingSoon.syncIntervalMinutes',
  autoSync: 'leavingSoon.autoSync',
  refreshLibraryAfterSync: 'leavingSoon.refreshLibraryAfterSync',
};

const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTINGS_KEYS.enabled]: 'true',
  [SETTINGS_KEYS.syncIntervalMinutes]: '60',
  [SETTINGS_KEYS.autoSync]: 'true',
  [SETTINGS_KEYS.refreshLibraryAfterSync]: 'true',
};

// ============================================
// Helper Functions
// ============================================

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function evaluateCondition(
  condition: RuleCondition,
  item: {
    addedDaysAgo: number;
    size: number;
    rating?: number;
    year: number;
    hasFile: boolean;
    monitored: boolean;
    genres: string[];
    tags: number[];
    lastWatchedDaysAgo?: number | null;
  },
  tagMap: Map<number, string>
): boolean {
  const { field, operator, value } = condition;

  switch (field) {
    case 'lastWatched':
      if (item.lastWatchedDaysAgo === null || item.lastWatchedDaysAgo === undefined) {
        return operator === 'greaterThan';
      }
      if (operator === 'greaterThan') return item.lastWatchedDaysAgo > Number(value);
      if (operator === 'lessThan') return item.lastWatchedDaysAgo < Number(value);
      break;

    case 'addedDate':
      if (operator === 'greaterThan') return item.addedDaysAgo > Number(value);
      if (operator === 'lessThan') return item.addedDaysAgo < Number(value);
      break;

    case 'size':
      const sizeInGB = item.size / (1024 * 1024 * 1024);
      if (operator === 'greaterThan') return sizeInGB > Number(value);
      if (operator === 'lessThan') return sizeInGB < Number(value);
      break;

    case 'rating':
      const rating = item.rating || 0;
      if (operator === 'equals') return rating === Number(value);
      if (operator === 'greaterThan') return rating > Number(value);
      if (operator === 'lessThan') return rating < Number(value);
      break;

    case 'year':
      if (operator === 'equals') return item.year === Number(value);
      if (operator === 'greaterThan') return item.year > Number(value);
      if (operator === 'lessThan') return item.year < Number(value);
      break;

    case 'hasFile':
      return item.hasFile === (value === true || value === 'true');

    case 'monitored':
      return item.monitored === (value === true || value === 'true');

    case 'genre':
      const genreValue = String(value).toLowerCase();
      if (operator === 'contains') return item.genres.some(g => g.toLowerCase().includes(genreValue));
      if (operator === 'notContains') return !item.genres.some(g => g.toLowerCase().includes(genreValue));
      if (operator === 'equals') return item.genres.some(g => g.toLowerCase() === genreValue);
      break;

    case 'tag':
      const tagValue = String(value).toLowerCase();
      const itemTagNames = item.tags.map(t => tagMap.get(t)?.toLowerCase() || '');
      if (operator === 'contains') return itemTagNames.some(t => t.includes(tagValue));
      if (operator === 'notContains') return !itemTagNames.some(t => t.includes(tagValue));
      if (operator === 'equals') return itemTagNames.some(t => t === tagValue);
      break;
  }

  return false;
}

/**
 * Sanitize a filename/folder name for filesystem use
 */
function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a symlink, handling platform differences
 */
function createSymlinkSafe(target: string, linkPath: string): void {
  const isWindows = process.platform === 'win32';
  
  if (!fs.existsSync(target)) {
    throw new Error(`Target path does not exist: ${target}`);
  }
  
  const targetStats = fs.statSync(target);
  
  if (isWindows) {
    if (targetStats.isDirectory()) {
      fs.symlinkSync(target, linkPath, 'junction');
    } else {
      fs.symlinkSync(target, linkPath, 'file');
    }
  } else {
    fs.symlinkSync(target, linkPath);
  }
}

// ============================================
// Leaving Soon Service
// ============================================

class LeavingSoonService {
  private syncInterval: NodeJS.Timeout | null = null;

  // ========================================
  // Settings Management
  // ========================================

  async getSetting(key: string): Promise<string> {
    const setting = await prisma.settings.findUnique({ where: { key } });
    return setting?.value ?? DEFAULT_SETTINGS[key] ?? '';
  }

  async getSettings(): Promise<Record<string, string>> {
    const settings = await prisma.settings.findMany({
      where: { key: { in: Object.values(SETTINGS_KEYS) } },
    });

    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    settings.forEach(s => {
      result[s.key] = s.value;
    });

    return result;
  }

  async updateSettings(updates: Record<string, string>): Promise<void> {
    const operations = Object.entries(updates)
      .filter(([key]) => Object.values(SETTINGS_KEYS).includes(key))
      .map(([key, value]) =>
        prisma.settings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );

    await Promise.all(operations);
    logger.info(`Updated Leaving Soon settings`, 'LeavingSoon');

    if (SETTINGS_KEYS.autoSync in updates || SETTINGS_KEYS.syncIntervalMinutes in updates) {
      await this.restartAutoSync();
    }
  }

  // ========================================
  // Auto-Sync Management
  // ========================================

  async startAutoSync(): Promise<void> {
    const settings = await this.getSettings();
    
    if (settings[SETTINGS_KEYS.autoSync] !== 'true' || settings[SETTINGS_KEYS.enabled] !== 'true') {
      logger.info('Leaving Soon auto-sync is disabled', 'LeavingSoon');
      return;
    }

    const intervalMinutes = parseInt(settings[SETTINGS_KEYS.syncIntervalMinutes]) || 60;
    const intervalMs = intervalMinutes * 60 * 1000;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllMediaServers();
      } catch (error) {
        logger.error(`Auto-sync failed: ${error}`, 'LeavingSoon');
      }
    }, intervalMs);

    logger.info(`Leaving Soon auto-sync started (every ${intervalMinutes} minutes)`, 'LeavingSoon');

    // Run initial sync after a short delay
    setTimeout(() => {
      this.syncAllMediaServers().catch(err => {
        logger.error(`Initial sync failed: ${err}`, 'LeavingSoon');
      });
    }, 10000);
  }

  async stopAutoSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Leaving Soon auto-sync stopped', 'LeavingSoon');
    }
  }

  async restartAutoSync(): Promise<void> {
    await this.stopAutoSync();
    await this.startAutoSync();
  }

  // ========================================
  // Find Items Targeted by Rules
  // ========================================

  async getTargetedItems(): Promise<TargetedItem[]> {
    const settings = await this.getSettings();
    
    if (settings[SETTINGS_KEYS.enabled] !== 'true') {
      return [];
    }

    const rules = await prisma.rule.findMany({
      where: {
        isEnabled: true,
        isActive: true,
        showInCollection: true,
        gracePeriodDays: { gt: 0 },
      },
      include: {
        arrApp: true,
      },
    });

    const targetedItems: TargetedItem[] = [];
    const now = new Date();

    // Get Jellystat client if available
    let jellystatClient: JellystatClient | null = null;
    const statsService = await prisma.statisticsService.findFirst({
      where: { isEnabled: true, type: 'jellystat' },
    });
    if (statsService) {
      jellystatClient = new JellystatClient({
        url: statsService.url,
        apiKey: statsService.apiKey,
      });
    }

    for (const rule of rules) {
      if (!rule.arrApp) continue;

      const conditions: RuleCondition[] = JSON.parse(rule.conditions);
      const needsWatchHistory = conditions.some(c => c.field === 'lastWatched');

      try {
        if (rule.arrApp.type === 'radarr' && rule.mediaType === 'movie') {
          const client = new RadarrClient({
            url: rule.arrApp.url,
            apiKey: rule.arrApp.apiKey,
          });

          const [movies, tags] = await Promise.all([
            client.getMovies(),
            client.getTags(),
          ]);

          const tagMap = new Map(tags.map(t => [t.id, t.label]));
          
          // Get watch history if needed
          const watchHistory = new Map<string, Date>();
          if (needsWatchHistory && jellystatClient && movies.length > 0) {
            try {
              const tmdbIds = movies.map(m => String(m.tmdbId)).filter(Boolean);
              const lastPlayedData = await jellystatClient.batchGetLastPlayed(tmdbIds);
              lastPlayedData.forEach((data, itemId) => {
                if (data?.LastPlayed) {
                  watchHistory.set(itemId, new Date(data.LastPlayed));
                }
              });
            } catch {
              logger.warn('Failed to fetch movie watch history', 'LeavingSoon');
            }
          }

          for (const movie of movies) {
            if (!movie.hasFile || !movie.path) continue;

            const addedDaysAgo = daysSince(movie.added);
            const lastWatchedDate = watchHistory.get(String(movie.tmdbId));
            const lastWatchedDaysAgo = lastWatchedDate ? daysSince(lastWatchedDate.toISOString()) : null;

            const itemData = {
              addedDaysAgo,
              size: movie.sizeOnDisk,
              rating: movie.ratings?.value,
              year: movie.year,
              hasFile: movie.hasFile,
              monitored: movie.monitored,
              genres: movie.genres || [],
              tags: movie.tags || [],
              lastWatchedDaysAgo,
            };

            const allMatch = conditions.every(condition => 
              evaluateCondition(condition, itemData, tagMap)
            );

            if (allMatch) {
              const expiresAt = new Date(movie.added);
              expiresAt.setDate(expiresAt.getDate() + rule.gracePeriodDays);

              if (expiresAt > now) {
                // Translate path from Arr to local
                const localPath = await pathMappingService.translateArrToLocal(
                  movie.path,
                  rule.arrAppId
                );

                targetedItems.push({
                  id: movie.id,
                  title: movie.title,
                  year: movie.year,
                  mediaType: 'movie',
                  externalId: String(movie.tmdbId),
                  arrPath: movie.path,
                  localPath,
                  arrAppId: rule.arrAppId,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  expiresAt,
                  addedAt: new Date(movie.added),
                  daysUntilExpiry: daysUntil(expiresAt),
                });
              }
            }
          }
        } else if (rule.arrApp.type === 'sonarr' && rule.mediaType === 'series') {
          const client = new SonarrClient({
            url: rule.arrApp.url,
            apiKey: rule.arrApp.apiKey,
          });

          const [series, tags] = await Promise.all([
            client.getSeries(),
            client.getTags(),
          ]);

          const tagMap = new Map(tags.map(t => [t.id, t.label]));

          // Get watch history if needed
          const watchHistory = new Map<string, Date>();
          if (needsWatchHistory && jellystatClient && series.length > 0) {
            try {
              const tvdbIds = series.map(s => String(s.tvdbId)).filter(Boolean);
              const lastPlayedData = await jellystatClient.batchGetLastPlayed(tvdbIds);
              lastPlayedData.forEach((data, itemId) => {
                if (data?.LastPlayed) {
                  watchHistory.set(itemId, new Date(data.LastPlayed));
                }
              });
            } catch {
              logger.warn('Failed to fetch series watch history', 'LeavingSoon');
            }
          }

          for (const show of series) {
            if (!show.path || (show.statistics?.episodeFileCount || 0) === 0) continue;

            const addedDaysAgo = daysSince(show.added);
            const lastWatchedDate = watchHistory.get(String(show.tvdbId));
            const lastWatchedDaysAgo = lastWatchedDate ? daysSince(lastWatchedDate.toISOString()) : null;

            const itemData = {
              addedDaysAgo,
              size: show.statistics?.sizeOnDisk || 0,
              rating: show.ratings?.value,
              year: show.year,
              hasFile: (show.statistics?.episodeFileCount || 0) > 0,
              monitored: show.monitored,
              genres: show.genres || [],
              tags: show.tags || [],
              lastWatchedDaysAgo,
            };

            const allMatch = conditions.every(condition => 
              evaluateCondition(condition, itemData, tagMap)
            );

            if (allMatch) {
              const expiresAt = new Date(show.added);
              expiresAt.setDate(expiresAt.getDate() + rule.gracePeriodDays);

              if (expiresAt > now) {
                const localPath = await pathMappingService.translateArrToLocal(
                  show.path,
                  rule.arrAppId
                );

                targetedItems.push({
                  id: show.id,
                  title: show.title,
                  year: show.year,
                  mediaType: 'series',
                  externalId: String(show.tvdbId),
                  arrPath: show.path,
                  localPath,
                  arrAppId: rule.arrAppId,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  expiresAt,
                  addedAt: new Date(show.added),
                  daysUntilExpiry: daysUntil(expiresAt),
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to evaluate rule ${rule.name}: ${error}`, 'LeavingSoon');
      }
    }

    // Deduplicate items - keep the one that expires soonest
    const uniqueItems = new Map<string, TargetedItem>();
    for (const item of targetedItems) {
      const key = `${item.mediaType}:${item.localPath}`;
      const existing = uniqueItems.get(key);
      if (!existing || item.expiresAt < existing.expiresAt) {
        uniqueItems.set(key, item);
      }
    }

    return Array.from(uniqueItems.values()).sort((a, b) => 
      a.expiresAt.getTime() - b.expiresAt.getTime()
    );
  }

  // ========================================
  // Symlink Management (Per Media Server)
  // ========================================

  /**
   * Sync symlinks for all configured media servers
   */
  async syncAllMediaServers(): Promise<MediaServerSyncResult[]> {
    const settings = await this.getSettings();
    
    if (settings[SETTINGS_KEYS.enabled] !== 'true') {
      return [];
    }

    const mediaServers = await prisma.mediaServer.findMany({
      where: {
        isEnabled: true,
        type: { in: ['jellyfin', 'emby'] },
      },
    });

    // Filter to only servers with leaving soon paths configured
    const configuredServers = mediaServers.filter(
      s => s.leavingSoonMoviesPath || s.leavingSoonTvPath
    );

    if (configuredServers.length === 0) {
      logger.info('No media servers have Leaving Soon paths configured', 'LeavingSoon');
      return [];
    }

    const items = await this.getTargetedItems();
    const results: MediaServerSyncResult[] = [];

    for (const server of configuredServers) {
      const result = await this.syncMediaServer(server.id, items);
      results.push(result);
    }

    // Refresh libraries if enabled
    if (settings[SETTINGS_KEYS.refreshLibraryAfterSync] === 'true') {
      const anyChanges = results.some(
        r => r.moviesCreated > 0 || r.moviesRemoved > 0 || r.tvCreated > 0 || r.tvRemoved > 0
      );
      if (anyChanges) {
        await this.refreshAllMediaServers();
      }
    }

    return results;
  }

  /**
   * Sync symlinks for a specific media server
   */
  async syncMediaServer(
    mediaServerId: number,
    items?: TargetedItem[]
  ): Promise<MediaServerSyncResult> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
    });

    if (!mediaServer) {
      return {
        mediaServerId,
        mediaServerName: 'Unknown',
        success: false,
        moviesCreated: 0,
        moviesRemoved: 0,
        tvCreated: 0,
        tvRemoved: 0,
        errors: ['Media server not found'],
      };
    }

    const targetedItems = items ?? await this.getTargetedItems();
    const errors: string[] = [];
    let moviesCreated = 0, moviesRemoved = 0, tvCreated = 0, tvRemoved = 0;

    // Process movies
    if (mediaServer.leavingSoonMoviesPath) {
      const movieResult = await this.syncSymlinksForPath(
        mediaServer.leavingSoonMoviesPath,
        targetedItems.filter(i => i.mediaType === 'movie')
      );
      moviesCreated = movieResult.created;
      moviesRemoved = movieResult.removed;
      errors.push(...movieResult.errors);
    }

    // Process TV shows
    if (mediaServer.leavingSoonTvPath) {
      const tvResult = await this.syncSymlinksForPath(
        mediaServer.leavingSoonTvPath,
        targetedItems.filter(i => i.mediaType === 'series')
      );
      tvCreated = tvResult.created;
      tvRemoved = tvResult.removed;
      errors.push(...tvResult.errors);
    }

    logger.info(
      `Synced ${mediaServer.name}: Movies +${moviesCreated}/-${moviesRemoved}, TV +${tvCreated}/-${tvRemoved}`,
      'LeavingSoon'
    );

    return {
      mediaServerId,
      mediaServerName: mediaServer.name,
      success: errors.length === 0,
      moviesCreated,
      moviesRemoved,
      tvCreated,
      tvRemoved,
      errors,
    };
  }

  private async syncSymlinksForPath(
    basePath: string,
    items: TargetedItem[]
  ): Promise<{ created: number; removed: number; errors: string[] }> {
    let created = 0;
    let removed = 0;
    const errors: string[] = [];

    // Ensure directory exists
    try {
      if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
        logger.info(`Created directory: ${basePath}`, 'LeavingSoon');
      }
    } catch (error: any) {
      errors.push(`Failed to create directory ${basePath}: ${error.message}`);
      return { created, removed, errors };
    }

    // Build expected symlink names
    const expectedLinks = new Map<string, TargetedItem>();
    for (const item of items) {
      const linkName = sanitizeName(`${item.title} (${item.year})`);
      expectedLinks.set(linkName, item);
    }

    // Get current symlinks
    let currentEntries: string[] = [];
    try {
      currentEntries = fs.readdirSync(basePath);
    } catch (error: any) {
      errors.push(`Failed to read directory ${basePath}: ${error.message}`);
      return { created, removed, errors };
    }

    // Remove stale symlinks
    for (const entry of currentEntries) {
      if (!expectedLinks.has(entry)) {
        const linkPath = path.join(basePath, entry);
        try {
          const stats = fs.lstatSync(linkPath);
          if (stats.isSymbolicLink()) {
            fs.unlinkSync(linkPath);
            removed++;
            logger.debug(`Removed stale symlink: ${linkPath}`, 'LeavingSoon');
          }
        } catch (error: any) {
          errors.push(`Failed to remove ${linkPath}: ${error.message}`);
        }
      }
    }

    // Create new symlinks
    for (const [linkName, item] of expectedLinks) {
      const linkPath = path.join(basePath, linkName);

      try {
        // Check if symlink already exists
        if (fs.existsSync(linkPath)) {
          const stats = fs.lstatSync(linkPath);
          if (stats.isSymbolicLink()) {
            const currentTarget = fs.readlinkSync(linkPath);
            if (currentTarget === item.localPath) {
              continue; // Already correct
            }
            fs.unlinkSync(linkPath); // Wrong target, recreate
          } else {
            continue; // Not a symlink, skip
          }
        }

        // Verify target exists
        if (!fs.existsSync(item.localPath)) {
          logger.warn(`Target path does not exist, skipping: ${item.localPath}`, 'LeavingSoon');
          continue;
        }

        // Create symlink
        createSymlinkSafe(item.localPath, linkPath);
        created++;
        logger.debug(`Created symlink: ${linkPath} -> ${item.localPath}`, 'LeavingSoon');
      } catch (error: any) {
        errors.push(`Failed to create symlink for "${item.title}": ${error.message}`);
      }
    }

    return { created, removed, errors };
  }

  /**
   * Clear all symlinks for a media server
   */
  async clearMediaServerSymlinks(mediaServerId: number): Promise<{ removed: number; errors: string[] }> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
    });

    if (!mediaServer) {
      return { removed: 0, errors: ['Media server not found'] };
    }

    let removed = 0;
    const errors: string[] = [];

    const paths = [mediaServer.leavingSoonMoviesPath, mediaServer.leavingSoonTvPath].filter(Boolean);

    for (const basePath of paths) {
      if (!basePath || !fs.existsSync(basePath)) continue;

      try {
        const entries = fs.readdirSync(basePath);
        for (const entry of entries) {
          const fullPath = path.join(basePath, entry);
          try {
            const stats = fs.lstatSync(fullPath);
            if (stats.isSymbolicLink()) {
              fs.unlinkSync(fullPath);
              removed++;
            }
          } catch (error: any) {
            errors.push(`Failed to remove ${fullPath}: ${error.message}`);
          }
        }
      } catch (error: any) {
        errors.push(`Failed to process ${basePath}: ${error.message}`);
      }
    }

    logger.info(`Cleared ${removed} symlinks for ${mediaServer.name}`, 'LeavingSoon');
    return { removed, errors };
  }

  // ========================================
  // Media Server Library Refresh
  // ========================================

  async refreshAllMediaServers(): Promise<LibraryRefreshResult[]> {
    const results: LibraryRefreshResult[] = [];
    
    const mediaServers = await prisma.mediaServer.findMany({
      where: {
        isEnabled: true,
        type: { in: ['jellyfin', 'emby'] },
      },
    });

    for (const server of mediaServers) {
      const result = await this.refreshMediaServer(server.id);
      results.push(result);
    }

    return results;
  }

  async refreshMediaServer(mediaServerId: number): Promise<LibraryRefreshResult> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
    });

    if (!mediaServer) {
      return {
        success: false,
        message: 'Media server not found',
        serverName: 'Unknown',
      };
    }

    try {
      if (mediaServer.type === 'jellyfin') {
        const client = new JellyfinClient({
          url: mediaServer.url,
          apiKey: mediaServer.apiKey,
        });
        await client.refreshLibrary();
      } else if (mediaServer.type === 'emby') {
        const client = new EmbyClient({
          url: mediaServer.url,
          apiKey: mediaServer.apiKey,
        });
        await client.refreshLibrary();
      }
      
      logger.info(`Triggered library refresh for ${mediaServer.name}`, 'LeavingSoon');
      return {
        success: true,
        message: 'Library refresh triggered',
        serverName: mediaServer.name,
      };
    } catch (error: any) {
      logger.error(`Failed to refresh library for ${mediaServer.name}: ${error.message}`, 'LeavingSoon');
      return {
        success: false,
        message: `Failed: ${error.message}`,
        serverName: mediaServer.name,
      };
    }
  }

  // ========================================
  // Status & Info
  // ========================================

  async getStatus(): Promise<{
    enabled: boolean;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    configuredServers: Array<{
      id: number;
      name: string;
      type: string;
      hasMoviesPath: boolean;
      hasTvPath: boolean;
    }>;
    targetedItemCount: number;
  }> {
    const settings = await this.getSettings();
    const items = await this.getTargetedItems();

    const mediaServers = await prisma.mediaServer.findMany({
      where: {
        isEnabled: true,
        type: { in: ['jellyfin', 'emby'] },
      },
      select: {
        id: true,
        name: true,
        type: true,
        leavingSoonMoviesPath: true,
        leavingSoonTvPath: true,
      },
    });

    const configuredServers = mediaServers.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      hasMoviesPath: !!s.leavingSoonMoviesPath,
      hasTvPath: !!s.leavingSoonTvPath,
    }));

    return {
      enabled: settings[SETTINGS_KEYS.enabled] === 'true',
      autoSyncEnabled: settings[SETTINGS_KEYS.autoSync] === 'true',
      syncIntervalMinutes: parseInt(settings[SETTINGS_KEYS.syncIntervalMinutes]) || 60,
      configuredServers,
      targetedItemCount: items.length,
    };
  }

  /**
   * Get symlink statistics for a specific media server
   */
  async getSymlinkStats(mediaServerId: number): Promise<{
    moviesPath: string | null;
    tvPath: string | null;
    movieCount: number;
    tvCount: number;
    totalCount: number;
  }> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
    });

    if (!mediaServer) {
      return {
        moviesPath: null,
        tvPath: null,
        movieCount: 0,
        tvCount: 0,
        totalCount: 0,
      };
    }

    let movieCount = 0;
    let tvCount = 0;

    if (mediaServer.leavingSoonMoviesPath && fs.existsSync(mediaServer.leavingSoonMoviesPath)) {
      try {
        const entries = fs.readdirSync(mediaServer.leavingSoonMoviesPath);
        movieCount = entries.filter(e => {
          try {
            return fs.lstatSync(path.join(mediaServer.leavingSoonMoviesPath!, e)).isSymbolicLink();
          } catch { return false; }
        }).length;
      } catch {}
    }

    if (mediaServer.leavingSoonTvPath && fs.existsSync(mediaServer.leavingSoonTvPath)) {
      try {
        const entries = fs.readdirSync(mediaServer.leavingSoonTvPath);
        tvCount = entries.filter(e => {
          try {
            return fs.lstatSync(path.join(mediaServer.leavingSoonTvPath!, e)).isSymbolicLink();
          } catch { return false; }
        }).length;
      } catch {}
    }

    return {
      moviesPath: mediaServer.leavingSoonMoviesPath,
      tvPath: mediaServer.leavingSoonTvPath,
      movieCount,
      tvCount,
      totalCount: movieCount + tvCount,
    };
  }
}

// Export singleton instance
export const leavingSoonService = new LeavingSoonService();
export default leavingSoonService;
