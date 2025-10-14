// Development Environment Configuration
module.exports = {
  NODE_ENV: 'development',
  PORT: 8080,
  API_BASE_URL: 'http://localhost:8080',
  FRONTEND_URL: 'http://localhost:3000',
  
  // CORS Settings (Development)
  CORS_ALLOW_ALL_ORIGINS: true,
  CORS_CREDENTIALS: true,
  
  // Database Settings (Development)
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_NAME: 'cow_swap_dev',
  DB_USER: 'postgres',
  DB_PASSWORD: 'password',

  NETWORK: process.env.NETWORK || 'mainnet',
  
  // Ethereum Settings (Development) - RPC Load Balancer
  RPC_BASE_URL: process.env.RPC_BASE_URL || 'https://rpc.example.com',
  RPC_TOKEN: process.env.RPC_TOKEN || 'demo',
  ETHEREUM_RPC_URL: `${process.env.RPC_BASE_URL || 'https://rpc.example.com'}/1/${process.env.RPC_TOKEN || 'demo'}`,
  
  // CoW Protocol Settings
  COW_PROTOCOL_CONTRACT: process.env.COW_PROTOCOL_CONTRACT || '0x9008D19f58AAbD9eD0d60971565AA8510560ab41',
  
  // External API Endpoints
  TOKENS_METADATA_API_URL: process.env.TOKENS_METADATA_API_URL || 'https://tokens-metadata.la-tribu.xyz',
  PAIR_PRICING_API_URL: process.env.PAIR_PRICING_API_URL || 'https://pair-pricing.la-tribu.xyz',
  BLOCKCHAIN_EXPLORER_URL: process.env.BLOCKCHAIN_EXPLORER_URL || 'https://etherscan.io',
  
  // Binance Price API Settings
  PAIR_API_TOKEN: process.env.PAIR_API_TOKEN || 'your_jwt_token_here',
  
  // RPC Backoff Configuration
  RPC_BACKOFF_MAX_RETRIES: parseInt(process.env.RPC_BACKOFF_MAX_RETRIES) || 5,
  RPC_BACKOFF_BASE_DELAY: parseInt(process.env.RPC_BACKOFF_BASE_DELAY) || 1000,
  RPC_BACKOFF_MAX_DELAY: parseInt(process.env.RPC_BACKOFF_MAX_DELAY) || 30000,
  RPC_BACKOFF_MULTIPLIER: parseFloat(process.env.RPC_BACKOFF_MULTIPLIER) || 2,
  RPC_TIMEOUT_DELAY: parseInt(process.env.RPC_TIMEOUT_DELAY) || 600000, // 10 minutes
};

