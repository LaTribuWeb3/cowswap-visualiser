import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { EthereumService } from './ethereum';
import { getDatabaseName } from '../config/networks';
import { DatabaseService } from './database';
import { Transaction } from '../types/db-types';
import * as fs from 'fs';
import * as path from 'path';

export class SqliteDatabaseService implements DatabaseService {
  private ethereumService: EthereumService;
  private db: SqlJsDatabase | null = null;
  private currentDatabasePath: string | null = null;
  private dataDirectory: string;
  private SQL: any = null;

  constructor() {
    this.ethereumService = new EthereumService();
    
    // Set up data directory for SQLite databases
    this.dataDirectory = process.env.SQLITE_DATA_DIR || path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDirectory)) {
      fs.mkdirSync(this.dataDirectory, { recursive: true });
      console.log(`📁 Created data directory: ${this.dataDirectory}`);
    }
  }

  async connect(networkId?: string): Promise<void> {
    try {
      // Initialize sql.js
      this.SQL = await initSqlJs();
      
      // Use provided networkId or get from ethereum service
      const targetNetworkId = networkId || await this.ethereumService.getNetworkId();
      const dbName = getDatabaseName(String(targetNetworkId));
      const dbPath = path.join(this.dataDirectory, `${dbName}.db`);
      
      this.currentDatabasePath = dbPath;
      
      // Load existing database or create new one
      if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        this.db = new this.SQL.Database(buffer);
        console.log(`📂 Loaded existing database: ${dbName}`);
      } else {
        this.db = new this.SQL.Database();
        console.log(`📂 Created new database: ${dbName}`);
      }
      
      await this.createTables();
      await this.createIndexes();
      
      console.log(`🔌 SQLite connected successfully to database: ${dbName}`);
      console.log(`📁 Database file: ${dbPath}`);
    } catch (error) {
      console.error('❌ Failed to connect to SQLite:', error);
      throw error;
    }
  }

  getCurrentDatabaseName(): string {
    if (!this.currentDatabasePath) return 'unknown';
    const dbName = path.basename(this.currentDatabasePath, '.db');
    console.log(`🔍 [DB] getCurrentDatabaseName() called - path: ${this.currentDatabasePath}, name: ${dbName}`);
    return dbName;
  }

  async getCurrentNetworkId(): Promise<number> {
    return await this.ethereumService.getNetworkId();
  }

  async switchNetwork(networkId: string): Promise<void> {
    try {
      const currentNetworkId = await this.ethereumService.getNetworkId();
      console.log(`🔄 [DB] Switching database from network ${currentNetworkId} to ${networkId}...`);
      
      // Save and close current database
      if (this.db && this.currentDatabasePath) {
        this.saveDatabase();
        this.db.close();
        this.db = null;
        this.currentDatabasePath = null;
        console.log(`🔌 [DB] Closed current database connection and reset path`);
      }
      
      await this.ethereumService.switchNetwork(networkId);
      console.log(`🔄 [DB] Ethereum service switched to network ${networkId}`);
      
      const dbName = getDatabaseName(networkId);
      const dbPath = path.join(this.dataDirectory, `${dbName}.db`);
      console.log(`📂 [DB] Switching to database: ${dbName}`);
      console.log(`📂 [DB] Database path: ${dbPath}`);
      console.log(`📂 [DB] Database exists: ${fs.existsSync(dbPath)}`);
      console.log(`📂 [DB] Data directory: ${this.dataDirectory}`);
      
      // Verify the database name is correct for the network
      if (networkId === '1' && !dbName.includes('mainnet')) {
        console.error(`❌ [DB] CRITICAL: Network 1 should use mainnet database, but got: ${dbName}`);
      } else if (networkId === '42161' && !dbName.includes('arbitrum')) {
        console.error(`❌ [DB] CRITICAL: Network 42161 should use arbitrum database, but got: ${dbName}`);
      }
      
      this.currentDatabasePath = dbPath;
      
      // Load or create database for the new network
      if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        this.db = new this.SQL.Database(buffer);
        console.log(`📂 Loaded existing database: ${dbName}`);
      } else {
        this.db = new this.SQL.Database();
        console.log(`📂 Created new database: ${dbName}`);
      }
      
      console.log(`📊 [DB] Connected to database: ${dbName}`);
      
      await this.createTables();
      await this.createIndexes();
      console.log(`✅ [DB] Successfully switched to database: ${dbName} for network ${networkId}`);
      
      // Debug: Check what data is in the database
      try {
        if (this.db) {
          const countResult = this.db.prepare('SELECT COUNT(*) as count FROM transactions').get() as unknown as { count: number };
          console.log(`📊 [DB] Database ${dbName} contains ${countResult.count} transactions`);
          
        if (countResult.count > 0) {
          const sampleResult = this.db.prepare('SELECT hash, blockNumber FROM transactions ORDER BY blockNumber DESC LIMIT 1').get();
          console.log(`🔍 [DB] Sample transaction from ${dbName}:`, sampleResult);
          
          // Verify the block number is appropriate for the network
          if (sampleResult && (sampleResult as any).blockNumber) {
            const blockNum = parseInt((sampleResult as any).blockNumber);
            if (networkId === '1' && blockNum > 20000000) {
              console.error(`❌ [DB] CRITICAL: Ethereum database contains Arbitrum-like block number: ${blockNum}`);
            } else if (networkId === '42161' && blockNum < 100000000) {
              console.error(`❌ [DB] CRITICAL: Arbitrum database contains Ethereum-like block number: ${blockNum}`);
            }
          }
        }
        }
      } catch (error) {
        console.log(`⚠️ [DB] Could not query database ${dbName}:`, error);
      }
    } catch (error) {
      console.error('❌ [DB] Error switching network database:', error);
      throw error;
    }
  }

  private saveDatabase(): void {
    if (!this.db || !this.currentDatabasePath) return;
    
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.currentDatabasePath, buffer);
    } catch (error) {
      console.error('❌ Error saving database:', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        this.saveDatabase();
        this.db.close();
        this.db = null;
        console.log('🔌 SQLite disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from SQLite:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    try {
      // Create transactions table with all necessary fields
      this.db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT NOT NULL UNIQUE,
          blockNumber INTEGER NOT NULL,
          timestamp TEXT,
          fromAddress TEXT,
          toAddress TEXT,
          sellToken TEXT,
          buyToken TEXT,
          sellAmount TEXT,
          buyAmount TEXT,
          executedBuyAmount TEXT,
          executedSellAmount TEXT,
          executedSellAmountBeforeFees TEXT,
          kind TEXT,
          receiver TEXT,
          parsedData TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create token metadata cache table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS token_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL,
          network_id TEXT NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          decimals INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(address, network_id)
        )
      `);

      // Create block timestamp cache table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS block_timestamps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          block_number INTEGER NOT NULL,
          network_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          cached_at INTEGER NOT NULL,
          UNIQUE(block_number, network_id)
        )
      `);
      
      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Create indexes for better query performance
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_blockNumber ON transactions(blockNumber DESC)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_fromAddress ON transactions(fromAddress)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_toAddress ON transactions(toAddress)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_sellToken ON transactions(sellToken)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_buyToken ON transactions(buyToken)');
      
      // Create indexes for token metadata cache
      this.db.run('CREATE INDEX IF NOT EXISTS idx_token_metadata_address ON token_metadata(address)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_token_metadata_network ON token_metadata(network_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_token_metadata_timestamp ON token_metadata(timestamp)');
      
      // Create indexes for block timestamp cache
      this.db.run('CREATE INDEX IF NOT EXISTS idx_block_timestamps_block_number ON block_timestamps(block_number)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_block_timestamps_network ON block_timestamps(network_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_block_timestamps_cached_at ON block_timestamps(cached_at)');
      
      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }

  async saveTransaction(transaction: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const sanitizedTransaction = this.sanitizeTransactionAmounts(transaction);
      
      // Prepare the insert/update statement
      const stmt = this.db.prepare(`
        INSERT INTO transactions (
          hash, blockNumber, timestamp, fromAddress, toAddress,
          sellToken, buyToken, sellAmount, buyAmount,
          executedBuyAmount, executedSellAmount, executedSellAmountBeforeFees,
          kind, receiver, parsedData, updatedAt
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, datetime('now')
        )
        ON CONFLICT(hash) DO UPDATE SET
          blockNumber = excluded.blockNumber,
          timestamp = excluded.timestamp,
          fromAddress = excluded.fromAddress,
          toAddress = excluded.toAddress,
          sellToken = excluded.sellToken,
          buyToken = excluded.buyToken,
          sellAmount = excluded.sellAmount,
          buyAmount = excluded.buyAmount,
          executedBuyAmount = excluded.executedBuyAmount,
          executedSellAmount = excluded.executedSellAmount,
          executedSellAmountBeforeFees = excluded.executedSellAmountBeforeFees,
          kind = excluded.kind,
          receiver = excluded.receiver,
          parsedData = excluded.parsedData,
          updatedAt = datetime('now')
      `);

      // Convert dates to ISO strings
      let timestamp = new Date().toISOString();
      if (sanitizedTransaction.timestamp) {
        timestamp = sanitizedTransaction.timestamp instanceof Date 
          ? sanitizedTransaction.timestamp.toISOString() 
          : sanitizedTransaction.timestamp;
      } else if (sanitizedTransaction.creationDate) {
        timestamp = sanitizedTransaction.creationDate instanceof Date
          ? sanitizedTransaction.creationDate.toISOString()
          : sanitizedTransaction.creationDate;
      }

      stmt.run([
        sanitizedTransaction.hash,
        sanitizedTransaction.blockNumber || 0,
        timestamp,
        sanitizedTransaction.from || sanitizedTransaction.fromAddress || null,
        sanitizedTransaction.to || sanitizedTransaction.toAddress || null,
        sanitizedTransaction.sellToken || null,
        sanitizedTransaction.buyToken || null,
        sanitizedTransaction.sellAmount || null,
        sanitizedTransaction.buyAmount || null,
        sanitizedTransaction.executedBuyAmount || null,
        sanitizedTransaction.executedSellAmount || null,
        sanitizedTransaction.executedSellAmountBeforeFees || null,
        sanitizedTransaction.kind || null,
        sanitizedTransaction.receiver || null,
        sanitizedTransaction.parsedData ? JSON.stringify(sanitizedTransaction.parsedData) : null,
      ]);
      
      stmt.free();
      
      // Save database to disk after each write
      this.saveDatabase();

      // Transaction saved silently - progress is shown in progress bar
    } catch (error) {
      console.error('❌ Error saving transaction to SQLite:', error);
      throw error;
    }
  }

  private sanitizeTransactionAmounts(transaction: any): any {
    const amountFields = [
      'sellAmount',
      'buyAmount',
      'executedBuyAmount',
      'executedSellAmount',
      'executedSellAmountBeforeFees',
      'executedAmount',
      'realSellAmount'
    ];

    const sanitized = { ...transaction };

    for (const field of amountFields) {
      if (sanitized[field] !== undefined && sanitized[field] !== null) {
        const originalValue = sanitized[field];
        const stringValue = String(originalValue);

        if (stringValue.includes('e') || stringValue.includes('E')) {
          console.warn(`⚠️ Preventing scientific notation storage for ${field}: ${stringValue}`);
          try {
            const num = parseFloat(stringValue);
            const bigIntStr = BigInt(Math.floor(num)).toString();
            sanitized[field] = bigIntStr;
            console.log(`✅ Sanitized ${field}: ${stringValue} → ${bigIntStr}`);
          } catch (error) {
            console.error(`❌ Failed to sanitize ${field}: ${stringValue}`, error);
            sanitized[field] = '0';
          }
        } else if (typeof originalValue !== 'string') {
          sanitized[field] = stringValue;
        }
      }
    }

    return sanitized;
  }

  async getTransactions(params: {
    limit?: number;
    offset?: number;
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Transaction[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      let query = 'SELECT * FROM transactions WHERE 1=1';
      const queryParams: any[] = [];

      if (params.fromAddress) {
        query += ' AND fromAddress = ?';
        queryParams.push(params.fromAddress);
      }

      if (params.toAddress) {
        query += ' AND toAddress = ?';
        queryParams.push(params.toAddress);
      }

      if (params.startDate) {
        query += ' AND timestamp >= ?';
        queryParams.push(params.startDate.toISOString());
      }

      if (params.endDate) {
        query += ' AND timestamp <= ?';
        queryParams.push(params.endDate.toISOString());
      }

      query += ' ORDER BY timestamp DESC';

      if (params.limit) {
        query += ' LIMIT ?';
        queryParams.push(params.limit);
      }

      if (params.offset) {
        query += ' OFFSET ?';
        queryParams.push(params.offset);
      }

      const stmt = this.db.prepare(query);
      stmt.bind(queryParams);
      
      const rows: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      
      return rows.map(row => this.rowToTransaction(row));
    } catch (error) {
      console.error('❌ Error fetching transactions from SQLite:', error);
      throw error;
    }
  }

  async getLatestTransactions(limit: number = 50): Promise<Transaction[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transactions
        ORDER BY blockNumber DESC
        LIMIT ?
      `);
      
      stmt.bind([limit]);
      
      const rows: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      
      return rows.map(row => this.rowToTransaction(row));
    } catch (error) {
      console.error('❌ Error fetching latest transactions from SQLite:', error);
      throw error;
    }
  }

  async getTransactionsCount(params: {
    fromAddress?: string;
    toAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      let query = 'SELECT COUNT(*) as count FROM transactions WHERE 1=1';
      const queryParams: any[] = [];

      if (params.fromAddress) {
        query += ' AND fromAddress = ?';
        queryParams.push(params.fromAddress);
      }

      if (params.toAddress) {
        query += ' AND toAddress = ?';
        queryParams.push(params.toAddress);
      }

      if (params.startDate) {
        query += ' AND timestamp >= ?';
        queryParams.push(params.startDate.toISOString());
      }

      if (params.endDate) {
        query += ' AND timestamp <= ?';
        queryParams.push(params.endDate.toISOString());
      }

      const stmt = this.db.prepare(query);
      stmt.bind(queryParams);
      
      let count = 0;
      if (stmt.step()) {
        const row = stmt.getAsObject();
        count = row.count as number;
      }
      stmt.free();
      
      return count;
    } catch (error) {
      console.error('❌ Error counting transactions from SQLite:', error);
      throw error;
    }
  }

  async getTransactionsFromLastDays(days: number = 10): Promise<Transaction[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.getTransactions({
      startDate,
      limit: 1000
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
  }): Promise<{ transactions: Transaction[]; total: number }> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      let query = 'SELECT * FROM transactions WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as count FROM transactions WHERE 1=1';
      const queryParams: any[] = [];
      const countParams: any[] = [];

      if (params.fromAddress) {
        query += ' AND fromAddress = ?';
        countQuery += ' AND fromAddress = ?';
        queryParams.push(params.fromAddress);
        countParams.push(params.fromAddress);
      }

      if (params.toAddress) {
        query += ' AND toAddress = ?';
        countQuery += ' AND toAddress = ?';
        queryParams.push(params.toAddress);
        countParams.push(params.toAddress);
      }

      if (params.startDate) {
        query += ' AND timestamp >= ?';
        countQuery += ' AND timestamp >= ?';
        const isoDate = params.startDate.toISOString();
        queryParams.push(isoDate);
        countParams.push(isoDate);
      }

      if (params.endDate) {
        query += ' AND timestamp <= ?';
        countQuery += ' AND timestamp <= ?';
        const isoDate = params.endDate.toISOString();
        queryParams.push(isoDate);
        countParams.push(isoDate);
      }

      if (params.sellToken) {
        query += ' AND sellToken = ?';
        countQuery += ' AND sellToken = ?';
        queryParams.push(params.sellToken);
        countParams.push(params.sellToken);
      }

      if (params.buyToken) {
        query += ' AND buyToken = ?';
        countQuery += ' AND buyToken = ?';
        queryParams.push(params.buyToken);
        countParams.push(params.buyToken);
      }

      // Get total count
      const countStmt = this.db.prepare(countQuery);
      countStmt.bind(countParams);
      let total = 0;
      if (countStmt.step()) {
        const row = countStmt.getAsObject();
        total = row.count as number;
      }
      countStmt.free();

      // Get paginated results
      query += ' ORDER BY timestamp DESC';

      if (params.limit) {
        query += ' LIMIT ?';
        queryParams.push(params.limit);
      }

      if (params.offset) {
        query += ' OFFSET ?';
        queryParams.push(params.offset);
      }

      const stmt = this.db.prepare(query);
      stmt.bind(queryParams);
      
      const rows: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      
      const transactions = rows.map(row => this.rowToTransaction(row));

      return {
        transactions,
        total
      };
    } catch (error) {
      console.error('❌ Error fetching transactions with pagination from SQLite:', error);
      throw error;
    }
  }

  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM transactions WHERE hash = ?');
      stmt.bind([hash]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return this.rowToTransaction(row);
      }
      
      stmt.free();
      return null;
    } catch (error) {
      console.error('❌ Error fetching transaction by hash from SQLite:', error);
      throw error;
    }
  }

  private rowToTransaction(row: any): Transaction {
    return {
      _id: row.id,
      hash: row.hash,
      blockNumber: row.blockNumber,
      timestamp: row.timestamp,
      from: row.fromAddress,
      to: row.toAddress,
      sellToken: row.sellToken,
      buyToken: row.buyToken,
      sellAmount: row.sellAmount || '0',
      buyAmount: row.buyAmount || '0',
      executedBuyAmount: row.executedBuyAmount || '0',
      executedSellAmount: row.executedSellAmount || '0',
      executedSellAmountBeforeFees: row.executedSellAmountBeforeFees || '0',
      kind: row.kind,
      receiver: row.receiver,
      parsedData: row.parsedData ? JSON.parse(row.parsedData) : undefined,
    };
  }

  /**
   * Get token metadata with caching and multicall support
   */
  async getTokenMetadata(address: string, networkId: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  }> {
    try {
      // Check cache first
      const cached = await this.getCachedTokenMetadata(address, networkId);
      if (cached) {
        console.log(`📦 Cache hit: Token metadata for ${address}`);
        return cached;
      }

      console.log(`🔍 Cache miss: Fetching token metadata for ${address} from blockchain`);
      
      // Switch to the correct network
      await this.ethereumService.switchNetwork(networkId);
      
      // Use multicall to fetch all token metadata in one blockchain call
      const metadata = await this.fetchTokenMetadataWithMulticall(address);
      
      // Cache the result
      await this.cacheTokenMetadata(address, networkId, metadata);
      
      return metadata;
    } catch (error) {
      console.error(`❌ Error fetching token metadata for ${address}:`, error);
      
      // Return fallback metadata
      return {
        name: `Token ${address.slice(0, 6)}...${address.slice(-4)}`,
        symbol: `TKN${address.slice(2, 6).toUpperCase()}`,
        decimals: 18,
        address: address
      };
    }
  }

  /**
   * Fetch token metadata using multicall for efficiency
   */
  private async fetchTokenMetadataWithMulticall(address: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  }> {
    try {
      // ERC20 ABI for token metadata
      const erc20Abi = [
        {
          constant: true,
          inputs: [],
          name: 'name',
          outputs: [{ name: '', type: 'string' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'symbol',
          outputs: [{ name: '', type: 'string' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }
      ];

      // Use the Ethereum service to make multicall
      const [name, symbol, decimals] = await Promise.all([
        this.ethereumService.callContract(address, erc20Abi, 'name', []),
        this.ethereumService.callContract(address, erc20Abi, 'symbol', []),
        this.ethereumService.callContract(address, erc20Abi, 'decimals', [])
      ]);

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals) || 18,
        address: address
      };
    } catch (error) {
      console.error(`❌ Multicall failed for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get cached token metadata from database
   */
  private async getCachedTokenMetadata(address: string, networkId: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  } | null> {
    try {
      if (!this.db) return null;

      const stmt = this.db.prepare(`
        SELECT name, symbol, decimals, address, timestamp 
        FROM token_metadata 
        WHERE address = ? AND network_id = ? AND timestamp > ?
      `);
      
      const cacheExpiry = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      const result = stmt.getAsObject([address.toLowerCase(), networkId, cacheExpiry]);
      
      if (result && result.name) {
        return {
          name: result.name as string,
          symbol: result.symbol as string,
          decimals: result.decimals as number,
          address: result.address as string
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error reading cached token metadata:', error);
      return null;
    }
  }

  /**
   * Cache token metadata in database
   */
  private async cacheTokenMetadata(
    address: string, 
    networkId: string, 
    metadata: { name: string; symbol: string; decimals: number; address: string }
  ): Promise<void> {
    try {
      if (!this.db) return;

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO token_metadata 
        (address, network_id, name, symbol, decimals, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        address.toLowerCase(),
        networkId,
        metadata.name,
        metadata.symbol,
        metadata.decimals,
        Date.now()
      ]);
      
      console.log(`💾 Cached token metadata for ${address}`);
    } catch (error) {
      console.error('❌ Error caching token metadata:', error);
    }
  }

  /**
   * Get block timestamp with caching
   */
  async getBlockTimestamp(blockNumber: number, networkId: string): Promise<number> {
    try {
      // Check cache first
      const cached = await this.getCachedBlockTimestamp(blockNumber, networkId);
      if (cached !== null) {
        console.log(`📦 Cache hit: Block timestamp for block ${blockNumber}`);
        return cached;
      }

      console.log(`🔍 Cache miss: Fetching block timestamp for block ${blockNumber} from blockchain`);
      
      // Switch to the correct network
      await this.ethereumService.switchNetwork(networkId);
      
      // Fetch from blockchain
      const timestamp = await this.ethereumService.getBlockTimestamp(blockNumber);
      
      console.log(`📡 Database service got timestamp ${timestamp} for block ${blockNumber}`);
      
      // Cache the result
      await this.cacheBlockTimestamp(blockNumber, networkId, timestamp);
      
      return timestamp;
    } catch (error) {
      console.error(`❌ Error fetching block timestamp for block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get cached block timestamp from database
   */
  private async getCachedBlockTimestamp(blockNumber: number, networkId: string): Promise<number | null> {
    try {
      if (!this.db) return null;

      const stmt = this.db.prepare(`
        SELECT timestamp 
        FROM block_timestamps 
        WHERE block_number = ? AND network_id = ? AND cached_at > ?
      `);
      
      // Cache for 24 hours (blocks are immutable, so we can cache longer)
      const cacheExpiry = Date.now() - (24 * 60 * 60 * 1000);
      const result = stmt.get([blockNumber, networkId, cacheExpiry]) as unknown as { timestamp: number } | undefined;
      
      if (result) {
        return result.timestamp;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error reading cached block timestamp:', error);
      return null;
    }
  }

  /**
   * Cache block timestamp in database
   */
  private async cacheBlockTimestamp(
    blockNumber: number, 
    networkId: string, 
    timestamp: number
  ): Promise<void> {
    try {
      if (!this.db) return;

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO block_timestamps 
        (block_number, network_id, timestamp, cached_at) 
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run([
        blockNumber,
        networkId,
        timestamp,
        Date.now()
      ]);
      
      console.log(`💾 Cached block timestamp for block ${blockNumber}`);
    } catch (error) {
      console.error('❌ Error caching block timestamp:', error);
    }
  }
}
