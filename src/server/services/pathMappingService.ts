import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface ArrPathMapping {
  arrPath: string;      // Path as seen by Radarr/Sonarr
  localPath: string;    // Path as mounted in Sweeparr container
}

export interface MediaServerPathMapping {
  localPath: string;        // Path in Sweeparr container
  mediaServerPath: string;  // Path as seen by media server
}

export interface TranslatedPath {
  original: string;
  local: string;
  mediaServer?: string;
}

// ============================================
// Path Mapping Service
// ============================================

class PathMappingService {

  // ========================================
  // Arr App Path Translation
  // ========================================

  /**
   * Get path mappings for an Arr app
   */
  async getArrPathMappings(arrAppId: number): Promise<ArrPathMapping[]> {
    const arrApp = await prisma.arrApp.findUnique({
      where: { id: arrAppId },
      select: { pathMappings: true },
    });

    if (!arrApp?.pathMappings) return [];

    try {
      return JSON.parse(arrApp.pathMappings);
    } catch {
      return [];
    }
  }

  /**
   * Update path mappings for an Arr app
   */
  async setArrPathMappings(arrAppId: number, mappings: ArrPathMapping[]): Promise<void> {
    // Normalize paths
    const normalized = mappings.map(m => ({
      arrPath: this.normalizePath(m.arrPath),
      localPath: this.normalizePath(m.localPath),
    }));

    await prisma.arrApp.update({
      where: { id: arrAppId },
      data: { pathMappings: JSON.stringify(normalized) },
    });

    logger.info(`Updated path mappings for Arr app ${arrAppId}`, 'PathMapping');
  }

  /**
   * Translate a path from Arr format to local (Sweeparr) format
   */
  async translateArrToLocal(arrPath: string, arrAppId: number): Promise<string> {
    const mappings = await this.getArrPathMappings(arrAppId);
    const normalizedArrPath = this.normalizePath(arrPath);

    for (const mapping of mappings) {
      const normalizedMappingArrPath = this.normalizePath(mapping.arrPath);
      
      if (normalizedArrPath.toLowerCase().startsWith(normalizedMappingArrPath.toLowerCase())) {
        const relativePath = normalizedArrPath.substring(normalizedMappingArrPath.length);
        return this.joinPaths(mapping.localPath, relativePath);
      }
    }

    // No mapping found - return original
    logger.debug(`No Arr path mapping found for: ${arrPath} (arrAppId: ${arrAppId})`, 'PathMapping');
    return normalizedArrPath;
  }

  // ========================================
  // Media Server Path Translation
  // ========================================

