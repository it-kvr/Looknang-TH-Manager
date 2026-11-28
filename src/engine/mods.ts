import {
  COUNTRY_META_BY_CODE,
  FOREIGN_CLUB_CATALOG,
  LINE,
  ROLE_BASE_ATTRS,
  TIER_STANDALONE_CLUBS,
  TN,
  getForeignClubStadiumName,
  getForeignTeamCountryMeta
} from '../data/thaiFootballData';
import type {
  CoreAttrs,
  GameModPack,
  GameState,
  ModClubOverride,
  ModCupConfig,
  ModCupKey,
  ModGameBrand,
  ModPlayerOverride,
  ModRealismSettings,
  Position,
  PreferredFoot,
  SubRole,
  Team
} from '../types/game';
import { clamp } from '../utils/math';
import { OVF } from './playerCore';

const MOD_PACKS_KEY = 'looknang_mod_packs_v1';
const ACTIVE_MOD_ID_KEY = 'looknang_active_mod_id_v1';

export const DEFAULT_GAME_TITLE = 'ลูกหนังไทย';
export const DEFAULT_GAME_SUBTITLE = 'เกมจำลองคุมสโมสร & นักเตะอาชีพไทย';
export const DEFAULT_DOC_TITLE = 'ลูกหนังไทย — เกมคุมทีมและนักเตะอาชีพ';

export const DEFAULT_TIER_NAMES: [string, string, string, string] = [
  TN[0] || 'ลีกระดับจังหวัด',
  TN[1] || 'ลีกในประเทศ ดิวิชั่น 2',
  TN[2] || 'ลีกในประเทศ ดิวิชั่น 1',
  TN[3] || 'สโมสรนานาชาติ'
];

export const DEFAULT_CUP_META: Record<
  ModCupKey,
  { name: string; short: string; icon: string; prize: number }
> = {
  fa: { name: 'ถ้วยประชาชน', short: 'เอฟเอ คัพ', icon: '🏆', prize: 400 },
  leagueCup: { name: 'ไทยลีก คัพ', short: 'ลีกคัพ', icon: '🥇', prize: 320 },
  divCup: { name: 'ถ้วยดิวิชั่น & ภูมิภาค', short: 'ถ้วยดิวิชั่น', icon: '🛡️', prize: 220 },
  superCup: { name: 'ไทยแลนด์ แชมเปี้ยนส์ คัพ', short: 'แชมเปี้ยนส์ คัพ', icon: '🏅', prize: 200 },
  asia: { name: 'ชิงแชมป์สโมสรทวีป', short: 'ถ้วยทวีป', icon: '🌏', prize: 1200 }
};

export interface WorldLeagueCatalogEntry {
  key: string;
  countryCode: string;
  countryName: string;
  flag: string;
  defaultName: string;
  tierHint: string;
}

export const WORLD_LEAGUE_CATALOG: WorldLeagueCatalogEntry[] = [
  { key: 'TH', countryCode: 'TH', countryName: 'ไทย', flag: '🇹🇭', defaultName: 'ลีกในประเทศ (ไทยลีก)', tierHint: 'ในประเทศ' },
  { key: 'GB', countryCode: 'GB', countryName: 'อังกฤษ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', defaultName: 'ลีกสูงสุดอังกฤษ', tierHint: 'ยุโรป' },
  { key: 'ES', countryCode: 'ES', countryName: 'สเปน', flag: '🇪🇸', defaultName: 'ลีกสูงสุดสเปน', tierHint: 'ยุโรป' },
  { key: 'DE', countryCode: 'DE', countryName: 'เยอรมนี', flag: '🇩🇪', defaultName: 'ลีกสูงสุดเยอรมนี', tierHint: 'ยุโรป' },
  { key: 'IT', countryCode: 'IT', countryName: 'อิตาลี', flag: '🇮🇹', defaultName: 'ลีกสูงสุดอิตาลี', tierHint: 'ยุโรป' },
  { key: 'FR', countryCode: 'FR', countryName: 'ฝรั่งเศส', flag: '🇫🇷', defaultName: 'ลีกสูงสุดฝรั่งเศส', tierHint: 'ยุโรป' },
  { key: 'PT', countryCode: 'PT', countryName: 'โปรตุเกส', flag: '🇵🇹', defaultName: 'ลีกสูงสุดโปรตุเกส', tierHint: 'ยุโรป' },
  { key: 'NL', countryCode: 'NL', countryName: 'เนเธอร์แลนด์', flag: '🇳🇱', defaultName: 'ลีกสูงสุดเนเธอร์แลนด์', tierHint: 'ยุโรป' },
  { key: 'JP', countryCode: 'JP', countryName: 'ญี่ปุ่น', flag: '🇯🇵', defaultName: 'ลีกสูงสุดญี่ปุ่น', tierHint: 'เอเชีย' },
  { key: 'KR', countryCode: 'KR', countryName: 'เกาหลีใต้', flag: '🇰🇷', defaultName: 'ลีกสูงสุดเกาหลีใต้', tierHint: 'เอเชีย' },
  { key: 'SA', countryCode: 'SA', countryName: 'ซาอุดีอาระเบีย', flag: '🇸🇦', defaultName: 'โปรลีกซาอุดีอาระเบีย', tierHint: 'เอเชีย' },
  { key: 'CN', countryCode: 'CN', countryName: 'จีน', flag: '🇨🇳', defaultName: 'ซูเปอร์ลีกจีน', tierHint: 'เอเชีย' },
  { key: 'AE', countryCode: 'AE', countryName: 'ยูเออี', flag: '🇦🇪', defaultName: 'โปรลีกยูเออี', tierHint: 'เอเชีย' },
  { key: 'QA', countryCode: 'QA', countryName: 'กาตาร์', flag: '🇶🇦', defaultName: 'สตาร์สลีกกาตาร์', tierHint: 'เอเชีย' },
  { key: 'IR', countryCode: 'IR', countryName: 'อิหร่าน', flag: '🇮🇷', defaultName: 'โปรลีกอิหร่าน', tierHint: 'เอเชีย' },
  { key: 'AU', countryCode: 'AU', countryName: 'ออสเตรเลีย', flag: '🇦🇺', defaultName: 'เอลีก ออสเตรเลีย', tierHint: 'เอเชีย-โอเชียเนีย' },
  { key: 'VN', countryCode: 'VN', countryName: 'เวียดนาม', flag: '🇻🇳', defaultName: 'วีลีก เวียดนาม', tierHint: 'อาเซียน' },
  { key: 'ID', countryCode: 'ID', countryName: 'อินโดนีเซีย', flag: '🇮🇩', defaultName: 'ลีกา 1 อินโดนีเซีย', tierHint: 'อาเซียน' },
  { key: 'MY', countryCode: 'MY', countryName: 'มาเลเซีย', flag: '🇲🇾', defaultName: 'ซูเปอร์ลีกมาเลเซีย', tierHint: 'อาเซียน' },
  { key: 'SG', countryCode: 'SG', countryName: 'สิงคโปร์', flag: '🇸🇬', defaultName: 'พรีเมียร์ลีกสิงคโปร์', tierHint: 'อาเซียน' },
  { key: 'BR', countryCode: 'BR', countryName: 'บราซิล', flag: '🇧🇷', defaultName: 'เซเรีย อา บราซิล', tierHint: 'อเมริกา' },
  { key: 'AR', countryCode: 'AR', countryName: 'อาร์เจนตินา', flag: '🇦🇷', defaultName: 'พรีเมร่า ดิวิซิออน', tierHint: 'อเมริกา' },
  { key: 'US', countryCode: 'US', countryName: 'สหรัฐอเมริกา', flag: '🇺🇸', defaultName: 'เมเจอร์ลีก ซอคเกอร์', tierHint: 'อเมริกา' },
  { key: 'MX', countryCode: 'MX', countryName: 'เม็กซิโก', flag: '🇲🇽', defaultName: 'ลีกา เอ็มเอ็กซ์', tierHint: 'อเมริกา' },
  { key: 'EG', countryCode: 'EG', countryName: 'อียิปต์', flag: '🇪🇬', defaultName: 'พรีเมียร์ลีกอียิปต์', tierHint: 'แอฟริกา' },
  { key: 'MA', countryCode: 'MA', countryName: 'โมร็อกโก', flag: '🇲🇦', defaultName: 'โบโตลา โปร โมร็อกโก', tierHint: 'แอฟริกา' }
];

