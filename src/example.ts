import { MockDatabaseService } from './services/database';

/**
 * Example usage of the CoW Protocol data fetching and storage
 */
async function example() {
  console.log('🔍 CoW Protocol Data Fetcher Example');
  
  // Initialize services
  const database = new MockDatabaseService();
  
  try {
    // Connect to database
    await database.connect();
    
    // Example: Store a sample transaction
    console.log('\n📥 Storing sample transaction...');
    const sampleTransaction = {
      hash: '0x1234567890abcdef',
      blockNumber: 19000000,
      timestamp: new Date(),
      from: '0xabcdef1234567890',
      to: '0x0987654321fedcba',
      value: '1000000000000000000',
      status: 'success'
    };
    
    await database.saveTransaction(sampleTransaction);
    console.log('✅ Sample transaction stored');
    
    // Retrieve stored data
    console.log('\n📊 Retrieving stored data...');
    const storedTransactions = await database.getLatestTransactions(5);
    
    console.log(`📋 Stored transactions: ${storedTransactions.length}`);
    
    // Disconnect from database
    await database.disconnect();
    
    console.log('\n✅ Example completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other files
export { example };
