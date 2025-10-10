import "./styles.css";
import "./script";
import {
  Transaction,
  Trade,
  DOMElements,
  UIState,
  BinancePriceData,
} from "./types";
import {
  formatNumber,
  formatCurrency,
  formatPrice,
  formatAmount,
  formatAmountWithDecimals,
  formatTokenAmount,
  formatDatabaseDate,
  formatGasUsed,
  formatGasPrice,
  formatAddress,
  getTokenInfo,
  getTokenInfoSync,
  getTokenInfoAsync,
  getTokenDecimals,
  getTokenSymbol,
  calculateConversionRates,
  formatScientific,
  fetchTokenInfoAndUpdateDOM,
} from "./utils";
import {
  fetchRecentTrades,
  fetchTradesWithPagination,
  fetchTradeByHash,
  checkAPIHealth,
  fetchBinancePrice,
  getBlockTimestamp,
  fetchSolverCompetition,
} from "./api";
// EthereumService is now accessed via API calls to the backend

// Global state
const state: UIState = {
  currentTrade: null,
  trades: [],
  isLoading: false,
  error: null,
  pagination: {
    currentPage: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
    hasMore: true,
  },
  filters: {},
};

// Track the last trade hash to detect new trades
let lastTradeHash: string | null = null;

// Track if there are new trades available on page 1
let hasNewTradesOnPage1: boolean = false;

// EthereumService functionality is now accessed via API calls

// Helper functions for amount calculations
function calculateAmountDifference(
  expectedAmount: string | undefined,
  realAmount: string | undefined,
  symbol: string
): string {
  if (!expectedAmount || !realAmount) return "0 " + symbol;

  const expected = parseFloat(expectedAmount);
  const real = parseFloat(realAmount);
  const difference = real - expected;

  if (difference > 0) {
    return `+${difference.toFixed(6)} ${symbol}`;
  } else if (difference < 0) {
    return `${difference.toFixed(6)} ${symbol}`;
  } else {
    return `0 ${symbol}`;
  }
}

function calculateAmountDifferenceClass(
  expectedAmount: string | undefined,
  realAmount: string | undefined
): string {
  if (!expectedAmount || !realAmount) return "";

  const expected = parseFloat(expectedAmount);
  const real = parseFloat(realAmount);
  const difference = real - expected;

  if (difference > 0) {
    return "positive-difference";
  } else {
    return "negative-difference";
  }
}

function calculateTradeRate(
  sellAmount: string | undefined,
  buyAmount: string | undefined,
  sellSymbol: string,
  buySymbol: string
): string {
  if (!sellAmount || !buyAmount) return "N/A";

  const sell = parseFloat(sellAmount);
  const buy = parseFloat(buyAmount);

  if (sell === 0) return "N/A";

  const rate = buy / sell;
  return `1 ${sellSymbol} = ${rate.toFixed(6)} ${buySymbol}`;
}

async function fetchAndDisplayBinancePrices(
  trade: Transaction,
  sellToken: any,
  buyToken: any
): Promise<void> {
  try {
    console.log(
      `🔍 Fetching Binance prices for ${sellToken.symbol}/${buyToken.symbol} pair`
    );

    // Show initial loading state with simple message
    await updateBinanceUIElements(
      trade.hash,
      sellToken.symbol,
      buyToken,
      "Loading...",
      "Loading...",
      false,
      'fetch-failed',
      undefined
    );

    // Try to fetch Binance price data
    const blockTimestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
    console.log('🕐 Block timestamp for trade:', blockTimestamp);
    
    // Create a polling progress updater
    let pollingAttempt = 0;
    const updatePollingProgress = async () => {
      pollingAttempt++;
      await updateBinanceUIElements(
        trade.hash,
        sellToken.symbol,
        buyToken,
        "Loading...",
        "Loading...",
        false,
        'fetch-failed',
        undefined
      );
    };

    const binanceData = await fetchBinancePrice(
      sellToken.symbol,
      buyToken.symbol,
      blockTimestamp,
      updatePollingProgress
    );

    if (
      binanceData.result &&
      binanceData.result.close &&
      binanceData.result.close > 0
    ) {
      const binanceRate = binanceData.result.close.toFixed(6);
      const priceDiff = await calculatePriceDifference(
        trade,
        binanceData.result.close
      );

      // Update the UI with Binance data - use a more robust element finding approach
      await updateBinanceUIElements(
        trade.hash,
        sellToken.symbol,
        buyToken,
        binanceRate,
        priceDiff,
        false,
        'fetch-failed',
        binanceData
      );

      // Show success toast
      showToast(
        `Binance prices loaded for ${sellToken.symbol}/${buyToken.symbol} pair`,
        "success"
      );
    } else {
      // No price data available
      showToast(
        `No Binance price data available for ${sellToken.symbol}/${buyToken.symbol} pair`,
        "warning"
      );
      await updateBinanceUIElements(
        trade.hash,
        sellToken.symbol,
        buyToken,
        null,
        null,
        false,
        'fetch-failed',
        undefined
      );
    }
  } catch (error) {
    console.error("❌ Error fetching Binance prices:", error);

    // Check if it's a "Pair not found" error to show appropriate message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isPairNotFound = errorMessage.includes('Pair not found');
    const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('Timeout');
    const isRateLimitError = errorMessage.includes('Rate limit') || errorMessage.includes('429');
    
    // Show error toast notification with more specific message
    let toastMessage: string;
    if (isPairNotFound) {
      toastMessage = `Token pair ${sellToken.symbol}/${buyToken.symbol} not found on Binance`;
    } else if (isTimeoutError) {
      toastMessage = `Request timeout for ${sellToken.symbol}/${buyToken.symbol} - please try again`;
    } else if (isRateLimitError) {
      toastMessage = `Rate limit exceeded for ${sellToken.symbol}/${buyToken.symbol} - please wait a moment`;
    } else {
      toastMessage = `Failed to fetch Binance prices for ${sellToken.symbol}/${buyToken.symbol} pair after retries`;
    }
    
    showToast(toastMessage, "error");

    // Show error message in UI with specific error type
    const errorType = isPairNotFound ? 'pair-not-found' : 'fetch-failed';
    await updateBinanceUIElements(
      trade.hash,
      sellToken.symbol,
      buyToken,
      null,
      null,
      true,
      errorType,
      undefined
    );
  }
}

