import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface SonarrConfig {
  url: string;
  apiKey: string;
}

export interface SonarrImage {
  coverType: string;
  url: string;
  remoteUrl?: string;  // Direct TVDB/TMDB URL when available
}

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  ended: boolean;
  overview?: string;
  previousAiring?: string;
  nextAiring?: string;
  network?: string;
  airTime?: string;
  images: SonarrImage[];
  seasons: SonarrSeason[];
  year: number;
  path: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  useSceneNumbering: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId?: number;
  tvMazeId?: number;
  firstAired?: string;
  seriesType: string;
  cleanTitle: string;
  imdbId?: string;
  titleSlug: string;
  certification?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics?: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
  statistics?: {
    previousAiring?: string;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate?: string;
  airDateUtc?: string;
  overview?: string;
  hasFile: boolean;
  monitored: boolean;
  unverifiedSceneNumbering: boolean;
  grabbed: boolean;
  episodeFile?: {
    id: number;
    seriesId: number;
    seasonNumber: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string } };
    mediaInfo?: {
      videoBitrate: number;
      audioBitrate: number;
      audioChannels: number;
      audioCodec: string;
      videoCodec: string;
      resolution: string;
      runTime: string;
    };
  };
}

export interface SonarrTag {
  id: number;
  label: string;
}

export interface SonarrQualityProfile {
  id: number;
  name: string;
}

export interface SonarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
}

export interface SonarrSystemStatus {
  appName: string;
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
}

export class SonarrClient {
  private client: AxiosInstance;
  private config: SonarrConfig;

