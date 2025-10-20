import fs from 'fs';
import path from 'path';

/**
 * Load configuration from config.json file with optional RPC overrides
 * @param configPath - Optional path to config file. If not provided, uses default path relative to src/config/config.json
 * @param rpcConfigPath - Optional path to RPC config file for overrides. If not provided, uses src/config/rpc-config.json
 * @returns Parsed configuration object with RPC overrides applied
 */
export function loadConfig(configPath?: string, rpcConfigPath?: string): Record<string, any> {
  try {
    // Use provided path or default to src/config/config.json
    const defaultPath = path.join(__dirname, '../config/config.json');
    const finalPath = configPath || defaultPath;
    
    const configContent = fs.readFileSync(finalPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Load RPC overrides - this is REQUIRED
    const defaultRpcPath = path.join(__dirname, '../config/rpc-config.json');
    const rpcPath = rpcConfigPath || defaultRpcPath;
    
    if (!fs.existsSync(rpcPath)) {
      console.error(`❌ RPC configuration file not found at ${rpcPath}`);
      console.error('\n📋 To fix this issue:');
      console.error('1. Create a file: src/config/rpc-config.json');
      console.error('2. Add your RPC URLs in this format:');
      console.error('   {');
      console.error('     "1": { "rpc": "https://your-ethereum-rpc-url" },');
      console.error('     "42161": { "rpc": "https://your-arbitrum-rpc-url" }');
      console.error('   }');
      console.error('3. Restart the application');
      throw new Error('RPC configuration file is required but not found');
    }
    
    try {
      const rpcConfigContent = fs.readFileSync(rpcPath, 'utf-8');
      const rpcConfig = JSON.parse(rpcConfigContent);
      
      // Merge RPC overrides into main config
      const mergedConfig = { ...config };
      
      for (const networkId in mergedConfig) {
        if (rpcConfig[networkId]?.rpc) {
          console.log(`🔄 Loading RPC for network ${networkId} (${mergedConfig[networkId].name})`);
          mergedConfig[networkId] = {
            ...mergedConfig[networkId],
            rpc: rpcConfig[networkId].rpc
          };
        }
      }
      
      // Validate that all networks have valid RPC URLs
      for (const networkId in mergedConfig) {
        const network = mergedConfig[networkId];
        if (!network.rpc || network.rpc === 'xxx' || network.rpc.trim() === '') {
          console.error(`❌ Invalid or missing RPC URL for network ${networkId} (${network.name})`);
          console.error('\n📋 To fix this issue:');
          console.error(`1. Update src/config/rpc-config.json`);
          console.error(`2. Add a valid RPC URL for network ${networkId}:`);
          console.error(`   "${networkId}": { "rpc": "https://your-rpc-url-for-${network.name.toLowerCase().replace(/\s+/g, '-')}" }`);
          console.error('3. Restart the application');
          throw new Error(`RPC URL not configured for network ${networkId} (${network.name})`);
        }
      }
      
      return mergedConfig;
    } catch (rpcError) {
      if (rpcError instanceof Error && rpcError.message.startsWith('RPC')) {
        // Re-throw our custom RPC errors
        throw rpcError;
      }
      console.error(`❌ Failed to load or parse RPC config from ${rpcPath}:`, rpcError);
      throw new Error(`Invalid RPC configuration file: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('RPC') || error.message.includes('configuration'))) {
      // Re-throw configuration errors
      throw error;
    }
    console.error('Failed to load config file:', error);
    throw new Error(`Could not load configuration from ${configPath || 'default path'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get network configurations from config.json with optional RPC overrides
 * @param configPath - Optional path to config file
 * @param rpcConfigPath - Optional path to RPC config file for overrides
 * @returns Network configurations object with RPC overrides applied
 */
export function getNetworkConfigs(configPath?: string, rpcConfigPath?: string): Record<string, any> {
  return loadConfig(configPath, rpcConfigPath);
}

/**
 * Get list of network IDs from config.json with optional RPC overrides
 * @param configPath - Optional path to config file
 * @param rpcConfigPath - Optional path to RPC config file for overrides
 * @returns Array of network IDs
 */
export function getNetworkIds(configPath?: string, rpcConfigPath?: string): string[] {
  const config = loadConfig(configPath, rpcConfigPath);
  return Object.keys(config);
}
