import type { StatKey, Player, Team, GameState, GodBlessingPatch } from '../types/game';
import { clamp, fmtMoney, MAX_CLUB_MONEY, capMoney } from '../utils/math';
import { LINE, CAREER_PERKS, PLAYER_PERSONALITIES, SKIN_P, HAIR_P } from '../data/thaiFootballData';
import { ovMe, syncMe, logFin, recordPlayerSeasonProgress } from './playerCore';

export const findMutablePlayerInState = (d: GameState, playerName: string, teamId: number | null): { pl: Player | null; team: Team | null } => {
  if (teamId !== null && d.teams[teamId]) {
    const found = d.teams[teamId].sq.find((q) => q.n === playerName);
    if (found) return { pl: found, team: d.teams[teamId] };
  }
  const inMk = d.mk.find((q) => q.n === playerName);
  if (inMk) return { pl: inMk, team: null };
  const inYth = d.yth.find((q) => q.n === playerName);
  if (inYth) return { pl: inYth, team: d.teams[d.me] || null };
  for (const t of d.teams) {
    const found = t.sq.find((q) => q.n === playerName);
    if (found) return { pl: found, team: t };
  }
  return { pl: null, team: null };
};

export const applyGodBlessingToPlayer = (d: GameState, playerName: string, teamId: number | null, patch: GodBlessingPatch) => {
  const { pl } = findMutablePlayerInState(d, playerName, teamId);
  if (!pl) return false;
  const nextPos = LINE[patch.ro] || pl.pos;
  pl.ro = patch.ro;
  pl.pos = nextPos;
  pl.ov = clamp(Math.round(patch.ov), 1, 99);
  pl.pot = clamp(Math.round(Math.max(patch.pot, pl.ov)), 1, 99);
  if (patch.talent !== undefined) {
    pl.talent = clamp(Math.round(patch.talent), 25, 99);
  }
  if (patch.traits !== undefined) {
    pl.traits = patch.traits.slice(0, 6);
  }
  if (patch.altRoles !== undefined) {
    const cleanAlt = Array.from(new Set(patch.altRoles)).filter(
      (r) => r !== patch.ro && Boolean(LINE[r])
    );
    pl.altRoles = cleanAlt;
  }
  if (patch.customPers !== undefined) {
    pl.customPers = clamp(Math.round(patch.customPers), 0, PLAYER_PERSONALITIES.length - 1);
  }
  if (Array.isArray(patch.vis) && patch.vis.length >= 6) {
    const v = patch.vis.slice();
    v[5] = pl.no || v[5] || 10;
    pl.vis = v;
  }
  pl.age = clamp(Math.round(patch.age), 15, 45);
  if (patch.ht !== undefined) pl.ht = clamp(Math.round(patch.ht), 155, 205);
  if (patch.wt !== undefined) pl.wt = clamp(Math.round(patch.wt), 50, 110);
  if (patch.foot !== undefined) pl.foot = patch.foot;
  pl.fit = clamp(Math.round(patch.fit), 1, 100);
  pl.inj = Math.max(0, Math.round(patch.inj));
  pl.sus = Math.max(0, Math.round(patch.sus));
  pl.customA = {
    sh: clamp(Math.round(patch.coreA.sh), 1, 99),
    ps: clamp(Math.round(patch.coreA.ps), 1, 99),
    dr: clamp(Math.round(patch.coreA.dr), 1, 99),
    tk: clamp(Math.round(patch.coreA.tk), 1, 99),
    ph: clamp(Math.round(patch.coreA.ph), 1, 99)
  };
  const cleanSub: Record<string, number> = {};
  Object.entries(patch.subD).forEach(([k, v]) => {
    cleanSub[k] = clamp(Math.round(v), 1, 99);
  });
  pl.customD = cleanSub;
  pl.customSig = patch.sig;
  pl.blessed = true;

  if ((pl.me || (d.mode === 'p' && d.p?.name === pl.n)) && d.p) {
    d.p.pos = nextPos;
    d.p.sp = patch.ro;
    d.p.a = { ...pl.customA };
    d.p.b = { ...pl.customA };
    d.p.sig = patch.sig;
    d.p.customD = { ...cleanSub };
    if (pl.talent !== undefined) d.p.talent = pl.talent;
    if (pl.traits !== undefined) d.p.traits = [...pl.traits];
    if (pl.altRoles !== undefined) d.p.altRoles = [...pl.altRoles];
    if (pl.customPers !== undefined) d.p.customPers = pl.customPers;
    if (patch.perks !== undefined) d.p.perks = [...patch.perks];
    if (Array.isArray(patch.vis) && patch.vis.length >= 6) {
      d.p.k = SKIN_P[patch.vis[0]] || d.p.k;
      d.p.h = HAIR_P[patch.vis[1]] || d.p.h;
      d.p.hs = patch.vis[2] ?? d.p.hs;
      d.p.fh = patch.vis[3] ?? d.p.fh;
      d.p.ey = patch.vis[4] ?? d.p.ey;
      d.p.fs = patch.vis[6] ?? d.p.fs;
      d.p.acc = patch.vis[7] ?? d.p.acc;
    }
    d.p.age = pl.age;
    if (pl.ht !== undefined) d.p.ht = pl.ht;
    if (pl.wt !== undefined) d.p.wt = pl.wt;
    if (pl.foot !== undefined) d.p.foot = pl.foot;
    d.p.en = pl.fit;
    d.p.inj = pl.inj;
    d.p.sus = pl.sus;
    syncMe(d);
  }
  recordPlayerSeasonProgress(pl, d.season ?? 1, d.md ?? 0, pl.me ? d.p : null);
  return true;
};

