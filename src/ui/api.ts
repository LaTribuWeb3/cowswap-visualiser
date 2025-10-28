import { Transaction, APIResponse, BinancePriceData } from './types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

// Block timestamp cache to avoid repeated requests
const blockTimestampCache = new Map<number, number>();

// Track failed blocks for retry purposes
const failedBlocks = new Set<number>();

/**
 * Get current network ID from sessionStorage (legacy function)
 * This is now replaced by the UI state management in main.ts
 */
export function getCurrentNetworkId(): string {
  if (typeof window !== 'undefined') {
    let networkId = sessionStorage.getItem('NETWORK_ID');
    if (!networkId) {
      // Auto-select first available network
      console.log('🔧 No network ID found, auto-selecting first available network...');
      // This will be handled by the main.ts initialization
      throw new Error('No network ID found in sessionStorage. Please wait for network initialization or select a network manually.');
    }
    return networkId;
  }
  throw new Error('getCurrentNetworkId() can only be called in browser environment');
}

/**
 * Switch to a different network
 */
export async function switchNetwork(networkId: string): Promise<boolean> {
  try {
    console.log(`🔄 [FRONTEND] Calling backend to switch to network ${networkId}...`);
    console.log(`🔄 [FRONTEND] API URL: ${API_BASE_URL}/api/network/switch`);
    
    const response = await fetch(`${API_BASE_URL}/api/network/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ networkId })
    });
    
    console.log(`🔄 [FRONTEND] Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [FRONTEND] HTTP error response:`, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`🔄 [FRONTEND] Response data:`, data);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to switch network');
    }
    
    console.log(`✅ [FRONTEND] Backend switched to network ${networkId}`);
    return true;
  } catch (error) {
    console.error('❌ [FRONTEND] Error switching network:', error);
    return false;
  }
}

/**
 * Fetch recent trades from the API
 */
export async function fetchRecentTrades(limit: number = 50, offset: number = 0, networkId?: string): Promise<Transaction[]> {
  try {
    const currentNetworkId = networkId || getCurrentNetworkId();
    const url = new URL(`${API_BASE_URL}/api/trades`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('chainId', currentNetworkId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as APIResponse;
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch trades');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching trades:', error);
    throw error;
  }
}

/**
 * Fetch trades with pagination info and filtering
 */
export async function fetchTradesWithPagination(
  limit: number = 50, 
  offset: number = 0,
  filters?: {
    fromAddress?: string;
    toAddress?: string;
    startDate?: string;
    endDate?: string;
    sellToken?: string;
    buyToken?: string;
  },
  networkId?: string
): Promise<{
  trades: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    currentPage?: number;
    totalPages?: number;
  };
}> {
  try {
    const currentNetworkId = networkId || getCurrentNetworkId();
    console.log(`🌐 [FRONTEND] Fetching trades with pagination - limit: ${limit}, offset: ${offset}, chainId: ${currentNetworkId}`);
    console.log(`🌐 [FRONTEND] Filters:`, filters);
    console.log(`🌐 [FRONTEND] Base URL: ${API_BASE_URL}`);
    
    const url = new URL(`${API_BASE_URL}/api/trades`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('chainId', currentNetworkId);
    
    console.log(`🌐 [FRONTEND] Full API URL: ${url.toString()}`);
    
    // Add filter parameters if provided
    if (filters) {
      if (filters.fromAddress) {
        url.searchParams.append('fromAddress', filters.fromAddress);
      }
      if (filters.toAddress) {
        url.searchParams.append('toAddress', filters.toAddress);
      }
      if (filters.startDate) {
        url.searchParams.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        url.searchParams.append('endDate', filters.endDate);
      }
      if (filters.sellToken) {
        url.searchParams.append('sellToken', filters.sellToken);
      }
      if (filters.buyToken) {
        url.searchParams.append('buyToken', filters.buyToken);
      }
    }
    
    console.log(`🌐 API: Full URL: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    console.log(`🌐 API: Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🌐 API: Error response body:`, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as any;
    console.log(`🌐 API: Response data:`, data);
    
    if (!data.success || !data.data) {
      console.error(`🌐 API: Invalid response structure:`, data);
      throw new Error(data.error || 'Failed to fetch trades');
    }
    
    console.log(`🌐 API: Successfully fetched ${data.data.length} trades`);
    
    return {
      trades: data.data,
      pagination: data.pagination || {
        total: data.data.length,
        limit,
        offset,
        hasMore: false
      }
    };
  } catch (error) {
    console.error('❌ API: Error fetching trades with pagination:', error);
    throw error;
  }
}

/**
 * Fetch trade details by hash
 */
export async function fetchTradeByHash(hash: string): Promise<Transaction | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/trades/${hash}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as APIResponse;
    
    if (!data.success || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return null;
    }
    
    return data.data[0];
  } catch (error) {
    console.error('Error fetching trade:', error);
    throw error;
  }
}

