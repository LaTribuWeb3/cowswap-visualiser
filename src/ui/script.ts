// EthereumService is now accessed via API calls to the backend

// TypeScript interfaces for the script
interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}

interface Trade {
  sellTokenIndex: number;
  sellToken: `0x${string}`;
  buyTokenIndex: number;
  buyToken: `0x${string}`;
  receiver: `0x${string}`;
  sellAmount: string;
  buyAmount: string;
  executedAmount: string;
  validTo: string;
  appData: `0x${string}`;
  feeAmount: string;
  flags: number;
  signature: `0x${string}`;
}

interface Interaction {
  target: `0x${string}`;
  value: string;
  callData: `0x${string}`;
}

interface ParsedData {
  tokens: `0x${string}`[];
  clearingPrices: string[];
  trades: Trade[];
  interactions: Interaction[][];
  numberOfOrders: number;
  numberOfInteractions: number;
}

interface TradeData {
  hash: `0x${string}`;
  blockNumber: string;
  timestamp: string;
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  gasPrice: string;
  gasUsed: string;
  status: string;
  parsedData: ParsedData;
}

interface ERC20ABI {
  constant: boolean;
  inputs: any[];
  name: string;
  outputs: Array<{ name: string; type: string }>;
  payable: boolean;
  stateMutability: string;
  type: string;
}

