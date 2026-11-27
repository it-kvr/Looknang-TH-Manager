import type {
  ArchivedMatchReport,
  ClubIdentity,
  FinishedMatchPayload,
  GameState,
  ManagerClubStint,
  ManagerJobOffer,
  Mentality,
  NationalTeamCallupMember,
  NationalTeamMatchRecord,
  NationalTeamState,
  Player,
  Position,
  Team
} from '../types/game';
import { clamp, P, R } from '../utils/math';
import { BASE, FSD, LINE, POS, TN } from '../data/thaiFootballData';
import {
  assignTeamShirtNumbers,
  ensureClubIdentity,
  getDefaultCoachVis,
  getTeamClubIdentity,
  logFin,
  mkPlayer,
  mkTeam,
  pushFeed,
  xi
} from './playerCore';
import { getTeamSeasonObjectiveInfo, mkMarket, rate, setBoardObjective, sortTable, syncAndEvaluateClubDemands } from './simulation';
import { pickUniqueSponsorBrandIds } from '../data/sponsorBrands';

export interface NationalOpponentTemplate {
  code: string;
  name: string;
  flag: string;
  kc: [string, string];
  baseOvr: number;
  tac: Mentality;
  form: string;
  region: 'asean' | 'asia';
  names: string[];
}

export const NATIONAL_OPPONENTS: NationalOpponentTemplate[] = [
  {
    code: 'VN',
    name: 'ทีมชาติเวียดนาม',
    flag: '🇻🇳',
    kc: ['#dc2626', '#facc15'],
    baseOvr: 70,
    tac: 'A',
    form: '4-2-3-1',
    region: 'asean',
    names: ['เหงียน กวาง ไฮ', 'เหงียน เทียน ลินห์', 'โด หุ่ง ดุง', 'เกว๊ หง็อก ไฮ', 'ดัง วัน ลัม', 'ฟาน วัน ดึ๊ก', 'บู่ย เตี๊ยน ดุง', 'โฮ เติ๊น ต่าย', 'เหงียน ฮหว่าง ดึ๊ก', 'หวู่ วัน แทง', 'เหงียน ฟิลิป']
  },
  {
    code: 'ID',
    name: 'ทีมชาติอินโดนีเซีย',
    flag: '🇮🇩',
    kc: ['#b91c1c', '#ffffff'],
    baseOvr: 71,
    tac: 'A',
    form: '3-4-3',
    region: 'asean',
    names: ['มาร์เซลิโน เฟอร์ดินาน', 'วิทาน สุไลมาน', 'ปราตามา อาร์ฮาน', 'อัสนาวี มังกูอาลัม', 'จอร์ดี้ อามัต', 'ริซกี้ ริดโฮ', 'มาร์เทน เพส', 'ทอม เฮย์', 'ราฟาเอล สตรูอิค', 'เจย์ อิดเซส', 'คัลวิน เวอร์ดองค์']
  },
  {
    code: 'MY',
    name: 'ทีมชาติมาเลเซีย',
    flag: '🇲🇾',
    kc: ['#facc15', '#111827'],
    baseOvr: 67,
    tac: 'B',
    form: '4-3-3',
    region: 'asean',
    names: ['อารีฟ ไอมาน', 'ไฟซาล ฮาลิม', 'ซาฟาวี ราซิด', 'คอร์บิน-ออง', 'ดิออน คูลส์', 'ซียาห์มี ซาฟารี', 'อะฮ์มัด ซีฮาน', 'แมทธิว เดวีส์', 'แบรนแดน กัน', 'โรเมล โมราเลส', 'เปาโล โชซูเอ']
  },
  {
    code: 'SG',
    name: 'ทีมชาติสิงคโปร์',
    flag: '🇸🇬',
    kc: ['#ef4444', '#ffffff'],
    baseOvr: 64,
    tac: 'D',
    form: '4-4-2',
    region: 'asean',
    names: ['อิคซาน ฟานดี้', 'อิรฟาน ฟานดี้', 'ฮาริส ฮารูน', 'ชะห์ ชะฮีราน', 'ฮัสซัน ซันนี', 'ซง อุย-ยอง', 'ชาวัล อานัวร์', 'นาซรุล นาซารี', 'ริวอาน สจ๊วร์ต', 'ฟาริส รามลี', 'เกล็นน์ กเวห์']
  },
  {
    code: 'PH',
    name: 'ทีมชาติฟิลิปปินส์',
    flag: '🇵🇭',
    kc: ['#1d4ed8', '#ffffff'],
    baseOvr: 65,
    tac: 'B',
    form: '4-2-3-1',
    region: 'asean',
    names: ['นีล เอเธอริดจ์', 'เควิน อิงเกรโซ', 'ซานโดร เรเยส', 'สเตฟาน ชร็อค', 'แพทริก ไรเชลท์', 'เบิร์น เกลย์น', 'จาร์วีย์ เกย์โอโซ', 'ดีแลน เดอ มุยเตอร์', 'เคมพ์เตอร์', 'เควิน เมนโดซา', 'บียอร์น คริสเตนเซน']
  },
  {
    code: 'CN',
    name: 'ทีมชาติจีน',
    flag: '🇨🇳',
    kc: ['#dc2626', '#fde047'],
    baseOvr: 73,
    tac: 'D',
    form: '4-4-2',
    region: 'asia',
    names: ['อู๋ เหล่ย', 'จาง อวี้หนิง', 'เหว่ย ซื่อหาว', 'หวัง ช่างหยวน', 'จู เฉินเจี๋ย', 'เจี่ยง กวงไท่', 'เหยียน จวิ้นหลิง', 'หลิว หยาง', 'เซี่ย เผิงเฟย', 'หลี่ หยวนอี', 'หวัง ต้าเหล่ย']
  },
  {
    code: 'IQ',
    name: 'ทีมชาติอิรัก',
    flag: '🇮🇶',
    kc: ['#15803d', '#ffffff'],
    baseOvr: 76,
    tac: 'B',
    form: '4-2-3-1',
    region: 'asia',
    names: ['อัยเมน ฮุสเซน', 'อาลี ยาซิม', 'โมฮานัด อาลี', 'ซีดาน อิกบาล', 'จาลาล ฮัสซัน', 'เรบิน ซูลากา', 'ฮุสเซน อาลี', 'อิบราฮิม บาเยช', 'อาเมียร์ อัล-อัมมารี', 'เมอร์คาส ดอสกี้', 'ยูสเซฟ อามีน']
  },
  {
    code: 'SA',
    name: 'ทีมชาติซาอุดีอาระเบีย',
    flag: '🇸🇦',
    kc: ['#166534', '#ffffff'],
    baseOvr: 79,
    tac: 'A',
    form: '4-3-3',
    region: 'asia',
    names: ['ซาเลม อัล-ดอว์ซารี', 'ฟิราส อัล-บูไรคาน', 'โมฮาเหม็ด คันโน', 'ซาอุด อับดุลฮามิด', 'อาลี อัล-บูไลฮี', 'ฮัสซัน ตัมบัคตี', 'โมฮัมเหม็ด อัล-โอวาอิส', 'นัสเซอร์ อัล-ดอว์ซารี', 'อับดุลลาห์ อัล-ไคบารี', 'ซาเลห์ อัล-เชห์รี', 'ยาซเซอร์ อัล-ชาห์รานี']
  },
  {
    code: 'AU',
    name: 'ทีมชาติออสเตรเลีย',
    flag: '🇦🇺',
    kc: ['#f59e0b', '#14532d'],
    baseOvr: 80,
    tac: 'B',
    form: '4-2-3-1',
    region: 'asia',
    names: ['แมทธิว ไรอัน', 'แฮร์รี ซุตตาร์', 'แจ็คสัน เออร์ไวน์', 'มาร์ติน บอยล์', 'เคร็ก กูดวิน', 'คีอานู บัคคัส', 'คเมอร์ ดุก', 'อาซิซ เบฮิช', 'จอร์แดน บอส', 'ไรลีย์ แม็คกรี', 'เนสโตรี อิรันคุนดา']
  },
  {
    code: 'KR',
    name: 'ทีมชาติเกาหลีใต้',
    flag: '🇰🇷',
    kc: ['#e11d48', '#1e293b'],
    baseOvr: 83,
    tac: 'X',
    form: '4-2-3-1',
    region: 'asia',
    names: ['ซน ฮึง-มิน', 'อี คัง-อิน', 'คิม มิน-แจ', 'ฮวาง ฮี-ชาน', 'โจ ฮยอน-อู', 'ฮวาง อิน-บอม', 'อี แจ-ซอง', 'คิม จิน-ซู', 'ซอล ยอง-อู', 'โช กยู-ซอง', 'แบ จุน-โฮ']
  },
  {
    code: 'JP',
    name: 'ทีมชาติญี่ปุ่น',
    flag: '🇯🇵',
    kc: ['#1d4ed8', '#ffffff'],
    baseOvr: 85,
    tac: 'X',
    form: '4-2-3-1',
    region: 'asia',
    names: ['ทาเคฟุสะ คุโบะ', 'คาโอรุ มิโตมะ', 'วาตารุ เอ็นโดะ', 'ทาคุมิ มินามิโนะ', 'ทาเคฮิโระ โทมิยาสุ', 'โค อิทาคุระ', 'ไซออน ซูซูกิ', 'ริตสึ โดอัน', 'อายาเสะ อุเอดะ', 'อาโอะ ทานากะ', 'จุนยะ อิโตะ']
  }
];

