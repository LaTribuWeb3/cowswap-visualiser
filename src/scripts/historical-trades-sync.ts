import { EthereumService } from "../services/ethereum";
import { DatabaseService, SqliteDatabaseService } from "../services/database";
import { getNetworkConfig } from "../config/networks";
import { getNetworkConfigs, getNetworkIds } from "../utils/config";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

interface SyncProgress {
  totalTransactions: number;
  savedOrders: number;
  skippedDuplicates: number;
  errors: number;
  startTime: Date;
  currentBlock: number;
  targetBlock: number;
}

interface CowOrderData {
  hash: string;
  executedBuyAmount: string;  // Store as exact string representation
  executedSellAmount: string; // Store as exact string representation
  executedSellAmountBeforeFees: string; // Store as exact string representation
  creationDate: Date;
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: string;  // Store as exact string representation
  buyAmount: string;   // Store as exact string representation
  kind: string;
  blockNumber: number;
}

class HistoricalTradesSync {
  private ethereumService: EthereumService;
  private databaseService: DatabaseService;
  private networkId: string;
  private progress: SyncProgress;
  private totalBlocks: number = 0;
  private processedBlocks: number = 0;
  
  // Adaptive batch processing configuration
  private currentBatchSize: number;
  private readonly INITIAL_BATCH_SIZE: number;
  private readonly MAX_BATCH_SIZE: number;
  private readonly MIN_BATCH_SIZE: number;
  private readonly BATCH_DELAY_MS: number;
  private lastSuccessfulBatchSize: number = 0;
  private lastFailedBatchSize: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailedBatchSizeForConsecutive: number = 0;
  
  // Timing and estimation
  private batchTimings: { blocks: number; timeMs: number }[] = [];
  private readonly MAX_TIMING_SAMPLES = 10;
  private batchStartTime: number = 0;

