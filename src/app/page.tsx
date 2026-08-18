"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
 ShieldCheck, Lock, ArrowRight, Loader2, School,
 Smartphone, User, Eye, EyeOff, ChevronDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setSession } from "@/lib/session";

type LoginMode = "phone" | "username";

export default function LoginPage() {
 const router = useRouter();

 // ── mode: "phone" is default, "username" is the legacy fallback
 const [mode, setMode] = useState<LoginMode>("phone");

 // phone mode
 const [phone, setPhone] = useState("");

 // username mode
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");

 // ── Phone login ────────────────────────────────────────────────────────────
 const handlePhoneLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");

 const digits = phone.replace(/\D/g, "");
 if (digits.length !== 10) {
 setError("Please enter a valid 10-digit mobile number.");
 return;
 }

 setLoading(true);
 await new Promise(r => setTimeout(r, 600));

 try {
 const { data: student } = await supabase
 .from("students")
 .select("*")
 .eq("parent_phone", digits)
 .maybeSingle();

 if (!student) {
 setError("No account found for this number. Try the username login below.");
 setLoading(false);
 return;
 }

 setSession({
 email: student.email_account || `${student.roll_id}@account.com`,
 role: "student-account",
 name: student.full_name,
 roll: student.roll_id,
 id: student.id,
 });

 router.push("/student/account");
 } catch (err: any) {
 setError("Something went wrong. Please try again.");
 setLoading(false);
 }
 };

 // ── Username / admin login ─────────────────────────────────────────────────
 const handleUsernameLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setLoading(true);
 await new Promise(r => setTimeout(r, 600));

 // Admin hardcoded check
 if (username === "admin@account" && password === "adminac123") {
 setSession({ email: username, role: "admin", name: "Master Admin" });
 router.push("/admin");
 return;
 }

 // Strip @account.com suffix if user typed the full email
 const handle = username.includes("@")
 ? username.split("@")[0]
 : username;

 try {
 const { data: student, error: fetchErr } = await supabase
 .from("students")
 .select("*")
 .eq("username", handle)
 .eq("password", password)
 .single();

 if (fetchErr || !student) {
 setError("Invalid username or password. Please try again.");
 setLoading(false);
 return;
 }

 setSession({
 email: student.email_account || `${handle}@account.com`,
 role: "student-account",
 name: student.full_name,
 roll: student.roll_id,
 id: student.id,
 });

 router.push("/student/account");
 } catch (err: any) {
 setError("Something went wrong. Please try again.");
 setLoading(false);
 }
 };

 // ── Phone input formatter (adds spaces: 98765 43210) ──────────────────────
 const formatPhone = (val: string) => {
 const digits = val.replace(/\D/g, "").slice(0, 10);
 if (digits.length <= 5) return digits;
 return `${digits.slice(0, 5)} ${digits.slice(5)}`;
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-[#F0F2F9] relative overflow-hidden font-sans px-4 py-8 transition-colors duration-200">
 {/* Background blobs */}
 <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#5A45FF]/8 rounded-full blur-[120px] pointer-events-none" />
 <div className="absolute bottom-[-15%] left-[-15%] w-[500px] h-[500px] bg-[#5A45FF]/5 rounded-full blur-[120px] pointer-events-none" />

 <motion.div
 initial={{ opacity: 0, scale: 0.97, y: 12 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 transition={{ duration: 0.45, ease: "easeOut" }}
 className="z-10 w-full max-w-md"
 >
 {/* Card */}
 <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(90,69,255,0.12)] overflow-hidden border border-transparent ">

 {/* Header */}
 <div className="bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] px-8 pt-10 pb-8 text-center relative overflow-hidden">
 <div className="absolute inset-0 opacity-10">
 <div className="absolute top-4 right-8 w-24 h-24 rounded-full bg-white" />
 <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white" />
 </div>
 <div className="relative z-10">
 <div className="inline-flex p-3.5 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
 <School className="w-7 h-7 text-white" />
 </div>
 <h1 className="text-2xl font-bold text-white">School Manager</h1>
 <p className="text-white/70 text-sm mt-1 font-medium">Student & Admin Portal</p>
 </div>
 </div>

 {/* Tab Toggle */}
 <div className="px-8 pt-6">
 <div className="flex bg-[#F0F2F9] rounded-2xl p-1 gap-1">
 <button
 onClick={() => { setMode("phone"); setError(""); }}
 className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
 mode === "phone"
 ? "bg-[#5A45FF] text-white shadow-[0_4px_12px_rgba(90,69,255,0.3)]"
 : "text-slate-500 hover:text-slate-700 "
 }`}
 >
 <Smartphone className="w-4 h-4" />
 Phone Number
 </button>
 <button
 onClick={() => { setMode("username"); setError(""); }}
 className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
 mode === "username"
 ? "bg-[#5A45FF] text-white shadow-[0_4px_12px_rgba(90,69,255,0.3)]"
 : "text-slate-500 hover:text-slate-700 "
 }`}
 >
 <User className="w-4 h-4" />
 Username
 </button>
 </div>
 </div>

 {/* Forms */}
 <div className="px-8 pb-8 pt-5">
 <AnimatePresence mode="wait">

 {/* ── PHONE MODE ── */}
 {mode === "phone" && (
 <motion.form
 key="phone"
 initial={{ opacity: 0, x: -12 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 12 }}
 transition={{ duration: 0.2 }}
 onSubmit={handlePhoneLogin}
 className="space-y-5"
 >
 {/* Helper banner */}
 <div className="bg-[#E8E5FF] rounded-2xl px-4 py-3 flex items-start gap-3">
 <Smartphone className="w-4 h-4 text-[#5A45FF] flex-shrink-0 mt-0.5" />
 <p className="text-xs text-[#5A45FF] font-medium leading-relaxed">
 Enter your registered <strong>10-digit mobile number</strong>. No password needed — just your phone number opens your portal instantly.
 </p>
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-semibold text-slate-700">Mobile Number</label>
 <div className="relative">
 {/* Country code badge */}
 <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 border-r border-slate-200 pr-3 pointer-events-none">
 <span className="text-sm font-bold text-slate-500">+91</span>
 </div>
 <input
 type="tel"
 inputMode="numeric"
 value={formatPhone(phone)}
 onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
 className="w-full pl-16 pr-4 py-3.5 bg-[#F0F2F9] rounded-2xl text-slate-900 text-base font-semibold tracking-widest placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all"
 placeholder="98765 43210"
 required
 />
 </div>
 <p className="text-xs text-slate-400 ml-1">The number registered with your school account</p>
 </div>

 {/* Error */}
 <AnimatePresence mode="wait">
 {error && (
 <motion.div
 initial={{ opacity: 0, y: -6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 className="flex items-center gap-2.5 bg-rose-50 text-rose-600 text-sm font-medium p-3.5 rounded-xl"
 >
 <ShieldCheck className="w-4 h-4 flex-shrink-0" />
 {error}
 </motion.div>
 )}
 </AnimatePresence>

 <button
 type="submit"
 disabled={loading || phone.replace(/\D/g, "").length !== 10}
 className="w-full py-3.5 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white font-bold rounded-2xl shadow-[0_4px_14px_rgba(90,69,255,0.35)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm"
 >
 {loading ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <>Enter Portal <ArrowRight className="w-4 h-4" /></>
 )}
 </button>

 {/* Phone digit progress indicator */}
 <div className="flex gap-1 justify-center">
 {Array.from({ length: 10 }).map((_, i) => (
 <div
 key={i}
 className={`h-1 flex-1 rounded-full transition-all duration-150 ${
 i < phone.replace(/\D/g, "").length
 ? "bg-[#5A45FF]"
 : "bg-[#E8E5FF]"
 }`}
 />
 ))}
 </div>
 </motion.form>
 )}

 {/* ── USERNAME MODE ── */}
 {mode === "username" && (
 <motion.form
 key="username"
 initial={{ opacity: 0, x: 12 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -12 }}
 transition={{ duration: 0.2 }}
 onSubmit={handleUsernameLogin}
 className="space-y-4"
 >
 <div className="space-y-1.5">
 <label className="text-sm font-semibold text-slate-700 ">Username</label>
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={username}
 onChange={e => setUsername(e.target.value)}
 className="w-full pl-11 pr-4 py-3.5 bg-[#F0F2F9] rounded-2xl text-slate-900 font-medium placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all text-sm"
 placeholder="Enter username or admin@account"
 required
 />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-semibold text-slate-700 ">Password</label>
 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type={showPassword ? "text" : "password"}
 value={password}
 onChange={e => setPassword(e.target.value)}
 className="w-full pl-11 pr-11 py-3.5 bg-[#F0F2F9] rounded-2xl text-slate-900 font-medium placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#5A45FF]/30 transition-all text-sm"
 placeholder="••••••••••"
 required
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
 >
 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>

 {/* Error */}
 <AnimatePresence mode="wait">
 {error && (
 <motion.div
 initial={{ opacity: 0, y: -6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 className="flex items-center gap-2.5 bg-rose-50 text-rose-600 text-sm font-medium p-3.5 rounded-xl"
 >
 <ShieldCheck className="w-4 h-4 flex-shrink-0" />
 {error}
 </motion.div>
 )}
 </AnimatePresence>

 <button
 type="submit"
 disabled={loading || !username || !password}
 className="w-full py-3.5 bg-gradient-to-r from-[#5A45FF] to-[#6C5CE7] text-white font-bold rounded-2xl shadow-[0_4px_14px_rgba(90,69,255,0.35)] hover:shadow-[0_4px_20px_rgba(90,69,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm"
 >
 {loading ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <>Sign In <ArrowRight className="w-4 h-4" /></>
 )}
 </button>

 {/* Admin hint */}
 <p className="text-center text-xs text-slate-400">
 Admin? Use <span className="font-mono font-semibold text-slate-500">admin@account</span> as username
 </p>
 </motion.form>
 )}

 </AnimatePresence>
 </div>
 </div>

 {/* Footer note */}
 <p className="text-center text-xs text-slate-400 mt-4">
 Secured by School Manager Protocol
 </p>
 </motion.div>
 </div>
 );
}
