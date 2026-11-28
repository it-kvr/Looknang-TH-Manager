import {
  FOREIGN_CLUB_CATALOG,
  TIER_STANDALONE_CLUBS,
  TN,
  getForeignClubStadiumName,
  getForeignTeamCountryMeta
} from '../data/thaiFootballData';
import type { GameModPack, GameState, ModClubOverride, ModRealismSettings, Team } from '../types/game';

const MOD_PACKS_KEY = 'looknang_mod_packs_v1';
const ACTIVE_MOD_ID_KEY = 'looknang_active_mod_id_v1';

export const DEFAULT_TIER_NAMES: [string, string, string, string] = [
  TN[0] || 'ลีกระดับจังหวัด',
  TN[1] || 'ลีกในประเทศ ดิวิชั่น 2',
  TN[2] || 'ลีกในประเทศ ดิวิชั่น 1',
  TN[3] || 'สโมสรนานาชาติ'
];

export interface EditableClubCatalogItem {
  key: string;
  tier: number;
  isForeign: boolean;
  countryFlag?: string;
  countryName?: string;
  defaultName: string;
  defaultStadium: string;
  defaultC1: string;
  defaultC2: string;
}

function sanitizeHexColor(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined;
}

function sanitizeClubOverride(raw: unknown): ModClubOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: ModClubOverride = {};
  if (typeof obj.name === 'string' && obj.name.trim()) out.name = obj.name.trim().slice(0, 64);
  if (typeof obj.stadium === 'string' && obj.stadium.trim()) out.stadium = obj.stadium.trim().slice(0, 80);
  const c1 = sanitizeHexColor(obj.c1);
  const c2 = sanitizeHexColor(obj.c2);
  const c3 = sanitizeHexColor(obj.c3);
  if (c1) out.c1 = c1;
  if (c2) out.c2 = c2;
  if (c3) out.c3 = c3;
  if (typeof obj.kit === 'number' && Number.isFinite(obj.kit)) out.kit = Math.max(0, Math.round(obj.kit));
  if (typeof obj.awayKit === 'number' && Number.isFinite(obj.awayKit)) out.awayKit = Math.max(0, Math.round(obj.awayKit));
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

  const cupNames: GameModPack['cupNames'] = {};
  if (obj.cupNames && typeof obj.cupNames === 'object') {
    const cn = obj.cupNames as Record<string, unknown>;
    (['fa', 'leagueCup', 'divCup', 'superCup', 'asia'] as const).forEach((k) => {
      if (typeof cn[k] === 'string' && cn[k]!.trim()) {
        cupNames[k] = (cn[k] as string).trim().slice(0, 64);
      }
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
    ...(Object.keys(realism).length > 0 ? { realism } : {}),
    ...(Object.keys(tierNames).length > 0 ? { tierNames } : {}),
    ...(Object.keys(cupNames).length > 0 ? { cupNames } : {}),
    clubOverrides,
    ...(Object.keys(playerOverrides).length > 0 ? { playerOverrides } : {})
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

export function applyActiveModToRuntimeData(explicitMod?: GameModPack | null) {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  DEFAULT_TIER_NAMES.forEach((defName, idx) => {
    const override = mod?.tierNames?.[idx as 0 | 1 | 2 | 3];
    TN[idx] = override && override.trim() ? override.trim() : defName;
  });
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
  key: keyof NonNullable<GameModPack['cupNames']>,
  fallback: string,
  explicitMod?: GameModPack | null
): string {
  const mod = explicitMod === undefined ? getActiveMod() : explicitMod;
  const custom = mod?.cupNames?.[key];
  return custom && custom.trim() ? custom.trim() : fallback;
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
      if (team.id === state?.me && state.club) {
        state.club.name = baseName;
        state.club.c1 = baseKc[0];
        state.club.c2 = baseKc[1];
        if (baseStadium) state.club.std = baseStadium;
      }
    } else {
      const ov = mod.clubOverrides?.[baseName] || mod.clubOverrides?.[team.name];
      const nextName = ov?.name || baseName;
      const nextC1 = ov?.c1 || baseKc[0];
      const nextC2 = ov?.c2 || baseKc[1];
      const nextStadium = ov?.stadium || baseStadium;

      if (
        team.name !== nextName ||
        team.kc[0] !== nextC1 ||
        team.kc[1] !== nextC2 ||
        (ov?.stadium && team.stadiumName !== ov.stadium)
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

      if (team.id === state?.me && state.club) {
        state.club.name = nextName;
        state.club.c1 = nextC1;
        state.club.c2 = nextC2;
        if (ov?.c3) state.club.c3 = ov.c3;
        if (ov?.stadium) state.club.std = ov.stadium;
        if (typeof ov?.kit === 'number') state.club.kit = ov.kit;
        if (typeof ov?.awayKit === 'number') state.club.awayKit = ov.awayKit;
      }
    }

    // Player overrides (safe rename + restore)
    const renameMap = new Map<string, string>();
    team.sq.forEach((pl) => {
      const origPName = pl.origName || pl.n;
      if (!pl.origName) pl.origName = origPName;
      const targetPName = mod?.playerOverrides?.[origPName] || mod?.playerOverrides?.[pl.n] || origPName;
      if (pl.n !== targetPName) {
        renameMap.set(pl.n, targetPName);
        pl.n = targetPName;
        if (pl.me && state?.mode === 'p' && state.p) {
          state.p.name = targetPName;
        }
        changedPlayers++;
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
        return {
          key,
          tier: team.tier,
          isForeign,
          countryFlag: meta?.flag,
          countryName: meta?.country,
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
        defaultName: name,
        defaultStadium: `สนาม${name}`,
        defaultC1: '#158049',
        defaultC2: '#f5c242'
      });
    });
  });

  FOREIGN_CLUB_CATALOG.forEach((entry) => {
    items.push({
      key: entry.name,
      tier: 3,
      isForeign: true,
      countryFlag: entry.flag,
      countryName: entry.country,
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
    version: '1.0',
    description: 'โหมดฟุตบอลสมจริงเต็มรูปแบบ พร้อมชื่อสโมสรและสนามเหย้าสไตล์ถ่ายทอดสดฟุตบอลอาชีพ (ปลอดภัยไร้ลิขสิทธิ์) และต่อยอดแก้ชื่อเองได้',
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
      c2: item.defaultC2
    };
  });

  return {
    v: 1,
    id: `mod_template_${Date.now()}`,
    name: 'แพ็กปรับแต่งลีกและสโมสร',
    author: 'ผู้เล่น',
    version: '1.0',
    description: 'แก้ไขกติกาความสมจริง ชื่อลีก ชื่อถ้วย ชื่อสโมสร ชื่อสนาม สีเสื้อ และรายชื่อนักเตะในไฟล์นี้',
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
    cupNames: {
      fa: 'ถ้วยประชาชน',
      leagueCup: 'ไทยลีก คัพ',
      divCup: 'ถ้วยดิวิชั่น & ภูมิภาค',
      superCup: 'ไทยแลนด์ แชมเปี้ยนส์ คัพ',
      asia: 'ชิงแชมป์สโมสรทวีป'
    },
    clubOverrides,
    playerOverrides: {}
  };
}
