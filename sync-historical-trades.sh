#!/bin/bash

echo "🚀 CoW Protocol Historical Trades Sync"
echo "====================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if ts-node is available for direct TypeScript execution
if command -v ts-node &> /dev/null; then
    echo "✅ ts-node found, running TypeScript directly"
    echo "🚀 Starting historical trades sync..."
    ts-node src/scripts/sync-historical-trades.ts "$@"
else
    echo "⚠️ ts-node not found, checking if project is built..."
    
    # Check if the project is built
    if [ ! -f "dist/scripts/sync-historical-trades.js" ]; then
        echo "🔨 Building project first..."
        npm run build
        if [ $? -ne 0 ]; then
            echo "❌ Build failed"
            exit 1
        fi
    fi

    echo "✅ Project built successfully"
    echo

    # Run the compiled JavaScript with any provided arguments
    echo "🚀 Starting historical trades sync..."
    node dist/scripts/sync-historical-trades.js "$@"
fi

echo
echo "✅ Sync completed!"
