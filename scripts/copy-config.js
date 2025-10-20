#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Copy configuration files to dist directory
 */
function copyConfigFiles() {
  const distConfigDir = path.join(__dirname, '..', 'dist', 'config');
  const srcConfigDir = path.join(__dirname, '..', 'src', 'config');
  
  // Create dist/config directory if it doesn't exist
  if (!fs.existsSync(distConfigDir)) {
    fs.mkdirSync(distConfigDir, { recursive: true });
    console.log(`📁 Created directory: ${distConfigDir}`);
  }
  
  // List of config files to copy
  const configFiles = [
    'config.json',
    'rpc-config.json'
  ];
  
  let copiedCount = 0;
  
  // Copy CSS files from src/ui to dist/ui
  const srcUiDir = path.join(__dirname, '..', 'src', 'ui');
  const distUiDir = path.join(__dirname, '..', 'dist', 'ui');
  
  // Create dist/ui directory if it doesn't exist
  if (!fs.existsSync(distUiDir)) {
    fs.mkdirSync(distUiDir, { recursive: true });
    console.log(`📁 Created directory: ${distUiDir}`);
  }
  
  // Copy CSS and HTML files
  const uiFiles = ['styles.css', 'index.html'];
  uiFiles.forEach(file => {
    const srcPath = path.join(srcUiDir, file);
    const destPath = path.join(distUiDir, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied: ${file}`);
      copiedCount++;
    } else {
      console.warn(`⚠️  Source file not found: ${srcPath}`);
    }
  });
  
  configFiles.forEach(file => {
    const srcPath = path.join(srcConfigDir, file);
    const destPath = path.join(distConfigDir, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied: ${file}`);
      copiedCount++;
    } else {
      console.warn(`⚠️  Source file not found: ${srcPath}`);
    }
  });
  
  console.log(`🎉 Successfully copied ${copiedCount} configuration files to dist/config/`);
}

// Run the copy function
copyConfigFiles();
