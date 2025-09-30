import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: "src/ui",
    build: {
      outDir: "../../dist",
      emptyOutDir: false,
      sourcemap: true,
    },
    esbuild: {
      sourcemap: true,
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV || "development"),
      "process.env.RPC_URL": JSON.stringify(env.RPC_URL || ""),
      "process.env.PAIR_API_TOKEN": JSON.stringify(env.PAIR_API_TOKEN || ""),
      "process.env.TOKEN_METADATA_API_TOKEN": JSON.stringify(env.TOKEN_METADATA_API_TOKEN || ""),
      "process.env.API_BASE_URL": JSON.stringify(env.API_BASE_URL || ""),
      "process.env.COW_API_URL": JSON.stringify(
        env.COW_API_URL || "https://api.cow.fi"
      ),
      "process.env.COW_API_KEY": JSON.stringify(env.COW_API_KEY || ""),
      "process.env.BLOCKCHAIN_EXPLORER_URL": JSON.stringify(
        env.BLOCKCHAIN_EXPLORER_URL || "https://etherscan.io"
      ),
      "process.env.TOKENS_METADATA_API_URL": JSON.stringify(
        env.TOKENS_METADATA_API_URL || "https://tokens-metadata.la-tribu.xyz"
      ),
      "process.env.PAIR_PRICING_API_URL": JSON.stringify(
        env.PAIR_PRICING_API_URL || "https://pair-pricing.la-tribu.xyz"
      ),
      "process.env.COW_PROTOCOL_CONTRACT": JSON.stringify(
        env.COW_PROTOCOL_CONTRACT || "0x9008D19f58AAbD9eD0d60971565AA8510560ab41"
      ),
    },
    optimizeDeps: {
      esbuildOptions: {
        sourcemap: true,
      },
    },
    server: {
      port: 3000,
      host: true,
      open: true,
    },
    preview: {
      port: 3000,
      host: true,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  };
});
