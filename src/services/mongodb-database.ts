import { MongoClient, Db, Collection } from 'mongodb';
import { EthereumService } from './ethereum';

export class MongoDBDatabaseService {
  private ethereumService: EthereumService;
  private client: MongoClient;
  private db: Db | null = null;
  private transactionsCollection: Collection | null = null;

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    this.ethereumService = new EthereumService();

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      const dbName = process.env.DB_NAME || 'cow-visualiser';
      this.db = this.client.db(dbName);
      
      const collectionName = process.env.COLLECTION_NAME || 'transactions';
      this.transactionsCollection = this.db.collection(collectionName);

      // Create indexes for efficient querying
      await this.createIndexes();
      
      console.log('🔌 MongoDB connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      console.log('🔌 MongoDB disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.transactionsCollection) return;

    try {
      // Create indexes for efficient querying
      await this.transactionsCollection.createIndex({ timestamp: -1 }); // Reverse chronological order
      await this.transactionsCollection.createIndex({ blockNumber: -1 });
      await this.transactionsCollection.createIndex({ hash: 1 }, { unique: true });
      await this.transactionsCollection.createIndex({ from: 1 });
      await this.transactionsCollection.createIndex({ to: 1 });
      
      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }



  async saveTransaction(transaction: any): Promise<void> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      await this.transactionsCollection.updateOne(
        { hash: transaction.hash },
        { $set: transaction },
        { upsert: true }
      );
      console.log(`💾 Transaction saved to MongoDB: ${transaction.hash}`);
    } catch (error) {
      console.error('❌ Error saving transaction to MongoDB:', error);
      throw error;
    }
  }





  async getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      let filter: any = {};
      
      if (params.fromAddress) {
        filter.from = params.fromAddress;
      }
      
      if (params.toAddress) {
        filter.to = params.toAddress;
      }
      
      if (params.startDate || params.endDate) {
        filter.timestamp = {};
        if (params.startDate) {
          filter.timestamp.$gte = params.startDate;
        }
        if (params.endDate) {
          filter.timestamp.$lte = params.endDate;
        }
      }

      let query = this.transactionsCollection.find(filter).sort({ timestamp: -1 });
      
      if (params.offset) {
        query = query.skip(params.offset);
      }
      
      if (params.limit) {
        query = query.limit(params.limit);
      }

      const transactions = await query.toArray();
      return transactions;
    } catch (error) {
      console.error('❌ Error fetching transactions from MongoDB:', error);
      throw error;
    }
  }

  async getLatestTransactions(limit: number = 50): Promise<any[]> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      const transactions = await this.transactionsCollection
        .find({})
        .sort({ blockNumber: -1 }) // Sort by block number since timestamp might not exist
        .limit(limit)
        .toArray();
      
      // Normalize the data to match the expected Transaction interface
      const normalizedTransactions = transactions.map(tx => {
        // Debug the raw transaction data
        console.log('🔍 Raw transaction from MongoDB:', {
          hash: tx.hash,
          creationDate: tx.creationDate,
          creationDateType: typeof tx.creationDate,
          creationDateInstance: tx.creationDate instanceof Date
        });
        
        // Convert numeric fields to strings and provide defaults
        const normalized = {
          ...tx,
          hash: tx.hash || 'Unknown',
          blockNumber: String(tx.blockNumber || 'Unknown'),
          timestamp: tx.timestamp || this.calculateTimestampFromBlock(tx.blockNumber), // Calculate from block number
          status: tx.status || 'success', // Provide default status
          from: tx.from || 'Unknown',
          to: tx.to || 'Unknown',
          value: tx.value ? String(tx.value) : '0',
          gasPrice: tx.gasPrice ? String(tx.gasPrice) : '0',
          gasUsed: tx.gasUsed ? String(tx.gasUsed) : '0',
          decodedFunction: tx.decodedFunction || 'Unknown',
          functionDescription: tx.functionDescription || 'No description available',
          // Map new database format fields to expected interface
          sellAmount: tx.sellAmount ? String(tx.sellAmount) : '0',
          buyAmount: tx.buyAmount ? String(tx.buyAmount) : '0',
          executedAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          realSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          sellPrice: tx.sellPrice ? String(tx.sellPrice) : '0',
          buyPrice: tx.buyPrice ? String(tx.buyPrice) : '0',
          // Add new fields from the database format
          executedBuyAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          executedSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          executedSellAmountBeforeFees: tx.executedSellAmountBeforeFees ? String(tx.executedSellAmountBeforeFees) : '0',
          kind: tx.kind || 'sell',
          receiver: tx.receiver || 'Unknown',
          // Handle creationDate - ensure it's properly converted to Date object
          creationDate: this.normalizeDate(tx.creationDate)
        };
        
        console.log('🔍 Normalized transaction:', {
          hash: normalized.hash,
          creationDate: normalized.creationDate,
          creationDateType: typeof normalized.creationDate,
          creationDateInstance: normalized.creationDate instanceof Date
        });
        return normalized;
      });
      
      return normalizedTransactions;
    } catch (error) {
      console.error('❌ Error fetching latest transactions from MongoDB:', error);
      throw error;
    }
  }

  async getTransactionsFromLastDays(days: number = 10): Promise<any[]> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const transactions = await this.transactionsCollection
        .find({
          timestamp: { $gte: startDate }
        })
        .sort({ timestamp: -1 })
        .toArray();
      
      // Normalize the data to match the expected Transaction interface
      const normalizedTransactions = transactions.map(tx => {
        const normalized = {
          ...tx,
          hash: tx.hash || 'Unknown',
          blockNumber: String(tx.blockNumber || 'Unknown'),
          timestamp: tx.timestamp || this.calculateTimestampFromBlock(tx.blockNumber),
          status: tx.status || 'success',
          from: tx.from || 'Unknown',
          to: tx.to || 'Unknown',
          value: tx.value ? String(tx.value) : '0',
          gasPrice: tx.gasPrice ? String(tx.gasPrice) : '0',
          gasUsed: tx.gasUsed ? String(tx.gasUsed) : '0',
          decodedFunction: tx.decodedFunction || 'Unknown',
          functionDescription: tx.functionDescription || 'No description available',
          sellAmount: tx.sellAmount ? String(tx.sellAmount) : '0',
          buyAmount: tx.buyAmount ? String(tx.buyAmount) : '0',
          executedAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          realSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          sellPrice: tx.sellPrice ? String(tx.sellPrice) : '0',
          buyPrice: tx.buyPrice ? String(tx.buyPrice) : '0',
          executedBuyAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          executedSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          executedSellAmountBeforeFees: tx.executedSellAmountBeforeFees ? String(tx.executedSellAmountBeforeFees) : '0',
          kind: tx.kind || 'sell',
          receiver: tx.receiver || 'Unknown',
          // Handle creationDate - ensure it's properly converted to Date object
          creationDate: this.normalizeDate(tx.creationDate)
        };
        return normalized;
      });
      
      return normalizedTransactions;
    } catch (error) {
      console.error('❌ Error fetching transactions from last days from MongoDB:', error);
      throw error;
    }
  }

  async getTransactionsWithPagination(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
    sellToken?: string;
    buyToken?: string;
  }): Promise<{
    transactions: any[];
    total: number;
  }> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      let filter: any = {};
      filter.$and = filter.$and || [];

      if (params.fromAddress) {
        filter.$and.push({ from: params.fromAddress });
      }
      
      if (params.toAddress) {
        filter.$and.push({ to: params.toAddress });
      }
      
      if (params.startDate || params.endDate) {
        let blockNumberFilter: any = {};

        if (params.startDate) {
          blockNumberFilter.$gte = await this.ethereumService.getBlockNumberFromDate(params.startDate);
        }
        if (params.endDate) {
          blockNumberFilter.$lte = await this.ethereumService.getBlockNumberFromDate(params.endDate);
        }
      
        filter.$and.push({ blockNumber: blockNumberFilter });
      }

      // Apply token filters
      if (params.sellToken) {
        filter.$and.push({ sellToken: params.sellToken.toLowerCase() });
      }
      
      if (params.buyToken) {
        filter.$and.push({ buyToken: params.buyToken.toLowerCase() });
      }
        
      if (params.fromAddress) {
        filter.$and.push({ from: params.fromAddress });
      }

      if (params.toAddress) {
        filter.$and.push({ to: params.toAddress });
      }

      if(filter.$and.length === 0) {
        filter = {};
      }

      // Get total count
      const total = await this.transactionsCollection.countDocuments(filter);

      // Build query with pagination
      let query = this.transactionsCollection.find(filter).sort({ blockNumber: -1 });
      
      if (params.offset) {
        query = query.skip(params.offset);
      }
      
      if (params.limit) {
        query = query.limit(params.limit);
      }

      const transactions = await query.toArray();

      // Normalize the data to match the expected Transaction interface
      const normalizedTransactions = transactions.map(tx => {
        const normalized = {
          ...tx,
          hash: tx.hash || 'Unknown',
          blockNumber: String(tx.blockNumber || 'Unknown'),
          timestamp: tx.timestamp,
          status: tx.status || 'success',
          from: tx.from || 'Unknown',
          to: tx.to || 'Unknown',
          value: tx.value ? String(tx.value) : '0',
          gasPrice: tx.gasPrice ? String(tx.gasPrice) : '0',
          gasUsed: tx.gasUsed ? String(tx.gasUsed) : '0',
          decodedFunction: tx.decodedFunction || 'Unknown',
          functionDescription: tx.functionDescription || 'No description available',
          sellAmount: tx.sellAmount ? String(tx.sellAmount) : '0',
          buyAmount: tx.buyAmount ? String(tx.buyAmount) : '0',
          executedAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          realSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          sellPrice: tx.sellPrice ? String(tx.sellPrice) : '0',
          buyPrice: tx.buyPrice ? String(tx.buyPrice) : '0',
          executedBuyAmount: tx.executedBuyAmount ? String(tx.executedBuyAmount) : '0',
          executedSellAmount: tx.executedSellAmount ? String(tx.executedSellAmount) : '0',
          executedSellAmountBeforeFees: tx.executedSellAmountBeforeFees ? String(tx.executedSellAmountBeforeFees) : '0',
          kind: tx.kind || 'sell',
          receiver: tx.receiver || 'Unknown',
          // Handle creationDate - ensure it's properly converted to Date object
          creationDate: this.normalizeDate(tx.creationDate)
        };
        return normalized;
      });

      return {
        transactions: normalizedTransactions,
        total
      };
    } catch (error) {
      console.error('❌ Error fetching transactions with pagination from MongoDB:', error);
      throw error;
    }
  }

  async getTransactionByHash(hash: string): Promise<any | null> {
    if (!this.transactionsCollection) {
      throw new Error('Database not connected');
    }

    try {
      const transaction = await this.transactionsCollection.findOne({ hash });
      return transaction;
    } catch (error) {
      console.error('❌ Error fetching transaction by hash from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Calculate approximate timestamp from block number
   * Ethereum blocks are mined approximately every 12 seconds
   */
  private calculateTimestampFromBlock(blockNumber: number | string): string {
    if (!blockNumber || blockNumber === 'Unknown') {
      return new Date().toISOString();
    }
    
    try {
      const blockNum = typeof blockNumber === 'string' ? parseInt(blockNumber) : blockNumber;
      if (isNaN(blockNum)) {
        return new Date().toISOString();
      }
      
      // Get current block number (approximate)
      const currentBlock = 19000000; // Approximate current block
      const blocksDiff = currentBlock - blockNum;
      
      // Each block takes ~12 seconds, so calculate approximate time difference
      const secondsDiff = blocksDiff * 12;
      const timestamp = Math.floor(Date.now() / 1000) - secondsDiff;
      
      return new Date(timestamp * 1000).toISOString();
    } catch (error) {
      console.warn('Failed to calculate timestamp from block number:', error);
      return new Date().toISOString();
    }
  }

  /**
   * Normalize date values from MongoDB to ensure they're proper Date objects
   */
  private normalizeDate(dateValue: any): Date | null {
    if (!dateValue) {
      return null;
    }
    
    // If it's already a Date object, return it
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
    
    // If it's a number (timestamp), convert it
    if (typeof dateValue === 'number') {
      // Check if it's in seconds or milliseconds
      const timestamp = dateValue > 1e10 ? dateValue : dateValue * 1000;
      const parsedDate = new Date(timestamp);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
    
    // If it's a MongoDB Date object (BSON), convert it
    if (dateValue && typeof dateValue === 'object' && dateValue.constructor && dateValue.constructor.name === 'Date') {
      return new Date(dateValue);
    }
    
    return null;
  }
}
