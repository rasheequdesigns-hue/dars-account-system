import { supabase } from "./supabase";
import { Student, Book, FundTransaction } from "./types";

// --- Student Actions ---

export async function enrollStudent(data: { name: string; roll: string; class: string; phone: string; username: string; password?: string }) {
  const { data: student, error } = await supabase
    .from('students')
    .insert([{
      full_name: data.name,
      roll_id: data.roll,
      grade: data.class,
      parent_phone: data.phone,
      username: data.username,
      password: data.password, // No default, must be provided
      email_account: `${data.username}@account.com`,
      email_library: `${data.username}@library.com`,
      balance: 0
    }])
    .select()
    .single();

  if (error) throw error;
  return student;
}

export async function fetchStudents() {
  const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

// --- Fund Actions ---

export async function updateStudentBalance(admissionNumber: string, amount: number, type: 'add' | 'sub') {
    // First find student by roll_id (Admission Number)
    const { data: student, error: fetchError } = await supabase
        .from('students')
        .select('id, balance')
        .eq('roll_id', admissionNumber)
        .single();
    
    if (fetchError || !student) throw new Error("Student not found");

    const newBalance = type === 'add' ? student.balance + amount : student.balance - amount;

    const { error: updateError } = await supabase
        .from('students')
        .update({ balance: newBalance })
        .eq('id', student.id);

    if (updateError) throw updateError;

    // Log transaction
    await supabase.from('fund_transactions').insert([{
        student_id: student.id,
        amount: type === 'add' ? amount : -amount,
        type: type === 'add' ? 'deposit' : 'withdrawal',
        description: `Manual adjustment by admin`
    }]);

    return { success: true };
}

export async function bulkDistributeFunds(amount: number, target: 'all' | 'class_10') {
    let query = supabase.from('students').select('id, balance');
    if (target === 'class_10') query = query.eq('grade', '10');

    const { data: students, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!students || students.length === 0) return { count: 0 };

    const perStudent = amount / students.length;

    // Use a Promise.all for faster execution or iterate carefully
    const results = await Promise.all(students.map(async (s) => {
        const newBalance = (s.balance || 0) + perStudent;
        
        // Update student balance
        const { error: updErr } = await supabase
            .from('students')
            .update({ balance: newBalance })
            .eq('id', s.id);
        
        if (updErr) throw updErr;

        // Log transaction
        const { error: txErr } = await supabase.from('fund_transactions').insert([{
            student_id: s.id,
            amount: perStudent,
            type: 'distribution',
            description: `Bulk split of ₹${amount}`
        }]);

        if (txErr) throw txErr;
    }));

    return { count: students.length };
}

// --- Finance Actions ---

export async function postLedgerEntry(purpose: string, type: 'Income' | 'Expense', amount: number) {
  const { error } = await supabase.from('school_finances').insert([{
    description: purpose,
    type: type.toLowerCase(),
    amount: type === 'Income' ? amount : -amount
  }]);
  if (error) throw error;
}

export async function fetchLedgerHistory() {
  const { data, error } = await supabase.from('school_finances').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  return data;
}

// --- Library Actions ---

export async function addBook(book: { number: string, name: string, author: string, rate: string }) {
  const { error } = await supabase.from('books').insert([{
    book_id: book.number,
    title: book.name,
    author: book.author,
    rate: parseFloat(book.rate),
    status: 'available'
  }]);
  if (error) throw error;
}

export async function fetchBooks() {
  const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateBook(id: string, updates: any) {
  const { error } = await supabase.from('books').update(updates).eq('id', id);
  if (error) throw error;
}
