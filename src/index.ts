import express from 'express';
import path from 'path';
import cors from 'cors';
import { config } from 'dotenv';
import fs from 'fs';
import { EthereumService } from './services/ethereum';
import { CowApiService } from './services/cow-api';

// Load environment variables
console.log('🔍 Loading environment variables...');
console.log('🔍 Current working directory:', process.cwd());

// Try multiple possible locations for .env file
const possibleEnvPaths = [
  '.env',
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '.env')
];

let envFileFound = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    console.log('🔍 .env file found at:', envPath);
    const result = config({ path: envPath });
    console.log('🔍 dotenv config result:', result);
    envFileFound = true;
    break;
  }
}

if (!envFileFound) {
  console.log('🔍 No .env file found in any of these locations:', possibleEnvPaths);
}

console.log('🔍 Environment variables after dotenv:');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 RPC_URL:', process.env.RPC_URL);
console.log('🔍 PAIR_API_TOKEN:', process.env.PAIR_API_TOKEN ? 'SET' : 'NOT SET');
console.log('🔍 PAIR_API_TOKEN value:', process.env.PAIR_API_TOKEN || 'NOT SET');

// Load configuration based on environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuration object using environment variables
const configFile = {
  PORT: parseInt(process.env.PORT || '8080'),
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  CORS_ALLOW_ALL_ORIGINS: process.env.CORS_ALLOW_ALL_ORIGINS === 'true',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  PAIR_API_TOKEN: process.env.PAIR_API_TOKEN
};

// Initialize database service
let databaseService: any = null;
let isDatabaseConnected = false;

async function initializeDatabase() {
  try {
    if (process.env.MONGODB_URI) {
      console.log('🔌 Initializing MongoDB database...');
      const { MongoDBDatabaseService } = await import('./services/mongodb-database');
      databaseService = new MongoDBDatabaseService();
      await databaseService.connect();
      isDatabaseConnected = true;
      console.log('✅ MongoDB database connected successfully');
    } else {
      console.log('⚠️ No MONGODB_URI found, using mock database');
      const { MockDatabaseService } = await import('./services/database');
      databaseService = new MockDatabaseService();
      await databaseService.connect();
      isDatabaseConnected = false;
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.log('⚠️ Falling back to mock database');
    const { MockDatabaseService } = await import('./services/database');
    databaseService = new MockDatabaseService();
    await databaseService.connect();
    isDatabaseConnected = false;
  }
}

const app = express();
const PORT = configFile.PORT;

// Utility function to recursively convert BigInt values to strings
function sanitizeForJSON(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJSON);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForJSON(value);
    }
    return sanitized;
  }
  
  return obj;
}

// CORS configuration based on environment
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (configFile.CORS_ALLOW_ALL_ORIGINS) {
      // In development, allow all origins for local development
      callback(null, true);
    } else {
      // In production, specify allowed origins
      const allowedOrigins = configFile.CORS_ALLOWED_ORIGINS;
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: configFile.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    cors: 'enabled',
    database: isDatabaseConnected ? 'MongoDB' : 'Mock',
    config: {
      port: PORT,
      apiBaseUrl: configFile.API_BASE_URL,
      frontendUrl: configFile.FRONTEND_URL
    }
  });
});

