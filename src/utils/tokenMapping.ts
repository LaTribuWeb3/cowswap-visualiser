import { arbitrumTokens } from './arbitrumTokens';
import { ethereumTokens } from './ethereumTokens';
import { getCurrentNetwork } from '../services/networkService';

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

/**
 * Get token metadata for a given address
 * @param tokenAddress - The token contract address
 * @returns TokenInfo object or null if not found
 */
export function getTokenMetadata(tokenAddress: string): TokenInfo | null {
  const network = getCurrentNetwork();
  const lower = tokenAddress.toLowerCase();
  const tokenData = network === 'arbitrum'
    ? arbitrumTokens[lower]
    : ethereumTokens[lower];
  
  if (tokenData) {
    return {
      symbol: tokenData.tokenSymbol,
      name: tokenData.tokenName,
      type: 'erc20',
      decimals: tokenData.tokenDecimals,
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
export function getTokenDisplaySymbol(tokenAddress: string, metadata?: Partial<TokenInfo>): string {
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
export function getTokenDisplayName(tokenAddress: string, metadata?: Partial<TokenInfo>): string | null {
  if (metadata?.name) {
    return metadata.name;
  }
  
  const tokenInfo = getTokenMetadata(tokenAddress);
  if (tokenInfo?.name) {
    return tokenInfo.name;
  }
  
  return null;
}
