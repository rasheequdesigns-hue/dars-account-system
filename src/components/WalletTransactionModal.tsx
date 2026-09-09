"use client";

import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  X, Volume2, VolumeX, Check, Minus, User, GraduationCap, Hash,
  Clock, Receipt, UserCog, Banknote, Copy, CheckCircle2, Activity,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type TxType = "add" | "remove";

export interface StudentObj {
  name: string;
  id: string;
  grade: string;
  newBalance: number;
}

export interface TransactionPayload {
  type: TxType;
  amount: number;
  reason: string;
  student: StudentObj;
  officerName?: string;
  referenceId?: string;
  timestamp?: Date;
}

interface WalletModalContextValue {
  open: boolean;
  payload: TransactionPayload | null;
  isMuted: boolean;
  triggerFundAnimation: (
    type: TxType, amount: number, reason: string,
    studentObj: StudentObj, extras?: Partial<TransactionPayload>
  ) => void;
  closeModal: () => void;
  toggleMute: () => void;
  showAudioToast: boolean;
}

const WalletModalContext = createContext<WalletModalContextValue | null>(null);

export function useWalletModal() {
  const ctx = useContext(WalletModalContext);
  if (!ctx) throw new Error("useWalletModal must be used within WalletModalProvider");
  return ctx;
}

/* ─── Web Audio Engine ───────────────────────────────────────────────────── */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private getCtx(): AudioContext {
    if (!this.ctx) {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = W.AudioContext || W.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx as AudioContext;
  }

  playCreditChime() {
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [
        { f: 659.25, t: 0.00, d: 0.18, g: 0.22 },
        { f: 783.99, t: 0.08, d: 0.18, g: 0.20 },
        { f: 987.77, t: 0.16, d: 0.30, g: 0.25 },
        { f: 1318.51, t: 0.24, d: 0.50, g: 0.22 },
      ];
      notes.forEach(({ f, t, d, g }) => this.note(ctx, now + t, f, d, g, "sine", "highpass", 420));
    } catch { /* noop */ }
  }

  playDebitTap() {
    try {
      const ctx = this.getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      this.note(ctx, now, 220.0, 0.09, 0.22, "triangle", "lowpass", 900);
      this.note(ctx, now + 0.16, 196.0, 0.12, 0.20, "triangle", "lowpass", 800);
    } catch { /* noop */ }
  }

  private note(
    ctx: AudioContext, at: number, freq: number, dur: number, gain: number,
    oscType: OscillatorType, filterType: BiquadFilterType, filterF: number
  ) {
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, at);
    filt.type = filterType;
    filt.frequency.value = filterF;
    filt.Q.value = 0.7;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(filt).connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

const audioEngine = new AudioEngine();

/* ─── Utility ─────────────────────────────────────────────────────────────── */
function generateRefId(): string {
  return "TX-" + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase();
}

function formatINR(n: number): string {
  return "₹" + Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/* ─── Animated Balance Counter ──────────────────────────────────────────── */
function BalanceCounter({
  value, duration = 1200, type,
}: { value: number; duration?: number; type: TxType }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={type === "add" ? "text-emerald-400" : "text-amber-400"}>
      {formatINR(display)}
    </span>
  );
}

