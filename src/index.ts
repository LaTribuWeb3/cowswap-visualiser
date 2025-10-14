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
console.log('🔍 PAIR_API_TOKEN:', process.env.PAIR_API_TOKEN ? 'SET' : 'NOT SET');
if(!process.env.PAIR_API_TOKEN) {
  console.error('❌ PAIR_API_TOKEN is not set');
  process.exit(1);
}

// Load configuration based on environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuration object using environment variables
const configFile = {
  PORT: parseInt(process.env.PORT || '8080'),
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  CORS_ALLOW_ALL_ORIGINS: process.env.CORS_ALLOW_ALL_ORIGINS === 'true' || NODE_ENV === 'development',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true' || NODE_ENV === 'development',
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://localhost:5001', 
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5001',
    'http://localhost:8080'
  ],
  PAIR_API_TOKEN: process.env.PAIR_API_TOKEN,
  // External API endpoints
  TOKENS_METADATA_API_URL: process.env.TOKENS_METADATA_API_URL || 'https://tokens-metadata.la-tribu.xyz',
  PAIR_PRICING_API_URL: process.env.PAIR_PRICING_API_URL || 'https://pair-pricing.la-tribu.xyz',
  BLOCKCHAIN_EXPLORER_URL: process.env.BLOCKCHAIN_EXPLORER_URL || 'https://etherscan.io',
  // Contract addresses
  COW_PROTOCOL_CONTRACT: process.env.COW_PROTOCOL_CONTRACT || '0x9008D19f58AAbD9eD0d60971565AA8510560ab41'
};

// Initialize database service
let databaseService: any = null;
let isDatabaseConnected = false;

// Singleton EthereumService instance - only ONE instance for the entire application
let ethereumServiceInstance: any = null;
let currentNetworkId: string = '1';

function getEthereumService(networkId?: string): any {
  const targetNetworkId = networkId || '1';
  
  // Create instance only once on first call
  if (!ethereumServiceInstance) {
    console.log(`🔧 Creating single EthereumService instance with network ${targetNetworkId}`);
    const { EthereumService } = require('./services/ethereum');
    ethereumServiceInstance = new EthereumService(targetNetworkId);
    currentNetworkId = targetNetworkId;
  } else if (targetNetworkId !== currentNetworkId) {
    // Switch network on the existing single instance
    console.log(`🔄 Switching network from ${currentNetworkId} to ${targetNetworkId} on existing instance`);
    ethereumServiceInstance.switchNetwork(targetNetworkId);
    currentNetworkId = targetNetworkId;
    
    // Also switch database network if connected
    if (databaseService && typeof databaseService.switchNetwork === 'function') {
      console.log(`🔄 Switching database network to ${targetNetworkId}...`);
      databaseService.switchNetwork(targetNetworkId).catch((error: any) => {
        console.error('❌ Error switching database network:', error);
      });
    }
  } else {
    console.log(`✓ Using existing EthereumService instance (already on network ${currentNetworkId})`);
  }
  
  return ethereumServiceInstance;
}

