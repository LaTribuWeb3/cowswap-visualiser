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
  
  // Ethereum Settings (Development)
  ETHEREUM_RPC_URL: process.env.RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  ETHEREUM_CHAIN_ID: 1,
  
  // CoW Protocol Settings
  COW_PROTOCOL_CONTRACT: '0x9008D19f58AAbD9eD0d60971565AA8510560ab41',
  COW_PROTOCOL_API_URL: 'https://api.cow.fi/mainnet',
  
  // Binance Price API Settings
  PAIR_API_TOKEN: process.env.PAIR_API_TOKEN || 'your_jwt_token_here'
};