// Sample trades data from your parsed output
const tradesData: TradeData[] = [
  {
    "hash": "0xb66dc57f54fba2dfcef26bc1660d8aff87565fcea423918b6f94c3f4c2ec2f3a",
    "blockNumber": "23216802",
    "timestamp": "1756109015",
    "from": "0x95480d3f27658e73b2785d30beb0c847d78294c7",
    "to": "0x9008d19f58aabd9ed0d60971565aa8510560ab41",
    "value": "0",
    "gasPrice": "431886176",
    "gasUsed": "957874",
    "status": "success",
    "parsedData": {
      "tokens": [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c"
      ],
      "clearingPrices": [
        "1",
        "1.164595140129645176",
        "0.000000000597418448",
        "0.00000000069853"
      ],
      "trades": [
        {
          "sellTokenIndex": 2,
          "sellToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "buyTokenIndex": 3,
          "buyToken": "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
          "receiver": "0xbD950B25906e3dc3B656b2d274eA6a3F3ECa34b3",
          "sellAmount": "698530000",
          "buyAmount": "597176393",
          "executedAmount": "698530000",
          "validTo": "2025-08-25T08:24:37.000Z",
          "appData": "0x3ef1ec355cb3194d3a1e132d455851e314ee8130f6ceae91e1fff7a37ddc63f8",
          "feeAmount": "0",
          "flags": 0,
          "signature": "0xe05b8e94c6ef5708c1592211769dac980addad3bea4adcfa3ed5052f62336f01427b0db35d1026ce2b4a284fd811015465008b1360d7e18e6e474ddeb9a599c81b"
        }
      ],
      "interactions": [
        [
          {
            "target": "0x60Bf78233f48eC42eE3F101b9a05eC7878728006",
            "value": "0",
            "callData": "0x760f2a0b000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000001689500000000000000000000000000000000000000000000000000000000000000e4d505accf000000000000000000000000bd950b25906e3dc3b656b2d274ea6a3f3eca34b3000000000000000000000000c92e8bdf79f0507f65a392b0ab4667716bfe0110ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000007213be29000000000000000000000000000000000000000000000000000000000000001bff7157784a9635ee57868d0e85c96fba40d19c53efc759e6eb6fe08ad905e66c48e319af1b90ccd2fc5ce1381679379f4173eff278d628875388596a4f29ad0d00000000000000000000000000000000000000000000000000000000"
          }
        ],
        [
          {
            "target": "0xbbbbbBB520d69a9775E85b458C58c648259FAD5F",
            "value": "0",
            "callData": "0x4dcebcba0000000000000000000000000000000000000000000000000000000068ac18e80000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab410000000000000000000000009ba0cf1588e1dfa905ec948f7fe5104dd40eda310000000000000000000000000000000000000000000000007bf1f3a0a4f52f9b000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f6000000000000000000000000000000000000000000000000000000002b8f6b8400000000000000000000000000000000000000000001209d8a483bc14ba6abbf0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab410000000000000000000000000000000000000000000000000000000000000000a62e41cfd0cbbe235281797a6d4b3d380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000029784fdc0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000411cc870c21161f0e91fadaee34148b6829d7bb989552bb0fbdae294f5cae88c81f5077aca0f54904bcde97a6c0c2a848dd044ef092610f180179135b3cffbab1fa100000000000000000000000000000000000000000000000000000000000000"
          },
          {
            "target": "0x111111125421cA6dc452d289314280a0f8842A65",
            "value": "0",
            "callData": "0x83800a8e000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f60000000000000000000000000000000000000000000112c4185df844e0000000000000000000000000000000000000000000000000000000020363dcef84292000800000000000000000000b5de0c3753b6e1b4dba616db82767f17513e6d4e"
          },
          {
            "target": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "value": "0",
            "callData": "0x2e1a7d4d000000000000000000000000000000000000000000000000021e8410fc1f53b9"
          },
          {
            "target": "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af",
            "value": "152704645861430201",
            "callData": "0x24856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060c0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001abaea1f7c830bd89acc67ec4af516284b1bc33c000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000021e8410fc1f53b90000000000000000000000000000000000000000000000000000000021d416840000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000021e8410fc1f53b900000000000000000000000000000000000000000000000000000000000000400000000000000000000000001abaea1f7c830bd89acc67ec4af516284b1bc33c0000000000000000000000000000000000000000000000000000000021d41684"
          }
        ],
        []
      ],
      "numberOfOrders": 1,
      "numberOfInteractions": 3
    }
  },
  {
    "hash": "0xf5111f0bf837d1510a51a1cd22429338a67fca7347a689b7dd13b8fa7420a69e",
    "blockNumber": "23217116",
    "timestamp": "1756109015",
    "from": "0x95480d3f27658e73b2785d30beb0c847d78294c7",
    "to": "0x9008d19f58aabd9ed0d60971565aa8510560ab41",
    "value": "0",
    "gasPrice": "431886176",
    "gasUsed": "322675",
    "status": "success",
    "parsedData": {
      "tokens": [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      ],
      "clearingPrices": [
        "209349530.502667993307113664",
        "209384855.391181376625248381",
        "0.000000005138801303",
        "0.000000005138788412"
      ],
      "trades": [
        {
          "sellTokenIndex": 2,
          "sellToken": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          "buyTokenIndex": 3,
          "buyToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "receiver": "0x5560b54aeb4Ac6e19fF0fe0aC58A65C8d28ecE63",
          "sellAmount": "5138788412",
          "buyAmount": "5138289195",
          "executedAmount": "5138788412",
          "validTo": "2025-08-25T09:11:50.000Z",
          "appData": "0xa2587df250b20ab8306adcfccfa0415104a685c677b9e2a157ed0bcc11d0e002",
          "feeAmount": "0",
          "flags": 0,
          "signature": "0x4d0ceed0c446beea1c3166adbb250e878800b3d8a97cd4360108aa1eba13e9046cbd2151098db9196db96a9e9765d01fa41cc95c206e43ad8ed91cd6403b33491c"
        }
      ],
      "interactions": [
        [
          {
            "target": "0x60Bf78233f48eC42eE3F101b9a05eC7878728006",
            "value": "0",
            "callData": "0x760f2a0b000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000001689500000000000000000000000000000000000000000000000000000000000000e4d505accf000000000000000000000000bd950b25906e3dc3b656b2d274ea6a3f3eca34b3000000000000000000000000c92e8bdf79f0507f65a392b0ab4667716bfe0110ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000007213be29000000000000000000000000000000000000000000000000000000000000001bff7157784a9635ee57868d0e85c96fba40d19c53efc759e6eb6fe08ad905e66c48e319af1b90ccd2fc5ce1381679379f4173eff278d628875388596a4f29ad0d00000000000000000000000000000000000000000000000000000000"
          }
        ],
        [
          {
            "target": "0xbbbbbBB520d69a9775E85b458C58c648259FAD5F",
            "value": "0",
            "callData": "0x4dcebcba0000000000000000000000000000000000000000000000000000000068ac18e80000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab410000000000000000000000009ba0cf1588e1dfa905ec948f7fe5104dd40eda310000000000000000000000000000000000000000000000007bf1f3a0a4f52f9b000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f6000000000000000000000000000000000000000000000000000000002b8f6b8400000000000000000000000000000000000000000001209d8a483bc14ba6abbf0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab410000000000000000000000000000000000000000000000000000000000000000a62e41cfd0cbbe235281797a6d4b3d380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000029784fdc0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000411cc870c21161f0e91fadaee34148b6829d7bb989552bb0fbdae294f5cae88c81f5077aca0f54904bcde97a6c0c2a848dd044ef092610f180179135b3cffbab1fa100000000000000000000000000000000000000000000000000000000000000"
          },
          {
            "target": "0x111111125421cA6dc452d289314280a0f8842A65",
            "value": "0",
            "callData": "0x83800a8e000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f60000000000000000000000000000000000000000000112c4185df844e0000000000000000000000000000000000000000000000000000000020363dcef84292000800000000000000000000b5de0c3753b6e1b4dba616db82767f17513e6d4e"
          },
          {
            "target": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "value": "0",
            "callData": "0x2e1a7d4d000000000000000000000000000000000000000000000000021e8410fc1f53b9"
          },
          {
            "target": "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af",
            "value": "152704645861430201",
            "callData": "0x24856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000340000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060c0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001abaea1f7c830bd89acc67ec4af516284b1bc33c000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000021e8410fc1f53b90000000000000000000000000000000000000000000000000000000021d416840000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000021e8410fc1f53b900000000000000000000000000000000000000000000000000000000000000400000000000000000000000001abaea1f7c830bd89acc67ec4af516284b1bc33c0000000000000000000000000000000000000000000000000000000021d41684"
          }
        ],
        []
      ],
      "numberOfOrders": 1,
      "numberOfInteractions": 3
    }
  }
];

