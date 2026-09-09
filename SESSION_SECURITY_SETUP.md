# 🔐 Setup Guide for Session Security Features

## Quick Start (5 minutes)

Follow these steps to enable the new session security features:

### Step 1: Update Database Schema ⚙️

You need to add a new column to track password changes. Run this SQL in your Supabase SQL Editor:

```sql
-- Add last_password_change column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN students.last_password_change IS 'Timestamp when password was last changed. Used to invalidate active sessions when credentials are updated by admin.';
```

**OR** use the provided migration file:
- Open `add_session_tracking_column.sql`
- Copy all content
- Paste into Supabase SQL Editor
- Click "Run"

### Step 2: Restart Development Server 🔄

If your dev server is running, stop it and restart:

```bash
npm run dev
```

### Step 3: Test the Features ✅

#### Test Password Change Invalidates Sessions:

1. **Open two browser windows:**
   - Window A: Login as student (e.g., `john@account.com`)
   - Window B: Login as admin (`admin@system.com`)

2. **In Window B (Admin):**
   - Go to Students tab
   - Find the student from Window A
   - Click EDIT button
   - Change their password
   - Save changes

3. **Go back to Window A (Student):**
   - Try to click any link or navigate
   - You should be automatically logged out
   - Redirected to login page

4. **Try logging in again with old password:**
   - Should fail ❌

5. **Login with new password:**
   - Should work ✅

#### Test Responsible User Access Revocation:

1. **Open two browser windows:**
   - Window A: Login as responsible user (e.g., `staff@responsible.com`)
   - Window B: Login as admin

2. **In Window B (Admin):**
   - Go to Students tab
   - Find the responsible user from Window A
   - Click "REVOKE CLEARANCE" button

3. **Go back to Window A (Responsible):**
   - Try to navigate to different tabs
   - Should be automatically logged out
   - Redirected to login page

4. **Try logging in again:**
   - Should fail because `is_responsible` is now false ❌

## What Changed

### New Files Created:
1. `src/lib/session-validation.ts` - Core validation logic
2. `SECURITY_FIXES.md` - Detailed documentation
3. `add_session_tracking_column.sql` - Database migration script

### Files Modified:
1. `src/app/admin/page.tsx` - Updated credential handling
2. `src/lib/session.ts` - Added timestamp tracking
3. `src/app/responsible/page.tsx` - Added session validation
4. `src/app/student/library/page.tsx` - Added session validation
5. `src/app/student/account/page.tsx` - Added session validation

## How It Works

### Before (Security Issue):
```
User logs in → Session created
Admin changes password → Session still valid ❌
User continues using old session
```

### After (Fixed):
```
User logs in → Session created with timestamp
Admin changes password → Timestamp updated in database
User tries to navigate → System checks timestamps
Password change time > Login time → Logout ✅
```

## Key Features

✅ **Automatic Logout**: Users are logged out immediately when their credentials change
✅ **No Stale Sessions**: Old passwords/usernames stop working instantly
✅ **Access Control**: Revoked responsible users can't access dashboard
✅ **Simple Implementation**: Just add the column and restart server
✅ **Transparent**: Users see clear error messages

## Troubleshooting

### Issue: Column already exists error
**Solution**: The column might already be added. Check your Supabase schema.

### Issue: Users not being logged out
**Solution**: Make sure you ran the SQL migration and restarted the dev server.

### Issue: TypeScript errors
**Solution**: Run `npm install` to ensure all dependencies are up to date.

### Issue: Session validation not working
**Solution**: Clear browser cache and localStorage, then test again.

## Admin Dashboard Changes

When you change someone's credentials now, you'll see:
- ✅ "Credentials updated successfully! Old credentials are now invalid."

This confirms the system is working correctly.

## Next Steps

1. ✅ Run the SQL migration
2. ✅ Restart dev server
3. ✅ Test both scenarios
4. ✅ Deploy to production when ready

## Questions?

Check `SECURITY_FIXES.md` for detailed technical documentation.

---

**Important Notes:**
- This only affects student and responsible user accounts
- Admin accounts use system-level authentication (unchanged)
- All validation happens client-side with database checks
- No sensitive data is stored in localStorage
