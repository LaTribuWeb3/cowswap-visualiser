import { HistoricalTradesSync } from './historical-trades-sync';
import { CowApiHistoricalSync } from './cow-api-historical-sync';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SyncOptions {
  monthsBack: number;
  method: 'blockchain' | 'api' | 'auto';
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
    console.log(`🔧 Method: ${this.options.method}`);
    console.log(`💪 Force: ${this.options.force}`);
    console.log('=============================================\n');

    try {
      if (this.options.method === 'blockchain') {
        await this.runBlockchainSync();
      } else if (this.options.method === 'api') {
        await this.runApiSync();
      } else {
        await this.runAutoSync();
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    }
  }

  private async runBlockchainSync(): Promise<void> {
    console.log('🔗 Using blockchain scanning method...');
    const sync = new HistoricalTradesSync();
    
    try {
      await sync.initialize();
      await sync.syncHistoricalTrades();
    } finally {
      await sync.cleanup();
    }
  }

  private async runApiSync(): Promise<void> {
    console.log('🌐 Using CoW Protocol API method...');
    const sync = new CowApiHistoricalSync();
    
    try {
      await sync.initialize();
      await sync.syncHistoricalData(this.options.monthsBack);
    } finally {
      await sync.cleanup();
    }
  }

  private async runAutoSync(): Promise<void> {
    console.log('🤖 Using auto-selection method...');
    
    // Try API first (faster and more reliable)
    try {
      console.log('🔄 Attempting CoW API sync first...');
      await this.runApiSync();
      return;
    } catch (error) {
      console.log('⚠️ CoW API sync failed, falling back to blockchain scanning...');
      console.log('⚠️ Error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fallback to blockchain scanning
    try {
      await this.runBlockchainSync();
    } catch (error) {
      console.error('❌ Both sync methods failed');
      throw error;
    }
  }
}

function parseCommandLineArgs(): SyncOptions {
  const args = process.argv.slice(2);
  let monthsBack = 4;
  let method: 'blockchain' | 'api' | 'auto' = 'auto';
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
        
      case '--method':
      case '-t':
        const methodArg = args[++i];
        if (methodArg === 'blockchain' || methodArg === 'api' || methodArg === 'auto') {
          method = methodArg;
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

  return { monthsBack, method, force };
}

function printHelp(): void {
  console.log(`
🚀 CoW Protocol Historical Trades Sync

USAGE:
  npm run sync:historical [OPTIONS]
  npm run sync:historical -- --months 6 --method api

OPTIONS:
  -m, --months <number>    Number of months to sync (default: 4)
  -t, --method <method>    Sync method: blockchain, api, or auto (default: auto)
  -f, --force             Force sync even if data exists
  -h, --help              Show this help message

EXAMPLES:
  # Sync past 4 months using auto-selection
  npm run sync:historical

  # Sync past 6 months using CoW API
  npm run sync:historical -- --months 6 --method api

  # Sync past 3 months using blockchain scanning
  npm run sync:historical -- --months 3 --method blockchain

METHODS:
  blockchain  - Scan blockchain blocks for CoW Protocol transactions
                Slower but more comprehensive, works offline
  api         - Use CoW Protocol API to fetch orders and batches
                Faster and more efficient, requires internet
  auto        - Try API first, fallback to blockchain (default)

ENVIRONMENT VARIABLES:
  MONGODB_URI     - MongoDB connection string
  DB_NAME         - Database name (default: cow-visualiser)
  COLLECTION_NAME - Collection name (default: transactions)
  RPC_URL         - Ethereum RPC URL for blockchain scanning
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
