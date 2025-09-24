export type SupportedNetwork = 'arbitrum' | 'ethereum';

export function getCurrentNetwork(): SupportedNetwork {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('network');
    if (stored === 'ethereum') return 'ethereum';
  }
  return 'arbitrum';
}

export function getApiBaseUrl(): string {
  const network = getCurrentNetwork();
  return network === 'arbitrum'
    ? 'https://prod.arbitrum.cowswap.la-tribu.xyz'
    : 'https://prod.mainnet.cowswap.la-tribu.xyz';
}

export function getExplorerOrderBaseUrl(): string {
  const network = getCurrentNetwork();
  return network === 'arbitrum'
    ? 'https://explorer.cow.fi/arb1/orders/'
    : 'https://explorer.cow.fi/orders/';
}


