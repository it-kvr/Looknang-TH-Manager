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
  Minimize2,
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
import {
  enterLandscapeFullscreen,
  exitFullscreenSafe,
  getFullscreenElement,
  isMobileDevice,
  onFullscreenChange,
} from '../utils/fullscreen';
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

interface ToggleSwitchRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  dataNoAutoFs?: boolean;
}

const ToggleSwitchRow: React.FC<ToggleSwitchRowProps> = ({
  icon,
  title,
  description,
  checked,
  onToggle,
  dataNoAutoFs,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    data-no-auto-fs={dataNoAutoFs ? '1' : undefined}
    onClick={onToggle}
    className="w-full py-2 mland:py-1.5 px-1 flex items-center justify-between gap-2.5 text-left rounded-lg hover:bg-[var(--surface-2)]/45 cursor-pointer transition-colors"
  >
    <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
      <div
        className={`w-7.5 h-7.5 mland:w-6 mland:h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? 'bg-[var(--g-soft)] text-[var(--g)]'
            : 'bg-[var(--surface-2)]/75 text-[var(--mut)]'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] truncate leading-snug">
          {title}
        </div>
        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate leading-snug">
          {description}
        </div>
      </div>
    </div>

    <span
      aria-hidden="true"
      className={`inline-flex items-center w-9 h-5 p-0.5 shrink-0 rounded-full transition-colors ${
        checked
          ? 'bg-[var(--g)]'
          : 'bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--line)]'
      }`}
    >
      <span
        className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

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
  const [fsActive, setFsActive] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncFsState = () => {
      setFsActive(Boolean(getFullscreenElement()));
    };
    const offFs = onFullscreenChange((active) => {
      setFsActive(active);
    });
    window.addEventListener('resize', syncFsState);
    window.addEventListener('orientationchange', syncFsState);
    return () => {
      offFs();
      window.removeEventListener('resize', syncFsState);
      window.removeEventListener('orientationchange', syncFsState);
    };
  }, []);

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
  const isCurrentlyFs = fsActive;
  const onMobile = isMobileDevice();
  const activeSaveTitle =
    state.mode === 'm'
      ? state.club?.name || state.teams[state.me]?.name || 'สโมสร'
      : state.p?.name || 'นักเตะ';
  const modeLabel = state.mode === 'm' ? 'ผู้จัดการทีม' : 'นักเตะอาชีพ';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*94)] rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 mland:px-3 mland:py-2 border-b border-[var(--line)]/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/25 text-[var(--g)] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3
                  id="settings-modal-title"
                  className="font-bold text-sm sm:text-base mland:text-xs font-display text-[var(--ink)] truncate leading-tight"
                >
                  ตั้งค่าเกม
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onOpenSecretBoost();
                  }}
                  aria-label="สแกนลายนิ้วมือ"
                  title={vipAuthorized ? 'เปิดแผงควบคุมพิเศษ (ยืนยันตัวตนแล้ว)' : 'สแกนลายนิ้วมือ'}
                  className={`w-6 h-6 mland:w-5 mland:h-5 rounded-md inline-flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                    vipAuthorized
                      ? 'text-[var(--g)] bg-[var(--g-soft)] hover:brightness-110'
                      : 'text-[var(--mut)]/35 hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/70'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
                </button>
              </div>
              <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular truncate mt-0.5 mland:mt-0">
                {activeSaveTitle}
                <span aria-hidden="true"> · </span>
                {modeLabel}
                <span aria-hidden="true"> · </span>
                ซีซัน {state.season} นัด {state.md}
                <span aria-hidden="true"> · </span>
                ช่อง #{slot}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดตั้งค่า"
            className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>
        </header>

        {/* Unified Single-Page Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 mland:px-3.5 mland:py-2.5 grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-5 sm:gap-6 mland:gap-3.5 items-start">
          {/* Left Column: Gameplay Speed & Audio */}
          <div className="divide-y divide-[var(--line)]/65">
            {/* Match Speed */}
            <section className="pb-3.5 mland:pb-2 space-y-2 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-[13px] mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Gauge className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>ความเร็วการแข่งขัน</span>
                </div>
                <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--g)] tabular whitespace-nowrap">
                  {curMatchSpeed}x · {curSpeedLabel}
                </span>
              </div>

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
                      className={`py-1.5 mland:py-1 px-1 rounded-lg mland:rounded-md flex flex-col items-center justify-center cursor-pointer transition-all ${
                        active
                          ? 'bg-[var(--g)] text-white shadow-xs'
                          : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/75'
                      }`}
                    >
                      <span className="text-[11.5px] mland:text-[9.5px] font-bold tabular leading-tight">
                        {opt.short}
                      </span>
                      <span
                        className={`hidden sm:block mland:hidden text-[9px] leading-tight mt-0.5 ${
                          active ? 'text-white/90 font-semibold' : 'text-[var(--mut)]'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Audio Volume Sliders */}
            <section className="py-3.5 mland:py-2 space-y-2.5 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-[13px] mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Volume2 className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>ระบบเสียงและการตอบสนอง</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    SFX.whistle();
                  }}
                  className="btn btn-xs btn-surface whitespace-nowrap shrink-0"
                >
                  <Volume2 className="w-3 h-3 text-[var(--g)] shrink-0" />
                  <span>ทดสอบเสียง</span>
                </button>
              </div>

              <div className="space-y-2 mland:space-y-1.5">
                <label className="grid grid-cols-[78px_1fr_40px] mland:grid-cols-[62px_1fr_32px] items-center gap-2.5 mland:gap-2 text-[11.5px] mland:text-[9.5px]">
                  <span className="text-[var(--mut)] font-semibold truncate">เสียงเอฟเฟกต์</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={!!st.mute}
                    value={st.sfxVolume ?? 85}
                    onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
                    className="w-full accent-[var(--g)] h-1.5 rounded-full bg-[var(--surface-2)] cursor-pointer disabled:opacity-40"
                  />
                  <span className="font-bold tabular text-right text-[var(--ink)]">
                    {st.mute ? 'ปิด' : `${st.sfxVolume ?? 85}%`}
                  </span>
                </label>

                <label className="grid grid-cols-[78px_1fr_40px] mland:grid-cols-[62px_1fr_32px] items-center gap-2.5 mland:gap-2 text-[11.5px] mland:text-[9.5px]">
                  <span className="text-[var(--mut)] font-semibold truncate">เสียงเชียร์</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={!!st.mute || !!st.nocrowd}
                    value={st.crowdVolume ?? 70}
                    onChange={(e) => update({ crowdVolume: Number(e.target.value) })}
                    className="w-full accent-[var(--g)] h-1.5 rounded-full bg-[var(--surface-2)] cursor-pointer disabled:opacity-40"
                  />
                  <span className="font-bold tabular text-right text-[var(--ink)]">
                    {st.mute || st.nocrowd ? 'ปิด' : `${st.crowdVolume ?? 70}%`}
                  </span>
                </label>
              </div>
            </section>

            {/* Audio & Haptics Switches */}
            <section className="pt-1.5 mland:pt-1 divide-y divide-[var(--line)]/45">
              <ToggleSwitchRow
                icon={<VolumeX className="w-4 h-4 mland:w-3.5 mland:h-3.5" />}
                title="ปิดเสียงทั้งหมด"
                description={st.mute ? 'ปิดเสียงเอฟเฟกต์และเสียงเชียร์ทั้งหมด' : 'เปิดเสียงประกอบการเล่นตามปกติ'}
                checked={!!st.mute}
                onToggle={() => {
                  unlockAudio();
                  SFX.tap();
                  update({ mute: !st.mute });
                }}
              />
              <ToggleSwitchRow
                icon={<Users className="w-4 h-4 mland:w-3.5 mland:h-3.5" />}
                title="ปิดเสียงเชียร์ในสนาม"
                description={st.nocrowd ? 'ปิดเสียงบรรยากาศผู้ชมระหว่างแข่ง' : 'เปิดเสียงเชียร์ในสนามแข่งขัน'}
                checked={!!st.nocrowd}
                onToggle={() => {
                  unlockAudio();
                  SFX.tap();
                  update({ nocrowd: !st.nocrowd });
                }}
              />
              <ToggleSwitchRow
                icon={<Smartphone className="w-4 h-4 mland:w-3.5 mland:h-3.5" />}
                title="ปิดการสั่น (Haptics)"
                description={st.novib ? 'งดการสั่นแจ้งเตือนเมื่อเกิดเหตุการณ์สำคัญ' : 'สั่นเตือนจังหวะยิงประตูและจบเกม'}
                checked={!!st.novib}
                onToggle={() => {
                  unlockAudio();
                  SFX.tap();
                  update({ novib: !st.novib });
                }}
              />
            </section>
          </div>

          {/* Right Column: Display, App & Save Management */}
          <div className="divide-y divide-[var(--line)]/65 border-t border-[var(--line)]/65 pt-4 sm:border-t-0 sm:pt-0 sm:border-l sm:border-[var(--line)]/65 sm:pl-6 mland:border-t-0 mland:pt-0 mland:border-l mland:border-[var(--line)]/65 mland:pl-3.5">
            {/* Display & App */}
            <section className="pb-3.5 mland:pb-2 space-y-2.5 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-[13px] mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Monitor className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>หน้าจอและแอปพลิเคชัน</span>
                </div>
                <span className="text-[11px] mland:text-[9px] text-[var(--mut)] font-semibold">
                  {(st.theme || '') === '' ? 'ตามระบบ' : st.theme === 'light' ? 'สว่าง' : 'มืด'}
                </span>
              </div>

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
                          : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/75'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-no-auto-fs="1"
                onClick={() => {
                  SFX.tap();
                  if (isCurrentlyFs) {
                    update({ preferFullscreen: false });
                    exitFullscreenSafe()
                      .then(() => {
                        setFsActive(Boolean(getFullscreenElement()));
                      })
                      .catch(() => undefined);
                    onToast('ออกจากโหมดเต็มจอแล้ว');
                  } else {
                    update({ preferFullscreen: true });
                    enterLandscapeFullscreen(true)
                      .then(() => {
                        setFsActive(Boolean(getFullscreenElement()));
                      })
                      .catch(() => undefined);
                    onToast(onMobile ? 'เข้าสู่โหมดเต็มจอแนวนอนแล้ว' : 'เข้าสู่โหมดเต็มจอแล้ว');
                  }
                }}
                className="w-full py-2 mland:py-1.5 px-1 flex items-center justify-between gap-2.5 text-left rounded-lg hover:bg-[var(--surface-2)]/45 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
                  <div
                    className={`w-7.5 h-7.5 mland:w-6 mland:h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isCurrentlyFs
                        ? 'bg-[var(--g-soft)] text-[var(--g)]'
                        : 'bg-[var(--surface-2)]/75 text-[var(--mut)]'
                    }`}
                  >
                    {isCurrentlyFs ? (
                      <Minimize2 className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
                    ) : (
                      <Maximize2 className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] truncate leading-snug">
                      {onMobile ? 'โหมดเต็มจอ & แนวนอน' : 'โหมดเต็มจอ'}
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate leading-snug">
                      {isCurrentlyFs
                        ? onMobile
                          ? 'กำลังใช้งานเต็มจอแนวนอนอยู่'
                          : 'กำลังใช้งานโหมดเต็มจออยู่'
                        : onMobile
                          ? 'กดเพื่อขยายเต็มจอและปรับแนวนอน'
                          : 'กดเพื่อขยายหน้าจอเกมเต็มหน้าต่าง'}
                    </div>
                  </div>
                </div>

                <span
                  className={`btn btn-xs shrink-0 whitespace-nowrap ${
                    isCurrentlyFs ? 'btn-secondary' : 'btn-primary'
                  }`}
                >
                  {isCurrentlyFs ? (
                    <Minimize2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Maximize2 className="w-3 h-3 shrink-0" />
                  )}
                  <span>{isCurrentlyFs ? 'ออกเต็มจอ' : onMobile ? 'เต็มจอแนวนอน' : 'เต็มจอ'}</span>
                </span>
              </button>

              <PWAInstallButton variant="settings" onToast={onToast} />
            </section>

            {/* Save Management */}
            <section className="pt-3.5 mland:pt-2 space-y-2.5 mland:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-[13px] mland:text-[10.5px] font-bold text-[var(--ink)]">
                  <Save className="w-4 h-4 mland:w-3.5 mland:h-3.5 text-[var(--g)] shrink-0" />
                  <span>จัดการเซฟเกม</span>
                </div>
                <span className="text-[11px] mland:text-[9px] font-semibold text-[var(--g)] tabular whitespace-nowrap">
                  ช่อง #{slot} · ออโต้เซฟ
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
                <div className="p-2.5 mland:p-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] space-y-1.5">
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
                    className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono text-[var(--ink)]"
                  />
                </div>
              )}

              {showLoadBox && (
                <div className="p-2.5 mland:p-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/65 border border-[var(--line)] space-y-2 mland:space-y-1.5">
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
                    className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono text-[var(--ink)]"
                  />

                  {importRaw.trim() && !parsedImport && (
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--red)] font-semibold">
                      ❌ ข้อมูลเซฟไม่ถูกต้อง กรุณาตรวจสอบไฟล์หรือโค้ดอีกครั้ง
                    </div>
                  )}

                  {parsedImport && (
                    <div className="p-2 mland:p-1.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 space-y-1.5">
                      <div className="text-[10.5px] mland:text-[9px] font-bold text-[var(--ink)] truncate tabular">
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
                              className="flex-1 min-w-0 h-9 mland:h-7 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10.5px] mland:text-[9px] font-semibold text-[var(--ink)]"
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
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-4 py-3 sm:px-5 mland:px-3 mland:py-2 border-t border-[var(--line)]/80 bg-[var(--surface)] flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onExitToMenu();
            }}
            className="btn btn-md btn-danger shrink-0"
          >
            <Home className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
            <span>กลับหน้าเมนูหลัก</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-primary min-w-[116px] mland:min-w-[90px] shrink-0"
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