// Helper function to update Binance UI elements with retry logic
async function updateBinanceUIElements(
  tradeHash: string,
  sellSymbol: string,
  buyToken: any,
  binanceRate: string | null,
  priceDiff: string | null,
  isError: boolean = false,
  errorType: string = 'fetch-failed',
  pivotDetails?: BinancePriceData
): Promise<void> {
  const maxRetries = 5;
  const retryDelay = 100; // 100ms between retries

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let binanceRateElement = document.getElementById(
      `binance-rate-${tradeHash}`
    );
    let priceDiffElement = document.getElementById(`price-diff-${tradeHash}`);
    let pivotDetailsElement = document.getElementById(`pivot-details-${tradeHash}`);
    let pivotDetailsContentElement = document.getElementById(`pivot-details-content-${tradeHash}`);

    // If elements not found by ID, try to find them in the current overlay
    if (!binanceRateElement || !priceDiffElement || !pivotDetailsElement || !pivotDetailsContentElement) {
      const currentOverlay = document.querySelector(".trade-info-overlay");
      if (currentOverlay) {
        if (!binanceRateElement) {
          binanceRateElement = currentOverlay.querySelector(
            `[id="binance-rate-${tradeHash}"]`
          ) as HTMLElement;
        }
        if (!priceDiffElement) {
          priceDiffElement = currentOverlay.querySelector(
            `[id="price-diff-${tradeHash}"]`
          ) as HTMLElement;
        }
        if (!pivotDetailsElement) {
          pivotDetailsElement = currentOverlay.querySelector(
            `[id="pivot-details-${tradeHash}"]`
          ) as HTMLElement;
        }
        if (!pivotDetailsContentElement) {
          pivotDetailsContentElement = currentOverlay.querySelector(
            `[id="pivot-details-content-${tradeHash}"]`
          ) as HTMLElement;
        }
      }
    }

    if (binanceRateElement && priceDiffElement) {
      // Elements found, update them
      if (isError || binanceRate === null) {
        // Show different messages based on error type
        if (errorType === 'pair-not-found') {
          binanceRateElement.innerHTML = `Token pair ${sellSymbol}/${buyToken.symbol} not found on Binance`;
        } else {
          binanceRateElement.innerHTML = "No price on Binance for this pair";
        }
        binanceRateElement.className = "info-value no-price-available";
      } else if (binanceRate === "Loading..." || binanceRate === "Loading... (with retry)" || binanceRate === "Loading Binance price..." || binanceRate === "Requesting Binance price..." || binanceRate.startsWith("Processing Binance price...")) {
        binanceRateElement.innerHTML = "Loading";
        binanceRateElement.className = "info-value loading";
      } else {
        binanceRateElement.innerHTML = `1 ${sellSymbol} = ${binanceRate} ${buyToken.symbol}`;
        binanceRateElement.className = "info-value";
      }

      if (priceDiff === "Loading...") {
        priceDiffElement.innerHTML = "Loading";
        priceDiffElement.className = "info-value loading";
      } else if (priceDiff && priceDiff !== "N/A") {
        priceDiffElement.innerHTML = priceDiff;
        priceDiffElement.className = `info-value ${
          priceDiff.includes("+")
            ? "positive-difference"
            : "negative-difference"
        }`;
      } else {
        priceDiffElement.innerHTML = "-";
        priceDiffElement.className = "info-value";
      }

      // Handle pivot details display
      if (pivotDetailsElement && pivotDetailsContentElement) {
        if (pivotDetails && pivotDetails.result && pivotDetails.result.intermediatePairs && pivotDetails.result.intermediatePairs.length > 0) {
          
          try {
            // Validate pivot data structure before processing
            const isValidPivotData = pivotDetails.result.intermediatePairs.every((pair: any) => 
              pair && 
              pair.price && 
              typeof pair.price.close === 'number' && 
              !isNaN(pair.price.close) &&
              pair.symbol &&
              pair.direction &&
              pair.stepNumber !== undefined
            );

            if (!isValidPivotData) {
              console.warn("Invalid pivot data structure, hiding pivot details section");
              pivotDetailsElement.style.display = "none";
              return;
            }

            // Show pivot details section only when we have valid data
            pivotDetailsElement.style.display = "block";
            
            // Generate pivot details content
            let pivotContent = "";
            pivotDetails.result.intermediatePairs.forEach((pair: any, index: number) => {
              try {
                const price = pair.price.close.toFixed(6);
                const direction = pair.direction === "forward" ? "→" : "←";
                const stepNumber = pair.stepNumber;
                
                // For reverse direction pairs, we need to show the inverse price
                let displayPrice;
                if (pair.direction === "reverse") {
                  // For reverse pairs like PENDLE/BTC, show BTC price in terms of PENDLE
                  displayPrice = `1 ${pair.quoteAsset} = ${price} ${pair.baseAsset}`;
                } else {
                  // For forward pairs like AAVE/BTC, show normal price
                  displayPrice = `1 ${pair.baseAsset} = ${price} ${pair.quoteAsset}`;
                }
                
                pivotContent += `
                  <div class="pivot-step">
                    <div class="pivot-step-header">
                      <span class="pivot-step-number">Step ${stepNumber}</span>
                      <span class="pivot-direction">${direction}</span>
                    </div>
                    <div class="pivot-pair-info">
                      <span class="pivot-symbol">${pair.symbol}</span>
                      <span class="pivot-price">${displayPrice}</span>
                    </div>
                  </div>
                `;
              } catch (pairError) {
                console.warn(`Error processing pivot pair ${index}:`, pairError);
                // Skip this pair and continue with others
              }
            });

            // Calculate final result with error handling
            try {
              let prices = pivotDetails.result.intermediatePairs
                .filter((pair: any) => pair && pair.price && typeof pair.price.close === 'number' && !isNaN(pair.price.close))
                .map((pair: any) => pair.price.close.toFixed(6));

              if (prices.length === 0) {
                throw new Error("No valid prices found for calculation");
              }

              let result = prices.reduce((acc: number, price: string) => acc * parseFloat(price), 1);
              
              // Only add calculation step if we have valid prices
              if (prices.length > 0) {
                pivotContent += `
                  <div class="pivot-step">
                      <div class="pivot-step-header">
                        <span class="pivot-step-number">Calculation</span>
                      </div>
                      <div class="pivot-pair-info">
                        <span class="pivot-symbol">${pivotDetails.result.calculationPath?.[0] || 'N/A'}${pivotDetails.result.calculationPath?.[pivotDetails.result.calculationPath?.length - 1] || 'N/A'}</span>
                        <span class="pivot-price">${prices.join(" x ")} = ${result.toFixed(6)}</span>
                      </div>
                  </div>
                `;
              }
              
              pivotDetailsContentElement.innerHTML = pivotContent;
            } catch (calcError) {
              console.warn("Error in pivot calculation:", calcError);
              // Hide pivot details section on calculation error
              pivotDetailsElement.style.display = "none";
            }
          } catch (pivotError) {
            console.warn("Error processing pivot details:", pivotError);
            // Hide pivot details section on any error
            pivotDetailsElement.style.display = "none";
          }
        } else {
          // Hide pivot details section when no data
          pivotDetailsElement.style.display = "none";
        }
      }

      console.log(
        `✅ Binance UI elements updated successfully on attempt ${attempt + 1}`
      );
      return;
    }

    // Elements not found, wait and retry
    if (attempt < maxRetries - 1) {
      console.log(
        `⏳ Binance UI elements not found on attempt ${
          attempt + 1
        }, retrying in ${retryDelay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // If we get here, elements were never found
  console.warn(
    `⚠️ Could not find Binance UI elements for trade ${tradeHash} after ${maxRetries} attempts`
  );
  showToast(
    `Could not update Binance price display for trade ${tradeHash.substring(
      0,
      8
    )}...`,
    "warning"
  );
}

async function calculatePriceDifference(
  trade: Transaction,
  binanceRate: number
): Promise<string> {
  if (!trade.sellToken || !trade.buyToken) return "N/A";
  
  const executedBuyAmount = await formatTokenAmount(trade.executedBuyAmount || trade.executedAmount, trade.buyToken);
  const executedSellAmount = await formatTokenAmount(trade.executedSellAmount || trade.realSellAmount, trade.sellToken);

  const buyAmountNum = parseFloat(executedBuyAmount);
  const sellAmountNum = parseFloat(executedSellAmount);

  if (buyAmountNum === 0 || sellAmountNum === 0) return "N/A";

  const tradeRate = buyAmountNum / sellAmountNum;
  const difference = ((tradeRate - binanceRate) / binanceRate) * 100;

  if (difference > 0) {
    return `+${difference.toFixed(2)}% (Better than Binance)`;
  } else if (difference < 0) {
    return `${difference.toFixed(2)}% (Worse than Binance)`;
  } else {
    return "0.00% (Same as Binance)";
  }
}

/**
 * Fetch and display solver competition data in the trade info frame
 */
async function fetchAndDisplaySolverCompetition(txHash: string): Promise<void> {
  const competitionContent = document.getElementById(`competition-content-${txHash}`);
  if (!competitionContent) {
    console.warn(`Could not find competition content element for trade ${txHash}`);
    return;
  }

  try {
    console.log(`🔍 Fetching solver competition data for ${txHash}`);
    
    const competitionData = await fetchSolverCompetition(txHash);
    
    if (!competitionData || !competitionData.solutions || competitionData.solutions.length === 0) {
      competitionContent.innerHTML = `
        <div class="no-competition-data">
          <i class="fas fa-info-circle"></i>
          <span>No solver competition data available for this transaction</span>
        </div>
      `;
      return;
    }

    // Sort solutions by ranking (1 = best, higher numbers = worse)
    const sortedSolutions = [...competitionData.solutions].sort((a, b) => {
      const rankA = a.ranking || Number.MAX_SAFE_INTEGER;
      const rankB = b.ranking || Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    // Create the competition display
    competitionContent.innerHTML = `
      <div class="competition-summary">
        <div class="competition-header">
          <div class="competition-info">
            <span class="competition-label">Auction ID:</span>
            <span class="competition-value">${competitionData.auctionId || 'N/A'}</span>
          </div>
          
           <div class="competition-info order-id-info">
             <span class="competition-label">Order ID:</span>
             <a href="https://explorer.cow.fi/arb1/orders/${competitionData.solutions[0].orders[0].id}" target="_blank" class="order-id-link">
               ${formatAddress(competitionData.solutions[0].orders[0].id)}
             </a>
           </div>
          
          <div class="competition-info">
            <span class="competition-label">Total Solvers:</span>
            <span class="competition-value">${competitionData.solutions.length}</span>
          </div>
        </div>
        
        <div class="solutions-summary">
          ${(await Promise.all(sortedSolutions.map(async (solution: any, index: number) => {
            // Calculate total buy amount across all orders
            let totalBuyAmount = '0';
            let buyTokenAddress = '';
            let formattedBuyAmount = 'N/A';
            
            if (solution.orders && solution.orders.length > 0) {
              // Sum up all buy amounts from orders
              totalBuyAmount = solution.orders.reduce((sum: bigint, order: any) => {
                return sum + BigInt(order.buyAmount || '0');
              }, BigInt(0)).toString();
              // Use the buy token from the first order (assuming all orders use the same buy token)
              buyTokenAddress = solution.orders[0].buyToken;
              
              if (totalBuyAmount !== '0' && buyTokenAddress) {
                try {
                  // Get token info to get the correct decimals
                  const tokenInfo = await getTokenInfoAsync(buyTokenAddress as `0x${string}`);
                  formattedBuyAmount = formatAmount(totalBuyAmount, tokenInfo.decimals);
                } catch (error) {
                  console.warn(`Failed to get token info for ${buyTokenAddress}:`, error);
                  // Fallback to using 6 decimals (common for USDC-like tokens)
                  formattedBuyAmount = formatAmount(totalBuyAmount, 6);
                }
              }
            }
            
            return `
            <div class="solution-summary-card ${solution.isWinner ? 'winner' : ''}">
              <div class="solution-header">
                <div class="solution-rank">
                  <span class="rank-number">#${index + 1}</span>
                  ${solution.isWinner ? '<span class="winner-badge">🏆 Winner</span>' : ''}
                </div>
                <div class="solution-address">
                  <a href="https://etherscan.io/address/${solution.solverAddress}" target="_blank" class="address-link">
                    ${formatAddress(solution.solverAddress)}
                  </a>
                </div>
              </div>
              <div class="solution-metrics">
                <div class="metric">
                  <span class="metric-label">Score:</span>
                  <span class="metric-value">${solution.score || 'N/A'}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Ranking:</span>
                  <span class="metric-value">${solution.ranking || 'N/A'}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Buy Amount:</span>
                  <span class="metric-value">${formattedBuyAmount}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Status:</span>
                  <span class="metric-value ${solution.filteredOut ? 'filtered' : 'active'}">
                    ${solution.filteredOut ? 'Filtered' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
            `;
          }))).join("")}
        </div>
      </div>
    `;

    console.log(`✅ Solver competition data displayed for ${txHash}`);
    
  } catch (error) {
    console.error(`❌ Error fetching solver competition data for ${txHash}:`, error);
    
    competitionContent.innerHTML = `
      <div class="competition-error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Failed to load solver competition data</span>
        <small>${error instanceof Error ? error.message : 'Unknown error'}</small>
      </div>
    `;
  }
}

// DOM elements cache
let elements: DOMElements;

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log("🚀 Initializing CoW Protocol Trade Visualizer...");

  // Cache DOM elements
  elements = {
    tradesGrid: document.getElementById("tradesGrid") as HTMLElement,
    tradesCount: document.getElementById("tradesCount") as HTMLElement,
    tradeDetailsSection: document.getElementById(
      "tradeDetailsSection"
    ) as HTMLElement,
    filterContainer: document.getElementById("filterContent") as HTMLElement,
    filterForm: document.getElementById("filterForm") as HTMLElement,
    startDateInput: document.getElementById("startDate") as HTMLInputElement,
    endDateInput: document.getElementById("endDate") as HTMLInputElement,
    sellTokenInput: document.getElementById("sellToken") as HTMLInputElement,
    buyTokenInput: document.getElementById("buyToken") as HTMLInputElement,
    clearFiltersButton: document.getElementById("clearFiltersButton") as HTMLButtonElement,
    applyFiltersButton: document.getElementById("applyFiltersButton") as HTMLButtonElement,
  };

  // Set up event listeners
  setupEventListeners();
  
  // Initialize filters
  initializeFilters();
  
  // Add manual refresh button
  addManualRefreshButton();

  // Check API health
  const isHealthy = await checkAPIHealth();
  if (!isHealthy) {
    console.warn(
      "⚠️ API server is not running. Please start the backend server."
    );
    showError(
      "Backend server is not running. Please start the server with: npm run server:dev"
    );
    return;
  }

  // Load initial data
  await loadTrades(1);
  
  // Update filter display
  updateFilterDisplay();
}

/**
 * Add a manual refresh button to the UI
 */
function addManualRefreshButton(): void {
  // Find the trades count element to add the button next to it
  const tradesCountElement = document.getElementById("tradesCount");
  if (!tradesCountElement) {
    console.warn("⚠️ Could not find tradesCount element to add refresh button");
    return;
  }

  // Create refresh button
  const refreshButton = document.createElement("button");
  refreshButton.id = "manualRefreshButton";
  refreshButton.className = "refresh-button";
  refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
  refreshButton.title = "Manually refresh trades list";
  
  // Add click event listener
  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    
    try {
      await loadTrades(1); // Go to page 1
      showToast("Trades list refreshed", "success");
    } catch (error) {
      console.error("❌ Error during manual refresh:", error);
      showToast("Failed to refresh trades list", "error");
    } finally {
      refreshButton.disabled = false;
      refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
  });

  // Insert the button after the trades count
  tradesCountElement.parentNode?.insertBefore(refreshButton, tradesCountElement.nextSibling);
  
  console.log("✅ Manual refresh button added");
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Auto-refresh disabled - user must manually refresh using the refresh button
  console.log("✅ Event listeners set up - auto-refresh disabled");
}

/**
 * Initialize filter functionality
 */
function initializeFilters(): void {
  console.log("🔧 Initializing filters...");
  
  // Toggle filters visibility
  const toggleButton = document.getElementById("toggleFiltersButton");
  if (toggleButton) {
    toggleButton.addEventListener("click", toggleFilters);
  }
  
  // Filter form submission
  if (elements.filterForm) {
    elements.filterForm.addEventListener("submit", handleFilterSubmit);
  }
  
  // Clear filters button
  if (elements.clearFiltersButton) {
    elements.clearFiltersButton.addEventListener("click", clearFilters);
  }
  
  console.log("✅ Filters initialized");
}

/**
 * Toggle filters visibility
 */
function toggleFilters(): void {
  const filterContent = elements.filterContainer;
  const toggleButton = document.getElementById("toggleFiltersButton");
  
  if (!filterContent || !toggleButton) return;
  
  const isVisible = filterContent.style.display !== "none";
  
  if (isVisible) {
    filterContent.style.display = "none";
    toggleButton.classList.remove("expanded");
  } else {
    filterContent.style.display = "block";
    toggleButton.classList.add("expanded");
  }
}

/**
 * Handle filter form submission
 */
async function handleFilterSubmit(event: Event): Promise<void> {
  event.preventDefault();
  
  console.log("🔍 Applying filters...");
  
  // Collect filter values
  const filters = {
    startDate: elements.startDateInput?.value || undefined,
    endDate: elements.endDateInput?.value || undefined,
    sellToken: elements.sellTokenInput?.value?.trim().toUpperCase() || undefined,
    buyToken: elements.buyTokenInput?.value?.trim().toUpperCase() || undefined,
  };
  
  // Validate date range
  if (filters.startDate && filters.endDate) {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    if (startDate > endDate) {
      showToast("Start date must be before end date", "error");
      return;
    }
  }
  
  // Remove empty values
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== undefined && value !== "")
  );
  
  console.log("🔍 Applied filters:", cleanFilters);
  
  // Update state
  state.filters = cleanFilters;
  
  // Reset to page 1 when applying filters
  state.pagination.currentPage = 1;
  
  // Load trades with new filters
  await loadTrades(1);
  
  // Update filter display
  updateFilterDisplay();
  
  // Show success message
  showToast("Filters applied successfully", "success");
}

/**
 * Clear all filters
 */
async function clearFilters(): Promise<void> {
  console.log("🧹 Clearing filters...");
  
  // Clear form inputs
  if (elements.startDateInput) elements.startDateInput.value = "";
  if (elements.endDateInput) elements.endDateInput.value = "";
  if (elements.sellTokenInput) elements.sellTokenInput.value = "";
  if (elements.buyTokenInput) elements.buyTokenInput.value = "";
  
  // Clear state
  state.filters = {};
  
  // Reset to page 1
  state.pagination.currentPage = 1;
  
  // Load trades without filters
  await loadTrades(1);
  
  // Update filter display
  updateFilterDisplay();
  
  // Show success message
  showToast("Filters cleared successfully", "success");
}

/**
 * Update filter display to show active filters
 */
function updateFilterDisplay(): void {
  const filterHeader = document.querySelector('.filters-card .card-header h2') as HTMLElement;
  if (!filterHeader) return;
  
  const activeFilters = Object.keys(state.filters).length;
  
  if (activeFilters > 0) {
    filterHeader.innerHTML = `<i class="fas fa-filter"></i> Filters (${activeFilters} active)`;
    filterHeader.style.color = '#4ade80'; // Green color for active filters
  } else {
    filterHeader.innerHTML = `<i class="fas fa-filter"></i> Filters`;
    filterHeader.style.color = 'white'; // Default white color
  }
}

/**
 * Load trades from API for a specific page with filters
 */
async function loadTrades(page: number = 1): Promise<void> {
  try {
    state.isLoading = true;
    state.error = null;

    // Set the current page
    state.pagination.currentPage = page;
    const offset = (page - 1) * state.pagination.pageSize;
    
    console.log(`📡 Fetching trades (page ${page}, offset ${offset})...`);
    console.log(`🔍 Current filters:`, state.filters);
    
    const result = await fetchTradesWithPagination(state.pagination.pageSize, offset, state.filters);

    console.log(`🔍 Fetched ${result.trades.length} trades from API`);

    // Debug: Log the first trade structure to understand the data
    if (result.trades.length > 0) {
      console.log(
        "🔍 First trade structure:",
        JSON.stringify(result.trades[0], null, 2)
      );
    }

    // Always replace trades with the new page's data
    state.trades = result.trades;
    
    // Update pagination state
    state.pagination.total = result.pagination.total;
    state.pagination.totalPages = result.pagination.totalPages || Math.ceil(result.pagination.total / state.pagination.pageSize);
    state.pagination.hasMore = result.pagination.hasMore;
    
    // Set the last trade hash for future comparisons
    if (result.trades.length > 0) {
      lastTradeHash = result.trades[0].hash;
    }
    
    await populateTradesList();
  } catch (error) {
    console.error("❌ Error loading trades:", error);
    state.error = error instanceof Error ? error.message : "Unknown error";
    showError("Failed to load trades");
  } finally {
    state.isLoading = false;
  }
}

/**
 * Check for new trades and update UI only if new trades are found
 */
async function checkForNewTrades(): Promise<void> {
  try {
    console.log("🔍 Checking for new trades...");
    const result = await fetchTradesWithPagination(50, 0);
    const trades = result.trades;

    if (trades.length === 0) {
      console.log("📭 No trades found");
      return;
    }

    // Check if there are new trades by comparing the first trade hash
    const currentFirstTradeHash = trades[0].hash;
    
    if (lastTradeHash === null) {
      // First time loading, set the hash and don't update UI
      lastTradeHash = currentFirstTradeHash;
      console.log("🔄 First load, setting initial trade hash");
      return;
    }

    if (currentFirstTradeHash === lastTradeHash) {
      console.log("✅ No new trades found, skipping UI update");
      return;
    }

    // New trades found! Update the state and UI
    console.log(`🆕 New trades detected! Previous: ${lastTradeHash}, Current: ${currentFirstTradeHash}`);
    
    // Find new trades (trades that weren't in the previous list)
    const newTrades = trades.filter(trade => {
      return !state.trades.some(existingTrade => existingTrade.hash === trade.hash);
    });

    if (newTrades.length > 0) {
      console.log(`🆕 Found ${newTrades.length} new trades, updating UI`);
      
      // Only update if user is on page 1
      if (state.pagination.currentPage === 1) {
        // Update state with new trades
        state.trades = trades;
        lastTradeHash = currentFirstTradeHash;
        
        // Update pagination state
        state.pagination.total = result.pagination.total;
        state.pagination.totalPages = result.pagination.totalPages || Math.ceil(result.pagination.total / state.pagination.pageSize);
        
        // Rebuild the trades list
        await populateTradesList();
        
        // Show a subtle notification about new trades
        showToast(`${newTrades.length} new trade${newTrades.length > 1 ? 's' : ''} found`, "info");
      } else {
        // User is on a different page, just update the hash and show notification
        lastTradeHash = currentFirstTradeHash;
        hasNewTradesOnPage1 = true;
        showToast(`${newTrades.length} new trade${newTrades.length > 1 ? 's' : ''} available on page 1`, "info");
        
        // Update pagination controls to show the indicator
        updatePaginationControls();
      }
    } else {
      // Update the hash even if no new trades were added (in case of reordering)
      lastTradeHash = currentFirstTradeHash;
    }

  } catch (error) {
    console.error("❌ Error checking for new trades:", error);
    // Don't show error to user for background checks, just log it
  }
}

/**
 * Go to a specific page
 */
async function goToPage(page: number): Promise<void> {
  if (page < 1 || page > state.pagination.totalPages || state.isLoading) {
    return;
  }

  try {
    console.log(`📡 Going to page ${page}...`);
    await loadTrades(page);

    // Clear the new trades indicator when user goes to page 1
    if (page === 1) {
      hasNewTradesOnPage1 = false;
    }

    console.log(`✅ Loaded page ${page}. Showing ${state.trades.length} trades`);
  } catch (error) {
    console.error("❌ Error loading page:", error);
    showToast("Failed to load page", "error");
  }
}

/**
 * Go to next page
 */
async function goToNextPage(): Promise<void> {
  if (state.pagination.currentPage < state.pagination.totalPages) {
    await goToPage(state.pagination.currentPage + 1);
  }
}

/**
 * Go to previous page
 */
async function goToPreviousPage(): Promise<void> {
  if (state.pagination.currentPage > 1) {
    await goToPage(state.pagination.currentPage - 1);
  }
}

/**
 * Populate trades list in the UI
 */
async function populateTradesList(): Promise<void> {
  console.log("🔍 Populating trades list...");

  if (!elements.tradesGrid) {
    console.error("❌ tradesGrid element not found!");
    return;
  }

  // Clear existing content
  elements.tradesGrid.innerHTML = `
    <table class="trades-table">
      <thead>
        <tr>
          <th>Transaction Hash</th>
          <th>Status</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Block</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  `;

  // Update trades count with pagination info
  const totalDisplay = state.pagination.total > 0 ? state.pagination.total : state.trades.length;
  elements.tradesCount.textContent = `${state.trades.length} of ${totalDisplay} trades`;

  // Get the tbody element
  const tbody = elements.tradesGrid.querySelector("tbody");
  if (!tbody) {
    console.error("❌ tbody element not found!");
    return;
  }

  // Check if there are any trades to display
  if (state.trades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-trades-message">
          <div style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 16px;"></i>
            <p>No trades found in the database.</p>
            <p>Run the historical sync script to populate the database with CoW Protocol trades.</p>
            <p><small>Use: npm run sync:historical:ts</small></p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Use for...of instead of forEach for async operations
  for (let index = 0; index < state.trades.length; index++) {
    const trade = state.trades[index];
    console.log(`🔍 Creating trade row ${index}`);
    const tradeRow = await createTradeTableRow(trade, index);
    console.log(`🔍 Appending trade row ${index} to table:`, tradeRow);

    // Debug: Check if tbody exists and is valid
    console.log(`🔍 tbody element before append:`, tbody);
    console.log(
      `🔍 tbody children count before append:`,
      tbody.children.length
    );

    tbody.appendChild(tradeRow);

    // Debug: Check if append was successful
    console.log(`🔍 tbody children count after append:`, tbody.children.length);
    console.log(`🔍 Last child in tbody:`, tbody.lastElementChild);

    console.log(`🔍 Trade row ${index} appended successfully`);
  }

  console.log(
    `🔍 Finished populating trades list. Grid now has ${elements.tradesGrid.children.length} children`
  );

  // Debug: Check the final table structure
  const table = elements.tradesGrid.querySelector("table");
  if (table) {
    const tbody = table.querySelector("tbody");
    if (tbody) {
      console.log(`🔍 Final table tbody has ${tbody.children.length} children`);
      console.log(`🔍 Final table HTML:`, table.outerHTML);
    } else {
      console.error(`❌ No tbody found in table`);
    }
  } else {
    console.error(`❌ No table found in tradesGrid`);
  }

  // Add pagination controls
  await addPaginationControls();
}

/**
 * Add pagination controls to the UI
 */
async function addPaginationControls(): Promise<void> {
  // Remove existing pagination controls
  const existingControls = document.querySelector('.pagination-controls');
  if (existingControls) {
    existingControls.remove();
  }

  // Only add controls if there are trades
  if (state.trades.length === 0) {
    return;
  }

  // Create pagination controls container
  const paginationContainer = document.createElement('div');
  paginationContainer.className = 'pagination-controls';

  // Create pagination info
  const paginationInfo = document.createElement('div');
  paginationInfo.className = 'pagination-info';
  const totalDisplay = state.pagination.total > 0 ? state.pagination.total : 'Unknown';
  paginationInfo.innerHTML = `
    <span class="pagination-text">
      Showing ${state.trades.length} of ${totalDisplay} trades
    </span>
    <span class="pagination-page">
      Page ${state.pagination.currentPage} of ${state.pagination.totalPages}
    </span>
  `;

  // Create navigation controls
  const navigationControls = document.createElement('div');
  navigationControls.className = 'pagination-navigation';

  // Previous button
  const prevButton = document.createElement('button');
  prevButton.className = 'pagination-nav-button';
  prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
  prevButton.disabled = state.pagination.currentPage <= 1;
  prevButton.addEventListener('click', goToPreviousPage);

  // Next button
  const nextButton = document.createElement('button');
  nextButton.className = 'pagination-nav-button';
  nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
  nextButton.disabled = state.pagination.currentPage >= state.pagination.totalPages;
  nextButton.addEventListener('click', goToNextPage);

  // Page numbers (show up to 5 pages around current page)
  const pageNumbers = document.createElement('div');
  pageNumbers.className = 'pagination-numbers';
  
  const startPage = Math.max(1, state.pagination.currentPage - 2);
  const endPage = Math.min(state.pagination.totalPages, state.pagination.currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.className = `pagination-page-button ${i === state.pagination.currentPage ? 'active' : ''}`;
    
    // Add indicator for page 1 if there are new trades
    if (i === 1 && hasNewTradesOnPage1 && state.pagination.currentPage !== 1) {
      pageButton.innerHTML = `1 <span class="new-trades-indicator">●</span>`;
    } else {
      pageButton.textContent = i.toString();
    }
    
    pageButton.addEventListener('click', () => goToPage(i));
    pageNumbers.appendChild(pageButton);
  }

  // Add elements to navigation controls
  navigationControls.appendChild(prevButton);
  navigationControls.appendChild(pageNumbers);
  navigationControls.appendChild(nextButton);

  // Add elements to container
  paginationContainer.appendChild(paginationInfo);
  paginationContainer.appendChild(navigationControls);

  // Add to the trades grid container
  if (elements.tradesGrid && elements.tradesGrid.parentNode) {
    elements.tradesGrid.parentNode.insertBefore(paginationContainer, elements.tradesGrid.nextSibling);
  }

  // Cache the elements for future updates
  elements.paginationInfo = paginationInfo;
  elements.paginationControls = paginationContainer;

  console.log('✅ Pagination controls added');
}

/**
 * Update pagination controls after loading more data
 */
async function updatePaginationControls(): Promise<void> {
  // Update trades count
  const totalDisplay = state.pagination.total > 0 ? state.pagination.total : state.trades.length;
  if (elements.tradesCount) {
    elements.tradesCount.textContent = `${state.trades.length} of ${totalDisplay} trades`;
  }

  // Update pagination info
  if (elements.paginationInfo) {
    const totalDisplay = state.pagination.total > 0 ? state.pagination.total : 'Unknown';
    elements.paginationInfo.innerHTML = `
      <span class="pagination-text">
        Showing ${state.trades.length} of ${totalDisplay} trades
      </span>
      <span class="pagination-page">
        Page ${state.pagination.currentPage} of ${state.pagination.totalPages}
      </span>
    `;
  }

  // Update navigation controls
  const navigationControls = document.querySelector('.pagination-navigation');
  if (navigationControls) {
    // Update previous button
    const prevButton = navigationControls.querySelector('.pagination-nav-button:first-child') as HTMLButtonElement;
    if (prevButton) {
      prevButton.disabled = state.pagination.currentPage <= 1;
    }

    // Update next button
    const nextButton = navigationControls.querySelector('.pagination-nav-button:last-child') as HTMLButtonElement;
    if (nextButton) {
      nextButton.disabled = state.pagination.currentPage >= state.pagination.totalPages;
    }

    // Update page numbers
    const pageNumbers = navigationControls.querySelector('.pagination-numbers');
    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      
      const startPage = Math.max(1, state.pagination.currentPage - 2);
      const endPage = Math.min(state.pagination.totalPages, state.pagination.currentPage + 2);
      
      for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-page-button ${i === state.pagination.currentPage ? 'active' : ''}`;
        
        // Add indicator for page 1 if there are new trades
        if (i === 1 && hasNewTradesOnPage1 && state.pagination.currentPage !== 1) {
          pageButton.innerHTML = `1 <span class="new-trades-indicator">●</span>`;
        } else {
          pageButton.textContent = i.toString();
        }
        
        pageButton.addEventListener('click', () => goToPage(i));
        pageNumbers.appendChild(pageButton);
      }
    }
  }

  // No load more button to update

  console.log('✅ Pagination controls updated');
}

