# Configuration Directory

This directory contains configuration files for the CoW Protocol Trade Visualizer.

## Files

### `networks.ts`

Network configuration mapping that defines:
- Supported blockchain networks
- Database names for each network
- Network metadata (name, chain ID, explorer URL, etc.)

**Key Functions:**
- `getDatabaseName(networkId)` - Get database name for a network
- `getNetworkConfig(chainId)` - Get full network configuration
- `getSupportedNetworks()` - Get list of all supported networks
- `isNetworkSupported(chainId)` - Check if a network is supported

**Current Networks:**
- Ethereum Mainnet (Chain ID: 1) → Database: `mainnet-visualizer`
- Arbitrum One (Chain ID: 42161) → Database: `arbitrum-visualizer`

## Adding New Networks

To add support for a new network:

1. Edit `networks.ts`
2. Add new entry to `NETWORK_CONFIGS`:
   ```typescript
   '137': {
     chainId: 137,
     name: 'Polygon',
     databaseName: 'polygon-visualizer',
     explorerUrl: 'https://polygonscan.com',
     nativeCurrency: {
       name: 'MATIC',
       symbol: 'MATIC',
       decimals: 18
     }
   }
   ```
3. Rebuild the project: `npm run build`
4. Restart the application

The new network will automatically appear in the network selector dropdown.

## Database Naming Convention

All databases follow the pattern: `{network}-visualizer`

Examples:
- `mainnet-visualizer`
- `arbitrum-visualizer`
- `polygon-visualizer` (if added)
- `base-visualizer` (if added)

This ensures:
- Consistent naming across networks
- Easy identification of network data
- Clean separation of concerns