/* ─── SVG Check / Minus Draw ─────────────────────────────────────────────── */
function AnimatedBadge({ type }: { type: TxType }) {
  const stroke = type === "add" ? "#34D399" : "#F59E0B";
  const aura = type === "add" ? "rgba(52,211,153,0.50)" : "rgba(245,158,11,0.50)";
  return (
    <div className="relative mx-auto mb-5 w-32 h-32 md:w-36 md:h-36 flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${aura} 0%, transparent 70%)` }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0.7, 1], scale: [0.5, 1.3, 0.95, 1.05] }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      <motion.svg
        className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.25" />
        <motion.circle
          cx="50" cy="50" r="46" fill="none" stroke={stroke} strokeWidth="2"
          strokeDasharray="289" strokeDashoffset="289"
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.85, ease: "easeOut", delay: 0.15 }}
        />
      </motion.svg>
      <motion.div
        className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center backdrop-blur-sm"
        style={{
          background: type === "add"
            ? "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(6,95,70,0.22))"
            : "linear-gradient(135deg, rgba(245,158,11,0.28), rgba(146,64,14,0.22))",
          boxShadow: `0 0 60px -8px ${aura}, inset 0 0 32px ${aura}`,
          border: `1.5px solid ${stroke}66`,
        }}
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 16, mass: 0.8, delay: 0.1 }}
      >
        {type === "add" ? (
          <svg className="w-11 h-11 md:w-12 md:h-12" viewBox="0 0 48 48" fill="none">
            <motion.path
              d="M10 26 L20 36 L38 16" stroke={stroke} strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.35 }}
            />
            <motion.path
              d="M10 26 L20 36 L38 16" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.4 }}
            />
          </svg>
        ) : (
          <svg className="w-11 h-11 md:w-12 md:h-12" viewBox="0 0 48 48" fill="none">
            <motion.line x1="11" y1="24" x2="37" y2="24" stroke={stroke} strokeWidth="5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
            />
            <motion.line x1="11" y1="24" x2="37" y2="24" stroke="white" strokeOpacity="0.4" strokeWidth="2.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.35 }}
            />
          </svg>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Confetti Particle Burst (Credit) ───────────────────────────────────── */
interface ParticleSpec { x: number; y: number; dx: number; dy: number; size: number; color: string; rot: number; rotSpd: number; shape: "square" | "circle" | "triangle"; }

function generateParticles(count: number): ParticleSpec[] {
  const colors = ["#34D399", "#10B981", "#6EE7B7", "#059669", "#A7F3D0", "#FACC15", "#60A5FA"];
  const shapes: ParticleSpec["shape"][] = ["square", "circle", "triangle"];
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const power = rand(100, 340);
    return {
      x: 0, y: 0,
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power - 80,
      size: rand(5, 13),
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpd: rand(-540, 540),
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    };
  });
}