// Token information mapping with cached decimals
const tokenInfo: Record<`0x${string}`, TokenInfo> = {};

// Global variables
let currentTradeData: TradeData | null = null;

// Enhanced utility functions for better formatting
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return new Intl.NumberFormat().format(num);
}

function formatScientific(value: number | string, threshold: number = 0.001): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  // Use scientific notation for very small numbers
  if (Math.abs(num) < threshold && num !== 0) {
    return num.toExponential(3);
  }
  
  // For larger numbers, use regular formatting with appropriate decimal places
  if (Math.abs(num) >= 1) {
    return num.toFixed(6);
  } else {
    return num.toFixed(8);
  }
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(amount: string | number, decimals: number = 18): string {
  const num = parseFloat(amount.toString()) / Math.pow(10, decimals);
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}

function formatCurrency(amount: string | number, decimals: number = 18): string {
  const num = parseFloat(amount.toString()) / Math.pow(10, decimals);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatPrice(price: string | number): string {
  const num = parseFloat(price.toString());
  if (num === 0) return '0.00';
  
  // Use scientific notation for very small numbers (< 0.01) or very large numbers (> 100)
  if (num < 0.01 || num > 100) {
    return num.toExponential(3);
  }
  
  // For numbers in the normal range, use regular formatting
  if (num < 1) return num.toFixed(6);
  if (num < 100) return num.toFixed(4);
  return num.toFixed(2);
}

function calculateExchangeRate(sellPrice: string | number, buyPrice: string | number): string {
  const rate = parseFloat(buyPrice.toString()) / parseFloat(sellPrice.toString());
  
  // Use scientific notation for very small numbers (< 0.01) or very large numbers (> 100)
  if (rate < 0.01 || rate > 100) {
    return rate.toExponential(3);
  }
  
  // For numbers in the normal range, use regular formatting
  if (rate < 1) return rate.toFixed(4);
  return rate.toFixed(2);
}

function formatDate(timestamp: string | number): string {
  const date = new Date(parseInt(timestamp.toString()) * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

function formatGasUsed(gasUsed: string | number): string {
  const gas = parseInt(gasUsed.toString());
  return `${formatNumber(gas)} gas`;
}

function formatGasPrice(gasPrice: string | number): string {
  const price = parseInt(gasPrice.toString());
  const gwei = price / 1000000000;
  return `${gwei.toFixed(2)} Gwei`;
}

// Initialize the UI
document.addEventListener('DOMContentLoaded', function() {
  populateTradesList();
  setupEventListeners();
});

function setupEventListeners(): void {
  // Back button
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', showTradesList);
  }
  
  // Filter toggle button
  const filterToggleButton = document.getElementById('filterToggleButton');
  if (filterToggleButton) {
    filterToggleButton.addEventListener('click', function() {
      const filtersSection = document.getElementById('filtersSection');
      if (filtersSection) {
        const isVisible = filtersSection.style.display !== 'none';
        
        if (isVisible) {
          filtersSection.style.display = 'none';
          filterToggleButton.classList.remove('active');
        } else {
          filtersSection.style.display = 'block';
          filterToggleButton.classList.add('active');
        }
      }
    });
  }
  
  // Refresh button
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', function() {
      // Add refresh functionality here
      console.log('Refresh clicked');
    });
  }
  
  // Tokens collapse toggle
  const tokensCollapseToggle = document.getElementById('tokensCollapseToggle');
  if (tokensCollapseToggle) {
    tokensCollapseToggle.addEventListener('click', function() {
      const content = document.getElementById('tokensContent');
      if (content) {
        const isCollapsed = content.style.display === 'none';
        
        if (isCollapsed) {
          content.style.display = 'block';
          tokensCollapseToggle.classList.remove('collapsed');
        } else {
          content.style.display = 'none';
          tokensCollapseToggle.classList.add('collapsed');
        }
      }
    });
  }
  
  // Interactions collapse toggle
  const interactionsCollapseToggle = document.getElementById('interactionsCollapseToggle');
  if (interactionsCollapseToggle) {
    interactionsCollapseToggle.addEventListener('click', function() {
      const content = document.getElementById('interactionsContent');
      if (content) {
        const isCollapsed = content.style.display === 'none';
        
        if (isCollapsed) {
          content.style.display = 'block';
          interactionsCollapseToggle.classList.remove('collapsed');
        } else {
          content.style.display = 'none';
          interactionsCollapseToggle.classList.add('collapsed');
        }
      }
    });
  }
  
  // Copy functionality for hash values
  document.addEventListener('click', function(e) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('hash-value')) {
      const text = target.textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          const originalText = target.textContent;
          target.textContent = 'Copied!';
          target.style.color = '#10b981';
          
          setTimeout(() => {
            if (originalText) {
              target.textContent = originalText;
              target.style.color = '';
            }
          }, 2000);
        });
      }
    }
  });
}

