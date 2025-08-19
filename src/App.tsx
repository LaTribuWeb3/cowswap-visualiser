import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

import { format, fromUnixTime, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { getTokenName, getTokenDecimals, formatVolume } from './utils';
import TransactionsTable from './TransactionsTable';

import { DataProvider, useData } from './DataContext';
import './App.css';

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

interface TokenStats {
  token: string;
  count: number;
  totalVolume: number;
}

interface PairStats {
  pair: string;
  sellToken: string;
  buyToken: string;
  count: number;
  totalSellVolume: number;
}

// Navigation component
const Navigation: React.FC = () => {
  const location = useLocation();
  const { count } = useData();
  
  return (
    <nav className="bg-white shadow-md mb-6">
      <div className="max-w-none mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CowSwap Visualizer</h1>
            {count > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {count.toLocaleString()} trades loaded
              </p>
            )}
          </div>
          <div className="flex space-x-4 items-center">
            <Link
              to="/"
              className={`px-4 py-2 rounded-md font-medium transition-colors border ${
                location.pathname === '/'
                  ? 'bg-gray-400 text-black border-gray-500'
                  : 'bg-gray-200 text-black border-gray-400 hover:bg-gray-300'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/transactions"
              className={`px-4 py-2 rounded-md font-medium transition-colors border ${
                location.pathname === '/transactions'
                  ? 'bg-gray-400 text-black border-gray-500'
                  : 'bg-gray-200 text-black border-gray-400 hover:bg-gray-300'
              }`}
            >
              Trades Table
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Helper function to get amount value from trade
const getAmountValue = (amount: number | { low: number; high: number; unsigned: boolean }): number => {
  if (typeof amount === 'number') {
    return amount;
  }
  // For BigInt-like objects, use the high value as approximation
  return amount.high;
};

// Dashboard component (existing App logic)
const Dashboard: React.FC = () => {
  const { data, dataRange, loading, error } = useData();
  const [filteredData, setFilteredData] = useState<Trade[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Initialize date range when data is loaded
  useEffect(() => {
    if (dataRange && data.length > 0) {
      setStartDate(format(dataRange.min, 'yyyy-MM-dd'));
      setEndDate(format(dataRange.max, 'yyyy-MM-dd'));
    }
  }, [dataRange, data]);

  // Filter data based on date range
  useEffect(() => {
    if (!data.length || !startDate || !endDate) {
      setFilteredData(data);
      return;
    }

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    const filtered = data.filter(trade => {
      const tradeDate = fromUnixTime(trade.timestamp);
      return isWithinInterval(tradeDate, { start, end });
    });

    setFilteredData(filtered);
  }, [data, startDate, endDate]);

  // Calculate token popularity
  const getTokenStats = (): TokenStats[] => {
    const tokenMap = new Map<string, { token: string; count: number; totalVolume: number }>();

    filteredData.forEach(trade => {
      const sellToken = trade.sellToken;
      const buyToken = trade.buyToken;
      
      // Use correct decimal places for each token
      const sellDecimals = getTokenDecimals(sellToken);
      const sellVolume = getAmountValue(trade.sellAmount) / Math.pow(10, sellDecimals);

      // Count sell tokens and add their volume
      if (tokenMap.has(sellToken)) {
        const existing = tokenMap.get(sellToken)!;
        existing.count++;
        existing.totalVolume += sellVolume;
      } else {
        tokenMap.set(sellToken, {
          token: sellToken,
          count: 1,
          totalVolume: sellVolume
        });
      }

      // Count buy tokens (but don't add their volume)
      if (tokenMap.has(buyToken)) {
        const existing = tokenMap.get(buyToken)!;
        existing.count++;
        // Don't add buy volume to totalVolume
      } else {
        tokenMap.set(buyToken, {
          token: buyToken,
          count: 1,
          totalVolume: 0 // Buy tokens start with 0 volume
        });
      }
    });

    return Array.from(tokenMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 tokens
  };

  // Calculate pair popularity
  const getPairStats = (): PairStats[] => {
    const pairMap = new Map<string, { 
      pair: string; 
      sellToken: string; 
      buyToken: string; 
      count: number; 
      totalSellVolume: number 
    }>();

    filteredData.forEach(trade => {
      const sellToken = trade.sellToken;
      const buyToken = trade.buyToken;
      const pair = `${sellToken} → ${buyToken}`;
      
      // Use correct decimal places for sell token
      const sellDecimals = getTokenDecimals(sellToken);
      const sellVolume = getAmountValue(trade.sellAmount) / Math.pow(10, sellDecimals);

      if (pairMap.has(pair)) {
        const existing = pairMap.get(pair)!;
        existing.count++;
        existing.totalSellVolume += sellVolume;
      } else {
        pairMap.set(pair, {
          pair,
          sellToken,
          buyToken,
          count: 1,
          totalSellVolume: sellVolume
        });
      }
    });

    return Array.from(pairMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 pairs
  };

  // Get summary statistics
  const getSummaryStats = () => {
    const totalTrades = filteredData.length;
    const uniqueTrades = new Set(filteredData.map(t => t.orderUid)).size;
    
    // Count sell tokens
    const sellTokenCounts = new Map<string, number>();
    filteredData.forEach(trade => {
      const sellToken = trade.sellToken;
      sellTokenCounts.set(sellToken, (sellTokenCounts.get(sellToken) || 0) + 1);
    });
    
    // Count buy tokens
    const buyTokenCounts = new Map<string, number>();
    filteredData.forEach(trade => {
      const buyToken = trade.buyToken;
      buyTokenCounts.set(buyToken, (buyTokenCounts.get(buyToken) || 0) + 1);
    });
    
    // Count token pairs
    const pairCounts = new Map<string, number>();
    filteredData.forEach(trade => {
      const sellSymbol = getTokenName(trade.sellToken);
      const buySymbol = getTokenName(trade.buyToken);
      const pair = `${sellSymbol} → ${buySymbol}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    });
    
    // Find most frequent
    const mostSeenSellToken = Array.from(sellTokenCounts.entries())
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    
    const mostSeenBuyToken = Array.from(buyTokenCounts.entries())
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    
    const mostSeenPair = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    return {
      totalTrades,
      uniqueTrades,
      mostSeenSellToken: { token: mostSeenSellToken[0], count: mostSeenSellToken[1] },
      mostSeenBuyToken: { token: mostSeenBuyToken[0], count: mostSeenBuyToken[1] },
      mostSeenPair: { pair: mostSeenPair[0], count: mostSeenPair[1] }
    };
  };

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

  const tokenStats = getTokenStats();
  const pairStats = getPairStats();
  const summaryStats = getSummaryStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-none mx-auto px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Dashboard Overview</h2>
        
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
              Data available from {dataRange ? format(dataRange.min, 'MMM dd, yyyy') : ''} to {dataRange ? format(dataRange.max, 'MMM dd, yyyy') : ''}
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Trades</h3>
            <p className="text-3xl font-bold text-blue-600">{summaryStats.totalTrades.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unique Orders</h3>
            <p className="text-3xl font-bold text-green-600">{summaryStats.uniqueTrades.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Most Seen Sell Token</h3>
            <p className="text-lg font-bold text-purple-600">{getTokenName(summaryStats.mostSeenSellToken.token)}</p>
            <p className="text-sm text-gray-500">{summaryStats.mostSeenSellToken.count} times</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Most Seen Buy Token</h3>
            <p className="text-lg font-bold text-orange-600">{getTokenName(summaryStats.mostSeenBuyToken.token)}</p>
            <p className="text-sm text-gray-500">{summaryStats.mostSeenBuyToken.count} times</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Most Seen Pair</h3>
            <p className="text-lg font-bold text-indigo-600">{summaryStats.mostSeenPair.pair}</p>
            <p className="text-sm text-gray-500">{summaryStats.mostSeenPair.count} times</p>
          </div>
        </div>

        {/* Token Popularity */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-center">Most Popular Tokens</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Token Address</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Trade Count</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sell Volume</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokenStats.map((token, index) => {
                  const volumeInfo = formatVolume(token.totalVolume);
                  return (
                    <tr key={token.token}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-semibold">{getTokenName(token.token)}</div>
                        <div className="text-xs text-gray-500 font-mono">{token.token}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{token.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span 
                          className="cursor-help" 
                          title={volumeInfo.full}
                        >
                          {volumeInfo.display} {getTokenName(token.token)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Pairs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">Most Popular Token Pairs</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Token Pair</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Trade Count</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sell Token Volume</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pairStats.map((pair, index) => {
                  const volumeInfo = formatVolume(pair.totalSellVolume);
                  const sellSymbol = getTokenName(pair.sellToken);
                  const buySymbol = getTokenName(pair.buyToken);
                  return (
                    <tr key={pair.pair}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-semibold">{sellSymbol} → {buySymbol}</div>
                        <div className="text-xs text-gray-500 font-mono">{pair.sellToken} → {pair.buyToken}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{pair.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span 
                          className="cursor-help" 
                          title={volumeInfo.full}
                        >
                          {volumeInfo.display} {sellSymbol}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <Router>
        <Navigation />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<TransactionsTable />} />
        </Routes>
      </Router>
    </DataProvider>
  );
};

export default App;
