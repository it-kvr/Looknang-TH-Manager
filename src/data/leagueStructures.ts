import type { Team } from '../types/game';
import { BASE, COUNTRY_META_BY_CODE, FOREIGN_CLUB_CATALOG, TN, getForeignTeamCountryMeta, type ForeignConfed, type ForeignNameRegion } from './thaiFootballData';

export const T3_ZONE_NAMES = ['โซนเหนือ-อีสาน', 'โซนกลาง-ใต้'] as const;

export function getT3ZoneLabel(zone?: number): string {
  return zone === 1 ? T3_ZONE_NAMES[1] : T3_ZONE_NAMES[0];
}

export interface DomesticLeagueSpec {
  tier: 0 | 1 | 2;
  name: string;
  shortName: string;
  teamCount: number;
  zones: number;
  teamsPerZone: number;
  matchdays: number;
  promoAuto: number;
  playoffRanks: number[];
  relSpots: number;
  aclEliteSpots: number;
  acl2Spots: number;
}

export const DOMESTIC_LEAGUE_SPECS: Record<0 | 1 | 2, DomesticLeagueSpec> = {
  2: {
    tier: 2,
    name: 'ไทยลีก 1',
    shortName: 'T1',
    teamCount: 16,
    zones: 1,
    teamsPerZone: 16,
    matchdays: 30,
    promoAuto: 0,
    playoffRanks: [],
    relSpots: 3,
    aclEliteSpots: 1,
    acl2Spots: 2
  },
  1: {
    tier: 1,
    name: 'ไทยลีก 2',
    shortName: 'T2',
    teamCount: 18,
    zones: 1,
    teamsPerZone: 18,
    matchdays: 34,
    promoAuto: 2,
    playoffRanks: [3, 4, 5, 6],
    relSpots: 3,
    aclEliteSpots: 0,
    acl2Spots: 0
  },
  0: {
    tier: 0,
    name: 'ไทยลีก 3',
    shortName: 'T3',
    teamCount: 24,
    zones: 2,
    teamsPerZone: 12,
    matchdays: 22,
    promoAuto: 1, // 1 per zone (2 total) + 1 Cross-Zone Playoff winner = 3 promoted
    playoffRanks: [2, 3], // per zone -> 4 teams cross-zone playoff
    relSpots: 0,
    aclEliteSpots: 0,
    acl2Spots: 0
  }
};

export interface SeasonCalendarMds {
  totalMd: number;
  w1Start: number;
  w1End: number;
  w2Start: number;
  w2End: number;
  sc: number[];
  ac: number[];
  lc: number[];
  dc: number[];
  cup: number[];
}

export function getSeasonCalendarMds(totalMd: number): SeasonCalendarMds {
  const safeTotal = Math.max(18, Math.round(totalMd || 30));
  if (safeTotal <= 24) {
    // ไทยลีก 3 (22 นัด)
    return {
      totalMd: safeTotal,
      w1Start: 0,
      w1End: 5,
      w2Start: 10,
      w2End: 14,
      sc: [2],
      ac: [3, 8, 13, 18],
      lc: [4, 9, 14, 19],
      dc: [5, 10, 15, 20],
      cup: [6, 11, 16, 21]
    };
  }
  if (safeTotal <= 31) {
    // ไทยลีก 1 (30 นัด)
    return {
      totalMd: safeTotal,
      w1Start: 0,
      w1End: 6,
      w2Start: 14,
      w2End: 20,
      sc: [2],
      ac: [3, 10, 17, 24],
      lc: [4, 11, 18, 25],
      dc: [5, 12, 19, 26],
      cup: [6, 13, 20, 27]
    };
  }
  // ไทยลีก 2 (34 นัด) หรือมากกว่า
  return {
    totalMd: safeTotal,
    w1Start: 0,
    w1End: 6,
    w2Start: 16,
    w2End: 22,
    sc: [2],
    ac: [3, 11, 19, 27],
    lc: [4, 12, 20, 28],
    dc: [5, 13, 21, 29],
    cup: [6, 14, 22, 30]
  };
}

export type ZoneTone = 'champ' | 'acl_elite' | 'acl2' | 'promo' | 'playoff' | 'rel_po' | 'rel' | 'neutral';

export interface ZoneBadgeInfo {
  tone: ZoneTone;
  label: string;
  shortLabel: string;
  rowCls: string;
  badgeCls: string;
}

export interface WorldLeagueZoneRule {
  fromRank: number;
  toRank: number;
  tone: ZoneTone;
  label: string;
  shortLabel: string;
}

export interface WorldClubSeed {
  name: string;
  baseOvr: number;
  kc: [string, string];
}

export interface WorldLeagueSpec {
  code: string;
  name: string;
  shortName: string;
  country: string;
  flag: string;
  confed: ForeignConfed;
  region: ForeignNameRegion;
  teamCount: number;
  roundsMultiplier: 1 | 2 | 3;
  matchdays: number;
  baseOvr: number;
  noRelegation?: boolean;
  note?: string;
  zones: WorldLeagueZoneRule[];
  clubs: WorldClubSeed[];
}

const TONE_CLASSES: Record<ZoneTone, { rowCls: string; badgeCls: string }> = {
  champ: {
    rowCls: 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500',
    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700'
  },
  acl_elite: {
    rowCls: 'bg-emerald-50/70 dark:bg-emerald-950/25 border-l-4 border-l-emerald-600',
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
  },
  acl2: {
    rowCls: 'bg-sky-50/70 dark:bg-sky-950/25 border-l-4 border-l-sky-500',
    badgeCls: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700'
  },
  promo: {
    rowCls: 'bg-emerald-50/70 dark:bg-emerald-950/25 border-l-4 border-l-emerald-500',
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
  },
  playoff: {
    rowCls: 'bg-indigo-50/70 dark:bg-indigo-950/25 border-l-4 border-l-indigo-500',
    badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700'
  },
  rel_po: {
    rowCls: 'bg-orange-50/70 dark:bg-orange-950/25 border-l-4 border-l-orange-500',
    badgeCls: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-700'
  },
  rel: {
    rowCls: 'bg-rose-50/75 dark:bg-rose-950/25 border-l-4 border-l-rose-500',
    badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700'
  },
  neutral: {
    rowCls: '',
    badgeCls: ''
  }
};

