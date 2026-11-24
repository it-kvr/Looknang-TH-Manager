import React, { useState } from 'react';
import { PWAInstallButton } from '../pwa.tsx';
import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, PlayerCareerProfile, GameState, PlayerArchetype } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { ATT, SPX, SPN, ROLE_HINT, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, FOOTBALL_TRAITS, TRAIT_BY_ID, ROLE_BASE_ATTRS, PLAYER_ARCHETYPES, NG, SFX0, KIT_P } from '../data/thaiFootballData';
import { SFX, unlockAudio } from '../utils/audioTheme';
import { genPlayerName, clearNamePool, genClubNames, NSL, loadGameFromSlot, deleteSlot, firstEmptySlot, mkTeam, OVF, dtInfo, rollPlayerTraits } from '../engine/playerCore';
import { cleanImportJson } from '../engine/saveCodec';
import { ovColor, statBarColor } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { enterAutoMobileFullscreen } from '../utils/fullscreen';
import stadiumHeroBg from '../assets/images/thai_stadium_hero_1795511663761.jpg';
import type { ClubIdentity } from '../types/game';

interface StarPosterCard {
  id: string;
  name: string;
  pos: SubRole;
  no: number;
  ov: number;
  clubName: string;
  sourceLabel: string;
  archLabel: string;
  attrs: CoreAttrs;
  kit1: string;
  kit2: string;
  player: Partial<Player>;
  team?: Team | null;
  club?: ClubIdentity | null;
  profile?: PlayerCareerProfile | null;
}

const STAR_CLUB_PRESETS: Array<{ name: string; kit: [string, string]; pos: Position; sp: SubRole; no: number; archId: string }> = [
  { name: `${NG[2][0]} ${SFX0[2][0]}`, kit: KIT_P[0], pos: 'FW', sp: 'ST', no: 9, archId: 'poacher' },
  { name: `${NG[2][1]} ${SFX0[2][5]}`, kit: KIT_P[1], pos: 'MF', sp: 'CAM', no: 10, archId: 'maestro' },
  { name: `${NG[2][2]} ${SFX0[2][6]}`, kit: KIT_P[2], pos: 'FW', sp: 'LW', no: 7, archId: 'winger' },
  { name: `${NG[2][7]} ${SFX0[2][8]}`, kit: KIT_P[3], pos: 'MF', sp: 'CM', no: 8, archId: 'b2b' },
  { name: `${NG[2][9]} ${SFX0[2][9]}`, kit: KIT_P[4], pos: 'DF', sp: 'CB', no: 4, archId: 'destroyer' },
  { name: `${NG[2][12]} ${SFX0[2][1]}`, kit: KIT_P[5], pos: 'GK', sp: 'GK', no: 1, archId: 'sweeper_gk' },
  { name: `${NG[2][20]} ${SFX0[2][3]}`, kit: KIT_P[7], pos: 'FW', sp: 'RW', no: 11, archId: 'cannon' },
  { name: `${NG[2][14]} ${SFX0[2][7]}`, kit: KIT_P[13], pos: 'DF', sp: 'RB', no: 2, archId: 'fullback' }
];

function buildStarPosterPool(): StarPosterCard[] {
  const pool: StarPosterCard[] = [];

  // Pull real stars from saved Manager & Player Career slots if available
  for (let k = 1; k <= NSL; k++) {
    const ms = loadGameFromSlot('m', k);
    if (ms && Array.isArray(ms.teams)) {
      const meT = ms.teams[ms.me];
      const top = meT?.sq?.slice().sort((a, b) => b.ov - a.ov)[0];
      if (meT && top) {
        const clubName = ms.club?.name || meT.name;
        const kit1 = ms.club?.c1 || meT.kc?.[0] || '#158049';
        const kit2 = ms.club?.c2 || meT.kc?.[1] || '#f5c242';
        pool.push({
          id: `save_m_${k}`,
          name: top.n,
          pos: top.ro,
          no: top.no || 10,
          ov: top.ov,
          clubName,
          sourceLabel: `สตาร์จากเซฟ #${k}`,
          archLabel: `${SPN[top.ro] || top.ro} · อายุ ${top.age} ปี`,
          attrs: top.customA || dtInfo(top).a,
          kit1,
          kit2,
          player: top,
          team: meT,
          club: ms.club || null
        });
      }
    }
    const ps = loadGameFromSlot('p', k);
    if (ps && ps.p && Array.isArray(ps.teams)) {
      const meT = ps.teams[ps.me];
      const mePl = meT?.sq?.find((q) => q.me);
      const attrs = ps.p.a || ROLE_BASE_ATTRS(ps.p.pos, ps.p.sp);
      const ov = mePl?.ov || OVF(ps.p.pos, attrs);
      pool.push({
        id: `save_p_${k}`,
        name: ps.p.name,
        pos: ps.p.sp,
        no: ps.p.no || 10,
        ov,
        clubName: meT?.name || 'ทีมชาติไทย',
        sourceLabel: `นักเตะของคุณ #${k}`,
        archLabel: ps.p.archName || SPN[ps.p.sp] || ps.p.sp,
        attrs,
        kit1: meT?.kc?.[0] || ps.p.c || '#158049',
        kit2: meT?.kc?.[1] || '#f5c242',
        player: mePl || { n: ps.p.name, pos: ps.p.pos, ro: ps.p.sp, no: ps.p.no, me: 1 },
        team: meT || null,
        profile: ps.p
      });
    }
  }

  // Add randomized Thai League Division 1 stars from in-game archetypes & clubs
  STAR_CLUB_PRESETS.forEach((preset, idx) => {
    const arch = PLAYER_ARCHETYPES.find((a) => a.id === preset.archId) || PLAYER_ARCHETYPES.find((a) => a.pos.includes(preset.pos)) || PLAYER_ARCHETYPES[0];
    const base = ROLE_BASE_ATTRS(preset.pos, preset.sp);
    const attrs: CoreAttrs = {
      sh: clamp(base.sh + (arch.coreBonus.sh || 0) + (preset.pos === 'FW' ? 22 : preset.pos === 'MF' ? 16 : 8), 35, 92),
      ps: clamp(base.ps + (arch.coreBonus.ps || 0) + (preset.pos === 'MF' ? 24 : 15), 38, 92),
      dr: clamp(base.dr + (arch.coreBonus.dr || 0) + (preset.pos === 'FW' || preset.pos === 'MF' ? 21 : 12), 34, 92),
      tk: clamp(base.tk + (arch.coreBonus.tk || 0) + (preset.pos === 'DF' || preset.pos === 'GK' ? 22 : 10), 32, 92),
      ph: clamp(base.ph + (arch.coreBonus.ph || 0) + 18, 45, 92)
    };
    const ov = OVF(preset.pos, attrs);
    const starName = genPlayerName();
    const teamStub: Team = {
      id: 900 + idx,
      name: preset.name,
      tier: 2,
      pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, p: 0,
      form: '4-3-3',
      tac: 'B',
      kc: preset.kit,
      sq: []
    };
    pool.push({
      id: `league_star_${idx}`,
      name: starName,
      pos: preset.sp,
      no: preset.no,
      ov,
      clubName: preset.name,
      sourceLabel: 'ซูเปอร์สตาร์ลีกสูงสุด',
      archLabel: `${arch.icon} ${arch.name}`,
      attrs,
      kit1: preset.kit[0],
      kit2: preset.kit[1],
      player: {
        n: starName,
        pos: preset.pos,
        ro: preset.sp,
        no: preset.no,
        ov,
        age: 21 + (idx % 6),
        vis: [idx % 5, idx % 5, idx % 8, idx % 2 === 0 ? 0 : idx % 4, idx % 4, preset.no, idx % 3]
      },
      team: teamStub
    });
  });

  return pool;
}

