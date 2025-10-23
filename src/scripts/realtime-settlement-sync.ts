import { EthereumService } from "../services/ethereum";
import { SqliteDatabaseService } from "../services/sqlite-database";
import { MockDatabaseService, DatabaseService } from "../services/database";
import { getSupportedNetworks, NetworkConfig } from "../config/networks";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface NetworkSyncState {
  networkId: string;
  networkName: string;
  latestBlock: number;
  lastProcessedBlock: number;
  processedEvents: number;
  savedOrders: number;
  errors: number;
}

interface SyncProgress {
  totalEvents: number;
  processedEvents: number;
  savedOrders: number;
  errors: number;
  startTime: Date;
  lastProcessedBlock: number;
  isWaitingForTimeout: boolean;
  timeoutStartTime?: Date;
  networkStates: Map<string, NetworkSyncState>;
}

interface CowOrderData {
  hash: string;
  executedBuyAmount: string;  // Store as exact string representation
  executedSellAmount: string; // Store as exact string representation
  executedSellAmountBeforeFees: string; // Store as exact string representation
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: string;  // Store as exact string representation
  buyAmount: string;   // Store as exact string representation
  kind: string;
  blockNumber: number;
}

class RealtimeSettlementSync {
  private ethereumService: EthereumService;
  private databaseServices: Map<string, DatabaseService>;
  private isDatabaseConnected: boolean = false;
  private progress: SyncProgress;
  private supportedNetworks: NetworkConfig[];
  private currentNetworkId: string = "";
  private isRunning: boolean = false;
  private pollingInterval: number = 5000; // 5 seconds
  
  // Backoff configuration for RPC errors
  private readonly MAX_RETRIES: number;
  private readonly BASE_DELAY: number;
  private readonly MAX_DELAY: number;
  private readonly BACKOFF_MULTIPLIER: number;
  private readonly RPC_TIMEOUT_DELAY: number;
  
  // Batch processing configuration
  private readonly MAX_BATCH_SIZE: number;
  private readonly BATCH_DELAY_MS: number;

  constructor() {
    this.ethereumService = new EthereumService();
    this.databaseServices = new Map();
    this.supportedNetworks = getSupportedNetworks();
    
    // Initialize backoff configuration from environment variables
    this.MAX_RETRIES = parseInt(process.env.RPC_BACKOFF_MAX_RETRIES || "5");
    this.BASE_DELAY = parseInt(process.env.RPC_BACKOFF_BASE_DELAY || "2000");
    this.MAX_DELAY = parseInt(process.env.RPC_BACKOFF_MAX_DELAY || "60000");
    this.BACKOFF_MULTIPLIER = parseFloat(process.env.RPC_BACKOFF_MULTIPLIER || "2");
    this.RPC_TIMEOUT_DELAY = parseInt(process.env.RPC_TIMEOUT_DELAY || "10000"); // 10 seconds
    
    // Initialize batch processing configuration
    this.MAX_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100");
    this.BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "1000");
    
    // Set polling interval based on block time
    // Poll every 1 second to stay current with new blocks
    this.pollingInterval = parseInt(process.env.REALTIME_POLLING_INTERVAL || "1000");

    this.progress = {
      totalEvents: 0,
      processedEvents: 0,
      savedOrders: 0,
      errors: 0,
      startTime: new Date(),
      lastProcessedBlock: 0,
      isWaitingForTimeout: false,
      networkStates: new Map(),
    };

    console.log(`🔄 RealtimeSync config: maxRetries=${this.MAX_RETRIES}, baseDelay=${this.BASE_DELAY}ms, maxDelay=${this.MAX_DELAY}ms, multiplier=${this.BACKOFF_MULTIPLIER}, timeoutDelay=${this.RPC_TIMEOUT_DELAY}ms`);
    console.log(`🚀 Batch config: maxBatchSize=${this.MAX_BATCH_SIZE}, batchDelay=${this.BATCH_DELAY_MS}ms`);
    console.log(`⏱️ Polling interval: ${this.pollingInterval}ms`);
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
    console.log("🚀 Initializing Realtime Settlement Sync for all networks...");
    console.log(`📡 Found ${this.supportedNetworks.length} supported networks`);

