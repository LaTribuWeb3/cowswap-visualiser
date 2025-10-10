#!/usr/bin/env ts-node

import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Restore MongoDB database from a local JSON backup file
 */
async function restoreDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME + '-visualiser' || 'cow-protocol-visualiser';
  const backupDir = path.join(process.cwd(), 'backups');

  console.log('🔄 Starting MongoDB restore...');
  console.log(`📂 Database: ${dbName}`);
  console.log(`📍 MongoDB URI: ${mongoUri}`);

  // List available backup files
  if (!fs.existsSync(backupDir)) {
    console.error('❌ Backup directory does not exist:', backupDir);
    process.exit(1);
  }

  const backupFiles = fs.readdirSync(backupDir)
    .filter(file => file.startsWith(`${dbName}-backup-`) && file.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first

  if (backupFiles.length === 0) {
    console.error('❌ No backup files found in:', backupDir);
    process.exit(1);
  }

  console.log('\n📋 Available backups:');
  backupFiles.forEach((file, index) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  ${index + 1}. ${file} (${sizeMB} MB)`);
  });

  // Get backup file from command line argument or use the most recent
  const backupFileArg = process.argv[2];
  let backupFile: string;

  if (backupFileArg) {
    // Check if it's a number (index) or a filename
    const fileIndex = parseInt(backupFileArg);
    if (!isNaN(fileIndex) && fileIndex > 0 && fileIndex <= backupFiles.length) {
      backupFile = path.join(backupDir, backupFiles[fileIndex - 1]);
    } else if (fs.existsSync(backupFileArg)) {
      backupFile = backupFileArg;
    } else {
      backupFile = path.join(backupDir, backupFileArg);
    }
  } else {
    backupFile = path.join(backupDir, backupFiles[0]);
    console.log(`\n📌 Using most recent backup: ${backupFiles[0]}`);
  }

  if (!fs.existsSync(backupFile)) {
    console.error('❌ Backup file not found:', backupFile);
    process.exit(1);
  }

  console.log(`\n📥 Reading backup file: ${backupFile}`);

  let client: MongoClient | null = null;

  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    
    if (!backupData.metadata || !backupData.documents) {
      throw new Error('Invalid backup file format');
    }

    console.log('\n📊 Backup metadata:');
    console.log(`  Backup date: ${backupData.metadata.backupDate}`);
    console.log(`  Database: ${backupData.metadata.database}`);
    console.log(`  Collection: ${backupData.metadata.collection}`);
    console.log(`  Document count: ${backupData.metadata.documentCount.toLocaleString()}`);

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will DELETE all existing data in the database!');
    console.log(`Database: ${dbName}`);
    console.log(`Collection: transactions`);
    
    const answer = await askQuestion('\nDo you want to continue? (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Restore cancelled by user');
      process.exit(0);
    }

    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('transactions');

    // Delete existing data
    console.log('🗑️  Deleting existing data...');
    const deleteResult = await collection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount.toLocaleString()} existing documents`);

    // Insert backup data
    console.log(`📥 Restoring ${backupData.documents.length.toLocaleString()} documents...`);
    
    if (backupData.documents.length > 0) {
      const insertResult = await collection.insertMany(backupData.documents, { ordered: false });
      console.log(`✅ Restored ${insertResult.insertedCount.toLocaleString()} documents`);
    }

    // Verify count
    const finalCount = await collection.countDocuments();
    console.log(`\n📊 Final document count: ${finalCount.toLocaleString()}`);

    console.log('\n✅ Restore completed successfully!');

  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

/**
 * Ask a question and wait for user input
 */
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Run the restore
restoreDatabase()
  .then(() => {
    console.log('🎉 Restore process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Restore process failed:', error);
    process.exit(1);
  });

