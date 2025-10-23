import { loadConfig } from '../utils/config';

/**
 * Network Configuration
 * Maps network IDs to their database names and display information
 */
import fs from 'fs';

export interface NetworkConfig {
  chainId: number;
  name: string;
  databaseName: string;
  explorerUrl: string;
  cowNetwork: string;
  rpc: string;
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
/**
 * Get network configurations with dynamic RPC endpoint
 */
export function getNetworkConfigs(): Record<string, NetworkConfig> {
  console.log('🔧 Loading network configurations...');
  const config = loadConfig();
  console.log('🔧 Network configurations loaded:', Object.keys(config).map(id => `${id}: ${config[id].name} (RPC: ${config[id].rpc ? 'SET' : 'NOT SET'})`));
  return config;
}

export const NETWORK_CONFIGS = getNetworkConfigs();

/**
 * Get list of supported networks
 */
export function getSupportedNetworks(): NetworkConfig[] {
  return Object.values(getNetworkConfigs());
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfig(chainId: string | number): NetworkConfig | undefined {
  return getNetworkConfigs()[chainId.toString()];
}

/**
 * Get database name for a given network ID
 * Throws an error if network is not configured
 */
export function getDatabaseName(networkId: string | number): string {
  const config = getNetworkConfig(networkId);
  if (!config) {
    throw new Error(`Network ${networkId} is not configured. Please check your network configuration.`);
  }
  return config.databaseName;
}

/**
 * Check if a network is supported
 */
export function isNetworkSupported(chainId: string | number): boolean {
  return chainId.toString() in NETWORK_CONFIGS;
}

/**
 * Get the first available network ID
 * Throws error if no networks are configured
 */
export function getDefaultNetworkId(): string {
  const configs = getNetworkConfigs();
  const networkIds = Object.keys(configs);
  
  if (networkIds.length === 0) {
    throw new Error('No networks configured. Please check your config.json file.');
  }
  
  return networkIds[0];
}


