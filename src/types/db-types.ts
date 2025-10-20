// Transaction type for database storage
export interface Transaction {
  _id?: any; // Database row ID
  hash: string;
  blockNumber: number;
  buyAmount: string; // Large numbers stored as strings to avoid precision loss
  buyToken: string;
  executedBuyAmount: string; // Large numbers stored as strings to avoid precision loss
  executedSellAmount: number;
  executedSellAmountBeforeFees: number;
  kind: string;
  receiver: string;
  sellAmount: number;
  sellToken: string;
  // Additional fields used by mock service (for compatibility)
  from?: string;
  to?: string;
  timestamp?: string | Date;
  parsedData?: any;
}