// Production Environment Configuration
module.exports = {
  NODE_ENV: 'production',
  PORT: process.env.PORT || 8080,
  API_BASE_URL: process.env.API_BASE_URL || 'https://yourdomain.com',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://yourdomain.com',
  
  // CORS Settings (Production)
  CORS_ALLOW_ALL_ORIGINS: false,
  CORS_CREDENTIALS: true,
  CORS_ALLOWED_ORIGINS: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    // Add your production domains here
  ],
  
  // Database Settings (Production)
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME || 'cow_swap_prod',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',
  
  // Ethereum Settings (Production)
  ETHEREUM_RPC_URL: process.env.RPC_URL || process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-key',
  ETHEREUM_CHAIN_ID: process.env.ETHEREUM_CHAIN_ID || 1,
  
  // CoW Protocol Settings
  COW_PROTOCOL_CONTRACT: '0x9008D19f58AAbD9eD0d60971565AA8510560ab41',
  COW_PROTOCOL_API_URL: 'https://api.cow.fi/mainnet'
};

