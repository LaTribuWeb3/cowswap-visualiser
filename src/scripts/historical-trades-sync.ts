import { EthereumService } from "../services/ethereum";
import { MongoDBDatabaseService } from "../services/mongodb-database";
import { MockDatabaseService } from "../services/database";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface SyncProgress {
  totalEvents: number;
  processedEvents: number;
  savedOrders: number;
  skippedDuplicates: number;
  errors: number;
  startTime: Date;
  lastProcessedBlock: number;
  isWaitingForTimeout: boolean;
  timeoutStartTime?: Date;
}

interface CowOrderData {
  hash: string;
  executedBuyAmount: number;
  executedSellAmount: number;
  executedSellAmountBeforeFees: number;
  creationDate: Date;
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: number;
  buyAmount: number;
  kind: string;
  blockNumber: number;
}

class HistoricalTradesSync {
  private ethereumService: EthereumService;
  private databaseService!: MongoDBDatabaseService | MockDatabaseService;
  private isDatabaseConnected: boolean = false;
  private progress: SyncProgress;
  private targetBlock: number = 0;

  constructor() {
    this.ethereumService = new EthereumService();
    this.progress = {
      totalEvents: 0,
      processedEvents: 0,
      savedOrders: 0,
      skippedDuplicates: 0,
      errors: 0,
      startTime: new Date(),
      lastProcessedBlock: 0,
      isWaitingForTimeout: false,
    };
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Historical Trades Sync...");

    try {
      // Try to connect to MongoDB first
      try {
        this.databaseService = new MongoDBDatabaseService();
        await this.databaseService.connect();
        this.isDatabaseConnected = true;
        console.log("✅ Connected to MongoDB");
      } catch (error) {
        console.log(
          "⚠️ MongoDB connection failed, falling back to mock database"
        );
        this.databaseService = new MockDatabaseService();
        this.isDatabaseConnected = false;
      }

      // Get the latest block number to start from
      const latestBlock = await this.ethereumService.getLatestBlockNumber();
      this.progress.lastProcessedBlock = Number(latestBlock);

      // Calculate target block (4 months ago)
      const monthsBack = 4;
      const blocksPerDay = 7200; // ~12 seconds per block
      const daysBack = monthsBack * 30;
      const estimatedBlocksBack = BigInt(daysBack * blocksPerDay);
      this.targetBlock = Number(latestBlock - estimatedBlocksBack);

      console.log(`📦 Starting from block: ${this.progress.lastProcessedBlock}`);
      console.log(`🎯 Target block (4 months ago): ${this.targetBlock}`);

      console.log("✅ Historical Trades Sync initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Historical Trades Sync:", error);
      throw error;
    }
  }

  async syncHistoricalTrades(): Promise<void> {
    console.log(
      "📅 Starting historical sync from most recent to 4 months ago..."
    );
    console.log("⏰ Adding 10-minute timeout between block fetches to prevent RPC limits");

    try {
      // Process blocks from most recent to oldest
      for (
        let blockNumber = this.progress.lastProcessedBlock;
        blockNumber >= this.targetBlock;
        blockNumber--
      ) {
        try {
          await this.processBlock(BigInt(blockNumber));
          
          // Update progress every 100 blocks
          if (blockNumber % 100 === 0) {
            this.printProgressReport();
          }

          // Add 10-minute timeout between block fetches to prevent RPC limits
          // Skip timeout for the last block to avoid unnecessary delay
          if (blockNumber > this.targetBlock) {
            this.progress.isWaitingForTimeout = true;
            this.progress.timeoutStartTime = new Date();
            console.log("⏳ Waiting 10 minutes before fetching next block to prevent RPC limits...");
            await this.delay(10 * 60 * 1000); // 10 minutes = 600,000ms
            this.progress.isWaitingForTimeout = false;
            this.progress.timeoutStartTime = undefined;
            console.log("✅ Timeout completed, continuing with next block...");
          }
        } catch (error) {
          console.error(`❌ Error processing block ${blockNumber}:`, error);
          this.progress.errors++;
        }
      }

      console.log("✅ Historical sync completed successfully!");
      this.printFinalReport();
    } catch (error) {
      console.error("❌ Error during historical sync:", error);
      throw error;
    }
  }

