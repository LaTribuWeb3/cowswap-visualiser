export interface TokenInfo {
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

// Common tokens on Arbitrum with their metadata
export const ARBITRUM_TOKEN_MAPPING: Record<string, { symbol: string; name: string }> = {
  // Stablecoins
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', name: 'USD Coin' },
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', name: 'Tether USD' },
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': { symbol: 'DAI', name: 'Dai Stablecoin' },
  
  // Native and Wrapped
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH', name: 'Wrapped Ether' },
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { symbol: 'WBTC', name: 'Wrapped BTC' },
  '0x5979d7b546e38e414f7e9822514be443a4800529': { symbol: 'wstETH', name: 'Wrapped stETH' },
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': { symbol: 'USDC.e', name: 'USDC.e' },
  
  // Layer 2 Tokens
  '0x912ce59144191c1204e64559fe8253a0e49e6548': { symbol: 'ARB', name: 'Arbitrum' },
  '0x6c84a8f1c29108f47a79964b5fe888d4f4d0de40': { symbol: 'OP', name: 'Optimism' },
  
  // DeFi Tokens
  '0x539bde0d7dbd336b79148aa742883198bbf60342': { symbol: 'MAGIC', name: 'MAGIC' },
  '0x4d15a3a2286d883af0aa1b3f21367843fac63e07': { symbol: 'TRU', name: 'TrueFi' },
  '0x11cdb42b0eb46d95f990bedd4695a6e3fa034978': { symbol: 'CRV', name: 'Curve DAO Token' },
  '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a': { symbol: 'GMX', name: 'GMX' },
  '0x4277f8f2c384827b5273592ff7cebd9f2c1ac258': { symbol: 'GRAIL', name: 'Camelot Token' },
  '0x3d9907f9a368ad0a51be60f7da3b97cf940982d8': { symbol: 'GRAIL', name: 'GRAIL' },
  '0xcb8b5cd20bdcaea9a010ac1f8d835824f5c87a04': { symbol: 'COW', name: 'COW' },
  
  // Additional popular tokens
  '0x6694340fc020c5a6b8c8d0c1808a5c4b0b0b0b0b': { symbol: 'STG', name: 'Stargate Finance' },
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': { symbol: 'MATIC', name: 'Polygon' },
  '0x1a4da80967373fd929961e976b4bce0bc945c5c9': { symbol: 'LINK', name: 'Chainlink' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', name: 'Dai Stablecoin' },
  '0xa0b86a33e6c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0': { symbol: 'UNI', name: 'Uniswap' },
  '0xaa6b1798a97505b36d9c4a3736c2aa48674aeb97': { symbol: 'JOSS', name: 'Joss Sticks' },
  '0x440017a1b021006d556d7fc06a54c32e42eb745b': { symbol: '@G', name: 'G@ARB' },
};

/**
 * Get token metadata for a given address
 * @param tokenAddress - The token contract address
 * @returns TokenInfo object or null if not found
 */
export function getTokenMetadata(tokenAddress: string): TokenInfo | null {
  const commonToken = ARBITRUM_TOKEN_MAPPING[tokenAddress.toLowerCase()];
  
  if (commonToken) {
    return {
      symbol: commonToken.symbol,
      name: commonToken.name,
      type: 'erc20',
      decimals: 18,
      status: 'active',
      id: tokenAddress.toLowerCase()
    };
  }
  
  return null;
}

/**
 * Get token symbol for display, with fallback to shortened address
 * @param tokenAddress - The token contract address
 * @param metadata - Optional existing token metadata
 * @returns Display string (symbol or shortened address)
 */
export function getTokenDisplaySymbol(tokenAddress: string, metadata?: TokenInfo): string {
  if (metadata?.symbol) {
    return metadata.symbol;
  }
  
  const tokenInfo = getTokenMetadata(tokenAddress);
  if (tokenInfo?.symbol) {
    return tokenInfo.symbol;
  }
  
  // Fallback to shortened address
  return tokenAddress.slice(0, 6).toUpperCase();
}

/**
 * Get token name for display
 * @param tokenAddress - The token contract address
 * @param metadata - Optional existing token metadata
 * @returns Display string (name or null)
 */
export function getTokenDisplayName(tokenAddress: string, metadata?: TokenInfo): string | null {
  if (metadata?.name) {
    return metadata.name;
  }
  
  const tokenInfo = getTokenMetadata(tokenAddress);
  if (tokenInfo?.name) {
    return tokenInfo.name;
  }
  
  return null;
}
