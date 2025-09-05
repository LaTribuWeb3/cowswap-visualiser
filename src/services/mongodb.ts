import mongoose from 'mongoose';
import { OrderModel, type IOrderDocument } from '../types/OrderModel';



// MongoDB connection configuration
const getMongoConfig = () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.DB_NAME || 'cowswap-orders';

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required. Please check your .env file.');
  }

  return { MONGODB_URI, DB_NAME };
};

let isConnected = false;

export const connectToDatabase = async (): Promise<void> => {
  if (isConnected) {
    return;
  }

  try {
    const { MONGODB_URI, DB_NAME } = getMongoConfig();
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
    });
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('Disconnected from MongoDB');
  }
};

// Dashboard statistics aggregation
export const getDashboardStats = async () => {
  await connectToDatabase();

  const pipeline = [
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalVolume: { $sum: { $toDouble: '$sellAmount' } },
        averageMarkup: { $avg: '$markup' },
        includedOrders: {
          $sum: { $cond: ['$ourOffer.wasIncluded', 1, 0] }
        },
        recentOrders: {
          $sum: {
            $cond: [
              { $gte: ['$timestamp', new Date(Date.now() - 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        }
      }
    }
  ];

  const [stats] = await OrderModel.aggregate(pipeline);
  
  if (!stats) {
    return {
      totalOrders: 0,
      totalVolume: 0,
      averageMarkup: 0,
      inclusionRate: 0,
      recentOrders: 0,
      topTokens: [],
      ordersByHour: []
    };
  }

  // Get top tokens
  const topTokensPipeline = [
    {
      $group: {
        _id: '$sellToken',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 as const } },
    { $limit: 10 },
    {
      $project: {
        token: '$_id',
        count: 1,
        _id: 0
      }
    }
  ];

  const topTokens = await OrderModel.aggregate(topTokensPipeline);

  // Get orders by hour for the last 24 hours
  const ordersByHourPipeline = [
    {
      $match: {
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        hour: '$_id',
        count: 1,
        _id: 0
      }
    }
  ];

  const ordersByHour = await OrderModel.aggregate(ordersByHourPipeline);
  
  // Fill in missing hours with 0 count
  const ordersByHourMap = new Map(ordersByHour.map(item => [item.hour, item.count]));
  const completeOrdersByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: ordersByHourMap.get(i) || 0
  }));

  return {
    totalOrders: stats.totalOrders,
    totalVolume: stats.totalVolume,
    averageMarkup: Math.round(stats.averageMarkup * 10) / 10,
    inclusionRate: Math.round((stats.includedOrders / stats.totalOrders) * 100 * 10) / 10,
    recentOrders: stats.recentOrders,
    topTokens,
    ordersByHour: completeOrdersByHour
  };
};

// Orders pagination and filtering
export const getOrders = async (options: {
  page: number;
  limit: number;
  sortBy: 'timestamp' | 'markup' | 'livePrice';
  sortOrder: 'asc' | 'desc';
  included?: boolean;
}) => {
  await connectToDatabase();

  const { page, limit, sortBy, sortOrder, included } = options;
  const skip = (page - 1) * limit;

  // Build filter
  const filter: any = {};
  if (included !== undefined) {
    filter['ourOffer.wasIncluded'] = included;
  }

  // Build sort
  const sort: any = {};
  if (sortBy === 'timestamp') {
    sort.timestamp = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'markup') {
    sort.markup = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'livePrice') {
    sort.livePrice = sortOrder === 'asc' ? 1 : -1;
  }

  // Get total count for pagination
  const totalCount = await OrderModel.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / limit);

  // Get orders
  const orders = await OrderModel.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    orders: orders as IOrderDocument[],
    totalPages,
    currentPage: page,
    totalCount
  };
};

// Get order by ID
export const getOrderById = async (orderId: string): Promise<IOrderDocument | null> => {
  await connectToDatabase();
  return await OrderModel.findById(orderId).lean();
};

// Get orders by owner
export const getOrdersByOwner = async (owner: string, limit: number = 50) => {
  await connectToDatabase();
  return await OrderModel.find({ owner })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Get orders by token pair
export const getOrdersByTokenPair = async (
  sellToken: string, 
  buyToken: string, 
  limit: number = 50
) => {
  await connectToDatabase();
  return await OrderModel.find({ sellToken, buyToken })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};
