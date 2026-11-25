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
  'เสี่ยหนูสายชิล', 'ครูต้นเชียร์บอล', 'ไอซ์ซ้อมเย็น', 'พี่ตั้มข้างอัฒจันทร์', 'น้องฟ้าขอบสนาม',
  'บ่าววีซอย4', 'เจมส์หน้าเซเว่น', 'ป๊อบสายชิล', 'มิ้นท์ขอลุ้น', 'ตู่หลังประตู'
];

const USERS_MID = [
  'Kittipong_FC', 'บอลไทยสไตล์เรา', 'Nattapong99', 'โค้ชคีย์บอร์ด', 'Poomza_TH',
  'สายแท็กติก', 'SiamFootball', 'Tonkla_Official', 'MheePooh_9', 'ดูบอลวนไป',
  'Winai_Analyze', 'เจตน์วิจารณ์บอล', 'Pat_BallThai', 'โอ๊ตคอบอล', 'Korn_Tactics',
  'บอลสยามรีวิว', 'Beamz_Soccer', 'ตั้ม90นาที', 'Sornchai_Live', 'แชมป์บอลไทย',
  'เบียร์สายปั่น', 'ก้องง่วงจัด', 'อาร์มเด็กหลังห้อง', 'นัทขอสักเม็ด', 'โฟล์คคอบอล'
];

const USERS_HIGH = [
  'UltraSiam_12', 'บิ๊กแฟนคลับ', 'TH_League_Watch', 'ป๋าดันทีมรัก', 'JaoKhao_99',
  'เสือปืนไว', 'Bank_LiveChat', 'FairPlay_TH', 'ChampHunter', 'KengSportLive',
  'GoalRadar_TH', 'ส่องฟอร์มแข้งไทย', 'ProMatch_Viewer', 'Tle_Highlight', 'BKK_StandFan',
  'คอลัมนิสต์ข้างจอ', 'Top_Division1', 'เชียร์ข้ามจังหวัด', 'PitchSide_TH', 'Petch_Goal',
  'สายบวก99', 'ขิงไว้ก่อน', 'แชมป์ว่าวไม่เอา', 'ทีมงานคุณภาพ', 'นิวสายแซว'
];

