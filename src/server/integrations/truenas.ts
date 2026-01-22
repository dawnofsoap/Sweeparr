/**
 * TrueNAS WebSocket API Client
 * Uses JSON-RPC 2.0 over WebSocket for communication
 * Supports both TrueNAS CORE and TrueNAS SCALE
 * 
 * This implementation uses WebSocket instead of REST API because:
 * 1. The REST API doesn't support RBAC for non-Full Admin users
 * 2. WebSocket API properly honors Readonly Admin permissions
 * 3. It's the recommended API going forward (TrueNAS 25.04+)
 */

import WebSocket from 'ws';

export interface TrueNASConfig {
  url: string;
  apiKey: string;
  username?: string;  // For user-linked API keys in 25.04+
  useSsl?: boolean;
}

export interface TrueNASPool {
  id: number;
  name: string;
  guid: string;
  path: string;
  status: string;
  healthy: boolean;
  is_decrypted: boolean;
  topology: {
    data: TrueNASVdev[];
    cache: TrueNASVdev[];
    log: TrueNASVdev[];
    spare: TrueNASVdev[];
    special: TrueNASVdev[];
  };
  size: number;
  allocated: number;
  free: number;
  freeing: number;
  fragmentation: string;
  autotrim: {
    value: string;
  };
}

export interface TrueNASVdev {
  name: string;
  type: string;
  status: string;
  path?: string;
  guid?: string;
  stats?: {
    size: number;
    allocated: number;
    free: number;
  };
  children?: TrueNASVdev[];
}

export interface TrueNASDataset {
  id: string;
  name: string;
  pool: string;
  type: string;
  mountpoint: string;
  used: {
    value: string;
    rawvalue: string;
    parsed: number;
  };
  available: {
    value: string;
    rawvalue: string;
    parsed: number;
  };
  quota: {
    value: string | null;
    rawvalue: string | null;
    parsed: number | null;
  };
  refquota: {
    value: string | null;
    rawvalue: string | null;
    parsed: number | null;
  };
  reservation: {
    value: string | null;
    rawvalue: string | null;
    parsed: number | null;
  };
  refreservation: {
    value: string | null;
    rawvalue: string | null;
    parsed: number | null;
  };
  compression: {
    value: string;
  };
  compressratio: {
    value: string;
  };
  origin: {
    value: string;
  };
  deduplication: {
    value: string;
  };
  comments: {
    value: string;
  };
  readonly: {
    value: boolean;
  };
  children?: TrueNASDataset[];
}

export interface TrueNASDisk {
  identifier: string;
  name: string;
  subsystem: string;
  number: number;
  serial: string;
  size: number;
  type: string;
  model: string;
  pool?: string;
}

export interface TrueNASSystemInfo {
  version: string;
  hostname: string;
  uptime: string;
  uptime_seconds: number;
  loadavg: number[];
  physmem: number;
  model: string;
  cores: number;
  timezone: string;
  datetime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

export interface StorageStats {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
  freePercent: number;
}

// JSON-RPC 2.0 types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown[];
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: {
      error: number;
      errname: string;
      reason: string;
      trace?: unknown;
      extra?: unknown[];
      py_exception?: string;
    };
  };
}

export class TrueNASClient {
  private config: TrueNASConfig;
  private wsUrl: string;
  private requestId: number = 0;
  private connectionTimeout: number = 10000; // 10 seconds
  private requestTimeout: number = 30000; // 30 seconds

  constructor(config: TrueNASConfig) {
    this.config = config;
    
    // Build WebSocket URL
    let baseUrl = config.url.replace(/\/+$/, '');
    
    // TrueNAS API requires SSL/TLS for API key authentication
    // Convert any URL to secure WebSocket (wss://)
    if (baseUrl.startsWith('https://')) {
      baseUrl = baseUrl.replace('https://', 'wss://');
    } else if (baseUrl.startsWith('http://')) {
      // Force upgrade to secure connection
      baseUrl = baseUrl.replace('http://', 'wss://');
    } else if (baseUrl.startsWith('ws://')) {
      // Force upgrade to secure connection
      baseUrl = baseUrl.replace('ws://', 'wss://');
    } else if (!baseUrl.startsWith('wss://')) {
      // No protocol specified, add wss://
      baseUrl = `wss://${baseUrl}`;
    }
    
    // Use the modern JSON-RPC endpoint
    this.wsUrl = `${baseUrl}/api/current`;
  }

