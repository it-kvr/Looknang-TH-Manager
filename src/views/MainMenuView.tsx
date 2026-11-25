import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FolderInput, RefreshCw, X } from 'lucide-react';
import { PWAInstallButton } from '../pwa.tsx';
import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, PlayerCareerProfile, GameState, PlayerArchetype, PreferredFoot } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { ATT, SPX, SPN, ROLE_HINT, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, ACC_N, FOOTBALL_TRAITS, TRAIT_BY_ID, ROLE_BASE_ATTRS, PLAYER_ARCHETYPES, NG, SFX0, KIT_P, SIGL, AR_T } from '../data/thaiFootballData';
import { SFX, unlockAudio } from '../utils/audioTheme';
import { genPlayerName, clearNamePool, genClubNames, NSL, loadGameFromSlot, deleteSlot, firstEmptySlot, mkTeam, OVF, dtInfo, summarizeStatGroups, rollPlayerTraits, rollPlayerBio, getPlayerBio, saveCustomPlayer, loadCustomPlayers, xi, teamKits, type PlayerBio, type StatCategorySummary } from '../engine/playerCore';
import { fmtFansShort } from '../engine/simulation';
import { cleanImportJson } from '../engine/saveCodec';
import { ovColor, statBarColor, statTierMeta, getPlayerTalent } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { FootPairIcon, getFootColorMeta } from '../components/PlayerBioStrip';
import { TalentBadge } from '../components/TalentBadge';
import { AthleteCard } from '../components/AthleteCard';
import { enterAutoMobileFullscreen } from '../utils/fullscreen';
import stadiumHeroBg from '../assets/images/thai_stadium_hero_1795511663761.jpg';
import type { ClubIdentity } from '../types/game';

