import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { getTokenMetadata, getTokenDisplaySymbol, getTokenDisplayName } from '../utils/tokenMapping';
import type { OrderStats, TokenInfo } from '../types/OrderTypes';
import { configService, type SolverConfig, type MarginConfig, type PricingConfig } from '../services/configService';
import { useNetwork } from '../context/NetworkContext';

// Order interface removed as it's not used in this component

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<Map<string, TokenInfo>>(new Map());
  const [solverConfig, setSolverConfig] = useState<SolverConfig | null>(null);
  const [marginConfig, setMarginConfig] = useState<MarginConfig | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const { apiBaseUrl } = useNetwork();

  useEffect(() => {
    fetchDashboardData();
    fetchConfigData();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!stats?.topTokens) return;
    (async () => {
      try {
        const tokensNeedingMetadata = stats.topTokens
          .filter(token => !token.tokenInfo?.symbol)
          .map(token => token.token);

        if (tokensNeedingMetadata.length === 0) return;

        const newMetadata = new Map<string, TokenInfo>();
        tokensNeedingMetadata.forEach(tokenAddress => {
          const tokenInfo = getTokenMetadata(tokenAddress);
          if (tokenInfo) {
            newMetadata.set(tokenAddress.toLowerCase(), tokenInfo);
          }
        });

        setTokenMetadata(prev => new Map([...prev, ...newMetadata]));
      } catch (error) {
        console.warn('Failed to fetch token metadata:', error);
      }
    })();
  }, [stats?.topTokens]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/dashboard-stats`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch dashboard data');
      }
      const data = await response.json();
      
      // Transform the data to match the expected structure
      const transformedStats = {
        ...data,
        // Add any necessary transformations here if the API response structure changed
      };
      
      setStats(transformedStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigData = async () => {
    try {
      const [solver, margin, pricing] = await Promise.all([
        configService.getSolverInfo(),
        configService.getMarginInfo(),
        configService.getPricingInfo()
      ]);
      
      setSolverConfig(solver);
      setMarginConfig(margin);
      setPricingConfig(pricing);
    } catch (err) {
      console.warn('Failed to fetch config data:', err);
      // Don't set error state for config, it's not critical
    }
  };

  if (loading) {
    return (
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
                  <p className="font-medium">Unable to connect to the API server:</p>
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

  if (!stats) return null;

  return (
    <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
      <div className="py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">O</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalOrders.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">$</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Volume</dt>
                    <dd className="text-lg font-medium text-gray-900">${(stats.totalVolume / 1000000).toFixed(1)}M</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">%</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Markup</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.averageMarkup} bps</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">✓</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Inclusion Rate</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.inclusionRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Tokens */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Top Trading Tokens</h3>
              <div className="space-y-3">
                {stats.topTokens.map((token, index) => {
                  const metadata = token.tokenInfo || tokenMetadata.get(token.token.toLowerCase());
                  const displaySymbol = getTokenDisplaySymbol(token.token, metadata);
                  const displayName = getTokenDisplayName(token.token, metadata);
                  const hasSymbol = metadata?.symbol || getTokenMetadata(token.token)?.symbol;
                  
                  return (
                    <div key={token.token} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {displaySymbol}
                          </p>
                          {displayName && displayName !== displaySymbol && (
                            <p className="text-xs text-gray-500">{displayName}</p>
                          )}
                          {!hasSymbol && (
                            <p className="text-xs text-gray-400">{token.token.slice(0, 6)}...{token.token.slice(-4)}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">{token.count} orders</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Orders by Hour */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Orders by Hour (Last 24h)</h3>
              <div className="space-y-2">
                {stats.ordersByHour.map((hourData) => {
                  const maxCount = Math.max(...stats.ordersByHour.map(h => h.count));
                  const percentage = maxCount > 0 ? (hourData.count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={hourData.hour} className="flex items-center">
                      <div className="w-12 text-sm text-gray-500">
                        {hourData.hour.toString().padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 ml-4">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-8 text-sm text-gray-500 text-right">
                        {hourData.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Solver Configuration */}
        {(solverConfig || marginConfig || pricingConfig) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Solver Info */}
            {solverConfig && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Solver Configuration</h3>
                  <div className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="text-sm text-gray-900">{solverConfig.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Version</dt>
                      <dd className="text-sm text-gray-900">{solverConfig.version}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Timeout</dt>
                      <dd className="text-sm text-gray-900">{solverConfig.timeout}ms</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Max Gas Price</dt>
                      <dd className="text-sm text-gray-900">{parseInt(solverConfig.maxGasPrice) / 1e9} Gwei</dd>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Margin Configuration */}
            {marginConfig && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Margin Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Current Margin</dt>
                      <dd className={`text-sm font-semibold ${marginConfig.basisPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marginConfig.basisPoints} bps ({marginConfig.percentage}%)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Minimum Margin</dt>
                      <dd className="text-sm text-gray-900">{marginConfig.minimumBasisPoints} bps</dd>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {marginConfig.description.basisPoints}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Information */}
            {pricingConfig && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Pricing Status</h3>
                  <div className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Connection</dt>
                      <dd className={`text-sm font-semibold ${pricingConfig.connected ? 'text-green-600' : 'text-red-600'}`}>
                        {pricingConfig.connected ? 'Connected' : 'Disconnected'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Current Price</dt>
                      <dd className="text-sm text-gray-900">${pricingConfig.currentPrice.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Price Age</dt>
                      <dd className={`text-sm ${pricingConfig.isPriceFresh ? 'text-green-600' : 'text-yellow-600'}`}>
                        {pricingConfig.priceAge}ms {pricingConfig.isPriceFresh ? '(Fresh)' : '(Stale)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Last Update</dt>
                      <dd className="text-sm text-gray-900">
                        {format(new Date(pricingConfig.lastUpdate), 'HH:mm:ss')}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="text-sm text-gray-500">
              <p>Last updated: {format(new Date(), 'PPpp')}</p>
              <p className="mt-1">{stats.recentOrders} orders processed in the last hour</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