/**
 * Create a trade table row element
 */
async function createTradeTableRow(
  trade: Transaction,
  index: number
): Promise<HTMLElement> {
  console.log(`🔍 Creating trade table row for index ${index}:`, trade);

  const row = document.createElement("tr");
  row.className = "trade-table-row";
  row.dataset.index = index.toString();

  // Check if this is a simplified trade structure (flat fields) or old parsedData structure
  console.log(`🔍 Trade ${index} structure check:`, {
    hasBuyAmount: !!trade.buyAmount,
    hasSellToken: !!trade.sellToken,
    hasBuyToken: !!trade.buyToken,
    buyAmount: trade.buyAmount,
    sellToken: trade.sellToken,
    buyToken: trade.buyToken,
  });

  if (trade.buyAmount && trade.sellToken && trade.buyToken) {
    // This is a simplified trade structure with flat fields
    console.log(`🔍 Trade ${index} simplified structure:`, trade);

    try {
      console.log(`🔍 Starting token info fetch for trade ${index}...`);
      console.log(`🔍 Sell token address: ${trade.sellToken}`);
      console.log(`🔍 Buy token address: ${trade.buyToken}`);

      // Get instant token info (will show addresses if not cached)
      const sellToken = getTokenInfoSync(trade.sellToken);
      const buyToken = getTokenInfoSync(trade.buyToken);
      console.log(`✅ Token info loaded (sync):`, { sellToken, buyToken });

      console.log(`🔍 Trade ${index} token info:`, { sellToken, buyToken });

      // Format amounts properly using token decimals
      // Based on new database structure: amounts are in wei format, need to divide by decimals
      const expectedSellAmount = await formatTokenAmount(trade.sellAmount, trade.sellToken);
      const expectedBuyAmount = await formatTokenAmount(trade.buyAmount, trade.buyToken);
      const executedBuyAmount = await formatTokenAmount(trade.executedBuyAmount, trade.buyToken);
      const executedSellAmount = await formatTokenAmount(trade.executedSellAmount, trade.sellToken);

      // Handle creationDate - it might be a Date object or a string from the database
      let localeString: string;
      if (trade.creationDate) {
        const formattedDate = formatDatabaseDate(trade.creationDate);
        console.log('🔍 Formatted creation date:', formattedDate);
        if (formattedDate !== 'No Date' && formattedDate !== 'Invalid Date') {
          localeString = formattedDate;
        } else {
          // Fallback to block timestamp if date is invalid
          const blockTimestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
          console.log('🔍 Block timestamp from API:', blockTimestamp);
          console.log('🔍 Block number:', trade.blockNumber);
          localeString = timestampToDateTime(blockTimestamp);
        }
      } else {
        // No creationDate, use block timestamp
        const blockTimestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
        console.log('🔍 No creation date, using block timestamp:', blockTimestamp);
        console.log('🔍 Block number:', trade.blockNumber);
        localeString = timestampToDateTime(blockTimestamp);
      }

      console.log('🔍 Trade creation date:', trade.creationDate);
      console.log('🔍 Locale string:', localeString); 

      row.innerHTML = `
        <td class="trade-hash">${formatAddress(trade.hash || "Unknown")}</td>
        <td class="trade-status success">Success</td>
        <td class="trade-amount">
          ${executedSellAmount} <span data-token-address="${trade.sellToken}" data-token-field="symbol">${sellToken.symbol}</span> → ${executedBuyAmount} <span data-token-address="${trade.buyToken}" data-token-field="symbol">${
        buyToken.symbol
      }</span>
        </td>
        <td class="trade-date">${localeString}</td>
        <td class="trade-block">${trade.blockNumber || "Unknown"}</td>
      `;

      // Asynchronously fetch token metadata and update all tagged elements
      fetchTokenInfoAndUpdateDOM(trade.sellToken);
      fetchTokenInfoAndUpdateDOM(trade.buyToken);
    } catch (error) {
      console.error(`❌ Error getting token info for trade ${index}:`, error);
      // Fallback to basic display if token info fails
      row.innerHTML = `
        <td class="trade-hash">${formatAddress(trade.hash || "Unknown")}</td>
        <td class="trade-status success">Success</td>
        <td class="trade-amount">Token Info Missing</td>
        <td class="trade-date">${timestampToDateTime(
          await getBlockTimestamp(parseInt(trade.blockNumber))
        )}</td>
        <td class="trade-block">${trade.blockNumber || "Unknown"}</td>
      `;
    }

    console.log(
      `🔍 Adding click listener to trade row ${index} (simplified structure)`
    );
    row.addEventListener("click", () => {
      console.log(`🖱️ Trade row ${index} clicked (simplified structure)`);
      showTradeDetails(trade);
    });


    console.log(`🔍 Trade row ${index} HTML content:`, row.innerHTML);
    console.log(`🔍 Trade row ${index} element:`, row);
    console.log(`🔍 Trade row ${index} ready to return`);

    return row;
  } else if (
    !trade.parsedData ||
    !trade.parsedData.trades ||
    trade.parsedData.trades.length === 0
  ) {
    // Handle case where trade data is not available
    row.innerHTML = `
      <td class="trade-hash">${formatAddress(trade.hash || "Unknown")}</td>
      <td class="trade-status ${trade.status || "unknown"}">${
      trade.status || "Unknown"
    }</td>
      <td class="trade-amount">- → -</td>
      <td class="trade-date">${timestampToDateTime(
        await getBlockTimestamp(parseInt(trade.blockNumber))
      )}</td>
      <td class="trade-block">${trade.blockNumber || "Unknown"}</td>
    `;

    console.log(`🔍 Adding click listener to trade row ${index} (no data)`);
    row.addEventListener("click", () => {
      console.log(`🖱️ Trade row ${index} clicked (no data)`);
      showTradeDetails(trade);
    });


    return row;
  } else {
    // Handle old parsedData structure
    const tradeData = trade.parsedData.trades[0];
    console.log(`🔍 Trade ${index} tradeData:`, tradeData);

    // Add defensive checks for trade data
    if (
      !tradeData.sellToken ||
      !tradeData.buyToken ||
      !tradeData.sellAmount ||
      !tradeData.buyAmount
    ) {
      console.warn(`⚠️ Trade ${index} missing required data:`, tradeData);
      row.innerHTML = `
        <td class="trade-hash">${formatAddress(trade.hash || "Unknown")}</td>
        <td class="trade-status ${trade.status || "unknown"}">${
        trade.status || "Unknown"
      }</td>
        <td class="trade-amount">Incomplete Data</td>
        <td class="trade-date">${timestampToDateTime(
          await getBlockTimestamp(parseInt(trade.blockNumber))
        )}</td>
        <td class="trade-block">${trade.blockNumber || "Unknown"}</td>
      `;
      
      
      return row;
    }

    // Get instant token info (will show addresses if not cached)
    const sellToken = getTokenInfoSync(tradeData.sellToken as `0x${string}`);
    const buyToken = getTokenInfoSync(tradeData.buyToken as `0x${string}`);

    row.innerHTML = `
      <td class="trade-hash">${formatAddress(trade.hash || "Unknown")}</td>
      <td class="trade-status ${trade.status || "unknown"}">${
      trade.status || "Unknown"
    }</td>
      <td class="trade-amount">
        ${formatAmount(tradeData.sellAmount, sellToken.decimals)} <span data-token-address="${tradeData.sellToken}" data-token-field="symbol">${
      sellToken.symbol
    }</span> → ${formatAmount(tradeData.buyAmount, buyToken.decimals)} <span data-token-address="${tradeData.buyToken}" data-token-field="symbol">${
      buyToken.symbol
    }</span>
      </td>
      <td class="trade-date">${timestampToDateTime(
        await getBlockTimestamp(parseInt(trade.blockNumber))
      )}</td>
      <td class="trade-block">${trade.blockNumber || "Unknown"}</td>
    `;

    // Asynchronously fetch token metadata and update all tagged elements
    fetchTokenInfoAndUpdateDOM(tradeData.sellToken as `0x${string}`);
    fetchTokenInfoAndUpdateDOM(tradeData.buyToken as `0x${string}`);

    console.log(`🔍 Adding click listener to trade row ${index} (with data)`);
    row.addEventListener("click", () => {
      console.log(`🖱️ Trade row ${index} clicked (with data)`);
      showTradeDetails(trade);
    });


    return row;
  }
}

