import type { StatKey, Player, Team, GameState, GodBlessingPatch } from '../types/game';
import { clamp, fmtMoney } from '../utils/math';
import { LINE } from '../data/thaiFootballData';
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
    pl.traits = patch.traits.slice(0, 5);
  }
  pl.age = clamp(Math.round(patch.age), 15, 45);
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
    d.p.age = pl.age;
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
  delete pl.blessed;
  if ((pl.me || (d.mode === 'p' && d.p?.name === pl.n)) && d.p) {
    delete d.p.customD;
    syncMe(d);
  }
  recordPlayerSeasonProgress(pl, d.season ?? 1, d.md ?? 0, pl.me ? d.p : null);
  return true;
};

export function applySecretBoost(
  d: GameState,
  kind: 'money500' | 'money2500' | 'money10000' | 'stat5' | 'stat10' | 'healAll'
): string {
  if (kind === 'money500' || kind === 'money2500' || kind === 'money10000') {
    const amt = kind === 'money500' ? 500 : kind === 'money2500' ? 2500 : 10000;
    d.money += amt;
    logFin(d, 'งบสนับสนุนพิเศษ (VIP)', amt);
    if (d.mode === 'p' && d.p) {
      d.p.rep = clamp((d.p.rep ?? 20) + (kind === 'money500' ? 8 : 20), 0, 99);
      d.p.en = 100;
      syncMe(d);
    }
    return `🎁 เติมเงินทุน +${fmtMoney(amt)} สำเร็จ!`;
  }
  if (kind === 'healAll') {
    if (d.mode === 'p' && d.p) {
      d.p.en = 100;
      d.p.inj = 0;
      d.p.sus = 0;
      syncMe(d);
      return '🩺 ฟื้นฟูพลังกาย 100% & ล้างบาดเจ็บ/แบนสำเร็จ!';
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