function populateTradesList(): void {
  const tradesGrid = document.getElementById('tradesGrid');
  const tradesCount = document.getElementById('tradesCount');
  
  if (!tradesGrid || !tradesCount) return;
  
  tradesGrid.innerHTML = '';
  tradesCount.textContent = `${tradesData.length} trades`;
  
  tradesData.forEach((tradeData, index) => {
    const trade = tradeData.parsedData.trades[0];
    const { tokens, clearingPrices } = tradeData.parsedData;
    
    // Get token information
    const sellToken = tokenInfo[trade.sellToken] || { symbol: 'Unknown', name: 'Unknown Token', decimals: 18 };
    const buyToken = tokenInfo[trade.buyToken] || { symbol: 'Unknown', name: 'Unknown Token', decimals: 18 };
    
    // Calculate exchange rate
    const sellPrice = clearingPrices[trade.sellTokenIndex];
    const buyPrice = clearingPrices[trade.buyTokenIndex];
    const exchangeRate = calculateExchangeRate(sellPrice, buyPrice);
    
    const tradeElement = document.createElement('div');
    tradeElement.className = 'trade-card';
    tradeElement.setAttribute('data-trade-index', index.toString());
    tradeElement.style.cursor = 'pointer';
    
    // Add click event listener with proper event handling
    tradeElement.addEventListener('click', (event) => {
      // Don't trigger if clicking on links or buttons
      if (event.target instanceof HTMLElement) {
        const target = event.target as HTMLElement;
        if (target.closest('a') || target.closest('button')) {
          return; // Let the link/button handle its own click
        }
      }
      // Use the main.ts showTradeDetails function that creates a popup
      // Convert the static trade data to Transaction format
      const tradeData = tradesData[index];
      const transaction: any = {
        hash: tradeData.hash,
        blockNumber: tradeData.blockNumber,
        timestamp: tradeData.timestamp,
        from: tradeData.from,
        to: tradeData.to,
        value: tradeData.value,
        gasPrice: tradeData.gasPrice,
        gasUsed: tradeData.gasUsed,
        status: tradeData.status,
        parsedData: tradeData.parsedData
      };
      
      // Call the main showTradeDetails function
      console.log('🔍 Attempting to call showTradeDetails with transaction:', transaction);
      if (typeof (window as any).showTradeDetails === 'function') {
        console.log('✅ showTradeDetails function found, calling it...');
        (window as any).showTradeDetails(transaction);
      } else {
        console.error('❌ showTradeDetails function not found on window object');
        console.log('🔍 Available window functions:', Object.keys(window).filter(key => key.includes('show')));
      }
    });
    
    tradeElement.innerHTML = `
      <div class="trade-header">
        <div class="trade-hash" style="cursor: pointer; text-decoration: underline; color: #667eea;" title="Click to view on CoW Protocol Explorer" onclick="event.stopPropagation(); window.open('https://explorer.cow.fi/tx/${tradeData.hash}?tab=orders', '_blank');">${formatAddress(tradeData.hash)}</div>
        <div class="trade-status">${tradeData.status.charAt(0).toUpperCase() + tradeData.status.slice(1)}</div>
      </div>
      <div class="trade-info">
        <div class="trade-info-item">
          <span class="trade-info-label">Block</span>
          <span class="trade-info-value">${formatNumber(parseInt(tradeData.blockNumber))}</span>
        </div>
        <div class="trade-info-item">
          <span class="trade-info-label">Gas Used</span>
          <span class="trade-info-value">${formatGasUsed(tradeData.gasUsed)}</span>
        </div>
        <div class="trade-info-item">
          <span class="trade-info-label">Orders</span>
          <span class="trade-info-value">${tradeData.parsedData.numberOfOrders}</span>
        </div>
        <div class="trade-info-item">
          <span class="trade-info-label">Interactions</span>
          <span class="trade-info-value">${tradeData.parsedData.numberOfInteractions}</span>
        </div>
      </div>
      <div class="trade-summary">
        <div class="trade-summary-title">Trade Summary</div>
        <div class="trade-summary-content">
          <span><strong>${formatAmount(trade.sellAmount, sellToken.decimals)} ${sellToken.symbol}</strong></span>
          <i class="fas fa-arrow-right trade-arrow"></i>
          <span><strong>${formatAmount(trade.buyAmount, buyToken.decimals)} ${buyToken.symbol}</strong></span>
        </div>
        <div class="trade-summary-content" style="margin-top: 8px; font-size: 0.85rem; color: #6c757d;">
          <span>Rate: <strong>${exchangeRate}</strong></span>
        </div>
      </div>
    `;
    
    tradesGrid.appendChild(tradeElement);
  });
}

