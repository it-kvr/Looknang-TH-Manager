import { AR_T, FSD, LINE } from '../data/thaiFootballData';
import type {
  GameState,
  MatchEnvironment,
  Mentality,
  Player,
  Position,
  SubRole,
  Team
} from '../types/game';
import { clamp } from '../utils/math';
import { ef, getFormationCounts, getFormationSlots, playerPen, xi } from './playerCore';
import { MAX_STAFF_LV, getStaffState, rate } from './simulation';
import type { MatchFixtureKind } from './matchEnv';

const PASS_NAMES = ['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'] as const;
const PRESS_NAMES = ['ต่ำ', 'กลาง', 'สูง'] as const;
const TEMPO_NAMES = ['ช้า', 'กลาง', 'เร็ว'] as const;
const LINE_NAMES = ['ลึก', 'กลาง', 'สูง'] as const;
const WID_NAMES = ['แคบ', 'กลาง', 'กว้าง'] as const;

export interface AssistantRecommendedTactic {
  form: string;
  tac: Mentality;
  pass: number;
  press: number;
  tempo: number;
  line: number;
  wid: number;
  summaryLine: string;
  rationale: string;
}

export interface AssistantCoachReport {
  asstLv: number;
  maxLv: number;
  rankTitle: string;
  tierLabel: string;
  unlockHint: string | null;
  confidenceLabel: string;
  weaknesses: {
    title: string;
    detail: string;
    tone: 'pos' | 'warn' | 'neg';
  }[];
  dangerThreat: {
    title: string;
    detail: string;
  } | null;
  targetPlayerNote: {
    name: string;
    role: SubRole;
    ov: number;
    fit: number;
    reason: string;
  } | null;
  envNote: string | null;
  squadFitNote: string | null;
  recommendation: AssistantRecommendedTactic | null;
  canApplyTactics: boolean;
  canShowFullSliders: boolean;
  canShowFormation: boolean;
}

