import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDashboardStats, getOrders } from './services/mongodb';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Dashboard stats endpoint
app.get('/api/dashboard-stats', async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Orders endpoint with pagination and filtering
app.get('/api/orders', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      sortBy = 'timestamp',
      sortOrder = 'desc',
      included
    } = req.query;

    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as 'timestamp' | 'markup' | 'livePrice',
      sortOrder: sortOrder as 'asc' | 'desc',
      included: included ? included === 'true' : undefined
    };

    const result = await getOrders(options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
  console.log(`Database Name: ${process.env.DB_NAME || 'cowswap-orders'}`);
});

export default app;
