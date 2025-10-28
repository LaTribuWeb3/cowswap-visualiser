#!/usr/bin/env ts-node

/**
 * Quick test script to verify Trade event fetching works
 * This will scan just the last 1000 blocks to test the functionality
 */

import { config } from 'dotenv';

// Load environment variables
config();

// Set a small number of blocks for testing
process.env.BLOCKS_TO_SCAN = '1000';

// Import and run the main script
import { TradesFetcher } from './fetch-all-trades';

async function testTradeFetching() {
  try {
    console.log('🧪 Testing Trade event fetching with last 1000 blocks...');
    
    const fetcher = new TradesFetcher();
    const events = await fetcher.fetchAllTradeEvents();
    
    if (events.length > 0) {
      console.log(`✅ SUCCESS: Found ${events.length} Trade events in the last 1000 blocks!`);
      console.log('📋 Sample event:');
      console.log(JSON.stringify(events[0], null, 2));
    } else {
      console.log('⚠️ No Trade events found in the last 1000 blocks.');
      console.log('This could mean:');
      console.log('- No recent trades in this block range');
      console.log('- Try increasing BLOCKS_TO_SCAN in your .env file');
      console.log('- Check if your RPC_URL is working correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTradeFetching();
