#!/usr/bin/env node

/**
 * Test script for Historical Trades Sync
 * This script tests the basic functionality without actually running the full sync
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Historical Trades Sync Setup (Unix Systems Only)');
console.log('==========================================================');

// Check if we're on a Unix-like system
if (process.platform === 'win32') {
    console.log('❌ This project is designed for Unix-based systems only.');
    console.log('⚠️  Windows users should use WSL (Windows Subsystem for Linux) or a Linux virtual machine.');
    console.log('💡 For WSL setup, see: https://docs.microsoft.com/en-us/windows/wsl/install');
    process.exit(1);
}

console.log('✅ Unix-like system detected');

// Check if required files exist
const requiredFiles = [
  'src/scripts/historical-trades-sync.ts',
  'src/scripts/cow-api-historical-sync.ts',
  'src/scripts/sync-historical-trades.ts',
  'sync-historical-trades.sh',
  'HISTORICAL_SYNC_README.md'
];

console.log('\n📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check if package.json has the new scripts
console.log('\n📦 Checking package.json scripts...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts;
  
  const requiredScripts = [
    'sync:historical',
    'sync:historical:api',
    'sync:historical:blockchain',
    'sync:historical:auto'
  ];
  
  requiredScripts.forEach(script => {
    const exists = scripts[script];
    console.log(`${exists ? '✅' : '❌'} ${script}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
  allFilesExist = false;
}

// Check if dist directory exists and has the built files
console.log('\n🔨 Checking build status...');
const distDir = 'dist';
const distExists = fs.existsSync(distDir);

if (distExists) {
  console.log('✅ dist/ directory exists');
  
  // Check if it has the main index file
  const indexExists = fs.existsSync(path.join(distDir, 'index.js'));
  console.log(`${indexExists ? '✅' : '❌'} dist/index.js exists`);
  
  if (!indexExists) {
    console.log('⚠️  Project needs to be built. Run: npm run build');
  }
} else {
  console.log('❌ dist/ directory does not exist');
  console.log('⚠️  Project needs to be built. Run: npm run build');
  allFilesExist = false;
}

// Check environment variables
console.log('\n🌐 Checking environment variables...');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const envVars = {
    'MONGODB_URI': envContent.includes('MONGODB_URI'),
    'RPC_BASE_URL': envContent.includes('RPC_BASE_URL'),
    'RPC_TOKEN': envContent.includes('RPC_TOKEN')
  };
  
  Object.entries(envVars).forEach(([varName, exists]) => {
    console.log(`${exists ? '✅' : '❌'} ${varName}`);
    if (!exists) allFilesExist = false;
  });
} catch (error) {
  console.log('❌ .env file not found or not readable');
  console.log('⚠️  Please create a .env file with required variables');
  allFilesExist = false;
}

// Final summary
console.log('\n📊 Test Summary');
console.log('===============');

if (allFilesExist) {
  console.log('✅ All tests passed! Historical sync is ready to use.');
  console.log('\n🚀 Next steps:');
  console.log('1. Ensure your .env file is configured');
  console.log('2. Run: npm run build');
  console.log('3. Run: npm run sync:historical');
  console.log('\n📚 For more information, see: HISTORICAL_SYNC_README.md');
  console.log('\n💡 Unix-specific commands:');
  console.log('   - Make script executable: chmod +x sync-historical-trades.sh');
  console.log('   - Run with shell script: ./sync-historical-trades.sh');
} else {
  console.log('❌ Some tests failed. Please fix the issues above.');
  console.log('\n🔧 Common fixes:');
  console.log('1. Run: npm run build');
  console.log('2. Check your .env file');
  console.log('3. Verify all required files exist');
  console.log('4. Ensure you have execute permissions: chmod +x sync-historical-trades.sh');
}

console.log('\n✨ Test completed!');