export const NT_CALLUP_QUOTA: Record<Position, number> = {
  GK: 3,
  DF: 8,
  MF: 7,
  FW: 5
};

export function getManagerRepRankLabel(rep: number): string {
  if (rep >= 180) return 'ตำนานลูกหนังไทย';
  if (rep >= 130) return 'ยอดกุนซือระดับทวีป';
  if (rep >= 95) return 'กุนซือระดับทีมชาติ';
  if (rep >= 75) return 'กุนซือฝีมือทอง';
  if (rep >= 55) return 'โค้ชมืออาชีพ';
  return 'กุนซือหน้าใหม่';
}

export function ensureManagerHistoryInitialized(s: GameState): ManagerClubStint[] {
  if (!Array.isArray(s.mgrHistory)) s.mgrHistory = [];
  if (!s.mgrCareerStats) {
    s.mgrCareerStats = { matches: 0, wins: 0, draws: 0, losses: 0 };
  }
  const meTeam = s.teams[s.me];
  if (meTeam && s.mgrHistory.length === 0) {
    s.mgrHistory.push({
      teamId: meTeam.id,
      teamName: s.club?.name || meTeam.name,
      tier: meTeam.tier,
      fromSeason: 1,
      toSeason: s.season ?? 1,
      matches: meTeam.p || 0,
      wins: meTeam.w || 0,
      draws: meTeam.d || 0,
      losses: meTeam.l || 0,
      trophies: (s.trophies || []).filter((t) => t.type !== 'nt').map((t) => `ซ.${t.season} ${t.title}`),
      endReason: 'active'
    });
  }
  return s.mgrHistory;
}

export function recordManagerClubMatchResult(s: GameState, myGoals: number, oppGoals: number) {
  if (s.mode !== 'm') return;
  const hist = ensureManagerHistoryInitialized(s);
  const stats = s.mgrCareerStats!;
  stats.matches += 1;
  if (myGoals > oppGoals) stats.wins += 1;
  else if (myGoals < oppGoals) stats.losses += 1;
  else stats.draws += 1;

  const active = hist.find((h) => h.endReason === 'active') || hist[hist.length - 1];
  if (active) {
    active.toSeason = s.season ?? active.toSeason;
    active.matches += 1;
    if (myGoals > oppGoals) active.wins += 1;
    else if (myGoals < oppGoals) active.losses += 1;
    else active.draws += 1;
  }
}

