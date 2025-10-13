import { TokenInfo, FormattedAmount, ConversionRate } from './types';

// Token information cache
const tokenDecimalsCache: Record<`0x${string}`, number> = {};
const tokenSymbolsCache: Record<`0x${string}`, string> = {};
const tokenInfoCache: Record<`0x${string}`, TokenInfo> = {};

// Persistent cache keys for localStorage
const TOKEN_CACHE_KEY = 'cow_swap_token_cache';
const FAILED_LOOKUPS_KEY = 'cow_swap_failed_lookups';

/**
 * Load token cache from localStorage
 */
function loadTokenCacheFromStorage(): void {
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (cached) {
      const cacheData = JSON.parse(cached);
      Object.assign(tokenInfoCache, cacheData);
      console.log(`📦 Loaded ${Object.keys(cacheData).length} tokens from persistent cache`);
    }
  } catch (error) {
    console.warn('Failed to load token cache from localStorage:', error);
  }
}

/**
 * Save token cache to localStorage
 */
function saveTokenCacheToStorage(): void {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(tokenInfoCache));
    console.log(`💾 Saved ${Object.keys(tokenInfoCache).length} tokens to persistent cache`);
  } catch (error) {
    console.warn('Failed to save token cache to localStorage:', error);
  }
}

/**
 * Load failed lookups from localStorage
 */
function loadFailedLookupsFromStorage(): void {
  try {
    const cached = localStorage.getItem(FAILED_LOOKUPS_KEY);
    if (cached) {
      const failedLookups = JSON.parse(cached);
      failedLookups.forEach((address: string) => {
        if (!tokenInfoCache[address as `0x${string}`]) {
          failedTokenLookups.add(address);
        }
      });
      console.log(`📦 Loaded ${failedLookups.length} failed lookups from persistent cache`);
    }
  } catch (error) {
    console.warn('Failed to load failed lookups from localStorage:', error);
  }
}

/**
 * Save failed lookups to localStorage
 */
function saveFailedLookupsToStorage(): void {
  try {
    localStorage.setItem(FAILED_LOOKUPS_KEY, JSON.stringify(Array.from(failedTokenLookups)));
  } catch (error) {
    console.warn('Failed to save failed lookups to localStorage:', error);
  }
}

// Initialize caches from localStorage when the module loads
loadTokenCacheFromStorage();
loadFailedLookupsFromStorage();


/**
 * Get token decimals from cache or fetch from contract
 */
export async function getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
  // Check cache first
  if (tokenDecimalsCache[tokenAddress]) {
    return tokenDecimalsCache[tokenAddress];
  }

  try {
    // Fetch from la-tribu API
    const metadata = await fetchTokenMetadata(tokenAddress);
    tokenDecimalsCache[tokenAddress] = metadata.decimals;
    return metadata.decimals;
  } catch (error) {
    console.warn(`Failed to fetch decimals for token ${tokenAddress}:`, error);
  }

  // Default to 18 decimals
  const defaultDecimals = 18;
  tokenDecimalsCache[tokenAddress] = defaultDecimals;
  return defaultDecimals;
}

/**
 * Get token information (synchronous - only from cache)
 */
export function getTokenInfo(tokenAddress: `0x${string}`): TokenInfo {
  return tokenInfoCache[tokenAddress] || {
    symbol: generateFallbackSymbol(tokenAddress),
    name: `Token ${formatAddress(tokenAddress)}`,
    decimals: 18,
    address: tokenAddress
  };
}

/**
 * Fetch token metadata with enhanced retry logic and multiple fallback sources
 */
