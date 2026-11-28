import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, ExternalLink, Sparkles } from 'lucide-react';
import type { GameState, Player, Position, Team } from '../types/game';
import { clamp } from '../utils/math';
import { getTeamTrainingPlan, LINE, PM, POS } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  autoAssignAllTeamShirtNumbers,
  ef,
  getFormationSlots,
  getPositionShirtGuide,
  getShirtNo,
  getTeamClubIdentity,
  playerPen,
  xi
} from '../engine/playerCore';
import { rate } from '../engine/simulation';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getWellbeingTierMeta,
  isTeamFavoritePlayer
} from '../engine/wellbeing';
import { ClubCrest, KitJersey, PlayerFace } from './SvgVisuals';
import { CaptainBadge } from './CaptainBadge';
import { PositionBadge } from './PositionBadge';
import { OvrBadge } from './OvrBadge';
import { StaminaBar, getStaminaMeta } from './StaminaBar';

type LockerViewTab = 'condition' | 'jersey';
type ConditionGroupKey = 'fresh' | 'caution' | 'tired' | 'unavailable';
type ConditionFilterKey = 'ALL' | ConditionGroupKey;
type LockerFilter = 'ALL' | 'XI' | Position;

const NUMBER_PAGES: ReadonlyArray<{ label: string; start: number; end: number; nums: number[] }> = [
  { label: '1–25', start: 1, end: 25, nums: Array.from({ length: 25 }, (_, i) => i + 1) },
  { label: '26–50', start: 26, end: 50, nums: Array.from({ length: 25 }, (_, i) => i + 26) },
  { label: '51–75', start: 51, end: 75, nums: Array.from({ length: 25 }, (_, i) => i + 51) },
  { label: '76–99', start: 76, end: 99, nums: Array.from({ length: 24 }, (_, i) => i + 76) }
];

const getPageForNumber = (num: number): number => clamp(Math.floor((num - 1) / 25), 0, NUMBER_PAGES.length - 1);

const CONDITION_GROUPS: ReadonlyArray<{
  key: ConditionGroupKey;
  icon: string;
  label: string;
  hint: string;
  cardCls: string;
  activeCardCls: string;
  headerBgCls: string;
  titleCls: string;
}> = [
  {
    key: 'fresh',
    icon: '🟢',
    label: 'ฟิตเต็ม · พร้อมลุย',
    hint: 'ความฟิต ≥ 80% ลงเล่น 90 นาทีได้เต็มที่ทั้งลีกและบอลถ้วย',
    cardCls: 'bg-emerald-500/[0.06] border-emerald-500/30 hover:border-emerald-500/65',
    activeCardCls: 'bg-emerald-500/14 border-emerald-500 ring-1 ring-emerald-500/40',
    headerBgCls: 'bg-emerald-500/[0.08] border-emerald-500/25',
    titleCls: 'text-emerald-700 dark:text-emerald-300'
  },
  {
    key: 'caution',
    icon: '🟡',
    label: 'เริ่มล้า · เฝ้าระวัง',
    hint: 'ความฟิต 65–79% ควรหมุนเวียนพักในบอลถ้วยเพื่อเก็บแรงไว้เกมลีก',
    cardCls: 'bg-amber-500/[0.06] border-amber-500/30 hover:border-amber-500/65',
    activeCardCls: 'bg-amber-500/14 border-amber-500 ring-1 ring-amber-500/40',
    headerBgCls: 'bg-amber-500/[0.08] border-amber-500/25',
    titleCls: 'text-amber-800 dark:text-amber-300'
  },
  {
    key: 'tired',
    icon: '🟠',
    label: 'เหนื่อยล้า · ควรพัก',
    hint: 'ความฟิต < 65% เสี่ยงฟอร์มตกและบาดเจ็บสูง แนะนำสลับสำรองลงแทน',
    cardCls: 'bg-orange-500/[0.07] border-orange-500/35 hover:border-orange-500/70',
    activeCardCls: 'bg-orange-500/15 border-orange-500 ring-1 ring-orange-500/40',
    headerBgCls: 'bg-orange-500/[0.09] border-orange-500/25',
    titleCls: 'text-orange-700 dark:text-orange-300'
  },
  {
    key: 'unavailable',
    icon: '🔴',
    label: 'บาดเจ็บ / ติดโทษแบน',
    hint: 'ยังไม่พร้อมลงสนาม ควรสั่งพักซ้อมเพื่อเร่งฟื้นตัว',
    cardCls: 'bg-rose-500/[0.06] border-rose-500/30 hover:border-rose-500/65',
    activeCardCls: 'bg-rose-500/14 border-rose-500 ring-1 ring-rose-500/40',
    headerBgCls: 'bg-rose-500/[0.08] border-rose-500/25',
    titleCls: 'text-rose-700 dark:text-rose-300'
  }
];

function classifyPlayerCondition(q: Player): ConditionGroupKey {
  if ((q.inj || 0) > 0 || (q.sus || 0) > 0) return 'unavailable';
  const f = Math.round(q.fit ?? 100);
  if (f >= 80) return 'fresh';
  if (f >= 65) return 'caution';
  return 'tired';
}

interface NextFixtureBrief {
  compType: 'league' | 'cup';
  compLabel: string;
  compIcon: string;
  oppName: string;
  isHome: boolean;
}

function resolveNextFixtureBrief(state: GameState): NextFixtureBrief | null {
  const getOpp = (homeId: number, awayId: number) => {
    const isHome = homeId === state.me;
    const oppId = isHome ? awayId : homeId;
    return { oppName: state.teams[oppId]?.name || 'คู่แข่ง', isHome };
  };

  if (state.pa && state.ac && state.ac.alive && !state.ac.done) {
    const idx = state.ac.ids.indexOf(state.me);
    if (idx >= 0) {
      const pIdx = Math.floor(idx / 2) * 2;
      return { compType: 'cup', compLabel: 'ชิงแชมป์สโมสรทวีป', compIcon: '🌏', ...getOpp(state.ac.ids[pIdx], state.ac.ids[pIdx + 1]) };
    }
  }
  if (state.psc && state.sc && state.sc.alive && !state.sc.done) {
    const idx = state.sc.ids.indexOf(state.me);
    if (idx >= 0) {
      const pIdx = Math.floor(idx / 2) * 2;
      return { compType: 'cup', compLabel: 'แชมเปี้ยนส์คัพ', compIcon: '🏅', ...getOpp(state.sc.ids[pIdx], state.sc.ids[pIdx + 1]) };
    }
  }
  if (state.plc && state.lc && state.lc.alive && !state.lc.done) {
    const idx = state.lc.ids.indexOf(state.me);
    if (idx >= 0) {
      const pIdx = Math.floor(idx / 2) * 2;
      return { compType: 'cup', compLabel: 'ลีกคัพ', compIcon: '🥇', ...getOpp(state.lc.ids[pIdx], state.lc.ids[pIdx + 1]) };
    }
  }
  if (state.pdc && state.dc && state.dc.alive && !state.dc.done) {
    const idx = state.dc.ids.indexOf(state.me);
    if (idx >= 0) {
      const pIdx = Math.floor(idx / 2) * 2;
      return { compType: 'cup', compLabel: 'ดิวิชั่นคัพ', compIcon: '🛡️', ...getOpp(state.dc.ids[pIdx], state.dc.ids[pIdx + 1]) };
    }
  }
  if (state.pc && state.cup && state.cup.alive && !state.cup.done) {
    const idx = state.cup.ids.indexOf(state.me);
    if (idx >= 0) {
      const pIdx = Math.floor(idx / 2) * 2;
      return { compType: 'cup', compLabel: 'ถ้วยประชาชน', compIcon: '🏆', ...getOpp(state.cup.ids[pIdx], state.cup.ids[pIdx + 1]) };
    }
  }
  if (state.md < state.fx.length) {
    const pair = state.fx[state.md]?.find((p) => p.includes(state.me));
    if (pair) {
      return { compType: 'league', compLabel: `ลีก นัดที่ ${state.md + 1}`, compIcon: '⚽', ...getOpp(pair[0], pair[1]) };
    }
  }
  return null;
}