export function syncActiveStintTrophy(s: GameState, title: string) {
  if (s.mode !== 'm') return;
  const hist = ensureManagerHistoryInitialized(s);
  const active = hist.find((h) => h.endReason === 'active');
  if (active) {
    const tag = `ซ.${s.season} ${title}`;
    if (!active.trophies.includes(tag)) active.trophies.push(tag);
  }
}

export function estimateClubBudgetForTier(tier: number): number {
  if (tier >= 2) return R(1350, 2350);
  if (tier === 1) return R(580, 980);
  return R(240, 440);
}

export function generateManagerJobOffers(
  s: GameState,
  opts?: { mode?: 'sacked' | 'season_end' | 'market' }
): ManagerJobOffer[] {
  const mode = opts?.mode || (s.sack === 1 ? 'sacked' : 'market');
  const meTeam = s.teams[s.me];
  const curTier = meTeam?.tier ?? 0;
  const rep = s.mgrRep ?? 50;

  const domesticTeams = s.teams.filter((t) => t.tier < 3 && t.id !== s.me);
  const tableByTier = new Map<number, Team[]>();
  [0, 1, 2].forEach((tier) => {
    tableByTier.set(tier, sortTable(s.teams.filter((t) => t.tier === tier)));
  });

  const makeOffer = (
    tm: Team,
    reason: ManagerJobOffer['reason'],
    minRep: number,
    note: string
  ): ManagerJobOffer => {
    const obj = getTeamSeasonObjectiveInfo(tm, s);
    return {
      id: `job-${s.season}-${tm.id}-${reason}`,
      teamId: tm.id,
      teamName: tm.name,
      tier: tm.tier,
      reason,
      targetRank: obj.targetRank,
      budgetK: estimateClubBudgetForTier(tm.tier),
      minRep,
      note
    };
  };

  if (mode === 'sacked') {
    const picks: ManagerJobOffer[] = [];
    const seen = new Set<number>();
    const addPick = (tm: Team | undefined, note: string) => {
      if (!tm || seen.has(tm.id)) return;
      seen.add(tm.id);
      picks.push(makeOffer(tm, 'rescue', 0, note));
    };

    // 1. Club from a lower tier (or provincial) eager to rebuild
    const lowerPool = domesticTeams
      .filter((t) => t.tier <= Math.max(0, curTier - 1))
      .sort(() => Math.random() - 0.5);
    if (lowerPool[0]) addPick(lowerPool[0], 'สโมสรระดับล่างต้องการโค้ชมีประสบการณ์มาช่วยยกระดับทีม');

    // 2. Struggling club in same tier looking for emergency rescue
    const sameTierList = (tableByTier.get(curTier) || []).filter((t) => t.id !== s.me);
    const strugglingSame = sameTierList.slice(-6).sort(() => Math.random() - 0.5);
    if (strugglingSame[0]) addPick(strugglingSame[0], 'ทีมกำลังหนีโซนอันตราย ยื่นสัญญากอบกู้สถานการณ์ทันที');

    // 3. Another club from provincial/tier 1 (guaranteed option)
    const fallbackPool = domesticTeams
      .filter((t) => t.tier <= Math.max(1, curTier))
      .sort((a, b) => a.tier - b.tier || Math.random() - 0.5);
    for (const cand of fallbackPool) {
      if (picks.length >= 3) break;
      addPick(cand, 'เปิดรับตำแหน่งหัวหน้าผู้ฝึกสอนพร้อมงบทำทีมตั้งต้นใหม่');
    }
    return picks;
  }

  if (mode === 'season_end') {
    const curRank = (tableByTier.get(curTier) || []).findIndex((t) => t.id === s.me) + 1;
    const upperTier = Math.min(2, curTier + 1);
    const offers: ManagerJobOffer[] = [];
    const seen = new Set<number>();

    const upperPool = domesticTeams
      .filter((t) => t.tier === upperTier)
      .sort(() => Math.random() - 0.5);
    const samePool = domesticTeams
      .filter((t) => t.tier === curTier)
      .sort((a, b) => {
        const ra = rate(a, s);
        const rb = rate(b, s);
        return rb.at + rb.df - (ra.at + ra.df);
      });

    const strongPerf = curRank <= 4 || rep >= 75;
    if (upperTier > curTier && strongPerf && upperPool.length > 0) {
      const c = upperPool[0];
      seen.add(c.id);
      offers.push(makeOffer(c, 'poach', 0, `ดึงตัวข้ามลีกสู่ ${TN[c.tier]} หลังสร้างผลงานเข้าตา`));
    }
    if (rep >= 90) {
      const t1Top = domesticTeams.filter((t) => t.tier === 2 && !seen.has(t.id)).sort(() => Math.random() - 0.5)[0];
      if (t1Top) {
        seen.add(t1Top.id);
        offers.push(makeOffer(t1Top, 'poach', 0, 'ทีมใหญ่ไทยลีก 1 ยื่นข้อเสนอคุมทีมลุ้นแชมป์ฤดูกาลหน้า'));
      }
    }
    for (const c of samePool) {
      if (offers.length >= 3) break;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      offers.push(makeOffer(c, 'open', 0, `ชวนย้ายคุมทัพลุย ${TN[c.tier]} พร้อมเป้าหมายติดอันดับต้นๆ`));
    }
    if (offers.length < 3) {
      const rest = domesticTeams.filter((t) => !seen.has(t.id)).sort(() => Math.random() - 0.5);
      for (const c of rest) {
        if (offers.length >= 3) break;
        seen.add(c.id);
        offers.push(makeOffer(c, 'open', 0, `ข้อเสนอคุมทีม ${TN[c.tier]} ฤดูกาลใหม่`));
      }
    }
    return offers;
  }

  // 'market' mode: show 4 open opportunities across tiers with realistic reputation gates
  const result: ManagerJobOffer[] = [];
  const picked = new Set<number>();

  const pickByTier = (tier: number, minRep: number, reason: ManagerJobOffer['reason'], note: string) => {
    const candidates = domesticTeams.filter((t) => t.tier === tier && !picked.has(t.id));
    if (!candidates.length) return;
    // Deterministic-friendly variety per season/md
    const idx = Math.abs((s.season * 17 + s.md * 7 + tier * 13) % candidates.length);
    const tm = candidates[idx];
    picked.add(tm.id);
    result.push(makeOffer(tm, reason, minRep, note));
  };

  pickByTier(2, 95, 'poach', 'ต้องการกุนซือระดับสูง (เครดิต 95+) ลุยศึกดิวิชั่น 1');
  pickByTier(2, 75, 'open', 'สโมสรดิวิชั่น 1 กำลังมองหาเฮดโค้ชคนใหม่ (เครดิต 75+)');
  pickByTier(1, 55, 'open', 'ทีมระดับดิวิชั่น 2 เปิดรับผู้จัดการทีมร่วมสร้างโปรเจกต์ (เครดิต 55+)');
  pickByTier(0, 20, 'open', 'สโมสรระดับจังหวัดเปิดประตูต้อนรับกุนซือไฟแรง');

  return result;
}

