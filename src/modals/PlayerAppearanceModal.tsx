import React, { useMemo, useState } from 'react';
import { Scissors, Sparkles, RotateCcw } from 'lucide-react';
import type { GameState, Player, PlayerCareerProfile } from '../types/game';
import { SKIN_P, HAIR_P, HS_N, FH_N, FS_N, EY_N, ACC_N } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { getShirtNo, rndVis, syncMe, tc } from '../engine/playerCore';
import { PlayerFace, resolveGkKitPalette } from '../components/SvgVisuals';

export interface PlayerAppearanceModalProps {
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}

export const PlayerAppearanceModal: React.FC<PlayerAppearanceModalProps> = ({
  state,
  onClose,
  onUpdateState,
  onToast
}) => {
  const p = state.p;
  const meTeam = state.teams[state.me];
  const meSq = meTeam?.sq.find((q) => q.me || q.n === p?.name);
  const initK = p?.k && SKIN_P.includes(p.k) ? p.k : SKIN_P[2];
  const initH = p?.h && HAIR_P.includes(p.h) ? p.h : HAIR_P[0];
  const initHs = ((p?.hs ?? 0) % HS_N.length + HS_N.length) % HS_N.length;
  const initFh = ((p?.fh ?? 0) % FH_N.length + FH_N.length) % FH_N.length;
  const initEy = ((p?.ey ?? 0) % EY_N.length + EY_N.length) % EY_N.length;
  const initFs = ((p?.fs ?? 0) % FS_N.length + FS_N.length) % FS_N.length;
  const initAcc = ((p?.acc ?? 0) % ACC_N.length + ACC_N.length) % ACC_N.length;

  const [skinHex, setSkinHex] = useState<string>(initK);
  const [hairHex, setHairHex] = useState<string>(initH);
  const [hs, setHs] = useState<number>(initHs);
  const [fh, setFh] = useState<number>(initFh);
  const [ey, setEy] = useState<number>(initEy);
  const [fs, setFs] = useState<number>(initFs);
  const [acc, setAcc] = useState<number>(initAcc);
  const [activeTab, setActiveTab] = useState<'hair' | 'face'>('hair');

  const previewProfile: PlayerCareerProfile | null = useMemo(() => {
    if (!p) return null;
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
  }, [p, skinHex, hairHex, hs, fh, ey, fs, acc]);

  if (!p || !meTeam || !previewProfile) return null;

  const isGK = p.pos === 'GK' || p.sp === 'GK';
  const kit1 = tc(meTeam, state, false);
  const kit2 = tc(meTeam, state, true);
  const gkPal = isGK ? resolveGkKitPalette(kit1, kit2, p.c) : null;
  const faceKit = gkPal ? gkPal.kit : kit1;
  const faceTrim = gkPal ? gkPal.trim : kit2;
  const shirtNo = p.no || meSq?.no || getShirtNo(meTeam, { n: p.name, pos: p.pos, ro: p.sp });

  const previewPlayer: Partial<Player> = {
    ...(meSq || {}),
    n: p.name,
    pos: p.pos,
    ro: p.sp,
    no: shirtNo,
    me: 1
  };

  const hasChanged =
    skinHex !== initK ||
    hairHex !== initH ||
    hs !== initHs ||
    fh !== initFh ||
    ey !== initEy ||
    fs !== initFs ||
    acc !== initAcc;

  const handleRandomLook = () => {
    SFX.tap();
    const rolled = rndVis(p.pos, p.age < 20);
    setSkinHex(SKIN_P[rolled[0]] || SKIN_P[2]);
    setHairHex(HAIR_P[rolled[1]] || HAIR_P[0]);
    setHs(rolled[2] % HS_N.length);
    setFh(rolled[3] % FH_N.length);
    setEy(rolled[4] % EY_N.length);
    setFs((rolled[6] ?? 0) % FS_N.length);
    setAcc((rolled[7] ?? 0) % ACC_N.length);
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
  };

  const handleSave = () => {
    SFX.tap();
    onUpdateState((d) => {
      if (!d.p) return;
      d.p.k = skinHex;
      d.p.h = hairHex;
      d.p.hs = hs;
      d.p.fh = fh;
      d.p.ey = ey;
      d.p.fs = fs;
      d.p.acc = acc;
      syncMe(d);
    });
    onToast(`💈 ปรับลุคใหม่เรียบร้อย! (${HS_N[hs]})`);
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
              <p className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                {p.name} · #{shirtNo} {meTeam.name}
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
                <span>สุ่มลุคเท่</span>
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
                  <div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)]">
                    เลือกทรงผม ({HS_N.length} ทรง)
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 mland:grid-cols-5 gap-2 mland:gap-1.5">
                    {HS_N.map((label, idx) => {
                      const active = hs === idx;
                      const sampleProfile: PlayerCareerProfile = {
                        ...previewProfile,
                        hs: idx
                      };
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            setHs(idx);
                          }}
                          className={`p-1.5 mland:p-1 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            active
                              ? 'bg-[var(--g-soft)] border-[var(--g)] ring-1 ring-[var(--g)]/55 shadow-xs'
                              : 'bg-[var(--surface-2)]/50 border-[var(--line)] hover:border-[var(--g)]'
                          }`}
                        >
                          <div className="[&>svg]:w-[42px] [&>svg]:h-[45px] mland:[&>svg]:w-[34px] mland:[&>svg]:h-[36px]">
                            <PlayerFace
                              player={previewPlayer}
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
            เปลี่ยนได้ฟรีตลอดอาชีพนักเตะ และอัปเดตในการ์ดทันที
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