async function fetchTokenMetadata(tokenAddress: `0x${string}`): Promise<{ symbol: string; name: string; decimals: number }> {
  const maxRetries = 5;
  const timeoutMs = 15000; // 15 seconds timeout
  const retryDelayMs = 2000; // 2 seconds between retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${maxRetries} to fetch token metadata for: ${tokenAddress}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      // Create the fetch promise with enhanced error handling
      const fetchPromise = fetch(`${process.env.TOKENS_METADATA_API_URL || 'https://tokens-metadata.la-tribu.xyz'}/tokens/ethereum/${tokenAddress}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TOKEN_METADATA_API_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'COW-Swap-Visualizer/1.0'
        },
        // Add timeout to the fetch itself
        signal: AbortSignal.timeout(timeoutMs)
      });
      
      // Race between timeout and fetch
      const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.symbol || !data.name) {
        throw new Error('Invalid token metadata response - missing symbol or name');
    }

      console.log(`✅ Fetched token metadata on attempt ${attempt}: ${data.symbol} - ${data.name} (${data.decimals || 18} decimals)`);
    
    // Debug: Check if decimals are missing or suspicious
    if (!data.decimals || data.decimals === 0) {
      console.warn(`⚠️ Token ${tokenAddress} (${data.symbol}) has missing or zero decimals, using default 18`);
    }
    
    return {
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals || 18
    };

  } catch (error) {
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${tokenAddress}:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const baseDelay = retryDelayMs * Math.pow(1.5, attempt - 1);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const delayMs = Math.min(baseDelay + jitter, 10000); // Cap at 10 seconds
        
        console.log(`⏳ Waiting ${Math.round(delayMs)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // All retries failed, default to 18 decimals
        console.log(`🔄 All ${maxRetries} attempts failed, defaulting to 18 decimals...`);
        return {
          symbol: generateFallbackSymbol(tokenAddress),
          name: `Token ${formatAddress(tokenAddress)}`,
          decimals: 18
        };
      }
    }
  }

  // This should never be reached due to the default above, but just in case
  throw new Error(`Failed to fetch token metadata for ${tokenAddress} after ${maxRetries} attempts`);
}

/**
 * Generate a fallback symbol when all sources fail
 */
function generateFallbackSymbol(tokenAddress: string): string {
  // Extract first 4 characters after 0x for a readable symbol
  const shortAddress = tokenAddress.slice(2, 6).toUpperCase();
  return `TKN${shortAddress}`;
}

/**
 * Check if a token info is real data (not fallback)
 */
function isRealTokenData(tokenInfo: TokenInfo): boolean {
  // Real token data should not start with "TKN" (our fallback prefix)
  return !tokenInfo.symbol.startsWith('TKN');
}

/**
 * Check if we have real cached token data
 */
export function hasRealTokenData(tokenAddress: `0x${string}`): boolean {
  const cached = tokenInfoCache[tokenAddress];
  return cached ? isRealTokenData(cached) : false;
}

/**
 * Get token information synchronously (only from cache)
 * Returns address if not cached - use for instant display
 */
export function getTokenInfoSync(tokenAddress: `0x${string}`): TokenInfo {
  // Check cache first
  if (tokenInfoCache[tokenAddress]) {
    return tokenInfoCache[tokenAddress];
  }

  // Return fallback symbol as placeholder - will be updated async
  const placeholderInfo: TokenInfo = {
    symbol: generateFallbackSymbol(tokenAddress),
    name: `Token ${formatAddress(tokenAddress)}`,
    decimals: 18, // Default to 18, but we'll show raw amounts when decimals are unknown
    address: tokenAddress,
    isLoading: true // Mark as loading to apply skeleton animation
  };
  
  return placeholderInfo;
}

/**
 * Get token information (asynchronous - fetches from backend if needed)
 */
export async function getTokenInfoAsync(tokenAddress: `0x${string}`): Promise<TokenInfo> {
  // Check cache first
  if (tokenInfoCache[tokenAddress]) {
    return tokenInfoCache[tokenAddress];
  }

  try {
    // Fetch token metadata from la-tribu API
    const metadata = await fetchTokenMetadata(tokenAddress);
    
    const tokenInfo: TokenInfo = {
      symbol: metadata.symbol,
      name: metadata.name,
      decimals: metadata.decimals,
      address: tokenAddress
    };
    
    // Only cache if we have real token data
    if (isRealTokenData(tokenInfo)) {
      tokenInfoCache[tokenAddress] = tokenInfo;
      tokenSymbolsCache[tokenAddress] = metadata.symbol;
      tokenDecimalsCache[tokenAddress] = metadata.decimals;
    }
    
    return tokenInfo;
  } catch (error) {
    console.warn(`Failed to fetch token info for ${tokenAddress}:`, error);
    
    // Don't cache fallback data - let it retry later
    // Return fallback info without caching
    const tokenInfo: TokenInfo = {
      symbol: generateFallbackSymbol(tokenAddress),
      name: `Token ${formatAddress(tokenAddress)}`,
      decimals: 18,
      address: tokenAddress
    };
    
    return tokenInfo;
  }
}

