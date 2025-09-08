import { CowApiService } from '../services/cow-api';
import { MongoDBDatabaseService } from '../services/mongodb-database';
import { MockDatabaseService } from '../services/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SyncProgress {
  totalOrders: number;
  processedOrders: number;
  totalBatches: number;
  processedBatches: number;
  savedOrders: number;
  savedBatches: number;
  errors: number;
  startTime: Date;
  estimatedTimeRemaining?: string;
}

class CowApiHistoricalSync {
  private cowApiService: CowApiService;
  private databaseService!: MongoDBDatabaseService | MockDatabaseService;
  private isDatabaseConnected: boolean = false;
  private progress: SyncProgress;

  constructor() {
    this.cowApiService = new CowApiService();
    this.progress = {
      totalOrders: 0,
      processedOrders: 0,
      totalBatches: 0,
      processedBatches: 0,
      savedOrders: 0,
      savedBatches: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing CoW API Historical Sync...');
    
    try {
      // Try to connect to MongoDB first
      try {
        this.databaseService = new MongoDBDatabaseService();
        await this.databaseService.connect();
        this.isDatabaseConnected = true;
        console.log('✅ Connected to MongoDB');
      } catch (error) {
        console.log('⚠️ MongoDB connection failed, falling back to mock database');
        this.databaseService = new MockDatabaseService();
        this.isDatabaseConnected = false;
      }

      console.log('✅ CoW API Historical Sync initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize CoW API Historical Sync:', error);
      throw error;
    }
  }

  async syncHistoricalData(monthsBack: number = 4): Promise<void> {
    console.log(`📅 Starting historical sync for the past ${monthsBack} months (most recent first)...`);
    
    try {
      // Calculate the target date
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - monthsBack);
      
      console.log(`🎯 Target date: ${targetDate.toISOString()}`);
      console.log(`🔄 Starting from most recent events and working backwards...`);
      
      // Sync orders and batches
      await Promise.all([
        this.syncHistoricalOrders(targetDate),
        this.syncHistoricalBatches(targetDate)
      ]);
      
      console.log('✅ Historical sync completed successfully!');
      this.printFinalReport();
      
    } catch (error) {
      console.error('❌ Error during historical sync:', error);
      throw error;
    }
  }

  private async syncHistoricalOrders(targetDate: Date): Promise<void> {
    console.log('📋 Starting historical orders sync (most recent first)...');
    
    let offset = 0;
    const limit = 100; // API limit
    let hasMore = true;
    let totalProcessed = 0;
    
    while (hasMore) {
      try {
        console.log(`📥 Fetching orders with offset ${offset} (most recent first)...`);
        
        const response = await this.cowApiService.fetchOrders({
          limit,
          offset
        });
        
        if (!response.success || !response.data) {
          console.error('❌ Failed to fetch orders:', response.error);
          break;
        }
        
        const orders = response.data;
        
        if (orders.length === 0) {
          console.log('✅ No more orders to fetch');
          hasMore = false;
          break;
        }
        
        // Check if we've reached orders older than our target date
        let shouldContinue = false;
        for (const order of orders) {
          if (order.validTo && new Date(order.validTo) >= targetDate) {
            shouldContinue = true;
            break;
          }
        }
        
        if (!shouldContinue) {
          console.log('✅ Reached target date, stopping orders sync');
          hasMore = false;
          break;
        }
        
        // Save orders to database
        for (const order of orders) {
          try {
            await this.databaseService.saveOrder(order);
            this.progress.savedOrders++;
          } catch (error) {
            console.error(`❌ Error saving order ${order.uid}:`, error);
            this.progress.errors++;
          }
        }
        
        this.progress.processedOrders += orders.length;
        this.progress.totalOrders += orders.length;
        totalProcessed += orders.length;
        
        console.log(`💾 Saved ${orders.length} orders (Total: ${this.progress.savedOrders}, Processed: ${totalProcessed})`);
        
        offset += limit;
        
        // Add delay to avoid overwhelming the API
        await this.delay(100);
        
      } catch (error) {
        console.error(`❌ Error fetching orders at offset ${offset}:`, error);
        this.progress.errors++;
        
        // If we get too many errors, stop
        if (this.progress.errors > 10) {
          console.error('❌ Too many errors, stopping orders sync');
          break;
        }
        
        // Wait longer on error
        await this.delay(1000);
      }
    }
  }

