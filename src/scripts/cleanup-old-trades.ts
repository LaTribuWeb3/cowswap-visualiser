import { MongoDBDatabaseService } from "../services/mongodb-database";
import { EthereumService } from "../services/ethereum";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Cleanup Old Trades Script
 * 
 * This script removes trades older than a specified number of months from the database.
 * It uses the Etherscan API to get the exact block number for the cutoff date,
 * which is more accurate than estimating based on average block times.
 * 
 * Requirements:
 * - ETHERSCAN_API_KEY environment variable must be set
 * - MONGODB_URI environment variable must be set
 * 
 * Usage:
 *   npm run cleanup:old-trades [months] [--execute]
 * 
 * Examples:
 *   npm run cleanup:old-trades 4           # Dry run for 4 months
 *   npm run cleanup:old-trades 4 --execute # Actually delete trades older than 4 months
 */

interface CleanupStats {
  totalTransactions: number;
  transactionsToDelete: number;
  deletedTransactions: number;
  oldestKeptDate: Date | null;
  newestDeletedDate: Date | null;
  cutoffBlock: number;
}

class OldTradesCleanup {
  private databaseService!: MongoDBDatabaseService;
  private ethereumService: EthereumService;
  private stats: CleanupStats;

  constructor() {
    this.ethereumService = new EthereumService();
    this.stats = {
      totalTransactions: 0,
      transactionsToDelete: 0,
      deletedTransactions: 0,
      oldestKeptDate: null,
      newestDeletedDate: null,
      cutoffBlock: 0,
    };
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Old Trades Cleanup Script...");

    try {
      // Validate required environment variables
      if (!process.env.ETHERSCAN_API_KEY) {
        throw new Error(
          "ETHERSCAN_API_KEY environment variable is required. " +
          "Get your API key from https://etherscan.io/apis and add it to your .env file"
        );
      }

      // Connect to MongoDB
      this.databaseService = new MongoDBDatabaseService();
      await this.databaseService.connect();
      console.log("✅ Connected to MongoDB");

      console.log("✅ Cleanup script initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize cleanup script:", error);
      throw error;
    }
  }

  private async calculateCutoffBlock(monthsBack: number): Promise<number> {
    console.log(`\n📊 Calculating cutoff block for ${monthsBack} months ago...`);

    // Calculate the date N months ago
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    
    const unixTimestamp = Math.floor(cutoffDate.getTime() / 1000);
    const nowTimestamp = Math.floor(Date.now() / 1000);
    
    console.log(`   Current date: ${new Date().toISOString()}`);
    console.log(`   Target date (${monthsBack} months ago): ${cutoffDate.toISOString()}`);
    console.log(`   Unix timestamp: ${unixTimestamp}`);
    
    // Sanity check: ensure the cutoff date is in the past
    if (unixTimestamp > nowTimestamp) {
      throw new Error(
        `Calculated cutoff date (${cutoffDate.toISOString()}) is in the future! ` +
        `This might indicate a system clock issue. Current time: ${new Date().toISOString()}`
      );
    }
    
    console.log(`   Querying Etherscan API for exact block number...`);

    try {
      // Use Etherscan API to get the exact block number for that date
      // This is more accurate than estimating based on block times
      const cutoffBlock = await this.ethereumService.getBlockNumberFromDate(cutoffDate);
      
      console.log(`   ✅ Cutoff block from Etherscan: ${cutoffBlock.toLocaleString()}`);
      
      return cutoffBlock;
    } catch (error) {
      console.error(`   ❌ Failed to get block from Etherscan API`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`\n   💡 TIP: Check that your ETHERSCAN_API_KEY is valid and CHAIN_ID is correct (1 for Ethereum mainnet)`);
      throw error;
    }
  }

  async analyzeTrades(monthsBack: number): Promise<void> {
    console.log("\n🔍 Analyzing trades in database...");

    try {
      // Calculate cutoff block
      this.stats.cutoffBlock = await this.calculateCutoffBlock(monthsBack);

      // Get database stats
      const collection = this.databaseService["transactionsCollection"];
      if (!collection) {
        throw new Error("Database collection not available");
      }

      // Count total transactions
      this.stats.totalTransactions = await collection.countDocuments();
      console.log(`\n📊 Total transactions in database: ${this.stats.totalTransactions.toLocaleString()}`);

      // Count transactions older than cutoff
      this.stats.transactionsToDelete = await collection.countDocuments({
        blockNumber: { $lt: this.stats.cutoffBlock },
      });

      console.log(`📊 Transactions older than ${monthsBack} months (block ${this.stats.cutoffBlock}): ${this.stats.transactionsToDelete.toLocaleString()}`);

      // Get the newest transaction that would be deleted
      const newestToDelete = await collection
        .find({ blockNumber: { $lt: this.stats.cutoffBlock } })
        .sort({ blockNumber: -1 })
        .limit(1)
        .toArray();

      if (newestToDelete.length > 0) {
        this.stats.newestDeletedDate = new Date(newestToDelete[0].creationDate);
        console.log(`   Newest trade to delete: Block ${newestToDelete[0].blockNumber} - ${this.stats.newestDeletedDate.toISOString()}`);
      }

      // Get the oldest transaction that would be kept
      const oldestToKeep = await collection
        .find({ blockNumber: { $gte: this.stats.cutoffBlock } })
        .sort({ blockNumber: 1 })
        .limit(1)
        .toArray();

      if (oldestToKeep.length > 0) {
        this.stats.oldestKeptDate = new Date(oldestToKeep[0].creationDate);
        console.log(`   Oldest trade to keep: Block ${oldestToKeep[0].blockNumber} - ${this.stats.oldestKeptDate.toISOString()}`);
      }

      // Calculate space that would be freed
      const remainingTransactions = this.stats.totalTransactions - this.stats.transactionsToDelete;
      const percentageToDelete = ((this.stats.transactionsToDelete / this.stats.totalTransactions) * 100).toFixed(2);
      const percentageToKeep = ((remainingTransactions / this.stats.totalTransactions) * 100).toFixed(2);

      console.log(`\n📈 Summary:`);
      console.log(`   Total transactions: ${this.stats.totalTransactions.toLocaleString()}`);
      console.log(`   To delete: ${this.stats.transactionsToDelete.toLocaleString()} (${percentageToDelete}%)`);
      console.log(`   To keep: ${remainingTransactions.toLocaleString()} (${percentageToKeep}%)`);

    } catch (error) {
      console.error("❌ Error analyzing trades:", error);
      throw error;
    }
  }

