import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { OrderWithMetadata, OrdersResponse } from '../types/OrderTypes';
import { getTokenDisplaySymbol, getTokenMetadata } from '../utils/tokenMapping';
import { getSolverName } from '../utils/solversMapping';
import { calculateCompetitorDeltas } from '../utils/deltaCalculations';

const OrdersTable: React.FC = () => {
  const [allOrders, setAllOrders] = useState<OrderWithMetadata[]>([]);
  const [orders, setOrders] = useState<OrderWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'timestamp' | 'markup' | 'livePrice'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterIncluded, setFilterIncluded] = useState<boolean | null>(null);
  const [filterValidSolutions, setFilterValidSolutions] = useState<boolean>(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const itemsPerPage = 20;

  // Fetch data from API once when component loads
  useEffect(() => {
    fetchOrders();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterIncluded, filterValidSolutions, sortBy, sortOrder]);

  // Apply client-side filtering and pagination (when filters or page change)
  useEffect(() => {
    applyFiltersAndPagination();
  }, [allOrders, page, sortBy, sortOrder, filterIncluded, filterValidSolutions]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://prod.arbitrum.cowswap.la-tribu.xyz/api/orders-bulk?limit=20000&withMetadata=false');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch orders');
      }
      
      const data: OrdersResponse = await response.json();
      setAllOrders(data.orders);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };


  const applyFiltersAndPagination = () => {
    let filteredOrders = [...allOrders];

    // Apply client-side filtering for included orders
    if (filterIncluded !== null) {
      filteredOrders = filteredOrders.filter(order => 
        order.ourOffer && order.ourOffer.wasIncluded === filterIncluded
      );
    }

    // Apply client-side filtering for valid solutions
    if (filterValidSolutions) {
      filteredOrders = filteredOrders.filter(order => {
        const hasValidRanking = order.metadata && 
          order.metadata.ranking !== undefined && 
          order.metadata.ranking !== null && 
          order.metadata.ranking > 0;
        
        // Debug logging
        if (!hasValidRanking) {
          console.log('Filtering out order:', {
            orderId: order._id,
            metadata: order.metadata,
            ranking: order.metadata?.ranking,
            hasMetadata: !!order.metadata,
            rankingType: typeof order.metadata?.ranking
          });
        }
        
        return hasValidRanking;
      });
    }


    // Apply sorting
    filteredOrders.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'markup':
          aValue = a.markup;
          bValue = b.markup;
          break;
        case 'livePrice':
          aValue = a.livePrice;
          bValue = b.livePrice;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    // Apply pagination
    const totalFilteredOrders = filteredOrders.length;
    const totalPages = Math.ceil(totalFilteredOrders / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    // Debug logging for valid solutions filter
    if (filterValidSolutions) {
      console.log('Valid solutions filter active. Showing orders:', paginatedOrders.map(order => ({
        orderId: order._id,
        ranking: order.metadata?.ranking,
        hasMetadata: !!order.metadata
      })));
      console.log('Total filtered orders:', totalFilteredOrders);
      console.log('Paginated orders count:', paginatedOrders.length);
    }
    
    console.log('Setting orders state with', paginatedOrders.length, 'orders');
    setOrders(paginatedOrders);
    setTotalPages(totalPages);
  };

  const handleSort = (field: 'timestamp' | 'markup' | 'livePrice') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1); // Reset to first page when sorting
  };

  const formatTokenAmount = (amount: string, tokenInfo?: any, tokenAddress?: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;

    // Try to get decimals from tokenInfo first, then from local metadata, then default to 18
    let decimals = 18;
    if (tokenInfo?.decimals) {
      decimals = tokenInfo.decimals;
    } else if (tokenAddress) {
      const localTokenInfo = getTokenMetadata(tokenAddress);
      if (localTokenInfo?.decimals) {
        decimals = localTokenInfo.decimals;
      }
    }

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

  const handleRowClick = (order: OrderWithMetadata) => {
    // Only allow expansion for included orders
    if (order.ourOffer.wasIncluded) {
      setExpandedOrderId(expandedOrderId === order._id ? null : order._id);
    }
  };

  const getCompetitorsData = (order: OrderWithMetadata) => {
    const competitors = calculateCompetitorDeltas(order);
    
    // Map solver addresses to readable names and add our solver info
    return competitors.map((competitor) => {
      const isOurs = competitor.isOurs;
      const solverName = isOurs ? 'Our Solver' : getSolverName(competitor.solverName);
      
      return {
        ...competitor,
        solverName,
        isOurs,
        // Rename for backward compatibility
        deltaVsLivePrice: competitor.deltaAbsolute,
        deltaVsLivePricePercent: competitor.deltaPercent,
        deltaVsLivePriceUnit: competitor.deltaUnit
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
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">API Connection Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p className="font-medium">Unable to load orders from the API server:</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Orders Table</h1>
            <p className="mt-2 text-sm text-gray-700">
              A chronological list of all CowSwap orders from most recent to least recent.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 bg-white shadow rounded-lg p-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center">
              <input
                id="filter-included"
                type="checkbox"
                checked={filterIncluded === true}
                onChange={(e) => setFilterIncluded(e.target.checked ? true : null)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="filter-included" className="ml-2 block text-sm font-medium text-gray-700">
                Only orders with solution
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="filter-valid-solutions"
                type="checkbox"
                checked={filterValidSolutions}
                onChange={(e) => setFilterValidSolutions(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="filter-valid-solutions" className="ml-2 block text-sm font-medium text-gray-700">
                Only valid solutions
              </label>
            </div>
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Owner
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      console.log('Rendering orders:', orders.length, 'orders');
                      if (filterValidSolutions) {
                        console.log('Rendering with valid solutions filter. Orders have rankings:', orders.map(o => ({ id: o._id, ranking: o.metadata?.ranking })));
                      }
                      return orders.map((order) => {
                      const isExpanded = expandedOrderId === order._id;
                      const competitors = order.ourOffer.wasIncluded ? getCompetitorsData(order) : [];
                      
                      return (
                        <React.Fragment key={order._id}>
                          <tr 
                            className={`hover:bg-gray-50 ${order.ourOffer.wasIncluded ? 'cursor-pointer' : ''}`}
                            onClick={() => handleRowClick(order)}
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
                                {formatTokenAmount(order.sellAmount, order.sellTokenInfo, order.sellToken)}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">
                                {getTokenSymbol(order.sellToken, order.sellTokenInfo)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-500 text-xs mr-1">Buy:</span>
                              <span className="font-medium">
                                {formatTokenAmount(order.buyAmount, order.buyTokenInfo, order.buyToken)}
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
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-16">
                          {order.metadata?.ranking ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.metadata.ranking === 1
                                ? 'bg-yellow-100 text-yellow-800' // Winner
                                : order.metadata.ranking <= 3
                                ? 'bg-green-100 text-green-800' // Top 3
                                : 'bg-gray-100 text-gray-800' // Other ranks
                            }`}>
                              {order.metadata.ranking === 1 ? '1st' : `#${order.metadata.ranking}`}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap w-24">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            order.ourOffer.wasIncluded 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {order.ourOffer.wasIncluded ? 'Included' : 'Excluded'}
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
                      
                      {/* Expandable competitors section for included orders */}
                      {isExpanded && order.ourOffer.wasIncluded && (
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
                                              {formatTokenAmount(competitor.sellAmount, order.sellTokenInfo, order.sellToken)}
                                              <span className="text-xs text-gray-500 ml-1">
                                                {getTokenSymbol(order.sellToken, order.sellTokenInfo)}
                                              </span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            <span className={competitor.isOurs ? 'text-blue-900 font-semibold' : 'text-gray-900'}>
                                              {formatTokenAmount(competitor.buyAmount, order.buyTokenInfo, order.buyToken)}
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
                                                {competitor.deltaVsLivePrice >= 0 ? '+' : ''}{competitor.deltaVsLivePrice.toFixed(6)} {competitor.deltaVsLivePriceUnit}
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
                    });
                    })()}
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

export default OrdersTable;
