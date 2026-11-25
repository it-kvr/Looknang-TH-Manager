import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { SFX } from '../utils/audioTheme';

export type CardStudioTone = 'light' | 'dark';

const STORAGE_KEY = 'lk_card_studio_tone';
let cachedTone: CardStudioTone | null = null;
const listeners = new Set<(tone: CardStudioTone) => void>();

function readInitialTone(): CardStudioTone {
  if (cachedTone) return cachedTone;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw === 'dark' || raw === 'light') {
      cachedTone = raw;
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  cachedTone = 'light';
  return 'light';
}

export function setCardStudioTone(next: CardStudioTone) {
  cachedTone = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }
  listeners.forEach((cb) => cb(next));
}

export function useCardStudioTone(): [CardStudioTone, () => void] {
  const [tone, setTone] = useState<CardStudioTone>(() => readInitialTone());

  useEffect(() => {
    const onSync = (val: CardStudioTone) => setTone(val);
    listeners.add(onSync);
    setTone(readInitialTone());
    return () => {
      listeners.delete(onSync);
    };
  }, []);

  const toggleTone = () => {
    SFX.tap();
    setCardStudioTone(tone === 'light' ? 'dark' : 'light');
  };

  return [tone, toggleTone];
}

export interface AthleteCardPalette {
  cardShell: string;
  subText: string;
  mutedText: string;
  clubText: string;
  iconBtn: string;
  lockerBtn: string;
  clubIconWrap: string;
  stageBox: string;
  stageGlow: string;
  nameText: string;
  metaText: string;
  statsWrap: string;
  statCell: string;
  statLabel: string;
  statTrack: string;
  traitChip: string;
  repText: string;
  capBadge: string;
  hgBadge: string;
}

export function getAthleteCardPalette(tone: CardStudioTone): AthleteCardPalette {
  if (tone === 'light') {
    return {
      cardShell:
        'border-slate-300/85 bg-gradient-to-b from-[#fbfdfc] via-[#f1f5f3] to-[#e6ede9] text-slate-900',
      subText: 'text-slate-600',
      mutedText: 'text-slate-500',
      clubText: 'text-slate-700',
      iconBtn:
        'bg-white/85 hover:bg-white border border-slate-300/85 hover:border-emerald-600/45 text-slate-700 hover:text-emerald-700 shadow-2xs',
      lockerBtn:
        'bg-amber-500/12 hover:bg-amber-500/22 border border-amber-600/35 text-amber-800',
      clubIconWrap: 'bg-white/85 border border-slate-300/75',
      stageBox:
        'border-slate-300/75 bg-gradient-to-b from-[#dfe7e3] via-[#edf2ef] to-[#d5dfd9] shadow-[inset_0_1px_4px_rgba(15,23,42,0.08)]',
      stageGlow:
        'radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.32) 48%, transparent 76%)',
      nameText: 'text-slate-900',
      metaText: 'text-emerald-800/80',
      statsWrap: 'bg-white/82 border-t border-slate-300/75',
      statCell: 'bg-slate-900/[0.04] border border-slate-200/80',
      statLabel: 'text-slate-500',
      statTrack: 'bg-slate-300/80',
      traitChip: 'bg-emerald-600/10 border-emerald-600/30 text-emerald-900',
      repText: 'text-amber-700',
      capBadge: 'bg-slate-800 text-white',
      hgBadge: 'bg-emerald-600/12 border border-emerald-600/35 text-emerald-800'
    };
  }

  return {
    cardShell:
      'border-white/15 bg-gradient-to-b from-[#16231d] via-[#0e1713] to-[#080e0b] text-white',
    subText: 'text-white/80',
    mutedText: 'text-white/60',
    clubText: 'text-white/75',
    iconBtn:
      'bg-white/8 hover:bg-white/15 border border-white/12 hover:border-[#f5c242]/50 text-white/80 hover:text-[#f5c242]',
    lockerBtn:
      'bg-white/12 hover:bg-white/25 border border-white/20 text-amber-200',
    clubIconWrap: 'bg-white/10 border border-white/15',
    stageBox:
      'border-white/10 bg-gradient-to-b from-[#23322c] via-[#18231e] to-[#111915] shadow-inner',
    stageGlow:
      'radial-gradient(circle at 50% 48%, rgba(241, 248, 244, 0.24) 0%, rgba(212, 228, 220, 0.08) 46%, transparent 74%)',
    nameText: 'text-white',
    metaText: 'text-emerald-100/80',
    statsWrap: 'bg-[#060c09]/92 border-t border-white/10',
    statCell: 'bg-white/[0.04]',
    statLabel: 'text-white/60',
    statTrack: 'bg-white/15',
    traitChip: 'bg-emerald-400/15 border-emerald-300/30 text-emerald-100',
    repText: 'text-amber-200/90',
    capBadge: 'bg-white/18 text-white',
    hgBadge: 'bg-emerald-400/20 border border-emerald-300/45 text-emerald-200'
  };
}

export const CardStudioToggleButton: React.FC<{
  tone: CardStudioTone;
  onToggle: () => void;
  className?: string;
}> = ({ tone, onToggle, className = '' }) => {
  const isLight = tone === 'light';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={isLight ? 'เปลี่ยนพื้นหลังสตูดิโอ: โทนเข้ม' : 'เปลี่ยนพื้นหลังสตูดิโอ: โทนขาว-เทา'}
      aria-label="สลับพื้นหลังสตูดิโอการ์ดนักเตะ"
      className={`w-6 h-6 mland:w-5 mland:h-5 rounded-lg border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
        isLight
          ? 'bg-white/85 hover:bg-white border-slate-300/85 text-slate-700 hover:text-slate-900 shadow-2xs'
          : 'bg-black/35 hover:bg-black/55 border-white/18 text-amber-200 hover:text-white'
      } ${className}`}
    >
      {isLight ? (
        <Moon className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
      ) : (
        <Sun className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
      )}
    </button>
  );
};
