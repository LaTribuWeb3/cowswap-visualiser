#!/usr/bin/env ts-node

/**
 * Standalone script to fetch all 'Trade' events from the COW Protocol contract
 * 
 * This script:
 * 1. Connects to the blockchain using RPC_URL from .env file
 * 2. Retrieves Trade events from recent blocks (last 100k blocks by default)
 * 3. Exports the events to a JSON file
 * 
 * Usage:
 *   npm run fetch:trades
 *   or
 *   ts-node src/scripts/fetch-all-trades.ts
 * 
 * Environment Variables:
 *   RPC_URL - Required: Ethereum RPC endpoint
 *   BLOCKS_TO_SCAN - Optional: Number of recent blocks to scan (default: 100000)
 *   COW_PROTOCOL_CONTRACT - Optional: Contract address (default: 0x9008D19f58AAbD9eD0d60971565AA8510560ab41)
 */

import { config } from 'dotenv';
import { createPublicClient, http, getContract, parseAbiItem, PublicClient, Chain } from 'viem';
import * as chains from 'viem/chains';
import { GPv2SettlementABI } from '../abi/GPv2SettlementABI';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Configuration
const COW_PROTOCOL_CONTRACT = process.env.COW_PROTOCOL_CONTRACT || '0x9008D19f58AAbD9eD0d60971565AA8510560ab41';
const OUTPUT_FILE = 'all-trades-events.json';
const BATCH_SIZE = 2000; // Process events in batches to avoid RPC limits
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

// Configuration for scanning recent blocks
const RECENT_BLOCKS_TO_SCAN = 100000; // Scan last 100k blocks by default
const MAX_BLOCKS_TO_SCAN = 500000; // Maximum blocks to scan (safety limit)

interface TradeEvent {
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
  buyAmount: bigint;
  feeAmount: bigint;
  orderUid: string;
  timestamp?: number;
}

class TradesFetcher {
  private client!: PublicClient;
  private contract!: any;
  private chainId!: number;

  constructor() {
    console.log('🚀 Initializing Trades Fetcher...');
  }

  /**
   * Initialize the blockchain connection
   */
  private async initialize(): Promise<void> {
    const rpcUrl = process.env.RPC_URL;
    
    if (!rpcUrl) {
      throw new Error('RPC_URL environment variable is required. Please set it in your .env file.');
    }

    console.log(`🔗 Connecting to RPC: ${rpcUrl.substring(0, 30)}...`);

    // Determine chain ID from RPC URL or environment
    let chainId = 1; // Default to Ethereum mainnet
    
    if (rpcUrl.includes('arbitrum')) {
      chainId = 42161;
    } else if (rpcUrl.includes('polygon')) {
      chainId = 137;
    } else if (rpcUrl.includes('gnosis')) {
      chainId = 100;
    }

    // Override with explicit chain ID if provided
    if (process.env.CHAIN_ID) {
      chainId = parseInt(process.env.CHAIN_ID);
    }

    this.chainId = chainId;
    console.log(`🌐 Using chain ID: ${chainId}`);

    // Get the chain from viem/chains
    const viemChains = Object.values(chains) as Chain[];
    const matchingChain = viemChains.find((chain: Chain) => chain.id === chainId);

    if (!matchingChain) {
      throw new Error(`Chain with ID ${chainId} not found in viem/chains. Supported chains: ${viemChains.map(c => `${c.name} (${c.id})`).join(', ')}`);
    }

    // Create public client
    this.client = createPublicClient({
      chain: matchingChain,
      transport: http(rpcUrl),
    });

    // Create contract instance
    this.contract = getContract({
      address: COW_PROTOCOL_CONTRACT as `0x${string}`,
      abi: GPv2SettlementABI,
      client: this.client,
    });

    console.log(`✅ Connected to ${matchingChain.name} (${chainId})`);
    console.log(`📋 Contract address: ${COW_PROTOCOL_CONTRACT}`);
  }

