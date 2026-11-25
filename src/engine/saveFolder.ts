import type { GameMode, GameState } from '../types/game';
import {
  buildSaveFileName,
  buildSaveFilePayload,
  cleanImportJson,
  inspectSavePreview,
  readSaveFileText
} from './saveCodec';

export interface FolderSaveEntry {
  id: string;
  source: 'os' | 'vault' | 'files';
  filename: string;
  mode: GameMode;
  name: string;
  season: number;
  md: number;
  label?: string;
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
  savedAt: number;
  size: number;
  raw: string;
}

interface DirHandleExt {
  name: string;
  kind: 'directory';
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandleExt>;
  removeEntry?: (name: string) => Promise<void>;
  values: () => AsyncIterable<DirEntryExt>;
}

interface FileHandleExt {
  name: string;
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}

type DirEntryExt = DirHandleExt | FileHandleExt;

const DB_NAME = 'looknang_save_vault_v1';
const DB_VERSION = 1;
const STORE_HANDLES = 'handles';
const STORE_FOLDERS = 'vault_folders';
const STORE_SAVES = 'vault_saves';
const OS_DIR_KEY = 'os_dir';

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

export const isOsDirectoryPickerSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { showDirectoryPicker?: unknown };
  return typeof w.showDirectoryPicker === 'function';
};

export const isInCrossOriginFrame = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const getSavedOsDirectory = async (): Promise<{ handle: DirHandleExt; name: string } | null> => {
  try {
    const db = await openVaultDb();
    const tx = db.transaction(STORE_HANDLES, 'readonly');
    const row = (await txPromise(tx.objectStore(STORE_HANDLES).get(OS_DIR_KEY))) as
      | { id: string; handle: DirHandleExt; name: string }
      | undefined;
    db.close();
    if (row?.handle && typeof row.handle.getFileHandle === 'function') {
      return { handle: row.handle, name: row.name || row.handle.name || 'โฟลเดอร์เซฟ' };
    }
    return null;
  } catch {
    return null;
  }
};

export const clearSavedOsDirectory = async (): Promise<void> => {
  try {
    const db = await openVaultDb();
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    await txPromise(tx.objectStore(STORE_HANDLES).delete(OS_DIR_KEY));
    db.close();
  } catch {
    // ignore
  }
};

export const pickOsSaveDirectory = async (): Promise<
  | { ok: true; handle: DirHandleExt; name: string }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'iframe_blocked' | 'error'; message: string }
> => {
  if (!isOsDirectoryPickerSupported()) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'เบราว์เซอร์นี้ยังไม่รองรับการเข้าถึงโฟลเดอร์บนเครื่องโดยตรง (แนะนำใช้แท็บ "โฟลเดอร์ในแอป" หรือเลือกไฟล์แทน)'
    };
  }
  try {
    const picker = (window as unknown as {
      showDirectoryPicker: (opts?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirHandleExt>;
    }).showDirectoryPicker;
    const handle = await picker({ id: 'looknang-saves', mode: 'readwrite', startIn: 'documents' });
    const name = handle.name || 'โฟลเดอร์เซฟ';
    try {
      const db = await openVaultDb();
      const tx = db.transaction(STORE_HANDLES, 'readwrite');
      await txPromise(tx.objectStore(STORE_HANDLES).put({ id: OS_DIR_KEY, handle, name, updatedAt: Date.now() }));
      db.close();
    } catch {
      // handle still works for current session even if IDB fails
    }
    return { ok: true, handle, name };
  } catch (err) {
    const errObj = err as { name?: string; message?: string };
    if (errObj?.name === 'AbortError') {
      return { ok: false, reason: 'cancelled', message: 'ยกเลิกการเลือกโฟลเดอร์' };
    }
    if (errObj?.name === 'SecurityError' || isInCrossOriginFrame()) {
      return {
        ok: false,
        reason: 'iframe_blocked',
        message: 'หน้าต่างตัวอย่าง (Iframe) บล็อกการเลือกโฟลเดอร์โดยตรง กรุณาเปิดผ่านแท็บ Chrome/Edge ปกติ หรือใช้แท็บ "โฟลเดอร์ในแอป"'
      };
    }
    return {
      ok: false,
      reason: 'error',
      message: 'ไม่สามารถเปิดโฟลเดอร์ที่เลือกได้ กรุณาลองโฟลเดอร์อื่นหรือใช้แท็บ "โฟลเดอร์ในแอป"'
    };
  }
};

export const ensureDirectoryPermission = async (
  handle: DirHandleExt,
  mode: 'read' | 'readwrite',
  requestIfPrompt = true
): Promise<boolean> => {
  try {
    if (handle.queryPermission) {
      const perm = await handle.queryPermission({ mode });
      if (perm === 'granted') return true;
    }
    if (requestIfPrompt && handle.requestPermission) {
      const req = await handle.requestPermission({ mode });
      return req === 'granted';
    }
    return !handle.queryPermission;
  } catch {
    return false;
  }
};

export const saveGameToOsDirectory = async (
  handle: DirHandleExt,
  state: GameState,
  label?: string
): Promise<{ filename: string; bytes: number }> => {
  const filename = buildSaveFileName(state, label, true);
  const payload = buildSaveFilePayload(state, label);
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(payload);
  await writable.close();
  return { filename, bytes: new Blob([payload]).size };
};