/**
 * Toggle solver competition display
 * NOTE: This function is no longer used since unfold buttons were removed
 */
/*
async function toggleSolverCompetition(txHash: string, button: HTMLButtonElement): Promise<void> {
  const row = button.closest('tr') as HTMLTableRowElement;
  if (!row) return;

  // Check if already expanded
  const existingDetails = row.querySelector('.solver-competition-details');
  if (existingDetails) {
    // Collapse
    existingDetails.remove();
    button.innerHTML = '<i class="fas fa-chevron-down"></i>';
    button.classList.remove('expanded');
    return;
  }

  // Expand - show loading state
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  button.disabled = true;

  try {
    const competitionData = await fetchSolverCompetition(txHash);
    
    // Create details row
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'solver-competition-details';
    detailsRow.innerHTML = `
      <td colspan="5">
        <div class="solver-competition-container">
          <div class="solver-competition-header">
            <h3><i class="fas fa-trophy"></i> Solver Competition</h3>
            <p>Auction ID: ${competitionData.auctionId || 'N/A'}</p>
          </div>
          <div class="solutions-list">
            ${competitionData.solutions?.map((solution: any, index: number) => `
              <div class="solution-card ${solution.isWinner ? 'winner' : ''}">
                <div class="solution-header">
                  <div class="solution-info">
                    <h4>Solver ${index + 1} ${solution.isWinner ? '🏆' : ''}</h4>
                    <p class="solver-address">${formatAddress(solution.solverAddress)}</p>
                  </div>
                  <div class="solution-stats">
                    <div class="stat">
                      <span class="stat-label">Score:</span>
                      <span class="stat-value">${solution.score || 'N/A'}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">Ranking:</span>
                      <span class="stat-value">${solution.ranking || 'N/A'}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">Winner:</span>
                      <span class="stat-value ${solution.isWinner ? 'winner' : 'loser'}">${solution.isWinner ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">Filtered:</span>
                      <span class="stat-value">${solution.filteredOut ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
                
                ${solution.clearingPrices ? `
                  <div class="clearing-prices">
                    <h5>Clearing Prices:</h5>
                    <div class="prices-grid">
                      ${Object.entries(solution.clearingPrices).map(([token, price]) => `
                        <div class="price-item">
                          <span class="token-address">${formatAddress(token)}</span>
                          <span class="price-value">${price}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
                
                ${solution.orders && solution.orders.length > 0 ? `
                  <div class="orders-section">
                    <h5>Orders (${solution.orders.length}):</h5>
                    <div class="orders-list">
                      ${solution.orders.map((order: any, orderIndex: number) => `
                        <div class="order-item">
                          <div class="order-header">
                            <span class="order-index">Order ${orderIndex + 1}</span>
                          </div>
                          <div class="order-details">
                            <div class="order-token">
                              <span class="token-label">Sell:</span>
                              <span class="token-address">${formatAddress(order.sellToken)}</span>
                              <span class="token-amount">${order.sellAmount || 'N/A'}</span>
                            </div>
                            <div class="order-token">
                              <span class="token-label">Buy:</span>
                              <span class="token-address">${formatAddress(order.buyToken)}</span>
                              <span class="token-amount">${order.buyAmount || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
                
                ${solution.referenceScore ? `
                  <div class="reference-score">
                    <span class="stat-label">Reference Score:</span>
                    <span class="stat-value">${solution.referenceScore}</span>
                  </div>
                ` : ''}
              </div>
            `).join('') || '<p>No solutions available</p>'}
          </div>
        </div>
      </td>
    `;

    // Insert the details row after the current row
    row.parentNode?.insertBefore(detailsRow, row.nextSibling);
    
    // Update button state
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
    button.classList.add('expanded');
    
  } catch (error) {
    console.error('Error fetching solver competition data:', error);
    
    // Show error state
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'solver-competition-details error';
    detailsRow.innerHTML = `
      <td colspan="5">
        <div class="solver-competition-container error">
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Failed to load solver competition data</p>
            <small>${error instanceof Error ? error.message : 'Unknown error'}</small>
          </div>
        </div>
      </td>
    `;
    
    row.parentNode?.insertBefore(detailsRow, row.nextSibling);
    button.innerHTML = '<i class="fas fa-chevron-up"></i>';
    button.classList.add('expanded');
  } finally {
    button.disabled = false;
  }
}
*/