export const MainMenu: React.FC<{
  onStartManager: (slot: number, names: string[][], t0: Team[], pick: number, diff: number) => void;
  onStartPlayer: (slot: number, profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>) => void;
  onLoadSave: (mode: GameMode, slot: number, state: GameState) => void;
  onToast: (msg: string) => void;
  onStepChange?: (step: 'menu' | 'ms' | 'cr') => void;
}> = ({ onStartManager, onStartPlayer, onLoadSave, onToast, onStepChange }) => {
  const [step, setStep] = useState<'menu' | 'ms' | 'cr'>('menu');
  const goStep = (next: 'menu' | 'ms' | 'cr') => {
    setStep(next);
    onStepChange?.(next);
    if (next !== 'menu') {
      enterAutoMobileFullscreen().catch(() => undefined);
    }
  };
  const [targetSlot, setTargetSlot] = useState<number>(1);
  const [previewClubs, setPreviewClubs] = useState<{ names: string[][]; t0: Team[] } | null>(null);
  const [diff, setDiff] = useState<number>(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, setRefresh] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [crMobTab, setCrMobTab] = useState<'info' | 'face' | 'arch' | 'stats'>('info');
  const [starPoster, setStarPoster] = useState<{ pool: StarPosterCard[]; idx: number }>(() => {
    const pool = buildStarPosterPool();
    return { pool, idx: Math.floor(Math.random() * Math.max(1, pool.length)) };
  });
  const starPool = starPoster.pool;
  const starIdx = starPoster.idx;
  const countSaves = (m: GameMode) => {
    let n = 0;
    for (let k = 1; k <= NSL; k++) {
      const d = loadGameFromSlot(m, k);
      if (d && Array.isArray(d.teams) && (m === 'm' || d.p)) n++;
    }
    return n;
  };

  const rollFaceTraits = () => ({
    c: P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111']),
    k: P(SKIN_P),
    h: P(HAIR_P),
    hs: R(0, 7),
    fh: R(0, 3),
    fs: R(0, 2),
    ey: R(0, 3)
  });

  const defaultNoForPos = (pos: Position) => (pos === 'GK' ? 1 : pos === 'DF' ? 4 : pos === 'MF' ? 8 : 10);

  const [cName, setCName] = useState('');
  const [cPos, setCPos] = useState<Position>('FW');
  const [cSp, setCSp] = useState<SubRole>('ST');
  const [cNo, setCNo] = useState<number>(10);
  const [cArchId, setCArchId] = useState<string>('poacher');
  const [cColor, setCColor] = useState(() => P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111']));
  const [cSkin, setCSkin] = useState(() => P(SKIN_P));
  const [cHair, setCHair] = useState(() => P(HAIR_P));
  const [cHs, setCHs] = useState(() => R(0, 7));
  const [cFh, setCFh] = useState(() => R(0, 3));
  const [cFs, setCFs] = useState(() => R(0, 2));
  const [cEy, setCEy] = useState(() => R(0, 3));
  const [faceChoices, setFaceChoices] = useState(() => Array.from({ length: 6 }, rollFaceTraits));
  const [cSubMap, setCSubMap] = useState<Record<string, number>>({});
  const [cBase, setCBase] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));
  const [cAttrs, setCAttrs] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));
  const [cTalent, setCTalent] = useState<number>(() => R(62, 93));
  const [cTraits, setCTraits] = useState<string[]>(() => rollPlayerTraits('FW', 'ST', 55, 78));

  const computeBaseWithArch = (pos: Position, sp: SubRole, arch: PlayerArchetype): CoreAttrs => {
    const base = ROLE_BASE_ATTRS(pos, sp);
    (Object.keys(arch.coreBonus) as StatKey[]).forEach((k) => {
      base[k] = clamp(base[k] + (arch.coreBonus[k] || 0), 10, 99);
    });
    return base;
  };

  const rollStartingStats = (pos: Position, sp: SubRole, arch: PlayerArchetype) => {
    const base = computeBaseWithArch(pos, sp, arch);
    const attrs: CoreAttrs = { ...base };

    // Weighted pool for 12 random core points based on position + archetype
    const posCorePool: Record<Position, StatKey[]> = {
      FW: ['sh', 'sh', 'sh', 'dr', 'dr', 'ps', 'ph'],
      MF: ['ps', 'ps', 'ps', 'dr', 'dr', 'sh', 'tk', 'ph'],
      DF: ['tk', 'tk', 'tk', 'ph', 'ph', 'ps', 'dr'],
      GK: ['ph', 'ph', 'ph', 'tk', 'tk', 'ps']
    };
    const corePool: StatKey[] = [...posCorePool[pos], arch.tr, arch.tr];
    (Object.keys(arch.autoCorePts) as StatKey[]).forEach((k) => {
      const w = arch.autoCorePts[k] || 0;
      for (let i = 0; i < Math.ceil(w / 2); i++) corePool.push(k);
    });
    for (let i = 0; i < 12; i++) {
      const avail = corePool.filter((k) => attrs[k] < 99);
      if (!avail.length) break;
      const pick = P(avail);
      attrs[pick] = clamp(attrs[pick] + 1, 10, 99);
    }

    // Weighted pool for 8 random detailed sub-stat points
    const subPoolKeys: string[] =
      pos === 'GK'
        ? ['sv', 'sv', 'cl', 'cl', 'dist', 'comp', 'sta', 'tol', 'rec']
        : pos === 'FW'
          ? ['fin', 'fin', 'pw', 'cur', 'run', 'spd', 'crs', 'hd', 'str', 'sta', 'comp']
          : pos === 'MF'
            ? ['crs', 'cur', 'rd', 'run', 'fin', 'pw', 'pos', 'mrk', 'spd', 'sta', 'comp', 'rec']
            : ['pos', 'pos', 'rd', 'rd', 'mrk', 'mrk', 'blk', 'blk', 'hd', 'str', 'spd', 'crs', 'sta', 'tol', 'comp'];
    const subPool = [
      ...subPoolKeys,
      arch.sig,
      arch.sig,
      arch.sig,
      ...Object.keys(arch.sbBonus).flatMap((k) => [k, k]),
      ...Object.keys(arch.autoSubPts).flatMap((k) => [k, k])
    ];
    const subMap: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      const pick = P(subPool);
      if ((subMap[pick] || 0) < 8) {
        subMap[pick] = (subMap[pick] || 0) + 1;
      } else {
        const alt = P(subPoolKeys);
        subMap[alt] = (subMap[alt] || 0) + 1;
      }
    }
    return { base, attrs, subMap };
  };

  const openManagerSetup = (slot: number) => {
    if (!slot) {
      onToast('เซฟเต็ม กรุณาลบเซฟเก่าก่อน');
      return;
    }
    SFX.tap();
    clearNamePool();
    const names = genClubNames();
    const t0 = names[0].map((n, i) => mkTeam(n, 0, i));
    setTargetSlot(slot);
    setPreviewClubs({ names, t0 });
    goStep('ms');
  };

  const applyFaceTraits = (f: ReturnType<typeof rollFaceTraits>) => {
    setCColor(f.c);
    setCSkin(f.k);
    setCHair(f.h);
    setCHs(f.hs);
    setCFh(f.fh);
    setCFs(f.fs);
    setCEy(f.ey);
  };

  const openPlayerSetup = (slot: number) => {
    if (!slot) {
      onToast('เซฟเต็ม กรุณาลบเซฟเก่าก่อน');
      return;
    }
    SFX.tap();
    setTargetSlot(slot);
    const defaultArch = PLAYER_ARCHETYPES.find((a) => a.pos.includes('FW'))!;
    const rolled = rollStartingStats('FW', 'ST', defaultArch);
    const initTalent = R(62, 93);
    const initOv = OVF('FW', rolled.attrs);
    const gallery = Array.from({ length: 6 }, rollFaceTraits);
    setFaceChoices(gallery);
    applyFaceTraits(gallery[0]);
    setCPos('FW');
    setCSp('ST');
    setCNo(defaultNoForPos('FW'));
    setCArchId(defaultArch.id);
    setCBase(rolled.base);
    setCAttrs(rolled.attrs);
    setCSubMap(rolled.subMap);
    setCTalent(initTalent);
    setCTraits(rollPlayerTraits('FW', 'ST', initOv, initTalent));
    goStep('cr');
  };

  const handleDeleteSlot = (mode: GameMode, k: number) => {
    const key = `${mode}_${k}`;
    if (confirmDel === key) {
      deleteSlot(mode, k);
      setConfirmDel(null);
      setRefresh((x) => x + 1);
      onToast('ลบเซฟเรียบร้อย');
    } else {
      setConfirmDel(key);
      setTimeout(() => setConfirmDel((cur) => (cur === key ? null : cur)), 3000);
    }
  };

  const handleImport = () => {
    const parsed = cleanImportJson(importText);
    if (!parsed) {
      onToast('โค้ดเซฟไม่ถูกต้อง');
      return;
    }
    const slot = firstEmptySlot(parsed.mode) || 1;
    onLoadSave(parsed.mode, slot, parsed);
    setShowImport(false);
    onToast(`นำเข้าเซฟลงสล็อต ${slot} แล้ว`);
  };

  const renderSlotList = (m: GameMode) => {
    const rows: React.ReactNode[] = [];
    let shownEmpty = false;
    const isMgr = m === 'm';
    for (let k = 1; k <= NSL; k++) {
      const d = loadGameFromSlot(m, k);
      if (d && Array.isArray(d.teams) && (isMgr || d.p)) {
        const meTeam = d.teams[d.me] || null;
        const name = isMgr ? d.club?.name || meTeam?.name || 'สโมสร' : d.p?.name || 'นักเตะ';
        const mePlayer = !isMgr && d.p
          ? meTeam?.sq?.find((q) => q.me) || { n: d.p.name, pos: d.p.pos, ro: d.p.sp, no: d.p.no, me: 1 }
          : null;
        const delKey = `${m}_${k}`;
        const isConfirm = confirmDel === delKey;
        rows.push(
          <div key={k} className="flex items-center gap-1.5 mland:gap-1">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onLoadSave(m, k, d);
              }}
              className="group flex-1 min-w-0 min-h-[48px] mland:min-h-[42px] text-left px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/75 hover:bg-[var(--surface-2)] hover:border-[var(--g)] transition-colors cursor-pointer flex items-center gap-2.5 mland:gap-2"
            >
              <div className="shrink-0 w-9 h-9 mland:w-8 mland:h-8 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 flex items-center justify-center overflow-hidden">
                {isMgr ? (
                  <div className="[&>svg]:w-7 [&>svg]:h-7 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                    <ClubCrest name={name} size={28} team={meTeam} club={d.club} isMyClub />
                  </div>
                ) : (
                  <div className="[&>svg]:w-8 [&>svg]:h-8 mland:[&>svg]:w-7 mland:[&>svg]:h-7 flex items-center justify-center">
                    <PlayerFace player={mePlayer} team={meTeam} state={d} careerProfile={d.p} size={32} bare />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight text-[var(--ink)] flex items-center gap-1.5">
                  <span className={`font-display tabular shrink-0 ${isMgr ? 'text-[#a16c00] dark:text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
                    #{k}
                  </span>
                  <span className="truncate">{name}</span>
                </div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate tabular leading-tight mt-0.5">
                  ซีซัน {d.season} · นัด {d.md}/{d.fx?.length || 30}
                  {!isMgr && d.p ? ` · ${d.p.pos}${meTeam ? ` · ${meTeam.name}` : ''}` : ''}
                </div>
              </div>

              <span className="text-xs font-bold text-[var(--mut)] group-hover:text-[var(--g)] shrink-0 transition-colors" aria-hidden="true">
                ▶
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteSlot(m, k)}
              aria-label="ลบเซฟ"
              className={`min-h-[48px] mland:min-h-[42px] px-2.5 mland:px-2 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer transition-colors shrink-0 ${
                isConfirm
                  ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50'
              }`}
            >
              {isConfirm ? 'ลบ?' : '🗑'}
            </button>
          </div>
        );
      } else if (!shownEmpty) {
        shownEmpty = true;
        rows.push(
          <button
            key={k}
            type="button"
            onClick={() => (isMgr ? openManagerSetup(k) : openPlayerSetup(k))}
            className="w-full min-h-[48px] mland:min-h-[42px] text-left px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg border border-dashed border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/45 transition-colors cursor-pointer flex items-center gap-2.5 mland:gap-2"
          >
            <div className="shrink-0 w-9 h-9 mland:w-8 mland:h-8 rounded-lg bg-[var(--surface-2)]/70 border border-dashed border-[var(--line)] flex items-center justify-center text-sm mland:text-xs font-bold text-[var(--mut)]">
              ＋
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs mland:text-[10.5px] truncate leading-tight text-[var(--ink)]">
                เปิดเซฟช่อง {k}
              </div>
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight mt-0.5 truncate">
                {isMgr ? 'เริ่มคุมสโมสรใหม่' : 'สร้างนักเตะอาชีพใหม่'}
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--mut)] shrink-0" aria-hidden="true">›</span>
          </button>
        );
      }
    }
    return <div className="flex flex-col gap-1.5 mland:gap-1">{rows}</div>;
  };

  if (step === 'ms' && previewClubs) {
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md safe-top safe-x">
          <div className="max-w-5xl mx-auto px-3 sm:px-5 mland:px-3 py-2 mland:py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base mland:text-sm font-bold font-display truncate">🏟️ เลือกสโมสรเริ่มต้น</h2>
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                เริ่มจากลีกระดับจังหวัด · แก้ไขชื่อ ตรา และชุดได้ภายหลัง
              </p>
            </div>
            <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
                {(['ง่าย', 'ปกติ', 'ยาก'] as const).map((lbl, idx) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => { SFX.tap(); setDiff(idx); }}
                    className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg mland:rounded-md text-xs mland:text-[10.5px] font-semibold cursor-pointer transition-colors ${
                      diff === idx ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => goStep('menu')}
                className="px-3 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[11px] font-semibold cursor-pointer hover:border-[var(--g)]"
              >
                ‹ กลับ
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto safe-bottom safe-x flex items-center justify-center p-3 sm:p-4 mland:p-2">
          <div className="w-full max-w-5xl grid grid-cols-4 gap-2 mland:gap-1.5 my-auto">
            {previewClubs.t0.map((t, idx) => {
              const avg = Math.round(t.sq.reduce((sum, q) => sum + q.ov, 0) / t.sq.length);
              const tierTag = avg >= 42 ? 'เต็งลีก' : avg >= 39 ? 'กลางตาราง' : 'ท้าทาย';
              const accent = t.kc?.[0] || '#158049';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onStartManager(targetSlot, previewClubs.names, previewClubs.t0, idx, diff); }}
                  className="group flex items-center gap-2.5 mland:gap-1.5 p-2.5 mland:px-2 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--g)] hover:shadow-md active:scale-[0.985] text-left transition-all cursor-pointer shadow-xs min-w-0"
                >
                  <div className="relative p-1 mland:p-0.5 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/60 shrink-0 [&>svg]:w-8 [&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                    <ClubCrest name={t.name} size={32} team={t} />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 mland:w-2 mland:h-2 rounded-full border border-white dark:border-slate-900"
                      style={{ background: accent }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs mland:text-[10.5px] truncate leading-tight text-[var(--ink)]">{t.name}</div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">
                      <span className={`font-bold ${avg >= 42 ? 'text-[#8a5b00] dark:text-[var(--lamp)]' : avg >= 39 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                        {tierTag}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular">{t.sq.length} คน</span>
                    </div>
                  </div>
                  <span className="px-2 mland:px-1.5 py-0.5 rounded-lg mland:rounded-md text-white text-xs mland:text-[10px] font-bold tabular shrink-0 shadow-xs" style={{ background: ovColor(avg) }}>
                    {avg}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'cr') {
    const posArchs = PLAYER_ARCHETYPES.filter((a) => a.pos.includes(cPos));
    const curArch = posArchs.find((a) => a.id === cArchId) || posArchs[0];
    const combinedSb: Record<string, number> = { ...curArch.sbBonus };
    Object.entries(cSubMap).forEach(([k, v]) => {
      if (v) combinedSb[k] = (combinedSb[k] || 0) + v;
    });

    const ov = OVF(cPos, cAttrs);
    const previewPlayer: Player = {
      n: cName.trim() || 'นักเตะใหม่', pos: cPos, ro: cSp, ov, age: 17, pot: 92, talent: cTalent, traits: cTraits, fit: 100, inj: 0, no: cNo, me: 1
    };
    const previewProfile: PlayerCareerProfile = {
      name: cName.trim() || 'นักเตะใหม่', pos: cPos, sp: cSp, no: cNo, tr: curArch.tr, sig: curArch.sig, archName: `${curArch.icon} ${curArch.name}`,
      sb: combinedSb, c: cColor, k: cSkin, h: cHair, hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, b: cBase, a: cAttrs,
      talent: cTalent, traits: cTraits,
      age: 17, gl: 0, as: 0, ap: 0, rs: 0, en: 100, plan: 1
    };
    const previewDt = dtInfo(previewPlayer, previewProfile);
    const subStats = previewDt.G;
    const posTraits = FOOTBALL_TRAITS.filter((t) => t.pos.includes(cPos));

    const applyRolledStats = (pos: Position, sp: SubRole, arch: PlayerArchetype) => {
      const rolled = rollStartingStats(pos, sp, arch);
      setCBase(rolled.base);
      setCAttrs(rolled.attrs);
      setCSubMap(rolled.subMap);
      return rolled;
    };

    const changePosition = (pos: Position) => {
      SFX.tap();
      const sp = SPX[pos][0];
      const nextArch = PLAYER_ARCHETYPES.find((a) => a.pos.includes(pos))!;
      setCPos(pos);
      setCSp(sp);
      setCNo(defaultNoForPos(pos));
      setCArchId(nextArch.id);
      const rolled = applyRolledStats(pos, sp, nextArch);
      setCTraits(rollPlayerTraits(pos, sp, OVF(pos, rolled.attrs), cTalent));
    };

    const changeSubRole = (sp: SubRole) => {
      SFX.tap();
      setCSp(sp);
      const rolled = applyRolledStats(cPos, sp, curArch);
      setCTraits(rollPlayerTraits(cPos, sp, OVF(cPos, rolled.attrs), cTalent));
    };

    const changeArchetype = (arch: PlayerArchetype) => {
      SFX.tap();
      setCArchId(arch.id);
      applyRolledStats(cPos, cSp, arch);
    };

    const rerollStartingPoints = () => {
      SFX.tap();
      applyRolledStats(cPos, cSp, curArch);
    };

    const rerollTraits = () => {
      SFX.tap();
      setCTraits(rollPlayerTraits(cPos, cSp, ov, cTalent));
    };

    const toggleTrait = (id: string) => {
      SFX.tap();
      setCTraits((prev) => {
        if (prev.includes(id)) {
          return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
        }
        const def = TRAIT_BY_ID[id];
        const cleaned = prev.filter((pid) => {
          const pd = TRAIT_BY_ID[pid];
          return !def?.conflicts?.includes(pid) && !pd?.conflicts?.includes(id);
        });
        return [...cleaned, id].slice(-4);
      });
    };

    const randomizeFaceOnly = () => {
      SFX.tap();
      const next = rollFaceTraits();
      applyFaceTraits({ ...next, c: cColor });
    };

    const rerollFaceGallery = () => {
      SFX.tap();
      const nextGallery = Array.from({ length: 6 }, rollFaceTraits);
      setFaceChoices(nextGallery);
      applyFaceTraits(nextGallery[0]);
    };

    const randomizeAll = () => {
      SFX.tap();
      setCName(genPlayerName());
      const nextGallery = Array.from({ length: 6 }, rollFaceTraits);
      setFaceChoices(nextGallery);
      applyFaceTraits(nextGallery[0]);
      const rSp = P(SPX[cPos]);
      const rArch = P(posArchs);
      const nextTalent = R(58, 95);
      setCSp(rSp);
      setCArchId(rArch.id);
      setCTalent(nextTalent);
      const rolled = applyRolledStats(cPos, rSp, rArch);
      setCTraits(rollPlayerTraits(cPos, rSp, OVF(cPos, rolled.attrs), nextTalent));
    };

    const startCareerNow = () => {
      SFX.tap();
      onStartPlayer(targetSlot, {
        name: (cName || genPlayerName()).trim(), pos: cPos, sp: cSp, no: clamp(cNo || 10, 1, 99), tr: curArch.tr, sig: curArch.sig,
        archName: `${curArch.icon} ${curArch.name}`, sb: combinedSb, c: cColor, k: cSkin, h: cHair,
        hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, a: { ...cAttrs },
        talent: cTalent, traits: cTraits
      });
    };

    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        {/* Compact Landscape Header Bar */}
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md safe-top safe-x">
          <div className="max-w-5xl mx-auto px-3 sm:px-5 mland:px-3 py-2 mland:py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base mland:text-sm font-bold font-display truncate">⚽ สร้างนักเตะอาชีพ</h2>
              <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">เลือกตำแหน่ง สไตล์การเล่น และนิสัยลูกหนังเฉพาะตัว</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={randomizeFaceOnly}
                className="px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)] whitespace-nowrap"
              >
                🎭 สุ่มหน้า
              </button>
              <button
                type="button"
                onClick={randomizeAll}
                className="px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)] whitespace-nowrap"
              >
                🔄 สุ่มทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => goStep('menu')}
                className="px-3 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10.5px] font-semibold cursor-pointer hover:border-[var(--g)] whitespace-nowrap"
              >
                ‹ กลับ
              </button>
            </div>
          </div>
        </div>

        {/* Two-Column Landscape Studio Body */}
        <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-3 sm:px-5 mland:px-3 py-2.5 mland:py-1.5 grid grid-cols-[205px_1fr] md:grid-cols-[248px_1fr] mland:grid-cols-[205px_1fr] gap-3 mland:gap-2.5 overflow-hidden safe-bottom safe-x">
          {/* Left Column: Live Player Card + Primary CTA */}
          <div className="flex flex-col justify-between gap-2 mland:gap-1.5 min-h-0">
            <div
              className="flex-1 min-h-0 rounded-2xl p-3 mland:p-2 text-white border border-white/15 shadow-md flex flex-col justify-between gap-2 mland:gap-1 overflow-hidden"
              style={{ background: `linear-gradient(155deg, ${ovColor(ov)}, #0b1f15 78%)` }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-black/25 border border-white/15 text-[11px] mland:text-[9.5px] font-bold tracking-wide">
                  {cSp} · #{cNo}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-black/30 border border-white/20 text-lg mland:text-base font-extrabold font-display tabular leading-tight">
                  {ov}
                </span>
              </div>

              <div className="flex flex-col items-center text-center gap-1 mland:gap-0.5 my-auto">
                <div className="shrink-0 [&>svg]:w-[68px] [&>svg]:h-[68px] mland:[&>svg]:w-[48px] mland:[&>svg]:h-[48px]">
                  <PlayerFace player={previewPlayer} careerProfile={previewProfile} size={68} bare />
                </div>
                <div className="font-bold text-base mland:text-xs truncate w-full leading-tight">
                  {cName.trim() || 'นักเตะใหม่'}
                </div>
                <div className="text-[11px] mland:text-[9.5px] text-white/90 font-semibold truncate w-full">
                  {curArch.icon} {curArch.name} · พรสวรรค์ {cTalent}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1 w-full">
                  {cTraits.slice(0, 3).map((tid) => {
                    const tr = TRAIT_BY_ID[tid];
                    if (!tr) return null;
                    return (
                      <span
                        key={tid}
                        title={tr.desc}
                        className="px-1.5 py-0.5 rounded bg-black/25 border border-white/15 text-[9px] mland:text-[7.5px] text-white/95 font-semibold truncate max-w-full"
                      >
                        {tr.icon} {tr.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1 pt-2 mland:pt-1 border-t border-white/20 text-center">
                {ATT.map(([k, l]) => (
                  <div key={k}>
                    <div className="text-sm mland:text-xs font-extrabold tabular leading-tight">{cAttrs[k]}</div>
                    <div className="text-[9.5px] mland:text-[8px] opacity-80">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={startCareerNow}
              className="shrink-0 w-full py-2.5 mland:py-2 px-3 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs sm:text-sm mland:text-[11px] hover:brightness-105 transition-all cursor-pointer shadow-sm truncate"
            >
              ⚽ เริ่มอาชีพ ({cSp} · OVR {ov})
            </button>
          </div>

          {/* Right Column: 4-Tab Workspace */}
          <div className="flex flex-col min-h-0 gap-2 mland:gap-1.5">
            <div className="shrink-0 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
              {(
                [
                  ['info', '📝 ข้อมูล'],
                  ['face', '🎭 หน้าตา'],
                  ['arch', '✨ สไตล์ & นิสัย'],
                  ['stats', '📊 พลัง']
                ] as const
              ).map(([tid, tlbl]) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => { SFX.tap(); setCrMobTab(tid); }}
                  className={`py-1.5 mland:py-1 px-2 rounded-lg text-xs mland:text-[10.5px] font-bold cursor-pointer truncate transition-colors ${
                    crMobTab === tid ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tlbl}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-3.5 mland:p-2.5">
              {/* Tab 1: Info & Position */}
              <div className={`space-y-3 mland:space-y-2 ${crMobTab === 'info' ? '' : 'hidden'}`}>
                <div className="flex items-center gap-2">
                  <input
                    value={cName}
                    onChange={(e) => setCName(e.target.value.replace(/["'<>`]/g, ''))}
                    placeholder="กรอกชื่อนักเตะ (เว้นว่างจะสุ่มให้)"
                    maxLength={22}
                    className="flex-1 min-w-0 px-3 py-2 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm mland:text-xs"
                  />
                  <div className="flex items-center gap-1 px-2.5 py-1.5 mland:py-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] shrink-0">
                    <span className="text-xs text-[var(--mut)] font-semibold">#</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      aria-label="หมายเลขเสื้อ"
                      value={cNo}
                      onChange={(e) => setCNo(clamp(parseInt(e.target.value, 10) || 1, 1, 99))}
                      className="w-10 bg-transparent text-sm mland:text-xs font-bold text-center tabular focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setCName(genPlayerName()); }}
                    className="px-3 py-2 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold shrink-0 cursor-pointer hover:border-[var(--g)]"
                  >
                    🔄 สุ่มชื่อ
                  </button>
                </div>

                <div>
                  <div className="text-xs mland:text-[10.5px] font-semibold text-[var(--mut)] mb-1.5 mland:mb-1">ตำแหน่งหลัก</div>
                  <div className="grid grid-cols-4 gap-2 mland:gap-1.5">
                    {([['FW', 'กองหน้า'], ['MF', 'กองกลาง'], ['DF', 'กองหลัง'], ['GK', 'ผู้รักษาประตู']] as [Position, string][]).map(([p, l]) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => changePosition(p)}
                        className={`py-2 mland:py-1.5 px-2 rounded-xl text-xs sm:text-sm mland:text-xs font-semibold cursor-pointer transition-colors ${
                          cPos === p ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {SPX[cPos].length > 1 && (
                  <div className="space-y-2 mland:space-y-1.5">
                    <div className="text-xs mland:text-[10.5px] font-semibold text-[var(--mut)]">บทบาทเฉพาะทาง</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SPX[cPos].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeSubRole(s)}
                          className={`px-3 mland:px-2.5 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[11px] font-semibold cursor-pointer ${
                            cSp === s ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {s} · {SPN[s]}
                        </button>
                      ))}
                    </div>
                    {ROLE_HINT[cSp] && (
                      <p className="text-xs mland:text-[10.5px] text-[var(--g)] font-semibold bg-[var(--g-soft)] px-3 py-1.5 mland:py-1 rounded-lg leading-snug">
                        💡 {cSp}: {ROLE_HINT[cSp]}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 2: Face & Kit */}
              <div className={`space-y-3 mland:space-y-2 ${crMobTab === 'face' ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm mland:text-xs">ใบหน้าแบบสุ่ม & ปรับแต่งรูปลักษณ์</span>
                  <button
                    type="button"
                    onClick={rerollFaceGallery}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10.5px] font-semibold cursor-pointer hover:border-[var(--g)]"
                  >
                    🎲 สุ่มชุดใบหน้าใหม่
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {faceChoices.map((f, idx) => {
                    const isPicked =
                      cSkin === f.k && cHair === f.h && cHs === f.hs && cFh === f.fh && cFs === f.fs && cEy === f.ey;
                    const sampleProfile: PlayerCareerProfile = {
                      ...previewProfile,
                      c: f.c,
                      k: f.k,
                      h: f.h,
                      hs: f.hs,
                      fh: f.fh,
                      fs: f.fs,
                      ey: f.ey
                    };
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          applyFaceTraits(f);
                        }}
                        className={`p-1.5 mland:p-1 rounded-xl border flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                          isPicked
                            ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]'
                            : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                        }`}
                      >
                        <PlayerFace player={previewPlayer} careerProfile={sampleProfile} size={38} />
                        <span className="text-[9.5px] mland:hidden font-semibold text-[var(--mut)] truncate w-full text-center">
                          {HS_N[f.hs]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2.5 mland:gap-2">
                  {[
                    ['สีชุด', ['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111'], cColor, setCColor],
                    ['สีผิว', SKIN_P, cSkin, setCSkin],
                    ['สีผม', HAIR_P, cHair, setCHair]
                  ].map(([lbl, cols, cur, setter]) => (
                    <div key={lbl as string}>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] mb-1">{lbl as string}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(cols as string[]).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => (setter as React.Dispatch<React.SetStateAction<string>>)(col)}
                            className={`w-6 h-6 mland:w-5 mland:h-5 rounded-full border border-white cursor-pointer ${cur === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                            style={{ background: col }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs mland:text-[10.5px]">
                  {[
                    ['รูปหน้า', FS_N, cFs, setCFs],
                    ['แววตา', EY_N, cEy, setCEy],
                    ['ทรงผม', HS_N, cHs, setCHs],
                    ['หนวดเครา', FH_N, cFh, setCFh]
                  ].map(([lbl, arr, cur, setter]) => (
                    <div key={lbl as string} className="flex items-center gap-1 flex-wrap">
                      <span className="text-[var(--mut)] text-[11px] mland:text-[9.5px] w-14 mland:w-12 shrink-0">{lbl as string}:</span>
                      {(arr as string[]).map((l, i) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => (setter as React.Dispatch<React.SetStateAction<number>>)(i)}
                          className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${cur === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab 3: Archetype, Traits & Rolled Stats */}
              <div className={`space-y-3 mland:space-y-2 ${crMobTab === 'arch' ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm mland:text-xs">สไตล์การเล่น & สุ่มแต้ม (+12 หลัก / +8 ย่อย)</span>
                  <button
                    type="button"
                    onClick={rerollStartingPoints}
                    className="px-2.5 py-1 rounded-lg bg-[var(--lamp)] text-[#261900] text-xs mland:text-[10.5px] font-bold cursor-pointer hover:brightness-105 shrink-0"
                  >
                    🎲 สุ่มแต้มใหม่
                  </button>
                </div>

                <div className="grid grid-cols-[1.25fr_0.95fr] gap-3 mland:gap-2 items-start">
                  <div className="grid grid-cols-2 gap-1.5">
                    {posArchs.map((arch) => {
                      const active = curArch.id === arch.id;
                      const coreTags = (Object.entries(arch.coreBonus) as [StatKey, number][]).map(
                        ([k, v]) => `${ATT.find((x) => x[0] === k)?.[1]} +${v}`
                      );
                      return (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => changeArchetype(arch)}
                          className={`p-2 mland:p-1.5 rounded-xl text-left border cursor-pointer transition-all ${
                            active ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs' : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          <div className="font-bold text-xs mland:text-[10.5px] truncate">{arch.icon} {arch.name}</div>
                          <div className={`text-[10.5px] mland:text-[9px] mt-0.5 line-clamp-1 ${active ? 'text-white/90' : 'text-[var(--mut)]'}`}>{arch.desc}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {coreTags.slice(0, 3).map((tg) => (
                              <span key={tg} className={`px-1 py-0.5 rounded text-[9.5px] mland:text-[8.5px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--g)]'}`}>
                                {tg}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-1.5 mland:space-y-1">
                    <div className="flex items-center justify-between text-xs mland:text-[10.5px]">
                      <span className="font-bold">พลังหลักหลังสุ่ม</span>
                      <span className="text-[10px] text-[var(--mut)]">+12 แต้มตามสาย</span>
                    </div>
                    {ATT.map(([k, l]) => {
                      const rolledAdd = cAttrs[k] - cBase[k];
                      const archCoreAdd = curArch.coreBonus[k] || 0;
                      return (
                        <div key={k} className="flex items-center gap-2 text-xs mland:text-[10.5px]">
                          <span className="w-20 flex items-center gap-1 truncate">
                            <span>{l}</span>
                            {archCoreAdd > 0 && <span className="text-[9.5px] font-bold text-[var(--g)]">+{archCoreAdd}</span>}
                            {rolledAdd > 0 && <span className="text-[9.5px] font-bold text-[var(--lamp)]">+{rolledAdd}</span>}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${cAttrs[k]}%`, background: rolledAdd > 0 ? 'var(--lamp)' : 'var(--g)' }} />
                          </div>
                          <span className="w-6 text-right font-bold tabular">{cAttrs[k]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Football Personality Traits Selector */}
                <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs mland:text-[11px] truncate">✨ นิสัยลูกหนังตามตำแหน่ง ({cTraits.length}/4)</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--g-soft)] text-[var(--g)] text-[10px] mland:text-[9px] font-bold tabular shrink-0">
                        🌟 พรสวรรค์ {cTalent}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={rerollTraits}
                      className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[10px] font-semibold cursor-pointer hover:border-[var(--g)] shrink-0"
                    >
                      🎲 สุ่มนิสัยใหม่
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {posTraits.map((tr) => {
                      const active = cTraits.includes(tr.id);
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => toggleTrait(tr.id)}
                          title={tr.desc}
                          className={`px-2 py-1 rounded-lg text-[11px] mland:text-[9.5px] font-semibold border cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                              : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          {tr.icon} {tr.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tab 4: Sub-stats Breakdown */}
              <div className={`space-y-2.5 mland:space-y-1.5 ${crMobTab === 'stats' ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm mland:text-xs">ค่าพลังเฉพาะด้าน</span>
                  <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">พลังหลัก + โบนัสสาย (เขียว) + แต้มสุ่ม (เหลือง)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mland:gap-1.5">
                  {subStats.map((g) => (
                    <div key={g[0]} className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)] space-y-1">
                      <div className="font-bold text-xs mland:text-[10px]">{g[0]}</div>
                      {g[1].map(([lbl, val, statKey]) => {
                        const archBonus = statKey ? curArch.sbBonus[statKey] || 0 : 0;
                        const rolledSub = statKey ? cSubMap[statKey] || 0 : 0;
                        return (
                          <div key={lbl} className="flex items-center justify-between gap-1 text-[11px] mland:text-[9.5px]">
                            <span className="truncate flex items-center gap-0.5 min-w-0">
                              <span className={archBonus > 0 ? 'font-semibold text-[var(--g)]' : 'text-[var(--mut)]'}>{lbl}</span>
                              {archBonus > 0 && <span className="text-[9px] font-bold text-[var(--g)]">+{archBonus}</span>}
                              {rolledSub > 0 && <span className="text-[9px] font-bold text-[var(--lamp)]">+{rolledSub}</span>}
                            </span>
                            <b className="tabular">{val}</b>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mCount = countSaves('m');
  const pCount = countSaves('p');
  const activeStar = starPool[starIdx % starPool.length];

  const cycleStarPoster = () => {
    SFX.tap();
    if (starPool.length <= 1) return;
    setStarPoster((cur) => {
      let next = Math.floor(Math.random() * cur.pool.length);
      if (next === cur.idx) next = (cur.idx + 1) % cur.pool.length;
      return { ...cur, idx: next };
    });
  };

  return (
    <div className="relative h-[100dvh] w-full flex flex-col justify-center overflow-hidden bg-[#040c08] safe-all">
      {/* Full-Bleed Stadium Artwork Canvas — Blurred & Dark Moody Night Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#040c08]"
      >
        <img
          src={stadiumHeroBg}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center scale-105 blur-[4px] brightness-[0.62] saturate-90"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020805]/86 via-[#05140c]/68 to-[#020805]/88" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(16,68,40,0.16),rgba(2,8,5,0.62)_78%)]" />
      </div>

      {/* Landscape-First Main Hub: Centered Stage with Breathing Room Top/Bottom */}
      <div className="relative z-10 w-full max-w-5xl mx-auto h-full sm:max-h-[500px] mland:max-h-[min(360px,calc(100dvh-28px))] px-4 sm:px-7 mland:px-5 py-4 sm:py-5 mland:py-2.5 flex flex-col gap-3 sm:gap-3.5 mland:gap-2.5 overflow-hidden">
        {/* Top Stadium Masthead */}
        <header className="shrink-0 flex items-center justify-between gap-3 mland:gap-2">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 mland:w-8 mland:h-8 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
              <svg viewBox="0 0 40 40" className="w-7 h-7 sm:w-8 sm:h-8 mland:w-6 mland:h-6" aria-hidden="true">
                <defs>
                  <linearGradient id="pitch_crest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#123a26" />
                    <stop offset="1" stopColor="#22794b" />
                  </linearGradient>
                  <radialGradient id="flood_crest" cx="0.5" cy="0.15" r="0.65">
                    <stop offset="0" stopColor="#fde68a" stopOpacity="0.7" />
                    <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#pitch_crest)" />
                <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#flood_crest)" />
                <g fill="none" stroke="#e6f7ed" strokeWidth="1.2" opacity="0.88">
                  <path d="M5 24h30" />
                  <ellipse cx="20" cy="27" rx="7.5" ry="3.2" />
                </g>
                <circle cx="20" cy="22" r="3.4" fill="#ffffff" stroke="#0d2619" strokeWidth="1" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl mland:text-lg font-extrabold font-display tracking-wide leading-none text-white drop-shadow-xs">
                ลูกหนัง<span className="text-[#fad05a]">ไทย</span>
              </h1>
              <p className="text-[11px] sm:text-xs mland:text-[9.5px] font-medium text-emerald-100/75 truncate mt-0.5">
                เกมจำลองคุมสโมสร &amp; นักเตะอาชีพไทย
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="px-3 mland:px-2.5 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-white/20 bg-white/10 hover:bg-white/18 backdrop-blur-sm text-[11px] mland:text-[10px] font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>📥</span>
              <span>นำเข้าเซฟ</span>
            </button>
            <PWAInstallButton variant="compact" tone="stadium" onToast={onToast} />
          </div>
        </header>

        {/* Main 2 Columns: Col 1 = Randomized In-Game Star Poster | Col 2 = 2-Column Save & Mode Hub */}
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[0.76fr_1.44fr] mland:grid-cols-[0.74fr_1.46fr] gap-3 sm:gap-4 mland:gap-3 overflow-hidden items-stretch">
          {/* Column 1: Premium Collector Star Footballer Poster */}
          <aside className="relative min-h-0 rounded-2xl mland:rounded-xl p-[1px] bg-gradient-to-b from-[#fad05a]/60 via-white/20 to-[#1f6a42]/60 shadow-[0_20px_48px_rgba(0,0,0,0.72)] overflow-hidden">
            <div className="relative h-full w-full rounded-[15px] mland:rounded-[11px] bg-gradient-to-b from-[#131e18] via-[#0c1410] to-[#060b08] overflow-hidden flex flex-col justify-between text-white">
              {/* Top Team Ribbon Accent */}
              <div
                aria-hidden="true"
                className="h-1 w-full shrink-0"
                style={{ background: `linear-gradient(90deg, ${activeStar.kit1}, #fad05a 50%, ${activeStar.kit2})` }}
              />

              {/* Top Poster Header: OVR Shield + Club Identity + Reroll */}
              <div className="relative z-10 px-3 pt-2.5 mland:px-2.5 mland:pt-1.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                  <div className="leading-none pr-2 border-r border-white/15 shrink-0 text-center">
                    <div className="text-2xl sm:text-[28px] mland:text-lg font-extrabold font-display tabular bg-gradient-to-b from-[#fff2b2] via-[#fad05a] to-[#d69514] bg-clip-text text-transparent drop-shadow-xs">
                      {activeStar.ov}
                    </div>
                    <div className="text-[9.5px] mland:text-[8px] font-bold text-white/80 tracking-wider mt-0.5">
                      {activeStar.pos} · #{activeStar.no}
                    </div>
                  </div>
                  <div className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                    <ClubCrest name={activeStar.clubName} size={20} team={activeStar.team} club={activeStar.club} isMyClub={!!activeStar.club} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] mland:text-[8.5px] font-bold text-[#fad05a] truncate leading-tight">
                      {activeStar.sourceLabel}
                    </div>
                    <div className="text-[11px] mland:text-[9.5px] font-semibold text-white/95 truncate leading-tight">
                      {activeStar.clubName}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cycleStarPoster}
                  title="สุ่มโปสเตอร์นักเตะคนอื่น"
                  aria-label="สุ่มโปสเตอร์นักเตะคนอื่น"
                  className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-white/10 hover:bg-[#fad05a]/25 border border-white/15 hover:border-[#fad05a]/50 text-xs mland:text-[10px] flex items-center justify-center cursor-pointer transition-all shrink-0"
                >
                  🎲
                </button>
              </div>

              {/* Center Contrasting Neutral Studio Showcase */}
              <div className="relative z-10 flex-1 min-h-0 mx-3 my-1.5 mland:mx-2.5 mland:my-1 rounded-xl border border-[#fad05a]/20 bg-gradient-to-b from-[#24332d] via-[#17221d] to-[#0f1713] flex items-end justify-center overflow-hidden shadow-inner">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 50% 44%, rgba(248, 252, 250, 0.28) 0%, rgba(212, 228, 220, 0.08) 48%, transparent 74%)'
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 inset-x-6 h-3 rounded-full bg-black/55 blur-sm"
                />
                <div className="relative z-10 [&>svg]:w-[98px] [&>svg]:h-[104px] sm:[&>svg]:w-[116px] sm:[&>svg]:h-[123px] mland:[&>svg]:w-[74px] mland:[&>svg]:h-[79px] drop-shadow-[0_12px_20px_rgba(0,0,0,0.78)]">
                  <PlayerFace
                    player={activeStar.player}
                    team={activeStar.team}
                    club={activeStar.club}
                    isMyClub={!!activeStar.club}
                    careerProfile={activeStar.profile}
                    kitColor={activeStar.kit1}
                    trimColor={activeStar.kit2}
                    size={116}
                    bare
                  />
                </div>
              </div>

              {/* Gold Divider + Nameplate & 5 Color-Coded Stats */}
              <div className="relative z-10 bg-[#050a07]/92 px-3 py-2 mland:px-2.5 mland:py-1.5 space-y-1.5 mland:space-y-1">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#fad05a]/50 to-transparent"
                />
                <div className="text-center">
                  <div className="font-display font-extrabold text-sm sm:text-base mland:text-xs text-white truncate leading-tight tracking-wide">
                    {activeStar.name}
                  </div>
                  <div className="text-[10px] mland:text-[8.5px] text-emerald-100/75 truncate mt-0.5 mland:mt-0">
                    {activeStar.archLabel}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1 pt-1 border-t border-white/10 text-center">
                  {ATT.map(([k, l]) => {
                    const val = activeStar.attrs[k];
                    return (
                      <div key={k} className="space-y-0.5">
                        <div className="text-xs sm:text-sm mland:text-[10.5px] font-extrabold font-display tabular leading-tight text-white">
                          {val}
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden mx-0.5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${clamp(val, 10, 100)}%`, background: statBarColor(val) }}
                          />
                        </div>
                        <div className="text-[9px] mland:text-[7.5px] text-white/65 leading-tight">{l}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Column 2: Save Hub Split Inside into 2 Columns ([Manager Mode + Saves] | [Player Mode + Saves]) */}
          <div className="min-h-0 grid grid-cols-2 gap-2.5 sm:gap-3 mland:gap-2 overflow-hidden">
            {/* Sub-Column 1: Manager Mode + Manager Saves */}
            <section className="min-h-0 flex flex-col gap-2 mland:gap-1.5">
              <button
                type="button"
                onClick={() => { unlockAudio(); openManagerSetup(firstEmptySlot('m')); }}
                className="group shrink-0 p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#fde078] via-[#f5c242] to-[#dfa116] text-[#211500] text-left shadow-lg hover:brightness-[1.03] transition-all cursor-pointer flex items-center gap-2.5 mland:gap-2 min-w-0"
              >
                <span className="w-9 h-9 sm:w-10 sm:h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-black/10 flex items-center justify-center text-lg mland:text-sm shrink-0">
                  📋
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display leading-tight truncate">
                    โหมดผู้จัดการทีม
                  </div>
                  <div className="text-[10px] sm:text-[11px] mland:text-[8.5px] font-semibold opacity-80 truncate mt-0.5 mland:mt-0">
                    คุมสโมสร จัดแผน &amp; ซื้อขาย
                  </div>
                </div>
                <span className="text-xs mland:text-[10px] font-extrabold opacity-80 group-hover:translate-x-0.5 transition-transform shrink-0 whitespace-nowrap">
                  เริ่มใหม่ ›
                </span>
              </button>

              <div className="flex-1 min-h-0 flex flex-col rounded-2xl mland:rounded-xl bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--line)] shadow-2xl overflow-hidden">
                <div className="shrink-0 px-3 mland:px-2.5 py-2 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/70 flex items-center justify-between gap-2">
                  <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)] truncate">
                    เซฟผู้จัดการทีม
                  </span>
                  <span className="text-[10.5px] mland:text-[9px] font-bold tabular text-[#9c6900] dark:text-[var(--lamp)] shrink-0">
                    {mCount}/{NSL}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 mland:p-1.5">
                  {renderSlotList('m')}
                </div>
              </div>
            </section>

            {/* Sub-Column 2: Player Career Mode + Player Saves */}
            <section className="min-h-0 flex flex-col gap-2 mland:gap-1.5">
              <button
                type="button"
                onClick={() => { unlockAudio(); openPlayerSetup(firstEmptySlot('p')); }}
                className="group shrink-0 p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#199354]/95 via-[#137442]/95 to-[#0c4f2d]/95 border border-emerald-300/25 text-white text-left shadow-lg hover:brightness-[1.06] transition-all cursor-pointer flex items-center gap-2.5 mland:gap-2 min-w-0"
              >
                <span className="w-9 h-9 sm:w-10 sm:h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-white/12 border border-white/12 flex items-center justify-center text-lg mland:text-sm shrink-0">
                  ⚽
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display leading-tight truncate">
                    โหมดนักเตะอาชีพ
                  </div>
                  <div className="text-[10px] sm:text-[11px] mland:text-[8.5px] font-medium text-emerald-50/85 truncate mt-0.5 mland:mt-0">
                    ปั้นนักเตะ &amp; ล่าฝันทีมชาติ
                  </div>
                </div>
                <span className="text-xs mland:text-[10px] font-extrabold opacity-85 group-hover:translate-x-0.5 transition-transform shrink-0 whitespace-nowrap">
                  เริ่มใหม่ ›
                </span>
              </button>

              <div className="flex-1 min-h-0 flex flex-col rounded-2xl mland:rounded-xl bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--line)] shadow-2xl overflow-hidden">
                <div className="shrink-0 px-3 mland:px-2.5 py-2 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]/70 flex items-center justify-between gap-2">
                  <span className="font-bold text-xs mland:text-[10.5px] text-[var(--ink)] truncate">
                    เซฟนักเตะอาชีพ
                  </span>
                  <span className="text-[10.5px] mland:text-[9px] font-bold tabular text-[var(--g)] shrink-0">
                    {pCount}/{NSL}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 mland:p-1.5">
                  {renderSlotList('p')}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {showImport && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowImport(false)}
        >
          <div
            className="w-full max-w-md p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm font-display">📥 นำเข้าโค้ดเซฟ</h3>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="w-7 h-7 rounded-full bg-[var(--surface-2)] text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="วางโค้ดเซฟที่นี่..."
              rows={4}
              className="w-full p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 py-2 px-4 rounded-xl bg-[var(--g)] text-white text-xs font-bold cursor-pointer hover:brightness-105"
              >
                ยืนยันนำเข้าเซฟ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