  constructor(networkId: string) {
    this.networkId = networkId;
    this.ethereumService = new EthereumService();
    this.databaseService = new SqliteDatabaseService();
    
    this.progress = {
      totalTransactions: 0,
      savedOrders: 0,
      skippedDuplicates: 0,
      errors: 0,
      startTime: new Date(),
      currentBlock: 0,
      targetBlock: 0,
    };
    
    // Initialize adaptive batch processing configuration
    this.INITIAL_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100");
    this.MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || "20000");
    this.MIN_BATCH_SIZE = parseInt(process.env.MIN_BATCH_SIZE || "50");
    this.BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "2000");
    
    // Start with initial batch size
    this.currentBatchSize = this.INITIAL_BATCH_SIZE;
  }

  async initialize(monthsBack: number = 4): Promise<void> {
    const networkConfig = getNetworkConfig(this.networkId);
    if (!networkConfig) {
      throw new Error(`Network ${this.networkId} not found`);
    }

    console.log(`🚀 Initializing Historical Trades Sync for ${networkConfig.name}...`);
    console.log(`🔗 RPC URL: [HIDDEN]`);

    try {
      // Switch to the network (RPC URL will be read from config.json)
      await this.ethereumService.switchNetwork(this.networkId);
      
      // Connect to database with the correct network ID
      await this.databaseService.connect(this.networkId);
      console.log(`✅ Connected to SQLite database for ${networkConfig.name}`);

      // Get the latest block number
      const latestBlock = await this.ethereumService.getLatestBlockNumber();
      const latestBlockNum = Number(latestBlock);
      this.progress.currentBlock = latestBlockNum;

      // Calculate target timestamp (4 months ago)
      const now = Math.floor(Date.now() / 1000);
      const targetTimestamp = now - (monthsBack * 30 * 24 * 3600);
      const targetDate = new Date(targetTimestamp * 1000);
      
      console.log(`🔍 Searching for block from ${targetDate.toISOString()}...`);
      
      // Use binary search to find the block from 4 months ago
      const targetBlock = await this.findBlockByTimestamp(
        1,
        latestBlockNum,
        targetTimestamp
      );
      
      this.progress.targetBlock = targetBlock;
      
      console.log(`✅ Will sync from block ${latestBlockNum} down to block ${targetBlock}`);
      console.log(`📊 Total blocks to process: ${(latestBlockNum - targetBlock).toLocaleString()}`);
      
      // Initialize progress tracking
      this.totalBlocks = latestBlockNum - targetBlock;
      this.processedBlocks = 0;

    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Binary search to find the block closest to a target timestamp
   */
  private async findBlockByTimestamp(
    lowBlock: number,
    highBlock: number,
    targetTimestamp: number
  ): Promise<number> {
    // Simple case: if range is small, return the low block
    if (highBlock - lowBlock <= 10) {
      console.log(`🎯 Binary search completed: block ${lowBlock}`);
      return lowBlock;
    }
    
    const midBlock = Math.floor((lowBlock + highBlock) / 2);
    
    try {
      console.log(`🔍 Checking block ${midBlock} (range: ${lowBlock}-${highBlock})...`);
      
      // Get the middle block's timestamp
      const blockTimestamp = await this.ethereumService.getBlockTimestamp(midBlock);
      const blockDate = new Date(blockTimestamp * 1000);
      
      console.log(`   📅 Block ${midBlock}: ${blockDate.toISOString()}`);
      
      // Recursive binary search
      if (blockTimestamp > targetTimestamp) {
        // Block is too recent, search lower half (older blocks)
        return await this.findBlockByTimestamp(lowBlock, midBlock, targetTimestamp);
      } else {
        // Block is too old, search upper half (newer blocks)
        return await this.findBlockByTimestamp(midBlock, highBlock, targetTimestamp);
      }
    } catch (error) {
      console.error(`❌ Error checking block ${midBlock}:`, error);
      return midBlock;
    }
  }

  async syncHistoricalTrades(): Promise<void> {
    const networkConfig = getNetworkConfig(this.networkId);
    console.log(`📅 Starting historical sync for ${networkConfig?.name}...`);
    console.log(`🚀 Batch size: ${this.MAX_BATCH_SIZE} blocks`);

    try {
      let batchNumber = 1;
      const startBlock = this.progress.currentBlock;
      
      // Process from current block down to target block
      while (this.progress.currentBlock > this.progress.targetBlock) {
        const batchEndBlock = Math.max(
          this.progress.currentBlock - this.currentBatchSize + 1,
          this.progress.targetBlock
        );
        
        try {
          // Start timing this batch
          this.startBatchTimer();
          
          await this.processBatch(
            BigInt(batchEndBlock),
            BigInt(this.progress.currentBlock)
          );
          
          // Calculate blocks processed in this batch
          const blocksProcessed = Number(this.progress.currentBlock - batchEndBlock + 1);
          const batchTime = this.recordBatchTiming(blocksProcessed);
          
          // Success: increase batch size for next attempt
          this.onBatchSuccess();
          
          // Move to next batch
          this.progress.currentBlock = batchEndBlock - 1;
          this.processedBlocks = startBlock - this.progress.currentBlock;
          
          // Show timing and remaining blocks after each successful fetch
          const remainingBlocks = this.progress.currentBlock - this.progress.targetBlock;
          const timeEstimate = this.calculateTimeEstimate();
          console.log(`⏱️ Batch completed in ${(batchTime / 1000).toFixed(1)}s (${blocksProcessed} blocks) | 📊 Remaining: ${remainingBlocks.toLocaleString()} blocks | 🕐 ETA: ${timeEstimate.remainingTimeFormatted}`);
          
          // Update progress bar
          this.updateProgressBar();
          
          // Delay between batches
          if (this.progress.currentBlock > this.progress.targetBlock) {
            await this.delay(this.BATCH_DELAY_MS);
          }
          
          batchNumber++;
        } catch (error) {
          // Check if error is due to too many blocks
          if (this.isBatchSizeError(error)) {
            console.log(`🔄 Detected batch size error, adapting batch size...`);
            this.onBatchSizeError();
            // Retry with smaller batch size (don't increment batchNumber)
            continue;
          } else {
            // Other error: move to next batch
            console.log(`❌ Non-batch-size error, moving to next batch`);
            this.progress.errors++;
            this.progress.currentBlock = batchEndBlock - 1;
            this.processedBlocks = startBlock - this.progress.currentBlock;
            this.updateProgressBar();
            batchNumber++;
          }
        }
      }

      // Complete the progress bar
      this.updateProgressBar();
      console.log("\n✅ Historical sync completed!");
      this.printFinalReport();
    } catch (error) {
      console.error("\n❌ Error during sync:", error);
      throw error;
    }
  }

  private async processBatch(fromBlock: bigint, toBlock: bigint): Promise<void> {
    try {
      // Fetch all events in the batch
      const events = await this.ethereumService.getBatchEvents(fromBlock, toBlock);
      
      if (events.length === 0) {
        return;
      }

      // Group events by transaction hash
      const eventsByTx = new Map<string, any[]>();
      
      for (const event of events) {
        const txHash = event.transactionHash || event.hash;
        if (!eventsByTx.has(txHash)) {
          eventsByTx.set(txHash, []);
        }
        eventsByTx.get(txHash)!.push(event);
      }

      // Process each transaction
      for (const [txHash, txEvents] of eventsByTx) {
        try {
          // Check if already exists
          const existing = await this.databaseService.getTransactionByHash(txHash);
          if (existing) {
            this.progress.skippedDuplicates++;
            continue;
          }

          // Get block number from first event
          const blockNumber = txEvents[0].blockNumber;
          
          // Process the transaction
          await this.processTransaction(txHash, BigInt(blockNumber));
          this.progress.totalTransactions++;
        } catch (error) {
          this.progress.errors++;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  private async processTransaction(txHash: string, blockNumber: bigint): Promise<void> {
    try {
      // Fetch order details from CoW API
      const orderData = await this.fetchOrderDetailsFromCowApi(txHash);

      if (orderData && orderData.length > 0) {
        // Process each order
        for (const order of orderData) {
          const processedOrder: CowOrderData = {
            hash: txHash,
            executedBuyAmount: String(order.executedBuyAmount),
            executedSellAmount: String(order.executedSellAmount),
            executedSellAmountBeforeFees: String(order.executedSellAmountBeforeFees),
            creationDate: new Date(order.creationDate),
            sellToken: order.sellToken,
            buyToken: order.buyToken,
            receiver: order.receiver,
            sellAmount: String(order.sellAmount),
            buyAmount: String(order.buyAmount),
            kind: order.kind,
            blockNumber: Number(blockNumber),
          };

          // Save to database
          await this.databaseService.saveTransaction(processedOrder);
          this.progress.savedOrders++;
          console.log(`      ✅ Saved order: ${txHash} | Block: ${blockNumber} | ${order.sellToken.slice(0, 8)}... → ${order.buyToken.slice(0, 8)}...`);
        }
      }
    } catch (error) {
      console.error(`      ❌ Error processing transaction ${txHash}:`, error);
      throw error;
    }
  }

  private async fetchOrderDetailsFromCowApi(transactionHash: string): Promise<any[]> {
    try {
      // Map chain ID to CoW API network name
      let networkName = "mainnet";
      if (this.networkId === "42161") {
        networkName = "arbitrum_one";
      } else if (this.networkId === "100") {
        networkName = "xdai";
      }
      
      const apiUrl = `https://api.cow.fi/${networkName}/api/v1/transactions/${transactionHash}/orders`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`         ❌ Error fetching orders for ${transactionHash}:`, error);
      return [];
    }
  }

  private onBatchSuccess(): void {
    // Success: reset consecutive failures and try to double the batch size for next attempt
    this.consecutiveFailures = 0;
    this.lastSuccessfulBatchSize = this.currentBatchSize;
    
    // Calculate next batch size, but never exceed the last failure size
    const proposedSize = this.currentBatchSize * 2;
    const maxAllowedSize = this.lastFailedBatchSize > 0 ? this.lastFailedBatchSize - 1 : this.MAX_BATCH_SIZE;
    this.currentBatchSize = Math.min(proposedSize, maxAllowedSize, this.MAX_BATCH_SIZE);
    
    console.log(`✅ Batch successful! Increasing batch size to ${this.currentBatchSize} blocks (max allowed: ${maxAllowedSize})`);
  }

  private onBatchSizeError(): void {
    // Track consecutive failures with the same batch size
    if (this.lastFailedBatchSizeForConsecutive === this.currentBatchSize) {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = 1;
      this.lastFailedBatchSizeForConsecutive = this.currentBatchSize;
    }
    
    this.lastFailedBatchSize = this.currentBatchSize;
    
    // If we've failed twice in a row with the same batch size, force a more aggressive reduction
    if (this.consecutiveFailures >= 2) {
      console.log(`🔄 Consecutive failures detected (${this.consecutiveFailures}), forcing aggressive reduction...`);
      this.currentBatchSize = Math.max(Math.floor(this.currentBatchSize / 2), this.MIN_BATCH_SIZE);
      this.consecutiveFailures = 0; // Reset after aggressive reduction
    } else if (this.lastSuccessfulBatchSize > 0) {
      // Use average between last successful and current failed size
      this.currentBatchSize = Math.floor((this.lastSuccessfulBatchSize + this.currentBatchSize) / 2);
      this.currentBatchSize = Math.max(this.currentBatchSize, this.MIN_BATCH_SIZE);
    } else {
      // No previous success: halve the current size
      this.currentBatchSize = Math.max(Math.floor(this.currentBatchSize / 2), this.MIN_BATCH_SIZE);
    }
    
    console.log(`⚠️ Batch too large! Reducing batch size to ${this.currentBatchSize} blocks`);
  }

  private isBatchSizeError(error: any): boolean {
    // Check if error is related to batch size (too many blocks, RPC limits, etc.)
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorData = error?.data?.toLowerCase() || '';
    const errorDetails = error?.details?.toLowerCase() || '';
    
    // Check all possible error message locations
    const fullErrorMessage = `${errorMessage} ${errorData} ${errorDetails}`;
    
    return fullErrorMessage.includes('too many') || 
           fullErrorMessage.includes('batch') || 
           fullErrorMessage.includes('limit') ||
           fullErrorMessage.includes('exceeded') ||
           fullErrorMessage.includes('rate limit') ||
           fullErrorMessage.includes('timeout') ||
           fullErrorMessage.includes('more than') ||
           fullErrorMessage.includes('results') ||
           fullErrorMessage.includes('query returned') ||
           fullErrorMessage.includes('invalid params') ||
           fullErrorMessage.includes('rpc method');
  }

  private startBatchTimer(): void {
    this.batchStartTime = Date.now();
  }

  private recordBatchTiming(blocksProcessed: number): number {
    const batchTime = Date.now() - this.batchStartTime;
    
    // Add timing data
    this.batchTimings.push({ blocks: blocksProcessed, timeMs: batchTime });
    
    // Keep only the last MAX_TIMING_SAMPLES
    if (this.batchTimings.length > this.MAX_TIMING_SAMPLES) {
      this.batchTimings.shift();
    }
    
    return batchTime;
  }

  private calculateTimeEstimate(): { timePerBlock: number; remainingTimeMs: number; remainingTimeFormatted: string } {
    if (this.batchTimings.length === 0) {
      return { timePerBlock: 0, remainingTimeMs: 0, remainingTimeFormatted: 'Unknown' };
    }
    
    // Calculate average time per block from recent batches
    const totalBlocks = this.batchTimings.reduce((sum, timing) => sum + timing.blocks, 0);
    const totalTime = this.batchTimings.reduce((sum, timing) => sum + timing.timeMs, 0);
    const timePerBlock = totalTime / totalBlocks;
    
    // Calculate remaining time
    const remainingBlocks = this.progress.currentBlock - this.progress.targetBlock;
    const remainingTimeMs = remainingBlocks * timePerBlock;
    
    // Format time
    const hours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingTimeMs % (1000 * 60)) / 1000);
    
    let remainingTimeFormatted = '';
    if (hours > 0) remainingTimeFormatted += `${hours}h `;
    if (minutes > 0) remainingTimeFormatted += `${minutes}m `;
    if (seconds > 0 || remainingTimeFormatted === '') remainingTimeFormatted += `${seconds}s`;
    
    return { timePerBlock, remainingTimeMs, remainingTimeFormatted: remainingTimeFormatted.trim() };
  }

  private updateProgressBar(): void {
    // Simple ASCII progress bar that works in VS Code
    const percentage = this.totalBlocks > 0 ? (this.processedBlocks / this.totalBlocks * 100) : 0;
    const remainingBlocks = this.totalBlocks - this.processedBlocks;
    const barWidth = 40;
    const filledWidth = Math.floor((percentage / 100) * barWidth);
    
    // Create ASCII progress bar
    let bar = '[';
    for (let i = 0; i < barWidth; i++) {
      if (i < filledWidth) {
        bar += '=';
      } else if (i === filledWidth) {
        bar += '>';
      } else {
        bar += '-';
      }
    }
    bar += ']';
    
    // Calculate time estimate
    const timeEstimate = this.calculateTimeEstimate();
    
    // Always write to a new line to avoid mixing with other output
    console.log(`🔄 ${bar} ${percentage.toFixed(1)}% | Blocks: ${this.processedBlocks.toLocaleString()}/${this.totalBlocks.toLocaleString()} (${remainingBlocks.toLocaleString()} left) | Orders: ${this.progress.savedOrders} | Skipped: ${this.progress.skippedDuplicates} | Errors: ${this.progress.errors} | Batch: ${this.currentBatchSize} | ETA: ${timeEstimate.remainingTimeFormatted}`);
  }

  private printProgress(): void {
    // Progress is now handled by the progress bar
    // This method is kept for compatibility but not used
  }

  private printFinalReport(): void {
    const totalTime = Date.now() - this.progress.startTime.getTime();
    const networkConfig = getNetworkConfig(this.networkId);

    console.log("\n📊 FINAL REPORT");
    console.log("=====================================");
    console.log(`🌐 Network: ${networkConfig?.name}`);
    console.log(`⏱️  Total time: ${this.formatTime(totalTime)}`);
    console.log(`🔄 Transactions: ${this.progress.totalTransactions}`);
    console.log(`💾 Orders saved: ${this.progress.savedOrders}`);
    console.log(`⏭️ Duplicates skipped: ${this.progress.skippedDuplicates}`);
    console.log(`❌ Errors: ${this.progress.errors}`);
    console.log("=====================================\n");
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
      console.log("\n🧹 Cleaning up...");
      await this.databaseService.disconnect();
      console.log("✅ Cleanup completed");
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }
}

// Main execution function
async function main() {
  // Get months from command line argument or default to 4
  const monthsBack = process.argv[2] ? parseInt(process.argv[2]) : 4;

  if (isNaN(monthsBack) || monthsBack <= 0) {
    console.error("❌ Invalid months argument. Please provide a positive number.");
    console.error("   Usage: npm run sync-historical [monthsBack]");
    console.error("   Example: npm run sync-historical 4");
    process.exit(1);
  }

  // Read config.json to get all network IDs
  const config = getNetworkConfigs();
  const networkIds = getNetworkIds();

  console.log(`🌐 Found ${networkIds.length} networks in config: ${networkIds.join(', ')}`);
  console.log(`📅 Will sync the past ${monthsBack} months for each network\n`);

  // Process each network sequentially
  for (let i = 0; i < networkIds.length; i++) {
    const networkId = networkIds[i];
    const networkConfig = config[networkId];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 NETWORK ${i + 1}/${networkIds.length}: ${networkConfig.name} (Chain ID: ${networkId})`);
    console.log(`${'='.repeat(60)}\n`);

    const sync = new HistoricalTradesSync(networkId);

    try {
      await sync.initialize(monthsBack);
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

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export { HistoricalTradesSync };