import type {
  GoalCelebrationStyle,
  LiveMatchWorld,
  LivePitchAgent,
  MatchEnvironment,
  MatchHighlightActorMeta,
  MatchHighlightClip,
  MatchHighlightFrame,
  MatchHighlightKind,
  Player,
  PlayerCareerProfile,
  SubRole,
  Team
} from '../types/game';
import { clamp } from '../utils/math';
import { DT, getFormationSlots, getShirtNo, visOf } from './playerCore';

export const HL_ACT = {
  NONE: 0,
  KICK: 1,
  BICYCLE: 2,
  VOLLEY: 3,
  HEADER: 4,
  DIVING_HEADER: 5,
  GK_DIVE: 6,
  SUPERSAVE: 7,
  CLASH: 8,
  CELEBRATE: 9,
  SLIDE: 10,
  TACKLE: 11,
  SHOOT_POWER: 12,
  SHOOT_FINESSE: 13,
  SHOOT_CHIP: 14,
  BURST: 15,
  STEPOVER: 16,
  SHIELD: 17,
  SPIN: 18,
  SKILL_PASS: 19,
  DRAGBACK: 20,
  CUTINSIDE: 21,
  SLIP: 22,
  WHIFF: 23,
  PRESS: 24,
  WALL: 25
} as const;

export interface SampledAgentFrame {
  id: string;
  sn: string;
  s: 'H' | 'A';
  no: number;
  ro: SubRole;
  gk?: 1;
  vis?: number[];
  ov?: number;
  cap?: 1;
  me?: 1;
  yc?: 1;
  sub?: 1;
  fit?: number;
  x: number;
  y: number;
  f: number;
  act?: number;
  dd?: number;
  ap?: number;
}

export interface RollingHighlightSample {
  ts: number;
  bx: number;
  by: number;
  bz: number;
  shot: boolean;
  style?: string;
  carId?: string;
  ripL: number;
  ripR: number;
  agents: SampledAgentFrame[];
}

export const MAX_MATCH_HIGHLIGHTS = 6;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

const mapAgentAction = (ag: LivePitchAgent): { act?: number; dd?: number; ap?: number } => {
  if (ag.intent === 'DIVE' && ag.diveProgress > 0) {
    return {
      act: HL_ACT.GK_DIVE,
      dd: ag.diveDir || 1,
      ap: Math.round(clamp(ag.diveProgress, 0, 1) * 100)
    };
  }
  if (ag.acrobatTimer && ag.acrobatTimer > 0) {
    const maxAc = Math.max(0.2, ag.acrobatMax || 0.72);
    const ap = Math.round(clamp(1 - ag.acrobatTimer / maxAc, 0, 1) * 100);
    const spinDir = ag.skillSpinDir || 1;
    switch (ag.acrobatType) {
      case 'bicycle':
        return { act: HL_ACT.BICYCLE, ap };
      case 'volley':
        return { act: HL_ACT.VOLLEY, ap };
      case 'header':
        return { act: HL_ACT.HEADER, ap };
      case 'diving_header':
        return { act: HL_ACT.DIVING_HEADER, ap };
      case 'supersave':
        return { act: HL_ACT.SUPERSAVE, dd: ag.diveDir || 1, ap };
      case 'clash':
        return { act: HL_ACT.CLASH, dd: (ag.actionDirX || 1) >= 0 ? 1 : -1, ap };
      case 'slide':
        return { act: HL_ACT.SLIDE, ap };
      case 'tackle':
        return { act: HL_ACT.TACKLE, ap };
      case 'shoot_power':
        return { act: HL_ACT.SHOOT_POWER, ap };
      case 'shoot_finesse':
        return { act: HL_ACT.SHOOT_FINESSE, ap };
      case 'shoot_chip':
        return { act: HL_ACT.SHOOT_CHIP, ap };
      case 'kick':
        return { act: HL_ACT.KICK, ap };
      case 'burst':
        return { act: HL_ACT.BURST, ap };
      case 'stepover':
        return { act: HL_ACT.STEPOVER, ap };
      case 'shield':
        return { act: HL_ACT.SHIELD, ap };
      case 'spin':
        return { act: HL_ACT.SPIN, dd: spinDir, ap };
      case 'skill_pass':
        return { act: HL_ACT.SKILL_PASS, dd: spinDir, ap };
      case 'dragback':
        return { act: HL_ACT.DRAGBACK, ap };
      case 'cutinside':
        return { act: HL_ACT.CUTINSIDE, dd: spinDir, ap };
      case 'slip':
        return { act: HL_ACT.SLIP, dd: spinDir, ap };
      case 'whiff':
        return { act: HL_ACT.WHIFF, ap };
      default:
        break;
    }
  }
  if (ag.intent === 'CELEBRATE') {
    if (ag.celebrateRole === 'conceded') {
      if (ag.isOgCulprit) {
        const ap = Math.round(clamp(ag.celebratePhase ?? 0, 0, 1) * 100);
        return { act: HL_ACT.CELEBRATE, dd: -1, ap };
      }
      return {};
    }
    const dd =
      ag.celebrateRole === 'scorer'
        ? 1
        : ag.celebrateRole === 'assister'
          ? 2
          : ag.isOgCulprit
            ? -1
            : 3;
    const ap = Math.round(clamp(ag.celebratePhase ?? 0, 0, 1) * 100);
    return { act: HL_ACT.CELEBRATE, dd, ap };
  }
  if (ag.intent === 'PRESS') {
    return { act: HL_ACT.PRESS };
  }
  if (ag.intent === 'WALL') {
    return { act: HL_ACT.WALL };
  }
  return {};
};

export const captureWorldSample = (w: LiveMatchWorld, tsSec: number): RollingHighlightSample => {
  const b = w.ball;
  const inShot =
    b.flightType === 'shot' ||
    b.flightType === 'freekick' ||
    b.flightType === 'penalty' ||
    (b.flightType === 'bounce' && Boolean(b.bounceNext?.goalPayload));

  return {
    ts: tsSec,
    bx: r1(b.x),
    by: r1(b.y),
    bz: r1(b.z),
    shot: inShot,
    style: b.shotStyle || (b.flightType === 'freekick' ? 'freekick' : b.flightType === 'penalty' ? 'penalty' : undefined),
    ...(b.carrierId ? { carId: b.carrierId } : {}),
    ripL: r2(w.goalNetRippleLeft || 0),
    ripR: r2(w.goalNetRippleRight || 0),
    agents: w.agents
      .filter((a) => !a.sentOff)
      .map((ag) => {
        const { act, dd, ap } = mapAgentAction(ag);
        return {
          id: ag.id,
          sn: ag.shortName,
          s: ag.side,
          no: ag.no,
          ro: ag.role,
          ...(ag.pos === 'GK' ? { gk: 1 as const } : {}),
          ...(ag.vis ? { vis: ag.vis } : {}),
          ...(ag.ov ? { ov: Math.round(ag.ov) } : {}),
          ...(ag.isCaptain ? { cap: 1 as const } : {}),
          ...(ag.isMe ? { me: 1 as const } : {}),
          ...(ag.hasYellow ? { yc: 1 as const } : {}),
          ...(ag.subbedIn ? { sub: 1 as const } : {}),
          ...(Number.isFinite(ag.fit) ? { fit: Math.round(ag.fit) } : {}),
          x: r1(ag.x),
          y: r1(ag.y),
          f: r2(ag.facing),
          ...(act ? { act } : {}),
          ...(dd ? { dd } : {}),
          ...(ap !== undefined ? { ap } : {})
        };
      })
  };
};

export const detectGoalHighlightKind = (opts: {
  finishVerb?: string;
  shotStyle?: string;
  flightType?: string;
  isOwnGoal?: boolean;
  shotDistM?: number;
}): MatchHighlightKind => {
  if (opts.isOwnGoal) return 'goal_og';
  const v = opts.finishVerb || '';
  const st = opts.shotStyle || '';
  if (v.includes('แฉลบ') || st === 'deflected') return 'goal_deflect';
  if (v.includes('ชนเสา') || v.includes('ชนคาน')) return 'goal_woodwork_in';
  if (opts.flightType === 'penalty' || v.includes('จุดโทษ') || st === 'panenka') return 'goal_penalty';
  if (opts.flightType === 'freekick' || v.includes('ฟรีคิก')) return 'goal_freekick';
  if (st === 'bicycle' || st === 'volley' || v.includes('ตีลังกา') || v.includes('วอลเลย์')) return 'goal_acrobat';
  if (st === 'diving_header' || st === 'header' || v.includes('โหม่ง')) return 'goal_header';
  if (st === 'curler' || st === 'trivela' || v.includes('ปั่นโค้ง') || v.includes('ทริเวล่า') || v.includes('สามเหลี่ยม')) {
    return 'goal_curler';
  }
  if (st === 'screamer' || st === 'knuckle' || (opts.shotDistM ?? 0) >= 22 || v.includes('ตะบันไกล') || v.includes('คนัคเคิล')) {
    return 'goal_screamer';
  }
  return 'goal_regular';
};

