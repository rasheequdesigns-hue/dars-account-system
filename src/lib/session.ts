export interface UserSession {
  email: string;
  role: 'admin' | 'student-account' | 'student-library' | 'responsible';
  name: string;
  roll?: string;
  id?: string;
  loginTimestamp?: string; // Track when user logged in for session validation
}

export function setSession(session: UserSession) {
  if (typeof window !== 'undefined') {
    // Add login timestamp for session validation
    const sessionWithTimestamp = {
      ...session,
      loginTimestamp: new Date().toISOString()
    };
    localStorage.setItem('school_session', JSON.stringify(sessionWithTimestamp));
  }
}

export function getSession(): UserSession | null {
  if (typeof window !== 'undefined') {
    const s = localStorage.getItem('school_session');
    return s ? JSON.parse(s) : null;
  }
  return null;
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('school_session');
  }
}
