// CoW Protocol Data Types
// Based on https://docs.cow.fi/

export interface CowOrder {
  uid: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  partiallyFillable: boolean;
  receiver: string;
  sellTokenBalance: string;
  buyTokenBalance: string;
  kind: 'sell' | 'buy';
  owner: string;
  signature: string;
  from: string;
  executedSellAmount?: string;
  executedBuyAmount?: string;
  invalidated: boolean;
  status: 'open' | 'fulfilled' | 'cancelled' | 'expired';
}

export interface CowBatch {
  _id?: string;
  id?: string;
  hash: string;
  blockNumber: number;
  buyAmount: number;
  buyToken: string;
  executedBuyAmount: number;
  executedSellAmount: number;
  executedSellAmountBeforeFees: number;
  kind: 'sell' | 'buy';
  receiver: string;
  sellAmount: number;
  sellToken: string;
  orders?: CowOrder[];
  solution?: CowSolution;
  status?: 'pending' | 'executed' | 'failed';
}

export interface CowSolution {
  id: string;
  batchId: string;
  solver: string;
  executedOrders: string[];
  prices: Record<string, string>;
  trades: CowTrade[];
}

export interface CowTrade {
  orderUid: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  feeAmount: string;
  executedAt: number;
}

export interface CowToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
}

export interface CowApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
