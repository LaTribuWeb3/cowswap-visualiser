/**
 * Network Configuration
 * Maps network IDs to their database names and display information
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  databaseName: string;
  rpcEndpoint?: string;
  explorerUrl?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Supported networks configuration
 * Maps chain ID to network details and database name
 */
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  '1': {
    chainId: 1,
    name: 'Ethereum Mainnet',
    databaseName: 'mainnet-visualiser',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  '42161': {
    chainId: 42161,
    name: 'Arbitrum One',
    databaseName: 'arbitrum-visualiser',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  }
};

/**
 * Get list of supported networks
 */
export function getSupportedNetworks(): NetworkConfig[] {
  return Object.values(NETWORK_CONFIGS);
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfig(chainId: string | number): NetworkConfig | undefined {
  return NETWORK_CONFIGS[chainId.toString()];
}

/**
 * Get database name for a given network ID
 */
export function getDatabaseName(networkId: string | number): string {
  const config = getNetworkConfig(networkId);
  return config?.databaseName || 'mainnet-visualizer';
}

/**
 * Check if a network is supported
 */
export function isNetworkSupported(chainId: string | number): boolean {
  return chainId.toString() in NETWORK_CONFIGS;
}

/**
 * Get default network ID
 */
export function getDefaultNetworkId(): string {
  return '1'; // Ethereum Mainnet
}


