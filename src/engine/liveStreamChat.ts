import { P } from '../utils/math';
import type { LiveStreamPlanId, MatchKind, Position, SubRole } from '../types/game';

export type StreamViewerTier = 'low' | 'mid' | 'high' | 'viral';

export type LiveCommentKind =
  | 'ambient'
  | 'goal'
  | 'concede'
  | 'save'
  | 'miss'
  | 'card'
  | 'var'
  | 'sub'
  | 'halftime'
  | 'late'
  | 'fulltime'
  | 'player'
  | 'club';

export interface BroadcastChannelInfo {
  name: string;
  short: string;
  badge: string;
}

const LOCAL_CHANNELS: readonly BroadcastChannelInfo[] = [
  { name: 'BallThai Local Play', short: 'BallThai Play', badge: 'ผู้ถือลิขสิทธิ์ลีก' },
  { name: 'Siamball Stream TV', short: 'Siamball TV', badge: 'ผู้ถือลิขสิทธิ์ลีก' },
  { name: 'Thonburi Sports Net', short: 'Thonburi Net', badge: 'ผู้ถือลิขสิทธิ์ลีก' }
];

const DIV2_CHANNELS: readonly BroadcastChannelInfo[] = [
  { name: 'BallThai Plus HD', short: 'BallThai Plus', badge: 'ผู้ถือลิขสิทธิ์ถ่ายทอด' },
  { name: 'SiamFooty Network', short: 'SiamFooty HD', badge: 'ผู้ถือลิขสิทธิ์ถ่ายทอด' },
  { name: 'ThaiSport Channel 2', short: 'ThaiSport CH2', badge: 'ผู้ถือลิขสิทธิ์ถ่ายทอด' }
];

const TOP_CHANNELS: readonly BroadcastChannelInfo[] = [
  { name: 'SiamSport Prime HD', short: 'SiamSport HD', badge: 'ลิขสิทธิ์ลีกสูงสุด' },
  { name: 'PrimeBall Thailand', short: 'PrimeBall TH', badge: 'ลิขสิทธิ์ลีกสูงสุด' },
  { name: 'ThaiPro TV1 Ultra', short: 'ThaiPro TV1', badge: 'ลิขสิทธิ์ลีกสูงสุด' }
];

const CUP_CHANNELS: readonly BroadcastChannelInfo[] = [
  { name: 'CupPlay Sports HD', short: 'CupPlay HD', badge: 'ลิขสิทธิ์บอลถ้วย' },
  { name: 'SiamCup Live TV', short: 'SiamCup TV', badge: 'ลิขสิทธิ์บอลถ้วย' }
];

export function getMatchBroadcastChannel(opts: {
  tier: number;
  kind?: MatchKind | 'asia';
  planId?: LiveStreamPlanId;
  homeId?: number;
  season?: number;
}): BroadcastChannelInfo {
  const seed = Math.abs((opts.homeId ?? 1) * 13 + (opts.season ?? 1) * 7 + (opts.tier ?? 0) * 5);
  if (opts.kind === 'asia') {
    return { name: 'AsiaFootball Network HD', short: 'AsiaFootball HD', badge: 'ลิขสิทธิ์ถ้วยทวีป' };
  }
  if (opts.kind === 'sc') {
    return { name: 'ThaiChampions Sports HD', short: 'ThaiChampions HD', badge: 'ลิขสิทธิ์ซูเปอร์คัพ' };
  }
  if (opts.kind === 'cup' || opts.kind === 'lc' || opts.kind === 'dc') {
    return CUP_CHANNELS[seed % CUP_CHANNELS.length];
  }
  if (opts.tier >= 2) {
    if (opts.planId === 'studio') return TOP_CHANNELS[0];
    return TOP_CHANNELS[seed % TOP_CHANNELS.length];
  }
  if (opts.tier === 1) {
    if (opts.planId === 'studio') return TOP_CHANNELS[1];
    return DIV2_CHANNELS[seed % DIV2_CHANNELS.length];
  }
  if (opts.planId === 'studio' || opts.planId === 'pro') {
    return DIV2_CHANNELS[seed % DIV2_CHANNELS.length];
  }
  return LOCAL_CHANNELS[seed % LOCAL_CHANNELS.length];
}

export interface LiveCommentItem {
  id: string;
  m: number;
  user: string;
  text: string;
  tier: StreamViewerTier;
  kind: LiveCommentKind;
  donateBaht?: number;
}

export function getStreamViewerTier(viewers: number): StreamViewerTier {
  if (viewers >= 30000) return 'viral';
  if (viewers >= 9000) return 'high';
  if (viewers >= 1500) return 'mid';
  return 'low';
}

