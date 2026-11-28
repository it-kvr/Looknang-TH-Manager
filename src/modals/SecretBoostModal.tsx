import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  ChevronRight,
  Clock,
  Crown,
  Delete,
  Eye,
  EyeOff,
  FastForward,
  Flame,
  HeartPulse,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Unlock,
  UserCog,
  X,
  Zap
} from 'lucide-react';
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
            onToast('🔓 ปลดล็อกห้องควบคุม VIP สำเร็จ');
            onUnlock();
          }, 380);
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
      }, 240);
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
      tone: 'text-[var(--mut)]',
      label: 'กรอกรหัสผ่าน 4 หลักเพื่อเข้าใช้งาน'
    },
    scanning: {
      tone: 'text-[var(--g)]',
      label: 'กำลังตรวจสอบรหัสผ่าน...'
    },
    denied: {
      tone: 'text-[var(--red)]',
      label: `รหัสผ่านไม่ถูกต้อง${attempts > 1 ? ` (ลองแล้ว ${attempts} ครั้ง)` : ''}`
    },
    granted: {
      tone: 'text-[var(--g)]',
      label: 'ยืนยันสิทธิ์สำเร็จ กำลังเปิดแผงควบคุม...'
    }
  }[status];

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9']
  ];

  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 mland:p-2 overflow-hidden">
      <div
        className={`w-full max-w-[520px] max-h-[calc(var(--app-dvh,1dvh)*92)] rounded-2xl bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden ${
          status === 'denied' ? 'office-pin-shake' : ''
        }`}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 mland:px-3.5 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm mland:text-xs font-display truncate">
                เข้าสู่ห้องควบคุม VIP
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onClose();
            }}
            aria-label="ปิดหน้าต่าง"
            className="btn-icon"
          >
            <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-3 grid grid-cols-1 sm:grid-cols-[1fr_210px] mland:grid-cols-[1fr_196px] gap-4 mland:gap-3 items-center">
          {/* Left: PIN Slots & Status */}
          <div className="flex flex-col justify-between gap-3.5 mland:gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs mland:text-[11px] font-bold text-[var(--ink)]">
                {status === 'granted' ? (
                  <ShieldCheck className="w-4 h-4 text-[var(--g)] shrink-0" />
                ) : status === 'denied' ? (
                  <ShieldAlert className="w-4 h-4 text-[var(--red)] shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-[#9a6700] dark:text-[var(--lamp)] shrink-0" />
                )}
                <span>ยืนยันรหัสผู้ดูแล</span>
              </div>
              <p className={`text-[11px] mland:text-[10px] font-medium leading-snug ${statusMeta.tone}`}>
                {statusMeta.label}
              </p>
            </div>

            <div className="space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between text-[11px] mland:text-[10px] text-[var(--mut)]">
                <span>รหัสผ่าน 4 หลัก</span>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setShowDigits((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] hover:text-[var(--g)] cursor-pointer"
                >
                  {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                      className={`h-12 mland:h-9.5 rounded-xl border flex items-center justify-center font-mono tabular text-lg mland:text-base font-bold transition-colors ${
                        status === 'denied'
                          ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]'
                          : status === 'granted'
                            ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--g)]'
                            : char
                              ? 'bg-[var(--surface-2)] border-[var(--g)]/70 text-[var(--ink)]'
                              : isActive
                                ? 'bg-[var(--surface)] border-[var(--lamp)] text-[var(--ink)]'
                                : 'bg-[var(--surface-2)]/60 border-[var(--line)] text-[var(--mut)]'
                      }`}
                    >
                      {char ? (showDigits ? char : '●') : isActive ? '_' : '·'}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={status === 'scanning' || status === 'granted'}
              onClick={() => verifyCode(pin)}
              className="btn btn-md btn-gold w-full"
            >
              <Unlock className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
              <span>{status === 'scanning' ? 'กำลังตรวจสอบ...' : 'ปลดล็อกเข้าใช้งาน'}</span>
            </button>
          </div>

          {/* Right: Compact Numeric Keypad */}
          <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)]">
            <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
              {keypadRows.flat().map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={status === 'scanning' || status === 'granted'}
                  onClick={() => pushDigit(digit)}
                  className="h-10 mland:h-8 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-sm mland:text-xs font-bold font-mono tabular text-[var(--ink)] cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={handleClear}
                title="ล้างรหัส"
                className="h-10 mland:h-8 rounded-lg bg-[var(--red-soft)] hover:brightness-95 border border-[var(--red)]/30 text-[11px] mland:text-[10px] font-bold text-[var(--red)] cursor-pointer disabled:opacity-50"
              >
                ล้าง
              </button>
              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={() => pushDigit('0')}
                className="h-10 mland:h-8 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-sm mland:text-xs font-bold font-mono tabular text-[var(--ink)] cursor-pointer disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                disabled={status === 'scanning' || status === 'granted'}
                onClick={handleBackspace}
                aria-label="ลบตัวเลข"
                title="ลบตัวเลขล่าสุด"
                className="h-10 mland:h-8 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <Delete className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SwitchRow: React.FC<{
  title: string;
  subtitle: string;
  checked: boolean;
  onToggle: () => void;
}> = ({ title, subtitle, checked, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    className="w-full flex items-center justify-between gap-2.5 px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/55 hover:bg-[var(--surface-2)] border border-[var(--line)] text-left cursor-pointer"
  >
    <div className="min-w-0">
      <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] truncate">{title}</div>
      <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">{subtitle}</div>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-[10px] mland:text-[9px] font-bold ${checked ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
        {checked ? 'เปิด' : 'ปิด'}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 mland:h-4 mland:w-7.5 items-center rounded-full transition-colors ${
          checked ? 'bg-[var(--g)]' : 'bg-[var(--line)]'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 mland:h-3 mland:w-3 rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-4.5 mland:translate-x-3.5' : 'translate-x-1'
          }`}
        />
      </span>
    </div>
  </button>
);

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
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*92)] mland:max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Clean Header */}
        <div className="shrink-0 px-4 py-3 mland:px-3.5 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-xl mland:rounded-lg bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display truncate">
                แผงควบคุม VIP
              </h3>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                {isPlayerMode ? 'โหมดนักเตะอาชีพ' : 'โหมดผู้จัดการทีม'} · ปรับแต่งงบ พลัง และข้ามแข่ง
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onLockVip();
                onToast('🔒 ล็อกห้องควบคุม VIP แล้ว');
              }}
              title="ล็อกห้อง VIP (ต้องกรอกรหัสใหม่)"
              className="btn btn-sm btn-secondary"
            >
              <Lock className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--red)]" />
              <span>ล็อกสิทธิ์</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="btn-icon"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2.5 space-y-3 mland:space-y-2">
          {/* Live Status Summary Strip */}
          {isPlayerMode && state.p ? (
            <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10.5px] tabular">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-[var(--ink)] truncate">{state.p.name}</span>
                <span className="text-[var(--mut)]">·</span>
                <span className="text-[var(--mut)]">อายุ {state.p.age} ปี</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[var(--mut)]">
                  ชื่อเสียง <b className="text-[#9a6700] dark:text-[var(--lamp)]">★ {state.p.rep ?? 10}</b>
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--mut)]">
                  พรสวรรค์ <TalentBadge talent={state.p.talent ?? 78} variant="default" size="xs" />
                </span>
                <span className="text-[var(--mut)]">
                  OVR <b className="text-[var(--ink)]">{ovMe(state.p)}</b>
                </span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10.5px] tabular">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--mut)]">งบสโมสรปัจจุบัน</span>
                <b className={state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--g)]'}>
                  <AnimatedMoney value={state.money} deltaPlacement="inline" />
                </b>
                {state.money < 0 && (
                  <span className="text-[10.5px] text-[var(--red)] font-bold">(ติดลบ)</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[var(--mut)]">
                <span>
                  OVR เฉลี่ย <b className="text-[var(--ink)]">{avgOv}</b>
                </span>
                <span>·</span>
                <span>
                  นักเตะ <b className="text-[var(--ink)]">{me?.sq.length || 0}</b> คน
                </span>
              </div>
            </div>
          )}

          {/* Section 1: Finance (Manager) or Career Reputation & Progression (Player) */}
          {isPlayerMode && state.p ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  ชื่อเสียงและพัฒนาการ
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => runPlayerBoost('rep15')}
                    className="btn btn-xs bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/30 hover:bg-[var(--g)] hover:text-white"
                  >
                    +15 ★
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlayerBoost('rep50')}
                    className="btn btn-xs bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] border border-[var(--lamp)]/40 hover:brightness-95"
                  >
                    +50 ★
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlayerBoost('repSub10')}
                    className="btn btn-xs btn-danger"
                  >
                    −10 ★
                  </button>
                </div>
              </div>

              <div className="p-3 mland:p-2 space-y-2.5 mland:space-y-1.5">
                <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                  <button
                    type="button"
                    onClick={() => runPlayerBoost('talent10')}
                    className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/55 hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)]/50 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                      <span className="truncate">พรสวรรค์ +10</span>
                    </div>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                      เพิ่มเพดานพัฒนา (สูงสุด 99)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => runPlayerBoost('ageSub2')}
                    className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/55 hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)]/50 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                      <span className="truncate">ย้อนวัย −2 ปี</span>
                    </div>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                      ขยายช่วงพีค (ขั้นต่ำ 16 ปี)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => runPlayerBoost('unlockPerks')}
                    className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/55 hover:bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--lamp)]/60 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                      <Award className="w-3.5 h-3.5 text-[#9a6700] dark:text-[var(--lamp)] shrink-0" />
                      <span className="truncate">ปลดสกิลครบ</span>
                    </div>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                      สกิลติดตัวระดับอาชีพทั้งหมด
                    </div>
                  </button>
                </div>

                <div className="pt-2 mland:pt-1.5 border-t border-[var(--line)]/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] whitespace-nowrap">
                      กำหนดชื่อเสียง:
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      aria-label="จำนวนชื่อเสียงที่ต้องการปรับ"
                      value={customRep}
                      onChange={(e) => setCustomRep(e.target.value)}
                      className="w-20 mland:w-16 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => runCustomRep('sub')}
                      className="btn btn-xs btn-danger"
                    >
                      − ลด {parsedRep > 0 ? `${parsedRep} ★` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => runCustomRep('add')}
                      className="btn btn-xs btn-primary"
                    >
                      + เพิ่ม
                    </button>
                    <button
                      type="button"
                      onClick={() => runCustomRep('set', 10)}
                      className="btn btn-xs btn-secondary"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>รีเซ็ต 10 ★</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
              <div className="px-3 py-2 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  จัดการงบประมาณสโมสร
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => runBoost('money500')}
                    className="btn btn-xs bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/30 hover:bg-[var(--g)] hover:text-white tabular"
                  >
                    +500k
                  </button>
                  <button
                    type="button"
                    onClick={() => runBoost('money2500')}
                    className="btn btn-xs bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/30 hover:bg-[var(--g)] hover:text-white tabular"
                  >
                    +2.5M
                  </button>
                  <button
                    type="button"
                    onClick={() => runBoost('money10000')}
                    className="btn btn-xs bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] border border-[var(--lamp)]/45 hover:brightness-95 tabular"
                  >
                    +10M
                  </button>
                  <span className="mx-0.5 text-[var(--line)] select-none">|</span>
                  <button
                    type="button"
                    onClick={() => runBoost('sub500')}
                    className="btn btn-xs btn-danger tabular"
                  >
                    −500k
                  </button>
                  <button
                    type="button"
                    onClick={() => runBoost('sub2500')}
                    className="btn btn-xs btn-danger tabular"
                  >
                    −2.5M
                  </button>
                  <button
                    type="button"
                    onClick={() => runBoost('sub10000')}
                    className="btn btn-xs btn-danger tabular"
                  >
                    −10M
                  </button>
                </div>
              </div>

              <div className="px-3 py-2.5 mland:px-2.5 mland:py-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] whitespace-nowrap">
                    กำหนดยอดเอง:
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    aria-label="จำนวนเงินที่ต้องการปรับ"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    className="w-24 mland:w-20 px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs mland:text-[10.5px] font-bold tabular text-right focus:outline-none focus:border-[var(--g)]"
                  />
                  <div className="seg-bar">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('k');
                      }}
                      className={`seg-btn ${unit === 'k' ? 'seg-btn-active' : ''}`}
                    >
                      พัน (k)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setUnit('m');
                      }}
                      className={`seg-btn ${unit === 'm' ? 'seg-btn-active' : ''}`}
                    >
                      ล้าน (M)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => runCustomMoney('sub')}
                    className="btn btn-xs btn-danger tabular"
                  >
                    − ลด {parsedAmountK > 0 ? fmtMoney(parsedAmountK) : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('add')}
                    className="btn btn-xs btn-primary"
                  >
                    + เพิ่ม
                  </button>
                  <button
                    type="button"
                    onClick={() => runCustomMoney('set', 0)}
                    title="ตั้งงบสโมสรกลับเป็น 0 ฿"
                    className="btn btn-xs btn-secondary"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>รีเซ็ต 0 ฿</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Squad / Player Power & Fitness Boosts */}
          <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
            <button
              type="button"
              onClick={() => runBoost('healAll')}
              className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)]/70 border border-[var(--line)] hover:border-[var(--g)]/60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                <HeartPulse className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                <span className="truncate">{isPlayerMode ? 'ฟื้นฟูฟิต 100%' : 'ฟื้นฟูทีม 100%'}</span>
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                ฟิตเต็ม · หายเจ็บ · ล้างแบน
              </div>
            </button>

            <button
              type="button"
              onClick={() => runBoost('stat5')}
              className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)]/70 border border-[var(--line)] hover:border-[var(--g)]/60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                <Zap className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                <span className="truncate">เพิ่มพลัง +5</span>
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                {isPlayerMode ? 'ทุกค่าพลัง +5 & ฟิต 100%' : 'ทั้งทีม +5 OVR & ฟิต 100%'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => runBoost('stat10')}
              className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)]/70 border border-[var(--line)] hover:border-[var(--lamp)]/70 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[#9a6700] dark:text-[var(--lamp)]">
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">เพิ่มพลัง +10</span>
              </div>
              <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] mt-0.5 truncate">
                {isPlayerMode ? 'ซูเปอร์สตาร์ +10 & ฟิตเต็ม' : 'ระดับแชมป์ +10 OVR & หายเจ็บ'}
              </div>
            </button>
          </div>

          {/* Section 3: Match Skip Controls */}
          <div className="p-3 mland:p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2 mland:space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                <FastForward className="w-3.5 h-3.5 text-[#9a6700] dark:text-[var(--lamp)] shrink-0" />
                <span>ระบบข้ามการแข่งขัน</span>
              </div>
              {nextMatchLabel && onSkipNextMatch && (
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onClose();
                    onSkipNextMatch();
                  }}
                  className="btn btn-xs btn-gold max-w-full"
                >
                  <FastForward className="w-3 h-3 shrink-0" />
                  <span className="truncate">ข้ามนัดถัดไป ({nextMatchLabel})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
              <SwitchRow
                title="ข้ามแข่งอัตโนมัติ"
                subtitle="จำลองผลทันทีโดยไม่เปิดสนาม 2D"
                checked={autoSkipOn}
                onToggle={() => {
                  SFX.tap();
                  onUpdateSettings({ autoSkipMatch: !autoSkipOn });
                  onToast(!autoSkipOn ? '⏭️ เปิดข้ามแข่งอัตโนมัติ (VIP) แล้ว' : 'ปิดข้ามแข่งอัตโนมัติแล้ว');
                }}
              />
              <SwitchRow
                title='ปุ่ม "ข้าม" ในสนาม'
                subtitle="แสดงปุ่มข้ามหน้าก่อนแข่ง & ในเกม 2D"
                checked={matchSkipButtonsOn}
                onToggle={() => {
                  SFX.tap();
                  const nextVal = !matchSkipButtonsOn;
                  onUpdateSettings({ vipMatchSkipEnabled: nextVal });
                  onToast(
                    nextVal
                      ? '⏩ เปิดปุ่ม "ข้าม" ในหน้าก่อนแข่งและสนาม 2D แล้ว'
                      : 'ซ่อนปุ่ม "ข้าม" ในหน้าก่อนแข่งและสนาม 2D แล้ว'
                  );
                }}
              />
            </div>
          </div>

          {/* Section 4: Individual Player VIP Editor */}
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              onClose();
              onOpenGodBlessing();
            }}
            className="w-full px-3.5 py-2.5 mland:px-3 mland:py-2 rounded-xl bg-[var(--lamp-soft)]/55 hover:bg-[var(--lamp-soft)]/80 border border-[var(--lamp)]/45 text-left flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 mland:w-7 mland:h-7 rounded-lg bg-[var(--lamp)] text-[#261900] flex items-center justify-center shrink-0">
                <UserCog className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs mland:text-[11px] text-[var(--ink)] truncate">
                  ปรับแต่งนักเตะรายบุคคล (VIP Editor)
                </div>
                <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">
                  แก้ไข OVR ค่าพลังย่อย เพดานพรสวรรค์ ตำแหน่งถนัด นิสัย และหน้าตาได้ทุกสโมสร
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs mland:text-[10.5px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] shrink-0 whitespace-nowrap">
              <span>เปิดเครื่องมือ</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
