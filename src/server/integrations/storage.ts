/**
 * Storage Client
 * Handles local filesystem, SMB mounts, and NFS mounts
 * All these appear as local paths within the container
 */

import { statfs, access, constants } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface StorageConfig {
  type: 'local' | 'smb' | 'nfs';
  path: string;
  // SMB specific
  host?: string;
  share?: string;
  username?: string;
  password?: string;
  domain?: string;
  // NFS specific
  export?: string;
}

export interface StorageStats {
  total: number;      // Total bytes
  used: number;       // Used bytes
  free: number;       // Free bytes
  available: number;  // Available bytes (may differ from free due to reserved space)
  usedPercent: number;
  freePercent: number;
  blockSize: number;
  path: string;
  type: string;
  mounted: boolean;
}

export interface MountInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  options: string;
}

export class StorageClient {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Test connection to storage
   */
  async testConnection(): Promise<{ connected: boolean; message: string; stats?: StorageStats }> {
    try {
      // First check if path exists and is accessible
      await access(this.config.path, constants.R_OK);
      
      // Get storage stats
      const stats = await this.getStats();
      
      return {
        connected: true,
        message: `Connected to ${this.config.path} (${this.formatBytes(stats.total)} total, ${this.formatBytes(stats.free)} free)`,
        stats,
      };
    } catch (error: any) {
      return {
        connected: false,
        message: error.code === 'ENOENT' 
          ? `Path not found: ${this.config.path}` 
          : error.code === 'EACCES'
            ? `Permission denied: ${this.config.path}`
            : `Failed to access storage: ${error.message}`,
      };
    }
  }

  /**
   * Get storage statistics for the configured path
   */
  async getStats(): Promise<StorageStats> {
    const stats = await statfs(this.config.path);
    
    const blockSize = stats.bsize;
    const total = stats.blocks * blockSize;
    const free = stats.bfree * blockSize;
    const available = stats.bavail * blockSize;
    const used = total - free;
    
    // Try to determine if this is a network mount
    let mounted = true;
    let type = this.config.type;
    
    try {
      const mountInfo = await this.getMountInfo();
      if (mountInfo) {
        if (mountInfo.fstype.toLowerCase().includes('cifs') || mountInfo.fstype.toLowerCase().includes('smb')) {
          type = 'smb';
        } else if (mountInfo.fstype.toLowerCase().includes('nfs')) {
          type = 'nfs';
        }
        mounted = true;
      }
    } catch {
      // Couldn't get mount info, assume it's a local path
    }
    
    return {
      total,
      used,
      free,
      available,
      usedPercent: total > 0 ? (used / total) * 100 : 0,
      freePercent: total > 0 ? (free / total) * 100 : 0,
      blockSize,
      path: this.config.path,
      type,
      mounted,
    };
  }

  /**
   * Get mount information for the path
   */
  async getMountInfo(): Promise<MountInfo | null> {
    try {
      // Use df to find the mount point
      const { stdout } = await execAsync(`df -PT "${this.config.path}" | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      
      if (parts.length >= 7) {
        return {
          device: parts[0],
          fstype: parts[1],
          mountpoint: parts[6],
          options: '',
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the path is mounted (useful for network mounts)
   */
  async isMounted(): Promise<boolean> {
    try {
      await access(this.config.path, constants.R_OK);
      const stats = await statfs(this.config.path);
      return stats.blocks > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Mount SMB share (requires cifs-utils)
   * Note: This requires the container to have proper privileges
   */
  static async mountSmb(config: {
    host: string;
    share: string;
    mountPoint: string;
    username?: string;
    password?: string;
    domain?: string;
    options?: string[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Build mount command
      const credentials = [];
      if (config.username) credentials.push(`username=${config.username}`);
      if (config.password) credentials.push(`password=${config.password}`);
      if (config.domain) credentials.push(`domain=${config.domain}`);
      
      const optionsStr = [
        ...credentials,
        ...(config.options || []),
      ].join(',');

      const cmd = `mount -t cifs //${config.host}/${config.share} ${config.mountPoint} -o ${optionsStr}`;
      
      await execAsync(cmd);
      
      return {
        success: true,
        message: `Successfully mounted //${config.host}/${config.share} at ${config.mountPoint}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to mount SMB share: ${error.message}`,
      };
    }
  }

  /**
   * Mount NFS share (requires nfs-common)
   * Note: This requires the container to have proper privileges
   */
  static async mountNfs(config: {
    host: string;
    export: string;
    mountPoint: string;
    options?: string[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      const optionsStr = config.options?.join(',') || 'rw';
      const cmd = `mount -t nfs -o ${optionsStr} ${config.host}:${config.export} ${config.mountPoint}`;
      
      await execAsync(cmd);
      
      return {
        success: true,
        message: `Successfully mounted ${config.host}:${config.export} at ${config.mountPoint}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to mount NFS share: ${error.message}`,
      };
    }
  }

  /**
   * Unmount a path
   */
  static async unmount(mountPoint: string): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync(`umount ${mountPoint}`);
      return {
        success: true,
        message: `Successfully unmounted ${mountPoint}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to unmount: ${error.message}`,
      };
    }
  }

  /**
   * Get all mounts on the system
   */
  static async getAllMounts(): Promise<MountInfo[]> {
    try {
      const { stdout } = await execAsync('mount');
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        // Parse: device on mountpoint type fstype (options)
        const match = line.match(/^(.+) on (.+) type (\S+) \((.+)\)$/);
        if (match) {
          return {
            device: match[1],
            mountpoint: match[2],
            fstype: match[3],
            options: match[4],
          };
        }
        return null;
      }).filter((m): m is MountInfo => m !== null);
    } catch {
      return [];
    }
  }

  /**
   * Get disk usage for a specific directory (recursively)
   */
  async getDirectorySize(): Promise<number> {
    try {
      const { stdout } = await execAsync(`du -sb "${this.config.path}" | cut -f1`);
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }
}
