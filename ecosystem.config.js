module.exports = {
  apps: [
    {
      name: "cow-x-visualiser-backend",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        // Production Environment Configuration
        NODE_ENV: "production",
        PORT: 8080,
        API_BASE_URL: "https://yourdomain.com",
        FRONTEND_URL: "https://yourdomain.com",

        // CORS Settings (Production)
        CORS_ALLOW_ALL_ORIGINS: "true", // Allow all origins for VM access
        CORS_CREDENTIALS: "true",
        CORS_ALLOWED_ORIGINS:
          "https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000,http://localhost:5001",

        // Ethereum Settings (Production) - RPC Load Balancer
        RPC_BASE_URL: "https://rpc.example.com",
        RPC_TOKEN: "your-rpc-token",

        // CoW Protocol Settings
        COW_PROTOCOL_CONTRACT: "0x9008D19f58AAbD9eD0d60971565AA8510560ab41",

        // MongoDB Settings (from original ecosystem config)
        MONGODB_URI:
          "mongodb+srv://xxx:yyy@zzz/?retryWrites=true&w=majority&appName=Cluster0",
        NETWORK: "mainnet",

        // API Token
        PAIR_API_TOKEN: "xxx",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
    },
    {
      name: "sync-historical-trades",
      script: "dist/scripts/sync-historical-trades.js",
      args: "--months 4 --method blockchain",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        // Production Environment Configuration
        NODE_ENV: "production",
        PORT: 8080,
        API_BASE_URL: "https://yourdomain.com",
        FRONTEND_URL: "https://yourdomain.com",

        // CORS Settings (Production)
        CORS_ALLOW_ALL_ORIGINS: "true", // Allow all origins for VM access
        CORS_CREDENTIALS: "true",
        CORS_ALLOWED_ORIGINS:
          "https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000,http://localhost:5001",

        // Ethereum Settings (Production) - RPC Load Balancer
        RPC_BASE_URL: "https://rpc.example.com",
        NETWORK_ID: "1",
        RPC_TOKEN: "your-rpc-token",

        // CoW Protocol Settings
        COW_PROTOCOL_CONTRACT: "0x9008D19f58AAbD9eD0d60971565AA8510560ab41",

        // MongoDB Settings (from original ecosystem config)
        MONGODB_URI:
          "mongodb+srv://xxx:yyy@zzz/?retryWrites=true&w=majority&appName=Cluster0",
        NETWORK: "mainnet",

        // API Token
        PAIR_API_TOKEN: "xxx",
      },
      error_file: "./logs/sync-historical-trades-err.log",
      out_file: "./logs/sync-historical-trades-out.log",
      log_file: "./logs/sync-historical-trades-combined.log",
      time: true,
    },
    {
      name: "sync-realtime-settlement",
      script: "dist/scripts/realtime-settlement-sync.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        // Production Environment Configuration
        NODE_ENV: "production",
        PORT: 8080,
        API_BASE_URL: "https://yourdomain.com",
        FRONTEND_URL: "https://yourdomain.com",

        // CORS Settings (Production)
        CORS_ALLOW_ALL_ORIGINS: "true", // Allow all origins for VM access
        CORS_CREDENTIALS: "true",
        CORS_ALLOWED_ORIGINS:
          "https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000,http://localhost:5001",

        // Ethereum Settings (Production) - RPC Load Balancer
        RPC_BASE_URL: "https://rpc.example.com",
        NETWORK_ID: "1",
        RPC_TOKEN: "your-rpc-token",

        // CoW Protocol Settings
        COW_PROTOCOL_CONTRACT: "0x9008D19f58AAbD9eD0d60971565AA8510560ab41",

        // MongoDB Settings (from original ecosystem config)
        MONGODB_URI:
          "mongodb+srv://xxx:yyy@zzz/?retryWrites=true&w=majority&appName=Cluster0",
        NETWORK: "mainnet",

        // API Token
        PAIR_API_TOKEN: "xxx",
      },
      error_file: "./logs/sync-realtime-settlement-err.log",
      out_file: "./logs/sync-realtime-settlement-out.log",
      log_file: "./logs/sync-realtime-settlement-combined.log",
      time: true,
    }
  ],
};