export function switchManagerClub(
  s: GameState,
  newTeamId: number,
  opts: { reason: 'sacked' | 'transfer' | 'resigned'; timing: 'midseason' | 'offseason' }
): string {
  const oldTeamId = s.me;
  const oldTeam = s.teams[oldTeamId];
  const newTeam = s.teams[newTeamId];
  if (!newTeam || newTeamId === oldTeamId) return '';

  const hist = ensureManagerHistoryInitialized(s);
  const activeStint = hist.find((h) => h.endReason === 'active');
  if (activeStint) {
    activeStint.toSeason = s.season ?? activeStint.toSeason;
    activeStint.endReason = opts.reason;
  }

  // Preserve manager identity & career metrics
  const prevClub = ensureClubIdentity(s);
  const preservedMgr = {
    managerName: prevClub.managerName || 'หัวหน้าผู้ฝึกสอน',
    managerVis: prevClub.managerVis ? [...prevClub.managerVis] : getDefaultCoachVis(prevClub.managerName || 'coach'),
    managerStyle: prevClub.managerStyle || 'balanced',
    managerOutfit: prevClub.managerOutfit || 'suit_navy',
    managerRandomOutfitPerMatch: Boolean(prevClub.managerRandomOutfitPerMatch)
  };

  // Archive per-club records safely
  s.clubRecordsByTeam = s.clubRecordsByTeam || {};
  if (s.records && oldTeam) {
    s.clubRecordsByTeam[oldTeam.id] = s.records;
  }
  s.records = s.clubRecordsByTeam[newTeam.id] ? { ...s.clubRecordsByTeam[newTeam.id] } : {};

  const oldTier = oldTeam?.tier ?? 0;
  s.me = newTeamId;
  s.lg = newTeam.tier;

  // Rebuild club visual & stadium identity to match newTeam cleanly while keeping manager persona
  const aiIdentity = getTeamClubIdentity(newTeam, null);
  const nextClub: ClubIdentity = {
    ...aiIdentity,
    name: newTeam.name,
    nick: '',
    std: `สนาม${newTeam.name}`,
    builtStadiumStyles: [aiIdentity.stadiumStyle || 'open_track'],
    ...preservedMgr
  };
  s.club = nextClub;
  newTeam.kc = [nextClub.c1, nextClub.c2];

  // Re-calibrate club economy & facilities for the new club tier
  const ntTier = newTeam.tier;
  s.money = estimateClubBudgetForTier(ntTier);
  s.st = ntTier >= 2 ? R(5, 7) : ntTier === 1 ? R(3, 5) : R(1, 2);
  s.tr = ntTier >= 2 ? R(5, 7) : ntTier === 1 ? R(3, 5) : R(1, 2);
  s.ya = ntTier >= 2 ? R(4, 6) : ntTier === 1 ? R(2, 4) : 1;
  s.med = ntTier >= 2 ? R(4, 6) : ntTier === 1 ? R(2, 4) : 1;
  s.merchLv = ntTier >= 2 ? R(4, 6) : ntTier === 1 ? R(2, 4) : 1;
  s.turfLv = ntTier >= 2 ? R(5, 7) : ntTier === 1 ? R(3, 5) : R(1, 2);
  s.analyticsLv = ntTier >= 2 ? R(4, 6) : ntTier === 1 ? R(2, 4) : 1;
  s.travelLv = ntTier >= 2 ? R(4, 6) : ntTier === 1 ? R(2, 4) : 1;
  s.facCond = { st: 100, tr: 100, ya: 100, med: 100, merchLv: 100, turfLv: 100, analyticsLv: 100, travelLv: 100 };
  const baseStaff = ntTier >= 2 ? 2 : ntTier === 1 ? 1 : 0;
  s.staff = {
    asst: baseStaff,
    fit: baseStaff,
    scout: baseStaff,
    physio: baseStaff,
    gkCoach: Math.max(0, baseStaff - 1),
    setPieceCoach: Math.max(0, baseStaff - 1)
  };

  s.bankLoan = null;
  s.payDue = 0;
  s.sponsorDeal = null;
  s.sponsorDeals = [];
  const nextSpSeed = R(1, 999999);
  s.sponsorSeed = nextSpSeed;
  s.sponsorBrands = pickUniqueSponsorBrandIds(nextSpSeed, 8);
  s.clubDemands = [];
  syncAndEvaluateClubDemands(s, { initial: true });
  s.megastore = undefined;
  s.scout = null;
  s.off = null;
  s.offers = [];
  s.dilemma = null;
  s.boardDirective = null;
  s.boardEffects = [];
  s.boardFeedbackLog = [];
  s.promo = 0;
  s.winBonus = 0;
  s.derby = 0;
  s.fan = ntTier >= 2 ? R(62, 78) : ntTier === 1 ? R(50, 66) : R(44, 58);
  s.mor = 65;
  s.bd = opts.reason === 'sacked' ? 62 : 72;
  s.sack = 0;
  s.sackReason = undefined;
  if (opts.reason === 'sacked') {
    s.mgrRep = clamp((s.mgrRep ?? 50) - 8, 10, 999);
  }

  // Open new club stint
  const startSeasonNum = opts.timing === 'offseason' ? (s.season ?? 1) + 1 : (s.season ?? 1);
  hist.push({
    teamId: newTeam.id,
    teamName: newTeam.name,
    tier: newTeam.tier,
    fromSeason: startSeasonNum,
    toSeason: startSeasonNum,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    trophies: [],
    endReason: 'active'
  });

  if (opts.timing === 'midseason') {
    if (ntTier !== oldTier) {
      s.fxo = s.fxo || {};
      s.fxo[oldTier] = s.fx;
      if (s.fxo[ntTier]) {
        s.fx = s.fxo[ntTier];
        delete s.fxo[ntTier];
      }
    }
    // Reconcile cup participation flags with the new club's survival status
    if (s.cup && (!s.cup.alive || !s.cup.ids.includes(newTeamId))) s.pc = false;
    if (s.lc && (!s.lc.alive || !s.lc.ids.includes(newTeamId))) s.plc = false;
    if (s.dc && (!s.dc.alive || !s.dc.ids.includes(newTeamId))) s.pdc = false;
    if (s.sc && (!s.sc.alive || !s.sc.ids.includes(newTeamId))) s.psc = false;
    if (s.ac && (!s.ac.alive || !s.ac.ids.includes(newTeamId))) s.pa = false;

    s.yth = Array.from({ length: 4 }, () =>
      mkPlayer(P(POS), BASE[ntTier] - 2 + Math.round((s.ya ?? 1) * 1.2), true)
    );
    s.schedRes = {};
    s.schedRoundRes = {};
    setBoardObjective(s);
    mkMarket(s);
  }

  logFin(s, `เข้ารับตำแหน่งผู้จัดการทีม ${newTeam.name} (งบตั้งต้นสโมสร)`, 0);
  const actionVerb = opts.reason === 'sacked' ? 'รับงานกอบกู้ทีม' : 'ย้ายไปคุมทัพ';
  const msg = `✍️ ${actionVerb} ${newTeam.name} (${TN[newTeam.tier]})`;
  s.hist.push(`ซ.${startSeasonNum}: ${msg}`);
  pushFeed(s, 'เส้นทางโค้ช', msg, 'ok');
  return msg;
}

