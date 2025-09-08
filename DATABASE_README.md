# Database Integration for CoW Swap Visualizer

This document explains the database integration features that have been added to store and retrieve CoW Protocol transactions.

## Features

### 1. MongoDB Integration
- **MongoDB Service**: Full MongoDB integration with proper indexing for efficient queries
- **Fallback**: Automatic fallback to mock database if MongoDB is unavailable
- **Environment Variables**: Uses `.env` file for configuration

### 2. Transaction Storage
- **Persistent Storage**: All transactions are stored in the database
- **Automatic Indexing**: Optimized indexes for timestamp, block number, and hash queries
- **Upsert Operations**: Prevents duplicate transactions

### 3. Smart Data Retrieval
- **UI-First**: Transactions are returned in reverse chronological order (latest first) for optimal UI display
- **Backend Processing**: Separate endpoint to retrieve transactions from last 10 days for backend processing
- **Pagination**: Built-in pagination support with limit/offset

## Environment Variables

Create a `.env` file in the root directory with:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=cow-visualiser
COLLECTION_NAME=transactions
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
```

## API Endpoints

### 1. Get Transactions (UI Display)
```http
GET /api/trades?limit=50&offset=0
```
- Returns transactions in reverse chronological order (latest first)
- Supports pagination with `limit` and `offset` parameters
- Optimized for UI display

### 2. Get Recent Transactions (Backend Processing)
```http
GET /api/trades/recent?days=10
```
- Returns transactions from the last N days
- Used for backend processing and analytics
- Maintains chronological order for data processing

### 3. Get Transaction by Hash
```http
GET /api/trades/:hash
```
- Retrieves specific transaction by its hash
- Returns transaction details from database

### 4. Sync Transactions from Blockchain
```http
POST /api/trades/sync
```
- Fetches latest transactions from Ethereum blockchain
- Stores them in the database
- Use this to populate initial data or sync new transactions

### 5. Database Health Check
```http
GET /api/database/health
```
- Checks database connection status
- Returns database type (MongoDB or Mock)

### 6. General Health Check
```http
GET /health
```
- Overall system health including database status

## Database Schema

### Transactions Collection
```typescript
{
  hash: string,           // Transaction hash (unique)
  from: string,           // Sender address
  to: string,             // Receiver address
  value: string,          // Transaction value
  gasPrice: string,       // Gas price
  gasUsed: string,        // Gas used
  blockNumber: number,    // Block number
  timestamp: Date,        // Transaction timestamp
  // ... other transaction fields
}
```

### Indexes
- `timestamp: -1` - Reverse chronological order (latest first)
- `blockNumber: -1` - Block number descending
- `hash: 1` - Unique hash index
- `from: 1` - Sender address index
- `to: 1` - Receiver address index

## Usage Examples

### 1. Initial Setup
```bash
# Start the server (will automatically connect to MongoDB)
npm run start:backend

# Sync initial data from blockchain
curl -X POST http://localhost:8080/api/trades/sync
```

### 2. Get Latest Transactions for UI
```bash
# Get latest 20 transactions
curl "http://localhost:8080/api/trades?limit=20&offset=0"

# Get next page
curl "http://localhost:8080/api/trades?limit=20&offset=20"
```

### 3. Get Recent Transactions for Processing
```bash
# Get transactions from last 7 days
curl "http://localhost:8080/api/trades/recent?days=7"
```

### 4. Check Database Status
```bash
# Check if MongoDB is connected
curl http://localhost:8080/api/database/health
```

## Data Flow

1. **Initial Sync**: Use `/api/trades/sync` to populate database with blockchain data
2. **UI Display**: Use `/api/trades` to show latest transactions in reverse chronological order
3. **Backend Processing**: Use `/api/trades/recent` to process transactions from specific time periods
4. **Continuous Updates**: Periodically call `/api/trades/sync` to keep data fresh

## Benefits

### For UI
- **Fast Loading**: Database queries are much faster than blockchain calls
- **Latest First**: Transactions automatically sorted newest to oldest
- **Pagination**: Efficient loading of large datasets
- **Offline Support**: Data available even when blockchain is slow

### For Backend
- **Historical Data**: Access to transaction history without blockchain queries
- **Analytics**: Process transactions from specific time periods
- **Performance**: Avoid repeated blockchain calls for the same data
- **Reliability**: Fallback to mock database if MongoDB is unavailable

## Error Handling

- **MongoDB Unavailable**: Automatic fallback to mock database
- **Connection Issues**: Graceful degradation with error logging
- **Data Validation**: Proper error handling for malformed transactions
- **Graceful Shutdown**: Database connections properly closed on server shutdown

## Monitoring

- **Health Checks**: Regular database status monitoring
- **Logging**: Comprehensive logging for debugging
- **Metrics**: Transaction count and sync status tracking
- **Fallback Status**: Clear indication of which database is active




