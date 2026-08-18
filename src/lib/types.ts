export interface Student {
  id: string;
  full_name: string;
  email_account: string; // name@account.com
  email_library: string; // name@library.com
  balance: number;
  grade?: string;
  created_at: string;
}

export interface FundTransaction {
  id: string;
  student_id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'distribution';
  description: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  status: 'available' | 'borrowed' | 'lost';
  current_borrower_id?: string;
  cover_url?: string;
}

export interface LibraryLog {
  id: string;
  student_id: string;
  book_id: string;
  borrow_date: string;
  return_date?: string;
  student_name: string;
  book_title: string;
}

export type UserRole = 'admin' | 'student' | 'responsible';
