import { P, R } from '../utils/math';

export type StreamViewerTier = 'low' | 'mid' | 'high' | 'viral';

export type LiveCommentKind = 'ambient' | 'goal' | 'concede' | 'save' | 'miss' | 'card' | 'var' | 'sub' | 'halftime' | 'late' | 'fulltime' | 'player' | 'club';

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
  'อาเฮียร้านกาแฟ', 'ต้อมบอลเดินสาย', 'ป้าแต๋วขาประจำ', 'กอล์ฟทีมท้องถิ่น', 'น้าชัยริมรั้ว'
];

const USERS_MID = [
  'Kittipong_FC', 'บอลไทยสไตล์เรา', 'Nattapong99', 'โค้ชคีย์บอร์ด', 'Poomza_TH',
  'สายแท็กติก', 'SiamFootball', 'Tonkla_Official', 'MheePooh_9', 'ดูบอลวนไป'
];

const USERS_HIGH = [
  'UltraSiam_12', 'บิ๊กแฟนคลับ', 'TH_League_Watch', 'ป๋าดันทีมรัก', 'JaoKhao_99',
  'เสือปืนไว', 'Bank_LiveChat', 'FairPlay_TH', 'ChampHunter', 'KengSportLive'
];

const USERS_VIRAL = [
  'ThaiFooty_Viral', 'KingOfDerby', 'VIP_Supporter88', 'ดราม่าบอลไทย', 'MegaFan_BKK',
  'ZoomInSoccer', 'ตำนานข้างสนาม', 'SuperChatKing', 'AllStar_Watcher', 'LiveBreaker_TH'
];

const pickUser = (tier: StreamViewerTier): string => {
  if (tier === 'viral') return P([...USERS_VIRAL, ...USERS_HIGH]);
  if (tier === 'high') return P([...USERS_HIGH, ...USERS_MID]);
  if (tier === 'mid') return P([...USERS_MID, ...USERS_LOW]);
  return P(USERS_LOW);
};

export interface LiveCommentContext {
  m: number;
  viewers: number;
  kind: LiveCommentKind;
  homeName: string;
  awayName: string;
  myTeamName: string;
  oppTeamName: string;
  actor?: string;
  assist?: string;
  gh: number;
  ga: number;
  playerModeName?: string;
  playerModeNo?: number | null;
}