/**
 * Fetch recent events from CoW Protocol
 */
export async function fetchRecentEvents(networkId?: string): Promise<any[]> {
  try {
    const currentNetworkId = networkId || getCurrentNetworkId();
    const url = new URL(`${API_BASE_URL}/api/events`);
    url.searchParams.append('networkId', currentNetworkId);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as any;
    return data.events || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

/**
 * Health check for the API
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    console.log(`🏥 API: Checking health at ${API_BASE_URL}/health`);
    const response = await fetch(`${API_BASE_URL}/health`);
    console.log(`🏥 API: Health check response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const healthData = await response.json();
      console.log(`🏥 API: Health check data:`, healthData);
    }
    
    return response.ok;
  } catch (error) {
    console.error('❌ API: Health check failed:', error);
    return false;
  }
}

/**
 * Fetch token metadata from the backend API with caching and multicall support
 */
export async function fetchTokenMetadata(tokenAddress: string, networkId?: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  address: string;
}> {
  const maxRetries = 3;
  const timeoutMs = 10000; // 10 seconds timeout
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch metadata for ${tokenAddress}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      // Create the fetch promise with network metadata endpoint
      const currentNetworkId = networkId || getCurrentNetworkId();
      const url = new URL(`${API_BASE_URL}/api/network-metadata`);
      url.searchParams.append('address', tokenAddress);
      url.searchParams.append('networkId', currentNetworkId);
      
      const fetchPromise = fetch(url.toString());
      
      // Race between timeout and fetch
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch token metadata');
      }
      
      console.log(`✅ Found metadata for ${tokenAddress} on attempt ${attempt}:`, data.data);
      return data.data;

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${tokenAddress}:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed - throw error instead of returning fallback
  console.error(`❌ All ${maxRetries} attempts failed to fetch metadata for ${tokenAddress}. Last error:`, lastError);
  throw new Error(`Failed to fetch token metadata for ${tokenAddress} after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fetch token decimals from the backend API (legacy method for compatibility)
 */
export async function fetchTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    const metadata = await fetchTokenMetadata(tokenAddress);
    return metadata.decimals;
  } catch (error) {
    console.error(`❌ Error fetching decimals for ${tokenAddress}:`, error);
    throw new Error(`Failed to fetch token decimals for ${tokenAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get block timestamp via API with enhanced caching
 */
export async function getBlockTimestamp(blockNumber: number, networkId?: string): Promise<number> {
  // Check cache first
  if (blockTimestampCache.has(blockNumber)) {
    const cachedTimestamp = blockTimestampCache.get(blockNumber)!;
    console.log(`📦 Using cached timestamp for block ${blockNumber}: ${cachedTimestamp}`);
    return cachedTimestamp;
  }

  const maxRetries = 20; // Much higher retry count for block timestamps
  const timeoutMs = 5000; // 5 seconds timeout per attempt
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch timestamp for block ${blockNumber}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      const currentNetworkId = networkId || getCurrentNetworkId();
      const url = new URL(`${API_BASE_URL}/api/block-timestamp/${blockNumber}`);
      url.searchParams.append('networkId', currentNetworkId);
      
      const fetchPromise = fetch(url.toString());
      
      // Race between timeout and fetch
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data || !data.data.timestamp) {
        throw new Error('Invalid response format from block timestamp API');
      }
      
      console.log(`✅ Retrieved timestamp for block ${blockNumber} on attempt ${attempt}: ${data.data.timestamp}`);
      
      // Cache the timestamp
      blockTimestampCache.set(blockNumber, data.data.timestamp);
      
      // Remove from failed blocks list if it was there
      failedBlocks.delete(blockNumber);
      
      return data.data.timestamp;

    } catch (error) {
      lastError = error;
      
      // Log specific error types for better debugging
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('503')) {
          console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for block ${blockNumber} (${error.message}):`, error);
        } else {
          console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for block ${blockNumber}:`, error);
        }
      } else {
        console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for block ${blockNumber}:`, error);
      }
      
      if (attempt < maxRetries) {
        // Linear backoff: wait 1s, 2s, 3s, 4s, 5s, 6s, 7s, 8s, 9s, 10s...
        const baseDelay = 1000 * attempt; // 1 second per attempt
        const jitter = Math.random() * 300; // Add up to 0.3 seconds of jitter
        const delayMs = baseDelay + jitter;
        console.log(`⏳ Waiting ${Math.round(delayMs)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  console.error(`❌ All ${maxRetries} attempts failed to fetch timestamp for block ${blockNumber}. Last error:`, lastError);
  
  // Track this block as failed for retry purposes
  failedBlocks.add(blockNumber);
  
  throw new Error(`Failed to fetch block timestamp for block ${blockNumber} after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Batch fetch block timestamps for multiple blocks
 * More efficient than individual requests
 */
export async function batchFetchBlockTimestamps(blockNumbers: number[]): Promise<Map<number, number>> {
  const results = new Map<number, number>();
  const blocksToFetch: number[] = [];
  
  // Check cache first
  for (const blockNumber of blockNumbers) {
    if (blockTimestampCache.has(blockNumber)) {
      results.set(blockNumber, blockTimestampCache.get(blockNumber)!);
    } else {
      blocksToFetch.push(blockNumber);
    }
  }
  
  if (blocksToFetch.length === 0) {
    console.log(`📦 All ${blockNumbers.length} block timestamps were cached`);
    return results;
  }
  
  console.log(`🔄 Batch fetching timestamps for ${blocksToFetch.length} blocks:`, blocksToFetch);
  
  // Fetch timestamps for uncached blocks
  const fetchPromises = blocksToFetch.map(async (blockNumber) => {
    try {
      const timestamp = await getBlockTimestamp(blockNumber);
      results.set(blockNumber, timestamp);
      return { blockNumber, timestamp, success: true };
    } catch (error) {
      console.error(`❌ Failed to fetch timestamp for block ${blockNumber}:`, error);
      return { blockNumber, timestamp: null, success: false, error };
    }
  });
  
  const fetchResults = await Promise.all(fetchPromises);
  
  // Log results
  const successful = fetchResults.filter(r => r.success).length;
  const failed = fetchResults.filter(r => !r.success).length;
  
  console.log(`✅ Batch fetch completed: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.warn(`⚠️ Failed to fetch timestamps for blocks:`, fetchResults.filter(r => !r.success).map(r => r.blockNumber));
  }
  
  return results;
}

/**
 * Retry fetching timestamps for blocks that failed previously
 * This can be called to retry blocks that showed as "Block X" instead of proper timestamps
 */
export async function retryFailedBlockTimestamps(blockNumbers: number[]): Promise<void> {
  console.log(`🔄 Retrying timestamp fetch for ${blockNumbers.length} failed blocks:`, blockNumbers);
  
  const retryPromises = blockNumbers.map(async (blockNumber) => {
    try {
      // Clear from cache if it exists (to force fresh fetch)
      blockTimestampCache.delete(blockNumber);
      
      // Retry the fetch
      const timestamp = await getBlockTimestamp(blockNumber);
      console.log(`✅ Successfully retried timestamp for block ${blockNumber}: ${timestamp}`);
      return { blockNumber, success: true, timestamp };
    } catch (error) {
      console.error(`❌ Retry failed for block ${blockNumber}:`, error);
      return { blockNumber, success: false, error };
    }
  });
  
  const results = await Promise.all(retryPromises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`🔄 Retry completed: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.warn(`⚠️ Still failed to fetch timestamps for blocks:`, results.filter(r => !r.success).map(r => r.blockNumber));
  }
}

/**
 * Get list of blocks that failed to fetch timestamps
 */
export function getFailedBlocks(): number[] {
  return Array.from(failedBlocks);
}

/**
 * Clear failed blocks list (after successful retry)
 */
export function clearFailedBlocks(): void {
  failedBlocks.clear();
  console.log('🧹 Cleared failed blocks list');
}

/**
 * Retry all failed blocks
 */
export async function retryAllFailedBlocks(): Promise<void> {
  const failedBlocksList = getFailedBlocks();
  if (failedBlocksList.length === 0) {
    console.log('✅ No failed blocks to retry');
    return;
  }
  
  console.log(`🔄 Retrying ${failedBlocksList.length} failed blocks:`, failedBlocksList);
  await retryFailedBlockTimestamps(failedBlocksList);
  
  // Clear the failed blocks list after retry attempt
  clearFailedBlocks();
}

/**
 * Batch fetch token metadata for multiple tokens at once
 */
export async function fetchBatchTokenMetadata(addresses: string[], networkId?: string): Promise<{
  [address: string]: { name: string; symbol: string; decimals: number; address: string }
}> {
  const currentNetworkId = networkId || getCurrentNetworkId();
  
  const response = await fetch(`${API_BASE_URL}/api/token-metadata/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addresses,
      networkId: currentNetworkId
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch batch token metadata');
  }
  
  // Convert array of results to object keyed by address
  const result: { [address: string]: { name: string; symbol: string; decimals: number; address: string } } = {};
  
  for (const item of data.data.results) {
    result[item.address.toLowerCase()] = item.metadata;
  }
  
  return result;
}

/**
 * Get network configurations from backend API
 */
export async function getNetworkConfigs(): Promise<Record<string, any>> {
  const response = await fetch(`${API_BASE_URL}/api/networks`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch network configurations');
  }
  
  return data.data;
}

/**
 * Get supported networks from backend API
 */
export async function getSupportedNetworks(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/networks/supported`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch supported networks');
  }
  
  return data.data;
}

/**
 * Get network configuration by chain ID from backend API
 */
export async function getNetworkConfig(chainId: string | number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/networks/${chainId}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return undefined;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch network configuration');
  }
  
  return data.data;
}

/**
 * Fetch solver competition data by transaction hash
 */
export async function fetchSolverCompetition(txHash: string, networkId?: string): Promise<any> {
  try {
    const currentNetworkId = networkId || getCurrentNetworkId();
    
    // Use backend API to get solver competition data
    const response = await fetch(`${API_BASE_URL}/api/solver-competition/${txHash}?networkId=${currentNetworkId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch solver competition data');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching solver competition data:', error);
    throw error;
  }
}

/**
 * Fetch order competition data by order ID
 */
export async function fetchOrderCompetition(orderId: string, networkId?: string): Promise<any> {
  try {
    const currentNetworkId = networkId || getCurrentNetworkId();
    
    // Use backend API to get order competition data
    const response = await fetch(`${API_BASE_URL}/api/order-competition/${orderId}?networkId=${currentNetworkId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch order competition data');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching order competition data:', error);
    throw error;
  }
}

// Simple in-memory cache for Binance prices
const binancePriceCache = new Map<string, { data: BinancePriceData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

/**
 * Generate cache key for Binance price request
 */
function generateCacheKey(inputToken: string, outputToken: string, timestamp?: number): string {
  return `${inputToken}/${outputToken}${timestamp ? `@${timestamp}` : ''}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cacheEntry: { data: BinancePriceData; timestamp: number }): boolean {
  return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
}

/**
 * Fetch Binance price data for token pair via secure proxy with retry logic and caching
 */
export async function fetchBinancePrice(inputToken: string, outputToken: string, timestamp?: number, progressCallback?: () => Promise<void>): Promise<BinancePriceData> {
  // Check cache first
  const cacheKey = generateCacheKey(inputToken, outputToken, timestamp);
  const cachedEntry = binancePriceCache.get(cacheKey);
  
  if (cachedEntry && isCacheValid(cachedEntry)) {
    console.log(`📦 Using cached Binance price for ${cacheKey}`);
    return cachedEntry.data;
  }

  // First, check if the API token is available
  const configResponse = await fetch(`${API_BASE_URL}/api/config`);
  if (!configResponse.ok) {
    throw new Error('Failed to fetch configuration');
  }
  
  const configData = await configResponse.json() as any;
  const tokenAvailable = configData.data?.pairApiTokenAvailable;
  
  console.log('🔑 API Token available:', tokenAvailable ? 'Yes' : 'No');
  
  if (!tokenAvailable) {
    throw new Error('PAIR_API_TOKEN not configured');
  }
  
  // Use the secure proxy endpoint instead of direct API calls
  const url = new URL(`${API_BASE_URL}/api/binance-price`);
  url.searchParams.append('inputToken', inputToken);
  url.searchParams.append('outputToken', outputToken);
  
  console.log('⏰ Timestamp parameter:', timestamp);
  if (timestamp) {
    url.searchParams.append('timestamp', timestamp.toString());
    console.log('✅ Timestamp added to URL');
  } else {
    console.log('⚠️ No timestamp provided');
  }
  
  console.log('🌐 Making request to secure proxy:', url.toString());
  
  // Poll for completion with 202 handling
  const maxPollingAttempts = 3; // Maximum 3 attempts (each call may take up to a few seconds in backend)
  const pollingInterval = 1000; // 1 second between attempts
  
  for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
    try {
      console.log(`🔄 Polling attempt ${attempt + 1}/${maxPollingAttempts} for Binance price`);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout per request
      });
      
      if (response.status === 200) {
        // Success - price data received
        const responseData = await response.json();
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'Unknown error from proxy');
        }
        
        console.log(`✅ Successfully fetched Binance price on attempt ${attempt + 1}`);
        console.log("🔍 Full API response:", responseData);
        console.log("🔍 API response data:", responseData.data);
        
        // Cache the successful result
        const priceData = responseData.data as BinancePriceData;
        binancePriceCache.set(cacheKey, {
          data: priceData,
          timestamp: Date.now()
        });
        
        return priceData;
        
      } else if (response.status === 202) {
        // Processing - continue polling
        const responseData = await response.json();
        console.log(`⏳ Job ${responseData.jobId} is still processing, continuing to poll...`);
        
        // Update progress if callback provided
        if (progressCallback) {
          await progressCallback();
        }
        
        // Wait before next poll (except on first attempt)
        if (attempt < maxPollingAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
        continue;
        
      } else if (response.status === 404) {
        // Pair not found - return error immediately
        throw new Error('Pair not found');
        
      } else {
        // Other error status
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`❌ Polling attempt ${attempt + 1} failed:`, error);
      
      // If it's a "Pair not found" error, throw immediately
      if (error instanceof Error && error.message.includes('Pair not found')) {
        throw error;
      }

      // If it's a 'outputToken must be 2-10 uppercase letters and numbers' error, throw immediately
      if (error instanceof Error && error.message.includes('outputToken must be 2-10 uppercase letters and numbers')) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxPollingAttempts - 1) {
        console.error('🚫 All polling attempts exhausted for Binance price fetch');
        throw error;
      }
      
      // Wait before retrying on error
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }
  
  // This should never be reached, but just in case
  throw new Error('Unexpected error in retry logic');
}