  /**
   * Get path mappings for a media server
   */
  async getMediaServerPathMappings(mediaServerId: number): Promise<MediaServerPathMapping[]> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
      select: { pathMappings: true },
    });

    if (!mediaServer?.pathMappings) return [];

    try {
      return JSON.parse(mediaServer.pathMappings);
    } catch {
      return [];
    }
  }

  /**
   * Update path mappings for a media server
   */
  async setMediaServerPathMappings(mediaServerId: number, mappings: MediaServerPathMapping[]): Promise<void> {
    const normalized = mappings.map(m => ({
      localPath: this.normalizePath(m.localPath),
      mediaServerPath: this.normalizePath(m.mediaServerPath),
    }));

    await prisma.mediaServer.update({
      where: { id: mediaServerId },
      data: { pathMappings: JSON.stringify(normalized) },
    });

    logger.info(`Updated path mappings for media server ${mediaServerId}`, 'PathMapping');
  }

  /**
   * Translate a local path to media server format
   */
  async translateLocalToMediaServer(localPath: string, mediaServerId: number): Promise<string> {
    const mappings = await this.getMediaServerPathMappings(mediaServerId);
    const normalizedLocalPath = this.normalizePath(localPath);

    for (const mapping of mappings) {
      const normalizedMappingLocalPath = this.normalizePath(mapping.localPath);
      
      if (normalizedLocalPath.toLowerCase().startsWith(normalizedMappingLocalPath.toLowerCase())) {
        const relativePath = normalizedLocalPath.substring(normalizedMappingLocalPath.length);
        return this.joinPaths(mapping.mediaServerPath, relativePath);
      }
    }

    // No mapping found - return original
    logger.debug(`No media server path mapping found for: ${localPath} (mediaServerId: ${mediaServerId})`, 'PathMapping');
    return normalizedLocalPath;
  }

  /**
   * Translate a media server path to local format
   */
  async translateMediaServerToLocal(mediaServerPath: string, mediaServerId: number): Promise<string> {
    const mappings = await this.getMediaServerPathMappings(mediaServerId);
    const normalizedMsPath = this.normalizePath(mediaServerPath);

    for (const mapping of mappings) {
      const normalizedMappingMsPath = this.normalizePath(mapping.mediaServerPath);
      
      if (normalizedMsPath.toLowerCase().startsWith(normalizedMappingMsPath.toLowerCase())) {
        const relativePath = normalizedMsPath.substring(normalizedMappingMsPath.length);
        return this.joinPaths(mapping.localPath, relativePath);
      }
    }

    return normalizedMsPath;
  }

  // ========================================
  // Full Translation Chain
  // ========================================

  /**
   * Translate a path from Arr format all the way to media server format
   * Arr -> Local -> Media Server
   */
  async translateArrToMediaServer(
    arrPath: string,
    arrAppId: number,
    mediaServerId: number
  ): Promise<TranslatedPath> {
    const localPath = await this.translateArrToLocal(arrPath, arrAppId);
    const mediaServerPath = await this.translateLocalToMediaServer(localPath, mediaServerId);

    return {
      original: arrPath,
      local: localPath,
      mediaServer: mediaServerPath,
    };
  }

  // ========================================
  // Leaving Soon Paths
  // ========================================

  /**
   * Get Leaving Soon paths for a media server
   */
  async getLeavingSoonPaths(mediaServerId: number): Promise<{
    moviesLocalPath: string | null;
    tvLocalPath: string | null;
    moviesMediaPath: string | null;
    tvMediaPath: string | null;
  }> {
    const mediaServer = await prisma.mediaServer.findUnique({
      where: { id: mediaServerId },
      select: {
        leavingSoonMoviesPath: true,
        leavingSoonTvPath: true,
        leavingSoonMoviesMediaPath: true,
        leavingSoonTvMediaPath: true,
      },
    });

    return {
      moviesLocalPath: mediaServer?.leavingSoonMoviesPath ?? null,
      tvLocalPath: mediaServer?.leavingSoonTvPath ?? null,
      moviesMediaPath: mediaServer?.leavingSoonMoviesMediaPath ?? null,
      tvMediaPath: mediaServer?.leavingSoonTvMediaPath ?? null,
    };
  }

  /**
   * Set Leaving Soon paths for a media server
   */
  async setLeavingSoonPaths(
    mediaServerId: number,
    paths: {
      moviesLocalPath?: string;
      tvLocalPath?: string;
      moviesMediaPath?: string;
      tvMediaPath?: string;
    }
  ): Promise<void> {
    await prisma.mediaServer.update({
      where: { id: mediaServerId },
      data: {
        leavingSoonMoviesPath: paths.moviesLocalPath ? this.normalizePath(paths.moviesLocalPath) : undefined,
        leavingSoonTvPath: paths.tvLocalPath ? this.normalizePath(paths.tvLocalPath) : undefined,
        leavingSoonMoviesMediaPath: paths.moviesMediaPath ? this.normalizePath(paths.moviesMediaPath) : undefined,
        leavingSoonTvMediaPath: paths.tvMediaPath ? this.normalizePath(paths.tvMediaPath) : undefined,
      },
    });

    logger.info(`Updated Leaving Soon paths for media server ${mediaServerId}`, 'PathMapping');
  }

  // ========================================
  // Validation
  // ========================================

  /**
   * Test if a local path exists
   */
  async testLocalPath(localPath: string): Promise<{
    exists: boolean;
    isDirectory: boolean;
    message: string;
  }> {
    const fs = await import('fs');
    
    try {
      const normalizedPath = this.normalizePath(localPath);
      
      if (!fs.existsSync(normalizedPath)) {
        return {
          exists: false,
          isDirectory: false,
          message: `Path does not exist: ${normalizedPath}`,
        };
      }

      const stats = fs.statSync(normalizedPath);
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        message: stats.isDirectory() 
          ? `Directory exists: ${normalizedPath}`
          : `File exists: ${normalizedPath}`,
      };
    } catch (error: any) {
      return {
        exists: false,
        isDirectory: false,
        message: `Error checking path: ${error.message}`,
      };
    }
  }

  /**
   * Test all path mappings for an Arr app
   */
  async testArrPathMappings(arrAppId: number): Promise<Array<{
    mapping: ArrPathMapping;
    localPathExists: boolean;
    message: string;
  }>> {
    const mappings = await this.getArrPathMappings(arrAppId);
    const results = [];

    for (const mapping of mappings) {
      const result = await this.testLocalPath(mapping.localPath);
      results.push({
        mapping,
        localPathExists: result.exists && result.isDirectory,
        message: result.message,
      });
    }

    return results;
  }

  /**
   * Test all path mappings for a media server
   */
  async testMediaServerPathMappings(mediaServerId: number): Promise<Array<{
    mapping: MediaServerPathMapping;
    localPathExists: boolean;
    message: string;
  }>> {
    const mappings = await this.getMediaServerPathMappings(mediaServerId);
    const results = [];

    for (const mapping of mappings) {
      const result = await this.testLocalPath(mapping.localPath);
      results.push({
        mapping,
        localPathExists: result.exists && result.isDirectory,
        message: result.message,
      });
    }

    return results;
  }

  // ========================================
  // Helper Methods
  // ========================================

  private normalizePath(path: string): string {
    // Convert backslashes to forward slashes
    let normalized = path.replace(/\\/g, '/');
    
    // Remove trailing slash unless it's the root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }

  private joinPaths(basePath: string, relativePath: string): string {
    const normalizedBase = this.normalizePath(basePath);
    const normalizedRelative = this.normalizePath(relativePath);
    
    if (!normalizedRelative || normalizedRelative === '/') {
      return normalizedBase;
    }
    
    // Ensure relative path starts with /
    const relPath = normalizedRelative.startsWith('/') 
      ? normalizedRelative 
      : '/' + normalizedRelative;
    
    return normalizedBase + relPath;
  }
}

// Export singleton instance
export const pathMappingService = new PathMappingService();
export default pathMappingService;