// showTradeDetails function removed - now using the popup version from main.ts

function showTradesList(): void {
  // Show trades list and hide details
  const tradesList = document.querySelector('.trades-list') as HTMLElement;
  const tradeDetailsSection = document.getElementById('tradeDetailsSection');
  
  if (tradesList) tradesList.style.display = 'block';
  if (tradeDetailsSection) tradeDetailsSection.style.display = 'none';
  
  currentTradeData = null;
}

function populateTradeOverview(): void {
  if (!currentTradeData) return;
  
  // Set the table title with transaction hash
  const tableTitleElement = document.getElementById('tableTitle');
  if (tableTitleElement) {
    tableTitleElement.textContent = currentTradeData.hash;
    tableTitleElement.style.cursor = 'pointer';
    tableTitleElement.style.textDecoration = 'underline';
    tableTitleElement.title = 'Click to view on CoW Protocol Explorer';
    
    // Add click handler for transaction hash
    tableTitleElement.onclick = function() {
      const explorerUrl = `https://explorer.cow.fi/tx/${currentTradeData!.hash}?tab=orders`;
      window.open(explorerUrl, '_blank');
    };
  }
  
  const blockNumberElement = document.getElementById('blockNumber');
  if (blockNumberElement) {
    blockNumberElement.textContent = formatNumber(parseInt(currentTradeData.blockNumber));
  }
  
  // Enhanced status display
  const statusElement = document.getElementById('status');
  if (statusElement) {
    const status = currentTradeData.status;
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `trade-table-value status-${status}`;
  }
  
  const gasUsedElement = document.getElementById('gasUsed');
  if (gasUsedElement) {
    gasUsedElement.textContent = formatGasUsed(currentTradeData.gasUsed);
  }
  
  // Additional details with better formatting
  const trade = currentTradeData.parsedData.trades[0];
  const receiverElement = document.getElementById('receiver');
  if (receiverElement) {
    receiverElement.textContent = formatAddress(trade.receiver);
  }
  
  const validToElement = document.getElementById('validTo');
  if (validToElement) {
    validToElement.textContent = formatDateTime(trade.validTo);
  }
  
  const appDataElement = document.getElementById('appData');
  if (appDataElement) {
    appDataElement.textContent = formatAddress(trade.appData);
  }
  
  const flagsElement = document.getElementById('flags');
  if (flagsElement) {
    flagsElement.textContent = trade.flags === 0 ? 'None' : trade.flags.toString();
  }
  
  // Trade flow and metrics with enhanced formatting
  const { tokens, clearingPrices } = currentTradeData.parsedData;
  
  // Get token information
  const sellToken = tokenInfo[trade.sellToken] || { symbol: 'Unknown', name: 'Unknown Token', decimals: 18 };
  const buyToken = tokenInfo[trade.buyToken] || { symbol: 'Unknown', name: 'Unknown Token', decimals: 18 };
  
  // Calculate exchange rate
  const sellPrice = clearingPrices[trade.sellTokenIndex];
  const buyPrice = clearingPrices[trade.buyTokenIndex];
  const exchangeRate = calculateExchangeRate(sellPrice, buyPrice);
  
  // Populate sell token info with better formatting
  const sellTokenInfoElement = document.getElementById('sellTokenInfo');
  if (sellTokenInfoElement) {
    sellTokenInfoElement.innerHTML = `
      <div><strong>${sellToken.symbol}</strong> - ${sellToken.name}</div>
      <div style="font-size: 1rem; font-weight: 600; color: #dc3545; margin: 6px 0;">${formatAmount(trade.sellAmount, sellToken.decimals)} ${sellToken.symbol}</div>
      <div style="color: #6c757d; font-size: 0.8rem;">Price: ${formatPrice(sellPrice)}</div>
    `;
  }
  
  // Populate buy token info with better formatting
  const buyTokenInfoElement = document.getElementById('buyTokenInfo');
  if (buyTokenInfoElement) {
    buyTokenInfoElement.innerHTML = `
      <div><strong>${buyToken.symbol}</strong> - ${buyToken.name}</div>
      <div style="font-size: 1rem; font-weight: 600; color: #198754; margin: 6px 0;">${formatAmount(trade.buyAmount, buyToken.decimals)} ${buyToken.symbol}</div>
      <div style="color: #6c757d; font-size: 0.8rem;">Price: ${formatPrice(buyPrice)}</div>
    `;
  }
  
  // Update metrics with better formatting
  const exchangeRateElement = document.getElementById('exchangeRate');
  if (exchangeRateElement) {
    exchangeRateElement.textContent = exchangeRate;
  }
  
  const executedAmountElement = document.getElementById('executedAmount');
  if (executedAmountElement) {
    executedAmountElement.textContent = formatAmount(trade.executedAmount, sellToken.decimals);
  }
  
  const feeAmountElement = document.getElementById('feeAmount');
  if (feeAmountElement) {
    feeAmountElement.textContent = trade.feeAmount === '0' ? 'No fee' : formatAmount(trade.feeAmount, sellToken.decimals);
  }
  
  // Calculate and display actually received amount and difference
  const expectedAmount = parseFloat(trade.buyAmount);
  const actuallyReceived = parseFloat(trade.executedAmount);
  const difference = actuallyReceived - expectedAmount;
  
  const actuallyReceivedElement = document.getElementById('actuallyReceived');
  if (actuallyReceivedElement) {
    actuallyReceivedElement.textContent = formatAmount(trade.executedAmount, buyToken.decimals);
  }
  
  const differenceElement = document.getElementById('difference');
  if (differenceElement) {
    if (difference > 0) {
      differenceElement.textContent = `+${formatAmount(difference.toString(), buyToken.decimals)}`;
      differenceElement.className = 'metric-difference positive';
    } else if (difference < 0) {
      differenceElement.textContent = `${formatAmount(difference.toString(), buyToken.decimals)}`;
      differenceElement.className = 'metric-difference negative';
    } else {
      differenceElement.textContent = 'No difference';
      differenceElement.className = 'metric-difference';
    }
  }
  
  // Populate conversion rates
  populateConversionRates(trade, sellToken, buyToken, sellPrice, buyPrice).catch(error => {
    console.error('Error populating conversion rates:', error);
  });
}

