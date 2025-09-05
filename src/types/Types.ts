import { type Address } from "viem";

export type U256 = string;
export type Bytes = string;
export type OrderUid = string;
export type Token = string;
export type TokenAmount = string;
export type U128 = string;
export type I128 = string;
export type I32 = number;
export type BigInt = string;
export type Decimal = string;
export type NativePrice = string;
export type DateTime = string;
export type AppData = string;
export type BalancerPoolId = string;

// Re-export Address from viem for use in other files
export type { Address };

export interface Fee {
  type: FeeType;
  amount?: U256;
}

export enum FeeType {
  Protocol = "protocol",
  Surplus = "surplus"
}

export enum OrderKind {
  Sell = "sell",
  Buy = "buy"
}

export enum OrderClass {
  Market = "market",
  Limit = "limit"
}

// Fee Policy types
export interface FeePolicy {
  kind: string;
}

export interface SurplusFee extends FeePolicy {
  kind: "surplus";
  maxVolumeFactor?: number;
  factor: number;
}

export interface PriceImprovement extends FeePolicy {
  kind: "priceImprovement";
  maxVolumeFactor?: number;
  factor: number;
  quote?: Quote;
}

export interface VolumeFee extends FeePolicy {
  kind: "volume";
  factor: number;
}

export interface Quote {
  sell_amount: TokenAmount;
  buy_amount: TokenAmount;
  fee: TokenAmount;
}

// Flashloan types
export interface FlashloanHint {
  lender: Address;
  borrower?: Address;
  token: Token;
  amount: TokenAmount;
}

export interface Flashloan {
  lender: Address;
  borrower: Address;
  token: Token;
  amount: TokenAmount;
}

// Balance source/destination types
export enum SellTokenBalance {
  Erc20 = "erc20",
  Internal = "internal",
  External = "external"
}

export enum BuyTokenBalance {
  Erc20 = "erc20",
  Internal = "internal"
}

// Signing scheme types
export enum SigningScheme {
  Eip712 = "eip712",
  EthSign = "ethSign",
  PreSign = "preSign",
  Eip1271 = "eip1271"
}

// Call types for interactions
export interface CallData {
  target: Address;
  value: TokenAmount;
  callData: string;
}

export interface Call {
  target: Address;
  value: TokenAmount;
  callData: string[];
}

// Liquidity types
export interface TokenReserve {
  balance: TokenAmount;
}

export interface ConstantProductPool {
  kind: "constantProduct";
  tokens: Record<Token, TokenReserve>;
  fee: Decimal;
  router: Address;
}

export interface WeightedProductPool {
  kind: "weightedProduct";
  tokens: Record<Token, TokenReserve & { scalingFactor?: Decimal; weight: Decimal }>;
  fee: Decimal;
  version?: "v0" | "v3Plus";
  balancer_pool_id: BalancerPoolId;
}

export interface StablePool {
  kind: "stable";
  tokens: Record<Token, TokenReserve & { scalingFactor: Decimal }>;
  amplificationParameter: Decimal;
  fee: Decimal;
  balancer_pool_id: BalancerPoolId;
}

export interface ConcentratedLiquidityPool {
  kind: "concentratedLiquidity";
  tokens: Token[];
  sqrtPrice: U256;
  liquidity: U128;
  tick: I32;
  liquidityNet: Record<string, I128>;
  fee: Decimal;
  router: Address;
}

export interface ForeignLimitOrder {
  kind: "limitOrder";
  makerToken: Token;
  takerToken: Token;
  makerAmount: TokenAmount;
  takerAmount: TokenAmount;
  takerTokenFeeAmount: TokenAmount;
}

export type LiquidityParameters = 
  | ConstantProductPool 
  | WeightedProductPool 
  | StablePool 
  | ConcentratedLiquidityPool 
  | ForeignLimitOrder;

export interface Liquidity {
  id: string;
  address: Address;
  gasEstimate: BigInt;
  kind: "constantProduct" | "weightedProduct" | "stable" | "concentratedLiquidity" | "limitOrder";
  tokens?: Record<Token, TokenReserve> | Record<Token, TokenReserve & { scalingFactor?: Decimal; weight: Decimal }> | Token[];
  fee?: Decimal;
  router?: Address;
  balancer_pool_id?: BalancerPoolId;
  amplificationParameter?: Decimal;
  sqrtPrice?: U256;
  liquidity?: U128;
  tick?: I32;
  liquidityNet?: Record<string, I128>;
  version?: "v0" | "v3Plus";
  makerToken?: Token;
  takerToken?: Token;
  makerAmount?: TokenAmount;
  takerAmount?: TokenAmount;
  takerTokenFeeAmount?: TokenAmount;
}

// Solve endpoint request types
export interface SolveRequest {
  id: string;
  tokens: Record<Address, TokenInfo>;
  orders: Order[];
}

export interface TokenInfo {
  decimals?: number;
  symbol?: string;
  referencePrice?: NativePrice;
  availableBalance: TokenAmount;
  trusted: boolean;
}

export interface InteractionData {
  target: Address;
  value: TokenAmount;
  callData: string;
}

export interface Allowance {
  token: Token;
  spender: Address;
  amount: TokenAmount;
}

export interface Asset {
  token: Token;
  amount: TokenAmount;
}