/**
 * Track failed token lookups for background retry
 */
const failedTokenLookups = new Set<string>();
const retryQueue: string[] = [];

/**
 * Fetch token info async and update all DOM elements tagged with this address
 * This allows for progressive enhancement of the UI
 */
export async function fetchTokenInfoAndUpdateDOM(
  tokenAddress: `0x${string}`
): Promise<void> {
  // If already cached with real data, update immediately
  if (tokenInfoCache[tokenAddress] && isRealTokenData(tokenInfoCache[tokenAddress])) {
    updateAllTokenElements(tokenAddress, tokenInfoCache[tokenAddress]);
    return;
  }

  try {
    // Fetch token metadata with enhanced retry logic
    const metadata = await fetchTokenMetadata(tokenAddress);
    
    const tokenInfo: TokenInfo = {
      symbol: metadata.symbol,
      name: metadata.name,
      decimals: metadata.decimals,
      address: tokenAddress
    };
    
    // Only cache if we have real token data
    if (isRealTokenData(tokenInfo)) {
      tokenInfoCache[tokenAddress] = tokenInfo;
      tokenSymbolsCache[tokenAddress] = metadata.symbol;
      tokenDecimalsCache[tokenAddress] = metadata.decimals;
      
      // Remove from failed lookups if it was there
      failedTokenLookups.delete(tokenAddress);
      
      // Save to persistent cache
      saveTokenCacheToStorage();
      saveFailedLookupsToStorage();
      
      // Update all DOM elements with this token address
      updateAllTokenElements(tokenAddress, tokenInfo);
      
      console.log(`✅ Updated all elements for token ${tokenAddress} with: ${tokenInfo.symbol} - ${tokenInfo.name}`);
    }
  } catch (error) {
    console.warn(`Failed to fetch token info for ${tokenAddress}:`, error);
    
    // Add to failed lookups for background retry
    failedTokenLookups.add(tokenAddress);
    if (!retryQueue.includes(tokenAddress)) {
      retryQueue.push(tokenAddress);
    }
    
    // Start background retry process if not already running
    if (retryQueue.length === 1) {
      setTimeout(() => retryFailedTokenLookups(), 5000); // Retry after 5 seconds
    }
    
    // Don't update DOM with fallback symbols - keep existing data
    console.log(`⚠️ Keeping existing token display for ${tokenAddress} while retrying...`);
  }
}

/**
 * Background retry process for failed token lookups
 */
async function retryFailedTokenLookups(): Promise<void> {
  if (retryQueue.length === 0) {
    return;
  }

  console.log(`🔄 Starting background retry for ${retryQueue.length} failed token lookups...`);
  
  const tokensToRetry = [...retryQueue];
  retryQueue.length = 0; // Clear the queue
  
  for (const tokenAddress of tokensToRetry) {
    if (tokenInfoCache[tokenAddress as `0x${string}`]) {
      // Already resolved, skip
      continue;
    }
    
    try {
      console.log(`🔄 Background retry for token: ${tokenAddress}`);
      const metadata = await fetchTokenMetadata(tokenAddress as `0x${string}`);
      
      const tokenInfo: TokenInfo = {
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        address: tokenAddress as `0x${string}`
      };
      
      // Only cache if we have real token data
      if (isRealTokenData(tokenInfo)) {
        tokenInfoCache[tokenAddress as `0x${string}`] = tokenInfo;
        tokenSymbolsCache[tokenAddress as `0x${string}`] = metadata.symbol;
        tokenDecimalsCache[tokenAddress as `0x${string}`] = metadata.decimals;
        
        // Remove from failed lookups
        failedTokenLookups.delete(tokenAddress);
        
        // Save to persistent cache
        saveTokenCacheToStorage();
        saveFailedLookupsToStorage();
        
        // Update all DOM elements with this token address
        updateAllTokenElements(tokenAddress, tokenInfo);
        
        console.log(`✅ Background retry successful for ${tokenAddress}: ${tokenInfo.symbol} - ${tokenInfo.name}`);
      }
      
      // Small delay between retries to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.warn(`⚠️ Background retry failed for ${tokenAddress}:`, error);
      // Keep in failed lookups for potential future retry
    }
  }
  
  // Schedule another retry if there are still failed lookups
  if (failedTokenLookups.size > 0) {
    console.log(`⏳ Scheduling another retry in 30 seconds for ${failedTokenLookups.size} remaining tokens...`);
    setTimeout(() => retryFailedTokenLookups(), 30000); // Retry again in 30 seconds
  }
}

