import type { OrderWithMetadata } from '../types/OrderTypes';
import { getTokenMetadata } from './tokenMapping';

// Token addresses for WETH/USDC pairs on Arbitrum
const WETH_ADDRESS = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const USDC_ADDRESS = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

// Precision constants for calculations
const PRECISION_FACTOR = 1_000_000_000_000_000_000n; // 18 decimal places


export interface DeltaResult {
  deltaPercent: number;
  deltaAbsolute: number;
  deltaUnit: string; // 'USDC' or 'WETH'
  actualBuyAmount: number;
  expectedBuyAmount: number;
}

export interface CompetitorDeltaResult extends DeltaResult {
  solverName: string;
  sellAmount: string;
  buyAmount: string;
  clearingPrices?: { [token: string]: string };
  isOurs: boolean;
  isWinner: boolean;
  deltaVsWinning: number;
  deltaVsWinningPercent: number;
}

/**
 * Convert BigInt to number with proper precision handling
 */
const bigIntToNumber = (value: bigint, decimals: number): number => {
  const divisor = BigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;
  
  // Convert to number with proper decimal places
  const decimalPart = Number(remainder) / (10 ** decimals);
  return Number(quotient) + decimalPart;
};

/**
 * Calculate the actual price offered from clearing prices using BigInt
 * Returns the price as BigInt with 18 decimal precision
 */
const getActualPriceFromClearingPrices = (
  sellToken: string,
  buyToken: string,
  clearingPrices?: { [token: string]: string }
): bigint | null => {
  if (!clearingPrices || !clearingPrices[sellToken] || !clearingPrices[buyToken]) {
    return null;
  }
  
  const sellPrice = BigInt(clearingPrices[sellToken]);
  const buyPrice = BigInt(clearingPrices[buyToken]);
  
  if (sellPrice === 0n) {
    return null;
  }
  
  // Price = buyPrice / sellPrice * PRECISION_FACTOR
  // This gives us the actual exchange rate offered
  return (buyPrice * PRECISION_FACTOR) / sellPrice;
};

/**
 * Calculate the effective buy amount from clearing prices using BigInt
 * This represents what would actually be received at the clearing price
 */
const getEffectiveBuyAmountFromClearingPrices = (
  sellAmount: string,
  sellToken: string,
  buyToken: string,
  clearingPrices?: { [token: string]: string }
): bigint | null => {
  const actualPrice = getActualPriceFromClearingPrices(sellToken, buyToken, clearingPrices);
  if (!actualPrice) {
    return null;
  }
  
  const sellAmountBigInt = BigInt(sellAmount);
  
  // Effective buy amount = sellAmount * actualPrice / PRECISION_FACTOR
  return (sellAmountBigInt * actualPrice) / PRECISION_FACTOR;
};


/**
 * Get the winning bid price from competitors using BigInt
 * Prioritizes clearing prices when available, falls back to buy/sell amounts
 */
export const getWinningBidPrice = (order: OrderWithMetadata): number | null => {
  if (!order.competitors || Object.keys(order.competitors).length === 0) {
    return null;
  }

  // Find the best offer (highest effective buy amount)
  let bestPrice = 0n;

  Object.values(order.competitors).forEach(competitor => {
    // Try to get price from clearing prices first
    const clearingPrice = getActualPriceFromClearingPrices(
      order.sellToken, 
      order.buyToken, 
      competitor.clearingPrices
    );
    
    if (clearingPrice) {
      if (clearingPrice > bestPrice) {
        bestPrice = clearingPrice;
      }
    } else {
      // Fallback to calculating from buy/sell amounts
      const buyAmount = BigInt(competitor.buyAmount || '0');
      const sellAmount = BigInt(competitor.sellAmount || '0');
      
      if (buyAmount > 0n && sellAmount > 0n) {
        const calculatedPrice = (buyAmount * PRECISION_FACTOR) / sellAmount;
        if (calculatedPrice > bestPrice) {
          bestPrice = calculatedPrice;
        }
      }
    }
  });

  if (bestPrice === 0n) {
    return null;
  }

  return bigIntToNumber(bestPrice, 18);
};

/**
 * Get token decimals, trying multiple sources
 */
const getTokenDecimals = (tokenAddress: string, tokenInfo?: { decimals?: number }): number => {
  if (tokenInfo?.decimals) {
    return tokenInfo.decimals;
  }
  
  const tokenMetadata = getTokenMetadata(tokenAddress);
  if (tokenMetadata?.decimals) {
    return tokenMetadata.decimals;
  }
  
  return 18; // Default to 18 decimals
};

/**
 * Calculate delta for a single order against live price using BigInt
 */
