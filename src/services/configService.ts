export interface SolverConfig {
  name: string;
  version: string;
  endpoint: string;
  timeout: number;
  maxGasPrice: string;
}

export interface MarginConfig {
  basisPoints: number;
  minimumBasisPoints: number;
  percentage: number;
  minimumPercentage: number;
  description: {
    basisPoints: string;
    minimumBasisPoints: string;
  };
}

export interface LimitsConfig {
  minProfitThreshold: string;
  maxGasPrice: string;
  timeout: {
    value: number;
    unit: string;
    description: string;
  };
  gasEstimation: {
    baseGas: number;
    perInteractionGas: number;
    description: string;
  };
}

export interface MilkbankConfig {
  addresses: {
    milkbank: string;
    settlement: string;
    funder: string;
  };
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
}

export interface PricingConfig {
  connected: boolean;
  currentPrice: number;
  priceAge: number;
  isPriceFresh: boolean;
  lastUpdate: number;
}

export interface SupportedToken {
  symbol: string;
  address: string;
  decimals: number;
}

export interface ConfigResponse {
  solver: SolverConfig;
  margin: MarginConfig;
  limits: LimitsConfig;
  milkbank: MilkbankConfig;
  pricing: PricingConfig;
  supportedTokens: SupportedToken[];
  tradingPairs: string[];
}

class ConfigService {
  private config: ConfigResponse | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getConfig(): Promise<ConfigResponse> {
    const now = Date.now();
    
    // Return cached config if it's still fresh
    if (this.config && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.config;
    }

    try {
      const response = await fetch('https://prod.arbitrum.cowswap.la-tribu.xyz/api/config');
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      
      this.config = await response.json();
      this.lastFetch = now;
      return this.config!;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  async getSolverInfo(): Promise<SolverConfig> {
    const config = await this.getConfig();
    return config.solver;
  }

  async getMarginInfo(): Promise<MarginConfig> {
    const config = await this.getConfig();
    return config.margin;
  }

  async getPricingInfo(): Promise<PricingConfig> {
    const config = await this.getConfig();
    return config.pricing;
  }

  async getSupportedTokens(): Promise<SupportedToken[]> {
    const config = await this.getConfig();
    return config.supportedTokens;
  }

  async getTradingPairs(): Promise<string[]> {
    const config = await this.getConfig();
    return config.tradingPairs;
  }
}

export const configService = new ConfigService();
