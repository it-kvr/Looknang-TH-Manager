import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Folder, FolderInput, Plus, Save, X } from 'lucide-react';
import { PWAInstallButton } from '../pwa.tsx';
import type { GameState, AppSettings } from '../types/game';
import { getSettings, saveSettings, getDefaultMatchSpeed, applyTheme, SFX, refreshAudioSettings, unlockAudio } from '../utils/audioTheme';
import { enterLandscapeFullscreen, exitFullscreenSafe, isMobileDevice } from '../utils/fullscreen';
import { exportSaveCode, cleanImportJson, readSaveFileText } from '../engine/saveCodec';
import { firstEmptySlot, getSlotCount, loadGameFromSlot, MAX_SLOTS, setSlotCount } from '../engine/playerCore';
import { GAME_AUTO_FOLDER_NAME, saveGameToAutoFolder } from '../engine/saveFolder';
import { SaveFolderModal } from './SaveFolderModal';

const VIP_UNLOCKED_KEY = 'lk_vip_unlocked';

export const SettingsModal: React.FC<{
  state: GameState;
  slot?: number;
  onClose: () => void;
  onExitToMenu: () => void;
  onSaveNow?: () => void;
  onLoadSaveFile?: (loaded: GameState, targetSlot: number) => void;
  onOpenSecretBoost: () => void;
  onToast: (msg: string) => void;
  onSettingsChange?: (next: AppSettings) => void;
}> = ({ state, slot = 1, onClose, onExitToMenu, onSaveNow, onLoadSaveFile, onOpenSecretBoost, onToast, onSettingsChange }) => {
  const [st, setSt] = useState<AppSettings>(() => getSettings());
  const [saveCode, setSaveCode] = useState('');
  const [lastSavedFile, setLastSavedFile] = useState('');
  const [showLoadBox, setShowLoadBox] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [targetSlot, setTargetSlot] = useState<number>(slot);
  const [slotTick, setSlotTick] = useState(0);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderInitialTab, setFolderInitialTab] = useState<'folder' | 'code'>('folder');
  const [savingToFolder, setSavingToFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [vipUnlocked, setVipUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(VIP_UNLOCKED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const vipTapRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });

  const parsedImport = useMemo(() => (importRaw.trim() ? cleanImportJson(importRaw) : null), [importRaw]);

  const parsedImportAlreadyInGame = useMemo(() => {
    if (!parsedImport) return false;
    const getKey = (s: GameState) => {
      const n = s.mode === 'm' ? s.club?.name || s.teams[s.me]?.name || 'สโมสร' : s.p?.name || 'นักเตะ';
      return `${s.mode}|${n.trim()}|${Number(s.season || 1)}|${Number(s.md || 0)}`;
    };
    const targetKey = getKey(parsedImport);
    if (getKey(state) === targetKey) return true;
    for (const m of ['m', 'p'] as const) {
      const cnt = getSlotCount(m);
      for (let k = 1; k <= cnt; k++) {
        const occ = loadGameFromSlot(m, k);
        if (occ && getKey(occ) === targetKey) return true;
      }
    }
    return false;
  }, [parsedImport, state]);

  const pickDefaultSlot = (parsed: GameState) => {
    if (parsed.mode === state.mode) return slot;
    const empty = firstEmptySlot(parsed.mode);
    if (empty > 0) return empty;
    const cnt = getSlotCount(parsed.mode);
    return cnt < MAX_SLOTS ? cnt + 1 : 1;
  };

  const handleSelectSaveFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const text = await readSaveFileText(file);
      const parsed = cleanImportJson(text);
      setImportFileName(file.name);
      setImportRaw(text);
      setShowLoadBox(true);
      if (parsed) {
        SFX.tap();
        setTargetSlot(pickDefaultSlot(parsed));
      } else {
        onToast('❌ ไฟล์เซฟไม่ถูกต้องหรือไม่ใช่ไฟล์ของเกมลูกหนังไทย');
      }
    } catch {
      onToast('❌ ไม่สามารถอ่านไฟล์จากเครื่องได้');
    }
  };

  const handleSecretVersionTap = () => {
    if (vipUnlocked) {
      SFX.tap();
      onOpenSecretBoost();
      return;
    }
    const now = Date.now();
    const ref = vipTapRef.current;
    ref.count = now - ref.lastTs > 2400 ? 1 : ref.count + 1;
    ref.lastTs = now;
    if (ref.count >= 5) {
      ref.count = 0;
      SFX.win();
      setVipUnlocked(true);
      try {
        sessionStorage.setItem(VIP_UNLOCKED_KEY, '1');
      } catch {
        // ignore
      }
      onToast('🔓 ปลดล็อกโหมดลับผู้สนับสนุน (VIP) แล้ว!');
      onOpenSecretBoost();
    } else if (ref.count >= 3) {
      SFX.tap();
      onToast(`แตะอีก ${5 - ref.count} ครั้ง...`);
    }
  };

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...st, ...patch };
    setSt(next);
    saveSettings(next);
    if ('theme' in patch) applyTheme(next.theme);
    if ('mute' in patch || 'nocrowd' in patch || 'sfxVolume' in patch || 'crowdVolume' in patch) {
      refreshAudioSettings();
    }
    onSettingsChange?.(next);
  };

  const curMatchSpeed = getDefaultMatchSpeed(st);
  const autoFsMobileOn = st.preferFullscreen !== false;
  const onMobile = isMobileDevice();

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display">⚙️ ตั้งค่าเกม</h3>
            <button
              type="button"
              onClick={handleSecretVersionTap}
              title="เวอร์ชันแอปพลิเคชัน"
              className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[9px] font-bold transition-colors cursor-pointer select-none ${
                vipUnlocked
                  ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border border-[var(--lamp)]/45 hover:brightness-105'
                  : 'text-[var(--mut)]/65 hover:text-[var(--mut)]'
              }`}
            >
              {vipUnlocked ? 'v1.2 · 👑 VIP' : 'v1.2'}
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดตั้งค่า" className="btn-icon rounded-full!">✕</button>
        </div>

        {/* Organized Horizontal 2-Column Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 grid grid-cols-2 gap-3 mland:gap-2 items-start">
          {/* Left Column: Match & Audio */}
          <div className="space-y-3 mland:space-y-1.5">
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                <span>⚽</span>
                <span>การแข่งขัน &amp; เสียง</span>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ความเร็วการแข่งเริ่มต้น</div>
                <div className="seg-bar grid grid-cols-5 w-full bg-[var(--surface)]">
                  {([
                    [0.25, '0.25x'],
                    [0.5, '0.5x'],
                    [1, '1x ปกติ'],
                    [2, '2x เร็ว'],
                    [5, '5x สูงสุด']
                  ] as const).map(([sp, lbl]) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => { SFX.tap(); update({ matchSpeed: sp, quick: sp === 5 }); }}
                      className={`seg-btn px-1! ${
                        curMatchSpeed === sp ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { SFX.tap(); update({ autoSkipMatch: !st.autoSkipMatch }); }}
                className={`w-full flex items-center justify-between gap-2.5 p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer ${
                  st.autoSkipMatch ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold">⏭️ ข้ามแข่งอัตโนมัติ</div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">จำลองผลทันทีโดยไม่เปิดหน้าต่างสนาม 2D</div>
                </div>
                <span className={`px-2.5 mland:px-2 py-0.5 rounded-full text-[10.5px] mland:text-[9px] font-bold shrink-0 ${st.autoSkipMatch ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {st.autoSkipMatch ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <div className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]/70 space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10px] font-bold">🎚️ ระดับเสียงเกม</span>
                  <button
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      SFX.whistle();
                    }}
                    className="btn btn-xs bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)] hover:brightness-95"
                  >
                    🔊 ทดสอบ
                  </button>
                </div>

                <div className="space-y-1.5 mland:space-y-1">
                  <label className="grid grid-cols-[58px_1fr_34px] mland:grid-cols-[50px_1fr_30px] items-center gap-2 text-[11px] mland:text-[9px]">
                    <span className="text-[var(--mut)] font-semibold truncate">เอฟเฟกต์</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!!st.mute}
                      value={st.sfxVolume ?? 85}
                      onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--g)] h-1.5 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-bold tabular text-right">{st.mute ? 'ปิด' : `${st.sfxVolume ?? 85}%`}</span>
                  </label>

                  <label className="grid grid-cols-[58px_1fr_34px] mland:grid-cols-[50px_1fr_30px] items-center gap-2 text-[11px] mland:text-[9px]">
                    <span className="text-[var(--mut)] font-semibold truncate">เสียงเชียร์</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!!st.mute || !!st.nocrowd}
                      value={st.crowdVolume ?? 70}
                      onChange={(e) => update({ crowdVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--g)] h-1.5 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-bold tabular text-right">{st.mute || st.nocrowd ? 'ปิด' : `${st.crowdVolume ?? 70}%`}</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mland:gap-1 pt-0.5">
                  {(
                    [
                      ['mute', '🔇 ปิดเสียง', !!st.mute],
                      ['nocrowd', '🏟️ ปิดเชียร์', !!st.nocrowd],
                      ['novib', '📳 ปิดสั่น', !!st.novib]
                    ] as [keyof AppSettings, string, boolean][]
                  ).map(([key, label, active]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { unlockAudio(); SFX.tap(); update({ [key]: !active }); }}
                      className={`btn btn-xs truncate ${
                        active ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Display, App Update & Helpers */}
          <div className="space-y-3 mland:space-y-1.5">
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                <span>🎨</span>
                <span>หน้าจอ &amp; แอปพลิเคชัน</span>
              </div>

              <div className="seg-bar grid grid-cols-3 w-full bg-[var(--surface)]">
                {([['', 'ตามระบบ'], ['light', '☀️ สว่าง'], ['dark', '🌙 มืด']] as const).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => { SFX.tap(); update({ theme: val }); }}
                    className={`seg-btn ${
                      (st.theme || '') === val ? 'seg-btn-active' : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-no-auto-fs="1"
                onClick={() => {
                  SFX.tap();
                  const nextVal = !autoFsMobileOn;
                  update({ preferFullscreen: nextVal });
                  if (!nextVal) {
                    exitFullscreenSafe().catch(() => undefined);
                    onToast('ปิดเต็มจอแล้ว (ไม่ขึ้นแถบแจ้งเตือนเบราว์เซอร์ด้านล่าง)');
                  } else {
                    enterLandscapeFullscreen(true).catch(() => undefined);
                    onToast(onMobile ? '📱 เปิดเต็มจออัตโนมัติแล้ว' : '🖥️ เปิดเต็มจออัตโนมัติแล้ว');
                  }
                }}
                className={`w-full flex items-center justify-between gap-2.5 p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer transition-colors ${
                  autoFsMobileOn ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold truncate">🖥️ เต็มจออัตโนมัติ &amp; แนวนอน</div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                    {autoFsMobileOn
                      ? onMobile
                        ? 'เข้าเต็มจอและล็อกแนวนอนอัตโนมัติขณะเล่น'
                        : 'เข้าสู่โหมดเต็มจออัตโนมัติเมื่อเปิดเล่น'
                      : 'ปิดเต็มจออัตโนมัติ (แสดงแถบเบราว์เซอร์ปกติ)'}
                  </div>
                </div>
                <span className={`px-2.5 mland:px-2 py-0.5 rounded-full text-[10.5px] mland:text-[9px] font-bold shrink-0 ${autoFsMobileOn ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {autoFsMobileOn ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <PWAInstallButton variant="settings" onToast={onToast} />
            </div>

            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                  <span>💾</span>
                  <span>จัดการเซฟเกม</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] tabular">
                  ช่อง #{slot}
                </span>
              </div>

              {/* Active Save Summary Strip */}
              <div className="px-2.5 py-2 mland:px-2 mland:py-1 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-7 h-7 mland:w-6 mland:h-6 rounded-lg border flex items-center justify-center text-sm mland:text-xs shrink-0 ${
                      state.mode === 'm'
                        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'
                        : 'bg-[var(--g-soft)] border-[var(--g)]/40'
                    }`}
                  >
                    {state.mode === 'm' ? '📋' : '⚽'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11.5px] mland:text-[9.5px] font-extrabold text-[var(--ink)] truncate leading-tight">
                      {state.mode === 'm' ? state.club?.name || state.teams[state.me]?.name || 'สโมสร' : state.p?.name || 'นักเตะ'}
                    </div>
                    <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)] tabular truncate">
                      {state.mode === 'm' ? 'ผู้จัดการทีม' : 'นักเตะอาชีพ'} · ซีซัน {state.season} · นัด {state.md}
                    </div>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded-md bg-[var(--g-soft)] text-[var(--g)] text-[9.5px] mland:text-[8px] font-bold shrink-0">
                  ออโต้เซฟ
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.lk2,.txt,application/json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  void handleSelectSaveFile(f);
                }}
              />

              {/* Primary Save & Save Vault Actions */}
              <div className="grid grid-cols-2 gap-2 mland:gap-1.5">
                <button
                  type="button"
                  disabled={savingToFolder}
                  onClick={async () => {
                    SFX.tap();
                    setSavingToFolder(true);
                    try {
                      onSaveNow?.();
                      const saved = await saveGameToAutoFolder(state);
                      setLastSavedFile(`${GAME_AUTO_FOLDER_NAME}/${saved.filename}`);
                      SFX.win();
                      onToast(`💾 บันทึกจุดเซฟ "${saved.filename}" ลงคลังเซฟแล้ว`);
                    } catch {
                      onToast('❌ บันทึกไฟล์ไม่สำเร็จ');
                    } finally {
                      setSavingToFolder(false);
                    }
                  }}
                  className="btn btn-sm btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-4 h-4 mland:w-3 mland:h-3 shrink-0" />
                  <span>{savingToFolder ? 'กำลังบันทึก...' : 'สร้างจุดเซฟทันที'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setFolderInitialTab('folder');
                    setShowFolderModal(true);
                  }}
                  className="btn btn-sm btn-gold flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Folder className="w-4 h-4 mland:w-3 mland:h-3 shrink-0" />
                  <span>เปิดคลังเซฟ</span>
                </button>
              </div>

              {lastSavedFile && (
                <div className="px-2 py-1 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-[10px] mland:text-[8.5px] text-[var(--g)] font-bold truncate">
                  ✓ บันทึกจุดเซฟแล้ว: {lastSavedFile}
                </div>
              )}

              {/* Quick Code Export / Import */}
              <div className="grid grid-cols-2 gap-1.5 mland:gap-1">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    const code = exportSaveCode(state);
                    setSaveCode(code);
                    navigator.clipboard?.writeText(code).catch(() => undefined);
                    onToast(`คัดลอกโค้ดเซฟ (${code.length.toLocaleString()} ตัวอักษร) แล้ว`);
                  }}
                  className="btn btn-xs btn-secondary flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Copy className="w-3 h-3 shrink-0" />
                  <span>คัดลอกโค้ดเซฟ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setShowLoadBox((v) => !v);
                  }}
                  className="btn btn-xs btn-secondary flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <FolderInput className="w-3 h-3 shrink-0 text-[var(--g)]" />
                  <span>{showLoadBox ? 'ซ่อนช่องวางโค้ด' : 'วางโค้ด / ไฟล์'}</span>
                </button>
              </div>

              {saveCode && (
                <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[10px] mland:text-[8.5px] text-[var(--g)] font-bold tabular">
                    <span>✓ คัดลอกโค้ดแล้ว ({saveCode.length.toLocaleString()} ตัวอักษร)</span>
                    <button
                      type="button"
                      onClick={() => setSaveCode('')}
                      className="text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ปิด
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={saveCode}
                    rows={2}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-mono"
                  />
                </div>
              )}

              {showLoadBox && (
                <div className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] mland:text-[9.5px] font-bold truncate">
                      {importFileName ? `📄 ${importFileName}` : '📂 นำเข้าไฟล์ภายนอก / วางโค้ดเซฟ'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          fileInputRef.current?.click();
                        }}
                        className="btn btn-xs btn-secondary"
                      >
                        เลือกไฟล์
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLoadBox(false);
                          setImportRaw('');
                          setImportFileName('');
                        }}
                        aria-label="ปิดกล่องโหลดเซฟ"
                        className="text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={importRaw}
                    onChange={(e) => {
                      const val = e.target.value;
                      setImportFileName('');
                      setImportRaw(val);
                      const p = val.trim() ? cleanImportJson(val) : null;
                      if (p) setTargetSlot(pickDefaultSlot(p));
                    }}
                    placeholder="เลือกไฟล์ด้านบน หรือวางโค้ด LK2: / JSON ที่นี่..."
                    rows={2}
                    className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-mono"
                  />

                  {importRaw.trim() && !parsedImport && (
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--red)] font-semibold">
                      ❌ ข้อมูลเซฟไม่ถูกต้อง กรุณาตรวจสอบไฟล์หรือโค้ดอีกครั้ง
                    </div>
                  )}

                  {parsedImport && (
                    <div className="p-2 mland:p-1.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 space-y-1.5">
                      <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] truncate">
                        {parsedImport.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} ·{' '}
                        {parsedImport.mode === 'm'
                          ? parsedImport.club?.name || parsedImport.teams[parsedImport.me]?.name
                          : parsedImport.p?.name}{' '}
                        (ซีซัน {parsedImport.season} นัด {parsedImport.md})
                      </div>

                      {parsedImportAlreadyInGame ? (
                        <div className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[9px] font-bold text-[var(--mut)] text-center">
                          ✓ เซฟนี้มีอยู่ในเกมแล้ว ไม่ต้องโหลดซ้ำ
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(() => {
                            void slotTick;
                            const cnt = getSlotCount(parsedImport.mode);
                            if (firstEmptySlot(parsedImport.mode) !== 0) return null;
                            return (
                              <div className="px-2 py-1.5 rounded-lg bg-[var(--lamp-soft)]/70 border border-[var(--lamp)]/60 flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1 text-[10px] mland:text-[8.5px] font-bold text-[#7c5200] dark:text-[var(--lamp)]">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {cnt < MAX_SLOTS
                                      ? `ช่องเซฟ${parsedImport.mode === 'm' ? 'ผู้จัดการ' : 'นักเตะ'}ไม่พอ (${cnt}/${cnt}) กดเพิ่มช่องใหม่`
                                      : `ช่องเซฟเต็มสูงสุด ${MAX_SLOTS} ช่องแล้ว จะเขียนทับช่องเดิม`}
                                  </span>
                                </div>
                                {cnt < MAX_SLOTS && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      SFX.tap();
                                      const nextCap = setSlotCount(parsedImport.mode, cnt + 1);
                                      setSlotTick((x) => x + 1);
                                      setTargetSlot(nextCap);
                                      onToast(`➕ เพิ่มช่องเซฟใหม่ (#${nextCap}) แล้ว`);
                                    }}
                                    className="h-8 mland:h-6 px-2.5 rounded-md bg-[var(--g)] text-white hover:brightness-110 text-[10px] mland:text-[8.5px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <Plus className="w-3 h-3 shrink-0 stroke-[2.5]" />
                                    <span>เพิ่มช่อง (#{cnt + 1})</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex items-center gap-1.5">
                            <select
                              value={targetSlot}
                              onChange={(e) => setTargetSlot(Number(e.target.value))}
                              className="flex-1 min-w-0 h-9 mland:h-7 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[9px] font-semibold"
                            >
                              {(() => {
                                void slotTick;
                                const cnt = getSlotCount(parsedImport.mode);
                                const opts = Array.from({ length: cnt }, (_, idx) => idx + 1).map((k) => {
                                  const existing = loadGameFromSlot(parsedImport.mode, k);
                                  const occName = existing
                                    ? existing.mode === 'm'
                                      ? existing.club?.name || existing.teams[existing.me]?.name
                                      : existing.p?.name
                                    : '';
                                  return (
                                    <option key={k} value={k}>
                                      ช่อง #{k} {existing ? `(ทับ: ${occName})` : '(ว่าง)'}
                                    </option>
                                  );
                                });
                                if (cnt < MAX_SLOTS) {
                                  opts.push(
                                    <option key={cnt + 1} value={cnt + 1}>
                                      ➕ เพิ่มช่องใหม่ (#{cnt + 1})
                                    </option>
                                  );
                                }
                                return opts;
                              })()}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                SFX.win();
                                if (targetSlot > getSlotCount(parsedImport.mode)) {
                                  setSlotCount(parsedImport.mode, targetSlot);
                                  setSlotTick((x) => x + 1);
                                }
                                onLoadSaveFile?.(parsedImport, targetSlot);
                              }}
                              className="btn h-9 mland:h-7 px-3 text-xs mland:text-[9.5px] btn-primary shrink-0"
                            >
                              โหลดเลย
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onExitToMenu();
            }}
            className="btn btn-md btn-danger flex-1"
          >
            🏠 กลับหน้าเมนูหลัก
          </button>
          <button type="button" onClick={onClose} className="btn btn-md btn-primary flex-1">
            ตกลง
          </button>
        </div>
      </div>

      {showFolderModal && (
        <SaveFolderModal
          currentState={state}
          currentSlot={slot}
          initialTab={folderInitialTab}
          onSaveCurrentSlot={onSaveNow}
          onLoadSave={(loaded, chosenSlot) => {
            onLoadSaveFile?.(loaded, chosenSlot);
            setShowFolderModal(false);
          }}
          onClose={() => setShowFolderModal(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
};