export const listOsDirectorySaves = async (handle: DirHandleExt): Promise<FolderSaveEntry[]> => {
  const entries: FolderSaveEntry[] = [];
  for await (const item of handle.values()) {
    if (item.kind !== 'file') continue;
    const lower = item.name.toLowerCase();
    if (!lower.endsWith('.json') && !lower.endsWith('.lk2') && !lower.endsWith('.txt')) continue;
    try {
      const file = await item.getFile();
      if (file.size > 15 * 1024 * 1024) continue;
      const text = await readSaveFileText(file);
      const meta = inspectSavePreview(text);
      if (!meta) continue;
      entries.push({
        id: `os:${item.name}:${file.lastModified}`,
        source: 'os',
        filename: item.name,
        mode: meta.mode,
        name: meta.name,
        season: meta.season,
        md: meta.md,
        label: meta.label,
        savedAt: meta.exportedAt ? Date.parse(meta.exportedAt) || file.lastModified : file.lastModified,
        size: file.size,
        readRaw: async () => text,
        remove: handle.removeEntry
          ? async () => {
              await handle.removeEntry?.(item.name);
            }
          : undefined
      });
    } catch {
      // skip unreadable files
    }
  }
  entries.sort((a, b) => b.savedAt - a.savedAt);
  return entries;
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

export const listVaultFolders = async (): Promise<CustomVaultFolder[]> => {
  const db = await openVaultDb();
  const tx = db.transaction(STORE_FOLDERS, 'readonly');
  const rows = (await txPromise(tx.objectStore(STORE_FOLDERS).getAll())) as CustomVaultFolder[];
  db.close();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
};

export const createVaultFolder = async (name: string): Promise<CustomVaultFolder> => {
  const clean = name.trim().slice(0, 40) || 'โฟลเดอร์เซฟ';
  const folder: CustomVaultFolder = {
    id: `vf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    createdAt: Date.now()
  };
  const db = await openVaultDb();
  const tx = db.transaction(STORE_FOLDERS, 'readwrite');
  await txPromise(tx.objectStore(STORE_FOLDERS).put(folder));
  db.close();
  return folder;
};

export const deleteVaultFolder = async (folderId: string): Promise<void> => {
  const db = await openVaultDb();
  const readTx = db.transaction(STORE_SAVES, 'readonly');
  const idx = readTx.objectStore(STORE_SAVES).index('by_folder');
  const saves = (await txPromise(idx.getAll(folderId))) as StoredVaultSave[];

  const writeTx = db.transaction([STORE_FOLDERS, STORE_SAVES], 'readwrite');
  writeTx.objectStore(STORE_FOLDERS).delete(folderId);
  const saveStore = writeTx.objectStore(STORE_SAVES);
  saves.forEach((sv) => saveStore.delete(sv.id));
  await new Promise<void>((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error || new Error('Delete folder failed'));
  });
  db.close();
};

export const saveGameToVaultFolder = async (
  folderId: string,
  state: GameState,
  label?: string
): Promise<FolderSaveEntry> => {
  const filename = buildSaveFileName(state, label, true);
  const raw = buildSaveFilePayload(state, label);
  const name = state.mode === 'm' ? (state.club?.name || state.teams[state.me]?.name || 'สโมสร') : (state.p?.name || 'นักเตะ');
  const now = Date.now();
  const rec: StoredVaultSave = {
    id: `vs_${now}_${Math.random().toString(36).slice(2, 6)}`,
    folderId,
    filename,
    mode: state.mode,
    name,
    season: state.season,
    md: state.md,
    ...(label?.trim() ? { label: label.trim() } : {}),
    savedAt: now,
    size: new Blob([raw]).size,
    raw
  };
  const db = await openVaultDb();
  const tx = db.transaction(STORE_SAVES, 'readwrite');
  await txPromise(tx.objectStore(STORE_SAVES).put(rec));
  db.close();
  return {
    id: rec.id,
    source: 'vault',
    filename: rec.filename,
    mode: rec.mode,
    name: rec.name,
    season: rec.season,
    md: rec.md,
    label: rec.label,
    savedAt: rec.savedAt,
    size: rec.size,
    readRaw: async () => rec.raw,
    remove: async () => {
      await deleteVaultSave(rec.id);
    }
  };
};

export const deleteVaultSave = async (saveId: string): Promise<void> => {
  const db = await openVaultDb();
  const tx = db.transaction(STORE_SAVES, 'readwrite');
  await txPromise(tx.objectStore(STORE_SAVES).delete(saveId));
  db.close();
};

export const listVaultFolderSaves = async (folderId: string): Promise<FolderSaveEntry[]> => {
  const db = await openVaultDb();
  const tx = db.transaction(STORE_SAVES, 'readonly');
  const idx = tx.objectStore(STORE_SAVES).index('by_folder');
  const rows = (await txPromise(idx.getAll(folderId))) as StoredVaultSave[];
  db.close();
  return rows
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((rec) => ({
      id: rec.id,
      source: 'vault' as const,
      filename: rec.filename,
      mode: rec.mode,
      name: rec.name,
      season: rec.season,
      md: rec.md,
      label: rec.label,
      savedAt: rec.savedAt,
      size: rec.size,
      readRaw: async () => rec.raw,
      remove: async () => {
        await deleteVaultSave(rec.id);
      }
    }));
};

export const parseFolderSaveEntry = async (entry: FolderSaveEntry): Promise<GameState | null> => {
  const raw = await entry.readRaw();
  return cleanImportJson(raw);
};
