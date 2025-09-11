import { TokenInfo, FormattedAmount, ConversionRate } from './types';
import { fetchTokenDecimals } from './api';
import { EthereumService } from '../services/ethereum';

// Token information cache
const tokenDecimalsCache: Record<`0x${string}`, number> = {};
const tokenSymbolsCache: Record<`0x${string}`, string> = {};
const tokenInfoCache: Record<`0x${string}`, TokenInfo> = {};

// Known token information
const KNOWN_TOKENS: Record<`0x${string}`, TokenInfo> = {
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  },
  '0x1aBaEA1f7C830bD89Acc67eC4d5169aAEb4F05d0': {
    symbol: 'EURe',
    name: 'Monerium EUR emoney',
    decimals: 6,
    address: '0x1aBaEA1f7C830bD89Acc67eC4d5169aAEb4F05d0'
  },
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  '0x6B175474E89094C44Da98b954EedeAC495271d0F': {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  // Add more common tokens
  '0x4Fabb145d64652a948d72533023f6E7A623C7C53': {
    symbol: 'BUSD',
    name: 'Binance USD',
    decimals: 18,
    address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53'
  },
  '0x514910771AF9Ca656af840dff83E8264EcF986CA': {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
  },
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': {
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
  },
  '0x7D1AfA7B718fb893dB30A3aBc0Cfc608aCafEBB': {
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608aCafEBB'
  },
  '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE': {
    symbol: 'SHIB',
    name: 'Shiba Inu',
    decimals: 18,
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
  },
  '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39': {
    symbol: 'HEX',
    name: 'HEX',
    decimals: 8,
    address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39'
  },
  '0x4d224452801ACEd8B2F0aebE155379bb5D594381': {
    symbol: 'APE',
    name: 'ApeCoin',
    decimals: 18,
    address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381'
  },
  '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9': {
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'
  },
  '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': {
    symbol: 'MKR',
    name: 'Maker',
    decimals: 18,
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'
  },
  '0x0D8775F648430679A709E98d2b0Cb6250d2887EF': {
    symbol: 'BAT',
    name: 'Basic Attention Token',
    decimals: 18,
    address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'
  },
  '0xE41d2489571d322189246DaFA5ebDe1F4699F498': {
    symbol: 'ZRX',
    name: '0x Protocol',
    decimals: 18,
    address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498'
  },
  '0x8E870D67F660D95d5be530380D0eC0bd388289E1': {
    symbol: 'PAX',
    name: 'Paxos Standard',
    decimals: 18,
    address: '0x8E870D67F660D95d5be530380D0eC0bd388289E1'
  },
  '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd': {
    symbol: 'GUSD',
    name: 'Gemini Dollar',
    decimals: 2,
    address: '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd'
  },
  '0x1456688345527bE1f37E9e627DA0837D6f08C925': {
    symbol: 'USDP',
    name: 'Pax Dollar',
    decimals: 6,
    address: '0x1456688345527bE1f37E9e627DA0837D6f08C925'
  },
  '0x853d955aCEf822Db058eb8505911ED77F175b99e': {
    symbol: 'FRAX',
    name: 'Frax',
    decimals: 18,
    address: '0x853d955aCEf822Db058eb8505911ED77F175b99e'
  },
  '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0': {
    symbol: 'LUSD',
    name: 'Liquity USD',
    decimals: 18,
    address: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0'
  },
  '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0': {
    symbol: 'FXS',
    name: 'Frax Share',
    decimals: 18,
    address: '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0'
  },
  '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32': {
    symbol: 'LDO',
    name: 'Lido DAO',
    decimals: 18,
    address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32'
  },
  '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704': {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704'
  },
  '0xae78736Cd615f374D3085123A210448E74Fc6393': {
    symbol: 'rETH',
    name: 'Rocket Pool ETH',
    decimals: 18,
    address: '0xae78736Cd615f374D3085123A210448E74Fc6393'
  },
  '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84': {
    symbol: 'stETH',
    name: 'Liquid staked Ether 2.0',
    decimals: 18,
    address: '0xae78736Cd615f374D3085123A210448E74Fc6393'
  }
};

// ERC20 ABI for decimals function
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
];

/**
 * Get token decimals from cache or fetch from contract
 */
