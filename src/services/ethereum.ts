import {
  createPublicClient,
  http,
  getContract,
  decodeFunctionData,
  formatEther,
  formatUnits,
} from "viem";
import { arbitrum } from "viem/chains";
import { GPv2SettlementABI } from "../abi/GPv2SettlementABI";

// CoW Protocol contract address (Arbitrum)
const COW_PROTOCOL_ADDRESS = "0x9008d19f58aabd9ed0d60971565aa8510560ab41";

export class EthereumService {
  private client;
  private contract;

  constructor() {
    // Get RPC URL from environment variables
    const rpcUrl =
      process.env.RPC_URL || "https://arb-mainnet.g.alchemy.com/v2/demo"; 

    console.log(`🔗 Using RPC URL: ${rpcUrl}`);

    // Create public client for Arbitrum
    this.client = createPublicClient({
      chain: arbitrum,
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

  async getBlockNumberFromDate(date: Date): Promise<number> {
    /*
     * 1757929503 => 379365564
     * 1757929504 => 379365568
     * 
     * 379365564 / 4 is number of seconds since startTimeStamp until timestamp 1757929503
     * 
     * startTimeStamp: 1757929503 - 379365564 / 4 = 1663088112
     *                 1757929503 -      94841391 = 1663088112                      
     * 
     * Formula: (timestamp - startTimeStamp) * 4
     */
    const startTimeStamp = 1663088112;
    const nowInSeconds = date.getTime() / 1000;
    const blockNumber = Math.floor((nowInSeconds - startTimeStamp) * 4);
    return Number(blockNumber);
  }

  async fetchTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
    try {
      console.log(`🔍 Fetching symbol for token: ${tokenAddress}`);

      // Known token symbols for common tokens
      const knownTokens: Record<string, string> = {
      };

      // Check if we know this token
      if (knownTokens[tokenAddress]) {
        console.log(
          `✅ Using known symbol for ${tokenAddress}: ${knownTokens[tokenAddress]}`
        );
        return knownTokens[tokenAddress];
      }

      console.log(
        `🔍 Token ${tokenAddress} not in known list, fetching from la-tribu API...`
      );

      // Use the comprehensive metadata function
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      console.log(`✅ Fetched symbol for ${tokenAddress}: ${metadata.symbol}`);
      return metadata.symbol;
    } catch (error) {
      console.error(`❌ Error fetching symbol for ${tokenAddress}:`, error);
      // Fallback to generated symbol
      return this.generateFallbackSymbol(tokenAddress);
    }
  }


  /**
   * Generate a fallback symbol when token symbol fetching fails
   */
  private generateFallbackSymbol(tokenAddress: string): string {
    // Check if it's a known token by address
    const knownTokens: Record<string, string> = {
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
      const fromBlock = latestBlock - 10n; // Look back 10 blocks (free tier limit)

      console.log(
        `📦 Block range: ${fromBlock} to ${latestBlock} (${Number(
          latestBlock - fromBlock
        )} blocks)`
      );

      let orderPlacements: any[] = [];
      let orderCancellations: any[] = [];
      let orderFulfillments: any[] = [];

      try {
        [orderPlacements, orderCancellations, orderFulfillments] =
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
      } catch (error: any) {
        console.warn("⚠️ RPC provider limitation detected:", error.message);

        // If the error mentions block range, try with a smaller range
        if (error.message && error.message.includes("block range")) {
          console.log("🔄 Retrying with smaller block range (5 blocks)...");
          const smallerFromBlock = latestBlock - 5n;

          try {
            [orderPlacements, orderCancellations, orderFulfillments] =
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
                  fromBlock: smallerFromBlock,
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
                  fromBlock: smallerFromBlock,
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
                  fromBlock: smallerFromBlock,
                  toBlock: latestBlock,
                }),
              ]);
            console.log(
              "✅ Successfully fetched events with smaller block range"
            );
          } catch (retryError) {
            console.error(
              "❌ Failed even with smaller block range:",
              retryError
            );
            // Return empty arrays to continue execution
            orderPlacements = [];
            orderCancellations = [];
            orderFulfillments = [];
          }
        } else {
          console.error("❌ Unexpected error fetching events:", error);
          // Return empty arrays to continue execution
          orderPlacements = [];
          orderCancellations = [];
          orderFulfillments = [];
        }
      }

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
   * Fetch complete token metadata from la-tribu API
   */
  async fetchTokenMetadata(tokenAddress: `0x${string}`): Promise<{
    address: string;
    network: string;
    name: string;
    symbol: string;
    decimals: number;
    cached: boolean;
    timestamp: string;
  }> {
    try {
      console.log(`🔍 Fetching complete token metadata for: ${tokenAddress}`);
      
      const response = await fetch(`https://tokens-metadata.la-tribu.xyz/tokens/arbitrum/${tokenAddress}`, {
        headers: {
          'Authorization': `Bearer ${process.env.TOKEN_METADATA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.symbol || !data.name) {
        throw new Error('Invalid token metadata response');
      }

      console.log(`✅ Fetched token metadata: ${data.symbol} - ${data.name} (${data.decimals || 18} decimals)`);
      
      return {
        address: data.address,
        network: data.network,
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals || 18,
        cached: data.cached || false,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.warn(`Failed to fetch token metadata for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get token decimals from the la-tribu API
   */
  async getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
    try {
      console.log(`🔍 Fetching decimals for token: ${tokenAddress}`);

      // Known token decimals for common tokens
      const knownDecimals: Record<string, number> = {
      };

      // Check if we know this token
      if (knownDecimals[tokenAddress]) {
        console.log(
          `✅ Using known decimals for ${tokenAddress}: ${knownDecimals[tokenAddress]}`
        );
        return knownDecimals[tokenAddress];
      }

      console.log(
        `🔍 Token ${tokenAddress} not in known list, fetching from la-tribu API...`
      );

      // Use the comprehensive metadata function
      const metadata = await this.fetchTokenMetadata(tokenAddress);
      console.log(`✅ Fetched decimals for ${tokenAddress}: ${metadata.decimals}`);
      return metadata.decimals;
    } catch (error) {
      console.error(`❌ Error fetching decimals for ${tokenAddress}:`, error);
      // Return default decimals (18) for ERC20 tokens
      console.log(`⚠️ Using default decimals (18) for ${tokenAddress}`);
      return 18;
    }
  }
}