function populateTokensAndPrices(): void {
  if (!currentTradeData) return;
  
  const tokensGrid = document.getElementById('tokensGrid');
  if (!tokensGrid) return;
  
  const { tokens, clearingPrices } = currentTradeData.parsedData;
  
  tokensGrid.innerHTML = '';
  
  tokens.forEach((token, index) => {
    const tokenData = tokenInfo[token] || { symbol: 'Unknown', name: 'Unknown Token', decimals: 18 };
    const price = clearingPrices[index];
    
    const tokenElement = document.createElement('div');
    tokenElement.className = 'token-item';
    tokenElement.innerHTML = `
      <div class="token-header">
        <div class="token-index">${index}</div>
        <div class="token-address">${formatAddress(token)}</div>
      </div>
      <div class="token-info">
        <strong>${tokenData.symbol}</strong> - ${tokenData.name}
      </div>
      <div class="token-price">${formatPrice(price)}</div>
    `;
    
    tokensGrid.appendChild(tokenElement);
  });
}

async function populateConversionRates(trade: Trade, sellToken: TokenInfo, buyToken: TokenInfo, sellPrice: string, buyPrice: string): Promise<void> {
  if (!currentTradeData) return;
  
  // Get clearing prices from CoW Protocol settlement data
  const { clearingPrices } = currentTradeData.parsedData;
  
  // Get the clearing prices for the specific tokens in this trade
  const sellTokenClearingPrice = parseFloat(clearingPrices[trade.sellTokenIndex]);
  const buyTokenClearingPrice = parseFloat(clearingPrices[trade.buyTokenIndex]);
  
  // Use cached token decimals or default to 18
  const sellTokenDecimals = sellToken.decimals || 18;
  const buyTokenDecimals = buyToken.decimals || 18;
  
  // Calculate amounts in human-readable format using actual decimals
  const sellAmount = parseFloat(trade.sellAmount) / Math.pow(10, sellTokenDecimals);
  const buyAmount = parseFloat(trade.buyAmount) / Math.pow(10, buyTokenDecimals);
  
  // The clearing prices from CoW Protocol are in terms of the token's smallest unit
  const sellTokenClearingPriceHuman = sellTokenClearingPrice * Math.pow(10, sellTokenDecimals);
  const buyTokenClearingPriceHuman = buyTokenClearingPrice * Math.pow(10, buyTokenDecimals);
  
  // Calculate and populate conversion rates using clearing prices
  const conversionRatesGrid = document.getElementById('conversionRatesGrid');
  if (!conversionRatesGrid) return;
  
  // Calculate rates based on clearing prices (this is the actual CoW Protocol execution rate)
  const clearingPriceRatio = buyTokenClearingPriceHuman / sellTokenClearingPriceHuman;
  const inverseClearingPriceRatio = sellTokenClearingPriceHuman / buyTokenClearingPriceHuman;
  
  // Calculate rates based on the actual executed amounts
  const executedRate = buyAmount / sellAmount; // How much buyToken per sellToken (actual execution)
  const inverseExecutedRate = sellAmount / buyAmount; // How much sellToken per buyToken (actual execution)
  
  conversionRatesGrid.innerHTML = `
    <div class="conversion-rate-item">
      <div class="conversion-rate-label">Clearing Price Ratio</div>
      <div class="conversion-rate-value">${formatScientific(clearingPriceRatio)}</div>
      <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">${buyToken.symbol} per ${sellToken.symbol}</div>
    </div>
    <div class="conversion-rate-item">
      <div class="conversion-rate-label">Inverse Clearing Price</div>
      <div class="conversion-rate-value">${formatScientific(inverseClearingPriceRatio)}</div>
      <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">${sellToken.symbol} per ${buyToken.symbol}</div>
    </div>
    <div class="conversion-rate-item">
      <div class="conversion-rate-label">Executed Rate</div>
      <div class="conversion-rate-value">${formatScientific(executedRate)}</div>
      <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">Actual ${buyToken.symbol} received per ${sellToken.symbol}</div>
    </div>
    <div class="conversion-rate-item">
      <div class="conversion-rate-label">Inverse Executed Rate</div>
      <div class="conversion-rate-value">${formatScientific(inverseExecutedRate)}</div>
      <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">Actual ${sellToken.symbol} per ${buyToken.symbol}</div>
    </div>
  `;
}