/**
 * Get list of currently unresolved token addresses
 */
export function getUnresolvedTokens(): string[] {
  return Array.from(failedTokenLookups);
}

/**
 * Force retry for specific token addresses
 */
export async function forceRetryTokens(tokenAddresses: string[]): Promise<void> {
  for (const address of tokenAddresses) {
    if (!retryQueue.includes(address)) {
      retryQueue.push(address);
    }
  }
  
  if (retryQueue.length > 0) {
    setTimeout(() => retryFailedTokenLookups(), 1000); // Retry in 1 second
  }
}


/**
 * Clear all caches (useful for debugging)
 */
export function clearAllCaches(): void {
  // Clear memory caches
  Object.keys(tokenInfoCache).forEach(key => delete tokenInfoCache[key as `0x${string}`]);
  Object.keys(tokenSymbolsCache).forEach(key => delete tokenSymbolsCache[key as `0x${string}`]);
  Object.keys(tokenDecimalsCache).forEach(key => delete tokenDecimalsCache[key as `0x${string}`]);
  
  // Clear failed lookups
  failedTokenLookups.clear();
  retryQueue.length = 0;
  
  // Clear localStorage
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
    localStorage.removeItem(FAILED_LOOKUPS_KEY);
    console.log('🧹 All caches cleared');
  } catch (error) {
    console.warn('Failed to clear localStorage caches:', error);
  }
}

/**
 * Update all DOM elements tagged with a specific token address
 */