export function getToneClasses(tone: ZoneTone): { rowCls: string; badgeCls: string } {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

const WORLD_KIT_PALETTES: [string, string][] = [
  ['#1d4ed8', '#ffffff'],
  ['#dc2626', '#ffffff'],
  ['#15803d', '#ffffff'],
  ['#111827', '#facc15'],
  ['#0284c7', '#0f172a'],
  ['#b91c1c', '#facc15'],
  ['#7c3aed', '#ffffff'],
  ['#ea580c', '#111827'],
  ['#0f766e', '#ffffff'],
  ['#eab308', '#1e293b'],
  ['#be123c', '#ffffff'],
  ['#1e3a8a', '#38bdf8'],
  ['#ffffff', '#1d4ed8'],
  ['#ffffff', '#dc2626']
];

const EXTRA_CITY_WORDS_BY_CODE: Record<string, { cities: string[]; suffixes: string[] }> = {
  GB: {
    cities: ['เชลซี', 'อาร์เซนอล', 'สเปอร์ส', 'นิวคาสเซิล', 'เวสต์แฮม', 'ไบรท์ตัน', 'วูล์ฟส์', 'ฟูแล่ม', 'คริสตัล พาเลซ', 'เบรนท์ฟอร์ด', 'เอฟเวอร์ตัน', 'น็อตติ้งแฮม', 'บอร์นมัธ', 'เลสเตอร์', 'อิปสวิช', 'เซาแธมป์ตัน', 'ลีดส์', 'เบิร์นลีย์'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้', 'โรเวอร์ส', 'แอธเลติก', 'แวนเดอเรอร์ส']
  },
  ES: {
    cities: ['บาเลนเซีย', 'บิลเบา', 'โซเซียดาด', 'เบติส', 'บียาร์เรอัล', 'แอตเลติโก', 'คิโรนา', 'โอซาซูนา', 'เซลตา', 'มายอร์กา', 'เกตาเฟ', 'ราโย', 'ลา กอรุนญา', 'อาลาเบส', 'เลกาเนส', 'เอสปันญอล', 'บายาโดลิด', 'ลาส ปัลมาส'],
    suffixes: ['เอฟซี', 'ซีเอฟ', 'ยูดี', 'อาร์ซี', 'คลับ', 'สปอร์ติ้ง']
  },
  DE: {
    cities: ['เลเวอร์คูเซิน', 'ไลป์ซิก', 'สตุ๊ตการ์ต', 'ไฟร์บวร์ก', 'โวล์ฟสบวร์ก', 'กลัดบัค', 'เบรเมน', 'ฮอฟเฟนไฮม์', 'ไมนซ์', 'เอาส์บวร์ก', 'อูนิโอน', 'โบคุม', 'ซังต์ เพาลี', 'คีล', 'ไฮเดนไฮม์', 'ฮัมบูร์ก', 'โคโลญจน์'],
    suffixes: ['เอฟซี', 'เอสซี', 'เอสเฟา', '04', 'ยูไนเต็ด']
  },
  IT: {
    cities: ['นาโปลี', 'อตาลันตา', 'ลาซิโอ', 'ฟิออเรนตินา', 'โบโลญญา', 'โตริโน', 'อูดิเนเซ', 'เจนัว', 'เลชเช', 'ปาร์มา', 'โกโม', 'เวโรนา', 'กายารี', 'เอ็มโปลี', 'เวเนเซีย', 'มอนซา', 'ปาแลร์โม', 'ซามพ์โดเรีย'],
    suffixes: ['คัลโช', 'เอฟซี', 'เอสเอส', 'เอซี', 'สปอร์ต']
  },
  FR: {
    cities: ['โมนาโก', 'ลีลล์', 'นีซ', 'แบรสต์', 'ล็องส์', 'แรนส์', 'ตูลูส', 'สตราสบูร์ก', 'แร็งส์', 'น็องต์', 'โอแซร์', 'อ็องเชร์', 'เลอ อาฟร์', 'แซงต์ เอเตียน', 'มงต์เปลลิเยร์', 'บอร์กโดซ์'],
    suffixes: ['เอฟซี', 'เอสซี', 'แอตเลติก', 'โอลิมปิก']
  },
  PT: {
    cities: ['เบนฟิกา', 'บรากา', 'กิมาไรส์', 'ซานตา คลารา', 'ฟามาลิเกา', 'เอสโตริล', 'กาซา ปิอา', 'กิล วิเซนเต', 'โมเรยเรนเซ', 'อารูกา', 'รีโอ อาเว', 'นาซิอองนาล', 'อาเวส', 'ฟาเรนเซ', 'บัววิสตา', 'เอสเตรลา', 'ปาซอส'],
    suffixes: ['เอฟซี', 'เอสซี', 'ซีดี', 'ยูไนเต็ด']
  },
  NL: {
    cities: ['ไอนด์โฮเฟน', 'อัลค์มาร์', 'ทเวนเต้', 'อูเทรคท์', 'โก อะเฮด', 'ไนเมเกน', 'ฮีเรนวีน', 'สปาร์ตา', 'ซโวลล์', 'โกรนิงเกน', 'ฟอร์ทูนา', 'ฮีราเคิลส์', 'เบรดา', 'ทิลบูร์ก', 'วาลไวก์', 'อัลเมเร'],
    suffixes: ['เอฟซี', 'เอสซี', 'ซิตี้', 'สปอร์ต']
  },
  JP: {
    cities: ['โกเบ', 'ฮิโรชิมา', 'คาชิมะ', 'คาวาซากิ', 'โยโกฮามา', 'อุราวะ', 'มาจิดะ', 'นาโกยา', 'ซัปโปโร', 'ฟุกุโอกะ', 'คาวาซุ', 'คาชิวะ', 'อัลบิเร็กซ์', 'เกียวโต', 'โชแนน', 'อิวาตะ', 'โทสุ', 'เซนได', 'ชิมิซุ'],
    suffixes: ['เอฟซี', 'แอนท์เลอร์ส', 'ยูไนเต็ด', 'ฟรอนตาเล', 'วิสเซล']
  },
  KR: {
    cities: ['อุลซาน', 'โปฮัง', 'ควังจู', 'คังวอน', 'แทจอน', 'แทกู', 'เชจู', 'ซูวอน', 'ชอนบุก', 'อินชอน', 'กิมชอน'],
    suffixes: ['เอฟซี', 'เอชดี', 'ยูไนเต็ด', 'ซิตี้']
  },
  CN: {
    cities: ['เฉิงตู', 'ซานตง', 'เทียนจิน', 'เจ้อเจียง', 'อู่ฮั่น', 'เหอหนาน', 'ชิงเต่า', 'ฉางชุน', 'เหมยโจว', 'เสิ่นเจิ้น', 'ต้าเหลียน', 'หนานทง', 'ซูโจว', 'ฉงชิ่ง'],
    suffixes: ['เอฟซี', 'ซิตี้', 'ยูไนเต็ด', 'ดราก้อนส์']
  },
  SA: {
    cities: ['อัล-ฮิลาล', 'อัล-อิตติฮัด', 'อัล-นาสเซอร์', 'อัล-อาห์ลี', 'อัล-ชาบับ', 'อัล-กาดซิยาห์', 'อัล-เอตติฟาค', 'อัล-ตาอาวูน', 'อัล-คาเลจ', 'อัล-ฟาเตห์', 'อัล-ริยาด', 'ดามัค', 'อัล-ไฟฮา', 'อัล-เวห์ดา', 'อัล-โอรูบาห์', 'อัล-อักดูด'],
    suffixes: ['คลับ', 'เอสซี', 'เอฟซี']
  },
  AE: {
    cities: ['อัล-ไอน์', 'ชาบับ อัล-อาห์ลี', 'อัล-วาห์ดา', 'ชาร์จาห์', 'อัล-วาซล์', 'อัล-จาซีรา', 'อัล-นาสร์', 'อัจมาน', 'คอร์ฟักคาน', 'อัล-บาตาเอห์', 'บันยาส', 'กัลบา'],
    suffixes: ['เอฟซี', 'เอสซี', 'คลับ']
  },
  QA: {
    cities: ['อัล-ซาดด์', 'อัล-ดูฮาอิล', 'อัล-การาฟา', 'อัล-รายยาน', 'อัล-อาห์ลี โดฮา', 'อัล-วาคราห์', 'กาตาร์ เอสซี', 'อัล-อาราบี', 'อัมม์ ซาลาล', 'อัล-คอร์'],
    suffixes: ['เอสซี', 'เอฟซี', 'คลับ']
  },
  IR: {
    cities: ['เปอร์เซโปลิส', 'เอสเตกลัล', 'แทรคเตอร์', 'เซปาฮาน', 'ฟูลาด', 'กอล โกฮาร์', 'โซบ อาฮาน', 'มาลาวาน', 'ชาดอร์มาลู', 'นัสซาจี', 'อาลูมิเนียม', 'ฮาวาดาร์', 'เมส ราฟซานจาน', 'เคย์บาร์'],
    suffixes: ['เอฟซี', 'เอสซี', 'ยูไนเต็ด']
  },
  IQ: {
    cities: ['อัล-ชอร์ตา', 'อัล-ควูวา', 'อัล-ซาวรา', 'อาร์บิล', 'นาจาฟ', 'ซาโค', 'อัล-มีนา', 'นาฟต์', 'การ์มา', 'ดิยาลา', 'คาร์บาลา', 'อัล-ทาลาบา', 'อัล-คาห์ราบา', 'ดูฮอก', 'อัล-นาฟต์', 'มายซาน', 'อัล-กาซิม', 'ซามาร์รา'],
    suffixes: ['เอสซี', 'เอฟซี', 'คลับ']
  },
  UZ: {
    cities: ['ปัคตากอร์', 'นาซาฟ', 'นาฟบาฮอร์', 'เอจีเอ็มเค', 'เนฟต์ชี', 'โซกดิโอนา', 'อันดิจอน', 'บูคาโร', 'ซูร์คอน', 'กิซิลคุม', 'โคกานด์', 'โอลิมปิก'],
    suffixes: ['เอฟซี', 'พีเอฟซี', 'คลับ']
  },
  AU: {
    cities: ['เมลเบิร์น ซิตี้', 'โอ๊คแลนด์', 'เวสต์เทิร์น ซิดนีย์', 'อาดิเลด', 'บริสเบน โรอาร์', 'เพิร์ธ กลอรี', 'นิวคาสเซิล เจ็ตส์', 'เซ็นทรัล โคสต์', 'แมคอาเธอร์', 'เวลลิงตัน'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้']
  },
  IN: {
    cities: ['โมฮัน บากัน', 'เบงกาลูรู', 'กัว', 'โอริสสา', 'เกรละ', 'นอร์ทอีสต์', 'เชนไนยิน', 'จามเชดปุระ', 'อีสต์ เบงกอล', 'ปัญจาบ', 'ไฮเดอราบาด'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้']
  },
  VN: {
    cities: ['นาม ดิญ', 'กง อัน ฮานอย', 'บินห์ ดิญ', 'แทงห์ ฮวา', 'เบคาเม็กซ์ บินห์ เดือง', 'ไฮฟอง', 'ฮวง แองห์ ยาลาย', 'ซง ลาม เหงะ อาน', 'ห่าติ๋ญ', 'ดานัง', 'กวาง นาม', 'บิ่ญเฟื้อก'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'คลับ']
  },
  ID: {
    cities: ['เปอร์ซิบ บันดุง', 'เปอร์เซบายา', 'มาดูรา', 'บอร์เนียว', 'พีเอสเอ็ม มากัสซาร์', 'อาเรมา', 'เดวา ยูไนเต็ด', 'เปอร์สิค เคดีรี', 'บาริโต', 'พีเอสไอเอส เซมารัง', 'มาลุต', 'สเลมัน', 'เปร์ซิตา', 'เปอร์ซิส โซโล', 'ซีเมน ปาดัง', 'บิอัค'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'คลับ']
  },
  MY: {
    cities: ['เซอลาโงร์', 'ซาบาห์', 'ตรังกานู', 'ปะหัง', 'ปีนัง', 'เปรัค', 'เกดะห์', 'เนเกรี เซมบิลัน', 'กูชิง ซิตี้', 'กลันตัน', 'มะละกา', 'ปุตราจายา'],
    suffixes: ['เอฟซี', 'ซิตี้', 'ยูไนเต็ด']
  },
  SG: {
    cities: ['แทมปิเนส', 'ไลออน ซิตี้', 'เกลัง', 'บาเลสเทียร์', 'หัวกัง', 'อัลบิเร็กซ์ สิงคโปร์', 'ตันจง ปาการ์', 'ยัง ไลออนส์'],
    suffixes: ['เอฟซี', 'โรเวอร์ส', 'ยูไนเต็ด']
  },
  PH: {
    cities: ['คายา อิโลอิโล', 'ดาเวา อากีลาส', 'สตาลเลียน ลากูนา', 'มาฮาร์ลิกา', 'โลโยลา', 'เมนดิโอลา', 'ตากิก', 'บาโกลอด'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'คลับ']
  },
  BR: {
    cities: ['พัลเมรัส', 'ฟลาเมงโก', 'โบตาโฟโก', 'อินเตอร์นาซิอองนาล', 'ฟอร์ตาเลซา', 'ครูเซโร', 'บาเฮีย', 'โครินเธียนส์', 'วาสโก', 'ฟลูมิเนนเซ', 'วิตอเรีย', 'เกรมิโอ', 'แอตเลติโก มิไนโร', 'บราซิเลีย', 'เรดบูลล์ บรากันติโน', 'จูเวนตูเด', 'เรซิเฟ'],
    suffixes: ['เอสซี', 'เอฟซี', 'อีซี', 'เอซี']
  },
  AR: {
    cities: ['ริเวอร์ พลาตา', 'เบเลซ', 'ราซิ่ง', 'ตาเยเรส', 'ฮูราคาน', 'โกดอย ครูซ', 'เอสตูเดียนเตส', 'อินเดเพนเดียนเต', 'ซาน โลเรนโซ', 'ลา นุส', 'อูนิโอน', 'อัตเลติโก ตูกูมัน', 'บานฟิลด์', 'ติเกร', 'พลาเทนเซ', 'เบลกราโน', 'อินสติตูโต', 'กิมนาเซีย', 'เดเฟนซา', 'ซาร์เมียนโต', 'ริวาเดเวีย', 'บาร์รากัส', 'อาร์เจนติโนส', 'กอร์โดบา', 'ซาน มาร์ติน'],
    suffixes: ['เอฟซี', 'ซีเอ', 'คลับ']
  },
  CO: {
    cities: ['แอตเลติโก นาซิอองนาล', 'มิยอนาริโอส', 'ซานตา เฟ', 'จูเนียร์', 'อเมริกา กาลี', 'เดปอร์ติโบ กาลี', 'โตลิมา', 'ออนเซ กัลดาส', 'ปาสโต', 'บูการามังกา', 'เปเรยรา', 'ปาตริโอตัส', 'เอ็นบิกาโด', 'ชีโก', 'อากีลาส', 'ฟอร์ตาเลซา โค', 'อาลิอันซา', 'ลา เอกิดัด'],
    suffixes: ['เอฟซี', 'ซีดี', 'เอสซี']
  },
  MX: {
    cities: ['อเมริกา', 'กรูซ อาซุล', 'โตลูกา', 'ติเกรส', 'ปูมาส', 'ชีวาส', 'ปาชูกา', 'เลออน', 'ซานโตส ลากูนา', 'ติฆัวนา', 'เนกาซา', 'แอตลาส', 'เกเรตาโร', 'ฮัวเรซ', 'ปวยบลา', 'มาซาตลัน'],
    suffixes: ['เอฟซี', 'ซีเอฟ', 'คลับ']
  },
  US: {
    cities: ['อินเตอร์ ไมอามี', 'โคลัมบัส ครูว์', 'ซินซินนาติ', 'ออร์แลนโด', 'ชาร์ลอตต์', 'แอตแลนตา', 'ฟิลาเดลเฟีย', 'ดีซี ยูไนเต็ด', 'มอนทรีออล', 'โตรอนโต', 'ชิคาโก', 'นิวอิงแลนด์', 'ซีแอตเทิล', 'ฮูสตัน', 'มินนิโซตา', 'โคโลราโด', 'พอร์ตแลนด์', 'ซอลต์ เลค'],
    suffixes: ['เอสซี', 'เอฟซี', 'ยูไนเต็ด']
  },
  EG: {
    cities: ['อัล-อาห์ลี ไคโร', 'ซามาเล็ก', 'พีรามิดส์', 'อัล-มาสรี', 'โมเดิร์น สปอร์ต', 'อัล-อิตติฮัด อเล็กซานเดรีย', 'เซด เอฟซี', 'เซรามิกา', 'เอ็นพีพีไอ', 'ทาลาเออา', 'อิสไมลี', 'เอล กูนา', 'ฟาร์โก', 'สโมฮา', 'เปโตรเจ็ต', 'กาซล์ เอล มาฮัลลา'],
    suffixes: ['เอสซี', 'เอฟซี', 'คลับ']
  },
  MA: {
    cities: ['รายา กาซาบล็องกา', 'วีดาด', 'ฟาร์ ราบัต', 'แบร์กาเน', 'ฟุส ราบัต', 'โอลิมปิก ซาฟี', 'ตังเกียร์', 'ฮัสซาเนีย', 'เมกเนส', 'อูจดา', 'มูฮัมเมเดีย', 'เตตวน', 'เจดีดา', 'คิมิส เซมมูร์'],
    suffixes: ['เอฟซี', 'เอซี', 'เอสซี']
  },
  NG: {
    cities: ['เอ็นยิมบา', 'เรโม สตาร์ส', 'ริเวอร์ส', 'คาโน พิลลาร์ส', 'อีโนกู เรนเจอร์ส', 'ชูตติ้ง สตาร์ส', 'พลาโต ยูไนเต็ด', 'โลบี สตาร์ส', 'คัตซินา', 'อักวา ยูไนเต็ด', 'คาวารา', 'ซันไชน์', 'เบนเดล', 'อาเบีย วอร์ริเออร์ส', 'ฮาร์ตแลนด์', 'บานียี', 'ไนเจอร์ ทอร์นาโด', 'เอล-คาเนมี'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'สตาร์ส']
  },
  ZA: {
    cities: ['มาเมโลดี ซันดาวน์ส', 'ออร์แลนโด ไพเรตส์', 'ไกเซอร์ ชีฟส์', 'สเตลเลนบอช', 'เซคฮูคูเน', 'เคปทาวน์ ซิตี้', 'ซุปเปอร์สปอร์ต', 'โปลอควาเน', 'รามาโลลา', 'อาเมซูลู', 'ชิปปา', 'ริชาร์ดส์ เบย์', 'มาเกซี', 'มารูโม', 'รอลลิง'],
    suffixes: ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้']
  },
  SN: {
    cities: ['เตืองเกธ', 'จาราฟ', 'เจเนราซิออง ฟุต', 'คาซา สปอร์ตส์', 'อัส ปิกีน', 'ดาการ์ ซาเคร-เกอร์', 'กูเดียเวย์', 'อูอาคาม', 'โอลิมปิก เอ็มบูร์', 'แฌมบูร์', 'เซนต์ หลุยส์', 'คาโอลาค', 'ซิกินชอร์'],
    suffixes: ['เอฟซี', 'เอเอส', 'ยูเอส']
  }
};

interface RawWorldLeagueDef {
  code: string;
  name: string;
  shortName: string;
  teamCount: number;
  roundsMultiplier: 1 | 2 | 3;
  baseOvr: number;
  noRelegation?: boolean;
  note?: string;
  zones: WorldLeagueZoneRule[];
}

const RAW_WORLD_LEAGUE_DEFS: RawWorldLeagueDef[] = [
  // Europe
  {
    code: 'GB', name: 'พรีเมียร์ลีก อังกฤษ', shortName: 'EPL', teamCount: 20, roundsMultiplier: 2, baseOvr: 81,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 5, toRank: 6, tone: 'acl2', label: 'ยูโรป้าลีก', shortLabel: 'UEL' },
      { fromRank: 18, toRank: 20, tone: 'rel', label: 'ตกชั้นแชมเปียนชิพ', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'ES', name: 'ลาลีกา สเปน', shortName: 'LaLiga', teamCount: 20, roundsMultiplier: 2, baseOvr: 80,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 5, toRank: 6, tone: 'acl2', label: 'ยูโรป้าลีก', shortLabel: 'UEL' },
      { fromRank: 18, toRank: 20, tone: 'rel', label: 'ตกชั้นเซกุนดา', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'DE', name: 'บุนเดสลีกา เยอรมนี', shortName: 'Bundesliga', teamCount: 18, roundsMultiplier: 2, baseOvr: 80,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 5, toRank: 6, tone: 'acl2', label: 'ยูโรป้าลีก', shortLabel: 'UEL' },
      { fromRank: 16, toRank: 16, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 17, toRank: 18, tone: 'rel', label: 'ตกชั้น 2.บุนเดสลีกา', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'IT', name: 'เซเรีย อา อิตาลี', shortName: 'Serie A', teamCount: 20, roundsMultiplier: 2, baseOvr: 80,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'สคูเดตโต้ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 5, toRank: 6, tone: 'acl2', label: 'ยูโรป้าลีก', shortLabel: 'UEL' },
      { fromRank: 18, toRank: 20, tone: 'rel', label: 'ตกชั้นเซเรีย บี', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'FR', name: 'ลีกเอิง ฝรั่งเศส', shortName: 'Ligue 1', teamCount: 18, roundsMultiplier: 2, baseOvr: 79,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 5, toRank: 6, tone: 'acl2', label: 'ยูโรป้าลีก', shortLabel: 'UEL' },
      { fromRank: 16, toRank: 16, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 17, toRank: 18, tone: 'rel', label: 'ตกชั้นลีกเดอซ์', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'PT', name: 'ปรีไมรา ลีกา โปรตุเกส', shortName: 'Liga PT', teamCount: 18, roundsMultiplier: 2, baseOvr: 76,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 3, toRank: 4, tone: 'acl2', label: 'ยูโรป้า / คอนเฟอเรนซ์', shortLabel: 'ยุโรป' },
      { fromRank: 16, toRank: 16, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 17, toRank: 18, tone: 'rel', label: 'ตกชั้นลีกา 2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'NL', name: 'เอเรดิวิซี เนเธอร์แลนด์', shortName: 'Eredivisie', teamCount: 18, roundsMultiplier: 2, baseOvr: 76,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & UCL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 3, tone: 'acl_elite', label: 'ยูฟ่า แชมเปียนส์ลีก', shortLabel: 'UCL' },
      { fromRank: 4, toRank: 5, tone: 'acl2', label: 'ยูโรป้า / เพลย์ออฟยุโรป', shortLabel: 'ยุโรป' },
      { fromRank: 16, toRank: 16, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 17, toRank: 18, tone: 'rel', label: 'ตกชั้นเคอูเคนฯ', shortLabel: 'ตกชั้น' }
    ]
  },

  // Asia & Oceania
  {
    code: 'JP', name: 'เจลีก 1 ญี่ปุ่น', shortName: 'J1', teamCount: 20, roundsMultiplier: 2, baseOvr: 75,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 18, toRank: 20, tone: 'rel', label: 'ตกชั้น J2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'KR', name: 'เคลีก 1 เกาหลีใต้', shortName: 'K1', teamCount: 12, roundsMultiplier: 3, baseOvr: 74,
    note: 'ระบบ 12 ทีม เตะ 3 เลก (33 นัด)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 10, toRank: 11, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 12, toRank: 12, tone: 'rel', label: 'ตกชั้น K2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'SA', name: 'ซาอุดี โปรลีก', shortName: 'SPL', teamCount: 18, roundsMultiplier: 2, baseOvr: 77,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 3, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 16, toRank: 18, tone: 'rel', label: 'ตกชั้นดิวิชั่น 1', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'CN', name: 'ไชนีส ซูเปอร์ลีก', shortName: 'CSL', teamCount: 16, roundsMultiplier: 2, baseOvr: 72,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 15, toRank: 16, tone: 'rel', label: 'ตกชั้นลีกวัน', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'AE', name: 'ยูเออี โปรลีก', shortName: 'UAE', teamCount: 14, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 13, toRank: 14, tone: 'rel', label: 'ตกชั้นดิวิชั่น 1', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'QA', name: 'กาตาร์ สตาร์สลีก', shortName: 'QSL', teamCount: 12, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 11, toRank: 12, tone: 'rel', label: 'ตกชั้นลีกรอง', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'IR', name: 'เปอร์เซียน กัลฟ์ โปรลีก', shortName: 'PGPL', teamCount: 16, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'ACL Elite', shortLabel: 'ACLE' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 15, toRank: 16, tone: 'rel', label: 'ตกชั้นอาซาเดกัน', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'IQ', name: 'อิรัก สตาร์สลีก', shortName: 'ISL', teamCount: 20, roundsMultiplier: 2, baseOvr: 71,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 18, toRank: 20, tone: 'rel', label: 'ตกชั้นพรีเมียร์', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'UZ', name: 'อุซเบกิสถาน ซูเปอร์ลีก', shortName: 'UZL', teamCount: 14, roundsMultiplier: 2, baseOvr: 73,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 13, toRank: 14, tone: 'rel', label: 'ตกชั้นโปรลีก', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'AU', name: 'เอลีก เมน ออสเตรเลีย', shortName: 'A-League', teamCount: 12, roundsMultiplier: 2, baseOvr: 73, noRelegation: true,
    note: 'ลีกปิด ไม่มีตกชั้น (1–6 ชิงรอบไฟนอลส์)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'พรีเมียร์ชิพ & ACL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 6, tone: 'playoff', label: 'รอบไฟนอลส์ ซีรีส์', shortLabel: 'ไฟนอลส์' }
    ]
  },
  {
    code: 'IN', name: 'อินเดียน ซูเปอร์ลีก', shortName: 'ISL-IN', teamCount: 13, roundsMultiplier: 2, baseOvr: 69, noRelegation: true,
    note: 'ลีกปิด ไม่มีตกชั้น (1–6 ชิงรอบเพลย์ออฟ)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'ลีกชิลด์ & ACL2', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 6, tone: 'playoff', label: 'เพลย์ออฟชิงถ้วย', shortLabel: 'เพลย์ออฟ' }
    ]
  },
  {
    code: 'VN', name: 'วีลีก 1 เวียดนาม', shortName: 'V.League', teamCount: 14, roundsMultiplier: 2, baseOvr: 70,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL2', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 13, toRank: 13, tone: 'rel_po', label: 'เพลย์ออฟหนีตกชั้น', shortLabel: 'PO หนีตก' },
      { fromRank: 14, toRank: 14, tone: 'rel', label: 'ตกชั้น V.League 2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'ID', name: 'ลีกา 1 อินโดนีเซีย', shortName: 'Liga 1', teamCount: 18, roundsMultiplier: 2, baseOvr: 70,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL2', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'โควตาเอเชีย', shortLabel: 'เอเชีย' },
      { fromRank: 16, toRank: 18, tone: 'rel', label: 'ตกชั้นลีกา 2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'MY', name: 'มาเลเซีย ซูเปอร์ลีก', shortName: 'MSL', teamCount: 14, roundsMultiplier: 2, baseOvr: 70,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' },
      { fromRank: 13, toRank: 14, tone: 'rel', label: 'ตกชั้นลีกรอง', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'SG', name: 'สิงคโปร์ พรีเมียร์ลีก', shortName: 'SPL-SG', teamCount: 10, roundsMultiplier: 3, baseOvr: 68, noRelegation: true,
    note: 'ลีกปิด 10 ทีม เตะ 3 เลก (27 นัด) ไม่มีตกชั้น',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL2', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' }
    ]
  },
  {
    code: 'PH', name: 'ฟิลิปปินส์ ฟุตบอลลีก', shortName: 'PFL', teamCount: 10, roundsMultiplier: 2, baseOvr: 67, noRelegation: true,
    note: 'ลีกเปิด 10 ทีม (18 นัด) ไม่มีตกชั้น',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ACL2', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2' }
    ]
  },

  // Americas
  {
    code: 'BR', name: 'บราซิเลียเรา เซเรีย อา', shortName: 'Série A', teamCount: 20, roundsMultiplier: 2, baseOvr: 79,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ลิเบอร์ตาดอเรส', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 6, tone: 'acl_elite', label: 'โคปา ลิเบอร์ตาดอเรส', shortLabel: 'ลิเบอร์ฯ' },
      { fromRank: 7, toRank: 12, tone: 'acl2', label: 'โคปา ซูดาเมริกานา', shortLabel: 'ซูดาฯ' },
      { fromRank: 17, toRank: 20, tone: 'rel', label: 'ตกชั้นเซเรีย บี', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'AR', name: 'อาร์เจนตินา พรีเมร่า ดิวิซิออน', shortName: 'LPF', teamCount: 28, roundsMultiplier: 1, baseOvr: 78,
    note: 'ระบบ 28 ทีม พบกันหมด 1 เลก (27 นัด)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ลิเบอร์ตาดอเรส', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'โคปา ลิเบอร์ตาดอเรส', shortLabel: 'ลิเบอร์ฯ' },
      { fromRank: 5, toRank: 10, tone: 'acl2', label: 'โคปา ซูดาเมริกานา', shortLabel: 'ซูดาฯ' },
      { fromRank: 27, toRank: 28, tone: 'rel', label: 'ตกชั้นพรีเมร่า นาซิอองนาล', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'CO', name: 'กาเตโกเรีย พรีเมรา เอ', shortName: 'Liga CO', teamCount: 20, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & ลิเบอร์ตาดอเรส', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 3, tone: 'acl_elite', label: 'ลิเบอร์ตาดอเรส', shortLabel: 'ลิเบอร์ฯ' },
      { fromRank: 4, toRank: 8, tone: 'playoff', label: 'รอบเพลย์ออฟควอดรังกูลาร์', shortLabel: 'เพลย์ออฟ' },
      { fromRank: 19, toRank: 20, tone: 'rel', label: 'ตกชั้นพรีเมรา บี', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'MX', name: 'ลีกา เอ็มเอ็กซ์ เม็กซิโก', shortName: 'Liga MX', teamCount: 18, roundsMultiplier: 2, baseOvr: 75, noRelegation: true,
    note: 'ระบบปิด ไม่มีตกชั้น (1–8 เข้ารอบลีกูย่า)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'จ่าฝูง & คอนคาแคฟ', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'คอนคาแคฟ แชมเปียนส์คัพ', shortLabel: 'คอนคาแคฟ' },
      { fromRank: 5, toRank: 8, tone: 'playoff', label: 'รอบลีกูย่าเพลย์ออฟ', shortLabel: 'ลีกูย่า' }
    ]
  },
  {
    code: 'US', name: 'เมเจอร์ลีก ซอคเกอร์', shortName: 'MLS', teamCount: 20, roundsMultiplier: 2, baseOvr: 74, noRelegation: true,
    note: 'ระบบลีกปิด ไม่มีตกชั้น (1–8 เข้ารอบ MLS Cup Playoffs)',
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'ซัพพอร์ตเตอร์ส ชิลด์', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 4, tone: 'acl_elite', label: 'คอนคาแคฟ แชมเปียนส์คัพ', shortLabel: 'คอนคาแคฟ' },
      { fromRank: 5, toRank: 8, tone: 'playoff', label: 'MLS Cup Playoffs', shortLabel: 'เพลย์ออฟ' }
    ]
  },

  // Africa
  {
    code: 'EG', name: 'อียิปต์ พรีเมียร์ลีก', shortName: 'EPL-EG', teamCount: 18, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & CAF CL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'CAF แชมเปียนส์ลีก', shortLabel: 'CAF CL' },
      { fromRank: 3, toRank: 4, tone: 'acl2', label: 'CAF คอนเฟเดอเรชันส์', shortLabel: 'CAF CC' },
      { fromRank: 16, toRank: 18, tone: 'rel', label: 'ตกชั้นดิวิชั่น 2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'MA', name: 'โบโตลา โปร โมร็อกโก', shortName: 'Botola', teamCount: 16, roundsMultiplier: 2, baseOvr: 74,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & CAF CL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'CAF แชมเปียนส์ลีก', shortLabel: 'CAF CL' },
      { fromRank: 3, toRank: 4, tone: 'acl2', label: 'CAF คอนเฟเดอเรชันส์', shortLabel: 'CAF CC' },
      { fromRank: 15, toRank: 16, tone: 'rel', label: 'ตกชั้นโบโตลา 2', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'NG', name: 'ไนจีเรีย พรีเมียร์ลีก', shortName: 'NPFL', teamCount: 20, roundsMultiplier: 2, baseOvr: 72,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & CAF CL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'CAF แชมเปียนส์ลีก', shortLabel: 'CAF CL' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'CAF คอนเฟเดอเรชันส์', shortLabel: 'CAF CC' },
      { fromRank: 17, toRank: 20, tone: 'rel', label: 'ตกชั้นลีกรอง', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'ZA', name: 'แอฟริกาใต้ พรีเมียร์ชิพ', shortName: 'PSL', teamCount: 16, roundsMultiplier: 2, baseOvr: 73,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & CAF CL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl_elite', label: 'CAF แชมเปียนส์ลีก', shortLabel: 'CAF CL' },
      { fromRank: 3, toRank: 3, tone: 'acl2', label: 'CAF คอนเฟเดอเรชันส์', shortLabel: 'CAF CC' },
      { fromRank: 15, toRank: 16, tone: 'rel', label: 'ตกชั้นดิวิชั่น 1', shortLabel: 'ตกชั้น' }
    ]
  },
  {
    code: 'SN', name: 'เซเนกัล ลีก 1', shortName: 'L1-SN', teamCount: 14, roundsMultiplier: 2, baseOvr: 73,
    zones: [
      { fromRank: 1, toRank: 1, tone: 'champ', label: 'แชมป์ & CAF CL', shortLabel: 'แชมป์' },
      { fromRank: 2, toRank: 2, tone: 'acl2', label: 'CAF คอนเฟเดอเรชันส์', shortLabel: 'CAF CC' },
      { fromRank: 13, toRank: 14, tone: 'rel', label: 'ตกชั้นลีก 2', shortLabel: 'ตกชั้น' }
    ]
  }
];