function ConfettiBurst({ active, count = 60, seed }: { active: boolean; count?: number; seed?: number }) {
  const [particles] = useState<ParticleSpec[]>(() => generateParticles(count));
  void seed;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-30">
      <div className="absolute left-1/2 top-[22%] md:top-[20%] -translate-x-1/2 -translate-y-1/2 w-0 h-0">
        <AnimatePresence>
          {active && particles.map((p, i) => (
            <motion.div
              key={i}
              style={{
                width: p.size, height: p.size, background: p.color,
                position: "absolute", top: 0, left: 0,
                borderRadius: p.shape === "circle" ? "9999px" : p.shape === "triangle" ? "2px" : "1px",
                clipPath: p.shape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                boxShadow: `0 0 10px ${p.color}aa`,
              }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: p.rot, scale: 0 }}
              animate={{
                x: p.dx,
                y: [0, p.dy * 0.55, p.dy, p.dy + 260],
                opacity: [0, 1, 1, 0],
                scale: [0, 1.1, 1, 0.3],
                rotate: p.rot + p.rotSpd,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.003 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Receipt Grid Cell (replaces InfoRow for responsive grids) ──────────── */
function ReceiptCell({
  icon: Icon, label, value, delay, copyable,
}: {
  icon: LucideIcon; label: string; value: string; delay: number; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!copyable) return;
    try { await navigator.clipboard.writeText(value); setCopied(true); } catch { /* noop */ }
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay }}
      className="group relative rounded-2xl p-4 md:p-5 h-full
        bg-white/[0.03] border border-white/10
        hover:bg-white/[0.06] hover:border-white/20
        transition-all backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10
            flex items-center justify-center text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">
            {label}
          </p>
        </div>
        {copyable && (
          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400
              hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
            aria-label={`Copy ${label}`}
          >
            {copied
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
      <p className="text-sm md:text-base font-semibold text-slate-100 break-words leading-snug">
        {value}
      </p>
    </motion.div>
  );
}

/* ─── Audio Toast ─────────────────────────────────────────────────────────── */
function AudioToast({
  type, show, onMuteToggle, isMuted, onClose,
}: {
  type: TxType; show: boolean; onMuteToggle: () => void; isMuted: boolean; onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80]
            px-4 py-2.5 rounded-2xl backdrop-blur-xl
            bg-slate-900/90 border border-white/10 shadow-2xl
            flex items-center gap-3 text-sm"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
            type === "add" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
          }`}>
            {type === "add" ? <Check className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </div>
          <span className="text-slate-200 font-medium">
            {isMuted ? "Sound muted" : type === "add" ? "Credit chime played" : "Debit tone played"}
          </span>
          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={onMuteToggle}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-200"
            aria-label="Close audio indicator"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Full-Screen Overlay Shell ─────────────────────────────────────────── */
function TransactionModal({
  open, payload, onClose, isMuted, toggleMute, showAudioToast, hideAudioToast,
}: {
  open: boolean;
  payload: TransactionPayload | null;
  onClose: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  showAudioToast: boolean;
  hideAudioToast: () => void;
}) {
  if (!payload) return null;
  const { type, amount, reason, student, officerName, referenceId, timestamp } = payload;
  const ts = timestamp || new Date();
  const ref = referenceId || generateRefId();
  const officer = officerName || "Admin Officer";
  const sign = type === "add" ? "+" : "−";

  const themeColors = type === "add"
    ? {
        accent: "#34D399", accentDim: "rgba(52,211,153,0.14)",
        accentBrd: "rgba(52,211,153,0.35)", headline: "text-emerald-400",
        chipBg: "bg-emerald-500/15", chipBrd: "border-emerald-500/30", chipText: "text-emerald-400",
        chipIconBg: "bg-emerald-500/20", chipIconText: "text-emerald-300",
        tagBg: "bg-emerald-500/20", tagText: "text-emerald-300",
      }
    : {
        accent: "#F59E0B", accentDim: "rgba(245,158,11,0.14)",
        accentBrd: "rgba(245,158,11,0.35)", headline: "text-amber-400",
        chipBg: "bg-amber-500/15", chipBrd: "border-amber-500/30", chipText: "text-amber-400",
        chipIconBg: "bg-amber-500/20", chipIconText: "text-amber-300",
        tagBg: "bg-amber-500/20", tagText: "text-amber-300",
      };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 w-screen h-screen z-[60] bg-slate-950 flex flex-col justify-between overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              backgroundImage: `
                radial-gradient(1200px 600px at 50% -10%, ${themeColors.accent}22 0%, transparent 60%),
                radial-gradient(900px 500px at 85% 110%, ${themeColors.accent}18 0%, transparent 60%),
                linear-gradient(160deg, #0b1020 0%, #070a16 40%, #05070f 100%)
              `,
            }}
          >
            {/* Decorative full-screen grid */}
            <div
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            {/* Top accent gradient bar */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] z-20"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${themeColors.accent} 30%, ${themeColors.accent} 70%, transparent 100%)`,
                opacity: 0.75,
              }}
            />

            <ConfettiBurst key={`${ref}-${ts.getTime()}`} active={type === "add"} seed={ts.getTime()} count={70} />

            {/* ═══ FIXED TOP HEADER ═══ */}
            <motion.header
              className="relative z-20 flex-shrink-0 border-b border-white/10
                bg-slate-950/60 backdrop-blur-2xl
                px-4 sm:px-6 md:px-10 lg:px-16 py-3 md:py-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
            >
              <div className="flex items-center justify-between max-w-6xl mx-auto">
                {/* Status badge */}
                <div className={`inline-flex items-center gap-2.5 px-3.5 md:px-4 py-2 rounded-full border ${themeColors.chipBrd} ${themeColors.chipBg}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${themeColors.chipIconBg}`}>
                    {type === "add"
                      ? <Check className={`w-3 h-3 ${themeColors.chipIconText}`} />
                      : <Minus className={`w-3 h-3 ${themeColors.chipIconText}`} />}
                  </div>
                  <span className={`text-[10px] md:text-[11px] font-black uppercase tracking-[0.18em] ${themeColors.chipText}`}>
                    {type === "add" ? "Funds Added" : "Funds Deducted"}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl border border-white/10
                      bg-white/5 text-slate-400 hover:text-slate-200
                      hover:bg-white/10 flex items-center justify-center transition-all"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 md:w-[18px] md:h-[18px]" /> : <Volume2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />}
                  </button>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl border border-white/10
                      bg-white/5 text-slate-400 hover:text-slate-200
                      hover:bg-white/10 flex items-center justify-center transition-all"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>
            </motion.header>

            {/* ═══ CENTERED CONTENT AREA (scrollable on small screens) ═══ */}
            <div className="relative z-10 flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 py-6 md:py-10 lg:py-12">

                {/* ─── Hero: Badge + Headline + Amount ─── */}
                <div className="relative z-10 text-center">
                  <AnimatedBadge type={type} />

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                    className="mb-3 md:mb-4"
                  >
                    <h2 className={`text-2xl md:text-4xl lg:text-5xl font-black tracking-tight mb-1.5 ${themeColors.headline}`}>
                      {type === "add" ? "Wallet Credited" : "Wallet Debited"}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 font-medium tracking-wide">
                      Campus ID Pay Card • Transaction Confirmed
                    </p>
                  </motion.div>

                  {/* Big Amount */}
                  <motion.div
                    className="flex items-center justify-center gap-3 mb-5 md:mb-7"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.45 }}
                  >
                    <span className={`text-4xl md:text-6xl lg:text-7xl font-black ${themeColors.headline}`}>
                      {sign}
                    </span>
                    <span
                      className={`text-5xl md:text-7xl lg:text-8xl font-black tracking-tight ${themeColors.headline}`}
                      style={{ textShadow: `0 0 40px ${themeColors.accent}55` }}
                    >
                      {formatINR(amount)}
                    </span>
                  </motion.div>

                  {/* Reason tag */}
                  <motion.div
                    className="flex justify-center mb-8 md:mb-10"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.4 }}
                  >
                    <div className={`px-4 md:px-5 py-2 rounded-full inline-flex items-center gap-2 ${themeColors.tagBg} ${themeColors.tagText} text-xs md:text-sm font-bold`}>
                      <Receipt className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      {reason || "General Wallet Adjustment"}
                    </div>
                  </motion.div>
                </div>

                {/* ─── Student ID Card ─── */}
                <motion.div
                  className="mb-7 md:mb-10 max-w-3xl mx-auto"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.62, duration: 0.5 }}
                >
                  <div
                    className="relative rounded-2xl md:rounded-3xl border border-white/10 overflow-hidden p-4 md:p-6"
                    style={{
                      background: `
                        linear-gradient(135deg, ${themeColors.accent}12 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.25) 100%)
                      `,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px -20px ${themeColors.accent}22`,
                    }}
                  >
                    {/* Corner decorative halo */}
                    <div
                      className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl opacity-60 pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${themeColors.accent}3a 0%, transparent 70%)` }}
                    />
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                      {/* Avatar */}
                      <div
                        className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center font-black text-2xl md:text-3xl flex-shrink-0 mx-auto sm:mx-0"
                        style={{
                          background: type === "add"
                            ? "linear-gradient(135deg, #059669, #064e3b)"
                            : "linear-gradient(135deg, #b45309, #78350f)",
                          boxShadow: `0 8px 30px -6px ${themeColors.accent}80`,
                          color: "white",
                        }}
                      >
                        {student.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      {/* Name + meta */}
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <motion.p
                          className="font-extrabold text-slate-100 truncate text-lg md:text-2xl tracking-tight"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.68 }}
                        >
                          {student.name}
                        </motion.p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-1.5 md:mt-2 text-[11px] md:text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="w-3 h-3 md:w-3.5 md:h-3.5" /> {student.grade || "—"}
                          </span>
                          <span className="text-white/10 hidden sm:inline">•</span>
                          <span className="flex items-center gap-1.5">
                            <Hash className="w-3 h-3 md:w-3.5 md:h-3.5" /> {student.id || "—"}
                          </span>
                        </div>
                      </div>
                      {/* Live Balance */}
                      <div className="text-center sm:text-right flex-shrink-0 mx-auto sm:mx-0">
                        <p className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] font-extrabold text-slate-500 mb-1">
                          Live Wallet Balance
                        </p>
                        <p className="text-xl md:text-3xl font-black leading-none">
                          <BalanceCounter value={student.newBalance} type={type} />
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ─── Transaction Receipt Header ─── */}
                <motion.div
                  className="flex items-center justify-between gap-3 mb-4 md:mb-6 max-w-3xl mx-auto"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.72, duration: 0.4 }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: themeColors.accentDim, color: themeColors.accent }}
                    >
                      <Banknote className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-lg font-extrabold text-slate-100 tracking-tight">
                        Transaction Receipt
                      </h3>
                      <p className="text-[10px] md:text-xs text-slate-500 font-medium">
                        All transaction details • verified by the system
                      </p>
                    </div>
                  </div>
                  {/* Ticket stub perforation indicator (desktop) */}
                  <div className="hidden md:flex h-5 w-10 relative items-center justify-center">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-950 border-r border-white/10" />
                    <div className="w-0.5 h-full" style={{
                      background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.2) 0 3px, transparent 3px 7px)",
                    }} />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-950 border-l border-white/10" />
                  </div>
                </motion.div>

                {/* ─── Receipt Grid: Responsive 1/3 column ─── */}
                <motion.div
                  className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.78, duration: 0.3 }}
                >
                  <ReceiptCell icon={User} label="Student Name" value={student.name} delay={0.82} />
                  <ReceiptCell icon={GraduationCap} label="Grade / Class" value={student.grade || "N/A"} delay={0.86} />
                  <ReceiptCell icon={Hash} label="Student ID" value={student.id || "N/A"} delay={0.90} />

                  <ReceiptCell icon={Receipt} label="Amount" value={`${sign} ${formatINR(amount)}`} delay={0.96} />
                  <ReceiptCell icon={Activity} label="Category" value={reason || "General"} delay={1.00} />
                  <ReceiptCell icon={Clock} label="Time" value={formatTime(ts)} delay={1.04} />

                  <ReceiptCell icon={UserCog} label="Admin Officer" value={officer} delay={1.10} />
                  <ReceiptCell icon={Hash} label="Reference ID" value={ref} delay={1.14} copyable />
                  <ReceiptCell
                    icon={Banknote}
                    label="New Balance"
                    value={formatINR(student.newBalance)}
                    delay={1.18}
                  />
                </motion.div>

                {/* ─── Bottom spacer for mobile so content clears sticky footer ─── */}
                <div className="h-28 md:h-0 mt-8 md:mt-10" />
              </div>
            </div>

            {/* ═══ STICKY BOTTOM ACTION FOOTER ═══ */}
            <motion.footer
              className="relative z-20 flex-shrink-0 border-t border-white/10
                bg-slate-950/70 backdrop-blur-2xl
                px-4 sm:px-6 md:px-10 lg:px-16 py-4 md:py-5"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.5, ease: "easeOut" }}
            >
              {/* Accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${themeColors.accent}40 30%, ${themeColors.accent}40 70%, transparent 100%)`,
                }}
              />
              <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <button
                  onClick={onClose}
                  className="py-3.5 md:py-4 rounded-xl md:rounded-2xl
                    border border-white/12 bg-white/[0.04]
                    text-slate-200 hover:text-white
                    hover:bg-white/[0.08] hover:border-white/20
                    transition-all font-bold text-sm md:text-base
                    flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                  Close
                </button>
                <button
                  onClick={async () => {
                    try {
                      const txt =
`Transaction Receipt — ${ref}
Student: ${student.name} (${student.id})
Class: ${student.grade}
Amount: ${sign} ${formatINR(amount)}
Reason: ${reason || "General"}
Officer: ${officer}
Time: ${ts.toLocaleString()}
New Balance: ${formatINR(student.newBalance)}`;
                      await navigator.clipboard.writeText(txt);
                    } catch { /* noop */ }
                  }}
                  className="py-3.5 md:py-4 rounded-xl md:rounded-2xl
                    font-black text-sm md:text-base text-slate-950
                    hover:brightness-110 active:brightness-95 transition-all
                    flex items-center justify-center gap-2.5"
                  style={{
                    background: type === "add"
                      ? "linear-gradient(135deg, #6EE7B7 0%, #34D399 50%, #10B981 100%)"
                      : "linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)",
                    boxShadow: `0 10px 30px -8px ${themeColors.accent}99, inset 0 1px 0 rgba(255,255,255,0.4)`,
                  }}
                >
                  <Copy className="w-4 h-4 md:w-5 md:h-5" />
                  Copy Receipt
                </button>
              </div>
            </motion.footer>
          </motion.div>
        )}
      </AnimatePresence>

      <AudioToast
        type={type}
        show={showAudioToast}
        onMuteToggle={toggleMute}
        isMuted={isMuted}
        onClose={hideAudioToast}
      />
    </>
  );
}

