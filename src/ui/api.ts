import { Transaction, APIResponse, BinancePriceData } from './types';
import { formatAddress } from './utils';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

/**
 * Fetch recent trades from the API
 */
export async function fetchRecentTrades(limit: number = 50, offset: number = 0): Promise<Transaction[]> {
  try {
    const url = new URL(`${API_BASE_URL}/api/trades`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    
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
  }
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
    const url = new URL(`${API_BASE_URL}/api/trades`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());
    
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
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch trades');
    }
    
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
    console.error('Error fetching trades with pagination:', error);
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
export async function fetchRecentEvents(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/events`);
    
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
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

/**
 * Fetch token decimals from the backend API
 */
export async function fetchTokenDecimals(tokenAddress: string): Promise<number> {
  const maxRetries = 3;
  const timeoutMs = 10000; // 10 seconds timeout
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch decimals for ${tokenAddress}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      // Create the fetch promise
      const fetchPromise = fetch(`${API_BASE_URL}/api/token/${tokenAddress}/decimals`);
      
      // Race between timeout and fetch
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch token decimals');
      }
      
      console.log(`✅ Found decimals: ${data.decimals} for ${tokenAddress} on attempt ${attempt}`);
      return data.decimals;

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

  // All retries failed
  console.error(`❌ All ${maxRetries} attempts failed to fetch decimals for ${tokenAddress}. Last error:`, lastError);
  
  // Return fallback decimals based on known tokens
  const fallbackDecimals = getFallbackDecimals(tokenAddress);
  console.log(`🔄 Using fallback decimals: ${fallbackDecimals} for ${tokenAddress}`);
  
  return fallbackDecimals;
}

/**
 * Get fallback decimals for known tokens
 */
function getFallbackDecimals(tokenAddress: string): number {
  const knownTokens: Record<string, number> = {
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 6,  // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 6,  // USDT
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 18, // WETH
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 8,  // WBTC
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 18, // DAI
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53': 18, // BUSD
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': 18, // LINK
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': 18, // UNI
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608aCafEBB': 18, // MATIC
    '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE': 18, // SHIB
    '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39': 8,  // HEX
    '0x4d224452801ACEd8B2F0aebE155379bb5D594381': 18, // APE
    '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9': 18, // AAVE
    '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': 18, // MKR
    '0xc770EEfAd204B5180dF6a14Ee197D99d808ee52d': 18, // FOX
  };

  if (knownTokens[tokenAddress]) {
    return knownTokens[tokenAddress];
  }

  // Default to 18 decimals for most ERC20 tokens
  return 18;
}

/**
 * Get block timestamp via API
 */
export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/block-timestamp/${blockNumber}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Block ${blockNumber} not found, using fallback timestamp`);
        // Use a reasonable fallback based on current time and block number
        const currentBlock = 19000000; // Approximate current block
        const blocksDiff = currentBlock - blockNumber;
        const secondsDiff = blocksDiff * 12; // 12 seconds per block
        return Math.floor(Date.now() / 1000) - secondsDiff;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success || !data.data || !data.data.timestamp) {
      throw new Error('Invalid response format from block timestamp API');
    }
    
    return data.data.timestamp;
  } catch (error) {
    console.error('Error getting block timestamp:', error);
    // Fallback to current time if API call fails
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Fetch solver competition data by transaction hash
 */
export async function fetchSolverCompetition(txHash: string): Promise<any> {
  try {
    const response = await fetch(`https://api.cow.fi/arbitrum_one/api/v2/solver_competition/by_tx_hash/${txHash}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching solver competition data:', error);
    throw error;
  }
}

/**
 * Fetch Binance price data for token pair via secure proxy
 */
export async function fetchBinancePrice(inputToken: string, outputToken: string, timestamp?: number): Promise<BinancePriceData> {
  try {
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
    
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json'
      },
      // Increase timeout to handle job polling (30 seconds + buffer)
      signal: AbortSignal.timeout(35000) // 35 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (errorData.error && errorData.error.includes('Pair not found')) {
        throw new Error('Pair not found');
      }

      throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Unknown error from proxy');
    }
    
    return responseData.data as BinancePriceData;
  } catch (error) {
    console.error('Error fetching Binance price:', error);
    throw error;
  }
}