function buildClubsForWorldLeague(def: RawWorldLeagueDef, globalUsedNames: Set<string>): WorldClubSeed[] {
  const existing = FOREIGN_CLUB_CATALOG.filter((c) => c.code === def.code);
  const out: WorldClubSeed[] = [];
  for (const c of existing) {
    if (!globalUsedNames.has(c.name)) {
      globalUsedNames.add(c.name);
      out.push({ name: c.name, baseOvr: c.baseOvr, kc: c.kc });
    }
  }
  const pool = EXTRA_CITY_WORDS_BY_CODE[def.code] || { cities: [COUNTRY_META_BY_CODE[def.code]?.country || def.code], suffixes: ['เอฟซี', 'ซิตี้', 'ยูไนเต็ด'] };
  let cityIdx = 0;
  let sufIdx = 0;
  while (out.length < def.teamCount) {
    const city = pool.cities[cityIdx % pool.cities.length];
    const suf = pool.suffixes[sufIdx % pool.suffixes.length];
    const alreadyHasSuffix = /(เอฟซี|ยูไนเต็ด|ซิตี้|เอสซี|คลับ|คัลโช|สปอร์ต|สเตเดียม|04|ซันดาวน์ส|ไพเรตส์|ชีฟส์)/.test(city);
    let candidate = alreadyHasSuffix && sufIdx === 0 ? `${city}` : `${city} ${suf}`;
    if (globalUsedNames.has(candidate)) {
      candidate = `${city} ${pool.suffixes[(sufIdx + 1) % pool.suffixes.length]}`;
    }
    if (globalUsedNames.has(candidate)) {
      candidate = `${city} ${out.length + 1}`;
    }
    globalUsedNames.add(candidate);
    // Spread OVR smoothly from baseOvr down to baseOvr - 6 so top teams stay stronger than relegation fodder
    const rankFactor = out.length / Math.max(1, def.teamCount - 1);
    const ovr = Math.max(58, Math.min(86, Math.round(def.baseOvr + 1 - rankFactor * 6)));
    const kc = WORLD_KIT_PALETTES[(out.length + def.code.charCodeAt(0)) % WORLD_KIT_PALETTES.length];
    out.push({ name: candidate, baseOvr: ovr, kc });
    cityIdx += 1;
    if (cityIdx >= pool.cities.length) {
      cityIdx = 0;
      sufIdx += 1;
    }
  }
  return out.slice(0, def.teamCount);
}