function updateAllTokenElements(tokenAddress: string, tokenInfo: TokenInfo): void {
  // Find all elements tagged with this token address
  const symbolElements = document.querySelectorAll(`[data-token-address="${tokenAddress}"][data-token-field="symbol"]`);
  const nameElements = document.querySelectorAll(`[data-token-address="${tokenAddress}"][data-token-field="name"]`);
  const amountElements = document.querySelectorAll(`[data-token-address="${tokenAddress}"][data-amount-type]`);
  
  // Update all symbol elements
  symbolElements.forEach(element => {
    element.textContent = tokenInfo.symbol;
    // Remove loading class once real data is loaded
    element.classList.remove('token-loading');
  });
  
  // Update all name elements
  nameElements.forEach(element => {
    element.textContent = tokenInfo.name;
    // Remove loading class once real data is loaded
    element.classList.remove('token-loading');
  });
  
  // Update all amount elements with proper decimals
  // We already have tokenInfo with correct decimals, so use it directly
  amountElements.forEach(element => {
    const tradeIndex = element.getAttribute('data-trade-index');
    const amountType = element.getAttribute('data-amount-type');
    
    if (tradeIndex && amountType) {
      try {
        // Get the trade data from the element's parent row
        const row = element.closest('tr');
        if (row) {
          const tradeHash = row.querySelector('.trade-hash')?.textContent;
          if (tradeHash) {
            // Find the trade in state (access via window object)
            const trade = (window as any).appState?.trades?.[parseInt(tradeIndex)];
            if (trade) {
              const rawAmount = amountType === 'sell' ? 
                (trade.executedSellAmount || trade.sellAmount) : 
                (trade.executedBuyAmount || trade.buyAmount);
              
              if (rawAmount) {
                console.log(`🔍 Formatting ${amountType} amount for trade ${tradeIndex}: raw=${rawAmount}, token=${tokenAddress}, decimals=${tokenInfo.decimals}`);
                const formattedAmount = formatAmountWithDecimals(rawAmount, tokenInfo.decimals);
                element.textContent = formattedAmount;
                console.log(`✅ Updated ${amountType} amount for trade ${tradeIndex}: ${formattedAmount}`);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to update amount for trade ${tradeIndex}:`, error);
      }
    }
  });
  
  console.log(`✅ Updated ${symbolElements.length} symbol elements, ${nameElements.length} name elements, and ${amountElements.length} amount elements for ${tokenAddress}`);
}

/**
 * Get token symbol from address
 */
export async function getTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
  // Check cache first
  if (tokenSymbolsCache[tokenAddress]) {
    return tokenSymbolsCache[tokenAddress];
  }

  try {
    // Fetch from la-tribu API
    const metadata = await fetchTokenMetadata(tokenAddress);
    tokenSymbolsCache[tokenAddress] = metadata.symbol;
    return metadata.symbol;
  } catch (error) {
    console.warn(`Failed to fetch symbol for token ${tokenAddress}:`, error);
  }

  // Default to fallback symbol
  return generateFallbackSymbol(tokenAddress);
}


/**
 * Format number with proper decimal places
 */
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Format currency values
 */
export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(num);
}

/**
 * Format price values
 */
export function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  
  // Use scientific notation for very small numbers (< 0.01) or very large numbers (> 100)
  if ((num < 0.01 && num > 0) || num > 100) {
    return `$${num.toExponential(3)}`;
  }
  
  return formatCurrency(num);
}

/**
 * Format small numbers using scientific notation for better readability
 */
export function formatScientific(value: number | string, threshold: number = 0.001): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  // Use scientific notation for very small numbers
  if (Math.abs(num) < threshold && num !== 0) {
    return num.toExponential(3);
  }
  
  // For larger numbers, use regular formatting with appropriate decimal places
  if (Math.abs(num) >= 1) {
    return num.toFixed(6);
  } else {
    return num.toFixed(8);
  }
}

/**
 * Format token amount with proper decimals
 */
export function formatAmount(amount: string | undefined | null, decimals: number): string {
  if (!amount) return '0';
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return formatNumber(num, 6);
}

/**
 * Convert scientific notation to BigInt string
 */
export function convertScientificToBigInt(amount: string | undefined | null): string {
  if (!amount) return '0';
  
  // If it's already a regular number string, return as is
  if (!amount.includes('e+') && !amount.includes('e-') && !amount.includes('E+') && !amount.includes('E-')) {
    return amount;
  }
  
  try {
    // Convert scientific notation to number, then to BigInt
    const num = parseFloat(amount);
    if (isNaN(num)) {
      console.warn(`⚠️ Invalid scientific notation: ${amount}`);
      return '0';
    }
    
    // Convert to BigInt by using the integer part
    const bigIntStr = BigInt(Math.floor(num)).toString();
    console.log(`🔢 Converted scientific notation: ${amount} → ${bigIntStr}`);
    return bigIntStr;
  } catch (error) {
    console.error(`❌ Failed to convert scientific notation ${amount}:`, error);
    return '0';
  }
}

/**
 * Format raw token amount without decimal conversion (for unknown tokens)
 */
export function formatRawAmount(amount: string | undefined | null): string {
  if (!amount) return '0';
  
  // Convert scientific notation to BigInt if needed
  const normalizedAmount = convertScientificToBigInt(amount);
  return new Intl.NumberFormat('en-US').format(BigInt(normalizedAmount));
}

/**
 * Format token amount with proper decimals, maintaining float precision
 */
export function formatAmountWithDecimals(amount: string | undefined | null, decimals: number): string {
  if (!amount) return '0';
  
  // Convert scientific notation to BigInt if needed
  const normalizedAmount = convertScientificToBigInt(amount);
  
  // Use BigInt for precise calculation to avoid floating point precision issues
  const amountBigInt = BigInt(normalizedAmount);
  const divisorBigInt = BigInt(Math.pow(10, decimals));
  
  // Calculate integer and fractional parts
  const integerPart = amountBigInt / divisorBigInt;
  const fractionalPart = amountBigInt % divisorBigInt;
  
  // Convert fractional part to decimal string with proper padding
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  
  // Remove trailing zeros from fractional part
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }
  
  // Limit to 6 decimal places for display
  const displayFractional = trimmedFractional.slice(0, 6);
  
  return `${integerPart}.${displayFractional}`;
}

/**
 * Format token amount synchronously using cached decimals or default 18
 * For instant display - will be updated once metadata is fetched
 */
export function formatTokenAmountSync(amount: string | undefined | null, tokenAddress: `0x${string}`): string {
  if (!amount) return '0';
  
  try {
    // Check if we have cached token info
    const tokenInfo = getTokenInfoSync(tokenAddress);
    return formatAmountWithDecimals(amount, tokenInfo.decimals);
  } catch (error) {
    console.warn(`Failed to format amount for ${tokenAddress}, showing raw amount:`, error);
    return formatRawAmount(amount);
  }
}

/**
 * Format token amount using token address (fetches decimals automatically)
 * Falls back to raw amount if token info is not available
 */
export async function formatTokenAmount(amount: string | undefined | null, tokenAddress: `0x${string}`): Promise<string> {
  if (!amount) return '0';
  
  try {
    const decimals = await getTokenDecimals(tokenAddress);
    return formatAmountWithDecimals(amount, decimals);
  } catch (error) {
    console.warn(`Failed to get decimals for ${tokenAddress}, showing raw amount:`, error);
    return formatRawAmount(amount);
  }
}

/**
 * Calculate exchange rate between two amounts
 */
export function calculateExchangeRate(amount1: string, decimals1: number, amount2: string, decimals2: number): string {
  const num1 = parseFloat(amount1) / Math.pow(10, decimals1);
  const num2 = parseFloat(amount2) / Math.pow(10, decimals2);
  
  if (num1 === 0) return '0';
  
  const rate = num2 / num1;
  
  // Use scientific notation for very small numbers (< 0.01) or very large numbers (> 100)
  if (rate < 0.01 || rate > 100) {
    return rate.toExponential(3);
  }
  
  return formatNumber(rate, 6);
}

/**
 * Safely format a date that might be a Date object or string from database
 */
export function formatDatabaseDate(dateValue: Date | string | null | undefined): string {
  if (!dateValue) {
    return 'No Date';
  }
  
  try {
    let date: Date;
    
    if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      date = new Date(dateValue);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Error formatting database date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format gas used
 */
export function formatGasUsed(gasUsed: string | undefined | null): string {
  if (!gasUsed) return '0';
  const gas = parseInt(gasUsed);
  return new Intl.NumberFormat('en-US').format(gas);
}

/**
 * Format gas price
 */
export function formatGasPrice(gasPrice: string | undefined | null): string {
  if (!gasPrice) return '0 Gwei';
  const price = parseInt(gasPrice);
  const gwei = price / 1e9;
  return `${formatNumber(gwei, 2)} Gwei`;
}

/**
 * Format address for display
 */
export function formatAddress(address: string | undefined | null): string {
  if (!address || address.length < 10) return address || 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Calculate conversion rates from clearing prices
 */
export function calculateConversionRates(
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: string,
  buyAmount: string,
  sellDecimals: number,
  buyDecimals: number
): ConversionRate {
  const sellAmountHuman = parseFloat(sellAmount) / Math.pow(10, sellDecimals);
  const buyAmountHuman = parseFloat(buyAmount) / Math.pow(10, buyDecimals);
  
  const rate = sellAmountHuman > 0 ? buyAmountHuman / sellAmountHuman : 0;
  const inverseRate = buyAmountHuman > 0 ? sellAmountHuman / buyAmountHuman : 0;
  
  return {
    from: getTokenInfo(sellToken).symbol,
    to: getTokenInfo(buyToken).symbol,
    rate: formatNumber(rate, 6),
    inverseRate: formatNumber(inverseRate, 6)
  };
}

