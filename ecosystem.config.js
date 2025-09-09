module.exports = {
  apps: [{
    name: 'cow-x-visualiser-backend',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      // Production Environment Configuration
      NODE_ENV: 'production',
      PORT: 8080,
      API_BASE_URL: 'https://yourdomain.com',
      FRONTEND_URL: 'https://yourdomain.com',
      
      // CORS Settings (Production)
      CORS_ALLOW_ALL_ORIGINS: 'true', // Allow all origins for VM access
      CORS_CREDENTIALS: 'true',
      CORS_ALLOWED_ORIGINS: 'https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000,http://localhost:5001',
      
      // Ethereum Settings (Production)
      RPC_URL: 'https://arb-mainnet.g.alchemy.com/v2/your-key',
      ETHEREUM_RPC_URL:  'https://eth-mainnet.g.alchemy.com/v2/your-key',
      ETHEREUM_CHAIN_ID: 1,
      
      // CoW Protocol Settings
      COW_PROTOCOL_CONTRACT: '0x9008D19f58AAbD9eD0d60971565AA8510560ab41',
      COW_PROTOCOL_API_URL: 'https://api.cow.fi/mainnet',
      
      // MongoDB Settings (from original ecosystem config)
      MONGODB_URI: 'mongodb+srv://xxx:yyy@zzz/?retryWrites=true&w=majority&appName=Cluster0',
      DB_NAME: 'arb-visualiser',
      COLLECTION_NAME: 'transactions',
      
      // API Token
      PAIR_API_TOKEN: 'xxx'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};