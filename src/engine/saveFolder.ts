import type { GameMode, GameState } from '../types/game';
import {
  buildSaveFileName,
  buildSaveFilePayload,
  cleanImportJson,
  inspectSavePreview,
  readSaveFileText
} from './saveCodec';

export const GAME_AUTO_FOLDER_NAME = 'LooknangTH_Saves';
export const GAME_AUTO_FOLDER_ID = '__game_auto_folder__';
const MIGRATION_FLAG_KEY = 'lk_autofolder_migrated_v1';

export interface FolderSaveEntry {
  id: string;
  source: 'opfs' | 'vault' | 'files';
  filename: string;
  mode: GameMode;
  name: string;
  season: number;
  md: number;
  label?: string;
  isAutoSave?: boolean;
  slot?: number;
  savedAt: number;
  size: number;
  readRaw: () => Promise<string>;
  remove?: () => Promise<void>;
}

export interface CustomVaultFolder {
  id: string;
  name: string;
  createdAt: number;
}

interface StoredVaultSave {
  id: string;
  folderId: string;
  filename: string;
  mode: GameMode;
  name: string;
  season: number;
  md: number;
  label?: string;
  isAutoSave?: boolean;
  slot?: number;
  savedAt: number;
  size: number;
  raw: string;
}

interface DirHandleExt {
  name: string;
  kind: 'directory';
  getDirectoryHandle?: (name: string, options?: { create?: boolean }) => Promise<DirHandleExt>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandleExt>;
  removeEntry?: (name: string) => Promise<void>;
  values: () => AsyncIterable<DirEntryExt>;
}

interface FileHandleExt {
  name: string;
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}

type DirEntryExt = DirHandleExt | FileHandleExt;

const DB_NAME = 'looknang_save_vault_v1';
const DB_VERSION = 1;
const STORE_HANDLES = 'handles';
const STORE_FOLDERS = 'vault_folders';
const STORE_SAVES = 'vault_saves';

const openVaultDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        const savesStore = db.createObjectStore(STORE_SAVES, { keyPath: 'id' });
        savesStore.createIndex('by_folder', 'folderId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open save vault DB'));
  });

const txPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request error'));
  });

// Serialize OPFS file writes per filename to avoid NoModificationAllowedError
const opfsWriteQueues = new Map<string, Promise<void>>();
const enqueueOpfsWrite = async (filename: string, task: () => Promise<void>): Promise<void> => {
  const prev = opfsWriteQueues.get(filename) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  opfsWriteQueues.set(filename, next);
  try {
    await next;
  } finally {
    if (opfsWriteQueues.get(filename) === next) {
      opfsWriteQueues.delete(filename);
    }
  }
};

export const isOpfsSupported = (): boolean => {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) return false;
    const storage = navigator.storage as unknown as { getDirectory?: unknown };
    return typeof storage.getDirectory === 'function';
  } catch {
    return false;
  }
};

const getAutoOpfsDirectory = async (): Promise<DirHandleExt | null> => {
  if (!isOpfsSupported()) return null;
  try {
    const storage = navigator.storage as unknown as {
      getDirectory: () => Promise<DirHandleExt>;
    };
    const root = await storage.getDirectory();
    if (!root || typeof root.getDirectoryHandle !== 'function') return null;
    const dir = await root.getDirectoryHandle(GAME_AUTO_FOLDER_NAME, { create: true });
    return dir;
  } catch {
    return null;
  }
};

const writeOpfsSaveFile = async (filename: string, payload: string): Promise<boolean> => {
  let ok = false;
  await enqueueOpfsWrite(filename, async () => {
    try {
      const dir = await getAutoOpfsDirectory();
      if (!dir) return;
      const fh = await dir.getFileHandle(filename, { create: true });
      if (typeof fh.createWritable !== 'function') return;
      const writable = await fh.createWritable();
      await writable.write(payload);
      await writable.close();
      ok = true;
    } catch {
      ok = false;
    }
  });
  return ok;
};

const removeOpfsSaveFile = async (filename: string): Promise<void> => {
  await enqueueOpfsWrite(filename, async () => {
    try {
      const dir = await getAutoOpfsDirectory();
      if (!dir || typeof dir.removeEntry !== 'function') return;
      await dir.removeEntry(filename);
    } catch {
      // ignore if not found
    }
  });
};