const _usedGlobalClubNames = new Set<string>();

export const WORLD_LEAGUE_SPECS: WorldLeagueSpec[] = RAW_WORLD_LEAGUE_DEFS.map((def) => {
  const cm = COUNTRY_META_BY_CODE[def.code];
  const matchdays =
    def.teamCount % 2 === 0
      ? (def.teamCount - 1) * def.roundsMultiplier
      : def.teamCount * def.roundsMultiplier;
  return {
    code: def.code,
    name: def.name,
    shortName: def.shortName,
    country: cm?.country || def.code,
    flag: cm?.flag || '🌐',
    confed: cm?.confed || 'asia',
    region: cm?.region || 'intl',
    teamCount: def.teamCount,
    roundsMultiplier: def.roundsMultiplier,
    matchdays,
    baseOvr: def.baseOvr,
    noRelegation: def.noRelegation,
    note: def.note,
    zones: def.zones,
    clubs: buildClubsForWorldLeague(def, _usedGlobalClubNames)
  };
});

export const WORLD_LEAGUE_BY_CODE: Record<string, WorldLeagueSpec> = Object.fromEntries(
  WORLD_LEAGUE_SPECS.map((sp) => [sp.code, sp])
);

export const WORLD_CLUB_BY_NAME: Record<string, { spec: WorldLeagueSpec; seed: WorldClubSeed }> = Object.fromEntries(
  WORLD_LEAGUE_SPECS.flatMap((spec) => spec.clubs.map((seed) => [seed.name, { spec, seed }]))
);

