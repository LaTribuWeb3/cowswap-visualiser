import { SqliteDatabaseService } from "../services/sqlite-database";
import { getNetworkConfigs, getNetworkConfig } from "../config/networks";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface DatabaseStats {
  networkId: string;
  networkName: string;
  totalTransactions: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  uniqueTokens: {
    sell: number;
    buy: number;
  };
}

async function listDatabaseContents(networkId?: string, limit: number = 20) {
  const networks = getNetworkConfigs();
  const networkIds = networkId ? [networkId] : Object.keys(networks);

  console.log("📊 SQLite Database Contents\n");
  console.log("=".repeat(80));

  for (const netId of networkIds) {
    const network = getNetworkConfig(netId);
    if (!network) {
      console.log(`⚠️ Network ${netId} not found, skipping...`);
      continue;
    }

    console.log(`\n🌐 Network: ${network.name} (Chain ID: ${netId})`);
    console.log("-".repeat(80));

    try {
      const db = new SqliteDatabaseService();
      
      // Manually set the network before connecting
      await db["ethereumService"].switchNetwork(netId);
      await db.connect();

      // Get statistics
      const stats = await getNetworkStats(db, netId, network.name);
      
      // Display statistics
      console.log(`\n📈 Statistics:`);
      console.log(`   Total Transactions: ${stats.totalTransactions}`);
      if (stats.totalTransactions > 0) {
        console.log(`   Date Range: ${stats.dateRange.earliest} → ${stats.dateRange.latest}`);
        console.log(`   Unique Sell Tokens: ${stats.uniqueTokens.sell}`);
        console.log(`   Unique Buy Tokens: ${stats.uniqueTokens.buy}`);
      }

      // Get recent transactions
      if (stats.totalTransactions > 0) {
        console.log(`\n📋 Recent Transactions (latest ${Math.min(limit, stats.totalTransactions)}):`);
        console.log("-".repeat(80));
        
        const transactions = await db.getLatestTransactions(limit);
        
        transactions.forEach((tx, index) => {
          const date = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A';
          const sellToken = tx.sellToken ? `${tx.sellToken.slice(0, 6)}...${tx.sellToken.slice(-4)}` : 'N/A';
          const buyToken = tx.buyToken ? `${tx.buyToken.slice(0, 6)}...${tx.buyToken.slice(-4)}` : 'N/A';
          
          console.log(`\n${index + 1}. Transaction Hash: ${tx.hash}`);
          console.log(`   Date: ${date}`);
          console.log(`   Block: ${tx.blockNumber}`);
          console.log(`   Type: ${tx.kind || 'N/A'}`);
          console.log(`   Sell Token: ${sellToken}`);
          console.log(`   Buy Token: ${buyToken}`);
          console.log(`   Sell Amount: ${tx.sellAmount || 'N/A'}`);
          console.log(`   Buy Amount: ${tx.buyAmount || 'N/A'}`);
          console.log(`   Executed Sell: ${tx.executedSellAmount || 'N/A'}`);
          console.log(`   Executed Buy: ${tx.executedBuyAmount || 'N/A'}`);
        });
      } else {
        console.log(`\n   ℹ️  No transactions found in database`);
      }

      await db.disconnect();
      
    } catch (error) {
      console.error(`❌ Error reading database for ${network.name}:`, error);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Database listing complete\n");
}

async function getNetworkStats(db: SqliteDatabaseService, networkId: string, networkName: string): Promise<DatabaseStats> {
  const totalTransactions = await db.getTransactionsCount({});
  
  let dateRange: { earliest: string | null; latest: string | null } = { earliest: null, latest: null };
  let uniqueTokens = { sell: 0, buy: 0 };

  if (totalTransactions > 0) {
    // Get date range
    const allTransactions = await db.getTransactions({ limit: 10000 });
    
    if (allTransactions.length > 0) {
      const timestamps = allTransactions
        .map(tx => tx.timestamp ? new Date(tx.timestamp).getTime() : 0)
        .filter(t => t > 0)
        .sort((a, b) => a - b);
      
      if (timestamps.length > 0) {
        dateRange = {
          earliest: new Date(timestamps[0]).toLocaleString(),
          latest: new Date(timestamps[timestamps.length - 1]).toLocaleString()
        };
      }

      // Count unique tokens
      const sellTokens = new Set(allTransactions.map(tx => tx.sellToken).filter(Boolean));
      const buyTokens = new Set(allTransactions.map(tx => tx.buyToken).filter(Boolean));
      
      uniqueTokens.sell = sellTokens.size;
      uniqueTokens.buy = buyTokens.size;
    }
  }

  return {
    networkId,
    networkName,
    totalTransactions,
    dateRange,
    uniqueTokens
  };
}

async function searchTransactions(networkId: string, searchTerm: string) {
  const network = getNetworkConfig(networkId);
  if (!network) {
    console.log(`⚠️ Network ${networkId} not found`);
    return;
  }

  console.log(`🔍 Searching in ${network.name} for: ${searchTerm}\n`);
  console.log("=".repeat(80));

  try {
    const db = new SqliteDatabaseService();
    await db["ethereumService"].switchNetwork(networkId);
    await db.connect();

    // Try to find by hash
    if (searchTerm.startsWith('0x') && searchTerm.length === 66) {
      const tx = await db.getTransactionByHash(searchTerm);
      if (tx) {
        console.log(`✅ Found transaction:\n`);
        console.log(JSON.stringify(tx, null, 2));
      } else {
        console.log(`❌ No transaction found with hash: ${searchTerm}`);
      }
    } else {
      console.log(`⚠️ Search term should be a transaction hash (0x...)`);
    }

    await db.disconnect();
  } catch (error) {
    console.error(`❌ Error searching database:`, error);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'search' && args.length >= 3) {
    const networkId = args[1];
    const searchTerm = args[2];
    await searchTransactions(networkId, searchTerm);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else {
    // List command (default)
    const networkId = args.find(arg => !arg.startsWith('--'));
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

    await listDatabaseContents(networkId, limit);
  }
}

function printHelp() {
  console.log(`
📊 SQLite Database Contents Viewer

USAGE:
  npm run db:list [OPTIONS]

COMMANDS:
  (default)                 List all databases
  <networkId>              List specific network database
  search <networkId> <hash> Search for transaction by hash
  help                     Show this help message

OPTIONS:
  --limit=<number>         Number of recent transactions to show (default: 20)

EXAMPLES:
  # List all databases
  npm run db:list

  # List specific network with more results
  npm run db:list 1 --limit=50

  # List Arbitrum database
  npm run db:list 42161

  # Search for specific transaction
  npm run db:list search 1 0xabc...def

AVAILABLE NETWORKS:
  1      - Ethereum Mainnet
  42161  - Arbitrum One
  100    - Gnosis Chain
`);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export { listDatabaseContents, searchTransactions };

