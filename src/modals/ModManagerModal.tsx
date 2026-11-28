import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  UserCheck,
  X
} from 'lucide-react';
import type {
  GameModPack,
  GameState,
  ModClubOverride,
  ModCupConfig,
  ModCupKey,
  ModGameBrand,
  ModPlayerOverride,
  ModRealismSettings,
  Position,
  SubRole
} from '../types/game';
import { LINE } from '../data/thaiFootballData';
import { DT, OVF } from '../engine/playerCore';
import {
  BUILTIN_REALISTIC_MOD_PRESETS,
  DEFAULT_CUP_META,
  DEFAULT_GAME_SUBTITLE,
  DEFAULT_GAME_TITLE,
  DEFAULT_TIER_NAMES,
  WORLD_LEAGUE_CATALOG,
  applyActiveModToRuntimeData,
  buildTemplateModPack,
  deleteInstalledMod,
  exportModPackJson,
  getActiveMod,
  getEditableClubCatalog,
  getInstalledMods,
  installBuiltinModPreset,
  sanitizeImageUrl,
  saveInstalledMod,
  setActiveModId
} from '../engine/mods';
import {
  downloadModPackXlsx,
  fetchGoogleSheetModPack,
  parseSpreadsheetBufferToModPack,
  parseSpreadsheetTextToModPack,
  type SpreadsheetImportResult
} from '../engine/modSpreadsheet';
import { SFX } from '../utils/audioTheme';
import { clamp } from '../utils/math';
import { VipOfficeScannerGate } from './SecretBoostModal';