export function getWorldLeagueSpec(code?: string | null): WorldLeagueSpec | null {
  if (!code) return null;
  return WORLD_LEAGUE_BY_CODE[code.trim().toUpperCase()] || null;
}

export function getRankZoneBadge(
  tier: number,
  rank: number,
  totalTeams: number,
  opts?: { leagueCode?: string }
): ZoneBadgeInfo {
  if (tier === 2) {
    if (rank === 1) {
      return { tone: 'champ', label: 'แชมป์ & ACL Elite', shortLabel: 'แชมป์ / ACLE', ...TONE_CLASSES.champ };
    }
    if (rank >= 2 && rank <= 3) {
      return { tone: 'acl2', label: 'ACL Two', shortLabel: 'ACL2', ...TONE_CLASSES.acl2 };
    }
    if (rank >= Math.max(4, totalTeams - 2)) {
      return { tone: 'rel', label: 'ตกชั้นไทยลีก 2', shortLabel: 'ตกชั้น', ...TONE_CLASSES.rel };
    }
    return { tone: 'neutral', label: '', shortLabel: '', ...TONE_CLASSES.neutral };
  }
  if (tier === 1) {
    if (rank === 1) {
      return { tone: 'champ', label: 'แชมป์ & เลื่อนชั้น T1', shortLabel: 'แชมป์ / ขึ้น T1', ...TONE_CLASSES.champ };
    }
    if (rank === 2) {
      return { tone: 'promo', label: 'เลื่อนชั้น T1 อัตโนมัติ', shortLabel: 'ขึ้น T1', ...TONE_CLASSES.promo };
    }
    if (rank >= 3 && rank <= 6) {
      return { tone: 'playoff', label: 'เพลย์ออฟเลื่อนชั้น T1', shortLabel: 'เพลย์ออฟ', ...TONE_CLASSES.playoff };
    }
    if (rank >= Math.max(7, totalTeams - 2)) {
      return { tone: 'rel', label: 'ตกชั้นไทยลีก 3', shortLabel: 'ตกชั้น', ...TONE_CLASSES.rel };
    }
    return { tone: 'neutral', label: '', shortLabel: '', ...TONE_CLASSES.neutral };
  }
  if (tier === 0) {
    if (rank === 1) {
      return { tone: 'champ', label: 'แชมป์โซน & ขึ้น T2 อัตโนมัติ + ชิงแชมป์ T3', shortLabel: 'ขึ้น T2 / ชิง T3', ...TONE_CLASSES.champ };
    }
    if (rank >= 2 && rank <= 3) {
      return { tone: 'playoff', label: 'เพลย์ออฟ ชปล. โซน (ชิงตั๋วใบที่ 3)', shortLabel: 'ชปล. T3', ...TONE_CLASSES.playoff };
    }
    return { tone: 'neutral', label: '', shortLabel: '', ...TONE_CLASSES.neutral };
  }
  const spec = getWorldLeagueSpec(opts?.leagueCode);
  if (spec) {
    const matched = spec.zones.find((z) => rank >= z.fromRank && rank <= z.toRank);
    if (matched) {
      return {
        tone: matched.tone,
        label: matched.label,
        shortLabel: matched.shortLabel,
        ...getToneClasses(matched.tone)
      };
    }
  }
  return { tone: 'neutral', label: '', shortLabel: '', ...TONE_CLASSES.neutral };
}

