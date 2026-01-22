import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface RadarrConfig {
  url: string;
  apiKey: string;
}

export interface RadarrImage {
  coverType: string;
  url: string;
  remoteUrl?: string;  // Direct TMDB URL when available
}

export interface RadarrMovie {
  id: number;
  title: string;
  originalTitle?: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: string;
  overview?: string;
  inCinemas?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  images: RadarrImage[];
  website?: string;
  year: number;
  hasFile: boolean;
  youTubeTrailerId?: string;
  studio?: string;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: string;
  isAvailable: boolean;
  folderName: string;
  runtime: number;
  cleanTitle: string;
  imdbId?: string;
  tmdbId: number;
  titleSlug: string;
  certification?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  movieFile?: {
    id: number;
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

export interface RadarrTag {
  id: number;
  label: string;
}

export interface RadarrQualityProfile {
  id: number;
  name: string;
}

export interface RadarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
}

export interface RadarrSystemStatus {
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

export class RadarrClient {
  private client: AxiosInstance;
  private config: RadarrConfig;

  constructor(config: RadarrConfig) {
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

  async testConnection(): Promise<{ success: boolean; message: string; systemInfo?: RadarrSystemStatus }> {
    try {
      const response = await this.client.get<RadarrSystemStatus>('/system/status');
      logger.info(`Connected to Radarr: v${response.data.version}`);
      return {
        success: true,
        message: `Connected to Radarr v${response.data.version}`,
        systemInfo: response.data,
      };
    } catch (error: any) {
      logger.error(`Radarr connection failed: ${error.message}`);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  async getSystemStatus(): Promise<RadarrSystemStatus> {
    const response = await this.client.get<RadarrSystemStatus>('/system/status');
    return response.data;
  }

  async getDiskSpace(): Promise<{ path: string; label: string; freeSpace: number; totalSpace: number }[]> {
    const response = await this.client.get('/diskspace');
    return response.data;
  }

  // ============================================
  // Movies
  // ============================================

  async getMovies(): Promise<RadarrMovie[]> {
    const response = await this.client.get<RadarrMovie[]>('/movie');
    return response.data;
  }

  async getMovie(id: number): Promise<RadarrMovie> {
    const response = await this.client.get<RadarrMovie>(`/movie/${id}`);
    return response.data;
  }

  async getMovieByTmdbId(tmdbId: number): Promise<RadarrMovie | null> {
    const movies = await this.getMovies();
    return movies.find(m => m.tmdbId === tmdbId) || null;
  }

  async getMovieByImdbId(imdbId: string): Promise<RadarrMovie | null> {
    const movies = await this.getMovies();
    return movies.find(m => m.imdbId === imdbId) || null;
  }

  async updateMovie(movie: RadarrMovie): Promise<RadarrMovie> {
    const response = await this.client.put<RadarrMovie>(`/movie/${movie.id}`, movie);
    return response.data;
  }

  async deleteMovie(id: number, deleteFiles: boolean = false, addImportExclusion: boolean = false): Promise<void> {
    await this.client.delete(`/movie/${id}`, {
      params: {
        deleteFiles,
        addImportExclusion,
      },
    });
    logger.info(`Deleted movie ${id} from Radarr (deleteFiles: ${deleteFiles})`);
  }

  // ============================================
  // Monitoring
  // ============================================

  async setMonitored(movieId: number, monitored: boolean): Promise<RadarrMovie> {
    const movie = await this.getMovie(movieId);
    movie.monitored = monitored;
    return this.updateMovie(movie);
  }

  async unmonitorMovie(movieId: number): Promise<RadarrMovie> {
    return this.setMonitored(movieId, false);
  }

  async monitorMovie(movieId: number): Promise<RadarrMovie> {
    return this.setMonitored(movieId, true);
  }

  // ============================================
  // Tags
  // ============================================

  async getTags(): Promise<RadarrTag[]> {
    const response = await this.client.get<RadarrTag[]>('/tag');
    return response.data;
  }

  async getTag(id: number): Promise<RadarrTag> {
    const response = await this.client.get<RadarrTag>(`/tag/${id}`);
    return response.data;
  }

  async createTag(label: string): Promise<RadarrTag> {
    const response = await this.client.post<RadarrTag>('/tag', { label });
    return response.data;
  }

  async getOrCreateTag(label: string): Promise<RadarrTag> {
    const tags = await this.getTags();
    const existing = tags.find(t => t.label.toLowerCase() === label.toLowerCase());
    if (existing) return existing;
    return this.createTag(label);
  }

  async addTagToMovie(movieId: number, tagId: number): Promise<RadarrMovie> {
    const movie = await this.getMovie(movieId);
    if (!movie.tags.includes(tagId)) {
      movie.tags.push(tagId);
      return this.updateMovie(movie);
    }
    return movie;
  }

  async removeTagFromMovie(movieId: number, tagId: number): Promise<RadarrMovie> {
    const movie = await this.getMovie(movieId);
    movie.tags = movie.tags.filter(t => t !== tagId);
    return this.updateMovie(movie);
  }

  // ============================================
  // Quality Profiles
  // ============================================

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    const response = await this.client.get<RadarrQualityProfile[]>('/qualityprofile');
    return response.data;
  }

  // ============================================
  // Root Folders
  // ============================================

  async getRootFolders(): Promise<RadarrRootFolder[]> {
    const response = await this.client.get<RadarrRootFolder[]>('/rootfolder');
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

  async getMovieHistory(movieId: number): Promise<any[]> {
    const response = await this.client.get(`/history/movie`, {
      params: { movieId },
    });
    return response.data;
  }

  // ============================================
  // Import Lists (Exclusions)
  // ============================================

  async getExclusions(): Promise<{ id: number; tmdbId: number; movieTitle: string; movieYear: number }[]> {
    const response = await this.client.get('/exclusions');
    return response.data;
  }

  async addExclusion(tmdbId: number, movieTitle: string, movieYear: number): Promise<void> {
    await this.client.post('/exclusions', { tmdbId, movieTitle, movieYear });
    logger.info(`Added exclusion for ${movieTitle} (${movieYear})`);
  }

  // ============================================
  // Commands (Manual Actions)
  // ============================================

  async refreshMovie(movieId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'RefreshMovie',
      movieIds: [movieId],
    });
  }

  async rescanMovie(movieId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'RescanMovie',
      movieId,
    });
  }

  async searchMovie(movieId: number): Promise<void> {
    await this.client.post('/command', {
      name: 'MoviesSearch',
      movieIds: [movieId],
    });
  }
}

export default RadarrClient;
