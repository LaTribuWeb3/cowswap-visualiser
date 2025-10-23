/**
 * Frontend Network Configuration
 * Reads network configuration from config.json to maintain single source of truth
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  databaseName: string;
  explorerUrl: string;
  cowNetwork: string;
}

// Cache for network configurations
let networkConfigCache: Record<string, NetworkConfig> | null = null;

/**
 * Load network configurations from config.json
 * Filters out RPC and nativeCurrency fields for frontend use
 * Throws error if config.json is not available
 */
async function loadNetworkConfigs(): Promise<Record<string, NetworkConfig>> {
  if (networkConfigCache) {
    return networkConfigCache;
  }

  const response = await fetch('/config/config.json');
  if (!response.ok) {
    const error = `Failed to load config.json: HTTP ${response.status}`;
    console.error('❌', error);
    throw new Error(error);
  }
  
  const fullConfig = await response.json();
  
  // Filter out RPC and nativeCurrency fields for frontend use
  const filteredConfig: Record<string, NetworkConfig> = {};
  
  for (const [networkId, config] of Object.entries(fullConfig)) {
    const networkConfig = config as any;
    filteredConfig[networkId] = {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
      databaseName: networkConfig.databaseName,
      explorerUrl: networkConfig.explorerUrl,
      cowNetwork: networkConfig.cowNetwork
    };
  }
  
  networkConfigCache = filteredConfig;
  return filteredConfig;
}

/**
 * Get network configurations
 */
export async function getNetworkConfigs(): Promise<Record<string, NetworkConfig>> {
  return await loadNetworkConfigs();
}

/**
 * Get network configuration by chain ID
 */
export async function getNetworkConfig(chainId: string | number): Promise<NetworkConfig | undefined> {
  const configs = await getNetworkConfigs();
  return configs[chainId.toString()];
}