/**
 * Show trade details
 */
async function showTradeDetails(trade: Transaction): Promise<void> {
  console.log(`🔍 showTradeDetails called with trade:`, trade);
  try {
    state.currentTrade = trade;

    // Create and display info frame overlay
    const infoFrameOverlay = await createTradeInfoFrameOverlay(trade);

    // Add the overlay to the body
    document.body.appendChild(infoFrameOverlay);

    console.log("✅ Trade info frame overlay loaded");
  } catch (error) {
    console.error("❌ Error loading trade details:", error);
    showError("Failed to load trade details");
  }
}

/**
 * Create trade info frame overlay
 */
async function createTradeInfoFrameOverlay(
  trade: Transaction
): Promise<HTMLElement> {
  const overlay = document.createElement("div");
  overlay.className = "trade-info-overlay";

  // Check if this is a simplified trade structure (flat fields) or old parsedData structure
  if (
    (trade.buyAmount && trade.sellToken && trade.buyToken) ||
    (trade.parsedData &&
      trade.parsedData.trades &&
      trade.parsedData.trades.length > 0)
  ) {
    // This is a simplified trade structure with flat fields or parsedData structure
    console.log(`🔍 Displaying clean trade structure:`, trade);

    let sellTokenAddress,
      buyTokenAddress,
      sellAmount,
      buyAmount,
      creationDate,
      executedAmount,
      realSellAmount;

    // Prioritize new database format fields
    if (trade.sellToken && trade.buyToken) {
      // Use new database format fields
      sellTokenAddress = trade.sellToken;
      buyTokenAddress = trade.buyToken;
      sellAmount = trade.sellAmount;
      buyAmount = trade.buyAmount;
      creationDate = trade.creationDate;
      executedAmount = trade.executedBuyAmount || trade.executedAmount;
      realSellAmount = trade.executedSellAmount || trade.realSellAmount;
    } else if (trade.parsedData?.trades?.[0]) {
      // Fallback to parsedData structure (old format)
      const tradeData = trade.parsedData.trades[0];
      sellTokenAddress = tradeData.sellToken;
      buyTokenAddress = tradeData.buyToken;
      sellAmount = tradeData.sellAmount;
      buyAmount = tradeData.buyAmount;
      executedAmount = tradeData.executedAmount || tradeData.sellAmount;
      realSellAmount = tradeData.sellAmount;
    } else {
      // Fallback for incomplete data
      sellTokenAddress = "Unknown";
      buyTokenAddress = "Unknown";
      sellAmount = "0";
      buyAmount = "0";
      executedAmount = "0";
      realSellAmount = "0";
    }

    // Get instant token info (will show addresses if not cached)
    const sellToken = getTokenInfoSync(sellTokenAddress as `0x${string}`);
    const buyToken = getTokenInfoSync(buyTokenAddress as `0x${string}`);

    // Format amounts with proper decimals
    const formattedSellAmount = await formatTokenAmount(sellAmount, sellTokenAddress as `0x${string}`);
    const formattedBuyAmount = await formatTokenAmount(buyAmount, buyTokenAddress as `0x${string}`);
    const formattedExecutedAmount = await formatTokenAmount(executedAmount, buyTokenAddress as `0x${string}`);
    const formattedRealSellAmount = await formatTokenAmount(realSellAmount, sellTokenAddress as `0x${string}`);
    const formattedExecutedBuyAmount = await formatTokenAmount(trade.executedBuyAmount, buyTokenAddress as `0x${string}`);
    const formattedExecutedSellAmount = await formatTokenAmount(trade.executedSellAmount, sellTokenAddress as `0x${string}`);
    const formattedExecutedSellAmountBeforeFees = await formatTokenAmount(trade.executedSellAmountBeforeFees, sellTokenAddress as `0x${string}`);

    // Debug logging to see what data we extracted
    console.log(`🔍 Extracted trade data:`, {
      sellToken: sellToken.symbol,
      buyToken: buyToken.symbol,
      sellAmount: formattedSellAmount,
      buyAmount: formattedBuyAmount,
      executedAmount: formattedExecutedAmount,
      realSellAmount: formattedRealSellAmount,
      sellTokenAddress,
      buyTokenAddress,
      creationDate,
    });

    // Format timestamp with proper fallback logic
    let formattedTimestamp: string;
    if (creationDate) {
      const formattedDate = formatDatabaseDate(creationDate);
      if (formattedDate !== 'No Date' && formattedDate !== 'Invalid Date') {
        formattedTimestamp = formattedDate;
      } else {
        // Fallback to block timestamp if date is invalid
        const blockTimestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
        formattedTimestamp = timestampToDateTime(blockTimestamp);
      }
    } else {
      // No creationDate, use block timestamp
      const blockTimestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
      formattedTimestamp = timestampToDateTime(blockTimestamp);
    }

    console.log('🔍 Formatted timestamp for overlay:', formattedTimestamp);

    overlay.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="info-frame">
        <div class="info-frame-header">
          <div class="info-frame-title">
            <i class="fas fa-exchange-alt"></i>
            Trade Information
          </div>
          <div class="info-frame-subtitle">
            <a href="https://explorer.cow.fi/tx/${
              trade.hash
            }" target="_blank" class="transaction-link">
              ${trade.hash}
            </a>
          </div>
        </div>
        
        <div class="info-frame-content">
          <!-- Essential Transaction Info -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-receipt"></i>
              Transaction Summary
            </div>
            <div class="info-section-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value status-success">Success</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Block Number</span>
                  <span class="info-value">${
                    trade.blockNumber || "Unknown"
                  }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Timestamp</span>
                  <span class="info-value">${
                    formattedTimestamp
                  }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Transaction Hash</span>
                  <span class="info-value hash-value">
                    <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/tx/${
                      trade.hash
                    }" target="_blank" class="address-link">
                      ${formatAddress(trade.hash)}
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Trade Details Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-chart-line"></i>
              Trade Summary
            </div>
            <div class="info-section-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Trade Type</span>
                  <span class="info-value">${trade.kind || 'sell'}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Token Details with Amount Information -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-coins"></i>
              Token Details
            </div>
            <div class="info-section-content">
              <!-- Receiver Information -->
              <div class="receiver-section">
                <div class="receiver-info">
                  <span class="receiver-label">Receiver</span>
                  <span class="receiver-value hash-value">
                    <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/address/${
                      trade.receiver || trade.from || "Unknown"
                    }" target="_blank" class="address-link">
                      ${formatAddress(
                        trade.receiver || trade.from || "Unknown"
                      )}
                    </a>
                  </span>
                </div>
              </div>
              
              <div class="token-details-container">
                <!-- Sell Token Section -->
                <div class="token-detail-section sell-token">
                  <div class="token-header">
                    <div class="token-info">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">SELL</span>
                        <span data-token-address="${sellTokenAddress}" data-token-field="symbol" style="font-weight: 600; color: #dc3545; font-size: 1.1rem;">${sellToken.symbol}</span>
                      </div>
                      <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/address/${
                        trade.sellToken ||
                        trade.parsedData?.trades?.[0]?.sellToken ||
                        "Unknown"
                      }" target="_blank" class="address-link">
                        ${formatAddress(
                          trade.sellToken ||
                            trade.parsedData?.trades?.[0]?.sellToken ||
                            "Unknown"
                        )}
                      </a>
                    </div>
                  </div>
                  
                  <!-- Sell Amount Details -->
                  <div class="amount-details-section">
                    <div class="amount-details-header">
                      <i class="fas fa-arrow-down"></i>
                      <span>Amount Details</span>
                    </div>
                    <table class="amount-details-table">
                      <thead>
                        <tr>
                          <th>Expected Amount</th>
                          <th>Executed Amount</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div class="amount-cell">
                              <div class="amount-value">${formattedSellAmount}</div>
                              <div class="amount-token">${sellToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="amount-cell">
                              <div class="amount-value">${formattedExecutedSellAmount || formattedRealSellAmount}</div>
                              <div class="amount-token">${sellToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="difference-cell">
                              <div class="difference-value ${calculateAmountDifferenceClass(
                                formattedSellAmount,
                                formattedExecutedSellAmount || formattedRealSellAmount
                              )}">
                                ${calculateAmountDifference(
                                  formattedSellAmount,
                                  formattedExecutedSellAmount || formattedRealSellAmount,
                                  sellToken.symbol
                                )}
                              </div>
                              <div class="difference-label">vs Expected</div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Buy Token Section -->
                <div class="token-detail-section buy-token">
                  <div class="token-header">
                    <div class="token-info">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="background: #198754; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">BUY</span>
                        <span data-token-address="${buyTokenAddress}" data-token-field="symbol" style="font-weight: 600; color: #198754; font-size: 1.1rem;">${buyToken.symbol}</span>
                      </div>
                      <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/address/${
                        trade.buyToken ||
                        trade.parsedData?.trades?.[0]?.buyToken ||
                        "Unknown"
                      }" target="_blank" class="address-link">
                        ${formatAddress(
                          trade.buyToken ||
                            trade.parsedData?.trades?.[0]?.buyToken ||
                            "Unknown"
                        )}
                      </a>
                    </div>
                  </div>
                  
                  <!-- Buy Amount Details -->
                  <div class="amount-details-section">
                    <div class="amount-details-header">
                      <i class="fas fa-arrow-up"></i>
                      <span>Amount Details</span>
                    </div>
                    <table class="amount-details-table">
                      <thead>
                        <tr>
                          <th>Expected Amount</th>
                          <th>Executed Amount</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div class="amount-cell">
                              <div class="amount-value">${formattedBuyAmount}</div>
                              <div class="amount-token">${buyToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="amount-cell">
                              <div class="amount-value">${formattedExecutedBuyAmount || formattedExecutedAmount}</div>
                              <div class="amount-token">${buyToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="difference-cell">
                              <div class="difference-value ${calculateAmountDifferenceClass(
                                formattedBuyAmount,
                                formattedExecutedBuyAmount || formattedExecutedAmount
                              )}">
                                ${calculateAmountDifference(
                                  formattedBuyAmount,
                                  formattedExecutedBuyAmount || formattedExecutedAmount,
                                  buyToken.symbol
                                )}
                              </div>
                              <div class="difference-label">vs Expected</div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Market Price Comparison Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-chart-bar"></i>
              Market Price Comparison
            </div>
            <div class="info-section-content">
              <div class="market-comparison-container">
                <!-- Trade Rates Section -->
                <div class="market-detail-section trade-rates">
                  <div class="market-header">
                    <div class="market-info">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">TRADE</span>
                        <span style="font-weight: 600; color: #667eea; font-size: 1.1rem;">${sellToken.symbol} → ${buyToken.symbol}</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Trade Rates Details -->
                  <div class="market-details-section">
                    <div class="market-details-header">
                      <i class="fas fa-exchange-alt"></i>
                      <span>Trade Rates</span>
                    </div>
                    <table class="market-details-table">
                      <thead>
                        <tr>
                          <th>Expected Rate</th>
                          <th>Actual Rate</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div class="rate-cell">
                              <div class="rate-value">1 ${sellToken.symbol} = ${
      parseFloat(formattedBuyAmount || "0") > 0 && parseFloat(formattedSellAmount || "0") > 0
        ? formatScientific(
            parseFloat(formattedBuyAmount || "0") / parseFloat(formattedSellAmount || "0")
          )
        : "0"
    } ${buyToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="rate-cell">
                              <div class="rate-value">1 ${sellToken.symbol} = ${
      parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") > 0 && parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0") > 0
        ? formatScientific(
            parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") / parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0")
          )
        : "0"
    } ${buyToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="rate-difference-cell">
                              <div class="rate-difference-frames">
                                ${(() => {
                                  const expectedRate = parseFloat(formattedBuyAmount || "0") > 0 && parseFloat(formattedSellAmount || "0") > 0
                                    ? parseFloat(formattedBuyAmount || "0") / parseFloat(formattedSellAmount || "0")
                                    : 0;
                                  const actualRate = parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") > 0 && parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0") > 0
                                    ? parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") / parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0")
                                    : 0;
                                  if (expectedRate === 0 || actualRate === 0) return "N/A";
                                  
                                  const rateDiff = actualRate - expectedRate;
                                  const percentDiff = ((actualRate - expectedRate) / expectedRate) * 100;
                                  
                                  const rateDiffFormatted = formatScientific(rateDiff);
                                  const percentDiffFormatted = percentDiff > 0 ? `+${percentDiff.toFixed(2)}%` : `${percentDiff.toFixed(2)}%`;
                                  
                                  const isPositive = rateDiff > 0;
                                  const isNegative = rateDiff < 0;
                                  
                                  return `
                                    <div class="rate-difference-frame ${isPositive ? 'positive' : isNegative ? 'negative' : ''}">
                                      <div class="rate-difference-value">${rateDiffFormatted} ${buyToken.symbol}</div>
                                    </div>
                                    <div class="rate-difference-frame ${isPositive ? 'positive' : isNegative ? 'negative' : ''}">
                                      <div class="rate-difference-value">${percentDiffFormatted}</div>
                                    </div>
                                  `;
                                })()}
                              </div>
                              <div class="rate-difference-label">vs Expected</div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Binance Rate Section -->
                <div class="market-detail-section binance-rate">
                  <div class="market-header">
                    <div class="market-info">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="background: #f7931a; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">BINANCE</span>
                        <span style="font-weight: 600; color: #f7931a; font-size: 1.1rem;">${sellToken.symbol} → ${buyToken.symbol}</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Binance Rate Details -->
                  <div class="market-details-section">
                    <div class="market-details-header">
                      <i class="fas fa-chart-line"></i>
                      <span>Market Rate</span>
                    </div>
                    <table class="market-details-table">
                      <thead>
                        <tr>
                          <th>Binance Rate</th>
                          <th>Trade Rate</th>
                          <th>Price Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div class="rate-cell">
                              <div class="rate-value loading" id="binance-rate-${
                                trade.hash
                              }">Loading</div>
                            </div>
                          </td>
                          <td>
                            <div class="rate-cell">
                              <div class="rate-value">1 ${sellToken.symbol} = ${
      parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") > 0 && parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0") > 0
        ? formatScientific(
            parseFloat(formattedExecutedBuyAmount || formattedExecutedAmount || "0") / parseFloat(formattedExecutedSellAmount || formattedRealSellAmount || "0")
          )
        : "0"
    } ${buyToken.symbol}</div>
                            </div>
                          </td>
                          <td>
                            <div class="rate-difference-cell">
                              <div class="rate-difference-value" id="price-diff-${
                                trade.hash
                              }">-</div>
                              <div class="rate-difference-label">vs Binance</div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <!-- Pivot Details Section -->
                    <div class="pivot-details-section" id="pivot-details-${trade.hash}" style="display: none;">
                      <div class="pivot-details-header">
                        <i class="fas fa-exchange-alt"></i>
                        <span>Pivot Details</span>
                      </div>
                      <div class="pivot-details-content" id="pivot-details-content-${trade.hash}">
                        <!-- Pivot details will be populated here -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Solver Competition Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-trophy"></i>
              Solver Competition
            </div>
            <div class="info-section-content">
              <div id="competition-content-${trade.hash}" class="competition-content">
                <div class="loading-competition">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>Loading competition data...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Trade Details Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-info-circle"></i>
              Additional Details
            </div>
            <div class="info-section-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Gas Price</span>
                  <span class="info-value">${formatGasPrice(
                    trade.gasPrice
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gas Used</span>
                  <span class="info-value">${formatGasUsed(
                    trade.gasUsed
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Function</span>
                  <span class="info-value">${
                    trade.decodedFunction || "settle"
                  }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Description</span>
                  <span class="info-value">${
                    trade.functionDescription ||
                    "Settle multiple orders in a batch auction"
                  }</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button class="close-button" id="closeButton">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Fetch Binance prices for this trade after ensuring DOM is ready
    setTimeout(async () => {
      await fetchAndDisplayBinancePrices(trade, sellToken, buyToken);
    }, 0);

    // Fetch and display solver competition data
    setTimeout(async () => {
      await fetchAndDisplaySolverCompetition(trade.hash);
    }, 0);
  } else if (
    !trade.parsedData ||
    !trade.parsedData.trades ||
    trade.parsedData.trades.length === 0
  ) {
    // Handle case where no trade data is available
    overlay.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="info-frame">
        <div class="info-frame-header">
          <div class="info-frame-title">
            <i class="fas fa-info-circle"></i>
            Transaction Information
          </div>
          <div class="info-frame-subtitle">
            <a href="https://explorer.cow.fi/tx/${
              trade.hash
            }" target="_blank" class="transaction-link">
              ${trade.hash}
            </a>
          </div>
        </div>
        
        <div class="info-frame-content">
          <!-- Basic Transaction Info -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-receipt"></i>
              Transaction Details
            </div>
            <div class="info-section-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value status-${
                    trade.status || "unknown"
                  }">${trade.status || "Unknown"}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Block Number</span>
                  <span class="info-value">${
                    trade.blockNumber || "Unknown"
                  }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">From Address</span>
                  <span class="info-value hash-value">${formatAddress(
                    trade.from
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">To Address</span>
                  <span class="info-value hash-value">${formatAddress(
                    trade.to
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Value (ETH)</span>
                  <span class="info-value">${
                    trade.value ? formatAmount(trade.value, 18) : "0"
                  } ETH</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gas Price</span>
                  <span class="info-value">${formatGasPrice(
                    trade.gasPrice
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gas Used</span>
                  <span class="info-value">${formatGasUsed(
                    trade.gasUsed
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Function</span>
                  <span class="info-value">${
                    trade.decodedFunction || "Unknown"
                  }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Description</span>
                  <span class="info-value">${
                    trade.functionDescription || "No description available"
                  }</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Solver Competition Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-trophy"></i>
              Solver Competition
            </div>
            <div class="info-section-content">
              <div id="competition-content-${trade.hash}" class="competition-content">
                <div class="loading-competition">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>Loading competition data...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Warning Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-exclamation-triangle"></i>
              Limited Trade Data
            </div>
            <div class="info-section-content">
              <p>This transaction does not contain detailed CoW Protocol trade information. It may be:</p>
              <ul>
                <li>A non-trade transaction (e.g., contract deployment, token approval)</li>
                <li>A transaction that failed to decode properly</li>
                <li>A transaction from before the CoW Protocol was fully implemented</li>
              </ul>
              <p><strong>Note:</strong> Only transactions with decoded trade data will show detailed swap information.</p>
            </div>
          </div>
        </div>
        
        <button class="close-button" id="closeButton">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Fetch and display solver competition data for this branch too
    setTimeout(async () => {
      await fetchAndDisplaySolverCompetition(trade.hash);
    }, 0);
  } else if (trade.sellToken && trade.buyToken) {
    // Handle simplified database structure (new format)
    const sellToken = await getTokenInfoAsync(trade.sellToken);
    const buyToken = await getTokenInfoAsync(trade.buyToken);

    // Format amounts with proper decimals
    const formattedSellAmount = await formatTokenAmount(trade.sellAmount, trade.sellToken);
    const formattedBuyAmount = await formatTokenAmount(trade.buyAmount, trade.buyToken);
    const formattedExecutedAmount = await formatTokenAmount(trade.executedAmount, trade.buyToken);
    const formattedRealSellAmount = await formatTokenAmount(trade.realSellAmount, trade.sellToken);

    // Calculate amounts and differences using formatted values
    const sellAmountNum = parseFloat(formattedSellAmount);
    const buyAmountNum = parseFloat(formattedBuyAmount);
    const executedAmountNum = parseFloat(formattedExecutedAmount);
    const realSellAmountNum = parseFloat(formattedRealSellAmount);

    // Calculate the difference between expected sell amount and actual sell amount
    const sellAmountDifference = sellAmountNum - realSellAmountNum;
    const sellAmountDifferenceFormatted = sellAmountDifference.toFixed(6);
    const sellAmountDifferenceClass =
      sellAmountDifference > 0 ? "negative-difference" : "positive-difference";

    // Calculate exchange rates
    let exchangeRateAToB = "0";
    let exchangeRateBToA = "0";

    if (sellAmountNum > 0) {
      exchangeRateAToB = (buyAmountNum / sellAmountNum).toFixed(6);
    }
    if (buyAmountNum > 0) {
      exchangeRateBToA = (sellAmountNum / buyAmountNum).toFixed(6);
    }

    // Fetch Binance prices
    let binanceRateAToB = "Loading...";
    let binanceRateBToA = "Loading...";
    let priceDifference = "Loading...";
    const timestamp = await getBlockTimestamp(parseInt(trade.blockNumber));
    console.log('🕐 Block timestamp for overlay:', timestamp);

    try {
      console.log(`🔍 Fetching Binance prices for overlay: ${sellToken.symbol}/${buyToken.symbol} pair`);
      
      const binanceData = await fetchBinancePrice(
        sellToken.symbol,
        buyToken.symbol,
        timestamp
      );
      if (
        binanceData.result &&
        binanceData.result.close &&
        binanceData.result.close > 0
      ) {
        binanceRateAToB = binanceData.result.close.toFixed(6);
        binanceRateBToA = (1 / binanceData.result.close).toFixed(6);

        // Calculate price difference
        const tradeRate = buyAmountNum / sellAmountNum;
        const binanceRate = binanceData.result.close;
        const diff = (((tradeRate - binanceRate) / binanceRate) * 100).toFixed(
          2
        );
        priceDifference = `${diff}%`;
        
        console.log(`✅ Successfully loaded Binance prices for overlay: ${sellToken.symbol}/${buyToken.symbol}`);
      } else {
        binanceRateAToB = "No price on Binance for this pair";
        binanceRateBToA = "No price on Binance for this pair";
        priceDifference = "-";
      }
    } catch (error) {
      console.error("❌ Error fetching Binance price for overlay:", error);
      
      // Check if it's a "Pair not found" error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isPairNotFound = errorMessage.includes('Pair not found');
      
      if (isPairNotFound) {
        binanceRateAToB = `Token pair ${sellToken.symbol}/${buyToken.symbol} not found on Binance`;
        binanceRateBToA = `Token pair ${sellToken.symbol}/${buyToken.symbol} not found on Binance`;
      } else {
        binanceRateAToB = "Failed to fetch price after retries";
        binanceRateBToA = "Failed to fetch price after retries";
      }
      priceDifference = "-";
    }

    overlay.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="info-frame">
        <div class="info-frame-header">
          <div class="info-frame-title">
            <i class="fas fa-exchange-alt"></i>
            Trade Information
          </div>
          <div class="info-frame-subtitle">
            <a href="https://explorer.cow.fi/tx/${
              trade.hash
            }?tab=orders" target="_blank" class="transaction-link">
              ${trade.hash}
            </a>
          </div>
        </div>
        
        <div class="info-frame-content">
          <!-- Basic Transaction Info -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-receipt"></i>
              Transaction Details
            </div>
            <div class="info-section-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Status</span>
                  <span class="info-value status-${trade.status}">${
      trade.status
    }</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Block Number</span>
                  <span class="info-value">${trade.blockNumber}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Timestamp</span>
                  <span class="info-value">${timestampToDateTime(
                    timestamp
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">From Address</span>
                  <span class="info-value hash-value">${formatAddress(
                    trade.from
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">To Address</span>
                  <span class="info-value hash-value">${formatAddress(
                    trade.to
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Value (ETH)</span>
                  <span class="info-value">${formatAmount(
                    trade.value,
                    18
                  )} ETH</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gas Price</span>
                  <span class="info-value">${formatGasPrice(
                    trade.gasPrice
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Gas Used</span>
                  <span class="info-value">${formatGasUsed(
                    trade.gasUsed
                  )}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Function</span>
                  <span class="info-value">${trade.decodedFunction}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Description</span>
                  <span class="info-value">${trade.functionDescription}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Trade Summary Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-chart-line"></i>
              Trade Summary
            </div>
            <div class="info-section-content">
              <!-- Token Addresses -->
              <div class="token-addresses">
                <div class="token-address-item">
                  <span class="token-label">Sell Token:</span>
                  <span class="token-address hash-value">${formatAddress(
                    trade.sellToken
                  )} (${sellToken.symbol})</span>
                </div>
                <div class="token-address-item">
                  <span class="token-label">Buy Token:</span>
                  <span class="token-address hash-value">${formatAddress(
                    trade.buyToken
                  )} (${buyToken.symbol})</span>
                </div>
              </div>

              <!-- Buy Section -->
              <div class="trade-section">
                <div class="trade-section-header">
                  <i class="fas fa-arrow-up"></i>
                  <span>Buy Details (${buyToken.symbol})</span>
                </div>
                <div class="trade-section-content">
                  <div class="trade-amount-row">
                    <div class="trade-amount-item">
                      <span class="amount-label">Expected Buy Amount:</span>
                      <span class="amount-value expected">${formattedBuyAmount} ${
      buyToken.symbol
    }</span>
                    </div>
                    <div class="trade-amount-item">
                      <span class="amount-label">Actual Buy Amount:</span>
                      <span class="amount-value actual">${formattedExecutedAmount} ${
      buyToken.symbol
    }</span>
                    </div>
                  </div>
                  <div class="trade-difference">
                    <span class="difference-label">Buy Amount Difference:</span>
                    <span class="difference-value ${
                      executedAmountNum >= buyAmountNum
                        ? "positive"
                        : "negative"
                    }">
                      ${(executedAmountNum - buyAmountNum).toFixed(6)} ${buyToken.symbol}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Sell Section -->
              <div class="trade-section">
                <div class="trade-section-header">
                  <i class="fas fa-arrow-down"></i>
                  <span>Sell Details (${sellToken.symbol})</span>
                </div>
                <div class="trade-section-content">
                  <div class="trade-amount-row">
                    <div class="trade-amount-item">
                      <span class="amount-label">Expected Sell Amount:</span>
                      <span class="amount-value expected">${formattedSellAmount} ${
      sellToken.symbol
    }</span>
                    </div>
                    <div class="trade-amount-item">
                      <span class="amount-label">Actual Sell Amount:</span>
                      <span class="amount-value actual">${formattedRealSellAmount} ${
      sellToken.symbol
    }</span>
                    </div>
                  </div>
                  <div class="trade-difference">
                    <span class="difference-label">Sell Amount Difference:</span>
                    <span class="difference-value ${sellAmountDifferenceClass}">
                      ${sellAmountDifferenceFormatted} ${sellToken.symbol}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Exchange Rates -->
              <div class="exchange-rates">
                <div class="rate-item">
                  <span class="rate-label">Trade Rate (${sellToken.symbol} → ${
      buyToken.symbol
    }):</span>
                  <span class="rate-value">1 ${
                    sellToken.symbol
                  } = ${exchangeRateAToB} ${buyToken.symbol}</span>
                </div>
                <div class="rate-item">
                  <span class="rate-label">Trade Rate (${buyToken.symbol} → ${
      sellToken.symbol
    }):</span>
                  <span class="rate-value">1 ${
                    buyToken.symbol
                  } = ${exchangeRateBToA} ${sellToken.symbol}</span>
                </div>
              </div>

              <!-- Market Price Comparison -->
              <div class="market-comparison">
                <div class="market-comparison-header">
                  <i class="fas fa-chart-bar"></i>
                  <span>Market Price Comparison</span>
                </div>
                <div class="market-comparison-content">
                  <div class="market-rate-item">
                    <span class="market-rate-label">Binance Rate (${
                      sellToken.symbol
                    } → ${buyToken.symbol}):</span>
                    <span class="market-rate-value">${binanceRateAToB}</span>
                  </div>
                  <div class="market-rate-item">
                    <span class="market-rate-label">Price Difference:</span>
                    <span class="market-rate-value ${
                      priceDifference !== "-"
                        ? priceDifference.includes("-")
                          ? "negative"
                          : "positive"
                        : ""
                    }">${priceDifference}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Token Information Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-coins"></i>
              Token Information
            </div>
            <div class="info-section-content">
              <div class="token-info-grid">
                <div class="token-info-card">
                  <div class="token-info-header">
                    <i class="fas fa-arrow-down"></i>
                    <span>Sell Token</span>
                  </div>
                  <div class="token-info-content">
                    <div data-token-address="${trade.sellToken}" data-token-field="symbol" class="token-symbol">${sellToken.symbol}</div>
                    <div data-token-address="${trade.sellToken}" data-token-field="name" class="token-name">${sellToken.name}</div>
                    <div class="token-address">
                      <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/address/${
                        trade.sellToken
                      }" target="_blank" class="address-link">
                        ${formatAddress(trade.sellToken)}
                      </a>
                    </div>
                  </div>
                </div>
                <div class="token-info-card">
                  <div class="token-info-header">
                    <i class="fas fa-arrow-up"></i>
                    <span>Buy Token</span>
                  </div>
                  <div class="token-info-content">
                    <div data-token-address="${trade.buyToken}" data-token-field="symbol" class="token-symbol">${buyToken.symbol}</div>
                    <div data-token-address="${trade.buyToken}" data-token-field="name" class="token-name">${buyToken.name}</div>
                    <div class="token-address">
                      <a href="${process.env.BLOCKCHAIN_EXPLORER_URL}/address/${
                        trade.buyToken
                      }" target="_blank" class="address-link">
                        ${formatAddress(trade.buyToken)}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Solver Competition Section -->
          <div class="info-section">
            <div class="info-section-title">
              <i class="fas fa-trophy"></i>
              Solver Competition
            </div>
            <div class="info-section-content">
              <div id="competition-content-${trade.hash}" class="competition-content">
                <div class="loading-competition">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>Loading competition data...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button class="close-button" id="closeButton">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Fetch and display solver competition data for this branch too
    setTimeout(async () => {
      await fetchAndDisplaySolverCompetition(trade.hash);
    }, 0);

    // Asynchronously fetch token metadata and update all tagged elements
    // This allows the UI to show addresses instantly, then update with names
    setTimeout(() => {
      const actualSellToken = trade.sellToken || trade.parsedData?.trades?.[0]?.sellToken;
      const actualBuyToken = trade.buyToken || trade.parsedData?.trades?.[0]?.buyToken;

      // Fetch and update all elements tagged with these token addresses
      if (actualSellToken) {
        fetchTokenInfoAndUpdateDOM(actualSellToken as `0x${string}`);
      }
      
      if (actualBuyToken) {
        fetchTokenInfoAndUpdateDOM(actualBuyToken as `0x${string}`);
      }
    }, 0);
  }

  // Add event listeners for closing the overlay
  setTimeout(() => {
    const closeButton = overlay.querySelector(
      "#closeButton"
    ) as HTMLButtonElement;
    const backdrop = overlay.querySelector(".overlay-backdrop") as HTMLElement;

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        closeTradeInfoOverlay();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", () => {
        closeTradeInfoOverlay();
      });
    }

    // Add escape key listener
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTradeInfoOverlay();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }, 100);

  return overlay;
}

function timestampToDateTime(timestamp: number): string {
  console.log('🔍 timestampToDateTime input:', timestamp);
  
  // Handle invalid timestamps
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    console.warn('Invalid timestamp provided to timestampToDateTime:', timestamp);
    return 'Invalid Date';
  }
  
  // Handle timestamps that might already be in milliseconds
  let timestampMs = timestamp;
  if (timestamp < 1e10) {
    // If timestamp is less than 1e10, it's likely in seconds, convert to milliseconds
    timestampMs = timestamp * 1000;
  }
  
  const date = new Date(timestampMs);
  console.log('🔍 Converted date:', date);
  console.log('🔍 Date valid:', !isNaN(date.getTime()));
  
  if (isNaN(date.getTime())) {
    console.warn('Invalid date created from timestamp:', timestamp, '->', timestampMs);
    return 'Invalid Date';
  }
  
  return date.toLocaleString();
}

/**
 * Close trade info overlay
 */
function closeTradeInfoOverlay(): void {
  const overlay = document.querySelector(".trade-info-overlay");
  if (overlay) {
    overlay.remove();
    state.currentTrade = null;
  }
}

/**
 * Show trades list
 */
function showTradesList(): void {
  // Close any open overlay
  closeTradeInfoOverlay();
  state.currentTrade = null;
}

/**
 * Show error message
 */
function showError(message: string): void {
  console.error("❌ Error:", message);
  // You can implement a proper error UI here
  alert(message);
}

/**
 * Show toast message
 */
function showToast(
  message: string,
  type: "info" | "success" | "warning" | "error" = "info"
): void {
  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${
        type === "info"
          ? "info-circle"
          : type === "success"
          ? "check-circle"
          : type === "warning"
          ? "exclamation-triangle"
          : "times-circle"
      }"></i>
      <span>${message}</span>
    </div>
  `;

  // Add to body
  document.body.appendChild(toast);

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);

  console.log(`💬 Toast (${type}):`, message);
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
