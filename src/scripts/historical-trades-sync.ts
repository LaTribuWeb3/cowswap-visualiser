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
  
  // Batch processing configuration
  private readonly MAX_BATCH_SIZE: number;
  private readonly BATCH_DELAY_MS: number;

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
    
    // Initialize batch processing configuration
    this.MAX_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100");
    this.BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "2000");
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

      // Calculate target block (4 months ago) with more conservative estimate
      const monthsBack = 4;
      const blocksPerDay = 345600; // ~0.25 seconds per block on Arbitrum = 345,600 blocks per day
      const daysBack = monthsBack * 30;
      const estimatedBlocksBack = BigInt(daysBack * blocksPerDay);
      
      // Ensure we don't go too far back - limit to maximum 6 months to avoid RPC provider limits
      const maxBlocksBack = BigInt(6 * 30 * blocksPerDay); // 6 months max
      const actualBlocksBack = estimatedBlocksBack > maxBlocksBack ? maxBlocksBack : estimatedBlocksBack;
      
      this.targetBlock = Number(latestBlock - actualBlocksBack);
      
      // Additional safety check - ensure target block is not negative or too small
      if (this.targetBlock < 100000000) { // Arbitrum started around block 0, but let's be safe
        console.warn(`⚠️ Calculated target block ${this.targetBlock} seems too low, using minimum safe value`);
        this.targetBlock = 100000000; // Safe minimum block number
      }

      console.log(`📦 Starting from block: ${this.progress.lastProcessedBlock}`);
      console.log(`🎯 Target block (4 months ago): ${this.targetBlock}`);

      // Validate that the target block is reasonable
      await this.validateTargetBlock();

      console.log("✅ Historical Trades Sync initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Historical Trades Sync:", error);
      throw error;
    }
  }

  private async validateTargetBlock(): Promise<void> {
    try {
      console.log(`🔍 Validating target block ${this.targetBlock}...`);
      
      // Try to fetch the target block to see if it's available
      const testBlock = await this.ethereumService["client"].getBlock({
        blockNumber: BigInt(this.targetBlock),
      });
      
      if (testBlock) {
        console.log(`✅ Target block ${this.targetBlock} is available`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('could not be found')) {
        console.warn(`⚠️ Target block ${this.targetBlock} is not available - adjusting to a more recent block`);
        
        // Try to find a more recent block that's available
        let adjustedTarget = this.targetBlock + 1000000; // Try 1M blocks more recent
        
        // Keep trying until we find an available block or reach the latest block
        while (adjustedTarget < this.progress.lastProcessedBlock - 1000) {
          try {
            await this.ethereumService["client"].getBlock({
              blockNumber: BigInt(adjustedTarget),
            });
            console.log(`✅ Found available block ${adjustedTarget}, updating target`);
            this.targetBlock = adjustedTarget;
            break;
          } catch (retryError) {
            adjustedTarget += 100000; // Try 100k blocks more recent
          }
        }
        
        if (adjustedTarget >= this.progress.lastProcessedBlock - 1000) {
          console.warn(`⚠️ Could not find a suitable target block, using latest block - 1000`);
          this.targetBlock = this.progress.lastProcessedBlock - 1000;
        }
      } else {
        console.error(`❌ Unexpected error validating target block:`, error);
        throw error;
      }
    }
  }

  async syncHistoricalTrades(): Promise<void> {
    console.log(
      "📅 Starting historical sync from most recent to 4 months ago..."
    );
    console.log("🚀 Using batch processing for much faster historical sync");

    try {
      const totalBlocksToProcess = this.progress.lastProcessedBlock - this.targetBlock;
      
      console.log(`🎯 BATCH SYNC PLAN:`);
      console.log(`   📦 Starting block: ${this.progress.lastProcessedBlock}`);
      console.log(`   🎯 Target block: ${this.targetBlock}`);
      console.log(`   📊 Total blocks to process: ${totalBlocksToProcess.toLocaleString()}`);
      console.log(`   🚀 Using batch size: ${this.MAX_BATCH_SIZE} blocks per batch`);
      console.log(`   ⏱️  Estimated time: ${Math.ceil(totalBlocksToProcess / this.MAX_BATCH_SIZE / 6)} minutes (with batch processing)`);
      console.log("");

      // Process in batches from most recent to oldest
      let currentBlock = this.progress.lastProcessedBlock;
      let batchNumber = 1;
      const batchSize = this.MAX_BATCH_SIZE;
      
      while (currentBlock > this.targetBlock) {
        const batchStartBlock = currentBlock;
        const batchEndBlock = Math.max(currentBlock - batchSize + 1, this.targetBlock);
        const actualBatchSize = batchStartBlock - batchEndBlock + 1;
        
        console.log(`\n🔄 BATCH ${batchNumber} - Processing blocks ${batchStartBlock} to ${batchEndBlock} (${actualBatchSize} blocks)`);
        console.log(`   📍 Progress: ${((this.progress.lastProcessedBlock - batchStartBlock) / totalBlocksToProcess * 100).toFixed(1)}%`);
        console.log(`   ⏰ Processing at: ${new Date().toISOString()}`);
        
        try {
          await this.processBatch(BigInt(batchEndBlock), BigInt(batchStartBlock));
          
          // Update progress after each batch
          console.log(`📊 Batch ${batchNumber} completed`);
          this.printProgressReport();
          
          // Configurable delay between batches to avoid overwhelming the RPC
          if (batchEndBlock > this.targetBlock) {
            console.log(`⏳ Brief pause between batches...`);
            await this.delay(this.BATCH_DELAY_MS);
          }
          
          currentBlock = batchEndBlock - 1;
          batchNumber++;
        } catch (error) {
          // Check if we've hit the RPC provider limit
          if (error instanceof Error && error.message.includes('Reached RPC provider limit')) {
            console.log(`✅ ${error.message}`);
            break; // Exit the loop gracefully
          }
          
          console.error(`❌ Error processing batch ${batchNumber}:`, error);
          this.progress.errors++;
          
          // Move to next batch even if current batch failed
          currentBlock = batchEndBlock - 1;
          batchNumber++;
        }
      }

      console.log("✅ Historical sync completed successfully!");
      this.printFinalReport();
    } catch (error) {
      console.error("❌ Error during historical sync:", error);
      throw error;
    }
  }

  private async processBatch(fromBlock: bigint, toBlock: bigint): Promise<void> {
    try {
      console.log(`   📡 Fetching batch events from block ${fromBlock} to ${toBlock}...`);
      
      // Use the new batch event fetching method
      const events = await this.ethereumService.getBatchEvents(fromBlock, toBlock);
      
      console.log(`   📋 Found ${events.length} events in batch`);
      
      if (events.length === 0) {
        console.log(`   ✅ No CoW Protocol events found in batch ${fromBlock}-${toBlock}`);
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

      console.log(`   🔄 Processing ${eventsByTransaction.size} unique transactions...`);

      // Process each transaction
      let processedTransactions = 0;
      for (const [txHash, txEvents] of eventsByTransaction) {
        processedTransactions++;
        console.log(`      🔄 Processing transaction ${processedTransactions}/${eventsByTransaction.size}: ${txHash}`);
        
        try {
          // Check if transaction already exists in database
          const existingTransaction = await this.databaseService.getTransactionByHash(txHash);
          if (existingTransaction) {
            console.log(`      ⏭️ Skipping duplicate transaction: ${txHash}`);
            this.progress.skippedDuplicates++;
            continue;
          }

          // Get the transaction details from the first event
          const firstEvent = txEvents[0];
          const blockNumber = firstEvent.blockNumber;
          
          // Create a mock transaction object for compatibility
          const mockTransaction = {
            hash: txHash,
            blockNumber: blockNumber,
            // Add other fields as needed
          };
          
          await this.processSettlementTransaction(mockTransaction, BigInt(blockNumber));
          this.progress.processedEvents++;
          console.log(`      ✅ Transaction ${txHash} processed successfully`);
        } catch (error) {
          console.error(`      ❌ Error processing transaction ${txHash}:`, error);
          this.progress.errors++;
        }
      }
      
      console.log(`   ✅ Batch processing completed: ${processedTransactions} transactions processed`);
    } catch (error) {
      console.error(`   ❌ Error in batch processing (${fromBlock}-${toBlock}):`, error);
      
      // Fall back to individual block processing if batch fails
      console.log(`   🔄 Falling back to individual block processing...`);
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        try {
          await this.processBlock(blockNum);
        } catch (blockError) {
          console.error(`   ❌ Error processing block ${blockNum}:`, blockError);
          this.progress.errors++;
        }
      }
    }
  }

  private async processBlock(blockNumber: bigint): Promise<void> {
    console.log(`   🔄 Fetching block ${blockNumber} from RPC...`);
    
    try {
      // Get block with transactions
      const block = await this.ethereumService["client"].getBlock({
        blockNumber,
        includeTransactions: true,
      });

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
            await this.processSettlementTransaction(tx, blockNumber);
            this.progress.processedEvents++;
            console.log(`   ✅ Transaction ${tx.hash} processed successfully`);
          } catch (error) {
            console.error(
              `   ❌ Error processing settlement transaction ${tx.hash}:`,
              error
            );
            this.progress.errors++;
          }
        }
      }
      
      console.log(`   ✅ Block ${blockNumber} completed successfully`);
    } catch (error) {
      // Check if this is a BlockNotFoundError - if so, we've likely hit the RPC provider's limit
      if (error instanceof Error && error.message.includes('could not be found')) {
        console.warn(`   ⚠️ Block ${blockNumber} not found - likely beyond RPC provider retention limit. Stopping sync.`);
        // Don't increment error count for this expected case
        throw new Error(`Reached RPC provider limit at block ${blockNumber}. Sync completed successfully.`);
      }
      
      console.error(`   ❌ Error fetching block ${blockNumber}:`, error);
      this.progress.errors++;
    }
  }

  private async processSettlementTransaction(
    tx: any,
    blockNumber: bigint
  ): Promise<void> {
    try {
      console.log(`      🔍 Checking if transaction ${tx.hash} already exists...`);
      
      // Check if transaction already exists in database
      const existingTransaction = await this.databaseService.getTransactionByHash(tx.hash);
      if (existingTransaction) {
        console.log(`      ⏭️ Skipping duplicate transaction: ${tx.hash}`);
        this.progress.skippedDuplicates++;
        return;
      }

      console.log(`      ✅ Transaction ${tx.hash} is new, processing...`);

      // Fetch order details from CoW API
      console.log(`      📡 Fetching order details from CoW API for ${tx.hash}...`);
      const orderData = await this.fetchOrderDetailsFromCowApi(tx.hash);

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

          console.log(`      💾 Saving order to database...`);
          // Save to database
          await this.databaseService.saveTransaction(processedOrder);
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
    transactionHash: string
  ): Promise<any[]> {
    try {
      // Determine the network based on the RPC URL
      let apiBaseUrl = process.env.COW_PROTOCOL_API_URL || "";

      const apiUrl = `${apiBaseUrl}/transactions/${transactionHash}/orders`;

      console.log(`         📡 API Request: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

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
      const timeoutRemaining = Math.max(0, (10 * 1000) - timeoutElapsed);
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