async function initializeDatabase(networkId?: string) {
  try {
    const targetNetworkId = networkId || currentNetworkId || '1';
    
    if (process.env.MONGODB_URI) {
      console.log(`🔌 Initializing MongoDB database for network ${targetNetworkId}...`);
      const { MongoDBDatabaseService } = await import('./services/mongodb-database');
      databaseService = new MongoDBDatabaseService(targetNetworkId);
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
    console.log('🔍 CORS origin:', origin);
    console.log('🔍 CORS_ALLOW_ALL_ORIGINS:', configFile.CORS_ALLOW_ALL_ORIGINS);
    
    if (configFile.CORS_ALLOW_ALL_ORIGINS) {
      // In development, allow all origins for local development
      console.log('🔍 CORS allow all origins');
      callback(null, true);
    } else {
      // In production, specify allowed origins
      const allowedOrigins = configFile.CORS_ALLOWED_ORIGINS;
      console.log('🔍 CORS allowed origins:', allowedOrigins);
      console.log('🔍 CORS origin:', origin);

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('🔍 CORS allowing request with no origin');
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log('🔍 CORS origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('🔍 CORS origin not allowed:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: configFile.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
    
    return res.json({
      success: true,
      status: 'connected',
      type: isDatabaseConnected ? 'MongoDB' : 'Mock',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to get trades with pagination and filtering
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
    const fromAddress = req.query.fromAddress as string;
    const toAddress = req.query.toAddress as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const sellToken = req.query.sellToken as string;
    const buyToken = req.query.buyToken as string;
    
    // Validate date parameters
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
      });
    }
    
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
      });
    }
    
    // Get transactions from database with proper pagination and filtering
    const result = await databaseService.getTransactionsWithPagination({
      limit,
      offset,
      fromAddress,
      toAddress,
      startDate,
      endDate,
      sellToken,
      buyToken
    });
    
    console.log(`✅ Retrieved ${result.transactions.length} transactions from database (showing latest first)`);
    console.log(`📊 Total transactions in database: ${result.total}`);
    
    return res.json({
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
    return res.status(500).json({
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
    
    return res.json({
      success: true,
      data: sanitizeForJSON(transactions),
      days,
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error fetching recent trades:', error);
    return res.status(500).json({
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
    
    return res.json({
      success: true,
      data: sanitizeForJSON([transaction]),
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error fetching trade details:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trade details'
    });
  }
});

// API endpoint to switch network
app.post('/api/network/switch', async (req, res) => {
  try {
    const { networkId } = req.body;
    
    if (!networkId) {
      return res.status(400).json({
        success: false,
        error: 'Network ID is required'
      });
    }
    
    console.log(`🔄 Switching to network ${networkId}...`);
    
    // Get or create service instance and switch network
    const ethereumService = getEthereumService(networkId);
    
    console.log(`✅ Successfully switched to network ${networkId}`);
    
    return res.json({
      success: true,
      networkId: networkId,
      message: `Switched to network ${networkId}`
    });
  } catch (error: any) {
    console.error('❌ Error switching network:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to switch network'
    });
  }
});

// API endpoint to get real CoW Protocol events
app.get('/api/events', async (req, res) => {
  try {
    console.log('📡 Fetching real CoW Protocol events...');
    
    // Get network ID from query parameter or default to 1
    const networkId = (req.query.networkId as string) || '1';
    const ethereumService = getEthereumService(networkId);
    const events = await ethereumService.getRecentEvents(10);
    
    console.log(`✅ Fetched ${events.length} real events`);
    
    return res.json({
      success: true,
      events: sanitizeForJSON(events)
    });
  } catch (error: any) {
    console.error('❌ Error fetching events:', error);
    return res.status(500).json({
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
    
    // Get network ID from query parameter or default to 1
    const networkId = (req.query.networkId as string) || (req.body.networkId as string) || '1';
    const ethereumService = getEthereumService(networkId);
    
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
    
    return res.json({
      success: true,
      message: `Synced ${savedCount} transactions to database`,
      totalFetched: transactions.length,
      totalSaved: savedCount,
      database: isDatabaseConnected ? 'MongoDB' : 'Mock'
    });
  } catch (error: any) {
    console.error('❌ Error syncing trades:', error);
    return res.status(500).json({
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
    
    // Fetch token metadata from la-tribu API
    const response = await fetch(`${configFile.TOKENS_METADATA_API_URL}/tokens/ethereum/${address}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TOKEN_METADATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    const decimals = data.decimals || 18; // Default to 18 if not specified
    
    console.log(`✅ Token ${address} has ${decimals} decimals`);
    
    return res.json({
      success: true,
      decimals: decimals
    });
  } catch (error: any) {
    console.error('❌ Error fetching token decimals:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
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
    
    // Fetch token metadata from la-tribu API
    const response = await fetch(`${configFile.TOKENS_METADATA_API_URL}/tokens/ethereum/${address}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TOKEN_METADATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.symbol) {
      throw new Error('Invalid token metadata response - no symbol found');
    }

    console.log(`✅ Token ${address} has symbol: ${data.symbol}`);
    
    return res.json({
      success: true,
      symbol: data.symbol
    });
  } catch (error: any) {
    console.error('❌ Error fetching token symbol:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch token symbol'
    });
  }
});

// New endpoint to fetch block timestamp
app.get('/api/block-timestamp/:blockNumber', async (req, res) => {
  try {
    const { blockNumber } = req.params;
    const blockNum = parseInt(blockNumber);
    
    if (isNaN(blockNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid block number'
      });
    }
    
    console.log(`📡 Fetching timestamp for block: ${blockNum}`);
    
    // Get network ID from query parameter or default to 1
    const networkId = (req.query.networkId as string) || '1';
    const ethereumService = getEthereumService(networkId);
    const timestamp = await ethereumService.getBlockTimestamp(blockNum);
    
    // Check if we got a valid timestamp
    if (!timestamp || timestamp <= 0) {
      return res.status(404).json({
        success: false,
        error: `Block ${blockNum} not found or invalid`
      });
    }
    
    return res.json({
      success: true,
      data: {
        blockNumber: blockNum,
        timestamp: timestamp
      }
    });
  } catch (error) {
    console.error('❌ Error fetching block timestamp:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch block timestamp'
    });
  }
});

// Configuration endpoint (no longer exposes sensitive tokens)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      pairApiTokenAvailable: !!configFile.PAIR_API_TOKEN
    }
  });
});

// Simple in-memory rate limiting for the proxy endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  clientData.count++;
  return true;
}

