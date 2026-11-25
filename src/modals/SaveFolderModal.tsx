import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
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
import type { GameMode, GameState, PlayerCareerProfile, Team } from '../types/game';
import { TN } from '../data/thaiFootballData';
import { ovColor } from '../engine/missions';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
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
  extractSaveVisualPreview,
  readSaveFileText,
  type SaveVisualPreview
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

const buildStubTeam = (preview?: SaveVisualPreview | null): Team | null => {
  if (!preview?.team) return null;
  return {
    id: preview.team.id,
    name: preview.team.name,
    tier: preview.team.tier,
    kc: preview.team.kc,
    sq: [],
    form: '4-4-2',
    tac: 'B',
    pts: 0,
    gf: 0,
    ga: 0,
    w: 0,
    d: 0,
    l: 0,
    p: 0
  };
};

const SaveVisualDock: React.FC<{
  mode: GameMode;
  name: string;
  preview?: SaveVisualPreview | null;
  isPinned?: boolean;
  compact?: boolean;
}> = ({ mode, name, preview, isPinned = false, compact = false }) => {
  const isMgr = mode === 'm';
  const teamObj = buildStubTeam(preview);
  const clubName = preview?.teamName || name;
  const primaryCol = preview?.club?.c1 || preview?.team?.kc?.[0] || (isMgr ? '#d97706' : '#158049');
  const boxCls = compact
    ? 'w-9 h-9 mland:w-8 mland:h-8 rounded-lg'
    : 'w-11 h-11 sm:w-12 sm:h-12 mland:w-9 mland:h-9 rounded-xl mland:rounded-lg';

  return (
    <div className="relative flex items-center gap-1 shrink-0">
      {/* Club Logo */}
      <div
        className={`${boxCls} border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center overflow-hidden shadow-2xs`}
        style={{
          backgroundImage: `radial-gradient(circle at 50% 25%, ${primaryCol}22, transparent 78%)`
        }}
        title={clubName}
      >
        {preview?.team || preview?.club ? (
          <div className={compact ? '[&>svg]:w-6 [&>svg]:h-6' : '[&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 mland:[&>svg]:w-6 mland:[&>svg]:h-6'}>
            <ClubCrest
              name={clubName}
              size={compact ? 24 : 32}
              team={teamObj}
              club={preview?.club || null}
              isMyClub={isMgr}
            />
          </div>
        ) : (
          <span className="text-base mland:text-xs leading-none">{isMgr ? '🛡️' : '🏟️'}</span>
        )}
      </div>

      {/* Player Avatar */}
      <div
        className={`${boxCls} border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center overflow-hidden shadow-2xs`}
        style={{
          backgroundImage: `linear-gradient(180deg, ${primaryCol}18 0%, transparent 75%)`
        }}
        title={preview?.player?.n || name}
      >
        {preview?.player || preview?.careerProfile ? (
          <div className={compact ? '[&>svg]:w-8 [&>svg]:h-8' : '[&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-11 sm:[&>svg]:h-11 mland:[&>svg]:w-8 mland:[&>svg]:h-8 flex items-end justify-center'}>
            <PlayerFace
              player={preview?.player || { n: name, pos: 'FW', ro: 'ST' }}
              team={teamObj}
              club={preview?.club || null}
              isMyClub={isMgr}
              careerProfile={(preview?.careerProfile as PlayerCareerProfile | null) || null}
              size={compact ? 32 : 42}
              bare
            />
          </div>
        ) : (
          <span className="text-base mland:text-xs leading-none">{isMgr ? '📋' : '⚽'}</span>
        )}
      </div>

      {isPinned && (
        <span
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--lamp)] text-[#261900] border border-white/60 flex items-center justify-center shadow-xs"
          title="ปักหมุดไว้บนสุด"
        >
          <Pin className="w-2.5 h-2.5 fill-current" />
        </span>
      )}
    </div>
  );
};