  private async processBlock(blockNumber: bigint): Promise<void> {
    try {
      // Get block with transactions
      const block = await this.ethereumService["client"].getBlock({
        blockNumber,
        includeTransactions: true,
      });

      if (!block || !block.transactions) {
        return;
      }

      // Filter transactions to CoW Protocol settlement contract
      const settlementTransactions = block.transactions.filter(
        (tx) =>
          typeof tx === "object" &&
          tx.to?.toLowerCase() ===
            "0x9008d19f58aabd9ed0d60971565aa8510560ab41".toLowerCase()
      );

      if (settlementTransactions.length === 0) {
        return;
      }

      console.log(
        `🔍 Block ${blockNumber}: Found ${settlementTransactions.length} settlement transactions`
      );

      // Process each settlement transaction
      for (const tx of settlementTransactions) {
        if (typeof tx === "object") {
          try {
            await this.processSettlementTransaction(tx, blockNumber);
            this.progress.processedEvents++;
          } catch (error) {
            console.error(
              `❌ Error processing settlement transaction ${tx.hash}:`,
              error
            );
            this.progress.errors++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching block ${blockNumber}:`, error);
      this.progress.errors++;
    }
  }

  private async processSettlementTransaction(
    tx: any,
    blockNumber: bigint
  ): Promise<void> {
    try {
      // Check if transaction already exists in database
      const existingTransaction = await this.databaseService.getTransactionByHash(tx.hash);
      if (existingTransaction) {
        console.log(`⏭️ Skipping duplicate transaction: ${tx.hash}`);
        this.progress.skippedDuplicates++;
        return;
      }

      console.log(`🔄 Processing settlement transaction: ${tx.hash}`);

      // Fetch order details from CoW API
      const orderData = await this.fetchOrderDetailsFromCowApi(tx.hash);

      if (orderData && orderData.length > 0) {
        console.log(
          `📋 Found ${orderData.length} orders for transaction ${tx.hash}`
        );

        // Process each order
        for (const order of orderData) {
          const processedOrder: CowOrderData = {
            hash: tx.hash,
            executedBuyAmount: parseInt(order.executedBuyAmount),
            executedSellAmount: parseInt(order.executedSellAmount),
            executedSellAmountBeforeFees: parseInt(
              order.executedSellAmountBeforeFees
            ),
            creationDate: new Date(order.creationDate),
            sellToken: order.sellToken,
            buyToken: order.buyToken,
            receiver: order.receiver,
            sellAmount: parseInt(order.sellAmount),
            buyAmount: parseInt(order.buyAmount),
            kind: order.kind,
            blockNumber: Number(blockNumber),
          };

          // Save to database
          await this.databaseService.saveTransaction(processedOrder);
          this.progress.savedOrders++;
          this.progress.totalEvents++;

          console.log(
            `💾 Saved order: ${order.kind} ${order.sellAmount} → ${order.buyAmount} (Block: ${blockNumber})`
          );
        }
      } else {
        console.log(`⚠️ No order data found for transaction ${tx.hash}`);
      }
    } catch (error) {
      console.error(
        `❌ Error processing settlement transaction ${tx.hash}:`,
        error
      );
      throw error;
    }
  }

  private async fetchOrderDetailsFromCowApi(
    transactionHash: string
  ): Promise<any[]> {
    try {
      // Determine the network based on the RPC URL
      const rpcUrl = process.env.RPC_URL || "";
      let apiBaseUrl = "https://api.cow.fi/mainnet/api/v1";

      if (rpcUrl.includes("arbitrum") || rpcUrl.includes("arb-mainnet")) {
        apiBaseUrl = "https://api.cow.fi/arbitrum_one/api/v1";
      }

      const apiUrl = `${apiBaseUrl}/transactions/${transactionHash}/orders`;

      console.log(`📡 Fetching order details from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ No orders found for transaction ${transactionHash} (404)`);
          return [];
        }
        console.error(`❌ HTTP error! status: ${response.status} for URL: ${apiUrl}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(
        `❌ Error fetching order details for ${transactionHash}:`,
        error
      );
      return [];
    }
  }

  private printProgressReport(): void {
    const totalTime = Date.now() - this.progress.startTime.getTime();
    const uptime = this.formatTime(totalTime);

    console.log("\n📊 HISTORICAL SYNC PROGRESS");
    console.log("===========================");
    console.log(`⏱️  Uptime: ${uptime}`);
    console.log(`📦 Current block: ${this.progress.lastProcessedBlock}`);
    console.log(`🎯 Target block: ${this.targetBlock}`);
    console.log(`🔄 Events processed: ${this.progress.processedEvents}`);
    console.log(`💾 Orders saved: ${this.progress.savedOrders}`);
    console.log(`⏭️ Duplicates skipped: ${this.progress.skippedDuplicates}`);
    console.log(`❌ Errors: ${this.progress.errors}`);
    console.log(`🗄️  Database: ${this.isDatabaseConnected ? "MongoDB" : "Mock"}`);
    
    if (this.progress.isWaitingForTimeout && this.progress.timeoutStartTime) {
      const timeoutElapsed = Date.now() - this.progress.timeoutStartTime.getTime();
      const timeoutRemaining = Math.max(0, (10 * 60 * 1000) - timeoutElapsed);
      const remainingTime = this.formatTime(timeoutRemaining);
      console.log(`⏳ RPC Timeout: ${remainingTime} remaining`);
    } else {
      console.log(`⏳ RPC Timeout: Not active`);
    }
    
    console.log("===========================\n");
  }

  private printFinalReport(): void {
    const totalTime = Date.now() - this.progress.startTime.getTime();

    console.log("\n📊 FINAL SYNC REPORT");
    console.log("===================");
    console.log(`⏱️  Total time: ${this.formatTime(totalTime)}`);
    console.log(`🔄 Events processed: ${this.progress.processedEvents}`);
    console.log(`💾 Orders saved: ${this.progress.savedOrders}`);
    console.log(`⏭️ Duplicates skipped: ${this.progress.skippedDuplicates}`);
    console.log(`❌ Errors: ${this.progress.errors}`);
    console.log(`🗄️  Database: ${this.isDatabaseConnected ? "MongoDB" : "Mock"}`);
    console.log("===================\n");
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    try {
      if (this.databaseService && "disconnect" in this.databaseService) {
        await this.databaseService.disconnect();
        console.log("🔌 Database connection closed");
      }
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }
}

// Main execution function
async function main() {
  const sync = new HistoricalTradesSync();

  try {
    await sync.initialize();

    // Get months from command line argument or default to 4
    const monthsBack = process.argv[2] ? parseInt(process.argv[2]) : 4;

    if (isNaN(monthsBack) || monthsBack <= 0) {
      console.error(
        "❌ Invalid months argument. Please provide a positive number."
      );
      process.exit(1);
    }

    console.log(
      `🚀 Starting historical sync for the past ${monthsBack} months...`
    );
    await sync.syncHistoricalTrades();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await sync.cleanup();
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export { HistoricalTradesSync };