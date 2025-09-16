// Order types based on the updated MongoDB model
export type OrderUid = string;
export type Token = string;
export type TokenAmount = string;
export type OrderKind = 'sell' | 'buy';

export interface TokenInfo {
  name: string;
  type: string;
  symbol: string;
  decimals: number;
  website?: string;
  description?: string;
  explorer?: string;
  status: string;
  id: string;
  tags?: string[];
}

// Competition data structure for each solver
export interface CompetitionData {
  solverAddress: string;
  clearingPrices: Record<string, string>;
  order: {
    id: string;
    sellAmount: string;
    buyAmount: string;
    buyToken: string;
    sellToken: string;
  };
}

// Price range for event block prices
export interface PriceRange {
  high: number;
  low: number;
}

// Solver bid price information
export interface SolverBidPriceInfo {
  solverPrice: string;
  solverPriceTimestamp: number;
  markup: number;
}

// Interface for the order document (matches the new MongoDB model)
export interface IOrderDocument {
  _id: string; // orderUid as the document _id
  eventBlockNumber: number;
  eventBlockTimestamp: number;
  eventTxHash: string;
  sellToken: string;
  buyToken: string;
  eventSellAmount: string;
  eventBuyAmount: string;
  competitionData: CompetitionData[];
  auctionStartBlock: number;
  auctionStartTimestamp: number;
  solverBidPriceInfo: SolverBidPriceInfo;
  eventBlockPrices: Record<string, PriceRange>;
  checked?: boolean;
}

// Enhanced order interface with token metadata for frontend display
export interface OrderWithMetadata extends IOrderDocument {
  sellTokenInfo?: TokenInfo;
  buyTokenInfo?: TokenInfo;
  // Legacy fields for backward compatibility with existing components
  timestamp?: Date;
  livePrice?: number;
  markup?: number;
  kind?: OrderKind;
  owner?: string;
  sellAmount?: string; // Legacy field
  buyAmount?: string; // Legacy field
  ourOffer?: {
    clearingPrices?: Record<string, string>;
    sellAmount: string;
    buyAmount: string;
    wasIncluded: boolean;
  };
  competitors?: {
    [solverAddress: string]: {
      sellAmount?: string;
      buyAmount?: string;
      clearingPrices?: Record<string, string>;
      ranking?: number;
      isWinner?: boolean;
    };
  };
  metadata?: {
    gasEstimate?: number;
    profitability?: number;
    priceDeviation?: number;
    isWinner?: boolean;
    ranking?: number;
    totalCompetitors?: number;
    competitionEnrichedAt?: Date;
    [key: string]: any;
  };
}

// Dashboard statistics interface
export interface OrderStats {
  totalOrders: number;
  totalVolume: number;
  averageMarkup: number;
  inclusionRate: number;
  recentOrders: number;
  topTokens: Array<{ token: string; count: number; tokenInfo?: TokenInfo }>;
  ordersByHour: Array<{ hour: number; count: number }>;
}

// Orders API response interface
export interface OrdersResponse {
  orders: OrderWithMetadata[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}
