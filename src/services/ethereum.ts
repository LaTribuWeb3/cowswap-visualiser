import {
  createPublicClient,
  http,
  getContract,
  decodeFunctionData,
  formatEther,
  formatUnits,
} from "viem";
import { mainnet } from "viem/chains";
import { GPv2SettlementABI } from "../abi/GPv2SettlementABI";

// CoW Protocol contract address
const COW_PROTOCOL_ADDRESS = "0x9008d19f58aabd9ed0d60971565aa8510560ab41";

export class EthereumService {
  private client;
  private contract;

  constructor() {
    // Get RPC URL from environment variables
    const rpcUrl =
      process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo";

    console.log(`🔗 Using RPC URL: ${rpcUrl}`);

    // Create public client for Ethereum mainnet
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    // Create contract instance
    this.contract = getContract({
      address: COW_PROTOCOL_ADDRESS as `0x${string}`,
      abi: GPv2SettlementABI,
      client: this.client,
    });
  }

  async getBlockTimestamp(blockNumber: number): Promise<number> {
    try {
      const block = await this.client.getBlock({
        blockNumber: BigInt(blockNumber),
      });
      if (block) {
        const timestamp = Number(block.timestamp); // Unix epoch timestamp in seconds
        const date = new Date(timestamp * 1000); // Convert to Date object
        console.log(`Timestamp for block ${blockNumber}: ${timestamp}`);
        console.log(`Date and time (UTC): ${date.toUTCString()}`);
        return timestamp;
      } else {
        console.log(`Block ${blockNumber} not found.`);
      }
    } catch (error) {
      console.error("Error fetching block:", error);
    }
    return 0;
  }

  async fetchTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
    console.log(`🔍 Fetching token symbol for ${tokenAddress}...`);

