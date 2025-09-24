import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SupportedNetwork = 'arbitrum' | 'ethereum';

export interface NetworkConfig {
  network: SupportedNetwork;
  apiBaseUrl: string;
  explorerOrderBaseUrl: string;
  chainId: number;
  setNetwork: (network: SupportedNetwork) => void;
}

const DEFAULT_NETWORK: SupportedNetwork = 'arbitrum';

function computeApiBaseUrl(network: SupportedNetwork): string {
  // Adjust here if your backend uses different subdomains/paths
  if (network === 'arbitrum') {
    return 'https://prod.arbitrum.cowswap.la-tribu.xyz';
  } else {
    return 'https://prod.mainnet.cowswap.la-tribu.xyz';
  }
}

function computeExplorerOrderBaseUrl(network: SupportedNetwork): string {
  return network === 'arbitrum'
    ? 'https://explorer.cow.fi/arb1/orders/'
    : 'https://explorer.cow.fi/orders/';
}

function computeChainId(network: SupportedNetwork): number {
  return network === 'arbitrum' ? 42161 : 1;
}

const NetworkContext = createContext<NetworkConfig | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [network, setNetwork] = useState<SupportedNetwork>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('network') : null;
    if (stored === 'arbitrum' || stored === 'ethereum') return stored;
    return DEFAULT_NETWORK;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('network', network);
    } catch {}
  }, [network]);

  const value = useMemo<NetworkConfig>(() => {
    return {
      network,
      apiBaseUrl: computeApiBaseUrl(network),
      explorerOrderBaseUrl: computeExplorerOrderBaseUrl(network),
      chainId: computeChainId(network),
      setNetwork
    };
  }, [network]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

function useNetwork(): NetworkConfig {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return ctx;
}

export { useNetwork };
