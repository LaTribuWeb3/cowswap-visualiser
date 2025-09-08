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
  errors: number;
  startTime: Date;
  lastProcessedBlock: number;
}

interface CowOrderData {
  hash: string;
  executedBuyAmount: number;
  executedSellAmount: number;
  executedSellAmountBeforeFees: number;
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: number;
  buyAmount: number;
  kind: string;
  blockNumber: number;
}

class RealtimeSettlementSync {
  private ethereumService: EthereumService;
  private databaseService!: MongoDBDatabaseService | MockDatabaseService;
  private isDatabaseConnected: boolean = false;
  private progress: SyncProgress;
  private isRunning: boolean = false;
  private pollingInterval: number = 5000; // 5 seconds

  constructor() {
    this.ethereumService = new EthereumService();
    this.progress = {
      totalEvents: 0,
      processedEvents: 0,
      savedOrders: 0,
      errors: 0,
      startTime: new Date(),
      lastProcessedBlock: 0,
    };
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Realtime Settlement Sync...");

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
      console.log(
        `📦 Starting from block: ${this.progress.lastProcessedBlock}`
      );

      console.log("✅ Realtime Settlement Sync initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Realtime Settlement Sync:", error);
      throw error;
    }
  }

  async startStreaming(): Promise<void> {
    console.log("🔄 Starting real-time settlement event streaming...");
    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        await this.delay(this.pollingInterval);
      } catch (error) {
        console.error("❌ Error in streaming loop:", error);
        this.progress.errors++;

        // Wait longer on error before retrying
        await this.delay(this.pollingInterval * 2);
      }
    }
  }

  async stopStreaming(): Promise<void> {
    console.log("⏹️ Stopping real-time settlement event streaming...");
    this.isRunning = false;
  }

  private async processNewBlocks(): Promise<void> {
    try {
      // Get current latest block
      const latestBlock = await this.ethereumService.getLatestBlockNumber();
      const currentBlock = Number(latestBlock);

      if (currentBlock <= this.progress.lastProcessedBlock) {
        // No new blocks
        return;
      }

      console.log(
        `📦 Processing new blocks: ${
          this.progress.lastProcessedBlock + 1
        } to ${currentBlock}`
      );

      // Process each new block
      for (
        let blockNumber = this.progress.lastProcessedBlock + 1;
        blockNumber <= currentBlock;
        blockNumber++
      ) {
        await this.processBlock(BigInt(blockNumber));
      }

      this.progress.lastProcessedBlock = currentBlock;
    } catch (error) {
      console.error("❌ Error processing new blocks:", error);
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
          console.log(`⚠️ No orders found for transaction ${transactionHash}`);
          return [];
        }
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

    console.log("\n📊 REALTIME SYNC PROGRESS");
    console.log("========================");
    console.log(`⏱️  Uptime: ${uptime}`);
    console.log(`📦 Last processed block: ${this.progress.lastProcessedBlock}`);
    console.log(`🔄 Events processed: ${this.progress.processedEvents}`);
    console.log(`💾 Orders saved: ${this.progress.savedOrders}`);
    console.log(`❌ Errors: ${this.progress.errors}`);
    console.log(
      `🗄️  Database: ${this.isDatabaseConnected ? "MongoDB" : "Mock"}`
    );
    console.log("========================\n");
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
      this.isRunning = false;
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
  const sync = new RealtimeSettlementSync();

  try {
    await sync.initialize();

    // Print progress report every 30 seconds
    const progressInterval = setInterval(() => {
      sync["printProgressReport"]();
    }, 30000);

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Received SIGINT, shutting down gracefully...");
      clearInterval(progressInterval);
      await sync.stopStreaming();
      await sync.cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
      clearInterval(progressInterval);
      await sync.stopStreaming();
      await sync.cleanup();
      process.exit(0);
    });

    console.log("🚀 Starting real-time settlement sync...");
    console.log("Press Ctrl+C to stop");

    await sync.startStreaming();
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

export { RealtimeSettlementSync };