    const maxRetries = 3;
    const timeoutMs = 10000; // 10 seconds timeout
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Attempt ${attempt}/${maxRetries} to fetch symbol for ${tokenAddress}`
        );

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
        });

        // Create the contract call promise
        const contractCallPromise = this.client.readContract({
          address: tokenAddress,
          abi: [
            {
              type: "function",
              name: "symbol",
              inputs: [],
              outputs: [{ type: "string" }],
              stateMutability: "view",
            },
          ],
          functionName: "symbol",
        });

        // Race between timeout and contract call
        const foundSymbol = (await Promise.race([
          contractCallPromise,
          timeoutPromise,
        ])) as string;

        console.log(
          `✅ Found symbol: ${foundSymbol} for ${tokenAddress} on attempt ${attempt}`
        );
        return foundSymbol;
      } catch (error) {
        lastError = error;
        console.warn(
          `⚠️ Attempt ${attempt}/${maxRetries} failed for ${tokenAddress}:`,
          error
        );

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delayMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    console.error(
      `❌ All ${maxRetries} attempts failed to fetch symbol for ${tokenAddress}. Last error:`,
      lastError
    );

    // Return a fallback symbol based on the address
    const fallbackSymbol = this.generateFallbackSymbol(tokenAddress);
    console.log(
      `🔄 Using fallback symbol: ${fallbackSymbol} for ${tokenAddress}`
    );

    return fallbackSymbol;
  }

  /**
   * Generate a fallback symbol when token symbol fetching fails
   */
  private generateFallbackSymbol(tokenAddress: string): string {
    // Check if it's a known token by address
    const knownTokens: Record<string, string> = {
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
      "0x6B175474E89094C44Da98b954EedeAC495271d0F": "DAI",
      "0x4Fabb145d64652a948d72533023f6E7A623C7C53": "BUSD",
      "0x514910771AF9Ca656af840dff83E8264EcF986CA": "LINK",
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": "UNI",
      "0x7D1AfA7B718fb893dB30A3aBc0Cfc608aCafEBB": "MATIC",
      "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE": "SHIB",
      "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": "HEX",
      "0x4d224452801ACEd8B2F0aebE155379bb5D594381": "APE",
      "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9": "AAVE",
      "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2": "MKR",
      "0xc770EEfAd204B5180dF6a14Ee197D99d808ee52d": "FOX", // This is the one failing in your logs
    };

    if (knownTokens[tokenAddress]) {
      return knownTokens[tokenAddress];
    }

    // Generate a short symbol from the address
    const shortAddress = tokenAddress.slice(2, 8).toUpperCase();
    return `TKN${shortAddress}`;
  }

  async getLatestBlockNumber() {
    return await this.client.getBlockNumber();
  }

  /**
   * Get the last 10 transactions for the CoW Protocol contract
   */
  async getLastTransactions(limit: number = 10) {
    try {
      console.log(
        `🔍 Fetching last ${limit} transactions for CoW Protocol contract...`
      );

      // Get the latest block number
      const latestBlock = await this.getLatestBlockNumber();
      console.log(`📦 Latest block: ${latestBlock}`);

      // Get transactions from recent blocks
      const transactions: any[] = [];
      let blockNumber = latestBlock;
      let count = 0;

      while (count < limit && blockNumber > 0) {
        try {
          const block = await this.client.getBlock({
            blockNumber,
            includeTransactions: true,
          });

          // Debug: Check if the returned block is more recent than our hardcoded limit
          if (block.number > latestBlock) {
            console.log(
              `⚠️  Warning: Block ${block.number} is more recent than hardcoded limit ${latestBlock}`
            );
          }

          if (block.transactions) {
            for (const tx of block.transactions) {
              if (
                typeof tx === "object" &&
                tx.to?.toLowerCase() === COW_PROTOCOL_ADDRESS.toLowerCase()
              ) {
                // Decode transaction data
                const decodedData = this.decodeTransactionData(tx.input);
                const formattedData = this.formatDecodedData(decodedData);

                transactions.push({
                  hash: tx.hash,
                  blockNumber: block.number,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value,
                  gasPrice: tx.gasPrice,
                  gasUsed: tx.gas || 0n,
                  status: "success", // We'll assume success for now
                  decodedFunction: formattedData.functionName,
                  functionDescription: formattedData.description,
                  parsedData: formattedData.parsedData,
                });
                count++;

                if (count >= limit) break;
              }
            }
          }
        } catch (error) {
          console.log(`⚠️  Error fetching block ${blockNumber}:`, error);
        }

        blockNumber--;
      }

      return transactions;
    } catch (error) {
      console.error("❌ Error fetching transactions:", error);
      throw error;
    }
  }

  /**
   * Decode transaction input data to extract function call information
   */
  decodeTransactionData(inputData: string) {
    try {
      if (!inputData || inputData === "0x") {
        return {
          functionName: "transfer",
          args: [],
          decoded: false,
        };
      }

      const decoded = decodeFunctionData({
        abi: GPv2SettlementABI,
        data: inputData as `0x${string}`,
      });

      // Find the function in the ABI to get parameter names
      const functionAbi = GPv2SettlementABI.find(
        (item) => item.type === "function" && item.name === decoded.functionName
      );

      if (functionAbi && functionAbi.inputs && decoded.args) {
        // Create named arguments object
        const namedArgs: Record<string, any> = {};
        functionAbi.inputs.forEach((input, index) => {
          namedArgs[input.name] = (decoded.args as any[])[index];
        });

        return {
          functionName: decoded.functionName,
          args: decoded.args,
          namedArgs,
          decoded: true,
        };
      }

      return {
        functionName: decoded.functionName,
        args: decoded.args,
        namedArgs: {},
        decoded: true,
      };
    } catch (error) {
      // Try to extract function signature from the input data
      const functionSignature = inputData.slice(0, 10);
      return {
        functionName: "unknown",
        args: [],
        namedArgs: {},
        decoded: false,
        error: error instanceof Error ? error.message : "Unknown error",
        functionSignature,
      };
    }
  }

  /**
   * Format decoded transaction data for display
   */
  formatDecodedData(decodedData: any) {
    if (!decodedData.decoded) {
      const description = decodedData.functionSignature
        ? `Unknown function (signature: ${decodedData.functionSignature})`
        : "Simple ETH transfer or unknown function";

      return {
        functionName: decodedData.functionName,
        description,
        details: decodedData.functionSignature
          ? [`Function Signature: ${decodedData.functionSignature}`]
          : [],
        parsedData: null,
      };
    }

    const details: string[] = [];
    let parsedData: any = null;

    switch (decodedData.functionName) {
      case "setPreSignature":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Signed: ${decodedData.args[1]}`);
        parsedData = {
          orderUid: decodedData.args[0],
          signed: decodedData.args[1],
        };
        break;

      case "invalidateOrder":
        details.push(`Order UID: ${decodedData.args[0]}`);
        parsedData = {
          orderUid: decodedData.args[0],
        };
        break;

      case "setSignature":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Signature: ${decodedData.args[1].slice(0, 20)}...`);
        parsedData = {
          orderUid: decodedData.args[0],
          signature: decodedData.args[1],
        };
        break;

      case "settle":
        const tokens = decodedData.namedArgs.tokens || decodedData.args[0];
        const clearingPrices =
          decodedData.namedArgs.clearingPrices || decodedData.args[1];
        const trades = decodedData.namedArgs.trades || decodedData.args[2];
        const interactions =
          decodedData.namedArgs.interactions || decodedData.args[3];

        // Show clearing prices
        if (clearingPrices && clearingPrices.length > 0) {
          details.push(
            `Clearing Prices: ${clearingPrices
              .map((price: bigint) => formatUnits(price, 18))
              .join("\n- ")}`
          );
        }

        // Show order details if available
        if (trades && trades.length > 0) {
          trades.forEach((order: any) => {
            details.push(`Order:`);
            details.push(`  - Sell Token Index: ${order.sellTokenIndex}`);
            details.push(`  - Sell Token: ${tokens[order.sellTokenIndex]}`);
            details.push(`  - Buy Token Index: ${order.buyTokenIndex}`);
            details.push(`  - Buy Token: ${tokens[order.buyTokenIndex]}`);
            details.push(`  - Receiver: ${order.receiver}`);
            details.push(`  - Sell Amount: ${order.sellAmount}`);
            details.push(`  - Buy Amount: ${order.buyAmount}`);
            details.push(`  - Executed Amount: ${order.executedAmount}`);
            details.push(
              `  - Valid To: ${new Date(
                Number(order.validTo) * 1000
              ).toISOString()}`
            );
          });
        }

        // Show interaction count
        if (interactions && interactions.length > 0) {
          details.push(
            `Interactions: ${interactions.length} interaction groups`
          );
        }

        // Create structured parsed data
        parsedData = {
          tokens,
          clearingPrices: clearingPrices?.map((price: bigint) =>
            formatUnits(price, 18)
          ),
          trades: trades?.map((trade: any) => ({
            sellTokenIndex: trade.sellTokenIndex,
            sellToken: tokens[trade.sellTokenIndex],
            buyTokenIndex: trade.buyTokenIndex,
            buyToken: tokens[trade.buyTokenIndex],
            receiver: trade.receiver,
            sellAmount: trade.sellAmount,
            buyAmount: trade.buyAmount,
            executedAmount: trade.executedAmount,
            validTo: new Date(Number(trade.validTo) * 1000).toISOString(),
            appData: trade.appData,
            feeAmount: trade.feeAmount,
            flags: trade.flags,
            signature: trade.signature,
          })),
          interactions,
          numberOfOrders: trades?.length || 0,
          numberOfInteractions: interactions?.length || 0,
        };
        break;

      case "settleSingleOrder":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Settlement Data: ${decodedData.args[1].slice(0, 50)}...`);
        parsedData = {
          orderUid: decodedData.args[0],
          settlementData: decodedData.args[1],
        };
        break;

      case "withdraw":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Recipient: ${decodedData.args[1]}`);
        details.push(`Amount: ${formatEther(decodedData.args[2])} ETH`);
        parsedData = {
          orderUid: decodedData.args[0],
          recipient: decodedData.args[1],
          amount: formatEther(decodedData.args[2]),
        };
        break;

      case "withdrawAll":
        details.push(`Order UID: ${decodedData.args[0]}`);
        details.push(`Recipient: ${decodedData.args[1]}`);
        parsedData = {
          orderUid: decodedData.args[0],
          recipient: decodedData.args[1],
        };
        break;

      default:
        details.push(`Raw Args: ${JSON.stringify(decodedData.args)}`);
        parsedData = {
          rawArgs: decodedData.args,
        };
    }

    return {
      functionName: decodedData.functionName,
      description: this.getFunctionDescription(decodedData.functionName),
      details,
      parsedData,
    };
  }

  /**
   * Get human-readable description for function names
   */
  getFunctionDescription(functionName: string): string {
    const descriptions: Record<string, string> = {
      setPreSignature:
        "Set pre-signature for a CoW Protocol order (order approval)",
      invalidateOrder: "Invalidate/cancel an order",
      setSignature: "Set signature for an order",
      settle: "Settle multiple orders in a batch auction",
      settleSingleOrder: "Settle a single order",
      withdraw: "Withdraw specific amount from order",
      withdrawAll: "Withdraw all funds from order",
      transfer: "Simple ETH transfer",
      unknown: "Unknown function call",
    };

    return descriptions[functionName] || "Unknown function";
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      console.log("📋 Fetching CoW Protocol contract information...");

      // Just return basic contract info without calling functions
      return {
        address: COW_PROTOCOL_ADDRESS,
        name: "CoW Protocol Settlement",
        description:
          "CoW Protocol's main settlement contract for batch auctions",
      };
    } catch (error) {
      console.error("❌ Error fetching contract info:", error);
      throw error;
    }
  }

  /**
   * Get recent events from the contract
   */
  async getRecentEvents(limit: number = 10) {
    try {
      console.log(
        `📡 Fetching last ${limit} events from CoW Protocol contract...`
      );

      const latestBlock = await this.getLatestBlockNumber();
      const fromBlock = latestBlock - 50n; // Look back 50 blocks

      const [orderPlacements, orderCancellations, orderFulfillments] =
        await Promise.all([
          this.client.getLogs({
            address: COW_PROTOCOL_ADDRESS as `0x${string}`,
            event: {
              type: "event",
              name: "OrderPlacement",
              inputs: [
                { type: "bytes", name: "orderUid", indexed: true },
                { type: "address", name: "owner", indexed: true },
                { type: "address", name: "sender", indexed: true },
              ],
            },
            fromBlock,
            toBlock: latestBlock,
          }),
          this.client.getLogs({
            address: COW_PROTOCOL_ADDRESS as `0x${string}`,
            event: {
              type: "event",
              name: "OrderCancellation",
              inputs: [
                { type: "bytes", name: "orderUid", indexed: true },
                { type: "address", name: "owner", indexed: true },
              ],
            },
            fromBlock,
            toBlock: latestBlock,
          }),
          this.client.getLogs({
            address: COW_PROTOCOL_ADDRESS as `0x${string}`,
            event: {
              type: "event",
              name: "OrderFulfillment",
              inputs: [
                { type: "bytes", name: "orderUid", indexed: true },
                { type: "address", name: "owner", indexed: true },
                { type: "address", name: "sender", indexed: true },
              ],
            },
            fromBlock,
            toBlock: latestBlock,
          }),
        ]);

      // Combine and sort events by block number
      const allEvents = [
        ...orderPlacements.map((log) => ({ ...log, type: "OrderPlacement" })),
        ...orderCancellations.map((log) => ({
          ...log,
          type: "OrderCancellation",
        })),
        ...orderFulfillments.map((log) => ({
          ...log,
          type: "OrderFulfillment",
        })),
      ].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

      return allEvents.slice(0, limit);
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      throw error;
    }
  }

  /**
   * Get token decimals from the blockchain
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      console.log(`🔍 Fetching decimals for token: ${tokenAddress}`);

      // Known token decimals for common tokens
      const knownDecimals: Record<string, number> = {
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 6, // USDC
        "0xdAC17F958D2ee523a2206206994597C13D831ec7": 6, // USDT
        "0x1aBaEA1f7C830bD89Acc67eC4d5169aAEb4F05d0": 6, // EURe
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 18, // WETH
        "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": 8, // WBTC
        "0x6B175474E89094C44Da98b954EedeAC495271d0F": 18, // DAI
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": 18, // ETH (placeholder)
      };

      // Check if we know this token
      if (knownDecimals[tokenAddress]) {
        console.log(
          `✅ Using known decimals for ${tokenAddress}: ${knownDecimals[tokenAddress]}`
        );
        return knownDecimals[tokenAddress];
      }

      console.log(
        `🔍 Token ${tokenAddress} not in known list, fetching from blockchain...`
      );

      // Try to fetch from contract
      console.log(`🔍 Calling readContract for ${tokenAddress}...`);
      const result = await this.client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [],
            name: "decimals",
            outputs: [{ name: "", type: "uint8" }],
            type: "function",
          },
        ],
        functionName: "decimals",
      });

      console.log(`🔍 readContract result:`, result);
      const decimals = Number(result);
      console.log(`✅ Fetched decimals for ${tokenAddress}: ${decimals}`);
      return decimals;
    } catch (error) {
      console.error(`❌ Error fetching decimals for ${tokenAddress}:`, error);
      // Return default decimals (18) for ERC20 tokens
      console.log(`⚠️ Using default decimals (18) for ${tokenAddress}`);
      return 18;
    }
  }
}
