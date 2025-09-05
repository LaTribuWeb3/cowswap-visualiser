# CowSwap Orders Dashboard

A comprehensive dashboard for visualizing and analyzing CowSwap orders from a MongoDB collection. This application provides:

- **Dashboard Overview**: Key statistics, metrics, and charts about your orders
- **Orders Table**: Detailed chronological view of all orders with filtering and sorting
- **Real-time Data**: Live connection to your MongoDB orders collection

## Features

- 📊 Interactive dashboard with key metrics
- 📋 Sortable and filterable orders table
- 🔍 Search and pagination
- 📈 Visual charts and statistics
- 🎨 Modern UI with Tailwind CSS
- ⚡ Fast performance with React and TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/cowswap-orders
   DB_NAME=cowswap-orders
   PORT=3001
   ```

3. **Start the development servers**:
   ```bash
   # Start both frontend and backend
   npm run dev:full
   
   # Or start them separately:
   npm run dev:server  # Backend only (port 3001)
   npm run dev         # Frontend only (port 5173)
   ```

4. **Open your browser**:
   Navigate to `http://localhost:5173` to view the dashboard.

## Project Structure

```
src/
├── components/          # React components
│   ├── Dashboard.tsx    # Main dashboard with statistics
│   └── OrdersTable.tsx  # Orders table with filtering
├── services/           # Backend services
│   └── mongodb.ts      # MongoDB connection and queries
├── types/              # TypeScript type definitions
│   ├── OrderModel.ts   # Mongoose order schema
│   └── Types.ts        # General type definitions
├── App.tsx             # Main app with routing
├── main.tsx           # React entry point
└── server.ts          # Express server
```

## Configuration

### MongoDB Setup

The application expects a MongoDB collection named `orders` with documents matching the `IOrderDocument` interface. Key fields include:

- `_id`: Order UID (string)
- `timestamp`: Order creation time
- `sellToken`/`buyToken`: Trading pair tokens
- `sellAmount`/`buyAmount`: Order amounts
- `livePrice`: Market price at time of order
- `markup`: Applied markup in basis points
- `ourOffer.wasIncluded`: Whether order was included in solution

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/cowswap-orders` |
| `DB_NAME` | Database name | `cowswap-orders` |
| `PORT` | Backend server port | `3001` |

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/dashboard-stats` - Dashboard statistics
- `GET /api/orders` - Paginated orders with filtering

## Development

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run dev:server` - Start backend server
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

1. **New Dashboard Metrics**: Add aggregation queries in `src/services/mongodb.ts`
2. **New Table Columns**: Update `src/components/OrdersTable.tsx`
3. **New API Endpoints**: Add routes in `src/server.ts`
4. **New Types**: Add to `src/types/Types.ts` or `src/types/OrderModel.ts`