  /**
   * Create a WebSocket connection and authenticate
   */
  private async connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.connectionTimeout);

      const ws = new WebSocket(this.wsUrl, {
        rejectUnauthorized: false, // Allow self-signed certs
      });

      ws.on('open', () => {
        clearTimeout(timeoutId);
        resolve(ws);
      });

      ws.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`WebSocket connection failed: ${err.message}`));
      });
    });
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private async call<T>(ws: WebSocket, method: string, params: unknown[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.requestTimeout);

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: JsonRpcResponse = JSON.parse(data.toString());
          
          if (response.id === id) {
            clearTimeout(timeoutId);
            ws.off('message', messageHandler);
            
            if (response.error) {
              const errorMsg = response.error.data?.reason || response.error.message || 'Unknown error';
              reject(new Error(`TrueNAS API error: ${errorMsg}`));
            } else {
              resolve(response.result as T);
            }
          }
        } catch {
          // Ignore parse errors for messages we're not waiting for
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(request));
    });
  }

  /**
   * Execute a method with automatic connection handling
   */
  private async execute<T>(method: string, params: unknown[] = []): Promise<T> {
    let ws: WebSocket | null = null;
    
    try {
      ws = await this.connect();
      
      // Authenticate with API key
      // Try the modern auth.login_with_api_key first
      try {
        const authResult = await this.call<boolean>(ws, 'auth.login_with_api_key', [this.config.apiKey]);
        if (!authResult) {
          throw new Error('Authentication failed');
        }
      } catch (authError: unknown) {
        // If that fails, try with username parameter (for user-linked keys in 25.04+)
        if (this.config.username) {
          const authResult = await this.call<{ response_type: string }>(ws, 'auth.login_ex', [{
            mechanism: 'API_KEY_PLAIN',
            username: this.config.username,
            api_key: this.config.apiKey,
          }]);
          if (authResult.response_type !== 'SUCCESS') {
            throw new Error('Authentication failed with user-linked API key');
          }
        } else {
          throw authError;
        }
      }
      
      // Execute the actual method
      const result = await this.call<T>(ws, method, params);
      
      return result;
    } finally {
      if (ws) {
        ws.close();
      }
    }
  }

  /**
   * Test connection to TrueNAS
   */
  async testConnection(): Promise<{ connected: boolean; message: string; serverInfo?: TrueNASSystemInfo }> {
    try {
      // Try to get system info first
      const info = await this.execute<TrueNASSystemInfo>('system.info');
      return {
        connected: true,
        message: `Connected to ${info.hostname} (TrueNAS ${info.version})`,
        serverInfo: info,
      };
    } catch (error: unknown) {
      // If system.info fails (permissions), try pool.query which needs less permissions
      try {
        const pools = await this.execute<TrueNASPool[]>('pool.query');
        if (pools.length > 0) {
          return {
            connected: true,
            message: `Connected to TrueNAS (${pools.length} pool${pools.length > 1 ? 's' : ''} found)`,
          };
        }
        return {
          connected: true,
          message: 'Connected to TrueNAS (no pools found)',
        };
      } catch (poolError: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to connect to TrueNAS';
        return {
          connected: false,
          message,
        };
      }
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<TrueNASSystemInfo> {
    return this.execute<TrueNASSystemInfo>('system.info');
  }

  /**
   * Get all ZFS pools
   */
  async getPools(): Promise<TrueNASPool[]> {
    return this.execute<TrueNASPool[]>('pool.query');
  }

  /**
   * Get a specific pool by name
   */
  async getPool(poolName: string): Promise<TrueNASPool | null> {
    const pools = await this.getPools();
    return pools.find(p => p.name === poolName) || null;
  }

  /**
   * Get storage stats for a pool
   */
  async getPoolStats(poolName: string): Promise<StorageStats | null> {
    const pool = await this.getPool(poolName);
    if (!pool) return null;

    const total = pool.size;
    const used = pool.allocated;
    const free = pool.free;
    
    return {
      total,
      used,
      free,
      usedPercent: total > 0 ? (used / total) * 100 : 0,
      freePercent: total > 0 ? (free / total) * 100 : 0,
    };
  }

  /**
   * Get all datasets
   */
  async getDatasets(): Promise<TrueNASDataset[]> {
    return this.execute<TrueNASDataset[]>('pool.dataset.query');
  }

  /**
   * Get a specific dataset by path (e.g., "tank/media" or "tank/media/movies")
   */
  async getDataset(datasetPath: string): Promise<TrueNASDataset | null> {
    try {
      // Query with filter for specific dataset
      const datasets = await this.execute<TrueNASDataset[]>('pool.dataset.query', [
        [['id', '=', datasetPath]],
      ]);
      return datasets.length > 0 ? datasets[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Get storage stats for a dataset
   */
  async getDatasetStats(datasetPath: string): Promise<StorageStats | null> {
    const dataset = await this.getDataset(datasetPath);
    if (!dataset) return null;

    const used = dataset.used.parsed || 0;
    const available = dataset.available.parsed || 0;
    const total = used + available;
    
    return {
      total,
      used,
      free: available,
      usedPercent: total > 0 ? (used / total) * 100 : 0,
      freePercent: total > 0 ? (available / total) * 100 : 0,
    };
  }

  /**
   * Get all disks
   */
  async getDisks(): Promise<TrueNASDisk[]> {
    return this.execute<TrueNASDisk[]>('disk.query');
  }

  /**
   * Get datasets for a specific pool
   */
  async getPoolDatasets(poolName: string): Promise<TrueNASDataset[]> {
    const datasets = await this.getDatasets();
    return datasets.filter(d => d.pool === poolName || d.name.startsWith(`${poolName}/`));
  }
}