/* ─── Provider ────────────────────────────────────────────────────────────── */
export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<TransactionPayload | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("wallet_muted") === "1"; } catch { return false; }
  });
  const [showAudioToast, setShowAudioToast] = useState(false);
  const audioToastTimer = useRef<number | null>(null);

  const triggerFundAnimation: WalletModalContextValue["triggerFundAnimation"] = useCallback(
    (type, amount, reason, studentObj, extras) => {
      const p: TransactionPayload = {
        type,
        amount: Math.abs(amount),
        reason,
        student: studentObj,
        officerName: extras?.officerName,
        referenceId: extras?.referenceId || generateRefId(),
        timestamp: extras?.timestamp || new Date(),
      };
      setPayload(p);
      setOpen(true);
      if (!isMuted) {
        setTimeout(() => {
          if (type === "add") audioEngine.playCreditChime();
          else audioEngine.playDebitTap();
        }, 280);
      }
      setShowAudioToast(true);
      if (audioToastTimer.current) window.clearTimeout(audioToastTimer.current);
      audioToastTimer.current = window.setTimeout(() => setShowAudioToast(false), 3200);
    },
    [isMuted]
  );

  const closeModal = useCallback(() => setOpen(false), []);
  const hideAudioToast = useCallback(() => setShowAudioToast(false), []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try { localStorage.setItem("wallet_muted", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }, []);

  const value = useMemo<WalletModalContextValue>(() => ({
    open, payload, isMuted, triggerFundAnimation, closeModal, toggleMute, showAudioToast,
  }), [open, payload, isMuted, triggerFundAnimation, closeModal, toggleMute, showAudioToast]);

  return (
    <WalletModalContext.Provider value={value}>
      {children}
      <TransactionModal
        open={open}
        payload={payload}
        onClose={closeModal}
        isMuted={isMuted}
        toggleMute={toggleMute}
        showAudioToast={showAudioToast}
        hideAudioToast={hideAudioToast}
      />
    </WalletModalContext.Provider>
  );
}
