# Database Backup & Restore

Scripts to backup and restore your MongoDB database locally.

## 📋 Prerequisites

Make sure your `.env` file has the correct MongoDB configuration:
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=cow-protocol
```

## 🗄️ Backup Database

### Create a backup

```bash
npm run backup:db
```

This will:
- ✅ Create a `backups/` directory if it doesn't exist
- ✅ Export all documents from the `transactions` collection
- ✅ Save to a timestamped JSON file: `cow-protocol-backup-YYYY-MM-DDTHH-MM-SS.json`
- ✅ Display backup statistics (document count, file size)

### Backup file location

```
backups/
  ├── cow-protocol-backup-2024-10-10T14-30-00.json
  ├── cow-protocol-backup-2024-10-09T10-15-30.json
  └── ...
```

### Backup file format

```json
{
  "metadata": {
    "backupDate": "2024-10-10T14:30:00.000Z",
    "database": "cow-protocol",
    "collection": "transactions",
    "documentCount": 1234,
    "version": "1.0.0"
  },
  "documents": [
    { ... },
    { ... }
  ]
}
```

## 📥 Restore Database

### Restore from the most recent backup

```bash
npm run restore:db
```

### Restore from a specific backup

**Using the backup number from the list:**
```bash
npm run restore:db 2
```

**Using the backup filename:**
```bash
npm run restore:db cow-protocol-backup-2024-10-10T14-30-00.json
```

**Using a full path:**
```bash
npm run restore:db /path/to/backup.json
```

### Restore process

1. Lists all available backups with sizes
2. Shows backup metadata (date, document count)
3. **Asks for confirmation** (⚠️ will delete existing data!)
4. Deletes all existing documents
5. Restores documents from backup
6. Verifies final count

### Example output

```
🔄 Starting MongoDB restore...
📂 Database: cow-protocol
📍 MongoDB URI: mongodb://localhost:27017

📋 Available backups:
  1. cow-protocol-backup-2024-10-10T14-30-00.json (125.43 MB)
  2. cow-protocol-backup-2024-10-09T10-15-30.json (120.15 MB)

📌 Using most recent backup: cow-protocol-backup-2024-10-10T14-30-00.json

📥 Reading backup file: backups/cow-protocol-backup-2024-10-10T14-30-00.json

📊 Backup metadata:
  Backup date: 2024-10-10T14:30:00.000Z
  Database: cow-protocol
  Collection: transactions
  Document count: 1,234

⚠️  WARNING: This will DELETE all existing data in the database!
Database: cow-protocol
Collection: transactions

Do you want to continue? (yes/no): yes

🔌 Connecting to MongoDB...
✅ Connected to MongoDB
🗑️  Deleting existing data...
✅ Deleted 1,234 existing documents
📥 Restoring 1,234 documents...
✅ Restored 1,234 documents

📊 Final document count: 1,234

✅ Restore completed successfully!
🔌 Disconnected from MongoDB
🎉 Restore process completed
```

## 🛡️ Safety Features

### Backup
- ✅ Non-destructive (only reads data)
- ✅ Creates timestamped files (never overwrites)
- ✅ Includes metadata for verification
- ✅ Shows file size and document count

### Restore
- ✅ Lists all available backups before proceeding
- ✅ Shows backup metadata
- ✅ **Requires explicit "yes" confirmation**
- ✅ Verifies final document count
- ✅ Graceful error handling

## 📝 Best Practices

### Before Re-syncing Data
```bash
# 1. Create a backup
npm run backup:db

# 2. Clear old data (if needed)
npm run cleanup:old-trades

# 3. Re-sync with new string-based amounts
npm run sync:historical
```

### Before Testing Changes
```bash
# 1. Backup current state
npm run backup:db

# 2. Test your changes

# 3. If something goes wrong, restore
npm run restore:db
```

### Regular Backups
```bash
# Create weekly backups
npm run backup:db
```

## 🗑️ Managing Backups

Backups are stored in the `backups/` directory and are automatically excluded from git (via `.gitignore`).

### Delete old backups manually
```bash
# List backups
ls -lh backups/

# Delete specific backup
rm backups/cow-protocol-backup-2024-10-09T10-15-30.json

# Keep only the 5 most recent backups
cd backups && ls -t | tail -n +6 | xargs rm
```

## ⚠️ Important Notes

1. **Full Database Restore**: The restore script deletes ALL existing data before restoring
2. **Confirmation Required**: You must type "yes" to confirm restore
3. **Backup Size**: Backup files can be large (100+ MB) depending on data volume
4. **Git Ignored**: Backup files are not committed to git for security and size reasons
5. **String Format**: All amounts are stored as exact string representations (no precision loss)

## 🚨 Troubleshooting

### "No backup files found"
- Make sure you've run `npm run backup:db` at least once
- Check that the `backups/` directory exists

### "Backup file not found"
- Verify the backup filename or number
- Use `ls backups/` to see available backups

### "Database not connected"
- Check your `.env` file has correct `MONGODB_URI`
- Ensure MongoDB is running locally or accessible

### Permission errors
- Make sure the `backups/` directory has write permissions
- Run the script with appropriate user permissions

## 📚 Use Cases

### Scenario 1: Before Re-syncing
```bash
npm run backup:db        # Backup current data
npm run sync:historical  # Re-sync with new format
```

### Scenario 2: Testing Changes
```bash
npm run backup:db        # Backup before testing
# ... make changes and test ...
npm run restore:db       # Restore if needed
```

### Scenario 3: Data Migration
```bash
npm run backup:db        # Backup old format
# ... update code ...
npm run restore:db       # Restore and process with new code
```

