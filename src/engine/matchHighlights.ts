import type {
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
import { getFormationSlots, getShirtNo, visOf } from './playerCore';

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
  CELEBRATE: 9
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

const mapAgentAction = (ag: LivePitchAgent): { act?: number; dd?: number } => {
  if (ag.intent === 'DIVE' && ag.diveProgress > 0) {
    return { act: HL_ACT.GK_DIVE, dd: ag.diveDir || 1 };
  }
  if (ag.acrobatTimer && ag.acrobatTimer > 0) {
    switch (ag.acrobatType) {
      case 'bicycle':
        return { act: HL_ACT.BICYCLE };
      case 'volley':
        return { act: HL_ACT.VOLLEY };
      case 'header':
        return { act: HL_ACT.HEADER };
      case 'diving_header':
        return { act: HL_ACT.DIVING_HEADER };
      case 'supersave':
        return { act: HL_ACT.SUPERSAVE, dd: ag.diveDir || 1 };
      case 'clash':
      case 'slide':
        return { act: HL_ACT.CLASH };
      case 'shoot_power':
        return { act: HL_ACT.KICK };
      default:
        break;
    }
  }
  if (ag.intent === 'CELEBRATE') {
    return { act: HL_ACT.CELEBRATE };
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
        const { act, dd } = mapAgentAction(ag);
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
          ...(dd ? { dd } : {})
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
      return { icon: '🎯', label: 'ปั่นโค้งเสียบมุม', toneClass: 'bg-sky-500/20 border-sky-400/60 text-sky-300' };
    case 'goal_screamer':
      return { icon: '🚀', label: 'ยิงไกลสุดสวย', toneClass: 'bg-orange-500/20 border-orange-400/60 text-orange-300' };
    case 'goal_freekick':
      return { icon: '🌀', label: 'ฟรีคิกมหัศจรรย์', toneClass: 'bg-indigo-500/20 border-indigo-400/60 text-indigo-300' };
    case 'goal_penalty':
      return { icon: '🎯', label: 'จุดโทษเฉียบขาด', toneClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300' };
    case 'goal_header':
      return { icon: '🗣️', label: 'ลูกโหม่งพิฆาต', toneClass: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300' };
    case 'goal_woodwork_in':
      return { icon: '🪵', label: 'ชนเสา/คานกระดอนเข้า', toneClass: 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300' };
    case 'goal_deflect':
      return { icon: '💫', label: 'บอลแฉลบเข้าประตู', toneClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300' };
    case 'goal_og':
      return { icon: '🤦', label: 'เข้าประตูตัวเอง (OG)', toneClass: 'bg-rose-500/20 border-rose-400/60 text-rose-300' };
    case 'super_save':
      return { icon: '🧤', label: 'ซูเปอร์เซฟระดับโลก', toneClass: 'bg-sky-500/20 border-sky-400/60 text-sky-300' };
    case 'woodwork':
      return { icon: '🧱', label: 'ซัดเต็มข้อชนเสา/คาน', toneClass: 'bg-amber-500/20 border-amber-400/60 text-amber-300' };
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
  let crewTag = '🎬 ตัดต่อมุมกล้องทีวี · ทีมงานมืออาชีพ';

  switch (inp.kind) {
    case 'goal_acrobat':
      baseDrama = 94;
      title = `🤸 มหัศจรรย์! ${actorShort} ฟาดลูกกลางอากาศตุงตาข่าย`;
      crewTag = '🎥 มุมกล้องสโลว์โมชัน · ช็อตแห่งฤดูกาล';
      break;
    case 'goal_freekick':
      baseDrama = 90;
      title = `🌀 ฟรีคิกปลิดวิญญาณ! ${actorShort} ปั่นโค้งเสียบมุม`;
      crewTag = '🎯 มุมกล้องหลังลูกยิง · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_curler':
      baseDrama = 87;
      title = `🎯 ปั่นโค้งสุดคม! ${actorShort} โชว์ความเหนือชั้น`;
      crewTag = '🎥 โฟกัสวิถีบอลโค้ง · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_screamer':
      baseDrama = 89;
      title = `🚀 ตะบันไกลสะท้านสนาม! ${actorShort}${inp.shotDistM ? ` (${inp.shotDistM} ม.)` : ''}`;
      crewTag = '⚡ จับสปีดลูกยิงเต็มข้อ · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_woodwork_in':
      baseDrama = 88;
      title = `🪵⚽ ชนเสา/คานกระดอนข้ามเส้น! ${actorShort} กดสุดเสียว`;
      crewTag = '🎥 รีเพลย์มุมกรอบประตู · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_header':
      baseDrama = 82;
      title = `🗣️ เทกตัวโหม่งเช็ดเสา! ${actorShort} พังประตู`;
      crewTag = '🎬 ตัดต่อจังหวะกลางอากาศ · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_penalty':
      baseDrama = 76;
      title = `🎯 สังหารจุดโทษนิ่งสนิท! ${actorShort} ไม่พลาด`;
      crewTag = '🎥 ดวลตัวต่อตัว 12 หลา · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_deflect':
      baseDrama = 74;
      title = `💫 บอลแฉลบเปลี่ยนทางเข้า! ${actorShort} ซัดตุงตาข่าย`;
      crewTag = '🎬 ภาพช้ามุมแฉลบ · ทีมตัดต่อมืออาชีพ';
      break;
    case 'goal_og':
      baseDrama = 72;
      title = `🤦 จังหวะโชคร้าย! ${actorShort} สกัดพลาดเข้าประตูตัวเอง`;
      crewTag = '🎞️ เก็บตกช็อตสำคัญ · ทีมตัดต่อมืออาชีพ';
      break;
    case 'super_save':
      baseDrama = 80;
      title = `🧤 ซูเปอร์เซฟระดับโลก! ${actorShort} บินปัดสุดปลายมือ`;
      crewTag = '🧤 โฟกัสนายด่าน · ทีมตัดต่อมืออาชีพ';
      break;
    case 'woodwork':
      baseDrama = 77;
      title = `🧱 หวิดเป็นประตู! ${actorShort} ซัดบอลสั่นเสา/คาน`;
      crewTag = '🎥 มุมกรอบประตู · ทีมตัดต่อมืออาชีพ';
      break;
    default:
      baseDrama = 78;
      title = `⚽ ${actorShort} จบสกอร์เด็ดขาดให้ ${inp.teamName}`;
      crewTag = '🎬 ตัดต่อจังหวะต่อบอล & ยิงประตู';
      break;
  }

  if (isLateWinner) {
    baseDrama += 12;
    title = `🔥 นาทีบาป ${inp.minute}'! ${actorShort} ซัดประตูชัย!`;
  } else if (isEqualizer && inp.minute >= 70) {
    baseDrama += 7;
  }
  if (inp.isDerby) baseDrama += 4;
  if ((inp.shotDistM ?? 0) >= 24 && inp.kind !== 'super_save') baseDrama += 4;

  const telemetryParts: string[] = [];
  if (inp.shotDistM && inp.shotDistM > 0) telemetryParts.push(`ระยะยิง ~${inp.shotDistM} ม.`);
  if (inp.shotSpeedKmh && inp.shotSpeedKmh > 0) telemetryParts.push(`ความเร็ว ${inp.shotSpeedKmh} กม./ชม.`);
  if (assistShort && inp.kind !== 'goal_og' && inp.kind !== 'super_save') {
    telemetryParts.push(`แอสซิสต์: ${assistShort}`);
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
  matchEnv?: MatchEnvironment;
  preSamples: RollingHighlightSample[];
  postSamples: RollingHighlightSample[];
}

export const finalizeHighlightClipFromSamples = (params: FinalizeClipParams): MatchHighlightClip => {
  const combined = [...params.preSamples, ...params.postSamples];
  // Guarantee at least 2 samples
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
      matchEnv: params.matchEnv ? { ...params.matchEnv, puddles: params.matchEnv.puddles?.slice(0, 4) } : undefined,
      actors: [],
      frames: []
    };
  }

  // Downsample preSamples to max 10 (always keep oldest & latest pre sample = climax!)
  // Downsample postSamples to max 6 (always keep newest post sample)
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
  const preIndices = pickIndices(preLen, 10, true);
  const postIndices = pickIndices(params.postSamples.length, 6, true).map((idx) => preLen + idx);
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
    const p: [number, number, number, number, number?, number?][] = smp.agents.map((ag) => {
      const idx = getActorIdx(ag);
      if (smp.carId && ag.id === smp.carId) carIdx = idx;
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

export interface SynthesizeHighlightInput {
  id: string;
  seq: number;
  minute: number;
  side: 'H' | 'A';
  attRight: boolean;
  secondHalf: boolean;
  homeTeam: Team;
  awayTeam: Team;
  homeLu: string[];
  awayLu: string[];
  scorerName: string;
  assisterName?: string;
  finishVerb: string;
  isOwnGoal?: boolean;
  scoreBefore: string;
  scoreAfter: string;
  scoreAfterGh: number;
  scoreAfterGa: number;
  isDerby?: boolean;
  careerP?: PlayerCareerProfile | null;
  matchEnv?: MatchEnvironment;
}

export const synthesizeHighlightClip = (inp: SynthesizeHighlightInput): MatchHighlightClip => {
  const isPenalty = inp.finishVerb.includes('จุดโทษ');
  const isFreekick = inp.finishVerb.includes('ฟรีคิก');
  const kind = detectGoalHighlightKind({
    finishVerb: inp.finishVerb,
    flightType: isPenalty ? 'penalty' : isFreekick ? 'freekick' : 'shot',
    isOwnGoal: inp.isOwnGoal,
    shotDistM: isFreekick ? 24 : 16
  });
  const shotDistM =
    kind === 'goal_penalty'
      ? 11
      : kind === 'goal_freekick'
        ? 23
        : kind === 'goal_screamer'
          ? 26
          : kind === 'goal_header'
            ? 9
            : kind === 'goal_og'
              ? 6
              : 15;
  const shotSpeedKmh =
    kind === 'goal_screamer'
      ? 114
      : kind === 'goal_acrobat'
        ? 102
        : kind === 'goal_freekick'
          ? 98
          : kind === 'goal_curler'
            ? 91
            : kind === 'goal_penalty'
              ? 104
              : 88;

  const attTeam = inp.side === 'H' ? inp.homeTeam : inp.awayTeam;
  const defTeam = inp.side === 'H' ? inp.awayTeam : inp.homeTeam;
  const attLu = inp.side === 'H' ? inp.homeLu : inp.awayLu;
  const defLu = inp.side === 'H' ? inp.awayLu : inp.homeLu;

  const buildRoster = (tm: Team, s: 'H' | 'A', lu: string[]) => {
    const slots = getFormationSlots(tm);
    const sideAttRight = (s === 'H') !== inp.secondHalf;
    return lu.map((n, i) => {
      const pl: Player | undefined = tm.sq.find((q) => q.n === n) || tm.sq[i];
      const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
      const homeBaseX = clamp(100 - slot.y, 4.5, 95.5);
      const bx = sideAttRight ? homeBaseX : 100 - homeBaseX;
      const by = sideAttRight ? clamp(slot.x, 6, 94) : clamp(100 - slot.x, 6, 94);
      // Shift outfield players toward the attacking final third of this clip
      const shiftX = slot.pos === 'GK' ? bx : clamp(inp.attRight ? bx * 0.68 + 30 : bx * 0.68 + 2, 6, 95);
      return {
        id: n,
        sn: n.split(' ')[0] || n,
        s,
        no: pl ? getShirtNo(tm, pl) : i + 1,
        ro: (slot.sp || pl?.ro || 'CM') as SubRole,
        gk: slot.pos === 'GK' || pl?.pos === 'GK' ? (1 as const) : undefined,
        vis: pl ? visOf(pl, inp.careerP) : [2, 0, 0, 0, 0, i + 1, 0],
        ov: pl?.ov ? Math.round(pl.ov) : undefined,
        cap: tm.cap && tm.cap === n ? (1 as const) : undefined,
        me: pl?.me || (inp.careerP?.name && inp.careerP.name === n) ? (1 as const) : undefined,
        fit: pl?.fit ? Math.round(pl.fit) : 92,
        x: shiftX,
        y: by
      };
    });
  };

  const hActors = buildRoster(inp.homeTeam, 'H', inp.homeLu);
  const aActors = buildRoster(inp.awayTeam, 'A', inp.awayLu);
  const combined = [...hActors, ...aActors];
  const actors: MatchHighlightActorMeta[] = combined.map(({ id, sn, s, no, ro, gk, vis, ov, cap, me, fit }) => ({
    id,
    sn,
    s,
    no,
    ro,
    ...(gk ? { gk } : {}),
    vis,
    ...(ov ? { ov } : {}),
    ...(cap ? { cap } : {}),
    ...(me ? { me } : {}),
    ...(fit ? { fit } : {})
  }));

  const scorerIdx = Math.max(0, combined.findIndex((a) => a.id === inp.scorerName));
  const assisterIdx = inp.assisterName ? combined.findIndex((a) => a.id === inp.assisterName) : -1;
  const defGkIdx = combined.findIndex((a) => a.s !== inp.side && a.gk === 1);

  const goalX = inp.attRight ? 100.8 : -0.8;
  const dir = inp.attRight ? 1 : -1;
  const shootSpotX = clamp(
    inp.attRight ? 100 - shotDistM * 0.92 : shotDistM * 0.92,
    8,
    92
  );
  const shootSpotY = kind === 'goal_penalty' ? 50 : kind === 'goal_curler' ? 37 : kind === 'goal_acrobat' ? 48 : 44;
  const targetY = kind === 'goal_penalty' ? 44.5 : kind === 'goal_curler' ? 43.2 : 54.4;
  const passStartX = clamp(shootSpotX - dir * 16, 12, 88);
  const passStartY = clamp(shootSpotY + 14, 14, 86);

  const frameCount = 14;
  const frames: MatchHighlightFrame[] = [];
  const peakIdx = 8; // shot impact -> arrives goal around idx 11 -> celebration idx 12-13

  for (let fi = 0; fi < frameCount; fi++) {
    const t = r3(fi / (frameCount - 1));
    let bx = shootSpotX;
    let by = shootSpotY;
    let bz = 0;
    let isShot = false;
    let ripL = 0;
    let ripR = 0;

    if (kind === 'goal_penalty' || kind === 'goal_freekick') {
      if (fi <= peakIdx) {
        bx = shootSpotX;
        by = shootSpotY;
        bz = 0;
      } else if (fi <= 11) {
        const sp = (fi - peakIdx) / (11 - peakIdx);
        bx = shootSpotX + (goalX - shootSpotX) * sp;
        by = shootSpotY + (targetY - shootSpotY) * sp + Math.sin(sp * Math.PI) * (kind === 'goal_freekick' ? -3.4 : 0.8);
        bz = Math.sin(sp * Math.PI) * (kind === 'goal_freekick' ? 4.4 : 2.1);
        isShot = true;
      } else {
        bx = goalX;
        by = targetY;
        bz = 0.2;
        if (inp.attRight) ripR = fi === 12 ? 0.95 : 0.55;
        else ripL = fi === 12 ? 0.95 : 0.55;
      }
    } else {
      if (fi < 4) {
        // Buildup carry by assister / teammate
        const bp = fi / 4;
        bx = passStartX + bp * dir * 2.5;
        by = passStartY - bp * 2.0;
      } else if (fi < peakIdx) {
        // Pass to scorer
        const pp = (fi - 4) / (peakIdx - 4);
        bx = passStartX + dir * 2.5 + (shootSpotX - (passStartX + dir * 2.5)) * pp;
        by = passStartY - 2.0 + (shootSpotY - (passStartY - 2.0)) * pp;
        bz = kind === 'goal_header' || kind === 'goal_acrobat' ? Math.sin(pp * Math.PI) * 5.2 : Math.sin(pp * Math.PI) * 1.4;
      } else if (fi <= 11) {
        const sp = (fi - peakIdx) / (11 - peakIdx);
        const curveOffset = kind === 'goal_curler' ? Math.sin(sp * Math.PI) * 4.2 : Math.sin(sp * Math.PI) * 1.2;
        bx = shootSpotX + (goalX - shootSpotX) * sp;
        by = shootSpotY + (targetY - shootSpotY) * sp + curveOffset;
        bz = Math.sin(sp * Math.PI) * (kind === 'goal_screamer' ? 3.2 : 2.5);
        isShot = true;
      } else {
        bx = goalX;
        by = targetY;
        bz = 0.2;
        if (inp.attRight) ripR = fi === 12 ? 0.95 : 0.52;
        else ripL = fi === 12 ? 0.95 : 0.52;
      }
    }

    const p: [number, number, number, number, number?, number?][] = combined.map((ag, aIdx) => {
      let ax = ag.x;
      let ay = ag.y;
      let facing = inp.attRight ? 0 : Math.PI;
      let act: number | undefined;
      let dd: number | undefined;

      if (aIdx === scorerIdx) {
        if (fi < peakIdx) {
          const runP = fi / peakIdx;
          ax = clamp(shootSpotX - dir * 5 * (1 - runP), 4, 96);
          ay = shootSpotY + (1 - runP) * 3;
          facing = Math.atan2(targetY - ay, goalX - ax);
        } else if (fi === peakIdx) {
          ax = shootSpotX;
          ay = shootSpotY;
          facing = Math.atan2(targetY - ay, goalX - ax);
          act =
            kind === 'goal_acrobat'
              ? HL_ACT.BICYCLE
              : kind === 'goal_header'
                ? HL_ACT.HEADER
                : HL_ACT.KICK;
        } else {
          ax = clamp(shootSpotX + dir * (fi - peakIdx) * 1.8, 5, 95);
          ay = clamp(shootSpotY + (fi - peakIdx) * (shootSpotY < 50 ? -1.4 : 1.4), 6, 94);
          facing = Math.atan2(50 - ay, goalX - ax);
          if (fi >= 12) act = HL_ACT.CELEBRATE;
        }
      } else if (aIdx === assisterIdx && kind !== 'goal_penalty' && kind !== 'goal_freekick') {
        ax = clamp(passStartX + Math.min(1, fi / 5) * dir * 3.2, 5, 95);
        ay = passStartY - Math.min(1, fi / 5) * 1.8;
        facing = Math.atan2(shootSpotY - ay, shootSpotX - ax);
        if (fi === 4) act = HL_ACT.KICK;
        if (fi >= 12) act = HL_ACT.CELEBRATE;
      } else if (aIdx === defGkIdx) {
        ax = inp.attRight ? 97.6 : 2.4;
        if (fi >= peakIdx + 1 && fi <= 12) {
          const dp = clamp((fi - peakIdx) / 3, 0, 1);
          ay = 50 + (50 - (targetY - 50) * 0.45 - 50) * dp;
          act = HL_ACT.GK_DIVE;
          dd = targetY >= 50 ? -1 : 1;
        } else {
          ay = 50;
        }
        facing = inp.attRight ? Math.PI : 0;
      } else {
        // Gentle motion toward box during play
        const drift = (fi / frameCount) * (ag.gk ? 0 : ag.s === inp.side ? dir * 2.8 : dir * 1.6);
        ax = clamp(ag.x + drift, 3, 97);
        ay = ag.y;
        facing = Math.atan2(by - ay, bx - ax);
        if (fi >= 12 && ag.s === inp.side && !ag.gk) act = HL_ACT.CELEBRATE;
      }

      if (act && dd) return [aIdx, r1(ax), r1(ay), r2(facing), act, dd];
      if (act) return [aIdx, r1(ax), r1(ay), r2(facing), act];
      return [aIdx, r1(ax), r1(ay), r2(facing)];
    });

    const synthCar =
      kind !== 'goal_penalty' && kind !== 'goal_freekick' && fi < 4 && assisterIdx >= 0
        ? assisterIdx
        : fi === peakIdx - 1 || (fi <= peakIdx && (kind === 'goal_penalty' || kind === 'goal_freekick'))
          ? scorerIdx
          : undefined;

    frames.push({
      t,
      bx: r1(bx),
      by: r1(by),
      bz: r1(bz),
      ...(isShot ? { shot: 1 } : {}),
      ...(isShot ? { style: kind === 'goal_curler' ? 'curler' : kind === 'goal_acrobat' ? 'bicycle' : 'shot' } : {}),
      ...(synthCar !== undefined ? { car: synthCar } : {}),
      ...(ripL > 0 ? { ripL } : {}),
      ...(ripR > 0 ? { ripR } : {}),
      p
    });
  }

  const ed = buildHighlightEditorial({
    kind,
    minute: inp.minute,
    teamName: attTeam.name,
    oppTeamName: defTeam.name,
    actorName: inp.scorerName,
    assisterName: inp.assisterName,
    finishVerb: inp.finishVerb,
    shotDistM,
    shotSpeedKmh,
    scoreAfterGh: inp.scoreAfterGh,
    scoreAfterGa: inp.scoreAfterGa,
    side: inp.side,
    isDerby: inp.isDerby
  });

  const defGk = defLu.map((n) => defTeam.sq.find((q) => q.n === n)).find((q) => q?.pos === 'GK');

  return {
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
    actorName: inp.scorerName,
    assisterName: inp.assisterName || undefined,
    victimName: defGk?.n,
    scoreBefore: inp.scoreBefore,
    scoreAfter: inp.scoreAfter,
    dramaScore: ed.dramaScore,
    shotDistM,
    shotSpeedKmh,
    peakT: frames[peakIdx]?.t ?? 0.6,
    secondHalf: inp.secondHalf,
    matchEnv: inp.matchEnv
      ? {
          season: inp.matchEnv.season,
          timeOfDay: inp.matchEnv.timeOfDay,
          sunAngle: inp.matchEnv.sunAngle,
          turfGrade: inp.matchEnv.turfGrade,
          turfCond: inp.matchEnv.turfCond,
          grassLength: inp.matchEnv.grassLength,
          dirtMix: inp.matchEnv.dirtMix,
          pitchSeed: inp.matchEnv.pitchSeed,
          stadiumStyle: inp.matchEnv.stadiumStyle,
          puddles: inp.matchEnv.puddles?.slice(0, 4) || []
        }
      : undefined,
    actors,
    frames
  };
};

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
            ? '⭐ ไฮไลท์อันดับ 1 · ทีมตัดต่อมืออาชีพ'
            : secondByDrama && compacted.id === secondByDrama.id && selected.length >= 3
              ? '🎬 ช็อตเด็ดประจำเกม · ทีมตัดต่อมืออาชีพ'
              : compacted.crewTag
      };
    });
};