export const resetGodBlessingOnPlayer = (d: GameState, playerName: string, teamId: number | null) => {
  const { pl } = findMutablePlayerInState(d, playerName, teamId);
  if (!pl) return false;
  delete pl.customA;
  delete pl.customD;
  delete pl.customSig;
  delete pl.customPers;
  delete pl.blessed;
  if ((pl.me || (d.mode === 'p' && d.p?.name === pl.n)) && d.p) {
    delete d.p.customD;
    delete d.p.customPers;
    syncMe(d);
  }
  recordPlayerSeasonProgress(pl, d.season ?? 1, d.md ?? 0, pl.me ? d.p : null);
  return true;
};

export function applySecretMoneyAdjust(
  d: GameState,
  mode: 'add' | 'sub' | 'set',
  amountK: number
): string {
  const cleanAmt = Math.max(0, Math.round(Number.isFinite(amountK) ? amountK : 0));
  const prev = Math.round(d.money || 0);
  if (mode === 'set') {
    const target = capMoney(cleanAmt);
    const diff = target - prev;
    d.money = target;
    if (diff !== 0) {
      logFin(d, diff > 0 ? 'ปรับงบเป็นยอดกำหนด (VIP)' : 'ปรับลดงบเป็นยอดกำหนด (VIP)', diff);
    }
    if (cleanAmt > MAX_CLUB_MONEY) {
      return `💳 ตั้งงบสโมสรเป็น ${fmtMoney(d.money)} แล้ว (เพดานสูงสุด ${fmtMoney(MAX_CLUB_MONEY)})`;
    }
    return `💳 ตั้งงบสโมสรเป็น ${fmtMoney(d.money)} แล้ว`;
  }
  if (cleanAmt <= 0) return 'กรุณาระบุจำนวนเงินมากกว่า 0';
  if (mode === 'sub') {
    d.money = capMoney(Math.round((d.money || 0) - cleanAmt));
    logFin(d, 'ปรับลดงบพิเศษ (VIP)', -cleanAmt);
    return `💸 ลดงบสโมสร -${fmtMoney(cleanAmt)} (คงเหลือ ${fmtMoney(d.money)})`;
  }
  const next = capMoney(Math.round((d.money || 0) + cleanAmt));
  const actualAdded = Math.max(0, next - prev);
  d.money = next;
  if (actualAdded <= 0) {
    return `💰 งบสโมสรถึงเพดานสูงสุด ${fmtMoney(MAX_CLUB_MONEY)} แล้ว`;
  }
  logFin(d, 'งบสนับสนุนพิเศษ (VIP)', actualAdded);
  if (actualAdded < cleanAmt) {
    return `🎁 เติมเงินทุน +${fmtMoney(actualAdded)} (ถึงเพดานสูงสุด ${fmtMoney(MAX_CLUB_MONEY)})`;
  }
  return `🎁 เติมเงินทุน +${fmtMoney(actualAdded)} สำเร็จ!`;
}