export function getViewerTierMeta(tier: StreamViewerTier): { label: string; desc: string } {
  switch (tier) {
    case 'viral':
      return { label: 'ไวรัลแตกแตน', desc: 'แชทไหลรัว · ซุปเปอร์แชทกระหน่ำ' };
    case 'high':
      return { label: 'ยอดทะลุหมื่น', desc: 'แฟนต่างทีมร่วมแจม · มีโดเนท' };
    case 'mid':
      return { label: 'เริ่มคึกคัก', desc: 'วิเคราะห์เกมเข้มข้น · กดแชร์เพียบ' };
    case 'low':
    default:
      return { label: 'อบอุ่นเป็นกันเอง', desc: 'แฟนเดนตาย · พูดคุยสบายๆ' };
  }
}

const USERS_LOW = [
  'ลุงสมชายหน้าสนาม', 'เจ๊หมวยลูกชิ้นทอด', 'แฟนเดนตาย01', 'พี่เอกบ้านใกล้', 'น้องบีมเชียร์สุด',
  'อาเฮียร้านกาแฟ', 'ต้อมบอลเดินสาย', 'ป้าแต๋วขาประจำ', 'กอล์ฟทีมท้องถิ่น', 'น้าชัยริมรั้ว',
  'พี่บอยตลาดนัด', 'ช่างกิตติดบอล', 'น้องแพรวหลังโกล', 'ลุงเปี๊ยกสายเชียร์', 'มอสบ้านนาFC',
  'เสี่ยหนูสายชิล', 'ครูต้นเชียร์บอล', 'ไอซ์ซ้อมเย็น', 'พี่ตั้มข้างอัฒจันทร์', 'น้องฟ้าขอบสนาม'
];

const USERS_MID = [
  'Kittipong_FC', 'บอลไทยสไตล์เรา', 'Nattapong99', 'โค้ชคีย์บอร์ด', 'Poomza_TH',
  'สายแท็กติก', 'SiamFootball', 'Tonkla_Official', 'MheePooh_9', 'ดูบอลวนไป',
  'Winai_Analyze', 'เจตน์วิจารณ์บอล', 'Pat_BallThai', 'โอ๊ตคอบอล', 'Korn_Tactics',
  'บอลสยามรีวิว', 'Beamz_Soccer', 'ตั้ม90นาที', 'Sornchai_Live', 'แชมป์บอลไทย'
];

const USERS_HIGH = [
  'UltraSiam_12', 'บิ๊กแฟนคลับ', 'TH_League_Watch', 'ป๋าดันทีมรัก', 'JaoKhao_99',
  'เสือปืนไว', 'Bank_LiveChat', 'FairPlay_TH', 'ChampHunter', 'KengSportLive',
  'GoalRadar_TH', 'ส่องฟอร์มแข้งไทย', 'ProMatch_Viewer', 'Tle_Highlight', 'BKK_StandFan',
  'คอลัมนิสต์ข้างจอ', 'Top_Division1', 'เชียร์ข้ามจังหวัด', 'PitchSide_TH', 'Petch_Goal'
];

const USERS_VIRAL = [
  'ThaiFooty_Viral', 'KingOfDerby', 'VIP_Supporter88', 'ดราม่าบอลไทย', 'MegaFan_BKK',
  'ZoomInSoccer', 'ตำนานข้างสนาม', 'SuperChatKing', 'AllStar_Watcher', 'LiveBreaker_TH',
  'Nationwide_12th', 'BigMatch_Alert', 'PrimeTime_TH', 'บอลไทยฟีเวอร์', 'RealUltra_TH',
  'StadiumEcho99', 'GoldenGoal_Live', 'แอดมินสายรีเพลย์', 'ViralPitch_TH', 'LegendSpotter'
];

const pickUser = (tier: StreamViewerTier): string => {
  if (tier === 'viral') return P([...USERS_VIRAL, ...USERS_HIGH]);
  if (tier === 'high') return P([...USERS_HIGH, ...USERS_MID]);
  if (tier === 'mid') return P([...USERS_MID, ...USERS_LOW]);
  return P(USERS_LOW);
};

function pickUnique(candidates: string[], usedTexts?: Set<string>): string | null {
  if (!candidates.length) return null;
  if (!usedTexts) return P(candidates);
  const available = candidates.filter((t) => {
    const clean = t.trim();
    return clean.length > 0 && !usedTexts.has(clean);
  });
  if (!available.length) return null;
  const chosen = P(available);
  usedTexts.add(chosen.trim());
  return chosen;
}