export const calculateOrderDelta = (order: OrderWithMetadata): DeltaResult | null => {
  const winningBidPrice = getWinningBidPrice(order);
  if (!winningBidPrice) {
    return null;
  }

  const livePrice = order.livePrice;
  
  // Get token decimals
  const sellTokenDecimals = getTokenDecimals(order.sellToken, order.sellTokenInfo);
  const buyTokenDecimals = getTokenDecimals(order.buyToken, order.buyTokenInfo);
  
  // Convert amounts to actual token values using BigInt for precision
  const actualSellAmount = bigIntToNumber(BigInt(order.sellAmount), sellTokenDecimals);
  const actualBuyAmount = bigIntToNumber(BigInt(order.buyAmount), buyTokenDecimals);
  
  // Determine order direction
  const isWETHToUSDC = order.sellToken === WETH_ADDRESS && order.buyToken === USDC_ADDRESS;
  const isUSDCToWETH = order.sellToken === USDC_ADDRESS && order.buyToken === WETH_ADDRESS;
  
  let expectedBuyAmount: number;
  let deltaUnit: string;
  
  if (isWETHToUSDC) {
    // WETH → USDC: expected USDC at live price
    expectedBuyAmount = actualSellAmount * livePrice;
    deltaUnit = 'USDC';
  } else if (isUSDCToWETH) {
    // USDC → WETH: expected WETH at live price
    expectedBuyAmount = actualSellAmount / livePrice;
    deltaUnit = 'WETH';
  } else {
    // Fallback: assume WETH → USDC
    expectedBuyAmount = actualSellAmount * livePrice;
    deltaUnit = 'USDC';
  }
  
  const deltaAbsolute = actualBuyAmount - expectedBuyAmount;
  const deltaPercent = expectedBuyAmount > 0 ? (deltaAbsolute / expectedBuyAmount) * 100 : 0;
  
  return {
    deltaPercent,
    deltaAbsolute,
    deltaUnit,
    actualBuyAmount,
    expectedBuyAmount
  };
};

/**
 * Calculate deltas for all competitors in an order using BigInt
 */