// Database health check endpoint
app.get('/api/database/health', async (req, res) => {
  try {
    if (!databaseService) {
      await initializeDatabase();
    }
    
    res.json({
      success: true,
      status: 'connected',
      type: isDatabaseConnected ? 'MongoDB' : 'Mock',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to get trades with pagination
app.get('/api/trades', async (req, res) => {
  try {
    console.log('📡 Fetching CoW Protocol trades...');
    
    // Ensure database is initialized
    if (!databaseService) {
      await initializeDatabase();
    }
    
    // Get query parameters
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get transactions from database with proper pagination
    const result = await databaseService.getTransactionsWithPagination({
      limit,
      offset
    });
    
    console.log(`✅ Retrieved ${result.transactions.length} transactions from database (showing latest first)`);
    console.log(`📊 Total transactions in database: ${result.total}`);
    
    res.json({
      success: true,
      data: sanitizeForJSON(result.transactions),
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(result.total / limit)
      },
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trades'
    });
  }
});

// API endpoint to get recent trades (for backend processing)
app.get('/api/trades/recent', async (req, res) => {
  try {
    console.log('📡 Fetching recent transactions from last 10 days...');
    
    // Ensure database is initialized
    if (!databaseService) {
      await initializeDatabase();
    }
    
    const days = parseInt(req.query.days as string) || 10;
    const transactions = await databaseService.getTransactionsFromLastDays(days);
    
    console.log(`✅ Retrieved ${transactions.length} transactions from last ${days} days`);
    
    res.json({
      success: true,
      data: sanitizeForJSON(transactions),
      days,
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error fetching recent trades:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recent trades'
    });
  }
});

// API endpoint to get trade by hash
app.get('/api/trades/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    console.log(`📡 Fetching trade details for hash: ${hash}`);
    
    // Ensure database is initialized
    if (!databaseService) {
      await initializeDatabase();
    }
    
    // Get transaction details from database
    const transaction = await databaseService.getTransactionByHash(hash);
    
    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found in database'
      });
      return;
    }
    
    res.json({
      success: true,
      data: sanitizeForJSON([transaction]),
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error fetching trade details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trade details'
    });
  }
});

// API endpoint to get real CoW Protocol events
app.get('/api/events', async (req, res) => {
  try {
    console.log('📡 Fetching real CoW Protocol events...');
    
    const ethereumService = new EthereumService();
    const events = await ethereumService.getRecentEvents(10);
    
    console.log(`✅ Fetched ${events.length} real events`);
    
    res.json({
      success: true,
      events: sanitizeForJSON(events)
    });
  } catch (error: any) {
    console.error('❌ Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch events'
    });
  }
});

// New endpoint to sync transactions from blockchain to database
app.post('/api/trades/sync', async (req, res) => {
  try {
    console.log('📡 Syncing transactions from blockchain to database...');
    
    // Ensure database is initialized
    if (!databaseService) {
      await initializeDatabase();
    }
    
    const ethereumService = new EthereumService();
    
    // Get real transactions from the blockchain (last 10 days)
    const transactions = await ethereumService.getLastTransactions(100);
    
    console.log(`📥 Fetched ${transactions.length} transactions from blockchain`);
    
    // Store transactions in database
    let savedCount = 0;
    for (const transaction of transactions) {
      try {
        await databaseService.saveTransaction(transaction);
        savedCount++;
      } catch (error) {
        console.error(`❌ Error saving transaction ${transaction.hash}:`, error);
      }
    }
    
    console.log(`✅ Successfully synced ${savedCount} transactions to database`);
    
    res.json({
      success: true,
      message: `Synced ${savedCount} transactions to database`,
      totalFetched: transactions.length,
      totalSaved: savedCount,
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error syncing trades:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync trades'
    });
  }
});

// New endpoint to fetch token decimals
app.get('/api/token/:address/decimals', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`📡 Fetching decimals for token: ${address}`);
    
    const ethereumService = new EthereumService();
    console.log(`✅ EthereumService imported successfully`);
    
    console.log(`🔍 Calling ethereumService.getTokenDecimals(${address})`);
    const decimals = await ethereumService.getTokenDecimals(address);
    
    console.log(`✅ Token ${address} has ${decimals} decimals`);
    
    res.json({
      success: true,
      decimals: decimals
    });
  } catch (error: any) {
    console.error('❌ Error fetching token decimals:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch token decimals'
    });
  }
});

