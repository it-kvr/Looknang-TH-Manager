import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Folder,
  FolderInput,
  Pin,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import type { GameMode, GameState } from '../types/game';
import { SFX } from '../utils/audioTheme';
import {
  firstEmptySlot,
  getPinnedFolderKeys,
  getSlotCount,
  loadGameFromSlot,
  MAX_SLOTS,
  setSlotCount,
  togglePinnedFolderKey
} from '../engine/playerCore';
import {
  cleanImportJson,
  downloadRawSaveFile,
  downloadSaveFile,
  exportSaveCode,
  readSaveFileText
} from '../engine/saveCodec';
import {
  GAME_AUTO_FOLDER_NAME,
  listAutoFolderSaves,
  migrateLocalSlotsToAutoFolderOnce,
  parseFolderSaveEntry,
  saveGameToAutoFolder,
  type FolderSaveEntry
} from '../engine/saveFolder';

type FolderTab = 'folder' | 'code';

const fmtSavedTime = (ts: number): string => {
  if (!ts || !Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

const fmtBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getStateDisplayName = (s: GameState): string =>
  s.mode === 'm' ? s.club?.name || s.teams[s.me]?.name || 'สโมสร' : s.p?.name || 'นักเตะ';

const buildSaveIdentityKey = (mode: GameMode, name: string, season: number, md: number): string =>
  `${mode}|${name.trim()}|${Number(season || 1)}|${Number(md || 0)}`;

export const SaveFolderModal: React.FC<{
  currentState?: GameState | null;
  currentSlot?: number;
  initialTab?: FolderTab;
  onSaveCurrentSlot?: () => void;
  onLoadSave: (loaded: GameState, targetSlot: number) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}> = ({
  currentState = null,
  currentSlot = 1,
  initialTab = 'folder',
  onSaveCurrentSlot,
  onLoadSave,
  onClose,
  onToast
}) => {
  const [tab, setTab] = useState<FolderTab>(initialTab);
  const [entries, setEntries] = useState<FolderSaveEntry[]>([]);
  const [opfsActive, setOpfsActive] = useState(false);
  const [modeFilter, setModeFilter] = useState<'all' | GameMode>('all');
  const [slotChoice, setSlotChoice] = useState<'auto' | number>('auto');
  const [confirmLoadEntry, setConfirmLoadEntry] = useState<FolderSaveEntry | null>(null);
  const [confirmSlotNum, setConfirmSlotNum] = useState<number>(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [pinnedFolderKeys, setPinnedFolderKeys] = useState<string[]>(() => getPinnedFolderKeys());

  // Tab 2: External File / Save Code
  const [codeText, setCodeText] = useState('');
  const [codeFileName, setCodeFileName] = useState('');
  const [exportedCode, setExportedCode] = useState('');
  const singleFileRef = useRef<HTMLInputElement | null>(null);
  const parsedCode = useMemo(() => (codeText.trim() ? cleanImportJson(codeText) : null), [codeText]);
  const [codeTargetSlot, setCodeTargetSlot] = useState<number>(currentSlot || 1);

  const inGameSaveIndex = useMemo(() => {
    const identityKeys = new Set<string>();
    const activeSlotKeys = new Map<string, string>();
    const addState = (s: GameState | null | undefined, slotKey?: string) => {
      if (!s) return;
      const key = buildSaveIdentityKey(s.mode, getStateDisplayName(s), s.season, s.md);
      identityKeys.add(key);
      if (slotKey) activeSlotKeys.set(slotKey, key);
    };
    addState(currentState);
    (['m', 'p'] as const).forEach((mode) => {
      const cnt = getSlotCount(mode);
      for (let k = 1; k <= cnt; k++) {
        addState(loadGameFromSlot(mode, k), `${mode}:${k}`);
      }
    });
    return { identityKeys, activeSlotKeys };
  }, [currentState, entries]);

  const isEntryAlreadyInGame = (entry: FolderSaveEntry): boolean =>
    inGameSaveIndex.identityKeys.has(
      buildSaveIdentityKey(entry.mode, entry.name, entry.season, entry.md)
    );

  const isActiveSlotAutoMirror = (entry: FolderSaveEntry): boolean => {
    if (!entry.isAutoSave || !entry.slot) return false;
    const slotKey = inGameSaveIndex.activeSlotKeys.get(`${entry.mode}:${entry.slot}`);
    if (!slotKey) return false;
    return slotKey === buildSaveIdentityKey(entry.mode, entry.name, entry.season, entry.md);
  };

  const parsedCodeAlreadyInGame = useMemo(() => {
    if (!parsedCode) return false;
    return inGameSaveIndex.identityKeys.has(
      buildSaveIdentityKey(
        parsedCode.mode,
        getStateDisplayName(parsedCode),
        parsedCode.season,
        parsedCode.md
      )
    );
  }, [parsedCode, inGameSaveIndex]);

  const resolveAutoSlotFor = (mode: GameMode, preferredSlot?: number): { slot: number; needsConfirm: boolean } => {
    const modeSlotCap = getSlotCount(mode);
    if (typeof slotChoice === 'number') {
      return { slot: slotChoice, needsConfirm: false };
    }
    if (currentState && currentState.mode === mode) {
      return { slot: currentSlot || 1, needsConfirm: false };
    }
    if (preferredSlot && preferredSlot >= 1 && preferredSlot <= modeSlotCap && !loadGameFromSlot(mode, preferredSlot)) {
      return { slot: preferredSlot, needsConfirm: false };
    }
    const empty = firstEmptySlot(mode);
    if (empty > 0) {
      return { slot: empty, needsConfirm: false };
    }
    if (modeSlotCap < MAX_SLOTS) {
      return { slot: modeSlotCap + 1, needsConfirm: true };
    }
    return { slot: preferredSlot && preferredSlot >= 1 && preferredSlot <= modeSlotCap ? preferredSlot : 1, needsConfirm: true };
  };

  const refreshFolderSaves = async () => {
    setLoadingList(true);
    try {
      await migrateLocalSlotsToAutoFolderOnce(loadGameFromSlot, Math.max(getSlotCount('m'), getSlotCount('p')));
      const res = await listAutoFolderSaves();
      setEntries(res.entries);
      setOpfsActive(res.opfsActive);
    } catch {
      onToast('❌ ไม่สามารถอ่านไฟล์ในโฟลเดอร์เซฟของเกมได้');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refreshFolderSaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveCheckpoint = async () => {
    if (!currentState) return;
    SFX.tap();
    onSaveCurrentSlot?.();
    setBusy(true);
    try {
      const saved = await saveGameToAutoFolder(currentState, {
        label: saveLabel.trim() || undefined
      });
      setSaveLabel('');
      await refreshFolderSaves();
      SFX.win();
      onToast(`💾 บันทึก "${saved.filename}" ลงโฟลเดอร์ ${GAME_AUTO_FOLDER_NAME} แล้ว`);
    } catch {
      onToast('❌ บันทึกไฟล์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadEntryDirect = async (entry: FolderSaveEntry, targetSlot: number) => {
    setBusy(true);
    try {
      const parsed = await parseFolderSaveEntry(entry);
      if (!parsed) {
        onToast('❌ ไฟล์เซฟเสียหายหรือไม่ถูกต้อง');
        return;
      }
      SFX.win();
      onLoadSave(parsed, targetSlot);
      onClose();
    } catch {
      onToast('❌ ไม่สามารถโหลดไฟล์เซฟนี้ได้');
    } finally {
      setBusy(false);
    }
  };

  const handlePickLoadEntry = (entry: FolderSaveEntry) => {
    if (isEntryAlreadyInGame(entry)) {
      SFX.tap();
      onToast('ไฟล์เซฟนี้มีอยู่ในเกมแล้ว ไม่ต้องโหลดซ้ำ');
      return;
    }
    SFX.tap();
    const resolved = resolveAutoSlotFor(entry.mode, entry.slot);
    if (resolved.needsConfirm) {
      setConfirmSlotNum(resolved.slot);
      setConfirmLoadEntry(entry);
    } else {
      void handleLoadEntryDirect(entry, resolved.slot);
    }
  };

  const handleDeleteEntry = async (entry: FolderSaveEntry) => {
    if (confirmDeleteId !== entry.id) {
      SFX.tap();
      setConfirmDeleteId(entry.id);
      window.setTimeout(() => {
        setConfirmDeleteId((cur) => (cur === entry.id ? null : cur));
      }, 3000);
      return;
    }
    SFX.tap();
    setConfirmDeleteId(null);
    await entry.remove?.();
    await refreshFolderSaves();
    onToast(`🗑️ ลบไฟล์ "${entry.filename}" แล้ว`);
  };

  const handleTogglePinEntry = (entry: FolderSaveEntry) => {
    SFX.tap();
    const res = togglePinnedFolderKey(entry.filename);
    setPinnedFolderKeys(res.list);
    onToast(res.pinned ? `📌 ปักหมุด "${entry.name}" ไว้บนสุดแล้ว` : `เลิกปักหมุด "${entry.name}" แล้ว`);
  };

  const pinnedFolderSet = useMemo(() => new Set(pinnedFolderKeys), [pinnedFolderKeys]);

  const availableEntries = useMemo(
    () => entries.filter((e) => !isActiveSlotAutoMirror(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, inGameSaveIndex]
  );

  const modeCounts = useMemo(
    () => ({
      all: availableEntries.length,
      m: availableEntries.filter((e) => e.mode === 'm').length,
      p: availableEntries.filter((e) => e.mode === 'p').length
    }),
    [availableEntries]
  );

  const filteredEntries = useMemo(() => {
    const base = modeFilter === 'all' ? availableEntries : availableEntries.filter((e) => e.mode === modeFilter);
    return base.slice().sort((a, b) => {
      const pa = pinnedFolderSet.has(a.filename) ? 1 : 0;
      const pb = pinnedFolderSet.has(b.filename) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
  }, [availableEntries, modeFilter, pinnedFolderSet]);

  const maxChoiceSlots = useMemo(
    () => Math.max(getSlotCount('m'), getSlotCount('p')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, currentState]
  );

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/72 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-[min(calc(var(--app-dvh,1dvh)*90),620px)] mland:h-[calc(var(--app-dvh,1dvh)*94)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 mland:w-6 mland:h-6 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 flex items-center justify-center shrink-0">
              <Folder className="w-3.5 h-3.5 text-[var(--g)]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display truncate leading-tight">
                คลังเซฟ ({GAME_AUTO_FOLDER_NAME})
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" className="btn-icon rounded-full!">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-3.5 pt-2.5 pb-1 mland:px-2.5 mland:pt-1.5 mland:pb-0.5">
          <div className="seg-bar grid grid-cols-2 w-full bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setTab('folder');
              }}
              className={`seg-btn flex items-center justify-center gap-1.5 ${
                tab === 'folder' ? 'seg-btn-active' : 'hover:bg-[var(--surface)]'
              }`}
            >
              <Folder className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">โฟลเดอร์เซฟของเกม ({availableEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setTab('code');
              }}
              className={`seg-btn flex items-center justify-center gap-1.5 ${
                tab === 'code' ? 'seg-btn-active' : 'hover:bg-[var(--surface)]'
              }`}
            >
              <FolderInput className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">นำเข้า / ส่งออกโค้ด</span>
            </button>
          </div>
        </div>

        {/* Body — stays uniform size across tabs */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden mland:overflow-y-auto p-3.5 mland:p-2.5">
          {tab === 'folder' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 mland:gap-2 mland:flex-none">
              {/* Auto Folder Info & Quick Save */}
              <div className="shrink-0 p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 mland:w-7 mland:h-7 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-base mland:text-sm shrink-0 shadow-2xs">
                      📁
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] flex items-center gap-1.5 flex-wrap">
                        <span>โฟลเดอร์เกม:</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] font-mono text-[10.5px] mland:text-[9px] text-[var(--g)] truncate">
                          {GAME_AUTO_FOLDER_NAME}/
                        </span>
                        {opfsActive && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[var(--g-soft)] border border-[var(--g)]/30 text-[9.5px] mland:text-[8px] font-bold text-[var(--g)]">
                            ระบบไฟล์ในเครื่อง
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate mt-0.5">
                        จัดเก็บไฟล์จุดเซฟและสำรองข้อมูลเกมให้อัตโนมัติ พร้อมโหลดใช้งานข้ามรอบได้ทันที
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loadingList}
                    onClick={() => {
                      SFX.tap();
                      void refreshFolderSaves();
                    }}
                    title="รีเฟรชรายการไฟล์เซฟ"
                    aria-label="รีเฟรชรายการไฟล์เซฟ"
                    className="btn-icon w-8 h-8 mland:w-7 mland:h-7 rounded-xl shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {currentState && (
                  <div className="pt-2 border-t border-[var(--line)]/70 flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveCheckpoint();
                      }}
                      placeholder="ตั้งชื่อโน้ตจุดเซฟ (ไม่ใส่ก็ได้ เช่น ก่อนนัดชิง)"
                      maxLength={32}
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveCheckpoint()}
                      className="btn btn-sm btn-primary shrink-0"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span>สร้างจุดเซฟเลย</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Filter & Target Slot Header */}
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                <div className="inline-flex rounded-xl bg-[var(--surface-2)] p-0.5 border border-[var(--line)] text-[10.5px] mland:text-[9.5px]">
                  {(
                    [
                      ['all', `ทั้งหมด (${modeCounts.all})`],
                      ['m', `ผู้จัดการ (${modeCounts.m})`],
                      ['p', `นักเตะ (${modeCounts.p})`]
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setModeFilter(key);
                      }}
                      className={`px-2.5 py-1 mland:py-0.5 rounded-lg font-bold cursor-pointer transition-colors ${
                        modeFilter === key
                          ? 'bg-[var(--g)] text-white shadow-2xs'
                          : 'text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5 text-[var(--mut)] shrink-0">
                  <span className="font-semibold">โหลดลงช่อง:</span>
                  <select
                    value={slotChoice}
                    onChange={(e) =>
                      setSlotChoice(e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                    }
                    className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)]"
                  >
                    <option value="auto">อัตโนมัติ</option>
                    {Array.from({ length: maxChoiceSlots }, (_, i) => i + 1).map((k) => (
                      <option key={k} value={k}>
                        ช่อง #{k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Scrollable Save List */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 mland:flex-none mland:overflow-visible">
                {loadingList ? (
                  <div className="h-full min-h-[160px] flex items-center justify-center p-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/30 text-center text-xs text-[var(--mut)]">
                    กำลังดึงรายการไฟล์เซฟจากโฟลเดอร์ {GAME_AUTO_FOLDER_NAME}...
                  </div>
                ) : filteredEntries.length ? (
                  <div className="space-y-2">
                    {filteredEntries.map((entry) => {
                      const isMgr = entry.mode === 'm';
                      const isConfirmDel = confirmDeleteId === entry.id;
                      const alreadyInGame = isEntryAlreadyInGame(entry);
                      const isPinned = pinnedFolderSet.has(entry.filename);
                      return (
                        <div
                          key={entry.id}
                          className={`group p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                            isPinned
                              ? 'border-[var(--lamp)]/65 bg-[var(--lamp-soft)]/22 hover:bg-[var(--surface)] shadow-2xs'
                              : alreadyInGame
                                ? 'border-[var(--g)]/40 bg-[var(--surface)] shadow-2xs'
                                : 'border-[var(--line)] bg-[var(--surface-2)]/55 hover:bg-[var(--surface)] hover:border-[var(--g)]/55 hover:shadow-xs'
                          }`}
                        >
                          {/* Mode Badge Tile */}
                          <div
                            className={`relative w-10 h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg border flex flex-col items-center justify-center shrink-0 ${
                              isMgr
                                ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'
                                : 'bg-[var(--g-soft)] border-[var(--g)]/40'
                            }`}
                          >
                            <span className="text-base mland:text-xs leading-none">{isMgr ? '📋' : '⚽'}</span>
                            {isPinned && (
                              <span
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--lamp)] text-[#261900] flex items-center justify-center shadow-xs"
                                title="ปักหมุดไว้บนสุด"
                              >
                                <Pin className="w-2.5 h-2.5 fill-current" />
                              </span>
                            )}
                          </div>

                          {/* Center Info */}
                          <div className="min-w-0 flex-1 space-y-1 mland:space-y-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="font-extrabold text-[13px] sm:text-sm mland:text-[11px] truncate text-[var(--ink)] leading-tight">
                                {entry.name}
                              </span>
                              {entry.label && !entry.isAutoSave && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] font-bold text-[var(--ink)] truncate max-w-[160px]">
                                  🏷️ {entry.label}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[9.5px] mland:text-[8px] font-bold shrink-0 ${
                                  isMgr
                                    ? 'bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)]'
                                    : 'bg-[var(--g-soft)] text-[var(--g)]'
                                }`}
                              >
                                {isMgr ? 'ผู้จัดการ' : 'นักเตะ'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[9.5px] mland:text-[8px] font-bold shrink-0 border ${
                                  entry.isAutoSave
                                    ? 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                                    : 'bg-[var(--lamp-soft)]/70 text-[#9a6700] dark:text-[var(--lamp)] border-[var(--lamp)]/40'
                                }`}
                              >
                                {entry.isAutoSave ? 'สำรอง' : 'จุดเซฟ'}
                              </span>
                            </div>

                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                              <span className="font-bold text-[var(--ink)]/85">
                                ซีซัน {entry.season} · นัด {entry.md}
                              </span>
                              {entry.savedAt > 0 && (
                                <>
                                  <span className="opacity-45">•</span>
                                  <span>{fmtSavedTime(entry.savedAt)}</span>
                                </>
                              )}
                              {entry.size > 0 && (
                                <>
                                  <span className="opacity-45">•</span>
                                  <span>{fmtBytes(entry.size)}</span>
                                </>
                              )}
                            </div>

                            <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]/75 font-mono truncate">
                              {entry.filename}
                            </div>
                          </div>

                          {/* Right Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleTogglePinEntry(entry)}
                              title={isPinned ? 'เลิกปักหมุด' : 'ปักหมุดเซฟนี้ไว้บนสุด'}
                              aria-label={isPinned ? 'เลิกปักหมุด' : 'ปักหมุดเซฟนี้ไว้บนสุด'}
                              className={`w-8 h-8 mland:w-6 mland:h-6 rounded-xl mland:rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                isPinned
                                  ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[#8a5b00] hover:border-[var(--lamp)]/60'
                              }`}
                            >
                              <Pin className={`w-3.5 h-3.5 mland:w-3 mland:h-3 ${isPinned ? 'fill-current' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                SFX.tap();
                                const raw = await entry.readRaw();
                                downloadRawSaveFile(entry.filename, raw);
                                onToast(`💾 ส่งออกสำเนา "${entry.filename}" แล้ว`);
                              }}
                              title="ดาวน์โหลดสำเนาไฟล์เซฟนี้"
                              aria-label="ดาวน์โหลดสำเนาไฟล์เซฟนี้"
                              className="btn-icon w-8 h-8 mland:w-6 mland:h-6 rounded-xl mland:rounded-lg"
                            >
                              <Download className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
                            </button>

                            {entry.remove && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteEntry(entry)}
                                title={isConfirmDel ? 'แตะอีกครั้งเพื่อยืนยันลบ' : 'ลบไฟล์เซฟนี้'}
                                aria-label="ลบไฟล์เซฟนี้"
                                className={`h-8 mland:h-6 px-2.5 mland:px-1.5 rounded-xl mland:rounded-lg border text-[10.5px] mland:text-[9px] font-bold transition-colors cursor-pointer flex items-center justify-center ${
                                  isConfirmDel
                                    ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]'
                                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50'
                                }`}
                              >
                                {isConfirmDel ? 'ลบ?' : <Trash2 className="w-3.5 h-3.5 mland:w-3 mland:h-3" />}
                              </button>
                            )}

                            {alreadyInGame ? (
                              <span className="h-8 mland:h-6 px-2.5 mland:px-2 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-[10.5px] mland:text-[9px] font-bold text-[var(--g)] inline-flex items-center gap-1 shrink-0">
                                <Check className="w-3 h-3 shrink-0" />
                                <span>มีในเกม</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handlePickLoadEntry(entry)}
                                className="btn btn-xs h-8 mland:h-6 px-3 mland:px-2 rounded-xl! mland:rounded-lg! btn-primary shrink-0"
                              >
                                โหลดใช้งาน
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center gap-1.5 p-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/30 text-center text-xs mland:text-[10px] text-[var(--mut)]">
                    <span className="text-xl opacity-75">📂</span>
                    <div>
                      {entries.length > 0 && availableEntries.length === 0
                        ? `ไฟล์เซฟทั้งหมดในโฟลเดอร์ ${GAME_AUTO_FOLDER_NAME} มีอยู่ในช่องเซฟของเกมแล้ว`
                        : modeFilter !== 'all' && availableEntries.length > 0
                          ? 'ไม่พบไฟล์เซฟเพิ่มเติมในโหมดที่เลือก'
                          : (
                            <>
                              ยังไม่มีไฟล์เซฟเพิ่มเติมในโฟลเดอร์ {GAME_AUTO_FOLDER_NAME}
                              {currentState
                                ? ' — กดปุ่ม "สร้างจุดเซฟเลย" ด้านบนเพื่อสร้างจุดเซฟแยกต่างหาก'
                                : ' — เมื่อเริ่มเล่นเกม ตัวเกมจะสร้างไฟล์เซฟในโฟลเดอร์นี้ให้อัตโนมัติ'}
                            </>
                          )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: External File / Save Code (for device transfer) */}
          {tab === 'code' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3 mland:space-y-2 mland:flex-none mland:overflow-visible">
              {currentState && (
                <div className="p-3 sm:p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <span>📤 ส่งออกเซฟปัจจุบันไปเครื่องอื่น</span>
                      </div>
                      <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] mt-0.5 truncate tabular">
                        {currentState.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} ·{' '}
                        <span className="font-bold text-[var(--ink)]">{getStateDisplayName(currentState)}</span> · ซีซัน {currentState.season} นัด {currentState.md}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.win();
                          onSaveCurrentSlot?.();
                          const { filename } = downloadSaveFile(currentState, saveLabel);
                          onToast(`💾 ดาวน์โหลดไฟล์ "${filename}" ลงเครื่องแล้ว`);
                        }}
                        className="btn btn-xs btn-primary"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>ดาวน์โหลด .json</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          const c = exportSaveCode(currentState);
                          setExportedCode(c);
                          navigator.clipboard?.writeText(c).catch(() => undefined);
                          onToast(`คัดลอกโค้ดเซฟ (${c.length.toLocaleString()} ตัวอักษร) แล้ว`);
                        }}
                        className="btn btn-xs btn-secondary"
                      >
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>คัดลอกโค้ด</span>
                      </button>
                    </div>
                  </div>
                  {exportedCode && (
                    <textarea
                      readOnly
                      value={exportedCode}
                      rows={2}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono"
                    />
                  )}
                </div>
              )}

              <div className="p-3 sm:p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                    📥 นำเข้าไฟล์เซฟหรือโค้ดจากภายนอก
                  </span>
                  {codeText && (
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setCodeText('');
                        setCodeFileName('');
                      }}
                      className="text-[10.5px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ล้างข้อมูล
                    </button>
                  )}
                </div>

                <input
                  ref={singleFileRef}
                  type="file"
                  accept=".json,.lk2,.txt,application/json,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = '';
                    if (!f) return;
                    try {
                      const txt = await readSaveFileText(f);
                      setCodeFileName(f.name);
                      setCodeText(txt);
                      const p = cleanImportJson(txt);
                      if (p) {
                        SFX.tap();
                        const resolved = resolveAutoSlotFor(p.mode);
                        setCodeTargetSlot(resolved.slot);
                      } else {
                        onToast('❌ ไฟล์เซฟไม่ถูกต้อง');
                      }
                    } catch {
                      onToast('❌ อ่านไฟล์ไม่สำเร็จ');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    singleFileRef.current?.click();
                  }}
                  className="w-full p-3 mland:p-2 rounded-xl border border-dashed border-[var(--g)]/60 bg-[var(--g-soft)]/45 hover:bg-[var(--g-soft)] cursor-pointer flex items-center justify-center gap-2 text-xs mland:text-[10.5px] font-bold transition-colors"
                >
                  <Upload className="w-4 h-4 text-[var(--g)] shrink-0" />
                  <span className="truncate">
                    {codeFileName
                      ? `📄 ${codeFileName} (แตะเพื่อเปลี่ยนไฟล์)`
                      : 'เลือกไฟล์เซฟจากเครื่อง (.json / .lk2 / .txt)'}
                  </span>
                </button>

                <textarea
                  value={codeText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCodeFileName('');
                    setCodeText(val);
                    const p = val.trim() ? cleanImportJson(val) : null;
                    if (p) setCodeTargetSlot(resolveAutoSlotFor(p.mode).slot);
                  }}
                  placeholder="หรือวางโค้ดเซฟ LK2: / JSON ที่นี่..."
                  rows={4}
                  className="w-full p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-mono"
                />

                {codeText.trim() && !parsedCode && (
                  <div className="p-2 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/35 text-[11px] text-[var(--red)] font-semibold">
                    ❌ ข้อมูลไฟล์หรือโค้ดเซฟไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง
                  </div>
                )}

                {parsedCode && (
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--g)]/45 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                            parsedCode.mode === 'm'
                              ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'
                              : 'bg-[var(--g-soft)] border-[var(--g)]/40'
                          }`}
                        >
                          <span className="text-sm leading-none">{parsedCode.mode === 'm' ? '📋' : '⚽'}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs truncate text-[var(--ink)]">
                            {getStateDisplayName(parsedCode)}
                          </div>
                          <div className="text-[10.5px] text-[var(--mut)] tabular">
                            {parsedCode.mode === 'm' ? 'ผู้จัดการทีม' : 'นักเตะอาชีพ'} · ซีซัน {parsedCode.season} · นัด {parsedCode.md}
                          </div>
                        </div>
                      </div>
                    </div>
                    {parsedCodeAlreadyInGame ? (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-[11px] font-bold text-[var(--g)] text-center flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>เซฟนี้มีอยู่ในเกมแล้ว ไม่ต้องโหลดซ้ำ</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={codeTargetSlot}
                          onChange={(e) => setCodeTargetSlot(Number(e.target.value))}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
                        >
                          {(() => {
                            const cnt = getSlotCount(parsedCode.mode);
                            const options = Array.from({ length: cnt }, (_, idx) => idx + 1).map((k) => {
                              const existing = loadGameFromSlot(parsedCode.mode, k);
                              const occName = existing ? getStateDisplayName(existing) : '';
                              return (
                                <option key={k} value={k}>
                                  ช่อง #{k} {existing ? `(ทับ: ${occName})` : '(ว่าง)'}
                                </option>
                              );
                            });
                            if (cnt < MAX_SLOTS) {
                              options.push(
                                <option key={cnt + 1} value={cnt + 1}>
                                  ➕ เพิ่มช่องใหม่ (#{cnt + 1})
                                </option>
                              );
                            }
                            return options;
                          })()}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            SFX.win();
                            if (codeTargetSlot > getSlotCount(parsedCode.mode)) {
                              setSlotCount(parsedCode.mode, codeTargetSlot);
                            }
                            await saveGameToAutoFolder(parsedCode, {
                              slot: codeTargetSlot,
                              isAutoSave: true
                            });
                            onLoadSave(parsedCode, codeTargetSlot);
                            onClose();
                          }}
                          className="btn btn-sm btn-primary shrink-0"
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>โหลดใช้งาน</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Slot Sub-dialog when slots are full and user is in auto mode */}
        {confirmLoadEntry && (
          <div
            className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setConfirmLoadEntry(null)}
          >
            <div
              className="w-full max-w-sm p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-bold text-sm font-display">
                {getSlotCount(confirmLoadEntry.mode) < MAX_SLOTS
                  ? 'เลือกช่องที่จะโหลดใช้งาน (เพิ่มช่องใหม่หรือเขียนทับ)'
                  : 'ช่องเซฟเต็มแล้ว — เลือกช่องที่จะเขียนทับ'}
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs space-y-0.5">
                <div className="font-bold truncate">
                  {confirmLoadEntry.mode === 'm' ? '📋' : '⚽'}{' '}
                  {confirmLoadEntry.label && !confirmLoadEntry.isAutoSave
                    ? `${confirmLoadEntry.label} · `
                    : ''}
                  {confirmLoadEntry.name}
                </div>
                <div className="text-[11px] text-[var(--mut)] tabular">
                  ซีซัน {confirmLoadEntry.season} · นัด {confirmLoadEntry.md}
                </div>
              </div>
              <select
                value={confirmSlotNum}
                onChange={(e) => setConfirmSlotNum(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
              >
                {(() => {
                  const cnt = getSlotCount(confirmLoadEntry.mode);
                  const opts = Array.from({ length: cnt }, (_, idx) => idx + 1).map((k) => {
                    const existing = loadGameFromSlot(confirmLoadEntry.mode, k);
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
                    opts.unshift(
                      <option key={cnt + 1} value={cnt + 1}>
                        ➕ เพิ่มช่องใหม่ (#{cnt + 1})
                      </option>
                    );
                  }
                  return opts;
                })()}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLoadEntry(null)}
                  className="btn btn-md btn-secondary"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirmSlotNum > getSlotCount(confirmLoadEntry.mode)) {
                      setSlotCount(confirmLoadEntry.mode, confirmSlotNum);
                    }
                    void handleLoadEntryDirect(confirmLoadEntry, confirmSlotNum);
                  }}
                  className="btn btn-md btn-primary flex-1"
                >
                  ยืนยันโหลดใช้งาน
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
