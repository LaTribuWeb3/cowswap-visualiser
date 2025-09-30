# Historical Trades Sync for CoW Protocol Visualizer

This standalone program ensures your database contains CoW Protocol trades for the past 4 months (or any specified period). It automatically fetches missing historical data and stores it in your MongoDB database.

> **Note**: This project is designed for Unix-based systems (Linux, macOS, WSL). Windows users should use WSL (Windows Subsystem for Linux) or a Linux virtual machine.

## 🚀 Quick Start

### Prerequisites
- **Operating System**: Linux, macOS, or WSL (Windows Subsystem for Linux)
- **Node.js**: v16 or higher
- **Shell**: Bash or compatible shell
- **Permissions**: Execute permissions for shell scripts
- **TypeScript Execution**: `ts-node` (optional, for direct TypeScript execution)

### 1. Build the Project
```bash
npm run build
```

### 2. Run Historical Sync
```bash
# Default: Sync past 4 months using auto-selection
npm run sync:historical

# Or use specific methods:
npm run sync:historical:api        # Use CoW API only
npm run sync:historical:blockchain # Use blockchain scanning only
npm run sync:historical:auto       # Try API first, fallback to blockchain

# TypeScript Direct Execution (requires ts-node)
npm run sync:historical:ts         # Run TypeScript directly
npm run sync:historical:ts:api     # Run TypeScript with API method
npm run sync:historical:ts:blockchain # Run TypeScript with blockchain method
npm run sync:historical:ts:auto    # Run TypeScript with auto method
```

### 3. Unix/Linux/Mac Users
```bash
chmod +x sync-historical-trades.sh
./sync-historical-trades.sh
```

### 4. TypeScript Direct Execution
```bash
# Install ts-node globally (optional)
npm install -g ts-node

# Run TypeScript scripts directly
npm run sync:historical:ts
npm run sync:historical:ts:api
npm run sync:historical:ts:blockchain
npm run sync:historical:ts:auto
```

## 📋 Command Line Options

```bash
npm run sync:historical -- [OPTIONS]

OPTIONS:
  -m, --months <number>    Number of months to sync (default: 4)
  -t, --method <method>    Sync method: blockchain, api, or auto (default: auto)
  -f, --force             Force sync even if data exists
  -h, --help              Show help message

EXAMPLES:
  # Sync past 6 months using CoW API
  npm run sync:historical -- --months 6 --method api

  # Sync past 3 months using blockchain scanning
  npm run sync:historical -- --months 3 --method blockchain

  # Force sync past 2 months
  npm run sync:historical -- --months 2 --force
```

## 🔧 Sync Methods

### 1. CoW Protocol API (Recommended)
- **Speed**: Fastest method
- **Reliability**: High
- **Data**: Orders and batches
- **Requirements**: Internet connection
- **Use case**: When you need comprehensive order data quickly

### 2. Blockchain Scanning
- **Speed**: Slower but comprehensive
- **Reliability**: High (works offline)
- **Data**: All CoW Protocol transactions
- **Requirements**: Ethereum RPC endpoint
- **Use case**: When you need complete transaction data or API is unavailable

### 3. Auto Selection (Default)
- **Behavior**: Tries API first, falls back to blockchain
- **Best of both**: Combines speed and reliability
- **Use case**: Recommended for most users

## 🗄️ Database Requirements

### MongoDB Setup
Ensure your `.env` file contains:
```env
MONGODB_URI=mongodb://your-connection-string
DB_NAME=cow-visualiser
COLLECTION_NAME=transactions
```

### Collections Created
- `transactions` - CoW Protocol transactions
- `orders` - CoW Protocol orders
- `batches` - CoW Protocol batches

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | Required |
| `DB_NAME` | Database name | `cow-visualiser` |
| `COLLECTION_NAME` | Collection name | `transactions` |
| `RPC_URL` | Ethereum RPC URL (for blockchain method) | Required for blockchain scanning |

## 📊 What Gets Synced