// New endpoint to fetch token symbol
app.get('/api/token/:address/symbol', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`📡 Fetching symbol for token: ${address}`);
    
    const ethereumService = new EthereumService();
    console.log(`✅ EthereumService imported successfully`);
    
    console.log(`🔍 Calling ethereumService.fetchTokenSymbol(${address})`);
    const symbol = await ethereumService.fetchTokenSymbol(address as `0x${string}`);
    
    console.log(`✅ Token ${address} has symbol: ${symbol}`);
    
    res.json({
      success: true,
      symbol: symbol
    });
  } catch (error: any) {
    console.error('❌ Error fetching token symbol:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch token symbol'
    });
  }
});

// Configuration endpoint to expose API tokens to frontend
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      pairApiToken: configFile.PAIR_API_TOKEN
    }
  });
});

// Serve static files from the dist directory (for production)
if (NODE_ENV === 'production') {
  app.use(express.static('dist/ui'));
}

// Serve the main page (for production)
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/ui', 'index.html'));
  });
}

// Start the server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 CoW Protocol Trade Visualizer server running on:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  console.log(`   - Network: http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔒 CORS: ${configFile.CORS_ALLOW_ALL_ORIGINS ? 'Development mode (all origins allowed)' : 'Production mode (restricted origins)'}`);
  
  // Initialize database
  try {
    await initializeDatabase();
    console.log(`💾 Database: ${isDatabaseConnected ? 'MongoDB connected' : 'Mock database active'}`);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
  
  if (NODE_ENV === 'development') {
    console.log(`📊 Frontend: ${configFile.FRONTEND_URL} (Vite dev server)`);
    console.log(`🔧 Backend API: ${configFile.API_BASE_URL}/api/trades`);
    console.log(`🔗 Real Data: Connected to Ethereum mainnet and CoW Protocol API`);
  } else {
    console.log(`📊 Production build served from: http://localhost:${PORT}`);
  }
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please try a different port.`);
    console.log(`💡 You can set a different port using: PORT=8081 node server.js`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  if (databaseService) {
    try {
      await databaseService.disconnect();
      console.log('✅ Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error);
    }
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  if (databaseService) {
    try {
      await databaseService.disconnect();
      console.log('✅ Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting database:', error);
    }
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Standalone data fetching function (for CLI usage)
async function fetchAndDisplayData() {
  try {
    console.log("📊 CoW Protocol data fetcher initialized");

    // Initialize Ethereum service
    const ethereumService = new EthereumService();

    // Get contract information
    console.log("\n📋 Contract Information:");
    const contractInfo = await ethereumService.getContractInfo();
    console.log(`Contract Address: ${contractInfo.address}`);
    console.log(`Contract Name: ${contractInfo.name}`);
    console.log(`Description: ${contractInfo.description}`);

    // Get last 10 transactions
    console.log("\n🔍 Fetching last 10 transactions...");
    const transactions = await ethereumService.getLastTransactions(10);

    console.log("\n📋 Last 10 Transactions:");
    console.log("=".repeat(120));

    if (transactions.length === 0) {
      console.log("No recent transactions found for the CoW Protocol contract.");
    } else {
      console.log(
        JSON.stringify(
          transactions,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2
        )
      );
    }

    // Get recent events
    console.log("\n📡 Recent Events:");
    const events = await ethereumService.getRecentEvents(5);

    if (events.length > 0) {
      events.forEach((event, index) => {
        console.log(`\n${index + 1}. Event Type: ${event.type}`);
        console.log(`   Block Number: ${event.blockNumber}`);
        console.log(`   Transaction Hash: ${event.transactionHash}`);
        console.log(`   Log Index: ${event.logIndex}`);
        console.log("-".repeat(50));
      });
    } else {
      console.log("No recent events found.");
    }

    console.log("\n✅ Data fetching completed successfully!");
  } catch (error) {
    console.error("❌ Error in data fetching:", error);
    process.exit(1);
  }
}

// Check if running as CLI tool (no server mode)
if (process.argv.includes('--cli') || process.argv.includes('--data-only')) {
  console.log("🚀 Running in CLI mode - fetching data only...");
  fetchAndDisplayData().then(() => {
    process.exit(0);
  });
} else {
  console.log("🚀 Running in server mode...");
}

export default app;