// ============================================================
// THAILAND NATIONAL TEAM MANAGEMENT (ช้างศึกทีมชาติไทย)
// ============================================================

export function getNationalTeamEligibility(s: GameState): {
  eligible: boolean;
  reasonText: string;
  progressText: string;
} {
  const rep = s.mgrRep ?? 50;
  const meTier = s.teams[s.me]?.tier ?? 0;
  const hasMajorTrophy = (s.trophies || []).some(
    (t) =>
      t.type === 'cup' ||
      t.type === 'asia' ||
      t.type === 'league_cup' ||
      (t.type === 'league' && (t.tier ?? 0) >= 2)
  );
  const eligible = rep >= 95 || hasMajorTrophy || (meTier >= 2 && rep >= 80);
  if (eligible) {
    return {
      eligible: true,
      reasonText: 'คุณมีคุณสมบัติครบถ้วน พร้อมรับตำแหน่งหัวหน้าผู้ฝึกสอนทีมชาติไทยชุดใหญ่',
      progressText: 'ปลดล็อกแล้ว!'
    };
  }
  return {
    eligible: false,
    reasonText: 'ต้องมีเครดิตโค้ช 95+ หรือคว้าแชมป์ระดับประเทศ/T1 (หรือคุมทีม T1 ด้วยเครดิต 80+)',
    progressText: `เครดิตปัจจุบัน ${rep}/95${meTier >= 2 ? ' (คุม T1 ต้องการ 80+)' : ''}`
  };
}

export interface NationalCandidateRow {
  teamId: number;
  teamName: string;
  tier: number;
  player: Player;
  score: number;
}

export function getNationalPlayerPool(s: GameState): NationalCandidateRow[] {
  const rows: NationalCandidateRow[] = [];
  s.teams
    .filter((t) => t.tier < 3)
    .forEach((t) => {
      t.sq.forEach((q) => {
        if (q.retired) return;
        const tierScore = t.tier === 2 ? 5 : t.tier === 1 ? 1.5 : -4;
        const formScore = (q.sg || 0) * 0.45 + (q.sa || 0) * 0.35 + (q.cs || 0) * 0.4;
        const score = +(q.ov + tierScore + formScore).toFixed(2);
        rows.push({ teamId: t.id, teamName: t.name, tier: t.tier, player: q, score });
      });
    });
  rows.sort((a, b) => b.score - a.score || b.player.ov - a.player.ov);
  return rows;
}

