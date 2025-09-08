import { config } from "dotenv";
import { EthereumService } from "./services/ethereum";

// Load environment variables
config();

console.log("🚀 CoW Swap Visualizer starting...");

async function main() {
  try {
    console.log("📊 CoW Protocol data fetcher initialized");

    // Initialize Ethereum service
    const ethereumService = new EthereumService();

    // Get contract information
    console.log("\n📋 Contract Information:");
    const contractInfo = await ethereumService.getContractInfo();
    console.log(`Contract Address: ${contractInfo.address}`);
    console.log(`Contract Name: ${contractInfo.name}`);
    console.log(`Description: ${contractInfo.description}`);

    // Get last 10 transactions
    console.log("\n🔍 Fetching last 10 transactions...");
    const transactions = await ethereumService.getLastTransactions(10);

    console.log("\n📋 Last 10 Transactions:");
    console.log("=".repeat(120));

    if (transactions.length === 0) {
      console.log(
        "No recent transactions found for the CoW Protocol contract."
      );
    } else {
      console.log(
        JSON.stringify(
          transactions,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2
        )
      );
    }

    // Get recent events
    console.log("\n📡 Recent Events:");
    const events = await ethereumService.getRecentEvents(5);

    if (events.length > 0) {
      events.forEach((event, index) => {
        console.log(`\n${index + 1}. Event Type: ${event.type}`);
        console.log(`   Block Number: ${event.blockNumber}`);
        console.log(`   Transaction Hash: ${event.transactionHash}`);
        console.log(`   Log Index: ${event.logIndex}`);
        console.log("-".repeat(50));
      });
    } else {
      console.log("No recent events found.");
    }

    console.log("\n✅ Application completed successfully!");
  } catch (error) {
    console.error("❌ Error in application:", error);
    process.exit(1);
  }
}

main();