export const getHighlightKindBadge = (kind: MatchHighlightKind): { icon: string; label: string; toneClass: string } => {
  switch (kind) {
    case 'goal_acrobat':
      return { icon: '🤸', label: 'โอเวอร์เฮด / วอลเลย์', toneClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300' };
    case 'goal_curler':
      return { icon: '🌀', label: 'ปั่นโค้งเสียบมุม', toneClass: 'bg-sky-500/20 border-sky-400/60 text-sky-300' };
    case 'goal_screamer':
      return { icon: '🚀', label: 'ยิงไกลสุดสวย', toneClass: 'bg-orange-500/20 border-orange-400/60 text-orange-300' };
    case 'goal_freekick':
      return { icon: '🌀', label: 'ฟรีคิกมหัศจรรย์', toneClass: 'bg-indigo-500/20 border-indigo-400/60 text-indigo-300' };
    case 'goal_penalty':
      return { icon: '🎯', label: 'จุดโทษเฉียบขาด', toneClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300' };
    case 'goal_header':
      return { icon: '⚽', label: 'ลูกโหม่งพิฆาต', toneClass: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300' };
    case 'goal_woodwork_in':
      return { icon: '🥅', label: 'ชนเสา/คานกระดอนเข้า', toneClass: 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300' };
    case 'goal_deflect':
      return { icon: '💫', label: 'บอลแฉลบเข้าประตู', toneClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300' };
    case 'goal_og':
      return { icon: '🤦', label: 'เข้าประตูตัวเอง (OG)', toneClass: 'bg-rose-500/20 border-rose-400/60 text-rose-300' };
    case 'super_save':
      return { icon: '🧤', label: 'ซูเปอร์เซฟระดับโลก', toneClass: 'bg-sky-500/20 border-sky-400/60 text-sky-300' };
    case 'woodwork':
      return { icon: '🥅', label: 'ซัดเต็มข้อชนเสา/คาน', toneClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300' };
    default:
      return { icon: '⚽', label: 'ประตูสุดสวย', toneClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300' };
  }
};

interface HighlightEditorialInput {
  kind: MatchHighlightKind;
  minute: number;
  teamName: string;
  oppTeamName: string;
  actorName: string;
  assisterName?: string;
  victimName?: string;
  finishVerb?: string;
  shotDistM?: number;
  shotSpeedKmh?: number;
  scoreAfterGh: number;
  scoreAfterGa: number;
  side: 'H' | 'A';
  isDerby?: boolean;
}

export const buildHighlightEditorial = (inp: HighlightEditorialInput): {
  title: string;
  subtitle: string;
  commentary: string;
  crewTag: string;
  dramaScore: number;
} => {
  const actorShort = inp.actorName.split(' ')[0] || inp.actorName;
  const assistShort = inp.assisterName ? inp.assisterName.split(' ')[0] || inp.assisterName : '';
  const diffAfter = inp.side === 'H' ? inp.scoreAfterGh - inp.scoreAfterGa : inp.scoreAfterGa - inp.scoreAfterGh;
  const isEqualizer = diffAfter === 0 && (inp.kind.startsWith('goal_') && inp.kind !== 'goal_og');
  const isLateWinner = inp.minute >= 80 && diffAfter === 1 && inp.kind.startsWith('goal_');

  let baseDrama = 60;
  let title = `⚽ ${actorShort} ยิงประตูให้ ${inp.teamName}`;
  let crewTag = '⚽ จังหวะต่อบอล & จบสกอร์';

  switch (inp.kind) {
    case 'goal_acrobat':
      baseDrama = 94;
      title = `🤸 มหัศจรรย์! ${actorShort} ฟาดลูกกลางอากาศตุงตาข่าย`;
      crewTag = '🤸 ไฮไลท์ลูกยิงกลางอากาศ';
      break;
    case 'goal_freekick':
      baseDrama = 90;
      title = `🌀 ฟรีคิกปลิดวิญญาณ! ${actorShort} ปั่นโค้งเสียบมุม`;
      crewTag = '🌀 จังหวะปั่นฟรีคิก';
      break;
    case 'goal_curler':
      baseDrama = 87;
      title = `🌀 ปั่นโค้งสุดคม! ${actorShort} โชว์ความเหนือชั้น`;
      crewTag = '🌀 วิถีบอลโค้งเสียบมุม';
      break;
    case 'goal_screamer':
      baseDrama = 89;
      title = `🚀 ตะบันไกลสะท้านสนาม! ${actorShort}${inp.shotDistM ? ` (${inp.shotDistM} ม.)` : ''}`;
      crewTag = '🚀 ลูกยิงไกลเต็มข้อ';
      break;
    case 'goal_woodwork_in':
      baseDrama = 88;
      title = `🥅⚽ ชนเสา/คานกระดอนข้ามเส้น! ${actorShort} กดสุดเสียว`;
      crewTag = '🥅 ชนเสา/คานกระดอนเข้า';
      break;
    case 'goal_header':
      baseDrama = 82;
      title = `⚽ เทกตัวโหม่งเช็ดเสา! ${actorShort} พังประตู`;
      crewTag = '⚽ จังหวะขึ้นโหม่งพังประตู';
      break;
    case 'goal_penalty':
      baseDrama = 76;
      title = `🎯 สังหารจุดโทษนิ่งสนิท! ${actorShort} ไม่พลาด`;
      crewTag = '🎯 ดวลจุดโทษ 12 หลา';
      break;
    case 'goal_deflect':
      baseDrama = 74;
      title = `💫 บอลแฉลบเปลี่ยนทางเข้า! ${actorShort} ซัดตุงตาข่าย`;
      crewTag = '💫 บอลแฉลบเปลี่ยนทาง';
      break;
    case 'goal_og':
      baseDrama = 72;
      title = `🤦 จังหวะโชคร้าย! ${actorShort} สกัดพลาดเข้าประตูตัวเอง`;
      crewTag = '🤦 จังหวะสกัดพลาดเข้าประตูตัวเอง';
      break;
    case 'super_save':
      baseDrama = 80;
      title = `🧤 ซูเปอร์เซฟระดับโลก! ${actorShort} บินปัดสุดปลายมือ`;
      crewTag = '🧤 เซฟสำคัญของนายด่าน';
      break;
    case 'woodwork':
      baseDrama = 77;
      title = `🥅 หวิดเป็นประตู! ${actorShort} ซัดบอลสั่นเสา/คาน`;
      crewTag = '🥅 จังหวะบอลชนเสา/คาน';
      break;
    default:
      baseDrama = 78;
      title = `⚽ ${actorShort} จบสกอร์เด็ดขาดให้ ${inp.teamName}`;
      crewTag = '⚽ จังหวะต่อบอล & จบสกอร์';
      break;
  }

  if (isLateWinner) {
    baseDrama += 12;
    title = `🔥⚽ นาทีบาป ${inp.minute}'! ${actorShort} ซัดประตูชัย!`;
  } else if (isEqualizer && inp.minute >= 70) {
    baseDrama += 7;
  }
  if (inp.isDerby) baseDrama += 4;
  if ((inp.shotDistM ?? 0) >= 24 && inp.kind !== 'super_save') baseDrama += 4;

  const telemetryParts: string[] = [];
  if (inp.shotDistM && inp.shotDistM > 0) telemetryParts.push(`📏 ระยะยิง ~${inp.shotDistM} ม.`);
  if (inp.shotSpeedKmh && inp.shotSpeedKmh > 0) telemetryParts.push(`⚡ ${inp.shotSpeedKmh} กม./ชม.`);
  if (assistShort && inp.kind !== 'goal_og' && inp.kind !== 'super_save') {
    telemetryParts.push(`👟 แอสซิสต์: ${assistShort}`);
  }

  const subtitle =
    telemetryParts.length > 0
      ? telemetryParts.join(' · ')
      : inp.kind === 'super_save'
        ? `${inp.teamName} ป้องกันประตูสำคัญ`
        : `${inp.teamName} vs ${inp.oppTeamName}`;

  const commentary =
    inp.kind === 'super_save'
      ? `น.${inp.minute}': ${inp.actorName} (${inp.teamName}) ${inp.finishVerb || 'พุ่งปัดปลายมือช่วยทีมรอดพ้นการเสียประตูอย่างเหลือเชื่อ'}${inp.victimName ? ` จากลูกยิงของ ${inp.victimName}` : ''}`
      : inp.kind === 'woodwork'
        ? `น.${inp.minute}': ${inp.actorName} (${inp.teamName}) ${inp.finishVerb || 'ซัดบอลพุ่งชนเสา/คานอย่างจัง ท่ามกลางเสียงฮือฮาทั้งสนาม'}`
        : inp.kind === 'goal_og'
          ? `น.${inp.minute}': ${inp.actorName} สกัดบอลผิดเหลี่ยมเปลี่ยนทางเข้าประตู ทำให้ ${inp.teamName} ได้ประตูสำคัญ`
          : `น.${inp.minute}': ${inp.actorName} (${inp.teamName}) ${inp.finishVerb || 'ส่งบอลตุงตาข่ายอย่างสวยงาม!'}${inp.assisterName ? ` จากจังหวะจ่ายให้ของ ${inp.assisterName}` : ''}`;

  return {
    title,
    subtitle,
    commentary,
    crewTag,
    dramaScore: Math.round(clamp(baseDrama, 50, 115))
  };
};

export interface FinalizeClipParams {
  id: string;
  seq: number;
  minute: number;
  kind: MatchHighlightKind;
  side: 'H' | 'A';
  attRight: boolean;
  title: string;
  subtitle: string;
  crewTag: string;
  commentary: string;
  actorName: string;
  assisterName?: string;
  victimName?: string;
  scoreBefore: string;
  scoreAfter: string;
  dramaScore: number;
  shotDistM?: number;
  shotSpeedKmh?: number;
  secondHalf?: boolean;
  celebratePose?: GoalCelebrationStyle;
  matchEnv?: MatchEnvironment;
  preSamples: RollingHighlightSample[];
  postSamples: RollingHighlightSample[];
}

export const finalizeHighlightClipFromSamples = (params: FinalizeClipParams): MatchHighlightClip => {
  const combined = [...params.preSamples, ...params.postSamples];
  if (combined.length === 0) {
    return {
      id: params.id,
      seq: params.seq,
      minute: params.minute,
      kind: params.kind,
      side: params.side,
      attRight: params.attRight,
      title: params.title,
      subtitle: params.subtitle,
      crewTag: params.crewTag,
      commentary: params.commentary,
      actorName: params.actorName,
      assisterName: params.assisterName,
      victimName: params.victimName,
      scoreBefore: params.scoreBefore,
      scoreAfter: params.scoreAfter,
      dramaScore: params.dramaScore,
      shotDistM: params.shotDistM,
      shotSpeedKmh: params.shotSpeedKmh,
      peakT: 0.65,
      secondHalf: params.secondHalf,
      ...(params.celebratePose ? { celebratePose: params.celebratePose } : {}),
      matchEnv: params.matchEnv ? { ...params.matchEnv, puddles: params.matchEnv.puddles?.slice(0, 4) } : undefined,
      actors: [],
      frames: []
    };
  }

  const pickIndices = (len: number, maxCount: number, alwaysLast: boolean): number[] => {
    if (len <= maxCount) return Array.from({ length: len }, (_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < maxCount; i++) {
      const idx = i === maxCount - 1 && alwaysLast ? len - 1 : Math.round((i / (maxCount - 1)) * (len - 1));
      if (!out.includes(idx)) out.push(idx);
    }
    return out;
  };

  const preLen = params.preSamples.length;
  const isGoal = params.kind.startsWith('goal_');
  const preIndices = pickIndices(preLen, isGoal ? 9 : 10, true);
  const postIndices = pickIndices(params.postSamples.length, isGoal ? 7 : 6, true).map((idx) => preLen + idx);
  const chosenIndices = [...preIndices, ...postIndices];

  const chosenSamples = chosenIndices.map((idx) => combined[idx]);
  const climaxSampleIdx = Math.max(0, preIndices.length - 1);

  const actorMap = new Map<string, number>();
  const actors: MatchHighlightActorMeta[] = [];

  const getActorIdx = (ag: SampledAgentFrame): number => {
    const key = `${ag.s}:${ag.id}`;
    const existing = actorMap.get(key);
    if (existing !== undefined) return existing;
    const idx = actors.length;
    actorMap.set(key, idx);
    actors.push({
      id: ag.id,
      sn: ag.sn,
      s: ag.s,
      no: ag.no,
      ro: ag.ro,
      ...(ag.gk ? { gk: 1 } : {}),
      ...(ag.vis ? { vis: ag.vis } : {}),
      ...(ag.ov ? { ov: ag.ov } : {}),
      ...(ag.cap ? { cap: 1 } : {}),
      ...(ag.me ? { me: 1 } : {}),
      ...(ag.yc ? { yc: 1 } : {}),
      ...(ag.sub ? { sub: 1 } : {}),
      ...(ag.fit !== undefined ? { fit: ag.fit } : {})
    });
    return idx;
  };

  const totalChosen = chosenSamples.length;
  const minTs = chosenSamples[0].ts;
  const maxTs = chosenSamples[totalChosen - 1].ts;
  const tsSpan = maxTs - minTs;

  const frames: MatchHighlightFrame[] = chosenSamples.map((smp, i) => {
    const t =
      totalChosen === 1
        ? 0.5
        : tsSpan > 0.15
          ? r3((smp.ts - minTs) / tsSpan)
          : r3(i / (totalChosen - 1));
    let carIdx: number | undefined;
    const p: [number, number, number, number, number?, number?, number?][] = smp.agents.map((ag) => {
      const idx = getActorIdx(ag);
      if (smp.carId && ag.id === smp.carId) carIdx = idx;
      if (ag.act && ag.ap !== undefined) return [idx, ag.x, ag.y, ag.f, ag.act, ag.dd || 0, ag.ap];
      if (ag.act && ag.dd) return [idx, ag.x, ag.y, ag.f, ag.act, ag.dd];
      if (ag.act) return [idx, ag.x, ag.y, ag.f, ag.act];
      return [idx, ag.x, ag.y, ag.f];
    });
    return {
      t,
      bx: smp.bx,
      by: smp.by,
      bz: smp.bz,
      ...(smp.shot ? { shot: 1 } : {}),
      ...(smp.style ? { style: smp.style } : {}),
      ...(carIdx !== undefined ? { car: carIdx } : {}),
      ...(smp.ripL > 0.04 ? { ripL: smp.ripL } : {}),
      ...(smp.ripR > 0.04 ? { ripR: smp.ripR } : {}),
      p
    };
  });

  // Ensure monotonic strictly increasing t
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].t <= frames[i - 1].t) {
      frames[i].t = r3(Math.min(1, frames[i - 1].t + 0.02));
    }
  }
  if (frames.length > 0) {
    frames[0].t = 0;
    frames[frames.length - 1].t = 1;
  }

  const peakT = frames[climaxSampleIdx]?.t ?? 0.65;

  return {
    id: params.id,
    seq: params.seq,
    minute: params.minute,
    kind: params.kind,
    side: params.side,
    attRight: params.attRight,
    title: params.title,
    subtitle: params.subtitle,
    crewTag: params.crewTag,
    commentary: params.commentary,
    actorName: params.actorName,
    assisterName: params.assisterName,
    victimName: params.victimName,
    scoreBefore: params.scoreBefore,
    scoreAfter: params.scoreAfter,
    dramaScore: params.dramaScore,
    shotDistM: params.shotDistM,
    shotSpeedKmh: params.shotSpeedKmh,
    peakT,
    secondHalf: params.secondHalf,
    ...(params.celebratePose ? { celebratePose: params.celebratePose } : {}),
    matchEnv: params.matchEnv
      ? {
          season: params.matchEnv.season,
          timeOfDay: params.matchEnv.timeOfDay,
          sunAngle: params.matchEnv.sunAngle,
          turfGrade: params.matchEnv.turfGrade,
          turfCond: params.matchEnv.turfCond,
          grassLength: params.matchEnv.grassLength,
          dirtMix: params.matchEnv.dirtMix,
          pitchSeed: params.matchEnv.pitchSeed,
          stadiumStyle: params.matchEnv.stadiumStyle,
          puddles: params.matchEnv.puddles?.slice(0, 4) || []
        }
      : undefined,
    actors,
    frames
  };
};

export interface TeamTacticParams {
  tac: 'X' | 'A' | 'B' | 'D' | 'Z';
  press: number;
  pass: number;
  tempo: number;
  width: number;
}

export interface SimulateRealtimeHighlightInput {
  id: string;
  seq: number;
  minute: number;
  kind?: MatchHighlightKind;
  side: 'H' | 'A';
  attRight: boolean;
  secondHalf: boolean;
  homeTeam: Team;
  awayTeam: Team;
  homeLu: string[];
  awayLu: string[];
  homeTactics?: TeamTacticParams;
  awayTactics?: TeamTacticParams;
  scorerName: string;
  assisterName?: string;
  victimName?: string;
  finishVerb: string;
  shotStyle?: string;
  shotDistM?: number;
  shotSpeedKmh?: number;
  isOwnGoal?: boolean;
  celebratePose?: GoalCelebrationStyle;
  scoreBefore: string;
  scoreAfter: string;
  scoreAfterGh: number;
  scoreAfterGa: number;
  isDerby?: boolean;
  careerP?: PlayerCareerProfile | null;
  matchEnv?: MatchEnvironment;
}

export type SynthesizeHighlightInput = SimulateRealtimeHighlightInput;

interface SimAgent {
  id: string;
  sn: string;
  s: 'H' | 'A';
  no: number;
  ro: SubRole;
  pos: 'GK' | 'DF' | 'MF' | 'FW';
  gk?: 1;
  vis: number[];
  ov?: number;
  cap?: 1;
  me?: 1;
  fit: number;
  slotX: number;
  slotY: number;
  slotIndex: number;
  spd: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  facing: number;
  act?: number;
  dd?: number;
  ap?: number;
  actTimer: number;
  actMax: number;
}

const interpAngle = (a0: number, a1: number, t: number): number => {
  let diff = a1 - a0;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a0 + diff * t;
};

const getTacticParams = (tm: Team, override?: TeamTacticParams): TeamTacticParams => ({
  tac: override?.tac || tm.tac || 'B',
  press: override?.press ?? tm.press ?? 1,
  pass: override?.pass ?? tm.pass ?? 1,
  tempo: override?.tempo ?? tm.tempo ?? 1,
  width: override?.width ?? tm.wid ?? 1
});

export const simulateRealtimeHighlightClip = (inp: SimulateRealtimeHighlightInput): MatchHighlightClip => {
  const isPenalty = inp.finishVerb.includes('จุดโทษ') || inp.shotStyle === 'penalty' || inp.shotStyle === 'panenka';
  const isFreekick = inp.finishVerb.includes('ฟรีคิก') || inp.shotStyle === 'freekick';
  const kind: MatchHighlightKind =
    inp.kind ||
    detectGoalHighlightKind({
      finishVerb: inp.finishVerb,
      shotStyle: inp.shotStyle,
      flightType: isPenalty ? 'penalty' : isFreekick ? 'freekick' : 'shot',
      isOwnGoal: inp.isOwnGoal,
      shotDistM: inp.shotDistM ?? (isFreekick ? 23 : 16)
    });

  const isGoal = kind.startsWith('goal_');
  const isSuperSave = kind === 'super_save';
  const isWoodwork = kind === 'woodwork';

  const shotDistM =
    inp.shotDistM ??
    (kind === 'goal_penalty'
      ? 11
      : kind === 'goal_freekick'
        ? 23
        : kind === 'goal_screamer'
          ? 25
          : kind === 'goal_header'
            ? 9
            : kind === 'goal_og'
              ? 6
              : 15);
  const shotSpeedKmh =
    inp.shotSpeedKmh ??
    (kind === 'goal_screamer'
      ? 114
      : kind === 'goal_acrobat'
        ? 102
        : kind === 'goal_freekick'
          ? 98
          : kind === 'goal_curler'
            ? 91
            : kind === 'goal_penalty'
              ? 104
              : 89);

  // For super_save, inp.side is the defending/GK team; attacking side is opposite
  const attSide: 'H' | 'A' = isSuperSave ? (inp.side === 'H' ? 'A' : 'H') : inp.side;
  const defSide: 'H' | 'A' = attSide === 'H' ? 'A' : 'H';
  const attTeam = attSide === 'H' ? inp.homeTeam : inp.awayTeam;
  const defTeam = defSide === 'H' ? inp.homeTeam : inp.awayTeam;
  const attCfg = getTacticParams(attTeam, attSide === 'H' ? inp.homeTactics : inp.awayTactics);
  const defCfg = getTacticParams(defTeam, defSide === 'H' ? inp.homeTactics : inp.awayTactics);

  const dir = inp.attRight ? 1 : -1;
  const goalLineX = inp.attRight ? 100 : 0;
  const goalBackX = inp.attRight ? 101.35 : -1.35;
  const postWoodX = inp.attRight ? 99.65 : 0.35;

  const isPostOrBarIn =
    kind === 'goal_woodwork_in' || inp.shotStyle === 'post_in' || inp.shotStyle === 'bar_in';
  const isBarIn = inp.shotStyle === 'bar_in' || inp.finishVerb.includes('คาน');
  const isFumbleIn = inp.shotStyle === 'gk_fumble_in' || inp.finishVerb.includes('ปัดไม่ออก');
  const isDeflect = kind === 'goal_deflect' || inp.shotStyle === 'deflected';

  // Pick realistic shooting spot & target corner
  const shootSpotX = isPenalty
    ? inp.attRight
      ? 88.5
      : 11.5
    : isFreekick
      ? clamp(inp.attRight ? 100 - clamp(shotDistM, 19, 28) * 0.92 : clamp(shotDistM, 19, 28) * 0.92, 16, 84)
      : kind === 'goal_og'
        ? clamp(inp.attRight ? 92.5 : 7.5, 6, 94)
        : clamp(inp.attRight ? 100 - shotDistM * 0.92 : shotDistM * 0.92, 10, 90);

  const laneSign = ((inp.minute + inp.seq) % 2 === 0 ? -1 : 1);
  const shootSpotY = isPenalty
    ? 50
    : isFreekick
      ? clamp(50 + laneSign * (7 + ((inp.seq * 3) % 7)), 34, 66)
      : kind === 'goal_curler'
        ? clamp(50 + laneSign * 14, 30, 70)
        : kind === 'goal_header' || kind === 'goal_acrobat'
          ? clamp(50 + laneSign * 4.5, 42, 58)
          : clamp(50 + laneSign * (5 + ((inp.minute * 3) % 9)), 33, 67);

  const cornerSign = (inp.minute + inp.seq) % 2 === 0 ? 1 : -1;
  const targetY = isPostOrBarIn
    ? isBarIn
      ? clamp(50 + cornerSign * 3.8, 44.5, 55.5)
      : cornerSign < 0
        ? 42.2
        : 57.8
    : isWoodwork
      ? cornerSign < 0
        ? 42.0
        : 58.0
      : isPenalty
        ? clamp(50 + cornerSign * 5.2, 43.2, 56.8)
        : kind === 'goal_curler'
          ? clamp(50 - laneSign * 6.4, 42.6, 57.4)
          : clamp(50 + cornerSign * 5.6, 42.8, 57.2);

  // Build 22 agents from real formations & attributes
  const buildAgents = (tm: Team, s: 'H' | 'A', lu: string[]): SimAgent[] => {
    const slots = getFormationSlots(tm);
    const sideAttRight = s === attSide ? inp.attRight : !inp.attRight;
    return lu.map((n, i) => {
      const pl: Player | undefined = tm.sq.find((q) => q.n === n) || tm.sq[i];
      const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
      const pos = (slot.pos || pl?.pos || 'MF') as 'GK' | 'DF' | 'MF' | 'FW';
      const isGk = pos === 'GK' || pl?.pos === 'GK';
      const spdAttr = pl ? DT(pl, inp.careerP).d.spd : 64;
      const spd = 17.5 + (spdAttr - 55) * 0.22;
      const normX = clamp(100 - slot.y, 4.5, 95.5);
      const baseX = sideAttRight ? normX : 100 - normX;
      const baseY = sideAttRight ? clamp(slot.x, 6, 94) : clamp(100 - slot.x, 6, 94);
      return {
        id: n,
        sn: n.split(' ')[0] || n,
        s,
        no: pl ? getShirtNo(tm, pl) : i + 1,
        ro: (slot.sp || pl?.ro || 'CM') as SubRole,
        pos,
        ...(isGk ? { gk: 1 as const } : {}),
        vis: pl ? visOf(pl, inp.careerP) : [2, 0, 0, 0, 0, i + 1, 0],
        ov: pl?.ov ? Math.round(pl.ov) : undefined,
        cap: tm.cap && tm.cap === n ? (1 as const) : undefined,
        me: pl?.me || (inp.careerP?.name && inp.careerP.name === n) ? (1 as const) : undefined,
        fit: pl?.fit ? Math.round(pl.fit) : 92,
        slotX: slot.x,
        slotY: slot.y,
        slotIndex: i,
        spd,
        x: baseX,
        y: baseY,
        vx: 0,
        vy: 0,
        tx: baseX,
        ty: baseY,
        facing: sideAttRight ? 0 : Math.PI,
        actTimer: 0,
        actMax: 0.4
      };
    });
  };

  const hAgents = buildAgents(inp.homeTeam, 'H', inp.homeLu);
  const aAgents = buildAgents(inp.awayTeam, 'A', inp.awayLu);
  const agents = [...hAgents, ...aAgents];

  // Identify key actors
  const shooterName = isSuperSave ? inp.victimName : inp.scorerName;
  const shooter =
    (shooterName ? agents.find((a) => a.s === attSide && a.id === shooterName) : undefined) ||
    agents.find((a) => a.s === attSide && a.pos === 'FW') ||
    agents.find((a) => a.s === attSide && !a.gk) ||
    agents[0];

  const ogCulprit =
    kind === 'goal_og'
      ? agents.find((a) => a.s === defSide && a.id === inp.scorerName) ||
        agents.find((a) => a.s === defSide && !a.gk)
      : undefined;

  const assister =
    !isPenalty && !isFreekick && kind !== 'goal_og'
      ? (inp.assisterName ? agents.find((a) => a.s === attSide && a.id === inp.assisterName && a.id !== shooter.id) : undefined) ||
        agents
          .filter((a) => a.s === attSide && !a.gk && a.id !== shooter.id)
          .sort((u, v) => (v.pos === 'MF' ? 2 : v.pos === 'FW' ? 1 : 0) - (u.pos === 'MF' ? 2 : u.pos === 'FW' ? 1 : 0))[0]
      : undefined;

  const buildupActor =
    !isPenalty && !isFreekick
      ? agents
          .filter((a) => a.s === attSide && !a.gk && a.id !== shooter.id && a.id !== assister?.id)
          .sort((u, v) => (v.pos === 'MF' ? 3 : v.pos === 'DF' ? 2 : 1) - (u.pos === 'MF' ? 3 : u.pos === 'DF' ? 2 : 1))[0] ||
        assister ||
        shooter
      : shooter;

  const defGk =
    (isSuperSave
      ? agents.find((a) => a.s === defSide && a.id === inp.scorerName)
      : undefined) || agents.find((a) => a.s === defSide && a.gk === 1);

  const defOutfield = agents
    .filter((a) => a.s === defSide && !a.gk && a.id !== ogCulprit?.id)
    .sort((u, v) => (u.pos === 'DF' ? 0 : 1) - (v.pos === 'DF' ? 0 : 1));
  const nearDef = defOutfield[0];
  const wallDefs = isFreekick ? defOutfield.slice(0, 3) : [];

  // Buildup geometry & phase timing (real-time seconds)
  const originX = clamp(shootSpotX - dir * (isPenalty || isFreekick ? 0 : 28), 16, 84);
  const originY = clamp(50 - laneSign * 13, 18, 82);
  const assistSpotX = clamp(shootSpotX - dir * (kind === 'goal_header' || kind === 'goal_acrobat' ? 10 : 16), 14, 86);
  const assistSpotY = clamp(
    kind === 'goal_header' || kind === 'goal_acrobat'
      ? laneSign < 0
        ? 16
        : 84
      : shootSpotY + (shootSpotY < 50 ? 18 : -18),
    12,
    88
  );

  const hasTwoPasses = !isPenalty && !isFreekick && Boolean(assister && buildupActor.id !== assister.id);
  const tPass1 = isPenalty || isFreekick ? 99 : hasTwoPasses ? 0.52 : 99;
  const tArrive1 = isPenalty || isFreekick ? 99 : hasTwoPasses ? 1.15 : 99;
  const tPass2 = isPenalty || isFreekick ? 99 : hasTwoPasses ? 1.50 : 0.72;
  const tShot = isPenalty ? 1.15 : isFreekick ? 1.25 : 2.35;
  const flightDur = isPenalty
    ? 0.42
    : isFreekick
      ? 0.62
      : clamp(Math.hypot(goalLineX - shootSpotX, targetY - shootSpotY) / 48, 0.36, 0.64);
  const tArriveGoal = tShot + flightDur;
  const bounceDur = isPostOrBarIn ? 0.24 : isDeflect ? 0.24 : isFumbleIn ? 0.25 : 0;
  const tImpact = tArriveGoal + bounceDur;
  const totalDur = isGoal ? tImpact + 2.05 : tArriveGoal + 1.45;

  // Position all 22 players realistically at t=0 based on origin ball position & each team's live tactics
  const shiftLineX = (ag: SimAgent, ballX: number, inPoss: boolean, cfg: TeamTacticParams) => {
    const aRight = ag.s === attSide ? inp.attRight : !inp.attRight;
    const normSlotX = clamp(100 - ag.slotY, 10, 88);
    const ballNorm = aRight ? ballX : 100 - ballX;
    const tacPush = cfg.tac === 'X' ? 11 : cfg.tac === 'A' ? 6 : cfg.tac === 'D' ? -7 : cfg.tac === 'Z' ? -11 : 0;
    const pressPush = !inPoss ? (cfg.press === 2 ? 7 : cfg.press === 0 ? -6 : 0) : 0;
    const lineShift = clamp((ballNorm - 50) * 0.48 + tacPush + pressPush + (inPoss ? 6 : -5), -22, 26);
    const nx = ag.gk ? 3.0 : clamp(normSlotX + lineShift, 11, 90);
    const rawY = aRight ? ag.slotX : 100 - ag.slotX;
    const widthMul = cfg.width === 2 ? 1.12 : cfg.width === 0 ? 0.84 : 1.0;
    const ny = ag.gk ? 50 : clamp(50 + (rawY - 50) * widthMul + (50 - originY) * -0.14, 7, 93);
    return { x: aRight ? nx : 100 - nx, y: ny };
  };

  agents.forEach((ag) => {
    const init = shiftLineX(ag, originX, ag.s === attSide, ag.s === attSide ? attCfg : defCfg);
    ag.x = init.x;
    ag.y = init.y;
    ag.tx = init.x;
    ag.ty = init.y;
  });

  if (isPenalty) {
    agents.forEach((ag) => {
      if (ag.gk) {
        ag.x = ag.s === defSide ? (inp.attRight ? 98.0 : 2.0) : inp.attRight ? 4.5 : 95.5;
        ag.y = 50;
      } else if (ag.id === shooter.id) {
        ag.x = clamp(shootSpotX - dir * 4.2, 4, 96);
        ag.y = 50;
      } else {
        const edgeX = inp.attRight ? 76.5 - (ag.slotIndex % 3) * 2.3 : 23.5 + (ag.slotIndex % 3) * 2.3;
        ag.x = edgeX;
        ag.y = clamp(24 + ((ag.slotIndex * 5.8) % 52), 18, 82);
      }
      ag.tx = ag.x;
      ag.ty = ag.y;
    });
  } else if (isFreekick) {
    const wallDist = 11.5;
    const angToGoal = Math.atan2(50 - shootSpotY, goalLineX - shootSpotX);
    const perpX = -Math.sin(angToGoal);
    const perpY = Math.cos(angToGoal);
    wallDefs.forEach((wd, idx) => {
      const off = (idx - (wallDefs.length - 1) / 2) * 2.25;
      wd.x = clamp(shootSpotX + Math.cos(angToGoal) * wallDist + perpX * off, 6, 94);
      wd.y = clamp(shootSpotY + Math.sin(angToGoal) * wallDist + perpY * off, 8, 92);
      wd.tx = wd.x;
      wd.ty = wd.y;
      wd.act = HL_ACT.WALL;
    });
    shooter.x = clamp(shootSpotX - dir * 3.4, 4, 96);
    shooter.y = clamp(shootSpotY + (shootSpotY < 50 ? -1.8 : 1.8), 6, 94);
    if (defGk) {
      defGk.x = inp.attRight ? 97.6 : 2.4;
      defGk.y = clamp(50 + (shootSpotY < 50 ? 2.4 : -2.4), 45, 55);
    }
  } else {
    // Place key buildup actors at starting play positions
    const startCarrier = hasTwoPasses ? buildupActor : assister || shooter;
    startCarrier.x = originX;
    startCarrier.y = originY;
    if (assister && assister.id !== startCarrier.id) {
      assister.x = clamp(assistSpotX - dir * 7, 10, 90);
      assister.y = clamp(assistSpotY + (assistSpotY < 50 ? 3 : -3), 10, 90);
    }
    if (shooter.id !== startCarrier.id) {
      shooter.x = clamp(shootSpotX - dir * 13, 12, 88);
      shooter.y = clamp(shootSpotY + (shootSpotY < 50 ? 5 : -5), 14, 86);
    }
    if (ogCulprit) {
      ogCulprit.x = clamp(shootSpotX + dir * 2.2, 6, 94);
      ogCulprit.y = clamp(shootSpotY + 2.0, 22, 78);
    }
    if (nearDef) {
      nearDef.x = clamp(shootSpotX + dir * 5.5, 8, 92);
      nearDef.y = clamp(shootSpotY + (shootSpotY < 50 ? 4 : -4), 16, 84);
    }
    if (defGk) {
      defGk.x = inp.attRight ? 97.4 : 2.6;
      defGk.y = clamp(50 + (originY - 50) * 0.14, 46, 54);
    }
  }

  // Celebration style & anchor (only used AFTER tImpact!)
  const celebPose: GoalCelebrationStyle =
    inp.celebratePose ||
    (kind === 'goal_og'
      ? 'own_goal_modest'
      : kind === 'goal_acrobat'
        ? 'backflip'
        : kind === 'goal_screamer'
          ? 'siu_jump'
          : kind === 'goal_curler'
            ? 'bow_crowd'
            : kind === 'goal_freekick'
              ? 'calm_shush'
              : 'knee_slide');
  const celebAnchorX = clamp(
    celebPose === 'calm_shush' ? (inp.attRight ? 83 : 17) : inp.attRight ? 90.5 : 9.5,
    8,
    92
  );
  const celebAnchorY = shootSpotY < 50 ? 12.5 : 87.5;
  const celebRunners = agents
    .filter((a) => a.s === attSide && !a.gk && a.id !== shooter.id && a.id !== assister?.id)
    .sort((u, v) => Math.hypot(u.x - shootSpotX, u.y - shootSpotY) - Math.hypot(v.x - shootSpotX, v.y - shootSpotY))
    .slice(0, 4);

  const preSamples: RollingHighlightSample[] = [];
  const postSamples: RollingHighlightSample[] = [];
  const dt = 0.05;
  const sampleEvery = 0.14;
  let lastSampleT = -1;

  let bx = isPenalty || isFreekick ? shootSpotX : (hasTwoPasses ? buildupActor : assister || shooter).x;
  let by = isPenalty || isFreekick ? shootSpotY : (hasTwoPasses ? buildupActor : assister || shooter).y;
  let bz = 0;
  let ripL = 0;
  let ripR = 0;
  let carId: string | undefined = isPenalty || isFreekick ? undefined : (hasTwoPasses ? buildupActor : assister || shooter).id;
  let inShot = false;
  let shotStyleTag: string | undefined;
  let goalCrossedLogged = false;
  let pass1Triggered = false;
  let pass2Triggered = false;
  let shotTriggered = false;
  let diveTriggered = false;
  let deflectMidX = (shootSpotX + goalLineX) * 0.55;
  let deflectMidY = (shootSpotY + targetY) * 0.5;
  let bounceStartX = postWoodX;
  let bounceStartY = targetY;

  const triggerAction = (ag: SimAgent, act: number, maxSec: number, dd?: number) => {
    ag.act = act;
    ag.dd = dd;
    ag.actTimer = maxSec;
    ag.actMax = maxSec;
    ag.ap = 8;
  };

  const strikeAct =
    kind === 'goal_acrobat'
      ? inp.shotStyle === 'volley'
        ? HL_ACT.VOLLEY
        : HL_ACT.BICYCLE
      : kind === 'goal_header'
        ? inp.shotStyle === 'diving_header'
          ? HL_ACT.DIVING_HEADER
          : HL_ACT.HEADER
        : kind === 'goal_curler' || kind === 'goal_freekick'
          ? HL_ACT.SHOOT_FINESSE
          : kind === 'goal_screamer'
            ? HL_ACT.SHOOT_POWER
            : inp.shotStyle === 'chip' || inp.shotStyle === 'panenka'
              ? HL_ACT.SHOOT_CHIP
              : HL_ACT.KICK;

  const shotStyleOut =
    inp.shotStyle ||
    (kind === 'goal_curler'
      ? 'curler'
      : kind === 'goal_acrobat'
        ? 'bicycle'
        : kind === 'goal_screamer'
          ? 'screamer'
          : kind === 'goal_header'
            ? 'header'
            : kind === 'goal_freekick'
              ? 'freekick'
              : kind === 'goal_penalty'
                ? 'penalty'
                : kind === 'goal_deflect'
                  ? 'deflected'
                  : 'shot');

  const steps = Math.ceil(totalDur / dt);
  for (let sIdx = 0; sIdx <= steps; sIdx++) {
    const t = r3(sIdx * dt);
    const celebratingNow = isGoal && t > tImpact + 0.03;

    // 1. Update ball & discrete play triggers
    if (isPenalty) {
      if (t < tShot) {
        bx = shootSpotX;
        by = shootSpotY;
        bz = 0;
        carId = undefined;
      } else {
        if (!shotTriggered) {
          shotTriggered = true;
          triggerAction(shooter, strikeAct, 0.45);
        }
        if (t <= tArriveGoal) {
          inShot = true;
          shotStyleTag = shotStyleOut;
          const sp = clamp((t - tShot) / flightDur, 0, 1);
          bx = shootSpotX + ((isSuperSave ? (inp.attRight ? 97.6 : 2.4) : isWoodwork ? postWoodX : goalBackX) - shootSpotX) * sp;
          by = shootSpotY + (targetY - shootSpotY) * sp + Math.sin(sp * Math.PI) * 0.8;
          bz = Math.sin(sp * Math.PI) * 2.2;
        } else if (isSuperSave) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          const saveX = inp.attRight ? 97.6 : 2.4;
          bx = saveX - dir * bp * 9.5;
          by = targetY + (targetY < 50 ? -10 : 10) * bp;
          bz = Math.sin(bp * Math.PI) * 3.4;
        } else if (isWoodwork) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          bx = postWoodX - dir * bp * 11;
          by = targetY + (targetY < 50 ? -9 : 9) * bp;
          bz = Math.sin(bp * Math.PI) * 4.0;
        } else {
          inShot = false;
          bx = goalBackX;
          by = targetY;
          bz = 0.25;
        }
      }
    } else if (isFreekick) {
      if (t < tShot) {
        bx = shootSpotX;
        by = shootSpotY;
        bz = 0;
        carId = undefined;
      } else {
        if (!shotTriggered) {
          shotTriggered = true;
          triggerAction(shooter, strikeAct, 0.5);
        }
        if (t <= tArriveGoal) {
          inShot = true;
          shotStyleTag = shotStyleOut;
          const sp = clamp((t - tShot) / flightDur, 0, 1);
          const fkDestX = isSuperSave ? (inp.attRight ? 97.4 : 2.6) : isWoodwork ? postWoodX : goalBackX;
          bx = shootSpotX + (fkDestX - shootSpotX) * sp;
          by = shootSpotY + (targetY - shootSpotY) * sp + Math.sin(sp * Math.PI) * (-laneSign * 4.2);
          bz = Math.sin(sp * Math.PI) * 4.6;
        } else if (isSuperSave) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          bx = (inp.attRight ? 97.4 : 2.6) - dir * bp * 8.5;
          by = targetY + (targetY < 50 ? -11 : 11) * bp;
          bz = Math.sin(bp * Math.PI) * 3.8;
        } else if (isWoodwork) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          bx = postWoodX - dir * bp * 10;
          by = targetY + (targetY < 50 ? -9 : 9) * bp;
          bz = Math.sin(bp * Math.PI) * 4.4;
        } else {
          inShot = false;
          bx = goalBackX;
          by = targetY;
          bz = 0.25;
        }
      }
    } else {
      // Open play real-time buildup -> pass(es) -> shot -> impact!
      const carrier1 = hasTwoPasses ? buildupActor : assister || shooter;
      const carrier2 = assister || shooter;
      if (t < (hasTwoPasses ? tPass1 : tPass2)) {
        carId = carrier1.id;
        bx = clamp(carrier1.x + Math.cos(carrier1.facing) * 1.15, 2, 98);
        by = clamp(carrier1.y + Math.sin(carrier1.facing) * 1.15, 3, 97);
        bz = 0.15;
      } else if (hasTwoPasses && t < tArrive1) {
        if (!pass1Triggered) {
          pass1Triggered = true;
          triggerAction(buildupActor, HL_ACT.KICK, 0.36);
        }
        carId = undefined;
        const pp = clamp((t - tPass1) / (tArrive1 - tPass1), 0, 1);
        bx = buildupActor.x + (assistSpotX - buildupActor.x) * pp;
        by = buildupActor.y + (assistSpotY - buildupActor.y) * pp + Math.sin(pp * Math.PI) * 1.4;
        bz = Math.sin(pp * Math.PI) * 1.5;
      } else if (hasTwoPasses && t < tPass2) {
        carId = carrier2.id;
        bx = clamp(carrier2.x + Math.cos(carrier2.facing) * 1.15, 2, 98);
        by = clamp(carrier2.y + Math.sin(carrier2.facing) * 1.15, 3, 97);
        bz = 0.15;
      } else if (t < tShot) {
        if (!pass2Triggered) {
          pass2Triggered = true;
          const passer = hasTwoPasses ? carrier2 : carrier1;
          if (passer.id !== shooter.id) {
            triggerAction(passer, HL_ACT.SKILL_PASS, 0.38);
          }
        }
        carId = undefined;
        const pStart = tPass2;
        const pFromX = hasTwoPasses ? assistSpotX : carrier1.x;
        const pFromY = hasTwoPasses ? assistSpotY : carrier1.y;
        const pp = clamp((t - pStart) / Math.max(0.15, tShot - pStart), 0, 1);
        bx = pFromX + (shootSpotX - pFromX) * pp;
        by = pFromY + (shootSpotY - pFromY) * pp + Math.sin(pp * Math.PI) * (laneSign * 1.8);
        bz = Math.sin(pp * Math.PI) * (kind === 'goal_header' || kind === 'goal_acrobat' ? 5.0 : 1.6);
      } else {
        if (!shotTriggered) {
          shotTriggered = true;
          const finisher = kind === 'goal_og' && ogCulprit ? ogCulprit : shooter;
          triggerAction(finisher, strikeAct, 0.46);
          if (nearDef && Math.hypot(nearDef.x - finisher.x, nearDef.y - finisher.y) < 9) {
            triggerAction(nearDef, HL_ACT.SLIDE, 0.45);
          }
          if (isDeflect && nearDef) {
            deflectMidX = clamp((shootSpotX + goalLineX) * 0.55, 10, 90);
            deflectMidY = clamp((shootSpotY + targetY) * 0.5, 32, 68);
          }
        }
        carId = undefined;
        if (t <= tArriveGoal) {
          inShot = true;
          shotStyleTag = shotStyleOut;
          const sp = clamp((t - tShot) / flightDur, 0, 1);
          const destX = isSuperSave
            ? inp.attRight
              ? 97.2
              : 2.8
            : isFumbleIn
              ? inp.attRight
                ? 97.4
                : 2.6
              : isPostOrBarIn || isWoodwork
                ? postWoodX
                : isDeflect
                  ? deflectMidX
                  : goalBackX;
          const destY = isDeflect ? deflectMidY : targetY;
          const curveAmt = kind === 'goal_curler' ? -laneSign * 3.8 : Math.sin(sp * Math.PI) * 1.1;
          bx = shootSpotX + (destX - shootSpotX) * sp;
          by = shootSpotY + (destY - shootSpotY) * sp + Math.sin(sp * Math.PI) * curveAmt;
          bz = Math.sin(sp * Math.PI) * (kind === 'goal_screamer' ? 3.2 : isBarIn ? 5.6 : 2.6);
          bounceStartX = destX;
          bounceStartY = destY;
        } else if (isGoal && bounceDur > 0 && t <= tImpact) {
          inShot = true;
          shotStyleTag = isDeflect ? 'deflected' : shotStyleOut;
          const bp = clamp((t - tArriveGoal) / bounceDur, 0, 1);
          bx = bounceStartX + (goalBackX - bounceStartX) * bp;
          by = bounceStartY + (targetY - bounceStartY) * bp;
          bz = isBarIn ? 4.4 * (1 - bp) : Math.sin(bp * Math.PI) * 1.6;
        } else if (isSuperSave) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          bx = bounceStartX - dir * bp * 9.5;
          by = targetY + (targetY < 50 ? -10.5 : 10.5) * bp;
          bz = Math.sin(bp * Math.PI) * 3.6;
        } else if (isWoodwork) {
          inShot = false;
          const bp = clamp((t - tArriveGoal) / 0.55, 0, 1);
          bx = postWoodX - dir * bp * 11.5;
          by = targetY + (targetY < 50 ? -9.5 : 9.5) * bp;
          bz = Math.sin(bp * Math.PI) * 4.2;
        } else {
          inShot = false;
          bx = goalBackX;
          by = targetY;
          bz = 0.22;
        }
      }
    }

    // Net ripple triggers ONLY at exact tImpact when ball crosses into net
    if (isGoal && !goalCrossedLogged && t >= tImpact) {
      goalCrossedLogged = true;
      if (inp.attRight) ripR = 1.0;
      else ripL = 1.0;
    } else {
      ripL = Math.max(0, ripL - 0.85 * dt);
      ripR = Math.max(0, ripR - 0.85 * dt);
    }

    // GK Dive trigger ~40% into shot flight
    const shotElapsed = t - tShot;
    if (!diveTriggered && shotElapsed >= flightDur * 0.38) {
      diveTriggered = true;
      if (defGk) {
        const diveDir = targetY >= defGk.y ? 1 : -1;
        triggerAction(
          defGk,
          isSuperSave ? HL_ACT.SUPERSAVE : HL_ACT.GK_DIVE,
          isSuperSave ? 0.85 : 0.78,
          diveDir
        );
      }
    }

    // 2. Update all 22 players' tactical targets dynamically in real time
    const celebProg = celebratingNow ? clamp((t - tImpact) / Math.max(0.5, totalDur - tImpact), 0, 1) : 0;
    agents.forEach((ag) => {
      if (ag.actTimer > 0) {
        ag.actTimer = Math.max(0, ag.actTimer - dt);
        ag.ap = Math.round(clamp(1 - ag.actTimer / Math.max(0.15, ag.actMax), 0, 1) * 100);
        if (ag.actTimer <= 0 && ag.act !== HL_ACT.WALL && ag.act !== HL_ACT.CELEBRATE) {
          ag.act = undefined;
          ag.dd = undefined;
          ag.ap = undefined;
        }
      }

      if (celebratingNow) {
        if (ag.s === attSide) {
          if (ag.id === shooter.id && kind !== 'goal_og') {
            ag.tx = clamp(celebAnchorX + (celebPose === 'knee_slide' ? dir * celebProg * 4.2 : 0), 6, 94);
            ag.ty = clamp(celebAnchorY, 8, 92);
            ag.act = HL_ACT.CELEBRATE;
            ag.dd = 1;
            ag.ap = Math.round(celebProg * 100);
          } else if (assister && ag.id === assister.id) {
            ag.tx = clamp(celebAnchorX - dir * 3.0, 7, 93);
            ag.ty = clamp(celebAnchorY + (celebAnchorY < 50 ? 3.2 : -3.2), 8, 92);
            ag.act = HL_ACT.CELEBRATE;
            ag.dd = 2;
            ag.ap = Math.round(celebProg * 100);
          } else if (!ag.gk && celebRunners.some((r) => r.id === ag.id)) {
            const rank = celebRunners.findIndex((r) => r.id === ag.id);
            const ang = (inp.attRight ? Math.PI : 0) + (rank - 1.5) * 0.55;
            ag.tx = clamp(celebAnchorX + Math.cos(ang) * 4.8, 7, 93);
            ag.ty = clamp(celebAnchorY + Math.sin(ang) * 4.8, 8, 92);
            ag.act = HL_ACT.CELEBRATE;
            ag.dd = 3;
            ag.ap = Math.round(celebProg * 100);
          } else if (!ag.gk) {
            ag.tx = ag.x;
            ag.ty = ag.y;
            ag.act = HL_ACT.CELEBRATE;
            ag.dd = 3;
            ag.ap = Math.round(celebProg * 100);
          }
        } else {
          // Conceding team slows / halts dejectedly
          if (kind === 'goal_og' && ogCulprit && ag.id === ogCulprit.id) {
            ag.act = HL_ACT.CELEBRATE;
            ag.dd = -1;
            ag.ap = Math.round(celebProg * 100);
          }
          ag.tx = ag.x;
          ag.ty = ag.y;
        }
        return;
      }

      // Active play positioning (real-time tactics & off-ball runs)
      if (isPenalty) {
        if (ag.id === shooter.id && t >= 0.45 && t <= tShot + 0.25) {
          ag.tx = shootSpotX;
          ag.ty = shootSpotY;
        } else if (ag.id === defGk?.id && t >= tShot) {
          ag.tx = inp.attRight ? 98.0 : 2.0;
          ag.ty = clamp(targetY, 43, 57);
        }
        return;
      }

      if (isFreekick) {
        if (ag.id === shooter.id && t >= 0.5 && t <= tShot + 0.25) {
          ag.tx = shootSpotX;
          ag.ty = shootSpotY;
        } else if (ag.id === defGk?.id && t >= tShot) {
          ag.tx = inp.attRight ? 97.6 : 2.4;
          ag.ty = clamp(targetY, 43, 57);
        } else if (!wallDefs.some((w) => w.id === ag.id) && !ag.gk) {
          // Box runners sprint into penalty area during free kick approach
          if (ag.pos === 'FW' || ag.ro === 'CB') {
            ag.tx = clamp(inp.attRight ? 88 + (ag.slotIndex % 3) * 2.2 : 12 - (ag.slotIndex % 3) * 2.2, 6, 94);
            ag.ty = clamp(40 + (ag.slotIndex % 4) * 6.5, 34, 66);
          }
        }
        return;
      }

      if (ag.id === defGk?.id) {
        ag.tx = inp.attRight ? 97.4 : 2.6;
        ag.ty = t >= tShot ? clamp(targetY, 43, 57) : clamp(50 + (by - 50) * 0.18, 45, 55);
        return;
      }

      if (ag.id === shooter.id) {
        if (t < tShot) {
          ag.tx = shootSpotX;
          ag.ty = shootSpotY;
        } else {
          ag.tx = clamp(shootSpotX + dir * 3.5, 5, 95);
          ag.ty = shootSpotY;
        }
        return;
      }

      if (assister && ag.id === assister.id) {
        if (t < tPass2) {
          ag.tx = assistSpotX;
          ag.ty = assistSpotY;
        } else {
          ag.tx = clamp(assistSpotX + dir * 4.0, 5, 95);
          ag.ty = assistSpotY;
        }
        return;
      }

      if (ag.id === buildupActor.id && hasTwoPasses) {
        if (t < tPass1) {
          ag.tx = clamp(originX + dir * 7, 8, 92);
          ag.ty = originY;
        } else {
          ag.tx = clamp(originX + dir * 13, 8, 92);
          ag.ty = originY;
        }
        return;
      }

      if (ag.id === ogCulprit?.id) {
        ag.tx = clamp(shootSpotX + dir * 0.5, 5, 95);
        ag.ty = shootSpotY;
        return;
      }

      if (ag.id === nearDef?.id) {
        // Primary defender actively presses carrier / tracks shooter!
        const chaseX = t < tPass2 && hasTwoPasses ? assistSpotX : shootSpotX;
        const chaseY = t < tPass2 && hasTwoPasses ? assistSpotY : shootSpotY;
        ag.tx = clamp(chaseX + dir * 1.4, 4, 96);
        ag.ty = clamp(chaseY, 6, 94);
        if (!ag.actTimer && Math.hypot(ag.x - bx, ag.y - by) < 11) {
          ag.act = HL_ACT.PRESS;
        } else if (ag.act === HL_ACT.PRESS) {
          ag.act = undefined;
        }
        return;
      }

      // All other players react dynamically to live ball & team tactics
      const baseTgt = shiftLineX(ag, bx, ag.s === attSide, ag.s === attSide ? attCfg : defCfg);
      if (ag.s === attSide && ag.pos === 'FW') {
        // Off-ball striker/winger runs into the box / far post
        ag.tx = clamp(baseTgt.x + dir * 8, 5, 95);
        ag.ty = clamp(baseTgt.y + (baseTgt.y < 50 ? -3 : 3), 8, 92);
      } else {
        ag.tx = baseTgt.x;
        ag.ty = baseTgt.y;
      }
    });

    // 3. Real-time kinematics (acceleration, velocity, position, facing, separation)
    agents.forEach((ag) => {
      const dx = ag.tx - ag.x;
      const dy = ag.ty - ag.y;
      const dist = Math.hypot(dx, dy);
      const isUrgent =
        ag.id === shooter.id ||
        ag.id === assister?.id ||
        ag.id === nearDef?.id ||
        celebratingNow;
      const maxSpd = ag.spd * (isUrgent ? 1.32 : 1.0);
      const stepSpd = Math.min(dist * 6.5, maxSpd);
      const accel = Math.min(1, dt * (isUrgent ? 13 : 8.5));
      if (dist > 0.16) {
        ag.vx += ((dx / dist) * stepSpd - ag.vx) * accel;
        ag.vy += ((dy / dist) * stepSpd - ag.vy) * accel;
      } else {
        const damp = Math.pow(0.05, dt);
        ag.vx *= damp;
        ag.vy *= damp;
      }
      const curSpd = Math.hypot(ag.vx, ag.vy);
      if (curSpd > 0.1) {
        ag.x = clamp(ag.x + ag.vx * dt, ag.gk ? 1.6 : 3, ag.gk ? 98.4 : 97);
        ag.y = clamp(ag.y + ag.vy * dt, 4, 96);
      }
      const desiredFacing =
        dist > 0.45 && curSpd > 1.5
          ? Math.atan2(ag.vy, ag.vx)
          : Math.atan2(by - ag.y, bx - ag.x);
      ag.facing = interpAngle(ag.facing, desiredFacing, Math.min(1, dt * 9));
    });

    // Soft body separation so players never stack
    const minSep = celebratingNow ? 1.45 : 1.9;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.act === HL_ACT.WALL || a.act === HL_ACT.GK_DIVE) continue;
      for (let j = i + 1; j < agents.length; j++) {
        const o = agents[j];
        if (o.act === HL_ACT.WALL || o.act === HL_ACT.GK_DIVE) continue;
        const sdx = a.x - o.x;
        const sdy = a.y - o.y;
        const sdSq = sdx * sdx + sdy * sdy;
        if (sdSq > 0.0004 && sdSq < minSep * minSep) {
          const sd = Math.sqrt(sdSq);
          const push = (minSep - sd) * 0.25;
          a.x = clamp(a.x + (sdx / sd) * push, 2.5, 97.5);
          a.y = clamp(a.y + (sdy / sd) * push, 4, 96);
          o.x = clamp(o.x - (sdx / sd) * push, 2.5, 97.5);
          o.y = clamp(o.y - (sdy / sd) * push, 4, 96);
        }
      }
    }

    // 4. Capture sample every ~0.14s (plus guaranteed climax sample right at impactT!)
    const isClimaxTick = isGoal
      ? t >= tImpact && t - dt < tImpact
      : t >= tArriveGoal && t - dt < tArriveGoal;
    if (isClimaxTick || t === 0 || t - lastSampleT >= sampleEvery || sIdx === steps) {
      lastSampleT = t;
      const sample: RollingHighlightSample = {
        ts: t,
        bx: r1(bx),
        by: r1(by),
        bz: r1(bz),
        shot: inShot,
        ...(shotStyleTag ? { style: shotStyleTag } : {}),
        ...(carId ? { carId } : {}),
        ripL: r2(ripL),
        ripR: r2(ripR),
        agents: agents.map((ag) => ({
          id: ag.id,
          sn: ag.sn,
          s: ag.s,
          no: ag.no,
          ro: ag.ro,
          ...(ag.gk ? { gk: 1 as const } : {}),
          vis: ag.vis,
          ...(ag.ov ? { ov: ag.ov } : {}),
          ...(ag.cap ? { cap: 1 as const } : {}),
          ...(ag.me ? { me: 1 as const } : {}),
          fit: ag.fit,
          x: r1(ag.x),
          y: r1(ag.y),
          f: r2(ag.facing),
          ...(ag.act ? { act: ag.act } : {}),
          ...(ag.dd ? { dd: ag.dd } : {}),
          ...(ag.ap !== undefined ? { ap: ag.ap } : {})
        }))
      };
      const climaxCutoff = isGoal ? tImpact : tArriveGoal;
      if (t <= climaxCutoff + 0.001) preSamples.push(sample);
      else postSamples.push(sample);
    }
  }

  const edTeam = isSuperSave ? defTeam : attTeam;
  const edOpp = isSuperSave ? attTeam : defTeam;
  const edActor = isSuperSave ? defGk?.id || inp.scorerName : inp.scorerName;
  const edVictim = isSuperSave ? shooter.id : defGk?.id;

  const ed = buildHighlightEditorial({
    kind,
    minute: inp.minute,
    teamName: edTeam.name,
    oppTeamName: edOpp.name,
    actorName: edActor,
    assisterName: isGoal && !inp.isOwnGoal ? assister?.id || inp.assisterName : undefined,
    victimName: edVictim,
    finishVerb: inp.finishVerb,
    shotDistM,
    shotSpeedKmh,
    scoreAfterGh: inp.scoreAfterGh,
    scoreAfterGa: inp.scoreAfterGa,
    side: inp.side,
    isDerby: inp.isDerby
  });

  return finalizeHighlightClipFromSamples({
    id: inp.id,
    seq: inp.seq,
    minute: inp.minute,
    kind,
    side: inp.side,
    attRight: inp.attRight,
    title: ed.title,
    subtitle: ed.subtitle,
    crewTag: ed.crewTag,
    commentary: ed.commentary,
    actorName: edActor,
    assisterName: isGoal && !inp.isOwnGoal ? assister?.id || inp.assisterName : undefined,
    victimName: edVictim,
    scoreBefore: inp.scoreBefore,
    scoreAfter: inp.scoreAfter,
    dramaScore: ed.dramaScore,
    shotDistM,
    shotSpeedKmh,
    secondHalf: inp.secondHalf,
    ...(isGoal ? { celebratePose: celebPose } : {}),
    matchEnv: inp.matchEnv,
    preSamples,
    postSamples
  });
};

