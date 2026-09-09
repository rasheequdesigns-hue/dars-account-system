## Library Management (Archive) Section Deletion Guide

This document provides a complete guide to removing the Library Management (Archive) section from the School Manager application.

### What Has Been Deleted

#### 1. **Frontend Code Changes** ✅
**File:** `src/app/admin/page.tsx`

Removed:
- All library-related state variables:
  - `libStudentSearch`, `libStudentSelected`
  - `libBookSearch`, `libBookSelected`
  - `libraryLogs`, `libSubTab`
  - `dueDate`, `showExportModal`, `overdueBooks`
  - `libGlobalFontId`, `libSettings`, `libArchiveSearch`
  - `profilePrivateMsg`, `profileFont` (related to library notifications)

- Library-specific imports:
  - `Archive`, `BookCopy` icons from lucide-react
  - `addBook`, `updateBook` functions from school-actions

- Library functions:
  - `handleAddBook()` - Add books to library
  - `handleUpdateLibFont()` - Update library settings fonts
  - `handleIssueBook()` - Issue books to students
  - `handleExportData()` - Export library data to CSV/XLSX
  - `handleReturnBook()` - Return books to library
  - `handleDamageCharge()` - Apply damage charges to students

- UI Components:
  - `renderLibraryTab()` - Complete library dashboard (321 lines)
  - Library tab in main navigation
  - All library-related forms and displays

- Other references:
  - Library settings CSS styling in main return statement
  - Library data fetching in `refreshData()` function

---

### Database Changes Required

**File to run SQL:** Use Supabase SQL Editor

Run the SQL script in `LIBRARY_DELETION.sql`:

```sql
-- Step 1: Delete all library-related data
DELETE FROM library_logs;
DELETE FROM library_reservations;
DELETE FROM books;
DELETE FROM library_settings;

-- Step 2: Reset sequences
SELECT setval(pg_get_serial_sequence('library_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('library_reservations', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('books', 'id'), 1, false);
```

### Deleted Database Tables (Optional)

If you want to completely remove the library tables from the database, you can run:

```sql
DROP TABLE IF EXISTS library_reservations CASCADE;
DROP TABLE IF EXISTS library_logs CASCADE;
DROP TABLE IF EXISTS library_settings CASCADE;
DROP TABLE IF EXISTS books CASCADE;
```

**Warning:** This is permanent and cannot be undone without a database backup.

---

### Additional Files Affected

#### Student Interface
- **File:** `src/app/student/` pages (if any library-related routes exist)
- These may have references to `email_library` field in the student profile

#### Database Schema
- **Students table:** Contains `email_library` field - can be removed if no longer needed
- **Records:** Check for any foreign key references to deleted tables

---

### Step-by-Step Implementation

#### 1. **Execute Database Deletion** (Recommended Order)
```
1. Go to Supabase Console → SQL Editor
2. Copy contents from LIBRARY_DELETION.sql
3. Paste and execute the queries
4. Verify all tables are empty or deleted
```

#### 2. **Verify Code Compilation**
```
1. Save all changes (already done)
2. Run: npm run build
3. Check for any remaining library references
```

#### 3. **Test the Application**
```
1. Restart development server: npm run dev
2. Navigate through admin panel
3. Verify "Archive" tab is no longer visible
4. Check all other tabs function correctly
```

#### 4. **Search for Remaining References** (Safety Check)
```bash
# Search for any lingering library references
grep -r "library" src/ --include="*.ts" --include="*.tsx"
grep -r "archive" src/ --include="*.ts" --include="*.tsx"
grep -r "book" src/lib/school-actions.ts
```

---

### Removed Database Tables Overview

| Table | Records | Status |
|-------|---------|--------|
| `books` | ✓ Deleted | Contained all books in the library |
| `library_logs` | ✓ Deleted | Transaction logs of book borrowing |
| `library_reservations` | ✓ Deleted | Book reservation records |
| `library_settings` | ✓ Deleted | Global library settings (fonts, etc.) |

---

### Removed Admin Dashboard Tabs

| Tab | Function | Status |
|-----|----------|--------|
| Archive (Library) | Full library management dashboard | ✓ Removed |
| - Issue | Issue books to students | ✓ Removed |
| - Staff | Manage library staff permissions | ✓ Removed |
| - Archive Research | Search and view books | ✓ Removed |
| - Overdue Monitor | Track overdue books | ✓ Removed |
| - Live Monitor | View active book loans | ✓ Removed |

---

### Files NOT Deleted (Intentional)

These files contain documentation and remain for reference:
- `LIBRARY_DELETION.sql` - This deletion guide SQL
- `README.md` - Main project documentation
- Other utility SQL files

---

### Rollback Instructions (If Needed)

If you need to restore the library system:
1. Restore from a database backup
2. Use version control to revert the code changes:
   ```bash
   git restore src/app/admin/page.tsx
   git restore src/components/MobileNavigation.tsx
   ```

---

### Post-Deletion Verification Checklist

- [ ] All library SQL data deleted successfully
- [ ] Admin page compiles without errors
- [ ] Application runs locally without errors
- [ ] Archive tab is no longer visible in admin panel
- [ ] All other admin tabs work correctly
- [ ] Student profiles work (no library-related fields shown)
- [ ] No console errors related to library

---

### Notes

- **Email Library Field:** The `email_library` field remains in the students table for data integrity. It will not be used but can be manually removed later if desired.
- **Font System:** The school fonts table and `library_settings` references have been fully removed.
- **Responsible Users:** The system that grants "responsible" status (library staff) remains intact - it may now be repurposed for other roles.

---

### Support

If you encounter issues during deletion:
1. Check the SQL error messages
2. Verify all foreign key constraints are properly handled
3. Ensure no active sessions are using library data
4. Review the code changes for any missed references

---

**Deletion Date:** April 17, 2026
**Last Updated:** April 17, 2026