export interface EditableClubCatalogItem {
  key: string;
  tier: number;
  isForeign: boolean;
  countryCode?: string;
  countryFlag?: string;
  countryName?: string;
  defaultLeagueName?: string;
  defaultName: string;
  defaultStadium: string;
  defaultC1: string;
  defaultC2: string;
}

export function sanitizeImageUrl(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (
    /^https?:\/\/\S+/i.test(trimmed) ||
    /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed) ||
    /^\/(?!\/)\S+/.test(trimmed)
  ) {
    return trimmed.slice(0, 260000);
  }
  return undefined;
}

function sanitizeHexColor(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined;
}

const VALID_SUBROLES = new Set<SubRole>(Object.keys(LINE) as SubRole[]);
const VALID_POSITIONS = new Set<Position>(['GK', 'DF', 'MF', 'FW']);

function sanitizeNumber(val: unknown, min: number, max: number): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = typeof val === 'number' ? val : Number(String(val).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return undefined;
  return clamp(Math.round(n), min, max);
}

function sanitizeClubOverride(raw: unknown): ModClubOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: ModClubOverride = {};
  if (typeof obj.name === 'string' && obj.name.trim()) out.name = obj.name.trim().slice(0, 64);
  if (typeof obj.shortName === 'string' && obj.shortName.trim()) out.shortName = obj.shortName.trim().slice(0, 24);
  if (typeof obj.stadium === 'string' && obj.stadium.trim()) out.stadium = obj.stadium.trim().slice(0, 80);
  if (typeof obj.leagueName === 'string' && obj.leagueName.trim()) out.leagueName = obj.leagueName.trim().slice(0, 64);
  if (typeof obj.countryCode === 'string' && obj.countryCode.trim()) out.countryCode = obj.countryCode.trim().toUpperCase().slice(0, 4);
  const logoUrl = sanitizeImageUrl(obj.logoUrl);
  if (logoUrl) out.logoUrl = logoUrl;
  const c1 = sanitizeHexColor(obj.c1);
  const c2 = sanitizeHexColor(obj.c2);
  const c3 = sanitizeHexColor(obj.c3);
  if (c1) out.c1 = c1;
  if (c2) out.c2 = c2;
  if (c3) out.c3 = c3;
  if (typeof obj.kit === 'number' && Number.isFinite(obj.kit)) out.kit = Math.max(0, Math.round(obj.kit));
  if (typeof obj.awayKit === 'number' && Number.isFinite(obj.awayKit)) out.awayKit = Math.max(0, Math.round(obj.awayKit));
  const budgetK = sanitizeNumber(obj.budgetK, -50000, 9999999);
  if (budgetK !== undefined) out.budgetK = budgetK;
  const fans = sanitizeNumber(obj.fans, 100, 100000000);
  if (fans !== undefined) out.fans = fans;
  const ovrTarget = sanitizeNumber(obj.ovrTarget, 30, 99);
  if (ovrTarget !== undefined) out.ovrTarget = ovrTarget;
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizePlayerOverride(raw: unknown): ModPlayerOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: ModPlayerOverride = {};
  if (typeof obj.clubKey === 'string' && obj.clubKey.trim()) out.clubKey = obj.clubKey.trim().slice(0, 64);
  if (typeof obj.origName === 'string' && obj.origName.trim()) out.origName = obj.origName.trim().slice(0, 64);
  if (typeof obj.name === 'string' && obj.name.trim()) out.name = obj.name.trim().slice(0, 64);
  if (typeof obj.nat === 'string' && obj.nat.trim()) out.nat = obj.nat.trim().toUpperCase().slice(0, 4);
  if (typeof obj.ro === 'string') {
    const roUp = obj.ro.trim().toUpperCase() as SubRole;
    if (VALID_SUBROLES.has(roUp)) {
      out.ro = roUp;
      out.pos = LINE[roUp];
    }
  }
  if (typeof obj.pos === 'string') {
    const posUp = obj.pos.trim().toUpperCase() as Position;
    if (VALID_POSITIONS.has(posUp)) {
      out.pos = posUp;
      if (out.ro && LINE[out.ro] !== posUp) {
        out.ro = undefined;
      }
    }
  }
  const age = sanitizeNumber(obj.age, 15, 45);
  if (age !== undefined) out.age = age;
  const no = sanitizeNumber(obj.no, 1, 99);
  if (no !== undefined) out.no = no;
  const ov = sanitizeNumber(obj.ov, 20, 99);
  if (ov !== undefined) out.ov = ov;
  const pot = sanitizeNumber(obj.pot, 20, 99);
  if (pot !== undefined) out.pot = pot;
  const talent = sanitizeNumber(obj.talent, 20, 99);
  if (talent !== undefined) out.talent = talent;
  const fit = sanitizeNumber(obj.fit, 1, 100);
  if (fit !== undefined) out.fit = fit;
  const sh = sanitizeNumber(obj.sh, 1, 99);
  if (sh !== undefined) out.sh = sh;
  const ps = sanitizeNumber(obj.ps, 1, 99);
  if (ps !== undefined) out.ps = ps;
  const dr = sanitizeNumber(obj.dr, 1, 99);
  if (dr !== undefined) out.dr = dr;
  const tk = sanitizeNumber(obj.tk, 1, 99);
  if (tk !== undefined) out.tk = tk;
  const ph = sanitizeNumber(obj.ph, 1, 99);
  if (ph !== undefined) out.ph = ph;
  const price = sanitizeNumber(obj.price, 1, 999999);
  if (price !== undefined) out.price = price;
  const wage = sanitizeNumber(obj.wage, 1, 99999);
  if (wage !== undefined) out.wage = wage;
  const ht = sanitizeNumber(obj.ht, 145, 215);
  if (ht !== undefined) out.ht = ht;
  const wt = sanitizeNumber(obj.wt, 45, 120);
  if (wt !== undefined) out.wt = wt;
  if (typeof obj.foot === 'string') {
    const f = obj.foot.trim().toUpperCase();
    if (f === 'L' || f === 'R' || f === 'B') out.foot = f as PreferredFoot;
  }
  if (Array.isArray(obj.traits)) {
    const cleanTraits = obj.traits.map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
    if (cleanTraits.length) out.traits = cleanTraits;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeModPack(raw: unknown): GameModPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 80) : '';
  if (!name) return null;

  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim().slice(0, 64)
      : `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const gameBrand: ModGameBrand = {};
  if (obj.gameBrand && typeof obj.gameBrand === 'object') {
    const gb = obj.gameBrand as Record<string, unknown>;
    if (typeof gb.title === 'string' && gb.title.trim()) gameBrand.title = gb.title.trim().slice(0, 48);
    if (typeof gb.subtitle === 'string' && gb.subtitle.trim()) gameBrand.subtitle = gb.subtitle.trim().slice(0, 96);
    const logoUrl = sanitizeImageUrl(gb.logoUrl);
    if (logoUrl) gameBrand.logoUrl = logoUrl;
  }

  const tierNames: Partial<Record<0 | 1 | 2 | 3, string>> = {};
  if (obj.tierNames && typeof obj.tierNames === 'object') {
    const tnRaw = obj.tierNames as Record<string, unknown>;
    ([0, 1, 2, 3] as const).forEach((t) => {
      const val = tnRaw[String(t)];
      if (typeof val === 'string' && val.trim()) {
        tierNames[t] = val.trim().slice(0, 64);
      }
    });
  }

  const worldLeagueNames: Record<string, string> = {};
  if (obj.worldLeagueNames && typeof obj.worldLeagueNames === 'object') {
    Object.entries(obj.worldLeagueNames as Record<string, unknown>).forEach(([k, v]) => {
      const code = k.trim().toUpperCase();
      if (code && typeof v === 'string' && v.trim()) {
        worldLeagueNames[code] = v.trim().slice(0, 64);
      }
    });
  }

  const leagueLogos: Record<string, string> = {};
  if (obj.leagueLogos && typeof obj.leagueLogos === 'object') {
    Object.entries(obj.leagueLogos as Record<string, unknown>).forEach(([k, v]) => {
      const cleanK = k.trim();
      const logo = sanitizeImageUrl(v);
      if (cleanK && logo) leagueLogos[cleanK] = logo;
    });
  }

  const cupNames: NonNullable<GameModPack['cupNames']> = {};
  if (obj.cupNames && typeof obj.cupNames === 'object') {
    const cn = obj.cupNames as Record<string, unknown>;
    (['fa', 'leagueCup', 'divCup', 'superCup', 'asia'] as const).forEach((k) => {
      if (typeof cn[k] === 'string' && (cn[k] as string).trim()) {
        cupNames[k] = (cn[k] as string).trim().slice(0, 64);
      }
    });
  }

  const cupMeta: NonNullable<GameModPack['cupMeta']> = {};
  if (obj.cupMeta && typeof obj.cupMeta === 'object') {
    const cm = obj.cupMeta as Record<string, unknown>;
    (['fa', 'leagueCup', 'divCup', 'superCup', 'asia'] as const).forEach((k) => {
      const item = cm[k];
      if (!item || typeof item !== 'object') return;
      const r = item as Record<string, unknown>;
      const out: ModCupConfig = {};
      if (typeof r.name === 'string' && r.name.trim()) {
        out.name = r.name.trim().slice(0, 64);
        if (!cupNames[k]) cupNames[k] = out.name;
      }
      if (typeof r.short === 'string' && r.short.trim()) out.short = r.short.trim().slice(0, 32);
      if (typeof r.icon === 'string' && r.icon.trim()) out.icon = r.icon.trim().slice(0, 8);
      const logoUrl = sanitizeImageUrl(r.logoUrl);
      if (logoUrl) out.logoUrl = logoUrl;
      const prize = sanitizeNumber(r.prize, 10, 999999);
      if (prize !== undefined) out.prize = prize;
      if (Object.keys(out).length > 0) cupMeta[k] = out;
    });
  }

  const clubOverrides: Record<string, ModClubOverride> = {};
  if (obj.clubOverrides && typeof obj.clubOverrides === 'object') {
    Object.entries(obj.clubOverrides as Record<string, unknown>).forEach(([key, val]) => {
      const cleanKey = key.trim();
      if (!cleanKey) return;
      const ov = sanitizeClubOverride(val);
      if (ov) clubOverrides[cleanKey] = ov;
    });
  }

  const playerOverrides: Record<string, string> = {};
  if (obj.playerOverrides && typeof obj.playerOverrides === 'object') {
    Object.entries(obj.playerOverrides as Record<string, unknown>).forEach(([key, val]) => {
      const cleanKey = key.trim();
      if (!cleanKey || typeof val !== 'string' || !val.trim()) return;
      playerOverrides[cleanKey] = val.trim().slice(0, 64);
    });
  }

  const playerDataOverrides: Record<string, ModPlayerOverride> = {};
  if (obj.playerDataOverrides && typeof obj.playerDataOverrides === 'object') {
    Object.entries(obj.playerDataOverrides as Record<string, unknown>).forEach(([key, val]) => {
      const cleanKey = key.trim();
      if (!cleanKey) return;
      const pov = sanitizePlayerOverride(val);
      if (pov) playerDataOverrides[cleanKey] = pov;
    });
  }

  const realism: ModRealismSettings = {};
  if (obj.realism && typeof obj.realism === 'object') {
    const rm = obj.realism as Record<string, unknown>;
    if (typeof rm.disableSupernatural === 'boolean') realism.disableSupernatural = rm.disableSupernatural;
    if (typeof rm.realisticScoring === 'boolean') realism.realisticScoring = rm.realisticScoring;
    if (typeof rm.realisticFatigue === 'boolean') realism.realisticFatigue = rm.realisticFatigue;
  }

  return {
    v: 1,
    id,
    name,
    author: typeof obj.author === 'string' && obj.author.trim() ? obj.author.trim().slice(0, 48) : 'ผู้เล่น',
    version: typeof obj.version === 'string' && obj.version.trim() ? obj.version.trim().slice(0, 24) : '1.0',
    description: typeof obj.description === 'string' && obj.description.trim() ? obj.description.trim().slice(0, 180) : undefined,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
    ...(typeof obj.sourceUrl === 'string' && obj.sourceUrl.trim() ? { sourceUrl: obj.sourceUrl.trim().slice(0, 512) } : {}),
    ...(Object.keys(gameBrand).length > 0 ? { gameBrand } : {}),
    ...(Object.keys(realism).length > 0 ? { realism } : {}),
    ...(Object.keys(tierNames).length > 0 ? { tierNames } : {}),
    ...(Object.keys(worldLeagueNames).length > 0 ? { worldLeagueNames } : {}),
    ...(Object.keys(leagueLogos).length > 0 ? { leagueLogos } : {}),
    ...(Object.keys(cupNames).length > 0 ? { cupNames } : {}),
    ...(Object.keys(cupMeta).length > 0 ? { cupMeta } : {}),
    clubOverrides,
    ...(Object.keys(playerOverrides).length > 0 ? { playerOverrides } : {}),
    ...(Object.keys(playerDataOverrides).length > 0 ? { playerDataOverrides } : {})
  };
}

export function getInstalledMods(): GameModPack[] {
  try {
    const raw = localStorage.getItem(MOD_PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeModPack).filter((x): x is GameModPack => Boolean(x));
  } catch {
    return [];
  }
}

function saveInstalledModsList(list: GameModPack[]) {
  try {
    localStorage.setItem(MOD_PACKS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function getActiveModId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_MOD_ID_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function getActiveMod(): GameModPack | null {
  const activeId = getActiveModId();
  if (!activeId) return null;
  const list = getInstalledMods();
  return list.find((m) => m.id === activeId) || null;
}

export function getGameBrandDisplay(explicitMod?: GameModPack | null): {
  title: string;
  subtitle: string;
  logoUrl?: string;
  isCustomTitle: boolean;
} {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  const customTitle = mod?.gameBrand?.title?.trim();
  const customSub = mod?.gameBrand?.subtitle?.trim();
  const logoUrl = sanitizeImageUrl(mod?.gameBrand?.logoUrl);
  return {
    title: customTitle || DEFAULT_GAME_TITLE,
    subtitle: customSub || DEFAULT_GAME_SUBTITLE,
    logoUrl,
    isCustomTitle: Boolean(customTitle && customTitle !== DEFAULT_GAME_TITLE)
  };
}

export function applyActiveModToRuntimeData(explicitMod?: GameModPack | null) {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  DEFAULT_TIER_NAMES.forEach((defName, idx) => {
    const override = mod?.tierNames?.[idx as 0 | 1 | 2 | 3];
    TN[idx] = override && override.trim() ? override.trim() : defName;
  });

  if (typeof document !== 'undefined') {
    const brand = getGameBrandDisplay(mod);
    document.title = brand.isCustomTitle ? `${brand.title} — ${brand.subtitle}` : DEFAULT_DOC_TITLE;
  }
}

export function getModRealismSettings(explicitMod?: GameModPack | null): Required<ModRealismSettings> {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  return {
    disableSupernatural: Boolean(mod?.realism?.disableSupernatural),
    realisticScoring: Boolean(mod?.realism?.realisticScoring),
    realisticFatigue: Boolean(mod?.realism?.realisticFatigue)
  };
}

export function getCupDisplayName(
  key: ModCupKey,
  fallback: string,
  explicitMod?: GameModPack | null
): string {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  const custom = mod?.cupMeta?.[key]?.name || mod?.cupNames?.[key];
  return custom && custom.trim() ? custom.trim() : fallback;
}

export function getCupConfig(
  key: ModCupKey,
  fallback: { name: string; short?: string; icon?: string; prize?: number },
  explicitMod?: GameModPack | null
): { name: string; short: string; icon: string; logoUrl?: string; prize: number } {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  const meta = mod?.cupMeta?.[key];
  const name = (meta?.name || mod?.cupNames?.[key] || fallback.name).trim();
  const short = (meta?.short || (name !== fallback.name ? name : fallback.short || name)).trim();
  const icon = (meta?.icon || fallback.icon || DEFAULT_CUP_META[key].icon).trim();
  const logoUrl = sanitizeImageUrl(meta?.logoUrl);
  const prize = typeof meta?.prize === 'number' && meta.prize > 0 ? meta.prize : fallback.prize ?? DEFAULT_CUP_META[key].prize;
  return { name, short, icon, logoUrl, prize };
}

export function getWorldLeagueDisplay(
  countryCode?: string | null,
  fallback?: string,
  explicitMod?: GameModPack | null
): string | undefined {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  if (!countryCode) return fallback;
  const upper = countryCode.trim().toUpperCase();
  const custom = mod?.worldLeagueNames?.[upper];
  if (custom && custom.trim()) return custom.trim();
  const cat = WORLD_LEAGUE_CATALOG.find((w) => w.countryCode === upper);
  return fallback || cat?.defaultName;
}

export function getLeagueLogoUrl(
  leagueKey: string | number,
  explicitMod?: GameModPack | null
): string | undefined {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  if (!mod?.leagueLogos) return undefined;
  const k = typeof leagueKey === 'number' ? `tier_${leagueKey}` : leagueKey.trim();
  return sanitizeImageUrl(mod.leagueLogos[k] || mod.leagueLogos[k.toUpperCase()]);
}

export function getClubModOverride(
  teamName?: string | null,
  explicitMod?: GameModPack | null
): ModClubOverride | null {
  if (!teamName) return null;
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  if (!mod?.clubOverrides) return null;
  return mod.clubOverrides[teamName] || null;
}

export function getClubModLogoUrl(
  teamName?: string | null,
  explicitMod?: GameModPack | null
): string | undefined {
  const ov = getClubModOverride(teamName, explicitMod);
  return sanitizeImageUrl(ov?.logoUrl);
}

export function setActiveModId(modId: string | null) {
  try {
    if (modId) {
      localStorage.setItem(ACTIVE_MOD_ID_KEY, modId);
    } else {
      localStorage.removeItem(ACTIVE_MOD_ID_KEY);
    }
  } catch {
    // ignore storage errors
  }
  applyActiveModToRuntimeData();
}

export function saveInstalledMod(pack: GameModPack, activate = true): GameModPack {
  const clean = normalizeModPack({ ...pack, updatedAt: Date.now() }) || {
    v: 1,
    id: pack.id || `mod_${Date.now()}`,
    name: pack.name || 'Custom Mod',
    updatedAt: Date.now(),
    clubOverrides: pack.clubOverrides || {}
  };
  const list = getInstalledMods();
  const idx = list.findIndex((m) => m.id === clean.id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? clean : m)) : [clean, ...list];
  saveInstalledModsList(next);
  if (activate) {
    setActiveModId(clean.id);
  } else {
    applyActiveModToRuntimeData();
  }
  return clean;
}

export function deleteInstalledMod(modId: string) {
  const list = getInstalledMods().filter((m) => m.id !== modId);
  saveInstalledModsList(list);
  if (getActiveModId() === modId) {
    setActiveModId(null);
  } else {
    applyActiveModToRuntimeData();
  }
}

export function parseModPackJson(raw: string): { ok: true; pack: GameModPack } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'กรุณาวางโค้ด JSON หรือเลือกไฟล์ Mod' };
  try {
    const parsed = JSON.parse(trimmed);
    const pack = normalizeModPack(parsed);
    if (!pack) {
      return { ok: false, error: 'ไฟล์ JSON ต้องมีชื่อแพ็ก ("name") และรูปแบบที่ถูกต้อง' };
    }
    return { ok: true, pack };
  } catch {
    return { ok: false, error: 'รูปแบบ JSON ไม่ถูกต้อง กรุณาตรวจสอบเครื่องหมายวงเล็บหรือเครื่องหมายคำพูด' };
  }
}

export function exportModPackJson(pack: GameModPack): string {
  return JSON.stringify(pack, null, 2);
}

function resolveModAttrsForPlayer(
  pl: Team['sq'][number],
  pov: ModPlayerOverride
): { customA?: CoreAttrs; ov: number } {
  const hasAnyCoreAttr =
    pov.sh !== undefined ||
    pov.ps !== undefined ||
    pov.dr !== undefined ||
    pov.tk !== undefined ||
    pov.ph !== undefined;

  if (hasAnyCoreAttr) {
    const base = pl.customA || ROLE_BASE_ATTRS(pl.pos, pl.ro);
    const fallbackOv = pov.ov ?? pl.ov;
    const scaleHint = pl.customA ? 0 : Math.round(fallbackOv - OVF(pl.pos, base));
    const nextA: CoreAttrs = {
      sh: clamp(pov.sh ?? clamp(base.sh + scaleHint, 15, 99), 1, 99),
      ps: clamp(pov.ps ?? clamp(base.ps + scaleHint, 15, 99), 1, 99),
      dr: clamp(pov.dr ?? clamp(base.dr + scaleHint, 15, 99), 1, 99),
      tk: clamp(pov.tk ?? clamp(base.tk + scaleHint, 15, 99), 1, 99),
      ph: clamp(pov.ph ?? clamp(base.ph + scaleHint, 15, 99), 1, 99)
    };
    const nextOv = pov.ov ?? clamp(OVF(pl.pos, nextA), 20, 99);
    return { customA: nextA, ov: nextOv };
  }

  return {
    customA: pl.customA,
    ov: pov.ov ?? pl.ov
  };
}

export function applyModToTeamsArray(
  teams: Team[],
  mod: GameModPack | null,
  state?: GameState | null
): { changedTeams: number; changedPlayers: number } {
  let changedTeams = 0;
  let changedPlayers = 0;

  teams.forEach((team) => {
    const baseName = team.origName || team.name;
    const baseKc: [string, string] = team.origKc
      ? [team.origKc[0], team.origKc[1]]
      : [team.kc?.[0] || '#158049', team.kc?.[1] || '#f5c242'];
    const isForeignBase =
      team.tier >= 3 || team.foreign === 1 || Boolean(getForeignTeamCountryMeta(baseName));
    const baseStadium =
      team.origStadium ||
      team.stadiumName ||
      (isForeignBase ? getForeignClubStadiumName(baseName) : `สนาม${baseName}`);

    if (!team.origName) team.origName = baseName;
    if (!team.origKc) team.origKc = [baseKc[0], baseKc[1]];
    if (!team.origStadium) team.origStadium = baseStadium;
    if (team.origFans === undefined && typeof team.fans === 'number') team.origFans = team.fans;
    if (team.origBudget === undefined && typeof team.budget === 'number') team.origBudget = team.budget;
    if (isForeignBase && team.foreign !== 1) team.foreign = 1;

    if (!mod) {
      if (team.name !== baseName) {
        team.name = baseName;
        changedTeams++;
      }
      team.kc = [baseKc[0], baseKc[1]];
      if (team.stadiumName && team.stadiumName !== baseStadium) {
        team.stadiumName = baseStadium;
      } else {
        delete team.stadiumName;
      }
      delete team.logoUrl;
      delete team.shortName;
      delete team.modLeagueName;
      if (team.origFans !== undefined) team.fans = team.origFans;
      if (team.origBudget !== undefined) team.budget = team.origBudget;

      if (team.id === state?.me && state.club) {
        state.club.name = baseName;
        state.club.c1 = baseKc[0];
        state.club.c2 = baseKc[1];
        delete state.club.logoUrl;
        if (baseStadium) state.club.std = baseStadium;
      }
    } else {
      const ov = mod.clubOverrides?.[baseName] || mod.clubOverrides?.[team.name];
      const nextName = ov?.name || baseName;
      const nextC1 = ov?.c1 || baseKc[0];
      const nextC2 = ov?.c2 || baseKc[1];
      const nextStadium = ov?.stadium || baseStadium;
      const nextLogo = sanitizeImageUrl(ov?.logoUrl);

      if (
        team.name !== nextName ||
        team.kc[0] !== nextC1 ||
        team.kc[1] !== nextC2 ||
        (ov?.stadium && team.stadiumName !== ov.stadium) ||
        team.logoUrl !== nextLogo
      ) {
        changedTeams++;
      }

      team.name = nextName;
      team.kc = [nextC1, nextC2];
      if (ov?.stadium) {
        team.stadiumName = nextStadium;
      } else {
        delete team.stadiumName;
      }
      if (nextLogo) team.logoUrl = nextLogo;
      else delete team.logoUrl;

      if (ov?.shortName) team.shortName = ov.shortName;
      else delete team.shortName;

      const meta = isForeignBase ? getForeignTeamCountryMeta(baseName) : null;
      const resolvedCountry = ov?.countryCode || meta?.code;
      const resolvedLeagueName =
        ov?.leagueName ||
        (resolvedCountry ? mod.worldLeagueNames?.[resolvedCountry] : undefined);
      if (resolvedLeagueName) team.modLeagueName = resolvedLeagueName;
      else delete team.modLeagueName;

      if (typeof ov?.fans === 'number') team.fans = ov.fans;
      if (typeof ov?.budgetK === 'number') {
        team.budget = ov.budgetK;
        if (state && state.mode === 'm' && team.id === state.me && state.md === 0 && state.season === 1) {
          state.money = ov.budgetK;
        }
      }

      if (typeof ov?.ovrTarget === 'number' && team.sq.length > 0) {
        const curAvg = team.sq.reduce((acc, q) => acc + q.ov, 0) / team.sq.length;
        const delta = Math.round(ov.ovrTarget - curAvg);
        if (Math.abs(delta) >= 2 && Math.abs(delta) <= 35) {
          team.sq.forEach((pl) => {
            if (!pl.origModSnap) {
              pl.origModSnap = {
                n: pl.origName || pl.n,
                nat: pl.nat,
                pos: pl.pos,
                ro: pl.ro,
                age: pl.age,
                no: pl.no,
                ov: pl.ov,
                pot: pl.pot,
                talent: pl.talent,
                fit: pl.fit,
                ht: pl.ht,
                wt: pl.wt,
                foot: pl.foot,
                customA: pl.customA ? { ...pl.customA } : undefined,
                customD: pl.customD ? { ...pl.customD } : undefined,
                price: pl.price,
                wg: pl.con?.wg,
                traits: pl.traits ? [...pl.traits] : undefined
              };
            }
            pl.ov = clamp(pl.ov + delta, 25, 97);
            pl.pot = Math.max(pl.pot, pl.ov);
          });
        }
      }

      if (team.id === state?.me && state.club) {
        state.club.name = nextName;
        state.club.c1 = nextC1;
        state.club.c2 = nextC2;
        if (ov?.c3) state.club.c3 = ov.c3;
        if (ov?.stadium) state.club.std = ov.stadium;
        if (typeof ov?.kit === 'number') state.club.kit = ov.kit;
        if (typeof ov?.awayKit === 'number') state.club.awayKit = ov.awayKit;
        if (nextLogo) state.club.logoUrl = nextLogo;
        else delete state.club.logoUrl;
      }
    }

    // Player overrides (restore + full attribute/identity patch)
    const renameMap = new Map<string, string>();
    team.sq.forEach((pl) => {
      const origPName = pl.origName || pl.n;
      if (!pl.origName) pl.origName = origPName;

      if (!mod) {
        if (pl.origModSnap) {
          const snap = pl.origModSnap;
          if (pl.n !== snap.n) renameMap.set(pl.n, snap.n);
          pl.n = snap.n;
          if (snap.nat !== undefined) pl.nat = snap.nat;
          else delete pl.nat;
          pl.pos = snap.pos;
          pl.ro = snap.ro;
          pl.age = snap.age;
          if (snap.no !== undefined) pl.no = snap.no;
          pl.ov = snap.ov;
          pl.pot = snap.pot;
          if (snap.talent !== undefined) pl.talent = snap.talent;
          pl.fit = snap.fit;
          if (snap.ht !== undefined) pl.ht = snap.ht;
          if (snap.wt !== undefined) pl.wt = snap.wt;
          if (snap.foot !== undefined) pl.foot = snap.foot;
          if (snap.customA) pl.customA = { ...snap.customA };
          else delete pl.customA;
          if (snap.customD) pl.customD = { ...snap.customD };
          else delete pl.customD;
          if (snap.price !== undefined) pl.price = snap.price;
          if (snap.wg !== undefined && pl.con) pl.con.wg = snap.wg;
          if (snap.traits) pl.traits = [...snap.traits];
          delete pl.origModSnap;
          changedPlayers++;
        } else if (pl.n !== origPName) {
          renameMap.set(pl.n, origPName);
          pl.n = origPName;
          changedPlayers++;
        }
        return;
      }

      const compositeKey = `${baseName}::${origPName}`;
      const pov =
        mod.playerDataOverrides?.[compositeKey] ||
        mod.playerDataOverrides?.[origPName] ||
        mod.playerDataOverrides?.[`${team.name}::${origPName}`];
      const simpleRename = mod.playerOverrides?.[origPName] || mod.playerOverrides?.[pl.n];
      const targetPName = pov?.name || simpleRename || origPName;

      if (pov) {
        if (!pl.origModSnap) {
          pl.origModSnap = {
            n: origPName,
            nat: pl.nat,
            pos: pl.pos,
            ro: pl.ro,
            age: pl.age,
            no: pl.no,
            ov: pl.ov,
            pot: pl.pot,
            talent: pl.talent,
            fit: pl.fit,
            ht: pl.ht,
            wt: pl.wt,
            foot: pl.foot,
            customA: pl.customA ? { ...pl.customA } : undefined,
            customD: pl.customD ? { ...pl.customD } : undefined,
            price: pl.price,
            wg: pl.con?.wg,
            traits: pl.traits ? [...pl.traits] : undefined
          };
        }
        if (pov.nat) pl.nat = pov.nat;
        if (pov.pos) pl.pos = pov.pos;
        if (pov.ro) {
          pl.ro = pov.ro;
          pl.pos = LINE[pov.ro] || pl.pos;
        } else if (pov.pos && LINE[pl.ro] !== pov.pos) {
          pl.ro = pov.pos === 'GK' ? 'GK' : pov.pos === 'DF' ? 'CB' : pov.pos === 'MF' ? 'CM' : 'ST';
        }
        if (pov.age !== undefined) pl.age = pov.age;
        if (pov.no !== undefined) {
          pl.no = pov.no;
          if (Array.isArray(pl.vis) && pl.vis.length > 5) pl.vis[5] = pov.no;
        }
        if (pov.pot !== undefined) pl.pot = pov.pot;
        if (pov.talent !== undefined) pl.talent = pov.talent;
        if (pov.fit !== undefined) pl.fit = pov.fit;
        if (pov.ht !== undefined) pl.ht = pov.ht;
        if (pov.wt !== undefined) pl.wt = pov.wt;
        if (pov.foot !== undefined) pl.foot = pov.foot;
        if (pov.price !== undefined) pl.price = pov.price;
        if (pov.wage !== undefined && pl.con) pl.con.wg = pov.wage;
        if (pov.traits?.length) pl.traits = [...pov.traits];

        const resolvedAttr = resolveModAttrsForPlayer(pl, pov);
        pl.ov = resolvedAttr.ov;
        if (resolvedAttr.customA) {
          pl.customA = resolvedAttr.customA;
        } else if (pov.ov !== undefined && !pl.origModSnap.customA) {
          delete pl.customA;
        }
        pl.pot = Math.max(pl.pot || pl.ov, pl.ov);
        changedPlayers++;
      }

      if (pl.n !== targetPName) {
        renameMap.set(pl.n, targetPName);
        pl.n = targetPName;
        if (pl.me && state?.mode === 'p' && state.p) {
          state.p.name = targetPName;
        }
        if (!pov) changedPlayers++;
      }
    });

    if (renameMap.size > 0) {
      if (team.cap && renameMap.has(team.cap)) team.cap = renameMap.get(team.cap);
      if (team.favPlayer && renameMap.has(team.favPlayer)) team.favPlayer = renameMap.get(team.favPlayer);
      if (team.favPlayers?.length) {
        team.favPlayers = team.favPlayers.map((n) => renameMap.get(n) || n);
      }
      if (team.lu?.length) {
        team.lu = team.lu.map((n) => renameMap.get(n) || n);
      }
      if (team.setPieces) {
        if (team.setPieces.corner && renameMap.has(team.setPieces.corner)) {
          team.setPieces.corner = renameMap.get(team.setPieces.corner);
        }
        if (team.setPieces.freekick && renameMap.has(team.setPieces.freekick)) {
          team.setPieces.freekick = renameMap.get(team.setPieces.freekick);
        }
        if (team.setPieces.penalty && renameMap.has(team.setPieces.penalty)) {
          team.setPieces.penalty = renameMap.get(team.setPieces.penalty);
        }
      }
    }
  });

  return { changedTeams, changedPlayers };
}

export function getEditableClubCatalog(state?: GameState | null): EditableClubCatalogItem[] {
  if (state && Array.isArray(state.teams) && state.teams.length > 0) {
    return state.teams
      .slice()
      .sort((a, b) => a.tier - b.tier || a.id - b.id)
      .map((team) => {
        const key = team.origName || team.name;
        const meta = getForeignTeamCountryMeta(key) || getForeignTeamCountryMeta(team.name);
        const isForeign = team.tier >= 3 || team.foreign === 1 || Boolean(meta);
        const defKc = team.origKc || team.kc;
        const countryCode = meta?.code || (isForeign ? undefined : 'TH');
        const worldDef = countryCode ? WORLD_LEAGUE_CATALOG.find((w) => w.countryCode === countryCode)?.defaultName : undefined;
        return {
          key,
          tier: team.tier,
          isForeign,
          countryCode,
          countryFlag: meta?.flag || (isForeign ? undefined : '🇹🇭'),
          countryName: meta?.country || (isForeign ? undefined : 'ไทย'),
          defaultLeagueName: isForeign ? worldDef : DEFAULT_TIER_NAMES[team.tier] || DEFAULT_TIER_NAMES[0],
          defaultName: key,
          defaultStadium:
            team.origStadium || (isForeign ? getForeignClubStadiumName(key) : `สนาม${key}`),
          defaultC1: defKc?.[0] || '#158049',
          defaultC2: defKc?.[1] || '#f5c242'
        };
      });
  }

  const items: EditableClubCatalogItem[] = [];
  TIER_STANDALONE_CLUBS.forEach((tierList, tierIdx) => {
    tierList.forEach((name) => {
      items.push({
        key: name,
        tier: tierIdx,
        isForeign: false,
        countryCode: 'TH',
        countryFlag: '🇹🇭',
        countryName: 'ไทย',
        defaultLeagueName: DEFAULT_TIER_NAMES[tierIdx] || DEFAULT_TIER_NAMES[0],
        defaultName: name,
        defaultStadium: `สนาม${name}`,
        defaultC1: '#158049',
        defaultC2: '#f5c242'
      });
    });
  });

  FOREIGN_CLUB_CATALOG.forEach((entry) => {
    const worldDef = WORLD_LEAGUE_CATALOG.find((w) => w.countryCode === entry.code)?.defaultName || entry.country;
    items.push({
      key: entry.name,
      tier: 3,
      isForeign: true,
      countryCode: entry.code,
      countryFlag: entry.flag,
      countryName: entry.country,
      defaultLeagueName: worldDef,
      defaultName: entry.name,
      defaultStadium: getForeignClubStadiumName(entry.name),
      defaultC1: entry.kc[0],
      defaultC2: entry.kc[1]
    });
  });

  return items;
}

export const BUILTIN_REALISTIC_MOD_PRESETS: GameModPack[] = [
  {
    v: 1,
    id: 'preset_pro_realism',
    name: '⚽ Mod ฟุตบอลสมจริง (Pro Realism Mode)',
    author: 'System Preset',
    version: '1.0',
    description: 'ตัดเหตุการณ์แฟนตาซี (ฟ้าผ่า/พร/พลิกนรก), ปรับสกอร์และ xG สมจริงแบบลีกอาชีพ, เน้นความฟิตและโรเตชั่น พร้อมชื่อลีก-ถ้วยมาตรฐานสากล',
    realism: {
      disableSupernatural: true,
      realisticScoring: true,
      realisticFatigue: true
    },
    tierNames: {
      0: 'ลีกภูมิภาค ดิวิชั่น 3',
      1: 'เนชันแนล แชมเปียนชิป (D2)',
      2: 'โปร พรีเมียร์ลีก (D1)',
      3: 'ฟุตบอลสโมสรนานาชาติ (อีลิท)'
    },
    cupNames: {
      fa: 'เนชันแนล เอฟเอ คัพ',
      leagueCup: 'โปร ลีก คัพ',
      divCup: 'ดิวิชั่น โทรฟี',
      superCup: 'แชมเปียนส์ ซูเปอร์ คัพ',
      asia: 'คอนติเนนตัล แชมเปียนส์ ลีก'
    },
    clubOverrides: {}
  },
  {
    v: 1,
    id: 'preset_world_pro_broadcast',
    name: '🌍 Mod ลีกสากลสมจริง (World Pro Broadcast)',
    author: 'System Preset',
    version: '1.1',
    description: 'โหมดฟุตบอลสมจริงเต็มรูปแบบ พร้อมชื่อลีกทั่วโลก ชื่อสโมสรและสนามเหย้าสไตล์ถ่ายทอดสดฟุตบอลอาชีพ (ปลอดภัยไร้ลิขสิทธิ์) และต่อยอดแก้ใน Excel/Sheets ได้',
    realism: {
      disableSupernatural: true,
      realisticScoring: true,
      realisticFatigue: true
    },
    tierNames: {
      0: 'เนชันแนล ลีก ทู (D3)',
      1: 'เนชันแนล ลีก แชมเปียนชิป (D2)',
      2: 'สยาม พรีเมียร์ ดิวิชั่น (D1)',
      3: 'คลับ อินเตอร์เนชันแนล คัพ'
    },
    worldLeagueNames: {
      TH: 'สยาม พรีเมียร์ ดิวิชั่น',
      GB: 'อิงลิช พรีเมียร์ ดิวิชั่น',
      ES: 'ไอบีเรีย พริเมรา ลีกา',
      DE: 'เยอรมัน 1. บุนเดสลีกา',
      IT: 'อิตาเลียน เซเรีย โปร',
      FR: 'เฟรนช์ ลีก 1',
      JP: 'นิปปอน เจ1 ลีก',
      KR: 'โคเรีย เคลีก 1',
      SA: 'อาระเบียน โปร ลีก',
      BR: 'บราซิล ซีรีเอ เอ',
      AR: 'อาร์เจนตินา พริเมรา'
    },
    cupNames: {
      fa: 'เอฟเอ คัพ',
      leagueCup: 'ลีก คัพ',
      divCup: 'แชมเปียนชิป โทรฟี',
      superCup: 'คอมมูนิตี ซูเปอร์ คัพ',
      asia: 'อินเตอร์เนชันแนล แชมเปียนส์ ลีก'
    },
    clubOverrides: {
      'ลอนดอน รอยัล เอฟซี': { name: 'ลอนดอน ยูไนเต็ด', stadium: 'คราวน์ ลอนดอน สเตเดียม', c1: '#1d4ed8', c2: '#ffffff' },
      'แมนเชสเตอร์ เรดส์': { name: 'แมนเชสเตอร์ แอธเลติก', stadium: 'แทรฟฟอร์ด ปาร์ค สเตเดียม', c1: '#dc2626', c2: '#111827' },
      'ลิเวอร์พูล เมอร์ซีย์': { name: 'เมอร์ซีย์ไซด์ เรดส์ เอฟซี', stadium: 'เมอร์ซีย์ ปาร์ค', c1: '#b91c1c', c2: '#facc15' },
      'เบอร์มิงแฮม มิดแลนด์': { name: 'มิดแลนด์ ซิตี้ เอฟซี', stadium: 'วิลลา มิดแลนด์ ปาร์ค', c1: '#7c2d12', c2: '#38bdf8' },
      'มาดริด รอยัล เอฟซี': { name: 'มาดริด เมโทร เอฟซี', stadium: 'เอสตาดิโอ คาสติยา', c1: '#ffffff', c2: '#eab308' },
      'บาร์เซโลนา โนวา เอฟซี': { name: 'คาตาโลเนีย เอฟซี', stadium: 'เอสตาดิโอ โนว์', c1: '#1e3a8a', c2: '#b91c1c' },
      'มิวนิก บาวาเรีย': { name: 'เอฟซี บาวาเรีย มิวนิก', stadium: 'มิวนิก อาเรน่า', c1: '#dc2626', c2: '#ffffff' },
      'ดอร์ทมุนด์ รูห์ร เอฟซี': { name: 'เวสต์ฟาเลีย ดอร์ทมุนด์', stadium: 'รูห์ร ซิกนัล สตาดิโอน', c1: '#facc15', c2: '#111827' },
      'มิลาน ลอมบาร์เดีย เอฟซี': { name: 'ลอมบาร์เดีย มิลาน เอฟซี', stadium: 'สตาดิโอ ซาน ซิโร่ นอร์ด', c1: '#1d4ed8', c2: '#111827' },
      'ตูริน อัลไพน์ เอฟซี': { name: 'เปียมอนเต้ ตูริน เอฟซี', stadium: 'อัลไพน์ สเตเดียม', c1: '#111827', c2: '#ffffff' },
      'ปารีส แซงต์-ลูมิแอร์': { name: 'ปารีส เมโทรโปล เอฟซี', stadium: 'ปาร์ก เดอ ปารีส', c1: '#1e3a8a', c2: '#dc2626' },
      'โตเกียว ฮาคุโร': { name: 'โตเกียว มหานคร เอฟซี', stadium: 'โตเกียว เนชันแนล สเตเดียม', c1: '#1d4ed8', c2: '#ffffff' },
      'โซล ชินโดก': { name: 'เอฟซี โซล แคปิตอล', stadium: 'โซล เวิลด์ คัพ สเตเดียม', c1: '#dc2626', c2: '#111827' },
      'ริยาด อัลซาฮิล': { name: 'ริยาด ซิตี้ คลับ', stadium: 'คิงดอม สปอร์ตส์ อาเรน่า', c1: '#1d4ed8', c2: '#facc15' }
    }
  }
];

export function installBuiltinModPreset(presetId: string, activate = true): GameModPack | null {
  const found = BUILTIN_REALISTIC_MOD_PRESETS.find((p) => p.id === presetId);
  if (!found) return null;
  const clone: GameModPack = JSON.parse(JSON.stringify(found));
  return saveInstalledMod(clone, activate);
}

export function buildTemplateModPack(state?: GameState | null): GameModPack {
  const catalog = getEditableClubCatalog(state);
  const clubOverrides: Record<string, ModClubOverride> = {};
  catalog.forEach((item) => {
    clubOverrides[item.key] = {
      name: item.defaultName,
      stadium: item.defaultStadium,
      c1: item.defaultC1,
      c2: item.defaultC2,
      ...(item.countryCode ? { countryCode: item.countryCode } : {}),
      ...(item.defaultLeagueName ? { leagueName: item.defaultLeagueName } : {})
    };
  });

  const worldLeagueNames: Record<string, string> = {};
  WORLD_LEAGUE_CATALOG.forEach((w) => {
    worldLeagueNames[w.countryCode] = w.defaultName;
  });

  return {
    v: 1,
    id: `mod_template_${Date.now()}`,
    name: 'แพ็กปรับแต่งลีกโลก สโมสร และนักเตะ',
    author: 'ผู้เล่น',
    version: '1.0',
    description: 'แก้ไขชื่อ/โลโก้เกม ลีกทั่วโลก บอลถ้วย สโมสร โลโก้ทีม และค่าพลังนักเตะผ่าน Excel / Google Sheets หรือ JSON',
    gameBrand: {
      title: DEFAULT_GAME_TITLE,
      subtitle: DEFAULT_GAME_SUBTITLE
    },
    realism: {
      disableSupernatural: true,
      realisticScoring: true,
      realisticFatigue: true
    },
    tierNames: {
      0: DEFAULT_TIER_NAMES[0],
      1: DEFAULT_TIER_NAMES[1],
      2: DEFAULT_TIER_NAMES[2],
      3: DEFAULT_TIER_NAMES[3]
    },
    worldLeagueNames,
    cupNames: {
      fa: DEFAULT_CUP_META.fa.name,
      leagueCup: DEFAULT_CUP_META.leagueCup.name,
      divCup: DEFAULT_CUP_META.divCup.name,
      superCup: DEFAULT_CUP_META.superCup.name,
      asia: DEFAULT_CUP_META.asia.name
    },
    cupMeta: {
      fa: { ...DEFAULT_CUP_META.fa },
      leagueCup: { ...DEFAULT_CUP_META.leagueCup },
      divCup: { ...DEFAULT_CUP_META.divCup },
      superCup: { ...DEFAULT_CUP_META.superCup },
      asia: { ...DEFAULT_CUP_META.asia }
    },
    clubOverrides,
    playerOverrides: {},
    playerDataOverrides: {}
  };
}

export function getCountryDisplayByCode(code?: string | null): string {
  if (!code) return '';
  const up = code.trim().toUpperCase();
  if (up === 'TH') return '🇹🇭 ไทย';
  const meta = COUNTRY_META_BY_CODE[up];
  return meta ? `${meta.flag} ${meta.country}` : up;
}
