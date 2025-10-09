import {
  createPublicClient,
  http,
  getContract,
  decodeFunctionData,
  formatEther,
  formatUnits,
  parseAbiItem,
} from "viem";
import { mainnet } from "viem/chains";
import { GPv2SettlementABI } from "../abi/GPv2SettlementABI";

// CoW Protocol contract address (mainnet)
const COW_PROTOCOL_ADDRESS = process.env.COW_PROTOCOL_CONTRACT || "0x9008d19f58aabd9ed0d60971565aa8510560ab41";

export class EthereumService {
  private client;
  private contract;
  private blockCache: Map<number, number> = new Map();
  private readonly CACHE_SIZE_LIMIT = 1000;
  private readonly dateToBlockNumber: Map<number, number> = new Map();

  // Backoff configuration
  private readonly MAX_RETRIES: number;
  private readonly BASE_DELAY: number;
  private readonly MAX_DELAY: number;
  private readonly BACKOFF_MULTIPLIER: number;
  
  // Batch processing configuration
  private readonly MAX_BATCH_SIZE: number;
  private readonly BATCH_DELAY_MS: number;

  constructor() {
    // Get RPC URL from environment variables
    const rpcUrl =
      process.env.RPC_URL || "https://arb-mainnet.g.alchemy.com/v2/demo"; 

    // Initialize backoff configuration from environment variables
    this.MAX_RETRIES = parseInt(process.env.RPC_BACKOFF_MAX_RETRIES || "5");
    this.BASE_DELAY = parseInt(process.env.RPC_BACKOFF_BASE_DELAY || "1000");
    this.MAX_DELAY = parseInt(process.env.RPC_BACKOFF_MAX_DELAY || "30000");
    this.BACKOFF_MULTIPLIER = parseFloat(process.env.RPC_BACKOFF_MULTIPLIER || "2");
    
    // Initialize batch processing configuration
    this.MAX_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100");
    this.BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "1000");

    console.log(`🔗 Using RPC URL: ${rpcUrl}`);
    console.log(`🔄 Backoff config: maxRetries=${this.MAX_RETRIES}, baseDelay=${this.BASE_DELAY}ms, maxDelay=${this.MAX_DELAY}ms, multiplier=${this.BACKOFF_MULTIPLIER}`);
    console.log(`🚀 Batch config: maxBatchSize=${this.MAX_BATCH_SIZE}, batchDelay=${this.BATCH_DELAY_MS}ms`);

