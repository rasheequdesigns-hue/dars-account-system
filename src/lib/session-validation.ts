import { supabase } from './supabase';
import { getSession, clearSession } from './session';

/**
 * Validates if the current user session is still valid
 * Checks if user still exists, credentials haven't changed, and access hasn't been revoked
 */
export async function validateSession(): Promise<boolean> {
  const session = getSession();
  
  if (!session) {
    return false;
  }

  // Admin sessions don't need validation (they're system-level)
  if (session.role === 'admin') {
    return true;
  }

  try {
    // Fetch latest user data in a schema-safe way.
    // Selecting specific columns can fail if an optional column
    // (like last_password_change) does not exist in some databases.
    const { data: userData, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', session.id)
      .single();

    // If user doesn't exist (error or no data), they've been deleted
    if (error || !userData) {
      console.log('User not found in database - clearing session');
      clearSession();
      return false;
    }

    // Check if responsible user still has access
    if (session.role === 'responsible' && !userData.is_responsible) {
      console.log('Responsible access revoked - clearing session');
      clearSession();
      return false;
    }

    // Check if password was changed after login
    if (userData?.last_password_change && session.loginTimestamp) {
      const loginTime = new Date(session.loginTimestamp).getTime();
      const passwordChangeTime = new Date(userData.last_password_change).getTime();
      
      if (passwordChangeTime > loginTime) {
        console.log('Password changed after login - clearing session');
        clearSession();
        return false;
      }
    }

    // All checks passed
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    clearSession();
    return false;
  }
}

/**
 * Middleware to check session validity before page load
 * Call this in your page components or layout
 */
export async function requireValidSession(redirectPath: string = '/') {
  const isValid = await validateSession();
  
  if (!isValid && typeof window !== 'undefined') {
    // Redirect to login if session is invalid
    window.location.href = redirectPath;
    return false;
  }
  
  return isValid;
}