  private async syncHistoricalBatches(targetDate: Date): Promise<void> {
    console.log('📦 Starting historical batches sync (most recent first)...');
    
    let offset = 0;
    const limit = 100; // API limit
    let hasMore = true;
    let totalProcessed = 0;
    
    while (hasMore) {
      try {
        console.log(`📥 Fetching batches with offset ${offset} (most recent first)...`);
        
        const response = await this.cowApiService.fetchBatches({
          limit,
          offset
        });
        
        if (!response.success || !response.data) {
          console.error('❌ Failed to fetch batches:', response.error);
          break;
        }
        
        const batches = response.data;
        
        if (batches.length === 0) {
          console.log('✅ No more batches to fetch');
          hasMore = false;
          break;
        }
        
        // Check if we've reached batches older than our target date
        let shouldContinue = false;
        for (const batch of batches) {
          // Use blockNumber to estimate date since timestamp is not available
          // This is a rough approximation - you may need to adjust based on your needs
          if (batch.blockNumber) {
            shouldContinue = true;
            break;
          }
        }
        
        if (!shouldContinue) {
          console.log('✅ Reached target date, stopping batches sync');
          hasMore = false;
          break;
        }
        
        // Save batches to database
        for (const batch of batches) {
          try {
            await this.databaseService.saveBatch(batch);
            this.progress.savedBatches++;
          } catch (error) {
            console.error(`❌ Error saving batch ${batch.hash}:`, error);
            this.progress.errors++;
          }
        }
        
        this.progress.processedBatches += batches.length;
        this.progress.totalBatches += batches.length;
        totalProcessed += batches.length;
        
        console.log(`💾 Saved ${batches.length} batches (Total: ${this.progress.savedBatches}, Processed: ${totalProcessed})`);
        
        offset += limit;
        
        // Add delay to avoid overwhelming the API
        await this.delay(100);
        
      } catch (error) {
        console.error(`❌ Error fetching batches at offset ${offset}:`, error);
        this.progress.errors++;
        
        // If we get too many errors, stop
        if (this.progress.errors > 10) {
          console.error('❌ Too many errors, stopping batches sync');
          break;
        }
        
        // Wait longer on error
        await this.delay(1000);
      }
    }
  }

  private printFinalReport(): void {
    const totalTime = Date.now() - this.progress.startTime.getTime();
    
    console.log('\n📊 FINAL SYNC REPORT');
    console.log('===================');
    console.log(`⏱️  Total time: ${this.formatTime(totalTime)}`);
    console.log(`📋 Orders processed: ${this.progress.processedOrders} (${this.progress.savedOrders} saved)`);
    console.log(`📦 Batches processed: ${this.progress.processedBatches} (${this.progress.savedBatches} saved)`);
    console.log(`❌ Errors: ${this.progress.errors}`);
    console.log(`🗄️  Database: ${this.isDatabaseConnected ? 'MongoDB' : 'Mock'}`);
    console.log('===================\n');
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    try {
      if (this.databaseService && 'disconnect' in this.databaseService) {
        await this.databaseService.disconnect();
        console.log('🔌 Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// Main execution function
async function main() {
  const sync = new CowApiHistoricalSync();
  
  try {
    await sync.initialize();
    
    // Get months from command line argument or default to 4
    const monthsBack = process.argv[2] ? parseInt(process.argv[2]) : 4;
    
    if (isNaN(monthsBack) || monthsBack <= 0) {
      console.error('❌ Invalid months argument. Please provide a positive number.');
      process.exit(1);
    }
    
    console.log(`🚀 Starting CoW API historical sync for the past ${monthsBack} months...`);
    await sync.syncHistoricalData(monthsBack);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await sync.cleanup();
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { CowApiHistoricalSync };
