// Sample trades data from your parsed output
const tradesData = [
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
const tokenInfo = {
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6
    },
    "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c": {
        symbol: "EURe",
        name: "Euro Coin",
        decimals: 6
    },
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6
    }
};

// Cache for token decimals to avoid repeated contract calls
const tokenDecimalsCache = new Map();

// ERC20 ABI for decimals function
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

// Global variables
let currentTradeData = null;

// Function to fetch token decimals from smart contract
async function getTokenDecimals(tokenAddress) {
    // Check cache first
    if (tokenDecimalsCache.has(tokenAddress)) {
        return tokenDecimalsCache.get(tokenAddress);
    }
    
    try {
        // Use ethers.js or web3 to call the contract
        // For now, we'll use a simple fetch to an Ethereum RPC
        const response = await fetch('https://eth-mainnet.g.alchemy.com/v2/demo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: '0x313ce567' // decimals() function selector
                }, 'latest'],
                id: 1
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        // Parse the hex result to decimal
        const decimals = parseInt(data.result, 16);
        
        // Cache the result
        tokenDecimalsCache.set(tokenAddress, decimals);
        
        return decimals;
    } catch (error) {
        console.error(`Error fetching decimals for ${tokenAddress}:`, error);
        
        // Fallback to known decimals
        const fallbackDecimals = {
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 6, // USDC
            "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c": 6, // EURe
            "0xdAC17F958D2ee523a2206206994597C13D831ec7": 6, // USDT
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 18, // WETH
            "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": 8, // WBTC
            "0x6B175474E89094C44Da98b954EedeAC495271d0F": 18  // DAI
        };
        
        const fallback = fallbackDecimals[tokenAddress] || 18;
        tokenDecimalsCache.set(tokenAddress, fallback);
        return fallback;
    }
}

// Enhanced utility functions for better formatting
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return new Intl.NumberFormat().format(num);
}

function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(amount, decimals = 18) {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 6 
    });
}

function formatCurrency(amount, decimals = 18) {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatPrice(price) {
    const num = parseFloat(price);
    if (num === 0) return '0.00';
    if (num < 0.000001) return num.toExponential(4);
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(6);
    if (num < 100) return num.toFixed(4);
    return num.toFixed(2);
}

function calculateExchangeRate(sellPrice, buyPrice) {
    const rate = parseFloat(buyPrice) / parseFloat(sellPrice);
    if (rate < 0.000001) return rate.toExponential(4);
    if (rate < 0.01) return rate.toFixed(6);
    if (rate < 1) return rate.toFixed(4);
    return rate.toFixed(2);
}

function formatDate(timestamp) {
    const date = new Date(parseInt(timestamp) * 1000);
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

function formatDateTime(dateString) {
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

function formatGasUsed(gasUsed) {
    const gas = parseInt(gasUsed);
    return `${formatNumber(gas)} gas`;
}

function formatGasPrice(gasPrice) {
    const price = parseInt(gasPrice);
    const gwei = price / 1000000000;
    return `${gwei.toFixed(2)} Gwei`;
}

// Initialize the UI
document.addEventListener('DOMContentLoaded', function() {
    populateTradesList();
    setupEventListeners();
});

function setupEventListeners() {
    // Back button
    document.getElementById('backButton').addEventListener('click', showTradesList);
    
    // Tokens collapse toggle
    const tokensCollapseToggle = document.getElementById('tokensCollapseToggle');
    if (tokensCollapseToggle) {
        tokensCollapseToggle.addEventListener('click', function() {
            const content = document.getElementById('tokensContent');
            const isCollapsed = content.style.display === 'none';
            
            if (isCollapsed) {
                content.style.display = 'block';
                tokensCollapseToggle.classList.remove('collapsed');
            } else {
                content.style.display = 'none';
                tokensCollapseToggle.classList.add('collapsed');
            }
        });
    }
    
    // Interactions collapse toggle
    const interactionsCollapseToggle = document.getElementById('interactionsCollapseToggle');
    if (interactionsCollapseToggle) {
        interactionsCollapseToggle.addEventListener('click', function() {
            const content = document.getElementById('interactionsContent');
            const isCollapsed = content.style.display === 'none';
            
            if (isCollapsed) {
                content.style.display = 'block';
                interactionsCollapseToggle.classList.remove('collapsed');
            } else {
                content.style.display = 'none';
                interactionsCollapseToggle.classList.add('collapsed');
            }
        });
    }
    
    // Copy functionality for hash values
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('hash-value')) {
            const text = e.target.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = e.target.textContent;
                e.target.textContent = 'Copied!';
                e.target.style.color = '#10b981';
                
                setTimeout(() => {
                    e.target.textContent = originalText;
                    e.target.style.color = '';
                }, 2000);
            });
        }
    });
}