export function generateLiveStreamComment(ctx: LiveCommentContext): LiveCommentItem {
  const tier = getStreamViewerTier(ctx.viewers);
  const user = ctx.kind === 'club' ? `${ctx.myTeamName} (Official)` : pickUser(tier);
  const act = ctx.actor || 'ตัวเก่ง';
  const ast = ctx.assist ? ` (จ่ายโดย ${ctx.assist})` : '';
  const score = `${ctx.gh}-${ctx.ga}`;
  let text = '';
  let donateBaht: number | undefined;

  if (ctx.kind === 'club') {
    text = P([
      `📢 ขอบคุณแฟนบอลทั้ง ${ctx.viewers.toLocaleString()} คนที่รับชมสด! กดแชร์เป็นกำลังใจให้ ${ctx.myTeamName} ด้วยนะครับ`,
      `🏟️ เสียงเชียร์ในไลฟ์ส่งถึงนักเตะ ${ctx.myTeamName} แน่นอน ลุยต่อครับ!`
    ]);
    return {
      id: `lc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      m: ctx.m,
      user,
      text,
      tier,
      kind: 'club'
    };
  }

  // Chance of SuperChat/Donate increases strongly with viewer tier
  const donateChance = tier === 'viral' ? 0.24 : tier === 'high' ? 0.14 : tier === 'mid' ? 0.05 : 0;
  const shouldDonate =
    donateChance > 0 &&
    (ctx.kind === 'goal' || ctx.kind === 'save' || ctx.kind === 'ambient' || ctx.kind === 'late') &&
    Math.random() < donateChance;

  if (shouldDonate) {
    donateBaht = tier === 'viral' ? P([200, 500, 1000, 2000]) : tier === 'high' ? P([100, 200, 500]) : P([50, 100]);
  }

  switch (ctx.kind) {
    case 'goal': {
      if (tier === 'low') {
        text = P([
          `เฮลั่นซอยแล้ววว! ${act} ยิงสวยมาก!`,
          `เข้าแล้วโว้ยย ${act}${ast} สุดยอด!`,
          `คนดูไม่เยอะแต่เสียงกรี๊ดดังมาก! ${score}`
        ]);
      } else if (tier === 'mid') {
        text = P([
          `GOOOAL!! ${act}${ast} จบสกอร์เฉียบขาดมาก! (${score})`,
          `กดหัวใจรัวๆ ให้ ${act} เลยลูกนี้ โคตรคม!`,
          `แอดมินซูมหน้า ${act} หน่อย ยิงอย่างสวย!`
        ]);
      } else if (tier === 'high') {
        text = P([
          `ตุงตาข่าย!! ${act}${ast} แชทเดือดจัดตอนนี้ (${score}) 🔥`,
          `ค่าตัวต้องพุ่งแล้วไหมลูกนี้ ${act} โคตรสุด!!`,
          `คนดูทะลุหมื่นเป็นพยานประตูสุดสวยของ ${act}!`
        ]);
      } else {
        text = P([
          `GOOOOOAL!! ${act}${ast} ไลฟ์แตกแล้วโว้ยย!! 🔥🔥`,
          `แชทวิ่งเป็นน้ำตก! ${act} ยิงระดับโลก (${score})!!`,
          `รีเพลย์สิบตลบเลยลูกนี้ ${act} ทำได้ไง!!`
        ]);
      }
      if (donateBaht) {
        text = `ส่งกำลังใจให้ ${ctx.myTeamName}! สุดจัดเลย ${act}!`;
      }
      break;
    }

    case 'concede': {
      text =
        tier === 'low'
          ? P([`อ้าว โดนจนได้ ไม่เป็นไรเอาใหม่นะ ${ctx.myTeamName}`, `สมาธิหน่อยหลังบ้าน สู้ต่อๆ!`])
          : tier === 'mid'
            ? P([`โดนเฉยเลย ต้องรีบแก้เกมแล้วโค้ช!`, `เกมรับหลวมไปนิดจังหวะเมื่อกี้ ยังมีเวลาเอาคืน`])
            : P([
                `โอ้โห โดนเฉย! แฟนทีมเยือนเฮลั่นแชทเลย (${score})`,
                `ตั้งสติกลับมาให้ไว ${ctx.myTeamName} เดี๋ยวยิงคืนได้!`
              ]);
      break;
    }

    case 'save': {
      text =
        tier === 'low'
          ? P([`โห โกลเซฟช่วยชีวิตเลย!`, `เหนียวมากลูกเมื่อกี้ นึกว่าเข้าแล้ว`])
          : tier === 'mid'
            ? P([`เซฟมหัศจรรย์! ปรบมือให้ผู้รักษาประตูเลย 👏`, `บินปัดได้ไงวะน่ะ! สุดจัด`])
            : P([
                `SUPER SAVE!! ช็อตเซฟแห่งสัปดาห์ต้องมาแล้ว! 🔥`,
                `มือเหนียวระดับทีมชาติ! แชทพิมพ์ 1 ให้โกลหน่อย!`
              ]);
      break;
    }

    case 'miss': {
      text =
        tier === 'low'
          ? P([`โอ๊ย เฉียดนิดเดียว! เกือบได้เฮแล้ว`, `อีกนิดเดียวๆ ${act} ลุยใหม่!`])
          : P([
              `อูยยย! แฟนบอลในไลฟ์เอามือกุมหัวกันหมดแล้ว 😱`,
              `จังหวะนี้ ${act} น่าจะใส่สกอร์ได้นะ เสียดายแทน!`
            ]);
      break;
    }

    case 'var': {
      text =
        tier === 'low'
          ? P([`เฮ้ย กรรมการเช็ก VAR เหรอ ลุ้นตัวโก่ง!`, `ขอให้เป็นใจกับเราเถอะ VAR 🙏`])
          : tier === 'mid'
            ? P([`ดูภาพช้าในไลฟ์แล้วเสียวมาก VAR จะว่าไง!`, `แชทนิ่งรอคำตัดสิน VAR กันทั้งห้องแล้ว`])
            : P([
                `VAR ดราม่ามาแล้ว!! แชทเถียงกันยับเลยตอนนี้ 📺`,
                `ซูมภาพช้าให้ชัดๆ หน่อยแอด! จังหวะนี้มีลุ้นจุดเปลี่ยน!`
              ]);
      break;
    }

    case 'card': {
      text =
        tier === 'low'
          ? P([`โอ้โห โดนใบเหลือง/แดงเฉย จังหวะหนักจริง`, `ใจเย็นๆ หน่อยนะทุกคน อย่าเสียฟาวล์ง่าย`])
          : P([
              `เข้าบอลแรงจัด! แฟนบอลในแชทฮือฮากันใหญ่ 🟨🟥`,
              `จังหวะนี้โดนจดชื่อไม่แปลกเลย เกมกำลังเดือด!`
            ]);
      break;
    }

    case 'sub': {
      text =
        tier === 'low'
          ? P([`เปลี่ยนตัวแล้ว ส่ง ${act} ลงมาเติมความสด`, `มาดูกันว่า ${act} จะเปลี่ยนเกมได้ไหม`])
          : P([
              `โค้ชขยับหมากส่ง ${act} ลงสนามแล้ว! รอดูทีเด็ดเลย 🔄`,
              `แฟนๆ รอเชียร์ ${act} อยู่ ลงมาจัดหน่อย!`
            ]);
      break;
    }

    case 'halftime': {
      text =
        tier === 'low'
          ? P([`พักครึ่งพอดี ไปต้มมาม่ารอก่อนนะ 😂`, `ครึ่งแรกสูสีดี ครึ่งหลังมาดูต่อกันครับ`])
          : tier === 'mid'
            ? P([`จบครึ่งแรก ${score} ครึ่งหลังต้องปรับเกมรุกเพิ่มนิดนึง`, `ภาพไลฟ์คมชัดมากครับ พักครึ่งดูสถิติเพลินเลย`])
            : P([
                `พักครึ่งยอดคนดูยังแน่น ${ctx.viewers.toLocaleString()} คน! ครึ่งหลังเดือดกว่านี้แน่`,
                `วิเคราะห์ครึ่งแรกกันหน่อย ใครเด่นสุดใน 45 นาทีแรก?`
              ]);
      break;
    }

    case 'late': {
      text =
        tier === 'low'
          ? P([`ท้ายเกมแล้ว ลุ้นจนนั่งไม่ติดเก้าอี้!`, `อีกไม่กี่นาที อดทนไว้นะ ${ctx.myTeamName}!`])
          : P([
              `เข้าสู่ช่วงท้ายเกมแล้ว ยอดคนดูพุ่งกระฉูดเลย!! ⏱️`,
              `หัวใจจะวาย นาทีบาปแบบนี้ใครพลาดมีน้ำตาแน่นอน!`
            ]);
      break;
    }

    case 'fulltime': {
      text =
        tier === 'viral'
          ? P([`จบเกมสุดมันส์ ${score}! ยอดคนดูถล่มทลาย ขอบคุณทีมงานถ่ายทอดสดด้วยครับ! 👏`, `แมตช์ระดับตำนาน! ใครดูสดคุ้มค่าเน็ตสุดๆ`])
          : tier === 'high'
            ? P([`จบเกม ${score}! สนุกมากนัดนี้ เจอกันใหม่ไลฟ์หน้าครับ`, `ไลฟ์สดลื่นไหลดีมาก ขอบคุณทุกคนที่ร่วมเชียร์!`])
            : P([`จบเกม ${score} แล้วครับ แยกย้ายพักผ่อน เจอกันแมตช์หน้า!`, `ขอบคุณแอดมินที่ถ่ายทอดให้ดูจนจบเกมนะครับ ❤️`]);
      break;
    }

    case 'player': {
      const pTag = ctx.playerModeName ? `${ctx.playerModeNo ? `#${ctx.playerModeNo} ` : ''}${ctx.playerModeName}` : act;
      text = P([
        `จับตาดูฟอร์ม ${pTag} นัดนี้หน่อย พลิ้วมาก!`,
        `${pTag} วันนี้เล่นโคตรเนียน แฟนในแชทชมไม่ขาดปาก 👏`,
        `มีใครมาดูไลฟ์นี้เพราะตามเชียร์ ${pTag} โดยเฉพาะบ้าง? ⭐`
      ]);
      break;
    }

    case 'ambient':
    default: {
      if (tier === 'low') {
        text = P([
          `แวะมาเชียร์ ${ctx.homeName} ครับ ภาพชัดเสียงแจ๋ว`,
          `คนดูยังไม่เยอะ แต่อบอุ่นดีครับ ลุยๆ!`,
          `ฝากทักทายพี่ๆ ข้างสนามด้วย วันนี้แดดดี/อากาศดีมาก`,
          `ดูจากที่บ้านสบายเลย ทีมรักสู้ๆ!`,
          `เพิ่งเลิกงานรีบเปิดไลฟ์ดูเลย ทันพอดี`
        ]);
      } else if (tier === 'mid') {
        text = P([
          `แชร์ไลฟ์ลงกลุ่มแล้วครับ คนดู ${ctx.viewers.toLocaleString()} คนแล้ว!`,
          `จังหวะต่อบอลวันนี้ ${ctx.myTeamName} ดูดีกว่าที่คิดแฮะ`,
          `มุมกล้องดีขึ้นเยอะเลย ชอบการพากย์สดมากครับ`,
          `ใครมอง ${act} อยู่บ้าง เล่นขยันมากเกมนี้`,
          `ครึ่งนี้เกมเร็วดีจัง ดูเพลินไม่มีเบื่อ`
        ]);
      } else if (tier === 'high') {
        text = P([
          `คนดูทะลุ ${Math.floor(ctx.viewers / 1000)}K แล้ว! คู่ ${ctx.homeName} vs ${ctx.awayName} เดือดจริง`,
          `แฟนต่างทีมแวะมาส่องฟอร์ม บอกเลยเกมคุณภาพมาก`,
          `คอมเมนต์วิ่งไวมาก กดไลก์ให้กำลังใจทีมงานด้วยครับ`,
          `บรรยากาศในสนามเสียงดังทะลุไลฟ์เลย ขนลุก!`,
          `เกมระดับนี้สปอนเซอร์ต้องเข้าอีกเพียบแน่นอน!`
        ]);
      } else {
        text = P([
          `คนดู ${Math.floor(ctx.viewers / 1000)}K+ ทั้งประเทศรอดูคู่นี้อยู่!! 🔥`,
          `โปรดักชันระดับพรีเมียม ภาพคมกริบทุกมุมกล้องเลย!`,
          `แชทไหลเป็นน้ำตก อ่านไม่ทันแล้ววว 😂🔥`,
          `กดซับช่องรอเลย คอนเทนต์ถ่ายทอดสดโคตรสุด!`,
          `คู่บิ๊กแมตช์ที่แท้จริง เสียงเชียร์กระหึ่มสุดๆ`
        ]);
      }
      if (donateBaht) {
        text =
          tier === 'viral'
            ? P([`จัดไปค่ากาแฟทีมงานถ่ายทอดสด! เชียร์ ${ctx.myTeamName} เต็มที่!`, `สมทบทุนสโมสรครับ ขอ 3 แต้มสวยๆ นะวันนี้!`])
            : `แวะส่งกำลังใจให้ ${ctx.myTeamName} และทีมไลฟ์สดครับ!`;
      }
      break;
    }
  }

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
