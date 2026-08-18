"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
 enrollStudent, deleteStudent, postLedgerEntry, fetchStudents,
} from "@/lib/school-actions";
import { motion, AnimatePresence } from "framer-motion";
import {
 Users, Wallet, LogOut, BookOpen, Trash2, TrendingUp, UserPlus,
 ChevronRight, X, Save, Banknote, Lock, Search, Activity, ShieldCheck,
 Plus, UsersRound, Calculator, CheckSquare, Square, Clock, Settings,
 ArrowUpRight, ArrowDownRight, RefreshCw, Mail, CheckCircle2, User,
 CreditCard, Upload, Download, Calendar, Zap, DollarSign, Eye, EyeOff,
 AlertTriangle, Database, FileText, BarChart3, Layers, Key,
 Landmark, Vault, GraduationCap, ClipboardList, UserCog, Moon, Sun
} from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/download-utils";
import { useTheme } from "@/components/ThemeProvider";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Student {
 id: string; full_name: string; roll_id: string; grade: string;
 balance: number; email_account?: string; email_library?: string;
 password?: string; rating?: number; is_responsible?: boolean;
 username?: string; last_password_change?: string;
}
interface Group { id: string; name: string; student_ids: string[]; }

function AdminDashboardContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const { theme, toggleTheme } = useTheme();
 const [isMounted, setIsMounted] = useState(false);
 const [activeTab, setActiveTab] = useState("funds");
 const [loading, setLoading] = useState(false);

 // ─── Data State ───────────────────────────────────────────────────────────
 const [students, setStudents] = useState<Student[]>([]);
 const [ledger, setLedger] = useState<any[]>([]);
 const [fundTransactions, setFundTransactions] = useState<any[]>([]);
 const [groups, setGroups] = useState<Group[]>([]);
 const [notifications, setNotifications] = useState<any[]>([]);
 const [books, setBooks] = useState<any[]>([]);
 const [fonts, setFonts] = useState<any[]>([]);
 const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

 // ─── Funds Tab State ──────────────────────────────────────────────────────
 const [bulkAmount, setBulkAmount] = useState("");
 const [bulkPurpose, setBulkPurpose] = useState("");
 const [bulkAction, setBulkAction] = useState<"add" | "sub">("add");
 const [bulkMode, setBulkMode] = useState<"all" | "group">("all");
 const [selectedGroupId, setSelectedGroupId] = useState("");
 const [singleSearch, setSingleSearch] = useState("");
 const [singleSelected, setSingleSelected] = useState<Student | null>(null);
 const [showSingleDropdown, setShowSingleDropdown] = useState(false);
 const [singleAmount, setSingleAmount] = useState("");
 const [singlePurpose, setSinglePurpose] = useState("");
 const [singleType, setSingleType] = useState<"add" | "sub">("add");

 // ─── Finance Tab State ────────────────────────────────────────────────────
 const [ledgerPurpose, setLedgerPurpose] = useState("");
 const [ledgerParty, setLedgerParty] = useState("");
 const [ledgerType, setLedgerType] = useState<"Income" | "Expense">("Income");
 const [ledgerValue, setLedgerValue] = useState("");
 const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().split('T')[0]);
 const [financeStartDate, setFinanceStartDate] = useState("");
 const [financeEndDate, setFinanceEndDate] = useState("");

 // ─── Selective Bulk Add State ─────────────────────────────────────────────
 const [selectiveAmount, setSelectiveAmount] = useState("");
 const [selectivePurpose, setSelectivePurpose] = useState("");
 const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

 // ─── Bulk Credit State ────────────────────────────────────────────────────
 const [bulkCreditPurpose, setBulkCreditPurpose] = useState("");
 const [bulkCreditAmount, setBulkCreditAmount] = useState("");
 const [bulkCreditSearch, setBulkCreditSearch] = useState("");
 const [selectedStudentsForCredit, setSelectedStudentsForCredit] = useState<string[]>([]);

 // ─── Transaction State ────────────────────────────────────────────────────
 const [transactionSearch, setTransactionSearch] = useState("");

 // ─── Student Import State ─────────────────────────────────────────────────
 const [bulkStudentJson, setBulkStudentJson] = useState("");
 const [bulkImportResults, setBulkImportResults] = useState<{success: number; failed: number; errors: string[]; skipped: number}>({success: 0, failed: 0, errors: [], skipped: 0});
 const [showBulkImport, setShowBulkImport] = useState(false);
 const [studentSearch, setStudentSearch] = useState("");
 const [studentBalanceFilter, setStudentBalanceFilter] = useState<"all" | "positive" | "negative">("all");

 // ─── Notification State ───────────────────────────────────────────────────
 const [notifyMsg, setNotifyMsg] = useState("");
 const [selectedFontId, setSelectedFontId] = useState("");
 const [notifyEnd, setNotifyEnd] = useState("");

 // ─── Sub States ───────────────────────────────────────────────────────────
 const [groupName, setGroupName] = useState("");
 const [groupSelected, setGroupSelected] = useState<string[]>([]);
 const [showGroupModal, setShowGroupModal] = useState(false);
 const [showUserModal, setShowUserModal] = useState(false);
 const [userType, setUserType] = useState<"student" | "responsible">("student");
 const [editingUser, setEditingUser] = useState<any>(null);
 const [showCredentialModal, setShowCredentialModal] = useState(false);
 const [editingCredentials, setEditingCredentials] = useState<any>(null);
 const [tempCredentials, setTempCredentials] = useState({ username: "", password: "" });
 const [showTempPassword, setShowTempPassword] = useState(false);
 const [activeUsers, setActiveUsers] = useState<any[]>([]);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 const [userToDelete, setUserToDelete] = useState<Student | null>(null);
 const [deleteConfirmText, setDeleteConfirmText] = useState("");

 // ─── Security Protocol State ──────────────────────────────────────────────
 const [showProfileSettings, setShowProfileSettings] = useState(false);
 const [adminProfile, setAdminProfile] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", newUsername: "" });
 const [showCurrentPw, setShowCurrentPw] = useState(false);
 const [showNewPw, setShowNewPw] = useState(false);
 const [showConfirmPw, setShowConfirmPw] = useState(false);

 // ─── Danger Zone State ────────────────────────────────────────────────────
 const [showPurgeModal, setShowPurgeModal] = useState(false);
 const [showDeleteStudentsModal, setShowDeleteStudentsModal] = useState(false);
 const [purgeConfirmText, setPurgeConfirmText] = useState("");
 const [deleteStudentsConfirmText, setDeleteStudentsConfirmText] = useState("");

 // ─── Mount & URL Sync ─────────────────────────────────────────────────────
 // Single source of truth: searchParams drives activeTab.
 // No circular effects — we just read the URL, never write it from state.
 useEffect(() => {
 setIsMounted(true);
 if (typeof window !== "undefined") {
 const openSecurity = localStorage.getItem("openSecurityModal");
 if (openSecurity === "true") {
 setShowProfileSettings(true);
 localStorage.removeItem("openSecurityModal");
 }
 if (new URLSearchParams(window.location.search).get("showSecurity") === "true") {
 setShowProfileSettings(true);
 window.history.replaceState({}, "", "/admin");
 }
 }
 }, []);

 // Keep activeTab in sync with the URL — URL is always the source of truth
 useEffect(() => {
 const tabFromUrl = searchParams.get("tab") || "funds";
 if (tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchParams]);

 // ─── Computed Values ──────────────────────────────────────────────────────
 const financeStats = useMemo(() => {
 // Only count school-level entries (exclude any student-linked rows)
 const schoolLedger = ledger.filter(l => !l.student_id);
 const totalIncome = schoolLedger.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0);
 const totalExpense = schoolLedger.filter(l => l.amount < 0).reduce((a, l) => a + Math.abs(l.amount), 0);
 const net = totalIncome - totalExpense;
 const studentFundTotal = students.reduce((a, s) => a + (s.balance || 0), 0);
 return { totalIncome, totalExpense, net, studentFundTotal };
 }, [ledger, students]);

 const splitTargetStudents = useMemo(() => {
 if (bulkMode === "all") return students;
 const grp = groups.find(g => g.id === selectedGroupId);
 return grp ? students.filter(s => grp.student_ids.includes(s.id)) : [];
 }, [bulkMode, selectedGroupId, students, groups]);

 const perHead = useMemo(() => {
 const amt = parseFloat(bulkAmount);
 return (!amt || splitTargetStudents.length === 0) ? 0 : amt / splitTargetStudents.length;
 }, [bulkAmount, splitTargetStudents]);

 const searchedTransactions = useMemo(() => {
 const filtered = viewingStudent ? fundTransactions.filter(tx => tx.student_id === viewingStudent.id) : fundTransactions;
 if (!transactionSearch) return filtered;
 const sl = transactionSearch.toLowerCase();
 return filtered.filter(tx => {
 const student = students.find(s => s.id === tx.student_id);
 return (
 student?.full_name.toLowerCase().includes(sl) ||
 student?.roll_id.toLowerCase().includes(sl) ||
 tx.description?.toLowerCase().includes(sl) ||
 tx.type?.toLowerCase().includes(sl) ||
 tx.amount.toString().includes(sl)
 );
 });
 }, [fundTransactions, viewingStudent, transactionSearch, students]);

 const filteredStudents = useMemo(() => {
 let result = students;
 if (studentSearch) {
 const sl = studentSearch.toLowerCase();
 result = result.filter(s =>
 s.full_name.toLowerCase().includes(sl) ||
 s.roll_id.toLowerCase().includes(sl) ||
 s.grade?.toLowerCase().includes(sl)
 );
 }
 if (studentBalanceFilter === "positive") result = result.filter(s => s.balance >= 0);
 if (studentBalanceFilter === "negative") result = result.filter(s => s.balance < 0);
 return result;
 }, [students, studentSearch, studentBalanceFilter]);

 const formatSignedCurrency = (amount: number) => {
 if (amount > 0) return `+₹${Math.abs(amount).toLocaleString()}`;
 if (amount < 0) return `-₹${Math.abs(amount).toLocaleString()}`;
 return `₹0`;
 };

 const getInitials = (name: string) => name?.[0]?.toUpperCase() || "?";

 const AVATAR_COLORS = [
 "from-violet-500 to-purple-600", "from-indigo-500 to-blue-600",
 "from-blue-500 to-cyan-600", "from-emerald-500 to-teal-600",
 "from-amber-500 to-orange-600", "from-rose-500 to-pink-600",
 ];
 const getAvatarGradient = (name: string) => {
 const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
 return AVATAR_COLORS[idx];
 };

 // ─── Handlers ─────────────────────────────────────────────────────────────
 const refreshData = async () => {
 setLoading(true);
 try {
 const [{ data: s }, { data: l }, { data: t }, { data: g }, { data: n }, { data: b }, { data: f }] = await Promise.all([
 supabase.from("students").select("*").order("created_at", { ascending: false }),
 supabase.from("school_finances").select("*").order("created_at", { ascending: false }),
 supabase.from("fund_transactions").select("*").order("created_at", { ascending: false }),
 supabase.from("student_groups").select("*").order("created_at", { ascending: false }),
 supabase.from("school_notifications").select("*").order("created_at", { ascending: false }),
 supabase.from("books").select("*").order("created_at", { ascending: false }),
 supabase.from("school_fonts").select("*").order("name", { ascending: true }),
 ]);
 setStudents(s || []); setActiveUsers(s || []); setLedger(l || []);
 setFundTransactions(t || []); setGroups(g || []); setNotifications(n || []);
 setBooks(b || []); setFonts(f || []);
 } catch (err: any) { console.error(err); }
 finally { setLoading(false); }
 };

 useEffect(() => { refreshData(); }, [activeTab]);
 useEffect(() => { if (students.length > 0) setSelectedStudentsForCredit(students.map(s => s.id)); }, [students]);

 const handleBulkExecute = async () => {
 if (!bulkAmount || splitTargetStudents.length === 0) return;
 setLoading(true);
 try {
 await Promise.all(splitTargetStudents.map(async (s) => {
 // Always fetch fresh balance to avoid stale read-modify-write
 const { data: fresh } = await supabase.from("students").select("balance").eq("id", s.id).single();
 const currentBalance = fresh?.balance ?? 0;
 const amt = bulkAction === "add" ? perHead : -perHead;
 await supabase.from("students").update({ balance: currentBalance + amt }).eq("id", s.id);
 await supabase.from("fund_transactions").insert([{ student_id: s.id, amount: amt, type: bulkAction === "add" ? "distribution" : "withdrawal", description: bulkPurpose || `Bulk ${bulkAction === "add" ? "Add" : "Subtract"} – ₹${perHead.toFixed(2)}/student` }]);
 }));
 setBulkAmount(""); setBulkPurpose(""); await refreshData();
 alert("✅ Bulk operation completed");
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleSingleEntry = async () => {
 if (!singleSelected || !singleAmount) return;
 setLoading(true);
 try {
 const amt = singleType === "add" ? parseFloat(singleAmount) : -parseFloat(singleAmount);
 const { data: current } = await supabase.from("students").select("balance").eq("id", singleSelected.id).single();
 await supabase.from("students").update({ balance: (current?.balance || 0) + amt }).eq("id", singleSelected.id);
 await supabase.from("fund_transactions").insert([{ student_id: singleSelected.id, amount: amt, type: singleType === "add" ? "deposit" : "withdrawal", description: singlePurpose || "Manual adjustment" }]);
 setSingleSelected(null); setSingleAmount(""); setSingleSearch(""); setSinglePurpose(""); await refreshData();
 alert(`✅ ₹${Math.abs(amt)} ${singleType === "add" ? "Added to" : "Deducted from"} Student Account`);
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handlePostLedger = async () => {
 if (!ledgerPurpose || !ledgerValue) return;
 const amt = parseFloat(ledgerValue);
 setLoading(true);
 try {
 const actualAmt = ledgerType === "Income" ? amt : -amt;
 await supabase.from("school_finances").insert([{ description: ledgerPurpose, party_name: ledgerParty, amount: actualAmt, type: ledgerType.toLowerCase(), created_at: ledgerDate ? new Date(ledgerDate).toISOString() : new Date().toISOString() }]);
 setLedgerPurpose(""); setLedgerParty(""); setLedgerValue(""); setLedgerDate(new Date().toISOString().split("T")[0]);
 await refreshData();
 alert(`✅ ${ledgerType} logged: ₹${amt}`);
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleSelectiveBulkAdd = async () => {
 if (!selectiveAmount || selectedStudents.length === 0) return;
 setLoading(true);
 try {
 const amt = parseFloat(selectiveAmount);
 await Promise.all(selectedStudents.map(async (studentId) => {
 const { data: fresh } = await supabase.from("students").select("balance").eq("id", studentId).single();
 const currentBalance = fresh?.balance ?? 0;
 await supabase.from("students").update({ balance: currentBalance + amt }).eq("id", studentId);
 await supabase.from("fund_transactions").insert([{ student_id: studentId, amount: amt, type: "distribution", description: selectivePurpose || "Selective Bulk Add" }]);
 }));
 setSelectiveAmount(""); setSelectivePurpose("");
 await refreshData();
 alert(`✅ ₹${amt} added to ${selectedStudents.length} selected students`);
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const selectAllStudents = () => setSelectedStudents(students.map(s => s.id));
 const clearSelectedStudents = () => setSelectedStudents([]);
 const toggleStudentSelection = (id: string) => setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
 const toggleGroupStudent = (id: string) => setGroupSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
 const toggleStudentCreditSelection = (id: string) => setSelectedStudentsForCredit(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

 const handleSaveGroup = async () => {
 if (!groupName || groupSelected.length === 0) return;
 setLoading(true);
 try {
 await supabase.from("student_groups").insert([{ name: groupName, student_ids: groupSelected }]);
 setGroupName(""); setGroupSelected([]); setShowGroupModal(false);
 await refreshData();
 alert(`✅ Group "${groupName}" created`);
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleDeleteGroup = async (id: string) => {
 if (!confirm("Delete this group?")) return;
 await supabase.from("student_groups").delete().eq("id", id); refreshData();
 };

 const handleUpdateRating = async (studentId: string, rating: number) => {
 await supabase.from("students").update({ rating }).eq("id", studentId); refreshData();
 };

 const handleDeleteStudent = async (id: string) => {
 await deleteStudent(id); refreshData();
 };

 const handleDeleteUser = async () => {
 if (!userToDelete) return;
 setLoading(true);
 try {
 const { data: activeLoans } = await supabase.from("library_logs").select("id").eq("student_id", userToDelete.id).is("return_date", null);
 if (activeLoans && activeLoans.length > 0) {
 alert(`⚠️ ${userToDelete.full_name} has ${activeLoans.length} book(s) not returned.`);
 setLoading(false); return;
 }
 await supabase.from("students").delete().eq("id", userToDelete.id);
 await refreshData();
 setShowDeleteConfirm(false); setUserToDelete(null); setDeleteConfirmText("");
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleDeleteAllStudents = async () => {
 if (deleteStudentsConfirmText !== "DELETE") return;
 setLoading(true);
 try {
 await supabase.from("students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
 refreshData(); setShowDeleteStudentsModal(false); setDeleteStudentsConfirmText("");
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleDeleteAllData = async () => {
 if (purgeConfirmText !== "DELETE") return;
 setLoading(true);
 try {
 const tables = ["students","fund_transactions","school_finances","school_notifications","library_logs","library_reservations","student_groups","books"];
 for (const table of tables) {
 await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
 }
 refreshData(); setShowPurgeModal(false); setPurgeConfirmText("");
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleBulkStudentCredit = async () => {
 if (!bulkCreditAmount || selectedStudentsForCredit.length === 0) return;
 setLoading(true);
 try {
 const amt = parseFloat(bulkCreditAmount);
 await Promise.all(selectedStudentsForCredit.map(async (studentId) => {
 const { data: fresh } = await supabase.from("students").select("balance").eq("id", studentId).single();
 const currentBalance = fresh?.balance ?? 0;
 await supabase.from("students").update({ balance: currentBalance + amt }).eq("id", studentId);
 await supabase.from("fund_transactions").insert([{ student_id: studentId, amount: amt, type: "distribution", description: bulkCreditPurpose || "Bulk Student Credit" }]);
 }));
 setBulkCreditAmount(""); setBulkCreditPurpose(""); setBulkCreditSearch("");
 await refreshData();
 alert(`✅ ₹${amt} credited to ${selectedStudentsForCredit.length} students`);
 } catch (err: any) { alert(err.message); }
 finally { setLoading(false); }
 };

 const handleSendNotification = async (studentId?: string) => {
 if (!notifyMsg) return;
 try {
 await supabase.from("school_notifications").insert([{ message: notifyMsg, font_id: selectedFontId || null, end_at: notifyEnd || null, student_id: studentId || null }]);
 setNotifyMsg(""); setSelectedFontId(""); setNotifyEnd(""); refreshData();
 alert("✅ Notification Broadcasted");
 } catch (err: any) { alert(err.message); }
 };

 const handleDeleteNotify = async (id: string) => {
 await supabase.from("school_notifications").delete().eq("id", id); refreshData();
 };

 const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]; if (!file) return;
 const name = prompt("Enter unique font name:"); if (!name) return;
 const reader = new FileReader();
 reader.onload = async (ev) => {
 const b64 = ev.target?.result;
 if (typeof b64 === "string") {
 try { await supabase.from("school_fonts").insert([{ name, font_data: b64 }]); alert("✅ Font saved"); refreshData(); }
 catch { alert("Error: Use a unique name."); }
 }
 };
 reader.readAsDataURL(file);
 };

 const handleCreateUser = async () => {
 setLoading(true);
 try {
 // Guaranteed-unique username: name prefix + random hex suffix
 const _np = (editingUser?.full_name || "u").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
 const _uid = typeof crypto !== "undefined" ? crypto.randomUUID().replace(/-/g,"").slice(0,8) : (Date.now().toString(36) + Math.random().toString(36).slice(2,5));
 // Only use admin-typed username if it was actually filled in; never inherit from previous student
 const autoUsername = (editingUser?.username && editingUser.username.trim().length > 0) ? editingUser.username.trim() : (_np + _uid);
 const autoRollId = (editingUser?.roll_id && editingUser.roll_id.trim().length > 0) ? editingUser.roll_id.trim() : ("STU-" + Date.now() + _uid);
 const newStudent = {
   full_name: editingUser?.full_name || "",
   roll_id: autoRollId,
   grade: editingUser?.grade || "",
   balance: 0,
   parent_phone: editingUser?.parent_phone ? editingUser.parent_phone.replace(/\D/g, "").slice(-10) : null,
   email_account: editingUser?.email_account || (autoUsername + "@account.com"),
   email_library: editingUser?.email_library || (autoUsername + "@library.com"),
   password: editingUser?.password || "password123",
   username: autoUsername,
   is_responsible: editingUser?.is_responsible || false,
 };
 if (editingUser?.id) await supabase.from("students").update(newStudent).eq("id", editingUser.id);
 else await supabase.from("students").insert([newStudent]);
 setShowUserModal(false); setEditingUser(null); refreshData();
 alert("✅ Student account created successfully");
 } catch (err: any) { alert(`❌ Error: ${err.message}`); }
 finally { setLoading(false); }
 };

 const handleUpdateCredentials = async () => {
 if (!editingCredentials) return;
 setLoading(true);
 try {
 await supabase.from("students").update({ username: tempCredentials.username, password: tempCredentials.password }).eq("id", editingCredentials.id);
 if (editingCredentials.is_responsible) await supabase.from("students").update({ last_password_change: new Date().toISOString() }).eq("id", editingCredentials.id);
 setShowCredentialModal(false); setEditingCredentials(null); refreshData();
 alert("✅ Credentials updated successfully");
 } catch (err: any) { alert(`❌ Error: ${err.message}`); }
 finally { setLoading(false); }
 };

 const handleChangeAdminPassword = async () => {
 if (!adminProfile.currentPassword || (!adminProfile.newPassword && !adminProfile.newUsername)) {
 alert("⚠️ Fill in at least new username or new password"); return;
 }
 if (adminProfile.newPassword && adminProfile.newPassword !== adminProfile.confirmPassword) { alert("❌ Passwords do not match!"); return; }
 if (adminProfile.newPassword && adminProfile.newPassword.length < 4) { alert("⚠️ Password must be at least 4 characters"); return; }
 setLoading(true);
 try {
 const adminData = JSON.parse(localStorage.getItem("admin_session") || "{}");
 // On fresh install localStorage has no password — fall back to the hardcoded default
 const storedPassword = adminData.password || "adminac123";
 if (storedPassword !== adminProfile.currentPassword) {
 alert("❌ Current password is incorrect!");
 setLoading(false);
 return;
 }
 const updated = { ...adminData };
 if (adminProfile.newUsername) updated.username = adminProfile.newUsername;
 if (adminProfile.newPassword) updated.password = adminProfile.newPassword;
 localStorage.setItem("admin_session", JSON.stringify(updated));
 setAdminProfile({ currentPassword: "", newPassword: "", confirmPassword: "", newUsername: "" });
 setShowProfileSettings(false);
 alert("✅ Credentials updated successfully!");
 } catch (err: any) { alert(`❌ Error: ${err.message}`); }
 finally { setLoading(false); }
 };

 const getFinancialYearLabel = (date: Date) => {
 const year = date.getFullYear(); const month = date.getMonth();
 const startYear = month >= 3 ? year : year - 1;
 return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
 };

 const buildTransactionAuditData = (transactions: any[]) => {
 return transactions.map((tx) => {
 const student = students.find((s) => s.id === tx.student_id);
 return {
 Date: new Date(tx.created_at).toLocaleDateString(),
 Student: student?.full_name || "Unknown",
 RollID: student?.roll_id || "N/A",
 Description: tx.description,
 Type: tx.type,
 Amount: formatSignedCurrency(tx.amount),
 };
 });
 };

 const handleDownloadTransactions = () => {
 const data = buildTransactionAuditData(searchedTransactions);
 downloadPDF("Full Transaction Audit", data, `transactions_full_${new Date().toISOString().split("T")[0]}.pdf`);
 };

 const handleDownloadStudents = () => {
 const exportData = students.map(s => ({ Name: s.full_name, RollID: s.roll_id, Balance: `₹${s.balance.toLocaleString()}`, Date: (s as any).created_at ? new Date((s as any).created_at).toLocaleDateString() : "" }));
 downloadPDF("Student Personnel List", exportData, `students_all_${new Date().toISOString().split("T")[0]}.pdf`);
 };

 const handleDownloadStudentLedger = (student: Student) => {
 const txs = fundTransactions.filter(tx => tx.student_id === student.id);
 const exportData = txs.map(tx => ({ Date: new Date(tx.created_at).toLocaleDateString(), Description: tx.description, Type: tx.type, Amount: `₹${tx.amount.toLocaleString()}` }));
 downloadPDF(`Ledger for ${student.full_name}`, exportData, `ledger_${student.full_name}_${new Date().toISOString().split("T")[0]}.pdf`);
 };

 const handleDownloadFinances = (type: "all" | "month" | "year" | "custom") => {
 let data = ledger.filter(item => !item.student_id);
 const now = new Date();
 if (type === "month") data = data.filter(item => { const d = new Date(item.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
 else if (type === "year") data = data.filter(item => new Date(item.created_at).getFullYear() === now.getFullYear());
 else if (type === "custom" && financeStartDate && financeEndDate) {
 const s = new Date(financeStartDate); const e = new Date(financeEndDate); e.setHours(23,59,59,999);
 data = data.filter(item => { const d = new Date(item.created_at); return d >= s && d <= e; });
 }
 const exportData = data.map(item => ({ Date: new Date(item.created_at).toLocaleDateString(), Description: item.description, Party: item.party_name, Type: item.amount > 0 ? "Income" : "Expense", Amount: formatSignedCurrency(item.amount) }));
 downloadPDF("Global Finance Records", exportData, `finances_${type}_${new Date().toISOString().split("T")[0]}.pdf`);
 };

 const handleBulkStudentImport = async () => {
 if (!bulkStudentJson.trim()) { alert("Please provide JSON data."); return; }
 setLoading(true); setBulkImportResults({success: 0, failed: 0, errors: [], skipped: 0});
 try {
 const studentsData = JSON.parse(bulkStudentJson);
 if (!Array.isArray(studentsData)) throw new Error("JSON must be an array");
 let successCount = 0, failedCount = 0; const errors: string[] = [];
 for (let i = 0; i < studentsData.length; i++) {
 const sd = studentsData[i];
 try {
 if (!sd.full_name || !sd.roll_id) throw new Error(`Student ${i+1}: full_name and roll_id required`);
 const { data: existing } = await supabase.from("students").select("id").eq("roll_id", sd.roll_id).single();
 const payload = { full_name: sd.full_name, grade: sd.grade || null, parent_phone: sd.parent_phone || null, username: (sd.username && sd.username.trim()) ? sd.username.trim() : ((sd.full_name||"u").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8) + (typeof crypto!=="undefined"?crypto.randomUUID().replace(/-/g,"").slice(0,8):(Date.now().toString(36)+Math.random().toString(36).slice(2,5)))), password: sd.password || "default123", email_account: sd.email_account || `${sd.username || sd.roll_id}@account.com`, email_library: sd.email_library || `${sd.username || sd.roll_id}@library.com`, balance: sd.balance || 0, is_responsible: sd.is_responsible || false };
 if (existing) { const { error } = await supabase.from("students").update(payload).eq("roll_id", sd.roll_id); if (error) throw error; }
 else { const { error } = await supabase.from("students").insert([{ ...payload, roll_id: sd.roll_id }]); if (error) throw error; }
 successCount++;
 } catch (err: any) { failedCount++; errors.push(`Student ${i+1} (${sd.full_name || "Unknown"}): ${err.message}`); }
 }
 setBulkImportResults({ success: successCount, failed: failedCount, errors, skipped: 0 });
 if (successCount > 0) { const updated = await fetchStudents(); setStudents(updated); }
 alert(`Import complete! ✅ ${successCount} success${failedCount > 0 ? ` ❌ ${failedCount} failed` : ""}`);
 if (failedCount === 0) { setBulkStudentJson(""); setShowBulkImport(false); }
 } catch (err: any) { alert(`Invalid JSON: ${err.message}`); }
 finally { setLoading(false); }
 };

 const handleOpenCredentialEdit = (student: Student) => {
 setEditingCredentials(student);
 setTempCredentials({ username: student.username || "", password: student.password || "" });
 setShowCredentialModal(true);
 };

 const addTestTransactions = async () => {
 if (students.length === 0) { alert("No students found."); return; }
 setLoading(true);
 try {
 for (const student of students.slice(0, 3)) {
 await supabase.from("fund_transactions").insert([{ student_id: student.id, amount: 500, type: "deposit", description: "Test deposit" }]);
 await supabase.from("fund_transactions").insert([{ student_id: student.id, amount: -200, type: "withdrawal", description: "Test withdrawal" }]);
 await supabase.from("students").update({ balance: (student.balance || 0) + 300 }).eq("id", student.id);
 }
 await refreshData(); alert("✅ Test transactions added!");
 } catch (err: any) { alert("Error: " + err.message); }
 finally { setLoading(false); }
 };


 // ─── FUNDS DESK TAB ───────────────────────────────────────────────────────
 const renderFundsTab = () => {
 const totalBalance = students.reduce((a, s) => a + (s.balance || 0), 0);
 const avgBalance = students.length > 0 ? totalBalance / students.length : 0;
 return (
 <div className="flex flex-col gap-5 pb-24">
 {/* Stats always first */}
 <div className="order-1">{/* stat cards wrapper */}
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] ">
 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Balance</p>
 <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate">₹{totalBalance.toLocaleString()}</p>
 <p className="text-[10px] text-slate-400 mt-0.5">{students.length} students</p>
 </div>
 <div className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] ">
 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Avg Balance</p>
 <p className="text-xl sm:text-2xl font-bold text-[#5A45FF] truncate">₹{avgBalance.toFixed(0)}</p>
 <p className="text-[10px] text-slate-400 mt-0.5">per student</p>
 </div>
 <div className="bg-white rounded-2xl p-4 shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] ">
 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Groups</p>
 <p className="text-xl sm:text-2xl font-bold text-slate-900 ">{groups.length}</p>
 <p className="text-[10px] text-slate-400 mt-0.5">configured</p>
 </div>
 </div>
 </div>

 {/* ── SECTION 1: SINGLE ENTRY AUDIT — mobile order 3, desktop order 2 ── */}
 <div className="order-3 sm:order-2 bg-white rounded-2xl shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="flex items-center gap-3 p-4 border-b border-[#E8E5FF]">
 <div className="w-8 h-8 rounded-xl bg-[#E8E5FF] flex items-center justify-center flex-shrink-0">
 <FileText className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-sm">Single Entry Audit</h3>
 <p className="text-[10px] text-slate-400">Adjust one student at a time</p>
 </div>
 </div>
 <div className="p-4">
 {singleSelected ? (
 <div className="space-y-3">
 {/* Selected student card */}
 <div className="flex items-center gap-3 bg-[#F0F2F9] rounded-xl p-3 border border-[#E8E5FF] relative">
 <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(singleSelected.full_name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
 {getInitials(singleSelected.full_name)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-900 text-sm truncate">{singleSelected.full_name}</p>
 <p className="text-xs text-slate-500">#{singleSelected.roll_id}</p>
 </div>
 <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${singleSelected.balance >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#FF7675]"}`}>
 {singleSelected.balance >= 0 ? "+" : ""}₹{singleSelected.balance.toLocaleString()}
 </span>
 <button onClick={() => { setSingleSelected(null); setSingleSearch(""); }} className="p-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
 <X className="w-4 h-4" />
 </button>
 </div>
 {/* Action row */}
 <div className="flex gap-2">
 <div className="flex bg-[#E8E5FF] rounded-xl p-0.5 gap-0.5 flex-shrink-0">
 <button onClick={() => setSingleType("add")} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${singleType === "add" ? "bg-[#00E676] text-slate-900 shadow-sm" : "text-slate-500"}`}>+Add</button>
 <button onClick={() => setSingleType("sub")} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${singleType === "sub" ? "bg-[#FF7675] text-white shadow-sm" : "text-slate-500"}`}>−Sub</button>
 </div>
 <div className="relative flex-1">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
 <input type="number" value={singleAmount} onChange={e => setSingleAmount(e.target.value)} className="w-full pl-7 pr-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Amount" />
 </div>
 </div>
 <input value={singlePurpose} onChange={e => setSinglePurpose(e.target.value)} className="w-full px-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Reason (optional)" />
 <button onClick={handleSingleEntry} disabled={loading || !singleAmount} className="w-full py-2.5 bg-[#5A45FF] text-white rounded-xl text-sm font-bold hover:bg-[#4834DF] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
 Commit Transaction
 </button>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input value={singleSearch} onChange={e => setSingleSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Search student name or roll ID..." />
 </div>
 <div className="space-y-1.5 max-h-48 overflow-y-auto">
 {students
 .filter(s => !singleSearch || s.full_name.toLowerCase().includes(singleSearch.toLowerCase()) || s.roll_id.toLowerCase().includes(singleSearch.toLowerCase()))
 .slice(0, 6)
 .map(s => (
 <button key={s.id} onClick={() => setSingleSelected(s)} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-[#F0F2F9] border border-transparent hover:border-[#5A45FF]/30 hover:bg-[#E8E5FF] transition-all">
 <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(s.full_name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{getInitials(s.full_name)}</div>
 <div className="flex-1 text-left min-w-0">
 <p className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</p>
 <p className="text-[10px] text-slate-500">#{s.roll_id}</p>
 </div>
 <span className={`text-xs font-bold flex-shrink-0 ${s.balance >= 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>
 {s.balance >= 0 ? "+" : ""}₹{s.balance.toLocaleString()}
 </span>
 </button>
 ))}
 {singleSearch && students.filter(s => s.full_name.toLowerCase().includes(singleSearch.toLowerCase()) || s.roll_id.toLowerCase().includes(singleSearch.toLowerCase())).length === 0 && (
 <p className="text-center py-6 text-sm text-slate-400">No students found</p>
 )}
 {!singleSearch && students.length === 0 && (
 <p className="text-center py-6 text-sm text-slate-400">No students enrolled yet</p>
 )}
 {!singleSearch && students.length > 0 && (
 <p className="text-center py-3 text-xs text-slate-400">Start typing to search {students.length} students</p>
 )}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ── SECTION 2: BULK AUTO SPLIT — mobile order 2, desktop order 3 ── */}
 <div className="order-2 sm:order-3 bg-white rounded-2xl shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="flex items-center gap-3 p-4 border-b border-[#E8E5FF]">
 <div className="w-8 h-8 rounded-xl bg-[#E8E5FF] flex items-center justify-center flex-shrink-0">
 <Calculator className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-sm">Bulk Auto Split</h3>
 <p className="text-[10px] text-slate-400">Split total amount evenly across students</p>
 </div>
 </div>
 <div className="p-4 space-y-4">
 {/* Add / Subtract toggle */}
 <div className="flex bg-[#F0F2F9] rounded-xl p-1 gap-1">
 <button onClick={() => setBulkAction("add")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${bulkAction === "add" ? "bg-[#00E676] text-slate-900 shadow-sm" : "text-slate-500"}`}>
 <Plus className="w-3.5 h-3.5" /> Add
 </button>
 <button onClick={() => setBulkAction("sub")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${bulkAction === "sub" ? "bg-[#FF7675] text-white shadow-sm" : "text-slate-500"}`}>
 <ArrowDownRight className="w-3.5 h-3.5" /> Subtract
 </button>
 </div>

 {/* Target */}
 <div className="grid grid-cols-2 gap-2">
 <button onClick={() => setBulkMode("all")} className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${bulkMode === "all" ? "border-[#5A45FF] bg-[#E8E5FF] text-[#5A45FF]" : "border-[#E8E5FF] text-slate-500"}`}>
 <Users className="w-4 h-4 mx-auto mb-1" />
 All Students
 </button>
 <button onClick={() => setBulkMode("group")} className={`p-3 rounded-xl border-2 text-xs font-bold transition-all ${bulkMode === "group" ? "border-[#5A45FF] bg-[#E8E5FF] text-[#5A45FF]" : "border-[#E8E5FF] text-slate-500"}`}>
 <Layers className="w-4 h-4 mx-auto mb-1" />
 Group Only
 </button>
 </div>

 {bulkMode === "group" && (
 <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="w-full bg-[#F0F2F9] border border-[#E8E5FF] p-2.5 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30">
 <option value="">— Select a group —</option>
 {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.student_ids.length} members)</option>)}
 </select>
 )}

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Total Amount (₹)</label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
 <input type="number" value={bulkAmount} onChange={e => setBulkAmount(e.target.value)} className="w-full pl-7 pr-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="0" />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Reason (optional)</label>
 <input value={bulkPurpose} onChange={e => setBulkPurpose(e.target.value)} className="w-full px-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="e.g. Activity Fee" />
 </div>
 </div>

 {/* Live breakdown */}
 {bulkAmount && splitTargetStudents.length > 0 && (
 <div className="bg-[#E8E5FF] rounded-xl p-3 border border-[#5A45FF]/20 flex items-center justify-between gap-3">
 <div>
 <p className="text-[10px] text-[#5A45FF] font-semibold">Per student</p>
 <p className="text-xl font-bold text-[#5A45FF]">₹{perHead.toFixed(2)}</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] text-slate-500">Across</p>
 <p className="text-sm font-bold text-slate-900">{splitTargetStudents.length} students</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] text-slate-500">Total</p>
 <p className="text-sm font-bold text-slate-900">₹{parseFloat(bulkAmount).toLocaleString()}</p>
 </div>
 </div>
 )}

 {bulkAmount && splitTargetStudents.length === 0 && bulkMode === "group" && (
 <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
 <p className="text-xs text-amber-700 font-medium">⚠️ No group selected or group has 0 members</p>
 </div>
 )}

 <button
 onClick={handleBulkExecute}
 disabled={loading || !bulkAmount || parseFloat(bulkAmount) <= 0 || splitTargetStudents.length === 0 || (bulkMode === "group" && !selectedGroupId)}
 className="w-full py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(90,69,255,0.3)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
 >
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
 Execute Split — ₹{perHead > 0 ? perHead.toFixed(2) : "0"} × {splitTargetStudents.length} students
 </button>
 </div>
 </div>

 {/* ── SECTION 3: ACTIVE PERSONNEL GROUPS — order 4 both ── */}
 <div className="order-4 bg-white rounded-2xl shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="flex items-center justify-between p-4 border-b border-[#E8E5FF]">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
 <Layers className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-sm">Personnel Groups</h3>
 <p className="text-[10px] text-slate-400">{groups.length} group{groups.length !== 1 ? "s" : ""}</p>
 </div>
 </div>
 <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#5A45FF] text-white rounded-xl text-xs font-bold hover:bg-[#4834DF] transition-colors shadow-[0_2px_8px_rgba(90,69,255,0.3)]">
 <Plus className="w-3.5 h-3.5" /> New Group
 </button>
 </div>
 {groups.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-10 text-slate-400">
 <Layers className="w-8 h-8 mb-2 text-slate-200" />
 <p className="text-xs font-medium">No groups yet — create one to target bulk splits</p>
 </div>
 ) : (
 <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
 {groups.map(g => (
 <div key={g.id} className="flex items-center justify-between p-3 bg-[#F0F2F9] rounded-xl border border-[#E8E5FF] group/card hover:border-[#5A45FF]/30 transition-all">
 <div>
 <p className="font-semibold text-slate-900 text-sm">{g.name}</p>
 <p className="text-[10px] text-slate-500">{g.student_ids.length} members</p>
 </div>
 <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 text-slate-300 hover:text-[#FF7675] hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* ── SECTION 4: SELECTIVE BULK ADD — order 5 both ── */}
 <div className="order-5 bg-white rounded-2xl shadow-[0_4px_16px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-[#E8E5FF]">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
 <CheckSquare className="w-4 h-4 text-emerald-600" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-sm">Selective Bulk Add</h3>
 <p className="text-[10px] text-slate-400">Fixed amount added to each selected student</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="px-2.5 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-[10px] font-bold">{selectedStudents.length}/{students.length}</span>
 <button onClick={selectAllStudents} disabled={!selectiveAmount} className="px-2.5 py-1 text-[10px] font-semibold bg-[#F0F2F9] border border-[#E8E5FF] rounded-full hover:bg-[#E8E5FF] transition-colors disabled:opacity-40">All</button>
 <button onClick={clearSelectedStudents} disabled={!selectiveAmount} className="px-2.5 py-1 text-[10px] font-semibold bg-[#F0F2F9] border border-[#E8E5FF] rounded-full hover:bg-[#E8E5FF] transition-colors disabled:opacity-40">Clear</button>
 </div>
 </div>

 <div className="p-4 space-y-4">
 {/* Amount + reason row */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Amount / Student (₹)</label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
 <input type="number" value={selectiveAmount} onChange={e => setSelectiveAmount(e.target.value)} className="w-full pl-7 pr-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="0" />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Reason</label>
 <input value={selectivePurpose} onChange={e => setSelectivePurpose(e.target.value)} className="w-full px-3 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="optional" />
 </div>
 </div>

 {/* Student list */}
 {!selectiveAmount ? (
 <div className="flex flex-col items-center justify-center py-8 bg-[#F0F2F9] rounded-xl border-2 border-dashed border-[#E8E5FF]">
 <DollarSign className="w-8 h-8 text-slate-200 mb-2" />
 <p className="text-xs font-semibold text-slate-400">Enter an amount above to select students</p>
 </div>
 ) : (
 <div className="bg-[#F0F2F9] rounded-xl border border-[#E8E5FF] overflow-hidden">
 <div className="px-3 py-2 border-b border-[#E8E5FF] bg-white">
 <p className="text-[10px] font-semibold text-slate-500">Tap to select / deselect</p>
 </div>
 <div className="max-h-60 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
 {students.map(s => (
 <label key={s.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border-2 ${selectedStudents.includes(s.id) ? "bg-[#E8E5FF] border-[#5A45FF]/40" : "bg-white border-transparent hover:bg-[#F4F0FF]"}`}>
 <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudentSelection(s.id)} className="w-4 h-4 accent-[#5A45FF] rounded flex-shrink-0" />
 <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(s.full_name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>{getInitials(s.full_name)}</div>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-semibold text-slate-900 truncate">{s.full_name}</p>
 <p className="text-[10px] text-slate-400">
 #{s.roll_id} · <span className={s.balance >= 0 ? "text-emerald-600" : "text-[#FF7675]"}>{s.balance >= 0 ? "+" : ""}₹{s.balance.toLocaleString()}</span>
 </p>
 </div>
 </label>
 ))}
 </div>
 </div>
 )}

 {/* Summary bar */}
 {selectedStudents.length > 0 && selectiveAmount && (
 <div className="flex items-center justify-between gap-3 bg-[#E8E5FF] rounded-xl p-3 border border-[#5A45FF]/20">
 <div>
 <p className="text-[10px] text-slate-500">Total disbursement</p>
 <p className="text-lg font-bold text-[#5A45FF]">₹{(parseFloat(selectiveAmount) * selectedStudents.length).toLocaleString()}</p>
 <p className="text-[10px] text-slate-500">₹{selectiveAmount} × {selectedStudents.length} students</p>
 </div>
 <button onClick={handleSelectiveBulkAdd} disabled={loading} className="px-4 py-2.5 bg-[#5A45FF] text-white rounded-xl text-sm font-bold hover:bg-[#4834DF] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
 Add to Selected
 </button>
 </div>
 )}

 {selectedStudents.length === 0 && selectiveAmount && (
 <p className="text-center text-xs text-slate-400 py-2">Select at least one student above</p>
 )}
 </div>
 </div>

 </div>
 );
 };
 // ─── GLOBAL VAULT TAB ─────────────────────────────────────────────────────
 const renderFinancesTab = () => (
 <div className="space-y-6 pb-20">
 {/* ── Page Header ── */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] flex items-center justify-center shadow-[0_4px_14px_rgba(90,69,255,0.35)]">
 <DollarSign className="w-6 h-6 text-white" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-slate-900">Global Vault</h2>
 <p className="text-sm text-slate-500 mt-0.5">Financial ledger overview & management</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Protocol Active
 </span>
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-semibold">
 <Zap className="w-3 h-3" />System Synced
 </span>
 </div>
 </div>
 </div>

 {/* ── Financial Overview Metrics ── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {/* Direct Income */}
 <div className="bg-white rounded-2xl p-5 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex items-center justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
 <ArrowUpRight className="w-4 h-4 text-emerald-600" />
 </div>
 <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">INCOME</span>
 </div>
 <p className="text-xs text-slate-500 font-medium">Direct Income</p>
 <p className="text-xl font-bold text-emerald-600 mt-1">₹{financeStats.totalIncome.toLocaleString()}</p>
 </div>

 {/* Direct Expense */}
 <div className="bg-white rounded-2xl p-5 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex items-center justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
 <ArrowDownRight className="w-4 h-4 text-[#FF7675]" />
 </div>
 <span className="text-[10px] font-semibold text-[#FF7675] bg-red-50 px-2 py-0.5 rounded-full">EXPENSE</span>
 </div>
 <p className="text-xs text-slate-500 font-medium">Direct Expense</p>
 <p className="text-xl font-bold text-[#FF7675] mt-1">₹{financeStats.totalExpense.toLocaleString()}</p>
 </div>

 {/* Net Vault – Hero card */}
 <div className="bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] rounded-2xl p-5 shadow-[0_10px_25px_rgba(90,69,255,0.3)] col-span-2 lg:col-span-1">
 <div className="flex items-center justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
 <BarChart3 className="w-4 h-4 text-white" />
 </div>
 <span className="text-[10px] font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">NET VAULT</span>
 </div>
 <p className="text-xs text-white/70 font-medium">Net Vault</p>
 <p className="text-2xl font-bold text-white mt-1">{financeStats.net >= 0 ? "+" : "-"}₹{Math.abs(financeStats.net).toLocaleString()}</p>
 <p className="text-xs text-white/60 mt-1">{financeStats.net >= 0 ? "Surplus" : "Deficit"}</p>
 </div>

 {/* Student Liability */}
 <div className="bg-white rounded-2xl p-5 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex items-center justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
 <Users className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <span className="text-[10px] font-semibold text-[#5A45FF] bg-[#E8E5FF] px-2 py-0.5 rounded-full">LIABILITY</span>
 </div>
 <p className="text-xs text-slate-500 font-medium">Student Liability</p>
 <p className="text-xl font-bold text-slate-900 mt-1">{financeStats.studentFundTotal >= 0 ? "+" : "-"}₹{Math.abs(financeStats.studentFundTotal).toLocaleString()}</p>
 </div>
 </div>

 {/* ── Export & Date Filter Toolbar ── */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex items-center gap-3 mb-5">
 <div className="w-9 h-9 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
 <Download className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900">Export & Date Filter</h3>
 <p className="text-xs text-slate-500">Download filtered financial records</p>
 </div>
 </div>

 {/* Quick Filter Pills */}
 <div className="flex flex-wrap gap-2 mb-5">
 <button onClick={() => handleDownloadFinances("month")} className="flex items-center gap-2 px-4 py-2 bg-[#F0F2F9] hover:bg-[#E8E5FF] border border-[#E8E5FF] hover:border-[#5A45FF]/30 rounded-full text-sm font-semibold text-slate-700 transition-all">
 <Calendar className="w-3.5 h-3.5 text-[#5A45FF]" /> This Month
 </button>
 <button onClick={() => handleDownloadFinances("year")} className="flex items-center gap-2 px-4 py-2 bg-[#F0F2F9] hover:bg-[#E8E5FF] border border-[#E8E5FF] hover:border-[#5A45FF]/30 rounded-full text-sm font-semibold text-slate-700 transition-all">
 <Calendar className="w-3.5 h-3.5 text-[#5A45FF]" /> This Year
 </button>
 <button onClick={() => handleDownloadFinances("all")} className="flex items-center gap-2 px-4 py-2 bg-[#5A45FF] hover:bg-[#4834DF] rounded-full text-sm font-semibold text-white shadow-[0_4px_12px_rgba(90,69,255,0.3)] transition-all">
 <Database className="w-3.5 h-3.5" /> Total History
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 border-t border-[#E8E5FF]">
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Start Date</label>
 <input type="date" value={financeStartDate} onChange={(e) => setFinanceStartDate(e.target.value)} className="w-full bg-[#F0F2F9] border border-[#E8E5FF] p-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" />
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">End Date</label>
 <input type="date" value={financeEndDate} onChange={(e) => setFinanceEndDate(e.target.value)} className="w-full bg-[#F0F2F9] border border-[#E8E5FF] p-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" />
 </div>
 <div className="flex items-end">
 <button onClick={() => handleDownloadFinances("custom")} disabled={!financeStartDate || !financeEndDate} className="w-full py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(90,69,255,0.3)]">
 <Download className="w-4 h-4" /> Download Custom Range
 </button>
 </div>
 </div>

 {/* PDF Export CTA */}
 <div className="mt-4 flex items-center justify-between p-4 bg-[#F0F2F9] rounded-xl border border-[#E8E5FF]">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
 <FileText className="w-5 h-5 text-red-500" />
 </div>
 <div>
 <p className="font-semibold text-slate-900 text-sm">Download Financial Records</p>
 <p className="text-xs text-slate-500">Export ledger data to PDF format</p>
 </div>
 </div>
 <button onClick={() => handleDownloadFinances("all")} className="px-4 py-2 bg-white border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-700 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all whitespace-nowrap">
 Export PDF
 </button>
 </div>
 </div>

 {/* ── Vault Management + System Ledger ── */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Entry Form */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] lg:sticky lg:top-4 self-start">
 <div className="flex items-center gap-3 mb-5">
 <div className="w-9 h-9 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
 <Banknote className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900">Vault Management</h3>
 <p className="text-xs text-slate-500">Commit new ledger entries</p>
 </div>
 </div>
 <div className="space-y-4">
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Entry Description</label>
 <input value={ledgerPurpose} onChange={(e) => setLedgerPurpose(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="e.g. Monthly Electricity" />
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Party Name / Shop / Rep</label>
 <input value={ledgerParty} onChange={(e) => setLedgerParty(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="e.g. KSEB" />
 </div>

 {/* Type Toggle */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Type</label>
 <div className="flex bg-[#F0F2F9] rounded-xl p-1 gap-1">
 <button onClick={() => setLedgerType("Income")} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${ledgerType === "Income" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-emerald-600"}`}>
 <Plus className="w-3.5 h-3.5" /> Income (+)
 </button>
 <button onClick={() => setLedgerType("Expense")} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${ledgerType === "Expense" ? "bg-[#FF7675] text-white shadow-sm" : "text-slate-500 hover:text-[#FF7675]"}`}>
 <ArrowDownRight className="w-3.5 h-3.5" /> Expense (-)
 </button>
 </div>
 </div>

 {/* Amount */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Amount (₹)</label>
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
 <input type="number" value={ledgerValue} onChange={(e) => setLedgerValue(e.target.value)} className="w-full pl-8 pr-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="0.00" />
 </div>
 </div>

 <div>
  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Transaction Date</label>
  <input
   type="date"
   value={ledgerDate}
   onChange={(e) => setLedgerDate(e.target.value)}
   className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30"
  />
  <p className="text-[10px] text-slate-400 mt-1 ml-1">Defaults to today — change for backdated entries</p>
 </div>

 <button onClick={handlePostLedger} disabled={loading || !ledgerPurpose || !ledgerValue} className="w-full py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(90,69,255,0.35)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
 🚀 Commit to Ledger
 </button>
 </div>
 </div>

 {/* System Ledger Audit Table */}
 <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] flex flex-col overflow-hidden">
 <div className="p-5 border-b border-[#E8E5FF] flex items-center justify-between">
 <div>
 <h3 className="font-bold text-slate-900">System Ledger Audit</h3>
 <p className="text-xs text-slate-500">{ledger.length} entries recorded</p>
 </div>
 <button onClick={() => handleDownloadFinances("all")} className="flex items-center gap-2 px-4 py-2 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all">
 <FileText className="w-3.5 h-3.5" /> Audit PDF
 </button>
 </div>

 {/* Table Header */}
 <div className="grid grid-cols-[1fr_80px_90px_90px] px-5 py-3 bg-[#F0F2F9] border-b border-[#E8E5FF] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
 <span>Description</span>
 <span>Type</span>
 <span>Party</span>
 <span className="text-right">Amount</span>
 </div>

 <div className="flex-1 overflow-y-auto" style={{maxHeight: "560px"}}>
 {ledger.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-slate-400">
 <Database className="w-10 h-10 mb-3 text-slate-200" />
 <p className="text-sm font-medium">No ledger entries yet</p>
 </div>
 ) : ledger.map((log, i) => (
 <div key={i} className={`grid grid-cols-[1fr_80px_90px_90px] px-5 py-3.5 border-b border-[#E8E5FF] hover:bg-[#F4F0FF] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#F0F2F9]/40"}`}>
 <div className="min-w-0 pr-3">
 <p className="text-sm font-semibold text-slate-900 truncate">{log.description}</p>
 <p className="text-xs text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleDateString()}</p>
 </div>
 <div className="flex items-center">
 <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${log.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#FF7675]"}`}>
 {log.amount > 0 ? "Income" : "Expense"}
 </span>
 </div>
 <div className="flex items-center min-w-0">
 <p className="text-xs text-slate-500 truncate">{log.party_name || "—"}</p>
 </div>
 <div className="flex items-center justify-end">
 <p className={`text-sm font-bold ${log.amount > 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>
 {log.amount > 0 ? "+" : ""}₹{Math.abs(log.amount).toLocaleString()}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 );

 // ─── PERSONNEL TAB ────────────────────────────────────────────────────────
 const renderStudentsTab = () => (
 <div className="space-y-6 pb-20">
 {/* ── Page Header ── */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-3 flex-wrap">
 <h2 className="text-2xl font-bold text-slate-900">Personnel Desk</h2>
 <span className="px-3 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-bold">{students.length} of {students.length} Members</span>
 </div>
 <p className="text-sm text-slate-500 mt-1">Manage enrolled students and personnel</p>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Protocol Active
 </span>
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-semibold">
 <Zap className="w-3 h-3" />System Synced
 </span>
 </div>
 </div>

 {/* Action Toolbar */}
 <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-5 border-t border-[#E8E5FF]">
 <button onClick={handleDownloadStudents} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-700 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all">
 <Download className="w-4 h-4" /> Download All Personnel (PDF)
 </button>
 <button onClick={() => { setEditingUser(null); setShowUserModal(true); }} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(90,69,255,0.3)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all">
 <UserPlus className="w-4 h-4" /> Enroll New Personnel
 </button>
 </div>
 </div>

 {/* ── Bulk Import Box ── */}
 <div className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="p-5 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
 <Upload className="w-4 h-4 text-[#5A45FF]" />
 </div>
 <div>
 <h3 className="font-bold text-slate-900 text-sm">Bulk Student Import</h3>
 <p className="text-xs text-slate-500">Import multiple students using JSON data</p>
 </div>
 </div>
 <button onClick={() => setShowBulkImport(!showBulkImport)} className="flex items-center gap-2 px-4 py-2 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-700 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all">
 {showBulkImport ? <X className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 {showBulkImport ? "Hide" : "Show"} Import Drawer
 </button>
 </div>

 <AnimatePresence>
 {showBulkImport && (
 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#E8E5FF]">
 <div className="p-5 space-y-4 bg-[#F0F2F9]">
 <textarea value={bulkStudentJson} onChange={(e) => setBulkStudentJson(e.target.value)} className="w-full bg-white border border-[#E8E5FF] rounded-xl p-4 font-mono text-sm text-slate-900 min-h-[220px] outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder={`[\n {\n "full_name": "Ahmed Sinan",\n "roll_id": "2024001",\n "grade": "Class-A",\n "parent_phone": "9876543210",\n "username": "ahmedsinan",\n "password": "secure123",\n "balance": 0\n },\n {\n "full_name": "Fatima Noor",\n "roll_id": "2024002",\n "grade": "Class-B",\n "parent_phone": "9123456789",\n "username": "fatimanoor",\n "password": "secure456",\n "balance": 0\n }\n]\n\n// Required: full_name, roll_id\n// Optional: grade, parent_phone (10-digit, for phone login),\n// username, password, balance, is_responsible`} />
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="text-xs text-slate-500 space-y-0.5">
 <p><span className="font-bold text-slate-700 ">Required:</span> full_name, roll_id</p>
 <p><span className="font-bold text-slate-700 ">Optional:</span> grade, parent_phone, username, password, balance, is_responsible</p>
 <p className="text-amber-600">⚠️ Existing roll_id will be updated</p>
 <p className="text-blue-500">📱 parent_phone = 10-digit number for phone login</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => { try { JSON.parse(bulkStudentJson); alert("✅ Valid JSON!"); } catch(e: any) { alert("❌ Invalid JSON: " + e.message); } }} disabled={!bulkStudentJson.trim()} className="px-4 py-2 bg-white border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-700 hover:bg-[#E8E5FF] transition-all disabled:opacity-40">Validate JSON</button>
 <button onClick={handleBulkStudentImport} disabled={loading || !bulkStudentJson.trim()} className="flex items-center gap-2 px-4 py-2 bg-[#5A45FF] text-white rounded-xl text-sm font-semibold hover:bg-[#4834DF] transition-all disabled:opacity-50">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 Upload & Sync
 </button>
 </div>
 </div>
 {(bulkImportResults.success > 0 || bulkImportResults.failed > 0) && (
 <div className="bg-white border border-[#E8E5FF] rounded-xl p-4">
 <div className="flex gap-4 mb-2">
 <span className="text-sm font-bold text-emerald-600">✅ {bulkImportResults.success} imported</span>
 {bulkImportResults.failed > 0 && <span className="text-sm font-bold text-[#FF7675]">❌ {bulkImportResults.failed} failed</span>}
 </div>
 {bulkImportResults.errors.map((err, i) => <p key={i} className="text-xs text-[#FF7675] font-mono">{err}</p>)}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* ── Search & Filter Bar ── */}
 <div className="bg-white rounded-2xl p-4 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search by name, roll ID, grade... (Ctrl+K)" className="w-full pl-11 pr-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" />
 {studentSearch && <button onClick={() => setStudentSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
 </div>
 <div className="flex bg-[#F0F2F9] rounded-xl p-1 gap-1 flex-shrink-0 border border-[#E8E5FF]">
 {([["all","All Members"],["positive","Positive"],["negative","Liability"]] as const).map(([val, label]) => (
 <button key={val} onClick={() => setStudentBalanceFilter(val)} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${studentBalanceFilter === val ? "bg-[#5A45FF] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>
 ))}
 </div>
 </div>
 </div>

 {/* ── Personnel Cards Grid ── */}
 {filteredStudents.length === 0 ? (
 <div className="text-center py-16 bg-white rounded-2xl border border-[#E8E5FF]">
 <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
 <p className="text-sm font-medium text-slate-400">No students found</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {filteredStudents.map((s) => (
 <motion.div key={s.id} whileHover={{ y: -4 }} onClick={() => { setViewingStudent(s); setActiveTab("transactions"); }} className="bg-white rounded-2xl p-5 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border-2 border-[#E8E5FF] hover:border-[#5A45FF]/40 hover:shadow-[0_10px_30px_rgba(90,69,255,0.15)] transition-all cursor-pointer group relative overflow-hidden">
 {/* Decorative bg blob */}
 <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-[#5A45FF]/5 -mr-6 -mt-6 pointer-events-none" />

 {/* Header: Avatar + ID */}
 <div className="flex items-start justify-between mb-4">
 <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(s.full_name)} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
 {getInitials(s.full_name)}
 </div>
 <span className="px-2.5 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-[10px] font-bold">#ID: {s.roll_id}</span>
 </div>

 {/* Name */}
 <h4 className="font-bold text-slate-900 text-base mb-1 leading-tight capitalize">{s.full_name}</h4>
 {s.grade && <p className="text-xs text-slate-400 mb-3">{s.grade}</p>}

 {/* Balance */}
 <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold mb-4 ${s.balance >= 0 ? "bg-[#00E676]/10 text-emerald-700 border border-emerald-200" : "bg-[#FF7675]/10 text-[#FF7675] border border-[#FF7675]/30"}`}>
 ₹{s.balance.toLocaleString()}
 </div>

 {/* Footer hint */}
 <p className="text-[10px] text-slate-400 group-hover:text-[#5A45FF] transition-colors flex items-center gap-1">
 Click to view lifetime transactions <ChevronRight className="w-3 h-3" />
 </p>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 );

 // ─── TRANSACTIONS / HISTORY TAB ───────────────────────────────────────────
 const renderTransactionsTab = () => {
 const totalCredits = searchedTransactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
 const totalDebits = searchedTransactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
 const netFlow = totalCredits - totalDebits;
 const studentsWithActivity = students.filter(s => searchedTransactions.some(tx => tx.student_id === s.id)).length;
 const sorted = [...searchedTransactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 const recentTx = sorted.slice(0, 10);
 const mostActive = students
 .map(s => ({
 student: s,
 count: sorted.filter(tx => tx.student_id === s.id).length,
 // Use actual stored balance, not transaction sum (which diverges from DB balance)
 balance: s.balance || 0,
 }))
 .filter(e => e.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

 return (
 <div className="space-y-6 pb-20">
 {/* ── Page Header ── */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold text-slate-900">Transactions / History</h2>
 <p className="text-sm text-slate-500 mt-1">
 {viewingStudent ? `Viewing ledger for ${viewingStudent.full_name}` : "Centralized transaction intelligence across all students"}
 </p>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Protocol Active
 </span>
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-semibold">
 <Zap className="w-3 h-3" />System Synced
 </span>
 </div>
 </div>

 {/* Search + PDF */}
 <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-5 border-t border-[#E8E5FF]">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input value={transactionSearch} onChange={e => setTransactionSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Search student, roll ID, description, type..." />
 {transactionSearch && <button onClick={() => setTransactionSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
 </div>
 <div className="flex gap-2">
 <button onClick={handleDownloadTransactions} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgba(90,69,255,0.3)] hover:opacity-90 transition-all whitespace-nowrap">
 <Download className="w-4 h-4" /> Download PDF Report
 </button>
 {viewingStudent && (
 <button onClick={() => setViewingStudent(null)} className="px-4 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl text-sm font-semibold hover:bg-[#E8E5FF] transition-all whitespace-nowrap">
 Show All
 </button>
 )}
 {!viewingStudent && fundTransactions.length === 0 && (
 <button onClick={addTestTransactions} disabled={loading} className="px-4 py-2.5 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl text-sm font-semibold hover:bg-[#E8E5FF] transition-all disabled:opacity-50 whitespace-nowrap">
 Add Test Data
 </button>
 )}
 </div>
 </div>
 </div>

 {/* ── Telemetry Metric Banner ── */}
 <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
 <div className="bg-white rounded-xl p-4 border border-[#E8E5FF] shadow-[0_4px_12px_rgba(90,69,255,0.06)]">
 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Entries</p>
 <p className="text-xl font-bold text-slate-900 mt-1">{searchedTransactions.length}</p>
 </div>
 <div className="bg-white rounded-xl p-4 border border-[#E8E5FF] shadow-[0_4px_12px_rgba(90,69,255,0.06)]">
 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Active Students</p>
 <p className="text-xl font-bold text-slate-900 mt-1">{studentsWithActivity}/{students.length}</p>
 </div>
 <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-[0_4px_12px_rgba(0,230,118,0.08)]">
 <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Total Credits</p>
 <p className="text-xl font-bold text-emerald-600 mt-1">₹{totalCredits.toLocaleString()}</p>
 </div>
 <div className="bg-white rounded-xl p-4 border border-red-100 shadow-[0_4px_12px_rgba(255,118,117,0.08)]">
 <p className="text-[10px] font-semibold text-[#FF7675] uppercase tracking-wide">Total Debits</p>
 <p className="text-xl font-bold text-[#FF7675] mt-1">₹{totalDebits.toLocaleString()}</p>
 </div>
 <div className={`bg-white rounded-xl p-4 border shadow-sm ${netFlow >= 0 ? "border-emerald-100" : "border-red-100"}`}>
 <p className={`text-[10px] font-semibold uppercase tracking-wide ${netFlow >= 0 ? "text-emerald-500" : "text-[#FF7675]"}`}>Net Flow</p>
 <p className={`text-xl font-bold mt-1 ${netFlow >= 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>{netFlow >= 0 ? "+" : ""}₹{Math.abs(netFlow).toLocaleString()}</p>
 </div>
 <div className="bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] rounded-xl p-4 shadow-[0_4px_12px_rgba(90,69,255,0.3)]">
 <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Coverage</p>
 <p className="text-xl font-bold text-white mt-1">{studentsWithActivity}/{students.length}</p>
 </div>
 </div>

 {/* ── Two-Column Dashboard ── */}
 <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
 {/* Recent Global Activity – 60% */}
 <div className="xl:col-span-3 bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="p-5 border-b border-[#E8E5FF] flex items-center justify-between">
 <div>
 <h3 className="font-bold text-slate-900">Recent Global Activity</h3>
 <p className="text-xs text-slate-500 mt-0.5">Live Audit Stream</p>
 </div>
 <span className="px-3 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-semibold">Latest 10 entries</span>
 </div>
 <div className="divide-y divide-[#E8E5FF]">
 {recentTx.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-slate-400">
 <Activity className="w-8 h-8 mb-2 text-slate-200" />
 <p className="text-sm">{transactionSearch ? "No results match your search" : "No transactions recorded yet"}</p>
 </div>
 ) : recentTx.map((tx, i) => {
 const student = students.find(s => s.id === tx.student_id);
 return (
 <div key={tx.id || i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F4F0FF] transition-colors">
 {/* Avatar */}
 <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(student?.full_name || "?")} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
 {getInitials(student?.full_name || "?")}
 </div>
 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="px-2 py-0.5 bg-[#E8E5FF] text-[#5A45FF] rounded-md text-[10px] font-bold">{tx.description || "Transaction"}</span>
 </div>
 <p className="text-xs text-slate-500 mt-0.5 truncate">
 {student?.full_name || "Unknown"} •
 <span className="font-semibold text-slate-600"> ID: {student?.roll_id || "N/A"}</span> •
 {new Date(tx.created_at).toLocaleDateString()}
 </p>
 </div>
 {/* Type badge */}
 <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${tx.type === "deposit" || tx.type === "distribution" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#FF7675]"}`}>
 {tx.type}
 </span>
 {/* Amount */}
 <p className={`text-sm font-bold flex-shrink-0 ${tx.amount > 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>
 {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString()}
 </p>
 </div>
 );
 })}
 </div>
 </div>

 {/* Most Active Students – 40% */}
 <div className="xl:col-span-2 bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="p-5 border-b border-[#E8E5FF]">
 <h3 className="font-bold text-slate-900">Most Active Students</h3>
 <p className="text-xs text-slate-500 mt-0.5">Top transacting members</p>
 </div>
 <div className="divide-y divide-[#E8E5FF]">
 {mostActive.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-slate-400">
 <Users className="w-8 h-8 mb-2 text-slate-200" />
 <p className="text-sm">No activity yet</p>
 </div>
 ) : mostActive.map(({ student, count, balance }, i) => (
 <div key={student.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F4F0FF] transition-colors">
 <span className="text-xs font-bold text-slate-300 w-4 flex-shrink-0">#{i + 1}</span>
 <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(student.full_name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
 {getInitials(student.full_name)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-slate-900 truncate">{student.full_name}</p>
 <p className="text-xs text-slate-500">ID: {student.roll_id} • <span className="font-semibold text-[#5A45FF]">{count} txn</span></p>
 </div>
 <p className={`text-sm font-bold flex-shrink-0 ${balance >= 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>
 {balance >= 0 ? "+" : ""}₹{Math.abs(balance).toLocaleString()}
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* ── Personal Ledger & Logs ── */}
 <div className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="p-5 border-b border-[#E8E5FF]">
 <h3 className="font-bold text-slate-900">Personal Ledger & Logs</h3>
 <p className="text-xs text-slate-500 mt-0.5">Complete transaction history for all students</p>
 </div>

 {students.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-slate-400">
 <Users className="w-10 h-10 mb-3 text-slate-200" />
 <p className="text-sm font-medium">No students enrolled yet</p>
 </div>
 ) : (
 <div className="divide-y divide-[#E8E5FF]">
 {students.map(student => {
 const stx = sorted.filter(tx => tx.student_id === student.id);
 const income = stx.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
 const expense = stx.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
 const net = income - expense;
 return (
 <StudentLedgerRow
 key={student.id}
 student={student}
 transactions={stx}
 income={income}
 expense={expense}
 net={net}
 getAvatarGradient={getAvatarGradient}
 getInitials={getInitials}
 handleDownloadStudentLedger={handleDownloadStudentLedger}
 />
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
 };

 // ─── NOTIFICATIONS TAB ────────────────────────────────────────────────────
 const renderNotificationsTab = () => (
 <div className="space-y-6 pb-20">
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 rounded-xl bg-[#E8E5FF] flex items-center justify-center"><Mail className="w-5 h-5 text-[#5A45FF]" /></div>
 <div><h2 className="text-xl font-bold text-slate-900">Authority Messaging Center</h2><p className="text-xs text-slate-500">Broadcast messages to all students</p></div>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="space-y-4">
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Message</label>
 <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} className="w-full bg-[#F0F2F9] border border-[#E8E5FF] p-4 rounded-xl min-h-[160px] text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 resize-none" placeholder="Enter broadcast text..." />
 </div>
 <div className="flex gap-3">
 <div className="flex-1 flex items-center gap-2 p-3 border-2 border-dashed border-[#E8E5FF] rounded-xl cursor-pointer hover:bg-[#F0F2F9] transition-colors relative">
 <input type="file" onChange={handleFontUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
 <Upload className="w-4 h-4 text-slate-400" />
 <span className="text-xs text-slate-500">Upload Font</span>
 </div>
 <button onClick={() => handleSendNotification()} disabled={!notifyMsg} className="flex-1 py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
 <Zap className="w-4 h-4" /> Broadcast
 </button>
 </div>
 </div>
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-xs font-semibold text-slate-600">Active Transmissions ({notifications.length})</p>
 </div>
 <div className="space-y-2 max-h-72 overflow-y-auto">
 {notifications.length === 0 && <div className="text-center py-8 text-sm text-slate-400">No active notifications</div>}
 {notifications.map(n => (
 <div key={n.id} className="flex items-start justify-between gap-3 p-4 bg-[#F0F2F9] rounded-xl border border-[#E8E5FF] group">
 <div className="flex-1 min-w-0">
 <p className="text-sm text-slate-800 leading-snug break-words">{n.message}</p>
 <div className="flex items-center gap-2 mt-2">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.student_id ? "bg-amber-50 text-amber-600" : "bg-[#E8E5FF] text-[#5A45FF]"}`}>{n.student_id ? "Direct" : "Global"}</span>
 <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</span>
 </div>
 </div>
 <button onClick={() => handleDeleteNotify(n.id)} className="p-1.5 text-slate-300 hover:text-[#FF7675] hover:bg-red-50 rounded-lg transition-all flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 );

 // ─── ACTIVE USERS TAB ────────────────────────────────────────────────────
 const renderActiveUsersTab = () => (
 <div className="space-y-6 pb-20">
 {/* ── Page Header ── */}
 <div className="bg-white rounded-2xl p-6 shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF]">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-3 flex-wrap">
 <h2 className="text-2xl font-bold text-slate-900">Active Users Monitor</h2>
 <span className="px-3 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-bold">{activeUsers.length} Registered Users</span>
 </div>
 <p className="text-sm text-slate-500 mt-1">View and manage all registered system users</p>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Protocol Active
 </span>
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-semibold">
 <Zap className="w-3 h-3" />System Synced
 </span>
 </div>
 </div>
 </div>

 {/* ── Danger Zone ── */}
 <div className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-red-100 overflow-hidden">
 <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
 <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
 <div>
 <h3 className="font-bold text-red-700 text-sm">Danger Zone</h3>
 <p className="text-xs text-red-500">Irreversible destructive actions — proceed with extreme caution</p>
 </div>
 </div>
 <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Delete Students */}
 <div className="bg-[#FFF5F5] rounded-xl p-5 border border-red-100">
 <div className="flex items-start gap-3 mb-4">
 <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
 <Trash2 className="w-4 h-4 text-red-600" />
 </div>
 <div>
 <p className="font-bold text-slate-900 text-sm">⚠️ Delete Students</p>
 <p className="text-xs text-slate-500 mt-1">Removes all students permanently from the system. This action cannot be undone.</p>
 </div>
 </div>
 <button onClick={() => setShowDeleteStudentsModal(true)} disabled={loading || activeUsers.length === 0} className="w-full py-2.5 border-2 border-red-400 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
 Delete All Students
 </button>
 </div>

 {/* Purge Everything */}
 <div className="bg-[#FFF0F0] rounded-xl p-5 border border-red-200">
 <div className="flex items-start gap-3 mb-4">
 <div className="w-9 h-9 rounded-xl bg-red-200 flex items-center justify-center flex-shrink-0">
 <Database className="w-4 h-4 text-red-700" />
 </div>
 <div>
 <p className="font-bold text-slate-900 text-sm">🚨 Delete All Data (CRITICAL)</p>
 <p className="text-xs text-slate-500 mt-1">Permanently removes EVERYTHING — students, transactions, finances, and all records. Requires double-confirmation.</p>
 </div>
 </div>
 <button onClick={() => setShowPurgeModal(true)} disabled={loading} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 shadow-[0_4px_12px_rgba(220,38,38,0.3)]">
 🚨 Purge Entire System
 </button>
 </div>
 </div>
 </div>

 {/* ── Users Grid ── */}
 <div className="bg-white rounded-2xl shadow-[0_10px_25px_rgba(90,69,255,0.08)] border border-[#E8E5FF] overflow-hidden">
 <div className="p-5 border-b border-[#E8E5FF]">
 <h3 className="font-bold text-slate-900">All Users</h3>
 <p className="text-xs text-slate-500 mt-0.5">{activeUsers.length} accounts registered</p>
 </div>

 {activeUsers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-slate-400">
 <Users className="w-10 h-10 mb-3 text-slate-200" />
 <p className="text-sm font-medium">No users registered</p>
 </div>
 ) : (
 <div className="divide-y divide-[#E8E5FF]">
 {activeUsers.map(user => (
 <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F4F0FF] transition-colors group">
 {/* Avatar */}
 <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.full_name)} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
 {getInitials(user.full_name)}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-bold text-slate-900 text-sm">{user.full_name}</p>
 <span className="px-2 py-0.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-[10px] font-bold">#ID: {user.roll_id}</span>
 {user.is_responsible && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">Staff</span>}
 </div>
 {user.username && <p className="text-xs text-slate-400 mt-0.5">{user.username}@account.com</p>}
 {user.grade && <p className="text-xs text-slate-400">{user.grade}</p>}
 </div>

 {/* Balance */}
 <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 ${(user.balance || 0) >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-[#FF7675] border border-red-100"}`}>
 ₹{(user.balance || 0).toLocaleString()}
 </span>

 {/* Actions */}
 <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => { setShowUserModal(true); setUserType("student"); setEditingUser(user); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E5FF] text-[#5A45FF] rounded-lg text-xs font-semibold hover:bg-[#5A45FF] hover:text-white transition-all">
 <Settings className="w-3.5 h-3.5" /> Edit
 </button>
 <button onClick={() => { setUserToDelete(user); setShowDeleteConfirm(true); setDeleteConfirmText(""); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500 hover:text-white transition-all">
 <Trash2 className="w-3.5 h-3.5" /> Del
 </button>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 </div>
 );

 // ─── SECURITY PROTOCOL MODAL ─────────────────────────────────────────────
 const renderAdminProfileSettingsModal = () => {
 if (!showProfileSettings) return null;
 const pwMatch = adminProfile.confirmPassword && adminProfile.newPassword === adminProfile.confirmPassword;
 const pwMismatch = adminProfile.confirmPassword && adminProfile.newPassword !== adminProfile.confirmPassword;
 return (
 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[300] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
 {/* Header */}
 <div className="p-6 border-b border-[#E8E5FF] flex items-center justify-between bg-gradient-to-r from-[#5A45FF]/5 to-transparent flex-shrink-0">
 <div className="flex items-center gap-4">
 <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] flex items-center justify-center shadow-[0_4px_12px_rgba(90,69,255,0.3)]">
 <ShieldCheck className="w-5 h-5 text-white" />
 </div>
 <div>
 <h3 className="text-xl font-bold text-slate-900">Security Protocol</h3>
 <p className="text-xs text-slate-500 mt-0.5">Manage administrative credentials & system access security</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold border border-emerald-100">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Protocol Active
 </span>
 <button onClick={() => { setShowProfileSettings(false); setAdminProfile({ currentPassword: "", newPassword: "", confirmPassword: "", newUsername: "" }); }} className="p-2 rounded-xl hover:bg-[#F0F2F9] text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6">
 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
 {/* Left — Credentials Form (60%) */}
 <div className="lg:col-span-3 space-y-5">
 <div className="bg-[#F0F2F9] rounded-2xl p-5 border border-[#E8E5FF]">
 <div className="flex items-center gap-3 mb-5">
 <Key className="w-5 h-5 text-[#5A45FF]" />
 <div>
 <h4 className="font-bold text-slate-900 text-sm">Account Credentials</h4>
 <p className="text-xs text-slate-500">Update username or password. Authentication required.</p>
 </div>
 </div>

 <div className="space-y-4">
 {/* New Username */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">New Username</label>
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type="text" value={adminProfile.newUsername} onChange={e => setAdminProfile({...adminProfile, newUsername: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all" placeholder="Enter new username..." />
 </div>
 <p className="text-[10px] text-slate-400 mt-1 ml-1">Leave blank to keep current username</p>
 </div>

 {/* Current Password */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Current Password <span className="text-red-500">*</span></label>
 <div className="relative">
 <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type={showCurrentPw ? "text" : "password"} value={adminProfile.currentPassword} onChange={e => setAdminProfile({...adminProfile, currentPassword: e.target.value})} className="w-full pl-11 pr-11 py-3 bg-white border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all" placeholder="Required to authorise changes" />
 <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
 {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 <p className="text-[10px] text-slate-400 mt-1 ml-1">Required to authorise any changes</p>
 </div>

 {/* New Password */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">New Password</label>
 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type={showNewPw ? "text" : "password"} value={adminProfile.newPassword} onChange={e => setAdminProfile({...adminProfile, newPassword: e.target.value})} className="w-full pl-11 pr-11 py-3 bg-white border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all" placeholder="Minimum 4 characters" />
 <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
 {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 {/* Strength bar */}
 {adminProfile.newPassword && (
 <div className="mt-2 flex gap-1">
 {[1,2,3,4].map(i => (
 <div key={i} className={`h-1 flex-1 rounded-full transition-all ${adminProfile.newPassword.length >= i * 2 ? (adminProfile.newPassword.length >= 8 ? "bg-emerald-500" : "bg-amber-400") : "bg-[#E8E5FF]"}`} />
 ))}
 </div>
 )}
 <p className="text-[10px] text-slate-400 mt-1 ml-1">Leave blank to keep current password</p>
 </div>

 {/* Confirm Password */}
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Confirm New Password</label>
 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type={showConfirmPw ? "text" : "password"} value={adminProfile.confirmPassword} onChange={e => setAdminProfile({...adminProfile, confirmPassword: e.target.value})} className={`w-full pl-11 pr-28 py-3 bg-white border rounded-xl text-sm text-slate-900 outline-none focus:ring-2 transition-all ${pwMismatch ? "border-[#FF7675] focus:ring-[#FF7675]/20" : pwMatch ? "border-emerald-300 focus:ring-emerald-500/20" : "border-[#E8E5FF] focus:ring-[#5A45FF]/30"}`} placeholder="Retype new password" />
 <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
 {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 {adminProfile.confirmPassword && (
 <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold ${pwMatch ? "text-emerald-600" : "text-[#FF7675]"}`}>
 {pwMatch ? "Matches" : "No match"}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex gap-3">
 <button onClick={() => { setShowProfileSettings(false); setAdminProfile({ currentPassword: "", newPassword: "", confirmPassword: "", newUsername: "" }); }} className="flex-1 py-3 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl font-semibold text-sm hover:bg-[#E8E5FF] transition-all">
 Cancel
 </button>
 <button onClick={handleChangeAdminPassword} disabled={loading || !adminProfile.currentPassword || (!adminProfile.newUsername && !adminProfile.newPassword)} className="flex-1 py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(90,69,255,0.35)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
 🔒 SAVE CHANGES
 </button>
 </div>
 </div>

 {/* Right — Guide & Audit (40%) */}
 <div className="lg:col-span-2 space-y-4">
 {/* Easy Steps */}
 <div className="bg-[#F4F0FF] rounded-2xl p-5 border border-[#E8E5FF]">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-7 h-7 rounded-lg bg-[#5A45FF] flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
 <h4 className="font-bold text-slate-900 text-sm">Easy Steps</h4>
 </div>
 <ul className="space-y-3">
 {[
 { icon: <User className="w-3.5 h-3.5" />, text: "Change Username Only: Current password + New username" },
 { icon: <Key className="w-3.5 h-3.5" />, text: "Change Password Only: Current password + New password twice" },
 { icon: <RefreshCw className="w-3.5 h-3.5" />, text: "Change Both: Complete all fields" },
 { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Always keep your current password safe" },
 ].map((item, i) => (
 <li key={i} className="flex items-start gap-3">
 <div className="w-6 h-6 rounded-lg bg-[#E8E5FF] text-[#5A45FF] flex items-center justify-center flex-shrink-0 mt-0.5">{item.icon}</div>
 <p className="text-xs text-slate-600 leading-relaxed">{item.text}</p>
 </li>
 ))}
 </ul>
 </div>

 {/* Security Audit Notice */}
 <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
 <div className="flex items-center gap-2 mb-3">
 <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5 text-amber-600" /></div>
 <h4 className="font-bold text-amber-800 text-sm">Security Audit Notice</h4>
 </div>
 <p className="text-xs text-amber-700 leading-relaxed">
 <strong>Important:</strong> All administrative credential modifications are permanently logged in system security records for audit safety.
 </p>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 );
 };

 // ─── GROUP CREATION MODAL ─────────────────────────────────────────────────
 const renderGroupCreationModal = () => (
 <AnimatePresence>
 {showGroupModal && (
 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[300] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
 <div className="p-6 border-b border-[#E8E5FF] flex items-center justify-between">
 <div>
 <h3 className="font-bold text-slate-900 text-lg">Create New Group</h3>
 <p className="text-xs text-slate-500 mt-0.5">Select students to form a new personnel group</p>
 </div>
 <button onClick={() => setShowGroupModal(false)} className="p-2 rounded-xl hover:bg-[#F0F2F9] text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
 </div>
 <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Group Name</label>
 <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="e.g. Science Class-A" />
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Select Students ({groupSelected.length} selected)</label>
 <div className="space-y-2 max-h-56 overflow-y-auto bg-[#F0F2F9] rounded-xl p-3 border border-[#E8E5FF]">
 {students.map(s => (
 <button key={s.id} onClick={() => toggleGroupStudent(s.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${groupSelected.includes(s.id) ? "border-[#5A45FF]/40 bg-[#E8E5FF]" : "border-transparent bg-white hover:bg-[#F4F0FF]"}`}>
 <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(s.full_name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{getInitials(s.full_name)}</div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</p>
 <p className="text-xs text-slate-500">#{s.roll_id}</p>
 </div>
 {groupSelected.includes(s.id) ? <CheckSquare className="w-4 h-4 text-[#5A45FF] flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />}
 </button>
 ))}
 </div>
 </div>
 <button onClick={handleSaveGroup} disabled={loading || !groupName || groupSelected.length === 0} className="w-full py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(90,69,255,0.3)] hover:opacity-90 transition-all disabled:opacity-50">
 {loading ? "Creating..." : "Create Group"}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );

 // ─── USER MANAGEMENT MODAL ────────────────────────────────────────────────
 const renderUserManagementModal = () => (
 <AnimatePresence>
 {showUserModal && (
 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[300] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
 <div className="p-6 border-b border-[#E8E5FF] flex items-center justify-between flex-shrink-0">
 <div>
 <h3 className="font-bold text-slate-900 text-lg">{editingUser?.id ? "Edit Account" : "Enroll New Personnel"}</h3>
 <p className="text-xs text-slate-500 mt-0.5">Student account details</p>
 </div>
 <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="p-2 rounded-xl hover:bg-[#F0F2F9] text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
 </div>
 <div className="p-6 space-y-4 overflow-y-auto flex-1">
 {[
 { label: "Full Name", key: "full_name", placeholder: "Enter full name", type: "text" },
 { label: "Roll ID", key: "roll_id", placeholder: "STU-XXXX (auto if empty)", type: "text" },
 { label: "Grade / Class", key: "grade", placeholder: "e.g. Class-A", type: "text" },
 { label: "Phone Number", key: "parent_phone", placeholder: "10-digit mobile number (for login)", type: "tel" },
 { label: "Username", key: "username", placeholder: "Login username", type: "text" },
 { label: "Password", key: "password", placeholder: "Login password", type: "text" },
 ].map(field => (
 <div key={field.key}>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{field.label}</label>
 <input type={field.type} value={editingUser?.[field.key] || ""} onChange={e => setEditingUser({...editingUser, [field.key]: e.target.value})} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder={field.placeholder} />
 </div>
 ))}
 <button onClick={handleCreateUser} disabled={loading || !editingUser?.full_name} className="w-full py-3 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(90,69,255,0.3)] hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
 {editingUser?.id ? "Save Changes" : "Create Account"}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );

 // ─── CREDENTIAL EDIT MODAL ────────────────────────────────────────────────
 const renderCredentialEditModal = () => {
 if (!showCredentialModal || !editingCredentials) return null;
 return (
 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[300] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
 <div className="p-6 border-b border-[#E8E5FF] flex items-center justify-between">
 <div>
 <h3 className="font-bold text-slate-900">Security Credentials</h3>
 <p className="text-xs text-slate-500 mt-0.5">Editing: {editingCredentials.full_name}</p>
 </div>
 <button onClick={() => { setShowCredentialModal(false); setEditingCredentials(null); }} className="p-2 rounded-xl hover:bg-[#F0F2F9] text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
 </div>
 <div className="p-6 space-y-4">
 <div className="bg-[#E8E5FF] rounded-xl p-4 border border-[#5A45FF]/20 flex items-start gap-3">
 <ShieldCheck className="w-5 h-5 text-[#5A45FF] flex-shrink-0 mt-0.5" />
 <p className="text-xs text-[#5A45FF] leading-relaxed">Changes take effect immediately. Old login details will no longer work.</p>
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Username</label>
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input value={tempCredentials.username} onChange={e => setTempCredentials({...tempCredentials, username: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Enter username" />
 </div>
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input type={showTempPassword ? "text" : "password"} value={tempCredentials.password} onChange={e => setTempCredentials({...tempCredentials, password: e.target.value})} className="w-full pl-11 pr-11 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#5A45FF]/30" placeholder="Enter password" />
 <button type="button" onClick={() => setShowTempPassword(!showTempPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
 {showTempPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={() => { setShowCredentialModal(false); setEditingCredentials(null); }} className="flex-1 py-3 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl font-semibold text-sm hover:bg-[#E8E5FF] transition-all">Cancel</button>
 <button onClick={handleUpdateCredentials} disabled={loading || !tempCredentials.username || !tempCredentials.password} className="flex-1 py-3 bg-[#5A45FF] text-white rounded-xl font-bold text-sm hover:bg-[#4834DF] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Update
 </button>
 </div>
 </div>
 </motion.div>
 </div>
 );
 };

 // ─── STUDENT PROFILE MODAL ────────────────────────────────────────────────
 const renderStudentProfileModal = () => {
 if (!viewingStudent) return null;
 return (
 <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[200] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
 <div className="p-6 border-b border-[#E8E5FF] flex items-center justify-between flex-shrink-0">
 <div className="flex items-center gap-4">
 <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(viewingStudent.full_name)} flex items-center justify-center text-white text-2xl font-bold`}>{getInitials(viewingStudent.full_name)}</div>
 <div>
 <h2 className="text-xl font-bold text-slate-900">{viewingStudent.full_name}</h2>
 <div className="flex items-center gap-2 mt-1">
 <span className="px-2.5 py-1 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-xs font-bold">#{viewingStudent.roll_id}</span>
 {viewingStudent.grade && <span className="text-xs text-slate-500">{viewingStudent.grade}</span>}
 </div>
 </div>
 </div>
 <button onClick={() => setViewingStudent(null)} className="p-2 rounded-xl hover:bg-[#F0F2F9] text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
 </div>
 <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="space-y-4">
 <div className="bg-[#F0F2F9] rounded-2xl p-5 border border-[#E8E5FF]">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Account Overview</h4>
 <div className="grid grid-cols-2 gap-3">
 <div className={`p-4 rounded-xl border-2 ${viewingStudent.balance >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
 <p className="text-xs text-slate-500 font-medium">Balance</p>
 <p className={`text-2xl font-bold mt-1 ${viewingStudent.balance >= 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>₹{viewingStudent.balance.toLocaleString()}</p>
 </div>
 <div className="p-4 rounded-xl bg-[#E8E5FF] border-2 border-[#5A45FF]/20">
 <p className="text-xs text-slate-500 font-medium">Grade</p>
 <p className="text-xl font-bold text-slate-900 mt-1">{viewingStudent.grade || "—"}</p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3 mt-3">
 <button onClick={() => handleOpenCredentialEdit(viewingStudent)} className="py-3 bg-[#5A45FF] text-white rounded-xl text-xs font-bold hover:bg-[#4834DF] transition-all flex items-center justify-center gap-2">
 <Key className="w-3.5 h-3.5" /> Credentials
 </button>
 <button onClick={() => { setShowUserModal(true); setUserType("student"); setEditingUser(viewingStudent); setViewingStudent(null); }} className="py-3 bg-white border border-[#E8E5FF] text-slate-700 rounded-xl text-xs font-bold hover:bg-[#F0F2F9] transition-all flex items-center justify-center gap-2">
 <Settings className="w-3.5 h-3.5" /> Edit Profile
 </button>
 </div>
 </div>
 </div>
 <div className="bg-[#F0F2F9] rounded-2xl p-5 border border-[#E8E5FF] flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Personal Ledger</h4>
 <button onClick={() => handleDownloadStudentLedger(viewingStudent)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5A45FF] text-white rounded-lg text-xs font-semibold hover:bg-[#4834DF] transition-all">
 <Download className="w-3 h-3" /> PDF
 </button>
 </div>
 <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
 {fundTransactions.filter(tx => tx.student_id === viewingStudent.id).length === 0 ? (
 <p className="text-center py-8 text-sm text-slate-400">No transaction history</p>
 ) : fundTransactions.filter(tx => tx.student_id === viewingStudent.id).map((tx, i) => (
 <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#E8E5FF]">
 <div>
 <p className="text-xs font-semibold text-slate-900">{tx.description || "Adjustment"}</p>
 <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
 </div>
 <span className={`text-sm font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>{tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 );
 };

 // ─── DELETE CONFIRM MODAL ─────────────────────────────────────────────────
 const renderDeleteConfirmationModal = () => {
 if (!showDeleteConfirm || !userToDelete) return null;
 return (
 <AnimatePresence>
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[500] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
 <div className="p-6 border-b border-red-100 bg-red-50 flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-600" /></div>
 <div>
 <h3 className="font-bold text-red-800">Delete User Account</h3>
 <p className="text-xs text-red-600 mt-0.5">This action is permanent and cannot be undone</p>
 </div>
 </div>
 <div className="p-6 space-y-4">
 <div className="bg-[#FFF5F5] rounded-xl p-4 border border-red-100 flex items-center gap-3">
 <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarGradient(userToDelete.full_name)} flex items-center justify-center text-white font-bold flex-shrink-0`}>{getInitials(userToDelete.full_name)}</div>
 <div>
 <p className="font-bold text-slate-900">{userToDelete.full_name}</p>
 <p className="text-xs text-slate-500">#{userToDelete.roll_id} • ₹{userToDelete.balance?.toLocaleString() || 0}</p>
 </div>
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Type <span className="font-mono bg-red-50 text-red-600 px-1.5 py-0.5 rounded">DELETE</span> to confirm</label>
 <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500/30" placeholder="Type DELETE here" />
 </div>
 <div className="flex gap-3">
 <button onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); setDeleteConfirmText(""); }} className="flex-1 py-3 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl font-semibold text-sm hover:bg-[#E8E5FF] transition-all">Cancel</button>
 <button onClick={handleDeleteUser} disabled={loading || deleteConfirmText !== "DELETE"} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
 Delete Permanently
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
 };

 // ─── DANGER ZONE MODALS ───────────────────────────────────────────────────
 const renderDangerModals = () => (
 <AnimatePresence>
 {/* Delete All Students */}
 {showDeleteStudentsModal && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[500] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
 <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
 <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
 <div><h3 className="font-bold text-amber-800">Delete All Students</h3><p className="text-xs text-amber-600 mt-0.5">Removes all {activeUsers.length} students permanently</p></div>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Type <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">DELETE</span> to confirm</label>
 <input value={deleteStudentsConfirmText} onChange={e => setDeleteStudentsConfirmText(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400/30" placeholder="Type DELETE here" />
 </div>
 <div className="flex gap-3">
 <button onClick={() => { setShowDeleteStudentsModal(false); setDeleteStudentsConfirmText(""); }} className="flex-1 py-3 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl font-semibold text-sm hover:bg-[#E8E5FF] transition-all">Cancel</button>
 <button onClick={handleDeleteAllStudents} disabled={loading || deleteStudentsConfirmText !== "DELETE"} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete All
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 {/* Purge System */}
 {showPurgeModal && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[500] flex items-center justify-center p-4">
 <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
 <div className="p-5 bg-red-50 border-b border-red-200 flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><Database className="w-5 h-5 text-red-700" /></div>
 <div><h3 className="font-bold text-red-800">🚨 Purge Entire System</h3><p className="text-xs text-red-600 mt-0.5">Permanently removes ALL data — students, finances, transactions, library</p></div>
 </div>
 <div className="p-6 space-y-4">
 <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-xs text-red-700 space-y-1">
 <p className="font-bold">This will permanently delete:</p>
 <p>• All {activeUsers.length} students and their accounts</p>
 <p>• All fund transactions and balances</p>
 <p>• All financial ledger records</p>
 <p>• All library data and notifications</p>
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Type <span className="font-mono bg-red-50 text-red-600 px-1.5 py-0.5 rounded">DELETE</span> to confirm</label>
 <input value={purgeConfirmText} onChange={e => setPurgeConfirmText(e.target.value)} className="w-full px-4 py-3 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/30" placeholder="Type DELETE here" />
 </div>
 <div className="flex gap-3">
 <button onClick={() => { setShowPurgeModal(false); setPurgeConfirmText(""); }} className="flex-1 py-3 bg-[#F0F2F9] border border-[#E8E5FF] text-slate-700 rounded-xl font-semibold text-sm hover:bg-[#E8E5FF] transition-all">Cancel</button>
 <button onClick={handleDeleteAllData} disabled={loading || purgeConfirmText !== "DELETE"} className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
 {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Purge System
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );

 // ─── CONTENT ROUTER ───────────────────────────────────────────────────────
 const renderContent = () => {
 // Read tab directly from URL to prevent any state lag
 const tab = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null) || activeTab || "funds";
 switch (tab) {
 case "funds": return renderFundsTab();
 case "finances": return renderFinancesTab();
 case "students": return renderStudentsTab();
 case "transactions": return renderTransactionsTab();
 case "broadcast": return renderNotificationsTab();
 case "active-users": return renderActiveUsersTab();
 default: return renderFundsTab();
 }
 };

 // ─── NAV ITEMS ────────────────────────────────────────────────────────────
 const navItems = [
 { id: "funds", label: "Funds Desk", icon: Landmark, color: "text-[#5A45FF]" },
 { id: "finances", label: "Global Vault", icon: Vault, color: "text-emerald-500" },
 { id: "students", label: "Personnel", icon: GraduationCap, color: "text-blue-500" },
 { id: "transactions", label: "Transactions / History", icon: ClipboardList, color: "text-rose-500" },
 { id: "active-users", label: "Active Users", icon: UserCog, color: "text-amber-500" },
 ];

 // ─── MAIN RENDER ─────────────────────────────────────────────────────────
 return (
 <div className="flex h-screen bg-[#F0F2F9] text-slate-900 font-sans overflow-hidden pb-16 md:pb-0 transition-colors duration-200">
 {/* ── Sidebar ── */}
 <aside className="w-72 bg-white border-r border-[#E8E5FF] p-6 flex flex-col hidden md:flex flex-shrink-0 shadow-[4px_0_24px_rgba(90,69,255,0.06)]">
 {/* Brand */}
 <div className="flex items-center gap-3 mb-10">
 <div className="w-11 h-11 bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-[0_4px_12px_rgba(90,69,255,0.35)]">SM</div>
 <div>
 <span className="font-bold text-base text-slate-900 block leading-tight">SCHOOL.</span>
 <span className="text-[10px] font-semibold text-[#5A45FF] tracking-wider">Central Protocol</span>
 </div>
 </div>

 {/* Nav */}
 <nav className="space-y-1 flex-1">
 {navItems.map(item => {
 const Icon = item.icon;
 const isActive = activeTab === item.id;
 return (
 <button key={item.id} onClick={() => router.push(`/admin?tab=${item.id}`)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group relative ${isActive ? "bg-[#E8E5FF] text-[#5A45FF]" : "text-slate-500 hover:bg-[#F0F2F9] hover:text-slate-900 "}`}>
 {isActive && <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#5A45FF] rounded-r-full" />}
 <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#5A45FF]" : item.color} transition-colors`} />
 <span className={`text-sm font-semibold ${isActive ? "text-[#5A45FF]" : ""}`}>{item.label}</span>
 </button>
 );
 })}
 </nav>

 {/* Bottom */}
 <div className="pt-6 border-t border-[#E8E5FF] space-y-1">
 {/* Dark mode toggle */}
 <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-[#F0F2F9] hover:text-slate-700 transition-all group">
 {theme === "dark"
 ? <Sun className="w-4 h-4 text-amber-400" />
 : <Moon className="w-4 h-4" />}
 <span className="text-sm font-semibold">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
 </button>
 <button onClick={() => setShowProfileSettings(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-[#F0F2F9] hover:text-[#5A45FF] transition-all group">
 <ShieldCheck className="w-4 h-4 group-hover:text-[#5A45FF] transition-colors" />
 <span className="text-sm font-semibold">Security Protocol</span>
 </button>
 <button onClick={() => router.push("/")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all group">
 <LogOut className="w-4 h-4" />
 <span className="text-sm font-semibold">Sign Out</span>
 </button>
 </div>
 </aside>

 {/* ── Main Content ── */}
 <main className="flex-1 overflow-y-auto">
 <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
 {/* Page Header */}
 <header className="flex items-center justify-between mb-6">
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 capitalize">
 {isMounted ? navItems.find(n => n.id === activeTab)?.label || activeTab : "Loading..."}
 </h1>
 </div>
 <div className="flex items-center gap-2 mt-1.5">
 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
 <p className="text-xs font-medium text-slate-500 ">Protocol Active • System Synced</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {/* Mobile dark mode toggle */}
 <button onClick={toggleTheme} className="md:hidden flex items-center justify-center w-10 h-10 bg-white border border-[#E8E5FF] rounded-xl text-slate-600 hover:bg-[#E8E5FF] transition-all">
 {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
 </button>
 <button onClick={refreshData} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E5FF] rounded-xl text-sm font-semibold text-slate-600 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all shadow-[0_2px_8px_rgba(90,69,255,0.06)]">
 <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#5A45FF]" : ""}`} />
 <span className="hidden sm:inline">Refresh</span>
 </button>
 </div>
 </header>

 {/* Tab Content */}
 {!isMounted ? (
 <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
 <div className="w-12 h-12 rounded-2xl bg-[#E8E5FF] flex items-center justify-center">
 <RefreshCw className="w-6 h-6 text-[#5A45FF] animate-spin" />
 </div>
 <p className="text-sm font-medium text-slate-500 ">Initialising Protocol...</p>
 </div>
 ) : (
 <AnimatePresence mode="wait">
 <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }}>
 {renderContent()}
 </motion.div>
 </AnimatePresence>
 )}
 </div>
 </main>

 {/* ── All Modals ── */}
 {renderStudentProfileModal()}
 {renderGroupCreationModal()}
 {renderUserManagementModal()}
 {renderCredentialEditModal()}
 {renderAdminProfileSettingsModal()}
 {renderDeleteConfirmationModal()}
 {renderDangerModals()}
 </div>
 );
}

// ─── STUDENT LEDGER ACCORDION ROW (standalone component) ──────────────────
function StudentLedgerRow({ student, transactions, income, expense, net, getAvatarGradient, getInitials, handleDownloadStudentLedger }: {
 student: Student; transactions: any[]; income: number; expense: number; net: number;
 getAvatarGradient: (n: string) => string; getInitials: (n: string) => string;
 handleDownloadStudentLedger: (s: Student) => void;
}) {
 const [open, setOpen] = useState(false);
 const [showAll, setShowAll] = useState(false);
 const visible = showAll ? transactions : transactions.slice(0, 6);

 return (
 <div className="hover:bg-[#F4F0FF] transition-colors">
 {/* Summary Row */}
 <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-5 py-4 text-left">
 {/* Avatar */}
 <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(student.full_name)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
 {getInitials(student.full_name)}
 </div>

 {/* Name + ID */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-bold text-slate-900 text-sm">{student.full_name}</p>
 <span className="px-2 py-0.5 bg-[#E8E5FF] text-[#5A45FF] rounded-full text-[10px] font-bold">#ID: {student.roll_id}</span>
 <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-semibold">{transactions.length} txn</span>
 </div>
 </div>

 {/* Mini badges */}
 <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
 <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">+₹{income.toLocaleString()}</span>
 <span className="px-2.5 py-1 bg-red-50 text-[#FF7675] rounded-lg text-xs font-bold">-₹{expense.toLocaleString()}</span>
 <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#FF7675]"}`}>{net >= 0 ? "+" : ""}₹{net.toLocaleString()}</span>
 </div>

 <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
 </button>

 {/* Expanded Detail */}
 <AnimatePresence>
 {open && (
 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
 <div className="px-5 pb-4">
 {/* Mobile mini badges */}
 <div className="flex sm:hidden items-center gap-2 mb-3 flex-wrap">
 <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">+₹{income.toLocaleString()}</span>
 <span className="px-2.5 py-1 bg-red-50 text-[#FF7675] rounded-lg text-xs font-bold">-₹{expense.toLocaleString()}</span>
 <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#FF7675]"}`}>{net >= 0 ? "+" : ""}₹{net.toLocaleString()}</span>
 </div>

 {transactions.length === 0 ? (
 <p className="text-center py-4 text-sm text-slate-400">No transactions yet</p>
 ) : (
 <>
 {/* Sub-table header */}
 <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-3 py-2 bg-[#F0F2F9] rounded-t-xl border border-[#E8E5FF] border-b-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
 <span>Note</span><span>Date</span><span>Type</span><span className="text-right">Amount</span>
 </div>
 <div className="border border-[#E8E5FF] rounded-b-xl overflow-hidden divide-y divide-[#E8E5FF]">
 {visible.map((tx, i) => (
 <div key={tx.id || i} className={`grid grid-cols-[1fr_80px_80px_80px] gap-2 px-3 py-2.5 items-center ${i % 2 === 0 ? "bg-white" : "bg-[#F0F2F9]/40"}`}>
 <p className="text-xs font-medium text-slate-900 truncate">{tx.description || "Transaction"}</p>
 <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
 <span className={`text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tx.type === "deposit" || tx.type === "distribution" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#FF7675]"}`}>{tx.type}</span>
 <p className={`text-xs font-bold text-right ${tx.amount > 0 ? "text-emerald-600" : "text-[#FF7675]"}`}>{tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString()}</p>
 </div>
 ))}
 </div>
 {transactions.length > 6 && (
 <button onClick={() => setShowAll(!showAll)} className="mt-2 w-full py-2 text-xs font-semibold text-[#5A45FF] hover:bg-[#E8E5FF] rounded-xl transition-colors">
 {showAll ? "Show less" : `Show more (+${transactions.length - 6} transactions)`}
 </button>
 )}
 <button onClick={() => handleDownloadStudentLedger(student)} className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#F0F2F9] border border-[#E8E5FF] rounded-xl text-xs font-semibold text-slate-600 hover:bg-[#E8E5FF] hover:text-[#5A45FF] transition-all">
 <Download className="w-3.5 h-3.5" /> Download PDF Ledger
 </button>
 </>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

// ─── PAGE EXPORT ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
 return (
 <Suspense fallback={
 <div className="min-h-screen bg-[#F0F2F9] flex items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <div className="w-12 h-12 rounded-2xl bg-[#E8E5FF] flex items-center justify-center">
 <RefreshCw className="w-6 h-6 text-[#5A45FF] animate-spin" />
 </div>
 <p className="text-sm font-medium text-slate-500">Loading System...</p>
 </div>
 </div>
 }>
 <AdminDashboardContent />
 </Suspense>
 );
}