// Simple in-memory cache for Binance prices (backend)
const backendPriceCache = new Map<string, { data: any; timestamp: number }>();
const BACKEND_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache duration

// Secure proxy endpoint for Binance price requests
app.get('/api/binance-price', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }
    
    const { inputToken, outputToken, timestamp } = req.query;
    
    // Validate required parameters
    if (!inputToken || !outputToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: inputToken and outputToken are required'
      });
    }
    
    // Validate token format (basic Ethereum address validation)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (addressRegex.test(inputToken as string) || addressRegex.test(outputToken as string)) {
      return res.status(400).json({
        success: false,
        error: 'Expecting token symbols, not addresses'
      });
    }
    
    // Validate timestamp if provided
    if (timestamp) {
      const timestampNum = parseInt(timestamp as string);
      if (isNaN(timestampNum) || timestampNum < 0 || timestampNum > Date.now() / 1000 + 3600) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timestamp format or value'
        });
      }
    }
    
    // Check if API token is available
    if (!configFile.PAIR_API_TOKEN || configFile.PAIR_API_TOKEN === 'your_jwt_token_here') {
      return res.status(503).json({
        success: false,
        error: 'PAIR_API_TOKEN not configured'
      });
    }
    
    // Check backend cache first
    const cacheKey = `${inputToken}/${outputToken}${timestamp ? `@${timestamp}` : ''}`;
    const cachedEntry = backendPriceCache.get(cacheKey);
    
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < BACKEND_CACHE_DURATION)) {
      console.log(`📦 Using backend cached price for ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedEntry.data
      });
    }
    
    // Build the external API URL
    const url = new URL(`${configFile.PAIR_PRICING_API_URL}/api/price/enhanced`);
    url.searchParams.append('inputToken', inputToken as string);
    url.searchParams.append('outputToken', outputToken as string);
    
    if (timestamp) {
      url.searchParams.append('timestamp', timestamp as string);
    }
    
    console.log('🌐 Proxying request to:', url.toString());
    
    // Make the request to the external API with the secure token
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${configFile.PAIR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (errorData.error && errorData.error.includes('Failed to get pair price: Request failed with status code 404')) {
        return res.status(404).json({
          success: false,
          error: 'Pair not found'
        });
      }
      
      return res.status(response.status).json({
        success: false,
        error: `External API error: ${errorData.message || errorData.error || 'Unknown error'}`
      });
    }
    
    const data = await response.json();
    
    // Check if the response indicates a job is being processed
    if (data.status === 'processing' && data.jobId) {
      console.log(`🔄 Job ${data.jobId} is being processed, returning 202 for client polling`);
      
      // Return 202 Accepted for processing requests - let frontend handle polling
      return res.status(202).json({
        success: true,
        status: 'processing',
        jobId: data.jobId,
        message: 'Job is being processed'
      });
    }
    
    // If the response is not a job processing response, return it directly
    // Cache the successful result
    backendPriceCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      data: data
    });
    return;
    
  } catch (error) {
    console.error('Error in Binance price proxy:', error);
    
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'TimeoutError') {
      return res.status(504).json({
        success: false,
        error: 'Request timeout - external API took too long to respond'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
    return;
  }
});

// Static file serving removed - using Cloudflare for frontend deployment

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
    console.log(`📊 Frontend: Deployed via Cloudflare`);
    console.log(`🔧 Backend API: ${configFile.API_BASE_URL}/api/trades`);
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

    // Initialize Ethereum service with default network ID of 1
    const ethereumService = new EthereumService('1');

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