function buildPositionPlayerComments(
  pTag: string,
  pos: Position | undefined,
  role: SubRole | undefined,
  teamName: string
): string[] {
  if (pos === 'GK' || role === 'GK') {
    return [
      `${pTag} วันนี้ยืนตำแหน่งในกรอบเขตโทษนิ่งมาก ไว้ใจได้สุดๆ 🧤`,
      `ชอบจังหวะสั่งแนวรับของ ${pTag} จริงๆ ช่วยจัดระเบียบหลังบ้านดีมาก`,
      `${pTag} อ่านลูกครอสกับลูกกลางอากาศขาดเลย ไม่ปล่อยให้หลุดง่ายๆ`,
      `ปฏิกิริยาไวมาก ${pTag} เกมนี้สมาธิสูงตั้งแต่ต้นจนถึงตอนนี้`,
      `${pTag} ออกบอลเร็วจากแดนหลังสวยหลายลูกเลย ช่วยโต้กลับไวขึ้น`,
      `มี ${pTag} เฝ้าเสาแล้วแฟน ${teamName} อุ่นใจขึ้นเยอะ 👏`,
      `จังหวะออกมาตัดบอลนอกเส้น 6 หลาของ ${pTag} กล้ามาก!`,
      `การสื่อสารระหว่าง ${pTag} กับคู่เซ็นเตอร์นัดนี้เข้าขากันดีจริง`,
      `ใครเห็นช็อตอ่านทางบอลของ ${pTag} บ้าง ดักทางแม่นมาก`,
      `มีใครเปิดช่องนี้มาเชียร์ ${pTag} เฝ้าเสาโดยเฉพาะไหมครับ 🧤⭐`
    ];
  }

  if (pos === 'DF' || role === 'CB' || role === 'LB' || role === 'RB') {
    const isFullback = role === 'LB' || role === 'RB';
    const baseDf = [
      `${pTag} เข้าสกัดจังหวะสำคัญได้สะอาดมาก ไม่มีเสียฟาวล์พร่ำเพรื่อ 🛡️`,
      `ลูกกลางอากาศเก็บกินเรียบเลย ${pTag} แข็งแกร่งสุดๆ`,
      `${pTag} อ่านทางบอลขาดตลอด ดักตัดบอลก่อนถึงเขตโทษได้หลายที`,
      `ชนเบียดตัวต่อตัวไม่มีถอยเลย ${pTag} แนวรับของแท้!`,
      `จังหวะยืนซ้อนเกมรับของ ${pTag} นิ่งเกินวัยมาก`,
      `${pTag} ประกบตัวรุกคู่แข่งติดหนึบ จนเล่นแทบไม่ออก`,
      `เกมรับ ${teamName} แน่นขึ้นเยอะเพราะ ${pTag} คุมโซนอยู่หมัด`,
      `การเคลียร์บอลจังหวะอันตรายของ ${pTag} เด็ดขาดทุกช็อต 👏`
    ];
    if (isFullback) {
      return [
        ...baseDf,
        `${pTag} วิ่งขึ้นลงริมเส้นไม่มีหมดเลยทั้งเกมรับและเกมรุก`,
        `จังหวะเติมเกมเปิดบอลจากริมเส้นของ ${pTag} ได้ลุ้นตลอด!`
      ];
    }
    return [
      ...baseDf,
      `${pTag} บล็อกลูกยิงหน้ากรอบได้จังหวะพอดีเป๊ะ กำแพงเหล็กชัดๆ`,
      `จ่ายบอลขึ้นมาจากแดนหลังของ ${pTag} นิ่งมาก ไม่ลนเวลาโดนเพรส`
    ];
  }

  if (pos === 'MF' || role === 'CDM' || role === 'CM' || role === 'CAM') {
    const isCam = role === 'CAM';
    const isCdm = role === 'CDM';
    const baseMf = [
      `${pTag} คุมจังหวะเกมกลางสนามเนียนมาก รู้ว่าจังหวะไหนควรเร่งหรือดึงช้า 🎯`,
      `ความขยันไล่เพรสแดนกลางของ ${pTag} ทำให้ ${teamName} ครองเกมได้เลย`,
      `${pTag} พลิกบอลหนีตัวประกบกลางสนามสวยมาก จ่ายต่อแม่นด้วย`,
      `วิสัยทัศน์การออกบอลของ ${pTag} ยอดเยี่ยม มองเพื่อนร่วมทีมไวตลอด`,
      `${pTag} เชื่อมเกมรับกับเกมรุกได้ลื่นไหลไม่มีสะดุด`,
      `การยืนตำแหน่งรับบอลของ ${pTag} ฉลาดมาก หาช่องว่างให้เพื่อนจ่ายตลอด`,
      `กลางสนามนัดนี้ ${pTag} เก็บบอลจังหวะสองได้แทบทุกลูก 👏`
    ];
    if (isCam) {
      return [
        ...baseMf,
        `${pTag} แทงบอลทะลุช่องแต่ละลูกโคตรอันตราย รอแอสซิสต์ได้เลย!`,
        `จังหวะปั้นเกมหน้ากรอบเขตโทษของ ${pTag} สร้างสรรค์สุดๆ ⭐`,
        `${pTag} พาบอลแหวกตรงกลางพลิ้วเลย เรียกฟาวล์ได้เปรียบตลอด`
      ];
    }
    if (isCdm) {
      return [
        ...baseMf,
        `${pTag} กวาดเกมหน้าแผงหลังหมดจด ตัวตัดเกมตัวจริงเสียงจริง 🛡️`,
        `คอยซ้อนจังหวะเพื่อนตรงกลางตลอด ${pTag} ปิดทองหลังพระของทีมเลย`,
        `ชิงจังหวะตัดบอลกลางสนามของ ${pTag} หนักแน่นแต่แม่นมาก`
      ];
    }
    return [
      ...baseMf,
      `วางบอลยาวเปลี่ยนแกนของ ${pTag} แม่นเหมือนจับวางเลย`,
      `ใครสังเกตบ้าง ${pTag} วิ่ง box-to-box ไม่มีหมดแรงเลยวันนี้`
    ];
  }

  // FW / LW / RW / ST
  const isWinger = role === 'LW' || role === 'RW';
  const baseFw = [
    `${pTag} เคลื่อนที่หาพื้นที่ในแดนหน้าดีมาก กองหลังจับยากสุดๆ ⚡`,
    `สปีดต้นของ ${pTag} เวลาสวนกลับเร็วอันตรายมากจริงๆ`,
    `${pTag} กดดันแนวรับคู่แข่งไม่ให้ตั้งเกมสบายเลย ขยันเพรสมาก`,
    `จังหวะจับบอลแรกแล้วหมุนหาช่องยิงของ ${pTag} คมมาก 👏`,
    `กองหลังฝั่งตรงข้ามต้องรุมสองคนตลอดเวลา ${pTag} ได้บอล`,
    `${pTag} สอดทะลุไลน์ล้ำหน้าเกือบหลุดเดี่ยวหลายรอบแล้ว รอลุ้นสกอร์เลย!`,
    `มีใครเปิดช่องมาตามดูฟอร์ม ${pTag} ล่าตาข่ายเกมนี้โดยเฉพาะบ้าง? ⭐`
  ];
  if (isWinger) {
    return [
      ...baseFw,
      `จังหวะกระชากหนีแบ็กริมเส้นของ ${pTag} พริ้วจัด! หลุดแทบทุกรอบ 🔥`,
      `${pTag} โยกหลอกริมเส้นแล้วตัดเข้าในสวยมาก เล่นเอาแผงหลังป่วนเลย`,
      `สเต็ปเท้า ${pTag} ริมเส้นวันนี้จี๊ดสุดๆ เปิดเข้ากลางได้ลุ้นตลอด`
    ];
  }
  return [
    ...baseFw,
    `จังหวะพักบอลแดนหน้าแล้วจ่ายให้เพื่อนเติมของ ${pTag} เนียนตาสุดๆ`,
    `สัญชาตญาณในกรอบเขตโทษของ ${pTag} ไวมาก จมูกไวรอเข้าฮอสตลอด`,
    `พริ้วจัดในพื้นที่สุดท้าย! ${pTag} หาจังหวะง้างยิงไวแทบทุกช็อต 🔥`
  ];
}