interface ModManagerModalProps {
  state?: GameState | null;
  authorized?: boolean;
  onAuthorize?: () => void;
  onLock?: () => void;
  onApplyModToState?: (mod: GameModPack | null) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

type EditorSection = 'brand' | 'leagues' | 'cups' | 'clubs' | 'players';

const SUB_ROLES = Object.keys(LINE) as SubRole[];
const CUP_KEYS: { key: ModCupKey; label: string }[] = [
  { key: 'fa', label: 'เอฟเอ คัพ / ถ้วยประชาชน' },
  { key: 'leagueCup', label: 'ลีก คัพ' },
  { key: 'divCup', label: 'ถ้วยดิวิชั่น & ภูมิภาค' },
  { key: 'superCup', label: 'ซูเปอร์ คัพ / แชมเปี้ยนส์ คัพ' },
  { key: 'asia', label: 'ถ้วยทวีป / สโมสรโลก' }
];

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

async function resizeImageFileToDataUrl(file: File, maxDim = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพ'));
        return;
      }
      if (dataUrl.startsWith('data:image/svg+xml')) {
        if (dataUrl.length <= 240000) {
          resolve(dataUrl);
        } else {
          reject(new Error('ไฟล์ SVG ใหญ่เกินไป'));
        }
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      img.onload = () => {
        const w = img.naturalWidth || img.width || maxDim;
        const h = img.naturalHeight || img.height || maxDim;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const tw = Math.max(16, Math.round(w * scale));
        const th = Math.max(16, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, tw, th);
        ctx.drawImage(img, 0, 0, tw, th);
        try {
          const webp = canvas.toDataURL('image/webp', 0.88);
          if (webp.startsWith('data:image/webp') && webp.length < 180000) {
            resolve(webp);
            return;
          }
        } catch {
          // fallback to png
        }
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function makeSafeFilename(name: string, ext: string): string {
  const base = name.replace(/[^\w\u0E00-\u0E7F-]+/g, '_').replace(/^_+|_+$/g, '') || 'looknang_mod';
  return `${base}.${ext}`;
}

export const ModManagerModal: React.FC<ModManagerModalProps> = ({
  state = null,
  authorized,
  onAuthorize,
  onLock,
  onApplyModToState,
  onClose,
  onToast
}) => {
  const [localAuthorized, setLocalAuthorized] = useState(false);
  const isAuthorized = authorized !== undefined ? authorized : localAuthorized;
  const handleUnlock = () => {
    setLocalAuthorized(true);
    onAuthorize?.();
  };
  const handleLock = () => {
    setLocalAuthorized(false);
    onLock?.();
    onClose();
  };

  const [tab, setTab] = useState<'list' | 'import' | 'editor'>('list');
  const [edSection, setEdSection] = useState<EditorSection>('brand');
  const [mods, setMods] = useState<GameModPack[]>(() => getInstalledMods());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveMod()?.id ?? null);

  // Import state (Excel / Google Sheets / CSV / TSV / JSON)
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [binaryImportResult, setBinaryImportResult] = useState<SpreadsheetImportResult | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edName, setEdName] = useState('Mod ลีกโลก สโมสร และนักเตะ');
  const [edAuthor, setEdAuthor] = useState('ผู้เล่น');
  const [edVersion, setEdVersion] = useState('1.0');
  const [edSourceUrl, setEdSourceUrl] = useState('');
  const [edBrand, setEdBrand] = useState<ModGameBrand>({
    title: DEFAULT_GAME_TITLE,
    subtitle: DEFAULT_GAME_SUBTITLE,
    logoUrl: ''
  });
  const [edRealism, setEdRealism] = useState<Required<ModRealismSettings>>({
    disableSupernatural: true,
    realisticScoring: true,
    realisticFatigue: true
  });
  const [edTierNames, setEdTierNames] = useState<[string, string, string, string]>([...DEFAULT_TIER_NAMES]);
  const [edWorldLeagues, setEdWorldLeagues] = useState<Record<string, string>>({});
  const [edLeagueLogos, setEdLeagueLogos] = useState<Record<string, string>>({});
  const [edCupMeta, setEdCupMeta] = useState<Record<ModCupKey, ModCupConfig>>({
    fa: { ...DEFAULT_CUP_META.fa },
    leagueCup: { ...DEFAULT_CUP_META.leagueCup },
    divCup: { ...DEFAULT_CUP_META.divCup },
    superCup: { ...DEFAULT_CUP_META.superCup },
    asia: { ...DEFAULT_CUP_META.asia }
  });
  const [edClubs, setEdClubs] = useState<Record<string, ModClubOverride>>({});
  const [edPlayers, setEdPlayers] = useState<Record<string, string>>({});
  const [edPlayerData, setEdPlayerData] = useState<Record<string, ModPlayerOverride>>({});

  // Search / filters inside editor
  const [leagueQuery, setLeagueQuery] = useState('');
  const [clubQuery, setClubQuery] = useState('');
  const [clubScope, setClubScope] = useState<'all' | 'domestic' | 'foreign'>('all');
  const [playerTeamKey, setPlayerTeamKey] = useState<string>('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [manualClubKey, setManualClubKey] = useState('');
  const [manualOrigName, setManualOrigName] = useState('');
  const [manualCustomName, setManualCustomName] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [batchTarget, setBatchTarget] = useState<'club' | 'player'>('club');

  const catalog = useMemo(() => getEditableClubCatalog(state), [state]);

  const refreshStore = () => {
    const nextMods = getInstalledMods();
    const curActive = getActiveMod();
    setMods(nextMods);
    setActiveId(curActive?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const textImportResult = useMemo<SpreadsheetImportResult | null>(() => {
    if (!importText.trim()) return null;
    return parseSpreadsheetTextToModPack(importText);
  }, [importText]);

  const activeImportResult = binaryImportResult || textImportResult;

  const activeMod = useMemo(
    () => mods.find((m) => m.id === activeId) || null,
    [mods, activeId]
  );

  const loadPackIntoEditor = (pack: GameModPack | null) => {
    if (!pack) {
      setEditingId(null);
      setEdName('Mod ฟุตบอลสมจริงของฉัน');
      setEdAuthor('ผู้เล่น');
      setEdVersion('1.0');
      setEdSourceUrl('');
      setEdBrand({
        title: DEFAULT_GAME_TITLE,
        subtitle: DEFAULT_GAME_SUBTITLE,
        logoUrl: ''
      });
      setEdRealism({
        disableSupernatural: true,
        realisticScoring: true,
        realisticFatigue: true
      });
      setEdTierNames([...DEFAULT_TIER_NAMES]);
      setEdWorldLeagues({});
      setEdLeagueLogos({});
      setEdCupMeta({
        fa: { ...DEFAULT_CUP_META.fa },
        leagueCup: { ...DEFAULT_CUP_META.leagueCup },
        divCup: { ...DEFAULT_CUP_META.divCup },
        superCup: { ...DEFAULT_CUP_META.superCup },
        asia: { ...DEFAULT_CUP_META.asia }
      });
      setEdClubs({});
      setEdPlayers({});
      setEdPlayerData({});
    } else {
      setEditingId(pack.id);
      setEdName(pack.name);
      setEdAuthor(pack.author || 'ผู้เล่น');
      setEdVersion(pack.version || '1.0');
      setEdSourceUrl(pack.sourceUrl || '');
      setEdBrand({
        title: pack.gameBrand?.title || DEFAULT_GAME_TITLE,
        subtitle: pack.gameBrand?.subtitle || DEFAULT_GAME_SUBTITLE,
        logoUrl: pack.gameBrand?.logoUrl || ''
      });
      setEdRealism({
        disableSupernatural: Boolean(pack.realism?.disableSupernatural),
        realisticScoring: Boolean(pack.realism?.realisticScoring),
        realisticFatigue: Boolean(pack.realism?.realisticFatigue)
      });
      setEdTierNames([
        pack.tierNames?.[0] || DEFAULT_TIER_NAMES[0],
        pack.tierNames?.[1] || DEFAULT_TIER_NAMES[1],
        pack.tierNames?.[2] || DEFAULT_TIER_NAMES[2],
        pack.tierNames?.[3] || DEFAULT_TIER_NAMES[3]
      ]);
      setEdWorldLeagues({ ...(pack.worldLeagueNames || {}) });
      setEdLeagueLogos({ ...(pack.leagueLogos || {}) });
      setEdCupMeta({
        fa: {
          name: pack.cupMeta?.fa?.name || pack.cupNames?.fa || DEFAULT_CUP_META.fa.name,
          short: pack.cupMeta?.fa?.short || DEFAULT_CUP_META.fa.short,
          icon: pack.cupMeta?.fa?.icon || DEFAULT_CUP_META.fa.icon,
          logoUrl: pack.cupMeta?.fa?.logoUrl || '',
          prize: pack.cupMeta?.fa?.prize ?? DEFAULT_CUP_META.fa.prize
        },
        leagueCup: {
          name: pack.cupMeta?.leagueCup?.name || pack.cupNames?.leagueCup || DEFAULT_CUP_META.leagueCup.name,
          short: pack.cupMeta?.leagueCup?.short || DEFAULT_CUP_META.leagueCup.short,
          icon: pack.cupMeta?.leagueCup?.icon || DEFAULT_CUP_META.leagueCup.icon,
          logoUrl: pack.cupMeta?.leagueCup?.logoUrl || '',
          prize: pack.cupMeta?.leagueCup?.prize ?? DEFAULT_CUP_META.leagueCup.prize
        },
        divCup: {
          name: pack.cupMeta?.divCup?.name || pack.cupNames?.divCup || DEFAULT_CUP_META.divCup.name,
          short: pack.cupMeta?.divCup?.short || DEFAULT_CUP_META.divCup.short,
          icon: pack.cupMeta?.divCup?.icon || DEFAULT_CUP_META.divCup.icon,
          logoUrl: pack.cupMeta?.divCup?.logoUrl || '',
          prize: pack.cupMeta?.divCup?.prize ?? DEFAULT_CUP_META.divCup.prize
        },
        superCup: {
          name: pack.cupMeta?.superCup?.name || pack.cupNames?.superCup || DEFAULT_CUP_META.superCup.name,
          short: pack.cupMeta?.superCup?.short || DEFAULT_CUP_META.superCup.short,
          icon: pack.cupMeta?.superCup?.icon || DEFAULT_CUP_META.superCup.icon,
          logoUrl: pack.cupMeta?.superCup?.logoUrl || '',
          prize: pack.cupMeta?.superCup?.prize ?? DEFAULT_CUP_META.superCup.prize
        },
        asia: {
          name: pack.cupMeta?.asia?.name || pack.cupNames?.asia || DEFAULT_CUP_META.asia.name,
          short: pack.cupMeta?.asia?.short || DEFAULT_CUP_META.asia.short,
          icon: pack.cupMeta?.asia?.icon || DEFAULT_CUP_META.asia.icon,
          logoUrl: pack.cupMeta?.asia?.logoUrl || '',
          prize: pack.cupMeta?.asia?.prize ?? DEFAULT_CUP_META.asia.prize
        }
      });
      setEdClubs({ ...(pack.clubOverrides || {}) });
      setEdPlayers({ ...(pack.playerOverrides || {}) });
      setEdPlayerData({ ...(pack.playerDataOverrides || {}) });
    }
    setEdSection('brand');
    setTab('editor');
  };

  const buildCurrentEditorPack = (): GameModPack | null => {
    const cleanName = edName.trim();
    if (!cleanName) return null;

    const gameBrand: ModGameBrand = {};
    if (edBrand.title?.trim() && edBrand.title.trim() !== DEFAULT_GAME_TITLE) {
      gameBrand.title = edBrand.title.trim();
    }
    if (edBrand.subtitle?.trim() && edBrand.subtitle.trim() !== DEFAULT_GAME_SUBTITLE) {
      gameBrand.subtitle = edBrand.subtitle.trim();
    }
    const cleanBrandLogo = sanitizeImageUrl(edBrand.logoUrl);
    if (cleanBrandLogo) gameBrand.logoUrl = cleanBrandLogo;

    const tierNames: Partial<Record<0 | 1 | 2 | 3, string>> = {};
    edTierNames.forEach((val, idx) => {
      const trimmed = val.trim();
      if (trimmed && trimmed !== DEFAULT_TIER_NAMES[idx]) {
        tierNames[idx as 0 | 1 | 2 | 3] = trimmed;
      }
    });

    const worldLeagueNames: Record<string, string> = {};
    Object.entries(edWorldLeagues).forEach(([code, val]) => {
      const trimmed = val.trim();
      const def = WORLD_LEAGUE_CATALOG.find((w) => w.countryCode === code)?.defaultName;
      if (trimmed && trimmed !== def) {
        worldLeagueNames[code.toUpperCase()] = trimmed;
      }
    });

    const leagueLogos: Record<string, string> = {};
    Object.entries(edLeagueLogos).forEach(([k, val]) => {
      const clean = sanitizeImageUrl(val);
      if (clean) leagueLogos[k] = clean;
    });

    const cupNames: NonNullable<GameModPack['cupNames']> = {};
    const cupMeta: NonNullable<GameModPack['cupMeta']> = {};
    CUP_KEYS.forEach(({ key }) => {
      const cur = edCupMeta[key];
      const def = DEFAULT_CUP_META[key];
      const cfg: ModCupConfig = {};
      if (cur.name?.trim() && cur.name.trim() !== def.name) {
        cfg.name = cur.name.trim();
        cupNames[key] = cur.name.trim();
      }
      if (cur.short?.trim() && cur.short.trim() !== def.short) {
        cfg.short = cur.short.trim();
      }
      if (cur.icon?.trim() && cur.icon.trim() !== def.icon) {
        cfg.icon = cur.icon.trim();
      }
      const cLogo = sanitizeImageUrl(cur.logoUrl);
      if (cLogo) cfg.logoUrl = cLogo;
      if (typeof cur.prize === 'number' && Number.isFinite(cur.prize) && cur.prize > 0 && cur.prize !== def.prize) {
        cfg.prize = Math.round(cur.prize);
      }
      if (Object.keys(cfg).length > 0) {
        cupMeta[key] = cfg;
      }
    });

    const cleanClubs: Record<string, ModClubOverride> = {};
    Object.entries(edClubs).forEach(([key, ov]) => {
      const base = catalog.find((c) => c.key === key);
      const nextOv: ModClubOverride = {};
      if (ov.name?.trim() && ov.name.trim() !== (base?.defaultName || key)) {
        nextOv.name = ov.name.trim();
      }
      if (ov.shortName?.trim()) nextOv.shortName = ov.shortName.trim();
      if (ov.stadium?.trim() && ov.stadium.trim() !== (base?.defaultStadium || '')) {
        nextOv.stadium = ov.stadium.trim();
      }
      if (ov.leagueName?.trim() && ov.leagueName.trim() !== (base?.defaultLeagueName || '')) {
        nextOv.leagueName = ov.leagueName.trim();
      }
      if (ov.countryCode?.trim() && ov.countryCode.trim() !== (base?.countryCode || '')) {
        nextOv.countryCode = ov.countryCode.trim().toUpperCase();
      }
      const cLogo = sanitizeImageUrl(ov.logoUrl);
      if (cLogo) nextOv.logoUrl = cLogo;
      if (ov.c1 && ov.c1 !== base?.defaultC1) nextOv.c1 = ov.c1;
      if (ov.c2 && ov.c2 !== base?.defaultC2) nextOv.c2 = ov.c2;
      if (typeof ov.budgetK === 'number' && Number.isFinite(ov.budgetK)) nextOv.budgetK = Math.round(ov.budgetK);
      if (typeof ov.fans === 'number' && Number.isFinite(ov.fans) && ov.fans > 0) nextOv.fans = Math.round(ov.fans);
      if (typeof ov.ovrTarget === 'number' && Number.isFinite(ov.ovrTarget)) {
        nextOv.ovrTarget = clamp(Math.round(ov.ovrTarget), 30, 99);
      }
      if (Object.keys(nextOv).length > 0) {
        cleanClubs[key] = nextOv;
      }
    });

    const cleanPlayers: Record<string, string> = {};
    Object.entries(edPlayers).forEach(([orig, next]) => {
      const o = orig.trim();
      const n = next.trim();
      if (o && n && o !== n) {
        cleanPlayers[o] = n;
      }
    });

    const cleanPlayerData: Record<string, ModPlayerOverride> = {};
    Object.entries(edPlayerData).forEach(([k, pov]) => {
      if (pov && Object.keys(pov).length > 0) {
        cleanPlayerData[k] = pov;
      }
    });

    return {
      v: 1,
      id: editingId || `mod_${Date.now()}`,
      name: cleanName,
      author: edAuthor.trim() || 'ผู้เล่น',
      version: edVersion.trim() || '1.0',
      ...(edSourceUrl.trim() ? { sourceUrl: edSourceUrl.trim() } : {}),
      ...(Object.keys(gameBrand).length > 0 ? { gameBrand } : {}),
      realism: edRealism,
      ...(Object.keys(tierNames).length > 0 ? { tierNames } : {}),
      ...(Object.keys(worldLeagueNames).length > 0 ? { worldLeagueNames } : {}),
      ...(Object.keys(leagueLogos).length > 0 ? { leagueLogos } : {}),
      ...(Object.keys(cupNames).length > 0 ? { cupNames } : {}),
      ...(Object.keys(cupMeta).length > 0 ? { cupMeta } : {}),
      clubOverrides: cleanClubs,
      ...(Object.keys(cleanPlayers).length > 0 ? { playerOverrides: cleanPlayers } : {}),
      ...(Object.keys(cleanPlayerData).length > 0 ? { playerDataOverrides: cleanPlayerData } : {})
    };
  };

  const handleInstallPreset = (presetId: string) => {
    const installed = installBuiltinModPreset(presetId, true);
    if (!installed) return;
    applyActiveModToRuntimeData(installed);
    onApplyModToState?.(installed);
    refreshStore();
    SFX.win();
    onToast(`⚽ ติดตั้งและเปิดใช้ "${installed.name}" แล้ว`);
  };

  const handleActivateMod = (mod: GameModPack | null) => {
    setActiveModId(mod?.id ?? null);
    applyActiveModToRuntimeData(mod);
    onApplyModToState?.(mod);
    refreshStore();
    if (mod) {
      SFX.win();
      onToast(`✅ เปิดใช้ Mod "${mod.name}" แล้ว`);
    } else {
      SFX.tap();
      onToast('🔄 ปิดการใช้งาน Mod และคืนค่าเริ่มต้นแล้ว');
    }
  };

  const handleSaveEditorPack = (downloadKind: 'none' | 'json' | 'xlsx' = 'none') => {
    const built = buildCurrentEditorPack();
    if (!built) {
      onToast('กรุณาระบุชื่อแพ็ก Mod');
      return;
    }

    const saved = saveInstalledMod(built, true);
    setEditingId(saved.id);
    applyActiveModToRuntimeData(saved);
    onApplyModToState?.(saved);
    refreshStore();

    if (downloadKind === 'xlsx') {
      downloadModPackXlsx(makeSafeFilename(saved.name, 'xlsx'), saved, state);
      SFX.win();
      onToast(`📊 บันทึกและส่งออก "${saved.name}.xlsx" สำหรับ Excel/Google Sheets แล้ว`);
    } else if (downloadKind === 'json') {
      downloadTextFile(makeSafeFilename(saved.name, 'json'), exportModPackJson(saved));
      SFX.win();
      onToast(`💾 บันทึกและดาวน์โหลด "${saved.name}.json" แล้ว`);
    } else {
      SFX.win();
      onToast(`✅ บันทึกและเปิดใช้ Mod "${saved.name}" แล้ว`);
      setTab('list');
    }
  };

  const handleUploadImageField = async (
    file: File | null | undefined,
    onDone: (dataUrl: string) => void
  ) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 160);
      onDone(dataUrl);
      SFX.tap();
      onToast('🖼️ อัปโหลดรูปโลโก้สำเร็จ (อย่าลืมกดบันทึก Mod)');
    } catch (err) {
      onToast(`❌ ${err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้'}`);
    }
  };

  const handleSelectImportFile = async (file: File | null | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    setImportFileName(file.name);
    setSheetError(null);
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const res = parseSpreadsheetBufferToModPack(buf, file.name);
        setBinaryImportResult(res);
        setImportText('');
        if (res.ok) SFX.tap();
      } else {
        const text = await file.text();
        setBinaryImportResult(null);
        setImportText(text);
        SFX.tap();
      }
    } catch {
      onToast('❌ ไม่สามารถอ่านไฟล์จากเครื่องได้');
    }
  };

  const handleFetchGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      setSheetError('กรุณาวางลิงก์ Google Sheets ก่อน');
      return;
    }
    setFetchingSheet(true);
    setSheetError(null);
    try {
      const res = await fetchGoogleSheetModPack(sheetUrl.trim());
      if (res.ok) {
        setBinaryImportResult(res);
        setImportFileName('Google Sheets Online');
        setImportText('');
        SFX.win();
        onToast(`📊 ดึงข้อมูลจาก Google Sheets "${res.pack.name}" สำเร็จ!`);
      } else {
        setSheetError(res.error);
      }
    } finally {
      setFetchingSheet(false);
    }
  };

  const handleInstallImportedPack = () => {
    if (!activeImportResult || !activeImportResult.ok) return;
    const saved = saveInstalledMod(activeImportResult.pack, true);
    applyActiveModToRuntimeData(saved);
    onApplyModToState?.(saved);
    refreshStore();
    setImportText('');
    setImportFileName('');
    setBinaryImportResult(null);
    setSheetError(null);
    SFX.win();
    onToast(`✅ ติดตั้งและเปิดใช้ Mod "${saved.name}" แล้ว`);
    setTab('list');
  };

  const handleApplyBatchText = () => {
    const lines = batchInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      onToast('กรุณาวางข้อความรูปแบบ ชื่อเดิม = ชื่อใหม่ ก่อน');
      return;
    }
    let count = 0;
    if (batchTarget === 'club') {
      const next = { ...edClubs };
      lines.forEach((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) return;
        const from = line.slice(0, eqIdx).trim();
        const rhs = line.slice(eqIdx + 1).trim();
        if (!from || !rhs) return;
        const parts = rhs.split('|').map((s) => s.trim());
        const matched = catalog.find(
          (c) => c.key === from || c.defaultName === from || next[c.key]?.name === from
        );
        const key = matched?.key || from;
        next[key] = {
          ...next[key],
          name: parts[0] || next[key]?.name,
          ...(parts[1] ? { stadium: parts[1] } : {})
        };
        count++;
      });
      setEdClubs(next);
    } else {
      const next = { ...edPlayers };
      lines.forEach((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) return;
        const from = line.slice(0, eqIdx).trim();
        const to = line.slice(eqIdx + 1).trim();
        if (!from || !to) return;
        next[from] = to;
        count++;
      });
      setEdPlayers(next);
    }
    if (count > 0) {
      SFX.tap();
      setBatchInput('');
      onToast(`⚡ อัปเดตชื่อสำเร็จ ${count} รายการ (อย่าลืมกดบันทึก Mod)`);
    } else {
      onToast('ไม่พบรูปแบบ ชื่อเดิม = ชื่อใหม่ ที่ถูกต้อง');
    }
  };

  const filteredWorldLeagues = useMemo(() => {
    const q = leagueQuery.trim().toLowerCase();
    if (!q) return WORLD_LEAGUE_CATALOG;
    return WORLD_LEAGUE_CATALOG.filter(
      (w) =>
        w.countryName.toLowerCase().includes(q) ||
        w.defaultName.toLowerCase().includes(q) ||
        w.countryCode.toLowerCase().includes(q) ||
        (edWorldLeagues[w.countryCode] || '').toLowerCase().includes(q)
    );
  }, [leagueQuery, edWorldLeagues]);

  const filteredCatalog = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (clubScope === 'domestic' && item.isForeign) return false;
      if (clubScope === 'foreign' && !item.isForeign) return false;
      if (!q) return true;
      const curName = edClubs[item.key]?.name || '';
      return (
        item.defaultName.toLowerCase().includes(q) ||
        curName.toLowerCase().includes(q) ||
        (item.countryName || '').toLowerCase().includes(q)
      );
    });
  }, [catalog, clubScope, clubQuery, edClubs]);

  const activePlayerTeam = useMemo(() => {
    if (!state?.teams?.length) return null;
    const key = playerTeamKey || state.teams[state.me]?.origName || state.teams[state.me]?.name || '';
    return (
      state.teams.find((t) => (t.origName || t.name) === key) ||
      state.teams[state.me] ||
      state.teams[0] ||
      null
    );
  }, [state, playerTeamKey]);

  const filteredTeamPlayers = useMemo(() => {
    if (!activePlayerTeam) return [];
    const q = playerQuery.trim().toLowerCase();
    return activePlayerTeam.sq.filter((pl) => {
      const origP = pl.origName || pl.n;
      const compKey = `${activePlayerTeam.origName || activePlayerTeam.name}::${origP}`;
      const pov = edPlayerData[compKey] || edPlayerData[origP];
      if (!q) return true;
      return (
        origP.toLowerCase().includes(q) ||
        pl.n.toLowerCase().includes(q) ||
        (pov?.name || '').toLowerCase().includes(q) ||
        pl.pos.toLowerCase().includes(q) ||
        pl.ro.toLowerCase().includes(q)
      );
    });
  }, [activePlayerTeam, playerQuery, edPlayerData]);

  const previewBrandLogo = sanitizeImageUrl(edBrand.logoUrl);

  if (!isAuthorized) {
    return (
      <VipOfficeScannerGate
        icon="fingerprint"
        heading="สแกนลายนิ้วมือ"
        subHeading="ยืนยันรหัสผ่าน"
        unlockToast="🔓 ยืนยันตัวตนสำเร็จ"
        grantedLabel="ยืนยันสิทธิ์สำเร็จ กำลังเปิดใช้งาน..."
        zIndexClass="z-[72]"
        onUnlock={handleUnlock}
        onClose={onClose}
        onToast={onToast}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-manager-title"
    >
      <div className="w-full max-w-4xl max-h-[calc(var(--app-dvh,1dvh)*95)] rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 sm:px-5 sm:py-3 mland:px-3 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 text-[#9a6700] dark:text-[var(--lamp)] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 id="mod-manager-title" className="font-bold text-sm sm:text-base mland:text-xs font-display text-[var(--ink)] truncate">
                จัดการ Mod &amp; Data Pack (Excel / Google Sheets / JSON)
              </h3>
              <p className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                ปรับชื่อ &amp; โลโก้เกม ลีกทั่วโลก บอลถ้วย สโมสร โลโก้ทีม และค่าพลังนักเตะให้สมจริง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                handleLock();
              }}
              title="ล็อกหน้าต่างนี้"
              className="h-9 mland:h-7 px-2.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] text-[11px] mland:text-[9.5px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Lock className="w-3.5 h-3.5 mland:w-3 mland:h-3" />
              <span className="hidden sm:inline">ล็อก</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง Mod"
              className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </button>
          </div>
        </header>

        {/* Active Status + Main Tabs */}
        <div className="shrink-0 px-4 py-2 sm:px-5 mland:px-3 mland:py-1.5 border-b border-[var(--line)]/70 bg-[var(--surface-2)]/45 space-y-2 mland:space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-[var(--mut)] font-semibold shrink-0">สถานะปัจจุบัน:</span>
              {activeMod ? (
                <span className="font-extrabold text-[var(--g)] truncate flex items-center gap-1.5">
                  {sanitizeImageUrl(activeMod.gameBrand?.logoUrl) && (
                    <img
                      src={sanitizeImageUrl(activeMod.gameBrand?.logoUrl)}
                      alt=""
                      className="w-4 h-4 rounded object-contain shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <span className="truncate">
                    ✓ เปิดใช้ "{activeMod.name}" (v{activeMod.version || '1.0'} · {Object.keys(activeMod.clubOverrides || {}).length} ทีม)
                  </span>
                </span>
              ) : (
                <span className="font-bold text-[var(--ink)]">ค่าเริ่มต้นของเกม (ไม่ได้เปิดใช้ Mod)</span>
              )}
            </div>
            {activeMod && (
              <button
                type="button"
                onClick={() => handleActivateMod(null)}
                className="btn btn-xs btn-surface text-[var(--red)] border-[var(--red)]/35 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ปิด Mod (กลับค่าเดิม)</span>
              </button>
            )}
          </div>

          <div className="seg-bar grid grid-cols-3 w-full">
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('list'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'list' ? 'seg-btn-active' : ''}`}
            >
              📦 แพ็ก Mod ({mods.length})
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('import'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'import' ? 'seg-btn-active' : ''}`}
            >
              📊 Excel / Google Sheets
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('editor'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'editor' ? 'seg-btn-active' : ''}`}
            >
              ✏️ สร้าง / แก้ไขในเกม
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 mland:px-3 mland:py-2 space-y-3 mland:space-y-2">
          {/* TAB 1: MOD LIST */}
          {tab === 'list' && (
            <div className="space-y-3">
              {/* Built-in Realistic Football Mod Presets */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/45 border border-[var(--lamp)]/45 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    ⚽ แพ็ก Mod ฟุตบอลสมจริงสำเร็จรูป (ติดตั้งใน 1 คลิก)
                  </div>
                  <span className="text-[10px] text-[var(--mut)] font-semibold">ส่งออกไปแก้ต่อใน Excel ได้</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUILTIN_REALISTIC_MOD_PRESETS.map((preset) => {
                    const installedCopy = mods.find((m) => m.id === preset.id);
                    const isPresetActive = activeId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 ${
                          isPresetActive
                            ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/60'
                            : 'bg-[var(--surface)]/90 border-[var(--line)]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-extrabold text-[var(--ink)] leading-snug">{preset.name}</div>
                          <p className="text-[10.5px] text-[var(--mut)] leading-relaxed">{preset.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] font-bold text-[var(--g)]">
                            {isPresetActive ? '✓ เปิดใช้งานอยู่' : installedCopy ? 'ติดตั้งแล้ว' : 'พร้อมติดตั้ง'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInstallPreset(preset.id)}
                            className={`btn btn-xs whitespace-nowrap ${isPresetActive ? 'btn-surface' : 'btn-gold'}`}
                          >
                            {isPresetActive ? 'อัปเดตค่าแนะนำ' : installedCopy ? 'เปิดใช้งาน' : 'ติดตั้ง & เปิดใช้'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {mods.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/50 p-4 mland:p-3 text-center space-y-2">
                  <div className="text-xs sm:text-sm mland:text-xs font-bold text-[var(--ink)]">
                    ยังไม่มี Mod ที่ปรับแต่งเอง
                  </div>
                  <p className="text-[11px] mland:text-[10px] text-[var(--mut)] max-w-lg mx-auto leading-relaxed">
                    ดาวน์โหลดแม่แบบ <strong>Excel (.xlsx)</strong> ไปเปิดแก้ใน Microsoft Excel หรือ Google Sheets เพื่อปรับชื่อ/โลโก้เกม ลีกทั่วโลก บอลถ้วย สโมสร และค่าพลังนักเตะ แล้วนำเข้ากลับมาใช้ได้เลย
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setTab('import');
                      }}
                      className="btn btn-sm btn-gold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>ใช้แม่แบบ Excel / Google Sheets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        loadPackIntoEditor(null);
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>สร้าง Mod ในเกม</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {mods.map((mod) => {
                    const isActive = mod.id === activeId;
                    const tierCount = Object.keys(mod.tierNames || {}).length;
                    const worldCount = Object.keys(mod.worldLeagueNames || {}).length;
                    const cupCount = Math.max(
                      Object.keys(mod.cupNames || {}).length,
                      Object.keys(mod.cupMeta || {}).length
                    );
                    const clubCount = Object.keys(mod.clubOverrides || {}).length;
                    const playerCount = Math.max(
                      Object.keys(mod.playerOverrides || {}).length,
                      Object.keys(mod.playerDataOverrides || {}).length
                    );
                    const hasRealism = Boolean(
                      mod.realism?.disableSupernatural || mod.realism?.realisticScoring || mod.realism?.realisticFatigue
                    );
                    const modLogo = sanitizeImageUrl(mod.gameBrand?.logoUrl);

                    return (
                      <div
                        key={mod.id}
                        className={`p-3 mland:p-2 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 ${
                          isActive
                            ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/60'
                            : 'bg-[var(--surface-2)]/55 border-[var(--line)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2.5">
                          {modLogo && (
                            <img
                              src={modLogo}
                              alt=""
                              className="w-8 h-8 rounded-lg object-contain bg-[var(--surface)] border border-[var(--line)] shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)] truncate">
                                {mod.name}
                              </span>
                              <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                                v{mod.version || '1.0'} · โดย {mod.author || 'ผู้เล่น'}
                              </span>
                            </div>
                            <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular flex flex-wrap gap-x-1.5">
                              {hasRealism && <span>⚽ สมจริง</span>}
                              {mod.gameBrand?.title && <span>🏷️ แบรนด์เกม</span>}
                              <span>ลีก {tierCount + worldCount}</span>
                              <span>· ถ้วย {cupCount}</span>
                              <span>· สโมสร {clubCount} ทีม</span>
                              {playerCount > 0 && <span>· นักเตะ {playerCount} คน</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap shrink-0">
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (state && onApplyModToState) {
                                  handleActivateMod(mod);
                                } else {
                                  handleActivateMod(null);
                                }
                              }}
                              className="btn btn-xs btn-primary whitespace-nowrap"
                            >
                              <Check className="w-3 h-3" />
                              <span>{state ? 'อัปเดตลงเซฟนี้' : 'กำลังใช้งาน'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateMod(mod)}
                              className="btn btn-xs btn-gold whitespace-nowrap"
                            >
                              เปิดใช้งาน
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              loadPackIntoEditor(mod);
                            }}
                            title="แก้ไข Mod นี้ในตัวเกม"
                            className="btn btn-xs btn-surface whitespace-nowrap"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>แก้ไข</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              downloadModPackXlsx(makeSafeFilename(mod.name, 'xlsx'), mod, state);
                              onToast(`📊 ส่งออก "${mod.name}.xlsx" แล้ว (เปิดใน Excel/Google Sheets ได้เลย)`);
                            }}
                            title="ส่งออกเป็นไฟล์ Excel (.xlsx)"
                            className="btn btn-xs btn-surface whitespace-nowrap text-emerald-700 dark:text-emerald-300"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>.xlsx</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              downloadTextFile(makeSafeFilename(mod.name, 'json'), exportModPackJson(mod));
                              onToast(`⬇️ ส่งออก "${mod.name}.json" แล้ว`);
                            }}
                            title="ดาวน์โหลดไฟล์ .json"
                            className="btn btn-xs btn-surface whitespace-nowrap"
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              const wasActive = mod.id === activeId;
                              deleteInstalledMod(mod.id);
                              if (wasActive && onApplyModToState) {
                                onApplyModToState(null);
                              }
                              refreshStore();
                              onToast(`🗑️ ลบ Mod "${mod.name}" แล้ว`);
                            }}
                            title="ลบ Mod นี้"
                            className="btn btn-xs btn-danger whitespace-nowrap"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXCEL / GOOGLE SHEETS / JSON */}
          {tab === 'import' && (
            <div className="space-y-3 mland:space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = '';
                  void handleSelectImportFile(file);
                }}
              />

              {/* Multi-Sheet Excel / Google Sheets Template Box */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/50 border border-[var(--lamp)]/50 flex flex-wrap items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>แม่แบบ Mod สำหรับ Excel &amp; Google Sheets (.xlsx 6 ชีต)</span>
                  </div>
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-relaxed">
                    มีครบ 6 แท็บ: <strong>Game_Brand</strong> (ชื่อ/โลโก้เกม), <strong>Leagues</strong> (ลีกในประเทศ+ทั่วโลก), <strong>Cups</strong> (บอลถ้วย+รางวัล), <strong>Clubs</strong> (ทุกสโมสร+โลโก้+สีเสื้อ+งบ), <strong>Players</strong> ({state?.teams?.length ? 'ดึงนักเตะ+ค่าพลังจากเซฟปัจจุบันให้ครบ!' : 'ตัวอย่าง+คอลัมน์ค่าพลัง'}) และ <strong>Guide</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      const tpl = buildTemplateModPack(state);
                      downloadModPackXlsx('looknang_mod_template.xlsx', tpl, state);
                      onToast('📊 ดาวน์โหลดแม่แบบ looknang_mod_template.xlsx แล้ว (อัปโหลดเข้า Google Sheets หรือเปิดใน Excel ได้ทันที)');
                    }}
                    className="btn btn-xs btn-gold whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลดแม่แบบ .xlsx</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      const tpl = buildTemplateModPack(state);
                      downloadTextFile('looknang_mod_template.json', exportModPackJson(tpl));
                      onToast('⬇️ ดาวน์โหลด looknang_mod_template.json แล้ว');
                    }}
                    className="btn btn-xs btn-surface whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    <span>.json</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const json = exportModPackJson(buildTemplateModPack(state));
                      try {
                        await navigator.clipboard.writeText(json);
                        SFX.tap();
                        onToast('📋 คัดลอกแม่แบบ JSON แล้ว');
                      } catch {
                        setBinaryImportResult(null);
                        setImportText(json);
                        onToast('วางแม่แบบลงในช่องด้านล่างให้แล้ว');
                      }
                    }}
                    className="btn btn-xs btn-surface whitespace-nowrap"
                  >
                    <Copy className="w-3 h-3" />
                    <span>คัดลอก JSON</span>
                  </button>
                </div>
              </div>

              {/* Google Sheets Link Importer */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--g-soft)]/35 border border-[var(--g)]/35 space-y-2">
                <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-[var(--g)] shrink-0" />
                  <span>นำเข้าโดยตรงจากลิงก์ Google Sheets</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => {
                      setSheetUrl(e.target.value);
                      setSheetError(null);
                    }}
                    placeholder="วางลิงก์ https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 min-w-0 h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] text-[var(--ink)]"
                  />
                  <button
                    type="button"
                    disabled={fetchingSheet}
                    onClick={() => void handleFetchGoogleSheet()}
                    className="btn btn-xs btn-primary h-8 mland:h-7 px-3 whitespace-nowrap shrink-0"
                  >
                    {fetchingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>{fetchingSheet ? 'กำลังดึงข้อมูล...' : 'ดึงจาก Google Sheets'}</span>
                  </button>
                </div>
                <p className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-relaxed">
                  วิธีใช้ Google Sheets: อัปโหลดไฟล์แม่แบบ <strong>.xlsx</strong> เข้า Google Drive &gt; เปิดด้วย Google Sheets &gt; กด <strong>แชร์ (ทุกคนที่มีลิงก์ดูได้)</strong> หรือ <strong>ไฟล์ &gt; แชร์ &gt; เผยแพร่ทางเว็บ (.xlsx)</strong> แล้ววางลิงก์ด้านบน (หรือดาวน์โหลดเป็น .xlsx มาอัปโหลดด้านล่างก็ได้ 100%)
                </p>
                {sheetError && (
                  <div className="p-2 rounded-lg bg-[var(--red-soft)]/50 border border-[var(--red)]/40 text-[11px] text-[var(--red)] font-semibold leading-relaxed">
                    ❌ {sheetError}
                  </div>
                )}
              </div>

              {/* File Upload + Paste Box */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)] truncate">
                    {importFileName ? `ไฟล์ที่เลือก: ${importFileName}` : 'อัปโหลดไฟล์ .xlsx / .csv / .json หรือวางข้อมูลจากตาราง'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      fileInputRef.current?.click();
                    }}
                    className="btn btn-xs btn-primary shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>เลือกไฟล์ (.xlsx / .csv / .json)</span>
                  </button>
                </div>

                <textarea
                  value={importText}
                  onChange={(e) => {
                    setImportFileName('');
                    setBinaryImportResult(null);
                    setImportText(e.target.value);
                  }}
                  rows={4}
                  placeholder="หรือวางโค้ด JSON / CSV / ก๊อปปี้ตาราง (Ctrl+C / Ctrl+V) จาก Google Sheets หรือ Excel มาวางที่นี่ได้เลย..."
                  className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[11px] font-mono text-[var(--ink)]"
                />

                {activeImportResult && !activeImportResult.ok && (
                  <div className="text-[11px] text-[var(--red)] font-semibold">
                    ❌ {activeImportResult.error}
                  </div>
                )}

                {activeImportResult && activeImportResult.ok && (
                  <div className="p-2.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/45 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-extrabold text-[var(--ink)] truncate flex items-center gap-1.5">
                        {sanitizeImageUrl(activeImportResult.pack.gameBrand?.logoUrl) && (
                          <img
                            src={sanitizeImageUrl(activeImportResult.pack.gameBrand?.logoUrl)}
                            alt=""
                            className="w-5 h-5 rounded object-contain bg-white/80 shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <span className="truncate">
                          ✓ พร้อมติดตั้ง: {activeImportResult.pack.name} (v{activeImportResult.pack.version || '1.0'})
                        </span>
                      </div>
                      <div className="text-[10.5px] text-[var(--mut)] tabular flex flex-wrap gap-x-2">
                        {activeImportResult.summary.hasGameBrand && <span>🏷️ ชื่อ/โลโก้เกม</span>}
                        <span>ลีกในประเทศ {activeImportResult.summary.tierCount}</span>
                        <span>ลีกโลก {activeImportResult.summary.worldLeagueCount}</span>
                        <span>บอลถ้วย {activeImportResult.summary.cupCount}</span>
                        <span>สโมสร {activeImportResult.summary.clubCount} ทีม</span>
                        <span>นักเตะ/พลัง {activeImportResult.summary.playerCount} คน</span>
                        {activeImportResult.summary.sheetsRead.length > 0 && (
                          <span className="opacity-75">({activeImportResult.summary.sheetsRead.join(', ')})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          loadPackIntoEditor(activeImportResult.pack);
                        }}
                        className="btn btn-xs btn-surface"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>ตรวจแก้ต่อ</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleInstallImportedPack}
                        className="btn btn-sm btn-primary"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ติดตั้งและเปิดใช้งาน</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: IN-GAME EDITOR */}
          {tab === 'editor' && (
            <div className="space-y-2.5 mland:space-y-1.5">
              {/* Sub-section selector */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)]">
                {(
                  [
                    { id: 'brand', label: '🏷️ เกม & กติกา', icon: Sparkles },
                    { id: 'leagues', label: '🌍 ลีกทั่วโลก', icon: Globe },
                    { id: 'cups', label: '🏆 บอลถ้วย', icon: Trophy },
                    { id: 'clubs', label: '🛡️ สโมสร & โลโก้', icon: Shield },
                    { id: 'players', label: '👤 นักเตะ & พลัง', icon: UserCheck }
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      setEdSection(id);
                    }}
                    className={`flex-1 min-w-[92px] py-1.5 mland:py-1 px-2 rounded-lg text-[11px] mland:text-[9.5px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                      edSection === id
                        ? 'bg-[var(--g)] text-white shadow-xs'
                        : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/75'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* SECTION 1: GAME BRAND & REALISM */}
              {edSection === 'brand' && (
                <div className="space-y-2.5">
                  {/* Pack Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mland:gap-1.5">
                    <label className="space-y-0.5">
                      <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">ชื่อแพ็ก Mod</span>
                      <input
                        type="text"
                        value={edName}
                        onChange={(e) => setEdName(e.target.value)}
                        className="w-full h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-bold text-[var(--ink)]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">ผู้สร้าง</span>
                      <input
                        type="text"
                        value={edAuthor}
                        onChange={(e) => setEdAuthor(e.target.value)}
                        className="w-full h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] text-[var(--ink)]"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">เวอร์ชัน</span>
                      <input
                        type="text"
                        value={edVersion}
                        onChange={(e) => setEdVersion(e.target.value)}
                        className="w-full h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] tabular text-[var(--ink)]"
                      />
                    </label>
                  </div>

                  {/* Game Title & Logo */}
                  <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                    <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--g)]" />
                      <span>ตั้งชื่อเกมและโลโก้ของเกม (แสดงในหน้าเข้าเกม &amp; เมนูหลัก)</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      <div className="w-16 h-16 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center overflow-hidden shrink-0">
                        {previewBrandLogo ? (
                          <img
                            src={previewBrandLogo}
                            alt="โลโก้เกม"
                            className="w-full h-full object-contain p-1"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-[10px] text-[var(--mut)] text-center px-1">โลโก้เดิม</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <label className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-[var(--mut)]">ชื่อเกมหลัก</span>
                          <input
                            type="text"
                            value={edBrand.title ?? ''}
                            placeholder={DEFAULT_GAME_TITLE}
                            onChange={(e) => setEdBrand((p) => ({ ...p, title: e.target.value }))}
                            className="w-full h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold text-[var(--ink)]"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-[var(--mut)]">คำโปรยใต้ชื่อเกม</span>
                          <input
                            type="text"
                            value={edBrand.subtitle ?? ''}
                            placeholder={DEFAULT_GAME_SUBTITLE}
                            onChange={(e) => setEdBrand((p) => ({ ...p, subtitle: e.target.value }))}
                            className="w-full h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--ink)]"
                          />
                        </label>
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5">
                          <input
                            type="text"
                            value={edBrand.logoUrl ?? ''}
                            placeholder="วางลิงก์รูปโลโก้เกม (https://...) หรือกดอัปโหลดรูปด้านขวา"
                            onChange={(e) => setEdBrand((p) => ({ ...p, logoUrl: e.target.value }))}
                            className="flex-1 min-w-[180px] h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)]"
                          />
                          <label className="btn btn-xs btn-secondary cursor-pointer h-8 px-2.5 inline-flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>อัปโหลดโลโก้</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.currentTarget.value = '';
                                void handleUploadImageField(f, (url) => setEdBrand((p) => ({ ...p, logoUrl: url })));
                              }}
                            />
                          </label>
                          {edBrand.logoUrl && (
                            <button
                              type="button"
                              onClick={() => setEdBrand((p) => ({ ...p, logoUrl: '' }))}
                              className="btn btn-xs btn-surface text-[var(--red)] h-8"
                            >
                              ล้างรูป
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Realism Rules */}
                  <div className="p-3 mland:p-2 rounded-xl bg-[var(--g-soft)]/35 border border-[var(--g)]/35 space-y-2">
                    <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                      ⚽ กติกาและความสมจริงของฟุตบอล (Realism Rules)
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-xs mland:text-[10px]">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edRealism.disableSupernatural}
                          onChange={(e) => setEdRealism((p) => ({ ...p, disableSupernatural: e.target.checked }))}
                          className="mt-0.5 accent-[var(--g)]"
                        />
                        <span className="text-[var(--ink)] font-semibold">
                          ตัดเหตุการณ์แฟนตาซี <span className="text-[var(--mut)] font-normal">(ปิดฟ้าผ่า +50, พรสิ่งศักดิ์สิทธิ์ และปาฏิหาริย์พลิกนรก)</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edRealism.realisticScoring}
                          onChange={(e) => setEdRealism((p) => ({ ...p, realisticScoring: e.target.checked }))}
                          className="mt-0.5 accent-[var(--g)]"
                        />
                        <span className="text-[var(--ink)] font-semibold">
                          สมดุลสกอร์และ xG สมจริง <span className="text-[var(--mut)] font-normal">(สกอร์เฉลี่ยใกล้เคียงลีกจริง แท็กติกและ OVR ตัดสินผลชัด)</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edRealism.realisticFatigue}
                          onChange={(e) => setEdRealism((p) => ({ ...p, realisticFatigue: e.target.checked }))}
                          className="mt-0.5 accent-[var(--g)]"
                        />
                        <span className="text-[var(--ink)] font-semibold">
                          ความล้าและการโรเตชั่นสมจริง <span className="text-[var(--mut)] font-normal">(นักเตะล้าท้ายเกมส่งผลต่อฟอร์มและจำเป็นต้องหมุนเวียนตัว)</span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: DOMESTIC & WORLD LEAGUES */}
              {edSection === 'leagues' && (
                <div className="space-y-2.5">
                  <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                    <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                      🏆 ชื่อ &amp; โลโก้ลีกหลักในเกมทั้ง 4 ระดับ
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {([0, 1, 2, 3] as const).map((tierIdx) => {
                        const logoKey = `tier_${tierIdx}`;
                        const curLogo = sanitizeImageUrl(edLeagueLogos[logoKey]);
                        return (
                          <div key={tierIdx} className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[var(--mut)] font-semibold">
                                ระดับ {tierIdx + 1} (เดิม: {DEFAULT_TIER_NAMES[tierIdx]})
                              </span>
                              {curLogo && (
                                <img
                                  src={curLogo}
                                  alt=""
                                  className="w-4 h-4 object-contain rounded-xs"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                            </div>
                            <input
                              type="text"
                              value={edTierNames[tierIdx]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEdTierNames((prev) => {
                                  const next = [...prev] as [string, string, string, string];
                                  next[tierIdx] = val;
                                  return next;
                                });
                              }}
                              className="w-full h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs font-semibold text-[var(--ink)]"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={edLeagueLogos[logoKey] ?? ''}
                                placeholder="ลิงก์โลโก้ลีก (ไม่บังคับ)"
                                onChange={(e) => setEdLeagueLogos((p) => ({ ...p, [logoKey]: e.target.value }))}
                                className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-[var(--ink)]"
                              />
                              <label className="btn btn-xs btn-surface cursor-pointer h-7 px-2">
                                <Upload className="w-3 h-3" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.currentTarget.value = '';
                                    void handleUploadImageField(f, (url) => setEdLeagueLogos((p) => ({ ...p, [logoKey]: url })));
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* World Leagues */}
                  <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                        🌍 ชื่อ &amp; โลโก้ลีกต่างๆ ทั่วโลก ({filteredWorldLeagues.length} ประเทศ)
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={leagueQuery}
                          onChange={(e) => setLeagueQuery(e.target.value)}
                          placeholder="ค้นหาประเทศ/รหัส (GB, ES, JP...)"
                          className="h-7 pl-7 pr-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)] w-48"
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {filteredWorldLeagues.map((wl) => {
                        const logoVal = edLeagueLogos[wl.countryCode] ?? '';
                        const cleanLogo = sanitizeImageUrl(logoVal);
                        return (
                          <div
                            key={wl.countryCode}
                            className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 grid grid-cols-1 sm:grid-cols-[135px_1fr_1fr] gap-1.5 items-center"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {cleanLogo ? (
                                <img
                                  src={cleanLogo}
                                  alt=""
                                  className="w-4 h-4 object-contain shrink-0 rounded-xs"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="shrink-0">{wl.flag}</span>
                              )}
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-[var(--ink)] truncate">{wl.countryName}</div>
                                <div className="text-[9.5px] text-[var(--mut)]">{wl.countryCode} · {wl.tierHint}</div>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={edWorldLeagues[wl.countryCode] ?? ''}
                              placeholder={wl.defaultName}
                              onChange={(e) =>
                                setEdWorldLeagues((prev) => ({ ...prev, [wl.countryCode]: e.target.value }))
                              }
                              className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={logoVal}
                                placeholder="URL โลโก้ลีก..."
                                onChange={(e) =>
                                  setEdLeagueLogos((prev) => ({ ...prev, [wl.countryCode]: e.target.value }))
                                }
                                className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-[var(--ink)]"
                              />
                              <label className="btn btn-xs btn-surface cursor-pointer h-7 px-2">
                                <Upload className="w-3 h-3" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.currentTarget.value = '';
                                    void handleUploadImageField(f, (url) =>
                                      setEdLeagueLogos((prev) => ({ ...prev, [wl.countryCode]: url }))
                                    );
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: CUPS */}
              {edSection === 'cups' && (
                <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    🏆 ปรับแต่งรายการฟุตบอลถ้วย (ชื่อ ตัวย่อ ไอคอน เงินรางวัล และโลโก้ถ้วย)
                  </div>
                  <div className="space-y-2">
                    {CUP_KEYS.map(({ key, label }) => {
                      const cur = edCupMeta[key];
                      const def = DEFAULT_CUP_META[key];
                      const cleanLogo = sanitizeImageUrl(cur.logoUrl);
                      const patchCup = (patch: Partial<ModCupConfig>) => {
                        setEdCupMeta((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], ...patch }
                        }));
                      };
                      return (
                        <div key={key} className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink)]">
                              {cleanLogo ? (
                                <img
                                  src={cleanLogo}
                                  alt=""
                                  className="w-5 h-5 object-contain rounded-xs"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span>{cur.icon || def.icon}</span>
                              )}
                              <span>{label}</span>
                            </div>
                            <span className="text-[10px] text-[var(--mut)]">รางวัลเดิม {def.prize.toLocaleString()} พัน฿</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_70px_110px] gap-1.5">
                            <input
                              type="text"
                              value={cur.name ?? ''}
                              placeholder={`ชื่อถ้วย (${def.name})`}
                              onChange={(e) => patchCup({ name: e.target.value })}
                              className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] font-semibold text-[var(--ink)]"
                            />
                            <input
                              type="text"
                              value={cur.short ?? ''}
                              placeholder={`ชื่อย่อ (${def.short})`}
                              onChange={(e) => patchCup({ short: e.target.value })}
                              className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                            />
                            <input
                              type="text"
                              value={cur.icon ?? ''}
                              placeholder={def.icon}
                              title="ไอคอนอีโมจิ"
                              onChange={(e) => patchCup({ icon: e.target.value })}
                              className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-center text-[var(--ink)]"
                            />
                            <input
                              type="number"
                              min={10}
                              max={999999}
                              value={cur.prize ?? def.prize}
                              title="เงินรางวัลแชมป์ (หน่วย: พันบาท)"
                              onChange={(e) => patchCup({ prize: Number(e.target.value) || def.prize })}
                              className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] tabular text-[var(--ink)]"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={cur.logoUrl ?? ''}
                              placeholder="วางลิงก์รูปโลโก้ถ้วย (https://...) หรืออัปโหลด"
                              onChange={(e) => patchCup({ logoUrl: e.target.value })}
                              className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-[var(--ink)]"
                            />
                            <label className="btn btn-xs btn-surface cursor-pointer h-7 px-2">
                              <Upload className="w-3 h-3" />
                              <span>อัปโหลด</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.currentTarget.value = '';
                                  void handleUploadImageField(f, (url) => patchCup({ logoUrl: url }));
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 4: CLUBS & LOGOS */}
              {edSection === 'clubs' && (
                <div className="space-y-2.5">
                  <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                        🛡️ แก้ไขสโมสร โลโก้ทีม สนาม ลีก งบประมาณ และสีชุด ({filteredCatalog.length} ทีม)
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="seg-bar bg-[var(--surface)]">
                          {([
                            ['all', 'ทั้งหมด'],
                            ['domestic', 'ในประเทศ'],
                            ['foreign', 'ต่างชาติ']
                          ] as const).map(([k, lbl]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setClubScope(k)}
                              className={`seg-btn py-0.5 px-2 text-[10px] ${clubScope === k ? 'seg-btn-active' : ''}`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={clubQuery}
                            onChange={(e) => setClubQuery(e.target.value)}
                            placeholder="ค้นหาชื่อทีม..."
                            className="h-7 pl-7 pr-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)] w-36 sm:w-44"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="max-h-64 mland:max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {filteredCatalog.slice(0, 120).map((item) => {
                        const cur = edClubs[item.key] || {};
                        const cleanLogo = sanitizeImageUrl(cur.logoUrl);
                        const patchClub = (patch: Partial<ModClubOverride>) => {
                          setEdClubs((prev) => ({
                            ...prev,
                            [item.key]: {
                              ...prev[item.key],
                              ...patch
                            }
                          }));
                        };
                        return (
                          <div
                            key={item.key}
                            className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 space-y-1.5"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_1fr_auto] gap-1.5 items-center">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {cleanLogo ? (
                                  <img
                                    src={cleanLogo}
                                    alt=""
                                    className="w-6 h-6 object-contain rounded bg-[var(--surface-2)] border border-[var(--line)] shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <span
                                    className="w-5 h-5 rounded-full border border-white/40 shrink-0"
                                    style={{ background: `linear-gradient(135deg, ${cur.c1 || item.defaultC1} 50%, ${cur.c2 || item.defaultC2} 50%)` }}
                                  />
                                )}
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-[var(--ink)] truncate">
                                    {item.countryFlag ? `${item.countryFlag} ` : ''}{item.defaultName}
                                  </div>
                                  <div className="text-[9.5px] text-[var(--mut)] truncate">
                                    {item.countryName || DEFAULT_TIER_NAMES[item.tier] || `Tier ${item.tier + 1}`}
                                  </div>
                                </div>
                              </div>

                              <input
                                type="text"
                                value={cur.name ?? ''}
                                placeholder={`ชื่อใหม่ (${item.defaultName})`}
                                onChange={(e) => patchClub({ name: e.target.value })}
                                className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                              />

                              <input
                                type="text"
                                value={cur.stadium ?? ''}
                                placeholder={`สนาม (${item.defaultStadium})`}
                                onChange={(e) => patchClub({ stadium: e.target.value })}
                                className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                              />

                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="color"
                                  title="สีชุดหลัก"
                                  value={cur.c1 || item.defaultC1}
                                  onChange={(e) => patchClub({ c1: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded border border-[var(--line)] bg-transparent cursor-pointer"
                                />
                                <input
                                  type="color"
                                  title="สีชุดรอง"
                                  value={cur.c2 || item.defaultC2}
                                  onChange={(e) => patchClub({ c2: e.target.value })}
                                  className="w-7 h-7 p-0.5 rounded border border-[var(--line)] bg-transparent cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-[110px_1fr_90px_90px_80px_auto] gap-1.5 items-center">
                              <input
                                type="text"
                                value={cur.shortName ?? ''}
                                placeholder="ชื่อย่อ (3-4 ตัว)"
                                onChange={(e) => patchClub({ shortName: e.target.value })}
                                className="h-6.5 px-2 rounded bg-[var(--surface-2)]/60 border border-[var(--line)] text-[10.5px] text-[var(--ink)]"
                              />
                              <input
                                type="text"
                                value={cur.logoUrl ?? ''}
                                placeholder="URL โลโก้สโมสร..."
                                onChange={(e) => patchClub({ logoUrl: e.target.value })}
                                className="h-6.5 px-2 rounded bg-[var(--surface-2)]/60 border border-[var(--line)] text-[10.5px] text-[var(--ink)]"
                              />
                              <input
                                type="number"
                                value={cur.budgetK ?? ''}
                                placeholder="งบ (พัน฿)"
                                title="งบสโมสร (หน่วย: พันบาท)"
                                onChange={(e) => patchClub({ budgetK: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-6.5 px-2 rounded bg-[var(--surface-2)]/60 border border-[var(--line)] text-[10.5px] tabular text-[var(--ink)]"
                              />
                              <input
                                type="number"
                                value={cur.fans ?? ''}
                                placeholder="ฐานแฟน"
                                title="จำนวนแฟนบอล"
                                onChange={(e) => patchClub({ fans: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-6.5 px-2 rounded bg-[var(--surface-2)]/60 border border-[var(--line)] text-[10.5px] tabular text-[var(--ink)]"
                              />
                              <input
                                type="number"
                                min={30}
                                max={99}
                                value={cur.ovrTarget ?? ''}
                                placeholder="OVR ทีม"
                                title="ปรับค่าเฉลี่ย OVR ของทีม (30-99)"
                                onChange={(e) => patchClub({ ovrTarget: e.target.value === '' ? undefined : Number(e.target.value) })}
                                className="h-6.5 px-2 rounded bg-[var(--surface-2)]/60 border border-[var(--line)] text-[10.5px] tabular text-[var(--ink)]"
                              />
                              <label className="btn btn-xs btn-surface cursor-pointer h-6.5 px-2 justify-center">
                                <Upload className="w-3 h-3" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.currentTarget.value = '';
                                    void handleUploadImageField(f, (url) => patchClub({ logoUrl: url }));
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                      {filteredCatalog.length > 120 && (
                        <div className="text-center text-[10.5px] text-[var(--mut)] py-1">
                          แสดง 120 รายการแรก — พิมพ์ค้นหาชื่อทีมเพื่อกรองเฉพาะทีมที่ต้องการ หรือส่งออก Excel เพื่อแก้ทั้งหมดพร้อมกัน
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Batch Rename */}
                  <div className="p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-extrabold text-[var(--ink)]">
                        ⚡ แก้ชื่อด่วนทีละหลายรายการ (ชื่อเดิม = ชื่อใหม่)
                      </div>
                      <div className="seg-bar bg-[var(--surface)]">
                        <button
                          type="button"
                          onClick={() => setBatchTarget('club')}
                          className={`seg-btn py-0.5 px-2 text-[10px] ${batchTarget === 'club' ? 'seg-btn-active' : ''}`}
                        >
                          สโมสร
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchTarget('player')}
                          className={`seg-btn py-0.5 px-2 text-[10px] ${batchTarget === 'player' ? 'seg-btn-active' : ''}`}
                        >
                          นักเตะ
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      rows={2}
                      placeholder={
                        batchTarget === 'club'
                          ? 'ตัวอย่าง: ลอนดอน รอยัล เอฟซี = เชลซี เอฟซี | สแตมฟอร์ด บริดจ์'
                          : 'ตัวอย่าง: ชื่อนักเตะเดิม = ชื่อนักเตะใหม่'
                      }
                      className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-mono text-[var(--ink)]"
                    />
                    <div className="flex justify-end">
                      <button type="button" onClick={handleApplyBatchText} className="btn btn-xs btn-secondary">
                        นำเข้าบรรทัดนี้เข้า Mod
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: PLAYERS & STATS/ATTRIBUTES */}
              {edSection === 'players' && (
                <div className="space-y-2.5">
                  {state && state.teams && state.teams.length > 0 ? (
                    <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                          👤 แก้ไขนักเตะ ตำแหน่ง เบอร์เสื้อ อายุ และค่าพลัง 5 ด้าน (ยิง/จ่าย/เลี้ยง/แย่ง/กาย)
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            value={activePlayerTeam ? (activePlayerTeam.origName || activePlayerTeam.name) : ''}
                            onChange={(e) => setPlayerTeamKey(e.target.value)}
                            className="h-7 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-semibold text-[var(--ink)] max-w-[200px]"
                          >
                            {state.teams
                              .slice()
                              .sort((a, b) => a.tier - b.tier || a.id - b.id)
                              .map((t) => {
                                const k = t.origName || t.name;
                                return (
                                  <option key={t.id} value={k}>
                                    {t.name} ({t.sq.length})
                                  </option>
                                );
                              })}
                          </select>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={playerQuery}
                              onChange={(e) => setPlayerQuery(e.target.value)}
                              placeholder="ค้นหานักเตะ..."
                              className="h-7 pl-7 pr-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)] w-32"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                        {filteredTeamPlayers.map((pl) => {
                          const clubOrig = activePlayerTeam!.origName || activePlayerTeam!.name;
                          const origP = pl.origName || pl.n;
                          const compKey = `${clubOrig}::${origP}`;
                          const pov: ModPlayerOverride = edPlayerData[compKey] || edPlayerData[origP] || {};
                          const dt = DT(pl, pl.me && state.mode === 'p' ? state.p : null);

                          const curRo = pov.ro || pl.ro;
                          const curPos: Position = LINE[curRo] || pov.pos || pl.pos;
                          const sh = pov.sh ?? dt.a.sh;
                          const ps = pov.ps ?? dt.a.ps;
                          const dr = pov.dr ?? dt.a.dr;
                          const tk = pov.tk ?? dt.a.tk;
                          const ph = pov.ph ?? dt.a.ph;
                          const calcOv = OVF(curPos, { sh, ps, dr, tk, ph });
                          const curOv = pov.ov ?? calcOv;

                          const patchPlayer = (patch: Partial<ModPlayerOverride>) => {
                            setEdPlayerData((prev) => {
                              const existing = prev[compKey] || prev[origP] || {};
                              return {
                                ...prev,
                                [compKey]: {
                                  ...existing,
                                  clubKey: clubOrig,
                                  origName: origP,
                                  ...patch
                                }
                              };
                            });
                          };

                          return (
                            <div
                              key={compKey}
                              className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 space-y-1.5"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_84px_62px_62px_68px_68px] gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={pov.name ?? edPlayers[origP] ?? ''}
                                  placeholder={origP}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    patchPlayer({ name: val || undefined });
                                    setEdPlayers((prev) => ({ ...prev, [origP]: val }));
                                  }}
                                  className="h-7 px-2 rounded bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] font-bold text-[var(--ink)]"
                                />
                                <select
                                  value={curRo}
                                  onChange={(e) => {
                                    const ro = e.target.value as SubRole;
                                    const pos = LINE[ro];
                                    patchPlayer({ ro, pos });
                                  }}
                                  className="h-7 px-1.5 rounded bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] font-bold text-[var(--ink)]"
                                >
                                  {SUB_ROLES.map((r) => (
                                    <option key={r} value={r}>
                                      {r} ({LINE[r]})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={pov.nat ?? pl.nat ?? ''}
                                  placeholder="TH"
                                  title="รหัสสัญชาติ (เช่น TH, GB, BR, JP)"
                                  onChange={(e) => patchPlayer({ nat: e.target.value.toUpperCase().slice(0, 4) || undefined })}
                                  className="h-7 px-1.5 rounded bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-center uppercase text-[var(--ink)]"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={pov.no ?? pl.no ?? ''}
                                  placeholder="เบอร์"
                                  title="เบอร์เสื้อ"
                                  onChange={(e) => patchPlayer({ no: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="h-7 px-1.5 rounded bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-center tabular text-[var(--ink)]"
                                />
                                <input
                                  type="number"
                                  min={15}
                                  max={45}
                                  value={pov.age ?? pl.age}
                                  title="อายุ"
                                  onChange={(e) => patchPlayer({ age: Number(e.target.value) || pl.age })}
                                  className="h-7 px-1.5 rounded bg-[var(--surface-2)]/70 border border-[var(--line)] text-[10.5px] text-center tabular text-[var(--ink)]"
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-[9.5px] font-bold text-[var(--g)]">OVR</span>
                                  <input
                                    type="number"
                                    min={20}
                                    max={99}
                                    value={curOv}
                                    title="OVR รวม"
                                    onChange={(e) => patchPlayer({ ov: Number(e.target.value) || curOv })}
                                    className="w-full h-7 px-1 rounded bg-[var(--g-soft)]/50 border border-[var(--g)]/40 text-[11px] font-extrabold text-center tabular text-[var(--ink)]"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-6 gap-1 text-[10px]">
                                {(
                                  [
                                    ['sh', 'ยิง', sh],
                                    ['ps', 'จ่าย', ps],
                                    ['dr', 'เลี้ยง', dr],
                                    ['tk', 'แย่ง', tk],
                                    ['ph', 'กาย', ph],
                                    ['pot', 'POT', pov.pot ?? pl.pot]
                                  ] as const
                                ).map(([statKey, lbl, val]) => (
                                  <label key={statKey} className="flex items-center gap-1 bg-[var(--surface-2)]/60 rounded px-1.5 py-0.5 border border-[var(--line)]/60">
                                    <span className="text-[var(--mut)] font-semibold shrink-0">{lbl}</span>
                                    <input
                                      type="number"
                                      min={statKey === 'pot' ? 20 : 1}
                                      max={99}
                                      value={val}
                                      onChange={(e) => {
                                        const num = clamp(Number(e.target.value) || 50, 1, 99);
                                        if (statKey === 'pot') {
                                          patchPlayer({ pot: num });
                                        } else {
                                          const nextAttrs = { sh, ps, dr, tk, ph, [statKey]: num };
                                          patchPlayer({
                                            [statKey]: num,
                                            ov: OVF(curPos, nextAttrs)
                                          });
                                        }
                                      }}
                                      className="w-full min-w-0 bg-transparent text-right font-bold tabular text-[var(--ink)] focus:outline-none"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                      <div className="text-xs font-extrabold text-[var(--ink)]">
                        👤 ปรับแต่งนักเตะ &amp; ค่าพลัง (โหมดเมนูก่อนเริ่มเกม)
                      </div>
                      <p className="text-[11px] text-[var(--mut)] leading-relaxed">
                        เมื่อโหลดเข้าเซฟเกมแล้วเปิดหน้านี้ จะเห็นรายชื่อนักเตะทั้ง 30+ ทีมพร้อมสไลเดอร์แก้ค่าพลังทีละคน หรือส่งออกแม่แบบ <strong>.xlsx</strong> หลังเปิดเซฟเพื่อแก้ไขใน Excel / Google Sheets ได้รวดเดียวทั้งลีก!
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center pt-1">
                        <input
                          type="text"
                          value={manualClubKey}
                          onChange={(e) => setManualClubKey(e.target.value)}
                          placeholder="ชื่อสโมสรเดิม (เว้นได้)"
                          className="h-7 px-2 rounded bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)]"
                        />
                        <input
                          type="text"
                          value={manualOrigName}
                          onChange={(e) => setManualOrigName(e.target.value)}
                          placeholder="ชื่อนักเตะเดิม"
                          className="h-7 px-2 rounded bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)]"
                        />
                        <input
                          type="text"
                          value={manualCustomName}
                          onChange={(e) => setManualCustomName(e.target.value)}
                          placeholder="ชื่อนักเตะใหม่"
                          className="h-7 px-2 rounded bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!manualOrigName.trim() || !manualCustomName.trim()) {
                              onToast('กรุณากรอกชื่อนักเตะเดิมและชื่อใหม่');
                              return;
                            }
                            const key = manualClubKey.trim()
                              ? `${manualClubKey.trim()}::${manualOrigName.trim()}`
                              : manualOrigName.trim();
                            setEdPlayerData((prev) => ({
                              ...prev,
                              [key]: {
                                ...(manualClubKey.trim() ? { clubKey: manualClubKey.trim() } : {}),
                                origName: manualOrigName.trim(),
                                name: manualCustomName.trim()
                              }
                            }));
                            setEdPlayers((prev) => ({
                              ...prev,
                              [manualOrigName.trim()]: manualCustomName.trim()
                            }));
                            setManualOrigName('');
                            setManualCustomName('');
                            SFX.tap();
                            onToast('เพิ่มการแก้ไขนักเตะแล้ว (อย่าลืมกดบันทึก Mod)');
                          }}
                          className="btn btn-xs btn-primary h-7"
                        >
                          <Plus className="w-3 h-3" />
                          <span>เพิ่ม</span>
                        </button>
                      </div>
                      {Object.keys(edPlayerData).length > 0 && (
                        <div className="text-[11px] text-[var(--g)] font-semibold">
                          มีรายการปรับแต่งนักเตะบันทึกอยู่ {Object.keys(edPlayerData).length} รายการ
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-4 py-3 sm:px-5 mland:px-3 mland:py-2 border-t border-[var(--line)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2">
          {tab === 'editor' ? (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSaveEditorPack('xlsx')}
                  className="btn btn-sm btn-gold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>บันทึก &amp; ส่งออก .xlsx</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditorPack('json')}
                  className="btn btn-sm btn-secondary"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.json</span>
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={onClose} className="btn btn-sm btn-surface">
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditorPack('none')}
                  className="btn btn-sm btn-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>บันทึก &amp; เปิดใช้ Mod</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-end w-full">
              <button type="button" onClick={onClose} className="btn btn-sm btn-primary min-w-[100px]">
                <Check className="w-3.5 h-3.5" />
                <span>ตกลง</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