export const calculateCompetitorDeltas = (order: OrderWithMetadata): CompetitorDeltaResult[] => {
  const competitors = [];
  
  // Add our offer first (always available for included orders)
  competitors.push({
    solverName: 'Our Solver',
    sellAmount: order.ourOffer.sellAmount,
    buyAmount: order.ourOffer.buyAmount,
    clearingPrices: order.ourOffer.clearingPrices,
    isOurs: true
  });
  
  // Add other competitors if they exist
  if (order.competitors) {
    Object.entries(order.competitors).forEach(([solverAddress, data]) => {
      competitors.push({
        solverName: solverAddress, // Will be mapped to readable name in component
        sellAmount: data.sellAmount || '0',
        buyAmount: data.buyAmount || '0',
        clearingPrices: data.clearingPrices,
        isOurs: false
      });
    });
  }
  
  // Sort by buy amount (best offer first) - use actual buy amounts for now
  const sortedCompetitors = competitors.sort((a, b) => {
    const aBuyAmount = BigInt(a.buyAmount);
    const bBuyAmount = BigInt(b.buyAmount);
    return aBuyAmount > bBuyAmount ? -1 : aBuyAmount < bBuyAmount ? 1 : 0;
  });

  // Get token decimals
  const buyTokenDecimals = getTokenDecimals(order.buyToken, order.buyTokenInfo);
  
  // For now, use actual buy amount to debug
  // TODO: Re-enable clearing prices once we understand the format  
  const winningBuyAmountBigInt = BigInt(sortedCompetitors[0]?.buyAmount || '0');
  
  const livePrice = order.livePrice;
  
  // Determine order direction
  const isWETHToUSDC = order.sellToken === WETH_ADDRESS && order.buyToken === USDC_ADDRESS;
  const isUSDCToWETH = order.sellToken === USDC_ADDRESS && order.buyToken === WETH_ADDRESS;
  
  return sortedCompetitors.map((competitor, index) => {
    const competitorSellAmountBigInt = BigInt(competitor.sellAmount);
    const isWinner = index === 0;
    
    // For now, let's use the actual buy amount to debug the issue
    // TODO: Re-enable clearing prices once we understand the format
    const competitorBuyAmountBigInt = BigInt(competitor.buyAmount);
    
    // Convert to actual token amounts for display
    const actualBuyAmount = bigIntToNumber(competitorBuyAmountBigInt, buyTokenDecimals);
    const actualWinningBuyAmount = bigIntToNumber(winningBuyAmountBigInt, buyTokenDecimals);
    
    // Delta vs winning bid (in actual token units)
    const deltaVsWinning = actualBuyAmount - actualWinningBuyAmount;
    const deltaVsWinningPercent = actualWinningBuyAmount > 0 ? (deltaVsWinning / actualWinningBuyAmount) * 100 : 0;
    
    // Delta vs live price - compare the offered WETH price to live price
    let offeredPrice: number | null = null;
    let deltaAbsolute: number = 0;
    let deltaPercent: number = 0;
    
    // Guard against zero or invalid live price
    if (livePrice <= 0) {
      return {
        ...competitor,
        isWinner,
        deltaPercent: 0,
        deltaAbsolute: 0,
        deltaUnit: 'USD',
        actualBuyAmount,
        expectedBuyAmount: actualBuyAmount,
        deltaVsWinning,
        deltaVsWinningPercent
      };
    }4358953378
    
    // Try to get the offered price from clearing prices first
    if (competitor.clearingPrices && competitor.clearingPrices[WETH_ADDRESS] && competitor.clearingPrices[USDC_ADDRESS]) {
      const wethClearingPrice = parseFloat(competitor.clearingPrices[WETH_ADDRESS]);
      const usdcClearingPrice = parseFloat(competitor.clearingPrices[USDC_ADDRESS]);
      
      if (wethClearingPrice > 0 && usdcClearingPrice > 0) {
        // Based on examples:
        // Example 1: WETH=4358953378, USDC=1e18 → 1 WETH ≈ 4358 USDC
        // Example 2: WETH=10000000, USDC=4294799891741830 → 1 WETH ≈ 2352 USDC
        // 
        // Pattern: The clearing prices are normalized exchange rates
        // Price per WETH = (WETH_clearing_price / USDC_clearing_price) * 1e12
        
        const ratio = wethClearingPrice / usdcClearingPrice;
        offeredPrice = ratio * 1e12;
        
        console.log('Clearing prices (final):', {
          rawUSDC: usdcClearingPrice,
          rawWETH: wethClearingPrice,
          ratio: ratio,
          pricePerWETH: offeredPrice,
          livePrice,
          competitor: competitor.solverName
        });
      }
    }
    
    // If no clearing prices, calculate from buy/sell amounts
    if (!offeredPrice) {
      // Always get the correct decimals for each token
      const sellTokenDecimals = order.sellToken === WETH_ADDRESS ? 18 : 6;
      const buyTokenDecimals = order.buyToken === WETH_ADDRESS ? 18 : 6;
      
      const actualSellAmount = bigIntToNumber(competitorSellAmountBigInt, sellTokenDecimals);
      const actualBuyAmountForPrice = bigIntToNumber(BigInt(competitor.buyAmount), buyTokenDecimals);
      
      if (actualSellAmount > 0 && actualBuyAmountForPrice > 0) {
        if (isWETHToUSDC) {
          // WETH → USDC: price = buyAmount / sellAmount (USDC per WETH)
          offeredPrice = actualBuyAmountForPrice / actualSellAmount;
        } else if (isUSDCToWETH) {
          // USDC → WETH: price = sellAmount / buyAmount (USDC per WETH)
          offeredPrice = actualSellAmount / actualBuyAmountForPrice;
        }
        
        console.log('Calculated from amounts:', {
          sellAmount: actualSellAmount,
          buyAmount: actualBuyAmountForPrice,
          offeredPrice,
          livePrice,
          direction: isWETHToUSDC ? 'WETH→USDC' : 'USDC→WETH',
          competitor: competitor.solverName
        });
      }
    }
    
    // Calculate delta if we have an offered price
    if (offeredPrice && offeredPrice > 0) {
      deltaAbsolute = offeredPrice - livePrice;
      deltaPercent = (deltaAbsolute / livePrice) * 100;
    }
    
    return {
      ...competitor,
      isWinner,
      deltaPercent,
      deltaAbsolute,
      deltaUnit: 'USD',
      actualBuyAmount,
      expectedBuyAmount: offeredPrice || 0, // Store the offered price for reference
      deltaVsWinning,
      deltaVsWinningPercent
    };
  });
};

/**
 * Calculate order size in USD for categorization using BigInt
 */
export const getOrderSizeInUSD = (order: OrderWithMetadata): number => {
  // Get token decimals
  const sellTokenDecimals = getTokenDecimals(order.sellToken, order.sellTokenInfo);
  const buyTokenDecimals = getTokenDecimals(order.buyToken, order.buyTokenInfo);

  const sellAmount = bigIntToNumber(BigInt(order.sellAmount), sellTokenDecimals);
  const buyAmount = bigIntToNumber(BigInt(order.buyAmount), buyTokenDecimals);

  // Calculate USD value based on token type using the order's live price
  if (order.sellToken === WETH_ADDRESS) {
    // WETH -> USDC: sellAmount is in WETH, multiply by live price to get USD value
    return sellAmount * order.livePrice;
  } else if (order.sellToken === USDC_ADDRESS) {
    // USDC -> WETH: sellAmount is in USDC (6 decimals), already in USD
    return sellAmount;
  } else if (order.buyToken === WETH_ADDRESS) {
    // USDC -> WETH: buyAmount is in WETH, multiply by live price to get USD value
    return buyAmount * order.livePrice;
  } else if (order.buyToken === USDC_ADDRESS) {
    // WETH -> USDC: buyAmount is in USDC (6 decimals), already in USD
    return buyAmount;
  } else {
    // Fallback: use sell amount with live price
    return sellAmount * order.livePrice;
  }
};
