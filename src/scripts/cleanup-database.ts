import { SqliteDatabaseService } from "../services/sqlite-database";
import { EthereumService } from "../services/ethereum";
import { getNetworkConfigs, getNetworkIds } from "../utils/config";
import { getDatabaseName } from "../config/networks";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface CleanupStats {
  networkId: string;
  networkName: string;
  totalTransactions: number;
  oldTransactions: number;
  futureTransactions: number;
  remainingTransactions: number;
  oldTransactionsDeleted: number;
  futureTransactionsDeleted: number;
}

class DatabaseCleanup {
  private ethereumService: EthereumService;
  private dataDirectory: string;

  constructor() {
    this.ethereumService = new EthereumService();
    this.dataDirectory = process.env.SQLITE_DATA_DIR || path.join(process.cwd(), 'data');
  }

  async cleanupAllNetworks(monthsBack: number = 4, dryRun: boolean = true): Promise<void> {
    console.log("🧹 CoW Protocol Database Cleanup");
    console.log("=================================");
    console.log(`📅 Cleaning trades older than ${monthsBack} months`);
    console.log(`🔮 Cleaning trades newer than current block`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE RUN (changes will be made)'}`);
    console.log("=================================\n");

    const config = getNetworkConfigs();
    const networkIds = getNetworkIds();
    const stats: CleanupStats[] = [];

    for (const networkId of networkIds) {
      const networkConfig = config[networkId];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌐 Processing: ${networkConfig.name} (Chain ID: ${networkId})`);
      console.log(`${'='.repeat(60)}`);

      try {
        const networkStats = await this.cleanupNetwork(networkId, networkConfig.name, monthsBack, dryRun);
        stats.push(networkStats);
      } catch (error) {
        console.error(`❌ Error cleaning ${networkConfig.name}:`, error);
        stats.push({
          networkId,
          networkName: networkConfig.name,
          totalTransactions: 0,
          oldTransactions: 0,
          futureTransactions: 0,
          remainingTransactions: 0,
          oldTransactionsDeleted: 0,
          futureTransactionsDeleted: 0,
        });
      }
    }

    this.printSummary(stats);
  }

  private async cleanupNetwork(
    networkId: string, 
    networkName: string, 
    monthsBack: number, 
    dryRun: boolean
  ): Promise<CleanupStats> {
    const dbPath = path.join(this.dataDirectory, `${getDatabaseName(networkId)}.db`);
    
    if (!fs.existsSync(dbPath)) {
      console.log(`⚠️ Database file not found: ${dbPath}`);
      return {
        networkId,
        networkName,
        totalTransactions: 0,
        oldTransactions: 0,
        futureTransactions: 0,
        remainingTransactions: 0,
        oldTransactionsDeleted: 0,
        futureTransactionsDeleted: 0,
      };
    }

    console.log(`📂 Database: ${path.basename(dbPath)}`);

    // Connect to database
    const databaseService = new SqliteDatabaseService();
    await databaseService.connect(networkId);

    try {
      // Get current block number
      await this.ethereumService.switchNetwork(networkId);
      const currentBlock = await this.ethereumService.getLatestBlockNumber();
      const currentBlockNum = Number(currentBlock);
      
      console.log(`📊 Current block: ${currentBlockNum.toLocaleString()}`);

      // Calculate cutoff dates
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (monthsBack * 30 * 24 * 60 * 60 * 1000));
      
      console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);
      console.log(`🔮 Future block threshold: ${currentBlockNum.toLocaleString()}`);

      // Get statistics
      const stats = await this.getCleanupStats(databaseService, cutoffDate, currentBlockNum);
      
      console.log(`📊 Total transactions: ${stats.totalTransactions.toLocaleString()}`);
      console.log(`📊 Old transactions (>${monthsBack} months): ${stats.oldTransactions.toLocaleString()}`);
      console.log(`📊 Future transactions (>current block): ${stats.futureTransactions.toLocaleString()}`);
      console.log(`📊 Remaining transactions: ${stats.remainingTransactions.toLocaleString()}`);

      if (stats.oldTransactions === 0 && stats.futureTransactions === 0) {
        console.log(`✅ No cleanup needed for ${networkName}`);
        return {
          networkId,
          networkName,
          ...stats,
          oldTransactionsDeleted: 0,
          futureTransactionsDeleted: 0,
        };
      }

      // Ask for confirmation if not dry run
      if (!dryRun) {
        const confirmed = await this.askForConfirmation(
          `Delete ${stats.oldTransactions + stats.futureTransactions} transactions from ${networkName}?`
        );
        
        if (!confirmed) {
          console.log(`⏭️ Skipping ${networkName}`);
          return {
            networkId,
            networkName,
            ...stats,
            oldTransactionsDeleted: 0,
            futureTransactionsDeleted: 0,
          };
        }
      }

      // Perform cleanup
      const deletedStats = await this.performCleanup(
        databaseService, 
        cutoffDate, 
        currentBlockNum, 
        dryRun
      );

      console.log(`✅ Cleanup completed for ${networkName}`);
      if (dryRun) {
        console.log(`🔍 DRY RUN: Would delete ${deletedStats.oldTransactionsDeleted + deletedStats.futureTransactionsDeleted} transactions`);
      } else {
        console.log(`🗑️ Deleted ${deletedStats.oldTransactionsDeleted + deletedStats.futureTransactionsDeleted} transactions`);
      }

      return {
        networkId,
        networkName,
        ...stats,
        ...deletedStats,
      };

    } finally {
      await databaseService.disconnect();
    }
  }

  private async getCleanupStats(
    databaseService: SqliteDatabaseService, 
    cutoffDate: Date, 
    currentBlock: number
  ): Promise<{
    totalTransactions: number;
    oldTransactions: number;
    futureTransactions: number;
    remainingTransactions: number;
  }> {
    const db = (databaseService as any).db;
    if (!db) throw new Error('Database not connected');

    // Get total count
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM transactions');
    const totalResult = totalStmt.getAsObject();
    const totalTransactions = Number(totalResult?.count) || 0;

    // Get old transactions count
    const oldStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE timestamp < ?');
    const oldResult = oldStmt.getAsObject([cutoffDate.toISOString()]);
    const oldTransactions = Number(oldResult?.count) || 0;

    // Get future transactions count
    const futureStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE blockNumber > ?');
    const futureResult = futureStmt.getAsObject([currentBlock]);
    const futureTransactions = Number(futureResult?.count) || 0;

    const remainingTransactions = totalTransactions - oldTransactions - futureTransactions;

    return {
      totalTransactions,
      oldTransactions,
      futureTransactions,
      remainingTransactions,
    };
  }

  private async performCleanup(
    databaseService: SqliteDatabaseService,
    cutoffDate: Date,
    currentBlock: number,
    dryRun: boolean
  ): Promise<{
    oldTransactionsDeleted: number;
    futureTransactionsDeleted: number;
  }> {
    const db = (databaseService as any).db;
    if (!db) throw new Error('Database not connected');

    let oldTransactionsDeleted = 0;
    let futureTransactionsDeleted = 0;

    if (dryRun) {
      // Count what would be deleted
      const oldStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE timestamp < ?');
      const oldResult = oldStmt.getAsObject([cutoffDate.toISOString()]);
      oldTransactionsDeleted = Number(oldResult?.count) || 0;

      const futureStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE blockNumber > ?');
      const futureResult = futureStmt.getAsObject([currentBlock]);
      futureTransactionsDeleted = Number(futureResult?.count) || 0;
    } else {
      // Actually delete the transactions
      const oldStmt = db.prepare('DELETE FROM transactions WHERE timestamp < ?');
      const oldResult = oldStmt.run([cutoffDate.toISOString()]);
      oldTransactionsDeleted = Number(oldResult?.changes) || 0;

      const futureStmt = db.prepare('DELETE FROM transactions WHERE blockNumber > ?');
      const futureResult = futureStmt.run([currentBlock]);
      futureTransactionsDeleted = Number(futureResult?.changes) || 0;

      // Save database after deletions
      (databaseService as any).saveDatabase();
    }

    return {
      oldTransactionsDeleted,
      futureTransactionsDeleted,
    };
  }

  private async askForConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${question} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  private printSummary(stats: CleanupStats[]): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 CLEANUP SUMMARY");
    console.log("=".repeat(80));

    let totalTransactions = 0;
    let totalOldTransactions = 0;
    let totalFutureTransactions = 0;
    let totalDeleted = 0;

    for (const stat of stats) {
      console.log(`\n🌐 ${stat.networkName} (${stat.networkId})`);
      console.log(`   📊 Total transactions: ${stat.totalTransactions.toLocaleString()}`);
      console.log(`   📊 Old transactions: ${stat.oldTransactions.toLocaleString()}`);
      console.log(`   📊 Future transactions: ${stat.futureTransactions.toLocaleString()}`);
      console.log(`   📊 Remaining: ${stat.remainingTransactions.toLocaleString()}`);
      console.log(`   🗑️ Deleted: ${(stat.oldTransactionsDeleted + stat.futureTransactionsDeleted).toLocaleString()}`);

      totalTransactions += stat.totalTransactions;
      totalOldTransactions += stat.oldTransactions;
      totalFutureTransactions += stat.futureTransactions;
      totalDeleted += stat.oldTransactionsDeleted + stat.futureTransactionsDeleted;
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 TOTALS");
    console.log("=".repeat(80));
    console.log(`📊 Total transactions: ${totalTransactions.toLocaleString()}`);
    console.log(`📊 Old transactions: ${totalOldTransactions.toLocaleString()}`);
    console.log(`📊 Future transactions: ${totalFutureTransactions.toLocaleString()}`);
    console.log(`🗑️ Total deleted: ${totalDeleted.toLocaleString()}`);
    console.log("=".repeat(80));
  }
}

// Command line argument parsing
function parseCommandLineArgs(): { monthsBack: number; dryRun: boolean; help: boolean } {
  const args = process.argv.slice(2);
  let monthsBack = 4;
  let dryRun = true;
  let help = false;

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
        
      case '--live':
      case '-l':
        dryRun = false;
        break;
        
      case '--help':
      case '-h':
        help = true;
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

  return { monthsBack, dryRun, help };
}

function printHelp(): void {
  console.log(`
🧹 CoW Protocol Database Cleanup Tool

USAGE:
  npm run cleanup:database [OPTIONS]
  npm run cleanup:database -- --months 6 --live

OPTIONS:
  -m, --months <number>    Number of months to keep (default: 4)
  -l, --live               Actually delete data (default: dry run)
  -h, --help              Show this help message

EXAMPLES:
  # Dry run cleanup (default - shows what would be deleted)
  npm run cleanup:database

  # Dry run with 6 months retention
  npm run cleanup:database -- --months 6

  # Actually delete data (live run)
  npm run cleanup:database -- --live

  # Live run with 3 months retention
  npm run cleanup:database -- --months 3 --live

WHAT IT CLEANS:
  - Transactions older than specified months
  - Transactions with block numbers newer than current block
  - Keeps transactions within the valid range

SAFETY:
  - Always runs in dry-run mode by default
  - Shows statistics before making changes
  - Asks for confirmation before deleting data
  - Works on all configured networks
`);
}

// Main execution function
async function main() {
  try {
    const { monthsBack, dryRun, help } = parseCommandLineArgs();
    
    if (help) {
      printHelp();
      return;
    }

    if (!dryRun) {
      console.log("⚠️  WARNING: This will permanently delete data from the database!");
      console.log("⚠️  Make sure you have backups before proceeding!");
      console.log("⚠️  Use --help to see all options\n");
    }

    const cleanup = new DatabaseCleanup();
    await cleanup.cleanupAllNetworks(monthsBack, dryRun);
    
    if (dryRun) {
      console.log("\n💡 To actually perform the cleanup, run with --live flag");
    } else {
      console.log("\n✅ Database cleanup completed!");
    }
  } catch (error) {
    console.error("❌ Fatal error:", error);
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

export { DatabaseCleanup };