function populateTradesList() {
    const tradesGrid = document.getElementById('tradesGrid');
    const tradesCount = document.getElementById('tradesCount');
    
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
        tradeElement.setAttribute('data-trade-index', index);
        tradeElement.addEventListener('click', () => showTradeDetails(index));
        
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

function showTradeDetails(tradeIndex) {
    currentTradeData = tradesData[tradeIndex];
    
    // Hide trades list and show details
    document.querySelector('.trades-list').style.display = 'none';
    document.getElementById('tradeDetailsSection').style.display = 'block';
    
    // Populate trade details
    populateTradeOverview();
    populateTokensAndPrices();
    populateInteractions();
}

function showTradesList() {
    // Show trades list and hide details
    document.querySelector('.trades-list').style.display = 'block';
    document.getElementById('tradeDetailsSection').style.display = 'none';
    
    currentTradeData = null;
}

function populateTradeOverview() {
    // Set the table title with transaction hash
    const tableTitleElement = document.getElementById('tableTitle');
    tableTitleElement.textContent = currentTradeData.hash;
    tableTitleElement.style.cursor = 'pointer';
    tableTitleElement.style.textDecoration = 'underline';
    tableTitleElement.title = 'Click to view on CoW Protocol Explorer';
    
    // Add click handler for transaction hash
    tableTitleElement.onclick = function() {
        const explorerUrl = `https://explorer.cow.fi/tx/${currentTradeData.hash}?tab=orders`;
        window.open(explorerUrl, '_blank');
    };
    
    document.getElementById('blockNumber').textContent = formatNumber(parseInt(currentTradeData.blockNumber));
    
    // Enhanced status display
    const statusElement = document.getElementById('status');
    const status = currentTradeData.status;
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `trade-table-value status-${status}`;
    
    document.getElementById('gasUsed').textContent = formatGasUsed(currentTradeData.gasUsed);
    
    // Additional details with better formatting
    const trade = currentTradeData.parsedData.trades[0];
    document.getElementById('receiver').textContent = formatAddress(trade.receiver);
    document.getElementById('validTo').textContent = formatDateTime(trade.validTo);
    document.getElementById('appData').textContent = formatAddress(trade.appData);
    document.getElementById('flags').textContent = trade.flags === 0 ? 'None' : trade.flags;
    
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
    document.getElementById('sellTokenInfo').innerHTML = `
        <div><strong>${sellToken.symbol}</strong> - ${sellToken.name}</div>
        <div style="font-size: 1rem; font-weight: 600; color: #dc3545; margin: 6px 0;">${formatAmount(trade.sellAmount, sellToken.decimals)} ${sellToken.symbol}</div>
        <div style="color: #6c757d; font-size: 0.8rem;">Price: ${formatPrice(sellPrice)}</div>
    `;
    
    // Populate buy token info with better formatting
    document.getElementById('buyTokenInfo').innerHTML = `
        <div><strong>${buyToken.symbol}</strong> - ${buyToken.name}</div>
        <div style="font-size: 1rem; font-weight: 600; color: #198754; margin: 6px 0;">${formatAmount(trade.buyAmount, buyToken.decimals)} ${buyToken.symbol}</div>
        <div style="color: #6c757d; font-size: 0.8rem;">Price: ${formatPrice(buyPrice)}</div>
    `;
    
    // Update metrics with better formatting
        document.getElementById('exchangeRate').textContent = exchangeRate;
    document.getElementById('executedAmount').textContent = formatAmount(trade.executedAmount, sellToken.decimals);
    document.getElementById('feeAmount').textContent = trade.feeAmount === '0' ? 'No fee' : formatAmount(trade.feeAmount, sellToken.decimals);
    
    // Calculate and display actually received amount and difference
    // Actually received should be the executed amount for the buy token
    const expectedAmount = parseFloat(trade.buyAmount);
    const actuallyReceived = parseFloat(trade.executedAmount);
    const difference = actuallyReceived - expectedAmount;
    
    document.getElementById('actuallyReceived').textContent = formatAmount(trade.executedAmount, buyToken.decimals);
    
    const differenceElement = document.getElementById('difference');
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
    
    // Populate conversion rates
    populateConversionRates(trade, sellToken, buyToken, sellPrice, buyPrice).catch(error => {
        console.error('Error populating conversion rates:', error);
    });
}



function populateTokensAndPrices() {
    const tokensGrid = document.getElementById('tokensGrid');
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

async function populateConversionRates(trade, sellToken, buyToken, sellPrice, buyPrice) {
    // Get clearing prices from CoW Protocol settlement data
    const { clearingPrices } = currentTradeData.parsedData;
    
    // Get the clearing prices for the specific tokens in this trade
    const sellTokenClearingPrice = parseFloat(clearingPrices[trade.sellTokenIndex]);
    const buyTokenClearingPrice = parseFloat(clearingPrices[trade.buyTokenIndex]);
    
    // Fetch token decimals if not already cached
    const sellTokenDecimals = await getTokenDecimals(trade.sellToken);
    const buyTokenDecimals = await getTokenDecimals(trade.buyToken);
    
    // Calculate amounts in human-readable format using actual decimals
    const sellAmount = parseFloat(trade.sellAmount) / Math.pow(10, sellTokenDecimals);
    const buyAmount = parseFloat(trade.buyAmount) / Math.pow(10, buyTokenDecimals);
    
    // The clearing prices from CoW Protocol are in terms of the token's smallest unit
    // We need to convert them to human-readable format
    const sellTokenClearingPriceHuman = sellTokenClearingPrice * Math.pow(10, sellTokenDecimals);
    const buyTokenClearingPriceHuman = buyTokenClearingPrice * Math.pow(10, buyTokenDecimals);
    
    // Calculate and populate conversion rates using clearing prices
    const conversionRatesGrid = document.getElementById('conversionRatesGrid');
    
    // Calculate rates based on clearing prices (this is the actual CoW Protocol execution rate)
    const clearingPriceRatio = buyTokenClearingPriceHuman / sellTokenClearingPriceHuman;
    const inverseClearingPriceRatio = sellTokenClearingPriceHuman / buyTokenClearingPriceHuman;
    
    // Calculate rates based on the actual executed amounts
    const executedRate = buyAmount / sellAmount; // How much buyToken per sellToken (actual execution)
    const inverseExecutedRate = sellAmount / buyAmount; // How much sellToken per buyToken (actual execution)
    
    conversionRatesGrid.innerHTML = `
        <div class="conversion-rate-item">
            <div class="conversion-rate-label">Clearing Price Ratio</div>
            <div class="conversion-rate-value">${clearingPriceRatio.toFixed(6)}</div>
            <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">${buyToken.symbol} per ${sellToken.symbol}</div>
        </div>
        <div class="conversion-rate-item">
            <div class="conversion-rate-label">Inverse Clearing Price</div>
            <div class="conversion-rate-value">${inverseClearingPriceRatio.toFixed(6)}</div>
            <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">${sellToken.symbol} per ${buyToken.symbol}</div>
        </div>
        <div class="conversion-rate-item">
            <div class="conversion-rate-label">Executed Rate</div>
            <div class="conversion-rate-value">${executedRate.toFixed(6)}</div>
            <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">Actual ${buyToken.symbol} received per ${sellToken.symbol}</div>
        </div>
        <div class="conversion-rate-item">
            <div class="conversion-rate-label">Inverse Executed Rate</div>
            <div class="conversion-rate-value">${inverseExecutedRate.toFixed(6)}</div>
            <div style="font-size: 0.75rem; color: #6c757d; margin-top: 4px;">Actual ${sellToken.symbol} per ${buyToken.symbol}</div>
        </div>
    `;
}

function populateInteractions() {
    const interactionsList = document.getElementById('interactionsList');
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
            const toggleButton = interactionElement.querySelector('.interaction-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', function() {
                    const dataElement = interactionElement.querySelector('.interaction-data');
                    const isExpanded = dataElement.classList.contains('expanded');
                    
                    if (isExpanded) {
                        dataElement.textContent = truncatedData;
                        dataElement.classList.remove('expanded');
                        toggleButton.textContent = 'Show full data';
                    } else {
                        dataElement.textContent = dataElement.dataset.fullData;
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
    document.getElementById('interactionCount').textContent = `${interactions.length} groups (${totalInteractions} total)`;
}
