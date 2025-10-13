// CoW Protocol Types
export interface Trade {
  sellTokenIndex: string;
  sellToken: string;
  buyTokenIndex: string;
  buyToken: string;
  receiver: string;
  sellAmount: string;
  buyAmount: string;
  executedAmount: string;
  validTo: string;
  appData: string;
  feeAmount: string;
  flags: string;
  signature: string;
}

export interface Interaction {
  target: string;
  value: string;
  callData: string;
}

export interface ParsedData {
  tokens: string[];
  clearingPrices: string[];
  trades: Trade[];
  interactions: Interaction[][];
  numberOfOrders: number;
  numberOfInteractions: number;
}

export interface Transaction {
  hash: `0x${string}`;
  blockNumber: string;
  from?: `0x${string}`;
  to?: `0x${string}`;
  value?: string;
  gasPrice?: string;
  gasUsed?: string;
  status?: string;
  decodedFunction?: string;
  functionDescription?: string;
  parsedData?: ParsedData;
  // New database format fields
  sellToken?: `0x${string}`;
  buyToken?: `0x${string}`;
  sellAmount?: string;
  buyAmount?: string;
  executedAmount?: string;
  creationDate?: Date;
  realSellAmount: string;
  sellPrice: string;
  buyPrice: string;
  receiver: `0x${string}`;
  // Additional fields from new database format
  executedBuyAmount?: string;
  executedSellAmount?: string;
  executedSellAmountBeforeFees?: string;
  kind?: 'sell' | 'buy';
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: `0x${string}`;
  isLoading?: boolean; // Indicates if this is a placeholder while fetching metadata
}

// UI State Types
export interface UIState {
  currentTrade: Transaction | null;
  trades: Transaction[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    fromAddress?: string;
    toAddress?: string;
    startDate?: string;
    endDate?: string;
    sellToken?: string;
    buyToken?: string;
  };
}

// API Response Types
export interface APIResponse {
  success: boolean;
  data?: Transaction[];
  error?: string;
}

// Utility Types
export interface FormattedAmount {
  value: string;
  symbol: string;
  usdValue?: string;
}

export interface ConversionRate {
  from: string;
  to: string;
  rate: string;
  inverseRate: string;
}

export interface BinancePriceData {
  jobId?: string;
  status?: string;
  result?: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    exactMatch: boolean;
    intermediatePairs?: Array<{
      symbol: string;
      baseAsset: string;
      quoteAsset: string;
      status: string;
      isActive: boolean;
      price: {
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        exactMatch: boolean;
      };
      direction: string;
      stepNumber: number;
    }>;
    calculationSteps?: number;
    isDirect?: boolean;
    calculationPath?: string[];
  };
  message?: string;
  completedAt?: string;
  cached?: boolean;
}

// DOM Element Types
export interface DOMElements {
  tradesGrid: HTMLElement;
  tradesCount: HTMLElement;
  tradeDetailsSection: HTMLElement;
  paginationInfo?: HTMLElement;
  paginationControls?: HTMLElement;
  filterContainer?: HTMLElement;
  filterForm?: HTMLElement;
  startDateInput?: HTMLInputElement;
  endDateInput?: HTMLInputElement;
  sellTokenInput?: HTMLInputElement;
  buyTokenInput?: HTMLInputElement;
  clearFiltersButton?: HTMLButtonElement;
  applyFiltersButton?: HTMLButtonElement;
}

