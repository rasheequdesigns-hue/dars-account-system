# 🗑️ Database Deletion Guide - Complete Data Removal

## ⚠️ CRITICAL WARNING

**This will PERMANENTLY DELETE ALL DATA from your school management system!**

- ✅ All student accounts will be deleted
- ✅ All book records will be deleted  
- ✅ All library logs, transactions, and notifications will be deleted
- ✅ This CANNOT be undone
- ❌ Admin account (admin@system.com) is NOT stored in database - no deletion needed

---

## 📋 Method 1: Safe Deletion with Verification (Recommended)

### Step-by-Step Instructions:

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

2. **Copy and Paste the Safe Delete Script**
   
   ```sql
   BEGIN;
   
   -- Clear dependent tables first
   DELETE FROM library_reservations;
   DELETE FROM library_logs;
   DELETE FROM fund_transactions;
   DELETE FROM student_groups;
   DELETE FROM school_notifications;
   DELETE FROM school_finances;
   UPDATE library_settings SET font_id = NULL;
   
   -- Clear main tables
   DELETE FROM students;
   DELETE FROM books;
   
   COMMIT;
   ```

3. **Click "Run"** or press `Ctrl+Enter`

4. **Verify Deletion**
   
   Run this query to confirm all data is deleted:
   
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM students) as students,
     (SELECT COUNT(*) FROM books) as books,
     (SELECT COUNT(*) FROM library_logs) as library_logs,
     (SELECT COUNT(*) FROM fund_transactions) as fund_transactions,
     (SELECT COUNT(*) FROM library_reservations) as reservations;
   ```
   
   **Expected Result:** All counts should be `0`

---

## ⚡ Method 2: Quick Delete (Fast)

If you just want to delete everything quickly:

```sql
BEGIN;
DELETE FROM library_reservations;
DELETE FROM library_logs;
DELETE FROM fund_transactions;
DELETE FROM student_groups;
DELETE FROM school_notifications;
DELETE FROM school_finances;
UPDATE library_settings SET font_id = NULL;
DELETE FROM students;
DELETE FROM books;
COMMIT;
```

---

## 🔍 What Gets Deleted?

### Tables Cleared:

| Table Name | What It Contains | Will Be Deleted |
|------------|------------------|-----------------|
| `students` | All student accounts | ✅ YES |
| `books` | All book records | ✅ YES |
| `library_logs` | Book borrowing history | ✅ YES |
| `fund_transactions` | All money transaction records | ✅ YES |
| `library_reservations` | Book reservation requests | ✅ YES |
| `school_finances` | Financial records | ✅ YES |
| `student_groups` | Student groupings | ✅ YES |
| `school_notifications` | System notifications | ✅ YES |

### Tables NOT Deleted:

| Table Name | Reason | Status |
|------------|--------|--------|
| `school_fonts` | Custom fonts (you might want to keep) | ⚠️ Optional |
| `library_settings` | System configuration | ⚠️ Reset only |
| Admin accounts | Not in database (uses system.com login) | ℹ️ No action needed |

---

## 🛡️ Safety Features

The SQL script includes:

1. **Transaction Wrapper (`BEGIN...COMMIT`)**
   - If any error occurs, all changes are rolled back
   - Ensures database stays consistent

2. **Correct Deletion Order**
   - Deletes child tables first (logs, transactions)
   - Then deletes parent tables (students, books)
   - Prevents foreign key constraint errors

3. **Verification Queries**
   - Count records after deletion
   - Confirm all tables are empty
   - Catch any issues immediately

---

## ❓ About Admin Accounts

**Important:** Admin login (`admin@system.com`) does NOT use the database!

- Admin authentication is handled separately
- Uses hardcoded system credentials
- No admin records exist in `students` table
- **No admin deletion is necessary**

Your system uses domain-based authentication:
- `@system.com` → Admin (no database lookup)
- `@account.com` or `@library.com` → Students (database lookup)
- `@responsible.com` → Responsible users (database lookup)

So deleting from `students` table only affects students and responsible users, NOT admins.

---

## 🧪 Testing After Deletion

### Test 1: Verify Empty Database
```sql
SELECT COUNT(*) FROM students; -- Should return 0
SELECT COUNT(*) FROM books;    -- Should return 0
```

### Test 2: Try Logging In
- **Admin**: `admin@system.com` → Should still work ✅
- **Students**: Any old student credentials → Should fail ❌
- **Responsible**: Any old responsible credentials → Should fail ❌

### Test 3: Add New Data
1. Log in as admin
2. Go to "Active Users" tab
3. Should see empty list
4. Try adding a new student → Should work ✅

---

## 🔄 Alternative: Soft Reset (Keep Some Data)

If you want to keep certain data but reset others:

### Reset Only Students (Keep Books):
```sql
BEGIN;
DELETE FROM library_reservations;
DELETE FROM library_logs;
DELETE FROM fund_transactions;
DELETE FROM students;
COMMIT;
```

### Reset Only Library (Keep Students):
```sql
BEGIN;
DELETE FROM library_reservations;
DELETE FROM library_logs;
DELETE FROM books;
COMMIT;
```

### Reset Finances Only:
```sql
BEGIN;
DELETE FROM fund_transactions;
DELETE FROM school_finances;
COMMIT;
```

---

## ⚠️ Troubleshooting

### Error: "Foreign Key Constraint Violation"
**Solution:** Make sure you're deleting in correct order:
1. First: `library_logs`, `fund_transactions`, etc.
2. Then: `students`, `books`

### Error: "Cannot delete because of references"
**Solution:** Check for other dependent tables:
```sql
-- Find what references a student
SELECT * FROM library_logs WHERE student_id = 'student-id-here';
```

### Deletion Didn't Work
**Solution:** 
1. Check if transaction was committed
2. Run verification queries
3. Manually check each table count

---

## 📊 Before & After Comparison

### Before Deletion:
```
Students: 150
Books: 500
Library Logs: 75
Fund Transactions: 200
```

### After Deletion:
```
Students: 0
Books: 0
Library Logs: 0
Fund Transactions: 0
```

---

## 💾 Backup Before Deleting (Optional but Recommended)

Want to save data before deleting? Export first:

### Export Students:
```sql
SELECT * FROM students;
-- Copy results and save as CSV
```

### Export Books:
```sql
SELECT * FROM books;
-- Copy results and save as CSV
```

### Export to Files:
In Supabase:
1. Run SELECT query
2. Click "Download" button
3. Save as CSV file
4. Keep for backup

---

## 🎯 When to Use This

Common scenarios:

✅ **Development/Testing**: Clean slate for testing new features  
✅ **School Year Reset**: Start fresh with new batch of students  
✅ **Data Cleanup**: Remove corrupted or incorrect data  
✅ **System Migration**: Clear old data before importing new  
❌ **Production Use**: Don't use on live system with active users!

---

## 📞 Need Help?

If you encounter issues:

1. **Check Supabase Logs**: Look for error messages
2. **Verify Table Names**: Make sure tables exist in your schema
3. **Test on Copy**: Try on a test database first
4. **Contact Support**: If foreign key issues persist

---

**Last Updated**: April 2026  
**Difficulty**: ⭐ Easy  
**Risk Level**: 🔴 High (Permanent Data Loss)

