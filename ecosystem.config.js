module.exports = {
  apps: [{
    name: 'cow-x-visualiser-backend',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      RPC_URL: 'https://arb-mainnet.g.alchemy.com/v2/xxx',
      MONGODB_URI: 'mongodb+srv://xxx:yyy@zzz/?retryWrites=true&w=majority&appName=Cluster0',
      DB_NAME: 'arb-visualiser',
      COLLECTION_NAME: 'transactions'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};