export interface LiveCommentContext {
  m: number;
  viewers: number;
  kind: LiveCommentKind;
  homeName: string;
  awayName: string;
  myTeamName: string;
  oppTeamName: string;
  channelName?: string;
  actor?: string;
  actorPos?: Position;
  actorRole?: SubRole;
  assist?: string;
  gkName?: string;
  gh: number;
  ga: number;
  playerModeName?: string;
  playerModeNo?: number | null;
  playerModePos?: Position;
  playerModeRole?: SubRole;
  usedTexts?: Set<string>;
}

export function generateLiveStreamComment(ctx: LiveCommentContext): LiveCommentItem | null {
  const tier = getStreamViewerTier(ctx.viewers);
  const chan = ctx.channelName || 'ช่องถ่ายทอดสดลิขสิทธิ์';
  const user =
    ctx.kind === 'club'
      ? `${ctx.myTeamName} (ผ่าน ${chan})`
      : pickUser(tier);
  const act = ctx.actor || 'ตัวรุกคนเก่ง';
  const ast = ctx.assist ? ` (จ่ายโดย ${ctx.assist})` : '';
  const score = `${ctx.gh}-${ctx.ga}`;
  let text: string | null = null;
  let donateBaht: number | undefined;

  if (ctx.kind === 'club') {
    text = pickUnique(
      [
        `📢 ขอบคุณแฟนบอลทั้ง ${ctx.viewers.toLocaleString()} คนที่รับชมสดผ่าน ${chan}! ช่วยกันส่งแรงเชียร์ให้ ${ctx.myTeamName} ด้วยนะครับ`,
        `🎙️ เสียงเชียร์จากหน้าจอ ${chan} ส่งถึงนักเตะ ${ctx.myTeamName} แน่นอน ลุยต่อครับ!`,
        `⚽ แฟนบอล ${ctx.myTeamName} ที่ดูสดทาง ${chan} อยู่ตอนนี้ พิมพ์ส่งกำลังใจให้ทีมรักได้เลยครับ!`
      ],
      ctx.usedTexts
    );
    if (!text) return null;
    return {
      id: `lc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      m: ctx.m,
      user,
      text,
      tier,
      kind: 'club'
    };
  }

  const donateChance = tier === 'viral' ? 0.22 : tier === 'high' ? 0.13 : tier === 'mid' ? 0.05 : 0;
  const shouldDonate =
    donateChance > 0 &&
    (ctx.kind === 'goal' || ctx.kind === 'save' || ctx.kind === 'ambient' || ctx.kind === 'late') &&
    Math.random() < donateChance;

  if (shouldDonate) {
    donateBaht = tier === 'viral' ? P([200, 500, 1000, 2000]) : tier === 'high' ? P([100, 200, 500]) : P([50, 100]);
  }

  switch (ctx.kind) {
    case 'goal': {
      const candidates = [
        `เฮลั่นหน้าจอแล้ว! ${act}${ast} ยิงสวยมาก! (${score}) ⚽`,
        `เข้าแล้วโว้ยย! ${act}${ast} สุดยอดจริงๆ!`,
        `GOOOAL!! ${act}${ast} จบสกอร์เฉียบขาดมาก! (${score})`,
        `กดหัวใจรัวๆ ให้ ${act} เลยลูกนี้ โคตรคม!`,
        `ตากล้อง ${chan} ซูมหน้า ${act} หน่อย ยิงอย่างสวย!`,
        `ตุงตาข่าย!! ${act}${ast} แชทเดือดจัดตอนนี้ (${score}) 🔥`,
        `ค่าตัวพุ่งแน่หลังลูกนี้ ${act} ทำได้ไง!!`,
        `คนดูทาง ${chan} เป็นพยานประตูสุดสวยของ ${act}!`,
        `GOOOOOAL!! ${act}${ast} ช่องแชทแตกแล้ว!! 🔥🔥`,
        `แชทวิ่งเป็นน้ำตก! ${act} ซัดระดับคุณภาพ (${score})`,
        `ต้องดูรีเพลย์สิบตลบเลยลูกนี้ ${act} วางเท้าเนียนมาก!`,
        `จังหวะเข้าทำของ ${ctx.myTeamName} ลูกนี้สมบูรณ์แบบมาก ${act} จบไม่พลาด!`,
        `เสียงผู้บรรยาย ${chan} ลั่นไมค์เลยจังหวะ ${act} ซัดเข้าไป!`,
        `ลูกนี้ยกนิ้วให้ทั้งคนจ่ายและคนยิง! ${act} ปิดกล่องสวย (${score})`
      ];
      if (donateBaht) {
        candidates.push(
          `ส่งกำลังใจให้ ${ctx.myTeamName}! สุดจัดเลย ${act}! (${score})`,
          `โดเนทฉลองประตูของ ${act} หน่อยครับ! ลุยต่อ ${ctx.myTeamName}!`
        );
      }
      text = pickUnique(candidates, ctx.usedTexts);
      break;
    }

    case 'concede': {
      text = pickUnique(
        [
          `อ้าว โดนจนได้ ไม่เป็นไรเอาใหม่นะ ${ctx.myTeamName} (${score})`,
          `สมาธิหน่อยแนวรับ ${ctx.myTeamName} ยังมีเวลาทวงคืน!`,
          `โดนเฉยเลย ต้องรีบแก้เกมแล้วโค้ช! (${score})`,
          `เกมรับหลวมไปนิดจังหวะเมื่อกี้ ปิดช่องว่างให้ไวเลย`,
          `โอ้โห โดนยิงคืนจนได้ แฟนคู่แข่งเฮลั่นแชทเลย (${score})`,
          `ตั้งสติกลับมาให้ไว ${ctx.myTeamName} เดี๋ยวเรายิงคืนได้!`,
          `จังหวะนี้เสียดายแทนโกลเลย แนวรับหลุดประกบไปเสี้ยววิ`,
          `ยังเหลือเวลาอีกเยอะ รีบดันเกมกลับมานะ ${ctx.myTeamName}`,
          `เสียงเชียร์อย่าตกครับ ส่งแรงใจให้ ${ctx.myTeamName} สู้ต่อ!`,
          `ลูกนี้ต้องยอมใจจังหวะจบคู่แข่ง รีบปรับแท็กติกแก้คืนเลยโค้ช`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'save': {
      const gkTag = ctx.gkName || (ctx.actorPos === 'GK' || ctx.actorRole === 'GK' ? act : 'ผู้รักษาประตู');
      text = pickUnique(
        [
          `โห ${gkTag} เซฟช่วยชีวิตเลย! นึกว่าเข้าแล้ว 🧤`,
          `เหนียวมาก ${gkTag} ลูกเมื่อกี้บินปัดสุดปลายมือ!`,
          `เซฟมหัศจรรย์! ปรบมือให้ ${gkTag} รัวๆ เลย 👏`,
          `${gkTag} ปัดได้ไงวะน่ะ! ปฏิกิริยาไวโคตร!`,
          `SUPER SAVE!! ช็อตเซฟแห่งสัปดาห์ต้องให้ ${gkTag} แล้ว! 🔥`,
          `มือเหนียวระดับทีมชาติ! แชทพิมพ์ 1 ให้ ${gkTag} หน่อย!`,
          `ถ้าไม่ได้ ${gkTag} ลูกนี้มีสิทธิ์เสียประตูไปแล้ว 🧤`,
          `กล้อง ${chan} จับภาพรีเพลย์ช็อตปัดบอลของ ${gkTag} ด่วน สุดจัด!`,
          `${gkTag} อ่านทางลูกยิงขาดมาก ยืนตำแหน่งรอรับอยู่แล้ว`,
          `ผู้รักษาประตูคนนี้ของจริง! ${gkTag} ช่วยทีมรอดตายอีกแล้ว`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'miss': {
      text = pickUnique(
        [
          `โอ๊ย เฉียดนิดเดียว! เกือบได้เฮกันทั้งบ้านแล้ว 😱`,
          `อีกนิดเดียวๆ ${act} วางเท้าเพิ่มอีกหน่อยมาแน่!`,
          `อูยยย! คนดูช่อง ${chan} เอามือกุมหัวกันหมดแล้ว`,
          `จังหวะนี้ ${act} น่าจะใส่สกอร์ได้นะ เสียดายแทนเลย!`,
          `บอลถากเสาออกไปแค่คืบเดียว ใจหายวาบ!`,
          `ได้ง้างยิงเน้นๆ แล้วแท้ๆ ${act} ลองใหม่จังหวะหน้า!`,
          `โอกาสทองมาแล้วแท้ๆ เสียดายแทน ${ctx.myTeamName} จริงๆ`,
          `อีกนิดเดียวบอลจะมุดเสียบคานอยู่แล้ว! ลุยกดดันต่อ`,
          `เห็นทางบอลแล้วลุ้นสุดตัวเลยจังหวะยิงของ ${act}`,
          `ไม่เป็นไร ${act} หาจังหวะเข้าทำแบบนี้เรื่อยๆ เดี๋ยวก็เข้า!`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'var': {
      text = pickUnique(
        [
          `เฮ้ย กรรมการเช็ก VAR เหรอ ลุ้นตัวโก่งหน้าจอเลย! 📺`,
          `ขอให้ตัดสินยุติธรรมเถอะจังหวะนี้ 🙏`,
          `ดูภาพช้าทาง ${chan} แล้วเสียวมาก VAR จะว่าไง!`,
          `แชทนิ่งรอคำตัดสิน VAR กันทั้งห้องแล้วตอนนี้`,
          `VAR ดราม่ามาแล้ว!! แชทเถียงกันยับเลย 📺`,
          `ซูมภาพช้าหลายมุมหน่อยทีมงาน ${chan} จังหวะนี้มีลุ้นจุดเปลี่ยน!`,
          `ผู้บรรยายยังต้องหยุดหายใจรอดูหน้าจอ VAR เลยจังหวะนี้`,
          `ช็อตนี้ก้ำกึ่งมาก อยู่ที่ดุลพินิจผู้ตัดสินเลย`,
          `ภาพช้าชัดเจนดีมาก แต่ต้องลุ้นว่ากรรมการหน้าจอจะตีความยังไง`,
          `ใจเต้นตึกตัก รอสัญญาณมือจากกรรมการกลางสนามอยู่เนี่ย!`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'card': {
      const targetStr = ctx.actor ? `ของ ${ctx.actor}` : '';
      text = pickUnique(
        [
          `โอ้โห โดนใบคาดโทษเฉย จังหวะเข้าบอล${targetStr} หนักจริง 🟨`,
          `ใจเย็นๆ หน่อยนะครับ อย่าเสียฟาวล์อันตรายง่ายๆ`,
          `เข้าบอลแรงจัด! แฟนบอลในแชทฮือฮากันใหญ่ 🟨🟥`,
          `จังหวะนี้โดนจดชื่อไม่แปลกเลย เกมกำลังเดือดสุดๆ`,
          `อารมณ์ในสนามเริ่มเดือดแล้ว ระวังโดนเหลืองสองนะ ${ctx.actor || 'ทุกคน'}`,
          `กรรมการควักใบไวมาก คุมเกมไม่ให้บานปลายเลย`,
          `จังหวะตัดเกมนี้คุ้มหรือเปล่าเนี่ย เสียวใบต่อมาก`,
          `ต้องดึงสติกันหน่อย อย่าให้เกมรับเสียโควตาใบเหลืองเพิ่ม`,
          `ผู้ชมทาง ${chan} ร้องซี๊ดเลยจังหวะเข้าปะทะเมื่อกี้`,
          `เล่นหนักกันมากคู่นี้ ไม่รู้จบเกมจะมีใบเพิ่มอีกไหม`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'sub': {
      const posNote =
        ctx.actorPos === 'FW'
          ? 'ลงมาเติมความสดแนวรุก'
          : ctx.actorPos === 'DF'
            ? 'ลงมาช่วยแพ็กเกมรับ'
            : ctx.actorPos === 'GK'
              ? 'ลงมาเฝ้าเสาแทน'
              : 'ลงมาคุมจังหวะแดนกลาง';
      text = pickUnique(
        [
          `เปลี่ยนตัวแล้ว ส่ง ${act} ${posNote} 🔄`,
          `มาดูกันว่า ${act} ลงสนามมาแล้วจะเปลี่ยนเกมได้แค่ไหน`,
          `โค้ชขยับหมากส่ง ${act} ลงสนามแล้ว! รอดูทีเด็ดเลย`,
          `แฟนๆ รอเชียร์ ${act} อยู่ ลงมาจัดเต็มหน่อย!`,
          `แท็กติกข้างสนามเริ่มขยับแล้ว ${act} สภาพความฟิตเต็มร้อยพร้อมลุย`,
          `ตัดสินใจส่ง ${act} ${posNote} ถูกจุดมากครับโค้ช`,
          `แรงใหม่ลงมาแล้ว ${act} น่าจะช่วยทีมได้เยอะในช่วงนี้`,
          `กล้องจับภาพ ${act} ข้างสนามวอร์มเสร็จพร้อมลงเล่นทันที!`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'halftime': {
      text = pickUnique(
        [
          `จบครึ่งแรก ${score} พักดื่มน้ำเตรียมลุยครึ่งหลังกันครับ`,
          `ครึ่งแรกสูสีดี ครึ่งหลังมาลุ้นต่อทาง ${chan}`,
          `สกอร์ครึ่งแรก ${score} ครึ่งหลังโค้ชทั้งสองฝั่งแก้เกมสนุกแน่`,
          `ภาพถ่ายทอดสดทาง ${chan} คมชัดมาก พักครึ่งดูสถิติเพลินเลย`,
          `พักครึ่งยอดคนดูยังแน่น ${ctx.viewers.toLocaleString()} คน! ครึ่งหลังเดือดกว่านี้ชัวร์`,
          `วิเคราะห์ครึ่งแรกกันหน่อยครับ ใครเด่นสุดใน 45 นาทีแรก?`,
          `พักครึ่งแบบนี้ขอโฆษณาสปอนเซอร์แป๊บ เดี๋ยวกลับมาลุยครึ่งหลัง!`,
          `45 นาทีแรกใส่กันเต็มที่จริงๆ ครึ่งหลังต้องวัดความฟิตกันแล้ว`,
          `รอดูการแก้เกมช่วงพักครึ่งเลย ว่าจะปรับจุดไหนบ้าง`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'late': {
      text = pickUnique(
        [
          `เข้าสู่ช่วงท้ายเกมแล้ว ลุ้นจนนั่งไม่ติดเก้าอี้! ⏱️`,
          `อีกไม่กี่นาที อดทนไว้นะ ${ctx.myTeamName}! (${score})`,
          `ช่วงท้ายเกมยอดคนดูทาง ${chan} พุ่งไม่หยุดเลย!! ⏱️`,
          `นาทีบาปแบบนี้ใครพลาดมีน้ำตาแน่นอน สมาธิห้ามหลุด!`,
          `ลุ้นวินาทีต่อวินาที กดดันกันทุกจังหวะแล้วตอนนี้`,
          `เข้าช่วงทดเจ็บทีไรหัวใจเต้นแรงทุกที! (${score})`,
          `ทุกสัมผัสบอลช่วงท้ายเกมมีค่ามหาศาลเลยตอนนี้`,
          `เสียงเชียร์ในสนามทะลุไมค์ถ่ายทอดสดแล้ว เอาใจช่วยสุดๆ!`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'fulltime': {
      text = pickUnique(
        [
          `จบเกมสุดมันส์ ${score}! ขอบคุณผู้ชมทุกคนที่ติดตามทาง ${chan} ครับ 👏`,
          `แมตช์คุณภาพจริงๆ! ใครดูถ่ายทอดสดทาง ${chan} คุ้มค่ามาก`,
          `จบเกม ${score}! สนุกมากนัดนี้ เจอกันใหม่ถ่ายทอดสดนัดหน้าครับ`,
          `สัญญาณถ่ายทอดสด ${chan} ลื่นไหลดีมาก ขอบคุณทีมงานทุกฝ่ายครับ`,
          `จบเกม ${score} แล้วครับ แยกย้ายพักผ่อน เจอกันแมตช์หน้า!`,
          `ขอบคุณทีมผู้บรรยาย ${chan} และแฟนบอลทุกคนที่ร่วมเชียร์จนจบเกม ❤️`,
          `ปิดจ๊อบ ${score} เก็บสถิติหลังเกมกันต่อเลยครับทุกคน!`,
          `แมตช์นี้ดูเพลินตั้งแต่ต้นจนนกหวีดสุดท้ายเลย 👏`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'player': {
      const pTag = ctx.playerModeName
        ? `${ctx.playerModeNo ? `#${ctx.playerModeNo} ` : ''}${ctx.playerModeName}`
        : act;
      const pool = buildPositionPlayerComments(pTag, ctx.playerModePos || ctx.actorPos, ctx.playerModeRole || ctx.actorRole, ctx.myTeamName);
      text = pickUnique(pool, ctx.usedTexts);
      break;
    }

    case 'ambient':
    default: {
      const pool: string[] = [
        `เปิดดูทาง ${chan} ชัดแจ๋วเลย เชียร์ ${ctx.homeName} เต็มที่ครับ`,
        `ภาพและเสียงของ ${chan} วันนี้ดีมาก ดูเพลินไม่มีกระตุก`,
        `เพิ่งเลิกงานรีบเปิด ${chan} ดูถ่ายทอดสด ทันเกมพอดีเลย`,
        `บรรยากาศในสนามเสียงดังทะลุไลฟ์เลย ขนลุก!`,
        `จังหวะต่อบอลวันนี้ ${ctx.myTeamName} ดูเป็นระบบกว่าที่คิดแฮะ`,
        `มุมกล้องถ่ายทอดสดของ ${chan} ชัดทุกจังหวะ ชอบการพากย์สดมาก`,
        `ครึ่งนี้สปีดเกมเร็วดีจัง ดูเพลินไม่มีเบื่อเลย`,
        `แชร์ลิงก์ ${chan} ลงกลุ่มเพื่อนแล้ว คนดู ${ctx.viewers.toLocaleString()} คนแล้ว!`,
        `แฟนต่างทีมแวะมาส่องฟอร์ม บอกเลยเกมนี้คุณภาพสูงจริง`,
        `คู่นี้ ${ctx.homeName} vs ${ctx.awayName} สู้กันสมศักดิ์ศรีมาก`,
        `จังหวะยืนโซนแท็กติกของทั้งสองทีมจัดว่าเข้มข้นเลยวันนี้`,
        `โปรดักชันของ ${chan} ยกระดับบอลไทยขึ้นเยอะมากครับ 👏`,
        `เสียงเชียร์กองเชียร์ทั้งสองฝั่งดังกระหึ่มจอมากตอนนี้`,
        `นั่งวิเคราะห์แท็กติกตามไปด้วย สนุกกว่าดูเฉยๆ เยอะ`,
        `สังเกตพื้นสนามกับสภาพอากาศวันนี้มีผลต่อสปีดบอลเหมือนกันนะ`,
        `ใครเชียร์ ${ctx.awayName} กับใครเชียร์ ${ctx.homeName} รายงานตัวในแชทหน่อย!`,
        `คราวหน้าต้องตามดูถ่ายทอดสดทาง ${chan} ทุกสัปดาห์ซะแล้ว`
      ];

      if (ctx.actor) {
        pool.push(...buildPositionPlayerComments(ctx.actor, ctx.actorPos, ctx.actorRole, ctx.myTeamName));
      }

      if (donateBaht) {
        pool.push(
          `ส่งกำลังใจผ่าน ${chan} ให้ ${ctx.myTeamName} เต็มที่เลยครับ!`,
          `สนับสนุนทีมงานถ่ายทอดสด ${chan} และเชียร์ ${ctx.myTeamName} คว้าชัยวันนี้!`
        );
      }

      text = pickUnique(pool, ctx.usedTexts);
      break;
    }
  }

  if (!text) return null;

  return {
    id: `lc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    m: ctx.m,
    user,
    text,
    tier,
    kind: donateBaht ? 'ambient' : ctx.kind,
    donateBaht
  };
}