interface StarPosterCard {
  id: string;
  name: string;
  pos: SubRole;
  no: number;
  ov: number;
  pot: number;
  talent: number;
  age: number;
  bio: PlayerBio;
  clubName: string;
  sourceLabel: string;
  archLabel: string;
  categories: StatCategorySummary[];
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

function buildStarPosterPool(preloaded?: { m: (GameState | null)[]; p: (GameState | null)[] }): StarPosterCard[] {
  const pool: StarPosterCard[] = [];

  // Pull real stars from saved Manager & Player Career slots if available
  for (let k = 1; k <= NSL; k++) {
    const ms = preloaded ? preloaded.m[k - 1] : loadGameFromSlot('m', k);
    if (ms && Array.isArray(ms.teams)) {
      const meT = ms.teams[ms.me];
      const top = meT?.sq?.slice().sort((a, b) => b.ov - a.ov)[0];
      if (meT && top) {
        const clubName = ms.club?.name || meT.name;
        const [kit1, kit2] = teamKits(meT, ms);
        pool.push({
          id: `save_m_${k}`,
          name: top.n,
          pos: top.ro,
          no: top.no || 10,
          ov: top.ov,
          pot: top.pot || top.ov,
          talent: getPlayerTalent(top),
          age: top.age || 22,
          bio: getPlayerBio(top),
          clubName,
          sourceLabel: `เซฟ #${k}`,
          archLabel: SPN[top.ro] || top.ro,
          categories: summarizeStatGroups(dtInfo(top).G),
          kit1,
          kit2,
          player: top,
          team: meT,
          club: ms.club || null
        });
      }
    }
    const ps = preloaded ? preloaded.p[k - 1] : loadGameFromSlot('p', k);
    if (ps && ps.p && Array.isArray(ps.teams)) {
      const meT = ps.teams[ps.me];
      const mePl = meT?.sq?.find((q) => q.me);
      const attrs = ps.p.a || ROLE_BASE_ATTRS(ps.p.pos, ps.p.sp);
      const ov = mePl?.ov || OVF(ps.p.pos, attrs);
      const talent = ps.p.talent ?? getPlayerTalent(mePl || { n: ps.p.name, pos: ps.p.pos, ro: ps.p.sp, ov, age: ps.p.age, pot: 92, fit: 100, inj: 0 }, ps.p);
      const pot = mePl?.pot ?? clamp(Math.max(88, talent + 6), ov + 8, 96);
      const playerObj: Player = mePl || {
        n: ps.p.name,
        pos: ps.p.pos,
        ro: ps.p.sp,
        ov,
        age: ps.p.age || 18,
        pot,
        talent,
        traits: ps.p.traits,
        fit: 100,
        inj: 0,
        no: ps.p.no || 10,
        me: 1,
        sb: ps.p.sb
      };
      const [pKit1, pKit2] = meT ? teamKits(meT, ps) : [ps.p.c || '#158049', '#f5c242'];
      pool.push({
        id: `save_p_${k}`,
        name: ps.p.name,
        pos: ps.p.sp,
        no: ps.p.no || 10,
        ov,
        pot,
        talent,
        age: ps.p.age || 18,
        bio: getPlayerBio(playerObj, ps.p),
        clubName: meT?.name || 'ทีมชาติไทย',
        sourceLabel: `เซฟอาชีพ #${k}`,
        archLabel: ps.p.archName || SPN[ps.p.sp] || ps.p.sp,
        categories: summarizeStatGroups(dtInfo(playerObj, ps.p).G),
        kit1: pKit1,
        kit2: pKit2,
        player: playerObj,
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
    const age = 21 + (idx % 6);
    const talent = clamp(ov + 6 + (idx % 5) * 2, 74, 94);
    const pot = clamp(Math.max(ov + 4, talent + 2), ov + 2, 95);
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
    const curatedVis: Array<[number, number, number, number, number, number, number]> = [
      [5, 0, 15, 0, 9, preset.no, 2],
      [0, 0, 14, 0, 5, preset.no, 0],
      [1, 0, 16, 4, 8, preset.no, 2],
      [2, 1, 17, 0, 0, preset.no, 3],
      [5, 0, 19, 1, 1, preset.no, 2],
      [1, 2, 7, 0, 3, preset.no, 4],
      [0, 0, 5, 4, 9, preset.no, 5],
      [2, 0, 9, 0, 2, preset.no, 0]
    ];
    const starPlayerObj: Player = {
      n: starName,
      pos: preset.pos,
      ro: preset.sp,
      no: preset.no,
      ov,
      age,
      pot,
      talent,
      fit: 100,
      inj: 0,
      customA: attrs,
      sb: arch.sbBonus,
      customSig: arch.sig,
      vis: curatedVis[idx % curatedVis.length]
    };
    pool.push({
      id: `league_star_${idx}`,
      name: starName,
      pos: preset.sp,
      no: preset.no,
      ov,
      pot,
      talent,
      age,
      bio: getPlayerBio(starPlayerObj),
      clubName: preset.name,
      sourceLabel: 'ลีกสูงสุด',
      archLabel: `${arch.icon} ${arch.name}`,
      categories: summarizeStatGroups(dtInfo(starPlayerObj).G),
      kit1: preset.kit[0],
      kit2: preset.kit[1],
      player: starPlayerObj,
      team: teamStub
    });
  });

  return pool;
}

export const MainMenu: React.FC<{
  onStartManager: (slot: number, names: string[][], t0: Team[], pick: number, diff: number) => void;
  onStartPlayer: (slot: number, profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'> & { age?: number; diff?: number }) => void;
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
  const [selectedClubIdx, setSelectedClubIdx] = useState<number>(0);
  const [clubFilter, setClubFilter] = useState<'all' | 'top' | 'mid' | 'underdog'>('all');
  const [diff, setDiff] = useState<number>(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const loadedSlots = useMemo(
    () => ({
      m: Array.from({ length: NSL }, (_, idx) => loadGameFromSlot('m', idx + 1)),
      p: Array.from({ length: NSL }, (_, idx) => loadGameFromSlot('p', idx + 1))
    }),
    [refresh]
  );
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [crMobTab, setCrMobTab] = useState<'info' | 'face' | 'arch' | 'stats'>('info');
  const [starPoster, setStarPoster] = useState<{ pool: StarPosterCard[]; idx: number }>(() => {
    const pool = buildStarPosterPool(loadedSlots);
    return { pool, idx: Math.floor(Math.random() * Math.max(1, pool.length)) };
  });
  const starPool = starPoster.pool;
  const starIdx = starPoster.idx;
  const countSaves = (m: GameMode) => {
    let n = 0;
    const list = loadedSlots[m];
    for (let k = 0; k < list.length; k++) {
      const d = list[k];
      if (d && Array.isArray(d.teams) && (m === 'm' || d.p)) n++;
    }
    return n;
  };

  const rollFaceTraits = () => ({
    c: P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111', '#158049', '#0ea5e9', '#be185d']),
    k: P([SKIN_P[0], SKIN_P[1], SKIN_P[2], SKIN_P[5], SKIN_P[6]]),
    h: P([HAIR_P[0], HAIR_P[0], HAIR_P[1], HAIR_P[2], HAIR_P[5]]),
    hs: P([14, 15, 16, 17, 18, 19, 9, 7, 5, 2]),
    fh: P([0, 0, 0, 4, 1]),
    fs: P([0, 2, 3, 5, 4]),
    ey: P([9, 8, 5, 2, 0, 3]),
    acc: Math.random() < 0.25 ? P([1, 4]) : 0
  });

  const defaultNoForPos = (pos: Position) => (pos === 'GK' ? 1 : pos === 'DF' ? 4 : pos === 'MF' ? 8 : 10);

  const [cName, setCName] = useState('');
  const [cPos, setCPos] = useState<Position>('FW');
  const [cSp, setCSp] = useState<SubRole>('ST');
  const [cNo, setCNo] = useState<number>(10);
  const [cAge, setCAge] = useState<number>(17);
  const [cHt, setCHt] = useState<number>(177);
  const [cWt, setCWt] = useState<number>(70);
  const [cFoot, setCFoot] = useState<PreferredFoot>('R');
  const [cDiff, setCDiff] = useState<number>(1);
  const [cArchId, setCArchId] = useState<string>('poacher');
  const [cColor, setCColor] = useState(() => P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111', '#158049', '#0ea5e9', '#be185d']));
  const [cSkin, setCSkin] = useState(() => SKIN_P[5]);
  const [cHair, setCHair] = useState(() => HAIR_P[0]);
  const [cHs, setCHs] = useState<number>(14);
  const [cFh, setCFh] = useState<number>(0);
  const [cFs, setCFs] = useState<number>(2);
  const [cEy, setCEy] = useState<number>(9);
  const [cAcc, setCAcc] = useState<number>(0);
  const [faceChoices, setFaceChoices] = useState(() => Array.from({ length: 6 }, rollFaceTraits));
  const [cSubMap, setCSubMap] = useState<Record<string, number>>({});
  const [cBase, setCBase] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));
  const [cAttrs, setCAttrs] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));
  const [cTalent, setCTalent] = useState<number>(() => R(62, 93));
  const [cTraits, setCTraits] = useState<string[]>(() => rollPlayerTraits('FW', 'ST', 55, 78));
  const [customRosterCount, setCustomRosterCount] = useState<number>(() => loadCustomPlayers().length);

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
        ? ['sv', 'sv', 'rfx', 'rfx', 'cl', 'cl', 'dist', 'spass', 'lpass', 'comp', 'sta', 'tol', 'rec']
        : pos === 'FW'
          ? ['fin', 'fin', 'pw', 'cur', 'lsh', 'drb', 'ctrl', 'spass', 'run', 'spd', 'acc', 'crs', 'hd', 'str', 'sta', 'comp']
          : pos === 'MF'
            ? ['spass', 'spass', 'lpass', 'drb', 'ctrl', 'vis', 'crs', 'cur', 'lsh', 'rd', 'run', 'fin', 'pw', 'pos', 'mrk', 'spd', 'acc', 'sta', 'comp', 'rec']
            : ['pos', 'pos', 'rd', 'rd', 'mrk', 'mrk', 'blk', 'blk', 'spass', 'lpass', 'ctrl', 'hd', 'str', 'spd', 'acc', 'crs', 'sta', 'tol', 'comp'];
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
    setSelectedClubIdx(0);
    setClubFilter('all');
    goStep('ms');
  };

  const rerollManagerClubs = () => {
    SFX.tap();
    clearNamePool();
    const names = genClubNames();
    const t0 = names[0].map((n, i) => mkTeam(n, 0, i));
    setPreviewClubs({ names, t0 });
    setSelectedClubIdx(0);
    setClubFilter('all');
  };

  const applyFaceTraits = (f: ReturnType<typeof rollFaceTraits>) => {
    setCColor(f.c);
    setCSkin(f.k);
    setCHair(f.h);
    setCHs(f.hs);
    setCFh(f.fh);
    setCFs(f.fs);
    setCEy(f.ey);
    setCAcc(f.acc ?? 0);
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
    setCAge(17);
    const initBio = rollPlayerBio('FW', 'ST');
    setCHt(initBio.ht);
    setCWt(initBio.wt);
    setCFoot(initBio.foot);
    setCDiff(1);
    setCArchId(defaultArch.id);
    setCBase(rolled.base);
    setCAttrs(rolled.attrs);
    setCSubMap(rolled.subMap);
    setCTalent(initTalent);
    setCTraits(rollPlayerTraits('FW', 'ST', initOv, initTalent));
    setCustomRosterCount(loadCustomPlayers().length);
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
    const slots = loadedSlots[m];
    for (let k = 1; k <= NSL; k++) {
      const d = slots[k - 1];
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
    const clubMetaList = previewClubs.t0.map((t, idx) => {
      const squadAvg = Math.round(t.sq.reduce((sum, q) => sum + q.ov, 0) / Math.max(1, t.sq.length));
      const tierBucket: 'top' | 'mid' | 'underdog' = squadAvg >= 42 ? 'top' : squadAvg >= 39 ? 'mid' : 'underdog';
      const tierTag = tierBucket === 'top' ? 'เต็งลีก' : tierBucket === 'mid' ? 'กลางตาราง' : 'ท้าทาย';
      return { team: t, idx, squadAvg, tierBucket, tierTag };
    });

    const filteredClubs = clubMetaList.filter((item) => clubFilter === 'all' || item.tierBucket === clubFilter);
    const activeIdx = previewClubs.t0[selectedClubIdx] ? selectedClubIdx : 0;
    const selectedTeam = previewClubs.t0[activeIdx];
    const selectedMeta = clubMetaList[activeIdx] || clubMetaList[0];
    const selectedXi = xi(selectedTeam);
    const xiAvg = Math.round(selectedXi.reduce((s, q) => s + q.ov, 0) / Math.max(1, selectedXi.length));

    const calcLineOv = (positions: Position[]) => {
      const xiLine = selectedXi.filter((q) => positions.includes(q.pos));
      const pool = xiLine.length ? xiLine : selectedTeam.sq.filter((q) => positions.includes(q.pos));
      if (!pool.length) return selectedMeta.squadAvg;
      return Math.round(pool.reduce((s, q) => s + q.ov, 0) / pool.length);
    };
    const attOv = calcLineOv(['FW']);
    const midOv = calcLineOv(['MF']);
    const defOv = calcLineOv(['DF', 'GK']);
    const topStars = selectedTeam.sq.slice().sort((a, b) => b.ov - a.ov).slice(0, 3);
    const diffDesc =
      diff === 0
        ? 'คู่แข่งผ่อนลงเล็กน้อย เหมาะสำหรับเริ่มต้น'
        : diff === 1
          ? 'ความท้าทายสมดุลตามมาตรฐานลีก'
          : 'คู่แข่งแข็งแกร่งขึ้น ท้าทายฝีมือคุมทีม';

    return (
      <div className="h-full w-full flex items-center justify-center overflow-hidden bg-[var(--bg)] stage-viewport">
        <div className="w-full max-w-7xl h-full max-h-[96%] sm:max-h-[min(94%,780px)] mland:max-h-[96%] mx-auto my-auto flex flex-col overflow-hidden rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface)]/55 shadow-xl">
          {/* Top Navigation Bar: 3 clean zones */}
          <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]">
            <div className="w-full mx-auto px-3 sm:px-4 mland:px-3 py-2 mland:py-1 flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => { SFX.tap(); goStep('menu'); }}
                  className="btn btn-sm btn-secondary shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>กลับ</span>
                </button>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base mland:text-xs font-extrabold font-display text-[var(--ink)] truncate leading-tight">
                    เลือกสโมสรเริ่มต้น
                  </h2>
                  <p className="hidden sm:block mland:hidden text-[10.5px] text-[var(--mut)] truncate">
                    ลีกระดับจังหวัด · แสดงครบทั้ง 16 สโมสร · ปรับแต่งชื่อ ตรา และชุดแข่งได้ภายหลัง
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mland:gap-1.5 shrink-0">
                <div className="seg-bar" role="group" aria-label="ระดับความยาก">
                  {(['ง่าย', 'ปกติ', 'ยาก'] as const).map((lbl, idx) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => { SFX.tap(); setDiff(idx); }}
                      className={`seg-btn ${diff === idx ? 'seg-btn-active' : ''}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={rerollManagerClubs}
                  title="สุ่มชุดสโมสรใหม่"
                  className="btn btn-sm btn-secondary shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline mland:inline">สุ่มใหม่</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main 2-Column Club Selection & Dossier Workspace */}
          <div className="flex-1 min-h-0 w-full mx-auto px-2.5 sm:px-4 mland:px-2.5 py-2 sm:py-2.5 mland:py-1.5 overflow-hidden flex flex-col sm:grid sm:grid-cols-[1.58fr_0.92fr] sm:grid-rows-[minmax(0,1fr)] mland:grid-cols-[1.58fr_0.92fr] mland:grid-rows-[minmax(0,1fr)] gap-2 sm:gap-3 mland:gap-2">
          {/* Left Column: Filter Bar + Full 16-Club Single-Screen Grid */}
          <section className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2 mland:gap-1">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5">
              <div className="seg-bar">
                {(
                  [
                    ['all', `ทั้งหมด (${clubMetaList.length})`],
                    ['top', 'เต็งลีก'],
                    ['mid', 'กลางตาราง'],
                    ['underdog', 'ท้าทาย']
                  ] as const
                ).map(([fk, fl]) => (
                  <button
                    key={fk}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setClubFilter(fk);
                      const firstMatch = clubMetaList.find((c) => fk === 'all' || c.tierBucket === fk);
                      if (firstMatch && fk !== 'all' && selectedMeta.tierBucket !== fk) {
                        setSelectedClubIdx(firstMatch.idx);
                      }
                    }}
                    className={`seg-btn ${clubFilter === fk ? 'seg-btn-active' : ''}`}
                  >
                    {fl}
                  </button>
                ))}
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[var(--mut)] tabular">
                <span>เซฟช่อง #{targetSlot}</span>
                <span aria-hidden="true">·</span>
                <span>คลิกทีมเพื่อดูรายละเอียด</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden mland:overflow-hidden flex flex-col">
              {filteredClubs.length === 0 ? (
                <div className="h-full min-h-[140px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-xs sm:text-sm font-semibold text-[var(--mut)]">
                    ไม่มีสโมสรในกลุ่มนี้จากการสุ่มรอบนี้
                  </p>
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setClubFilter('all'); }}
                    className="btn btn-sm btn-secondary"
                  >
                    แสดงทั้งหมด
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mland:grid-cols-4 gap-1.5 sm:gap-2 mland:gap-1 sm:h-full mland:h-full content-start sm:content-stretch mland:content-stretch auto-rows-min sm:auto-rows-fr mland:auto-rows-fr">
                  {filteredClubs.map(({ team: t, idx, squadAvg, tierBucket, tierTag }) => {
                    const isSelected = idx === activeIdx;
                    const primaryKit = t.kc?.[0] || '#158049';
                    const secondaryKit = t.kc?.[1] || '#f5c242';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { SFX.tap(); setSelectedClubIdx(idx); }}
                        aria-pressed={isSelected}
                        className={`group rounded-xl mland:rounded-lg border text-left transition-all cursor-pointer overflow-hidden flex flex-col justify-between min-w-0 ${
                          isSelected
                            ? 'border-[var(--g)] bg-[var(--surface)] shadow-md ring-1 ring-[var(--g)]/35'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--g)]/55 hover:bg-[var(--surface-2)]/45'
                        }`}
                      >
                        <div
                          aria-hidden="true"
                          className={`h-[3px] mland:h-[2px] w-full shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-65 group-hover:opacity-100'}`}
                          style={{ background: `linear-gradient(90deg, ${primaryKit}, ${secondaryKit})` }}
                        />
                        <div className="flex-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 mland:px-1.5 mland:py-1 flex items-center gap-1.5 sm:gap-2 mland:gap-1 min-w-0">
                          <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-7 sm:[&>svg]:h-7 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                            <ClubCrest name={t.name} size={28} team={t} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-[11px] sm:text-xs mland:text-[9.5px] truncate leading-tight text-[var(--ink)]">
                              {t.name}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-[9.5px] sm:text-[10px] mland:text-[8px] text-[var(--mut)] truncate leading-tight">
                              <span
                                className={`font-semibold shrink-0 ${
                                  tierBucket === 'top'
                                    ? 'text-[#8a5b00] dark:text-[var(--lamp)]'
                                    : tierBucket === 'mid'
                                      ? 'text-[var(--g)]'
                                      : 'text-[var(--mut)]'
                                }`}
                              >
                                {tierTag}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0 font-medium text-[var(--ink)]/75">{t.form}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-0.5">
                            <div
                              className="text-xs sm:text-sm mland:text-[10.5px] font-extrabold font-display tabular leading-none"
                              style={{ color: ovColor(squadAvg) }}
                            >
                              {squadAvg}
                            </div>
                            <div className="text-[8.5px] mland:text-[7px] text-[var(--mut)] mt-0.5 leading-none">
                              OVR
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Selected Club Dossier & Start Confirmation */}
          <aside className="shrink-0 sm:min-h-0 flex flex-col rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm overflow-hidden">
            <div
              aria-hidden="true"
              className="h-1.5 mland:h-1 w-full shrink-0"
              style={{ background: `linear-gradient(90deg, ${selectedTeam.kc?.[0] || '#158049'}, ${selectedTeam.kc?.[1] || '#f5c242'})` }}
            />

            {/* Dossier Identity Header */}
            <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-b border-[var(--line)]/75 flex items-center gap-2.5 mland:gap-2">
              <div className="shrink-0 [&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-12 sm:[&>svg]:h-12 mland:[&>svg]:w-8 mland:[&>svg]:h-8">
                <ClubCrest name={selectedTeam.name} size={48} team={selectedTeam} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--g)] truncate">
                  {selectedMeta.tierBucket === 'top'
                    ? 'กลุ่มเต็งลุ้นแชมป์ลีก'
                    : selectedMeta.tierBucket === 'mid'
                      ? 'กลุ่มกลางตารางสมดุล'
                      : 'ทีมพลังสู้ท้าทาย'}
                </div>
                <h3 className="font-display font-extrabold text-sm sm:text-base mland:text-xs text-[var(--ink)] truncate leading-tight mt-0.5">
                  {selectedTeam.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate mt-0.5 tabular">
                  <span>ฐานแฟน ~{fmtFansShort(selectedTeam.fans || 9500)}</span>
                  <span aria-hidden="true">·</span>
                  <span>นักเตะ {selectedTeam.sq.length} คน</span>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2 border-l border-[var(--line)]/75">
                <div
                  className="text-lg sm:text-xl mland:text-sm font-extrabold font-display tabular leading-none"
                  style={{ color: ovColor(xiAvg) }}
                >
                  {xiAvg}
                </div>
                <div className="text-[9.5px] mland:text-[7.5px] text-[var(--mut)] mt-0.5 whitespace-nowrap">
                  11 ตัวจริง
                </div>
              </div>
            </div>

            {/* Detailed Dossier Body (Desktop / Tablet / Mobile Landscape) */}
            <div className="hidden sm:flex mland:flex flex-1 min-h-0 flex-col overflow-y-auto px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 space-y-2.5 mland:space-y-1.5">
              {/* Line Strength Breakdown */}
              <div className="space-y-1.5 mland:space-y-1">
                <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">
                  สมดุลขุมกำลัง
                </div>
                <div className="space-y-1">
                  {(
                    [
                      ['เกมรุก', attOv],
                      ['แดนกลาง', midOv],
                      ['เกมรับ & ประตู', defOv]
                    ] as const
                  ).map(([lbl, val]) => (
                    <div key={lbl} className="grid grid-cols-[88px_1fr_28px] mland:grid-cols-[72px_1fr_24px] items-center gap-2 text-xs mland:text-[9px]">
                      <span className="font-medium text-[var(--ink)]/85 truncate">{lbl}</span>
                      <div className="h-1.5 mland:h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${clamp(val * 1.45, 18, 100)}%`, background: statBarColor(val) }}
                        />
                      </div>
                      <span className="font-display font-bold tabular text-right text-[var(--ink)]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tactical Profile Rows */}
              <div className="border-t border-[var(--line)]/70 pt-2 mland:pt-1 space-y-1 text-xs mland:text-[9px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--mut)]">ระบบการเล่น</span>
                  <span className="font-bold text-[var(--ink)] tabular">
                    {selectedTeam.form} · {AR_T[selectedTeam.tac]}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--mut)] shrink-0">ปรัชญาสโมสร</span>
                  <span className="font-semibold text-[var(--ink)] truncate text-right">
                    {selectedTeam.philosophy || 'สมดุล'}
                  </span>
                </div>
              </div>

              {/* Key Players List */}
              <div className="border-t border-[var(--line)]/70 pt-2 mland:pt-1 space-y-1">
                <div className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--mut)]">
                  3 แข้งแกนหลักประจำทีม
                </div>
                <div className="divide-y divide-[var(--line)]/55">
                  {topStars.map((pl) => (
                    <div key={pl.n} className="py-1 mland:py-0.5 flex items-center gap-2 mland:gap-1.5 min-w-0">
                      <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                        <PlayerFace player={pl} team={selectedTeam} size={24} bare />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs mland:text-[9.5px] font-bold text-[var(--ink)] truncate leading-tight">
                          {pl.n}
                        </div>
                        <div className="text-[10px] mland:text-[8px] text-[var(--mut)] tabular leading-tight">
                          {SPN[pl.ro] || pl.ro} · อายุ {pl.age} ปี
                        </div>
                      </div>
                      <span
                        className="text-xs mland:text-[10px] font-extrabold font-display tabular shrink-0"
                        style={{ color: ovColor(pl.ov) }}
                      >
                        {pl.ov}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Mobile Portrait Metrics Strip */}
            <div className="sm:hidden mland:hidden px-3 py-1.5 border-b border-[var(--line)]/65 flex items-center justify-between gap-2 text-[10.5px] tabular bg-[var(--surface-2)]/35">
              <span>รุก <strong className="text-[var(--ink)]">{attOv}</strong></span>
              <span className="text-[var(--mut)]" aria-hidden="true">·</span>
              <span>กลาง <strong className="text-[var(--ink)]">{midOv}</strong></span>
              <span className="text-[var(--mut)]" aria-hidden="true">·</span>
              <span>รับ <strong className="text-[var(--ink)]">{defOv}</strong></span>
              <span className="text-[var(--mut)]" aria-hidden="true">·</span>
              <span className="font-semibold text-[var(--ink)] truncate">{selectedTeam.form}</span>
            </div>

            {/* Primary CTA Footer */}
            <div className="shrink-0 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 border-t border-[var(--line)]/75 bg-[var(--surface-2)]/45 space-y-1.5 mland:space-y-1">
              <p className="hidden sm:block mland:hidden text-[10.5px] text-[var(--mut)] leading-snug">
                ระดับ{['ง่าย', 'ปกติ', 'ยาก'][diff]}: {diffDesc}
              </p>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onStartManager(targetSlot, previewClubs.names, previewClubs.t0, activeIdx, diff);
                }}
                className="btn btn-gold btn-lg mland:btn-md w-full font-extrabold"
              >
                <span className="truncate">รับคุมทีม {selectedTeam.name}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </aside>
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
    const estPot = clamp(Math.max(88, cTalent + 6), ov + 18, 96);
    const previewName = cName.trim() || 'นักเตะใหม่';
    const previewPlayer: Player = {
      n: previewName, pos: cPos, ro: cSp, ov, age: cAge, ht: cHt, wt: cWt, foot: cFoot, pot: estPot, talent: cTalent, traits: cTraits, fit: 100, inj: 0, no: cNo, me: 1, hg: 1, customCreated: 1
    };
    const previewProfile: PlayerCareerProfile = {
      name: previewName, pos: cPos, sp: cSp, no: cNo, tr: curArch.tr, sig: curArch.sig, archName: `${curArch.icon} ${curArch.name}`,
      sb: combinedSb, c: cColor, k: cSkin, h: cHair, hs: cHs, fh: cFh, fs: cFs, ey: cEy, acc: cAcc, pts: 0, b: cBase, a: cAttrs,
      talent: cTalent, traits: cTraits,
      age: cAge, ht: cHt, wt: cWt, foot: cFoot, gl: 0, as: 0, ap: 0, rs: 0, en: 100, plan: 1
    };
    const previewDt = dtInfo(previewPlayer, previewProfile);
    const previewBio = getPlayerBio(previewPlayer, previewProfile);
    const subStats = previewDt.G;
    const posTraits = FOOTBALL_TRAITS.filter((t) => t.pos.includes(cPos));
    const kitPalette = ['#e4572e', '#2f6fd6', '#158049', '#f4c63d', '#7c3aed', '#0ea5e9', '#be185d', '#111111'];
    const quickNumbers: Record<Position, number[]> = {
      FW: [7, 9, 10, 11, 17, 19],
      MF: [6, 8, 10, 14, 18, 21],
      DF: [2, 3, 4, 5, 6, 15],
      GK: [1, 13, 22, 25, 30, 99]
    };
    const posWeightSummary: Record<Position, string> = {
      FW: 'ยิง 45% · เลี้ยง 25% · จ่าย 15% · กาย 15%',
      MF: 'จ่าย 40% · เลี้ยง 20% · ยิง 15% · แย่ง 15% · กาย 10%',
      DF: 'แย่ง 45% · กาย 30% · จ่าย 15% · เลี้ยง 10%',
      GK: 'กาย 50% · แย่ง 30% · จ่าย 15% · เลี้ยง 5%'
    };

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
      const nextBio = rollPlayerBio(pos, sp);
      setCHt(nextBio.ht);
      setCWt(nextBio.wt);
      setCFoot(nextBio.foot);
      const rolled = applyRolledStats(pos, sp, nextArch);
      setCTraits(rollPlayerTraits(pos, sp, OVF(pos, rolled.attrs), cTalent));
    };

    const changeSubRole = (sp: SubRole) => {
      SFX.tap();
      setCSp(sp);
      const nextBio = rollPlayerBio(cPos, sp);
      setCHt(nextBio.ht);
      setCWt(nextBio.wt);
      setCFoot(nextBio.foot);
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

    const rerollTalent = () => {
      SFX.tap();
      const nextTalent = R(62, 95);
      setCTalent(nextTalent);
      setCTraits(rollPlayerTraits(cPos, cSp, ov, nextTalent));
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
      const nextTalent = R(62, 95);
      setCSp(rSp);
      setCArchId(rArch.id);
      setCTalent(nextTalent);
      const nextBio = rollPlayerBio(cPos, rSp);
      setCHt(nextBio.ht);
      setCWt(nextBio.wt);
      setCFoot(nextBio.foot);
      const rolled = applyRolledStats(cPos, rSp, rArch);
      setCTraits(rollPlayerTraits(cPos, rSp, OVF(cPos, rolled.attrs), nextTalent));
    };

    const buildCreationPayload = () => {
      const finalName = (cName || genPlayerName()).trim();
      if (!cName.trim()) setCName(finalName);
      return {
        name: finalName,
        pos: cPos,
        sp: cSp,
        no: clamp(cNo || 10, 1, 99),
        tr: curArch.tr,
        sig: curArch.sig,
        archName: `${curArch.icon} ${curArch.name}`,
        sb: combinedSb,
        c: cColor,
        k: cSkin,
        h: cHair,
        hs: cHs,
        fh: cFh,
        fs: cFs,
        ey: cEy,
        acc: cAcc,
        pts: 0,
        a: { ...cAttrs },
        talent: cTalent,
        traits: cTraits,
        age: cAge,
        ht: cHt,
        wt: cWt,
        foot: cFoot,
        diff: cDiff
      };
    };

    const saveToCustomPool = () => {
      SFX.win();
      const payload = buildCreationPayload();
      saveCustomPlayer({
        id: `cp_${Date.now()}`,
        createdAt: Date.now(),
        profile: payload,
        ov,
        pot: estPot
      });
      setCustomRosterCount(loadCustomPlayers().length);
      onToast(`💾 บันทึก "${payload.name}" เข้าทำเนียบแล้ว! สามารถซื้อ/ดึงเป็นเด็กปั้นในโหมดผู้จัดการได้`);
    };

    const startCareerNow = () => {
      SFX.tap();
      onStartPlayer(targetSlot, buildCreationPayload());
    };

    const activeTabStatsBadge = SIGL[curArch.sig] || curArch.sig;

    return (
      <div className="h-full w-full flex items-center justify-center overflow-hidden bg-[var(--bg)] stage-viewport">
        <div className="w-full max-w-7xl h-full max-h-[96%] sm:max-h-[min(94%,740px)] mland:max-h-[96%] mx-auto my-auto flex flex-col overflow-hidden rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface)]/60 shadow-xl">
          {/* Studio Header */}
          <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]">
            <div className="w-full mx-auto px-3 sm:px-4 mland:px-3 py-2 mland:py-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => { SFX.tap(); goStep('menu'); }}
                  className="btn btn-sm btn-secondary shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>กลับ</span>
                </button>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base mland:text-xs font-extrabold font-display truncate leading-tight text-[var(--ink)]">
                    ⚽ สตูดิโอสร้างนักเตะ
                  </h2>
                  <div className="hidden sm:flex mland:hidden items-center gap-1.5 text-[10.5px] text-[var(--mut)] truncate tabular">
                    <span>เซฟช่อง #{targetSlot}</span>
                    <span aria-hidden="true">·</span>
                    <span>เล่นอาชีพหรือบันทึกเข้าทำเนียบผู้จัดการ</span>
                    {customRosterCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[var(--g)]">ทำเนียบ {customRosterCount} คน</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={randomizeFaceOnly}
                  className="btn btn-sm btn-secondary"
                >
                  🎭 สุ่มหน้า
                </button>
                <button
                  type="button"
                  onClick={randomizeAll}
                  className="btn btn-sm btn-secondary"
                >
                  🔄 สุ่มทั้งหมด
                </button>
              </div>
            </div>
          </header>

          {/* Responsive Studio Grid */}
          <div className="flex-1 min-h-0 w-full mx-auto px-2.5 sm:px-4 mland:px-2.5 py-2 sm:py-2.5 mland:py-1.5 overflow-y-auto sm:overflow-hidden mland:overflow-hidden grid grid-cols-1 sm:grid-cols-[245px_1fr] md:grid-cols-[270px_1fr] sm:grid-rows-[minmax(0,1fr)] mland:grid-cols-[210px_1fr] mland:grid-rows-[minmax(0,1fr)] gap-2.5 sm:gap-3 mland:gap-2">
          {/* Left Column: Athlete Card Preview + Active Traits + Primary CTAs */}
          <div className="flex flex-col justify-between gap-2 mland:gap-1.5 min-h-0 sm:h-full mland:h-full sm:overflow-y-auto mland:overflow-y-auto shrink-0">
            <div className="flex flex-col gap-1.5 mland:gap-1 shrink-0">
              <AthleteCard
                ov={ov}
                pot={estPot}
                talent={cTalent}
                roleLabel={cSp}
                shirtNo={cNo}
                kit1={cColor}
                kit2="#fad05a"
                faceProps={{
                  player: previewPlayer,
                  careerProfile: previewProfile,
                  kitColor: cColor,
                  trimColor: '#fad05a'
                }}
                name={previewName}
                subtitle={`อายุ ${cAge} ปี · ${curArch.icon} ${curArch.name}`}
                bio={previewBio}
                categories={summarizeStatGroups(subStats)}
                renderBadges={(palette) => (
                  <span className={`text-[8.5px] mland:text-[7px] font-bold truncate max-w-[110px] ${palette.clubText}`}>
                    {cTraits.length > 0 ? `✨ ${cTraits.length} นิสัยติดตัว` : 'นักเตะใหม่'}
                  </span>
                )}
              />

              {cTraits.length > 0 && (
                <div className="px-2 py-1 mland:py-0.5 text-center text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] leading-snug">
                  {cTraits
                    .map((tid) => TRAIT_BY_ID[tid])
                    .filter(Boolean)
                    .map((tr) => `${tr.icon} ${tr.name}`)
                    .join(' · ')}
                </div>
              )}
            </div>

            <div className="shrink-0 space-y-1.5 mland:space-y-1">
              <button
                type="button"
                onClick={startCareerNow}
                className="btn btn-md btn-gold w-full font-extrabold truncate"
              >
                ⚽ เริ่มอาชีพช่อง #{targetSlot} ({cSp} · OVR {ov})
              </button>
              <button
                type="button"
                onClick={saveToCustomPool}
                className="btn btn-sm btn-surface w-full border-[var(--g)]/50 text-[var(--g)] hover:bg-[var(--g-soft)] truncate"
              >
                💾 บันทึกตัวไว้ซื้อในโหมดผู้จัดการ
              </button>
            </div>
          </div>

          {/* Right Column: 4-Tab Clean Customization Workspace */}
          <div className="flex flex-col min-h-0 sm:h-full mland:h-full gap-2 mland:gap-1.5">
            <div className="seg-bar grid grid-cols-4 w-full shrink-0">
              {(
                [
                  ['info', '📝 ข้อมูล & ตำแหน่ง'],
                  ['face', '🎭 หน้าตา & ชุด'],
                  ['arch', '✨ สไตล์ & นิสัย'],
                  ['stats', '📊 พลังละเอียด']
                ] as const
              ).map(([tid, tlbl]) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => { SFX.tap(); setCrMobTab(tid); }}
                  className={`seg-btn py-1.5 mland:py-1 truncate ${crMobTab === tid ? 'seg-btn-active' : ''}`}
                >
                  {tlbl}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] px-4 py-3 mland:px-3 mland:py-2">
              {/* Tab 1: Identity, Bio, Difficulty, Position & SubRole (Compact Hairline Sections) */}
              <div className={`divide-y divide-[var(--line)]/65 ${crMobTab === 'info' ? '' : 'hidden'}`}>
                {/* Section 1: Name, Number, Age, Difficulty */}
                <div className="pb-2.5 mland:pb-1.5 space-y-2 mland:space-y-1">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mland:gap-1.5">
                    <input
                      value={cName}
                      onChange={(e) => setCName(e.target.value.replace(/["'<>`]/g, ''))}
                      placeholder="กรอกชื่อ-นามสกุลนักเตะ (เว้นว่างสุ่มให้)"
                      maxLength={24}
                      className="flex-1 min-w-[160px] px-3 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/70 text-sm mland:text-xs font-medium focus:outline-none focus:border-[var(--g)]"
                    />
                    <div className="flex items-center gap-1 px-2 py-1.5 mland:py-1 rounded-xl mland:rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/70 shrink-0">
                      <span className="text-xs text-[var(--mut)] font-bold">#</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        aria-label="หมายเลขเสื้อ"
                        value={cNo}
                        onChange={(e) => setCNo(clamp(parseInt(e.target.value, 10) || 1, 1, 99))}
                        className="w-9 bg-transparent text-sm mland:text-xs font-extrabold text-center tabular focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { SFX.tap(); setCName(genPlayerName()); }}
                      className="btn btn-sm btn-secondary shrink-0"
                    >
                      🔄 สุ่มชื่อ
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10.5px] mland:text-[9px] text-[var(--mut)] font-semibold mr-0.5">เบอร์แนะนำ:</span>
                      {quickNumbers[cPos].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => { SFX.tap(); setCNo(num); }}
                          className={`px-2 py-0.5 rounded-md text-[11px] mland:text-[9px] font-bold tabular cursor-pointer transition-colors ${
                            cNo === num ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          #{num}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mland:gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)]">อายุ:</span>
                        <div className="seg-bar">
                          {[16, 17, 18, 19].map((ageOpt) => (
                            <button
                              key={ageOpt}
                              type="button"
                              onClick={() => { SFX.tap(); setCAge(ageOpt); }}
                              className={`seg-btn py-0.5 px-2 text-[11px] mland:text-[9px] tabular ${cAge === ageOpt ? 'seg-btn-active' : ''}`}
                            >
                              {ageOpt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)]">ความยาก:</span>
                        <div className="seg-bar">
                          {(['ง่าย', 'ปกติ', 'ยาก'] as const).map((dlbl, didx) => (
                            <button
                              key={dlbl}
                              type="button"
                              onClick={() => { SFX.tap(); setCDiff(didx); }}
                              className={`seg-btn py-0.5 px-2 text-[11px] mland:text-[9px] ${cDiff === didx ? 'seg-btn-active' : ''}`}
                            >
                              {dlbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Height, Weight & Preferred Foot */}
                <div className="py-2.5 mland:py-1.5 space-y-1.5 mland:space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                      📐 สัดส่วนร่างกาย &amp; เท้าที่ถนัด
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        const rb = rollPlayerBio(cPos, cSp);
                        setCHt(rb.ht);
                        setCWt(rb.wt);
                        setCFoot(rb.foot);
                      }}
                      className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] hover:underline cursor-pointer"
                    >
                      🎲 สุ่มรูปร่าง
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2 items-center">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] mland:text-[9.5px]">
                        <span className="font-semibold text-[var(--ink)]">ส่วนสูง</span>
                        <b className="tabular font-extrabold text-[var(--g)]">{cHt} ซม.</b>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setCHt((v) => clamp(v - 1, 155, 205))} className="btn-icon w-6 h-6 text-xs">-</button>
                        <input
                          type="range"
                          min={155}
                          max={205}
                          value={cHt}
                          onChange={(e) => setCHt(Number(e.target.value))}
                          className="flex-1 min-w-0 accent-[var(--g)]"
                        />
                        <button type="button" onClick={() => setCHt((v) => clamp(v + 1, 155, 205))} className="btn-icon w-6 h-6 text-xs">+</button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] mland:text-[9.5px]">
                        <span className="font-semibold text-[var(--ink)]">น้ำหนัก</span>
                        <b className="tabular font-extrabold text-[var(--g)]">{cWt} กก.</b>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setCWt((v) => clamp(v - 1, 50, 110))} className="btn-icon w-6 h-6 text-xs">-</button>
                        <input
                          type="range"
                          min={50}
                          max={110}
                          value={cWt}
                          onChange={(e) => setCWt(Number(e.target.value))}
                          className="flex-1 min-w-0 accent-[var(--g)]"
                        />
                        <button type="button" onClick={() => setCWt((v) => clamp(v + 1, 50, 110))} className="btn-icon w-6 h-6 text-xs">+</button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] mland:text-[9.5px]">
                        <span className="font-semibold text-[var(--ink)]">เท้าถนัด</span>
                        <span className={`inline-flex items-center gap-1 font-bold ${getFootColorMeta(cFoot).textCls}`}>
                          <FootPairIcon foot={cFoot} size="xs" />
                          <span>{getFootColorMeta(cFoot).label}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['L', 'R', 'B'] as const).map((fk) => {
                          const fm = getFootColorMeta(fk);
                          const active = cFoot === fk;
                          return (
                            <button
                              key={fk}
                              type="button"
                              onClick={() => { SFX.tap(); setCFoot(fk); }}
                              className={`btn btn-xs px-1 gap-0.5 text-[10px] mland:text-[8.5px] whitespace-nowrap ${
                                active ? fm.buttonActiveCls : 'btn-secondary text-[var(--mut)] hover:text-[var(--ink)]'
                              }`}
                            >
                              <FootPairIcon foot={fk} size="xs" />
                              <span>{fm.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Primary Position & Sub-Role */}
                <div className="pt-2.5 mland:pt-1.5 space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">ตำแหน่งหลักในสนาม</span>
                    <span className="text-[10.5px] mland:text-[8.5px] text-[var(--g)] font-semibold truncate">
                      สูตร OVR: {posWeightSummary[cPos]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1.5">
                    {([
                      ['FW', '⚽ กองหน้า', 'ล่าตาข่าย & ริมเส้น'],
                      ['MF', '🎯 กองกลาง', 'คุมจังหวะ & สร้างเกม'],
                      ['DF', '🛡️ กองหลัง', 'สกัด & คุมแนวรับ'],
                      ['GK', '🧤 ผู้รักษาประตู', 'เซฟ & สั่งแนวรับ']
                    ] as [Position, string, string][]).map(([p, l, sub]) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => changePosition(p)}
                        className={`px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg text-left border cursor-pointer transition-all ${
                          cPos === p
                            ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                            : 'bg-[var(--surface-2)]/55 text-[var(--ink)] border-[var(--line)] hover:border-[var(--g)]'
                        }`}
                      >
                        <div className="font-bold text-xs mland:text-[10px] truncate">{l}</div>
                        <div className={`text-[10px] mland:text-[8px] mt-0.5 truncate ${cPos === p ? 'text-white/85' : 'text-[var(--mut)]'}`}>{sub}</div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 mland:space-y-1 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] mr-1">บทบาท:</span>
                      {SPX[cPos].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeSubRole(s)}
                          className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors ${
                            cSp === s
                              ? 'bg-[var(--g)] text-white shadow-xs'
                              : 'bg-[var(--surface-2)]/70 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {s} · {SPN[s]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-snug">
                      <b className="text-[var(--g)]">{cSp} ({SPN[cSp] || cSp})</b> — {ROLE_HINT[cSp] || `บทบาท ${SPN[cSp] || cSp} (${curArch.icon} ${curArch.name})`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab 2: Face, Hair & Kit Colors */}
              <div className={`divide-y divide-[var(--line)]/65 ${crMobTab === 'face' ? '' : 'hidden'}`}>
                <div className="pb-2.5 mland:pb-1.5 space-y-2 mland:space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">เลือกใบหน้าต้นแบบ</span>
                      <span className="hidden sm:inline ml-2 text-[11px] text-[var(--mut)]">คลิกเลือกแล้วปรับละเอียดด้านล่างได้</span>
                    </div>
                    <button
                      type="button"
                      onClick={rerollFaceGallery}
                      className="btn btn-xs btn-secondary shrink-0"
                    >
                      🎲 สุ่ม 6 หน้าใหม่
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-6 gap-2 mland:gap-1.5">
                    {faceChoices.map((f, idx) => {
                      const isPicked =
                        cSkin === f.k && cHair === f.h && cHs === f.hs && cFh === f.fh && cFs === f.fs && cEy === f.ey && cAcc === (f.acc ?? 0);
                      const sampleProfile: PlayerCareerProfile = {
                        ...previewProfile,
                        c: f.c,
                        k: f.k,
                        h: f.h,
                        hs: f.hs,
                        fh: f.fh,
                        fs: f.fs,
                        ey: f.ey,
                        acc: f.acc ?? 0
                      };
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            applyFaceTraits(f);
                          }}
                          className={`p-1.5 mland:p-1 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            isPicked
                              ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/50'
                              : 'bg-[var(--surface-2)]/50 border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          <PlayerFace player={previewPlayer} careerProfile={sampleProfile} kitColor={f.c} trimColor="#fad05a" size={38} />
                          <span className="text-[9.5px] mland:hidden font-semibold text-[var(--mut)] truncate w-full text-center">
                            {HS_N[f.hs]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="py-2.5 mland:py-1.5 grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2">
                  {[
                    ['สีเสื้อประจำตัว', kitPalette, cColor, setCColor],
                    ['โทนสีผิว', SKIN_P, cSkin, setCSkin],
                    ['สีผม & เครา', HAIR_P, cHair, setCHair]
                  ].map(([lbl, cols, cur, setter]) => (
                    <div key={lbl as string} className="space-y-1">
                      <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">{lbl as string}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(cols as string[]).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              (setter as React.Dispatch<React.SetStateAction<string>>)(col);
                            }}
                            aria-label={`${lbl as string} ${col}`}
                            className={`w-6 h-6 mland:w-5 mland:h-5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer transition-transform ${
                              cur === col ? 'ring-2 ring-[var(--lamp)] scale-110' : 'hover:scale-105'
                            }`}
                            style={{ background: col }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2.5 mland:pt-1.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-x-4 gap-y-2 mland:gap-y-1.5 text-xs mland:text-[10px]">
                  {[
                    ['รูปหน้า', FS_N, cFs, setCFs],
                    ['แววตา / อารมณ์', EY_N, cEy, setCEy],
                    ['ทรงผม', HS_N, cHs, setCHs],
                    ['หนวดเครา', FH_N, cFh, setCFh],
                    ['เอกลักษณ์ / เครื่องประดับ', ACC_N, cAcc, setCAcc]
                  ].map(([lbl, arr, cur, setter]) => (
                    <div
                      key={lbl as string}
                      className={`space-y-1 ${
                        lbl === 'เอกลักษณ์ / เครื่องประดับ' ? 'sm:col-span-2 mland:col-span-2' : ''
                      }`}
                    >
                      <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">{lbl as string}</div>
                      <div className="flex flex-wrap gap-1">
                        {(arr as string[]).map((l, i) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              (setter as React.Dispatch<React.SetStateAction<number>>)(i);
                            }}
                            className={`px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[9px] font-semibold cursor-pointer transition-colors ${
                              cur === i ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface-2)]/65 border border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab 3: Archetype, Talent & Football Traits */}
              <div className={`divide-y divide-[var(--line)]/65 ${crMobTab === 'arch' ? '' : 'hidden'}`}>
                <div className="pb-2.5 mland:pb-1.5 space-y-2 mland:space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)]">สไตล์ประจำตำแหน่ง</span>
                      <span className="ml-2 text-[11px] mland:text-[9px] text-[var(--mut)]">
                        ท่าประจำสาย: <b className="text-[var(--g)]">🔥 {activeTabStatsBadge} (+8)</b>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={rerollTalent}
                        className="btn btn-xs btn-secondary"
                      >
                        🌟 สุ่มพรสวรรค์ ({cTalent})
                      </button>
                      <button
                        type="button"
                        onClick={rerollStartingPoints}
                        className="btn btn-xs btn-gold"
                      >
                        🎲 สุ่มแต้มใหม่
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.32fr_0.88fr] mland:grid-cols-[1.28fr_0.9fr] gap-3 mland:gap-2 items-start">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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
                            className={`p-2 mland:p-1.5 rounded-xl mland:rounded-lg text-left border cursor-pointer transition-all ${
                              active
                                ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                                : 'bg-[var(--surface-2)]/50 border-[var(--line)] hover:border-[var(--g)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs mland:text-[10px] truncate">{arch.icon} {arch.name}</span>
                              <span className={`text-[9.5px] mland:text-[8px] font-bold shrink-0 ${active ? 'text-white/90' : 'text-[#8a5b00] dark:text-[var(--lamp)]'}`}>
                                🔥 {SIGL[arch.sig] || arch.sig}
                              </span>
                            </div>
                            <div className={`text-[10px] mland:text-[8.5px] mt-0.5 leading-snug line-clamp-2 ${active ? 'text-white/90' : 'text-[var(--mut)]'}`}>
                              {arch.desc}
                            </div>
                            <div className={`text-[9.5px] mland:text-[8px] font-semibold mt-1 truncate ${active ? 'text-white/95' : 'text-[var(--g)]'}`}>
                              {coreTags.slice(0, 3).join(' · ')}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="lg:pl-3 lg:border-l border-[var(--line)]/65 space-y-2 mland:space-y-1">
                      <div className="flex items-center justify-between text-xs mland:text-[10px]">
                        <span className="font-bold text-[var(--ink)]">พลังหลักหลังสุ่ม</span>
                        <span className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] tabular">OVR {ov}</span>
                      </div>
                      {ATT.map(([k, l]) => {
                        const rolledAdd = cAttrs[k] - cBase[k];
                        const archCoreAdd = curArch.coreBonus[k] || 0;
                        return (
                          <div key={k} className="flex items-center gap-2 text-xs mland:text-[9.5px]">
                            <span className="w-24 mland:w-20 flex items-center gap-1 truncate shrink-0">
                              <span className="font-semibold text-[var(--ink)]">{l}</span>
                              {archCoreAdd > 0 && <span className="text-[9.5px] font-bold text-[var(--g)]">+{archCoreAdd}</span>}
                              {rolledAdd > 0 && <span className="text-[9.5px] font-bold text-[#9a6700] dark:text-[var(--lamp)]">+{rolledAdd}</span>}
                            </span>
                            <div className="flex-1 h-2.5 mland:h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${cAttrs[k]}%`, background: statBarColor(cAttrs[k]) }} />
                            </div>
                            <span className="w-6 text-right font-extrabold tabular text-[var(--ink)]">{cAttrs[k]}</span>
                          </div>
                        );
                      })}
                      <div className="pt-1.5 border-t border-[var(--line)]/60 flex items-center justify-between gap-2 text-[11px] mland:text-[9px]">
                        <span className="text-[var(--mut)] font-semibold">เพดานพรสวรรค์</span>
                        <TalentBadge talent={cTalent} variant="meter" showLabel size="xs" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Football Personality Traits Selector */}
                <div className="pt-2.5 mland:pt-1.5 space-y-2 mland:space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs mland:text-[10px] truncate text-[var(--ink)]">
                      ✨ นิสัยลูกหนัง (เลือก 1–4 อย่าง · {cTraits.length}/4)
                    </span>
                    <button
                      type="button"
                      onClick={rerollTraits}
                      className="btn btn-xs btn-secondary shrink-0"
                    >
                      🎲 สุ่มนิสัยใหม่
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {posTraits.map((tr) => {
                      const active = cTraits.includes(tr.id);
                      const hasConflict = !active && cTraits.some((cid) => tr.conflicts?.includes(cid) || TRAIT_BY_ID[cid]?.conflicts?.includes(tr.id));
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => toggleTrait(tr.id)}
                          title={tr.desc}
                          className={`px-2.5 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[9px] font-semibold border cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-xs'
                              : hasConflict
                                ? 'bg-[var(--surface-2)]/35 text-[var(--mut)] border-dashed border-[var(--line)] opacity-60'
                                : 'bg-[var(--surface-2)]/65 text-[var(--ink)] border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          {tr.icon} {tr.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-0.5 text-[10.5px] mland:text-[9px] text-[var(--mut)]">
                    {cTraits.map((tid) => {
                      const tr = TRAIT_BY_ID[tid];
                      if (!tr) return null;
                      return (
                        <div key={tid} className="truncate">
                          <b className="text-[var(--ink)]">{tr.icon} {tr.name}</b> — {tr.desc}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tab 4: Sub-stats Breakdown (Clean Hairline Columns) */}
              <div className={`space-y-2.5 mland:space-y-1.5 ${crMobTab === 'stats' ? '' : 'hidden'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--line)]/65">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] mland:text-[9px] text-[var(--mut)]">
                    <span className="font-bold text-xs mland:text-[10px] text-[var(--ink)]">ค่าพลังเฉพาะด้าน</span>
                    <span>
                      ★ <span className="text-[#9a6700] dark:text-[var(--lamp)] font-semibold">ท่าประจำสาย (+8)</span> · <span className="text-[var(--g)] font-semibold">โบนัสสาย</span> · <span className="text-[#9a6700] dark:text-[var(--lamp)] font-semibold">แต้มสุ่ม</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={rerollStartingPoints}
                    className="btn btn-xs btn-gold shrink-0"
                  >
                    🎲 สุ่มแต้มใหม่
                  </button>
                </div>
                <div
                  className={`grid grid-cols-1 gap-x-4 gap-y-3 mland:gap-y-2 ${
                    subStats.length === 6 ? 'sm:grid-cols-3 mland:grid-cols-3' : 'sm:grid-cols-2 mland:grid-cols-2'
                  }`}
                >
                  {subStats.map((g) => (
                    <div key={g[0]} className="space-y-1 mland:space-y-0.5">
                      <div className="font-bold text-[11.5px] mland:text-[9.5px] pb-0.5 border-b border-[var(--line)]/65 text-[var(--ink)]">
                        {g[0]}
                      </div>
                      {g[1].map(([lbl, val, statKey]) => {
                        const isSig = statKey === curArch.sig;
                        const archBonus = statKey ? curArch.sbBonus[statKey] || 0 : 0;
                        const rolledSub = statKey ? cSubMap[statKey] || 0 : 0;
                        return (
                          <div key={lbl} className="flex items-center gap-1.5 text-[11px] mland:text-[9px]">
                            <span className="w-[88px] sm:w-[96px] mland:w-[72px] shrink-0 truncate flex items-center gap-1 min-w-0">
                              {isSig && <span className="text-[#9a6700] dark:text-[var(--lamp)] font-black shrink-0" title="ท่าไม้ตายประจำสาย">★</span>}
                              <span className={`truncate ${isSig ? 'font-bold text-[var(--ink)]' : archBonus > 0 ? 'font-semibold text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                                {lbl}
                              </span>
                              {archBonus > 0 && <span className="text-[9px] font-bold text-[var(--g)] shrink-0">+{archBonus}</span>}
                              {rolledSub > 0 && <span className="text-[9px] font-bold text-[#9a6700] dark:text-[var(--lamp)] shrink-0">+{rolledSub}</span>}
                            </span>
                            <div className="flex-1 min-w-[36px] h-2 mland:h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${clamp(val, 6, 100)}%`, background: statBarColor(val) }} />
                            </div>
                            <b className="w-6 mland:w-5 text-right shrink-0 tabular text-[var(--ink)]">{val}</b>
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
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden bg-[#040c08] stage-viewport">
      {/* Full-Bleed Stadium Artwork Canvas — Blurred & Dark Moody Night Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#040c08]"
      >
        <img
          src={stadiumHeroBg}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center brightness-[0.52] saturate-95"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020805]/86 via-[#05140c]/68 to-[#020805]/88" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(16,68,40,0.16),rgba(2,8,5,0.62)_78%)]" />
      </div>

      {/* Framed Main Hub Stage with Comfortable Vertical & Horizontal Breathing Room */}
      <div className="relative z-10 w-full max-w-6xl h-full max-h-[82%] sm:max-h-[min(78%,600px)] mland:max-h-[84%] mx-auto my-auto rounded-3xl mland:rounded-2xl border border-white/14 bg-[#07130d]/82 shadow-[0_24px_64px_rgba(0,0,0,0.68)] px-3.5 sm:px-5 mland:px-3.5 py-3 sm:py-4 mland:py-2 flex flex-col gap-3 mland:gap-1.5 overflow-hidden">
        {/* Top Stadium Masthead */}
        <header className="shrink-0 flex items-center justify-between gap-3 mland:gap-2">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 mland:w-8 mland:h-8 rounded-xl bg-white/12 border border-white/15 flex items-center justify-center shrink-0 shadow-lg">
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
              <h1 className="text-xl sm:text-2xl mland:text-lg font-extrabold font-display tracking-wide leading-none text-white">
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
              onClick={() => { SFX.tap(); setShowImport(true); }}
              className="h-8 sm:h-9 mland:h-7 px-3 mland:px-2.5 rounded-xl mland:rounded-lg border border-white/22 bg-[#11241a]/88 hover:bg-[#193325] hover:border-white/38 text-[11px] sm:text-xs mland:text-[10px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_8px_rgba(0,0,0,0.28)] transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FolderInput className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-emerald-200 shrink-0" />
              <span>นำเข้าเซฟ</span>
            </button>
            <PWAInstallButton variant="compact" tone="stadium" onToast={onToast} />
          </div>
        </header>

        {/* Main 2 Columns: Col 1 = In-Game Collector Athlete Card | Col 2 = 2-Column Save & Mode Hub */}
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[0.76fr_1.44fr] sm:grid-rows-[minmax(0,1fr)] mland:grid-cols-[0.74fr_1.46fr] mland:grid-rows-[minmax(0,1fr)] gap-3 sm:gap-4 mland:gap-3 overflow-y-auto sm:overflow-hidden mland:overflow-hidden items-stretch">
          {/* Column 1: Signature In-Game Athlete Card */}
          <aside className="min-h-0 flex flex-col">
            <AthleteCard
              ov={activeStar.ov}
              pot={activeStar.pot}
              talent={activeStar.talent}
              roleLabel={activeStar.pos}
              shirtNo={activeStar.no}
              kit1={activeStar.kit1}
              kit2={activeStar.kit2}
              faceProps={{
                player: activeStar.player,
                team: activeStar.team,
                club: activeStar.club,
                isMyClub: !!activeStar.club,
                careerProfile: activeStar.profile
              }}
              name={activeStar.name}
              subtitle={`อายุ ${activeStar.age} ปี · ${activeStar.archLabel} · ${activeStar.sourceLabel}`}
              bio={activeStar.bio}
              categories={activeStar.categories}
              stretchStage
              className="flex-1 min-h-0 shadow-[0_18px_42px_rgba(0,0,0,0.65)]"
              renderBadges={(palette) => (
                <div className="flex items-center gap-1 max-w-[130px] mland:max-w-[95px]">
                  <div className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 mland:[&>svg]:w-3 mland:[&>svg]:h-3">
                    <ClubCrest name={activeStar.clubName} size={14} team={activeStar.team} club={activeStar.club} isMyClub={!!activeStar.club} />
                  </div>
                  <span className={`text-[9px] mland:text-[7px] font-semibold truncate ${palette.clubText}`}>
                    {activeStar.clubName}
                  </span>
                </div>
              )}
              renderHeaderAction={(palette) => (
                <button
                  type="button"
                  onClick={cycleStarPoster}
                  title="สลับนักเตะแนะนำ"
                  aria-label="สลับนักเตะแนะนำ"
                  className={`w-6 h-6 mland:w-5 mland:h-5 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0 ${palette.iconBtn}`}
                >
                  <RefreshCw className="w-3 h-3 mland:w-2.5 mland:h-2.5" />
                </button>
              )}
            />
          </aside>

          {/* Column 2: Save Hub Split Inside into 2 Columns ([Manager Mode + Saves] | [Player Mode + Saves]) */}
          <div className="min-h-0 sm:h-full mland:h-full grid grid-cols-2 grid-rows-[minmax(0,1fr)] gap-2.5 sm:gap-3 mland:gap-2 overflow-hidden">
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

              <div className="flex-1 min-h-0 flex flex-col rounded-2xl mland:rounded-xl bg-[var(--surface)]/97 border border-[var(--line)] shadow-2xl overflow-hidden">
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

              <div className="flex-1 min-h-0 flex flex-col rounded-2xl mland:rounded-xl bg-[var(--surface)]/97 border border-[var(--line)] shadow-2xl overflow-hidden">
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
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowImport(false)}
        >
          <div
            className="w-full max-w-md p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm font-display flex items-center gap-2">
                <FolderInput className="w-4 h-4 text-[var(--g)] shrink-0" />
                <span>นำเข้าโค้ดเซฟ</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                aria-label="ปิดหน้าต่าง"
                className="btn-icon rounded-full!"
              >
                <X className="w-4 h-4" />
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
                className="btn btn-md btn-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="btn btn-md btn-primary flex-1"
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

