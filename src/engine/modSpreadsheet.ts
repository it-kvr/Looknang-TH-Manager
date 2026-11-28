import * as XLSX from 'xlsx';
import type {
  GameModPack,
  GameState,
  ModClubOverride,
  ModCupConfig,
  ModCupKey,
  ModPlayerOverride,
  Position,
  PreferredFoot,
  SubRole
} from '../types/game';
import { LINE, ROLE_BASE_ATTRS } from '../data/thaiFootballData';
import { clamp } from '../utils/math';
import {
  DEFAULT_CUP_META,
  DEFAULT_GAME_SUBTITLE,
  DEFAULT_GAME_TITLE,
  DEFAULT_TIER_NAMES,
  WORLD_LEAGUE_CATALOG,
  getEditableClubCatalog,
  normalizeModPack,
  sanitizeImageUrl
} from './mods';
import { DT, OVF } from './playerCore';

export interface SpreadsheetImportSummary {
  hasGameBrand: boolean;
  tierCount: number;
  worldLeagueCount: number;
  cupCount: number;
  clubCount: number;
  playerCount: number;
  sheetsRead: string[];
}

export type SpreadsheetImportResult =
  | { ok: true; pack: GameModPack; summary: SpreadsheetImportSummary }
  | { ok: false; error: string };

function strVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function numVal(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const cleaned = String(v).replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function boolVal(v: unknown, fallback?: boolean): boolean | undefined {
  const s = strVal(v).toLowerCase();
  if (!s) return fallback;
  if (['true', '1', 'yes', 'y', 'on', 'ใช่', 'เปิด'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off', 'ไม่', 'ปิด'].includes(s)) return false;
  return fallback;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(row).forEach(([k, v]) => {
    const nk = k
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[()]/g, '');
    out[nk] = v;
  });
  return out;
}

function pickField(r: Record<string, unknown>, aliases: string[]): unknown {
  for (const a of aliases) {
    const val = r[a];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return undefined;
}

function isPlaceholderOrUnchanged(custom: string, orig: string): boolean {
  if (!custom) return true;
  return custom.trim() === orig.trim();
}

function buildPlayerRowsForExport(pack: GameModPack, state?: GameState | null): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();

  if (state && Array.isArray(state.teams) && state.teams.length > 0) {
    const orderedTeams = state.teams.slice().sort((a, b) => a.tier - b.tier || a.id - b.id);
    orderedTeams.forEach((team) => {
      const clubOrig = team.origName || team.name;
      team.sq.forEach((pl) => {
        const origP = pl.origName || pl.n;
        const compKey = `${clubOrig}::${origP}`;
        seenKeys.add(compKey);
        const pov =
          pack.playerDataOverrides?.[compKey] ||
          pack.playerDataOverrides?.[origP] ||
          undefined;
        const dt = DT(pl, pl.me && state.mode === 'p' ? state.p : null);
        rows.push({
          club_orig_name: clubOrig,
          orig_name: origP,
          custom_name: pov?.name || pack.playerOverrides?.[origP] || (pl.n !== origP ? pl.n : ''),
          nat: pov?.nat || pl.nat || (team.tier >= 3 ? '' : 'TH'),
          pos: pov?.pos || pl.pos,
          role: pov?.ro || pl.ro,
          age: pov?.age ?? pl.age,
          shirt_no: pov?.no ?? pl.no ?? '',
          ov: pov?.ov ?? pl.ov,
          pot: pov?.pot ?? pl.pot,
          talent: pov?.talent ?? pl.talent ?? dt.tlVal,
          sh: pov?.sh ?? dt.a.sh,
          ps: pov?.ps ?? dt.a.ps,
          dr: pov?.dr ?? dt.a.dr,
          tk: pov?.tk ?? dt.a.tk,
          ph: pov?.ph ?? dt.a.ph,
          fit: pov?.fit ?? Math.round(pl.fit ?? 100),
          foot: pov?.foot ?? pl.foot ?? 'R',
          height_cm: pov?.ht ?? pl.ht ?? '',
          weight_kg: pov?.wt ?? pl.wt ?? '',
          price_k: pov?.price ?? pl.price ?? '',
          wage_k: pov?.wage ?? pl.con?.wg ?? ''
        });
      });
    });
  }

  // Include any player overrides not already emitted from active save
  Object.entries(pack.playerDataOverrides || {}).forEach(([k, pov]) => {
    if (seenKeys.has(k)) return;
    const parts = k.includes('::') ? k.split('::') : [pov.clubKey || '', k];
    const clubOrig = pov.clubKey || parts[0] || '';
    const origName = pov.origName || parts[1] || k;
    rows.push({
      club_orig_name: clubOrig,
      orig_name: origName,
      custom_name: pov.name || '',
      nat: pov.nat || '',
      pos: pov.pos || '',
      role: pov.ro || '',
      age: pov.age ?? '',
      shirt_no: pov.no ?? '',
      ov: pov.ov ?? '',
      pot: pov.pot ?? '',
      talent: pov.talent ?? '',
      sh: pov.sh ?? '',
      ps: pov.ps ?? '',
      dr: pov.dr ?? '',
      tk: pov.tk ?? '',
      ph: pov.ph ?? '',
      fit: pov.fit ?? '',
      foot: pov.foot ?? '',
      height_cm: pov.ht ?? '',
      weight_kg: pov.wt ?? '',
      price_k: pov.price ?? '',
      wage_k: pov.wage ?? ''
    });
  });

  Object.entries(pack.playerOverrides || {}).forEach(([origName, nextName]) => {
    if (seenKeys.has(origName)) return;
    const alreadyInData = rows.some((r) => strVal(r.orig_name) === origName);
    if (alreadyInData) return;
    rows.push({
      club_orig_name: '',
      orig_name: origName,
      custom_name: nextName,
      nat: '',
      pos: '',
      role: '',
      age: '',
      shirt_no: '',
      ov: '',
      pot: '',
      talent: '',
      sh: '',
      ps: '',
      dr: '',
      tk: '',
      ph: '',
      fit: '',
      foot: '',
      height_cm: '',
      weight_kg: '',
      price_k: '',
      wage_k: ''
    });
  });

  if (rows.length === 0) {
    // Provide clean starter example rows when exporting template from main menu without a loaded save
    const sampleAttrs = ROLE_BASE_ATTRS('FW', 'ST');
    rows.push(
      {
        club_orig_name: 'บุรีรัมย์ ยูไนเต็ด',
        orig_name: 'ชื่อนักเตะเดิม (ใส่เมื่อเปิดเซฟแล้วหรือดูจากเซฟ)',
        custom_name: 'ชื่อนักเตะใหม่ที่ต้องการ',
        nat: 'TH',
        pos: 'FW',
        role: 'ST',
        age: 24,
        shirt_no: 9,
        ov: 78,
        pot: 84,
        talent: 82,
        sh: clamp(sampleAttrs.sh + 22, 40, 95),
        ps: clamp(sampleAttrs.ps + 14, 40, 95),
        dr: clamp(sampleAttrs.dr + 18, 40, 95),
        tk: clamp(sampleAttrs.tk + 5, 30, 95),
        ph: clamp(sampleAttrs.ph + 18, 40, 95),
        fit: 100,
        foot: 'R',
        height_cm: 179,
        weight_kg: 73,
        price_k: 4500,
        wage_k: 85
      },
      {
        club_orig_name: 'ลอนดอน รอยัล เอฟซี',
        orig_name: 'ตัวอย่างนักเตะต่างชาติ',
        custom_name: 'โคล พาลเมอร์',
        nat: 'GB',
        pos: 'MF',
        role: 'CAM',
        age: 23,
        shirt_no: 10,
        ov: 86,
        pot: 91,
        talent: 90,
        sh: 85,
        ps: 88,
        dr: 87,
        tk: 54,
        ph: 76,
        fit: 100,
        foot: 'L',
        height_cm: 185,
        weight_kg: 76,
        price_k: 35000,
        wage_k: 420
      }
    );
  }

  return rows;
}

export function exportModPackToXlsx(pack: GameModPack, state?: GameState | null): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Game_Brand sheet
  const gameRows = [
    { key: 'mod_name', value: pack.name || 'My Custom Mod', description: 'ชื่อแพ็ก Mod (จำเป็น)' },
    { key: 'mod_author', value: pack.author || 'ผู้เล่น', description: 'ชื่อผู้สร้าง Mod' },
    { key: 'mod_version', value: pack.version || '1.0', description: 'เวอร์ชัน Mod' },
    { key: 'mod_description', value: pack.description || '', description: 'คำอธิบายแพ็ก Mod' },
    { key: 'game_title', value: pack.gameBrand?.title || DEFAULT_GAME_TITLE, description: 'ชื่อเกมที่แสดงหน้าหลักและแท็บเบราว์เซอร์' },
    { key: 'game_subtitle', value: pack.gameBrand?.subtitle || DEFAULT_GAME_SUBTITLE, description: 'คำโปรยใต้ชื่อเกม' },
    { key: 'game_logo_url', value: pack.gameBrand?.logoUrl || '', description: 'ลิงก์รูปโลโก้เกม (https://... หรือ data:image/...)' },
    { key: 'disable_supernatural', value: pack.realism?.disableSupernatural ? 'TRUE' : 'FALSE', description: 'TRUE = ตัดเหตุการณ์แฟนตาซี (ฟ้าผ่า/พร/พลิกนรก)' },
    { key: 'realistic_scoring', value: pack.realism?.realisticScoring ? 'TRUE' : 'FALSE', description: 'TRUE = สกอร์และ xG สมจริงแบบลีกอาชีพ' },
    { key: 'realistic_fatigue', value: pack.realism?.realisticFatigue ? 'TRUE' : 'FALSE', description: 'TRUE = ความล้าและโรเตชั่นสมจริง' }
  ];
  const wsGame = XLSX.utils.json_to_sheet(gameRows);
  wsGame['!cols'] = [{ wch: 24 }, { wch: 46 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsGame, 'Game_Brand');

  // 2. Leagues sheet (4 tiers + world leagues)
  const leagueRows: Record<string, unknown>[] = [
    ...[0, 1, 2, 3].map((idx) => {
      const k = `tier_${idx}`;
      return {
        league_key: k,
        country_flag: idx < 3 ? '🇹🇭' : '🌍',
        default_name: DEFAULT_TIER_NAMES[idx],
        custom_name: pack.tierNames?.[idx as 0 | 1 | 2 | 3] || DEFAULT_TIER_NAMES[idx],
        logo_url: pack.leagueLogos?.[k] || '',
        notes: idx < 3 ? `ลีกในประเทศ ระดับ ${idx + 1}` : 'หมวดสโมสรนานาชาติ'
      };
    }),
    ...WORLD_LEAGUE_CATALOG.map((wl) => ({
      league_key: wl.countryCode,
      country_flag: wl.flag,
      default_name: wl.defaultName,
      custom_name: pack.worldLeagueNames?.[wl.countryCode] || wl.defaultName,
      logo_url: pack.leagueLogos?.[wl.countryCode] || '',
      notes: `${wl.tierHint} (${wl.countryName})`
    }))
  ];
  const wsLeagues = XLSX.utils.json_to_sheet(leagueRows);
  wsLeagues['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 34 }, { wch: 42 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsLeagues, 'Leagues');

  // 3. Cups sheet
  const cupRows = (Object.keys(DEFAULT_CUP_META) as ModCupKey[]).map((key) => {
    const def = DEFAULT_CUP_META[key];
    const meta = pack.cupMeta?.[key];
    return {
      cup_key: key,
      default_name: def.name,
      custom_name: meta?.name || pack.cupNames?.[key] || def.name,
      short_name: meta?.short || def.short,
      icon: meta?.icon || def.icon,
      prize_k: meta?.prize ?? def.prize,
      logo_url: meta?.logoUrl || ''
    };
  });
  const wsCups = XLSX.utils.json_to_sheet(cupRows);
  wsCups['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsCups, 'Cups');

  // 4. Clubs sheet
  const catalog = getEditableClubCatalog(state);
  const clubRows = catalog.map((item) => {
    const ov = pack.clubOverrides?.[item.key];
    const liveTeam = state?.teams?.find((t) => (t.origName || t.name) === item.key);
    return {
      orig_name: item.key,
      custom_name: ov?.name || item.defaultName,
      short_name: ov?.shortName || liveTeam?.shortName || '',
      tier_or_country: item.isForeign ? `${item.countryFlag || ''} ${item.countryName || ''}`.trim() : `ระดับ ${item.tier + 1}`,
      country_code: ov?.countryCode || item.countryCode || '',
      league_name: ov?.leagueName || (item.countryCode ? pack.worldLeagueNames?.[item.countryCode] : undefined) || item.defaultLeagueName || '',
      stadium: ov?.stadium || item.defaultStadium,
      color_1: ov?.c1 || item.defaultC1,
      color_2: ov?.c2 || item.defaultC2,
      color_3: ov?.c3 || '',
      budget_k: ov?.budgetK ?? liveTeam?.budget ?? '',
      fans: ov?.fans ?? liveTeam?.fans ?? '',
      ovr_target: ov?.ovrTarget ?? '',
      logo_url: ov?.logoUrl || liveTeam?.logoUrl || ''
    };
  });
  const wsClubs = XLSX.utils.json_to_sheet(clubRows);
  wsClubs['!cols'] = [
    { wch: 26 },
    { wch: 26 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 26 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 11 },
    { wch: 44 }
  ];
  XLSX.utils.book_append_sheet(wb, wsClubs, 'Clubs');

  // 5. Players sheet
  const playerRows = buildPlayerRowsForExport(pack, state);
  const wsPlayers = XLSX.utils.json_to_sheet(playerRows);
  wsPlayers['!cols'] = [
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 8 },
    { wch: 7 },
    { wch: 8 },
    { wch: 7 },
    { wch: 9 },
    { wch: 7 },
    { wch: 7 },
    { wch: 8 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPlayers, 'Players');

  // 6. Guide sheet
  const guideRows = [
    { หัวข้อ: '1. การแก้ไขใน Google Sheets / Excel', รายละเอียด: 'อัปโหลดไฟล์ .xlsx นี้ขึ้น Google Drive แล้วเปิดด้วย Google Sheets หรือแก้ไขใน Microsoft Excel โดยตรง (ห้ามเปลี่ยนชื่อคอลัมน์ภาษาอังกฤษแถวแรก)' },
    { หัวข้อ: '2. โลโก้เกม / โลโก้ลีก / โลโก้ถ้วย / โลโก้สโมสร', รายละเอียด: 'ใส่ URL รูปภาพ (https://... .png/.svg/.jpg) ในคอลัมน์ logo_url หรือ game_logo_url ได้ทันที หากเว้นว่างจะใช้ตราสัญลักษณ์ของเกมอัตโนมัติ' },
    { หัวข้อ: '3. การตั้งชื่อลีกทั่วโลก (Leagues)', รายละเอียด: 'tier_0..tier_3 คือชื่อลีก 4 ระดับหลัก ส่วน GB, ES, DE, IT, FR, JP, KR, SA, BR ฯลฯ คือชื่อลีกตามประเทศทั่วโลก' },
    { หัวข้อ: '4. บอลถ้วย (Cups)', รายละเอียด: 'แก้ชื่อเต็ม custom_name, ชื่อย่อ short_name, ไอคอน icon, เงินรางวัล prize_k (หน่วยพันบาท เช่น 5000 = 5M) และ logo_url' },
    { หัวข้อ: '5. สโมสร (Clubs)', รายละเอียด: 'ห้ามแก้คอลัมน์ orig_name (ใช้จับคู่ทีมเดิม) ให้แก้ที่ custom_name, stadium, color_1 (#RRGGBB), color_2, budget_k, fans, ovr_target (ปรับ OVR เฉลี่ยทั้งทีม) และ logo_url' },
    { หัวข้อ: '6. นักเตะและค่าพลัง (Players)', รายละเอียด: 'แนะนำให้เปิดเซฟเกมก่อนแล้วค่อยกดส่งออก .xlsx เพื่อให้รายชื่อนักเตะทั้งเกมอยู่ในตารางครบ จากนั้นแก้ custom_name, nat, pos (GK/DF/MF/FW), role (ST/LW/CAM/CM/CB/GK...), age, ov, pot, sh, ps, dr, tk, ph ได้เต็มรูปแบบ' },
    { หัวข้อ: '7. วิธีนำเข้ากลับเข้าเกม', รายละเอียด: 'วิธี A: ดาวน์โหลดเป็น .xlsx จาก Excel/Google Sheets แล้วอัปโหลดเข้าเกม | วิธี B: กด Publish to web (เผยแพร่ทางเว็บ) ใน Google Sheets แล้วนำลิงก์มาวางในเกม | วิธี C: คัดลอกตาราง (Ctrl+C) แล้ววางลงในช่องนำเข้าได้เลย' }
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 36 }, { wch: 96 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guide');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function downloadModPackXlsx(filename: string, pack: GameModPack, state?: GameState | null) {
  const bytes = exportModPackToXlsx(pack, state);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

function classifySheetKind(name: string, rows: Record<string, unknown>[]): 'game' | 'leagues' | 'cups' | 'clubs' | 'players' | 'ignore' {
  const low = name.trim().toLowerCase();
  if (low.includes('guide') || low.includes('คู่มือ') || low.includes('help')) return 'ignore';
  if (low.includes('game') || low.includes('brand') || low.includes('ตั้งค่าเกม')) return 'game';
  if (low.includes('league') || low.includes('ลีก')) return 'leagues';
  if (low.includes('cup') || low.includes('ถ้วย')) return 'cups';
  if (low.includes('club') || low.includes('team') || low.includes('สโมสร') || low.includes('ทีม')) return 'clubs';
  if (low.includes('player') || low.includes('นักเตะ') || low.includes('ผู้เล่น')) return 'players';

  // Sniff headers when sheet name is generic (e.g. Sheet1 from CSV / single tab Google Sheet)
  if (rows.length > 0) {
    const keys = Object.keys(normalizeRowKeys(rows[0]));
    if (keys.includes('key') && keys.includes('value')) return 'game';
    if (keys.some((k) => ['cup_key', 'prize_k'].includes(k))) return 'cups';
    if (keys.some((k) => ['league_key'].includes(k))) return 'leagues';
    if (keys.some((k) => ['club_orig_name', 'sh', 'ps', 'dr', 'tk', 'ph', 'shirt_no', 'role'].includes(k))) return 'players';
    if (keys.some((k) => ['orig_name', 'stadium', 'color_1', 'budget_k'].includes(k))) return 'clubs';
  }
  return 'ignore';
}

function parseWorkbookToModPack(wb: XLSX.WorkBook, fallbackName = 'Spreadsheet Mod'): SpreadsheetImportResult {
  let modName = fallbackName;
  let modAuthor = 'ผู้เล่น';
  let modVersion = '1.0';
  let modDescription = '';

  const gameBrand: NonNullable<GameModPack['gameBrand']> = {};
  const realism: NonNullable<GameModPack['realism']> = {};
  const tierNames: Partial<Record<0 | 1 | 2 | 3, string>> = {};
  const worldLeagueNames: Record<string, string> = {};
  const leagueLogos: Record<string, string> = {};
  const cupNames: Partial<Record<ModCupKey, string>> = {};
  const cupMeta: Partial<Record<ModCupKey, ModCupConfig>> = {};
  const clubOverrides: Record<string, ModClubOverride> = {};
  const playerOverrides: Record<string, string> = {};
  const playerDataOverrides: Record<string, ModPlayerOverride> = {};
  const sheetsRead: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!rawRows.length) continue;

    const kind = classifySheetKind(sheetName, rawRows);
    if (kind === 'ignore') continue;
    sheetsRead.push(sheetName);

    if (kind === 'game') {
      rawRows.forEach((raw) => {
        const r = normalizeRowKeys(raw);
        const k = strVal(pickField(r, ['key', 'setting', 'หัวข้อ', 'คีย์'])).toLowerCase();
        const v = pickField(r, ['value', 'val', 'ค่า', 'รายละเอียด']);
        const sv = strVal(v);
        if (!k) return;
        if (k === 'mod_name' && sv) modName = sv;
        else if (k === 'mod_author' && sv) modAuthor = sv;
        else if (k === 'mod_version' && sv) modVersion = sv;
        else if (k === 'mod_description' && sv) modDescription = sv;
        else if (k === 'game_title' && sv && sv !== DEFAULT_GAME_TITLE) gameBrand.title = sv;
        else if (k === 'game_subtitle' && sv && sv !== DEFAULT_GAME_SUBTITLE) gameBrand.subtitle = sv;
        else if (k === 'game_logo_url') {
          const logo = sanitizeImageUrl(sv);
          if (logo) gameBrand.logoUrl = logo;
        } else if (k === 'disable_supernatural') {
          const b = boolVal(v);
          if (b !== undefined) realism.disableSupernatural = b;
        } else if (k === 'realistic_scoring') {
          const b = boolVal(v);
          if (b !== undefined) realism.realisticScoring = b;
        } else if (k === 'realistic_fatigue') {
          const b = boolVal(v);
          if (b !== undefined) realism.realisticFatigue = b;
        }
      });
    } else if (kind === 'leagues') {
      rawRows.forEach((raw) => {
        const r = normalizeRowKeys(raw);
        const key = strVal(pickField(r, ['league_key', 'key', 'code', 'รหัสลีก']));
        const defName = strVal(pickField(r, ['default_name', 'ชื่อเดิม']));
        const customName = strVal(pickField(r, ['custom_name', 'name', 'ชื่อใหม่', 'ชื่อลีก']));
        const logo = sanitizeImageUrl(pickField(r, ['logo_url', 'logo', 'โลโก้']));
        if (!key) return;
        const tierMatch = key.match(/^tier_([0-3])$/i);
        if (tierMatch) {
          const ti = Number(tierMatch[1]) as 0 | 1 | 2 | 3;
          if (customName && !isPlaceholderOrUnchanged(customName, defName || DEFAULT_TIER_NAMES[ti])) {
            tierNames[ti] = customName;
          }
          if (logo) leagueLogos[`tier_${ti}`] = logo;
        } else {
          const code = key.toUpperCase();
          const catDef = WORLD_LEAGUE_CATALOG.find((w) => w.countryCode === code)?.defaultName || defName;
          if (customName && !isPlaceholderOrUnchanged(customName, catDef || '')) {
            worldLeagueNames[code] = customName;
          }
          if (logo) leagueLogos[code] = logo;
        }
      });
    } else if (kind === 'cups') {
      rawRows.forEach((raw) => {
        const r = normalizeRowKeys(raw);
        const key = strVal(pickField(r, ['cup_key', 'key', 'รหัสถ้วย'])) as ModCupKey;
        if (!DEFAULT_CUP_META[key]) return;
        const def = DEFAULT_CUP_META[key];
        const defName = strVal(pickField(r, ['default_name', 'ชื่อเดิม'])) || def.name;
        const customName = strVal(pickField(r, ['custom_name', 'name', 'ชื่อใหม่']));
        const shortName = strVal(pickField(r, ['short_name', 'short', 'ชื่อย่อ']));
        const icon = strVal(pickField(r, ['icon', 'emoji', 'ไอคอน']));
        const prize = numVal(pickField(r, ['prize_k', 'prize', 'เงินรางวัล']));
        const logo = sanitizeImageUrl(pickField(r, ['logo_url', 'logo', 'โลโก้']));
        const cfg: ModCupConfig = {};
        if (customName && customName !== defName) {
          cfg.name = customName;
          cupNames[key] = customName;
        }
        if (shortName && shortName !== def.short) cfg.short = shortName;
        if (icon && icon !== def.icon) cfg.icon = icon;
        if (prize !== undefined && prize !== def.prize && prize > 0) cfg.prize = Math.round(prize);
        if (logo) cfg.logoUrl = logo;
        if (Object.keys(cfg).length > 0) cupMeta[key] = cfg;
      });
    } else if (kind === 'clubs') {
      rawRows.forEach((raw) => {
        const r = normalizeRowKeys(raw);
        const origName = strVal(pickField(r, ['orig_name', 'key', 'club_key', 'ชื่อเดิม', 'ชื่อสโมสรเดิม']));
        if (!origName) return;
        const customName = strVal(pickField(r, ['custom_name', 'name', 'ชื่อใหม่', 'ชื่อสโมสรใหม่']));
        const shortName = strVal(pickField(r, ['short_name', 'short', 'ชื่อย่อ']));
        const countryCode = strVal(pickField(r, ['country_code', 'country', 'ประเทศ'])).toUpperCase();
        const leagueName = strVal(pickField(r, ['league_name', 'league', 'ลีก']));
        const stadium = strVal(pickField(r, ['stadium', 'สนาม', 'ชื่อสนาม']));
        const c1 = strVal(pickField(r, ['color_1', 'c1', 'สีหลัก']));
        const c2 = strVal(pickField(r, ['color_2', 'c2', 'สีรอง']));
        const c3 = strVal(pickField(r, ['color_3', 'c3', 'สีตัดขอบ']));
        const budgetK = numVal(pickField(r, ['budget_k', 'budget', 'งบประมาณ']));
        const fans = numVal(pickField(r, ['fans', 'แฟนบอล']));
        const ovrTarget = numVal(pickField(r, ['ovr_target', 'ovr', 'ระดับทีม']));
        const logoUrl = sanitizeImageUrl(pickField(r, ['logo_url', 'logo', 'โลโก้']));

        const ov: ModClubOverride = {};
        if (customName && customName !== origName) ov.name = customName;
        if (shortName) ov.shortName = shortName;
        if (countryCode) ov.countryCode = countryCode;
        if (leagueName) ov.leagueName = leagueName;
        if (stadium && stadium !== `สนาม${origName}`) ov.stadium = stadium;
        if (/^#[0-9a-fA-F]{3,8}$/.test(c1)) ov.c1 = c1;
        if (/^#[0-9a-fA-F]{3,8}$/.test(c2)) ov.c2 = c2;
        if (/^#[0-9a-fA-F]{3,8}$/.test(c3)) ov.c3 = c3;
        if (budgetK !== undefined) ov.budgetK = Math.round(budgetK);
        if (fans !== undefined && fans >= 100) ov.fans = Math.round(fans);
        if (ovrTarget !== undefined && ovrTarget >= 30 && ovrTarget <= 99) ov.ovrTarget = Math.round(ovrTarget);
        if (logoUrl) ov.logoUrl = logoUrl;

        if (Object.keys(ov).length > 0) {
          clubOverrides[origName] = ov;
        }
      });
    } else if (kind === 'players') {
      rawRows.forEach((raw) => {
        const r = normalizeRowKeys(raw);
        const clubOrig = strVal(pickField(r, ['club_orig_name', 'club_key', 'club', 'ทีมเดิม', 'สโมสร']));
        const origName = strVal(pickField(r, ['orig_name', 'player_key', 'ชื่อเดิม', 'ชื่อนักเตะเดิม']));
        if (!origName || origName.startsWith('ชื่อนักเตะเดิม (')) return;
        const customName = strVal(pickField(r, ['custom_name', 'name', 'ชื่อใหม่', 'ชื่อนักเตะใหม่']));
        const nat = strVal(pickField(r, ['nat', 'nationality', 'สัญชาติ'])).toUpperCase();
        const posRaw = strVal(pickField(r, ['pos', 'position', 'ตำแหน่ง'])).toUpperCase() as Position;
        const roleRaw = strVal(pickField(r, ['role', 'ro', 'บทบาท'])).toUpperCase() as SubRole;
        const age = numVal(pickField(r, ['age', 'อายุ']));
        const no = numVal(pickField(r, ['shirt_no', 'no', 'number', 'เบอร์เสื้อ']));
        const ov = numVal(pickField(r, ['ov', 'ovr', 'พลังรวม']));
        const pot = numVal(pickField(r, ['pot', 'potential', 'ศักยภาพ']));
        const talent = numVal(pickField(r, ['talent', 'พรสวรรค์']));
        const sh = numVal(pickField(r, ['sh', 'shoot', 'ยิง']));
        const ps = numVal(pickField(r, ['ps', 'pass', 'จ่าย']));
        const dr = numVal(pickField(r, ['dr', 'dribble', 'เลี้ยง']));
        const tk = numVal(pickField(r, ['tk', 'tackle', 'defend', 'รับ']));
        const ph = numVal(pickField(r, ['ph', 'physical', 'กาย']));
        const fit = numVal(pickField(r, ['fit', 'fitness', 'ความฟิต']));
        const footRaw = strVal(pickField(r, ['foot', 'เท้าถนัด'])).toUpperCase();
        const ht = numVal(pickField(r, ['height_cm', 'ht', 'height', 'ส่วนสูง']));
        const wt = numVal(pickField(r, ['weight_kg', 'wt', 'weight', 'น้ำหนัก']));
        const price = numVal(pickField(r, ['price_k', 'price', 'มูลค่า']));
        const wage = numVal(pickField(r, ['wage_k', 'wage', 'ค่าเหนื่อย']));

        const pov: ModPlayerOverride = {};
        if (clubOrig) pov.clubKey = clubOrig;
        pov.origName = origName;
        if (customName && customName !== origName) pov.name = customName;
        if (nat) pov.nat = nat;
        if (['GK', 'DF', 'MF', 'FW'].includes(posRaw)) pov.pos = posRaw;
        if (roleRaw && LINE[roleRaw]) pov.ro = roleRaw;
        if (age !== undefined) pov.age = clamp(Math.round(age), 15, 45);
        if (no !== undefined) pov.no = clamp(Math.round(no), 1, 99);
        if (ov !== undefined) pov.ov = clamp(Math.round(ov), 20, 99);
        if (pot !== undefined) pov.pot = clamp(Math.round(pot), 20, 99);
        if (talent !== undefined) pov.talent = clamp(Math.round(talent), 20, 99);
        if (sh !== undefined) pov.sh = clamp(Math.round(sh), 1, 99);
        if (ps !== undefined) pov.ps = clamp(Math.round(ps), 1, 99);
        if (dr !== undefined) pov.dr = clamp(Math.round(dr), 1, 99);
        if (tk !== undefined) pov.tk = clamp(Math.round(tk), 1, 99);
        if (ph !== undefined) pov.ph = clamp(Math.round(ph), 1, 99);
        if (fit !== undefined) pov.fit = clamp(Math.round(fit), 1, 100);
        if (['L', 'R', 'B'].includes(footRaw)) pov.foot = footRaw as PreferredFoot;
        if (ht !== undefined) pov.ht = clamp(Math.round(ht), 145, 215);
        if (wt !== undefined) pov.wt = clamp(Math.round(wt), 45, 120);
        if (price !== undefined) pov.price = Math.max(1, Math.round(price));
        if (wage !== undefined) pov.wage = Math.max(1, Math.round(wage));

        // Compute ov automatically if core stats provided without explicit ov
        if (pov.ov === undefined && pov.sh !== undefined && pov.ps !== undefined && pov.dr !== undefined && pov.tk !== undefined && pov.ph !== undefined) {
          const calcPos = pov.pos || (pov.ro ? LINE[pov.ro] : 'MF');
          pov.ov = clamp(OVF(calcPos, { sh: pov.sh, ps: pov.ps, dr: pov.dr, tk: pov.tk, ph: pov.ph }), 20, 99);
        }

        const hasMeaningfulChange =
          Boolean(pov.name) ||
          pov.ov !== undefined ||
          pov.sh !== undefined ||
          pov.ps !== undefined ||
          pov.dr !== undefined ||
          pov.tk !== undefined ||
          pov.ph !== undefined ||
          pov.age !== undefined ||
          pov.pot !== undefined ||
          pov.talent !== undefined ||
          pov.no !== undefined ||
          pov.pos !== undefined ||
          pov.ro !== undefined ||
          Boolean(pov.nat);

        if (hasMeaningfulChange) {
          const mapKey = clubOrig ? `${clubOrig}::${origName}` : origName;
          playerDataOverrides[mapKey] = pov;
          if (pov.name) playerOverrides[origName] = pov.name;
        }
      });
    }
  }

  if (sheetsRead.length === 0) {
    return {
      ok: false,
      error: 'ไม่พบชีตหรือคอลัมน์ Mod ที่รู้จักในไฟล์นี้ กรุณาใช้ไฟล์แม่แบบ .xlsx จากเกมหรือตรวจสอบหัวคอลัมน์'
    };
  }

  const normalized = normalizeModPack({
    v: 1,
    id: `mod_sheet_${Date.now()}`,
    name: modName,
    author: modAuthor,
    version: modVersion,
    description: modDescription || 'นำเข้าจาก Excel / Google Sheets',
    gameBrand,
    realism,
    tierNames,
    worldLeagueNames,
    leagueLogos,
    cupNames,
    cupMeta,
    clubOverrides,
    playerOverrides,
    playerDataOverrides
  });

  if (!normalized) {
    return { ok: false, error: 'ไม่สามารถแปลงข้อมูลจากตารางเป็นแพ็ก Mod ได้' };
  }

  return {
    ok: true,
    pack: normalized,
    summary: {
      hasGameBrand: Boolean(gameBrand.title || gameBrand.subtitle || gameBrand.logoUrl),
      tierCount: Object.keys(tierNames).length,
      worldLeagueCount: Object.keys(worldLeagueNames).length,
      cupCount: Object.keys(cupMeta).length,
      clubCount: Object.keys(clubOverrides).length,
      playerCount: Object.keys(playerDataOverrides).length,
      sheetsRead
    }
  };
}

export function parseSpreadsheetBufferToModPack(buffer: ArrayBuffer, fileName = ''): SpreadsheetImportResult {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const baseName = fileName.replace(/\.(xlsx|xls|csv|tsv)$/i, '').trim() || 'Excel Mod Pack';
    return parseWorkbookToModPack(wb, baseName);
  } catch {
    return {
      ok: false,
      error: 'อ่านไฟล์ Excel/CSV ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์ไม่เสียหายและไม่ติดรหัสผ่าน'
    };
  }
}

export function parseSpreadsheetTextToModPack(rawText: string): SpreadsheetImportResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: 'กรุณาวางข้อมูล JSON, CSV หรือคัดลอกตารางจาก Google Sheets / Excel' };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const pack = normalizeModPack(parsed);
      if (!pack) {
        return { ok: false, error: 'ไฟล์ JSON ต้องมีชื่อแพ็ก ("name") และรูปแบบที่ถูกต้อง' };
      }
      return {
        ok: true,
        pack,
        summary: {
          hasGameBrand: Boolean(pack.gameBrand?.title || pack.gameBrand?.logoUrl),
          tierCount: Object.keys(pack.tierNames || {}).length,
          worldLeagueCount: Object.keys(pack.worldLeagueNames || {}).length,
          cupCount: Object.keys(pack.cupMeta || pack.cupNames || {}).length,
          clubCount: Object.keys(pack.clubOverrides || {}).length,
          playerCount: Math.max(
            Object.keys(pack.playerDataOverrides || {}).length,
            Object.keys(pack.playerOverrides || {}).length
          ),
          sheetsRead: ['JSON']
        }
      };
    } catch {
      return { ok: false, error: 'รูปแบบ JSON ไม่ถูกต้อง กรุณาตรวจสอบเครื่องหมายวงเล็บหรือคำพูด' };
    }
  }

  try {
    const isTsv = trimmed.includes('\t');
    const wb = XLSX.read(trimmed, {
      type: 'string',
      FS: isTsv ? '\t' : ','
    });
    return parseWorkbookToModPack(wb, 'Google Sheets / Table Mod');
  } catch {
    return {
      ok: false,
      error: 'ไม่สามารถอ่านข้อความตารางได้ กรุณาตรวจสอบว่ามีแถวหัวคอลัมน์ (เช่น orig_name, custom_name) ครบถ้วน'
    };
  }
}

export function buildGoogleSheetsExportCandidates(inputUrl: string): string[] {
  const raw = inputUrl.trim();
  if (!raw) return [];

  // Direct export/csv/xlsx link
  if (/\/(export|pub)\?/.test(raw) || /\.(xlsx|csv)(\?|$)/i.test(raw)) {
    return [raw];
  }

  // Published Google Sheet: /spreadsheets/d/e/<PUB_ID>/...
  const pubMatch = raw.match(/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (pubMatch) {
    const pubId = pubMatch[1];
    return [
      `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=xlsx`,
      `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`
    ];
  }

  // Standard Google Sheet: /spreadsheets/d/<SHEET_ID>/...
  const idMatch = raw.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    const sheetId = idMatch[1];
    const gidMatch = raw.match(/[?&#]gid=(\d+)/);
    const gidSuffix = gidMatch ? `&gid=${gidMatch[1]}` : '';
    return [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidSuffix}`
    ];
  }

  return [raw];
}

export async function fetchGoogleSheetModPack(url: string): Promise<SpreadsheetImportResult> {
  const candidates = buildGoogleSheetsExportCandidates(url);
  if (!candidates.length) {
    return { ok: false, error: 'กรุณาวางลิงก์ Google Sheets ก่อน' };
  }

  let sawHtmlOrAuth = false;
  let lastNetworkError = false;

  for (const targetUrl of candidates) {
    try {
      const resp = await fetch(targetUrl, { mode: 'cors' });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) sawHtmlOrAuth = true;
        continue;
      }
      const ctype = (resp.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('text/html')) {
        sawHtmlOrAuth = true;
        continue;
      }
      const buf = await resp.arrayBuffer();
      if (buf.byteLength < 16) continue;
      const headBytes = new Uint8Array(buf.slice(0, 64));
      const headText = new TextDecoder().decode(headBytes).trim().toLowerCase();
      if (headText.startsWith('<!doctype') || headText.startsWith('<html')) {
        sawHtmlOrAuth = true;
        continue;
      }

      const parsed = parseSpreadsheetBufferToModPack(buf, 'Google Sheets Mod');
      if (parsed.ok) {
        parsed.pack.sourceUrl = url.trim();
        return parsed;
      }
    } catch {
      lastNetworkError = true;
    }
  }

  if (sawHtmlOrAuth) {
    return {
      ok: false,
      error:
        'Google Sheet นี้ยังไม่เปิดสิทธิ์สาธารณะ กรุณาตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์ดูได้" หรือ "ไฟล์ -> เผยแพร่ทางเว็บ (Publish to web)" หรือดาวน์โหลดเป็นไฟล์ .xlsx แล้วอัปโหลดเข้าเกมแทน'
    };
  }
  if (lastNetworkError) {
    return {
      ok: false,
      error:
        'เบราว์เซอร์ติดสิทธิ์ CORS จากลิงก์นี้ แนะนำให้กดใน Google Sheets: ไฟล์ -> เผยแพร่ทางเว็บ -> เลือก Microsoft Excel (.xlsx) แล้วนำลิงก์มาวาง หรือกด ดาวน์โหลดเป็น .xlsx เพื่อนำเข้าได้ทันที 100%'
    };
  }
  return {
    ok: false,
    error: 'ไม่พบข้อมูล Mod ที่อ่านได้จากลิงก์นี้ กรุณาใช้ลิงก์จากไฟล์แม่แบบของเกมหรือนำเข้าด้วยไฟล์ .xlsx'
  };
}