function buildRotationLineup(
  team: Team,
  mode: 'league' | 'cup',
  prevStarterNames: Set<string>
): Player[] {
  const slots = getFormationSlots(team);
  const available = team.sq.filter((q) => (q.inj || 0) === 0 && (q.sus || 0) === 0);
  const pool = available.length >= 11 ? available : team.sq.slice();
  const used = new Set<string>();
  const picked: (Player | null)[] = Array(slots.length).fill(null);

  const scoreForSlot = (q: Player, sp: typeof slots[number]['sp']) => {
    const f = q.fit ?? 100;
    const pen = playerPen(q, sp);
    const penMult = PM[pen] ?? 0.85;
    if (mode === 'league') {
      const fitFactor = f >= 76 ? 1.03 : f >= 64 ? 0.94 : 0.78;
      return ef(q) * penMult * fitFactor;
    }
    // Cup rotation: strongly prefer fresh fit players, rest fatigued regulars, give bench/youth a look
    const freshBonus = f >= 85 ? 20 : f >= 76 ? 10 : f >= 68 ? -6 : -26;
    const rotateBonus = !prevStarterNames.has(q.n) && f >= 74 ? 7 : 0;
    const youthBonus = (q.age || 24) <= 23 && f >= 74 ? 4 : 0;
    const overworkPenalty = prevStarterNames.has(q.n) && f < 78 ? -12 : 0;
    return (q.ov * 0.8 + freshBonus + rotateBonus + youthBonus + overworkPenalty) * penMult;
  };

  // Pass 1: Assign natural/zero-penalty fits first per position
  POS.forEach((posLine) => {
    const slotIdxs = slots.map((z, i) => (z.pos === posLine ? i : -1)).filter((i) => i >= 0);
    const candidates: Array<{ score: number; q: Player; i: number }> = [];
    pool
      .filter((q) => !used.has(q.n) && (q.pos === posLine || (q.altRoles?.some((r) => LINE[r] === posLine) ?? false)))
      .forEach((q) => {
        slotIdxs.forEach((i) => {
          candidates.push({ score: scoreForSlot(q, slots[i].sp), q, i });
        });
      });
    candidates.sort((a, b) => b.score - a.score);
    candidates.forEach(({ q, i }) => {
      if (used.has(q.n) || picked[i]) return;
      used.add(q.n);
      picked[i] = q;
    });
  });

  // Pass 2: Fill any remaining empty slots cleanly
  slots.forEach((slot, i) => {
    if (picked[i]) return;
    const fallback = pool
      .filter(
        (q) =>
          !used.has(q.n) &&
          (slot.pos === 'GK' ? true : q.pos !== 'GK' || (q.altRoles?.some((r) => LINE[r] !== 'GK') ?? false))
      )
      .sort((a, b) => scoreForSlot(b, slot.sp) - scoreForSlot(a, slot.sp))[0] || pool.find((q) => !used.has(q.n));
    if (fallback) {
      used.add(fallback.n);
      picked[i] = fallback;
    }
  });

  return picked.filter((q): q is Player => Boolean(q));
}