export function getTeamBaseOvr(
  team?: Pick<Team, 'tier' | 'leagueCode'> | null,
  fallbackTier?: number
): number {
  const tier = team ? (team.tier ?? 0) : (fallbackTier ?? 0);
  if (tier >= 3) {
    const spec = getWorldLeagueSpec(team?.leagueCode);
    return spec?.baseOvr ?? 74;
  }
  const idx = Math.max(0, Math.min(BASE.length - 1, tier));
  return BASE[idx] ?? 60;
}

export function getTeamLeagueName(
  team?: Pick<Team, 'name' | 'origName' | 'tier' | 'zone' | 'leagueCode' | 'modLeagueName'> | null,
  opts?: { includeZone?: boolean; withFlag?: boolean; short?: boolean }
): string {
  if (!team) return TN[0];
  if (team.modLeagueName) return team.modLeagueName;
  const tier = team.tier ?? 0;
  if (tier < 3) {
    const base = TN[tier] || TN[0];
    if (opts?.includeZone && tier === 0) {
      return `${base} (${getT3ZoneLabel(team.zone)})`;
    }
    return base;
  }
  const meta = getForeignTeamCountryMeta(team.origName || team.name, team.leagueCode);
  const spec = getWorldLeagueSpec(team.leagueCode || meta?.code);
  const label = opts?.short
    ? (spec?.shortName || spec?.name || meta?.country || TN[3])
    : (spec?.name || meta?.country || TN[3]);
  const flag = spec?.flag || meta?.flag;
  return opts?.withFlag && flag ? `${flag} ${label}` : label;
}