const listOpfsDirectorySaves = async (): Promise<FolderSaveEntry[]> => {
  const dir = await getAutoOpfsDirectory();
  if (!dir) return [];
  const entries: FolderSaveEntry[] = [];
  try {
    for await (const item of dir.values()) {
      if (item.kind !== 'file') continue;
      const lower = item.name.toLowerCase();
      if (!lower.endsWith('.json') && !lower.endsWith('.lk2') && !lower.endsWith('.txt')) continue;
      try {
        const file = await item.getFile();
        if (file.size > 15 * 1024 * 1024) continue;
        const text = await readSaveFileText(file);
        const meta = inspectSavePreview(text);
        if (!meta) continue;
        const isAuto = item.name.startsWith('autosave-');
        const slotMatch = item.name.match(/-slot(\d+)\./i);
        entries.push({
          id: `opfs:${item.name}`,
          source: 'opfs',
          filename: item.name,
          mode: meta.mode,
          name: meta.name,
          season: meta.season,
          md: meta.md,
          label: meta.label,
          isAutoSave: isAuto,
          slot: slotMatch ? Number(slotMatch[1]) : undefined,
          savedAt: meta.exportedAt ? Date.parse(meta.exportedAt) || file.lastModified : file.lastModified,
          size: file.size,
          readRaw: async () => text,
          remove: async () => {
            await removeOpfsSaveFile(item.name);
            await deleteVaultSaveByFilename(item.name);
          }
        });
      } catch {
        // skip unreadable file
      }
    }
  } catch {
    return [];
  }
  entries.sort((a, b) => b.savedAt - a.savedAt);
  return entries;
};

const buildAutoSaveFilename = (mode: GameMode, slot: number): string => {
  const modeTag = mode === 'm' ? 'manager' : 'player';
  return `autosave-${modeTag}-slot${slot}.json`;
};

const ensureAutoFolderMeta = async (): Promise<void> => {
  try {
    const db = await openVaultDb();
    const tx = db.transaction(STORE_FOLDERS, 'readwrite');
    const existing = await txPromise(tx.objectStore(STORE_FOLDERS).get(GAME_AUTO_FOLDER_ID));
    if (!existing) {
      await txPromise(
        tx.objectStore(STORE_FOLDERS).put({
          id: GAME_AUTO_FOLDER_ID,
          name: GAME_AUTO_FOLDER_NAME,
          createdAt: Date.now()
        } satisfies CustomVaultFolder)
      );
    }
    db.close();
  } catch {
    // ignore
  }
};

export const deleteVaultSave = async (saveId: string): Promise<void> => {
  try {
    const db = await openVaultDb();
    const tx = db.transaction(STORE_SAVES, 'readwrite');
    await txPromise(tx.objectStore(STORE_SAVES).delete(saveId));
    db.close();
  } catch {
    // ignore
  }
};

const deleteVaultSaveByFilename = async (filename: string): Promise<void> => {
  try {
    const db = await openVaultDb();
    const readTx = db.transaction(STORE_SAVES, 'readonly');
    const all = (await txPromise(readTx.objectStore(STORE_SAVES).getAll())) as StoredVaultSave[];
    const matches = all.filter((r) => r.filename === filename);
    if (matches.length) {
      const writeTx = db.transaction(STORE_SAVES, 'readwrite');
      const store = writeTx.objectStore(STORE_SAVES);
      matches.forEach((m) => store.delete(m.id));
      await new Promise<void>((resolve, reject) => {
        writeTx.oncomplete = () => resolve();
        writeTx.onerror = () => reject(writeTx.error || new Error('Delete failed'));
      });
    }
    db.close();
  } catch {
    // ignore
  }
};

export const saveGameToAutoFolder = async (
  state: GameState,
  opts?: { label?: string; slot?: number; isAutoSave?: boolean }
): Promise<FolderSaveEntry> => {
  const isAutoSave = Boolean(opts?.isAutoSave && opts?.slot);
  const slot = opts?.slot;
  const cleanLabel = opts?.label?.trim() || (isAutoSave && slot ? `เซฟอัตโนมัติ ช่อง #${slot}` : undefined);
  const filename =
    isAutoSave && slot
      ? buildAutoSaveFilename(state.mode, slot)
      : buildSaveFileName(state, cleanLabel, true);
  const raw = buildSaveFilePayload(state, cleanLabel);
  const name =
    state.mode === 'm'
      ? state.club?.name || state.teams[state.me]?.name || 'สโมสร'
      : state.p?.name || 'นักเตะ';
  const now = Date.now();
  const size = new Blob([raw]).size;
  const id =
    isAutoSave && slot
      ? `auto_${state.mode}_slot_${slot}`
      : `vs_${now}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. Write directly to OPFS folder (no user prompt)
  await writeOpfsSaveFile(filename, raw);

  // 2. Always persist/mirror in IndexedDB so it works in every browser & iframe
  try {
    await ensureAutoFolderMeta();
    const rec: StoredVaultSave = {
      id,
      folderId: GAME_AUTO_FOLDER_ID,
      filename,
      mode: state.mode,
      name,
      season: state.season,
      md: state.md,
      ...(cleanLabel ? { label: cleanLabel } : {}),
      ...(isAutoSave ? { isAutoSave: true } : {}),
      ...(slot ? { slot } : {}),
      savedAt: now,
      size,
      raw
    };
    const db = await openVaultDb();
    const tx = db.transaction(STORE_SAVES, 'readwrite');
    await txPromise(tx.objectStore(STORE_SAVES).put(rec));
    db.close();
  } catch {
    // ignore IDB errors if OPFS succeeded
  }

  return {
    id,
    source: 'vault',
    filename,
    mode: state.mode,
    name,
    season: state.season,
    md: state.md,
    label: cleanLabel,
    isAutoSave,
    slot,
    savedAt: now,
    size,
    readRaw: async () => raw,
    remove: async () => {
      await removeOpfsSaveFile(filename);
      await deleteVaultSave(id);
      await deleteVaultSaveByFilename(filename);
    }
  };
};

// Coalesced background auto-sync per (mode, slot)
const pendingSlotSync = new Map<string, Promise<void>>();
export const syncSlotToAutoFolder = async (state: GameState, slot: number): Promise<void> => {
  const key = `${state.mode}_${slot}`;
  const prev = pendingSlotSync.get(key) || Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      await saveGameToAutoFolder(state, {
        slot,
        isAutoSave: true,
        label: `เซฟอัตโนมัติ ช่อง #${slot}`
      });
    });
  pendingSlotSync.set(key, next);
  try {
    await next;
  } finally {
    if (pendingSlotSync.get(key) === next) {
      pendingSlotSync.delete(key);
    }
  }
};