const LockerCabinDecor: React.FC<{ selected?: boolean; compact?: boolean }> = ({ selected = false, compact = false }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            selected
              ? 'radial-gradient(ellipse 85% 58% at 50% 6%, rgba(52, 211, 153, 0.24), transparent 70%)'
              : 'radial-gradient(ellipse 82% 54% at 50% 6%, rgba(254, 243, 199, 0.14), transparent 72%)',
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 14px)',
            'linear-gradient(180deg, #1b2226 0%, #12171a 58%, #0b0e10 100%)'
          ].join(', ')
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-2.5 bg-gradient-to-b from-black/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/45 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-black/45 to-transparent"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-2.5 mland:inset-x-2 ${compact ? 'top-[5px]' : 'top-[7px] mland:top-[5px]'} h-[2.5px] rounded-full bg-gradient-to-b from-[#e2e8f0] via-[#94a3b8] to-[#475569] shadow-[0_1px_3px_rgba(0,0,0,0.75)]`}
      >
        <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-2 rounded-xs bg-[#334155] border border-white/20" />
        <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-2 rounded-xs bg-[#334155] border border-white/20" />
      </div>
      <svg
        viewBox="0 0 100 38"
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-[5] ${
          compact
            ? 'top-[2px] w-[42px] h-[16px] mland:w-[32px] mland:h-[13px]'
            : 'top-[3px] mland:top-[2px] w-[46px] h-[18px] mland:w-[36px] mland:h-[14px]'
        }`}
      >
        <defs>
          <linearGradient id={`hw-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d49b63" />
            <stop offset="45%" stopColor="#9f6838" />
            <stop offset="100%" stopColor="#653b1b" />
          </linearGradient>
          <linearGradient id={`hc-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="55%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
        <path
          d="M 50 14.5 L 50 11.5 C 50 9 54.5 8.5 54.5 5.8 C 54.5 3.6 52.4 2.3 50 2.3 C 47.9 2.3 46.2 3.5 45.8 5.2"
          fill="none"
          stroke={`url(#hc-${uid})`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <rect x="47.4" y="13.2" width="5.2" height="3.2" rx="1.2" fill="#e5b85c" stroke="#5c3d0e" strokeWidth="0.6" />
        <path
          d="M 50 16 C 56 16.5 72 22.5 84.5 29.5 C 86.5 30.6 86.4 33.4 83.8 33.8 C 81.8 34.1 79.2 33 76.5 31.8 C 67 27.5 57 23.2 50 23.2 C 43 23.2 33 27.5 23.5 31.8 C 20.8 33 18.2 34.1 16.2 33.8 C 13.6 33.4 13.5 30.6 15.5 29.5 C 28 22.5 44 16.5 50 16 Z"
          fill={`url(#hw-${uid})`}
          stroke="#3b200c"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path
          d="M 20 28.8 C 31.5 22.6 43.5 17.7 50 17.7 C 56.5 17.7 68.5 22.6 80 28.8"
          fill="none"
          stroke="#f3cca1"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px] mland:h-[4px] bg-gradient-to-b from-[#694426] to-[#3c2412] border-t border-[#b98456]/35"
      />
    </>
  );
};

export const LockerRoomPanel: React.FC<{
  state: GameState;
  team: Team;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, team, onUpdateState, onInspectPlayer, onToast }) => {
  const isMgr = state.mode === 'm';
  const clubIdentity = useMemo(() => getTeamClubIdentity(team, state), [team, state]);
  const starters = useMemo(() => xi(team), [team]);
  const starterNames = useMemo(() => new Set(starters.map((q) => q.n)), [starters]);
  const slots = useMemo(() => getFormationSlots(team), [team]);
  const teamRating = useMemo(() => rate(team, state), [team, state]);
  const trainingPlan = getTeamTrainingPlan(state);
  const indMap = trainingPlan.individualFocus || {};

  const [viewTab, setViewTab] = useState<LockerViewTab>('condition');
  const [condFilter, setCondFilter] = useState<ConditionFilterKey>('ALL');
  const [condPosFilter, setCondPosFilter] = useState<'ALL' | Position>('ALL');

  // Shirt-number locker states
  const [posFilter, setPosFilter] = useState<LockerFilter>('ALL');
  const [kitSide, setKitSide] = useState<'home' | 'away'>('home');
  const [selectedName, setSelectedName] = useState<string>(() => {
    const meSq = team.sq.find((q) => q.me);
    return meSq?.n || starters[0]?.n || team.sq[0]?.n || '';
  });

  // Condition groups computation
  const groupedPlayers = useMemo(() => {
    const map: Record<ConditionGroupKey, Player[]> = {
      fresh: [],
      caution: [],
      tired: [],
      unavailable: []
    };
    team.sq.forEach((q) => {
      if (condPosFilter !== 'ALL' && q.pos !== condPosFilter) return;
      map[classifyPlayerCondition(q)].push(q);
    });
    map.fresh.sort((a, b) => (b.fit ?? 100) - (a.fit ?? 100) || b.ov - a.ov);
    map.caution.sort((a, b) => (b.fit ?? 100) - (a.fit ?? 100) || b.ov - a.ov);
    map.tired.sort((a, b) => (a.fit ?? 100) - (b.fit ?? 100) || b.ov - a.ov);
    map.unavailable.sort((a, b) => (b.inj || 0) - (a.inj || 0) || (b.sus || 0) - (a.sus || 0) || b.ov - a.ov);
    return map;
  }, [team.sq, condPosFilter]);

  const allGroupCounts = useMemo(() => {
    const counts: Record<ConditionGroupKey, number> = {
      fresh: 0,
      caution: 0,
      tired: 0,
      unavailable: 0
    };
    team.sq.forEach((q) => {
      counts[classifyPlayerCondition(q)]++;
    });
    return counts;
  }, [team.sq]);

  const avgSquadFit = useMemo(
    () => (team.sq.length ? Math.round(team.sq.reduce((s, q) => s + (q.fit ?? 100), 0) / team.sq.length) : 100),
    [team.sq]
  );
  const avgXiFit = useMemo(
    () => (starters.length ? Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / starters.length) : 100),
    [starters]
  );
  const xiNeedsRotationCount = useMemo(
    () => starters.filter((q) => (q.inj || 0) > 0 || (q.sus || 0) > 0 || (q.fit ?? 100) < 72).length,
    [starters]
  );

  const nextFixture = useMemo(() => resolveNextFixtureBrief(state), [state]);
  const activeCups = useMemo(() => {
    const list: Array<{ icon: string; label: string }> = [];
    if (state.cup?.alive && !state.cup?.done) list.push({ icon: '🏆', label: 'ถ้วย ปชช.' });
    if (state.lc?.alive && !state.lc?.done) list.push({ icon: '🥇', label: 'ลีกคัพ' });
    if (state.dc?.alive && !state.dc?.done) list.push({ icon: '🛡️', label: 'ดิวิชั่นคัพ' });
    if (state.sc?.alive && !state.sc?.done) list.push({ icon: '🏅', label: 'แชมเปี้ยนส์คัพ' });
    if (state.ac?.alive && !state.ac?.done) list.push({ icon: '🌏', label: 'ถ้วยทวีป' });
    return list;
  }, [state.cup, state.lc, state.dc, state.sc, state.ac]);

  const lineDepth = useMemo(() => {
    return POS.map((pos) => {
      const list = team.sq.filter((q) => q.pos === pos);
      const ready = list.filter((q) => (q.inj || 0) === 0 && (q.sus || 0) === 0 && (q.fit ?? 100) >= 75).length;
      const tired = list.filter((q) => (q.inj || 0) === 0 && (q.sus || 0) === 0 && (q.fit ?? 100) < 75).length;
      const out = list.filter((q) => (q.inj || 0) > 0 || (q.sus || 0) > 0).length;
      return { pos, total: list.length, ready, tired, out };
    });
  }, [team.sq]);

  const leaguePreviewXi = useMemo(() => buildRotationLineup(team, 'league', starterNames), [team, starterNames]);
  const cupPreviewXi = useMemo(() => buildRotationLineup(team, 'cup', starterNames), [team, starterNames]);
  const leaguePreviewFit = useMemo(
    () => (leaguePreviewXi.length ? Math.round(leaguePreviewXi.reduce((s, q) => s + (q.fit ?? 100), 0) / leaguePreviewXi.length) : 100),
    [leaguePreviewXi]
  );
  const cupPreviewFit = useMemo(
    () => (cupPreviewXi.length ? Math.round(cupPreviewXi.reduce((s, q) => s + (q.fit ?? 100), 0) / cupPreviewXi.length) : 100),
    [cupPreviewXi]
  );
  const cupSwappedOutCount = useMemo(
    () => starters.filter((q) => !cupPreviewXi.some((c) => c.n === q.n)).length,
    [starters, cupPreviewXi]
  );

  const restEligibleCount = useMemo(
    () => team.sq.filter((q) => ((q.fit ?? 100) < 72 || q.inj > 0) && indMap[q.n] !== 'REST').length,
    [team.sq, indMap]
  );

  const handleApplyPresetLineup = (mode: 'league' | 'cup') => {
    if (!isMgr) return;
    SFX.confirm();
    const targetXi = mode === 'league' ? leaguePreviewXi : cupPreviewXi;
    const avgTargetFit = mode === 'league' ? leaguePreviewFit : cupPreviewFit;
    onUpdateState((d) => {
      const t = d.teams[d.me];
      t.lu = targetXi.map((q) => q.n);
    });
    if (mode === 'league') {
      onToast(`🏆 จัดชุดใหญ่เน้นเกมลีกแล้ว (11 ตัวจริง · ฟิตเฉลี่ย ${avgTargetFit}%)`);
    } else {
      onToast(`🔄 จัดชุดโรเตชั่นบอลถ้วยแล้ว (พักตัวหลัก ${cupSwappedOutCount} คน · ฟิตเฉลี่ย ${avgTargetFit}%)`);
    }
  };

  const handleSwapUnreadyAndTiredXi = () => {
    if (!isMgr) return;
    const swappedPairs: string[] = [];
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      const curXi = xi(t);
      const nextLu = curXi.map((q) => q.n);
      const usedNames = new Set(nextLu);
      const freshPool = t.sq
        .filter((q) => !usedNames.has(q.n) && q.inj === 0 && (q.sus || 0) === 0 && (q.fit ?? 100) >= 74)
        .sort((a, b) => (b.fit ?? 100) * 0.55 + b.ov - ((a.fit ?? 100) * 0.55 + a.ov));

      curXi.forEach((starter, idx) => {
        const isUnavail = starter.inj > 0 || (starter.sus || 0) > 0;
        const sf = Math.round(starter.fit ?? 100);
        if (!isUnavail && sf >= 72) return;
        const starterSlotSp = slots[idx]?.sp || starter.ro;
        const subIdx = freshPool.findIndex((b) =>
          starter.pos === 'GK'
            ? b.pos === 'GK' || playerPen(b, 'GK') === 0
            : b.pos === starter.pos || playerPen(b, starterSlotSp) === 0
        );
        const fallbackIdx =
          subIdx >= 0
            ? subIdx
            : starter.pos === 'GK'
              ? -1
              : freshPool.findIndex((b) => b.pos !== 'GK' || playerPen(b, starterSlotSp) <= 1);
        if (fallbackIdx >= 0) {
          const replacement = freshPool.splice(fallbackIdx, 1)[0];
          nextLu[idx] = replacement.n;
          swappedPairs.push(`${starter.n.split(' ')[0]}→${replacement.n.split(' ')[0]}`);
        }
      });
      t.lu = nextLu;
    });
    if (swappedPairs.length > 0) {
      onToast(`🩹 สลับตัวไม่พร้อม/ล้าออก ${swappedPairs.length} ตำแหน่ง (${swappedPairs.slice(0, 2).join(', ')})`);
    } else {
      onToast('ตัวจริง 11 คนพร้อมลงสนามดีอยู่แล้ว หรือยังไม่มีสำรองฟิตกว่ามาสลับ');
    }
  };

  const handleTogglePlayerXi = (target: Player) => {
    if (!isMgr) return;
    if ((target.inj || 0) > 0 || (target.sus || 0) > 0) {
      onToast(`${target.n} ยังบาดเจ็บ/ติดแบน ไม่สามารถส่งลงตัวจริงได้`);
      return;
    }
    const isStarter = starterNames.has(target.n);
    let swapMsg = '';
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      const curXi = xi(t);
      const nextLu = curXi.map((q) => q.n);
      const tSlots = getFormationSlots(t);
      if (isStarter) {
        const idx = nextLu.indexOf(target.n);
        if (idx < 0) return;
        const slotSp = tSlots[idx]?.sp || target.ro;
        const slotPos = tSlots[idx]?.pos || target.pos;
        const used = new Set(nextLu);
        const availBench = t.sq.filter((b) => !used.has(b.n) && (b.inj || 0) === 0 && (b.sus || 0) === 0);
        const rep =
          availBench
            .filter((b) => playerPen(b, slotSp) === 0)
            .sort((a, b) => (b.fit ?? 100) * 0.5 + b.ov - ((a.fit ?? 100) * 0.5 + a.ov))[0] ||
          availBench
            .filter((b) => b.pos === slotPos)
            .sort((a, b) => (b.fit ?? 100) * 0.5 + b.ov - ((a.fit ?? 100) * 0.5 + a.ov))[0] ||
          availBench
            .filter((b) => (slotPos === 'GK' ? true : b.pos !== 'GK'))
            .sort((a, b) => (b.fit ?? 100) * 0.5 + b.ov - ((a.fit ?? 100) * 0.5 + a.ov))[0];
        if (!rep) return;
        nextLu[idx] = rep.n;
        t.lu = nextLu;
        swapMsg = `พัก ${target.n.split(' ')[0]} นั่งสำรอง · ส่ง ${rep.n.split(' ')[0]} (${slotSp}) ลงแทน`;
      } else {
        // Bring bench player into best matching slot (preferring injured/tired starter in same role/line)
        const candidates = curXi.map((s, idx) => {
          const slotSp = tSlots[idx]?.sp || s.ro;
          const slotPos = tSlots[idx]?.pos || s.pos;
          const pen = playerPen(target, slotSp);
          const sameLine = slotPos === target.pos ? 0 : 1;
          const isBad = (s.inj || 0) > 0 || (s.sus || 0) > 0 ? -200 : 0;
          const starterFit = s.fit ?? 100;
          // Lower score = better slot to replace
          const priority = pen * 120 + sameLine * 45 + isBad + starterFit * 0.8 + s.ov * 0.3;
          return { idx, s, slotSp, priority };
        });
        candidates.sort((a, b) => a.priority - b.priority);
        const chosen = candidates[0];
        if (!chosen) return;
        nextLu[chosen.idx] = target.n;
        t.lu = nextLu;
        swapMsg = `ส่ง ${target.n.split(' ')[0]} ลงตัวจริง (${chosen.slotSp}) แทน ${chosen.s.n.split(' ')[0]}`;
      }
    });
    if (swapMsg) onToast(swapMsg);
  };

  const handleToggleIndividualRest = (target: Player) => {
    if (!isMgr) return;
    SFX.tap();
    const currentlyRest = indMap[target.n] === 'REST';
    onUpdateState((d) => {
      const cur = getTeamTrainingPlan(d);
      const nextInd = { ...(cur.individualFocus || {}) };
      if (nextInd[target.n] === 'REST') delete nextInd[target.n];
      else nextInd[target.n] = 'REST';
      if (d.focusPlayer === target.n) d.focusPlayer = null;
      d.trainingPlan = { ...cur, individualFocus: nextInd };
    });
    onToast(currentlyRest ? `ให้ ${target.n.split(' ')[0]} กลับมาซ้อมปกติ` : `😴 สั่งพักฟื้นเดี่ยวให้ ${target.n.split(' ')[0]} (+10% ฟิต/นัด)`);
  };

  const handleRestAllFatigued = () => {
    if (!isMgr) return;
    SFX.tap();
    let added = 0;
    onUpdateState((d) => {
      const cur = getTeamTrainingPlan(d);
      const nextInd: Record<string, 'REST' | 'FOCUS'> = { ...(cur.individualFocus || {}) };
      d.teams[d.me].sq.forEach((q) => {
        if ((q.fit ?? 100) < 72 || q.inj > 0) {
          if (nextInd[q.n] !== 'REST') added++;
          nextInd[q.n] = 'REST';
          if (d.focusPlayer === q.n) d.focusPlayer = null;
        } else if (nextInd[q.n] === 'REST' && (q.fit ?? 100) >= 88 && q.inj === 0) {
          delete nextInd[q.n];
        }
      });
      d.trainingPlan = { ...cur, individualFocus: nextInd };
    });
    onToast(added > 0 ? `😴 สั่งพักฟื้นเดี่ยวนักเตะล้า/เจ็บ ${added} คนแล้ว` : 'นักเตะที่ล้า/เจ็บถูกสั่งพักไว้ครบแล้ว');
  };

  // ==================== JERSEY LOCKER DATA ====================
  const sortedSquad = useMemo(() => {
    return team.sq
      .slice()
      .sort((a, b) => {
        const aIn = starterNames.has(a.n) ? 0 : 1;
        const bIn = starterNames.has(b.n) ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        const posDiff = POS.indexOf(a.pos) - POS.indexOf(b.pos);
        if (posDiff !== 0) return posDiff;
        return b.ov - a.ov;
      });
  }, [team.sq, starterNames]);

  const filteredPlayers = useMemo(() => {
    if (posFilter === 'ALL') return sortedSquad;
    if (posFilter === 'XI') return sortedSquad.filter((q) => starterNames.has(q.n));
    return sortedSquad.filter((q) => q.pos === posFilter);
  }, [sortedSquad, posFilter, starterNames]);

  const selectedPlayer = useMemo(
    () => team.sq.find((q) => q.n === selectedName) || filteredPlayers[0] || sortedSquad[0] || null,
    [team.sq, selectedName, filteredPlayers, sortedSquad]
  );

  const selectedNo = selectedPlayer ? getShirtNo(team, selectedPlayer) : 10;
  const [numPage, setNumPage] = useState<number>(() => getPageForNumber(selectedNo));

  useEffect(() => {
    if (selectedPlayer) {
      const no = getShirtNo(team, selectedPlayer);
      setNumPage(getPageForNumber(no));
    }
  }, [selectedPlayer?.n, team]);

  const numberHolderMap = useMemo(() => {
    const map = new Map<number, Player>();
    team.sq.forEach((q) => {
      map.set(getShirtNo(team, q), q);
    });
    return map;
  }, [team]);

  const shirtGuide = useMemo(
    () => (selectedPlayer ? getPositionShirtGuide(selectedPlayer.ro, selectedPlayer.pos) : null),
    [selectedPlayer?.ro, selectedPlayer?.pos]
  );
  const primaryRecSet = useMemo(() => new Set(shirtGuide?.primary || []), [shirtGuide]);
  const altRecSet = useMemo(() => new Set(shirtGuide?.alt || []), [shirtGuide]);

  const isSelectedMe = Boolean(selectedPlayer && (selectedPlayer.me || (!isMgr && state.p?.name === selectedPlayer.n)));
  const canEditSelected = Boolean(selectedPlayer && (isMgr || isSelectedMe));
  const isSelectedStarter = Boolean(selectedPlayer && starterNames.has(selectedPlayer.n));

  const handleAssignNumber = (targetPlayer: Player, rawNum: number) => {
    const nextNo = clamp(Math.round(rawNum) || 1, 1, 99);
    const oldNo = getShirtNo(team, targetPlayer);
    if (oldNo === nextNo) return;

    const currentHolder = team.sq.find((q) => q.n !== targetPlayer.n && getShirtNo(team, q) === nextNo);
    SFX.tap();
    onUpdateState((d) => {
      const t = d.teams[d.me];
      const pl = t.sq.find((q) => q.n === targetPlayer.n);
      if (!pl) return;
      const curOldNo = getShirtNo(t, pl);
      const holder = t.sq.find((q) => q !== pl && getShirtNo(t, q) === nextNo);
      if (holder) {
        holder.no = curOldNo;
        if (Array.isArray(holder.vis) && holder.vis.length >= 6) holder.vis[5] = curOldNo;
        if (holder.me && d.p) d.p.no = curOldNo;
      }
      pl.no = nextNo;
      if (Array.isArray(pl.vis) && pl.vis.length >= 6) pl.vis[5] = nextNo;
      if (pl.me && d.p) d.p.no = nextNo;
    });
    setNumPage(getPageForNumber(nextNo));

    if (currentHolder) {
      onToast(`สลับเบอร์ #${nextNo} (${targetPlayer.n.split(' ')[0]}) ↔ #${oldNo} (${currentHolder.n.split(' ')[0]}) แล้ว`);
    } else {
      onToast(`เปลี่ยนเบอร์เสื้อ ${targetPlayer.n.split(' ')[0]} เป็น #${nextNo} แล้ว`);
    }
  };

  const handleAutoAssignAll = () => {
    SFX.confirm();
    let changedCount = 0;
    onUpdateState((d) => {
      const t = d.teams[d.me];
      changedCount = autoAssignAllTeamShirtNumbers(t, d.p);
    });
    if (changedCount > 0) {
      onToast(`เปลี่ยนเบอร์เสื้อออโต้ทั้งทีม (${changedCount} คน) ตามตำแหน่งและบทบาทตัวจริงแล้ว`);
    } else {
      onToast('เบอร์เสื้อทั้งทีมจัดเรียงตามตำแหน่งเหมาะสมครบแล้ว');
    }
  };

  const activePageSpec = NUMBER_PAGES[numPage] || NUMBER_PAGES[0];

  const quickRecommendedNumbers = useMemo(() => {
    if (!shirtGuide) return [];
    const seen = new Set<number>();
    const list: number[] = [];
    for (const n of [...shirtGuide.primary, ...shirtGuide.alt]) {
      if (!seen.has(n)) {
        seen.add(n);
        list.push(n);
      }
    }
    return list.slice(0, 7);
  }, [shirtGuide]);

  const visibleGroups = useMemo(
    () =>
      CONDITION_GROUPS.filter((g) => {
        if (condFilter !== 'ALL' && g.key !== condFilter) return false;
        return groupedPlayers[g.key].length > 0;
      }),
    [condFilter, groupedPlayers]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      {/* Top Locker Room Header & Mode Switcher */}
      <div className="shrink-0 px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 mland:gap-1.5">
        <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
          <div className="shrink-0 w-6 h-6 mland:w-5 mland:h-5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/80 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 mland:[&>svg]:w-3.5 mland:[&>svg]:h-3.5">
            <ClubCrest name={team.name} size={16} team={team} club={state.club} isMyClub={isMgr} />
          </div>
          <div className="flex items-baseline gap-1.5 min-w-0">
            <h2 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold font-display text-[var(--ink)] truncate whitespace-nowrap leading-none">
              ห้องแต่งตัว
            </h2>
            <span className="hidden xl:inline text-[10.5px] text-[var(--mut)] truncate tabular whitespace-nowrap">
              · {team.sq.length} คน · ฟิตทีม {avgSquadFit}% · ตัวจริง {avgXiFit}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mland:gap-1 shrink-0">
          <div className="seg-bar shrink-0">
            <button
              type="button"
              onClick={() => { SFX.tap(); setViewTab('condition'); }}
              className={`seg-btn whitespace-nowrap shrink-0 px-2.5! py-0.5! mland:px-1.5! mland:py-0.5! ${
                viewTab === 'condition' ? 'seg-btn-active' : ''
              }`}
            >
              🩺 สภาพทีม &amp; หมุนเวียน
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setViewTab('jersey'); }}
              className={`seg-btn whitespace-nowrap shrink-0 px-2.5! py-0.5! mland:px-1.5! mland:py-0.5! ${
                viewTab === 'jersey' ? 'seg-btn-active' : ''
              }`}
            >
              👕 ล็อกเกอร์เบอร์เสื้อ
            </button>
          </div>

          {viewTab === 'condition' ? (
            <div className="seg-bar shrink-0">
              {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map((posKey) => (
                <button
                  key={posKey}
                  type="button"
                  onClick={() => { SFX.tap(); setCondPosFilter(posKey); }}
                  className={`seg-btn whitespace-nowrap shrink-0 px-2! py-0.5! mland:px-1.5! mland:py-0.5! ${
                    condPosFilter === posKey ? 'seg-btn-active' : ''
                  }`}
                >
                  {posKey === 'ALL' ? 'ทุกตำแหน่ง' : posKey}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="seg-bar shrink-0">
                {([
                  ['ALL', 'ทั้งหมด'],
                  ['XI', 'ตัวจริง'],
                  ['GK', 'GK'],
                  ['DF', 'DF'],
                  ['MF', 'MF'],
                  ['FW', 'FW']
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { SFX.tap(); setPosFilter(key); }}
                    className={`seg-btn whitespace-nowrap shrink-0 px-2! py-0.5! mland:px-1.5! mland:py-0.5! ${
                      posFilter === key ? 'seg-btn-active' : ''
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="seg-bar shrink-0">
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setKitSide('home'); }}
                  className={`seg-btn whitespace-nowrap shrink-0 px-2! py-0.5! mland:px-1.5! mland:py-0.5! ${
                    kitSide === 'home' ? 'seg-btn-active' : ''
                  }`}
                >
                  เหย้า
                </button>
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setKitSide('away'); }}
                  className={`seg-btn whitespace-nowrap shrink-0 px-2! py-0.5! mland:px-1.5! mland:py-0.5! ${
                    kitSide === 'away' ? 'seg-btn-active' : ''
                  }`}
                >
                  เยือน
                </button>
              </div>

              <button
                type="button"
                onClick={handleAutoAssignAll}
                title="จัดเบอร์เสื้ออัตโนมัติทั้งทีม"
                className="btn btn-xs mland:py-0.5 mland:px-1.5 btn-primary whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                <span className="hidden sm:inline">จัดเบอร์ออโต้</span>
                <span className="sm:hidden">ออโต้</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ==================== VIEW 1: CONDITION GROUPS & ROTATION PLANNER ==================== */}
      {viewTab === 'condition' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-y-auto lg:overflow-hidden mland:overflow-hidden">
          {/* 4 Condition Status Summary Cards (Interactive Filter) */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 mland:gap-1">
            {CONDITION_GROUPS.map((g) => {
              const cnt = allGroupCounts[g.key];
              const pct = team.sq.length ? Math.round((cnt / team.sq.length) * 100) : 0;
              const isSelectedFilter = condFilter === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  title={`${g.hint} — คลิกเพื่อกรองเฉพาะกลุ่มนี้`}
                  onClick={() => {
                    SFX.tap();
                    setCondFilter((prev) => (prev === g.key ? 'ALL' : g.key));
                  }}
                  className={`px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isSelectedFilter ? g.activeCardCls : g.cardCls
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-[10.5px] mland:text-[8.5px] font-bold truncate ${g.titleCls}`}>
                      {g.icon} {g.label.split(' · ')[0]}
                    </div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate mt-0.5">
                      {g.key === 'fresh'
                        ? 'ฟิต ≥ 80%'
                        : g.key === 'caution'
                          ? 'ฟิต 65–79%'
                          : g.key === 'tired'
                            ? 'ฟิต < 65%'
                            : 'งดลงสนาม'}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular leading-none">
                    <div className="text-sm sm:text-base mland:text-xs font-extrabold font-display text-[var(--ink)]">
                      {cnt} <span className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)]">คน</span>
                    </div>
                    <div className="text-[9px] mland:text-[7.5px] text-[var(--mut)] mt-0.5">{pct}%</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main 2-Column Stage: Left Grouped Squad Condition Lists + Right League/Cup Rotation Planner */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.45fr_0.82fr] mland:grid-cols-[1.42fr_0.85fr] lg:grid-rows-[minmax(0,1fr)] mland:grid-rows-[minmax(0,1fr)] gap-2.5 mland:gap-2 items-stretch overflow-y-auto lg:overflow-hidden mland:overflow-hidden">
            {/* LEFT: 4 Grouped Squad Lists */}
            <div className="lg:h-full lg:overflow-y-auto mland:h-full mland:overflow-y-auto space-y-2 mland:space-y-1.5 pr-0.5 min-h-[260px] lg:min-h-0">
              {condFilter !== 'ALL' && (
                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] mland:text-[8.5px]">
                  <span className="text-[var(--mut)]">
                    กำลังกรองเฉพาะ: <b className="text-[var(--ink)]">{CONDITION_GROUPS.find((x) => x.key === condFilter)?.label}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setCondFilter('ALL'); }}
                    className="font-bold text-[var(--g)] hover:underline cursor-pointer"
                  >
                    แสดงทุกกลุ่ม
                  </button>
                </div>
              )}

              {visibleGroups.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-center space-y-2">
                  <div className="text-xs text-[var(--mut)]">ไม่มีนักเตะในกลุ่มสภาพร่างกายที่เลือก</div>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setCondFilter('ALL');
                      setCondPosFilter('ALL');
                    }}
                    className="btn btn-xs btn-secondary"
                  >
                    แสดงนักเตะทั้งหมด
                  </button>
                </div>
              ) : (
                visibleGroups.map((group) => {
                  const players = groupedPlayers[group.key];
                  const grpAvgFit = Math.round(players.reduce((s, q) => s + (q.fit ?? 100), 0) / players.length);
                  return (
                    <div
                      key={group.key}
                      className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden"
                    >
                      {/* Group Header */}
                      <div className={`px-3 py-1.5 mland:px-2 mland:py-1 border-b flex items-center justify-between gap-2 ${group.headerBgCls}`}>
                        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs mland:text-[10px] font-extrabold ${group.titleCls}`}>
                            {group.icon} {group.label}
                          </span>
                          <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                            ({players.length} คน · ฟิตเฉลี่ย {grpAvgFit}%)
                          </span>
                        </div>
                        <span className="hidden sm:inline text-[9.5px] mland:text-[8px] text-[var(--mut)] truncate">
                          {group.hint}
                        </span>
                      </div>

                      {/* Group Rows */}
                      <div className="divide-y divide-[var(--line)]/75">
                        {players.map((q) => {
                          const f = Math.round(q.fit ?? 100);
                          const isStarter = starterNames.has(q.n);
                          const isRest = indMap[q.n] === 'REST';
                          const isMe = Boolean(q.me || (!isMgr && state.p?.name === q.n));
                          const isFav = isTeamFavoritePlayer(team, q.n);
                          const favBoost = getActiveFavBoost(q, team, isMe ? state.p : null);
                          const mScore = getPlayerMentalScore(q, isMe ? state.p : null);
                          const pScore = getPlayerPhysScore(q, isMe ? state.p : null);
                          const mMeta = getWellbeingTierMeta(mScore, 'mental', false);
                          const pMeta = getWellbeingTierMeta(pScore, 'phys', q.inj > 0);
                          const unavailable = (q.inj || 0) > 0 || (q.sus || 0) > 0;
                          const no = getShirtNo(team, q);

                          return (
                            <div
                              key={q.n}
                              className={`px-2.5 py-1.5 mland:px-2 mland:py-1 grid items-center gap-1.5 mland:gap-1 transition-colors ${
                                isMgr
                                  ? 'grid-cols-[minmax(0,1fr)_52px_36px_auto] sm:grid-cols-[minmax(0,1fr)_60px_38px_auto] mland:grid-cols-[minmax(0,1fr)_52px_36px_auto]'
                                  : 'grid-cols-[minmax(0,1fr)_54px_38px] sm:grid-cols-[minmax(0,1fr)_60px_40px]'
                              } ${
                                isStarter ? 'bg-[var(--g-soft)]/35' : isRest ? 'bg-emerald-500/[0.06]' : 'hover:bg-[var(--surface-2)]/45'
                              }`}
                            >
                              {/* Player Identity */}
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(q, team)}
                                className="flex items-center gap-1.5 mland:gap-1 min-w-0 text-left cursor-pointer group"
                              >
                                <div className="hidden sm:block mland:block shrink-0 [&>svg]:block">
                                  <PlayerFace player={{ ...q, no }} team={team} state={state} size={22} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <PositionBadge role={q.ro} size="2xs" />
                                    <span className="text-[12px] mland:text-[10px] font-bold text-[var(--ink)] group-hover:text-[var(--g)] truncate leading-tight">
                                      {q.n}
                                    </span>
                                    {team.cap === q.n && <CaptainBadge team={team} state={state} size="xs" className="shrink-0" />}
                                    {isFav && (
                                      <span
                                        title={favBoost > 0 ? `ลูกรักประจำทีม (+${favBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม'}
                                        className={`inline-flex items-center text-[9.5px] mland:text-[8px] font-extrabold leading-none tabular shrink-0 ${
                                          favBoost > 0
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-rose-500/80 dark:text-rose-400/80'
                                        }`}
                                      >
                                        {favBoost > 0 ? `💖+${favBoost}` : '💖'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate mt-0.5 flex items-center gap-1">
                                    <span className={isStarter ? 'text-[var(--g)] font-bold' : ''}>
                                      {isStarter ? '⭐ ตัวจริง' : '🪑 สำรอง'}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>#{no}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{q.age}ปี</span>
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className="inline-flex items-center gap-1 font-bold"
                                      title={`จิตใจ ${mScore}/100 · ร่างกาย ${pScore}/100`}
                                    >
                                      <span className={mMeta.txtCls}>🧠{mScore}</span>
                                      <span className={pMeta.txtCls}>💪{pScore}</span>
                                    </span>
                                    {q.inj > 0 && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-[var(--red)] font-bold">เจ็บ {q.inj}น</span>
                                      </>
                                    )}
                                    {(q.sus || 0) > 0 && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-amber-700 dark:text-amber-300 font-bold">แบน {q.sus}</span>
                                      </>
                                    )}
                                    {isRest && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">😴 พัก</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {/* Stamina */}
                              <div className="flex justify-center">
                                <StaminaBar value={f} variant="compact" className="w-[50px] sm:w-[58px] mland:w-[50px]" />
                              </div>

                              {/* Standard OVR Badge */}
                              <div className="flex justify-center">
                                <OvrBadge
                                  ov={q.ov + favBoost}
                                  boost={favBoost}
                                  size="sm"
                                  title={favBoost > 0 ? `OVR ${q.ov} + ลูกรัก ${favBoost} = ${q.ov + favBoost}` : undefined}
                                />
                              </div>

                              {/* Rotation & Rest Quick Controls (Manager Mode) */}
                              {isMgr && (
                                <div className="flex items-center justify-end gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={unavailable}
                                    title={
                                      unavailable
                                        ? 'บาดเจ็บ/ติดแบน ไม่สามารถส่งลงสนาม'
                                        : isStarter
                                          ? 'ถอดจาก 11 ตัวจริงไปพักเป็นสำรอง (สลับตัวฟิตลงแทน)'
                                          : 'ส่งลงเป็น 11 ตัวจริงในตำแหน่งที่เหมาะสม'
                                    }
                                    onClick={() => handleTogglePlayerXi(q)}
                                    className={`h-[25px] mland:h-[21px] px-2 mland:px-1.5 rounded-lg border text-[10px] mland:text-[8.5px] font-bold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap transition-colors ${
                                      isStarter
                                        ? 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)] hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300'
                                        : 'bg-[var(--g-soft)] border-[var(--g)]/55 text-[var(--g)] hover:bg-[var(--g)] hover:text-white'
                                    }`}
                                  >
                                    {isStarter ? 'พักสำรอง' : 'ส่งลง XI'}
                                  </button>

                                  <button
                                    type="button"
                                    title={isRest ? 'ยกเลิกพักฟื้นเดี่ยว' : 'สั่งพักซ้อมเดี่ยว (+10% ฟิต & ลดโอกาสเจ็บ)'}
                                    onClick={() => handleToggleIndividualRest(q)}
                                    className={`h-[25px] mland:h-[21px] px-1.5 mland:px-1 rounded-lg border text-[10px] mland:text-[8.5px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                                      isRest
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:border-emerald-500/60'
                                    }`}
                                  >
                                    😴
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT: League & Cup Rotation Planner */}
            <div className="lg:h-full lg:overflow-y-auto mland:h-full mland:overflow-y-auto space-y-2 mland:space-y-1.5 pr-0.5 shrink-0">
              {/* Next Match & Competition Pressure Card */}
              <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-[13px] mland:text-[10.5px] font-extrabold font-display text-[var(--ink)]">
                    🎯 วางแผนหมุนเวียน ลีก &amp; บอลถ้วย
                  </h3>
                  <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular">
                    ⚔️{Math.round(teamRating.at)} · 🛡️{Math.round(teamRating.df)}
                  </span>
                </div>

                {nextFixture ? (
                  <div
                    className={`px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl border text-[11px] mland:text-[9px] space-y-0.5 ${
                      nextFixture.compType === 'cup'
                        ? 'bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/50'
                        : 'bg-[var(--g-soft)]/60 border-[var(--g)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span className="text-[var(--ink)]">
                        {nextFixture.compIcon} นัดถัดไป: {nextFixture.compLabel}
                      </span>
                      <span className="text-[10px] mland:text-[8px] text-[var(--mut)] shrink-0">
                        {nextFixture.isHome ? '🏟️ เหย้า' : '🚌 เยือน'}
                      </span>
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                      พบ <b className="text-[var(--ink)]">{nextFixture.oppName}</b> ·{' '}
                      {nextFixture.compType === 'cup'
                        ? 'บอลถ้วย — เหมาะหมุนสำรองฟิตพักตัวหลัก'
                        : 'เกมลีก — เน้นความพร้อมและคะแนนตาราง'}
                    </div>
                  </div>
                ) : (
                  <div className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)]/65 border border-[var(--line)] text-[10.5px] text-[var(--mut)]">
                    จบโปรแกรมแข่งฤดูกาลนี้แล้ว
                  </div>
                )}

                {activeCups.length > 0 && (
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                    รายการที่ยังลุ้นแชมป์:{' '}
                    <span className="text-[var(--ink)] font-semibold">
                      ลีก{activeCups.map((c) => ` · ${c.icon} ${c.label}`).join('')}
                    </span>
                  </div>
                )}

                {/* 1-Click Rotation Presets */}
                {isMgr ? (
                  <div className="pt-1.5 border-t border-[var(--line)] space-y-1.5 mland:space-y-1">
                    <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">
                      จัดชุด 11 ตัวจริงทันที (สลับแผนอัตโนมัติ)
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyPresetLineup('league')}
                      className="w-full px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--g-soft)]/70 hover:bg-[var(--g-soft)] border border-[var(--g)]/55 text-left cursor-pointer transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] mland:text-[9.5px] font-extrabold text-[var(--g)]">
                          🏆 จัดชุดใหญ่เกมลีก (Best XI)
                        </span>
                        <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] tabular">
                          ฟิต ~{leaguePreviewFit}%
                        </span>
                      </div>
                      <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                        ส่งตัวท็อปที่พร้อมลงสนามสูงสุดตามตำแหน่งลงตัวจริง
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPresetLineup('cup')}
                      className="w-full px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl bg-[var(--lamp-soft)]/45 hover:bg-[var(--lamp-soft)]/75 border border-[var(--lamp)]/55 text-left cursor-pointer transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] mland:text-[9.5px] font-extrabold text-amber-800 dark:text-[var(--lamp)]">
                          🔄 จัดชุดโรเตชั่นบอลถ้วย
                        </span>
                        <span className="text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] tabular">
                          พัก {cupSwappedOutCount} ตัว · ฟิต ~{cupPreviewFit}%
                        </span>
                      </div>
                      <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]">
                        พักตัวหลักที่เริ่มล้า ดันสำรอง &amp; ดาวรุ่งฟิตเต็มลงลุยบอลถ้วย
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={xiNeedsRotationCount === 0}
                      onClick={handleSwapUnreadyAndTiredXi}
                      className="w-full px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)]/75 hover:bg-[var(--surface-2)] border border-[var(--line)] text-left cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] mland:text-[9px] font-bold text-[var(--ink)] truncate">
                        🩹 สลับตัวจริงที่เจ็บ/ล้า &lt;72% ออก
                      </span>
                      <span className={`text-[10px] mland:text-[8.5px] font-extrabold tabular shrink-0 ${xiNeedsRotationCount > 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                        {xiNeedsRotationCount > 0 ? `${xiNeedsRotationCount} คน` : 'ครบแล้ว'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-[var(--line)] text-[10.5px] text-[var(--mut)]">
                    โหมดนักเตะอาชีพ: ติดตามความฟิตและแผนหมุนเวียนของทีมได้ที่นี่
                  </div>
                )}
              </div>

              {/* Position Rotation Depth Matrix */}
              <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    📊 ความพร้อมหมุนเวียนตามตำแหน่ง
                  </h4>
                  <span className="text-[10px] mland:text-[8px] text-[var(--mut)]">
                    ตัวจริงฟิตเฉลี่ย <b className={getStaminaMeta(avgXiFit).txtCls}>{avgXiFit}%</b>
                  </span>
                </div>

                <div className="divide-y divide-[var(--line)]/75 border border-[var(--line)]/85 rounded-xl overflow-hidden text-[11px] mland:text-[9px]">
                  {lineDepth.map((row) => {
                    const lowDepth = row.ready < (row.pos === 'GK' ? 1 : 3);
                    return (
                      <button
                        key={row.pos}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setCondPosFilter((prev) => (prev === row.pos ? 'ALL' : row.pos));
                        }}
                        className={`w-full px-2.5 py-1.5 mland:px-2 mland:py-1 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                          condPosFilter === row.pos ? 'bg-[var(--g-soft)]/50' : 'hover:bg-[var(--surface-2)]/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <PositionBadge role={row.pos} size="2xs" />
                          <span className="font-bold text-[var(--ink)]">{row.total} คน</span>
                        </div>
                        <div className="flex items-center gap-2 tabular text-[10px] mland:text-[8.5px]">
                          <span className={lowDepth ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-[var(--g)] font-bold'}>
                            พร้อม {row.ready}
                          </span>
                          <span className="text-[var(--mut)]">·</span>
                          <span className={row.tired > 0 ? 'text-orange-600 dark:text-orange-300 font-semibold' : 'text-[var(--mut)]'}>
                            ล้า {row.tired}
                          </span>
                          <span className="text-[var(--mut)]">·</span>
                          <span className={row.out > 0 ? 'text-[var(--red)] font-bold' : 'text-[var(--mut)]'}>
                            พัก {row.out}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isMgr && (
                  <button
                    type="button"
                    disabled={restEligibleCount === 0}
                    onClick={handleRestAllFatigued}
                    className="btn btn-xs btn-secondary w-full justify-between disabled:opacity-45"
                  >
                    <span>😴 สั่งพักซ้อมคนล้า &lt;72% &amp; คนเจ็บ</span>
                    <span className="tabular font-extrabold">
                      {restEligibleCount > 0 ? `+${restEligibleCount} คน` : 'สั่งครบแล้ว'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== VIEW 2: SHIRT NUMBER & JERSEY LOCKER ==================== */
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_368px] mland:grid-cols-[1fr_290px] gap-2.5 mland:gap-2 overflow-y-auto md:overflow-hidden mland:overflow-hidden">
          {/* Left: Pro Dressing Room Locker Stalls */}
          <div className="min-h-[240px] md:min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 sm:p-3 mland:p-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mland:gap-1.5">
              {filteredPlayers.map((q) => {
                const no = getShirtNo(team, q);
                const isSelected = selectedPlayer?.n === q.n;
                const isStarter = starterNames.has(q.n);
                const isCap = team.cap === q.n;
                const isMe = Boolean(q.me || (!isMgr && state.p?.name === q.n));
                const isFav = isTeamFavoritePlayer(team, q.n);
                const qFavBoost = getActiveFavBoost(q, team, isMe ? state.p : null);

                return (
                  <button
                    key={q.n}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setSelectedName(q.n);
                    }}
                    className={`group text-left rounded-xl border transition-all cursor-pointer flex flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--g)] ${
                      isSelected
                        ? 'bg-[var(--g-soft)]/55 border-[var(--g)] ring-1 ring-[var(--g)]/55 shadow-sm'
                        : 'bg-[var(--surface-2)]/45 border-[var(--line)] hover:border-[var(--g)]/55 hover:bg-[var(--surface-2)]/75'
                    }`}
                  >
                    <div
                      className={`px-2 py-1 mland:px-1.5 mland:py-0.5 flex items-center justify-between gap-1 text-[10px] mland:text-[8.5px] tabular border-b ${
                        isSelected
                          ? 'bg-[var(--g)]/12 border-[var(--g)]/30'
                          : 'bg-[var(--surface)]/75 border-[var(--line)]/70'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <PositionBadge role={q.ro} size="2xs" />
                        <span className={`truncate font-medium ${isStarter ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                          {isStarter ? 'ตัวจริง' : 'สำรอง'}
                        </span>
                      </span>
                      <OvrBadge
                        ov={q.ov + qFavBoost}
                        boost={qFavBoost}
                        size="xs"
                        title={qFavBoost > 0 ? `OVR ${q.ov} + ลูกรัก ${qFavBoost} = ${q.ov + qFavBoost}` : undefined}
                      />
                    </div>

                    <div className="relative mx-2 mt-2 mland:mx-1.5 mland:mt-1.5 rounded-lg border border-white/12 pt-[18px] pb-2 mland:pt-[14px] mland:pb-1.5 px-2 flex items-center justify-center overflow-hidden shadow-inner">
                      <LockerCabinDecor selected={isSelected} />
                      <div className="relative z-10 shrink-0 mt-0.5 [&>svg]:w-[54px] [&>svg]:h-[54px] mland:[&>svg]:w-[42px] mland:[&>svg]:h-[42px] transition-transform duration-150 group-hover:scale-[1.03]">
                        <KitJersey
                          club={clubIdentity}
                          away={kitSide === 'away'}
                          size={54}
                          team={team}
                          state={state}
                          shirtNo={no}
                          isGK={q.pos === 'GK'}
                        />
                      </div>
                      <div className="absolute bottom-2 right-1.5 mland:bottom-1.5 mland:right-1 z-20 w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-full bg-[#0b1114]/95 border border-white/25 shadow-md flex items-center justify-center overflow-hidden [&>svg]:w-[28px] [&>svg]:h-[30px] mland:[&>svg]:w-[22px] mland:[&>svg]:h-[24px]">
                        <PlayerFace player={{ ...q, no }} team={team} state={state} size={28} />
                      </div>
                    </div>

                    <div className="px-2 py-1.5 mland:px-1.5 mland:py-1 flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate flex items-center gap-1 min-w-0">
                        <span className="truncate">{q.n}</span>
                        {isCap ? <CaptainBadge team={team} state={state} size="xs" className="shrink-0" /> : null}
                        {isFav ? (
                          <span
                            title={qFavBoost > 0 ? `ลูกรักประจำทีม (+${qFavBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม (รอใจ/กาย ≥ 72)'}
                            className={`inline-flex items-center text-[9.5px] mland:text-[8px] font-extrabold leading-none tabular shrink-0 ${
                              qFavBoost > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-rose-500/80 dark:text-rose-400/80'
                            }`}
                          >
                            {qFavBoost > 0 ? `💖+${qFavBoost}` : '💖'}
                          </span>
                        ) : null}
                        {isMe ? (
                          <span className="text-[#9a6700] dark:text-[var(--lamp)] shrink-0" title="ตัวคุณ">
                            ★
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`text-xs mland:text-[10px] font-extrabold font-display tabular shrink-0 ${
                          isSelected ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                        }`}
                      >
                        #{no}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {!filteredPlayers.length && (
              <div className="py-12 text-center text-xs text-[var(--mut)]">
                ไม่มีนักเตะในหมวดหมู่นี้
              </div>
            )}
          </div>

          {/* Right: Selected Locker Spotlight & 1–99 Number Assignment */}
          <div className="min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 sm:p-3 mland:p-1.5 flex flex-col gap-2 mland:gap-1">
            {selectedPlayer ? (
              <>
                <div className="shrink-0 flex items-center gap-2.5 mland:gap-2 pb-2 mland:pb-1 border-b border-[var(--line)]">
                  <div className="relative shrink-0">
                    <div className="relative rounded-xl mland:rounded-lg border border-white/12 pt-[16px] pb-1.5 px-2 mland:pt-[13px] mland:pb-1 mland:px-1.5 flex items-center justify-center overflow-hidden shadow-inner">
                      <LockerCabinDecor selected compact />
                      <div className="relative z-10 mt-0.5 [&>svg]:w-[52px] [&>svg]:h-[52px] mland:[&>svg]:w-[38px] mland:[&>svg]:h-[38px]">
                        <KitJersey
                          club={clubIdentity}
                          away={kitSide === 'away'}
                          size={52}
                          team={team}
                          state={state}
                          shirtNo={selectedNo}
                          isGK={selectedPlayer.pos === 'GK'}
                        />
                      </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 z-20 w-7 h-7 mland:w-5.5 mland:h-5.5 rounded-full bg-[#0b1114] border border-white/25 shadow-md flex items-center justify-center overflow-hidden [&>svg]:w-[24px] [&>svg]:h-[26px] mland:[&>svg]:w-[18px] mland:[&>svg]:h-[20px]">
                      <PlayerFace player={{ ...selectedPlayer, no: selectedNo }} team={team} state={state} size={24} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    {(() => {
                      const isSelectedFav = isTeamFavoritePlayer(team, selectedPlayer.n);
                      const selBoost = getActiveFavBoost(selectedPlayer, team, isSelectedMe ? state.p : null);
                      return (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm mland:text-[10.5px] font-extrabold font-display text-[var(--ink)] truncate flex items-center gap-1 leading-tight">
                              <span className="truncate">{selectedPlayer.n}</span>
                              {team.cap === selectedPlayer.n ? (
                                <CaptainBadge team={team} state={state} size="sm" className="shrink-0" />
                              ) : null}
                              {isSelectedFav ? (
                                <span
                                  title={selBoost > 0 ? `ลูกรักประจำทีม (+${selBoost} OVR ชั่วคราว)` : 'ลูกรักประจำทีม (รอใจ/กาย ≥ 72)'}
                                  className={`inline-flex items-center text-[10px] mland:text-[8.5px] font-extrabold leading-none tabular shrink-0 ${
                                    selBoost > 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-rose-500/80 dark:text-rose-400/80'
                                  }`}
                                >
                                  {selBoost > 0 ? `💖+${selBoost}` : '💖'}
                                </span>
                              ) : null}
                              {isSelectedMe ? (
                                <span className="text-[#9a6700] dark:text-[var(--lamp)] shrink-0">★</span>
                              ) : null}
                            </div>
                            <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate tabular mt-0.5 leading-tight flex items-center gap-1">
                              <PositionBadge role={selectedPlayer.ro} size="2xs" />
                              <span className={isSelectedStarter ? 'text-[var(--g)] font-semibold' : ''}>
                                {isSelectedStarter ? 'ตัวจริง' : 'สำรอง'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>อายุ {selectedPlayer.age}</span>
                              <span aria-hidden="true">·</span>
                              <OvrBadge
                                ov={selectedPlayer.ov + selBoost}
                                boost={selBoost}
                                size="xs"
                                prefix="OVR"
                                title={selBoost > 0 ? `OVR ${selectedPlayer.ov} + ลูกรัก ${selBoost} = ${selectedPlayer.ov + selBoost}` : undefined}
                              />
                            </div>
                          </div>

                          <div className="shrink-0 text-right leading-none">
                            <div className="text-lg sm:text-xl mland:text-sm font-extrabold font-display tabular text-[var(--g)]">
                              #{selectedNo}
                            </div>
                            <div className="text-[9px] mland:text-[7.5px] text-[var(--mut)] mt-0.5">
                              {kitSide === 'home' ? 'ชุดเหย้า' : 'ชุดเยือน'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        onInspectPlayer(selectedPlayer, team);
                      }}
                      className="inline-flex items-center gap-1 text-[10.5px] mland:text-[8.5px] font-bold text-[var(--g)] hover:underline cursor-pointer"
                    >
                      <span>เปิดการ์ดข้อมูลนักเตะ</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {shirtGuide && quickRecommendedNumbers.length > 0 && (
                  <div className="shrink-0 pb-2 mland:pb-1 border-b border-[var(--line)]/80 space-y-1 mland:space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-[10.5px] mland:text-[8.5px] leading-tight">
                      <span className="font-bold text-[var(--ink)] truncate">{shirtGuide.label}</span>
                      <span className="text-[var(--mut)] shrink-0">เบอร์แนะนำตำแหน่ง</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {quickRecommendedNumbers.map((num) => {
                        const holder = numberHolderMap.get(num);
                        const isCurrent = holder?.n === selectedPlayer.n || num === selectedNo;
                        const isTaken = Boolean(holder && !isCurrent);
                        const isPrimary = primaryRecSet.has(num);

                        return (
                          <button
                            key={num}
                            type="button"
                            disabled={!canEditSelected || isCurrent}
                            onClick={() => handleAssignNumber(selectedPlayer, num)}
                            title={
                              isCurrent
                                ? `ใช้อยู่แล้ว (#${num})`
                                : isTaken
                                  ? `สลับกับ ${holder!.n} (#${num})`
                                  : `เลือกเบอร์ #${num}`
                            }
                            className={`h-6 mland:h-4.5 px-2 mland:px-1.5 rounded-md border text-[10.5px] mland:text-[8.5px] font-extrabold tabular inline-flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-default ${
                              isCurrent
                                ? 'bg-[var(--g)] border-[var(--g)] text-white'
                                : isTaken
                                  ? 'bg-[var(--lamp-soft)]/50 border-[var(--lamp)]/60 text-[var(--ink)] hover:bg-[var(--lamp-soft)]/85 disabled:opacity-45'
                                  : isPrimary
                                    ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)] hover:bg-[var(--g)] hover:text-white disabled:opacity-45'
                                    : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                            }`}
                          >
                            <span>#{num}</span>
                            {isTaken && <ArrowLeftRight className="w-2.5 h-2.5 opacity-80" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col gap-1.5 mland:gap-1">
                  <div className="shrink-0 flex items-center justify-between gap-2">
                    <span className="text-[11px] mland:text-[9px] font-bold text-[var(--ink)] whitespace-nowrap">
                      เลือกเบอร์เสื้อ (1–99)
                    </span>
                    <div className="seg-bar grid grid-cols-4 flex-1 max-w-[228px]">
                      {NUMBER_PAGES.map((pg, idx) => {
                        const active = numPage === idx;
                        const containsCurrent = selectedNo >= pg.start && selectedNo <= pg.end;
                        return (
                          <button
                            key={pg.label}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              setNumPage(idx);
                            }}
                            className={`seg-btn px-1! py-0.5! text-[10px] mland:text-[8px] tabular whitespace-nowrap ${
                              active ? 'seg-btn-active' : containsCurrent ? 'text-[var(--g)]! font-extrabold!' : ''
                            }`}
                            title={`หน้า ${idx + 1}: เบอร์ ${pg.label}${containsCurrent ? ' (เบอร์ปัจจุบันอยู่ในหน้านี้)' : ''}`}
                          >
                            {pg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 max-h-[245px] mland:max-h-none grid grid-cols-5 grid-rows-5 gap-1.5 mland:gap-1">
                    {activePageSpec.nums.map((num) => {
                      const holder = numberHolderMap.get(num);
                      const isCurrent = holder?.n === selectedPlayer.n;
                      const isTaken = Boolean(holder && !isCurrent);
                      const isPrimaryRec = primaryRecSet.has(num);
                      const isAltRec = !isPrimaryRec && altRecSet.has(num);
                      const holderShort = holder ? holder.n.split(' ')[0] : '';

                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={!canEditSelected || isCurrent}
                          onClick={() => handleAssignNumber(selectedPlayer, num)}
                          title={
                            isCurrent
                              ? `เบอร์ปัจจุบันของ ${selectedPlayer.n}`
                              : isTaken
                                ? `เบอร์ #${num} เป็นของ ${holder!.n} (${holder!.ro}) — แตะเพื่อสลับ`
                                : `เบอร์ #${num} ว่าง${isPrimaryRec || isAltRec ? ' (เบอร์แนะนำประจำตำแหน่ง)' : ''} — แตะเพื่อเลือก`
                          }
                          className={`relative min-h-[34px] md:min-h-0 mland:min-h-0 h-full rounded-lg mland:rounded-md border px-1 transition-colors cursor-pointer disabled:cursor-default flex flex-col items-center justify-center leading-none ${
                            isCurrent
                              ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-xs'
                              : isTaken
                                ? 'bg-[var(--lamp-soft)]/50 border-dashed border-[var(--lamp)]/65 text-[var(--ink)] hover:border-[var(--lamp)] hover:bg-[var(--lamp-soft)]/85 disabled:opacity-45'
                                : isPrimaryRec
                                  ? 'bg-[var(--g-soft)]/45 border-[var(--g)]/55 text-[var(--ink)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/75 disabled:opacity-45'
                                  : isAltRec
                                    ? 'bg-[var(--surface-2)]/70 border-[var(--g)]/35 text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                                    : 'bg-[var(--surface-2)]/35 border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)] hover:text-[var(--g)] disabled:opacity-45'
                          }`}
                        >
                          <span className="text-xs mland:text-[9px] font-extrabold tabular">{num}</span>
                          {isCurrent ? (
                            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] mland:text-[6.5px] font-bold text-white/95">
                              <Check className="w-2.5 h-2.5 mland:w-2 mland:h-2" />
                            </span>
                          ) : isTaken ? (
                            <span className="mt-0.5 text-[8px] mland:text-[6px] font-semibold text-[#855800] dark:text-[var(--lamp)] truncate max-w-full">
                              ⇄ {holderShort}
                            </span>
                          ) : isPrimaryRec || isAltRec ? (
                            <span className="mt-0.5 text-[8px] mland:text-[6px] font-bold text-[var(--g)]">
                              แนะนำ
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-[var(--mut)]">
                เลือกนักเตะจากล็อกเกอร์เพื่อจัดการเบอร์เสื้อ
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
