import { HistoricalTradesSync } from './historical-trades-sync';
import { getNetworkConfigs, getNetworkIds } from '../utils/config';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

interface SyncOptions {
  monthsBack: number;
  force: boolean;
}

class HistoricalTradesSyncManager {
  private options: SyncOptions;

  constructor(options: SyncOptions) {
    this.options = options;
  }

  async run(): Promise<void> {
    console.log('🚀 CoW Protocol Historical Trades Sync Manager');
    console.log('=============================================');
    console.log(`📅 Target: Past ${this.options.monthsBack} months`);
    console.log(`💪 Force: ${this.options.force}`);
    console.log('=============================================\n');

    try {
      await this.runSync();
    } catch (error) {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    }
  }

  private async runSync(): Promise<void> {
    console.log('🔗 Using blockchain scanning method...');
    
    // Read config.json to get all network IDs
    const config = getNetworkConfigs();
    const networkIds = getNetworkIds();

    console.log(`🌐 Found ${networkIds.length} networks in config: ${networkIds.join(', ')}`);
    console.log(`📅 Will sync the past ${this.options.monthsBack} months for each network\n`);

    // Process each network sequentially
    for (let i = 0; i < networkIds.length; i++) {
      const networkId = networkIds[i];
      const networkConfig = config[networkId];
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 NETWORK ${i + 1}/${networkIds.length}: ${networkConfig.name} (Chain ID: ${networkId})`);
      console.log(`${'='.repeat(60)}\n`);

      const sync = new HistoricalTradesSync(networkId);

      try {
        await sync.initialize(this.options.monthsBack);
        await sync.syncHistoricalTrades();
      } catch (error) {
        console.error(`❌ Error syncing ${networkConfig.name}:`, error);
        console.log(`⏭️  Continuing to next network...\n`);
      } finally {
        await sync.cleanup();
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ COMPLETED: All networks have been processed`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

function parseCommandLineArgs(): SyncOptions {
  const args = process.argv.slice(2);
  let monthsBack = 4;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--months':
      case '-m':
        const months = parseInt(args[++i]);
        if (!isNaN(months) && months > 0) {
          monthsBack = months;
        }
        break;
        
      case '--force':
      case '-f':
        force = true;
        break;
        
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
        
      default:
        if (arg.startsWith('-')) {
          console.error(`❌ Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
        break;
    }
  }

  return { monthsBack, force };
}

function printHelp(): void {
  console.log(`
🚀 CoW Protocol Historical Trades Sync

USAGE:
  npm run sync:historical [OPTIONS]
  npm run sync:historical -- --months 6

OPTIONS:
  -m, --months <number>    Number of months to sync (default: 4)
  -f, --force             Force sync even if data exists
  -h, --help              Show this help message

EXAMPLES:
  # Sync past 4 months for all networks
  npm run sync:historical

  # Sync past 6 months for all networks
  npm run sync:historical -- --months 6

  # Force sync past 3 months
  npm run sync:historical -- --months 3 --force

NOTE:
  This will sync all networks defined in config.json sequentially.
  Currently configured networks: Ethereum Mainnet, Arbitrum One

ENVIRONMENT VARIABLES:
  SQLITE_DATA_DIR - SQLite data directory (optional)
`);
}

// Main execution function
async function main() {
  try {
    const options = parseCommandLineArgs();
    const manager = new HistoricalTradesSyncManager(options);
    await manager.run();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { HistoricalTradesSyncManager, parseCommandLineArgs };