export const synthesizeHighlightClip = (inp: SynthesizeHighlightInput): MatchHighlightClip =>
  simulateRealtimeHighlightClip(inp);

const compactClipFrames = (clip: MatchHighlightClip, targetMaxFrames: number): MatchHighlightClip => {
  const frames = clip.frames;
  if (frames.length <= targetMaxFrames || targetMaxFrames < 4) return clip;

  // Find climax frame index closest to peakT
  let peakIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = Math.abs(frames[i].t - clip.peakT);
    if (d < bestDiff) {
      bestDiff = d;
      peakIdx = i;
    }
  }

  const chosen = new Set<number>([0, peakIdx, frames.length - 1]);
  // Add immediate post-climax frame (goal impact / net ripple) if available
  if (peakIdx + 1 < frames.length - 1) chosen.add(peakIdx + 1);
  if (peakIdx - 1 > 0) chosen.add(peakIdx - 1);

  for (let slot = 1; chosen.size < targetMaxFrames && slot < targetMaxFrames * 2; slot++) {
    const approxIdx = Math.round((slot / (targetMaxFrames - 1)) * (frames.length - 1));
    chosen.add(clamp(approxIdx, 0, frames.length - 1));
  }

  const sortedIndices = Array.from(chosen).sort((a, b) => a - b);
  return {
    ...clip,
    frames: sortedIndices.map((idx) => frames[idx])
  };
};

