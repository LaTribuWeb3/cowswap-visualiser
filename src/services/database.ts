import { CowOrder, CowBatch } from '../types/cow-protocol';
export { MongoDBDatabaseService } from './mongodb-database';

export interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  saveOrder(order: CowOrder): Promise<void>;
  saveBatch(batch: CowBatch): Promise<void>;
  saveTransaction(transaction: any): Promise<void>;
  getOrder(uid: string): Promise<CowOrder | null>;
  getBatch(id: string): Promise<CowBatch | null>;
  getTransactionByHash(hash: string): Promise<any | null>;
  getOrders(params: {
    limit?: number;
    offset?: number;
    status?: string;
    owner?: string;
  }): Promise<CowOrder[]>;
  getBatches(params: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<CowBatch[]>;
  getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]>;
  getLatestTransactions(limit?: number): Promise<any[]>;
  getTransactionsFromLastDays(days?: number): Promise<any[]>;
  getTransactionsWithPagination(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    transactions: any[];
    total: number;
  }>;
}

export class MockDatabaseService implements DatabaseService {
  private orders: Map<string, CowOrder> = new Map();
  private batches: Map<string, CowBatch> = new Map();
  private transactions: Map<string, any> = new Map();

  async connect(): Promise<void> {
    console.log('🔌 Mock database connected');
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Mock database disconnected');
  }

  async saveOrder(order: CowOrder): Promise<void> {
    this.orders.set(order.uid, order);
    console.log(`💾 Order saved: ${order.uid}`);
  }

  async saveBatch(batch: CowBatch): Promise<void> {
    // Use hash as the key since it's always present
    const key = batch.hash;
    this.batches.set(key, batch);
    console.log(`💾 Batch saved: ${key}`);
  }

  async saveTransaction(transaction: any): Promise<void> {
    this.transactions.set(transaction.hash, transaction);
    console.log(`💾 Transaction saved: ${transaction.hash}`);
  }

  async getOrder(uid: string): Promise<CowOrder | null> {
    return this.orders.get(uid) || null;
  }

  async getBatch(id: string): Promise<CowBatch | null> {
    return this.batches.get(id) || null;
  }

  async getTransactionByHash(hash: string): Promise<any | null> {
    return this.transactions.get(hash) || null;
  }

  async getOrders(params: {
    limit?: number;
    offset?: number;
    status?: string;
    owner?: string;
  }): Promise<CowOrder[]> {
    let orders = Array.from(this.orders.values());

    if (params.status) {
      orders = orders.filter(order => order.status === params.status);
    }

    if (params.owner) {
      orders = orders.filter(order => order.owner === params.owner);
    }

    if (params.offset) {
      orders = orders.slice(params.offset);
    }

    if (params.limit) {
      orders = orders.slice(0, params.limit);
    }

    return orders;
  }

  async getBatches(params: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<CowBatch[]> {
    let batches = Array.from(this.batches.values());

    if (params.status) {
      batches = batches.filter(batch => batch.status === params.status);
    }

    if (params.offset) {
      batches = batches.slice(params.offset);
    }

    if (params.limit) {
      batches = batches.slice(0, params.limit);
    }

    return batches;
  }

  async getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    let transactions = Array.from(this.transactions.values());

    if (params.fromAddress) {
      transactions = transactions.filter(tx => tx.from === params.fromAddress);
    }

    if (params.toAddress) {
      transactions = transactions.filter(tx => tx.to === params.toAddress);
    }

    if (params.startDate || params.endDate) {
      transactions = transactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        if (params.startDate && txDate < params.startDate) return false;
        if (params.endDate && txDate > params.endDate) return false;
        return true;
      });
    }

    // Sort by timestamp in reverse chronological order
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (params.offset) {
      transactions = transactions.slice(params.offset);
    }

    if (params.limit) {
      transactions = transactions.slice(0, params.limit);
    }

    return transactions;
  }

  async getLatestTransactions(limit: number = 50): Promise<any[]> {
    const transactions = Array.from(this.transactions.values());
    return transactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getTransactionsFromLastDays(days: number = 10): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const transactions = Array.from(this.transactions.values());
    return transactions
      .filter(tx => new Date(tx.timestamp) >= startDate)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getTransactionsWithPagination(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    transactions: any[];
    total: number;
  }> {
    let transactions = Array.from(this.transactions.values());

    // Apply filters
    if (params.fromAddress) {
      transactions = transactions.filter(tx => tx.from === params.fromAddress);
    }

    if (params.toAddress) {
      transactions = transactions.filter(tx => tx.to === params.toAddress);
    }

    if (params.startDate || params.endDate) {
      transactions = transactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        if (params.startDate && txDate < params.startDate) return false;
        if (params.endDate && txDate > params.endDate) return false;
        return true;
      });
    }

    // Sort by timestamp in reverse chronological order
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get total count before pagination
    const total = transactions.length;

    // Apply pagination
    if (params.offset) {
      transactions = transactions.slice(params.offset);
    }

    if (params.limit) {
      transactions = transactions.slice(0, params.limit);
    }

    return {
      transactions,
      total
    };
  }
}
