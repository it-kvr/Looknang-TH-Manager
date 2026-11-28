import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Fingerprint,
  Folder,
  FolderInput,
  Gauge,
  Home,
  Maximize2,
  Monitor,
  Moon,
  Plus,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PWAInstallButton } from '../pwa.tsx';
import type { GameState, AppSettings } from '../types/game';
import { getSettings, saveSettings, getDefaultMatchSpeed, applyTheme, SFX, refreshAudioSettings, unlockAudio } from '../utils/audioTheme';
import { enterLandscapeFullscreen, exitFullscreenSafe, isMobileDevice } from '../utils/fullscreen';
import { exportSaveCode, cleanImportJson, readSaveFileText } from '../engine/saveCodec';
import { firstEmptySlot, getSlotCount, loadGameFromSlot, MAX_SLOTS, setSlotCount } from '../engine/playerCore';
import { GAME_AUTO_FOLDER_NAME, saveGameToAutoFolder } from '../engine/saveFolder';
import { SaveFolderModal } from './SaveFolderModal';

const MATCH_SPEED_OPTIONS = [
  { value: 0.25, short: '0.25x', label: 'ช้าละเอียด' },
  { value: 0.5, short: '0.5x', label: 'ช้า' },
  { value: 1, short: '1x', label: 'ปกติ' },
  { value: 2, short: '2x', label: 'เร็ว' },
  { value: 5, short: '5x', label: 'เร็วสูงสุด' },
] as const;