/**
 * Pro-crew curator: ALWAYS preserves every single goal scored (even in 10+ goal matches),
 * fills remaining slots up to MAX_MATCH_HIGHLIGHTS with top saves / woodwork when goals < 6,
 * compacts frames slightly on high-scoring goal-fests to keep save size lean,
 * assigns broadcast rank badges, and sorts chronologically for cohesive playback.
 */
export const curateMatchHighlights = (rawClips: MatchHighlightClip[]): MatchHighlightClip[] => {
  if (!rawClips.length) return [];
  const valid = rawClips.filter((c) => c.frames.length >= 2 && c.actors.length > 0);
  if (!valid.length) return [];

  const goals = valid
    .filter((c) => c.kind.startsWith('goal_'))
    .sort((a, b) => a.minute - b.minute || a.seq - b.seq);
  const nonGoals = valid
    .filter((c) => !c.kind.startsWith('goal_'))
    .sort((a, b) => b.dramaScore - a.dramaScore || a.seq - b.seq);

  // Never drop a goal: keep all goals, and top up with dramatic saves/woodwork up to MAX_MATCH_HIGHLIGHTS
  const selected: MatchHighlightClip[] = [...goals];
  for (const ng of nonGoals) {
    if (selected.length < MAX_MATCH_HIGHLIGHTS) {
      selected.push(ng);
    }
  }

  const frameBudget = selected.length > 9 ? 9 : selected.length > MAX_MATCH_HIGHLIGHTS ? 11 : 16;

  // Assign #1 drama badge
  const byDrama = selected.slice().sort((a, b) => b.dramaScore - a.dramaScore);
  const topByDrama = byDrama[0];
  const secondByDrama = byDrama[1];

  return selected
    .slice()
    .sort((a, b) => a.minute - b.minute || a.seq - b.seq)
    .map((clip) => {
      const compacted = frameBudget < 16 ? compactClipFrames(clip, frameBudget) : clip;
      return {
        ...compacted,
        crewTag:
          topByDrama && compacted.id === topByDrama.id
            ? '⭐ ไฮไลท์อันดับ 1'
            : secondByDrama && compacted.id === secondByDrama.id && selected.length >= 3
              ? '🔥 ช็อตเด็ดประจำเกม'
              : compacted.crewTag
      };
    });
};
