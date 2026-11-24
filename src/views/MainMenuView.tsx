import React, { useState } from 'react';
import { PWAInstallButton } from '../pwa.tsx';
import type { Position, SubRole, StatKey, GameMode, CoreAttrs, Player, Team, PlayerCareerProfile, GameState, PlayerArchetype } from '../types/game';
import { R, P, clamp } from '../utils/math';
import { ATT, SPX, SPN, ROLE_HINT, SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, SIGL, ROLE_BASE_ATTRS, PLAYER_ARCHETYPES } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { genPlayerName, clearNamePool, genClubNames, NSL, loadGameFromSlot, deleteSlot, firstEmptySlot, mkTeam, OVF, dtInfo } from '../engine/playerCore';
import { cleanImportJson } from '../engine/saveCodec';
import { ovColor } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';

export const MainMenu: React.FC<{
  onStartManager: (slot: number, names: string[][], t0: Team[], pick: number, diff: number) => void;
  onStartPlayer: (slot: number, profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>) => void;
  onLoadSave: (mode: GameMode, slot: number, state: GameState) => void;
  onToast: (msg: string) => void;
}> = ({ onStartManager, onStartPlayer, onLoadSave, onToast }) => {
  const [step, setStep] = useState<'menu' | 'ms' | 'cr'>('menu');
  const [targetSlot, setTargetSlot] = useState<number>(1);
  const [previewClubs, setPreviewClubs] = useState<{ names: string[][]; t0: Team[] } | null>(null);
  const [diff, setDiff] = useState<number>(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, setRefresh] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [crMobTab, setCrMobTab] = useState<'info' | 'face' | 'arch' | 'stats'>('info');

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
    setStep('ms');
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
    setStep('cr');
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
    for (let k = 1; k <= NSL; k++) {
      const d = loadGameFromSlot(m, k);
      if (d && Array.isArray(d.teams) && (m === 'm' || d.p)) {
        const name = m === 'm' ? d.club?.name || d.teams[d.me]?.name : d.p?.name;
        const delKey = `${m}_${k}`;
        const isConfirm = confirmDel === delKey;
        rows.push(
          <div key={k} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onLoadSave(m, k, d);
              }}
              className="flex-1 min-w-0 text-left px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/75 hover:bg-[var(--surface-2)] hover:border-[var(--g)] transition-colors cursor-pointer"
            >
              <div className="font-semibold text-sm mland:text-[10.5px] truncate">▶ สล็อต {k} · {name}</div>
              <div className="text-xs mland:text-[9px] text-[var(--mut)] truncate tabular">
                ซีซั่น {d.season} · นัด {d.md}/{d.fx?.length || 30}
                {m === 'p' && d.p ? ` · ${d.p.pos} · ${d.p.ap} นัด` : ''}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteSlot(m, k)}
              aria-label="ลบเซฟ"
              className={`min-h-[42px] mland:min-h-[34px] px-3 mland:px-2.5 rounded-xl border text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors shrink-0 ${
                isConfirm ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)]'
              }`}
            >
              {isConfirm ? 'ยืนยันลบ?' : '🗑'}
            </button>
          </div>
        );
      } else if (!shownEmpty) {
        shownEmpty = true;
        rows.push(
          <button
            key={k}
            type="button"
            onClick={() => (m === 'm' ? openManagerSetup(k) : openPlayerSetup(k))}
            className="w-full text-left px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border border-dashed border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/40 transition-colors cursor-pointer"
          >
            <div className="font-semibold text-sm mland:text-[10.5px]">＋ สล็อต {k} · ว่าง</div>
            <div className="text-xs mland:text-[9px] text-[var(--mut)]">เริ่มเกมใหม่</div>
          </button>
        );
      }
    }
    return <div className="flex flex-col gap-1.5 mland:gap-1">{rows}</div>;
  };

  if (step === 'ms' && previewClubs) {
    return (
      <div className="h-full min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md safe-top safe-x">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-3 mland:py-1 flex flex-wrap items-center justify-between gap-2.5 mland:gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl mland:text-sm font-bold font-display truncate">🏟️ เลือกสโมสรเริ่มต้น</h2>
              <p className="text-xs text-[var(--mut)] truncate mland:hidden">เริ่มจากลีกระดับจังหวัด · แก้ชื่อ ตรา และสีชุดได้ภายหลัง</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 p-1 mland:p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                {(['ง่าย', 'ปกติ', 'ยาก'] as const).map((lbl, idx) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => { SFX.tap(); setDiff(idx); }}
                    className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors ${
                      diff === idx ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="px-3.5 mland:px-2.5 py-1.5 mland:py-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs sm:text-sm mland:text-[10.5px] font-semibold cursor-pointer"
              >
                ‹ กลับ
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden safe-bottom safe-x">
          <div className="max-w-5xl mland:max-w-none mx-auto p-3 sm:p-5 mland:p-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mland:grid-cols-4 gap-2.5 mland:gap-1.5 mland:min-h-full mland:auto-rows-fr">
            {previewClubs.t0.map((t, idx) => {
              const avg = Math.round(t.sq.reduce((sum, q) => sum + q.ov, 0) / t.sq.length);
              const tierTag = avg >= 42 ? 'เต็งลีก' : avg >= 39 ? 'กลางตาราง' : 'ท้าทาย';
              const accent = t.kc?.[0] || '#158049';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onStartManager(targetSlot, previewClubs.names, previewClubs.t0, idx, diff); }}
                  style={{ borderLeftColor: accent }}
                  className="group flex items-center gap-3 mland:gap-2 p-3 mland:p-1.5 rounded-2xl mland:rounded-xl border border-[var(--line)] border-l-4 bg-[var(--surface)] hover:border-[var(--g)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] text-left transition-all cursor-pointer shadow-xs min-w-0"
                >
                  <div className="p-1 mland:p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/80 border border-[var(--line)]/60 shrink-0 mland:[&_svg]:w-6 mland:[&_svg]:h-6 group-hover:scale-105 transition-transform">
                    <ClubCrest name={t.name} size={36} team={t} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm mland:text-[10.5px] truncate leading-tight text-[var(--ink)]">{t.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9.5px] mland:text-[8.5px] font-bold ${avg >= 42 ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)]' : avg >= 39 ? 'bg-[var(--g-soft)] text-[var(--g)]' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                        {tierTag}
                      </span>
                      <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">{t.sq.length} คน</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-white text-xs mland:text-[10px] font-bold tabular shrink-0 shadow-xs" style={{ background: ovColor(avg) }}>
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
    const previewPlayer: Player = { n: cName.trim() || 'นักเตะใหม่', pos: cPos, ro: cSp, ov, age: 17, pot: 92, fit: 100, inj: 0, no: cNo, me: 1 };
    const previewProfile: PlayerCareerProfile = {
      name: cName.trim() || 'นักเตะใหม่', pos: cPos, sp: cSp, no: cNo, tr: curArch.tr, sig: curArch.sig, archName: `${curArch.icon} ${curArch.name}`,
      sb: combinedSb, c: cColor, k: cSkin, h: cHair, hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, b: cBase, a: cAttrs,
      age: 17, gl: 0, as: 0, ap: 0, rs: 0, en: 100, plan: 1
    };
    const previewDt = dtInfo(previewPlayer, previewProfile);
    const subStats = previewDt.G;

    const applyRolledStats = (pos: Position, sp: SubRole, arch: PlayerArchetype) => {
      const rolled = rollStartingStats(pos, sp, arch);
      setCBase(rolled.base);
      setCAttrs(rolled.attrs);
      setCSubMap(rolled.subMap);
    };

    const changePosition = (pos: Position) => {
      SFX.tap();
      const sp = SPX[pos][0];
      const nextArch = PLAYER_ARCHETYPES.find((a) => a.pos.includes(pos))!;
      setCPos(pos);
      setCSp(sp);
      setCNo(defaultNoForPos(pos));
      setCArchId(nextArch.id);
      applyRolledStats(pos, sp, nextArch);
    };

    const changeSubRole = (sp: SubRole) => {
      SFX.tap();
      setCSp(sp);
      applyRolledStats(cPos, sp, curArch);
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
      setCSp(rSp);
      setCArchId(rArch.id);
      applyRolledStats(cPos, rSp, rArch);
    };

    const startCareerNow = () => {
      SFX.tap();
      onStartPlayer(targetSlot, {
        name: (cName || genPlayerName()).trim(), pos: cPos, sp: cSp, no: clamp(cNo || 10, 1, 99), tr: curArch.tr, sig: curArch.sig,
        archName: `${curArch.icon} ${curArch.name}`, sb: combinedSb, c: cColor, k: cSkin, h: cHair,
        hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, a: { ...cAttrs }
      });
    };

    return (
      <div className="h-full min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md safe-top safe-x">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-2.5 mland:py-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl mland:text-sm font-bold font-display truncate">⚽ สร้างนักเตะอาชีพ</h2>
              <p className="text-[11px] sm:text-xs text-[var(--mut)] truncate mland:hidden">เลือกตำแหน่งและสไตล์ แล้วระบบจะสุ่มแต้มเริ่มต้นให้เข้ากับบทบาท</p>
            </div>
            <button type="button" onClick={() => setStep('menu')} className="px-3.5 mland:px-2.5 py-1.5 mland:py-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs sm:text-sm mland:text-[10.5px] font-semibold shrink-0 cursor-pointer">
              ‹ กลับ
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden overflow-x-hidden safe-bottom safe-x">
          <div className="max-w-5xl mland:max-w-none mx-auto p-3 sm:p-5 mland:p-1.5 grid grid-cols-1 lg:grid-cols-[280px_1fr] mland:grid-cols-[190px_1fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:h-full">
            <div className="lg:sticky lg:top-3 mland:static flex flex-col gap-2.5 mland:gap-1 mland:h-full mland:justify-between">
              <div className="rounded-3xl mland:rounded-2xl p-4 mland:p-2 text-white border border-white/20" style={{ background: `linear-gradient(155deg, ${ovColor(ov)}, #0b1f15 78%)` }}>
                <div className="flex items-center justify-between gap-3 mland:gap-1.5 mland:[&_svg]:w-12 mland:[&_svg]:h-12">
                  <div className="text-center">
                    <div className="text-4xl mland:text-xl font-bold font-display leading-none">{ov}</div>
                    <div className="text-xs mland:text-[9px] font-bold mt-1 mland:mt-0.5 border-t border-white/40 pt-1 mland:pt-0.5">{cSp} · #{cNo}</div>
                  </div>
                  <PlayerFace player={previewPlayer} careerProfile={previewProfile} size={68} bare />
                </div>
                <div className="text-center font-bold text-lg mland:text-xs border-b border-white/30 py-2 mland:py-0.5 truncate">{cName.trim() || 'ชื่อนักเตะ'}</div>
                <div className="text-center text-[11px] mland:text-[9px] font-semibold text-white/90 pt-1.5 mland:pt-0.5 truncate">
                  {curArch.icon} {curArch.name} · ⭐ {SIGL[curArch.sig]}
                </div>
                <div className="grid grid-cols-5 gap-1 pt-2 mland:pt-1 text-center text-[11px] mland:text-[9px]">
                  {ATT.map(([k, l]) => (
                    <div key={k}>
                      <div className="text-base mland:text-xs font-bold tabular">{cAttrs[k]}</div>
                      <div className="opacity-85">{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mland:gap-1 text-center">
                <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">อายุเริ่มต้น</div>
                  <div className="font-bold text-sm mland:text-[10.5px]">17 ปี</div>
                </div>
                <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">แต้มสุ่ม</div>
                  <div className="font-bold text-sm mland:text-[10.5px] text-[var(--g)]">+12 หลัก · +8 ย่อย</div>
                </div>
              </div>
            </div>

          <div className="flex flex-col gap-4 mland:gap-1 mland:h-full mland:min-h-0">
            <div className="hidden mland:grid mland:grid-cols-4 gap-1 p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              {(
                [
                  ['info', '📝 ข้อมูล & ตำแหน่ง'],
                  ['face', '🎭 หน้าตา & ชุด'],
                  ['arch', '⭐ จุดเด่น & แต้ม'],
                  ['stats', '📊 ค่าพลังละเอียด']
                ] as const
              ).map(([tid, tlbl]) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => { SFX.tap(); setCrMobTab(tid); }}
                  className={`py-1 px-1 rounded-lg text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                    crMobTab === tid ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tlbl}
                </button>
              ))}
            </div>
            <div className={`p-4 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'info' ? '' : 'mland:hidden'}`}>
              <h3 className="font-bold text-base mland:text-xs mb-2.5 mland:mb-1.5">ข้อมูล & ตำแหน่ง</h3>
              <div className="flex flex-wrap gap-2 mland:gap-1.5 mb-3 mland:mb-2">
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value.replace(/["'<>`]/g, ''))}
                  placeholder="กรอกชื่อนักเตะ (เว้นว่างจะสุ่มให้)"
                  maxLength={22}
                  className="flex-1 min-w-[160px] px-3 py-2.5 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm mland:text-xs"
                />
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
                  <span className="text-xs text-[var(--mut)] font-semibold">#</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    aria-label="หมายเลขเสื้อ"
                    value={cNo}
                    onChange={(e) => setCNo(clamp(parseInt(e.target.value, 10) || 1, 1, 99))}
                    className="w-11 bg-transparent text-sm font-bold text-center tabular focus:outline-none"
                  />
                </div>
                <button type="button" onClick={() => { SFX.tap(); setCName(genPlayerName()); }} className="px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm font-semibold shrink-0 cursor-pointer">
                  🔄 สุ่มชื่อ
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                {([['FW', 'กองหน้า'], ['MF', 'กองกลาง'], ['DF', 'กองหลัง'], ['GK', 'ผู้รักษาประตู']] as [Position, string][]).map(([p, l]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => changePosition(p)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
                      cPos === p ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {SPX[cPos].length > 1 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {SPX[cPos].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => changeSubRole(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          cSp === s ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s} · {SPN[s]}
                      </button>
                    ))}
                  </div>
                  {ROLE_HINT[cSp] && (
                    <p className="text-[11px] text-[var(--g)] font-semibold bg-[var(--g-soft)] px-2.5 py-1 rounded-lg">
                      💡 {cSp}: {ROLE_HINT[cSp]}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'face' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mland:mb-2">
                <div>
                  <h3 className="font-bold text-base mland:text-sm">รูปลักษณ์ & ใบหน้าแบบสุ่ม</h3>
                  <p className="text-xs text-[var(--mut)] mland:hidden">เลือกใบหน้าที่สุ่มมาให้หรือปรับแต่งทรงผม สีผิว และแววตาได้ตามใจ</p>
                </div>
                <button
                  type="button"
                  onClick={rerollFaceGallery}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer hover:border-[var(--g)]"
                >
                  🎲 สุ่มชุดใบหน้าใหม่
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-6 gap-2 mland:gap-1.5 mb-4 mland:mb-2.5">
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
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        isPicked
                          ? 'bg-[var(--g-soft)] border-[var(--g)] ring-2 ring-[var(--g)]/30'
                          : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <PlayerFace player={previewPlayer} careerProfile={sampleProfile} size={48} />
                      <span className="text-[10px] font-semibold text-[var(--mut)] truncate w-full text-center">
                        {HS_N[f.hs]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2 mb-3 mland:mb-2">
                {[
                  ['สีชุด', ['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111'], cColor, setCColor],
                  ['สีผิว', SKIN_P, cSkin, setCSkin],
                  ['สีผม', HAIR_P, cHair, setCHair]
                ].map(([lbl, cols, cur, setter]) => (
                  <div key={lbl as string}>
                    <div className="text-xs text-[var(--mut)] mb-1.5">{lbl as string}</div>
                    <div className="flex flex-wrap gap-2">
                      {(cols as string[]).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => (setter as React.Dispatch<React.SetStateAction<string>>)(col)}
                          className={`w-7 h-7 rounded-full border-2 border-white cursor-pointer ${cur === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                          style={{ background: col }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ['รูปหน้า', FS_N, cFs, setCFs],
                  ['แววตา', EY_N, cEy, setCEy],
                  ['ทรงผม', HS_N, cHs, setCHs],
                  ['หนวดเครา', FH_N, cFh, setCFh]
                ].map(([lbl, arr, cur, setter]) => (
                  <div key={lbl as string}>
                    <span className="text-[var(--mut)]">{lbl as string}:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(arr as string[]).map((l, i) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => (setter as React.Dispatch<React.SetStateAction<number>>)(i)}
                          className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${cur === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-4 mland:space-y-2.5 mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'arch' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base mland:text-sm">จุดเด่น & แต้มเริ่มต้น (สุ่มอัตโนมัติ)</h3>
                  <p className="text-xs text-[var(--mut)]">เลือกจุดเด่นที่ชอบ ระบบจะสุ่มอัปเกรดแต้มเริ่มต้นให้เข้ากับตำแหน่งและสายการเล่น</p>
                </div>
                <button
                  type="button"
                  onClick={rerollStartingPoints}
                  className="px-3 py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs font-bold cursor-pointer hover:brightness-105"
                >
                  🎲 สุ่มแต้มเริ่มต้นใหม่
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {posArchs.map((arch) => {
                  const active = curArch.id === arch.id;
                  const coreTags = (Object.entries(arch.coreBonus) as [StatKey, number][]).map(
                    ([k, v]) => `${ATT.find((x) => x[0] === k)?.[1]} +${v}`
                  );
                  const subTags = [
                    `${SIGL[arch.sig]} +8`,
                    ...Object.entries(arch.sbBonus).map(([k, v]) => `${SIGL[k] || k} +${v}`)
                  ];
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => changeArchetype(arch)}
                      className={`p-3 rounded-xl text-left border cursor-pointer transition-all ${
                        active ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-sm' : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm">{arch.icon} {arch.name}</span>
                        {active && <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">เลือกอยู่</span>}
                      </div>
                      <div className={`text-[11px] mt-1 ${active ? 'text-white/90' : 'text-[var(--mut)]'}`}>{arch.desc}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {coreTags.map((tg) => (
                          <span key={tg} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-[var(--g-soft)] text-[var(--g)]'}`}>
                            {tg}
                          </span>
                        ))}
                        {subTags.map((tg) => (
                          <span key={tg} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${active ? 'bg-black/20 text-white/95' : 'bg-[var(--surface)] text-[var(--mut)] border border-[var(--line)]'}`}>
                            {tg}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">พลังหลักหลังสุ่มแต้มเริ่มต้น</span>
                  <span className="text-xs text-[var(--mut)]">สุ่มเพิ่ม +12 แต้มตามสาย</span>
                </div>
                <div className="space-y-2">
                  {ATT.map(([k, l]) => {
                    const rolledAdd = cAttrs[k] - cBase[k];
                    const archCoreAdd = curArch.coreBonus[k] || 0;
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-24 text-sm flex items-center gap-1">
                          <span>{l}</span>
                          {archCoreAdd > 0 && <span className="text-[10px] font-bold text-[var(--g)]">+{archCoreAdd}</span>}
                          {rolledAdd > 0 && <span className="text-[10px] font-bold text-[var(--lamp)]">+{rolledAdd}</span>}
                        </span>
                        <div className="flex-1 h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${cAttrs[k]}%`, background: rolledAdd > 0 ? 'var(--lamp)' : 'var(--g)' }} />
                        </div>
                        <span className="w-8 text-right font-bold tabular text-sm">{cAttrs[k]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'stats' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm">ค่าพลังหลายด้าน (อัปเดตตามจุดเด่น & สุ่มแต้มเริ่มต้น)</h3>
                  <p className="text-[11px] text-[var(--mut)]">แสดงผลรวมจากพลังหลัก + จุดเด่น (⭐ / สีเขียว) + แต้มสุ่มเฉพาะทาง (+8, สีเหลือง)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2">
                {subStats.map((g) => (
                  <div key={g[0]} className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5">
                    <div className="font-bold text-xs mb-1">{g[0]}</div>
                    {g[1].map(([lbl, val, statKey]) => {
                      const isSig = statKey && statKey === curArch.sig;
                      const archBonus = statKey ? curArch.sbBonus[statKey] || 0 : 0;
                      const rolledSub = statKey ? cSubMap[statKey] || 0 : 0;
                      return (
                        <div key={lbl} className="flex items-center justify-between gap-2 text-xs py-0.5">
                          <span className="truncate flex items-center gap-1 min-w-0">
                            <span className={isSig ? 'font-bold text-[var(--g)]' : 'text-[var(--mut)]'}>{isSig ? '⭐ ' : ''}{lbl}</span>
                            {archBonus > 0 && <span className="text-[10px] font-bold text-[var(--g)]">+{archBonus}</span>}
                            {rolledSub > 0 && <span className="text-[10px] font-bold text-[var(--lamp)]">+{rolledSub}</span>}
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

        {/* Pinned Bottom Action Bar inside Screen */}
        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-2.5 mland:py-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={randomizeFaceOnly} className="px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)]">
                🎭 สุ่มใบหน้า
              </button>
              <button type="button" onClick={randomizeAll} className="px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)]">
                🔄 สุ่มทั้งหมด
              </button>
            </div>
            <button
              type="button"
              onClick={startCareerNow}
              className="flex-1 sm:flex-initial sm:min-w-[220px] py-2.5 mland:py-1 px-5 mland:px-4 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-[11px] hover:brightness-105 transition-all cursor-pointer shadow-sm"
            >
              ⚽ เริ่มอาชีพนักเตะ ({cSp} · OVR {ov})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[100dvh] w-full overflow-y-auto mland:overflow-hidden overflow-x-hidden flex flex-col bg-[var(--bg)] safe-all">
      <div className="w-full max-w-5xl mland:max-w-none m-auto mland:m-0 mland:h-full p-3 sm:p-5 mland:p-2 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] mland:grid-cols-[0.74fr_1.26fr] gap-4 lg:gap-6 mland:gap-2.5 items-center mland:items-stretch">
        <div className="text-center lg:text-left mland:text-left mland:flex mland:flex-col mland:justify-between mland:h-full mland:min-h-0 mland:game-card mland:p-2.5 mland:rounded-xl">
          <div>
            <svg viewBox="0 0 320 155" className="w-full max-w-[380px] mland:max-w-full mland:max-h-[84px] mx-auto lg:mx-0 mland:mx-0 rounded-3xl mland:rounded-xl border border-[var(--line)] mb-4 mland:mb-1.5 shadow-xs">
              <defs>
                <linearGradient id="sk_hero" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0b2018" />
                  <stop offset="1" stopColor="#1d6b42" />
                </linearGradient>
                <radialGradient id="gw_hero">
                  <stop offset="0" stopColor="#fff7c2" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#fff7c2" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="320" height="155" fill="url(#sk_hero)" />
              <circle cx="48" cy="34" r="44" fill="url(#gw_hero)" />
              <circle cx="272" cy="34" r="44" fill="url(#gw_hero)" />
              <path d="M48 34v70M272 34v70" stroke="#9fb3a5" strokeWidth="3" />
              <path d="M38 28h20v12H38zM262 28h20v12h-20z" fill="#fffbe0" />
              <path d="M60 90h200l60 65H0z" fill="#2a8f58" />
              <path d="M110 90h25l-15 65H40zM185 90h25l50 65h-40z" fill="#33a063" />
              <g fill="none" stroke="#eef2e6" strokeWidth="2" opacity="0.85">
                <path d="M160 90v65" />
                <ellipse cx="160" cy="124" rx="42" ry="12" />
              </g>
              <circle cx="160" cy="124" r="8" fill="#fff" stroke="#111" strokeWidth="1.5" />
            </svg>
            <h1 className="text-4xl md:text-5xl mland:text-xl font-bold font-display tracking-tight mb-2 mland:mb-0.5 leading-none">ลูกหนังไทย</h1>
            <p className="text-base mland:text-[10.5px] mland:leading-snug text-[var(--mut)] mb-3 mland:mb-1.5">จากลีกระดับจังหวัด สู่ลีกสูงสุดในประเทศ บอลถ้วยประชาชน และเวทีชิงแชมป์ทวีป</p>
            <p className="text-xs mland:text-[9.5px] text-[var(--mut)] leading-relaxed">
              ไต่ 3 ระดับ 48 ทีม · แข่งสด 2 มิติปรับแผนเรียลไทม์ · แมวมองและเส้นทางทีมชาติ
            </p>
          </div>
          <div className="hidden mland:block mt-auto pt-1.5">
            <PWAInstallButton variant="card" onToast={onToast} />
          </div>
        </div>

        <div className="flex flex-col gap-4 mland:gap-2 mland:h-full mland:min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openManagerSetup(firstEmptySlot('m'))}
              className="group relative overflow-hidden p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#fad05a] via-[#f5c242] to-[#e5ac24] text-[#261900] font-bold text-left shadow-sm hover:shadow-md hover:brightness-[1.03] transition-all cursor-pointer flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
                <span className="w-10 h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-black/10 flex items-center justify-center text-xl mland:text-base shrink-0">📋</span>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg mland:text-xs font-display leading-tight">โหมดผู้จัดการทีม</div>
                  <div className="text-xs mland:text-[9px] font-medium opacity-80 mt-0.5 mland:line-clamp-1">คุมแท็กติก แก้เกมสด ซื้อขายนักเตะ อัปเกรดสโมสร</div>
                </div>
              </div>
              <span className="text-lg mland:text-sm opacity-60 group-hover:translate-x-0.5 transition-transform shrink-0">›</span>
            </button>
            <button
              type="button"
              onClick={() => openPlayerSetup(firstEmptySlot('p'))}
              className="group relative overflow-hidden p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#1b9958] via-[#158049] to-[#0f6338] text-white font-bold text-left shadow-sm hover:shadow-md hover:brightness-[1.05] transition-all cursor-pointer flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
                <span className="w-10 h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-white/15 flex items-center justify-center text-xl mland:text-base shrink-0">⚽</span>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg mland:text-xs font-display leading-tight">โหมดนักเตะอาชีพ</div>
                  <div className="text-xs mland:text-[9px] font-medium opacity-85 mt-0.5 mland:line-clamp-1">สร้างตัวละคร ฝึกซ้อม ปลดล็อกสกิล และติดทีมชาติ</div>
                </div>
              </div>
              <span className="text-lg mland:text-sm opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0">›</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2 mland:flex-1 mland:min-h-0">
            <div className="p-3.5 mland:p-2 game-card rounded-2xl mland:rounded-xl mland:flex mland:flex-col mland:min-h-0">
              <div className="font-bold text-sm mland:text-[10.5px] mb-2 mland:mb-1 shrink-0 flex items-center justify-between text-[var(--ink)]">
                <span>เซฟโหมดผู้จัดการ</span>
                <span className="text-[10px] mland:text-[9px] font-medium text-[var(--mut)]">3 ช่อง</span>
              </div>
              <div className="mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5">{renderSlotList('m')}</div>
            </div>
            <div className="p-3.5 mland:p-2 game-card rounded-2xl mland:rounded-xl mland:flex mland:flex-col mland:min-h-0">
              <div className="font-bold text-sm mland:text-[10.5px] mb-2 mland:mb-1 shrink-0 flex items-center justify-between text-[var(--ink)]">
                <span>เซฟโหมดนักเตะ</span>
                <span className="text-[10px] mland:text-[9px] font-medium text-[var(--mut)]">3 ช่อง</span>
              </div>
              <div className="mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5">{renderSlotList('p')}</div>
            </div>
          </div>

          <div className="flex justify-end shrink-0">
            <button type="button" onClick={() => setShowImport(!showImport)} className="text-xs mland:text-[10px] font-semibold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer">
              📥 นำเข้าโค้ดเซฟจากเครื่องอื่น
            </button>
          </div>

          {showImport && (
            <div className="p-3.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="วางโค้ดเซฟที่นี่..."
                rows={1}
                className="w-full p-2 mland:p-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-mono mb-1.5 mland:mb-1"
              />
              <button type="button" onClick={handleImport} className="px-4 py-1.5 mland:py-1 rounded-xl bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer">
                ยืนยันนำเข้าเซฟ
              </button>
            </div>
          )}

          <div className="mland:hidden">
            <PWAInstallButton variant="card" onToast={onToast} />
          </div>
        </div>
      </div>
    </div>
  );
};