  async deleteTrades(dryRun: boolean = true): Promise<void> {
    if (this.stats.transactionsToDelete === 0) {
      console.log("\n✅ No transactions to delete!");
      return;
    }

    if (dryRun) {
      console.log("\n🔍 DRY RUN MODE - No data will be deleted");
      console.log(`   Would delete ${this.stats.transactionsToDelete.toLocaleString()} transactions older than block ${this.stats.cutoffBlock}`);
      console.log(`   To actually delete, run with --execute flag`);
      return;
    }

    console.log("\n⚠️  WARNING: About to delete data permanently!");
    console.log(`   Deleting ${this.stats.transactionsToDelete.toLocaleString()} transactions older than block ${this.stats.cutoffBlock}`);
    console.log(`   This action cannot be undone!`);

    try {
      const collection = this.databaseService["transactionsCollection"];
      if (!collection) {
        throw new Error("Database collection not available");
      }

      console.log("\n🗑️  Deleting old transactions...");
      const result = await collection.deleteMany({
        blockNumber: { $lt: this.stats.cutoffBlock },
      });

      this.stats.deletedTransactions = result.deletedCount || 0;

      console.log(`\n✅ Deletion completed!`);
      console.log(`   Deleted: ${this.stats.deletedTransactions.toLocaleString()} transactions`);
      console.log(`   Remaining: ${(this.stats.totalTransactions - this.stats.deletedTransactions).toLocaleString()} transactions`);

    } catch (error) {
      console.error("❌ Error deleting trades:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.databaseService && "disconnect" in this.databaseService) {
        await this.databaseService.disconnect();
        console.log("\n🔌 Database connection closed");
      }
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }

  printFinalReport(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 CLEANUP REPORT");
    console.log("=".repeat(60));
    console.log(`Total transactions before: ${this.stats.totalTransactions.toLocaleString()}`);
    console.log(`Cutoff block: ${this.stats.cutoffBlock.toLocaleString()}`);
    console.log(`Transactions deleted: ${this.stats.deletedTransactions.toLocaleString()}`);
    console.log(`Transactions remaining: ${(this.stats.totalTransactions - this.stats.deletedTransactions).toLocaleString()}`);
    
    if (this.stats.newestDeletedDate) {
      console.log(`Newest deleted trade date: ${this.stats.newestDeletedDate.toISOString()}`);
    }
    
    if (this.stats.oldestKeptDate) {
      console.log(`Oldest kept trade date: ${this.stats.oldestKeptDate.toISOString()}`);
    }
    
    console.log("=".repeat(60) + "\n");
  }
}

// Main execution function
async function main() {
  const cleanup = new OldTradesCleanup();

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const monthsArg = args.find(arg => !arg.startsWith('--'));
    const monthsBack = monthsArg ? parseInt(monthsArg) : 4;
    const execute = args.includes('--execute');
    const dryRun = !execute;

    if (isNaN(monthsBack) || monthsBack <= 0) {
      console.error("❌ Invalid months argument. Please provide a positive number.");
      console.log("\nUsage:");
      console.log("  npm run cleanup-old-trades [months] [--execute]");
      console.log("\nExamples:");
      console.log("  npm run cleanup-old-trades 4           # Dry run, show what would be deleted (4 months)");
      console.log("  npm run cleanup-old-trades 4 --execute # Actually delete trades older than 4 months");
      console.log("  npm run cleanup-old-trades 6           # Dry run for 6 months");
      process.exit(1);
    }

    await cleanup.initialize();

    console.log("\n" + "=".repeat(60));
    console.log(`🧹 OLD TRADES CLEANUP - ${dryRun ? 'DRY RUN' : 'EXECUTE'} MODE`);
    console.log("=".repeat(60));
    console.log(`Removing trades older than ${monthsBack} months`);

    // Analyze what would be deleted
    await cleanup.analyzeTrades(monthsBack);

    // Delete trades (or dry run)
    await cleanup.deleteTrades(dryRun);

    // Print final report
    cleanup.printFinalReport();

    if (dryRun) {
      console.log("💡 TIP: Run with --execute flag to actually delete the data");
    }

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await cleanup.cleanup();
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export { OldTradesCleanup };