export const migrateLocalSlotsToAutoFolderOnce = async (
  loadSlotFn: (m: GameMode, slot: number) => GameState | null,
  maxSlots: number
): Promise<void> => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === '1') return;
    const tasks: Promise<void>[] = [];
    (['m', 'p'] as GameMode[]).forEach((mode) => {
      for (let k = 1; k <= maxSlots; k++) {
        const d = loadSlotFn(mode, k);
        if (d) {
          tasks.push(syncSlotToAutoFolder(d, k));
        }
      }
    });
    await Promise.all(tasks);
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch {
    // ignore
  }
};

export const listAutoFolderSaves = async (): Promise<{
  entries: FolderSaveEntry[];
  opfsActive: boolean;
}> => {
  const [opfsEntries, idbRows] = await Promise.all([
    listOpfsDirectorySaves(),
    (async (): Promise<StoredVaultSave[]> => {
      try {
        const db = await openVaultDb();
        const tx = db.transaction(STORE_SAVES, 'readonly');
        const rows = (await txPromise(tx.objectStore(STORE_SAVES).getAll())) as StoredVaultSave[];
        db.close();
        return rows;
      } catch {
        return [];
      }
    })()
  ]);

  const byFilename = new Map<string, FolderSaveEntry>();

  for (const rec of idbRows) {
    const isAuto = Boolean(rec.isAutoSave || rec.filename.startsWith('autosave-'));
    const entry: FolderSaveEntry = {
      id: rec.id,
      source: 'vault',
      filename: rec.filename,
      mode: rec.mode,
      name: rec.name,
      season: rec.season,
      md: rec.md,
      label: rec.label,
      isAutoSave: isAuto,
      slot: rec.slot,
      savedAt: rec.savedAt,
      size: rec.size,
      readRaw: async () => rec.raw,
      remove: async () => {
        await removeOpfsSaveFile(rec.filename);
        await deleteVaultSave(rec.id);
        await deleteVaultSaveByFilename(rec.filename);
      }
    };
    const existing = byFilename.get(rec.filename);
    if (!existing || entry.savedAt >= existing.savedAt) {
      byFilename.set(rec.filename, entry);
    }
  }

  for (const opfsEntry of opfsEntries) {
    const existing = byFilename.get(opfsEntry.filename);
    if (!existing || opfsEntry.savedAt >= existing.savedAt) {
      byFilename.set(opfsEntry.filename, opfsEntry);
    }
  }

  const entries = Array.from(byFilename.values()).sort((a, b) => b.savedAt - a.savedAt);
  return {
    entries,
    opfsActive: opfsEntries.length > 0 || isOpfsSupported()
  };
};

export const readFileListAsSaveEntries = async (files: FileList | File[]): Promise<FolderSaveEntry[]> => {
  const arr = Array.from(files);
  const out: FolderSaveEntry[] = [];
  for (const file of arr) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.json') && !lower.endsWith('.lk2') && !lower.endsWith('.txt')) continue;
    if (file.size > 15 * 1024 * 1024) continue;
    try {
      const text = await readSaveFileText(file);
      const meta = inspectSavePreview(text);
      if (!meta) continue;
      out.push({
        id: `file:${file.name}:${file.lastModified}:${file.size}`,
        source: 'files',
        filename: file.name,
        mode: meta.mode,
        name: meta.name,
        season: meta.season,
        md: meta.md,
        label: meta.label,
        savedAt: meta.exportedAt ? Date.parse(meta.exportedAt) || file.lastModified : file.lastModified,
        size: file.size,
        readRaw: async () => text
      });
    } catch {
      // ignore invalid file
    }
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
};

export const parseFolderSaveEntry = async (entry: FolderSaveEntry): Promise<GameState | null> => {
  const raw = await entry.readRaw();
  return cleanImportJson(raw);
};
