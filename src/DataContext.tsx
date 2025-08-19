import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { fromUnixTime } from 'date-fns';

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

interface DataContextType {
  data: Trade[];
  dataRange: { min: Date; max: Date } | null;
  loading: boolean;
  error: string;
  count: number;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<Trade[]>([]);
  const [dataRange, setDataRange] = useState<{ min: Date; max: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [count, setCount] = useState<number>(0);

  const loadData = async (setLoadingState: boolean = true) => {
    try {
      if (setLoadingState) {
        setLoading(true);
      }
      setError('');
      
      // Fetch data from the API endpoint
      const response = await fetch('https://cowswap.mm.la-tribu.xyz/api/documents/latest?&collection=trades');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const jsonData = await response.json();
      
      if (!jsonData.success) {
        throw new Error('API returned unsuccessful response');
      }
      
      const trades = jsonData.data as Trade[];
      const totalCount = jsonData.total || trades.length;
      
      if (trades.length === 0) {
        setError('No data found in API response');
        if (setLoadingState) {
          setLoading(false);
        }
        return;
      }
      
      // Convert timestamps to dates and find range
      let minTimestamp = Infinity;
      let maxTimestamp = -Infinity;
      
      trades.forEach(trade => {
        const timestamp = trade.timestamp;
        if (!isNaN(timestamp)) {
          if (timestamp < minTimestamp) minTimestamp = timestamp;
          if (timestamp > maxTimestamp) maxTimestamp = timestamp;
        }
      });
      
      if (minTimestamp === Infinity || maxTimestamp === -Infinity) {
        setError('No valid timestamps found in data');
        if (setLoadingState) {
          setLoading(false);
        }
        return;
      }
      
      const minDate = fromUnixTime(minTimestamp);
      const maxDate = fromUnixTime(maxTimestamp);
      
      setData(trades);
      setDataRange({ min: minDate, max: maxDate });
      setCount(totalCount);
      if (setLoadingState) {
        setLoading(false);
      }
    } catch (err) {
      setError(`Error loading data from API: ${err}`);
      if (setLoadingState) {
        setLoading(false);
      }
    }
  };

  const refreshData = async () => {
    try {
      console.log('🔄 Starting refresh operation...');
      setLoading(true);
      setError('');
      
      // Add a timeout to prevent loading state from getting stuck
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Refresh operation taking longer than expected, forcing loading state reset');
        setLoading(false);
      }, 30000); // 30 second timeout
      
      // First, clear the cache by making a POST request
      console.log('🗑️ Clearing cache...');
      const clearCacheResponse = await fetch('https://mm.la-tribu.xyz/api/cache/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!clearCacheResponse.ok) {
        console.warn(`⚠️ Cache clear request failed with status: ${clearCacheResponse.status}`);
        // Continue with data loading even if cache clear fails
      } else {
        console.log('✅ Cache cleared successfully');
      }
      
      // Then load the fresh data
      console.log('📥 Loading fresh data...');
      try {
        await loadData(false);
        clearTimeout(timeoutId); // Clear timeout on success
        console.log('✅ Fresh data loaded successfully');
        setLoading(false); // Ensure loading is set to false after successful refresh
      } catch (loadError) {
        // If loadData throws an error, we need to handle it here since setLoadingState was false
        clearTimeout(timeoutId); // Clear timeout on error
        console.error('❌ Error loading fresh data:', loadError);
        setError(`Error loading fresh data: ${loadError}`);
        setLoading(false);
        throw loadError; // Re-throw to be caught by the outer catch block
      }
    } catch (err) {
      console.error('❌ Error during refresh operation:', err);
      setError(`Error refreshing data: ${err}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const value: DataContextType = {
    data,
    dataRange,
    loading,
    error,
    count,
    refreshData
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}; 