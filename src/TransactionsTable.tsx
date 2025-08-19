import React, { useState, useEffect } from 'react';

import { format, fromUnixTime, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { getTokenName, getTokenDecimals, formatVolume, truncateAddress } from './utils';
import { useData } from './DataContext';

interface Trade {
  _id: string;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: number | { low: number; high: number; unsigned: boolean };
  buyAmount: number | { low: number; high: number; unsigned: boolean };
  feeAmount: number;
  orderUid: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp: number;
  creationDate: number;
  kind: string;
  validTo: number;
  executedBuyAmount: string;
  executedSellAmount: string;
  executedFeeAmount: string;
  executedFee: string;
  executedFeeToken: string;
  quote?: {
    gasAmount: string;
    gasPrice: string;
    sellTokenPrice: string;
    sellAmount: string;
    buyAmount: string;
    solver: string;
  };
}

interface SortConfig {
  key: keyof Trade | 'formattedDate' | 'sellVolume' | 'buyVolume';
  direction: 'asc' | 'desc';
}

const TransactionsTable: React.FC = () => {
  const { data, dataRange, loading, error } = useData();
  const [filteredData, setFilteredData] = useState<Trade[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedSellToken, setSelectedSellToken] = useState<string>('all');
  const [selectedBuyToken, setSelectedBuyToken] = useState<string>('all');
  const [sellSearchValue, setSellSearchValue] = useState<string>('');
  const [buySearchValue, setBuySearchValue] = useState<string>('');
  const [showSellSuggestions, setShowSellSuggestions] = useState<boolean>(false);
  const [showBuySuggestions, setShowBuySuggestions] = useState<boolean>(false);

  // Initialize date range when data is loaded
  useEffect(() => {
    if (dataRange && data.length > 0) {
      setStartDate(format(dataRange.min, 'yyyy-MM-dd'));
      setEndDate(format(dataRange.max, 'yyyy-MM-dd'));
    }
    
    // Debug: Log the first trade to see what fields are available
    if (data.length > 0) {
      console.log('First trade fields:', Object.keys(data[0]));
      console.log('First trade data:', data[0]);
    }
  }, [dataRange, data]);

  // Helper function to get amount value from trade
  const getAmountValue = (amount: number | { low: number; high: number; unsigned: boolean }): number => {
    if (typeof amount === 'number') {
      return amount;
    }
    // For BigInt-like objects, use the high value as approximation
    return amount.high;
  };

  // Get unique tokens for filtering
  const getUniqueTokens = () => {
    const sellTokens = new Set<string>();
    const buyTokens = new Set<string>();
    
    data.forEach(trade => {
      sellTokens.add(trade.sellToken);
      buyTokens.add(trade.buyToken);
    });
    
    return {
      sellTokens: Array.from(sellTokens).sort(),
      buyTokens: Array.from(buyTokens).sort()
    };
  };

  // Get unique transaction counts
  const getUniqueTransactionCounts = () => {
    const uniqueOrderUids = new Set<string>();
    const uniqueTransactionHashes = new Set<string>();
    
    data.forEach(trade => {
      uniqueOrderUids.add(trade.orderUid);
      uniqueTransactionHashes.add(trade.transactionHash);
    });
    
    return {
      uniqueOrders: uniqueOrderUids.size,
      uniqueTransactions: uniqueTransactionHashes.size,
      totalRows: data.length
    };
  };

  // Get unique transaction counts for filtered data
  const getFilteredUniqueTransactionCounts = () => {
    const uniqueOrderUids = new Set<string>();
    const uniqueTransactionHashes = new Set<string>();
    
    filteredData.forEach(trade => {
      uniqueOrderUids.add(trade.orderUid);
      uniqueTransactionHashes.add(trade.transactionHash);
    });
    
    return {
      uniqueOrders: uniqueOrderUids.size,
      uniqueTransactions: uniqueOrderUids.size,
      totalRows: filteredData.length
    };
  };

  // Get filtered suggestions for autocomplete
  const getSellSuggestions = () => {
    if (!sellSearchValue.trim()) return [];
    
    const { sellTokens } = getUniqueTokens();
    return sellTokens
      .filter(token => 
        getTokenName(token).toLowerCase().includes(sellSearchValue.toLowerCase()) ||
        token.toLowerCase().includes(sellSearchValue.toLowerCase())
      )
      .slice(0, 8); // Limit to 8 suggestions
  };

  const getBuySuggestions = () => {
    if (!buySearchValue.trim()) return [];
    
    const { buyTokens } = getUniqueTokens();
    return buyTokens
      .filter(token => 
        getTokenName(token).toLowerCase().includes(buySearchValue.toLowerCase()) ||
        token.toLowerCase().includes(buySearchValue.toLowerCase())
      )
      .slice(0, 8); // Limit to 8 suggestions
  };

  // Handle token selection
  const handleSellTokenSelect = (tokenAddress: string) => {
    setSelectedSellToken(tokenAddress);
    setSellSearchValue(getTokenName(tokenAddress));
    setShowSellSuggestions(false);
  };

  const handleBuyTokenSelect = (tokenAddress: string) => {
    setSelectedBuyToken(tokenAddress);
    setBuySearchValue(getTokenName(tokenAddress));
    setShowBuySuggestions(false);
  };

  // Filter data based on date range and selected tokens
  useEffect(() => {
    if (!data.length || !startDate || !endDate) {
      let filtered = data;
      
      // Apply sell token filter if not "all"
      if (selectedSellToken !== 'all') {
        filtered = filtered.filter(trade => 
          trade.sellToken === selectedSellToken
        );
      }
      
      // Apply buy token filter if not "all"
      if (selectedBuyToken !== 'all') {
        filtered = filtered.filter(trade => 
          trade.buyToken === selectedBuyToken
        );
      }
      
      setFilteredData(filtered);
      setCurrentPage(1);
      return;
    }

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    let filtered = data.filter(trade => {
      const tradeDate = fromUnixTime(trade.timestamp);
      return isWithinInterval(tradeDate, { start, end });
    });

    // Apply sell token filter if not "all"
    if (selectedSellToken !== 'all') {
      filtered = filtered.filter(trade => 
        trade.sellToken === selectedSellToken
      );
    }
    
    // Apply buy token filter if not "all"
    if (selectedBuyToken !== 'all') {
      filtered = filtered.filter(trade => 
        trade.buyToken === selectedBuyToken
      );
    }

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [data, startDate, endDate, selectedSellToken, selectedBuyToken]);

  // Sorting function
  const sortData = (data: Trade[]) => {
    return [...data].sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortConfig.key) {
        case 'formattedDate':
          aValue = fromUnixTime(a.timestamp);
          bValue = fromUnixTime(b.timestamp);
          break;
        case 'sellVolume': {
          const sellDecimalsA = getTokenDecimals(a.sellToken);
          const sellDecimalsB = getTokenDecimals(b.sellToken);
          aValue = getAmountValue(a.sellAmount) / Math.pow(10, sellDecimalsA);
          bValue = getAmountValue(b.sellAmount) / Math.pow(10, sellDecimalsB);
          break;
        }
        case 'buyVolume': {
          const buyDecimalsA = getTokenDecimals(a.buyToken);
          const buyDecimalsB = getTokenDecimals(b.buyToken);
          aValue = getAmountValue(a.buyAmount) / Math.pow(10, buyDecimalsA);
          bValue = getAmountValue(b.buyAmount) / Math.pow(10, buyDecimalsB);
          break;
        }
        default:
          // Type guard to ensure we only access valid Trade properties
          if (sortConfig.key in a && sortConfig.key in b) {
            const aProp = a[sortConfig.key as keyof Trade];
            const bProp = b[sortConfig.key as keyof Trade];
            
            // Handle complex types by converting them to strings
            if (typeof aProp === 'object' && aProp !== null) {
              aValue = JSON.stringify(aProp);
            } else {
              aValue = (aProp as string | number) ?? '';
            }
            
            if (typeof bProp === 'object' && bProp !== null) {
              bValue = JSON.stringify(bProp);
            } else {
              bValue = (bProp as string | number) ?? '';
            }
          } else {
            // Fallback for invalid keys
            aValue = '';
            bValue = '';
          }
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Calculate total sell volume for filtered trades
  const getTotalSellVolume = () => {
    if (selectedSellToken === 'all') return null;
    
    const volumes = filteredData.map(trade => {
      const sellDecimals = getTokenDecimals(trade.sellToken);
      return getAmountValue(trade.sellAmount) / Math.pow(10, sellDecimals);
    });
    
    const totalVolume = volumes.reduce((total, volume) => total + volume, 0);
    const meanVolume = totalVolume / volumes.length;
    
    // Calculate median
    const sortedVolumes = [...volumes].sort((a, b) => a - b);
    const medianVolume = sortedVolumes.length % 2 === 0
      ? (sortedVolumes[sortedVolumes.length / 2 - 1] + sortedVolumes[sortedVolumes.length / 2]) / 2
      : sortedVolumes[Math.floor(sortedVolumes.length / 2)];
    
    const totalVolumeInfo = formatVolume(totalVolume);
    const meanVolumeInfo = formatVolume(meanVolume);
    const medianVolumeInfo = formatVolume(medianVolume);
    
    return {
      volume: totalVolume,
      display: totalVolumeInfo.display,
      full: totalVolumeInfo.full,
      mean: meanVolume,
      meanDisplay: meanVolumeInfo.display,
      meanFull: meanVolumeInfo.full,
      median: medianVolume,
      medianDisplay: medianVolumeInfo.display,
      medianFull: medianVolumeInfo.full,
      tokenName: getTokenName(selectedSellToken),
      count: volumes.length
    };
  };

  // Calculate total sell volume for current page only
  const getCurrentPageSellVolume = () => {
    if (selectedSellToken === 'all') return null;
    
    const currentPageVolumes = paginatedData.map(trade => {
      const sellDecimals = getTokenDecimals(trade.sellToken);
      return getAmountValue(trade.sellAmount) / Math.pow(10, sellDecimals);
    });
    
    const totalVolume = currentPageVolumes.reduce((total, volume) => total + volume, 0);
    const volumeInfo = formatVolume(totalVolume);
    
    return {
      volume: totalVolume,
      display: volumeInfo.display,
      full: volumeInfo.full,
      tokenName: getTokenName(selectedSellToken)
    };
  };

  const sortedData = sortData(filteredData);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-none mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">CowSwap Trades Table</h1>
        
        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-center">Date Range</h2>
          
          {/* Quick Selection Buttons */}
          <div className="flex gap-3 justify-center mb-4">
            <button
              onClick={() => {
                if (dataRange) {
                  const endDate = new Date(dataRange.max);
                  const startDate = new Date(endDate);
                  startDate.setDate(endDate.getDate() - 30);
                  setStartDate(format(startDate, 'yyyy-MM-dd'));
                  setEndDate(format(endDate, 'yyyy-MM-dd'));
                }
              }}
              className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors border border-gray-400"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => {
                if (dataRange) {
                  const endDate = new Date(dataRange.max);
                  const startDate = new Date(endDate);
                  startDate.setDate(endDate.getDate() - 90);
                  setStartDate(format(startDate, 'yyyy-MM-dd'));
                  setEndDate(format(endDate, 'yyyy-MM-dd'));
                }
              }}
              className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors border border-gray-400"
            >
              Last 90 Days
            </button>
            <button
              onClick={() => {
                if (dataRange) {
                  setStartDate(format(dataRange.min, 'yyyy-MM-dd'));
                  setEndDate(format(dataRange.max, 'yyyy-MM-dd'));
                }
              }}
              className="px-4 py-2 bg-gray-200 text-black font-semibold rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors border border-gray-400"
            >
              All Data
            </button>
          </div>
          
          <div className="flex gap-4 items-center justify-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={dataRange ? format(dataRange.min, 'yyyy-MM-dd') : undefined}
                max={dataRange ? format(dataRange.max, 'yyyy-MM-dd') : undefined}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={dataRange ? format(dataRange.min, 'yyyy-MM-dd') : undefined}
                max={dataRange ? format(dataRange.max, 'yyyy-MM-dd') : undefined}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-700 font-medium">
              {(() => {
                const totalCounts = getUniqueTransactionCounts();
                const filteredCounts = getFilteredUniqueTransactionCounts();
                const hasDuplicates = totalCounts.totalRows !== totalCounts.uniqueOrders;
                
                return (
                  <div>
                    <div>
                      Showing {filteredCounts.totalRows.toLocaleString()} of {totalCounts.totalRows.toLocaleString()} trade rows
                      {hasDuplicates && (
                        <span className="text-orange-600 font-semibold ml-2">
                          ({filteredCounts.uniqueOrders.toLocaleString()} unique orders)
                        </span>
                      )}
                    </div>
                    {hasDuplicates && (
                      <div className="text-xs text-gray-500 mt-1">
                        Dataset contains {totalCounts.totalRows - totalCounts.uniqueOrders} duplicate order entries
                      </div>
                    )}
                    {(() => {
                      const totalVolume = getTotalSellVolume();
                      if (totalVolume) {
                        return (
                          <div className="mt-1 text-blue-600 font-semibold">
                            <div>
                              Total {totalVolume.tokenName}: {totalVolume.display}
                              <span className="text-xs text-gray-500 ml-1" title={totalVolume.full}>
                                (hover for exact value)
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Mean: {totalVolume.meanDisplay}
                              <span className="text-xs text-gray-500 ml-1" title={totalVolume.meanFull}>
                                (hover for exact value)
                              </span>
                              {' • '}
                              Median: {totalVolume.medianDisplay}
                              <span className="text-xs text-gray-500 ml-1" title={totalVolume.medianFull}>
                                (hover for exact value)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
          
          {/* Token Filters */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Filter by Tokens</label>
            <div className="flex justify-center items-center gap-2">
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Input Token</label>
                <input
                  type="text"
                  value={sellSearchValue}
                  onChange={(e) => {
                    setSellSearchValue(e.target.value);
                    setShowSellSuggestions(true);
                    if (e.target.value === '') {
                      setSelectedSellToken('all');
                    }
                  }}
                  onFocus={() => setShowSellSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSellSuggestions(false), 200)}
                  placeholder="Search input token..."
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                />
                {showSellSuggestions && getSellSuggestions().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {getSellSuggestions().map((token) => (
                      <div
                        key={token}
                        onClick={() => handleSellTokenSelect(token)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{getTokenName(token)}</div>
                        <div className="text-xs text-gray-500 font-mono">{token}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-gray-700 font-semibold mt-6">→</div>
              <div className="relative">
                <label className="block text-xs text-gray-600 mb-1">Output Token</label>
                <input
                  type="text"
                  value={buySearchValue}
                  onChange={(e) => {
                    setBuySearchValue(e.target.value);
                    setShowBuySuggestions(true);
                    if (e.target.value === '') {
                      setSelectedBuyToken('all');
                    }
                  }}
                  onFocus={() => setShowBuySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowBuySuggestions(false), 200)}
                  placeholder="Search output token..."
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                />
                {showBuySuggestions && getBuySuggestions().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {getBuySuggestions().map((token) => (
                      <div
                        key={token}
                        onClick={() => handleBuyTokenSelect(token)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{getTokenName(token)}</div>
                        <div className="text-xs text-gray-500 font-mono">{token}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-center mt-2">
              <button
                onClick={() => {
                  setSelectedSellToken('all');
                  setSelectedBuyToken('all');
                  setSellSearchValue('');
                  setBuySearchValue('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear Token Filters
              </button>
            </div>
          </div>

          {/* Clear All Filters */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (dataRange) {
                  setStartDate(format(dataRange.min, 'yyyy-MM-dd'));
                  setEndDate(format(dataRange.max, 'yyyy-MM-dd'));
                }
                setSelectedSellToken('all');
                setSelectedBuyToken('all');
                setSellSearchValue('');
                setBuySearchValue('');
              }}
              className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors border border-red-300"
            >
              Clear All Filters
            </button>
          </div>

          {/* Cache Clear Button */}
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                try {
                  const response = await fetch('https://mm.la-tribu.xyz/api/cache/clear', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  if (response.ok) {
                    const result = await response.json();
                    alert(`Cache cleared successfully! ${result.message}`);
                  } else {
                    alert('Failed to clear cache. Please try again.');
                  }
                } catch (error) {
                  console.error('Error clearing cache:', error);
                  alert('Error clearing cache. Please check the console for details.');
                }
              }}
              disabled={loading}
              className="px-4 py-2 bg-orange-100 text-orange-700 font-semibold rounded-md hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors border border-orange-300"
              title="Clear API cache"
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Trades Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('formattedDate')}
                  >
                    Date/Time
                    {sortConfig.key === 'formattedDate' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('sellToken')}
                  >
                    Input Token
                    {sortConfig.key === 'sellToken' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('sellVolume')}
                  >
                    Input Amount
                    {sortConfig.key === 'sellVolume' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('buyToken')}
                  >
                    Output Token
                    {sortConfig.key === 'buyToken' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('buyVolume')}
                  >
                    Output Amount
                    {sortConfig.key === 'buyVolume' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((trade, index) => {
                  const sellDecimals = getTokenDecimals(trade.sellToken);
                  const buyDecimals = getTokenDecimals(trade.buyToken);
                  const sellVolume = getAmountValue(trade.sellAmount) / Math.pow(10, sellDecimals);
                  const buyVolume = getAmountValue(trade.buyAmount) / Math.pow(10, buyDecimals);
                  const sellVolumeInfo = formatVolume(sellVolume);
                  const buyVolumeInfo = formatVolume(buyVolume);
                  const tradeDate = fromUnixTime(trade.timestamp);

                  return (
                    <tr key={`${trade.orderUid}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const now = new Date();
                          const diffInMinutes = Math.floor((now.getTime() - tradeDate.getTime()) / (1000 * 60));
                          
                          if (diffInMinutes < 60) {
                            return (
                              <span 
                                className="text-blue-600 font-medium cursor-help" 
                                title={format(tradeDate, 'MMM dd, yyyy HH:mm:ss')}
                              >
                                {diffInMinutes === 0 ? 'Just now' : `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`}
                              </span>
                            );
                          } else {
                            return format(tradeDate, 'MMM dd, yyyy HH:mm:ss');
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-semibold">{getTokenName(trade.sellToken)}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          <button
                            onClick={() => copyToClipboard(trade.sellToken)}
                            className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                            title="Click to copy full address"
                          >
                            {truncateAddress(trade.sellToken)}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span 
                          className="cursor-help" 
                          title={sellVolumeInfo.full}
                        >
                          {sellVolumeInfo.display} {getTokenName(trade.sellToken)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-semibold">{getTokenName(trade.buyToken)}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          <button
                            onClick={() => copyToClipboard(trade.buyToken)}
                            className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                            title="Click to copy full address"
                          >
                            {truncateAddress(trade.buyToken)}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span 
                          className="cursor-help" 
                          title={buyVolumeInfo.display}
                        >
                          {buyVolumeInfo.display} {getTokenName(trade.buyToken)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        <button
                          onClick={() => copyToClipboard(trade._id)}
                          className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                          title="Click to copy full order ID"
                        >
                          {trade._id.substring(0, 10)}...
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-400 text-sm font-medium rounded-md text-black bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-400 text-sm font-medium rounded-md text-black bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, sortedData.length)}
                    </span>{' '}
                    of <span className="font-medium">{sortedData.length}</span> results
                    {(() => {
                      const currentPageVolume = getCurrentPageSellVolume();
                      if (currentPageVolume) {
                        return (
                          <span className="ml-2 text-blue-600 font-semibold">
                            • Page {currentPageVolume.tokenName}: {currentPageVolume.display}
                            <span className="text-xs text-gray-500 ml-1" title={currentPageVolume.full}>
                              (hover for exact value)
                            </span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-400 bg-gray-200 text-sm font-medium text-black hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-gray-400 border-gray-500 text-black'
                              : 'bg-gray-200 border-gray-400 text-black hover:bg-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-400 bg-gray-200 text-sm font-medium text-black hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default TransactionsTable; 