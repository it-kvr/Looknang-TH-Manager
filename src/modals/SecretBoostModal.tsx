import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Eye, EyeOff, FastForward, Fingerprint, Lock, ScanLine, ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';
import type { AppSettings, GameState } from '../types/game';
import { fmtMoney } from '../utils/math';
import { SFX, snd, vibrate } from '../utils/audioTheme';
import { ovMe } from '../engine/playerCore';
import { TalentBadge } from '../components/TalentBadge';
import { AnimatedMoney } from '../components/AnimatedMoney';
import {
  applySecretBoost,
  applySecretMoneyAdjust,
  applySecretPlayerBoost,
  applySecretRepAdjust
} from '../engine/blessings';

const VIP_PASSCODE = '1150';

type ScannerStatus = 'idle' | 'scanning' | 'denied' | 'granted';

const VipOfficeScannerGate: React.FC<{
  onUnlock: () => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}> = ({ onUnlock, onClose, onToast }) => {
  const [pin, setPin] = useState('');
  const [showDigits, setShowDigits] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const verifyCode = useCallback(
    (code: string) => {
      if (status === 'scanning' || status === 'granted') return;
      if (code.length < 4) {
        snd(300, 0.08, 'sawtooth', 0.03);
        vibrate(25);
        setStatus('denied');
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setStatus('idle');
        }, 550);
        return;
      }

      setStatus('scanning');
      snd(920, 0.06, 'sine', 0.035);

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (code === VIP_PASSCODE) {
          setStatus('granted');
          snd(1318.5, 0.08, 'sine', 0.045, 0);
          snd(1760, 0.14, 'sine', 0.05, 0.08);
          SFX.win();
          vibrate(35);
          timerRef.current = window.setTimeout(() => {
            onToast('🔓 สแกนเข้าออฟฟิศ VIP สำเร็จ! ปลดล็อกสิทธิ์ผู้ดูแลแล้ว');
            onUnlock();
          }, 420);
        } else {
          setStatus('denied');
          setAttempts((n) => n + 1);
          snd(220, 0.11, 'sawtooth', 0.038, 0);
          snd(175, 0.16, 'sawtooth', 0.038, 0.12);
          vibrate([30, 40, 30]);
          timerRef.current = window.setTimeout(() => {
            setPin('');
            setStatus('idle');
          }, 680);
        }
      }, 280);
    },
    [onToast, onUnlock, status]
  );

  const pushDigit = useCallback(
    (digit: string) => {
      if (status === 'scanning' || status === 'granted') return;
      if (status === 'denied') setStatus('idle');
      setPin((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + digit;
        snd(1180 + Number(digit) * 28, 0.045, 'sine', 0.04);
        vibrate(10);
        if (next.length === 4) {
          window.setTimeout(() => verifyCode(next), 90);
        }
        return next;
      });
    },
    [status, verifyCode]
  );

  const handleBackspace = useCallback(() => {
    if (status === 'scanning' || status === 'granted') return;
    if (status === 'denied') setStatus('idle');
    snd(620, 0.045, 'triangle', 0.03);
    setPin((prev) => prev.slice(0, -1));
  }, [status]);

  const handleClear = useCallback(() => {
    if (status === 'scanning' || status === 'granted') return;
    snd(520, 0.055, 'triangle', 0.03);
    setPin('');
    setStatus('idle');
  }, [status]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        verifyCode(pin);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackspace, handleClear, onClose, pin, pushDigit, verifyCode]);

  const statusMeta = {
    idle: {
      dotCls: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
      badgeCls: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
      label: 'LOCKED · รอสแกนรหัสพนักงาน VIP',
      sub: 'กรอกรหัสผ่าน 4 หลักเพื่อเปิดประตูเข้าสู่ออฟฟิศปรับแต่งค่า'
    },
    scanning: {
      dotCls: 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.95)] animate-pulse',
      badgeCls: 'bg-sky-500/20 border-sky-400/50 text-sky-300',
      label: 'SCANNING · กำลังตรวจสอบสิทธิ์...',
      sub: 'กำลังอ่านข้อมูลบัตรพนักงานและรหัสผ่าน...'
    },
    denied: {
      dotCls: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.95)] animate-ping',
      badgeCls: 'bg-rose-500/20 border-rose-500/60 text-rose-300',
      label: `ACCESS DENIED · รหัสผ่านไม่ถูกต้อง${attempts > 1 ? ` (${attempts})` : ''}`,
      sub: 'ไม่ได้รับอนุญาตเข้าสู่ออฟฟิศ กรุณาลองใหม่อีกครั้ง'
    },
    granted: {
      dotCls: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.95)]',
      badgeCls: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300',
      label: 'ACCESS GRANTED · อนุญาตเข้าออฟฟิศ VIP',
      sub: 'ประตูออฟฟิศเปิดแล้ว กำลังเข้าสู่แผงควบคุม...'
    }
  }[status];

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9']
  ];

  return (
    <div className="fixed inset-0 z-[65] bg-black/80 flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div
        className={`w-full max-w-[600px] mland:max-w-[580px] max-h-[calc(var(--app-dvh,1dvh)*94)] rounded-3xl mland:rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-[#050b08] text-slate-100 border border-slate-700/80 shadow-[0_24px_70px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden ${
          status === 'denied' ? 'office-pin-shake' : ''
        }`}
      >
        {/* Terminal Top Bezel */}
        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusMeta.dotCls}`} />
            <div className="min-w-0">
              <div className="text-[11px] mland:text-[10px] font-extrabold tracking-wider uppercase text-slate-200 flex items-center gap-1.5 truncate">
                <ScanLine className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>OFFICE ACCESS TERMINAL · VIP GATE</span>
              </div>
              <div className="text-[9.5px] mland:text-[8.5px] text-slate-400 truncate">
                เครื่องสแกนเข้าออฟฟิศทำงาน · ระบบรักษาความปลอดภัย
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onClose();
            }}
            aria-label="ปิดเครื่องสแกน"
            className="w-8 h-8 mland:w-6 mland:h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scanner Body: Dual-Panel Hardware Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2.5 grid grid-cols-1 sm:grid-cols-[1fr_228px] mland:grid-cols-[1fr_214px] gap-3.5 mland:gap-2.5 items-stretch">
          {/* Left Panel: RFID / Biometric Sensor & Digital PIN Display */}
          <div className="flex flex-col justify-between gap-2.5 mland:gap-1.5 p-3 mland:p-2 rounded-2xl bg-slate-900/80 border border-slate-800">
            {/* Status Pill */}
            <div className={`px-2.5 py-1.5 mland:py-1 rounded-xl border text-[10.5px] mland:text-[9.5px] font-bold flex items-center gap-1.5 ${statusMeta.badgeCls}`}>
              {status === 'granted' ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : status === 'denied' ? (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              ) : (
                <Lock className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{statusMeta.label}</span>
            </div>

            {/* Scanner Optical Pad */}
            <div className="relative h-24 mland:h-[72px] rounded-xl bg-gradient-to-b from-[#07130e] to-[#040a07] border border-emerald-500/30 overflow-hidden flex items-center justify-center">
              {/* Subtle corner brackets like real optical door reader */}
              <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400/60 rounded-tl-sm" />
              <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400/60 rounded-tr-sm" />
              <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400/60 rounded-bl-sm" />
              <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400/60 rounded-br-sm" />

              {/* Moving Laser Scan Beam */}
              <div
                className={`office-scan-beam absolute left-3 right-3 h-0.5 rounded-full pointer-events-none ${
                  status === 'denied'
                    ? 'bg-rose-400 shadow-[0_0_12px_2px_rgba(244,63,94,0.85)]'
                    : status === 'granted'
                      ? 'bg-emerald-300 shadow-[0_0_14px_3px_rgba(52,211,153,0.95)]'
                      : 'bg-emerald-400/80 shadow-[0_0_10px_2px_rgba(16,185,129,0.7)]'
                }`}
              />

              <div className="flex flex-col items-center gap-1 z-10">
                <Fingerprint
                  className={`w-10 h-10 mland:w-8 mland:h-8 transition-colors ${
                    status === 'denied'
                      ? 'text-rose-400'
                      : status === 'granted'
                        ? 'text-emerald-300'
                        : status === 'scanning'
                          ? 'text-sky-300'
                          : 'text-emerald-400/80'
                  }`}
                />
                <span className="text-[9.5px] mland:text-[8.5px] font-mono tracking-widest uppercase text-emerald-300/75">
                  {status === 'granted' ? 'DOOR UNLOCKED' : status === 'scanning' ? 'VERIFYING...' : 'RFID / PIN READER'}
                </span>
              </div>
            </div>

            {/* 4-Digit Digital LCD Screen */}
            <div className="space-y-1.5 mland:space-y-1">
              <div className="flex items-center justify-between text-[10px] mland:text-[9px] text-slate-400">
                <span className="font-semibold">รหัสพนักงานเข้าออฟฟิศ (4 หลัก)</span>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setShowDigits((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  {showDigits ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showDigits ? 'ซ่อน' : 'แสดง'}</span>
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mland:gap-1.5">
                {[0, 1, 2, 3].map((idx) => {
                  const char = pin[idx] || '';
                  const isActive = idx === pin.length && status !== 'granted';
                  return (
                    <div
                      key={idx}
                      className={`h-12 mland:h-9 rounded-xl border-2 flex items-center justify-center font-mono text-xl mland:text-base font-extrabold transition-all ${
                        status === 'denied'
                          ? 'bg-rose-950/50 border-rose-500/80 text-rose-300'
                          : status === 'granted'
                            ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                            : char
                              ? 'bg-slate-950 border-emerald-400/70 text-emerald-300 shadow-[inset_0_0_12px_rgba(16,185,129,0.12)]'
                              : isActive
                                ? 'bg-slate-950 border-amber-400/75 text-amber-300'
                                : 'bg-slate-950/70 border-slate-700/80 text-slate-600'
                      }`}
                    >
                      {char ? (showDigits ? char : '●') : isActive ? '_' : '·'}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] mland:text-[8.5px] text-slate-400 leading-snug">
                {statusMeta.sub}
              </div>
            </div>
          </div>

          {/* Right Panel: Physical Stainless Keypad */}
          <div className="flex flex-col justify-between gap-2 mland:gap-1.5 p-3 mland:p-2 rounded-2xl bg-slate-900/95 border border-slate-800">
            <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
              {keypadRows.flat().map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={status === 'scanning' || status === 'granted'}
                  onClick={() => pushDigit(digit)}
                  className="h-11 mland:h-8 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 active:scale-95 border border-slate-700/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-base mland:text-sm font-extrabold font-mono text-slate-100 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={handleClear}
                title="ล้างรหัส"
                className="h-11 mland:h-8 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 active:scale-95 border border-rose-500/40 text-xs mland:text-[11px] font-extrabold text-rose-300 cursor-pointer disabled:opacity-50 transition-all"
              >
                ล้าง
              </button>
              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={() => pushDigit('0')}
                className="h-11 mland:h-8 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 active:scale-95 border border-slate-700/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-base mland:text-sm font-extrabold font-mono text-slate-100 cursor-pointer disabled:opacity-50 transition-all"
              >
                0
              </button>
              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={handleBackspace}
                aria-label="ลบตัวเลข"
                title="ลบตัวเลขล่าสุด"
                className="h-11 mland:h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-50 transition-all"
              >
                <Delete className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={status === 'scanning' || status === 'granted'}
              onClick={() => verifyCode(pin)}
              className="w-full h-11 mland:h-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-extrabold text-xs mland:text-[11px] flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50 transition-all"
            >
              <Unlock className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
              <span>{status === 'scanning' ? 'กำลังสแกน...' : 'สแกนเข้าออฟฟิศ'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SecretBoostModal: React.FC<{
  state: GameState;
  vipAuthorized: boolean;
  onUnlockVip: () => void;
  onLockVip: () => void;
  appSettings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  nextMatchLabel?: string | null;
  onSkipNextMatch?: () => void;
  onClose: () => void;
  onOpenGodBlessing: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({
  state,
  vipAuthorized,
  onUnlockVip,
  onLockVip,
  appSettings,
  onUpdateSettings,
  nextMatchLabel,
  onSkipNextMatch,
  onClose,
  onOpenGodBlessing,
  onUpdateState,
  onToast
}) => {
  const isPlayerMode = state.mode === 'p' && !!state.p;
  const me = state.teams[state.me];
  const avgOv = me?.sq.length ? Math.round(me.sq.reduce((s, q) => s + q.ov, 0) / me.sq.length) : 60;
  const [customVal, setCustomVal] = useState('1000');
  const [unit, setUnit] = useState<'k' | 'm'>('k');
  const [customRep, setCustomRep] = useState('25');

  if (!vipAuthorized) {
    return (
      <VipOfficeScannerGate
        onUnlock={onUnlockVip}
        onClose={onClose}
        onToast={onToast}
      />
    );
  }

  const autoSkipOn = Boolean(appSettings.autoSkipMatch);
  const matchSkipButtonsOn = appSettings.vipMatchSkipEnabled !== false;

  const runBoost = (
    kind: 'money500' | 'money2500' | 'money10000' | 'sub500' | 'sub2500' | 'sub10000' | 'stat5' | 'stat10' | 'healAll'
  ) => {
    if (kind === 'sub500' || kind === 'sub2500' || kind === 'sub10000') {
      SFX.tap();
      vibrate(20);
    } else {
      SFX.win();
      vibrate(35);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretBoost(d, kind);
    });
    if (msg) onToast(msg);
  };

  const runPlayerBoost = (
    kind: 'rep15' | 'rep50' | 'repSub10' | 'talent10' | 'ageSub2' | 'unlockPerks'
  ) => {
    if (kind === 'repSub10') {
      SFX.tap();
      vibrate(20);
    } else {
      SFX.win();
      vibrate(35);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretPlayerBoost(d, kind);
    });
    if (msg) onToast(msg);
  };

  const parsedAmountK = (() => {
    const raw = Number(customVal);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.round(unit === 'm' ? raw * 1000 : raw);
  })();

  const runCustomMoney = (mode: 'add' | 'sub' | 'set', overrideK?: number) => {
    const amtK = overrideK !== undefined ? overrideK : parsedAmountK;
    if (mode !== 'set' && amtK <= 0) {
      onToast('กรุณากรอกจำนวนเงินที่ต้องการ');
      return;
    }
    if (mode === 'add') {
      SFX.win();
      vibrate(30);
    } else {
      SFX.tap();
      vibrate(20);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretMoneyAdjust(d, mode, amtK);
    });
    if (msg) onToast(msg);
  };

  const parsedRep = (() => {
    const raw = Number(customRep);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.round(raw);
  })();

  const runCustomRep = (mode: 'add' | 'sub' | 'set', overrideAmt?: number) => {
    const amt = overrideAmt !== undefined ? overrideAmt : parsedRep;
    if (mode !== 'set' && amt <= 0) {
      onToast('กรุณากรอกจำนวนชื่อเสียงที่ต้องการ');
      return;
    }
    if (mode === 'add') {
      SFX.win();
      vibrate(30);
    } else {
      SFX.tap();
      vibrate(20);
    }
    let msg = '';
    onUpdateState((d) => {
      msg = applySecretRepAdjust(d, mode, amt);
    });
    if (msg) onToast(msg);
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/75 flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--lamp)]/50 flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 px-5 py-3 mland:px-3 mland:py-1.5 bg-[var(--lamp-soft)]/50 border-b border-[var(--lamp)]/30 flex items-center justify-between gap-2">
          <h3 className="font-bold text-base mland:text-xs font-display flex items-center gap-1.5 min-w-0">
            <span>👑</span>
            <span className="truncate">{isPlayerMode ? 'โหมดลับนักเตะอาชีพ (VIP Boost)' : 'โหมดลับผู้สนับสนุน (VIP Boost)'}</span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--g-soft)] border border-[var(--g)]/40 text-[10px] font-bold text-[var(--g)] shrink-0">
              <ShieldCheck className="w-3 h-3" />
              <span>ผ่านเครื่องสแกน</span>
            </span>
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onLockVip();
                onToast('🔒 ล็อกประตูออฟฟิศ VIP แล้ว');
              }}
              title="ล็อกห้อง VIP (ต้องสแกนรหัสใหม่)"
              className="px-2.5 h-8 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--red)]/50 text-[11px] mland:text-[9.5px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-[var(--red)]" />
              <span>ล็อก</span>
            </button>
            <button type="button" onClick={onClose} className="w-8 h-8 mland:w-6 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] mland:text-xs font-bold cursor-pointer">✕</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-2.5 space-y-2.5 mland:space-y-1.5">
          {/* VIP Match Skip Control Center (Moved from Settings & Match Controls) */}
          <div className="p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/80 border border-[var(--lamp)]/40 space-y-2 mland:space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs mland:text-[10.5px] font-extrabold text-[#8a5b00] dark:text-[var(--lamp)] flex items-center gap-1.5">
                <FastForward className="w-3.5 h-3.5 shrink-0" />
                <span>ระบบข้ามการแข่งขัน (VIP Skip)</span>
              </div>
              {nextMatchLabel && onSkipNextMatch && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onClose();
                    onSkipNextMatch();
                  }}
                  className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] hover:brightness-105 text-[10.5px] mland:text-[9px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>⏭️ ข้ามนัดถัดไป ({nextMatchLabel})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onUpdateSettings({ autoSkipMatch: !autoSkipOn });
                  onToast(!autoSkipOn ? '⏭️ เปิดข้ามแข่งอัตโนมัติ (VIP) แล้ว' : 'ปิดข้ามแข่งอัตโนมัติแล้ว');
                }}
                className={`w-full flex items-center justify-between gap-2 p-2 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer transition-colors ${
                  autoSkipOn ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold truncate">⏭️ ข้ามแข่งอัตโนมัติ</div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                    จำลองผลทันทีโดยไม่เปิดสนาม 2D
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] mland:text-[8.5px] font-bold shrink-0 ${autoSkipOn ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {autoSkipOn ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  const nextVal = !matchSkipButtonsOn;
                  onUpdateSettings({ vipMatchSkipEnabled: nextVal });
                  onToast(nextVal ? '⏩ เปิดปุ่ม "ข้าม" ในหน้าก่อนแข่งและสนาม 2D แล้ว' : 'ซ่อนปุ่ม "ข้าม" ในหน้าก่อนแข่งและสนาม 2D แล้ว');
                }}
                className={`w-full flex items-center justify-between gap-2 p-2 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer transition-colors ${
                  matchSkipButtonsOn ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold truncate">⏩ ปุ่ม "ข้าม" ในสนาม</div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                    แสดงปุ่มข้ามหน้าก่อนแข่ง &amp; ในเกม 2D
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] mland:text-[8.5px] font-bold shrink-0 ${matchSkipButtonsOn ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {matchSkipButtonsOn ? 'เปิด' : 'ปิด'}
                </span>
              </button>
            </div>
          </div>

          {isPlayerMode && state.p ? (
            <>
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10.5px] tabular">
                <span>
                  นักเตะ: <b className="text-[var(--ink)]">{state.p.name}</b> · อายุ <b>{state.p.age}</b> ปี
                </span>
                <div className="flex items-center gap-3">
                  <span>ชื่อเสียง: <b className="text-[#9a6700] dark:text-[var(--lamp)]">★ {state.p.rep ?? 10}</b></span>
                  <span className="inline-flex items-center gap-1">
                    พรสวรรค์: <TalentBadge talent={state.p.talent ?? 78} variant="default" size="xs" />
                  </span>
                  <span>OVR: <b className="text-[var(--lamp)]">{ovMe(state.p)}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                <button
                  type="button"
                  onClick={() => runPlayerBoost('rep15')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)]">⭐ ชื่อเสียง +15 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ใช้ปลดล็อกสกิลติดตัว &amp; ซ้อม</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('rep50')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-amber-300">👑 ชื่อเสียง +50 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ระดับซุปตาร์มหาชน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('repSub10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/75 border border-[var(--red)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">📉 ลดชื่อเสียง -10 ★</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ปรับลดชื่อเสียงลง</div>
                </button>

                <button
                  type="button"
                  onClick={() => runPlayerBoost('talent10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--g)]">🌟 พรสวรรค์ +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">เพิ่มโอกาสภารกิจ (ตัน 99)</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('ageSub2')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-teal-500/12 border border-teal-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-teal-700 dark:text-teal-300">⏳ ย้อนวัย -2 ปี</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ขยายช่วงพีค (ขั้นต่ำ 16)</div>
                </button>
                <button
                  type="button"
                  onClick={() => runPlayerBoost('unlockPerks')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-purple-500/12 border border-purple-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-purple-700 dark:text-purple-300">🔓 ปลดสกิลติดตัวครบ</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ได้สกิลติดตัวระดับอาชีพทั้งหมด</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('healAll')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/12 border border-sky-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-sky-700 dark:text-sky-300">🩺 ฟื้นฟูฟิต 100%</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ฟิตเต็ม · หายเจ็บ · ล้างแบน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat5')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px]">⚡ เพิ่มพลัง +5</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ทุกค่าพลัง +5 &amp; ฟิต 100%</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-orange-500/12 border border-orange-500/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-orange-700 dark:text-orange-300">🔥 เพิ่มพลัง +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ซูเปอร์สตาร์ +10 &amp; ฟิตเต็ม</div>
                </button>
              </div>

              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] whitespace-nowrap">กำหนดชื่อเสียง (★):</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    aria-label="จำนวนชื่อเสียงที่ต้องการปรับ"
                    value={customRep}
                    onChange={(e) => setCustomRep(e.target.value)}
                    className="w-20 mland:w-16 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => runCustomRep('sub')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--red-soft)] border border-[var(--red)]/45 text-[var(--red)] text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-95"
                  >
                    − ลด {parsedRep > 0 ? `${parsedRep} ★` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomRep('add')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-105"
                  >
                    + เพิ่ม
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomRep('set', 10)}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/50 text-xs mland:text-[10px] font-bold cursor-pointer"
                  >
                    รีเซ็ต 10 ★
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-xs mland:text-[10.5px] tabular">
                <span>
                  งบสโมสรปัจจุบัน:{' '}
                  <b className={state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>
                    <AnimatedMoney value={state.money} deltaPlacement="inline" />
                  </b>
                  {state.money < 0 && <span className="ml-1.5 text-[10px] text-[var(--red)] font-bold">(ติดลบ)</span>}
                </span>
                <span>OVR เฉลี่ยทีม: <b className="text-[var(--lamp)]">{avgOv}</b></span>
              </div>

              <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                <button
                  type="button"
                  onClick={() => runBoost('money500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--g)]">💰 เติมเงิน +500k ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบเสริมทัพ &amp; บริหารทีม</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('money2500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)]">💎 เติมเงิน +2.5m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">งบมหาเศรษฐีทุ่มตลาด</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('money10000')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-amber-300">🏦 เติมเงิน +10m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">เทคโอเวอร์ระดับลีกสูงสุด</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('sub500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/70 border border-[var(--red)]/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">💸 ลดเงิน -500k ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">หักงบสโมสรลง 500k</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('sub2500')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)]/85 border border-[var(--red)]/45 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">📉 ลดเงิน -2.5m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ปรับงบลดลง 2.5 ล้าน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('sub10000')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/55 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-[var(--red)]">🔻 ลดเงิน -10m ฿</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ดึงงบออก 10 ล้าน</div>
                </button>

                <button
                  type="button"
                  onClick={() => runBoost('healAll')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-sky-500/12 border border-sky-500/35 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-sky-700 dark:text-sky-300">🩺 ฟื้นฟูทีม 100%</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ฟิตเต็ม · หายเจ็บ · ล้างโทษแบน</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat5')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px]">⚡ เพิ่มพลัง +5</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ทั้งทีม +5 OVR &amp; ฟิต 100%</div>
                </button>
                <button
                  type="button"
                  onClick={() => runBoost('stat10')}
                  className="p-2.5 mland:p-1.5 rounded-xl bg-orange-500/12 border border-orange-500/40 hover:brightness-105 text-left cursor-pointer"
                >
                  <div className="font-bold text-xs mland:text-[10.5px] text-orange-700 dark:text-orange-300">🔥 เพิ่มพลัง +10</div>
                  <div className="text-[10px] mland:text-[9px] text-[var(--mut)] mt-0.5">ระดับแชมป์ +10 OVR &amp; หายเจ็บ</div>
                </button>
              </div>

              {/* Custom Money Adjust Bar */}
              <div className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] whitespace-nowrap">กำหนดยอดเอง:</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    aria-label="จำนวนเงินที่ต้องการปรับ"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    className="w-24 mland:w-20 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                  />
                  <div className="flex items-center p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('k');
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer ${unit === 'k' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      พัน (k)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('m');
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer ${unit === 'm' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      ล้าน (m)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => runCustomMoney('sub')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--red-soft)] border border-[var(--red)]/45 text-[var(--red)] text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-95"
                  >
                    − ลด {parsedAmountK > 0 ? fmtMoney(parsedAmountK) : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('add')}
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer hover:brightness-105"
                  >
                    + เพิ่ม
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('set', 0)}
                    title="ตั้งงบสโมสรกลับเป็น 0 ฿"
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--red)]/50 text-xs mland:text-[10px] font-bold cursor-pointer"
                  >
                    รีเซ็ต 0 ฿
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onClose();
              onOpenGodBlessing();
            }}
            className="w-full p-2.5 mland:p-1.5 rounded-xl bg-gradient-to-r from-[var(--lamp-soft)] via-[var(--surface-2)] to-[var(--g-soft)] border border-[var(--lamp)]/50 hover:brightness-105 text-left flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="font-bold text-xs mland:text-[10.5px] text-[#8a5b00] dark:text-[var(--lamp)] flex items-center gap-1.5">
                <span>🛠️ ปรับแต่งนักเตะรายบุคคล (VIP Editor)</span>
              </div>
              <div className="text-[10px] mland:text-[9px] text-[var(--mut)] truncate">
                แก้ไข OVR ค่าพลังย่อย เพดานพรสวรรค์ ตำแหน่งถนัด นิสัย สไตล์ และหน้าตาได้ทุกสโมสร
              </div>
            </div>
            <span className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] text-[10.5px] mland:text-[9.5px] font-extrabold shrink-0">
              เปิดปรับแต่ง →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
