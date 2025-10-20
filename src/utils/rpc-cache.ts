import { PublicClient, Block } from 'viem';

/**
 * RPC Cache Utility
 * 
 * This utility provides caching for various RPC calls to reduce the load on RPC endpoints.
 * Supports caching for:
 * - Block data (including transactions)
 * - Token metadata (name, symbol, decimals)
 * - Logs/Events
 * - Block timestamps
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

export class RPCCache {
  // Cache storage
  private blockCache: Map<string, CacheEntry<any>> = new Map();
  private tokenMetadataCache: Map<string, CacheEntry<TokenMetadata>> = new Map();
  private logsCache: Map<string, CacheEntry<any[]>> = new Map();
  private blockTimestampCache: Map<number, CacheEntry<number>> = new Map();
  
  // Cache configuration
  private readonly BLOCK_CACHE_TTL = 60 * 60 * 1000; // 1 hour (blocks are immutable)
  private readonly TOKEN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (token metadata rarely changes)
  private readonly LOGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (recent logs might change)
  private readonly TIMESTAMP_CACHE_TTL = 60 * 60 * 1000; // 1 hour (block timestamps are immutable)
  
  private readonly MAX_CACHE_SIZE = 1000;
  
  /**
   * Generate cache key for block data
   */
  private getBlockCacheKey(blockNumber: bigint, includeTransactions: boolean): string {
    return `block:${blockNumber}:${includeTransactions ? 'with-tx' : 'no-tx'}`;
  }
  
  /**
   * Generate cache key for logs
   */
  private getLogsCacheKey(
    address: string,
    fromBlock: bigint,
    toBlock: bigint,
    eventName?: string
  ): string {
    return `logs:${address}:${fromBlock}:${toBlock}:${eventName || 'all'}`;
  }
  
  /**
   * Generate cache key for token metadata
   */
  private getTokenCacheKey(tokenAddress: string, networkId: number): string {
    return `token:${networkId}:${tokenAddress.toLowerCase()}`;
  }
  
  /**
   * Check if cache entry is valid
   */
  private isValidCacheEntry<T>(entry: CacheEntry<T> | undefined, ttl: number): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < ttl;
  }
  
  /**
   * Evict oldest entries when cache size limit is reached
   */
  private evictOldEntries<K, V>(cache: Map<K, CacheEntry<V>>): void {
    if (cache.size <= this.MAX_CACHE_SIZE) return;
    
    // Convert to array and sort by timestamp
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10%
    const entriesToRemove = Math.floor(this.MAX_CACHE_SIZE * 0.1);
    for (let i = 0; i < entriesToRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }
  
  /**
   * Get block data from cache or fetch it
   */
  async getBlock(
    blockNumber: bigint,
    includeTransactions: boolean,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const cacheKey = this.getBlockCacheKey(blockNumber, includeTransactions);
    const cached = this.blockCache.get(cacheKey);
    
    if (this.isValidCacheEntry(cached, this.BLOCK_CACHE_TTL)) {
      console.log(`📦 Cache hit: Block ${blockNumber} (${includeTransactions ? 'with' : 'without'} transactions)`);
      return cached!.data;
    }
    
    console.log(`🔍 Cache miss: Fetching block ${blockNumber} from RPC`);
    const blockData = await fetcher();
    
    this.blockCache.set(cacheKey, {
      data: blockData,
      timestamp: Date.now()
    });
    
    this.evictOldEntries(this.blockCache);
    
    return blockData;
  }
  
  /**
   * Get block timestamp from cache or fetch it
   */
  async getBlockTimestamp(
    blockNumber: number,
    fetcher: () => Promise<number>
  ): Promise<number> {
    const cached = this.blockTimestampCache.get(blockNumber);
    
    if (this.isValidCacheEntry(cached, this.TIMESTAMP_CACHE_TTL)) {
      console.log(`📦 Cache hit: Block ${blockNumber} timestamp`);
      return cached!.data;
    }
    
    console.log(`🔍 Cache miss: Fetching block ${blockNumber} timestamp from RPC`);
    const timestamp = await fetcher();
    
    this.blockTimestampCache.set(blockNumber, {
      data: timestamp,
      timestamp: Date.now()
    });
    
    this.evictOldEntries(this.blockTimestampCache);
    
    return timestamp;
  }
  
  /**
   * Get token metadata from cache or fetch it
   */
  async getTokenMetadata(
    tokenAddress: string,
    networkId: number,
    fetcher: () => Promise<TokenMetadata>
  ): Promise<TokenMetadata> {
    const cacheKey = this.getTokenCacheKey(tokenAddress, networkId);
    const cached = this.tokenMetadataCache.get(cacheKey);
    
    if (this.isValidCacheEntry(cached, this.TOKEN_CACHE_TTL)) {
      console.log(`📦 Cache hit: Token ${tokenAddress} metadata`);
      return cached!.data;
    }
    
    console.log(`🔍 Cache miss: Fetching token ${tokenAddress} metadata from RPC`);
    const metadata = await fetcher();
    
    this.tokenMetadataCache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now()
    });
    
    this.evictOldEntries(this.tokenMetadataCache);
    
    return metadata;
  }
  
  /**
   * Get logs from cache or fetch them
   */
  async getLogs(
    address: string,
    fromBlock: bigint,
    toBlock: bigint,
    eventName: string | undefined,
    fetcher: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = this.getLogsCacheKey(address, fromBlock, toBlock, eventName);
    const cached = this.logsCache.get(cacheKey);
    
    // For recent blocks (within last 5 minutes), use shorter TTL
    const blockRange = Number(toBlock - fromBlock);
    const ttl = blockRange < 100 ? this.LOGS_CACHE_TTL : this.BLOCK_CACHE_TTL;
    
    if (this.isValidCacheEntry(cached, ttl)) {
      console.log(`📦 Cache hit: Logs for ${address} (blocks ${fromBlock}-${toBlock})`);
      return cached!.data;
    }
    
    console.log(`🔍 Cache miss: Fetching logs for ${address} (blocks ${fromBlock}-${toBlock}) from RPC`);
    const logs = await fetcher();
    
    this.logsCache.set(cacheKey, {
      data: logs,
      timestamp: Date.now()
    });
    
    this.evictOldEntries(this.logsCache);
    
    return logs;
  }
  
  /**
   * Manually add block timestamp to cache (useful for seeding)
   */
  addBlockTimestamp(blockNumber: number, timestamp: number): void {
    this.blockTimestampCache.set(blockNumber, {
      data: timestamp,
      timestamp: Date.now()
    });
  }
  
  /**
   * Manually add token metadata to cache (useful for seeding)
   */
  addTokenMetadata(tokenAddress: string, networkId: number, metadata: TokenMetadata): void {
    const cacheKey = this.getTokenCacheKey(tokenAddress, networkId);
    this.tokenMetadataCache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    blocks: number;
    tokens: number;
    logs: number;
    timestamps: number;
    total: number;
  } {
    return {
      blocks: this.blockCache.size,
      tokens: this.tokenMetadataCache.size,
      logs: this.logsCache.size,
      timestamps: this.blockTimestampCache.size,
      total: this.blockCache.size + this.tokenMetadataCache.size + 
             this.logsCache.size + this.blockTimestampCache.size
    };
  }
  
  /**
   * Clear all caches
   */
  clearAll(): void {
    this.blockCache.clear();
    this.tokenMetadataCache.clear();
    this.logsCache.clear();
    this.blockTimestampCache.clear();
    console.log('🧹 All RPC caches cleared');
  }
  
  /**
   * Clear specific cache
   */
  clearCache(type: 'blocks' | 'tokens' | 'logs' | 'timestamps'): void {
    switch (type) {
      case 'blocks':
        this.blockCache.clear();
        console.log('🧹 Block cache cleared');
        break;
      case 'tokens':
        this.tokenMetadataCache.clear();
        console.log('🧹 Token cache cleared');
        break;
      case 'logs':
        this.logsCache.clear();
        console.log('🧹 Logs cache cleared');
        break;
      case 'timestamps':
        this.blockTimestampCache.clear();
        console.log('🧹 Timestamp cache cleared');
        break;
    }
  }
}

// Singleton instance for backend
export const rpcCache = new RPCCache();

