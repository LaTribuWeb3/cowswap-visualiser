import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { OrderWithMetadata, OrdersResponse } from '../types/OrderTypes';
import { getTokenDisplaySymbol } from '../utils/tokenMapping';

const CompetitionTable: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'timestamp' | 'markup' | 'livePrice' | 'auctionRanking'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const itemsPerPage = 20;

  useEffect(() => {
    fetchOrders();
  }, [page, sortBy, sortOrder]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder,
        withMetadata: 'true',
        // Only fetch orders where we have ranking data (competition data)
        hasRanking: 'true',
        included: 'true'
      });

      const response = await fetch(`https://prod.arbitrum.cowswap.la-tribu.xyz/api/orders?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch competition orders');
      }
      const data: OrdersResponse = await response.json();
      setOrders(data.orders);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'timestamp' | 'markup' | 'livePrice' | 'auctionRanking') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatTokenAmount = (amount: string, tokenInfo?: any) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;

    const decimals = tokenInfo?.decimals || 18;
    const divisor = Math.pow(10, decimals);
    const formatted = num / divisor;

    if (formatted >= 1000000) {
      return `${(formatted / 1000000).toFixed(1)}M`;
    } else if (formatted >= 1000) {
      return `${(formatted / 1000).toFixed(1)}K`;
    } else if (formatted >= 1) {
      return formatted.toFixed(2);
    } else {
      return formatted.toFixed(6);
    }
  };

  const getTokenSymbol = (tokenAddress: string, tokenInfo?: any) => {
    return getTokenDisplaySymbol(tokenAddress, tokenInfo);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getWinStatus = (order: OrderWithMetadata) => {
    if (order.metadata?.isWinner === true) {
      return { text: 'Won', className: 'bg-green-100 text-green-800' };
    } else if (order.metadata?.auctionRanking) {
      return { text: `#${order.metadata.auctionRanking}`, className: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: 'Unknown', className: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleRowClick = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const getCompetitorsData = (order: OrderWithMetadata) => {
    const competitors = [];
    
    // Add our offer first
    competitors.push({
      solverName: 'Our Solver',
      sellAmount: order.ourOffer.sellAmount,
      buyAmount: order.ourOffer.buyAmount,
      timestamp: order.timestamp,
      isOurs: true
    });
    
    // Add other competitors if they exist
    if (order.competitors) {
      Object.entries(order.competitors).forEach(([solverName, data]) => {
        competitors.push({
          solverName,
          sellAmount: data.sellAmount || '0',
          buyAmount: data.buyAmount || '0',
          timestamp: data.timestamp,
          isOurs: false
        });
      });
    }
    
    // Sort by buy amount (best offer first) - higher buy amount is better for the user
    const sortedCompetitors = competitors.sort((a, b) => {
      const aBuyAmount = parseFloat(a.buyAmount);
      const bBuyAmount = parseFloat(b.buyAmount);
      return bBuyAmount - aBuyAmount;
    });

    // Calculate deltas for each competitor
    const winningBuyAmount = parseFloat(sortedCompetitors[0]?.buyAmount || '0');
    const livePrice = order.livePrice; // This is in dollars
    
    return sortedCompetitors.map((competitor, index) => {
      const competitorBuyAmount = parseFloat(competitor.buyAmount);
      const competitorSellAmount = parseFloat(competitor.sellAmount);
      const isWinner = index === 0;
      
      // Convert token amounts to their actual values using decimals
      const sellTokenDecimals = order.sellTokenInfo?.decimals || 18;
      const buyTokenDecimals = order.buyTokenInfo?.decimals || 18;
      
      const actualSellAmount = competitorSellAmount / Math.pow(10, sellTokenDecimals);
      const actualBuyAmount = competitorBuyAmount / Math.pow(10, buyTokenDecimals);
      const actualWinningBuyAmount = winningBuyAmount / Math.pow(10, buyTokenDecimals);
      
      // Delta vs winning bid (in actual token units)
      const deltaVsWinning = actualBuyAmount - actualWinningBuyAmount;
      const deltaVsWinningPercent = actualWinningBuyAmount > 0 ? (deltaVsWinning / actualWinningBuyAmount) * 100 : 0;
      
      // Delta vs live price (in dollars)
      // Determine order direction based on token addresses
      const isWETHToUSDC = order.sellToken === '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'; // WETH on Arbitrum
      const isUSDCToWETH = order.buyToken === '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'; // WETH on Arbitrum
      
      let deltaVsLivePrice: number;
      let deltaVsLivePricePercent: number;
      
      if (isWETHToUSDC) {
        // WETH → USDC: compare actual USDC received vs what we should get at live price
        const expectedUSDC = actualSellAmount * livePrice; // Expected USDC at live price
        deltaVsLivePrice = actualBuyAmount - expectedUSDC; // Profit/loss in USDC
        deltaVsLivePricePercent = expectedUSDC > 0 ? (deltaVsLivePrice / expectedUSDC) * 100 : 0;
      } else if (isUSDCToWETH) {
        // USDC → WETH: compare actual WETH received vs what we should get at live price
        const expectedWETH = actualSellAmount / livePrice; // Expected WETH at live price
        deltaVsLivePrice = actualBuyAmount - expectedWETH; // Profit/loss in WETH
        deltaVsLivePricePercent = expectedWETH > 0 ? (deltaVsLivePrice / expectedWETH) * 100 : 0;
      } else {
        // Fallback: assume WETH → USDC
        const expectedUSDC = actualSellAmount * livePrice;
        deltaVsLivePrice = actualBuyAmount - expectedUSDC;
        deltaVsLivePricePercent = expectedUSDC > 0 ? (deltaVsLivePrice / expectedUSDC) * 100 : 0;
      }
      
      return {
        ...competitor,
        isWinner,
        deltaVsWinning,
        deltaVsWinningPercent,
        deltaVsLivePrice,
        deltaVsLivePricePercent,
        actualSellAmount,
        actualBuyAmount
      };
    });
  };


  if (loading && orders.length === 0) {
    return (
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">API Connection Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p className="font-medium">Unable to load competition orders from the API server:</p>
                  <p className="mt-1">{error}</p>
                  <div className="mt-3">
                    <p className="text-xs text-red-600">
                      Please check your internet connection and ensure the API server is running.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
      <div className="py-6">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-gray-900">Competition Analysis</h1>
            <p className="mt-2 text-sm text-gray-700">
              Orders where we submitted solutions and competed against other solvers.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="mt-8 flex flex-col">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full py-2 align-middle">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('timestamp')}
                      >
                        <div className="flex items-center">
                          Timestamp
                          {sortBy === 'timestamp' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pair
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amounts
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kind
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('livePrice')}
                      >
                        <div className="flex items-center">
                          Live Price
                          {sortBy === 'livePrice' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('markup')}
                      >
                        <div className="flex items-center">
                          Markup (bps)
                          {sortBy === 'markup' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('auctionRanking')}
                      >
                        <div className="flex items-center">
                          Result
                          {sortBy === 'auctionRanking' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Owner
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => {
                      const winStatus = getWinStatus(order);
                      const isExpanded = expandedOrderId === order._id;
                      const competitors = getCompetitorsData(order);
                      
                      return (
                        <React.Fragment key={order._id}>
                          <tr 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleRowClick(order._id)}
                          >
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-48">
                            {format(new Date(order.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900 w-32">
                            <a
                              href={`https://explorer.cow.fi/arb1/orders/${order._id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {formatAddress(order._id)}
                            </a>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-48">
                            <div className="flex items-center">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {getTokenSymbol(order.sellToken, order.sellTokenInfo)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatAddress(order.sellToken)}
                                </span>
                              </div>
                              <span className="mx-2 text-gray-400">→</span>
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {getTokenSymbol(order.buyToken, order.buyTokenInfo)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatAddress(order.buyToken)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-40">
                            <div>
                              <div className="flex items-center">
                                <span className="text-gray-500 text-xs mr-1">Sell:</span>
                                <span className="font-medium">
                                  {formatTokenAmount(order.sellAmount, order.sellTokenInfo)}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  {getTokenSymbol(order.sellToken, order.sellTokenInfo)}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-500 text-xs mr-1">Buy:</span>
                                <span className="font-medium">
                                  {formatTokenAmount(order.buyAmount, order.buyTokenInfo)}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  {getTokenSymbol(order.buyToken, order.buyTokenInfo)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap w-20">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.kind === 'sell' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {order.kind.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-24">
                            ${order.livePrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-20">
                            {order.markup.toFixed(1)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap w-24">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${winStatus.className}`}>
                              {winStatus.text}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-500 w-32">
                            <a
                              href={`https://arbiscan.io/address/${order.owner}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {formatAddress(order.owner)}
                            </a>
                          </td>
                        </tr>
                        
                        {/* Expandable competitors section */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-4 py-4 bg-gray-50">
                              <div className="bg-white rounded-lg shadow-sm border">
                                <div className="px-4 py-3 border-b border-gray-200">
                                  <h3 className="text-lg font-medium text-gray-900">
                                    Competition Analysis
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    Order ID: {order._id}
                                  </p>
                                </div>
                                
                                {competitors.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Solver
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Sell Amount
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Buy Amount
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            vs Winning Bid
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            vs Live Price
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {competitors.map((competitor, index) => (
                                          <tr 
                                            key={`${competitor.solverName}-${index}`}
                                            className={competitor.isOurs ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                                          >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                              <div className="flex items-center">
                                                {competitor.isOurs && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                                    OURS
                                                  </span>
                                                )}
                                                <span className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                                  {competitor.solverName}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                              <span className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                                {formatTokenAmount(competitor.sellAmount, order.sellTokenInfo)}
                                                <span className="text-xs text-gray-500 ml-1">
                                                  {getTokenSymbol(order.sellToken, order.sellTokenInfo)}
                                                </span>
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                              <span className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                                {formatTokenAmount(competitor.buyAmount, order.buyTokenInfo)}
                                                <span className="text-xs text-gray-500 ml-1">
                                                  {getTokenSymbol(order.buyToken, order.buyTokenInfo)}
                                                </span>
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                              <div className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                                {competitor.isWinner ? (
                                                  <span className="text-green-600 font-medium">Winner</span>
                                                ) : (
                                                  <div>
                                                    <div className={competitor.deltaVsWinning >= 0 ? 'text-red-600' : 'text-green-600'}>
                                                      {competitor.deltaVsWinning >= 0 ? '+' : ''}{competitor.deltaVsWinning.toFixed(6)} {getTokenSymbol(order.buyToken, order.buyTokenInfo)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                      {competitor.deltaVsWinningPercent >= 0 ? '+' : ''}{competitor.deltaVsWinningPercent.toFixed(2)}%
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                              <div className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                                <div className={competitor.deltaVsLivePrice >= 0 ? 'text-red-600' : 'text-green-600'}>
                                                  {competitor.deltaVsLivePrice >= 0 ? '+' : ''}${competitor.deltaVsLivePrice.toFixed(4)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {competitor.deltaVsLivePricePercent >= 0 ? '+' : ''}{competitor.deltaVsLivePricePercent.toFixed(2)}%
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="px-4 py-6 text-center text-gray-500">
                                    <p>No competition data available for this order.</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{page}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {(() => {
                  const pages = [];
                  const startPage = Math.max(1, page - 2);
                  const endPage = Math.min(totalPages, page + 2);
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          i === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pages;
                })()}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionTable;