const SaveOvrBadge: React.FC<{
  mode: GameMode;
  preview?: SaveVisualPreview | null;
  compact?: boolean;
}> = ({ mode, preview, compact = false }) => {
  if (!preview || !preview.maxOvr) return null;
  const ov = mode === 'm' ? preview.maxOvr : preview.player?.ov || preview.maxOvr;
  const col = ovColor(ov);
  const peak = preview.peakOvr && preview.peakOvr > ov ? preview.peakOvr : null;

  return (
    <div
      className={`shrink-0 flex flex-col items-center justify-center rounded-xl mland:rounded-lg border text-white shadow-xs tabular ${
        compact
          ? 'min-w-[44px] px-1.5 py-1'
          : 'min-w-[54px] sm:min-w-[60px] mland:min-w-[48px] px-2 py-1 mland:px-1.5 mland:py-0.5'
      }`}
      style={{
        backgroundColor: col,
        borderColor: 'rgba(255,255,255,0.28)'
      }}
      title={
        mode === 'm'
          ? `ค่าพลังสูงสุดในทีม ${ov}${preview.squadAvg ? ` · เฉลี่ยทีม ${preview.squadAvg}` : ''}`
          : `ค่าพลังปัจจุบัน ${ov}${peak ? ` · สูงสุด ${peak}` : ''}`
      }
    >
      <span className="text-[8px] mland:text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none">
        {mode === 'm' ? 'พลังสูงสุด' : 'ค่าพลัง'}
      </span>
      <span
        className={`font-display font-extrabold leading-tight ${
          compact ? 'text-sm' : 'text-base sm:text-lg mland:text-sm'
        }`}
      >
        {ov}
      </span>
      {mode === 'p' && peak && (
        <span className="text-[8px] mland:text-[7px] font-bold opacity-90 leading-none">
          สูงสุด {peak}
        </span>
      )}
      {mode === 'm' && preview.squadAvg ? (
        <span className="text-[8px] mland:text-[7px] font-bold opacity-90 leading-none">
          ทีม {preview.squadAvg}
        </span>
      ) : null}
    </div>
  );
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
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<FolderSaveEntry | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
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

  const currentPreview = useMemo(
    () => (currentState ? extractSaveVisualPreview(currentState) : null),
    [currentState]
  );
  const parsedCodePreview = useMemo(
    () => (parsedCode ? extractSaveVisualPreview(parsedCode) : null),
    [parsedCode]
  );

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

  const executeSaveCheckpoint = async () => {
    if (!currentState) return;
    SFX.tap();
    onSaveCurrentSlot?.();
    setBusy(true);
    try {
      const saved = await saveGameToAutoFolder(currentState, {
        label: saveLabel.trim() || undefined
      });
      setSaveLabel('');
      setConfirmSaveOpen(false);
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

  const executeDeleteEntry = async (entry: FolderSaveEntry) => {
    SFX.tap();
    setBusy(true);
    try {
      await entry.remove?.();
      setConfirmDeleteEntry(null);
      await refreshFolderSaves();
      onToast(`🗑️ ลบไฟล์ "${entry.filename}" แล้ว`);
    } catch {
      onToast('❌ ลบไฟล์เซฟไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
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

  const groupedSections = useMemo(() => {
    const mList = filteredEntries.filter((e) => e.mode === 'm');
    const pList = filteredEntries.filter((e) => e.mode === 'p');
    const groups: Array<{ mode: GameMode; title: string; icon: string; list: FolderSaveEntry[] }> = [];
    if (modeFilter === 'all') {
      if (mList.length) groups.push({ mode: 'm', title: 'โหมดผู้จัดการทีม', icon: '📋', list: mList });
      if (pList.length) groups.push({ mode: 'p', title: 'โหมดนักเตะอาชีพ', icon: '⚽', list: pList });
    } else if (modeFilter === 'm' && mList.length) {
      groups.push({ mode: 'm', title: 'โหมดผู้จัดการทีม', icon: '📋', list: mList });
    } else if (modeFilter === 'p' && pList.length) {
      groups.push({ mode: 'p', title: 'โหมดนักเตะอาชีพ', icon: '⚽', list: pList });
    }
    return groups;
  }, [filteredEntries, modeFilter]);

  const maxChoiceSlots = useMemo(
    () => Math.max(getSlotCount('m'), getSlotCount('p')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, currentState]
  );

  const renderSaveCard = (entry: FolderSaveEntry) => {
    const isMgr = entry.mode === 'm';
    const alreadyInGame = isEntryAlreadyInGame(entry);
    const isPinned = pinnedFolderSet.has(entry.filename);
    const pv = entry.preview;
    const tierLabel = pv && typeof pv.tier === 'number' && TN[pv.tier] ? TN[pv.tier] : '';

    return (
      <div
        key={entry.id}
        className={`group p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mland:gap-2 ${
          isPinned
            ? 'border-[var(--lamp)]/70 bg-[var(--lamp-soft)]/20 hover:bg-[var(--surface)] shadow-2xs'
            : alreadyInGame
              ? 'border-[var(--g)]/45 bg-[var(--surface)] shadow-2xs'
              : 'border-[var(--line)] bg-[var(--surface-2)]/55 hover:bg-[var(--surface)] hover:border-[var(--g)]/55 hover:shadow-xs'
        }`}
      >
        {/* Top/Left Content: Logo + Player + Details + Max OVR */}
        <div className="flex items-center gap-2.5 mland:gap-2 min-w-0 flex-1">
          <SaveVisualDock
            mode={entry.mode}
            name={entry.name}
            preview={pv}
            isPinned={isPinned}
          />

          <div className="min-w-0 flex-1 space-y-0.5">
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
                className={`px-1.5 py-0.5 rounded-md text-[9.5px] mland:text-[8px] font-bold shrink-0 border ${
                  entry.isAutoSave
                    ? 'bg-[var(--surface)] text-[var(--mut)] border-[var(--line)]'
                    : 'bg-[var(--lamp-soft)]/70 text-[#9a6700] dark:text-[var(--lamp)] border-[var(--lamp)]/40'
                }`}
              >
                {entry.isAutoSave ? 'สำรอง' : 'จุดเซฟ'}
              </span>
            </div>

            {/* Player & Club Line */}
            {pv && (
              <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[10.5px] mland:text-[8.5px] font-semibold text-[var(--ink)]/85 truncate">
                {isMgr ? (
                  <>
                    {pv.player ? (
                      <span className="truncate">
                        ⭐ {pv.player.n}{' '}
                        <span className="text-[var(--mut)] font-bold">({pv.player.ro})</span>
                      </span>
                    ) : null}
                    {tierLabel && (
                      <>
                        {pv.player && <span className="opacity-40">·</span>}
                        <span className="text-[var(--mut)] truncate">{tierLabel}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="truncate">🛡️ {pv.teamName}</span>
                    {pv.player && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="text-[var(--g)] font-bold">{pv.player.ro}</span>
                      </>
                    )}
                    {tierLabel && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="text-[var(--mut)] truncate">{tierLabel}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Season & Time Meta */}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] mland:text-[8px] text-[var(--mut)] tabular">
              <span className="font-bold text-[var(--ink)]/80">
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
          </div>

          {/* Max OVR Badge (always visible beside info on mobile & desktop) */}
          <SaveOvrBadge mode={entry.mode} preview={pv} />
        </div>

        {/* Actions Bar — spacious, clear buttons with confirmation */}
        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-[var(--line)]/55 sm:pt-0 sm:border-t-0 shrink-0">
          <button
            type="button"
            onClick={() => handleTogglePinEntry(entry)}
            title={isPinned ? 'เลิกปักหมุด' : 'ปักหมุดเซฟนี้ไว้บนสุด'}
            aria-label={isPinned ? 'เลิกปักหมุด' : 'ปักหมุดเซฟนี้ไว้บนสุด'}
            className={`w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isPinned
                ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[#8a5b00] hover:border-[var(--lamp)]/60'
            }`}
          >
            <Pin className={`w-4 h-4 mland:w-3.5 mland:h-3.5 ${isPinned ? 'fill-current' : ''}`} />
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
            className="btn-icon w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg"
          >
            <Download className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>

          {entry.remove && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                SFX.tap();
                setConfirmDeleteEntry(entry);
              }}
              title="ลบไฟล์เซฟนี้"
              aria-label="ลบไฟล์เซฟนี้"
              className="h-9 mland:h-7 px-3 mland:px-2 rounded-xl mland:rounded-lg border border-[var(--red)]/35 bg-[var(--surface)] text-[var(--red)] hover:bg-[var(--red-soft)] hover:border-[var(--red)] text-xs mland:text-[9.5px] font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 mland:w-3 mland:h-3 shrink-0" />
              <span>ลบ</span>
            </button>
          )}

          {alreadyInGame ? (
            <span className="h-9 mland:h-7 px-3 mland:px-2 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/35 text-xs mland:text-[9.5px] font-bold text-[var(--g)] inline-flex items-center gap-1 shrink-0">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>มีในเกม</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => handlePickLoadEntry(entry)}
              className="btn h-9 mland:h-7 px-3.5 mland:px-2.5 rounded-xl! mland:rounded-lg! text-xs mland:text-[9.5px] btn-primary shrink-0"
            >
              โหลดใช้งาน
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/72 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-[min(calc(var(--app-dvh,1dvh)*92),660px)] mland:h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden"
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

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden mland:overflow-y-auto p-3.5 mland:p-2.5">
          {tab === 'folder' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 mland:gap-2 mland:flex-none">
              {/* Auto Folder Info & Quick Save */}
              <div className="shrink-0 p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {currentState && currentPreview ? (
                      <SaveVisualDock
                        mode={currentState.mode}
                        name={getStateDisplayName(currentState)}
                        preview={currentPreview}
                        compact
                      />
                    ) : (
                      <div className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-base mland:text-sm shrink-0 shadow-2xs">
                        📁
                      </div>
                    )}
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
                        แสดงโลโก้สโมสร นักเตะเด่น และค่าพลังสูงสุด แยกตามโหมดให้เลือกโหลดง่าย
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentState && currentPreview && (
                      <SaveOvrBadge mode={currentState.mode} preview={currentPreview} compact />
                    )}
                    <button
                      type="button"
                      disabled={loadingList}
                      onClick={() => {
                        SFX.tap();
                        void refreshFolderSaves();
                      }}
                      title="รีเฟรชรายการไฟล์เซฟ"
                      aria-label="รีเฟรชรายการไฟล์เซฟ"
                      className="btn-icon w-9 h-9 mland:w-7 mland:h-7 rounded-xl shrink-0"
                    >
                      <RefreshCw className={`w-4 h-4 mland:w-3.5 mland:h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {currentState && (
                  <div className="pt-2 border-t border-[var(--line)]/70 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          SFX.tap();
                          setConfirmSaveOpen(true);
                        }
                      }}
                      placeholder="ตั้งชื่อโน้ตจุดเซฟ (ไม่ใส่ก็ได้ เช่น ก่อนนัดชิง)"
                      maxLength={32}
                      className="flex-1 min-w-[160px] h-9 mland:h-7 px-3 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        SFX.tap();
                        setConfirmSaveOpen(true);
                      }}
                      className="btn h-9 mland:h-7 px-4 mland:px-3 text-xs mland:text-[10px] btn-primary shrink-0"
                    >
                      <Save className="w-4 h-4 mland:w-3.5 mland:h-3.5 shrink-0" />
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
                      ['m', `📋 ผู้จัดการ (${modeCounts.m})`],
                      ['p', `⚽ นักเตะ (${modeCounts.p})`]
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
                    className="px-2.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] mland:text-[9.5px] font-bold text-[var(--ink)]"
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

              {/* Scrollable Save List — Separated Cleanly by Mode */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 mland:flex-none mland:overflow-visible">
                {loadingList ? (
                  <div className="h-full min-h-[160px] flex items-center justify-center p-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/30 text-center text-xs text-[var(--mut)]">
                    กำลังดึงรายการไฟล์เซฟจากโฟลเดอร์ {GAME_AUTO_FOLDER_NAME}...
                  </div>
                ) : groupedSections.length ? (
                  <div className="space-y-3.5 mland:space-y-2.5">
                    {groupedSections.map((group) => {
                      const isMgrGroup = group.mode === 'm';
                      return (
                        <section
                          key={group.mode}
                          className="rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface)]/75 overflow-hidden"
                        >
                          <div
                            className={`px-3 py-2 mland:px-2.5 mland:py-1 border-b border-[var(--line)] flex items-center justify-between gap-2 ${
                              isMgrGroup
                                ? 'bg-[var(--lamp-soft)]/35'
                                : 'bg-[var(--g-soft)]/35'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm mland:text-xs leading-none">{group.icon}</span>
                              <span
                                className={`font-extrabold text-xs mland:text-[10.5px] font-display truncate ${
                                  isMgrGroup
                                    ? 'text-[#8a5b00] dark:text-[var(--lamp)]'
                                    : 'text-[var(--g)]'
                                }`}
                              >
                                {group.title}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-bold tabular border ${
                                isMgrGroup
                                  ? 'bg-[var(--surface)] border-[var(--lamp)]/40 text-[#8a5b00] dark:text-[var(--lamp)]'
                                  : 'bg-[var(--surface)] border-[var(--g)]/35 text-[var(--g)]'
                              }`}
                            >
                              {group.list.length} รายการ
                            </span>
                          </div>
                          <div className="p-2 mland:p-1.5 space-y-2 mland:space-y-1.5">
                            {group.list.map((entry) => renderSaveCard(entry))}
                          </div>
                        </section>
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
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <SaveVisualDock
                        mode={currentState.mode}
                        name={getStateDisplayName(currentState)}
                        preview={currentPreview}
                        compact
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs mland:text-[10.5px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                          <span>📤 ส่งออกเซฟปัจจุบันไปเครื่องอื่น</span>
                        </div>
                        <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] mt-0.5 truncate tabular">
                          {currentState.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} ·{' '}
                          <span className="font-bold text-[var(--ink)]">{getStateDisplayName(currentState)}</span> · ซีซัน {currentState.season} นัด {currentState.md}
                        </div>
                      </div>
                      <SaveOvrBadge mode={currentState.mode} preview={currentPreview} compact />
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
                        className="btn h-8 mland:h-7 px-3 text-xs mland:text-[9.5px] btn-primary"
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
                        className="btn h-8 mland:h-7 px-3 text-xs mland:text-[9.5px] btn-secondary"
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
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <SaveVisualDock
                          mode={parsedCode.mode}
                          name={getStateDisplayName(parsedCode)}
                          preview={parsedCodePreview}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-xs sm:text-sm truncate text-[var(--ink)]">
                            {getStateDisplayName(parsedCode)}
                          </div>
                          {parsedCodePreview && (
                            <div className="text-[10.5px] font-semibold text-[var(--ink)]/85 truncate">
                              {parsedCode.mode === 'm'
                                ? parsedCodePreview.player
                                  ? `⭐ ${parsedCodePreview.player.n} (${parsedCodePreview.player.ro})`
                                  : TN[parsedCodePreview.tier] || ''
                                : `🛡️ ${parsedCodePreview.teamName}`}
                            </div>
                          )}
                          <div className="text-[10.5px] text-[var(--mut)] tabular">
                            {parsedCode.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} · ซีซัน {parsedCode.season} · นัด {parsedCode.md}
                          </div>
                        </div>
                      </div>
                      <SaveOvrBadge mode={parsedCode.mode} preview={parsedCodePreview} />
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
                          className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
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
                          className="btn h-9 px-4 text-xs btn-primary shrink-0"
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

        {/* Confirm Save Checkpoint Sub-dialog */}
        {confirmSaveOpen && currentState && (
          <div
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !busy && setConfirmSaveOpen(false)}
          >
            <div
              className="w-full max-w-sm p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/35 flex items-center justify-center text-[var(--g)] shrink-0">
                  <Save className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm font-display">ยืนยันสร้างจุดเซฟใหม่?</div>
                  <div className="text-[11px] text-[var(--mut)]">บันทึกจุดเซฟปัจจุบันเก็บแยกไว้ในคลังเซฟ</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <SaveVisualDock
                    mode={currentState.mode}
                    name={getStateDisplayName(currentState)}
                    preview={currentPreview}
                    compact
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate text-[var(--ink)]">
                      {getStateDisplayName(currentState)}
                    </div>
                    <div className="text-[10.5px] text-[var(--mut)] tabular">
                      ซีซัน {currentState.season} · นัด {currentState.md}
                    </div>
                  </div>
                </div>
                <SaveOvrBadge mode={currentState.mode} preview={currentPreview} compact />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--mut)] block">
                  โน้ตจุดเซฟ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder="เช่น ก่อนนัดชิง, จบฤดูกาล"
                  maxLength={32}
                  className="w-full h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmSaveOpen(false)}
                  className="btn btn-md btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void executeSaveCheckpoint()}
                  className="btn btn-md btn-primary flex-1"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>{busy ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Sub-dialog */}
        {confirmDeleteEntry && (
          <div
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !busy && setConfirmDeleteEntry(null)}
          >
            <div
              className="w-full max-w-sm p-4 rounded-2xl bg-[var(--surface)] border border-[var(--red)]/45 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/40 flex items-center justify-center text-[var(--red)] shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm font-display text-[var(--red)]">ยืนยันการลบไฟล์เซฟ?</div>
                  <div className="text-[11px] text-[var(--mut)]">เมื่อลบแล้วจะไม่สามารถกู้คืนไฟล์นี้ได้</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <SaveVisualDock
                    mode={confirmDeleteEntry.mode}
                    name={confirmDeleteEntry.name}
                    preview={confirmDeleteEntry.preview}
                    compact
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate text-[var(--ink)]">
                      {confirmDeleteEntry.label && !confirmDeleteEntry.isAutoSave
                        ? `${confirmDeleteEntry.label} · `
                        : ''}
                      {confirmDeleteEntry.name}
                    </div>
                    <div className="text-[10.5px] text-[var(--mut)] tabular">
                      {confirmDeleteEntry.mode === 'm' ? '📋 ผู้จัดการทีม' : '⚽ นักเตะอาชีพ'} · ซีซัน {confirmDeleteEntry.season} · นัด {confirmDeleteEntry.md}
                    </div>
                  </div>
                </div>
                <SaveOvrBadge mode={confirmDeleteEntry.mode} preview={confirmDeleteEntry.preview} compact />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDeleteEntry(null)}
                  className="btn btn-md btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void executeDeleteEntry(confirmDeleteEntry)}
                  className="btn btn-md bg-[var(--red)] text-white hover:brightness-110 flex-1"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>{busy ? 'กำลังลบ...' : 'ยืนยันลบเซฟ'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Slot Sub-dialog when slots are full and user is in auto mode */}
        {confirmLoadEntry && (
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
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
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <SaveVisualDock
                    mode={confirmLoadEntry.mode}
                    name={confirmLoadEntry.name}
                    preview={confirmLoadEntry.preview}
                    compact
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate">
                      {confirmLoadEntry.label && !confirmLoadEntry.isAutoSave
                        ? `${confirmLoadEntry.label} · `
                        : ''}
                      {confirmLoadEntry.name}
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">
                      ซีซัน {confirmLoadEntry.season} · นัด {confirmLoadEntry.md}
                    </div>
                  </div>
                </div>
                <SaveOvrBadge mode={confirmLoadEntry.mode} preview={confirmLoadEntry.preview} compact />
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
                  className="btn btn-md btn-secondary flex-1"
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
