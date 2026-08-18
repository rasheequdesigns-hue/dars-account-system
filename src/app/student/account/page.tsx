"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Wallet, LogOut, ArrowDownRight, ArrowUpRight,
  ShieldCheck, Receipt, Activity, ArrowLeft, TrendingUp, Moon, Sun
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getSession, clearSession } from "@/lib/session";
import { validateSession } from "@/lib/session-validation";
import { useTheme } from "@/components/ThemeProvider";

export default function StudentAccountDashboard() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [session, setSession]       = useState<any>(null);
  const [balance, setBalance]       = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [fonts, setFonts]           = useState<any[]>([]);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const validateAndFetch = async () => {
      const s = getSession();
      if (!s) { router.push("/"); return; }
      const isValid = await validateSession();
      if (!isValid) { clearSession(); router.push("/"); return; }
      setSession(s);
      if (s.roll) fetchData(s.roll);
    };
    validateAndFetch();
  }, []);

  const fetchData = async (rollId: string) => {
    try {
      const { data: student } = await supabase.from("students").select("*").eq("roll_id", rollId).single();
      if (student) {
        setStudentInfo(student);
        setBalance(student.balance);
        const [{ data: n }, { data: trans }, { data: f }] = await Promise.all([
          supabase.from("school_notifications").select("*, school_fonts(name)").or(`student_id.is.null,student_id.eq.${student.id}`).order("created_at", { ascending: false }),
          supabase.from("fund_transactions").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
          supabase.from("school_fonts").select("*"),
        ]);
        const now = new Date().getTime();
        setNotifications((n || []).filter((notif: any) => !notif.end_at || new Date(notif.end_at).getTime() > now));
        setTransactions(trans || []);
        setFonts(f || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);
    const monthlyTxs = transactions.filter(t => new Date(t.created_at) >= startOfMonth);
    const yearlyTxs  = transactions.filter(t => new Date(t.created_at) >= startOfYear);
    return {
      monthlyReceived: monthlyTxs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
      yearlyReceived:  yearlyTxs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
      totalReceived:   transactions.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
      totalSpent:      Math.abs(transactions.filter(t => t.amount < 0).reduce((a, t) => a + (t.amount || 0), 0)),
    };
  }, [transactions]);

  const handleLogout = () => { clearSession(); router.push("/"); };

  const fontFaceStyles = fonts.map(f =>
    `@font-face { font-family: '${f.name}'; src: url(${f.font_data}); }`
  ).join("\n");

  const statCards = [
    { label: "Monthly Sync",     value: stats.monthlyReceived, color: "text-[#5B52A3]",    Icon: TrendingUp,  desc: "Synced this month" },
    { label: "Annual Total",     value: stats.yearlyReceived,  color: "text-emerald-600",  Icon: Activity,    desc: "Total this year"   },
    { label: "Total Deductions", value: stats.totalSpent,      color: "text-rose-600",     Icon: ArrowUpRight, desc: "All expenses"    },
  ];

  return (
    <div className="min-h-screen bg-[#eef2f6] dark:bg-[#0f1117] text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden relative pb-24 md:pb-32 transition-colors duration-200">
      <style dangerouslySetInnerHTML={{ __html: fontFaceStyles }} />

      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 relative z-10">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#1a1d27] p-6 sm:p-8 rounded-[2rem] gap-6 shadow-sm border border-transparent dark:border-[#2e3148]">
          <div className="flex items-center space-x-4 sm:space-x-6 w-full sm:w-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#5B52A3] rounded-full flex items-center justify-center shadow-lg text-white font-bold text-xl sm:text-2xl flex-shrink-0">
              {session?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{session?.name}</h1>
                <div className="flex space-x-1 mt-1 sm:mt-0 flex-shrink-0">
                  {[1,2,3,4,5].map(s => (
                    <TrendingUp key={s} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${s <= (studentInfo?.rating || 5) ? "text-[#5B52A3]" : "text-slate-300 dark:text-slate-600"}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-2 text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="font-medium text-xs sm:text-sm truncate dark:text-slate-400">Roll Number: {session?.roll}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {/* Dark mode toggle */}
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-[#252836] hover:bg-slate-200 dark:hover:bg-[#2e3148] rounded-2xl transition-all text-slate-600 dark:text-slate-300">
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => router.push("/")} className="p-3 bg-slate-100 dark:bg-[#252836] hover:bg-slate-200 dark:hover:bg-[#2e3148] rounded-2xl transition-all text-slate-600 dark:text-slate-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-2xl transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── Global Broadcast Notifications ── */}
        <div className="space-y-4">
          <AnimatePresence>
            {notifications.filter(n => !n.student_id).map(n => (
              <motion.div key={n.id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
                <div className="bg-[#f3e8ff] dark:bg-[#1e1a35] p-6 rounded-[2rem] shadow-sm border border-transparent dark:border-[#2e3148]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="px-3 py-1 bg-white dark:bg-[#252836] rounded-full flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#5B52A3] rounded-full animate-pulse" />
                      <span className="text-xs font-semibold text-[#5B52A3]">Global Broadcast</span>
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-200 leading-snug"
                    style={{ fontFamily: n.school_fonts?.name || "inherit" }}>
                    {n.message}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── Quranic Ayah Warning Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative overflow-hidden rounded-[1.75rem] border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-yellow-50 dark:from-emerald-950/50 dark:to-yellow-950/40 shadow-sm"
        >
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-2 right-4 text-[120px] font-arabic leading-none text-emerald-600 select-none">﷽</div>
          </div>

          <div className="relative z-10 px-6 py-5 sm:px-8 sm:py-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold tracking-wider uppercase mb-4 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Financial Reminder — Quran 17:26–27
            </div>

            {/* Arabic text */}
            <p
              dir="rtl"
              className="text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-200 leading-[2.2] text-right mb-4"
              style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
            >
              وَلَا تُبَذِّرْ تَبْذِيرًا ۝ إِنَّ الْمُبَذِّرِينَ كَانُوا إِخْوَانَ الشَّيَاطِينِ ۖ وَكَانَ الشَّيْطَانُ لِرَبِّهِ كَفُورًا
            </p>

            {/* Malayalam translation */}
            <div className="flex items-start gap-3 bg-white/60 dark:bg-black/20 rounded-2xl px-4 py-3 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="text-emerald-500 text-lg mt-0.5 flex-shrink-0">📖</span>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                നിങ്ങൾ ധൂർത്തടിക്കരുത്; ധൂർത്തടിക്കുന്നവർ പിശാചിന്റെ സഹോദരങ്ങളാണ്. പിശാച് അല്ലാഹുവോട് കടുത്ത നന്ദികെട്ടവനാകുന്നു.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Hero Balance + Stat Cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Balance Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-[#5B52A3] p-8 sm:p-10 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[300px]"
          >
            <div className="absolute top-[-20%] right-[-10%] opacity-5">
              <Wallet className="w-64 h-64 text-white" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-2 text-white/80 font-semibold text-sm bg-white/10 w-max px-4 py-1.5 rounded-full">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Premium Treasury</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-white">
                  ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
                <p className="text-white/70 font-medium text-sm sm:text-base max-w-md">
                  Your active school balance. Funds are securely locked and allocated for academic purposes.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap gap-6 mt-12">
              <button className="bg-white text-[#5B52A3] px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-slate-50 transition-all">
                Add Funds
              </button>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <div className="flex flex-col gap-4 sm:gap-6 justify-between">
            {statCards.map((card, idx) => {
              const Icon = card.Icon;
              return (
                <div key={idx} className="bg-white dark:bg-[#1a1d27] p-5 sm:p-6 rounded-[2rem] shadow-sm flex-1 flex flex-col justify-center border border-transparent dark:border-[#2e3148]">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs font-semibold ${card.color}`}>{card.label}</p>
                    <div className="p-1.5 rounded-full bg-slate-50 dark:bg-[#252836]">
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white pb-2">
                    ₹{card.value.toLocaleString()}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white dark:bg-[#1a1d27] rounded-[2rem] overflow-hidden shadow-sm border border-transparent dark:border-[#2e3148]">
          <div className="p-6 sm:p-8">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Transaction History</h3>
          </div>

          <div className="p-4 sm:p-6 pt-0 space-y-3">
            {transactions.map((tx, idx) => (
              <div
                key={tx.id}
                className={`p-4 sm:p-5 rounded-2xl flex items-center justify-between transition-all gap-4 ${
                  idx % 2 === 0
                    ? "bg-[#f8f9fc] dark:bg-[#252836]"
                    : "bg-[#f3e8ff] dark:bg-[#22203a]"
                }`}
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-[#1a1d27] shadow-sm ${tx.amount > 0 ? "text-emerald-500" : "text-[#5B52A3]"}`}>
                    {tx.amount > 0
                      ? <ArrowDownRight className="w-5 h-5 sm:w-6 sm:h-6" />
                      : <ArrowUpRight   className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 truncate">{tx.description}</h4>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-center">
                  {tx.amount > 0 ? (
                    <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap mb-1">
                      Completed
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#252836] text-[#5B52A3] dark:text-[#7c6fff] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap mb-1 shadow-sm">
                      Deducted
                    </div>
                  )}
                  <div className={`text-lg font-bold whitespace-nowrap ${tx.amount > 0 ? "text-emerald-600" : "text-slate-800 dark:text-slate-300"}`}>
                    {tx.amount > 0 ? "+" : "-"}₹{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="py-12 text-center opacity-60">
                <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-500 font-medium text-sm">No recent transactions found</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
