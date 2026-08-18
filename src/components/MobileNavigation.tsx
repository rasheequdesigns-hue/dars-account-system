"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark, Vault, GraduationCap, ClipboardList, UserCog,
  MoreHorizontal, LogOut, Bell, ShieldCheck, X, Zap, Home, Moon, Sun
} from "lucide-react";import { getSession, clearSession } from "@/lib/session";
import { useTheme } from "@/components/ThemeProvider";

// ── Admin navigation items ────────────────────────────────────────────────────
const adminMainItems = [
  { id: "funds",        label: "Funds",     icon: Landmark,      path: "/admin?tab=funds" },
  { id: "finances",     label: "Vault",     icon: Vault,         path: "/admin?tab=finances" },
  { id: "students",     label: "Personnel", icon: GraduationCap, path: "/admin?tab=students" },
  { id: "transactions", label: "History",   icon: ClipboardList, path: "/admin?tab=transactions" },
];

const adminMoreItems = [
  { id: "broadcast",    label: "Notifications",     icon: Bell,        path: "/admin?tab=broadcast" },
  { id: "active-users", label: "Active Users",      icon: UserCog,     path: "/admin?tab=active-users" },
  { id: "security",     label: "Security Protocol", icon: ShieldCheck, path: "/admin?showSecurity=true" },
];

// ── Student navigation items ──────────────────────────────────────────────────
// (student nav is rendered inline, no separate items array needed)

export default function MobileNavigation() {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [session,     setSession]     = useState<any>(null);
  const [isMoreOpen,  setIsMoreOpen]  = useState(false);
  const [isMounted,   setIsMounted]   = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setSession(getSession());
  }, [pathname]); // re-read on route change so it stays in sync

  // Don't render anything on the login page or before hydration
  if (!isMounted || pathname === "/") return null;

  const role = session?.role ?? null;

  // If no session at all, render nothing
  if (!role) return null;

  const getActiveTab = () => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("tab") || "";
  };

  const isAdminTabActive = (path: string) => {
    const tab = path.split("?tab=")[1];
    return tab ? getActiveTab() === tab : false;
  };

  const handleNav = (path: string) => {
    setIsMoreOpen(false);
    if (path === "/admin?showSecurity=true") {
      localStorage.setItem("openSecurityModal", "true");
    }
    router.push(path);
  };

  const handleLogout = () => {
    clearSession();
    setIsMoreOpen(false);
    router.push("/");
  };

  // ────────────────────────────────────────────────────────────────────────────
  // STUDENT NAV — minimal bottom bar
  // ────────────────────────────────────────────────────────────────────────────
  if (role === "student-account") {
    return (
      <>
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-[#5A45FF]/20 to-transparent" />
          <div className="bg-white/95 dark:bg-[#1a1d27]/95 backdrop-blur-xl border-t border-[#E8E5FF] dark:border-[#2e3148]">
            <div className="flex items-center justify-around px-4 py-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.push("/student/account")} className="relative flex flex-col items-center justify-center py-2 px-5 rounded-2xl flex-1 gap-1">
                <div className="absolute inset-0 bg-[#E8E5FF] dark:bg-[#2a2640] rounded-2xl" />
                <Home className="w-5 h-5 text-[#5A45FF] relative z-10" strokeWidth={2} />
                <span className="text-[10px] font-semibold text-[#5A45FF] relative z-10">My Account</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleTheme} className="flex flex-col items-center justify-center py-2 px-5 rounded-2xl flex-1 gap-1 text-slate-400 dark:text-slate-500 transition-colors">
                {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" strokeWidth={1.8} /> : <Moon className="w-5 h-5" strokeWidth={1.8} />}
                <span className="text-[10px] font-semibold">{theme === "dark" ? "Light" : "Dark"}</span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleLogout} className="flex flex-col items-center justify-center py-2 px-5 rounded-2xl flex-1 gap-1 text-slate-400 hover:text-rose-500 transition-colors">
                <LogOut className="w-5 h-5" strokeWidth={1.8} />
                <span className="text-[10px] font-semibold">Sign Out</span>
              </motion.button>
            </div>
          </div>
        </nav>
        <div className="h-16 md:hidden" />
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN NAV — full bottom nav with More sheet
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-[#5A45FF]/30 to-transparent" />
        <div className="bg-white/95 dark:bg-[#1a1d27]/95 backdrop-blur-xl border-t border-[#E8E5FF] dark:border-[#2e3148]">
          <div className="flex items-center justify-around px-2 py-2">

            {adminMainItems.map(item => {
              const Icon   = item.icon;
              const active = isAdminTabActive(item.path);
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  whileTap={{ scale: 0.9 }}
                  className="relative flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all flex-1 gap-1"
                >
                  {active && (
                    <motion.div
                      layoutId="admin-nav-bg"
                      className="absolute inset-0 bg-[#E8E5FF] rounded-2xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <Icon
                    className={`w-5 h-5 relative z-10 transition-all duration-200 ${active ? "text-[#5A45FF]" : "text-slate-400"}`}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span className={`text-[10px] font-semibold relative z-10 transition-colors ${active ? "text-[#5A45FF]" : "text-slate-400"}`}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="admin-nav-dot"
                      className="absolute -bottom-0.5 w-1 h-1 bg-[#5A45FF] rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </motion.button>
              );
            })}

            {/* More */}
            <motion.button
              onClick={() => setIsMoreOpen(true)}
              whileTap={{ scale: 0.9 }}
              className="relative flex flex-col items-center justify-center py-2 px-3 rounded-2xl flex-1 gap-1"
            >
              <MoreHorizontal className="w-5 h-5 text-slate-400" strokeWidth={1.8} />
              <span className="text-[10px] font-semibold text-slate-400">More</span>
            </motion.button>

          </div>
        </div>
      </nav>

      {/* More Sheet */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[70] md:hidden bg-white dark:bg-[#1a1d27] rounded-t-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-[#E8E5FF] dark:bg-[#2e3148] rounded-full" />
              </div>
              <div className="px-6 pt-3 pb-4 flex items-center justify-between border-b border-[#E8E5FF] dark:border-[#2e3148]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#5A45FF] to-[#6C5CE7] flex items-center justify-center">
                    <span className="text-white font-bold text-xs">SM</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">More Options</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-medium text-slate-500">System Active</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsMoreOpen(false)} className="p-2 rounded-xl bg-[#F0F2F9] hover:bg-[#E8E5FF] transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Items */}
              <div className="p-4 space-y-2">
                {adminMoreItems.map(item => {
                  const Icon   = item.icon;
                  const active = isAdminTabActive(item.path);
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => handleNav(item.path)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all text-left ${
                        active ? "bg-[#E8E5FF] text-[#5A45FF]" : "bg-[#F0F2F9] text-slate-700 hover:bg-[#E8E5FF] hover:text-[#5A45FF]"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        active ? "bg-[#5A45FF] shadow-[0_4px_12px_rgba(90,69,255,0.3)]" : "bg-white border border-[#E8E5FF]"
                      }`}>
                        <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#5A45FF]"}`} />
                      </div>
                      <span className="font-semibold text-sm">{item.label}</span>
                      {active && <Zap className="w-3.5 h-3.5 text-[#5A45FF] ml-auto" />}
                    </motion.button>
                  );
                })}

                <div className="py-1"><div className="h-px bg-[#E8E5FF]" /></div>

                {/* Logout */}
                <motion.button
                  onClick={handleLogout}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-semibold text-sm">Sign Out</span>
                </motion.button>
              </div>

              <div className="h-6" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Content spacer */}
      <div className="h-16 md:hidden" />
    </>
  );
}