export const SettingsModal: React.FC<{
  state: GameState;
  slot?: number;
  vipAuthorized?: boolean;
  onClose: () => void;
  onExitToMenu: () => void;
  onSaveNow?: () => void;
  onLoadSaveFile?: (loaded: GameState, targetSlot: number) => void;
  onOpenSecretBoost: () => void;
  onToast: (msg: string) => void;
  onSettingsChange?: (next: AppSettings) => void;
}> = ({
  state,
  slot = 1,
  vipAuthorized = false,
  onClose,
  onExitToMenu,
  onSaveNow,
  onLoadSaveFile,
  onOpenSecretBoost,
  onToast,
  onSettingsChange,
}) => {
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showFolderModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, showFolderModal]);

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
  const curSpeedLabel = MATCH_SPEED_OPTIONS.find((opt) => opt.value === curMatchSpeed)?.label ?? 'ปกติ';
  const autoFsMobileOn = st.preferFullscreen !== false;
  const onMobile = isMobileDevice();
  const activeSaveTitle =
    state.mode === 'm'
      ? state.club?.name || state.teams[state.me]?.name || 'สโมสร'
      : state.p?.name || 'นักเตะ';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 mland:px-3 mland:py-2 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/25 text-[var(--g)] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <h3
              id="settings-modal-title"
              className="font-bold text-sm sm:text-base mland:text-xs font-display text-[var(--ink)] truncate"
            >
              ตั้งค่าเกม
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onOpenSecretBoost();
              }}
              aria-label="สแกนลายนิ้วมือ"
              title={vipAuthorized ? 'เปิดแผงควบคุมพิเศษ (ยืนยันตัวตนแล้ว)' : 'สแกนลายนิ้วมือ'}
              className={`w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg border inline-flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                vipAuthorized
                  ? 'bg-[var(--g-soft)] border-[var(--g)]/55 text-[var(--g)] hover:brightness-105'
                  : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:border-[var(--g)]/45 hover:bg-[var(--surface-2)]'
              }`}
            >
              <Fingerprint className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดตั้งค่า"
              className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3.5 mland:gap-2 items-start">
          {/* Left Column: Match Speed & Audio */}
          <div className="space-y-3 mland:space-y-2">
            {/* Match Speed Section */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] divide-y divide-[var(--line)]/70 overflow-hidden">
              <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Gauge className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>ความเร็วการแข่งขัน</span>
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--g)] tabular whitespace-nowrap">
                  {curMatchSpeed}x · {curSpeedLabel}
                </span>
              </div>

              <div className="p-3 mland:p-2">
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                  {MATCH_SPEED_OPTIONS.map((opt) => {
                    const active = curMatchSpeed === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          update({ matchSpeed: opt.value, quick: opt.value === 5 });
                        }}
                        className={`h-8 mland:h-6.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold tabular whitespace-nowrap cursor-pointer transition-all ${
                          active
                            ? 'bg-[var(--g)] text-white shadow-xs'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/70'
                        }`}
                      >
                        {opt.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Audio & Haptics Section */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] divide-y divide-[var(--line)]/70 overflow-hidden">
              <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Volume2 className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>ระบบเสียงและการตอบสนอง</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    SFX.whistle();
                  }}
                  className="h-7 mland:h-6 px-2.5 mland:px-2 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-[var(--g)] text-[11px] mland:text-[9.5px] font-bold inline-flex items-center gap-1 cursor-pointer hover:brightness-95 whitespace-nowrap shrink-0"
                >
                  <Volume2 className="w-3 h-3 shrink-0" />
                  <span>ทดสอบเสียง</span>
                </button>
              </div>

              <div className="p-3.5 mland:p-2.5 space-y-3 mland:space-y-2">
                <label className="grid grid-cols-[64px_1fr_38px] mland:grid-cols-[54px_1fr_32px] items-center gap-2.5 text-[11.5px] mland:text-[9.5px]">
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
                  <span className="font-bold tabular text-right text-[var(--ink)]">
                    {st.mute ? 'ปิด' : `${st.sfxVolume ?? 85}%`}
                  </span>
                </label>

                <label className="grid grid-cols-[64px_1fr_38px] mland:grid-cols-[54px_1fr_32px] items-center gap-2.5 text-[11.5px] mland:text-[9.5px]">
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
                  <span className="font-bold tabular text-right text-[var(--ink)]">
                    {st.mute || st.nocrowd ? 'ปิด' : `${st.crowdVolume ?? 70}%`}
                  </span>
                </label>
              </div>

              <div className="p-3 mland:p-2 grid grid-cols-3 gap-1.5 mland:gap-1">
                {([
                  { key: 'mute', label: 'ปิดเสียง', active: !!st.mute, Icon: VolumeX },
                  { key: 'nocrowd', label: 'ปิดเสียงเชียร์', active: !!st.nocrowd, Icon: Users },
                  { key: 'novib', label: 'ปิดการสั่น', active: !!st.novib, Icon: Smartphone },
                ] as const).map(({ key, label, active, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      SFX.tap();
                      update({ [key]: !active });
                    }}
                    className={`h-8 mland:h-6.5 px-2 mland:px-1.5 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[9px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors truncate whitespace-nowrap ${
                      active
                        ? 'bg-[var(--g)] border-[var(--g)] text-white shadow-2xs'
                        : 'bg-[var(--surface-2)]/65 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Display, App & Save Management */}
          <div className="space-y-3 mland:space-y-2">
            {/* Display & App Section */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] divide-y divide-[var(--line)]/70 overflow-hidden">
              <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Monitor className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>หน้าจอและแอปพลิเคชัน</span>
                </div>
              </div>

              <div className="p-3 mland:p-2 space-y-2.5 mland:space-y-1.5">
                {/* Theme Selector */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)]/70">
                  {([
                    { val: '', label: 'ตามระบบ', Icon: Monitor },
                    { val: 'light', label: 'สว่าง', Icon: Sun },
                    { val: 'dark', label: 'มืด', Icon: Moon },
                  ] as const).map(({ val, label, Icon }) => {
                    const active = (st.theme || '') === val;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          update({ theme: val });
                        }}
                        className={`h-8 mland:h-6.5 rounded-lg mland:rounded-md text-[11px] mland:text-[9.5px] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                          active
                            ? 'bg-[var(--g)] text-white shadow-xs'
                            : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/70'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Fullscreen Toggle Row */}
                <button
                  type="button"
                  data-no-auto-fs="1"
                  role="switch"
                  aria-checked={autoFsMobileOn}
                  onClick={() => {
                    SFX.tap();
                    const nextVal = !autoFsMobileOn;
                    update({ preferFullscreen: nextVal });
                    if (!nextVal) {
                      exitFullscreenSafe().catch(() => undefined);
                      onToast('ปิดเต็มจออัตโนมัติแล้ว');
                    } else {
                      enterLandscapeFullscreen(true).catch(() => undefined);
                      onToast(onMobile ? 'เปิดเต็มจอและแนวนอนอัตโนมัติแล้ว' : 'เปิดเต็มจออัตโนมัติแล้ว');
                    }
                  }}
                  className="w-full flex items-center justify-between gap-3 p-2.5 mland:p-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/55 hover:bg-[var(--surface-2)] border border-[var(--line)]/80 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 mland:w-6.5 mland:h-6.5 rounded-lg flex items-center justify-center shrink-0 ${
                        autoFsMobileOn
                          ? 'bg-[var(--g-soft)] text-[var(--g)]'
                          : 'bg-[var(--surface)] text-[var(--mut)] border border-[var(--line)]'
                      }`}
                    >
                      <Maximize2 className="w-4 h-4 mland:w-3 mland:h-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] truncate">
                        เต็มจออัตโนมัติ &amp; แนวนอน
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                        {autoFsMobileOn
                          ? onMobile
                            ? 'ขยายเต็มจอและล็อกแนวนอนเมื่อเริ่มเล่น'
                            : 'ขยายเต็มจออัตโนมัติขณะเข้าเล่น'
                          : 'แสดงหน้าต่างเบราว์เซอร์ตามปกติ'}
                      </div>
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                      autoFsMobileOn
                        ? 'bg-[var(--g)] border-[var(--g)]'
                        : 'bg-[var(--surface)] border-[var(--line)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform mt-[1px] ${
                        autoFsMobileOn ? 'translate-x-[17px]' : 'translate-x-[1px]'
                      }`}
                    />
                  </span>
                </button>

                {/* PWA Install / Update */}
                <PWAInstallButton variant="settings" onToast={onToast} />
              </div>
            </section>

            {/* Save Management Section */}
            <section className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] divide-y divide-[var(--line)]/70 overflow-hidden">
              <div className="px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Save className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>จัดการเซฟเกม</span>
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)] tabular">
                  ช่อง #{slot}
                </span>
              </div>

              <div className="p-3 mland:p-2 space-y-2.5 mland:space-y-1.5">
                {/* Active Save Summary Row */}
                <div className="px-2.5 py-2 mland:px-2 mland:py-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/55 border border-[var(--line)]/75 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] truncate leading-tight">
                      {activeSaveTitle}
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular truncate mt-0.5">
                      {state.mode === 'm' ? 'ผู้จัดการทีม' : 'นักเตะอาชีพ'}
                      <span aria-hidden="true"> · </span>
                      ซีซัน {state.season}
                      <span aria-hidden="true"> · </span>
                      นัด {state.md}
                      <span aria-hidden="true"> · </span>
                      <span className="text-[var(--g)] font-semibold">ออโต้เซฟ</span>
                    </div>
                  </div>
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

                {/* Primary Save & Vault Buttons */}
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
                        onToast(`บันทึกจุดเซฟ "${saved.filename}" ลงคลังเซฟแล้ว`);
                      } catch {
                        onToast('❌ บันทึกไฟล์ไม่สำเร็จ');
                      } finally {
                        setSavingToFolder(false);
                      }
                    }}
                    className="btn btn-sm btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
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
                    <Folder className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
                    <span>เปิดคลังเซฟ</span>
                  </button>
                </div>

                {lastSavedFile && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-[10.5px] mland:text-[8.5px] text-[var(--g)] font-bold truncate">
                    ✓ บันทึกจุดเซฟแล้ว: {lastSavedFile}
                  </div>
                )}

                {/* Secondary Code Export / Import */}
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
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-1.5">
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
                      className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono"
                    />
                  </div>
                )}

                {showLoadBox && (
                  <div className="p-2.5 mland:p-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-2 mland:space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)] truncate">
                        {importFileName ? importFileName : 'นำเข้าไฟล์ภายนอก / วางโค้ดเซฟ'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            fileInputRef.current?.click();
                          }}
                          className="btn btn-xs btn-surface"
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
                      className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono"
                    />

                    {importRaw.trim() && !parsedImport && (
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--red)] font-semibold">
                        ❌ ข้อมูลเซฟไม่ถูกต้อง กรุณาตรวจสอบไฟล์หรือโค้ดอีกครั้ง
                      </div>
                    )}

                    {parsedImport && (
                      <div className="p-2 mland:p-1.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 space-y-1.5">
                        <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] truncate">
                          {parsedImport.mode === 'm' ? 'ผู้จัดการทีม' : 'นักเตะอาชีพ'} ·{' '}
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
                                        onToast(`เพิ่มช่องเซฟใหม่ (#${nextCap}) แล้ว`);
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
                                        + เพิ่มช่องใหม่ (#{cnt + 1})
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
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-4 py-3 mland:px-3 mland:py-2 bg-[var(--surface)] border-t border-[var(--line)] flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onExitToMenu();
            }}
            className="btn btn-md btn-danger flex-1"
          >
            <Home className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
            <span>กลับหน้าเมนูหลัก</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-primary flex-1"
          >
            <Check className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
            <span>ตกลง</span>
          </button>
        </footer>
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
