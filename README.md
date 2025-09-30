# CoW Swap Visualizer

A TypeScript project to fetch and store CoW Protocol data for analysis and visualization.

## About CoW Protocol

[CoW Protocol](https://docs.cow.fi/) is a fully permissionless trading protocol that leverages batch auctions as its price finding mechanism. It uses batch auctions to maximize liquidity via Coincidence of Wants (CoWs) in addition to tapping all available on-chain liquidity whenever needed.

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── types/
│   └── cow-protocol.ts   # TypeScript interfaces for CoW Protocol data
├── services/
│   ├── cow-api.ts        # Service for fetching CoW Protocol API data
│   └── database.ts       # Database service interface and mock implementation
└── utils/                # Utility functions (to be implemented)
```

## Features

- 🔄 Fetch orders and batches from CoW Protocol API
- 💾 Store data in database (currently using mock implementation)
- 📊 TypeScript interfaces for type safety
- 🚀 Ready for development and extension
- 📈 Binance price comparison for trade analysis
- 🎯 Real-time price difference calculations

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cow-swap-visualizer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (required):
```bash
# Ethereum RPC Configuration (REQUIRED)
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key

# CoW Protocol API configuration
COW_API_KEY=your_api_key_here

# Binance Price API JWT Token (for price comparison)
PAIR_API_TOKEN=your_jwt_token_here

# Database configuration (for future implementation)
DATABASE_URL=your_database_url
```

## Usage

### Development Mode
```bash
npm run dev
```

### Build and Run
```bash
npm run build
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the built application
- `npm test` - Run tests (to be implemented)

## Data Types

The project includes TypeScript interfaces for:

- **CowOrder**: Individual trading orders
- **CowBatch**: Batch auctions containing multiple orders
- **CowSolution**: Solutions for batch auctions
- **CowTrade**: Executed trades
- **CowToken**: Token information

## API Integration

The `CowApiService` class provides methods to:

- Fetch orders with filtering options
- Fetch batches with pagination
- Retrieve specific orders by UID
- Handle API responses with error handling

## Database Integration

Currently using a mock database service that stores data in memory. The `DatabaseService` interface is designed to be easily replaced with real database implementations (PostgreSQL, MongoDB, etc.).

## Ethereum Integration

The project uses viem to connect to Ethereum mainnet and interact with the CoW Protocol contract. You can configure the RPC endpoint by setting the `RPC_URL` environment variable in your `.env` file.

### RPC Configuration

- **Required**: You must set `RPC_URL` in your `.env` file
- **Providers**: Any Ethereum mainnet RPC endpoint (Alchemy, Infura, etc.)
- **Example**: `RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key`

### Blockchain Explorer Configuration

- **Optional**: Set `BLOCKCHAIN_EXPLORER_URL` in your `.env` file to configure the blockchain explorer links
- **Default**: `https://etherscan.io` (Ethereum mainnet)
- **Examples**:
  - Arbitrum: `BLOCKCHAIN_EXPLORER_URL=https://arbiscan.io`
  - Polygon: `BLOCKCHAIN_EXPLORER_URL=https://polygonscan.com`
  - BSC: `BLOCKCHAIN_EXPLORER_URL=https://bscscan.com`

## Binance Price Comparison

The application now includes Binance price comparison functionality to help analyze trade execution quality:

### Features

- **Real-time Price Data**: Fetches current Binance prices for token pairs
- **Price Difference Calculation**: Shows percentage difference between executed rate and Binance rate
- **Visual Indicators**: Color-coded price differences (green for better, red for worse)
- **Historical Comparison**: Uses trade timestamp for accurate historical price comparison

### Configuration

To enable Binance price comparison:

1. Set the `PAIR_API_TOKEN` environment variable in your `.env` file with your JWT token
2. The JWT token should be obtained from the pair pricing service
3. The application will automatically fetch and display Binance rates alongside CoW Protocol rates

### API Endpoint

The application uses the pair pricing API endpoint:
```
GET https://pair-pricing.la-tribu.xyz/api/price?inputToken=DOLO&outputToken=USDC&timestamp=1756301100
```

### Display

The conversion rates section now shows:
- Clearing Price Ratio (CoW Protocol)
- Executed Rate (Actual trade)
- Binance Rate (Market reference)
- Price Difference (Percentage comparison)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC

## Resources

- [CoW Protocol Documentation](https://docs.cow.fi/)
- [CoW Protocol GitHub](https://github.com/cowprotocol)
- [CoW Swap Frontend](https://swap.cow.fi/)