export interface Order {
  uid: OrderUid;
  sellToken: Token;
  buyToken: Token;
  sellAmount: TokenAmount;
  fullSellAmount: TokenAmount;
  buyAmount: TokenAmount;
  fullBuyAmount: TokenAmount;
  validTo: number;
  kind: OrderKind;
  receiver?: Address;
  owner: Address;
  partiallyFillable: boolean;
  preInteractions: InteractionType[];
  postInteractions: InteractionData[];
  sellTokenSource: SellTokenBalance;
  buyTokenDestination: BuyTokenBalance;
  class: OrderClass;
  appData: AppData;
  flashloanHint?: FlashloanHint;
  signingScheme: SigningScheme;
  signature: string;
  feePolicies?: FeePolicy[];
}

export interface Auction {
  id: string | null;
  orders: Order[];
  tokens: Record<Address, TokenInfo>;
  liquidity: Liquidity[];
  effectiveGasPrice: TokenAmount;
  deadline: DateTime;
  surplusCapturingJitOrderOwners: Address[];
}

export interface JitOrder {
  sellToken: Token;
  buyToken: Token;
  receiver: Address;
  sellAmount: TokenAmount;
  buyAmount: TokenAmount;
  validTo: number;
  appData: AppData;
  kind: OrderKind;
  sellTokenBalance: SellTokenBalance;
  buyTokenBalance: BuyTokenBalance;
  signingScheme: SigningScheme;
  signature: string;
  partiallyFillable?: boolean;
}

export interface Fulfillment {
  kind: "fulfillment";
  order: OrderUid;
  executedAmount: TokenAmount;
  fee?: TokenAmount;
}

export interface JitTrade {
  kind: "jit";
  order: JitOrder;
  executedAmount: TokenAmount;
  fee: TokenAmount;
}

export type Trade = Fulfillment | JitTrade;

export interface LiquidityInteraction {
  kind: "liquidity";
  id: number;
  inputToken: Token;
  outputToken: Token;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  internalize?: boolean;
}

export interface CustomInteraction {
  kind: "custom";
  target: Address;
  value: TokenAmount;
  callData: string;
  inputs: Asset[];
  outputs: Asset[];
  allowances?: Allowance[];
  internalize?: boolean;
}

export type InteractionType = LiquidityInteraction | CustomInteraction;

// Pricing metadata captured during solution building
export interface SolutionPricingMetadata {
  orderUid: OrderUid;
  livePrice: number;        // The actual live market price used
  markup: number;           // The actual markup applied (in basis points)
  adjustedPrice: number;    // The price after applying markup
  ourOffer: {
    sellAmount: TokenAmount;
    buyAmount: TokenAmount;
  };
  priceTimestamp: number;   // When the price was captured
}

export interface Solution {
  id: number;
  prices: Record<Address, U256>;
  trades: Trade[];
  preInteractions: Call[];
  interactions: InteractionType[];
  postInteractions: Call[];
  gas?: number;
  flashloans?: Record<OrderUid, Flashloan>;
  // Add pricing metadata for storage purposes
  pricingMetadata?: SolutionPricingMetadata;
}

export interface SolverConfig {
  // Solver metadata
  name: string;
  version: string;
  endpoint: string;
  timeout: number;
  maxGasPrice: U256;
  
  // Profit and margin configuration
  minProfitThreshold: U256;
  margin?: {
    // Margin in basis points (e.g., 100 = 1% margin)
    // Positive values mean we offer less favorable rates to make profit
    // Negative values mean we offer better rates (competitive pricing)
    basisPoints: number;
    
    // Minimum margin in basis points (e.g., 50 = 0.5%)
    minimumBasisPoints: number;
  };
  
  // Gas estimation settings
  gasEstimation?: {
    baseGas: number;
    perInteractionGas: number;
  };
  
  // Logging configuration
  logging?: {
    // Enable detailed technical logs
    verbose?: boolean;
    // Show trade summary with key metrics
    showTradeSummary?: boolean;
  };

  // MongoDB configuration
  mongodb?: {
    connectionString: string;
    dbName: string;
    collections?: {
      orders?: string;
    };
  };
}

// milkbank types

export interface MilkbankOrder {
  tokenToSend: Address;
  amountToSend: U256;
  tokenToReceive: Address;
  amountToReceive: U256;
  deadline: bigint;
  nonce: bigint;
}

export interface MilkbankConfig {
  milkbankAddress: Address;
  settlementAddress: Address;
  funderAddress: Address;
  signerPrivateKey: `0x${string}`;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
}

export interface GPv2Trade {
  sellTokenIndex: number;
  buyTokenIndex: number;
  receiver: Address;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: number;
  appData: `0x${string}`;
  feeAmount: bigint;
  flags: number;
  executedAmount: bigint;
  signature: `0x${string}`;
}

export interface GPv2Interaction {
  target: Address;
  value: TokenAmount;
  callData: `0x${string}`;
}

export interface SettlementParams {
  tokens: Address[];
  clearingPrices: bigint[];
  trades: GPv2Trade[];
  interactions: [GPv2Interaction[], GPv2Interaction[], GPv2Interaction[]];
}

// Simplified pricing service types
export interface SimplePriceData {
  symbol: string;
  midPrice: number;
  timestamp: number;
}

export interface PricingConfig {
  ethUsdcMidPrice: number; // Static mid price for ETH/USDC
  epsilonPercent: number;  // Epsilon in percentage (e.g., 0.5 for 0.5%)
}

export interface ProfitabilityAnalysis {
  isProfitable: boolean;
  expectedProfit: number;
  marketPrice: number;
  orderPrice: number;
  priceDeviation: number;
}