    // Create public client for Mainnet
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    // Create contract instance
    this.contract = getContract({
      address: COW_PROTOCOL_ADDRESS as `0x${string}`,
      abi: GPv2SettlementABI,
      client: this.client,
    });
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
   * Execute RPC call with exponential backoff retry logic
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
      'ECONNREFUSED'
    ];
    
    const lowerErrorMessage = errorMessage.toLowerCase();
    return retryableErrors.some(error => lowerErrorMessage.includes(error));
  }

  /**
   * Add a block to cache and manage cache size
   */
  private addToCache(blockNumber: number, timestamp: number): void {
    this.blockCache.set(blockNumber, timestamp);

    // Remove oldest entries if cache exceeds limit
    if (this.blockCache.size > this.CACHE_SIZE_LIMIT) {
      const entries = Array.from(this.blockCache.entries());
      // Sort by block number to remove oldest (lowest block numbers)
      entries.sort((a, b) => a[0] - b[0]);
      
      // Remove the oldest 10% of entries
      const entriesToRemove = Math.floor(this.CACHE_SIZE_LIMIT * 0.1);
      for (let i = 0; i < entriesToRemove; i++) {
        this.blockCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Fetch block timestamp using viem (RPC call)
   */
  private async fetchBlockTimestampFromRPC(blockNumber: number): Promise<number> {
    return await this.executeWithBackoff(
      async () => {
        const block = await this.client.getBlock({
          blockNumber: BigInt(blockNumber),
        });
        if (block) {
          const timestamp = Number(block.timestamp);
          this.addToCache(blockNumber, timestamp);
          return timestamp;
        }
        return 0;
      },
      `fetchBlockTimestampFromRPC(${blockNumber})`
    );
  }

  async getBlockTimestamp(blockNumber: number): Promise<number> {
    return await this.fetchBlockTimestampFromRPC(blockNumber);
  }

  async getBlockNumberFromDate(date: Date): Promise<number> {
    /**
     * Queries https://api.etherscan.io/v2/api
     * ?chainid=42161
     * &module=block
     * &action=getblocknobytime
     * &timestamp=1578638524
     * &closest=before
     * &apikey=YourApiKeyToken
     * 
     * to get the block number from a date
     */
    const timestamp = date.getTime() / 1000;
    if(this.dateToBlockNumber.has(timestamp)) {
      return this.dateToBlockNumber.get(timestamp)!;
    } else {
      const blockNumber = await this.executeWithBackoff(
        async () => {
          const response = await fetch(`https://api.etherscan.io/v2/api?chainid=42161&module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${process.env.ETHERSCAN_API_KEY}`);
          const data = await response.json();
          if (data.status !== "1") {
            throw new Error(`Failed to get block number from date: ${data.result}`);
          }
          return data.result;
        },
        `getBlockNumberFromDate(${date})`
      );
      const blockNum = Number(blockNumber);
      this.dateToBlockNumber.set(timestamp, blockNum);
      return blockNum;
    }
  }

  /**
   * Manually add a block to the cache (useful for seeding the cache)
   */
  public addBlockToCache(blockNumber: number, timestamp: number): void {
    this.addToCache(blockNumber, timestamp);
    console.log(`Added block ${blockNumber} with timestamp ${timestamp} to cache`);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; limit: number; blocks: number[] } {
    return {
      size: this.blockCache.size,
      limit: this.CACHE_SIZE_LIMIT,
      blocks: Array.from(this.blockCache.keys()).sort((a, b) => a - b)
    };
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.blockCache.clear();
    console.log('Block cache cleared');
  }

  async fetchTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
    try {
      console.log(`🔍 Fetching symbol for token: ${tokenAddress}`);

      // Known token symbols for common tokens
      const knownTokens: Record<string, string> = {
      };

      // Check if we know this token
      if (knownTokens[tokenAddress]) {
        console.log(
          `✅ Using known symbol for ${tokenAddress}: ${knownTokens[tokenAddress]}`
        );
        return knownTokens[tokenAddress];
      }

      console.log(
        `🔍 Token ${tokenAddress} not in known list, fetching from la-tribu API...`
      );

      // Use the comprehensive metadata function
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      console.log(`✅ Fetched symbol for ${tokenAddress}: ${metadata.symbol}`);
      return metadata.symbol;
    } catch (error) {
      console.error(`❌ Error fetching symbol for ${tokenAddress}:`, error);
      // Fallback to generated symbol
      return this.generateFallbackSymbol(tokenAddress);
    }
  }


  /**
   * Generate a fallback symbol when token symbol fetching fails
   */
  private generateFallbackSymbol(tokenAddress: string): string {
    // Check if it's a known token by address
    const knownTokens: Record<string, string> = {
    };

    if (knownTokens[tokenAddress]) {
      return knownTokens[tokenAddress];
    }

    // Generate a short symbol from the address
    const shortAddress = tokenAddress.slice(2, 8).toUpperCase();
    return `TKN${shortAddress}`;
  }

  async getLatestBlockNumber() {
    return await this.executeWithBackoff(
      () => this.client.getBlockNumber(),
      'getLatestBlockNumber'
    );
  }

  /**
   * Get the last 10 transactions for the CoW Protocol contract
   */
  async getLastTransactions(limit: number = 10) {
    try {
      console.log(
        `🔍 Fetching last ${limit} transactions for CoW Protocol contract...`
      );

      // Get the latest block number
      const latestBlock = await this.getLatestBlockNumber();
      console.log(`📦 Latest block: ${latestBlock}`);

      // Get transactions from recent blocks
      const transactions: any[] = [];
      let blockNumber = latestBlock;
      let count = 0;

      while (count < limit && blockNumber > 0) {
        try {
          const block = await this.executeWithBackoff(
            () => this.client.getBlock({
              blockNumber,
              includeTransactions: true,
            }),
            `getBlock(${blockNumber})`
          );

          // Debug: Check if the returned block is more recent than our hardcoded limit
          if (block.number > latestBlock) {
            console.log(
              `⚠️  Warning: Block ${block.number} is more recent than hardcoded limit ${latestBlock}`
            );
          }

          if (block.transactions) {
            for (const tx of block.transactions) {
              if (
                typeof tx === "object" &&
                tx.to?.toLowerCase() === COW_PROTOCOL_ADDRESS.toLowerCase()
              ) {
                // Decode transaction data
                const decodedData = this.decodeTransactionData(tx.input);
                const formattedData = this.formatDecodedData(decodedData);

                transactions.push({
                  hash: tx.hash,
                  blockNumber: block.number,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value,
                  gasPrice: tx.gasPrice,
                  gasUsed: tx.gas || 0n,
                  status: "success", // We'll assume success for now
                  decodedFunction: formattedData.functionName,
                  functionDescription: formattedData.description,
                  parsedData: formattedData.parsedData,
                });
                count++;

                if (count >= limit) break;
              }
            }
          }
        } catch (error) {
          console.log(`⚠️  Error fetching block ${blockNumber}:`, error);
        }

        blockNumber--;
      }

      return transactions;
    } catch (error) {
      console.error("❌ Error fetching transactions:", error);
      throw error;
    }
  }

  /**
   * Decode transaction input data to extract function call information
   */
  decodeTransactionData(inputData: string) {
    try {
      if (!inputData || inputData === "0x") {
        return {
          functionName: "transfer",
          args: [],
          decoded: false,
        };
      }

      const decoded = decodeFunctionData({
        abi: GPv2SettlementABI,
        data: inputData as `0x${string}`,
      });

      // Find the function in the ABI to get parameter names
      const functionAbi = GPv2SettlementABI.find(
        (item) => item.type === "function" && item.name === decoded.functionName
      );

      if (functionAbi && functionAbi.inputs && decoded.args) {
        // Create named arguments object
        const namedArgs: Record<string, any> = {};
        functionAbi.inputs.forEach((input, index) => {
          namedArgs[input.name] = (decoded.args as any[])[index];
        });

        return {
          functionName: decoded.functionName,
          args: decoded.args,
          namedArgs,
          decoded: true,
        };
      }

      return {
        functionName: decoded.functionName,
        args: decoded.args,
        namedArgs: {},
        decoded: true,
      };
    } catch (error) {
      // Try to extract function signature from the input data
      const functionSignature = inputData.slice(0, 10);
      return {
        functionName: "unknown",
        args: [],
        namedArgs: {},
        decoded: false,
        error: error instanceof Error ? error.message : "Unknown error",
        functionSignature,
      };
    }
  }

  /**
   * Format decoded transaction data for display
   */
  formatDecodedData(decodedData: any) {
    if (!decodedData.decoded) {
      const description = decodedData.functionSignature
        ? `Unknown function (signature: ${decodedData.functionSignature})`
        : "Simple ETH transfer or unknown function";

      return {
        functionName: decodedData.functionName,
        description,
        details: decodedData.functionSignature
          ? [`Function Signature: ${decodedData.functionSignature}`]
          : [],
        parsedData: null,
      };
    }

    const details: string[] = [];
    let parsedData: any = null;

    switch (decodedData.functionName) {
      case "setPreSignature":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Signed: ${decodedData.args[1]}`);
        parsedData = {
          orderUid: decodedData.args[0],
          signed: decodedData.args[1],
        };
        break;

      case "invalidateOrder":
        details.push(`Order UID: ${decodedData.args[0]}`);
        parsedData = {
          orderUid: decodedData.args[0],
        };
        break;

      case "setSignature":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Signature: ${decodedData.args[1].slice(0, 20)}...`);
        parsedData = {
          orderUid: decodedData.args[0],
          signature: decodedData.args[1],
        };
        break;

      case "settle":
        const tokens = decodedData.namedArgs.tokens || decodedData.args[0];
        const clearingPrices =
          decodedData.namedArgs.clearingPrices || decodedData.args[1];
        const trades = decodedData.namedArgs.trades || decodedData.args[2];
        const interactions =
          decodedData.namedArgs.interactions || decodedData.args[3];

        // Show clearing prices
        if (clearingPrices && clearingPrices.length > 0) {
          details.push(
            `Clearing Prices: ${clearingPrices
              .map((price: bigint) => formatUnits(price, 18))
              .join("\n- ")}`
          );
        }

        // Show order details if available
        if (trades && trades.length > 0) {
          trades.forEach((order: any) => {
            details.push(`Order:`);
            details.push(`  - Sell Token Index: ${order.sellTokenIndex}`);
            details.push(`  - Sell Token: ${tokens[order.sellTokenIndex]}`);
            details.push(`  - Buy Token Index: ${order.buyTokenIndex}`);
            details.push(`  - Buy Token: ${tokens[order.buyTokenIndex]}`);
            details.push(`  - Receiver: ${order.receiver}`);
            details.push(`  - Sell Amount: ${order.sellAmount}`);
            details.push(`  - Buy Amount: ${order.buyAmount}`);
            details.push(`  - Executed Amount: ${order.executedAmount}`);
            details.push(
              `  - Valid To: ${new Date(
                Number(order.validTo) * 1000
              ).toISOString()}`
            );
          });
        }

        // Show interaction count
        if (interactions && interactions.length > 0) {
          details.push(
            `Interactions: ${interactions.length} interaction groups`
          );
        }

        // Create structured parsed data
        parsedData = {
          tokens,
          clearingPrices: clearingPrices?.map((price: bigint) =>
            formatUnits(price, 18)
          ),
          trades: trades?.map((trade: any) => ({
            sellTokenIndex: trade.sellTokenIndex,
            sellToken: tokens[trade.sellTokenIndex],
            buyTokenIndex: trade.buyTokenIndex,
            buyToken: tokens[trade.buyTokenIndex],
            receiver: trade.receiver,
            sellAmount: trade.sellAmount,
            buyAmount: trade.buyAmount,
            executedAmount: trade.executedAmount,
            validTo: new Date(Number(trade.validTo) * 1000).toISOString(),
            appData: trade.appData,
            feeAmount: trade.feeAmount,
            flags: trade.flags,
            signature: trade.signature,
          })),
          interactions,
          numberOfOrders: trades?.length || 0,
          numberOfInteractions: interactions?.length || 0,
        };
        break;

      case "settleSingleOrder":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Settlement Data: ${decodedData.args[1].slice(0, 50)}...`);
        parsedData = {
          orderUid: decodedData.args[0],
          settlementData: decodedData.args[1],
        };
        break;

      case "withdraw":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Recipient: ${decodedData.args[1]}`);
        details.push(`Amount: ${formatEther(decodedData.args[2])} ETH`);
        parsedData = {
          orderUid: decodedData.args[0],
          recipient: decodedData.args[1],
          amount: formatEther(decodedData.args[2]),
        };
        break;

      case "withdrawAll":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Recipient: ${decodedData.args[1]}`);
        parsedData = {
          orderUid: decodedData.args[0],
          recipient: decodedData.args[1],
        };
        break;

      default:
        details.push(`Raw Args: ${JSON.stringify(decodedData.args)}`);
        parsedData = {
          rawArgs: decodedData.args,
        };
    }

    return {
      functionName: decodedData.functionName,
      description: this.getFunctionDescription(decodedData.functionName),
      details,
      parsedData,
    };
  }

  /**
   * Get human-readable description for function names
   */
  getFunctionDescription(functionName: string): string {
    const descriptions: Record<string, string> = {
      setPreSignature:
        "Set pre-signature for a CoW Protocol order (order approval)",
      invalidateOrder: "Invalidate/cancel an order",
      setSignature: "Set signature for an order",
      settle: "Settle multiple orders in a batch auction",
      settleSingleOrder: "Settle a single order",
      withdraw: "Withdraw specific amount from order",
      withdrawAll: "Withdraw all funds from order",
      transfer: "Simple ETH transfer",
      unknown: "Unknown function call",
    };

    return descriptions[functionName] || "Unknown function";
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      console.log("📋 Fetching CoW Protocol contract information...");

      // Just return basic contract info without calling functions
      return {
        address: COW_PROTOCOL_ADDRESS,
        name: "CoW Protocol Settlement",
        description:
          "CoW Protocol's main settlement contract for batch auctions",
      };
    } catch (error) {
      console.error("❌ Error fetching contract info:", error);
      throw error;
    }
  }

  /**
   * Fetch events from multiple blocks at once using batch processing
   * This is much more efficient than processing blocks individually
   */
  async getBatchEvents(
    fromBlock: bigint,
    toBlock: bigint,
    eventName?: string
  ): Promise<any[]> {
    try {
      console.log(
        `📡 Fetching batch events from block ${fromBlock} to ${toBlock}${eventName ? ` for event ${eventName}` : ''}...`
      );

      const blockRange = Number(toBlock - fromBlock);
      console.log(`📦 Block range: ${blockRange} blocks`);

      // If the range is too large, split it into smaller chunks
      if (blockRange > this.MAX_BATCH_SIZE) {
        console.log(`⚠️ Block range too large (${blockRange} blocks), splitting into chunks of ${this.MAX_BATCH_SIZE}`);
        
        const allEvents: any[] = [];
        let currentFromBlock = fromBlock;
        
        while (currentFromBlock < toBlock) {
          const currentToBlock = BigInt(Math.min(Number(currentFromBlock) + this.MAX_BATCH_SIZE - 1, Number(toBlock)));
          
          console.log(`🔄 Processing chunk: blocks ${currentFromBlock} to ${currentToBlock}`);
          const chunkEvents = await this.getBatchEvents(currentFromBlock, currentToBlock, eventName);
          allEvents.push(...chunkEvents);
          
          currentFromBlock = currentToBlock + 1n;
          
          // Add a configurable delay between chunks to avoid overwhelming the RPC
          if (currentFromBlock < toBlock) {
            await this.sleep(this.BATCH_DELAY_MS);
          }
        }
        
        return allEvents;
      }

      // Use getLogs to fetch all CoW Protocol events efficiently in a single call
      // This is much more efficient than multiple getLogs calls or fetching all blocks
      const allLogs = await this.executeWithBackoff(
        () => this.client.getLogs({
          address: COW_PROTOCOL_ADDRESS as `0x${string}`,
          fromBlock,
          toBlock,
        }),
        `getLogs(${fromBlock}-${toBlock})`
      );

      console.log(`📋 Total logs fetched: ${allLogs.length}`);

      // Group logs by transaction hash to process them as settlement transactions
      const logsByTransaction = new Map<string, any[]>();
      
      for (const log of allLogs) {
        const txHash = log.transactionHash;
        if (!logsByTransaction.has(txHash)) {
          logsByTransaction.set(txHash, []);
        }
        logsByTransaction.get(txHash)!.push(log);
      }

      console.log(`🎯 Unique settlement transactions: ${logsByTransaction.size}`);

      // Convert to event-like objects for compatibility with existing processing logic
      const allEvents = Array.from(logsByTransaction.entries()).map(([txHash, logs]) => ({
        type: "SettlementTransaction",
        transactionHash: txHash,
        blockNumber: logs[0].blockNumber,
        logs: logs,
        // Add other fields for compatibility
        hash: txHash,
        blockHash: logs[0].blockHash,
      })).sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      console.log(`✅ Batch fetch completed: ${allEvents.length} events from ${blockRange} blocks`);
      return allEvents;
    } catch (error) {
      console.error(`❌ Error in batch event fetch (${fromBlock}-${toBlock}):`, error);
      
      // If batch fails, fall back to individual block processing
      console.log(`🔄 Falling back to individual block processing...`);
      const allEvents: any[] = [];
      
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        try {
          const blockEvents = await this.getEventsFromSingleBlock(blockNum);
          allEvents.push(...blockEvents);
        } catch (blockError) {
          console.error(`❌ Error fetching events from block ${blockNum}:`, blockError);
        }
      }
      
      return allEvents;
    }
  }

  /**
   * Get events from a single block (fallback method)
   */
  async getEventsFromSingleBlock(blockNumber: bigint): Promise<any[]> {
    try {
      const block = await this.executeWithBackoff(
        () => this.client.getBlock({
          blockNumber,
          includeTransactions: true,
        }),
        `getBlock(${blockNumber})`
      );

      if (!block || !block.transactions) {
        return [];
      }

      // Filter transactions to CoW Protocol settlement contract
      const settlementTransactions = block.transactions.filter(
        (tx) =>
          typeof tx === "object" &&
          tx.to?.toLowerCase() === COW_PROTOCOL_ADDRESS.toLowerCase()
      );

      // Convert transactions to event-like objects
      return settlementTransactions.map((tx) => ({
        type: "SettlementTransaction",
        blockNumber,
        transactionHash: tx.hash,
        transaction: tx,
      }));
    } catch (error) {
      console.error(`❌ Error fetching events from single block ${blockNumber}:`, error);
      return [];
    }
  }

  /**
   * Get recent events from the contract
   */
  async getRecentEvents(limit: number = 10) {
    try {
      console.log(
        `📡 Fetching last ${limit} events from CoW Protocol contract...`
      );

      const latestBlock = await this.getLatestBlockNumber();
      const fromBlock = latestBlock - 10n; // Look back 10 blocks (free tier limit)

      console.log(
        `📦 Block range: ${fromBlock} to ${latestBlock} (${Number(
          latestBlock - fromBlock
        )} blocks)`
      );

      let orderPlacements: any[] = [];
      let orderCancellations: any[] = [];
      let orderFulfillments: any[] = [];

      try {
        [orderPlacements, orderCancellations, orderFulfillments] =
          await Promise.all([
            this.executeWithBackoff(
              () => this.client.getLogs({
                address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                event: {
                  type: "event",
                  name: "OrderPlacement",
                  inputs: [
                    { type: "bytes", name: "orderUid", indexed: true },
                    { type: "address", name: "owner", indexed: true },
                    { type: "address", name: "sender", indexed: true },
                  ],
                },
                fromBlock,
                toBlock: latestBlock,
              }),
              'getLogs(OrderPlacement)'
            ),
            this.executeWithBackoff(
              () => this.client.getLogs({
                address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                event: {
                  type: "event",
                  name: "OrderCancellation",
                  inputs: [
                    { type: "bytes", name: "orderUid", indexed: true },
                    { type: "address", name: "owner", indexed: true },
                  ],
                },
                fromBlock,
                toBlock: latestBlock,
              }),
              'getLogs(OrderCancellation)'
            ),
            this.executeWithBackoff(
              () => this.client.getLogs({
                address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                event: {
                  type: "event",
                  name: "OrderFulfillment",
                  inputs: [
                    { type: "bytes", name: "orderUid", indexed: true },
                    { type: "address", name: "owner", indexed: true },
                    { type: "address", name: "sender", indexed: true },
                  ],
                },
                fromBlock,
                toBlock: latestBlock,
              }),
              'getLogs(OrderFulfillment)'
            ),
          ]);
      } catch (error: any) {
        console.warn("⚠️ RPC provider limitation detected:", error.message);

        // If the error mentions block range, try with a smaller range
        if (error.message && error.message.includes("block range")) {
          console.log("🔄 Retrying with smaller block range (5 blocks)...");
          const smallerFromBlock = latestBlock - 5n;

          try {
            [orderPlacements, orderCancellations, orderFulfillments] =
              await Promise.all([
                this.executeWithBackoff(
                  () => this.client.getLogs({
                    address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                    event: {
                      type: "event",
                      name: "OrderPlacement",
                      inputs: [
                        { type: "bytes", name: "orderUid", indexed: true },
                        { type: "address", name: "owner", indexed: true },
                        { type: "address", name: "sender", indexed: true },
                      ],
                    },
                    fromBlock: smallerFromBlock,
                    toBlock: latestBlock,
                  }),
                  'getLogs(OrderPlacement-retry)'
                ),
                this.executeWithBackoff(
                  () => this.client.getLogs({
                    address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                    event: {
                      type: "event",
                      name: "OrderCancellation",
                      inputs: [
                        { type: "bytes", name: "orderUid", indexed: true },
                        { type: "address", name: "owner", indexed: true },
                      ],
                    },
                    fromBlock: smallerFromBlock,
                    toBlock: latestBlock,
                  }),
                  'getLogs(OrderCancellation-retry)'
                ),
                this.executeWithBackoff(
                  () => this.client.getLogs({
                    address: COW_PROTOCOL_ADDRESS as `0x${string}`,
                    event: {
                      type: "event",
                      name: "OrderFulfillment",
                      inputs: [
                        { type: "bytes", name: "orderUid", indexed: true },
                        { type: "address", name: "owner", indexed: true },
                        { type: "address", name: "sender", indexed: true },
                      ],
                    },
                    fromBlock: smallerFromBlock,
                    toBlock: latestBlock,
                  }),
                  'getLogs(OrderFulfillment-retry)'
                ),
              ]);
            console.log(
              "✅ Successfully fetched events with smaller block range"
            );
          } catch (retryError) {
            console.error(
              "❌ Failed even with smaller block range:",
              retryError
            );
            // Return empty arrays to continue execution
            orderPlacements = [];
            orderCancellations = [];
            orderFulfillments = [];
          }
        } else {
          console.error("❌ Unexpected error fetching events:", error);
          // Return empty arrays to continue execution
          orderPlacements = [];
          orderCancellations = [];
          orderFulfillments = [];
        }
      }

      // Combine and sort events by block number
      const allEvents = [
        ...orderPlacements.map((log) => ({ ...log, type: "OrderPlacement" })),
        ...orderCancellations.map((log) => ({
          ...log,
          type: "OrderCancellation",
        })),
        ...orderFulfillments.map((log) => ({
          ...log,
          type: "OrderFulfillment",
        })),
      ].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

      return allEvents.slice(0, limit);
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      throw error;
    }
  }

  /**
   * Fetch complete token metadata from la-tribu API
   */
  async fetchTokenMetadata(tokenAddress: `0x${string}`): Promise<{
    address: string;
    network: string;
    name: string;
    symbol: string;
    decimals: number;
    cached: boolean;
    timestamp: string;
  }> {
    try {
      console.log(`🔍 Fetching complete token metadata for: ${tokenAddress}`);
      
      const response = await fetch(`${process.env.TOKENS_METADATA_API_URL || 'https://tokens-metadata.la-tribu.xyz'}/tokens/ethereum/${tokenAddress}`, {
        headers: {
          'Authorization': `Bearer ${process.env.TOKEN_METADATA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.symbol || !data.name) {
        throw new Error('Invalid token metadata response');
      }

      console.log(`✅ Fetched token metadata: ${data.symbol} - ${data.name} (${data.decimals || 18} decimals)`);
      
      return {
        address: data.address,
        network: data.network,
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals || 18,
        cached: data.cached || false,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.warn(`Failed to fetch token metadata for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get token decimals from the la-tribu API
   */
  async getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
    try {
      console.log(`🔍 Fetching decimals for token: ${tokenAddress}`);

      // Known token decimals for common tokens
      const knownDecimals: Record<string, number> = {
      };

      // Check if we know this token
      if (knownDecimals[tokenAddress]) {
        console.log(
          `✅ Using known decimals for ${tokenAddress}: ${knownDecimals[tokenAddress]}`
        );
        return knownDecimals[tokenAddress];
      }

      console.log(
        `🔍 Token ${tokenAddress} not in known list, fetching from la-tribu API...`
      );

      // Use the comprehensive metadata function
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      console.log(`✅ Fetched decimals for ${tokenAddress}: ${metadata.decimals}`);
      return metadata.decimals;
    } catch (error) {
      console.error(`❌ Error fetching decimals for ${tokenAddress}:`, error);
      // Return default decimals (18) for ERC20 tokens
      console.log(`⚠️ Using default decimals (18) for ${tokenAddress}`);
      return 18;
    }
  }
}
