#!/usr/bin/env ts-node

import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Backup MongoDB database to a local JSON file
 */
async function backupDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME + '-visualiser' || 'cow-protocol-visualiser';
  const backupDir = path.join(process.cwd(), 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${dbName}-backup-${timestamp}.json`);

  console.log('🔄 Starting MongoDB backup...');
  console.log(`📂 Database: ${dbName}`);
  console.log(`📍 MongoDB URI: ${mongoUri}`);

  let client: MongoClient | null = null;

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('transactions');

    // Count total documents
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total documents to backup: ${totalCount.toLocaleString()}`);

    if (totalCount === 0) {
      console.log('⚠️  No documents to backup');
      return;
    }

    // Fetch all documents
    console.log('📥 Fetching documents...');
    const documents = await collection.find({}).toArray();
    console.log(`✅ Fetched ${documents.length.toLocaleString()} documents`);

    // Prepare backup data
    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        database: dbName,
        collection: 'transactions',
        documentCount: documents.length,
        version: '1.0.0'
      },
      documents: documents
    };

    // Write to file
    console.log(`💾 Writing backup to: ${backupFile}`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    // Get file size
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Backup completed successfully!');
    console.log(`📄 Backup file: ${backupFile}`);
    console.log(`📦 File size: ${fileSizeMB} MB`);
    console.log(`📊 Documents backed up: ${documents.length.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the backup
backupDatabase()
  .then(() => {
    console.log('🎉 Backup process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Backup process failed:', error);
    process.exit(1);
  });

