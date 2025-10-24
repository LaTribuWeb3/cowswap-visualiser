import { Transaction } from '../types/db-types';

export { SqliteDatabaseService } from './sqlite-database';

export interface DatabaseService {
  connect(networkId?: string): Promise<void>;
  disconnect(): Promise<void>;
  saveTransaction(transaction: any): Promise<void>;
  getTransactionByHash(hash: string): Promise<Transaction | null>;
  getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Transaction[]>;
  getLatestTransactions(limit?: number): Promise<Transaction[]>;
  getTransactionsCount(params: {
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  getTransactionsFromLastDays(days?: number): Promise<Transaction[]>;
  getTransactionsWithPagination(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
    sellToken?: string;
    buyToken?: string;
  }): Promise<{
    transactions: Transaction[];
    total: number;
  }>;
  switchNetwork(networkId: string): Promise<void>;
}

export class MockDatabaseService implements DatabaseService {
  private transactions: Map<string, Transaction> = new Map();

  async getTransactionsCount(params: { fromAddress?: string; toAddress?: string; startDate?: Date; endDate?: Date; }): Promise<number> {
    return Promise.resolve(0);
  }

  async connect(networkId?: string): Promise<void> {
    console.log('🔌 Mock database connected');
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Mock database disconnected');
  }


  async saveTransaction(transaction: any): Promise<void> {
    this.transactions.set(transaction.hash, transaction);
    console.log(`💾 Transaction saved: ${transaction.hash}`);
  }


  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    return this.transactions.get(hash) || null;
  }


  async getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Transaction[]> {
    let transactions = Array.from(this.transactions.values());

    if (params.fromAddress) {
      transactions = transactions.filter(tx => tx.from === params.fromAddress);
    }

    if (params.toAddress) {
      transactions = transactions.filter(tx => tx.to === params.toAddress);
    }

    if (params.startDate || params.endDate) {
      transactions = transactions.filter(tx => {
        if (!tx.timestamp) return false;
        const txDate = new Date(tx.timestamp);
        if (params.startDate && txDate < params.startDate) return false;
        if (params.endDate && txDate > params.endDate) return false;
        return true;
      });
    }

    // Sort by timestamp in reverse chronological order
    transactions.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    if (params.offset) {
      transactions = transactions.slice(params.offset);
    }

    if (params.limit) {
      transactions = transactions.slice(0, params.limit);
    }

    return transactions;
  }

  async getLatestTransactions(limit: number = 50): Promise<Transaction[]> {
    const transactions = Array.from(this.transactions.values());
    return transactions
      .sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, limit);
  }

  async getTransactionsFromLastDays(days: number = 10): Promise<Transaction[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const transactions = Array.from(this.transactions.values());
    return transactions
      .filter(tx => tx.timestamp && new Date(tx.timestamp) >= startDate)
      .sort((a, b) => {
        const blockA = parseInt(String(a.blockNumber || '0'));
        const blockB = parseInt(String(b.blockNumber || '0'));
        return blockB - blockA;
      });
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
    transactions: Transaction[];
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
        if (!tx.timestamp) return false;
        const txDate = new Date(tx.timestamp);
        if (params.startDate && txDate < params.startDate) return false;
        if (params.endDate && txDate > params.endDate) return false;
        return true;
      });
    }

    // Apply token filters
    if (params.sellToken) {
      transactions = transactions.filter(tx => 
        tx.sellToken === params.sellToken || 
        (tx.parsedData?.trades?.[0]?.sellToken === params.sellToken)
      );
    }

    if (params.buyToken) {
      transactions = transactions.filter(tx => 
        tx.buyToken === params.buyToken || 
        (tx.parsedData?.trades?.[0]?.buyToken === params.buyToken)
      );
    }

    // Sort by timestamp in reverse chronological order
    transactions.sort((a, b) => {
      const blockA = parseInt(String(a.blockNumber || '0'));
      const blockB = parseInt(String(b.blockNumber || '0'));
      return blockB - blockA;
    });

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

  async switchNetwork(networkId: string): Promise<void> {
    console.log(`🔄 Switching to network: ${networkId}`);
  }
}
