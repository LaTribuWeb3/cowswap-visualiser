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

// Interface for the order document (matches the MongoDB model)
export interface IOrderDocument {
  // Use orderUid as the document _id
  _id: OrderUid;
  
  // Request metadata
  auctionId: string;
  timestamp: Date;
  requestIp?: string;
  processingTimeMs?: number;
  
  // Order details
  sellToken: Token;
  buyToken: Token;
  sellAmount: TokenAmount;
  buyAmount: TokenAmount;
  kind: OrderKind;
  owner: string;
  
  // Our pricing and offer
  livePrice: number;        // The live market price we based our quote on
  markup: number;           // The markup we applied (in basis points)
  ourOffer: {
    sellAmount: TokenAmount; // How much we offered to sell
    buyAmount: TokenAmount;  // How much we offered to buy
    wasIncluded: boolean;    // Whether this order was included in our solution
  };
  
  // Future fields for competitive analysis (can be added later)
  competitors?: {
    [solverName: string]: {
      sellAmount?: TokenAmount;
      buyAmount?: TokenAmount;
      timestamp: Date;
    };
  };
  
  // Additional metadata that might be useful
  metadata?: {
    gasEstimate?: number;
    profitability?: number;
    priceDeviation?: number;
    // Competition data
    isWinner?: boolean; // Whether our solver won this auction
    auctionRanking?: number; // Our ranking in the competition (1 = winner)
    auctionScore?: string; // Our score in the competition
    competitionEnrichedAt?: Date; // When competition data was last enriched
    [key: string]: any;
  };
}

// Enhanced order interface with token metadata for frontend display
export interface OrderWithMetadata extends IOrderDocument {
  sellTokenInfo?: TokenInfo;
  buyTokenInfo?: TokenInfo;
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
