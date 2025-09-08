import { CowApiService } from './services/cow-api';
import { MockDatabaseService } from './services/database';

/**
 * Example usage of the CoW Protocol data fetching and storage
 */
async function example() {
  console.log('🔍 CoW Protocol Data Fetcher Example');
  
  // Initialize services
  const cowApi = new CowApiService();
  const database = new MockDatabaseService();
  
  try {
    // Connect to database
    await database.connect();
    
    // Fetch recent orders
    console.log('\n📥 Fetching recent orders...');
    const ordersResponse = await cowApi.fetchOrders({
      limit: 10,
      status: 'fulfilled'
    });
    
    if (ordersResponse.success && ordersResponse.data) {
      console.log(`✅ Fetched ${ordersResponse.data.length} orders`);
      
      // Store orders in database
      for (const order of ordersResponse.data) {
        await database.saveOrder(order);
      }
    } else {
      console.log('❌ Failed to fetch orders:', ordersResponse.error);
    }
    
    // Fetch recent batches
    console.log('\n📥 Fetching recent batches...');
    const batchesResponse = await cowApi.fetchBatches({
      limit: 5,
      status: 'executed'
    });
    
    if (batchesResponse.success && batchesResponse.data) {
      console.log(`✅ Fetched ${batchesResponse.data.length} batches`);
      
      // Store batches in database
      for (const batch of batchesResponse.data) {
        await database.saveBatch(batch);
      }
    } else {
      console.log('❌ Failed to fetch batches:', batchesResponse.error);
    }
    
    // Retrieve stored data
    console.log('\n📊 Retrieving stored data...');
    const storedOrders = await database.getOrders({ limit: 5 });
    const storedBatches = await database.getBatches({ limit: 3 });
    
    console.log(`📋 Stored orders: ${storedOrders.length}`);
    console.log(`📋 Stored batches: ${storedBatches.length}`);
    
    // Disconnect from database
    await database.disconnect();
    
    console.log('\n✅ Example completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other files
export { example };