  constructor(config: SonarrConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.url.replace(/\/$/, '')}/api/v3`,
      headers: {
        'X-Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ============================================
  // Connection & System
  // ============================================

  async testConnection(): Promise<{ success: boolean; message: string; systemInfo?: SonarrSystemStatus }> {
    try {
      const response = await this.client.get<SonarrSystemStatus>('/system/status');
      logger.info(`Connected to Sonarr: v${response.data.version}`);
      return {
        success: true,
        message: `Connected to Sonarr v${response.data.version}`,
        systemInfo: response.data,
      };
    } catch (error: any) {
      logger.error(`Sonarr connection failed: ${error.message}`);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  async getSystemStatus(): Promise<SonarrSystemStatus> {
    const response = await this.client.get<SonarrSystemStatus>('/system/status');
    return response.data;
  }

  async getDiskSpace(): Promise<{ path: string; label: string; freeSpace: number; totalSpace: number }[]> {
    const response = await this.client.get('/diskspace');
    return response.data;
  }

  // ============================================
  // Series
  // ============================================

  async getSeries(): Promise<SonarrSeries[]> {
    const response = await this.client.get<SonarrSeries[]>('/series');
    return response.data;
  }

  async getSeriesById(id: number): Promise<SonarrSeries> {
    const response = await this.client.get<SonarrSeries>(`/series/${id}`);
    return response.data;
  }

  async getSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null> {
    const series = await this.getSeries();
    return series.find(s => s.tvdbId === tvdbId) || null;
  }

  async updateSeries(series: SonarrSeries): Promise<SonarrSeries> {
    const response = await this.client.put<SonarrSeries>(`/series/${series.id}`, series);
    return response.data;
  }

  async deleteSeries(id: number, deleteFiles: boolean = false, addImportListExclusion: boolean = false): Promise<void> {
    await this.client.delete(`/series/${id}`, {
      params: {
        deleteFiles,
        addImportListExclusion,
      },
    });
    logger.info(`Deleted series ${id} from Sonarr (deleteFiles: ${deleteFiles})`);
  }

  // ============================================
  // Episodes
  // ============================================

  async getEpisodesBySeriesId(seriesId: number): Promise<SonarrEpisode[]> {
    const response = await this.client.get<SonarrEpisode[]>('/episode', {
      params: { seriesId },
    });
    return response.data;
  }

  async getEpisodesBySeason(seriesId: number, seasonNumber: number): Promise<SonarrEpisode[]> {
    const episodes = await this.getEpisodesBySeriesId(seriesId);
    return episodes.filter(e => e.seasonNumber === seasonNumber);
  }

  async getEpisode(episodeId: number): Promise<SonarrEpisode> {
    const response = await this.client.get<SonarrEpisode>(`/episode/${episodeId}`);
    return response.data;
  }

  async setEpisodeMonitored(episodeId: number, monitored: boolean): Promise<SonarrEpisode> {
    const episode = await this.getEpisode(episodeId);
    episode.monitored = monitored;
    const response = await this.client.put<SonarrEpisode>(`/episode/${episodeId}`, episode);
    return response.data;
  }

  // ============================================
  // Episode Files
  // ============================================

  async getEpisodeFile(episodeFileId: number): Promise<any> {
    const response = await this.client.get(`/episodefile/${episodeFileId}`);
    return response.data;
  }

  async deleteEpisodeFile(episodeFileId: number): Promise<void> {
    await this.client.delete(`/episodefile/${episodeFileId}`);
    logger.info(`Deleted episode file ${episodeFileId} from Sonarr`);
  }

  async deleteEpisodeFiles(episodeFileIds: number[]): Promise<void> {
    await this.client.delete('/episodefile/bulk', {
      data: { episodeFileIds },
    });
    logger.info(`Deleted ${episodeFileIds.length} episode files from Sonarr`);
  }

  // ============================================
  // Monitoring
  // ============================================

  async setSeriesMonitored(seriesId: number, monitored: boolean): Promise<SonarrSeries> {
    const series = await this.getSeriesById(seriesId);
    series.monitored = monitored;
    return this.updateSeries(series);
  }

  async unmonitorSeries(seriesId: number): Promise<SonarrSeries> {
    return this.setSeriesMonitored(seriesId, false);
  }

  async monitorSeries(seriesId: number): Promise<SonarrSeries> {
    return this.setSeriesMonitored(seriesId, true);
  }

  async setSeasonMonitored(seriesId: number, seasonNumber: number, monitored: boolean): Promise<SonarrSeries> {
    const series = await this.getSeriesById(seriesId);
    const season = series.seasons.find(s => s.seasonNumber === seasonNumber);
    if (season) {
      season.monitored = monitored;
    }
    return this.updateSeries(series);
  }

  // ============================================
  // Tags
  // ============================================

  async getTags(): Promise<SonarrTag[]> {
    const response = await this.client.get<SonarrTag[]>('/tag');
    return response.data;
  }

  async getTag(id: number): Promise<SonarrTag> {
    const response = await this.client.get<SonarrTag>(`/tag/${id}`);
    return response.data;
  }

  async createTag(label: string): Promise<SonarrTag> {
    const response = await this.client.post<SonarrTag>('/tag', { label });
    return response.data;
  }

  async getOrCreateTag(label: string): Promise<SonarrTag> {
    const tags = await this.getTags();
    const existing = tags.find(t => t.label.toLowerCase() === label.toLowerCase());
    if (existing) return existing;
    return this.createTag(label);
  }

  async addTagToSeries(seriesId: number, tagId: number): Promise<SonarrSeries> {
    const series = await this.getSeriesById(seriesId);
    if (!series.tags.includes(tagId)) {
      series.tags.push(tagId);
      return this.updateSeries(series);
    }
    return series;
  }

  async removeTagFromSeries(seriesId: number, tagId: number): Promise<SonarrSeries> {
    const series = await this.getSeriesById(seriesId);
    series.tags = series.tags.filter(t => t !== tagId);
    return this.updateSeries(series);
  }

  // ============================================
  // Quality Profiles
  // ============================================

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    const response = await this.client.get<SonarrQualityProfile[]>('/qualityprofile');
    return response.data;
  }

  // ============================================
  // Root Folders
  // ============================================

  async getRootFolders(): Promise<SonarrRootFolder[]> {
    const response = await this.client.get<SonarrRootFolder[]>('/rootfolder');
    return response.data;
  }

  // ============================================
  // History
  // ============================================

  async getHistory(params?: {
    page?: number;
    pageSize?: number;
    sortKey?: string;
    sortDirection?: 'ascending' | 'descending';
    eventType?: string;
  }): Promise<{ page: number; pageSize: number; totalRecords: number; records: any[] }> {
    const response = await this.client.get('/history', {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 50,
        sortKey: params?.sortKey || 'date',
        sortDirection: params?.sortDirection || 'descending',
        eventType: params?.eventType,
      },
    });
    return response.data;
  }

  async getSeriesHistory(seriesId: number): Promise<any[]> {
    const response = await this.client.get(`/history/series`, {
      params: { seriesId },
    });
    return response.data;
  }

  // ============================================
  // Import Lists (Exclusions)
  // ============================================

  async getExclusions(): Promise<{ id: number; tvdbId: number; title: string }[]> {
    const response = await this.client.get('/importlistexclusion');
    return response.data;
  }

  async addExclusion(tvdbId: number, title: string): Promise<void> {
    await this.client.post('/importlistexclusion', { tvdbId, title });
    logger.info(`Added exclusion for ${title}`);
  }

  // ============================================
  // Commands (Manual Actions)
  // ============================================

  async refreshSeries(seriesId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'RefreshSeries',
      seriesId,
    });
  }

  async rescanSeries(seriesId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'RescanSeries',
      seriesId,
    });
  }

  async searchSeries(seriesId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'SeriesSearch',
      seriesId,
    });
  }

  async searchSeason(seriesId: number, seasonNumber: number): Promise<void> {
    await this.client.post('/command', {
      name: 'SeasonSearch',
      seriesId,
      seasonNumber,
    });
  }
}

export default SonarrClient;