export interface AssistantAppliedPlanResult {
  form: string;
  tac: Mentality;
  pass: number;
  press: number;
  tempo: number;
  line: number;
  wid: number;
  lineupNames: string[];
  avgFit: number;
  weaknessSummary: string;
  usedAssistantLevel: number;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function getLineAverage(players: Player[], slots: { pos: Position }[], targetPos: Position): number {
  const matched = players.filter((q, idx) => (slots[idx]?.pos || q.pos) === targetPos);
  if (!matched.length) return 0;
  return avg(matched.map((q) => ef(q)));
}

function getFlankAverage(players: Player[], slots: { sp: SubRole }[], side: 'L' | 'R' | 'C'): number {
  const leftRoles = new Set<SubRole>(['LB', 'LWB', 'LM', 'LW']);
  const rightRoles = new Set<SubRole>(['RB', 'RWB', 'RM', 'RW']);
  const centerRoles = new Set<SubRole>(['CB', 'LCB', 'RCB', 'CDM', 'LDM', 'RDM', 'CM', 'LCM', 'RCM', 'CAM', 'CF', 'ST', 'LS', 'RS']);
  const set = side === 'L' ? leftRoles : side === 'R' ? rightRoles : centerRoles;
  const matched = players.filter((q, idx) => set.has(slots[idx]?.sp || q.ro));
  if (!matched.length) return 0;
  return avg(matched.map((q) => ef(q)));
}

function scoreSquadForFormation(team: Team, formName: string): { fitScore: number; outOfPos: number } {
  const rawSlots = FSD[formName];
  if (!rawSlots) return { fitScore: 0, outOfPos: 11 };

  const available = team.sq
    .filter((q) => q.inj === 0 && (q.sus || 0) === 0)
    .slice()
    .sort((a, b) => ef(b) - ef(a));

  if (available.length < 11) {
    return { fitScore: 40, outOfPos: Math.max(0, 11 - available.length) };
  }

  const slots = rawSlots.map(([sp]) => ({ sp, pos: LINE[sp] || ('MF' as Position) }));
  const used = new Set<string>();
  let totalScore = 0;
  let outOfPos = 0;

  // Assign GK first, then best-fit slots in order of scarcity (DF/FW/MF)
  const order = [...slots.keys()].sort((a, b) => {
    const pa = slots[a].pos === 'GK' ? 0 : slots[a].pos === 'FW' ? 1 : slots[a].pos === 'DF' ? 2 : 3;
    const pb = slots[b].pos === 'GK' ? 0 : slots[b].pos === 'FW' ? 1 : slots[b].pos === 'DF' ? 2 : 3;
    return pa - pb;
  });

  for (const idx of order) {
    const sl = slots[idx];
    let bestPlayer: Player | null = null;
    let bestVal = -999;
    for (const pl of available) {
      if (used.has(pl.n)) continue;
      const penLvl = playerPen(pl, sl.sp);
      const mult = penLvl === 0 ? 1 : penLvl === 1 ? 0.91 : 0.78;
      const fitBonus = (pl.fit ?? 100) >= 75 ? 1 : 0.88;
      const val = ef(pl) * mult * fitBonus - penLvl * 4;
      if (val > bestVal) {
        bestVal = val;
        bestPlayer = pl;
      }
    }
    if (bestPlayer) {
      used.add(bestPlayer.n);
      const penLvl = playerPen(bestPlayer, sl.sp);
      if (penLvl > 0) outOfPos += 1;
      totalScore += bestVal;
    }
  }

  return { fitScore: totalScore / 11, outOfPos };
}

export function buildAssistantCoachNotes(params: {
  state: GameState;
  myTeam: Team;
  oppTeam: Team;
  meIsHome: boolean;
  myRate?: { at: number; df: number };
  oppRate?: { at: number; df: number };
  matchEnv: MatchEnvironment;
  kind: MatchFixtureKind;
  isDerby: boolean;
}): AssistantCoachReport {
  const { state, myTeam, oppTeam, meIsHome, matchEnv, kind, isDerby } = params;
  const asstLv = clamp(getStaffState(state).asst, 0, MAX_STAFF_LV);
  const myRate = params.myRate ?? rate(myTeam, state, false, undefined, undefined, undefined, meIsHome);
  const oppRate = params.oppRate ?? rate(oppTeam, state, false, undefined, undefined, undefined, !meIsHome);

  const oppXi = xi(oppTeam);
  const oppSlots = getFormationSlots(oppTeam);
  const oppCounts = getFormationCounts(oppTeam);

  const myXi = xi(myTeam);
  const myAvgFit = Math.round(avg(myXi.map((q) => q.fit ?? 100)));
  const oppAvgFit = Math.round(avg(oppXi.map((q) => q.fit ?? 100)));

  const myPow = (myRate.at + myRate.df) / 2;
  const oppPow = (oppRate.at + oppRate.df) / 2;
  const powGap = myPow - oppPow;

  const rankTitles = [
    'ยังไม่มีผู้ช่วยโค้ช',
    'ผู้ช่วยฝึกหัด',
    'ผู้ช่วยภาคสนาม',
    'ผู้ช่วยวิเคราะห์แท็กติก',
    'ผู้ช่วยอาวุโส',
    'หัวหน้าโค้ชแท็กติก',
    'มือขวาขั้นมาสเตอร์'
  ] as const;

  const unlockHints: Record<number, string> = {
    0: 'จ้าง "ผู้ช่วยผู้จัดการทีม" ในหน้า สโมสร & การเงิน → สตาฟฟ์ เพื่อปลดล็อกโน้ตจุดอ่อนคู่แข่งและคำแนะนำแผนแก้ทาง',
    1: 'อัปเกรดผู้ช่วยเป็น Lv.2 เพื่อปลดล็อกระบบการเล่นแนะนำและตัวอันตรายของคู่แข่ง',
    2: 'อัปเกรดผู้ช่วยเป็น Lv.3 เพื่อปลดล็อกแท็กติกละเอียด 5 ค่า และปุ่มใช้แผนอัตโนมัติในคลิกเดียว',
    3: 'อัปเกรดผู้ช่วยเป็น Lv.4 เพื่อเจาะข้อมูลจุดอ่อนลึกขึ้นและอ่านตัวอันตรายคู่แข่งแม่นยำขึ้น',
    4: 'อัปเกรดผู้ช่วยเป็น Lv.5 เพื่อล็อกเป้าผู้เล่นที่เป็นจุดอ่อนรายบุคคลของคู่แข่งและตรวจความพร้อมขุมกำลังเต็มรูปแบบ',
    5: 'อัปเกรดผู้ช่วยเป็น Lv.6 (สูงสุด) เพื่อปลดล็อกเคล็ดลับชิงความได้เปรียบตามสภาพสนามและจังหวะเกม'
  };

  if (asstLv <= 0) {
    const basicLine =
      powGap >= 4
        ? `ภาพรวมศักยภาพ 11 ตัวจริงของทีมเราเหนือกว่า ${oppTeam.name} เล็กน้อย`
        : powGap <= -4
          ? `${oppTeam.name} มีขุมกำลัง 11 ตัวจริงแข็งแกร่งกว่า ต้องเน้นความรัดกุมในเกมนี้`
          : `รูปเกมสูสีกับ ${oppTeam.name} การจัดตัวและสภาพความฟิตในสนามจะเป็นตัวตัดสิน`;

    return {
      asstLv: 0,
      maxLv: MAX_STAFF_LV,
      rankTitle: rankTitles[0],
      tierLabel: `ผู้ช่วย Lv.0/${MAX_STAFF_LV}`,
      unlockHint: unlockHints[0],
      confidenceLabel: 'ข้อมูลพื้นฐาน',
      weaknesses: [
        {
          title: 'ประเมินสภาพเบื้องต้นก่อนแข่ง',
          detail: `${basicLine} · ${meIsHome ? 'ได้เปรียบเสียงเชียร์เจ้าบ้าน' : 'ออกไปเยือนต้องระวังแรงกดดันเกมรุกเจ้าถิ่น'}`,
          tone: 'warn'
        }
      ],
      dangerThreat: null,
      targetPlayerNote: null,
      envNote: null,
      squadFitNote: null,
      recommendation: null,
      canApplyTactics: false,
      canShowFullSliders: false,
      canShowFormation: false
    };
  }

  // ---- Deep opponent weakness extraction (truthful to engine data) ----
  const gkAvg = getLineAverage(oppXi, oppSlots, 'GK');
  const dfAvg = getLineAverage(oppXi, oppSlots, 'DF');
  const mfAvg = getLineAverage(oppXi, oppSlots, 'MF');
  const fwAvg = getLineAverage(oppXi, oppSlots, 'FW');
  const leftAvg = getFlankAverage(oppXi, oppSlots, 'L');
  const rightAvg = getFlankAverage(oppXi, oppSlots, 'R');

  const oppOutOfPos = oppXi
    .map((pl, idx) => ({ pl, slot: oppSlots[idx]?.sp || pl.ro, pen: playerPen(pl, oppSlots[idx]?.sp) }))
    .filter((item) => item.pen > 0)
    .sort((a, b) => b.pen - a.pen || a.pl.ov - b.pl.ov);

  const oppTiredStarters = oppXi
    .filter((pl) => Math.round(pl.fit ?? 100) < 76)
    .sort((a, b) => (a.fit ?? 100) - (b.fit ?? 100));

  const oppForm = (oppTeam.fm || '').slice(-5);
  const recentLosses = (oppForm.match(/L/g) || []).length;
  const oppGaPerGame = oppTeam.p > 0 ? oppTeam.ga / oppTeam.p : 1.1;

  const weaknesses: { priority: number; title: string; detail: string; tone: 'pos' | 'warn' | 'neg' }[] = [];

  // 1. Out-of-position weakness
  if (oppOutOfPos.length > 0) {
    const first = oppOutOfPos[0];
    weaknesses.push({
      priority: 95 + oppOutOfPos.length * 4,
      title: `จัดตัวฝืนตำแหน่ง ${oppOutOfPos.length} จุด`,
      detail: `${first.pl.n} (${first.pl.ro}) ถูกจับยืน ${first.slot} ทำให้ประสิทธิภาพลดลง เปิดช่องให้กดดันพื้นที่นี้ได้`,
      tone: 'pos'
    });
  }

  // 2. Fatigue / low stamina
  if (oppTiredStarters.length >= 2 || oppAvgFit < 79) {
    const worst = oppTiredStarters[0] || oppXi.slice().sort((a, b) => (a.fit ?? 100) - (b.fit ?? 100))[0];
    weaknesses.push({
      priority: 90 + (82 - oppAvgFit),
      title: `ความฟิตคู่แข่งอ่อนล้า (เฉลี่ย ${oppAvgFit}%)`,
      detail: worst
        ? `มีตัวจริงฟิตต่ำกว่า 76% ถึง ${oppTiredStarters.length} ราย (เช่น ${worst.n} เหลือ ${Math.round(worst.fit ?? 100)}%) หากบี้เร็วครึ่งหลังจะยุบชัดเจน`
        : 'แนวรับคู่แข่งความฟิตไม่เต็มร้อย เหมาะเร่งจังหวะและเพรสซิ่งกดดันต่อเนื่อง',
      tone: 'pos'
    });
  }

  // 3. Tactical line / aggressive mentality vulnerability
  const oppLine = oppTeam.line ?? 1;
  const oppPress = oppTeam.press ?? 1;
  const oppWid = oppTeam.wid ?? 1;
  const oppTac = oppTeam.tac;

  if (oppTac === 'X' || oppTac === 'A' || oppLine === 2) {
    weaknesses.push({
      priority: 88,
      title: `ดันแนวรับสูง / เปิดพื้นที่หลังไลน์`,
      detail: `คู่แข่งเล่นสไตล์ ${AR_T[oppTac]} (แนวรับ${LINE_NAMES[oppLine]}) ทิ้งพื้นที่ว่างหลังกองหลัง เหมาะกับบอลเร็วและการแทงทะลุช่อง`,
      tone: 'pos'
    });
  } else if (oppTac === 'D' || oppTac === 'Z' || oppCounts[1] >= 5) {
    weaknesses.push({
      priority: 84,
      title: `เน้นอุดรับลึก ปล่อยพื้นที่ริมเส้นและหน้ากรอบ`,
      detail: `คู่แข่งถอยรับต่ำ (${oppTeam.cf ? 'ระบบกำหนดเอง' : oppTeam.form} · ${AR_T[oppTac]}) ยิงตรงๆ เจาะยาก ควรถ่างเกมออกข้างและต่อบอลหาช่องจบสกอร์`,
      tone: 'warn'
    });
  }

  // 4. Wing vs center structural gaps
  const oppHasWingGap = oppCounts[1] === 3 || oppTeam.form === '4-1-2-1-2';
  if (oppHasWingGap) {
    weaknesses.push({
      priority: 82,
      title: oppTeam.form === '4-1-2-1-2' ? 'ระบบแคบ พื้นที่ริมเส้นเปิดกว้าง' : 'หลัง 3 คน มีช่องว่างหลังวิงแบ็ก',
      detail:
        oppTeam.form === '4-1-2-1-2'
          ? 'แผนไดมอนด์อัดแน่นตรงกลางแต่ขาดตัวริมเส้นธรรมชาติ ใช้ปีกหรือแบ็กเติมเกมกว้างจะสร้างโอกาสเปิดบอลได้บ่อย'
          : `หลัง 3 ตัวของ ${oppTeam.form} มักถูกโจมตีด้านข้างเวลาวิงแบ็กเติมสูง ควรเปิดเกมริมเส้นโจมตีจังหวะสวน`,
      tone: 'pos'
    });
  } else if (leftAvg > 0 && rightAvg > 0 && Math.abs(leftAvg - rightAvg) >= 3) {
    const weakSide = leftAvg < rightAvg ? 'ฝั่งซ้าย' : 'ฝั่งขวา';
    const strongAttackHint = leftAvg < rightAvg ? 'เจาะทางขวาของเรา (RW/RM/RB)' : 'เจาะทางซ้ายของเรา (LW/LM/LB)';
    weaknesses.push({
      priority: 79,
      title: `เกมรับ${weakSide}คู่แข่งค่อนข้างเปราะ`,
      detail: `ค่าเฉลี่ยผู้เล่น${weakSide}ของคู่แข่งต่ำกว่าอีกฝั่งชัดเจน (${Math.round(Math.min(leftAvg, rightAvg))} vs ${Math.round(Math.max(leftAvg, rightAvg))}) แนะนำเน้น${strongAttackHint}`,
      tone: 'pos'
    });
  }

  // 5. Weakest sector (GK / DF / MF / FW)
  const rawSectors: { key: Position; label: string; score: number }[] = [
    { key: 'GK', label: 'ผู้รักษาประตู', score: gkAvg },
    { key: 'DF', label: 'แนวรับ', score: dfAvg },
    { key: 'MF', label: 'แดนกลาง', score: mfAvg },
    { key: 'FW', label: 'แดนหน้า', score: fwAvg }
  ];
  const sectorPairs = rawSectors.filter((x) => x.score > 0);
  sectorPairs.sort((a, b) => a.score - b.score);
  const weakestSector = sectorPairs[0];
  if (weakestSector) {
    const detailMap: Record<Position, string> = {
      GK: `นายด่านคู่แข่งพลังเฉลี่ยราว ${Math.round(weakestSector.score)} ยังรับมือลูกยิงไกลและลูกเปิดริมเส้นไม่นิ่งเท่าไร กล้าสับไกหน้ากรอบได้เปรียบ`,
      DF: `แผงกองหลังเฉลี่ยราว ${Math.round(weakestSector.score)} ช้ากว่าค่าเฉลี่ยทีมอื่นในแนว เจาะเข้าทำในกรอบเขตโทษมีลุ้นประตูสูง`,
      MF: `ห้องเครื่องตรงกลางเฉลี่ยราว ${Math.round(weakestSector.score)} แย่งบอลและเชื่อมเกมไม่แน่น ใช้กองกลาง 3 คนหรือเพรสตรงกลางจะตัดเกมได้บ่อย`,
      FW: `แนวรุกจบสกอร์ไม่คมนัก (เฉลี่ย ${Math.round(weakestSector.score)}) เราสามารถดันไลน์ขึ้นมาคุมเกมได้โดยไม่ต้องถอยรับลึกเกินไป`
    };
    weaknesses.push({
      priority: 75,
      title: `จุดเปราะบางที่สุดอยู่ที่${weakestSector.label}`,
      detail: detailMap[weakestSector.key],
      tone: 'pos'
    });
  }

  // 6. Tactical familiarity or poor form
  if ((oppTeam.tacFam ?? 65) < 62) {
    weaknesses.push({
      priority: 73,
      title: `ความเข้าใจแผนคู่แข่งยังไม่ลงตัว (${oppTeam.tacFam ?? 65}%)`,
      detail: 'นักเตะคู่แข่งยังประสานงานตามแท็กติกไม่คล่องตัว กดเพรสซิ่งเร็วจะบีบให้จ่ายพลาดง่าย',
      tone: 'pos'
    });
  }
  if (recentLosses >= 3 || (oppTeam.p >= 4 && oppGaPerGame >= 1.75)) {
    weaknesses.push({
      priority: 71,
      title: recentLosses >= 3 ? `ความมั่นใจตกต่ำ (แพ้ ${recentLosses} จาก 5 นัดหลัง)` : `แนวรับเสียประตูเฉลี่ย ${oppGaPerGame.toFixed(1)} ลูก/นัด`,
      detail: 'หากทีมเราออกสตาร์ตบุกกดดันและยิงนำเร็ว เกมรับคู่แข่งมีโอกาสรวนสูง',
      tone: 'pos'
    });
  }

  weaknesses.sort((a, b) => b.priority - a.priority);

  // ---- Danger threat (unlocked Lv.2+) ----
  const dangerPool = oppXi
    .filter((q) => q.pos === 'FW' || q.pos === 'MF')
    .slice()
    .sort((a, b) => ef(b) - ef(a));
  const topThreat = dangerPool[0] || oppXi[0];
  const oppUsesCounterTrap = (oppTeam.pass ?? 1) === 3;
  const dangerThreat =
    asstLv >= 2 && topThreat
      ? {
          title: `ระวัง ${topThreat.n} (${topThreat.ro} · OV ${topThreat.ov})`,
          detail: oppUsesCounterTrap
            ? `ตัวความหวังอันดับ 1 ของคู่แข่ง และทีมเยือนตั้งบอลสวนกลับ (เกมสวน) อย่าดันแนวรับเพลินจนโดนแทงหลุดเดี่ยว`
            : `${topThreat.n} เป็นแกนหลักสร้างอันตรายสูงสุดของ ${oppTeam.name} (ฟิต ${Math.round(topThreat.fit ?? 100)}%) ควรมีตัวรับคอยซ้อนจังหวะพลิกบอล`
        }
      : null;

  // ---- Specific weak target player (unlocked Lv.5+) ----
  const outfieldOpp = oppXi
    .map((pl, idx) => ({
      pl,
      role: oppSlots[idx]?.sp || pl.ro,
      pen: playerPen(pl, oppSlots[idx]?.sp),
      score: ef(pl) - playerPen(pl, oppSlots[idx]?.sp) * 6 - Math.max(0, 78 - (pl.fit ?? 100)) * 0.45
    }))
    .filter((item) => item.role !== 'GK')
    .sort((a, b) => a.score - b.score);
  const weakTarget = outfieldOpp[0];
  const targetPlayerNote =
    asstLv >= 5 && weakTarget
      ? {
          name: weakTarget.pl.n,
          role: weakTarget.role,
          ov: weakTarget.pl.ov,
          fit: Math.round(weakTarget.pl.fit ?? 100),
          reason:
            weakTarget.pen > 0
              ? `ยืนฝืนตำแหน่ง ${weakTarget.role}`
              : (weakTarget.pl.fit ?? 100) < 74
                ? `ความฟิตเหลือเพียง ${Math.round(weakTarget.pl.fit ?? 100)}%`
                : `ค่าพลังรับมือเกมระดับนี้ต่ำกว่าเพื่อนร่วมแนว (OV ${weakTarget.pl.ov})`
        }
      : null;

  // ---- Environment & Pitch advice (Lv.3+ brief / Lv.6 deep edge tip) ----
  const isWetHeavy = matchEnv.season === 'rainy' && (matchEnv.puddles.length >= 2 || matchEnv.turfCond < 75);
  const isLongGrass = matchEnv.grassLength === 'long' || (matchEnv.dirtMix ?? 0) >= 0.35;
  const isHotDay = matchEnv.season === 'summer' && matchEnv.timeOfDay === 'day';

  let envNote: string | null = null;
  if (asstLv >= 3) {
    if (isWetHeavy || isLongGrass) {
      envNote = `สนามมี${matchEnv.puddles.length > 0 ? `แอ่งน้ำ ${matchEnv.puddles.length} จุด` : 'หญ้ายาว/พื้นผิวขรุขระ'} บอลเรียดอาจสะดุด แนะนำจ่ายบอลแบบผสมหรือบอลยาวแทนการต่อบอลสั้นเสี่ยงหน้าบ้าน`;
    } else if (isHotDay && myAvgFit < 84) {
      envNote = `เตะกลางวันอากาศร้อน (ฟิตเฉลี่ยทีม ${myAvgFit}%) ไม่ควรเพรสสุดตลอด 90 นาที เผื่อแรงไว้คุมจังหวะครึ่งหลัง`;
    } else if (asstLv >= 6) {
      envNote =
        matchEnv.turfCond >= 85 && matchEnv.grassLength === 'short'
          ? 'พื้นสนามเรียบและตัดหญ้าสั้น บอลวิ่งเร็วมาก เหมาะกับการต่อบอลจังหวะเดียวและโจมตีพื้นที่ว่างอย่างรวดเร็ว'
          : `สภาพสนาม ${matchEnv.turfCond}% สมดุลมาตรฐาน ใช้แท็กติกตามแผนหลักได้เต็มประสิทธิภาพ` +
            (isDerby ? ' · เกมดาร์บี้ระวังอารมณ์และการโดนใบเหลืองเร็ว' : '');
    }
  }

  // ---- Optimal Tactical Recommendation Engine ----
  const candidateForms = Object.keys(FSD);
  let bestForm = myTeam.cf ? myTeam.form : '4-2-3-1';
  let bestFormScore = -999;
  let bestOutOfPos = 0;

  for (const fname of candidateForms) {
    const { fitScore, outOfPos } = scoreSquadForFormation(myTeam, fname);
    let tacBonus = 0;
    const fSlots = FSD[fname];
    const dfN = fSlots.filter(([r]) => LINE[r] === 'DF').length;
    const fwN = fSlots.filter(([r]) => LINE[r] === 'FW').length;
    const hasWingAtk = fSlots.some(([r]) => r === 'LW' || r === 'RW' || r === 'LM' || r === 'RM');
    const hasCam = fSlots.some(([r]) => r === 'CAM' || r === 'CF');
    const hasCdm = fSlots.some(([r]) => r === 'CDM' || r === 'LDM' || r === 'RDM');

    if ((oppHasWingGap || oppTac === 'D' || oppTac === 'Z') && hasWingAtk) tacBonus += 2.2;
    if ((oppTac === 'D' || oppTac === 'Z' || oppCounts[1] >= 5) && hasCam) tacBonus += 1.6;
    if (powGap <= -4 && dfN >= 5) tacBonus += 2.4;
    if (powGap <= -3 && hasCdm) tacBonus += 1.5;
    if (powGap >= 3.5 && (fwN >= 3 || fname === '4-2-3-1' || fname === '4-3-3')) tacBonus += 2.0;
    if (oppUsesCounterTrap && hasCdm) tacBonus += 1.3;
    if (fname === myTeam.form && !myTeam.cf) tacBonus += 0.7; // familiarity continuity bonus

    const total = fitScore + tacBonus - outOfPos * 2.2;
    if (total > bestFormScore) {
      bestFormScore = total;
      bestForm = fname;
      bestOutOfPos = outOfPos;
    }
  }

  // Optimal mentality & 5 tactical sliders
  let recTac: Mentality = 'B';
  if (powGap >= 5 || (meIsHome && powGap >= 2 && (oppTac === 'D' || oppTac === 'Z'))) {
    recTac = 'A';
  } else if (powGap <= -5 && !meIsHome) {
    recTac = 'D';
  } else if (powGap <= -2.5) {
    recTac = 'D';
  } else if (oppTac === 'X' && powGap > -2) {
    recTac = 'B';
  } else if (meIsHome && weakestSector?.key === 'DF' && powGap >= 0) {
    recTac = 'A';
  }

  let recPass = 1; // 0 short, 1 mixed, 2 long, 3 counter
  if (oppTac === 'X' || oppTac === 'A' || oppLine === 2 || powGap <= -3) {
    recPass = 3; // Counter!
  } else if (isWetHeavy || isLongGrass) {
    recPass = weakestSector?.key === 'GK' || oppHasWingGap ? 2 : 1;
  } else if (oppTac === 'D' || oppTac === 'Z') {
    recPass = 0; // Short passing to unlock bus
  } else if (mfAvg > 0 && myRate.at > oppRate.df + 2) {
    recPass = 0;
  }

  let recPress = 1; // 0 low, 1 mid, 2 high
  if ((oppAvgFit < 78 || (oppTeam.tacFam ?? 65) < 62 || recentLosses >= 3) && myAvgFit >= 80 && !isHotDay) {
    recPress = 2;
  } else if (powGap <= -4 || myAvgFit < 74) {
    recPress = 0;
  }

  let recTempo = 1; // 0 slow, 1 mid, 2 fast
  if (recPass === 3 || oppTiredStarters.length >= 2 || oppLine === 2) {
    recTempo = 2;
  } else if (oppTac === 'D' || oppTac === 'Z' || myAvgFit < 74) {
    recTempo = isHotDay && myAvgFit < 78 ? 0 : 1;
  }

  let recLine = 1; // 0 deep, 1 mid, 2 high
  if (oppUsesCounterTrap || powGap <= -3 || recTac === 'D') {
    recLine = 0;
  } else if (recTac === 'A' && recPress === 2 && !oppUsesCounterTrap) {
    recLine = 2;
  }

  let recWid = 1; // 0 narrow, 1 mid, 2 wide
  if (oppHasWingGap || oppTac === 'D' || oppTac === 'Z' || oppTeam.form === '4-1-2-1-2') {
    recWid = 2;
  } else if (oppTeam.form === '3-4-3' && powGap < 0) {
    recWid = 0;
  }

  const rationaleParts: string[] = [];
  if (bestOutOfPos === 0) {
    rationaleParts.push(`ขุมกำลังที่ฟิตพร้อมของทีมลงตัวกับระบบ ${bestForm} ครบทุกตำแหน่ง`);
  } else {
    rationaleParts.push(`ระบบ ${bestForm} ดึงศักยภาพตัวจริงที่มีอยู่ได้ดีที่สุดในเกมนี้`);
  }
  if (recPass === 3) {
    rationaleParts.push('เน้นเกมสวนกลับเร็วเจาะพื้นที่หลังแนวรับคู่แข่ง');
  } else if (recPass === 0) {
    rationaleParts.push('ต่อบอลสั้นไล่หาช่องเจาะแนวรับที่ถอยตั้งโซนแน่น');
  } else if (recPass === 2) {
    rationaleParts.push('เปิดบอลยาวข้ามโซนลดความเสี่ยงบอลสะดุดบนพื้นสนาม');
  }
  if (recWid === 2) {
    rationaleParts.push('ถ่างเกมรุกออกริมเส้นเพื่อสร้างจังหวะครอส');
  }
  if (recLine === 0 && oppUsesCounterTrap) {
    rationaleParts.push('คุมแนวรับลึกกันโดนสวนกลับเร็ว');
  }

  const maxWeaknesses = asstLv <= 2 ? 2 : asstLv <= 4 ? 3 : 4;
  const trimmedWeaknesses = weaknesses.slice(0, maxWeaknesses).map(({ title, detail, tone }) => ({ title, detail, tone }));

  const confidenceLabel =
    asstLv >= 5
      ? 'วิเคราะห์เจาะลึกสูงสุด'
      : asstLv >= 3
        ? 'วิเคราะห์แท็กติกครบชุด'
        : 'ประเมินเบื้องต้น';

  const summaryLine =
    asstLv >= 3
      ? `${bestForm} · ${AR_T[recTac]} · จ่าย${PASS_NAMES[recPass]} · เพรส${PRESS_NAMES[recPress]} · จังหวะ${TEMPO_NAMES[recTempo]} · แนวรับ${LINE_NAMES[recLine]} · ${WID_NAMES[recWid]}`
      : asstLv === 2
        ? `${bestForm} · สไตล์${AR_T[recTac]}`
        : `แนะนำสไตล์${AR_T[recTac]} (${PASS_NAMES[recPass]})`;

  const squadFitNote =
    asstLv >= 4
      ? myAvgFit < 76
        ? `ความฟิตเฉลี่ย 11 ตัวจริงอยู่ที่ ${myAvgFit}% ควรสลับตัวล้าออกก่อนคิกออฟหรือเตรียมเปลี่ยนตัวเร็วช่วงนาที 60`
        : bestOutOfPos === 0
          ? `นักเตะ 11 ตัวจริงของทีมเราเข้ากับแผน ${bestForm} แบบตรงตำแหน่ง 100% (ฟิตเฉลี่ย ${myAvgFit}%)`
          : `หากปรับใช้ระบบ ${bestForm} มีจุดขยับตำแหน่ง ${bestOutOfPos} จุด แต่ค่าพลังรวมยังได้เปรียบที่สุด`
      : null;

  return {
    asstLv,
    maxLv: MAX_STAFF_LV,
    rankTitle: rankTitles[asstLv],
    tierLabel: `ผู้ช่วย Lv.${asstLv}/${MAX_STAFF_LV}`,
    unlockHint: unlockHints[asstLv] || null,
    confidenceLabel,
    weaknesses: trimmedWeaknesses,
    dangerThreat,
    targetPlayerNote,
    envNote,
    squadFitNote,
    recommendation: {
      form: bestForm,
      tac: recTac,
      pass: recPass,
      press: recPress,
      tempo: recTempo,
      line: recLine,
      wid: recWid,
      summaryLine,
      rationale: rationaleParts.join(' · ')
    },
    canApplyTactics: asstLv >= 3,
    canShowFullSliders: asstLv >= 3,
    canShowFormation: asstLv >= 2
  };
}

function scorePlayerFitnessForSlot(pl: Player, slot: { sp: SubRole; pos: Position }): number {
  const fit = clamp(pl.fit ?? 100, 0, 100);
  const unavailPenalty = pl.inj > 0 || (pl.sus || 0) > 0 ? -5000 : 0;

  if (slot.pos === 'GK') {
    const gkRoleBonus = pl.pos === 'GK' ? 600 : -600;
    return unavailPenalty + gkRoleBonus + fit * 10 + pl.ov * 0.15;
  }

  if (pl.pos === 'GK') {
    return unavailPenalty - 600 + fit * 10 + pl.ov * 0.1;
  }

  const penLvl = playerPen(pl, slot.sp);
  const roleBonus = penLvl === 0 ? 80 : penLvl === 1 ? 40 : -80;
  return unavailPenalty + roleBonus + fit * 10 + pl.ov * 0.2;
}

export function pickFittestLineupForFormation(team: Team, formName: string): string[] {
  const rawSlots = FSD[formName] || FSD['4-2-3-1'] || FSD['4-4-2'];
  const slots = rawSlots.map(([sp]) => ({ sp, pos: LINE[sp] || ('MF' as Position) }));
  if (team.sq.length < slots.length) {
    return team.sq.map((q) => q.n);
  }

  const availablePool = team.sq.filter((q) => q.inj === 0 && (q.sus || 0) === 0);
  const pool =
    availablePool.length >= slots.length
      ? availablePool
      : [
          ...availablePool,
          ...team.sq
            .filter((q) => q.inj > 0 || (q.sus || 0) > 0)
            .sort((a, b) => a.inj + (a.sus || 0) - (b.inj + (b.sus || 0)) || (b.fit ?? 100) - (a.fit ?? 100))
        ];

  // Assign GK first, then outfield positions in scarcity order (fewest natural candidates first)
  const slotOrder = slots
    .map((sl, idx) => {
      const naturalCount = pool.filter((q) =>
        sl.pos === 'GK' ? q.pos === 'GK' : q.pos !== 'GK' && playerPen(q, sl.sp) === 0
      ).length;
      return { idx, isGk: sl.pos === 'GK' ? 0 : 1, naturalCount };
    })
    .sort((a, b) => a.isGk - b.isGk || a.naturalCount - b.naturalCount)
    .map((x) => x.idx);

  const chosen = new Array<Player | null>(slots.length).fill(null);
  const used = new Set<string>();

  for (const idx of slotOrder) {
    const sl = slots[idx];
    let bestPlayer: Player | null = null;
    let bestScore = -Infinity;
    for (const pl of pool) {
      if (used.has(pl.n)) continue;
      const sc = scorePlayerFitnessForSlot(pl, sl);
      if (sc > bestScore) {
        bestScore = sc;
        bestPlayer = pl;
      }
    }
    if (bestPlayer) {
      chosen[idx] = bestPlayer;
      used.add(bestPlayer.n);
    }
  }

  // Quick polish: swap any two starters if doing so improves total fitness+role score
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const pi = chosen[i];
        const pj = chosen[j];
        if (!pi || !pj) continue;
        const curScore = scorePlayerFitnessForSlot(pi, slots[i]) + scorePlayerFitnessForSlot(pj, slots[j]);
        const swappedScore = scorePlayerFitnessForSlot(pj, slots[i]) + scorePlayerFitnessForSlot(pi, slots[j]);
        if (swappedScore > curScore + 0.01) {
          chosen[i] = pj;
          chosen[j] = pi;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return chosen.filter((q): q is Player => Boolean(q)).map((q) => q.n);
}

export function recommendMatchPlanAndLineup(params: {
  state: GameState;
  myTeam: Team;
  oppTeam: Team;
  meIsHome: boolean;
  myRate?: { at: number; df: number };
  oppRate?: { at: number; df: number };
  matchEnv: MatchEnvironment;
  kind: MatchFixtureKind;
  isDerby: boolean;
  existingReport?: AssistantCoachReport | null;
}): AssistantAppliedPlanResult {
  const { state, myTeam, oppTeam, meIsHome, matchEnv, kind, isDerby } = params;
  const report =
    params.existingReport ??
    buildAssistantCoachNotes({
      state,
      myTeam,
      oppTeam,
      meIsHome,
      myRate: params.myRate,
      oppRate: params.oppRate,
      matchEnv,
      kind,
      isDerby
    });

  const myRate = params.myRate ?? rate(myTeam, state, false, undefined, undefined, undefined, meIsHome);
  const oppRate = params.oppRate ?? rate(oppTeam, state, false, undefined, undefined, undefined, !meIsHome);
  const powGap = (myRate.at + myRate.df) / 2 - (oppRate.at + oppRate.df) / 2;

  let chosenForm = report.recommendation?.form || (myTeam.cf ? '4-2-3-1' : myTeam.form);
  let chosenTac: Mentality = report.recommendation?.tac || (powGap >= 3 ? 'A' : powGap <= -3 ? 'D' : 'B');
  const chosenPass = report.recommendation?.pass ?? 1;
  const chosenPress = report.recommendation?.press ?? 1;
  const chosenTempo = report.recommendation?.tempo ?? 1;
  const chosenLine = report.recommendation?.line ?? (powGap <= -3 ? 0 : 1);
  const chosenWid = report.recommendation?.wid ?? 1;

  // If no assistant coach hired yet (Lv.0), still pick best formation for fittest squad
  if (!report.recommendation) {
    let bestScore = -Infinity;
    for (const fname of Object.keys(FSD)) {
      const names = pickFittestLineupForFormation(myTeam, fname);
      const rawSlots = FSD[fname];
      const sc = names.reduce((sum, name, idx) => {
        const pl = myTeam.sq.find((q) => q.n === name);
        if (!pl) return sum;
        const sp = rawSlots[idx]?.[0] || pl.ro;
        return sum + scorePlayerFitnessForSlot(pl, { sp, pos: LINE[sp] || pl.pos });
      }, 0);
      if (sc > bestScore) {
        bestScore = sc;
        chosenForm = fname;
      }
    }
    chosenTac = powGap >= 3 ? 'A' : powGap <= -3 ? 'D' : 'B';
  }

  const lineupNames = pickFittestLineupForFormation(myTeam, chosenForm);
  const pickedPlayers = lineupNames
    .map((n) => myTeam.sq.find((q) => q.n === n))
    .filter((q): q is Player => Boolean(q));
  const avgFit = Math.round(
    pickedPlayers.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, pickedPlayers.length)
  );

  const oppXi = xi(oppTeam);
  const oppAvgFit = Math.round(avg(oppXi.map((q) => q.fit ?? 100)));
  const weaknessTitles = report.weaknesses.slice(0, 2).map((w) => w.title);
  const weaknessSummary =
    report.asstLv > 0 && weaknessTitles.length > 0
      ? report.targetPlayerNote
        ? `${weaknessTitles.join(' · ')} (เป้าเจาะ: ${report.targetPlayerNote.name})`
        : weaknessTitles.join(' · ')
      : `สรุปเบื้องต้น: คู่แข่งฟิตเฉลี่ย ${oppAvgFit}% (จ้างผู้ช่วยโค้ชเพื่อเจาะจุดอ่อนลึกขึ้น)`;

  return {
    form: chosenForm,
    tac: chosenTac,
    pass: chosenPass,
    press: chosenPress,
    tempo: chosenTempo,
    line: chosenLine,
    wid: chosenWid,
    lineupNames,
    avgFit,
    weaknessSummary,
    usedAssistantLevel: report.asstLv
  };
}
