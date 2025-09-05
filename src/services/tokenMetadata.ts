import { getAddress } from 'viem';

interface TokenInfo {
  name: string;
  type: string;
  symbol: string;
  decimals: number;
  website?: string;
  description?: string;
  explorer?: string;
  status: string;
  id: string;
  tags?: string[];
}

interface CachedTokenInfo extends TokenInfo {
  cachedAt: number;
}

class TokenMetadataService {
  private cache = new Map<string, CachedTokenInfo>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly BASE_URL = 'https://raw.githubusercontent.com/trustwallet/assets/refs/heads/master/blockchains/arbitrum/assets';

  /**
   * Get token metadata, using cache if available and not expired
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    
    // Check cache first
    const cached = this.cache.get(normalizedAddress);
    if (cached && this.isCacheValid(cached.cachedAt)) {
      return this.removeCacheMetadata(cached);
    }

    // Fetch from API
    try {
      const tokenInfo = await this.fetchTokenInfoFromAPI(normalizedAddress);
      if (tokenInfo) {
        // Cache the result
        this.cache.set(normalizedAddress, {
          ...tokenInfo,
          cachedAt: Date.now()
        });
        return tokenInfo;
      }
    } catch (error) {
      console.warn(`Failed to fetch token info for ${normalizedAddress}:`, error);
      
      // Return cached data even if expired, as fallback
      if (cached) {
        console.log(`Using expired cache for ${normalizedAddress}`);
        return this.removeCacheMetadata(cached);
      }
    }

    return null;
  }

  /**
   * Get multiple token infos in batch
   */
  async getMultipleTokenInfos(tokenAddresses: string[]): Promise<Map<string, TokenInfo>> {
    const results = new Map<string, TokenInfo>();
    const addressesToFetch: string[] = [];

    // Check cache for each address
    for (const address of tokenAddresses) {
      const normalizedAddress = address.toLowerCase();
      const cached = this.cache.get(normalizedAddress);
      
      if (cached && this.isCacheValid(cached.cachedAt)) {
        results.set(normalizedAddress, this.removeCacheMetadata(cached));
      } else {
        addressesToFetch.push(normalizedAddress);
      }
    }

    // Fetch missing tokens in parallel
    if (addressesToFetch.length > 0) {
      const fetchPromises = addressesToFetch.map(async (address) => {
        try {
          const tokenInfo = await this.fetchTokenInfoFromAPI(address);
          if (tokenInfo) {
            this.cache.set(address, {
              ...tokenInfo,
              cachedAt: Date.now()
            });
            results.set(address, tokenInfo);
          }
        } catch (error) {
          console.warn(`Failed to fetch token info for ${address}:`, error);
        }
      });

      await Promise.allSettled(fetchPromises);
    }

    return results;
  }

  /**
   * Format token amount using token decimals
   */
  formatTokenAmount(amount: string, decimals: number): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;

    const divisor = Math.pow(10, decimals);
    const formatted = num / divisor;

    if (formatted >= 1000000) {
      return `${(formatted / 1000000).toFixed(1)}M`;
    } else if (formatted >= 1000) {
      return `${(formatted / 1000).toFixed(1)}K`;
    } else if (formatted >= 1) {
      return formatted.toFixed(2);
    } else {
      return formatted.toFixed(6);
    }
  }

  /**
   * Get token symbol with fallback
   */
  getTokenSymbol(tokenAddress: string, tokenInfo?: TokenInfo | null): string {
    if (tokenInfo?.symbol) {
      return tokenInfo.symbol;
    }
    
    // Fallback to first 6 characters of address
    return tokenAddress.slice(0, 6).toUpperCase();
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(cachedAt: number): boolean {
    return Date.now() - cachedAt < this.CACHE_DURATION;
  }

  /**
   * Remove cache-specific metadata before returning
   */
  private removeCacheMetadata(cached: CachedTokenInfo): TokenInfo {
    const { cachedAt, ...tokenInfo } = cached;
    return tokenInfo;
  }

  /**
   * Fetch token info from Trust Wallet API
   */
  private async fetchTokenInfoFromAPI(tokenAddress: string): Promise<TokenInfo | null> {
    // Convert to checksummed address for the API
    const checksummedAddress = getAddress(tokenAddress);
    const url = `${this.BASE_URL}/${checksummedAddress}/info.json`;
    console.log(`Fetching token info for ${tokenAddress} (checksummed: ${checksummedAddress}) from ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CowSwap-Visualiser/1.0'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Token info not found for ${tokenAddress} (checksummed: ${checksummedAddress})`);
        return null;
      }
      console.error(`HTTP error for ${tokenAddress} (checksummed: ${checksummedAddress}): ${response.status} ${response.statusText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched token info for ${tokenAddress}:`, data.symbol);
    
    // Validate required fields
    if (!data.symbol || !data.decimals) {
      console.warn(`Invalid token data for ${tokenAddress}:`, data);
      return null;
    }

    return {
      name: data.name || data.symbol,
      type: data.type || 'ARBITRUM',
      symbol: data.symbol,
      decimals: parseInt(data.decimals),
      website: data.website,
      description: data.description,
      explorer: data.explorer,
      status: data.status || 'active',
      id: data.id || tokenAddress,
      tags: data.tags || []
    };
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ address: string; cachedAt: number; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([address, data]) => ({
      address,
      cachedAt: data.cachedAt,
      age: Date.now() - data.cachedAt
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const tokenMetadataService = new TokenMetadataService();
export type { TokenInfo };
