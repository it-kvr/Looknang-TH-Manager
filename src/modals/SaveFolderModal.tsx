import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Folder,
  FolderInput,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import type { GameMode, GameState } from '../types/game';
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

  // Tab 2: External File / Save Code
  const [codeText, setCodeText] = useState('');
  const [codeFileName, setCodeFileName] = useState('');
  const [exportedCode, setExportedCode] = useState('');
  const singleFileRef = useRef<HTMLInputElement | null>(null);
  const parsedCode = useMemo(() => (codeText.trim() ? cleanImportJson(codeText) : null), [codeText]);
  const [codeTargetSlot, setCodeTargetSlot] = useState<number>(currentSlot || 1);

  const resolveAutoSlotFor = (mode: GameMode, preferredSlot?: number): { slot: number; needsConfirm: boolean } => {
    if (typeof slotChoice === 'number') {
      return { slot: slotChoice, needsConfirm: false };
    }
    if (currentState && currentState.mode === mode) {
      return { slot: currentSlot || 1, needsConfirm: false };
    }
    if (preferredSlot && preferredSlot >= 1 && preferredSlot <= NSL && !loadGameFromSlot(mode, preferredSlot)) {
      return { slot: preferredSlot, needsConfirm: false };
    }
    const empty = firstEmptySlot(mode);
    if (empty > 0) {
      return { slot: empty, needsConfirm: false };
    }
    return { slot: preferredSlot && preferredSlot >= 1 && preferredSlot <= NSL ? preferredSlot : 1, needsConfirm: true };
  };

  const refreshFolderSaves = async () => {
    setLoadingList(true);
    try {
      await migrateLocalSlotsToAutoFolderOnce(loadGameFromSlot, NSL);
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

  const filteredEntries = useMemo(
    () => (modeFilter === 'all' ? entries : entries.filter((e) => e.mode === modeFilter)),
    [entries, modeFilter]
  );

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
              คลังเซฟอัตโนมัติ ({GAME_AUTO_FOLDER_NAME})
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" className="btn-icon rounded-full!">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-3.5 pt-2.5 mland:px-2.5 mland:pt-1.5">
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
              <span className="truncate">โฟลเดอร์เซฟของเกม ({entries.length})</span>
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 mland:p-2.5 space-y-3 mland:space-y-2">
          {tab === 'folder' && (
            <div className="space-y-2.5 mland:space-y-2">
              {/* Auto Folder Info & Quick Save */}
              <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <span>📁 โฟลเดอร์เกม:</span>
                      <span className="font-mono text-[var(--g)] truncate">{GAME_AUTO_FOLDER_NAME}/</span>
                    </div>
                    <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)]">
                      ตัวเกมสร้างและจัดเก็บไฟล์เซฟในโฟลเดอร์นี้ให้อัตโนมัติ ไม่ต้องเลือกที่อยู่เอง
                      {opfsActive ? ' · พร้อมระบบไฟล์ในเครื่อง' : ''}
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
                    className="btn-icon w-7 h-7 rounded-lg shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {currentState && (
                  <div className="pt-1.5 border-t border-[var(--line)]/70 flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveCheckpoint();
                      }}
                      placeholder="โน้ตกำกับเซฟ (ไม่ใส่ก็ได้ เช่น ก่อนนัดชิง)"
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
                      <span>บันทึกไฟล์เซฟเลย</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Save List pulled automatically from folder */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
                  <div className="font-bold text-[var(--ink)]">
                    เลือกไฟล์ที่บันทึกไว้เพื่อโหลดใช้งาน ({filteredEntries.length})
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="inline-flex rounded-lg bg-[var(--surface-2)] p-0.5 border border-[var(--line)] text-[10px]">
                      {(
                        [
                          ['all', 'ทั้งหมด'],
                          ['m', 'ผู้จัดการ'],
                          ['p', 'นักเตะ']
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            setModeFilter(key);
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                            modeFilter === key
                              ? 'bg-[var(--g)] text-white'
                              : 'text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-1 text-[var(--mut)] shrink-0">
                      <span>ลงช่อง:</span>
                      <select
                        value={slotChoice}
                        onChange={(e) =>
                          setSlotChoice(e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                        }
                        className="px-1.5 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)]"
                      >
                        <option value="auto">อัตโนมัติ</option>
                        {Array.from({ length: NSL }, (_, i) => i + 1).map((k) => (
                          <option key={k} value={k}>
                            ช่อง #{k}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {loadingList ? (
                  <div className="p-5 rounded-xl border border-dashed border-[var(--line)] text-center text-xs text-[var(--mut)]">
                    กำลังดึงไฟล์เซฟจากโฟลเดอร์ {GAME_AUTO_FOLDER_NAME}...
                  </div>
                ) : filteredEntries.length ? (
                  <div className="space-y-1.5">
                    {filteredEntries.map((entry) => {
                      const modeLabel = entry.mode === 'm' ? '📋 ผู้จัดการ' : '⚽ นักเตะ';
                      const isConfirmDel = confirmDeleteId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className="p-2.5 mland:p-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 hover:border-[var(--g)]/55 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[9.5px] mland:text-[8.5px] font-bold shrink-0">
                                {modeLabel}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[9px] mland:text-[8px] font-bold shrink-0 ${
                                  entry.isAutoSave
                                    ? 'bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35'
                                    : 'bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)] border border-[var(--lamp)]/40'
                                }`}
                              >
                                {entry.isAutoSave ? 'อัตโนมัติ' : 'จุดเซฟ'}
                              </span>
                              <span className="font-bold text-xs mland:text-[10.5px] truncate text-[var(--ink)]">
                                {entry.label && !entry.isAutoSave
                                  ? `${entry.label} · ${entry.name}`
                                  : entry.name}
                              </span>
                            </div>
                            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate tabular">
                              ซีซัน {entry.season} · นัด {entry.md}
                              {entry.savedAt ? ` · ${fmtSavedTime(entry.savedAt)}` : ''}
                              {entry.size ? ` · ${fmtBytes(entry.size)}` : ''}
                            </div>
                            <div className="text-[9.5px] mland:text-[8px] text-[var(--mut)]/80 font-mono truncate">
                              {GAME_AUTO_FOLDER_NAME}/{entry.filename}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
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
                              className="btn-icon w-7 h-7 mland:w-6 mland:h-6 rounded-lg"
                            >
                              <Download className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
                            </button>

                            {entry.remove && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteEntry(entry)}
                                title={isConfirmDel ? 'แตะอีกครั้งเพื่อยืนยันลบ' : 'ลบไฟล์เซฟนี้'}
                                aria-label="ลบไฟล์เซฟนี้"
                                className={`h-7 mland:h-6 px-2 rounded-lg border text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center ${
                                  isConfirmDel
                                    ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]'
                                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)] hover:border-[var(--red)]/50'
                                }`}
                              >
                                {isConfirmDel ? 'ลบ?' : <Trash2 className="w-3.5 h-3.5 mland:w-3 mland:h-3" />}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handlePickLoadEntry(entry)}
                              className="btn btn-xs btn-primary shrink-0"
                            >
                              โหลดใช้งาน
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--line)] text-center text-xs mland:text-[10px] text-[var(--mut)]">
                    ยังไม่มีไฟล์เซฟในโฟลเดอร์ {GAME_AUTO_FOLDER_NAME}
                    {currentState
                      ? ' — กดปุ่ม "บันทึกไฟล์เซฟเลย" ด้านบนเพื่อสร้างไฟล์เซฟทันที'
                      : ' — เมื่อเริ่มเล่นเกม ตัวเกมจะสร้างไฟล์เซฟในโฟลเดอร์นี้ให้อัตโนมัติ'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: External File / Save Code (for device transfer) */}
          {tab === 'code' && (
            <div className="space-y-2.5 mland:space-y-2">
              {currentState && (
                <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs mland:text-[10.5px] font-bold">
                      📤 ส่งออกเกมปัจจุบันไปเครื่องอื่น
                    </span>
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
                  className="w-full p-2.5 rounded-xl border border-dashed border-[var(--g)]/60 bg-[var(--g-soft)]/50 hover:bg-[var(--g-soft)] cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Upload className="w-4 h-4 text-[var(--g)] shrink-0" />
                  <span className="truncate">
                    {codeFileName
                      ? `📄 ${codeFileName} (เปลี่ยนไฟล์)`
                      : '📂 นำเข้าไฟล์เซฟจากภายนอก (.json / .lk2 / .txt)'}
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
                        onClick={async () => {
                          SFX.win();
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
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Slot Sub-dialog only when all slots are full and user is in auto mode */}
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
                ช่องเซฟเต็มแล้ว — เลือกช่องที่จะเขียนทับ
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