### Orders
- Order UID, owner, sender
- Token addresses and amounts
- Valid from/to timestamps
- Status and metadata

### Batches
- Batch ID and timestamp
- Orders included
- Settlement data
- Gas usage and fees

### Transactions
- Transaction hash and block number
- Decoded function calls
- Token transfers and interactions
- Gas usage and pricing

## 🔍 Progress Monitoring

The sync process provides real-time progress updates:

```
📊 Progress: 45.23% (45,230/100,000 blocks)
💾 Transactions: 1,234 saved, 5 errors
⏱️  Estimated time remaining: 2h 15m 30s
```

## ⚠️ Important Notes

### Rate Limiting
- **CoW API**: 100ms delay between requests
- **Blockchain**: 100ms delay between block batches
- **Error handling**: Automatic retry with exponential backoff

### Data Deduplication
- Uses upsert operations to prevent duplicates
- Transaction hash is the unique identifier
- Safe to run multiple times

### Memory Usage
- Processes data in batches to manage memory
- Automatically cleans up resources
- Suitable for long-running syncs

## 🚨 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed
```bash
❌ Failed to connect to MongoDB: connection refused
```
**Solution**: Check your `MONGODB_URI` and ensure MongoDB is running.

#### 2. RPC Rate Limited
```bash
❌ Error fetching block: rate limit exceeded
```
**Solution**: Use a different RPC endpoint or wait before retrying.

#### 3. Insufficient Disk Space
```bash
❌ Error saving transaction: disk space full
```
**Solution**: Free up disk space or use a larger storage volume.

### Error Recovery
The sync process is designed to be resilient:
- **Automatic retries** for transient failures
- **Graceful degradation** to alternative methods
- **Progress preservation** across restarts
- **Detailed error logging** for debugging

## 📈 Performance Tips

### For Large Syncs (>6 months)
1. **Use CoW API method** when possible
2. **Run during off-peak hours**
3. **Ensure stable internet connection**
4. **Monitor system resources**

### For Regular Updates
1. **Run daily** to keep data fresh
2. **Use auto method** for best results
3. **Monitor error rates**
4. **Set up automated scheduling**

## 🔄 Automation

### Cron Job (Linux/macOS)
```bash
# Add to crontab -e
0 2 * * * cd /path/to/project && npm run sync:historical
```

### Systemd Timer (Linux)
```bash
# Create a systemd service file
sudo nano /etc/systemd/system/cow-sync.service

[Unit]
Description=CoW Protocol Historical Sync
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/npm run sync:historical
Environment=NODE_ENV=production

# Create a timer file
sudo nano /etc/systemd/system/cow-sync.timer

[Unit]
Description=Run CoW Protocol sync daily at 2 AM
Requires=cow-sync.service

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target

# Enable and start the timer
sudo systemctl enable cow-sync.timer
sudo systemctl start cow-sync.timer
```

### GitHub Actions
```yaml
name: Daily Historical Sync
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run sync:historical
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          RPC_URL: ${{ secrets.RPC_URL }}
```

## 📚 API Reference

### HistoricalTradesSyncManager
Main class for managing historical sync operations.

```typescript
const manager = new HistoricalTradesSyncManager({
  monthsBack: 4,
  method: 'auto',
  force: false
});

await manager.run();
```

### HistoricalTradesSync
Blockchain-based sync implementation.

```typescript
const sync = new HistoricalTradesSync();
await sync.initialize();
await sync.syncHistoricalTrades(4);
await sync.cleanup();
```

### CowApiHistoricalSync
API-based sync implementation.

```typescript
const sync = new CowApiHistoricalSync();
await sync.initialize();
await sync.syncHistoricalData(4);
await sync.cleanup();
```

## 🤝 Contributing

To contribute to the historical sync functionality:

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests if applicable**
5. **Submit a pull request**

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter issues:

1. **Check the troubleshooting section**
2. **Review error logs**
3. **Verify environment variables**
4. **Open an issue** with detailed information

---

**Happy Syncing! 🚀**