function populateInteractions(): void {
  if (!currentTradeData) return;
  
  const interactionsList = document.getElementById('interactionsList');
  if (!interactionsList) return;
  
  const { interactions } = currentTradeData.parsedData;
  
  interactionsList.innerHTML = '';
  
  interactions.forEach((group, groupIndex) => {
    if (group.length === 0) return;
    
    const groupElement = document.createElement('div');
    groupElement.className = 'interaction-group';
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'interaction-group-header';
    groupHeader.innerHTML = `
      <div class="interaction-group-title">
        <i class="fas fa-cogs"></i>
        Interaction Group ${groupIndex + 1}
      </div>
      <div class="interaction-count-badge">${group.length}</div>
    `;
    
    groupElement.appendChild(groupHeader);
    
    group.forEach((interaction, interactionIndex) => {
      const interactionElement = document.createElement('div');
      interactionElement.className = 'interaction-item';
      
      // Truncate the call data for initial display
      const truncatedData = interaction.callData.length > 100 
        ? interaction.callData.substring(0, 100) + '...' 
        : interaction.callData;
      
      interactionElement.innerHTML = `
        <div class="interaction-target">${formatAddress(interaction.target)}</div>
        <div class="interaction-data" data-full-data="${interaction.callData}">${truncatedData}</div>
        ${interaction.callData.length > 100 ? '<button class="interaction-toggle">Show full data</button>' : ''}
      `;
      
      // Add click handler for toggle button
      const toggleButton = interactionElement.querySelector('.interaction-toggle') as HTMLButtonElement;
      if (toggleButton) {
        toggleButton.addEventListener('click', function() {
          const dataElement = interactionElement.querySelector('.interaction-data') as HTMLElement;
          const isExpanded = dataElement.classList.contains('expanded');
          
          if (isExpanded) {
            dataElement.textContent = truncatedData;
            dataElement.classList.remove('expanded');
            toggleButton.textContent = 'Show full data';
          } else {
            dataElement.textContent = dataElement.dataset.fullData || '';
            dataElement.classList.add('expanded');
            toggleButton.textContent = 'Hide full data';
          }
        });
      }
      
      groupElement.appendChild(interactionElement);
    });
    
    interactionsList.appendChild(groupElement);
  });
  
  // Update interaction count
  const totalInteractions = interactions.reduce((sum, group) => sum + group.length, 0);
  const interactionCountElement = document.getElementById('interactionCount');
  if (interactionCountElement) {
    interactionCountElement.textContent = `${interactions.length} groups (${totalInteractions} total)`;
  }
}

// Theme Toggle Functionality
function initializeThemeToggle() {
  const themeToggleButton = document.getElementById('themeToggleButton') as HTMLButtonElement;
  const body = document.body;
  
  // Check for saved theme preference or default to light mode
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    body.classList.add('dark-theme');
    updateThemeIcon(true);
  }
  
  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      const isDark = body.classList.contains('dark-theme');
      
      if (isDark) {
        body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        updateThemeIcon(false);
      } else {
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        updateThemeIcon(true);
      }
    });
  }
}

function updateThemeIcon(isDark: boolean) {
  const themeToggleButton = document.getElementById('themeToggleButton') as HTMLButtonElement;
  if (themeToggleButton) {
    const icon = themeToggleButton.querySelector('i');
    if (icon) {
      if (isDark) {
        icon.className = 'fas fa-sun';
        themeToggleButton.title = 'Switch to Light Theme';
      } else {
        icon.className = 'fas fa-moon';
        themeToggleButton.title = 'Switch to Dark Theme';
      }
    }
  }
}

// Initialize theme toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeThemeToggle();
});