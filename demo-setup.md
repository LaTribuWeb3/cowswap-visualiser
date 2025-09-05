# CowSwap Orders Dashboard - Setup Guide

## Required Setup

The dashboard requires a MongoDB connection to function. Make sure you have your MongoDB connection details ready.

### 1. Configure Environment

Create a `.env` file in the root directory with your MongoDB connection details:

```env
MONGODB_URI=mongodb://localhost:27017/cowswap-orders
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cowswap-orders
DB_NAME=cowswap-orders
PORT=3001
```

### 2. Start the Application

```bash
# Install dependencies (if not already done)
npm install

# Start both frontend and backend
npm run dev:full
```

This will start:
- Frontend on http://localhost:5173
- Backend API on http://localhost:3001

### 3. View the Dashboard

Open http://localhost:5173 in your browser. You'll see:

**Dashboard Page (`/`)**:
- Key metrics cards (Total Orders, Volume, Average Markup, Inclusion Rate)
- Top trading tokens chart
- Orders by hour chart (last 24 hours)
- Recent activity summary

**Orders Table Page (`/orders`)**:
- Sortable table with all order details
- Filter by inclusion status
- Pagination controls
- Chronological ordering (newest first)

### 4. Error Handling

If MongoDB is not accessible, you'll see clear error messages with:
- Specific connection error details
- Instructions to check your .env configuration
- Visual indicators for connection issues

## Connecting to Your MongoDB

To connect to your actual MongoDB collection:

1. **Create `.env` file**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/cowswap-orders
   DB_NAME=cowswap-orders
   PORT=3001
   ```

2. **Ensure your MongoDB has the `orders` collection** with documents matching the `IOrderDocument` schema.

3. **Restart the application**:
   ```bash
   npm run dev:full
   ```

## Sample Data Structure

Your MongoDB documents should look like this:

```json
{
  "_id": "0x1234567890abcdef...",
  "auctionId": "auction-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "sellToken": "WETH",
  "buyToken": "USDC",
  "sellAmount": "1.5",
  "buyAmount": "3000.0",
  "kind": "sell",
  "owner": "0xabcdef1234567890...",
  "livePrice": 2000.0,
  "markup": 15.5,
  "ourOffer": {
    "sellAmount": "1.5",
    "buyAmount": "3000.0",
    "wasIncluded": true
  },
  "metadata": {
    "gasEstimate": 150000,
    "profitability": 25.5,
    "priceDeviation": 2.1
  }
}
```

## Customization

- **Add new metrics**: Edit `src/services/mongodb.ts` aggregation pipelines
- **Modify table columns**: Update `src/components/OrdersTable.tsx`
- **Change styling**: Modify Tailwind classes in components
- **Add new pages**: Create new components and add routes in `src/App.tsx`