export function applySecretBoost(
  d: GameState,
  kind: 'money500' | 'money2500' | 'money10000' | 'sub500' | 'sub2500' | 'sub10000' | 'stat5' | 'stat10' | 'healAll'
): string {
  if (kind === 'money500' || kind === 'money2500' || kind === 'money10000') {
    const amt = kind === 'money500' ? 500 : kind === 'money2500' ? 2500 : 10000;
    const prev = d.money || 0;
    const next = capMoney(prev + amt);
    const actualAdded = Math.max(0, next - prev);
    d.money = next;
    if (actualAdded > 0) {
      logFin(d, 'งบสนับสนุนพิเศษ (VIP)', actualAdded);
    }
    if (d.mode === 'p' && d.p) {
      d.p.rep = clamp((d.p.rep ?? 20) + (kind === 'money500' ? 8 : 20), 0, 99);
      d.p.en = 100;
      syncMe(d);
    }
    if (actualAdded <= 0) {
      return `💰 งบสโมสรถึงเพดานสูงสุด ${fmtMoney(MAX_CLUB_MONEY)} แล้ว`;
    }
    if (actualAdded < amt) {
      return `🎁 เติมเงินทุน +${fmtMoney(actualAdded)} (ถึงเพดานสูงสุด ${fmtMoney(MAX_CLUB_MONEY)})`;
    }
    return `🎁 เติมเงินทุน +${fmtMoney(actualAdded)} สำเร็จ!`;
  }
  if (kind === 'sub500' || kind === 'sub2500' || kind === 'sub10000') {
    const amt = kind === 'sub500' ? 500 : kind === 'sub2500' ? 2500 : 10000;
    return applySecretMoneyAdjust(d, 'sub', amt);
  }
  if (kind === 'healAll') {
    if (d.mode === 'p' && d.p) {
      d.p.en = 100;
      d.p.inj = 0;
      d.p.sus = 0;
      syncMe(d);
      return '🩺 ฟื้นฟูความฟิต 100% & ล้างบาดเจ็บ/แบนสำเร็จ!';
    }
    const t = d.teams[d.me];
    if (t) {
      t.sq.forEach((q) => {
        q.fit = 100;
        q.inj = 0;
        q.sus = 0;
      });
      t.tacFam = clamp((t.tacFam ?? 65) + 15, 0, 100);
    }
    d.mor = clamp((d.mor ?? 60) + 20, 0, 100);
    return '🩺 ฟื้นฟูทีมฟิต 100% หายเจ็บและล้างโทษแบนยกทีมแล้ว!';
  }
  const delta = kind === 'stat5' ? 5 : 10;
  if (d.mode === 'p' && d.p) {
    (['sh', 'ps', 'dr', 'tk', 'ph'] as StatKey[]).forEach((k) => {
      d.p!.a[k] = clamp((d.p!.a[k] ?? 60) + delta, 1, 99);
    });
    d.p.en = 100;
    d.p.sus = 0;
    syncMe(d);
    return `⚡ อัปเกรดพลัง +${delta} (OVR ${ovMe(d.p)}) & ฟิต 100% สำเร็จ!`;
  }
  const t = d.teams[d.me];
  if (t) {
    t.sq.forEach((q) => {
      q.ov = clamp(q.ov + delta, 1, 99);
      q.pot = Math.max(q.pot ?? q.ov, clamp(q.ov + 5, 1, 99));
      q.fit = 100;
      q.inj = 0;
      q.sus = 0;
      recordPlayerSeasonProgress(q, d.season ?? 1, d.md ?? 0, q.me ? d.p : null);
    });
    t.tacFam = clamp((t.tacFam ?? 65) + delta * 2, 0, 100);
  }
  d.mor = clamp((d.mor ?? 60) + 15, 0, 100);
  return `⚡ เสริมพลังทั้งทีม +${delta} OVR & ฟิต 100% สำเร็จ!`;
}

export function applySecretRepAdjust(
  d: GameState,
  mode: 'add' | 'sub' | 'set',
  amount: number
): string {
  if (!d.p) return 'ไม่พบข้อมูลนักเตะ';
  const cleanAmt = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  if (mode === 'set') {
    d.p.rep = clamp(cleanAmt, 0, 999);
    syncMe(d);
    return `⭐ ตั้งค่าชื่อเสียงเป็น ★ ${d.p.rep} แล้ว`;
  }
  if (cleanAmt <= 0) return 'กรุณาระบุจำนวนมากกว่า 0';
  if (mode === 'sub') {
    d.p.rep = clamp((d.p.rep ?? 10) - cleanAmt, 0, 999);
    syncMe(d);
    return `📉 ลดชื่อเสียง -${cleanAmt} (คงเหลือ ★ ${d.p.rep})`;
  }
  d.p.rep = clamp((d.p.rep ?? 10) + cleanAmt, 0, 999);
  syncMe(d);
  return `⭐ เพิ่มชื่อเสียง +${cleanAmt} (รวม ★ ${d.p.rep}) สำเร็จ!`;
}

export function applySecretPlayerBoost(
  d: GameState,
  kind: 'rep15' | 'rep50' | 'repSub10' | 'talent10' | 'ageSub2' | 'unlockPerks'
): string {
  if (!d.p) return 'ไม่พบข้อมูลนักเตะ';
  if (kind === 'rep15') return applySecretRepAdjust(d, 'add', 15);
  if (kind === 'rep50') return applySecretRepAdjust(d, 'add', 50);
  if (kind === 'repSub10') return applySecretRepAdjust(d, 'sub', 10);
  if (kind === 'talent10') {
    const nextTl = clamp((d.p.talent ?? 75) + 10, 25, 99);
    d.p.talent = nextTl;
    const meSq = d.teams[d.me]?.sq.find((q) => q.me);
    if (meSq) {
      meSq.talent = nextTl;
      meSq.pot = Math.max(meSq.pot ?? nextTl, nextTl);
    }
    syncMe(d);
    return `🌟 อัปเกรดพรสวรรค์เป็น ${nextTl}/99 สำเร็จ!`;
  }
  if (kind === 'ageSub2') {
    const nextAge = clamp((d.p.age ?? 18) - 2, 16, 40);
    d.p.age = nextAge;
    const meSq = d.teams[d.me]?.sq.find((q) => q.me);
    if (meSq) meSq.age = nextAge;
    syncMe(d);
    return `⏳ ย้อนวัยนักเตะเหลืออายุ ${nextAge} ปี สำเร็จ!`;
  }
  d.p.perks = CAREER_PERKS.map((pk) => pk.id);
  syncMe(d);
  return '🔓 ปลดล็อกสกิลอาชีพ (Career Perks) ครบทุกสกิลแล้ว!';
}

