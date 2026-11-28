import React, { useMemo, useState } from 'react';
import { Scissors, Sparkles, RotateCcw } from 'lucide-react';
import type { GameState, Player, PlayerCareerProfile, Team } from '../types/game';
import {
  SKIN_P,
  HAIR_P,
  HS_N,
  FH_N,
  FS_N,
  EY_N,
  ACC_N,
  getCountryMetaByCode,
  getForeignTeamCountryMeta
} from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import {
  APPEARANCE_ORIGIN_PRESETS,
  getPresetGroupProfile,
  getShirtNo,
  mapOriginToPresetGroup,
  resolveAppearanceOrigin,
  rndVis,
  syncMe,
  tc,
  visOf,
  type AppearancePresetGroup
} from '../engine/playerCore';
import { PlayerFace, resolveGkKitPalette } from '../components/SvgVisuals';

export interface PlayerAppearanceModalProps {
  state: GameState;
  targetPlayer?: Player | null;
  targetTeam?: Team | null;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}

export const PlayerAppearanceModal: React.FC<PlayerAppearanceModalProps> = ({
  state,
  targetPlayer = null,
  targetTeam = null,
  onClose,
  onUpdateState,
  onToast
}) => {
  const p = state.p;
  const meTeam = targetTeam ?? state.teams[state.me];
  const isCareerMe =
    !targetPlayer ||
    (state.mode === 'p' && (Boolean(targetPlayer.me) || targetPlayer.n === p?.name));
  const meSq =
    targetPlayer ||
    meTeam?.sq.find((q) => q.me || q.n === p?.name) ||
    null;

  const baseVis = useMemo(() => {
    if (isCareerMe && p) {
      const ki = p.k && SKIN_P.includes(p.k) ? SKIN_P.indexOf(p.k) : 2;
      const hi = p.h && HAIR_P.includes(p.h) ? HAIR_P.indexOf(p.h) : 0;
      return [
        ki,
        hi,
        ((p.hs ?? 0) % HS_N.length + HS_N.length) % HS_N.length,
        ((p.fh ?? 0) % FH_N.length + FH_N.length) % FH_N.length,
        ((p.ey ?? 0) % EY_N.length + EY_N.length) % EY_N.length,
        p.no || meSq?.no || 10,
        ((p.fs ?? 0) % FS_N.length + FS_N.length) % FS_N.length,
        ((p.acc ?? 0) % ACC_N.length + ACC_N.length) % ACC_N.length
      ];
    }
    if (meSq) {
      return visOf(meSq, null);
    }
    return [2, 0, 0, 0, 0, 10, 0, 0];
  }, [isCareerMe, p, meSq]);

  const initK = SKIN_P[baseVis[0]] || SKIN_P[2];
  const initH = HAIR_P[baseVis[1]] || HAIR_P[0];
  const initHs = ((baseVis[2] ?? 0) % HS_N.length + HS_N.length) % HS_N.length;
  const initFh = ((baseVis[3] ?? 0) % FH_N.length + FH_N.length) % FH_N.length;
  const initEy = ((baseVis[4] ?? 0) % EY_N.length + EY_N.length) % EY_N.length;
  const initFs = ((baseVis[6] ?? 0) % FS_N.length + FS_N.length) % FS_N.length;
  const initAcc = ((baseVis[7] ?? 0) % ACC_N.length + ACC_N.length) % ACC_N.length;

  const foreignTeamMeta =
    meTeam && (meTeam.tier >= 3 || meTeam.foreign === 1)
      ? getForeignTeamCountryMeta(meTeam.name)
      : null;
  const resolvedNatCode =
    meSq?.nat ||
    foreignTeamMeta?.code ||
    'TH';
  const natMeta = getCountryMetaByCode(resolvedNatCode) || getCountryMetaByCode('TH');
  const defaultOriginId = resolveAppearanceOrigin(resolvedNatCode, foreignTeamMeta?.region);
  const defaultPresetGroup = mapOriginToPresetGroup(defaultOriginId);

  const [skinHex, setSkinHex] = useState<string>(initK);
  const [hairHex, setHairHex] = useState<string>(initH);
  const [hs, setHs] = useState<number>(initHs);
  const [fh, setFh] = useState<number>(initFh);
  const [ey, setEy] = useState<number>(initEy);
  const [fs, setFs] = useState<number>(initFs);
  const [acc, setAcc] = useState<number>(initAcc);
  const [activeOrigin, setActiveOrigin] = useState<AppearancePresetGroup>(defaultPresetGroup);
  const [activeTab, setActiveTab] = useState<'hair' | 'face'>('hair');

  const activePresetMeta = getPresetGroupProfile(activeOrigin);
  const recommendedHairSet = useMemo(
    () => new Set(activePresetMeta.recommendedHairStyles),
    [activePresetMeta]
  );

  const subjectName = isCareerMe && p ? p.name : meSq?.n || 'นักเตะ';
  const subjectPos = isCareerMe && p ? p.pos : meSq?.pos || 'MF';
  const subjectRole = isCareerMe && p ? p.sp : meSq?.ro || 'CM';
  const subjectAge = isCareerMe && p ? p.age : meSq?.age || 22;

  const shirtNo =
    (isCareerMe && p ? p.no : undefined) ||
    meSq?.no ||
    (meTeam ? getShirtNo(meTeam, { n: subjectName, pos: subjectPos, ro: subjectRole }) : 10);

  const skinIdx = Math.max(0, SKIN_P.indexOf(skinHex));
  const hairIdx = Math.max(0, HAIR_P.indexOf(hairHex));
  const currentVisTuple = useMemo(
    () => [skinIdx, hairIdx, hs, fh, ey, shirtNo, fs, acc],
    [skinIdx, hairIdx, hs, fh, ey, shirtNo, fs, acc]
  );

  const previewProfile: PlayerCareerProfile | null = useMemo(() => {
    if (!isCareerMe || !p) return null;
    return {
      ...p,
      k: skinHex,
      h: hairHex,
      hs,
      fh,
      ey,
      fs,
      acc
    };
  }, [isCareerMe, p, skinHex, hairHex, hs, fh, ey, fs, acc]);

  if ((isCareerMe && !p) || (!isCareerMe && !meSq)) return null;

  const isGK = subjectPos === 'GK' || subjectRole === 'GK';
  const kit1 = meTeam ? tc(meTeam, state, false) : p?.c || '#158049';
  const kit2 = meTeam ? tc(meTeam, state, true) : '#f5c242';
  const gkPal = isGK ? resolveGkKitPalette(kit1, kit2, isCareerMe ? p?.c : undefined) : null;
  const faceKit = gkPal ? gkPal.kit : kit1;
  const faceTrim = gkPal ? gkPal.trim : kit2;

  const previewPlayer: Partial<Player> = {
    ...(meSq || {}),
    n: subjectName,
    pos: subjectPos,
    ro: subjectRole,
    no: shirtNo,
    me: isCareerMe ? 1 : meSq?.me,
    vis: currentVisTuple
  };

  const hasChanged =
    skinHex !== initK ||
    hairHex !== initH ||
    hs !== initHs ||
    fh !== initFh ||
    ey !== initEy ||
    fs !== initFs ||
    acc !== initAcc;

  const applyRolledVis = (rolled: number[]) => {
    setSkinHex(SKIN_P[rolled[0]] || SKIN_P[2]);
    setHairHex(HAIR_P[rolled[1]] || HAIR_P[0]);
    setHs(rolled[2] % HS_N.length);
    setFh(rolled[3] % FH_N.length);
    setEy(rolled[4] % EY_N.length);
    setFs((rolled[6] ?? 0) % FS_N.length);
    setAcc((rolled[7] ?? 0) % ACC_N.length);
  };

  const handleSelectOrigin = (origin: AppearancePresetGroup) => {
    SFX.tap();
    setActiveOrigin(origin);
    const rolled = rndVis(subjectPos, subjectAge < 20, { originPreset: origin });
    applyRolledVis(rolled);
  };

  const handleRollNationalityLook = () => {
    SFX.tap();
    setActiveOrigin(defaultPresetGroup);
    const rolled = rndVis(subjectPos, subjectAge < 20, {
      natCode: resolvedNatCode,
      foreignRegion: foreignTeamMeta?.region
    });
    applyRolledVis(rolled);
  };

  const handleRandomLook = () => {
    SFX.tap();
    const useExactNat = activeOrigin === defaultPresetGroup && resolvedNatCode !== 'TH';
    const rolled = rndVis(
      subjectPos,
      subjectAge < 20,
      useExactNat
        ? { natCode: resolvedNatCode, foreignRegion: foreignTeamMeta?.region }
        : { originPreset: activeOrigin }
    );
    applyRolledVis(rolled);
  };

  const handleReset = () => {
    SFX.tap();
    setSkinHex(initK);
    setHairHex(initH);
    setHs(initHs);
    setFh(initFh);
    setEy(initEy);
    setFs(initFs);
    setAcc(initAcc);
    setActiveOrigin(defaultPresetGroup);
  };

  const handleSave = () => {
    SFX.tap();
    onUpdateState((d) => {
      if (isCareerMe && d.p) {
        d.p.k = skinHex;
        d.p.h = hairHex;
        d.p.hs = hs;
        d.p.fh = fh;
        d.p.ey = ey;
        d.p.fs = fs;
        d.p.acc = acc;
        syncMe(d);
        const sqPl = d.teams[d.me]?.sq.find((q) => q.me || q.n === d.p?.name);
        if (sqPl) sqPl.visCustom = 1;
        return;
      }
      let pl: Player | undefined;
      if (targetTeam && d.teams[targetTeam.id]) {
        pl = d.teams[targetTeam.id].sq.find((q) => q.n === subjectName);
      }
      if (!pl) {
        for (const t of d.teams) {
          const found = t.sq.find((q) => q.n === subjectName);
          if (found) {
            pl = found;
            break;
          }
        }
      }
      if (!pl) {
        pl = d.mk.find((q) => q.n === subjectName) || d.yth.find((q) => q.n === subjectName);
      }
      if (pl) {
        pl.vis = [skinIdx, hairIdx, hs, fh, ey, pl.no || shirtNo, fs, acc];
        pl.visCustom = 1;
      }
    });
    onToast(`💈 ปรับลุค ${subjectName} เรียบร้อย! (${HS_N[hs]})`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[72] bg-black/75 flex items-center justify-center p-2 sm:p-4 mland:p-2 overflow-hidden">
      <div className="w-full max-w-4xl mland:max-w-[95vw] h-[min(calc(var(--app-dvh,1dvh)*92),680px)] mland:h-[calc(var(--app-dvh,1dvh)*94)] mland:max-h-[calc(var(--app-dvh,1dvh)*100-12px)] rounded-3xl mland:rounded-2xl bg-[var(--bg)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 mland:w-6 mland:h-6 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/35 flex items-center justify-center text-[var(--g)] shrink-0">
              <Scissors className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm mland:text-xs font-extrabold font-display text-[var(--ink)] truncate">
                ห้องแต่งตัว &amp; ร้านตัดผมนักเตะ
              </h2>
              <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate flex items-center gap-1">
                {natMeta && (
                  <span title={`สัญชาติ${natMeta.country}`}>
                    {natMeta.flag} {natMeta.country}
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {subjectName} · #{shirtNo} {meTeam?.name || (meSq?.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="seg-bar">
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setActiveTab('hair');
                }}
                className={`seg-btn ${activeTab === 'hair' ? 'seg-btn-active' : ''}`}
              >
                ✂️ ทรงผม &amp; สีผม
              </button>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setActiveTab('face');
                }}
                className={`seg-btn ${activeTab === 'face' ? 'seg-btn-active' : ''}`}
              >
                😎 ใบหน้า &amp; หนวดเครา
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="btn-icon rounded-full"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col sm:grid sm:grid-cols-[220px_1fr] mland:grid mland:grid-cols-[195px_1fr] gap-2.5 mland:gap-1.5 p-3 mland:p-2 overflow-hidden">
          {/* Live Portrait Preview Column */}
          <div className="shrink-0 sm:h-full mland:h-full rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 flex sm:flex-col mland:flex-col items-center justify-between gap-2.5 mland:gap-1.5">
            <div className="flex sm:flex-col mland:flex-col items-center gap-3 sm:gap-2 mland:gap-1.5 min-w-0">
              <div className="rounded-2xl mland:rounded-xl bg-gradient-to-b from-[var(--surface-2)] to-[var(--bg)] border border-[var(--line)] p-2.5 mland:p-1.5 shadow-inner [&>svg]:w-[76px] [&>svg]:h-[81px] sm:[&>svg]:w-[96px] sm:[&>svg]:h-[102px] mland:[&>svg]:w-[76px] mland:[&>svg]:h-[81px]">
                <PlayerFace
                  player={previewPlayer}
                  team={meTeam}
                  state={state}
                  careerProfile={previewProfile}
                  isGK={isGK}
                  kitColor={faceKit}
                  trimColor={faceTrim}
                  size={96}
                  bare
                />
              </div>
              <div className="sm:text-center mland:text-center min-w-0 space-y-0.5">
                <div className="text-xs sm:text-sm mland:text-xs font-extrabold font-display truncate text-[var(--ink)]">
                  {HS_N[hs]}
                </div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                  {FS_N[fs]} · {EY_N[ey]}
                </div>
                <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate">
                  {fh > 0 ? FH_N[fh] : 'หน้าเกลี้ยง'}{acc > 0 ? ` · ${ACC_N[acc]}` : ''}
                </div>
              </div>
            </div>

            <div className="flex sm:flex-col mland:flex-col gap-1.5 w-auto sm:w-full mland:w-full shrink-0">
              <button
                type="button"
                onClick={handleRandomLook}
                className="btn btn-xs sm:btn-sm btn-secondary w-full whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>สุ่มลุค{activePresetMeta.shortLabel}</span>
              </button>
              {hasChanged && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-xs btn-ghost w-full whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>คืนค่าเดิม</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Selection Panel */}
          <div className="flex-1 min-h-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3 mland:p-2 overflow-y-auto space-y-3 mland:space-y-2">
            {/* Regional / Nationality Appearance Presets */}
            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)]">
                  🌍 สไตล์ใบหน้า &amp; ทรงผมตามสัญชาติ / ภูมิภาค
                </span>
                {resolvedNatCode !== 'TH' && natMeta && (
                  <button
                    type="button"
                    onClick={handleRollNationalityLook}
                    className="px-2 py-0.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 text-[10px] mland:text-[8.5px] font-bold text-[var(--g)] hover:brightness-110 cursor-pointer"
                  >
                    🎲 สุ่มตรงสัญชาติ {natMeta.flag} {natMeta.country}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {APPEARANCE_ORIGIN_PRESETS.map((preset) => {
                  const isActive = activeOrigin === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectOrigin(preset.id)}
                      className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'bg-[var(--g)] text-white shadow-xs'
                          : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                      }`}
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] mland:text-[8.5px] leading-snug text-[var(--mut)] space-y-0.5">
                <div>
                  <b className="text-[var(--ink)]">ใบหน้า {activePresetMeta.icon} {activePresetMeta.label}:</b>{' '}
                  {activePresetMeta.faceDesc}
                </div>
                <div>
                  <b className="text-[var(--ink)]">ทรงผมยอดนิยม:</b> {activePresetMeta.hairDesc}
                </div>
              </div>
            </div>

            {activeTab === 'hair' ? (
              <>
                {/* Hair Color */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                      สีผม &amp; หนวดเครา
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--g)]">
                      เลือกได้ทุกสี
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mland:gap-1.5">
                    {HAIR_P.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setHairHex(col);
                        }}
                        aria-label={`สีผม ${col}`}
                        className={`w-7 h-7 mland:w-6 mland:h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer transition-transform ${
                          hairHex === col
                            ? 'ring-2 ring-[var(--g)] scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                {/* Visual Hairstyle Grid (All styles with live face preview) */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--line)]/65">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                      เลือกทรงผม ({HS_N.length} ทรง)
                    </span>
                    <span className="text-[9.5px] mland:text-[8px] font-semibold text-[#8a5b00] dark:text-[var(--lamp)]">
                      ★ = แนะนำสำหรับสไตล์{activePresetMeta.shortLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 mland:grid-cols-5 gap-2 mland:gap-1.5">
                    {HS_N.map((label, idx) => {
                      const active = hs === idx;
                      const isRecommended = recommendedHairSet.has(idx);
                      const sampleProfile: PlayerCareerProfile | null = previewProfile
                        ? { ...previewProfile, hs: idx }
                        : null;
                      const samplePlayer: Partial<Player> = {
                        ...previewPlayer,
                        vis: [skinIdx, hairIdx, idx, fh, ey, shirtNo, fs, acc]
                      };
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            setHs(idx);
                          }}
                          className={`relative p-1.5 mland:p-1 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            active
                              ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/55 shadow-xs'
                              : isRecommended
                                ? 'bg-[var(--lamp-soft)]/30 border-[var(--lamp)]/45 hover:border-[var(--g)]'
                                : 'bg-[var(--surface-2)]/50 border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          {isRecommended && (
                            <span
                              title={`ทรงผมแนะนำสำหรับสไตล์${activePresetMeta.shortLabel}`}
                              className="absolute top-1 right-1 text-[8px] mland:text-[7px] font-extrabold text-[#9a6700] dark:text-[var(--lamp)] leading-none"
                            >
                              ★
                            </span>
                          )}
                          <div className="[&>svg]:w-[42px] [&>svg]:h-[45px] mland:[&>svg]:w-[34px] mland:[&>svg]:h-[36px]">
                            <PlayerFace
                              player={samplePlayer}
                              team={meTeam}
                              state={state}
                              careerProfile={sampleProfile}
                              isGK={isGK}
                              kitColor={faceKit}
                              trimColor={faceTrim}
                              size={42}
                              bare
                            />
                          </div>
                          <span
                            className={`text-[10px] mland:text-[8.5px] font-bold leading-tight w-full text-center break-words ${
                              active ? 'text-[var(--g)]' : 'text-[var(--ink)]'
                            }`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 mland:space-y-2">
                {/* Skin Tone */}
                <div className="space-y-1.5">
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                    โทนสีผิว
                  </div>
                  <div className="flex flex-wrap gap-2 mland:gap-1.5">
                    {SKIN_P.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setSkinHex(col);
                        }}
                        aria-label={`โทนสีผิว ${col}`}
                        className={`w-7 h-7 mland:w-6 mland:h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-xs cursor-pointer transition-transform ${
                          skinHex === col
                            ? 'ring-2 ring-[var(--g)] scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                {/* Face Shape, Expressions, Facial Hair, Accessories */}
                {(
                  [
                    ['รูปหน้า', FS_N, fs, setFs],
                    ['แววตา / อารมณ์', EY_N, ey, setEy],
                    ['หนวดเครา', FH_N, fh, setFh],
                    ['เอกลักษณ์ / เครื่องประดับ', ACC_N, acc, setAcc]
                  ] as [string, string[], number, React.Dispatch<React.SetStateAction<number>>][]
                ).map(([lbl, arr, cur, setter]) => (
                  <div
                    key={lbl}
                    className="space-y-1.5 pt-2 border-t border-[var(--line)]/65"
                  >
                    <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                      {lbl}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {arr.map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            setter(i);
                          }}
                          className={`px-2.5 py-1.5 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg text-[11px] mland:text-[9.5px] font-semibold cursor-pointer transition-colors ${
                            cur === i
                              ? 'bg-[var(--g)] text-white shadow-xs'
                              : 'bg-[var(--surface-2)]/65 border border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface)] border-t border-[var(--line)] flex items-center justify-between gap-2">
          <span className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
            {isCareerMe
              ? 'เปลี่ยนได้ฟรีตลอดอาชีพนักเตะ และอัปเดตในการ์ดทันที'
              : `บันทึกหน้าตาและทรงผมให้ ${subjectName} และอัปเดตในการ์ดทันที`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm mland:btn-xs btn-secondary"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-sm mland:btn-xs btn-primary"
            >
              ✅ บันทึกโฉมใหม่
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
