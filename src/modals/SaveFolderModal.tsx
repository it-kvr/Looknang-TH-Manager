import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import type { GameState } from '../types/game';
import { SFX } from '../utils/audioTheme';
import { firstEmptySlot, loadGameFromSlot, NSL } from '../engine/playerCore';
import {
  cleanImportJson,
  downloadRawSaveFile,
  downloadSaveFile,
  exportSaveCode,
  readSaveFileText
} from '../engine/saveCodec';
import {
  clearSavedOsDirectory,
  createVaultFolder,
  deleteVaultFolder,
  ensureDirectoryPermission,
  getSavedOsDirectory,
  isInCrossOriginFrame,
  isOsDirectoryPickerSupported,
  listOsDirectorySaves,
  listVaultFolders,
  listVaultFolderSaves,
  parseFolderSaveEntry,
  pickOsSaveDirectory,
  readFileListAsSaveEntries,
  saveGameToOsDirectory,
  saveGameToVaultFolder,
  type CustomVaultFolder,
  type FolderSaveEntry
} from '../engine/saveFolder';
import { isMobileDevice } from '../utils/fullscreen';

type FolderTab = 'os' | 'vault' | 'code';

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
  initialTab,
  onSaveCurrentSlot,
  onLoadSave,
  onClose,
  onToast
}) => {
  const osSupported = isOsDirectoryPickerSupported() && !isInCrossOriginFrame();
  const [tab, setTab] = useState<FolderTab>(() => initialTab || (osSupported ? 'os' : 'vault'));

  // Slot selector for loading ('auto' picks empty slot or current slot)
  const [slotChoice, setSlotChoice] = useState<'auto' | number>('auto');
  const [confirmLoadEntry, setConfirmLoadEntry] = useState<FolderSaveEntry | null>(null);
  const [confirmSlotNum, setConfirmSlotNum] = useState<number>(1);
  const [saveLabel, setSaveLabel] = useState('');
  const [busy, setBusy] = useState(false);

  // Tab 1: OS Real Folder & Multi-file picker
  const [osDir, setOsDir] = useState<{
    handle: Awaited<ReturnType<typeof getSavedOsDirectory>> extends infer R
      ? R extends { handle: infer H }
        ? H
        : never
      : never;
    name: string;
  } | null>(null);
  const [osNeedsPerm, setOsNeedsPerm] = useState(false);
  const [osEntries, setOsEntries] = useState<FolderSaveEntry[]>([]);
  const [osNotice, setOsNotice] = useState<string>('');
  const [pickedFilesLabel, setPickedFilesLabel] = useState('');
  const multiFileRef = useRef<HTMLInputElement | null>(null);
  const webkitDirRef = useRef<HTMLInputElement | null>(null);

  // Tab 2: In-App Custom Named Vault Folders (IndexedDB)
  const [vaultFolders, setVaultFolders] = useState<CustomVaultFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [vaultEntries, setVaultEntries] = useState<FolderSaveEntry[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmDelFolder, setConfirmDelFolder] = useState(false);

  // Tab 3: Save Code / Single Text Paste
  const [codeText, setCodeText] = useState('');
  const [codeFileName, setCodeFileName] = useState('');
  const [exportedCode, setExportedCode] = useState('');
  const singleFileRef = useRef<HTMLInputElement | null>(null);
  const parsedCode = useMemo(() => (codeText.trim() ? cleanImportJson(codeText) : null), [codeText]);
  const [codeTargetSlot, setCodeTargetSlot] = useState<number>(currentSlot || 1);

  const resolveDefaultSlotFor = (mode: 'm' | 'p'): number => {
    if (typeof slotChoice === 'number') return slotChoice;
    if (currentState && currentState.mode === mode) return currentSlot || 1;
    return firstEmptySlot(mode) || 1;
  };

  const refreshOsDirEntries = async (
    dir: NonNullable<typeof osDir>,
    askPermission = false
  ) => {
    setBusy(true);
    try {
      const ok = await ensureDirectoryPermission(dir.handle, 'readwrite', askPermission);
      if (!ok) {
        const readOk = await ensureDirectoryPermission(dir.handle, 'read', askPermission);
        if (!readOk) {
          setOsNeedsPerm(true);
          setOsEntries([]);
          return;
        }
      }
      setOsNeedsPerm(false);
      const list = await listOsDirectorySaves(dir.handle);
      setOsEntries(list);
      setPickedFilesLabel('');
      setOsNotice('');
    } catch {
      setOsNotice('ไม่สามารถอ่านไฟล์ในโฟลเดอร์ได้ กรุณาลองเลือกโฟลเดอร์ใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  const refreshVault = async (preferFolderId?: string) => {
    try {
      let folders = await listVaultFolders();
      if (!folders.length) {
        const def = await createVaultFolder('โฟลเดอร์ส่วนตัว');
        folders = [def];
      }
      setVaultFolders(folders);
      const targetId =
        preferFolderId && folders.some((f) => f.id === preferFolderId)
          ? preferFolderId
          : selectedFolderId && folders.some((f) => f.id === selectedFolderId)
            ? selectedFolderId
            : folders[0].id;
      setSelectedFolderId(targetId);
      const saves = await listVaultFolderSaves(targetId);
      setVaultEntries(saves);
    } catch {
      onToast('❌ ไม่สามารถเปิดคลังโฟลเดอร์ในเครื่องได้');
    }
  };

  useEffect(() => {
    void (async () => {
      const saved = await getSavedOsDirectory();
      if (saved) {
        setOsDir(saved);
        await refreshOsDirEntries(saved, false);
      }
      await refreshVault();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedFolderId) return;
    setConfirmDelFolder(false);
    void listVaultFolderSaves(selectedFolderId).then(setVaultEntries).catch(() => undefined);
  }, [selectedFolderId]);

  const handlePickOsDirectory = async () => {
    SFX.tap();
    setBusy(true);
    try {
      const res = await pickOsSaveDirectory();
      if (res.ok) {
        const dir = { handle: res.handle, name: res.name };
        setOsDir(dir);
        setOsNotice('');
        await refreshOsDirEntries(dir, true);
        onToast(`📁 ผูกโฟลเดอร์ "${res.name}" เรียบร้อยแล้ว`);
      } else if (res.reason !== 'cancelled') {
        setOsNotice(res.message);
        onToast(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveToOsDirectory = async () => {
    if (!currentState) return;
    SFX.tap();
    onSaveCurrentSlot?.();
    let dir = osDir;
    if (!dir) {
      const res = await pickOsSaveDirectory();
      if (!res.ok) {
        if (res.reason !== 'cancelled') {
          setOsNotice(res.message);
          onToast(res.message);
        }
        return;
      }
      dir = { handle: res.handle, name: res.name };
      setOsDir(dir);
    }
    setBusy(true);
    try {
      const perm = await ensureDirectoryPermission(dir.handle, 'readwrite', true);
      if (!perm) {
        setOsNeedsPerm(true);
        onToast('⚠️ กรุณากดอนุญาตสิทธิ์เขียนไฟล์ลงโฟลเดอร์ก่อน');
        return;
      }
      const { filename } = await saveGameToOsDirectory(dir.handle, currentState, saveLabel);
      setSaveLabel('');
      await refreshOsDirEntries(dir, false);
      SFX.win();
      onToast(`💾 บันทึก "${filename}" ลงโฟลเดอร์ "${dir.name}" แล้ว`);
    } catch {
      onToast('❌ บันทึกลงโฟลเดอร์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handlePickMultipleFiles = async (files: FileList | null, sourceLabel: string) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const entries = await readFileListAsSaveEntries(files);
      setOsEntries(entries);
      setPickedFilesLabel(`${sourceLabel} (${entries.length} ไฟล์)`);
      if (entries.length) {
        SFX.tap();
        setOsNotice('');
      } else {
        setOsNotice('ไม่พบไฟล์เซฟเกมลูกหนังไทยในรายการที่เลือก');
        onToast('❌ ไม่พบไฟล์เซฟที่ถูกต้องในสิ่งที่เลือก');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateVaultFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      onToast('กรุณาตั้งชื่อโฟลเดอร์');
      return;
    }
    SFX.tap();
    const created = await createVaultFolder(trimmed);
    setNewFolderName('');
    await refreshVault(created.id);
    onToast(`🗂️ สร้างโฟลเดอร์ "${created.name}" แล้ว`);
  };

  const handleSaveToVault = async () => {
    if (!currentState || !selectedFolderId) return;
    SFX.win();
    onSaveCurrentSlot?.();
    setBusy(true);
    try {
      const created = await saveGameToVaultFolder(selectedFolderId, currentState, saveLabel);
      setSaveLabel('');
      const saves = await listVaultFolderSaves(selectedFolderId);
      setVaultEntries(saves);
      const curFolder = vaultFolders.find((f) => f.id === selectedFolderId);
      onToast(`💾 บันทึก "${created.label || created.name}" ลงโฟลเดอร์ "${curFolder?.name || 'ส่วนตัว'}" แล้ว`);
    } catch {
      onToast('❌ บันทึกเข้าโฟลเดอร์ไม่สำเร็จ');
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

  const renderEntryRow = (entry: FolderSaveEntry) => {
    const modeLabel = entry.mode === 'm' ? '📋 ผู้จัดการ' : '⚽ นักเตะ';
    return (
      <div
        key={entry.id}
        className="p-2.5 mland:p-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 hover:border-[var(--g)]/55 transition-colors flex items-center justify-between gap-2"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[9.5px] mland:text-[8.5px] font-bold shrink-0">
              {modeLabel}
            </span>
            <span className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">
              {entry.label ? `${entry.label} · ${entry.name}` : entry.name}
            </span>
          </div>
          <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
            ซีซัน {entry.season} · นัด {entry.md}
            {entry.savedAt ? ` · ${fmtSavedTime(entry.savedAt)}` : ''}
            {entry.size ? ` · ${fmtBytes(entry.size)}` : ''}
          </div>
          <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]/80 font-mono truncate">
            {entry.filename}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {entry.source === 'vault' && (
            <button
              type="button"
              onClick={async () => {
                SFX.tap();
                const raw = await entry.readRaw();
                downloadRawSaveFile(entry.filename, raw);
                onToast(`💾 ดาวน์โหลด "${entry.filename}" ลงเครื่องแล้ว`);
              }}
              title="ส่งออกเป็นไฟล์ลงเครื่อง"
              aria-label="ส่งออกเป็นไฟล์ลงเครื่อง"
              className="btn-icon w-7 h-7 mland:w-6 mland:h-6 rounded-lg"
            >
              <Download className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
            </button>
          )}

          {entry.remove && (
            <button
              type="button"
              onClick={async () => {
                SFX.tap();
                await entry.remove?.();
                if (entry.source === 'os' && osDir) {
                  await refreshOsDirEntries(osDir, false);
                } else if (entry.source === 'vault') {
                  const saves = await listVaultFolderSaves(selectedFolderId);
                  setVaultEntries(saves);
                }
                onToast('🗑️ ลบไฟล์เซฟที่เลือกแล้ว');
              }}
              title="ลบไฟล์เซฟนี้"
              aria-label="ลบไฟล์เซฟนี้"
              className="btn-icon w-7 h-7 mland:w-6 mland:h-6 rounded-lg hover:text-[var(--red)] hover:border-[var(--red)]/50"
            >
              <Trash2 className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              SFX.tap();
              if (typeof slotChoice === 'number') {
                void handleLoadEntryDirect(entry, slotChoice);
              } else {
                setConfirmSlotNum(resolveDefaultSlotFor(entry.mode));
                setConfirmLoadEntry(entry);
              }
            }}
            className="btn btn-xs btn-primary shrink-0"
          >
            โหลดเข้าเล่น
          </button>
        </div>
      </div>
    );
  };

  const activeVaultFolder = vaultFolders.find((f) => f.id === selectedFolderId) || null;

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/72 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[calc(var(--app-dvh,1dvh)*94)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-4 h-4 text-[var(--g)] shrink-0" />
            <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display truncate">
              ที่เก็บเซฟ &amp; โฟลเดอร์ส่วนตัว
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" className="btn-icon rounded-full!">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-3.5 pt-2.5 mland:px-2.5 mland:pt-1.5">
          <div className="seg-bar grid grid-cols-3 w-full bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('os'); }}
              className={`seg-btn flex items-center justify-center gap-1 ${tab === 'os' ? 'seg-btn-active' : 'hover:bg-[var(--surface)]'}`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">โฟลเดอร์เครื่อง</span>
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('vault'); }}
              className={`seg-btn flex items-center justify-center gap-1 ${tab === 'vault' ? 'seg-btn-active' : 'hover:bg-[var(--surface)]'}`}
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">โฟลเดอร์ในแอป</span>
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('code'); }}
              className={`seg-btn flex items-center justify-center gap-1 ${tab === 'code' ? 'seg-btn-active' : 'hover:bg-[var(--surface)]'}`}
            >
              <FolderInput className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">ไฟล์เดี่ยว / โค้ด</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-3 mland:space-y-2">
          {/* Tab 1: Real OS Directory + Multi-file Picker */}
          {tab === 'os' && (
            <div className="space-y-2.5 mland:space-y-2">
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                      {osDir ? `📁 ที่อยู่ที่เลือกไว้: ${osDir.name}` : '📁 เลือกหรือสร้างโฟลเดอร์บนเครื่อง'}
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                      {osDir
                        ? 'บันทึกและสแกนไฟล์เซฟจากโฟลเดอร์นี้ได้โดยตรง พร้อมเลือกไฟล์ที่จะโหลดเข้าเล่น'
                        : 'ผูกโฟลเดอร์บนเครื่องเพื่อเซฟไฟล์ลงโฟลเดอร์นั้นโดยตรง และเปิดเลือกโหลดได้ทุกครั้ง'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {osSupported && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePickOsDirectory()}
                        className="btn btn-xs btn-primary"
                      >
                        <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>{osDir ? 'เปลี่ยนโฟลเดอร์' : 'เลือก / สร้างโฟลเดอร์'}</span>
                      </button>
                    )}
                    {osDir && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => osDir && void refreshOsDirEntries(osDir, true)}
                          title="รีเฟรชรายการไฟล์ในโฟลเดอร์"
                          aria-label="รีเฟรชรายการไฟล์ในโฟลเดอร์"
                          className="btn-icon w-7 h-7 rounded-lg"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await clearSavedOsDirectory();
                            setOsDir(null);
                            setOsEntries([]);
                            setOsNeedsPerm(false);
                            onToast('ยกเลิกการผูกโฟลเดอร์แล้ว');
                          }}
                          className="btn btn-xs btn-secondary"
                        >
                          ยกเลิกผูก
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {osDir && osNeedsPerm && (
                  <button
                    type="button"
                    onClick={() => osDir && void refreshOsDirEntries(osDir, true)}
                    className="w-full btn btn-sm btn-gold"
                  >
                    🔓 กดอนุญาตเข้าถึงโฟลเดอร์ &quot;{osDir.name}&quot; อีกครั้ง
                  </button>
                )}

                {currentState && (
                  <div className="pt-1 border-t border-[var(--line)]/70 flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      placeholder="โน้ตกำกับเซฟ (ไม่ใส่ก็ได้ เช่น ก่อนนัดชิง)"
                      maxLength={32}
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
                    />
                    {osSupported ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveToOsDirectory()}
                        className="btn btn-sm btn-primary shrink-0"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{osDir ? `บันทึกลง "${osDir.name}"` : 'เลือกโฟลเดอร์ & บันทึก'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          SFX.win();
                          onSaveCurrentSlot?.();
                          const { filename } = downloadSaveFile(currentState, saveLabel);
                          setSaveLabel('');
                          onToast(`💾 ดาวน์โหลดไฟล์ "${filename}" ลงเครื่องแล้ว`);
                        }}
                        className="btn btn-sm btn-primary shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>ดาวน์โหลดไฟล์ลงเครื่อง</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Universal fallback multi-file & directory input for mobile / iframe */}
                <input
                  ref={multiFileRef}
                  type="file"
                  multiple
                  accept=".json,.lk2,.txt,application/json,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    void handlePickMultipleFiles(files, 'ไฟล์ที่เลือกจากเครื่อง');
                    e.currentTarget.value = '';
                  }}
                />
                <input
                  ref={(el) => {
                    webkitDirRef.current = el;
                    if (el) {
                      (el as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
                    }
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    void handlePickMultipleFiles(files, 'โฟลเดอร์ที่เลือก');
                    e.currentTarget.value = '';
                  }}
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--line)]/60">
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      multiFileRef.current?.click();
                    }}
                    className="btn btn-xs btn-secondary flex-1 min-w-[160px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                    <span>เลือกหลายไฟล์จากโฟลเดอร์ในเครื่อง</span>
                  </button>
                  {!isMobileDevice() && (
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        webkitDirRef.current?.click();
                      }}
                      className="btn btn-xs btn-secondary shrink-0"
                    >
                      <Folder className="w-3.5 h-3.5 text-[var(--g)] shrink-0" />
                      <span>สแกนทั้งโฟลเดอร์</span>
                    </button>
                  )}
                </div>

                {!osSupported && (
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug">
                    💡 มือถือหรือหน้าต่างตัวอย่างอาจจำกัดการเขียนโฟลเดอร์ระบบโดยตรง คุณสามารถเลือกหลายไฟล์จากเครื่องด้านบน หรือใช้แท็บ <b className="text-[var(--ink)]">&quot;โฟลเดอร์ในแอป&quot;</b> เพื่อสร้างโฟลเดอร์ตั้งชื่อเองและเลือกเซฟโหลดได้ทันทีทุกอุปกรณ์
                  </div>
                )}

                {osNotice && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/55 text-[10.5px] mland:text-[9px] font-semibold text-[var(--ink)]">
                    {osNotice}
                  </div>
                )}
              </div>

              {/* Save List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                  <span className="font-bold text-[var(--ink)] truncate">
                    {pickedFilesLabel
                      ? `📄 ${pickedFilesLabel}`
                      : osDir
                        ? `รายการเซฟใน "${osDir.name}" (${osEntries.length} ไฟล์)`
                        : `รายการเซฟที่เปิดดู (${osEntries.length})`}
                  </span>
                  <label className="flex items-center gap-1 text-[var(--mut)] shrink-0">
                    <span>โหลดเข้าช่อง:</span>
                    <select
                      value={slotChoice}
                      onChange={(e) => setSlotChoice(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                      className="px-1.5 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)]"
                    >
                      <option value="auto">ถามก่อนโหลด</option>
                      {Array.from({ length: NSL }, (_, i) => i + 1).map((k) => (
                        <option key={k} value={k}>ช่อง #{k}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {osEntries.length ? (
                  <div className="space-y-1.5">{osEntries.map(renderEntryRow)}</div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--line)] text-center text-xs mland:text-[10px] text-[var(--mut)]">
                    {osDir
                      ? 'ยังไม่มีไฟล์เซฟลูกหนังไทยในโฟลเดอร์นี้'
                      : 'เลือกโฟลเดอร์หรือเลือกไฟล์จากเครื่องเพื่อแสดงรายการเซฟที่มีอยู่'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Custom Named In-App Folders (IndexedDB - works everywhere) */}
          {tab === 'vault' && (
            <div className="space-y-2.5 mland:space-y-2">
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)]">
                    🗂️ สร้างโฟลเดอร์ตั้งชื่อเอง (เก็บถาวรในเครื่องทุกอุปกรณ์)
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreateVaultFolder();
                    }}
                    placeholder="ตั้งชื่อโฟลเดอร์ใหม่ เช่น เซฟแชมป์ลีก, ก่อนซื้อขาย..."
                    maxLength={40}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
                  />
                  <button type="button" onClick={() => void handleCreateVaultFolder()} className="btn btn-sm btn-primary shrink-0">
                    <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>สร้างโฟลเดอร์</span>
                  </button>
                </div>

                {/* Folder selector bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {vaultFolders.map((f) => {
                    const active = f.id === selectedFolderId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          setSelectedFolderId(f.id);
                        }}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] mland:text-[9.5px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          active
                            ? 'bg-[var(--g)] text-white border-[var(--g)]'
                            : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--g)]/55'
                        }`}
                      >
                        <Folder className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[140px]">{f.name}</span>
                      </button>
                    );
                  })}
                  {activeVaultFolder && vaultFolders.length > 1 && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirmDelFolder) {
                          setConfirmDelFolder(true);
                          window.setTimeout(() => setConfirmDelFolder(false), 3000);
                          return;
                        }
                        await deleteVaultFolder(activeVaultFolder.id);
                        setConfirmDelFolder(false);
                        await refreshVault();
                        onToast(`🗑️ ลบโฟลเดอร์ "${activeVaultFolder.name}" แล้ว`);
                      }}
                      className={`px-2 py-1 rounded-xl border text-[10px] font-bold cursor-pointer ${
                        confirmDelFolder
                          ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--red)]'
                      }`}
                    >
                      {confirmDelFolder ? 'ยืนยันลบโฟลเดอร์?' : 'ลบโฟลเดอร์นี้'}
                    </button>
                  )}
                </div>

                {currentState && activeVaultFolder && (
                  <div className="pt-1.5 border-t border-[var(--line)]/70 flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      placeholder={`โน้ตกำกับใน "${activeVaultFolder.name}" (ไม่ใส่ก็ได้)`}
                      maxLength={32}
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveToVault()}
                      className="btn btn-sm btn-gold shrink-0"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span>บันทึกเข้า &quot;{activeVaultFolder.name}&quot;</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                  <span className="font-bold text-[var(--ink)] truncate">
                    เซฟในโฟลเดอร์ &quot;{activeVaultFolder?.name || 'ส่วนตัว'}&quot; ({vaultEntries.length} รายการ)
                  </span>
                  <label className="flex items-center gap-1 text-[var(--mut)] shrink-0">
                    <span>โหลดเข้าช่อง:</span>
                    <select
                      value={slotChoice}
                      onChange={(e) => setSlotChoice(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                      className="px-1.5 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)]"
                    >
                      <option value="auto">ถามก่อนโหลด</option>
                      {Array.from({ length: NSL }, (_, i) => i + 1).map((k) => (
                        <option key={k} value={k}>ช่อง #{k}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {vaultEntries.length ? (
                  <div className="space-y-1.5">{vaultEntries.map(renderEntryRow)}</div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--line)] text-center text-xs mland:text-[10px] text-[var(--mut)]">
                    ยังไม่มีเซฟในโฟลเดอร์นี้ {currentState ? '— กดปุ่มบันทึกด้านบนเพื่อเก็บจุดเซฟไว้เลือกโหลดได้ตลอดเวลา' : '— เข้าเกมแล้วเปิดตั้งค่าเพื่อบันทึกลงโฟลเดอร์นี้ได้'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Single File / Code */}
          {tab === 'code' && (
            <div className="space-y-2.5 mland:space-y-2">
              {currentState && (
                <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs mland:text-[10.5px] font-bold">📤 ส่งออกเกมปัจจุบัน</span>
                    <div className="flex items-center gap-1.5">
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
                      className="w-full p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono"
                    />
                  )}
                </div>
              )}

              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
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
                        setCodeTargetSlot(resolveDefaultSlotFor(p.mode));
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
                  className="w-full p-2.5 rounded-xl border border-dashed border-[var(--g)]/60 bg-[var(--g-soft)]/50 hover:bg-[var(--g-soft)] cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Upload className="w-4 h-4 text-[var(--g)] shrink-0" />
                  <span className="truncate">
                    {codeFileName ? `📄 ${codeFileName} (เปลี่ยนไฟล์)` : '📂 เลือกไฟล์เซฟจากเครื่อง (.json / .lk2 / .txt)'}
                  </span>
                </button>

                <textarea
                  value={codeText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCodeFileName('');
                    setCodeText(val);
                    const p = val.trim() ? cleanImportJson(val) : null;
                    if (p) setCodeTargetSlot(resolveDefaultSlotFor(p.mode));
                  }}
                  placeholder="หรือวางโค้ดเซฟ LK2: / JSON ที่นี่..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-mono"
                />

                {codeText.trim() && !parsedCode && (
                  <div className="text-[11px] text-[var(--red)] font-semibold">
                    ❌ ข้อมูลไฟล์หรือโค้ดเซฟไม่ถูกต้อง
                  </div>
                )}

                {parsedCode && (
                  <div className="p-2.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/45 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="truncate">
                        {parsedCode.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} ·{' '}
                        {parsedCode.mode === 'm'
                          ? parsedCode.club?.name || parsedCode.teams[parsedCode.me]?.name
                          : parsedCode.p?.name}
                      </span>
                      <span className="text-[10.5px] text-[var(--g)] tabular shrink-0">
                        ซีซัน {parsedCode.season} · นัด {parsedCode.md}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={codeTargetSlot}
                        onChange={(e) => setCodeTargetSlot(Number(e.target.value))}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-semibold"
                      >
                        {Array.from({ length: NSL }, (_, idx) => idx + 1).map((k) => {
                          const existing = loadGameFromSlot(parsedCode.mode, k);
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
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          SFX.win();
                          onLoadSave(parsedCode, codeTargetSlot);
                          onClose();
                        }}
                        className="btn btn-sm btn-primary shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>โหลดเข้าเล่น</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Slot Sub-dialog when user picks a save from folder */}
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
                เลือกช่องสล็อตที่จะโหลดเซฟนี้เข้ามา
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs space-y-0.5">
                <div className="font-bold truncate">
                  {confirmLoadEntry.mode === 'm' ? '📋' : '⚽'} {confirmLoadEntry.label ? `${confirmLoadEntry.label} · ` : ''}
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
                {Array.from({ length: NSL }, (_, idx) => idx + 1).map((k) => {
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
                })}
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
                  onClick={() => void handleLoadEntryDirect(confirmLoadEntry, confirmSlotNum)}
                  className="btn btn-md btn-primary flex-1"
                >
                  ยืนยันโหลดเข้าเล่น
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