  /**
   * Get the latest block number
   */
  private async getLatestBlockNumber(): Promise<bigint> {
    try {
      const blockNumber = await this.client.getBlockNumber();
      console.log(`📦 Latest block: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      console.error('❌ Error fetching latest block number:', error);
      throw error;
    }
  }

  /**
   * Get the starting block for scanning (recent blocks approach)
   */
  private getStartingBlock(latestBlock: bigint): bigint {
    const blocksToScan = process.env.BLOCKS_TO_SCAN ? 
      parseInt(process.env.BLOCKS_TO_SCAN) : RECENT_BLOCKS_TO_SCAN;
    
    const maxBlocks = Math.min(blocksToScan, MAX_BLOCKS_TO_SCAN);
    const startingBlock = latestBlock - BigInt(maxBlocks);
    
    console.log(`🔍 Scanning last ${maxBlocks} blocks (from block ${startingBlock} to ${latestBlock})`);
    return startingBlock;
  }

  /**
   * Fetch Trade events from a specific block range
   */
  private async fetchTradeEvents(fromBlock: bigint, toBlock: bigint): Promise<TradeEvent[]> {
    try {
      console.log(`📡 Fetching Trade events from block ${fromBlock} to ${toBlock}...`);

      // First, let's try to get all logs from the contract to see if there are any events at all
      const allLogs = await this.client.getLogs({
        address: COW_PROTOCOL_CONTRACT as `0x${string}`,
        fromBlock,
        toBlock,
      });

      console.log(`📋 Found ${allLogs.length} total logs from contract in block range ${fromBlock}-${toBlock}`);

      // Now filter for Trade events specifically
      const tradeLogs = await this.client.getLogs({
        address: COW_PROTOCOL_CONTRACT as `0x${string}`,
        event: parseAbiItem('event Trade(address indexed owner, address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount, uint256 feeAmount, bytes orderUid)'),
        fromBlock,
        toBlock,
      });

      console.log(`📋 Found ${tradeLogs.length} Trade events in block range ${fromBlock}-${toBlock}`);

      // If we found logs but no Trade events, let's debug
      if (allLogs.length > 0 && tradeLogs.length === 0) {
        console.log(`🔍 Debug: Found ${allLogs.length} logs but no Trade events. Checking event signatures...`);
        
        // Check what events we actually have
        const eventSignatures = new Set();
        for (const log of allLogs) {
          if (log.topics && log.topics[0]) {
            eventSignatures.add(log.topics[0]);
          }
        }
        
        console.log(`🔍 Unique event signatures found: ${Array.from(eventSignatures).join(', ')}`);
        
        // The Trade event signature should be: 0xa07a543ab8a018198e99ca0184c93fe9050a79400a0a723441f84de1d972cc17
        const expectedTradeSignature = '0xa07a543ab8a018198e99ca0184c93fe9050a79400a0a723441f84de1d972cc17';
        console.log(`🔍 Expected Trade event signature: ${expectedTradeSignature}`);
        
        if (eventSignatures.has(expectedTradeSignature)) {
          console.log(`✅ Found Trade event signature in logs! There might be an issue with the event parsing.`);
        } else {
          console.log(`❌ Trade event signature not found in logs.`);
        }
      }

      // Convert logs to TradeEvent objects
      const tradeEvents: TradeEvent[] = tradeLogs.map((log) => ({
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        owner: log.args.owner as string,
        sellToken: log.args.sellToken as string,
        buyToken: log.args.buyToken as string,
        sellAmount: log.args.sellAmount as bigint,
        buyAmount: log.args.buyAmount as bigint,
        feeAmount: log.args.feeAmount as bigint,
        orderUid: log.args.orderUid as string,
      }));

      return tradeEvents;
    } catch (error) {
      console.error(`❌ Error fetching Trade events from blocks ${fromBlock}-${toBlock}:`, error);
      throw error;
    }
  }

  /**
   * Add timestamps to events by fetching block data
   */
  private async addTimestampsToEvents(events: TradeEvent[]): Promise<TradeEvent[]> {
    console.log(`⏰ Adding timestamps to ${events.length} events...`);
    
    // Group events by block number to minimize RPC calls
    const eventsByBlock = new Map<bigint, TradeEvent[]>();
    
    for (const event of events) {
      if (!eventsByBlock.has(event.blockNumber)) {
        eventsByBlock.set(event.blockNumber, []);
      }
      eventsByBlock.get(event.blockNumber)!.push(event);
    }

    const uniqueBlocks = Array.from(eventsByBlock.keys()).sort((a, b) => Number(a - b));
    console.log(`📦 Fetching timestamps for ${uniqueBlocks.length} unique blocks...`);

    // Fetch block timestamps in batches
    const blockTimestamps = new Map<bigint, number>();
    
    for (let i = 0; i < uniqueBlocks.length; i += 10) {
      const batch = uniqueBlocks.slice(i, i + 10);
      
      try {
        const blockPromises = batch.map(async (blockNumber) => {
          const block = await this.client.getBlock({ blockNumber });
          return { blockNumber, timestamp: Number(block.timestamp) };
        });

        const batchResults = await Promise.all(blockPromises);
        
        for (const result of batchResults) {
          blockTimestamps.set(result.blockNumber, result.timestamp);
        }

        console.log(`✅ Fetched timestamps for blocks ${batch[0]}-${batch[batch.length - 1]} (${i + batch.length}/${uniqueBlocks.length})`);
        
        // Add delay to avoid overwhelming the RPC
        if (i + 10 < uniqueBlocks.length) {
          await this.delay(100);
        }
      } catch (error) {
        console.error(`❌ Error fetching timestamps for batch ${i}-${i + 10}:`, error);
        // Continue with other batches
      }
    }

    // Add timestamps to events
    const eventsWithTimestamps = events.map(event => ({
      ...event,
      timestamp: blockTimestamps.get(event.blockNumber),
    }));

    console.log(`✅ Added timestamps to ${eventsWithTimestamps.length} events`);
    return eventsWithTimestamps;
  }

  /**
   * Fetch all Trade events from recent blocks to latest block
   */
  async fetchAllTradeEvents(): Promise<TradeEvent[]> {
    await this.initialize();

    const latestBlock = await this.getLatestBlockNumber();
    const startingBlock = this.getStartingBlock(latestBlock);

    console.log(`🎯 Fetching Trade events from block ${startingBlock} to ${latestBlock}`);
    console.log(`📊 Total blocks to scan: ${Number(latestBlock - startingBlock)}`);

    const allEvents: TradeEvent[] = [];
    let currentFromBlock = startingBlock;

    while (currentFromBlock < latestBlock) {
      const currentToBlock = BigInt(Math.min(Number(currentFromBlock) + BATCH_SIZE - 1, Number(latestBlock)));

      try {
        console.log(`\n🔄 Processing batch: blocks ${currentFromBlock} to ${currentToBlock}`);
        const batchEvents = await this.fetchTradeEvents(currentFromBlock, currentToBlock);
        allEvents.push(...batchEvents);

        console.log(`✅ Batch completed: ${batchEvents.length} events found (Total: ${allEvents.length})`);

        // Add delay between batches to avoid overwhelming the RPC
        if (currentToBlock < latestBlock) {
          console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await this.delay(DELAY_BETWEEN_BATCHES);
        }
      } catch (error) {
        console.error(`❌ Error processing batch ${currentFromBlock}-${currentToBlock}:`, error);
        
        // If batch fails, try smaller chunks
        if (Number(currentToBlock - currentFromBlock) > 100) {
          console.log(`🔄 Retrying with smaller chunks...`);
          const chunkSize = 100;
          let chunkFromBlock = currentFromBlock;
          
          while (chunkFromBlock < currentToBlock) {
            const chunkToBlock = BigInt(Math.min(Number(chunkFromBlock) + chunkSize - 1, Number(currentToBlock)));
            
            try {
              const chunkEvents = await this.fetchTradeEvents(chunkFromBlock, chunkToBlock);
              allEvents.push(...chunkEvents);
              console.log(`✅ Chunk completed: ${chunkEvents.length} events (Total: ${allEvents.length})`);
            } catch (chunkError) {
              console.error(`❌ Error in chunk ${chunkFromBlock}-${chunkToBlock}:`, chunkError);
            }
            
            chunkFromBlock = chunkToBlock + 1n;
            await this.delay(500); // Shorter delay for chunks
          }
        }
      }

      currentFromBlock = currentToBlock + 1n;
    }

    console.log(`\n🎉 Fetch completed! Total Trade events found: ${allEvents.length}`);

    // Add timestamps to events
    const eventsWithTimestamps = await this.addTimestampsToEvents(allEvents);

    return eventsWithTimestamps;
  }

  /**
   * Export events to JSON file
   */
  async exportToJson(events: TradeEvent[]): Promise<void> {
    const outputPath = path.resolve(OUTPUT_FILE);
    
    console.log(`\n💾 Exporting ${events.length} events to ${outputPath}...`);

    // Convert BigInt values to strings for JSON serialization
    const serializableEvents = events.map(event => ({
      ...event,
      blockNumber: event.blockNumber.toString(),
      sellAmount: event.sellAmount.toString(),
      buyAmount: event.buyAmount.toString(),
      feeAmount: event.feeAmount.toString(),
      timestamp: event.timestamp,
    }));

    const exportData = {
      metadata: {
        contractAddress: COW_PROTOCOL_CONTRACT,
        chainId: this.chainId,
        totalEvents: events.length,
        exportDate: new Date().toISOString(),
        blockRange: {
          from: events.length > 0 ? events[0].blockNumber.toString() : '0',
          to: events.length > 0 ? events[events.length - 1].blockNumber.toString() : '0',
        },
      },
      events: serializableEvents,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Successfully exported ${events.length} Trade events to ${outputPath}`);
    console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting Trade Events Fetcher...');
    console.log('=' .repeat(50));

    const fetcher = new TradesFetcher();
    const events = await fetcher.fetchAllTradeEvents();
    
    if (events.length === 0) {
      console.log('⚠️ No Trade events found. This could mean:');
      console.log('   - The contract has no trades yet');
      console.log('   - The deployment block is incorrect');
      console.log('   - There\'s an issue with the RPC connection');
      return;
    }

    await fetcher.exportToJson(events);

    console.log('\n🎉 Script completed successfully!');
    console.log(`📋 Summary:`);
    console.log(`   - Total Trade events: ${events.length}`);
    console.log(`   - Output file: ${OUTPUT_FILE}`);
    console.log(`   - Contract: ${COW_PROTOCOL_CONTRACT}`);

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { TradesFetcher, TradeEvent };