const USERS_VIRAL = [
  'ThaiFooty_Viral', 'KingOfDerby', 'VIP_Supporter88', 'ดราม่าบอลไทย', 'MegaFan_BKK',
  'ZoomInSoccer', 'ตำนานข้างสนาม', 'SuperChatKing', 'AllStar_Watcher', 'LiveBreaker_TH',
  'Nationwide_12th', 'BigMatch_Alert', 'PrimeTime_TH', 'บอลไทยฟีเวอร์', 'RealUltra_TH',
  'StadiumEcho99', 'GoldenGoal_Live', 'แอดมินสายรีเพลย์', 'ViralPitch_TH', 'LegendSpotter',
  'วุ๊บๆFC', 'แชทไหลไม่หยุด', 'ตึงจัดปลัดบอก', 'ขาประจำช่องแชท', 'ปั่นจัดๆ'
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
      `${pTag} ยืนนิ่งดีนะวันนี้ 🧤`,
      `${pTag} สั่งหลังบ้านเสียงดังมาก 55`,
      `${pTag} ออกบอลช้าไปนิดนึงป่าว`,
      `มี ${pTag} เฝ้าเสาอุ่นใจขึ้นเยอะ`,
      `${pTag} ออกมาตัดบอลกล้าดี`,
      `${pTag} เตะเปิดเกมเสียวหลุดตลอด 😂`,
      `สายตา ${pTag} ไวจัด`,
      `${pTag} อย่าเหม่อนะลูกพี่`,
      `${pTag} เซฟหน้างานดีเกิน`,
      `ไว้ใจ ${pTag} ได้อยู่นะเกมนี้ 🧤`
    ];
  }

  if (pos === 'DF' || role === 'CB' || role === 'LB' || role === 'RB') {
    const isFullback = role === 'LB' || role === 'RB';
    const baseDf = [
      `${pTag} เข้าบอลเด็ดขาดมาก 🛡️`,
      `${pTag} ช้าไปครึ่งก้าวระวังหลุดนะ`,
      `ลูกโหม่ง ${pTag} เก็บเรียบเลย`,
      `${pTag} ชอบจ่ายเสียวหน้าโกล 55`,
      `${pTag} ประกบติดดีแฮะ`,
      `ซ้อนเพื่อนสวย ${pTag}`,
      `${pTag} อย่าเข้าพรวดดิเสียวจุดโทษ`,
      `${pTag} เคลียร์ทิ้งไปก่อนดีละ`,
      `หลังบ้าน ${teamName} ดีที่ ${pTag} แบกอยู่`,
      `${pTag} แข็งจัด ชนไม่ล้มเลย`
    ];
    if (isFullback) {
      return [
        ...baseDf,
        `${pTag} วิ่งขึ้นลงไม่พักเลยแฮะ`,
        `${pTag} เติมแล้วลงทันมั้ยนั่น 55`,
        `${pTag} เปิดริมเส้นได้ลุ้นอยู่นะ`
      ];
    }
    return [
      ...baseDf,
      `${pTag} บล็อกทันพอดีเลย`,
      `${pTag} จ่ายขึ้นหน้านิ่งดี`
    ];
  }

  if (pos === 'MF' || role === 'CDM' || role === 'CM' || role === 'CAM') {
    const isCam = role === 'CAM';
    const isCdm = role === 'CDM';
    const baseMf = [
      `${pTag} คุมจังหวะเนียนดี 🎯`,
      `${pTag} หายไปจากเกมป่าวเนี่ย`,
      `${pTag} จ่ายเสียบ่อยนะวันนี้`,
      `${pTag} ม้วนเยอะไปหน่อย รีบจ่ายสิ`,
      `${pTag} วิ่งเหมือนมีสองปอด 55`,
      `${pTag} เกมนี้แบกกลางเลย`,
      `${pTag} ดึงบอลช้าไปจังหวะนึง`,
      `วิสัยทัศน์ ${pTag} เอาเรื่อง`,
      `${pTag} เก็บบอลสองดีมาก`,
      `${pTag} เพรสซิ่งขยันจัด`
    ];
    if (isCam) {
      return [
        ...baseMf,
        `${pTag} แทงทะลุช่องโคตรสวย`,
        `${pTag} พลิ้วจัดตรงกลาง 🔥`,
        `${pTag} ลองยิงไกลดูบ้างดิ`
      ];
    }
    if (isCdm) {
      return [
        ...baseMf,
        `${pTag} ตัดเกมดุมาก 🛡️`,
        `${pTag} ชนแหลกเลยตรงกลาง 55`,
        `${pTag} คอยซ้อนเพื่อนดีตลอด`
      ];
    }
    return [
      ...baseMf,
      `${pTag} วางยาวแม่นเฉย`,
      `${pTag} เชื่อมเกมดีอยู่นะ`
    ];
  }

  // FW / LW / RW / ST
  const isWinger = role === 'LW' || role === 'RW';
  const baseFw = [
    `${pTag} สปีดจัดจ้าน ⚡`,
    `${pTag} หายไปไหนไม่ค่อยได้บอลเลย`,
    `จังหวะจับบอล ${pTag} คมดี`,
    `${pTag} ยืนล้ำหน้าบ่อยจัง 55`,
    `จังหวะจบ ${pTag} ยังไม่มาแฮะ`,
    `${pTag} ขยันไล่บอลดี`,
    `กองหลังต้องรุม ${pTag} สองคนเลย`,
    `${pTag} ง้างช้าไปนิดนึง`,
    `สอดดีมาก ${pTag} รอลุ้นเม็ดนึง`,
    `${pTag} วันนี้เอาเรื่องอยู่นะ`
  ];
  if (isWinger) {
    return [
      ...baseFw,
      `${pTag} พลิ้วจัดริมเส้น 🔥`,
      `${pTag} ก้มหน้าเลี้ยงมากไปหน่อยป่าว`,
      `${pTag} กระชากหายเลย 55`
    ];
  }
  return [
    ...baseFw,
    `${pTag} พักบอลเนียนอยู่นะ`,
    `${pTag} รอเข้าฮอสในกรอบดี`,
    `${pTag} หาช่องยิงไวดี 🔥`
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
  const act = ctx.actor || 'ตัวรุก';
  const ast = ctx.assist ? ` (+${ctx.assist})` : '';
  const score = `${ctx.gh}-${ctx.ga}`;
  const isMyHome = ctx.homeName === ctx.myTeamName;
  const myScore = isMyHome ? ctx.gh : ctx.ga;
  const oppScore = isMyHome ? ctx.ga : ctx.gh;
  const scoreDiff = myScore - oppScore;
  let text: string | null = null;
  let donateBaht: number | undefined;

  if (ctx.kind === 'club') {
    text = pickUnique(
      [
        `📢 ขอบคุณ ${ctx.viewers.toLocaleString()} คนที่ดูผ่าน ${chan} นะครับ ลุยต่อ ${ctx.myTeamName}!`,
        `⚽ แฟน ${ctx.myTeamName} ทาง ${chan} ส่งเสียงเชียร์กันหน่อย!`,
        `🎙️ สู้เต็มที่เพื่อแฟนบอลที่เชียร์ผ่าน ${chan} อยู่ตอนนี้ครับ!`
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

  const donateChance = tier === 'viral' ? 0.16 : tier === 'high' ? 0.09 : tier === 'mid' ? 0.04 : 0;
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
        `วุ๊!! เข้าแล้ววว!!`,
        `โกวววว!! ⚽`,
        `เอาว่ะ!!`,
        `ตุงงงง!! 🔥`,
        `เรียบร้อย!! (${score})`,
        `GOOOAL!!`,
        `5555 เข้าเฉย`,
        `ปังปุริเย่!!`,
        `โหดเกิ๊น!!`,
        `คมกริบ!!`,
        `${act}!! 🔥🔥`,
        `${act} ของแท้!!`,
        `${act} อย่างเอา!!`,
        `ว่าละต้องเข้า! ${act}`,
        `ยิงโหดมาก ${act}`,
        `สะใจโว้ยย (${score})`,
        `${act}${ast} ตึงจัด (${score})`,
        `แชทแตก!! 🔥`,
        `ค่าตัวพุ่งแล้ว ${act} 55`,
        `โคตรสวยลูกนี้!!`,
        `กรี๊ดบ้านแตกแล้วว`,
        `เออ แบบนี้สิวะ!!`,
        `เฮลั่นซอยเลยเมื่อกี้`
      ];
      if (donateBaht) {
        candidates.push(
          `เอาไปเลย ${act}! สะใจจัด (${score})`,
          `โดเนทฉลอง! ${ctx.myTeamName} ลุยต่อ!`
        );
      }
      text = pickUnique(candidates, ctx.usedTexts);
      break;
    }

    case 'concede': {
      text = pickUnique(
        [
          `อ้าวเห้ย`,
          `โอ๊ยย โดนจนได้`,
          `หลังมัวทำไรกันวะ`,
          `รั่วจัด`,
          `ประกบตัวไหนกันเนี่ย`,
          `ไม่น่ารอด 😓`,
          `เศร้าเลย (${score})`,
          `เอาคืนด่วน!`,
          `พังๆ`,
          `โค้ชหน้าซีดแล้วมั้ง`,
          `ปิดไลฟ์ทันมั้ย 555`,
          `หลุดเฉยเลย`,
          `เหม่อกันทั้งแผง`,
          `เอาจนได้นะฝั่งนู้น`,
          `อย่าเพิ่งท้อ ลุยคืน!`,
          `โดนง่ายไปป่าว`,
          `หัวจะปวด`,
          `แก้เกมด่วนโค้ช! (${score})`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'save': {
      const gkTag = ctx.gkName || (ctx.actorPos === 'GK' || ctx.actorRole === 'GK' ? act : 'โกล');
      text = pickUnique(
        [
          `วุ๊! รอด!!`,
          `เหนียวเกิ๊นน 🧤`,
          `โกลเทพ!!`,
          `${gkTag}!! 🔥`,
          `ปัดได้ไงวะน่ะ`,
          `เซฟชีวิต!`,
          `บินอย่างสวย 🧤`,
          `ใจหายแว้บ`,
          `นึกว่าเข้าแล้ว!`,
          `แบกหลังแอ่นเลย ${gkTag}`,
          `มือติดกาวป่าวเนี่ย 55`,
          `กราบ ${gkTag} งามๆ`,
          `สุดปลายมือเลยโว้ย`,
          `${gkTag} ช่วยไว้แท้ๆ 👏`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'miss': {
      text = pickUnique(
        [
          `อูยยย!! 😱`,
          `เห้ย ไม่เข้าได้ไง`,
          `วืดเฉย 55`,
          `ไปดาวอังคารแล้วมั้ง 55`,
          `เสียดายโว้ย`,
          `จ่อๆ เลยนะ ${act}`,
          `เกือบ!!`,
          `อีกคืบเดียวเอง`,
          `กุมขมับเลย`,
          `โถ่ ${act}!!`,
          `ยิงไรของเอ็งวะ ${act}`,
          `เสาสั่นเลยเมื่อกี้`,
          `ง้างขนาดนั้นไม่เข้าได้ไง`,
          `ลุ้นแทบขาดใจ ไม่เข้าเฉย`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'var': {
      text = pickUnique(
        [
          `VAR อีกละ 📺`,
          `วุ๊ ลุ้น VAR`,
          `เช็กไรนานจัง`,
          `ล้ำป่าว`,
          `อย่าโกงนะจารย์ 🙏`,
          `ดูยังไงก็ฟาวล์`,
          `ใสๆ ไม่มีไรหรอก`,
          `ตัวเกร็งเลยทีนี้`,
          `จารย์ดูจอนานละ`,
          `เสียวสันหลังวาบ`,
          `555 นั่งลุ้นหน้าจอ`,
          `จุดเปลี่ยนเลยนะเนี่ย`,
          `เถียงกันยับ 📺`,
          `เอาให้ชัวร์จารย์`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'card': {
      text = pickUnique(
        [
          `อุ๊ย เหลือง! 🟨`,
          `เข้าหนักจัด`,
          `เสียบซะน่ากลัว`,
          `ใจเย็นพ่อหนุ่ม`,
          `จารย์ควักไวมาก`,
          `เดี๋ยวก็แดงหรอก`,
          `เบรคหน่อย ${ctx.actor || 'เพื่อน'}`,
          `เล่นคนไม่เล่นบอล 55`,
          `เดือดจัดคู่นี้`,
          `ปะทะกันสนั่น`,
          `ฟาวล์โง่ๆ ป่ะเนี่ย`,
          `ระวังโดนไล่ออกนะ`,
          `เหลืองว่อนเลย 🟨`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'sub': {
      text = pickUnique(
        [
          `เปลี่ยนสักที 🔄`,
          `ส่ง ${act} มาแล้ว`,
          `รอดู ${act}`,
          `เปลี่ยนช้าไปป่าวโค้ช`,
          `เอา ${act} ลงมาป่วนหน่อย`,
          `งงแผนเปลี่ยนตัวแฮะ`,
          `ถึงเวลา ${act} โชว์ของ`,
          `ตัวทีเด็ดลงละ`,
          `เปลี่ยนตัวไวดีแฮะ`,
          `${act} ลงมาวิ่งหน่อยโว้ย`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'halftime': {
      text = pickUnique(
        [
          `พักครึ่ง ${score}`,
          `ไปเข้าห้องน้ำแป๊บ`,
          `ครึ่งแรกง่วงนิดหน่อย 55`,
          `ครึ่งแรกเดือดจัด`,
          `ครึ่งหลังต้องแก้เกมละ`,
          `45 นาทีแรกยังไม่สุด`,
          `เล่นดีกว่าที่คิดแฮะ`,
          `พักกินน้ำแป๊บ`,
          `ครึ่งหลังขอมันส์ๆ กว่านี้`,
          `สกอร์ ${score} ครึ่งหลังมีลุ้นอีกเยอะ`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'late': {
      text = pickUnique(
        [
          `อีกแป๊บเดียว! ⏱️`,
          `ทดกี่นาทีวะ`,
          `เสียวมากตอนนี้`,
          `อุดเข้าไป!`,
          `หมดเวลายังเนี่ย`,
          `อย่าพลาดนะโว้ย`,
          `หัวใจจะวาย (${score})`,
          `เวลาเดินช้าจัง`,
          `ทดเจ็บทีไรใจสั่น`,
          `บดให้ยับช่วงท้าย!`
        ],
        ctx.usedTexts
      );
      break;
    }

    case 'fulltime': {
      const ftPool = [
        `จบ!! ${score}`,
        `เย้ จบซะที`,
        `ปวดหัวทั้งเกม 55`,
        `แยกย้ายๆ`,
        `คุ้มค่าดูอยู่นะ`,
        `เหนื่อยแทนนักเตะ`,
        `เจอกันนัดหน้า!`,
        `สรุปใคร MOM`,
        `จบเกม ${score} 👏`
      ];
      if (scoreDiff > 0) {
        ftPool.push(`3 แต้มโว้ยย!!`, `หวานเจี๊ยบ ${score}`, `เล่นโคตรดีวันนี้!`);
      } else if (scoreDiff < 0) {
        ftPool.push(`ฟอร์มแบบนี้ไม่ไหวนะ`, `โค้ชต้องทำการบ้านหนักละ`, `นอนไม่หลับแน่คืนนี้`);
      } else {
        ftPool.push(`แบ่งแต้มกันไป`, `เกือบชนะแล้วแท้ๆ`, `เสมอก็ยังดีวะ`);
      }
      text = pickUnique(ftPool, ctx.usedTexts);
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
      // Short colorful reactions, interjections, memes, casual critiques, and viewer banter
      const shortHypeAndNoise: string[] = [
        `วุ๊`,
        `วุ๊ววว`,
        `เอาาา`,
        `เอาเรื่องง`,
        `ลุยยย`,
        `ปัง`,
        `จึ้ง`,
        `เชรดด`,
        `ป๊าดดด`,
        `อู้วว`,
        `โอ๊ยย`,
        `เห้ยย`,
        `อ้าว`,
        `หืมม`,
        `5555`,
        `555555`,
        `ฮ่าๆๆ`,
        `111`,
        `999`,
        `🔥🔥🔥`,
        `⚽⚽`,
        `👏👏`,
        `👀👀`,
        `จ๊าบจัด`,
        `ตึงเปรี๊ยะ`,
        `เดือด!!`,
        `ลั่นเลย`,
        `สุดจัด`,
        `โหดเกิ๊น`,
        `เสียวโว้ย`,
        `มาดิค้าบ`,
        `เอาหน่อย`,
        `ตื่นๆ`,
        `ง่วงแฮะ`,
        `เร่งดิ`,
        `ขอลุ้นหน่อย`,
        `ใจจะวาย`,
        `ว้าวซ่า`,
        `ทรงดีจัด`,
        `โหหห`,
        `ดุดันมาก`,
        `ไม่ไหวละ 55`
      ];

      const critiquesAndBanter: string[] = [
        `เล่นไรกันเนี่ย`,
        `ส่งคืนหลังอยู่นั่น`,
        `เคาะบอลช้ามาก`,
        `โยนอย่างเดียวเลยหรอ`,
        `กลางหายไปไหนหมด`,
        `แนวรับอย่าเหม่อดิ`,
        `หน้าไม่วิ่งเลยแฮะ`,
        `จ่ายขาดๆ เกินๆ`,
        `โดนเพรสจนลนละ`,
        `ทำไมไม่ยิงวะ`,
        `ม้วนอยู่นั่นแหละ 55`,
        `จับบอลลั่นบ่อยจัง`,
        `โค้ชยืนสั่งหน่อย`,
        `แก้เกมเหอะทรงนี้`,
        `เปลี่ยนตัวได้ยัง`,
        `กรรมการเป่าแปลกๆ นะ`,
        `เป่าเอียงป่าว 55`,
        `คู่แข่งเล่นหนักเกิ๊น`,
        `วิ่งหน่อยลูกเพ่`,
        `หมดแรงกันแล้วมั้ง`,
        `สนามแอบหนืดๆ ป่ะเนี่ย`,
        `บอลวิ่งแปลกๆ แฮะ`,
        `วันนี้จังหวะไม่เข้าขาเลย`,
        `ทรงบอลใช้ได้อยู่`,
        `เริ่มต่อบอลติดละ`,
        `กดดันต่ออย่าผ่อน!`,
        `บีบสูงเลยลูกพี่`,
        `ช่องซ้ายโล่งมาก`,
        `ฝั่งขวาเงียบกริบ`,
        `เกมตึงมากแม่`
      ];

      const viewerChatter: string[] = [
        `เพิ่งเข้ามา ใครนำ`,
        `สกอร์เท่าไหร่แล้ว`,
        `ดูชัดแจ๋วเลย`,
        `แอบนายดูอยู่ 555`,
        `ข้าวเย็นยังไม่กินติดบอล`,
        `เน็ตใครกระตุกมั่ง`,
        `แชทไหลจัด`,
        `${chan} ชัดอยู่นะ`,
        `ดูช่อง ${chan} ยาวๆ`,
        `${ctx.homeName} สู้ๆ`,
        `เชียร์ ${ctx.awayName} เงียบๆ`,
        `เสียงกลองเชียร์อย่างดัง`,
        `ใครเชียร์ ${ctx.myTeamName} กด 1`,
        `แฟน ${ctx.oppTeamName} เยอะนะวันนี้`,
        `คู่นี้สูสีแฮะ`,
        `ครึ่งนี้มันส์อยู่นะ`,
        `ดูจากที่ทำงาน 55`,
        `${ctx.myTeamName} ต้องชนะเท่านั้น`
      ];

      const scoreAware: string[] =
        scoreDiff < 0
          ? [
              `โดนนำแล้วโว้ย รีบเอาคืน`,
              `เล่นแบบนี้จะตีเสมอไงเนี่ย`,
              `ขอลูกตีเสมอหน่อยเถอะ`,
              `เกมรับมีปัญหาละวันนี้`,
              `ต้องดันสูงแล้วโค้ช!`
            ]
          : scoreDiff > 0
            ? [
                `นำแล้วอย่าผ่อนนะ`,
                `ปิดเกมดิรอไร`,
                `อุดเลยมั้ยโค้ช 555`,
                `ระวังโดนสวนนะ`,
                `หวานเจี๊ยบเลยตอนนี้`,
                `3 แต้มไม่หนีไปไหน`
              ]
            : [
                `อึดอัดจัด เสมออยู่เลย`,
                `ใครจะยิงก่อนวะ`,
                `ขอสักลูกเถอะ!`,
                `เจาะไม่เข้าเลยแฮะ`,
                `จังหวะสุดท้ายไม่มาสักที`
              ];

      const pool: string[] = [
        ...shortHypeAndNoise,
        ...critiquesAndBanter,
        ...viewerChatter,
        ...scoreAware
      ];

      // Mix position-accurate player banter in ~35% of ambient pulls so chat isn't overly repetitive on player commentary
      if (ctx.actor && Math.random() < 0.38) {
        pool.push(...buildPositionPlayerComments(ctx.actor, ctx.actorPos, ctx.actorRole, ctx.myTeamName));
      }

      if (donateBaht) {
        pool.push(
          `ส่งกำลังใจให้ ${ctx.myTeamName} เต็มที่!`,
          `เอาไปซื้อน้ำให้นักเตะหน่อย 55`,
          `สู้เว้ยย ${ctx.myTeamName}!!`
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