export async function getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
  // Check cache first
  if (tokenDecimalsCache[tokenAddress]) {
    return tokenDecimalsCache[tokenAddress];
  }

  // Check known tokens
  if (KNOWN_TOKENS[tokenAddress]) {
    const decimals = KNOWN_TOKENS[tokenAddress].decimals;
    tokenDecimalsCache[tokenAddress] = decimals;
    return decimals;
  }

  try {
    // Fetch from backend API instead of direct external API call
    const decimals = await fetchTokenDecimals(tokenAddress);
    tokenDecimalsCache[tokenAddress] = decimals;
    return decimals;
  } catch (error) {
    console.warn(`Failed to fetch decimals for token ${tokenAddress}:`, error);
  }

  // Default to 18 decimals
  const defaultDecimals = 18;
  tokenDecimalsCache[tokenAddress] = defaultDecimals;
  return defaultDecimals;
}

/**
 * Get token information (synchronous - only from cache/known tokens)
 */
export function getTokenInfo(tokenAddress: `0x${string}`): TokenInfo {
  return KNOWN_TOKENS[tokenAddress] || {
    symbol: formatAddress(tokenAddress),
    name: `Token ${formatAddress(tokenAddress)}`,
    decimals: 18,
    address: tokenAddress
  };
}

/**
 * Get token information (asynchronous - fetches from backend if needed)
 */
export async function getTokenInfoAsync(tokenAddress: `0x${string}`): Promise<TokenInfo> {
  // Check cache first
  if (tokenInfoCache[tokenAddress]) {
    return tokenInfoCache[tokenAddress];
  }

  // Check known tokens first
  if (KNOWN_TOKENS[tokenAddress]) {
    tokenInfoCache[tokenAddress] = KNOWN_TOKENS[tokenAddress];
    return KNOWN_TOKENS[tokenAddress];
  }

  try {
    // Fetch both symbol and decimals from backend API
    const ethereumService = new EthereumService();
    const [symbol, decimals] = await Promise.all([
      ethereumService.fetchTokenSymbol(tokenAddress),
      getTokenDecimals(tokenAddress)
    ]);
    
    const tokenInfo: TokenInfo = {
      symbol: symbol,
      name: `Token ${symbol}`,
      decimals: decimals,
      address: tokenAddress
    };
    
    // Cache the complete token info
    tokenInfoCache[tokenAddress] = tokenInfo;
    tokenSymbolsCache[tokenAddress] = symbol;
    tokenDecimalsCache[tokenAddress] = decimals;
    
    return tokenInfo;
  } catch (error) {
    console.warn(`Failed to fetch token info for ${tokenAddress}:`, error);
    
    // Fallback to formatted address with default decimals
    const tokenInfo: TokenInfo = {
      symbol: formatAddress(tokenAddress),
      name: `Token ${formatAddress(tokenAddress)}`,
      decimals: 18,
      address: tokenAddress
    };
    
    tokenInfoCache[tokenAddress] = tokenInfo;
    return tokenInfo;
  }
}

/**
 * Get token symbol from address
 */
export async function getTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
  // Check cache first
  if (tokenSymbolsCache[tokenAddress]) {
    return tokenSymbolsCache[tokenAddress];
  }

  // Check known tokens
  if (KNOWN_TOKENS[tokenAddress]) {
    const symbol = KNOWN_TOKENS[tokenAddress].symbol;
    tokenSymbolsCache[tokenAddress] = symbol;
    return symbol;
  }

  try {
    // Fetch from backend API
    const ethereumService = new EthereumService();
    const symbol = await ethereumService.fetchTokenSymbol(tokenAddress as `0x${string}`);
    tokenSymbolsCache[tokenAddress] = symbol;
    return symbol;
  } catch (error) {
    console.warn(`Failed to fetch symbol for token ${tokenAddress}:`, error);
  }

  // Default to formatted address
  return formatAddress(tokenAddress);;
}

/**
 * Get token address from symbol (reverse lookup)
 */
export function getTokenAddress(symbol: string): string | null {
  const token = Object.values(KNOWN_TOKENS).find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  return token ? token.address : null;
}

/**
 * Check if token symbol is known
 */
export function isKnownTokenSymbol(symbol: string): boolean {
  return Object.values(KNOWN_TOKENS).some(t => t.symbol.toUpperCase() === symbol.toUpperCase());
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
 * Format token amount with proper decimals, maintaining float precision
 */
export function formatAmountWithDecimals(amount: string | undefined | null, decimals: number): string {
  if (!amount) return '0';
  
  // Use BigInt for precise calculation to avoid floating point precision issues
  const amountBigInt = BigInt(amount);
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
 * Format token amount using token address (fetches decimals automatically)
 */
export async function formatTokenAmount(amount: string | undefined | null, tokenAddress: `0x${string}`): Promise<string> {
  if (!amount) return '0';
  
  const decimals = await getTokenDecimals(tokenAddress);
  return formatAmountWithDecimals(amount, decimals);
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

