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
  isWaitingForTimeout: boolean;
  timeoutStartTime?: Date;
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
  
  // Backoff configuration for RPC errors
  private readonly MAX_RETRIES: number;
  private readonly BASE_DELAY: number;
  private readonly MAX_DELAY: number;
  private readonly BACKOFF_MULTIPLIER: number;
  private readonly RPC_TIMEOUT_DELAY: number;

  constructor() {
    // Initialize backoff configuration from environment variables
    this.MAX_RETRIES = parseInt(process.env.RPC_BACKOFF_MAX_RETRIES || "5");
    this.BASE_DELAY = parseInt(process.env.RPC_BACKOFF_BASE_DELAY || "2000");
    this.MAX_DELAY = parseInt(process.env.RPC_BACKOFF_MAX_DELAY || "60000");
    this.BACKOFF_MULTIPLIER = parseFloat(process.env.RPC_BACKOFF_MULTIPLIER || "2");
    this.RPC_TIMEOUT_DELAY = parseInt(process.env.RPC_TIMEOUT_DELAY || "600000"); // 10 minutes

    this.ethereumService = new EthereumService();
    this.progress = {
      totalEvents: 0,
      processedEvents: 0,
      savedOrders: 0,
      errors: 0,
      startTime: new Date(),
      lastProcessedBlock: 0,
      isWaitingForTimeout: false,
    };

    console.log(`🔄 RealtimeSync backoff config: maxRetries=${this.MAX_RETRIES}, baseDelay=${this.BASE_DELAY}ms, maxDelay=${this.MAX_DELAY}ms, multiplier=${this.BACKOFF_MULTIPLIER}, timeoutDelay=${this.RPC_TIMEOUT_DELAY}ms`);
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = this.BASE_DELAY * Math.pow(this.BACKOFF_MULTIPLIER, attempt);
    return Math.min(delay, this.MAX_DELAY);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoffDelay(attempt - 1);
          console.log(`🔄 Retrying ${operationName} (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms delay...`);
          await this.sleep(delay);
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if it's a retryable error
        const isRetryableError = this.isRetryableRpcError(errorMessage);
        
        if (!isRetryableError || attempt === maxRetries) {
          console.error(`❌ ${operationName} failed after ${attempt + 1} attempts:`, errorMessage);
          throw error;
        }
        
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMessage);
      }
    }
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Check if an RPC error is retryable
   */
  private isRetryableRpcError(errorMessage: string): boolean {
    const retryableErrors = [
      'timeout',
      'connection',
      'network',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'request timeout',
      'socket hang up',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'RPC error',
      'block range'
    ];
    
    const lowerErrorMessage = errorMessage.toLowerCase();
    return retryableErrors.some(error => lowerErrorMessage.includes(error));
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
      const latestBlock = await this.executeWithBackoff(
        () => this.ethereumService.getLatestBlockNumber(),
        'getLatestBlockNumber(initialize)'
      );
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
      const latestBlock = await this.executeWithBackoff(
        () => this.ethereumService.getLatestBlockNumber(),
        'getLatestBlockNumber(processNewBlocks)'
      );
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
      console.log("⏰ Adding 10-minute timeout between block fetches to prevent RPC limits");

      // Process each new block
      for (
        let blockNumber = this.progress.lastProcessedBlock + 1;
        blockNumber <= currentBlock;
        blockNumber++
      ) {
        await this.processBlock(BigInt(blockNumber));
        
        // Add timeout between block fetches to prevent RPC limits
        // Skip timeout for the last block to avoid unnecessary delay
        if (blockNumber < currentBlock) {
          this.progress.isWaitingForTimeout = true;
          this.progress.timeoutStartTime = new Date();
          const timeoutMinutes = this.RPC_TIMEOUT_DELAY / (60 * 1000);
          console.log(`⏳ Waiting ${timeoutMinutes} minutes before fetching next block to prevent RPC limits...`);
          await this.delay(this.RPC_TIMEOUT_DELAY);
          this.progress.isWaitingForTimeout = false;
          this.progress.timeoutStartTime = undefined;
          console.log("✅ Timeout completed, continuing with next block...");
        }
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
      const block = await this.executeWithBackoff(
        () => this.ethereumService["client"].getBlock({
          blockNumber,
          includeTransactions: true,
        }),
        `getBlock(${blockNumber})`
      );

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
      let apiBaseUrl = process.env.COW_PROTOCOL_API_URL || "";
      const apiUrl = `${apiBaseUrl}/transactions/${transactionHash}/orders`;

      console.log(`📡 Fetching order details from: ${apiUrl}`);

      const response = await this.executeWithBackoff(
        () => fetch(apiUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
          },
        }),
        `fetchOrderDetailsFromCowApi(${transactionHash})`
      );

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
    
    if (this.progress.isWaitingForTimeout && this.progress.timeoutStartTime) {
      const timeoutElapsed = Date.now() - this.progress.timeoutStartTime.getTime();
      const timeoutRemaining = Math.max(0, this.RPC_TIMEOUT_DELAY - timeoutElapsed);
      const remainingTime = this.formatTime(timeoutRemaining);
      console.log(`⏳ RPC Timeout: ${remainingTime} remaining`);
    } else {
      console.log(`⏳ RPC Timeout: Not active`);
    }
    
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