export function autoPickThailandSquad(s: GameState): NationalTeamCallupMember[] {
  const pool = getNationalPlayerPool(s);
  const picked: NationalTeamCallupMember[] = [];
  const usedKeys = new Set<string>();

  const pickForPos = (pos: Position, count: number) => {
    const candidates = pool.filter((r) => r.player.pos === pos && r.player.inj === 0);
    for (const row of candidates) {
      if (picked.filter((m) => {
        const p = s.teams[m.teamId]?.sq.find((q) => q.n === m.playerName);
        return p?.pos === pos;
      }).length >= count) break;
      const key = `${row.teamId}:${row.player.n}`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      picked.push({ teamId: row.teamId, playerName: row.player.n });
    }
  };

  pickForPos('GK', NT_CALLUP_QUOTA.GK);
  pickForPos('DF', NT_CALLUP_QUOTA.DF);
  pickForPos('MF', NT_CALLUP_QUOTA.MF);
  pickForPos('FW', NT_CALLUP_QUOTA.FW);

  // Fill up to 23 if any position ran short
  for (const row of pool) {
    if (picked.length >= 23) break;
    const key = `${row.teamId}:${row.player.n}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    picked.push({ teamId: row.teamId, playerName: row.player.n });
  }
  return picked;
}

export function hydrateThailandTeam(s: GameState, nt: NationalTeamState): Team {
  const validMembers: NationalTeamCallupMember[] = [];
  const squadPlayers: Player[] = [];
  const seenNames = new Set<string>();

  nt.squad.forEach((m) => {
    const srcTeam = s.teams[m.teamId];
    const orig = srcTeam?.sq.find((q) => q.n === m.playerName);
    if (!orig || seenNames.has(orig.n)) return;
    seenNames.add(orig.n);
    validMembers.push(m);
    squadPlayers.push({
      ...orig,
      fit: Math.max(82, orig.fit ?? 100),
      inj: 0,
      sus: 0
    });
  });

  if (squadPlayers.length < 18) {
    const fallback = autoPickThailandSquad(s);
    fallback.forEach((m) => {
      if (squadPlayers.length >= 23) return;
      const orig = s.teams[m.teamId]?.sq.find((q) => q.n === m.playerName);
      if (!orig || seenNames.has(orig.n)) return;
      seenNames.add(orig.n);
      validMembers.push(m);
      squadPlayers.push({ ...orig, fit: 95, inj: 0, sus: 0 });
    });
    nt.squad = validMembers;
  }

  const thTeam: Team = {
    id: s.teams.length,
    name: 'ทีมชาติไทย',
    tier: 2,
    kc: ['#1d3b8b', '#dc2626'],
    sq: squadPlayers,
    form: nt.formCode || '4-2-3-1',
    ...(nt.cf ? { cf: nt.cf } : {}),
    lu: nt.lu && nt.lu.length === 11 ? nt.lu.filter((n) => seenNames.has(n)) : null,
    cap: nt.cap && seenNames.has(nt.cap) ? nt.cap : undefined,
    tac: nt.tac || 'B',
    press: nt.press ?? 1,
    tempo: nt.tempo ?? 1,
    wid: nt.wid ?? 1,
    line: nt.line ?? 1,
    pass: nt.pass ?? 1,
    pts: 0,
    gf: nt.gf,
    ga: nt.ga,
    w: nt.wins,
    d: nt.draws,
    l: nt.losses,
    p: nt.matches,
    fm: nt.form,
    tacFam: 86,
    fans: 185000
  };
  if (thTeam.lu && thTeam.lu.length !== 11) {
    thTeam.lu = null;
  }
  assignTeamShirtNumbers(thTeam);
  return thTeam;
}

export function generateNationalFixturesForSeason(season: number): NationalTeamMatchRecord[] {
  const isAsiaYear = season % 2 === 0;
  const pickByCode = (code: string) =>
    NATIONAL_OPPONENTS.find((o) => o.code === code) || NATIONAL_OPPONENTS[0];

  if (!isAsiaYear) {
    const g1 = pickByCode('SG');
    const g2 = pickByCode('MY');
    const g3 = pickByCode('VN');
    const sf = pickByCode('ID');
    const fn = pickByCode('VN');
    return [
      {
        id: `nt-${season}-1`,
        season,
        md: 6,
        compName: 'ชิงแชมป์อาเซียน (AFF)',
        roundLabel: 'รอบแบ่งกลุ่ม นัด 1',
        isKnockout: false,
        opponentName: g1.name,
        opponentFlag: g1.flag,
        opponentTier: 1,
        opponentKc: g1.kc,
        opponentOvr: g1.baseOvr,
        home: true,
        played: false
      },
      {
        id: `nt-${season}-2`,
        season,
        md: 11,
        compName: 'ชิงแชมป์อาเซียน (AFF)',
        roundLabel: 'รอบแบ่งกลุ่ม นัด 2',
        isKnockout: false,
        opponentName: g2.name,
        opponentFlag: g2.flag,
        opponentTier: 1,
        opponentKc: g2.kc,
        opponentOvr: g2.baseOvr,
        home: false,
        played: false
      },
      {
        id: `nt-${season}-3`,
        season,
        md: 16,
        compName: 'ชิงแชมป์อาเซียน (AFF)',
        roundLabel: 'รอบแบ่งกลุ่ม นัด 3',
        isKnockout: false,
        opponentName: g3.name,
        opponentFlag: g3.flag,
        opponentTier: 2,
        opponentKc: g3.kc,
        opponentOvr: g3.baseOvr,
        home: true,
        played: false
      },
      {
        id: `nt-${season}-4`,
        season,
        md: 22,
        compName: 'ชิงแชมป์อาเซียน (AFF)',
        roundLabel: 'รอบรองชนะเลิศ',
        isKnockout: true,
        opponentName: sf.name,
        opponentFlag: sf.flag,
        opponentTier: 2,
        opponentKc: sf.kc,
        opponentOvr: sf.baseOvr + 1,
        home: false,
        played: false
      },
      {
        id: `nt-${season}-5`,
        season,
        md: 28,
        compName: 'ชิงแชมป์อาเซียน (AFF)',
        roundLabel: 'รอบชิงชนะเลิศ',
        isKnockout: true,
        opponentName: fn.name,
        opponentFlag: fn.flag,
        opponentTier: 2,
        opponentKc: fn.kc,
        opponentOvr: fn.baseOvr + 2,
        home: true,
        played: false
      }
    ];
  }

  const f1 = pickByCode('CN');
  const f2 = pickByCode('IQ');
  const f3 = pickByCode('SA');
  const sf = pickByCode('KR');
  const fn = pickByCode('JP');
  return [
    {
      id: `nt-${season}-1`,
      season,
      md: 6,
      compName: 'ศึกคัดเลือกเอเชีย',
      roundLabel: 'รอบแบ่งกลุ่ม นัด 1',
      isKnockout: false,
      opponentName: f1.name,
      opponentFlag: f1.flag,
      opponentTier: 2,
      opponentKc: f1.kc,
      opponentOvr: f1.baseOvr,
      home: true,
      played: false
    },
    {
      id: `nt-${season}-2`,
      season,
      md: 11,
      compName: 'ศึกคัดเลือกเอเชีย',
      roundLabel: 'รอบแบ่งกลุ่ม นัด 2',
      isKnockout: false,
      opponentName: f2.name,
      opponentFlag: f2.flag,
      opponentTier: 2,
      opponentKc: f2.kc,
      opponentOvr: f2.baseOvr,
      home: false,
      played: false
    },
    {
      id: `nt-${season}-3`,
      season,
      md: 16,
      compName: 'ศึกคัดเลือกเอเชีย',
      roundLabel: 'รอบแบ่งกลุ่ม นัด 3',
      isKnockout: false,
      opponentName: f3.name,
      opponentFlag: f3.flag,
      opponentTier: 2,
      opponentKc: f3.kc,
      opponentOvr: f3.baseOvr,
      home: true,
      played: false
    },
    {
      id: `nt-${season}-4`,
      season,
      md: 22,
      compName: 'เอเชียน คัพ',
      roundLabel: 'รอบรองชนะเลิศเอเชีย',
      isKnockout: true,
      opponentName: sf.name,
      opponentFlag: sf.flag,
      opponentTier: 3,
      opponentKc: sf.kc,
      opponentOvr: sf.baseOvr,
      home: false,
      played: false
    },
    {
      id: `nt-${season}-5`,
      season,
      md: 28,
      compName: 'เอเชียน คัพ',
      roundLabel: 'รอบชิงชนะเลิศเอเชีย',
      isKnockout: true,
      opponentName: fn.name,
      opponentFlag: fn.flag,
      opponentTier: 3,
      opponentKc: fn.kc,
      opponentOvr: fn.baseOvr,
      home: true,
      played: false
    }
  ];
}

export function appointThailandManager(s: GameState): NationalTeamState {
  const squad = autoPickThailandSquad(s);
  const existing = s.natTeam;
  const nt: NationalTeamState = {
    active: true,
    invitedSeason: s.season,
    appointedSeason: existing?.appointedSeason ?? s.season,
    matches: existing?.matches ?? 0,
    wins: existing?.wins ?? 0,
    draws: existing?.draws ?? 0,
    losses: existing?.losses ?? 0,
    gf: existing?.gf ?? 0,
    ga: existing?.ga ?? 0,
    form: existing?.form ?? '',
    formCode: existing?.formCode || '4-2-3-1',
    cf: existing?.cf,
    lu: existing?.lu ?? null,
    cap: existing?.cap,
    tac: existing?.tac || 'B',
    press: existing?.press ?? 1,
    tempo: existing?.tempo ?? 1,
    wid: existing?.wid ?? 1,
    line: existing?.line ?? 1,
    pass: existing?.pass ?? 1,
    squad,
    fixtures:
      existing?.fixtures?.length && existing.fixtures[0]?.season === s.season
        ? existing.fixtures
        : generateNationalFixturesForSeason(s.season),
    trophies: existing?.trophies || []
  };
  s.natTeam = nt;
  pushFeed(s, 'ทีมชาติไทย', '🇹🇭 สมาคมฟุตบอลแต่งตั้งคุณเป็นหัวหน้าผู้ฝึกสอนทีมชาติไทย (ช้างศึก)!', 'ok');
  return nt;
}

export function refreshNationalCampaignOnNewSeason(s: GameState) {
  if (!s.natTeam?.active) return;
  s.natTeam.fixtures = generateNationalFixturesForSeason(s.season);
  // Keep user's squad valid & top up any retired/missing players
  const hydrated = hydrateThailandTeam(s, s.natTeam);
  if (!s.natTeam.cap || !hydrated.sq.some((q) => q.n === s.natTeam?.cap)) {
    s.natTeam.cap = hydrated.cap;
  }
  pushFeed(
    s,
    'ทีมชาติไทย',
    `🇹🇭 โปรแกรมทีมชาติไทย ซีซั่น ${s.season}: ${s.natTeam.fixtures[0]?.compName || 'แมตช์นานาชาติ'} พร้อมแล้ว`,
    'ok'
  );
}

export function buildThailandMatchOpponentTeam(fixture: NationalTeamMatchRecord, teamId: number): Team {
  const tpl =
    NATIONAL_OPPONENTS.find((o) => o.name === fixture.opponentName) ||
    NATIONAL_OPPONENTS[0];
  const baseTeam = mkTeam(`${tpl.flag} ${tpl.name}`, Math.min(2, fixture.opponentTier), teamId, 0);
  baseTeam.tier = 3;
  baseTeam.foreign = 1;
  baseTeam.kc = [...fixture.opponentKc];
  baseTeam.form = tpl.form;
  baseTeam.tac = tpl.tac;
  baseTeam.tacFam = 85;
  baseTeam.fans = 160000;

  // Calibrate opponent squad OVR & inject iconic national names
  const targetOvr = fixture.opponentOvr;
  const rolesOrder: Position[] = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
  const customNames = tpl.names.slice();
  baseTeam.sq.forEach((q, idx) => {
    const jitter = idx < 11 ? R(-2, 4) : R(-6, 1);
    q.ov = clamp(targetOvr + jitter, 52, 92);
    q.pot = Math.max(q.ov + 2, q.pot || q.ov + 2);
    if (idx < customNames.length && customNames[idx]) {
      q.n = customNames[idx];
      if (idx === 0 && rolesOrder[idx]) {
        // leave position untouched unless close
      }
    }
  });
  assignTeamShirtNumbers(baseTeam);
  return baseTeam;
}

export function buildNationalVirtualMatchState(
  s: GameState,
  fixture: NationalTeamMatchRecord
): {
  matchState: GameState;
  homeId: number;
  awayId: number;
  thailandId: number;
  opponentId: number;
  thailandClubIdentity: ClubIdentity;
} {
  const nt = s.natTeam!;
  const thailandId = s.teams.length;
  const opponentId = s.teams.length + 1;
  const thTeam = hydrateThailandTeam(s, nt);
  thTeam.id = thailandId;
  const oppTeam = buildThailandMatchOpponentTeam(fixture, opponentId);

  const mgrClub = ensureClubIdentity(s);
  const thailandClubIdentity: ClubIdentity = {
    name: 'ทีมชาติไทย (ช้างศึก)',
    nick: 'ช้างศึก',
    std: 'ราชมังคลากีฬาสถาน',
    stadiumStyle: 'modern_bowl',
    builtStadiumStyles: ['modern_bowl'],
    c1: '#1d3b8b',
    c2: '#dc2626',
    c3: '#ffffff',
    shape: 0,
    pat: 2,
    icon: '🐘',
    iconColor: '#facc15',
    kit: 0,
    awayKit: 1,
    collar: 1,
    crestBorder: 1,
    stars: nt.trophies.length,
    cuffTrim: true,
    managerName: mgrClub.managerName || 'หัวหน้าผู้ฝึกสอน',
    managerVis: mgrClub.managerVis ? [...mgrClub.managerVis] : undefined,
    managerStyle: mgrClub.managerStyle || 'balanced',
    managerOutfit: mgrClub.managerOutfit || 'suit_navy',
    managerRandomOutfitPerMatch: mgrClub.managerRandomOutfitPerMatch
  };

  const matchState: GameState = {
    ...s,
    me: thailandId,
    teams: [...s.teams, thTeam, oppTeam],
    club: thailandClubIdentity,
    derby: fixture.opponentName.includes('เวียดนาม') ? 1 : 0,
    mor: 78,
    fan: 88,
    turfLv: 9,
    st: 10
  };

  return {
    matchState,
    homeId: fixture.home ? thailandId : opponentId,
    awayId: fixture.home ? opponentId : thailandId,
    thailandId,
    opponentId,
    thailandClubIdentity
  };
}

export function applyNationalMatchOutcomeToDraft(
  d: GameState,
  fixtureId: string,
  payload: FinishedMatchPayload,
  thailandHome: boolean
): { trophyWon?: string; wonMatch: boolean } {
  const nt = d.natTeam;
  if (!nt) return { wonMatch: false };
  const fx = nt.fixtures.find((f) => f.id === fixtureId);
  if (!fx || fx.played) return { wonMatch: false };

  const gf = thailandHome ? payload.gh : payload.ga;
  const ga = thailandHome ? payload.ga : payload.gh;
  const penWin =
    gf === ga && payload.pen !== undefined
      ? thailandHome
        ? Boolean(payload.pen)
        : !Boolean(payload.pen)
      : false;
  const wonMatch = gf > ga || penWin;
  const lostMatch = gf < ga || (gf === ga && payload.pen !== undefined && !penWin);

  fx.played = true;
  fx.gf = gf;
  fx.ga = ga;
  if (payload.penText) fx.penText = payload.penText;
  fx.report = {
    kind: 'nt',
    roundLabel: `${fx.compName} · ${fx.roundLabel}`,
    h: thailandHome ? 0 : 1,
    a: thailandHome ? 1 : 0,
    gh: payload.gh,
    ga: payload.ga,
    ...(payload.pen !== undefined ? { pen: payload.pen } : {}),
    ...(payload.penText ? { penText: payload.penText } : {}),
    xgH: payload.xgH,
    xgA: payload.xgA,
    possH: payload.possH,
    motm: payload.motm,
    evs: payload.evs,
    cards: payload.cards,
    subs: payload.subs
  };

  nt.matches += 1;
  nt.gf += gf;
  nt.ga += ga;
  const ch = wonMatch ? 'W' : lostMatch ? 'L' : 'D';
  if (wonMatch) nt.wins += 1;
  else if (lostMatch) nt.losses += 1;
  else nt.draws += 1;
  nt.form = (nt.form + ch).slice(-8);

  // Reputation & morale effects
  const repGain = wonMatch ? (fx.isKnockout ? 10 : 5) : lostMatch ? -2 : 2;
  d.mgrRep = clamp((d.mgrRep ?? 50) + repGain, 10, 999);
  if (wonMatch) {
    d.mor = clamp((d.mor ?? 55) + 3, 0, 100);
  }

  let trophyWon: string | undefined;
  const isFinal = fx.roundLabel.includes('ชิงชนะเลิศ');
  if (isFinal && wonMatch) {
    const title = fx.compName.includes('อาเซียน') ? 'แชมป์อาเซียน (ทีมชาติไทย)' : 'แชมป์เอเชียน คัพ (ทีมชาติไทย)';
    nt.trophies = nt.trophies || [];
    nt.trophies.push({ season: d.season, title });
    d.trophies = d.trophies || [];
    if (!d.trophies.some((t) => t.season === d.season && t.type === 'nt' && t.title === title)) {
      d.trophies.push({ season: d.season, title, type: 'nt' });
    }
    const bonusRep = fx.compName.includes('อาเซียน') ? 40 : 75;
    d.mgrRep = (d.mgrRep ?? 50) + bonusRep;
    trophyWon = title;
    pushFeed(d, 'ทีมชาติไทย', `🏆🇹🇭 ช้างศึกผงาดคว้า "${title}"! เครดิตโค้ช +${bonusRep}`, 'ok');
  } else {
    const scoreLine = `${fx.home ? 'ทีมชาติไทย' : fx.opponentName} ${payload.gh}-${payload.ga} ${fx.home ? fx.opponentName : 'ทีมชาติไทย'}${payload.penText ? ` (${payload.penText})` : ''}`;
    pushFeed(d, 'ทีมชาติไทย', `🇹🇭 ${fx.roundLabel}: ${scoreLine}`, wonMatch ? 'ok' : lostMatch ? 'urg' : '');
  }

  return { trophyWon, wonMatch };
}