    try {
      // Initialize services and state for each network
      for (const network of this.supportedNetworks) {
        console.log(`\n🌐 Initializing network: ${network.name} (Chain ID: ${network.chainId})`);
        
        // Switch to this network
        await this.ethereumService.switchNetwork(network.chainId.toString());
        
        // Try to connect to database for this network
        try {
          const databaseService = new SqliteDatabaseService();
          await databaseService.connect(network.chainId.toString());
          this.databaseServices.set(network.chainId.toString(), databaseService);
          this.isDatabaseConnected = true;
          console.log(`✅ Connected to SQLite database for ${network.name}`);
        } catch (error) {
          console.log(`⚠️ Database connection failed for ${network.name}, falling back to mock database`);
          this.databaseServices.set(network.chainId.toString(), new MockDatabaseService());
          this.isDatabaseConnected = false;
        }

        // Get the latest block number for this network
        const latestBlock = await this.executeWithBackoff(
          () => this.ethereumService.getLatestBlockNumber(),
          `getLatestBlockNumber(initialize) for ${network.name}`
        );
        const latestBlockNum = Number(latestBlock);

        // Initialize network state
        const networkState: NetworkSyncState = {
          networkId: network.chainId.toString(),
          networkName: network.name,
          latestBlock: latestBlockNum,
          lastProcessedBlock: latestBlockNum,
          processedEvents: 0,
          savedOrders: 0,
          errors: 0,
        };

        this.progress.networkStates.set(network.chainId.toString(), networkState);
        
        console.log(`📦 ${network.name} - Starting from block: ${latestBlockNum}`);
      }

      console.log("\n✅ Realtime Settlement Sync initialized successfully for all networks");
    } catch (error) {
      console.error("❌ Failed to initialize Realtime Settlement Sync:", error);
      throw error;
    }
  }

  async startStreaming(): Promise<void> {
    console.log("🔄 Starting real-time settlement event streaming across all networks...");
    console.log("🔄 Will prioritize the network closest to the present at each iteration\n");
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
      // Update latest blocks for all networks
      console.log(`🔍 Checking for new blocks across all networks...`);
      
      for (const [networkId, networkState] of this.progress.networkStates) {
        try {
          // Switch to this network
          await this.ethereumService.switchNetwork(networkId);
          
          const latestBlock = await this.executeWithBackoff(
            () => this.ethereumService.getLatestBlockNumber(),
            `getLatestBlockNumber(${networkState.networkName})`
          );
          networkState.latestBlock = Number(latestBlock);
        } catch (error) {
          console.error(`❌ Error getting latest block for ${networkState.networkName}:`, error);
        }
      }
      
      // Process ALL networks that have new blocks, not just the one with the most blocks
      const networksWithNewBlocks = this.getNetworksWithNewBlocks();
      
      if (networksWithNewBlocks.length === 0) {
        console.log(`✅ No new blocks to process on any network`);
        return;
      }
      
      console.log(`🔄 Processing ${networksWithNewBlocks.length} networks with new blocks...`);
      
      // Process each network that has new blocks
      for (const networkId of networksWithNewBlocks) {
        const networkState = this.progress.networkStates.get(networkId);
        if (!networkState) continue;
        
        this.currentNetworkId = networkId;
        
        const currentBlock = networkState.latestBlock;
        const lastProcessed = networkState.lastProcessedBlock;
        
        console.log(`\n🌐 Processing network: ${networkState.networkName}`);
        console.log(`📦 Current latest block: ${currentBlock}`);
        console.log(`📦 Last processed block: ${lastProcessed}`);

        if (currentBlock <= lastProcessed) {
          console.log(`✅ No new blocks to process for ${networkState.networkName}`);
          continue;
        }

        const newBlocksCount = currentBlock - lastProcessed;
        console.log(
          `🆕 Found ${newBlocksCount} new blocks to process: ${
            lastProcessed + 1
          } to ${currentBlock}`
        );

        try {
          // Use batch processing for efficiency
          if (newBlocksCount > 1) {
            console.log(`🚀 Using batch processing for ${newBlocksCount} blocks`);
            await this.processBlocksInBatch(
              BigInt(lastProcessed + 1),
              BigInt(currentBlock),
              networkId
            );
          } else {
            // Single block - use individual processing
            console.log(`🔍 Processing single block ${lastProcessed + 1}`);
            await this.processBlock(BigInt(lastProcessed + 1), networkId);
          }

          console.log(`✅ Completed processing ${newBlocksCount} new blocks for ${networkState.networkName}`);
          networkState.lastProcessedBlock = currentBlock;
          this.progress.lastProcessedBlock = Math.max(this.progress.lastProcessedBlock, currentBlock);
        } catch (error) {
          console.error(`❌ Error processing blocks for ${networkState.networkName}:`, error);
          networkState.errors++;
          this.progress.errors++;
        }
      }
    } catch (error) {
      console.error("❌ Error processing new blocks:", error);
      throw error;
    }
  }

  /**
   * Get all networks that have new blocks to process
   * Returns an array of network IDs that have pending blocks
   */
  private getNetworksWithNewBlocks(): string[] {
    const networksWithNewBlocks: string[] = [];
    
    for (const [networkId, state] of this.progress.networkStates) {
      const newBlocks = state.latestBlock - state.lastProcessedBlock;
      
      // Include networks with new blocks
      if (newBlocks > 0) {
        networksWithNewBlocks.push(networkId);
      }
    }
    
    return networksWithNewBlocks;
  }

  private async processBlocksInBatch(fromBlock: bigint, toBlock: bigint, networkId: string): Promise<void> {
    try {
      const networkState = this.progress.networkStates.get(networkId);
      
      if (!networkState) {
        throw new Error(`Network state not found for network ${networkId}`);
      }
      
      // Switch to the correct network
      await this.ethereumService.switchNetwork(networkId);
      
      console.log(`📡 Fetching batch events from block ${fromBlock} to ${toBlock}...`);
      
      // Use the new batch event fetching method
      const events = await this.ethereumService.getBatchEvents(fromBlock, toBlock);
      
      console.log(`📋 Found ${events.length} events in batch`);
      
      if (events.length === 0) {
        console.log(`✅ No CoW Protocol events found in batch ${fromBlock}-${toBlock}`);
        return;
      }

      // Group events by transaction hash for processing
      const eventsByTransaction = new Map<string, any[]>();
      
      for (const event of events) {
        const txHash = event.transactionHash || event.hash;
        if (!eventsByTransaction.has(txHash)) {
          eventsByTransaction.set(txHash, []);
        }
        eventsByTransaction.get(txHash)!.push(event);
      }

      console.log(`🔄 Processing ${eventsByTransaction.size} unique transactions...`);

      // Process each transaction
      let processedTransactions = 0;
      for (const [txHash, txEvents] of eventsByTransaction) {
        processedTransactions++;
        console.log(`   🔄 Processing transaction ${processedTransactions}/${eventsByTransaction.size}: ${txHash}`);
        
        try {
          // Get the transaction details from the first event
          const firstEvent = txEvents[0];
          const blockNumber = firstEvent.blockNumber;
          
          // Create a mock transaction object for compatibility
          const mockTransaction = {
            hash: txHash,
            blockNumber: blockNumber,
            // Add other fields as needed
          };
          
          await this.processSettlementTransaction(mockTransaction, BigInt(blockNumber), networkId);
          networkState.processedEvents++;
          this.progress.processedEvents++;
          console.log(`   ✅ Transaction ${txHash} processed successfully`);
        } catch (error) {
          console.error(`   ❌ Error processing transaction ${txHash}:`, error);
          networkState.errors++;
          this.progress.errors++;
        }
      }
      
      console.log(`✅ Batch processing completed: ${processedTransactions} transactions processed`);
    } catch (error) {
      console.error(`❌ Error in batch processing (${fromBlock}-${toBlock}):`, error);
      
      // Fall back to individual block processing if batch fails
      console.log(`🔄 Falling back to individual block processing...`);
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        try {
          await this.processBlock(blockNum, networkId);
        } catch (blockError) {
          console.error(`❌ Error processing block ${blockNum}:`, blockError);
          const networkState = this.progress.networkStates.get(networkId);
          if (networkState) {
            networkState.errors++;
          }
          this.progress.errors++;
        }
      }
    }
  }

  private async processBlock(blockNumber: bigint, networkId: string): Promise<void> {
    try {
      const networkState = this.progress.networkStates.get(networkId);
      
      if (!networkState) {
        throw new Error(`Network state not found for network ${networkId}`);
      }
      
      // Switch to the correct network
      await this.ethereumService.switchNetwork(networkId);
      
      console.log(`   🔄 Fetching block ${blockNumber} from RPC...`);
      
      // Get block with transactions
      const block = await this.executeWithBackoff(
        () => this.ethereumService["client"].getBlock({
          blockNumber,
          includeTransactions: true,
        }),
        `getBlock(${blockNumber}) for ${networkState.networkName}`
      );

      if (!block || !block.transactions) {
        console.log(`   ⚠️  Block ${blockNumber}: No block data or transactions found`);
        return;
      }

      console.log(`   📦 Block ${blockNumber}: Found ${block.transactions.length} total transactions`);

      // Filter transactions to CoW Protocol settlement contract
      const settlementTransactions = block.transactions.filter(
        (tx) =>
          typeof tx === "object" &&
          tx.to?.toLowerCase() ===
            (process.env.COW_PROTOCOL_CONTRACT || "0x9008d19f58aabd9ed0d60971565aa8510560ab41").toLowerCase()
      );

      console.log(`   🎯 Block ${blockNumber}: Found ${settlementTransactions.length} CoW Protocol transactions`);

      if (settlementTransactions.length === 0) {
        console.log(`   ✅ Block ${blockNumber}: No CoW Protocol transactions, skipping`);
        return;
      }

      console.log(`   🔍 Block ${blockNumber}: Processing ${settlementTransactions.length} settlement transactions`);

      // Process each settlement transaction
      for (let i = 0; i < settlementTransactions.length; i++) {
        const tx = settlementTransactions[i];
        if (typeof tx === "object") {
          console.log(`   🔄 Processing transaction ${i + 1}/${settlementTransactions.length}: ${tx.hash}`);
          try {
            await this.processSettlementTransaction(tx, blockNumber, networkId);
            networkState.processedEvents++;
            this.progress.processedEvents++;
            console.log(`   ✅ Transaction ${tx.hash} processed successfully`);
          } catch (error) {
            console.error(
              `   ❌ Error processing settlement transaction ${tx.hash}:`,
              error
            );
            networkState.errors++;
            this.progress.errors++;
          }
        }
      }
      
      console.log(`   ✅ Block ${blockNumber} completed successfully`);
    } catch (error) {
      console.error(`   ❌ Error fetching block ${blockNumber}:`, error);
      const networkState = this.progress.networkStates.get(networkId);
      if (networkState) {
        networkState.errors++;
      }
      this.progress.errors++;
    }
  }

  private async processSettlementTransaction(
    tx: any,
    blockNumber: bigint,
    networkId: string
  ): Promise<void> {
    try {
      const databaseService = this.databaseServices.get(networkId);
      const networkState = this.progress.networkStates.get(networkId);
      
      if (!databaseService || !networkState) {
        throw new Error(`Services not found for network ${networkId}`);
      }
      
      console.log(`      🔄 Processing settlement transaction: ${tx.hash}`);

      // Fetch order details from CoW API
      console.log(`      📡 Fetching order details from CoW API for ${tx.hash}...`);
      const orderData = await this.fetchOrderDetailsFromCowApi(tx.hash, networkId);

      if (orderData && orderData.length > 0) {
        console.log(
          `      📋 Found ${orderData.length} orders for transaction ${tx.hash}`
        );

        // Process each order
        for (let i = 0; i < orderData.length; i++) {
          const order = orderData[i];
          console.log(`      🔄 Processing order ${i + 1}/${orderData.length}: ${order.kind} ${order.sellAmount} → ${order.buyAmount}`);
          
          const processedOrder: CowOrderData = {
            hash: tx.hash,
            // Store amounts as exact string representations to avoid precision loss
            executedBuyAmount: String(order.executedBuyAmount),
            executedSellAmount: String(order.executedSellAmount),
            executedSellAmountBeforeFees: String(order.executedSellAmountBeforeFees),
            sellToken: order.sellToken,
            buyToken: order.buyToken,
            receiver: order.receiver,
            sellAmount: String(order.sellAmount),
            buyAmount: String(order.buyAmount),
            kind: order.kind,
            blockNumber: Number(blockNumber),
          };

          console.log(`      💾 Saving order to database...`);
          // Save to database
          await databaseService.saveTransaction(processedOrder);
          networkState.savedOrders++;
          this.progress.savedOrders++;
          this.progress.totalEvents++;

          console.log(
            `      ✅ Saved order: ${order.kind} ${order.sellAmount} → ${order.buyAmount} (Block: ${blockNumber})`
          );
        }
      } else {
        console.log(`      ⚠️ No order data found for transaction ${tx.hash}`);
      }
    } catch (error) {
      console.error(
        `      ❌ Error processing settlement transaction ${tx.hash}:`,
        error
      );
      throw error;
    }
  }

  private async fetchOrderDetailsFromCowApi(
    transactionHash: string,
    networkId: string
  ): Promise<any[]> {
    try {
      // Determine the network API endpoint based on chain ID
      let networkName = "mainnet"; // default
      if (networkId === "42161") {
        networkName = "arbitrum_one";
      } else if (networkId === "100") {
        networkName = "xdai";
      }
      
      const apiBaseUrl = `https://api.cow.fi/${networkName}/api/v1`;
      const apiUrl = `${apiBaseUrl}/transactions/${transactionHash}/orders`;

      console.log(`         📡 API Request: ${apiUrl}`);

      const response = await this.executeWithBackoff(
        () => fetch(apiUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
          },
        }),
        `fetchOrderDetailsFromCowApi(${transactionHash})`
      );

      console.log(`         📊 API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`         ⚠️ No orders found for transaction ${transactionHash} (404)`);
          return [];
        }
        console.error(`         ❌ HTTP error! status: ${response.status} for URL: ${apiUrl}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const result = Array.isArray(data) ? data : [];
      console.log(`         ✅ API returned ${result.length} orders`);
      return result;
    } catch (error) {
      console.error(
        `         ❌ Error fetching order details for ${transactionHash}:`,
        error
      );
      return [];
    }
  }

  private printProgressReport(): void {
    const totalTime = Date.now() - this.progress.startTime.getTime();
    const uptime = this.formatTime(totalTime);

    console.log("\n📊 REALTIME SYNC PROGRESS (MULTI-NETWORK)");
    console.log("=========================================");
    console.log(`⏱️  Uptime: ${uptime}`);
    console.log(`🗄️  Database: ${this.isDatabaseConnected ? "SQLite" : "Mock"}`);
    console.log("");
    console.log("OVERALL STATS:");
    console.log(`  🔄 Events processed: ${this.progress.processedEvents}`);
    console.log(`  💾 Orders saved: ${this.progress.savedOrders}`);
    console.log(`  ❌ Errors: ${this.progress.errors}`);
    console.log("");
    console.log("PER-NETWORK STATS:");
    
    for (const [networkId, state] of this.progress.networkStates) {
      const newBlocks = state.latestBlock - state.lastProcessedBlock;
      
      console.log(`  ${state.networkName}:`);
      console.log(`    📦 Latest block: ${state.latestBlock}, Last processed: ${state.lastProcessedBlock}, Pending: ${newBlocks}`);
      console.log(`    💾 Orders: ${state.savedOrders}, Events: ${state.processedEvents}, Errors: ${state.errors}`);
    }
    
    if (this.progress.isWaitingForTimeout && this.progress.timeoutStartTime) {
      const timeoutElapsed = Date.now() - this.progress.timeoutStartTime.getTime();
      const timeoutRemaining = Math.max(0, this.RPC_TIMEOUT_DELAY - timeoutElapsed);
      const remainingTime = this.formatTime(timeoutRemaining);
      console.log(`\n⏳ RPC Timeout: ${remainingTime} remaining`);
    }
    
    console.log("=========================================\n");
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
      console.log("🧹 Cleaning up connections...");
      
      // Close all database connections
      for (const [networkId, databaseService] of this.databaseServices) {
        if (databaseService && "disconnect" in databaseService) {
          await databaseService.disconnect();
          const networkState = this.progress.networkStates.get(networkId);
          console.log(`🔌 Database connection closed for ${networkState?.networkName || networkId}`);
        }
      }
      
      console.log("✅ Cleanup completed");
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
