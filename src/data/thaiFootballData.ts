import type { Position, SubRole, StatKey, Mentality, TrainingFocus, TrainingProgramId, TrainingIntensity, TeamTrainingPlan, CoreAttrs, GameState, PlayerArchetype, TrainingProgramMeta, FootballTraitDef, CoachStyleId } from '../types/game';

export const A1 = ['ธน', 'กิต', 'วีร', 'ภัค', 'ศุภ', 'นรา', 'อนุ', 'ชัย', 'พงศ์', 'กฤษ', 'ปริญ', 'รัฐ', 'เมธ', 'ณัฐ'];
export const A2 = ['พล', 'ภัทร', 'วัฒน์', 'ศักดิ์', 'เดช', 'พัฒน์', 'ชนม์', 'ธร', 'นนท์', 'กร'];
export const S1 = ['วงษ์', 'แสง', 'บุญ', 'ทอง', 'สุข', 'คำ', 'ศรี', 'ใจ', 'เพชร', 'มณี'];
export const S2 = ['ทอง', 'เจริญ', 'รัตน์', 'สกุล', 'ชัย', 'งาม', 'ดี', 'มั่น'];

export const FN = [
  'สมชาย', 'วิชัย', 'ประเสริฐ', 'อนุชา', 'ธีรพงษ์', 'สุรชัย', 'ณรงค์', 'มานะ', 'สมศักดิ์', 'ประวิทย์',
  'ชาญชัย', 'วีระ', 'สุเทพ', 'อดิศักดิ์', 'เกียรติศักดิ์', 'ภานุ', 'ธนากร', 'พีรพล', 'รชต', 'ศิวกร',
  'ปฏิภาณ', 'จักรกฤษณ์', 'นัฐวุฒิ', 'อภิชาติ', 'ชัยวัฒน์', 'สิทธิพล', 'พิสิษฐ์', 'เจษฎา', 'ธเนศ', 'คมสัน',
  'ภูมิพัฒน์', 'กิตติพงษ์', 'อรรถพล', 'ศุภชัย', 'วรเชษฐ์', 'ปุริม', 'ธีรเดช', 'นพดล', 'เอกชัย', 'ชนาวิน'
];

export const SN = [
  'แสนดี', 'ใจดี', 'รักษา', 'มั่นคง', 'พรหมมา', 'สีสุข', 'ทองสุข', 'บุญมา', 'คำแก้ว', 'ศรีสวัสดิ์',
  'วงษ์ประเสริฐ', 'เพ็งสุข', 'จันทร์แจ่ม', 'โพธิ์ทอง', 'ชูเกียรติ', 'สุวรรณ', 'พิมพ์ทอง', 'อินทร์แก้ว',
  'ปัญญาดี', 'แก้วมณี', 'ไชยวงศ์', 'เรืองศรี', 'สายทอง', 'บัวผัน', 'ดวงดี', 'มีสุข', 'นาคสุข', 'ธนะสาร', 'ศรีจันทร์', 'หอมหวล'
];

export type ForeignNameRegion =
  | 'jp' | 'kr' | 'cn' | 'me' | 'ir' | 'uz' | 'in' | 'vn' | 'id' | 'my_sg' | 'ph' | 'au'
  | 'en' | 'es' | 'de' | 'it' | 'fr' | 'pt_br' | 'ar_lat' | 'nl' | 'af' | 'intl';

export type ForeignConfed = 'asia' | 'europe' | 'americas' | 'africa';

export const CONFED_META: Record<ForeignConfed, { id: ForeignConfed; icon: string; label: string; short: string }> = {
  asia: { id: 'asia', icon: '🌏', label: 'เอเชีย & โอเชียเนีย', short: 'เอเชีย' },
  europe: { id: 'europe', icon: '🇪🇺', label: 'ยุโรป', short: 'ยุโรป' },
  americas: { id: 'americas', icon: '🌎', label: 'อเมริกา', short: 'อเมริกา' },
  africa: { id: 'africa', icon: '🌍', label: 'แอฟริกา', short: 'แอฟริกา' }
};

export interface CountryCatalogMeta {
  code: string;
  flag: string;
  country: string;
  region: ForeignNameRegion;
  confed: ForeignConfed;
}

export const COUNTRY_META_BY_CODE: Record<string, CountryCatalogMeta> = {
  JP: { code: 'JP', flag: '🇯🇵', country: 'ญี่ปุ่น', region: 'jp', confed: 'asia' },
  KR: { code: 'KR', flag: '🇰🇷', country: 'เกาหลีใต้', region: 'kr', confed: 'asia' },
  CN: { code: 'CN', flag: '🇨🇳', country: 'จีน', region: 'cn', confed: 'asia' },
  SA: { code: 'SA', flag: '🇸🇦', country: 'ซาอุดีอาระเบีย', region: 'me', confed: 'asia' },
  AE: { code: 'AE', flag: '🇦🇪', country: 'ยูเออี', region: 'me', confed: 'asia' },
  QA: { code: 'QA', flag: '🇶🇦', country: 'กาตาร์', region: 'me', confed: 'asia' },
  IR: { code: 'IR', flag: '🇮🇷', country: 'อิหร่าน', region: 'ir', confed: 'asia' },
  IQ: { code: 'IQ', flag: '🇮🇶', country: 'อิรัก', region: 'me', confed: 'asia' },
  UZ: { code: 'UZ', flag: '🇺🇿', country: 'อุซเบกิสถาน', region: 'uz', confed: 'asia' },
  AU: { code: 'AU', flag: '🇦🇺', country: 'ออสเตรเลีย', region: 'au', confed: 'asia' },
  IN: { code: 'IN', flag: '🇮🇳', country: 'อินเดีย', region: 'in', confed: 'asia' },
  VN: { code: 'VN', flag: '🇻🇳', country: 'เวียดนาม', region: 'vn', confed: 'asia' },
  ID: { code: 'ID', flag: '🇮🇩', country: 'อินโดนีเซีย', region: 'id', confed: 'asia' },
  MY: { code: 'MY', flag: '🇲🇾', country: 'มาเลเซีย', region: 'my_sg', confed: 'asia' },
  SG: { code: 'SG', flag: '🇸🇬', country: 'สิงคโปร์', region: 'my_sg', confed: 'asia' },
  PH: { code: 'PH', flag: '🇵🇭', country: 'ฟิลิปปินส์', region: 'ph', confed: 'asia' },
  MM: { code: 'MM', flag: '🇲🇲', country: 'เมียนมา', region: 'intl', confed: 'asia' },
  KH: { code: 'KH', flag: '🇰🇭', country: 'กัมพูชา', region: 'intl', confed: 'asia' },
  GB: { code: 'GB', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'อังกฤษ', region: 'en', confed: 'europe' },
  ES: { code: 'ES', flag: '🇪🇸', country: 'สเปน', region: 'es', confed: 'europe' },
  DE: { code: 'DE', flag: '🇩🇪', country: 'เยอรมนี', region: 'de', confed: 'europe' },
  IT: { code: 'IT', flag: '🇮🇹', country: 'อิตาลี', region: 'it', confed: 'europe' },
  FR: { code: 'FR', flag: '🇫🇷', country: 'ฝรั่งเศส', region: 'fr', confed: 'europe' },
  PT: { code: 'PT', flag: '🇵🇹', country: 'โปรตุเกส', region: 'pt_br', confed: 'europe' },
  NL: { code: 'NL', flag: '🇳🇱', country: 'เนเธอร์แลนด์', region: 'nl', confed: 'europe' },
  BR: { code: 'BR', flag: '🇧🇷', country: 'บราซิล', region: 'pt_br', confed: 'americas' },
  AR: { code: 'AR', flag: '🇦🇷', country: 'อาร์เจนตินา', region: 'ar_lat', confed: 'americas' },
  CO: { code: 'CO', flag: '🇨🇴', country: 'โคลอมเบีย', region: 'ar_lat', confed: 'americas' },
  MX: { code: 'MX', flag: '🇲🇽', country: 'เม็กซิโก', region: 'es', confed: 'americas' },
  US: { code: 'US', flag: '🇺🇸', country: 'สหรัฐอเมริกา', region: 'en', confed: 'americas' },
  EG: { code: 'EG', flag: '🇪🇬', country: 'อียิปต์', region: 'me', confed: 'africa' },
  MA: { code: 'MA', flag: '🇲🇦', country: 'โมร็อกโก', region: 'me', confed: 'africa' },
  NG: { code: 'NG', flag: '🇳🇬', country: 'ไนจีเรีย', region: 'af', confed: 'africa' },
  SN: { code: 'SN', flag: '🇸🇳', country: 'เซเนกัล', region: 'af', confed: 'africa' },
  ZA: { code: 'ZA', flag: '🇿🇦', country: 'แอฟริกาใต้', region: 'af', confed: 'africa' }
};

export function getCountryMetaByCode(code?: string | null): CountryCatalogMeta | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (upper === 'TH') {
    return { code: 'TH', flag: '🇹🇭', country: 'ไทย', region: 'intl', confed: 'asia' };
  }
  return COUNTRY_META_BY_CODE[upper] || null;
}

export const FOOTBALL_POPULARITY_COUNTRY_ORDER: readonly string[] = [
  'BR', // บราซิล
  'AR', // อาร์เจนตินา
  'GB', // อังกฤษ
  'ES', // สเปน
  'FR', // ฝรั่งเศส
  'DE', // เยอรมนี
  'IT', // อิตาลี
  'PT', // โปรตุเกส
  'NL', // เนเธอร์แลนด์
  'JP', // ญี่ปุ่น
  'KR', // เกาหลีใต้
  'CO', // โคลอมเบีย
  'MA', // โมร็อกโก
  'SN', // เซเนกัล
  'NG', // ไนจีเรีย
  'EG', // อียิปต์
  'MX', // เม็กซิโก
  'SA', // ซาอุดีอาระเบีย
  'IR', // อิหร่าน
  'AU', // ออสเตรเลีย
  'US', // สหรัฐอเมริกา
  'UZ', // อุซเบกิสถาน
  'QA', // กาตาร์
  'AE', // ยูเออี
  'IQ', // อิรัก
  'VN', // เวียดนาม
  'ID', // อินโดนีเซีย
  'MY', // มาเลเซีย
  'CN', // จีน
  'ZA', // แอฟริกาใต้
  'SG', // สิงคโปร์
  'IN', // อินเดีย
  'MM', // เมียนมา
  'PH', // ฟิลิปปินส์
  'KH' // กัมพูชา
];

const COUNTRY_POPULARITY_RANK: Record<string, number> = Object.fromEntries(
  FOOTBALL_POPULARITY_COUNTRY_ORDER.map((code, idx) => [code, idx])
);

export function getCountriesOrderedByFootballPopularity(confed?: ForeignConfed): CountryCatalogMeta[] {
  const list = Object.values(COUNTRY_META_BY_CODE).filter((cm) => !confed || cm.confed === confed);
  return list.sort((a, b) => {
    const ra = COUNTRY_POPULARITY_RANK[a.code] ?? 999;
    const rb = COUNTRY_POPULARITY_RANK[b.code] ?? 999;
    if (ra !== rb) return ra - rb;
    return a.country.localeCompare(b.country, 'th');
  });
}

export const FOREIGN_NAME_POOLS: Record<ForeignNameRegion, { first: string[]; last: string[] }> = {
  jp: {
    first: [
      'ฮิโรโตะ', 'เรียวตะ', 'ไคโตะ', 'โชตะ', 'เคนโตะ', 'ทาคุมิ', 'ยูโตะ', 'โซตะ',
      'ดาอิกิ', 'คาซึกิ', 'ริคุ', 'ฮารุกิ', 'นาโอกิ', 'โทโมยะ', 'โคเฮ', 'มาซาโตะ',
      'ชุนสุเกะ', 'เคสุเกะ', 'โคจิ', 'เรียวเฮ', 'ยูตะ', 'โคตะ', 'อายูมุ', 'ทัตสึยะ'
    ],
    last: [
      'ซาโต้', 'ซุซุกิ', 'ทาคาฮาชิ', 'ทานากะ', 'วาตานาเบะ', 'อิโต้', 'ยามาโมโตะ', 'นากามูระ',
      'โคบายาชิ', 'คาโต้', 'โยชิดะ', 'ยามาดะ', 'ซาซากิ', 'ยามากุจิ', 'มัตสึโมโตะ', 'อิโนอุเอะ',
      'คิมูระ', 'ฮายาชิ', 'ชิมิซุ', 'ไซโต้', 'ฟูจิตะ', 'โมริตะ', 'โอคาดะ', 'อุเอฮาระ'
    ]
  },
  kr: {
    first: [
      'มิน-แจ', 'ซึง-โฮ', 'จี-ฮุน', 'ดง-ฮยอน', 'แท-ยัง', 'แจ-ซอง', 'คยอง-มิน', 'ยอง-อู',
      'จุน-โฮ', 'ฮยอน-อู', 'ซอง-มิน', 'คัง-อิน', 'อิน-บอม', 'จิน-ซู', 'วู-ยอง', 'กยู-ซอง',
      'ฮี-ชาน', 'ดง-วอน', 'ซึง-อู', 'ชาง-ฮุน', 'จู-ยอง', 'มิน-กยู', 'ซัง-โฮ', 'ฮยอน-จุน'
    ],
    last: [
      'คิม', 'อี', 'พัค', 'ชเว', 'จอง', 'คัง', 'โช', 'ยุน',
      'จาง', 'อิม', 'ฮัน', 'โอ', 'ซอ', 'ชิน', 'ควอน', 'ฮวาง',
      'อัน', 'ซง', 'ยู', 'ฮง', 'โก', 'มุน', 'ยาง', 'แบ'
    ]
  },
  cn: {
    first: [
      'เหว่ย', 'เฟย', 'ฮ่าว', 'เทา', 'จื่อเฉียง', 'หมิง', 'เฉิง', 'หยาง',
      'เจี๋ย', 'เหล่ย', 'อวี้หนิง', 'ซื่อหาว', 'เผิงเฟย', 'จวิ้นหลิง', 'ป๋อ', 'จวิน',
      'ฉี', 'อี้', 'ไห่', 'เทียนอี้', 'หลิน', 'ซีห่าว', 'เจี้ยนกั๋ว', 'ต้าเหล่ย'
    ],
    last: [
      'หวัง', 'หลี่', 'จาง', 'หลิว', 'เฉิน', 'หยาง', 'จ้าว', 'หวง',
      'โจว', 'อู๋', 'สวี', 'ซุน', 'หม่า', 'จู', 'หู', 'กัว',
      'เหอ', 'เกา', 'หลิน', 'เจิ้ง', 'เซี่ย', 'ถัง', 'เฟิง', 'เติ้ง'
    ]
  },
  me: {
    first: [
      'ฟาฮัด', 'ซาเลม', 'อาลี', 'โอมาร์', 'คาเล็ด', 'ฟิราส', 'นาสเซอร์', 'ยาซเซอร์',
      'ซาอุด', 'อัยเมน', 'ฮัสซัน', 'อับดุลลาห์', 'โมฮัมเหม็ด', 'ทาริค', 'ไซด์', 'อิบราฮิม',
      'ยูสเซฟ', 'ฮุสเซน', 'อัคราม', 'อัลโมเอซ', 'คาริม', 'ซัลมาน', 'ราชิด', 'มานซูร์'
    ],
    last: [
      'อัล-ดอว์ซารี', 'อัล-บูไรคาน', 'อัล-คาห์ตานี', 'อัล-ชาห์รานี', 'อัล-มูวัลลัด', 'อัล-โอวาอิส',
      'อัล-ฮาร์บี', 'อัล-จัสซิม', 'อัล-ซาฮาฟี', 'อัล-เชห์รี', 'อัล-ไคบารี', 'อัล-บูไลฮี',
      'คันโน', 'ตัมบัคตี', 'อับดุลฮามิด', 'อัล-อัมมารี', 'อิกบาล', 'อาฟิฟ',
      'อัล-ไฮดอส', 'อาลี', 'อัล-ไอน์', 'ชาห์บี', 'อัล-มาร์รี', 'ฟาราจ'
    ]
  },
  ir: {
    first: [
      'ซาร์ดาร์', 'เมห์ดี', 'อาลีเรซา', 'ซาอิด', 'เอห์ซาน', 'รามิน', 'โฮสเซน', 'โชจา',
      'อามิน', 'โมฮัมหมัด', 'วาฮิด', 'คาริม', 'ปูร์ยา', 'โอมีด', 'เมอร์ดาด', 'อัลลาห์ยาร์',
      'ซามาน', 'เรซา', 'อามีร์', 'มอร์เตซา'
    ],
    last: [
      'อาซมูน', 'ทาเรมี', 'จาฮันบัคช์', 'เบย์รานวานด์', 'เอซาโตลาฮี', 'ฮาจซาฟี', 'เรซาเอียน', 'คานานี',
      'คาลิลซาเดห์', 'กอดดอส', 'โทราบี', 'กาเอดี', 'ชอจาอี', 'อามิรี', 'อันซารีฟาร์ด', 'ปูราลิกานจี',
      'นูราฟคาน', 'มอฮัมมาดี', 'โมเฮบี', 'การิมี'
    ]
  },
  uz: {
    first: [
      'เอลดอร์', 'อับบอสเบค', 'จาโลลิดดิน', 'โอตาเบค', 'อับดูโกดีร์', 'อัซิซเบค', 'รุสตัม', 'ออสตัน',
      'อิคติยอร์', 'จัมชิด', 'อูมาร์', 'ชารอฟ', 'ติมูร์', 'อิกอร์', 'คิมรอน', 'โบเบอร์',
      'ฟาร์รุค', 'ดิยอร์', 'เซอร์ดอร์', 'อาลีเชอร์'
    ],
    last: [
      'ชอมูโรดอฟ', 'ฟายซุลลาเยฟ', 'มาชาริพอฟ', 'ชูคูรอฟ', 'คูซานอฟ', 'ตูร์กุนโบเยฟ', 'อาชูร์มาตอฟ', 'อูรูนอฟ',
      'อิสบานดิยารอฟ', 'อัลลิคูลอฟ', 'ยูซูปอฟ', 'เออร์กิโนฟ', 'ซาฟิเยฟ', 'อับดิโคลิคอฟ', 'มูคาเมดอฟ', 'คาโมลอฟ',
      'อาลีโจโนฟ', 'นาร์ซุลลาเยฟ', 'คามดาโมฟ', 'ราคิมอฟ'
    ]
  },
  in: {
    first: [
      'ซูนีล', 'ราฮุล', 'วิเวก', 'อาร์จุน', 'โรฮัน', 'นิคิล', 'มันวีร์', 'อนิรุธ',
      'กูร์ปรีต', 'ซาฮัล', 'สตีเวน', 'วิกรัม', 'อคาช', 'พริทัม', 'สุเรช', 'ลาลเลียนซูอาลา',
      'อูดาต้า', 'อาชิค', 'เจย์', 'แบรนดอน'
    ],
    last: [
      'เชตรี', 'ชาร์มา', 'ซิงห์', 'ปาเทล', 'กุมาร', 'ท็อปโป', 'ธาปา', 'ซานดู',
      'โบส', 'โกลา', 'โกตาล', 'นาอีร์', 'มูเคอร์จี', 'เฌอนา', 'เบค', 'วาซ',
      'เฟอร์นันเดส', 'มิชรา', 'ชังเต้', 'เปา'
    ]
  },
  vn: {
    first: [
      'กวาง ไฮ', 'เทียน ลินห์', 'หุ่ง ดุง', 'ฮหว่าง ดึ๊ก', 'คอง เฟือง', 'วัน ตว่าน', 'วัน แทง', 'หง็อก ไฮ',
      'ดุย มัญ', 'ต๊วน ไฮ', 'ไท ซอน', 'มินห์ ต๊วน', 'ซวน เจื่อง', 'ดึ๊ก ชิญ', 'ฮอง ดุย', 'ตัน ต่าย',
      'วัน ลัม', 'วัน เวียด', 'เกีย ฮึง', 'วัน คัง'
    ],
    last: [
      'เหงียน', 'ตรัน', 'เล', 'ฟาม', 'ฮว่าง', 'ฟาน', 'หวู่', 'ดัง',
      'บู่ย', 'โด', 'โฮ', 'โง', 'เดือง', 'ลี', 'เกว๊', 'เวือง'
    ]
  },
  id: {
    first: [
      'ปราตามา', 'อัสนาวี', 'วิทาน', 'ริซกี้', 'มาร์เซลิโน', 'ราฟาเอล', 'อีวาร์', 'รอมฎอน',
      'ดิมัส', 'เอลคาน', 'เอกี้', 'อัลเฟอันดรา', 'ริกกี้', 'ฟาครุดดิน', 'ซัดดิล', 'ฮอกกี้',
      'นาเดโอ', 'เออร์นันโด', 'ยาคอบ', 'แยนเซอ'
    ],
    last: [
      'อาร์ฮาน', 'สุไลมาน', 'ริดโฮ', 'มังกูอาลัม', 'เฟอร์ดินาน', 'สตรูอิค', 'ปรัตมา', 'ซานันตา',
      'ดราจัต', 'แบ็กกอตต์', 'วิกรี', 'เดวังกา', 'คัมบูอายา', 'รอมฎอนี', 'ซายูรี', 'อารี',
      'อาร์กาวีนาตา', 'มูฮัมหมัด', 'พุตรา', 'กุสุมา'
    ]
  },
  my_sg: {
    first: [
      'อารีฟ', 'ไฟซาล', 'ซาฟาวี', 'อิลฮาน', 'อิคซาน', 'อิรฟาน', 'ฮาริส', 'ซียาห์มี',
      'อาคยาร์', 'ฟาริส', 'ชาวัล', 'ชะห์รุล', 'อัซซาม', 'มุฮัยมีน', 'นาซรุล', 'ดาเนียล',
      'ฮาซิก', 'นูร์', 'เอฟฟันดี้', 'ซุลฟาฮมี'
    ],
    last: [
      'ไอมาน', 'ฮาลิม', 'ราซิด', 'ฟานดี้', 'ฮารูน', 'ซาฟารี', 'อานัวร์', 'รามลี',
      'อิสกันดาร์', 'อับดุลลาห์', 'ฮัสซัน', 'อูมาร์', 'นาซารี', 'อะห์มัด', 'อิสมาอิล', 'การิม',
      'อิดริส', 'ซาอัด', 'ฮัมซาห์', 'โมฮัมหมัด'
    ]
  },
  ph: {
    first: [
      'ซานโดร', 'แพทริก', 'เควิน', 'นีล', 'ดีแลน', 'จาร์วีย์', 'เซบาสเตียน', 'ไบรอัน',
      'มิเกล', 'คริสเตียน', 'มาร์โก', 'ซันติอาโก', 'จอห์น-แพทริก', 'โจชัว', 'โอลิเวอร์', 'มานูเอล'
    ],
    last: [
      'เรเยส', 'เอเธอริดจ์', 'อิงเกรโซ', 'ไรเชลท์', 'เกย์โอโซ', 'เมนโดซา', 'คริสเตนเซน', 'รอนตา',
      'สตราอุสส์', 'มาร์ตินส์', 'เบนเนตต์', 'อาควิโน', 'การ์เซีย', 'บัลดีส', 'ซานโตส', 'ฮาร์ตมันน์'
    ]
  },
  au: {
    first: [
      'แจ็คสัน', 'แฮร์รี', 'แมทธิว', 'มาร์ติน', 'เคร็ก', 'ไรลีย์', 'จอร์แดน', 'คีอานู',
      'มิทเชลล์', 'คาเมรอน', 'คอนเนอร์', 'นาธาเนียล', 'คัลลัม', 'เลียม', 'ดีแลน', 'แซม'
    ],
    last: [
      'ไรอัน', 'ซุตตาร์', 'เออร์ไวน์', 'บอยล์', 'กูดวิน', 'บัคคัส', 'แม็คกรี', 'บอส',
      'ดุก', 'เบฮิช', 'เบอร์เจสส์', 'เม็ตคาล์ฟ', 'แอตกินสัน', 'โอคอนเนอร์', 'รอว์ลส์', 'คูโอล'
    ]
  },
  en: {
    first: [
      'แฮร์รี', 'จู๊ด', 'บูคาโย', 'ฟิล', 'โคล', 'ดีแคลน', 'มาร์คัส', 'เทรนต์',
      'จอร์แดน', 'แจ็ค', 'ค็อบบี้', 'แอนโธนี', 'โอลลี', 'จอห์น', 'ลุค', 'เจมส์',
      'เคอร์ติส', 'คอนเนอร์', 'รีซ', 'เจดอน'
    ],
    last: [
      'เคน', 'เบลลิงแฮม', 'ซาก้า', 'โฟเดน', 'พาล์มเมอร์', 'ไรซ์', 'แรชฟอร์ด', 'พิคฟอร์ด',
      'สโตนส์', 'วอล์คเกอร์', 'การ์ดเนอร์', 'กอร์ดอน', 'วัตกินส์', 'โบเวน', 'ฮาร์วีย์', 'วอร์ด',
      'โรเจอร์ส', 'เมดดิสัน', 'กัลลาเกอร์', 'เทย์เลอร์'
    ]
  },
  es: {
    first: [
      'เปดรี้', 'กาบี้', 'โรดรี้', 'ลามีน', 'อัลบาโร', 'ดานี่', 'เฟร์ราน', 'นิโก้',
      'มิเกล', 'มาร์ก', 'ปาอู', 'อูไน', 'อาเล็กซ์', 'ฟาเบียน', 'มาร์ติน', 'เยเรมี่',
      'การ์ลอส', 'ฆาบี', 'ราอูล', 'ดีเอโก้'
    ],
    last: [
      'การ์เซีย', 'ตอร์เรส', 'โมราตา', 'การ์บาฆาล', 'โอลโม่', 'ซูบิเมนดี้', 'เมริโน่', 'รุยซ์',
      'วิลเลียมส์', 'ยามาล', 'คูบาร์ซี่', 'เปเรซ', 'ซานเชซ', 'โลเปซ', 'กอนซาเลซ', 'มาร์ติเนซ',
      'โกเมซ', 'โมเรโน่', 'นาบาส', 'โอซาร์ซาบาล'
    ]
  },
  de: {
    first: [
      'จามาล', 'ฟลอเรียน', 'โยชัว', 'เลรอย', 'ไค', 'นิคลาส', 'อิลคาย', 'โทนี',
      'อันโตนิโอ', 'มานูเอล', 'เลออน', 'คาริม', 'ยูเลียน', 'โรเบิร์ต', 'คริส', 'เดวิด',
      'มัตส์', 'ลูคัส', 'เบนจามิน', 'มัคซิมิเลียน'
    ],
    last: [
      'มูเซียลา', 'เวิร์ตซ์', 'คิมมิช', 'ซาเน่', 'ฮาแวร์ตซ์', 'ฟึลล์ครูก', 'กุนโดกัน', 'รูดิเกอร์',
      'นอยเออร์', 'แทร์ ชเตเก้น', 'ทาห์', 'ชล็อทเทอร์เบ็ค', 'บรันด์ท', 'แอร์ดริช', 'โกเร็ตซ์ก้า', 'กนาบรี',
      'โกรสส์', 'บาวมันน์', 'มุลเลอร์', 'เบเออร์'
    ]
  },
  it: {
    first: [
      'นิโคโล', 'เฟเดริโก', 'อเลสซานโดร', 'จานลุยจิ', 'มัตเตโอ', 'ซานโดร', 'จาโคโม', 'ดาวิเด',
      'โลเรนโซ', 'ริคคาร์โด', 'อันเดรีย', 'มาร์โก', 'จอร์โจ', 'ชิโร', 'ลูก้า', 'กูกลิเอลโม',
      'ซามูเอเล', 'เดสตินี่', 'ปิเอโตร', 'โมอิเซ่'
    ],
    last: [
      'บาเรลล่า', 'เคียซ่า', 'บาสโตนี่', 'ดอนนารุมม่า', 'ดิ มาร์โก', 'โตนาลี่', 'ฟรัตเตซี่', 'เปเยกรินี่',
      'คาลาฟิออรี่', 'ดิ โลเรนโซ่', 'บอนจอร์โน่', 'กัตติ', 'วิคาริโอ้', 'เรเตกี', 'สคามัคค่า', 'ราสปาโดรี่',
      'คัมเบียโซ่', 'ริชชี่', 'อูโดกี้', 'รอสซี่'
    ]
  },
  fr: {
    first: [
      'คีเลียน', 'อองตวน', 'อุสมาน', 'ออเรเลียง', 'เอดูอาร์โด้', 'วิลเลียม', 'อิบราฮิมา', 'เตโอ',
      'ชูลส์', 'แรนดัล', 'แบรดลีย์', 'วาร์เรน', 'มิคาเอล', 'ไมค์', 'อาเดรียง', 'มาร์คุส',
      'โยอันน์', 'อูโก้', 'ลูคัส', 'ดาโยต์'
    ],
    last: [
      'เอ็มบัปเป้', 'กรีซมันน์', 'เดมเบเล่', 'ชูอาเมนี่', 'กามาวินก้า', 'ซาลิบา', 'โกนาเต้', 'แอร์กนองเดซ',
      'กุนเด้', 'โกโล มูอานี่', 'บาร์โกล่า', 'ซาอีร์-เอเมรี', 'โอลิเซ่', 'เมญอง', 'ราบิโอต์', 'ตูราม',
      'อูปาเมกาโน่', 'โฟฟาน่า', 'กงเต้', 'ดิอาบี้'
    ]
  },
  pt_br: {
    first: [
      'วินิซิอุส', 'โรดรีโก้', 'ราฟินญ่า', 'กาเบรียล', 'บรูโน่', 'ลูคัส', 'มาร์ควินญอส', 'อลิสซอน',
      'เอแดร์ซอน', 'บรูโน่', 'ราฟาเอล', 'แบร์นาร์โด้', 'ชูเอา', 'กอนซาโล', 'รูเบน', 'วิตินญ่า',
      'ดิโอโก้', 'เปโดร', 'มาเตอุส', 'เอ็นดริค'
    ],
    last: [
      'จูเนียร์', 'ซิลวา', 'เฟอร์นันเดส', 'ดิอาส', 'คังเซโล่', 'เนเวส', 'เลเอา', 'รามอส',
      'โจต้า', 'ปาลินญ่า', 'กิมาไรส์', 'ปาเกต้า', 'มาร์ติเนลลี่', 'มากัลเญส', 'เฆซุส', 'ริชาร์ลิซอน',
      'ซาวินโญ่', 'โรดริเกส', 'คอสต้า', 'เมนเดส'
    ]
  },
  ar_lat: {
    first: [
      'ลิโอเนล', 'เลาตาโร', 'ฮูเลียน', 'อเล็กซิส', 'เอ็นโซ', 'โรดริโก้', 'นิโคลัส', 'คริสเตียน',
      'ลิซานโดร', 'เอมิเลียโน', 'ฟรานโก้', 'การ์ลอส', 'เฟเดริโก้', 'ดาร์วิน', 'ลุยส์', 'ฮาเมส',
      'อเล็กซิส', 'อังเคล', 'เปาโล', 'ติอาโก้'
    ],
    last: [
      'มาร์ติเนซ', 'อัลวาเรซ', 'แม็ค อัลลิสเตอร์', 'เฟอร์นันเดซ', 'เด ปอล', 'โรเมโร่', 'โอตาเมนดี้', 'โมลินา',
      'ทาเกลียฟิโก้', 'การ์นาโช่', 'กอนซาเลซ', 'อัลมาด้า', 'บัลเบร์เด', 'นูนเญซ', 'ดิอาซ', 'โรดริเกซ',
      'ดีบาลา', 'ปาเรเดส', 'อคูญา', 'ริออส'
    ]
  },
  nl: {
    first: [
      'เฟอร์จิล', 'แฟรงกี้', 'เมมฟิส', 'โคดี้', 'ซาวี', 'ทิจจานี่', 'เยเรมี่', 'เดนเซล',
      'มัทไธส์', 'สเตฟาน', 'นาธาน', 'มิกกี้', 'บาร์ต', 'เยอร์ดี้', 'โจอี', 'ไบรอัน',
      'ยูร์เรียน', 'ดอนเยลล์', 'โยนัส', 'จัสติน'
    ],
    last: [
      'ฟาน ไดจ์ค', 'เดอ ยอง', 'เดปาย', 'กัคโป', 'ซิมอนส์', 'ไรน์เดอร์ส', 'ฟริมปง', 'ดุมฟรีส์',
      'เดอ ลิกต์', 'เดอ ไฟรจ์', 'อาเก้', 'ฟาน เดอ เฟน', 'แฟร์บรึคเคิน', 'ชูเทน', 'เวียร์มัน', 'บร็อบบีย์',
      'ทิมเบอร์', 'มาเลน', 'ไคลเวิร์ต', 'คุปไมเนอร์ส'
    ]
  },
  af: {
    first: [
      'วิคเตอร์', 'อเดโมล่า', 'อเล็กซ์', 'วิลเฟรด', 'ซาดิโอ', 'คาลิดู', 'เอดูอาร์', 'ปาเป้',
      'นิโคลัส', 'อิสไมลา', 'อิบราฮิมา', 'มุสซา', 'ชุควูเอเซ', 'โมเสส', 'เพอร์ซี่', 'ธีมบา',
      'อองเดร', 'โมฮาเหม็ด', 'อัชราฟ', 'โซฟียาน'
    ],
    last: [
      'โอซิมเฮน', 'ลุคแมน', 'อิโวบี', 'เอ็นดิดี้', 'มาเน่', 'คูลิบาลี', 'เมนดี้', 'ซาร์',
      'แจ็คสัน', 'เกย์', 'เนียง', 'โบนีเฟซ', 'ไซมอน', 'บาซีย์', 'เอกอง', 'เอ็นวาบาลี',
      'ซวาเน่', 'ตาอู', 'วิลเลียมส์', 'โชนู'
    ]
  },
  intl: {
    first: [
      'ลูคัส', 'มาเตอุส', 'กาเบรียล', 'ดิเอโก้', 'โรดริโก้', 'ราฟาเอล', 'บรูโน่', 'วิคเตอร์',
      'เอ็ดการ์', 'ติอาโก้', 'ฟิลิเป้', 'เลอันโดร', 'มาร์คัส', 'ดาเนียล', 'อเล็กซานเดอร์', 'ลูก้า',
      'ซามูเอล', 'อีริค', 'โอลิเวอร์', 'เซบาสเตียน'
    ],
    last: [
      'ซิลวา', 'ซานโตส', 'โอลิเวรา', 'คอสต้า', 'เฟอร์นันเดซ', 'มาร์ติเนซ', 'โรดริเกซ', 'กอนซาเลซ',
      'เปเรซ', 'ซานเชซ', 'โมเรโน', 'วาเลนเซีย', 'อันเดอร์สัน', 'โจนส์', 'คาร์เตอร์', 'โนวัก',
      'โควาชิช', 'มุลเลอร์', 'เบนเนตต์', 'การ์โดโซ'
    ]
  }
};

export interface ForeignClubCatalogEntry {
  name: string;
  code: string;
  country: string;
  flag: string;
  region: ForeignNameRegion;
  confed: ForeignConfed;
  baseOvr: number;
  kc: [string, string];
}

export const FOREIGN_CLUB_CATALOG: ForeignClubCatalogEntry[] = [
  // Asia & Oceania (32 clubs across 16 countries)
  { name: 'โตเกียว ฮาคุโร', code: 'JP', country: 'ญี่ปุ่น', flag: '🇯🇵', region: 'jp', confed: 'asia', baseOvr: 77, kc: ['#1d4ed8', '#ffffff'] },
  { name: 'โอซาก้า ซากุระ', code: 'JP', country: 'ญี่ปุ่น', flag: '🇯🇵', region: 'jp', confed: 'asia', baseOvr: 75, kc: ['#ec4899', '#1e293b'] },
  { name: 'โซล ชินโดก', code: 'KR', country: 'เกาหลีใต้', flag: '🇰🇷', region: 'kr', confed: 'asia', baseOvr: 76, kc: ['#dc2626', '#111827'] },
  { name: 'ปูซาน ไทเกอร์ส', code: 'KR', country: 'เกาหลีใต้', flag: '🇰🇷', region: 'kr', confed: 'asia', baseOvr: 74, kc: ['#0284c7', '#ffffff'] },
  { name: 'เซี่ยงไฮ้ ดราก้อน', code: 'CN', country: 'จีน', flag: '🇨🇳', region: 'cn', confed: 'asia', baseOvr: 73, kc: ['#b91c1c', '#facc15'] },
  { name: 'ปักกิ่ง เทียนหลง', code: 'CN', country: 'จีน', flag: '🇨🇳', region: 'cn', confed: 'asia', baseOvr: 72, kc: ['#15803d', '#fde047'] },
  { name: 'ริยาด อัลซาฮิล', code: 'SA', country: 'ซาอุดีอาระเบีย', flag: '🇸🇦', region: 'me', confed: 'asia', baseOvr: 78, kc: ['#1d4ed8', '#facc15'] },
  { name: 'เจดดาห์ ฟอลคอนส์', code: 'SA', country: 'ซาอุดีอาระเบีย', flag: '🇸🇦', region: 'me', confed: 'asia', baseOvr: 76, kc: ['#166534', '#ffffff'] },
  { name: 'ดูไบ อัลมาส', code: 'AE', country: 'ยูเออี', flag: '🇦🇪', region: 'me', confed: 'asia', baseOvr: 74, kc: ['#7c3aed', '#ffffff'] },
  { name: 'อาบูดาบี ซิตี้', code: 'AE', country: 'ยูเออี', flag: '🇦🇪', region: 'me', confed: 'asia', baseOvr: 75, kc: ['#0ea5e9', '#0f172a'] },
  { name: 'โดฮา สตาร์', code: 'QA', country: 'กาตาร์', flag: '🇶🇦', region: 'me', confed: 'asia', baseOvr: 75, kc: ['#7f1d1d', '#ffffff'] },
  { name: 'ลูซาอิล เอสซี', code: 'QA', country: 'กาตาร์', flag: '🇶🇦', region: 'me', confed: 'asia', baseOvr: 74, kc: ['#be123c', '#fde047'] },
  { name: 'เตหะราน ไลออนส์', code: 'IR', country: 'อิหร่าน', flag: '🇮🇷', region: 'ir', confed: 'asia', baseOvr: 75, kc: ['#dc2626', '#ffffff'] },
  { name: 'อิสฟาฮาน เอฟซี', code: 'IR', country: 'อิหร่าน', flag: '🇮🇷', region: 'ir', confed: 'asia', baseOvr: 74, kc: ['#eab308', '#111827'] },
  { name: 'แบกแดด ยูไนเต็ด', code: 'IQ', country: 'อิรัก', flag: '🇮🇶', region: 'me', confed: 'asia', baseOvr: 72, kc: ['#16a34a', '#ffffff'] },
  { name: 'บาสรา สปอร์ต', code: 'IQ', country: 'อิรัก', flag: '🇮🇶', region: 'me', confed: 'asia', baseOvr: 71, kc: ['#0f766e', '#ffffff'] },
  { name: 'ทาชเคนต์ เอฟซี', code: 'UZ', country: 'อุซเบกิสถาน', flag: '🇺🇿', region: 'uz', confed: 'asia', baseOvr: 74, kc: ['#0284c7', '#facc15'] },
  { name: 'ซามาร์คันด์ คลับ', code: 'UZ', country: 'อุซเบกิสถาน', flag: '🇺🇿', region: 'uz', confed: 'asia', baseOvr: 72, kc: ['#0369a1', '#ffffff'] },
  { name: 'ซิดนีย์ ฮาร์เบอร์', code: 'AU', country: 'ออสเตรเลีย', flag: '🇦🇺', region: 'au', confed: 'asia', baseOvr: 74, kc: ['#38bdf8', '#0f172a'] },
  { name: 'เมลเบิร์น เซาท์ครอส', code: 'AU', country: 'ออสเตรเลีย', flag: '🇦🇺', region: 'au', confed: 'asia', baseOvr: 74, kc: ['#1e3a8a', '#ffffff'] },
  { name: 'มุมไบ ราชปุระ', code: 'IN', country: 'อินเดีย', flag: '🇮🇳', region: 'in', confed: 'asia', baseOvr: 70, kc: ['#0284c7', '#f97316'] },
  { name: 'เดลี ซันดาร์', code: 'IN', country: 'อินเดีย', flag: '🇮🇳', region: 'in', confed: 'asia', baseOvr: 69, kc: ['#ea580c', '#1e293b'] },
  { name: 'ฮานอย ลองซา', code: 'VN', country: 'เวียดนาม', flag: '🇻🇳', region: 'vn', confed: 'asia', baseOvr: 71, kc: ['#7c3aed', '#facc15'] },
  { name: 'ไซ่ง่อน เอฟซี', code: 'VN', country: 'เวียดนาม', flag: '🇻🇳', region: 'vn', confed: 'asia', baseOvr: 70, kc: ['#dc2626', '#ffffff'] },
  { name: 'จาการ์ตา การูด้า', code: 'ID', country: 'อินโดนีเซีย', flag: '🇮🇩', region: 'id', confed: 'asia', baseOvr: 71, kc: ['#ea580c', '#ffffff'] },
  { name: 'บาหลี นูซา เอฟซี', code: 'ID', country: 'อินโดนีเซีย', flag: '🇮🇩', region: 'id', confed: 'asia', baseOvr: 70, kc: ['#b91c1c', '#111827'] },
  { name: 'กัวลาลัมเปอร์ ไทเกอร์ส', code: 'MY', country: 'มาเลเซีย', flag: '🇲🇾', region: 'my_sg', confed: 'asia', baseOvr: 70, kc: ['#dc2626', '#1e293b'] },
  { name: 'ยะโฮร์ ซิตี้', code: 'MY', country: 'มาเลเซีย', flag: '🇲🇾', region: 'my_sg', confed: 'asia', baseOvr: 74, kc: ['#1d4ed8', '#dc2626'] },
  { name: 'สิงคโปร์ เมอร์ลิน', code: 'SG', country: 'สิงคโปร์', flag: '🇸🇬', region: 'my_sg', confed: 'asia', baseOvr: 69, kc: ['#0284c7', '#ffffff'] },
  { name: 'มารีน่า เบย์ เอฟซี', code: 'SG', country: 'สิงคโปร์', flag: '🇸🇬', region: 'my_sg', confed: 'asia', baseOvr: 68, kc: ['#be123c', '#ffffff'] },
  { name: 'มะนิลา สตาร์', code: 'PH', country: 'ฟิลิปปินส์', flag: '🇵🇭', region: 'ph', confed: 'asia', baseOvr: 68, kc: ['#facc15', '#1d4ed8'] },
  { name: 'เซบู ยูไนเต็ด', code: 'PH', country: 'ฟิลิปปินส์', flag: '🇵🇭', region: 'ph', confed: 'asia', baseOvr: 67, kc: ['#0f766e', '#facc15'] },

  // Europe (20 clubs across 7 countries)
  { name: 'ลอนดอน รอยัล เอฟซี', code: 'GB', country: 'อังกฤษ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'en', confed: 'europe', baseOvr: 82, kc: ['#1d4ed8', '#ffffff'] },
  { name: 'แมนเชสเตอร์ เรดส์', code: 'GB', country: 'อังกฤษ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'en', confed: 'europe', baseOvr: 82, kc: ['#dc2626', '#111827'] },
  { name: 'ลิเวอร์พูล เมอร์ซีย์', code: 'GB', country: 'อังกฤษ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'en', confed: 'europe', baseOvr: 83, kc: ['#b91c1c', '#facc15'] },
  { name: 'เบอร์มิงแฮม มิดแลนด์', code: 'GB', country: 'อังกฤษ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'en', confed: 'europe', baseOvr: 78, kc: ['#7c2d12', '#38bdf8'] },
  { name: 'มาดริด รอยัล เอฟซี', code: 'ES', country: 'สเปน', flag: '🇪🇸', region: 'es', confed: 'europe', baseOvr: 85, kc: ['#ffffff', '#facc15'] },
  { name: 'บาร์เซโลนา โนวา เอฟซี', code: 'ES', country: 'สเปน', flag: '🇪🇸', region: 'es', confed: 'europe', baseOvr: 84, kc: ['#1e3a8a', '#b91c1c'] },
  { name: 'เซบีญา แอธเลติก', code: 'ES', country: 'สเปน', flag: '🇪🇸', region: 'es', confed: 'europe', baseOvr: 78, kc: ['#dc2626', '#ffffff'] },
  { name: 'มิวนิก บาวาเรีย', code: 'DE', country: 'เยอรมนี', flag: '🇩🇪', region: 'de', confed: 'europe', baseOvr: 84, kc: ['#dc2626', '#ffffff'] },
  { name: 'ดอร์ทมุนด์ รูห์ร เอฟซี', code: 'DE', country: 'เยอรมนี', flag: '🇩🇪', region: 'de', confed: 'europe', baseOvr: 81, kc: ['#facc15', '#111827'] },
  { name: 'แฟรงก์เฟิร์ต อีเกิลส์', code: 'DE', country: 'เยอรมนี', flag: '🇩🇪', region: 'de', confed: 'europe', baseOvr: 77, kc: ['#111827', '#dc2626'] },
  { name: 'มิลาน ลอมบาร์เดีย เอฟซี', code: 'IT', country: 'อิตาลี', flag: '🇮🇹', region: 'it', confed: 'europe', baseOvr: 82, kc: ['#1d4ed8', '#111827'] },
  { name: 'ตูริน อัลไพน์ เอฟซี', code: 'IT', country: 'อิตาลี', flag: '🇮🇹', region: 'it', confed: 'europe', baseOvr: 80, kc: ['#111827', '#ffffff'] },
  { name: 'โรม่า อิมพีเรียล', code: 'IT', country: 'อิตาลี', flag: '🇮🇹', region: 'it', confed: 'europe', baseOvr: 78, kc: ['#991b1b', '#f59e0b'] },
  { name: 'ปารีส แซงต์-ลูมิแอร์', code: 'FR', country: 'ฝรั่งเศส', flag: '🇫🇷', region: 'fr', confed: 'europe', baseOvr: 83, kc: ['#1e3a8a', '#dc2626'] },
  { name: 'ลียง โรน เอฟซี', code: 'FR', country: 'ฝรั่งเศส', flag: '🇫🇷', region: 'fr', confed: 'europe', baseOvr: 77, kc: ['#ffffff', '#1d4ed8'] },
  { name: 'มาร์กเซย อาซูร์', code: 'FR', country: 'ฝรั่งเศส', flag: '🇫🇷', region: 'fr', confed: 'europe', baseOvr: 78, kc: ['#38bdf8', '#ffffff'] },
  { name: 'ลิสบอน ดราก้อนส์', code: 'PT', country: 'โปรตุเกส', flag: '🇵🇹', region: 'pt_br', confed: 'europe', baseOvr: 79, kc: ['#15803d', '#ffffff'] },
  { name: 'ปอร์โต้ แอตแลนติก', code: 'PT', country: 'โปรตุเกส', flag: '🇵🇹', region: 'pt_br', confed: 'europe', baseOvr: 78, kc: ['#1d4ed8', '#ffffff'] },
  { name: 'อัมสเตอร์ดัม โกลด์', code: 'NL', country: 'เนเธอร์แลนด์', flag: '🇳🇱', region: 'nl', confed: 'europe', baseOvr: 79, kc: ['#ffffff', '#dc2626'] },
  { name: 'รอตเตอร์ดัม ฮาร์เบอร์', code: 'NL', country: 'เนเธอร์แลนด์', flag: '🇳🇱', region: 'nl', confed: 'europe', baseOvr: 77, kc: ['#dc2626', '#111827'] },

  // Americas (12 clubs across 5 countries)
  { name: 'เซาเปาโล คาริโอกา', code: 'BR', country: 'บราซิล', flag: '🇧🇷', region: 'pt_br', confed: 'americas', baseOvr: 80, kc: ['#16a34a', '#facc15'] },
  { name: 'รีโอ เด จาเนโร เอฟซี', code: 'BR', country: 'บราซิล', flag: '🇧🇷', region: 'pt_br', confed: 'americas', baseOvr: 81, kc: ['#dc2626', '#111827'] },
  { name: 'ปอร์ตู อาเลเกร เอสซี', code: 'BR', country: 'บราซิล', flag: '🇧🇷', region: 'pt_br', confed: 'americas', baseOvr: 78, kc: ['#0284c7', '#111827'] },
  { name: 'บัวโนสไอเรส ปอร์เตญโญ่', code: 'AR', country: 'อาร์เจนตินา', flag: '🇦🇷', region: 'ar_lat', confed: 'americas', baseOvr: 80, kc: ['#1d4ed8', '#facc15'] },
  { name: 'ริโอ เด ลา พลาตา เอฟซี', code: 'AR', country: 'อาร์เจนตินา', flag: '🇦🇷', region: 'ar_lat', confed: 'americas', baseOvr: 80, kc: ['#ffffff', '#dc2626'] },
  { name: 'โรซาริโอ ปัมปา เอฟซี', code: 'AR', country: 'อาร์เจนตินา', flag: '🇦🇷', region: 'ar_lat', confed: 'americas', baseOvr: 76, kc: ['#eab308', '#1e3a8a'] },
  { name: 'โบโกตา คอนดอร์', code: 'CO', country: 'โคลอมเบีย', flag: '🇨🇴', region: 'ar_lat', confed: 'americas', baseOvr: 75, kc: ['#facc15', '#1d4ed8'] },
  { name: 'เมเดยิน แอธเลติก', code: 'CO', country: 'โคลอมเบีย', flag: '🇨🇴', region: 'ar_lat', confed: 'americas', baseOvr: 75, kc: ['#16a34a', '#ffffff'] },
  { name: 'เม็กซิโก ซิตี้ อาซเท็ก', code: 'MX', country: 'เม็กซิโก', flag: '🇲🇽', region: 'es', confed: 'americas', baseOvr: 76, kc: ['#facc15', '#1e3a8a'] },
  { name: 'มอนเตร์เรย์ ฟีนิกซ์', code: 'MX', country: 'เม็กซิโก', flag: '🇲🇽', region: 'es', confed: 'americas', baseOvr: 76, kc: ['#1e3a8a', '#ffffff'] },
  { name: 'ลอสแอนเจลิส แปซิฟิก', code: 'US', country: 'สหรัฐอเมริกา', flag: '🇺🇸', region: 'en', confed: 'americas', baseOvr: 76, kc: ['#111827', '#f59e0b'] },
  { name: 'นิวยอร์ก ฮัดสัน เอสซี', code: 'US', country: 'สหรัฐอเมริกา', flag: '🇺🇸', region: 'en', confed: 'americas', baseOvr: 75, kc: ['#38bdf8', '#1e3a8a'] },

  // Africa (8 clubs across 5 countries)
  { name: 'ไคโร ฟาโรห์ เอสซี', code: 'EG', country: 'อียิปต์', flag: '🇪🇬', region: 'me', confed: 'africa', baseOvr: 76, kc: ['#dc2626', '#ffffff'] },
  { name: 'อเล็กซานเดรีย ซี', code: 'EG', country: 'อียิปต์', flag: '🇪🇬', region: 'me', confed: 'africa', baseOvr: 73, kc: ['#15803d', '#ffffff'] },
  { name: 'กาซาบล็องกา แอตลาส', code: 'MA', country: 'โมร็อกโก', flag: '🇲🇦', region: 'me', confed: 'africa', baseOvr: 76, kc: ['#b91c1c', '#16a34a'] },
  { name: 'ราบัต รอยัล', code: 'MA', country: 'โมร็อกโก', flag: '🇲🇦', region: 'me', confed: 'africa', baseOvr: 74, kc: ['#111827', '#dc2626'] },
  { name: 'ลากอส อีเกิลส์', code: 'NG', country: 'ไนจีเรีย', flag: '🇳🇬', region: 'af', confed: 'africa', baseOvr: 74, kc: ['#16a34a', '#ffffff'] },
  { name: 'อาบูจา สตาร์ส', code: 'NG', country: 'ไนจีเรีย', flag: '🇳🇬', region: 'af', confed: 'africa', baseOvr: 72, kc: ['#15803d', '#facc15'] },
  { name: 'ดาการ์ ไลออนส์ เอฟซี', code: 'SN', country: 'เซเนกัล', flag: '🇸🇳', region: 'af', confed: 'africa', baseOvr: 75, kc: ['#16a34a', '#facc15'] },
  { name: 'โจฮันเนสเบิร์ก โกลด์', code: 'ZA', country: 'แอฟริกาใต้', flag: '🇿🇦', region: 'af', confed: 'africa', baseOvr: 74, kc: ['#eab308', '#111827'] }
];

export const LEGACY_FOREIGN_CLUB_RENAMES: Record<string, string> = {
  'ซิดนีย์ ซิตี้': 'ซิดนีย์ ฮาร์เบอร์',
  'เมลเบิร์น วิคตอรี่': 'เมลเบิร์น เซาท์ครอส',
  'บาหลี ยูไนเต็ด': 'บาหลี นูซา เอฟซี',
  'เบอร์มิงแฮม ซิตี้': 'เบอร์มิงแฮม มิดแลนด์',
  'บาร์เซโลนา คาตาลัน': 'บาร์เซโลนา โนวา เอฟซี',
  'ดอร์ทมุนด์ ซิกนัล': 'ดอร์ทมุนด์ รูห์ร เอฟซี',
  'มิลาน เนรัซซูรี': 'มิลาน ลอมบาร์เดีย เอฟซี',
  'ตูริน เบียงโคเนรี': 'ตูริน อัลไพน์ เอฟซี',
  'ลียง โอลิมปิก': 'ลียง โรน เอฟซี',
  'บัวโนสไอเรส ลา โบกา': 'บัวโนสไอเรส ปอร์เตญโญ่',
  'ริเวอร์ ซิลเวอร์ เอฟซี': 'ริโอ เด ลา พลาตา เอฟซี',
  'โรซาริโอ เซนทรัล': 'โรซาริโอ ปัมปา เอฟซี',
  'ลอสแอนเจลิส กาแล็กติก': 'ลอสแอนเจลิส แปซิฟิก',
  'นิวยอร์ก เมโทร เอสซี': 'นิวยอร์ก ฮัดสัน เอสซี'
};

export const FOREIGN_CLUB_BY_NAME: Record<string, ForeignClubCatalogEntry> = Object.fromEntries(
  FOREIGN_CLUB_CATALOG.map((c) => [c.name, c])
);

export function getForeignClubEntry(teamName?: string): ForeignClubCatalogEntry | null {
  if (!teamName) return null;
  const trimmed = teamName.trim();
  const canonical = LEGACY_FOREIGN_CLUB_RENAMES[trimmed] || trimmed;
  return FOREIGN_CLUB_BY_NAME[canonical] || null;
}

export function getForeignClubStadiumName(teamName?: string): string {
  const n = (teamName || '').trim();
  if (!n) return 'อินเตอร์เนชันแนล อารีน่า';
  const canonical = LEGACY_FOREIGN_CLUB_RENAMES[n] || n;
  const meta = getForeignTeamCountryMeta(canonical);
  const city = canonical.split(/\s+/)[0] || canonical;
  const hash = [...canonical].reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 7), 0) >>> 0;

  if (!meta) return `สเตเดียม ${canonical}`;

  const patternsByCode: Partial<Record<string, string[]>> = {
    GB: [`${city} พาร์ค`, `${city} คราวน์ กราวด์`, `${city} รอยัล สเตเดียม`],
    ES: [`เอสตาดิโอ เดอ ${city}`, `${city} เมโทรโปลิตาโน`, `กัมโป ${city}`],
    DE: [`${city} สตาดิโอน`, `${city} อารีน่า ปาร์ค`, `ซิตี้-สตาดิโอน ${city}`],
    IT: [`สตาดิโอ โอลิมปิโก ${city}`, `${city} อารีน่า คัลโช่`, `ปาลาซโซ สเตเดียม ${city}`],
    FR: [`สต๊าด เดอ ${city}`, `ปาร์ก ลูมิแอร์ ${city}`, `${city} เมโทรโปล สเตเดียม`],
    PT: [`เอสตาดิโอ โด ${city}`, `${city} แอตแลนติก ปาร์ค`],
    NL: [`สตาดิโอน ฟาน ${city}`, `${city} ออเรนจ์ อารีน่า`],
    BR: [`เอสตาดิโอ โด ${city}`, `${city} มาราคานา ปาร์ค`, `อารีน่า โด ซอล ${city}`],
    AR: [`เอสตาดิโอ โมนิวเมนทัล ${city}`, `${city} ลูซ อารีน่า`],
    CO: [`เอสตาดิโอ ${city}`, `${city} อันเดส อารีน่า`],
    MX: [`เอสตาดิโอ อาซเท็ก ${city}`, `${city} ซอล อารีน่า`],
    US: [`${city} เมโทร อารีน่า`, `${city} แปซิฟิก ปาร์ค`],
    JP: [`${city} โดม สเตเดียม`, `ชิน-สเตเดียม ${city}`, `${city} ซากุระ ปาร์ค`],
    KR: [`${city} เวิลด์ คัพ ปาร์ค`, `${city} สปอร์ตส์ คอมเพล็กซ์`],
    CN: [`${city} สปอร์ตส์ เซ็นเตอร์`, `${city} ดราก้อน สเตเดียม`],
    SA: [`${city} อินเตอร์เนชันแนล อารีน่า`, `อัล-ซาฮิล สเตเดียม ${city}`],
    AE: [`${city} จิวเวล โดม`, `${city} อินเตอร์เนชันแนล ปาร์ค`],
    QA: [`${city} กัลฟ์ อารีน่า`, `คราวน์ สเตเดียม ${city}`],
    IR: [`${city} อาซาดี อารีน่า`, `${city} แกรนด์ สเตเดียม`],
    IQ: [`${city} เนชันแนล ปาร์ค`, `${city} ยูไนเต็ด สเตเดียม`],
    UZ: [`${city} เซนทรัล สเตเดียม`, `ซิลค์ โรด อารีน่า ${city}`],
    AU: [`${city} ฮาร์เบอร์ สเตเดียม`, `${city} โอวัล อารีน่า`],
    IN: [`${city} เนชันแนล อารีน่า`, `${city} สปอร์ตส์ คอมเพล็กซ์`],
    VN: [`${city} เซนทรัล สเตเดียม`, `มีดินห์-สไตล์ ปาร์ค ${city}`],
    ID: [`เกโลรา ${city} สเตเดียม`, `${city} อาร์คิเปลาโก ปาร์ค`],
    MY: [`${city} บูกิต อารีน่า`, `${city} สปอร์ตส์ ปาร์ค`],
    SG: [`${city} เนชันแนล โดม`, `มารีน่า วอเตอร์ฟรอนต์ สเตเดียม`],
    PH: [`${city} เมโทร สเตเดียม`, `${city} สปอร์ตส์ อารีน่า`],
    EG: [`${city} อินเตอร์เนชันแนล สเตเดียม`, `ไนล์ คราวน์ อารีน่า`],
    MA: [`สต๊าด เดอ ${city}`, `${city} แอตลาส อารีน่า`],
    NG: [`${city} เนชันแนล สเตเดียม`, `อีเกิลส์ อารีน่า ${city}`],
    SN: [`สต๊าด เดอ ${city}`, `เทอแรงก้า อารีน่า ${city}`],
    ZA: [`${city} โกลด์ อารีน่า`, `ซิตี้ โบว์ล ${city}`]
  };
  const pool = patternsByCode[meta.code] || [`${city} อินเตอร์เนชันแนล สเตเดียม`, `${city} สปอร์ตส์ อารีน่า`];
  return pool[hash % pool.length];
}

export function getForeignTeamCountryMeta(
  teamName?: string
): { flag: string; country: string; region: ForeignNameRegion; confed: ForeignConfed; code: string } | null {
  if (!teamName) return null;
  const n = teamName.trim();
  const exact = FOREIGN_CLUB_BY_NAME[n];
  if (exact) {
    return { flag: exact.flag, country: exact.country, region: exact.region, confed: exact.confed, code: exact.code };
  }
  if (/โตเกียว|โอซาก้า|ฮาคุโร|คิตะซึกิ|อาซูร่า|ซากุระ|ญี่ปุ่น/.test(n)) return { flag: '🇯🇵', country: 'ญี่ปุ่น', region: 'jp', confed: 'asia', code: 'JP' };
  if (/โซล|ปูซาน|อินชอน|ชินโดก|มูจิน|แทกุก|เกาหลี/.test(n)) return { flag: '🇰🇷', country: 'เกาหลีใต้', region: 'kr', confed: 'asia', code: 'KR' };
  if (/เซี่ยงไฮ้|ปักกิ่ง|เหลียงซาน|เทียนหลง|จินหลิง|จีน/.test(n)) return { flag: '🇨🇳', country: 'จีน', region: 'cn', confed: 'asia', code: 'CN' };
  if (/ริยาด|เจดดาห์|อัลซาฮิล|ซาอุดี/.test(n)) return { flag: '🇸🇦', country: 'ซาอุดีอาระเบีย', region: 'me', confed: 'asia', code: 'SA' };
  if (/ดูไบ|อาบูดาบี|อัลมาส|ยูเออี/.test(n)) return { flag: '🇦🇪', country: 'ยูเออี', region: 'me', confed: 'asia', code: 'AE' };
  if (/โดฮา|ลูซาอิล|กาตาร์/.test(n)) return { flag: '🇶🇦', country: 'กาตาร์', region: 'me', confed: 'asia', code: 'QA' };
  if (/เตหะราน|อิสฟาฮาน|คาวีร์|อิหร่าน/.test(n)) return { flag: '🇮🇷', country: 'อิหร่าน', region: 'ir', confed: 'asia', code: 'IR' };
  if (/แบกแดด|บาสรา|อิรัก/.test(n)) return { flag: '🇮🇶', country: 'อิรัก', region: 'me', confed: 'asia', code: 'IQ' };
  if (/ทาชเคนต์|ซามาร์คันด์|อุซเบกิสถาน/.test(n)) return { flag: '🇺🇿', country: 'อุซเบกิสถาน', region: 'uz', confed: 'asia', code: 'UZ' };
  if (/ซิดนีย์|เมลเบิร์น|บริสเบน|ออสเตรเลีย/.test(n)) return { flag: '🇦🇺', country: 'ออสเตรเลีย', region: 'au', confed: 'asia', code: 'AU' };
  if (/มุมไบ|เดลี|ซันดาร์|ราชปุระ|อินเดีย/.test(n)) return { flag: '🇮🇳', country: 'อินเดีย', region: 'in', confed: 'asia', code: 'IN' };
  if (/ฮานอย|ไซ่ง่อน|ลองซา|เวียดนาม/.test(n)) return { flag: '🇻🇳', country: 'เวียดนาม', region: 'vn', confed: 'asia', code: 'VN' };
  if (/จาการ์ตา|บาหลี|นุสันตรา|การูด้า|อินโดนีเซีย/.test(n)) return { flag: '🇮🇩', country: 'อินโดนีเซีย', region: 'id', confed: 'asia', code: 'ID' };
  if (/กัวลาลัมเปอร์|ยะโฮร์|มาเลเซีย/.test(n)) return { flag: '🇲🇾', country: 'มาเลเซีย', region: 'my_sg', confed: 'asia', code: 'MY' };
  if (/สิงคโปร์|มารีน่า เบย์|เมอร์ลิน/.test(n)) return { flag: '🇸🇬', country: 'สิงคโปร์', region: 'my_sg', confed: 'asia', code: 'SG' };
  if (/มะนิลา|เซบู|ฟิลิปปินส์/.test(n)) return { flag: '🇵🇭', country: 'ฟิลิปปินส์', region: 'ph', confed: 'asia', code: 'PH' };
  if (/เมียนมา/.test(n)) return { flag: '🇲🇲', country: 'เมียนมา', region: 'intl', confed: 'asia', code: 'MM' };
  if (/กัมพูชา/.test(n)) return { flag: '🇰🇭', country: 'กัมพูชา', region: 'intl', confed: 'asia', code: 'KH' };
  if (/ลอนดอน|แมนเชสเตอร์|ลิเวอร์พูล|เบอร์มิงแฮม|อังกฤษ/.test(n)) return { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'อังกฤษ', region: 'en', confed: 'europe', code: 'GB' };
  if (/มาดริด|บาร์เซโลนา|เซบีญา|สเปน/.test(n)) return { flag: '🇪🇸', country: 'สเปน', region: 'es', confed: 'europe', code: 'ES' };
  if (/มิวนิก|ดอร์ทมุนด์|แฟรงก์เฟิร์ต|เยอรมนี/.test(n)) return { flag: '🇩🇪', country: 'เยอรมนี', region: 'de', confed: 'europe', code: 'DE' };
  if (/มิลาน|ตูริน|โรม่า|อิตาลี/.test(n)) return { flag: '🇮🇹', country: 'อิตาลี', region: 'it', confed: 'europe', code: 'IT' };
  if (/ปารีส|ลียง|มาร์กเซย|ฝรั่งเศส/.test(n)) return { flag: '🇫🇷', country: 'ฝรั่งเศส', region: 'fr', confed: 'europe', code: 'FR' };
  if (/ลิสบอน|ปอร์โต้|โปรตุเกส/.test(n)) return { flag: '🇵🇹', country: 'โปรตุเกส', region: 'pt_br', confed: 'europe', code: 'PT' };
  if (/อัมสเตอร์ดัม|รอตเตอร์ดัม|เนเธอร์แลนด์/.test(n)) return { flag: '🇳🇱', country: 'เนเธอร์แลนด์', region: 'nl', confed: 'europe', code: 'NL' };
  if (/เซาเปาโล|รีโอ|ปอร์ตู อาเลเกร|บราซิล/.test(n)) return { flag: '🇧🇷', country: 'บราซิล', region: 'pt_br', confed: 'americas', code: 'BR' };
  if (/บัวโนสไอเรส|ริเวอร์|ริโอ เด ลา พลาตา|โรซาริโอ|อาร์เจนตินา/.test(n)) return { flag: '🇦🇷', country: 'อาร์เจนตินา', region: 'ar_lat', confed: 'americas', code: 'AR' };
  if (/โบโกตา|เมเดยิน|โคลอมเบีย/.test(n)) return { flag: '🇨🇴', country: 'โคลอมเบีย', region: 'ar_lat', confed: 'americas', code: 'CO' };
  if (/เม็กซิโก|มอนเตร์เรย์/.test(n)) return { flag: '🇲🇽', country: 'เม็กซิโก', region: 'es', confed: 'americas', code: 'MX' };
  if (/ลอสแอนเจลิส|นิวยอร์ก|สหรัฐ/.test(n)) return { flag: '🇺🇸', country: 'สหรัฐอเมริกา', region: 'en', confed: 'americas', code: 'US' };
  if (/ไคโร|อเล็กซานเดรีย|อียิปต์/.test(n)) return { flag: '🇪🇬', country: 'อียิปต์', region: 'me', confed: 'africa', code: 'EG' };
  if (/กาซาบล็องกา|ราบัต|โมร็อกโก/.test(n)) return { flag: '🇲🇦', country: 'โมร็อกโก', region: 'me', confed: 'africa', code: 'MA' };
  if (/ลากอส|อาบูจา|ไนจีเรีย/.test(n)) return { flag: '🇳🇬', country: 'ไนจีเรีย', region: 'af', confed: 'africa', code: 'NG' };
  if (/ดาการ์|เซเนกัล/.test(n)) return { flag: '🇸🇳', country: 'เซเนกัล', region: 'af', confed: 'africa', code: 'SN' };
  if (/โจฮันเนสเบิร์ก|แอฟริกาใต้/.test(n)) return { flag: '🇿🇦', country: 'แอฟริกาใต้', region: 'af', confed: 'africa', code: 'ZA' };
  return null;
}

export function inferForeignTeamRegion(teamName?: string): ForeignNameRegion | null {
  return getForeignTeamCountryMeta(teamName)?.region || null;
}

export const NG = [
  [
    'อรุณรุ่ง', 'สายหมอก', 'ทุ่งทอง', 'ผาแดง', 'ห้วยมรกต', 'ไพรวัลย์', 'ท่าทรายทอง', 'รุ่งตะวัน',
    'ดอยอรุณ', 'หาดแก้ว', 'บึงทอง', 'เนินไศล', 'ธาราใส', 'สนไพร', 'วังศิลา', 'ทุ่งแสงดาว',
    'ภูอรุณ', 'ร่มไทร', 'แสงจันทร์', 'ไร่ทองคำ', 'เนินมณี', 'ชลธารา', 'นทีทอง', 'รวงทอง',
    'ยอดภู', 'ริมธารา', 'สันผา', 'สวนแก้ว', 'แสงเหนือ', 'พนาลี', 'ริมชล', 'บุษบา'
  ],
  [
    'เวียงทอง', 'นครฟ้า', 'นพรัตน์', 'มณีปุระ', 'ศิรินคร', 'เวียงแก้ว', 'สุวรรณปุระ', 'ภูมินทร์',
    'ชัยวรมัน', 'ทิพยนคร', 'อินทราปุระ', 'สุริยนคร', 'จันทรปุระ', 'วชิรนคร', 'อัคนีปุระ', 'วรุณนคร',
    'ไกรลาส', 'หิมพานต์', 'พิมานปุระ', 'มรกตปุระ', 'วิมานทอง', 'อุตรนคร', 'ดาราปุระ', 'เหมราช',
    'นภดล', 'รัชตะนคร', 'อโนดาต', 'สุธาปุระ', 'เวียงสวรรค์', 'ธราดล', 'ศศินคร', 'ปฐพีปุระ'
  ],
  [
    'สยาม', 'มหานคร', 'เจ้าพระยา', 'สุวรรณภูมิ', 'ราชธานี', 'อรุณทวีป', 'ศรีนคร', 'รัตนากร',
    'บูรพา', 'ทักษิณ', 'อัคคี', 'เทวา', 'มหิธร', 'จตุรทิศ', 'เทพนคร', 'จักรวาล',
    'อันดามัน', 'อ่าวไทย', 'ราชันย์', 'เอกราช', 'ราชพฤกษ์', 'ก้องฟ้า', 'เมฆา', 'สิงขร',
    'ไตรรงค์', 'สุริยา', 'ดารา', 'นครินทร์', 'วายุ', 'อัศวิน', 'เกียรติสยาม', 'ราชสีห์'
  ]
];

export const TIER_STANDALONE_CLUBS = [
  [
    'สิงห์สายน้ำ', 'เสือตะวันตก', 'ช้างป่าดงพญา', 'อินทรีทะเลใต้',
    'พยัคฆ์ทุ่งหลวง', 'ม้าศึกเมืองเหนือ', 'เหยี่ยวปากอ่าว', 'กระทิงดอย',
    'นาคาลุ่มน้ำ', 'หงส์ฟ้าชายแดน', 'มังกรคาบสมุทร', 'นักรบรุ่งอรุณ'
  ],
  [
    'พยัคฆ์ล้านนา', 'ขุนพลแดนทอง', 'มังกรอีสาน', 'นักรบปักษ์ใต้',
    'ราชันภูผา', 'อินทรีอันดามัน', 'สิงห์เจ้าพระยา', 'ช้างขาวบูรพา',
    'กระทิงตะวันตก', 'นาคามรกต', 'หงส์หยกเมืองเหนือ', 'คชสารแดนใต้',
    'เหยี่ยวฟ้าพนา', 'ฉลามอ่าวไทย'
  ],
  [
    'อัศวินนครหลวง', 'พยัคฆ์เจ้าพระยา', 'ราชสีห์สุวรรณภูมิ', 'มังกรบูรพา',
    'อินทรีอรุณรุ่ง', 'ฉลามทะเลทอง', 'นาคินทร์ลุ่มน้ำ', 'สิงห์ทักษิณ',
    'เสือดาวเหนือฟ้า', 'อาชาไนยไตรรงค์', 'เหยี่ยวฟ้าอันดามัน', 'กระทิงนคร',
    'พญาหงส์อัคนี', 'ขุนศึกสยาม', 'เทพราชสีห์', 'วายุภักษ์อารีน่า'
  ]
];

export const LEGACY_THAI_CLUB_PREFIX_RENAMES: Record<string, string> = {
  // Old Tier 0 district/town names -> Fictional names
  บางแสน: 'อรุณรุ่ง', หัวหิน: 'สายหมอก', แม่กลอง: 'ทุ่งทอง', อัมพวา: 'ผาแดง',
  ปากน้ำ: 'ห้วยมรกต', เชียงคาน: 'ไพรวัลย์', ปาย: 'ท่าทรายทอง', ลำปาง: 'รุ่งตะวัน',
  หาดใหญ่: 'ดอยอรุณ', ศรีราชา: 'หาดแก้ว', พัทยา: 'บึงทอง', ชะอำ: 'เนินไศล',
  สัตหีบ: 'ธาราใส', ปากช่อง: 'สนไพร', ดอนเมือง: 'วังศิลา', แม่สอด: 'ทุ่งแสงดาว',
  บ้านโป่ง: 'ภูอรุณ', หล่มสัก: 'ร่มไทร', เบตง: 'แสงจันทร์', เกาะสมุย: 'ไร่ทองคำ',
  อ่าวนาง: 'เนินมณี', ท่าเรือ: 'ชลธารา', สามพราน: 'นทีทอง', ลาดกระบัง: 'รวงทอง',
  โพธาราม: 'ยอดภู', สันทราย: 'ริมธารา', บางปู: 'สันผา', บางสะพาน: 'สวนแก้ว',
  สวรรคโลก: 'แสงเหนือ', พานทอง: 'พนาลี', บางเลน: 'ริมชล', วังน้ำเขียว: 'บุษบา',
  // Old Tier 1 province names -> Fictional names
  เชียงใหม่: 'เวียงทอง', ขอนแก่น: 'นครฟ้า', โคราช: 'นพรัตน์', ชลบุรี: 'มณีปุระ',
  สุพรรณ: 'ศิรินคร', ระยอง: 'เวียงแก้ว', สงขลา: 'สุวรรณปุระ', อุดรธานี: 'ภูมินทร์',
  อยุธยา: 'ชัยวรมัน', พิษณุโลก: 'ทิพยนคร', สุโขทัย: 'อินทราปุระ', ภูเก็ต: 'สุริยนคร',
  กระบี่: 'จันทรปุระ', นครปฐม: 'วชิรนคร', ราชบุรี: 'อัคนีปุระ', สระบุรี: 'วรุณนคร',
  ลำพูน: 'ไกรลาส', แพร่: 'หิมพานต์', ตราด: 'พิมานปุระ', หนองคาย: 'มรกตปุระ',
  ศรีสะเกษ: 'วิมานทอง', บุรีรัมย์: 'อุตรนคร', จันทบุรี: 'ดาราปุระ', เพชรบุรี: 'เหมราช',
  น่าน: 'นภดล', ชัยนาท: 'รัชตะนคร', ประจวบ: 'อโนดาต', สมุทรสาคร: 'สุธาปุระ',
  นนทบุรี: 'เวียงสวรรค์', ปทุมธานี: 'ธราดล', สุรินทร์: 'ศศินคร', สกลนคร: 'ปฐพีปุระ',
  // Old Tier 2 place names -> Fictional names
  ธนบุรี: 'ราชธานี', อโยธยา: 'อรุณทวีป', ล้านนา: 'อัคคี', อีสาน: 'เทวา',
  นพบุรี: 'มหิธร', เวียงพิงค์: 'จตุรทิศ', อินทนนท์: 'จักรวาล', ปทุมวัน: 'ราชันย์',
  พญาไท: 'เอกราช', บางกอก: 'ก้องฟ้า', ศรีวิชัย: 'เมฆา', ทวารวดี: 'สิงขร'
};

export const LEGACY_THAI_STANDALONE_RENAMES: Record<string, string> = {
  นักรบปากน้ำโพ: 'นักรบรุ่งอรุณ',
  ขุนพลกรุงเก่า: 'ขุนพลแดนทอง',
  ราชันเมืองโอ่ง: 'ราชันภูผา',
  เหยี่ยวอีสานใต้: 'เหยี่ยวฟ้าพนา',
  อินทรีอโยธยา: 'อินทรีอรุณรุ่ง',
  เสือดาวล้านนา: 'เสือดาวเหนือฟ้า',
  อาชาไนยอีสาน: 'อาชาไนยไตรรงค์',
  พญาหงส์กรุงธน: 'พญาหงส์อัคนี'
};

export const AN = FOREIGN_CLUB_CATALOG.map((c) => c.name);

export const RN = ['รอบ 16 ทีม', 'รอบ 8 ทีม', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];
export const TN = ['ลีกระดับจังหวัด', 'ลีกในประเทศ ดิวิชั่น 2', 'ลีกในประเทศ ดิวิชั่น 1', 'สโมสรนานาชาติ'];
export const BASE = [40, 54, 68, 72];
export const POS: Position[] = ['GK', 'DF', 'MF', 'FW'];
export const ATT: [StatKey, string][] = [['sh', 'ยิง'], ['ps', 'จ่าย'], ['dr', 'เลี้ยง'], ['tk', 'แย่ง'], ['ph', 'กาย']];
export const GN: Record<Position, string> = { GK: 'ผู้รักษาประตู', DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };

export const SFX0 = [
  ['เอฟซี', 'ซิตี้', 'เอสซี', 'ยูธ', 'ทาวน์', 'คลับ', 'สปอร์ต'],
  ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้', 'เอสซี', 'แอธเลติก', 'คลับ', 'สปอร์ต'],
  ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้', 'เอสซี', 'คลับ', 'สปอร์ต', '']
];

export const FSD: Record<string, [SubRole, number, number][]> = {
  '4-4-2': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['LM', 12, 49], ['LCM', 38, 54], ['RCM', 62, 54], ['RM', 88, 49], ['LS', 38, 19], ['RS', 62, 19]],
  '4-3-3': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['LCM', 27, 47], ['CDM', 50, 58], ['RCM', 73, 47], ['LW', 15, 22], ['ST', 50, 14], ['RW', 85, 22]],
  '4-3-3 (F9)': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['LCM', 28, 48], ['CDM', 50, 59], ['RCM', 72, 48], ['LW', 18, 18], ['CF', 50, 26], ['RW', 82, 18]],
  '3-5-2': [['GK', 50, 93], ['LCB', 24, 76], ['CB', 50, 79], ['RCB', 76, 76], ['LM', 8, 45], ['LCM', 30, 52], ['CDM', 50, 60], ['RCM', 70, 52], ['RM', 92, 45], ['LS', 38, 18], ['RS', 62, 18]],
  '4-2-3-1': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['LDM', 36, 60], ['RDM', 64, 60], ['LM', 14, 39], ['CAM', 50, 38], ['RM', 86, 39], ['ST', 50, 13]],
  '5-3-2': [['GK', 50, 93], ['LWB', 8, 62], ['LCB', 28, 76], ['CB', 50, 79], ['RCB', 72, 76], ['RWB', 92, 62], ['LCM', 27, 46], ['CDM', 50, 59], ['RCM', 73, 46], ['LS', 38, 18], ['RS', 62, 18]],
  '3-4-3': [['GK', 50, 93], ['LCB', 24, 76], ['CB', 50, 79], ['RCB', 76, 76], ['LM', 10, 51], ['LCM', 38, 55], ['RCM', 62, 55], ['RM', 90, 51], ['LW', 18, 20], ['ST', 50, 13], ['RW', 82, 20]],
  '5-4-1': [['GK', 50, 93], ['LWB', 8, 64], ['LCB', 28, 76], ['CB', 50, 79], ['RCB', 72, 76], ['RWB', 92, 64], ['LM', 14, 46], ['LCM', 38, 52], ['RCM', 62, 52], ['RM', 86, 46], ['ST', 50, 16]],
  '4-4-1-1': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['LM', 12, 52], ['LCM', 38, 56], ['RCM', 62, 56], ['RM', 88, 52], ['CF', 50, 29], ['ST', 50, 12]],
  '4-1-2-1-2': [['GK', 50, 93], ['LB', 14, 72], ['LCB', 38, 77], ['RCB', 62, 77], ['RB', 86, 72], ['CDM', 50, 60], ['LCM', 27, 48], ['RCM', 73, 48], ['CAM', 50, 38], ['LS', 38, 15], ['RS', 62, 15]]
};

export const LINE: Record<string, Position> = {
  GK: 'GK', CB: 'DF', LCB: 'DF', RCB: 'DF', LB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF',
  CDM: 'MF', LDM: 'MF', RDM: 'MF', CM: 'MF', LCM: 'MF', RCM: 'MF', CAM: 'MF', LM: 'MF', RM: 'MF',
  ST: 'FW', LS: 'FW', RS: 'FW', LST: 'FW', RST: 'FW', CF: 'FW', LW: 'FW', RW: 'FW'
};

// CF (False 9 / Link-up) is kept distinct from ST (Poacher); LCB/RCB and CB share natural CB mastery, LS/RS and ST share natural ST mastery
export const EQ: Record<string, string> = {
  LCB: 'CB', RCB: 'CB',
  LCM: 'CM', RCM: 'CM',
  LDM: 'CDM', RDM: 'CDM',
  LS: 'ST', RS: 'ST',
  LST: 'ST', RST: 'ST'
};
export const baseRoleOf = (ro?: string | null): string => (ro ? EQ[ro] || ro : '');

export const SIMP = [
  'LB LWB', 'RB RWB', 'CDM CM', 'CM CAM', 'CM LM', 'CM RM', 'LM LW', 'RM RW',
  'ST CF', 'CF CAM', 'CF LW', 'CF RW',
  'LW ST', 'RW ST', 'LW CF', 'RW CF', 'LWB LM', 'RWB RM', 'CB CDM'
];
export const PM = [1, 0.94, 0.85];
export const PCOL = ['#ffffff', '#ffc247', '#ff6b6b'];

export const SPX: Record<Position, SubRole[]> = {
  GK: ['GK'],
  DF: ['LCB', 'RCB', 'LB', 'RB', 'LWB', 'RWB', 'CB'],
  MF: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'LCM', 'RCM', 'LDM', 'RDM'],
  FW: ['ST', 'CF', 'LW', 'RW', 'LS', 'RS']
};

// Keep indices 0..20 fixed for saveCodec backward compatibility; indices 21..22 upgrade LST/RST to LS/RS cleanly.
export const ALL_SUB_ROLES: SubRole[] = [
  'GK',
  'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'CF', 'LW', 'RW',
  'LCB', 'RCB', 'LDM', 'RDM', 'LCM', 'RCM', 'LS', 'RS'
];

export const SPN: Record<string, string> = {
  GK: 'ผู้รักษาประตู',
  CB: 'เซนเตอร์กลาง (หลัง 3)',
  LCB: 'เซนเตอร์ซ้าย',
  RCB: 'เซนเตอร์ขวา',
  LB: 'แบ็กซ้าย',
  RB: 'แบ็กขวา',
  CDM: 'กองกลางตัวรับ',
  CM: 'กองกลาง',
  CAM: 'กองกลางตัวรุก',
  LM: 'ปีกซ้าย(กลาง)',
  RM: 'ปีกขวา(กลาง)',
  ST: 'หน้าเป้า (ปักหลักจบสกอร์)',
  LS: 'หน้าคู่ซ้าย (Left Striker)',
  RS: 'หน้าคู่ขวา (Right Striker)',
  CF: 'หน้าเชื่อม (False 9 / พักบอล)',
  LCM: 'กองกลางซ้าย',
  RCM: 'กองกลางขวา',
  LDM: 'ตัวรับซ้าย',
  RDM: 'ตัวรับขวา',
  LWB: 'วิงแบ็กซ้าย',
  RWB: 'วิงแบ็กขวา',
  LW: 'ปีกซ้าย',
  RW: 'ปีกขวา'
};

export const ROLE_HINT: Partial<Record<SubRole, string>> = {
  LCB: 'เซนเตอร์แบ็กฝั่งซ้าย (นิยมในระบบหลัง 4 และหลัง 3) สามารถหุบยืน CB ตัวกลางได้คล่อง',
  RCB: 'เซนเตอร์แบ็กฝั่งขวา (นิยมในระบบหลัง 4 และหลัง 3) สามารถหุบยืน CB ตัวกลางได้คล่อง',
  CB: 'เซนเตอร์ตัวกลางสำหรับระบบหลัง 3 (ไม่ค่อยนิยมใช้เป็นตัวหลักในระบบหลัง 4 แต่เล่น LCB/RCB ได้เต็มร้อย)',
  ST: 'ปักหลักค้ำแนวรับคู่แข่ง ยืนได้ทั้งหน้าเดี่ยวและหน้าคู่ (LS/RS) รอเข้าฮอสในกรอบเขตโทษ',
  LS: 'กองหน้าคู่ฝั่งซ้าย (Left Striker) ประสานงานคู่หูแดนหน้า วิ่งฉีกช่องและจบสกอร์',
  RS: 'กองหน้าคู่ฝั่งขวา (Right Striker) ประสานงานคู่หูแดนหน้า วิ่งฉีกช่องและจบสกอร์',
  CF: 'ถอยลงมารับบอลเชื่อมเกม ดึงเซนเตอร์หลุดตำแหน่งเพื่อเปิดช่องให้ปีกและตัวสอดเข้ายิง'
};

export const POSL: SubRole[] = [
  'ST', 'LS', 'RS', 'CF', 'CAM', 'LW', 'RW',
  'LM', 'RM', 'CM', 'LCM', 'RCM', 'CDM', 'LDM', 'RDM',
  'LCB', 'RCB', 'CB', 'RWB', 'LWB', 'LB', 'RB'
];
export const SKIN_P = ['#f6d4b3', '#f1c9a0', '#d9a273', '#a8744a', '#6b4630', '#fde4cf', '#c68642', '#4b2e1e'];
export const HAIR_P = ['#16161a', '#4a2e16', '#8b5a2b', '#c9a227', '#7a2e22', '#d1d5db', '#e5e7eb', '#d97706', '#2563eb', '#be185d'];
export const HS_N = [
  'คลาสสิก', 'สไปกี้', 'ปัดข้าง', 'หยิกฟู', 'สกินเฮด', 'เสยเรียบ', 'คาดผม', 'แสกกลาง',
  'โมฮอว์ก', 'อันเดอร์คัต', 'มัดจุก', 'เดรดล็อก', 'มัลเล็ต', 'หัวโล้น',
  'ทูบล็อกเกาหลี', 'แสกคอมม่า', 'เฟดควิฟฟ์', 'สลิคแบ็กเท่', 'วูล์ฟคัท', 'เท็กซ์เจอร์ครอป',
  'ปอมปาดัวร์เฟด', 'ไซด์พาร์ทเนี้ยบ', 'ดรอปเฟดลอนคลื่น', 'คอมม่าทูบล็อก', 'เบิรสต์เฟดตั้งเท่', 'ซอฟต์เซอร์เฟอร์'
];
export const FH_N = ['ไม่มี', 'เคราแพะ', 'เคราเต็ม', 'หนวด', 'ตอหนวดจาง', 'เคราแพะ+หนวด', 'เคราจอนยาว', 'เคราหนาเข้ม'];
export const FS_N = ['เรียว', 'กลม', 'กรามคม', 'เหลี่ยมคม', 'หน้ายาว', 'โหนกแก้มชัด'];
export const EY_N = ['มุ่งมั่น', 'จริงจัง', 'ยิ้มมั่นใจ', 'สุขุม', 'ดุดัน', 'ยิ้มมุมปาก', 'ตาโตสดใส', 'เยือกเย็น', 'คิ้วเข้มคม', 'มาดพระเอก'];
export const ACC_N = ['ไม่มี', 'ผ้าคาดหัว', 'พลาสเตอร์แก้ม', 'เทปจมูก', 'รอยบากคิ้ว', 'แว่นสปอร์ต', 'หน้ากากกันชน', 'เพนต์แก้มทีม'];

export const KIT_P: [string, string][] = [
  ['#c0392b', '#ffffff'], ['#1d4ed8', '#facc15'], ['#ea580c', '#0f172a'], ['#6d28d9', '#fde047'],
  ['#111827', '#f8fafc'], ['#0f766e', '#ffedd5'], ['#be185d', '#ecfeff'], ['#15803d', '#ffffff'],
  ['#eab308', '#0f172a'], ['#1e3a8a', '#fb923c'], ['#7f1d1d', '#bae6fd'], ['#0ea5e9', '#0f172a'],
  ['#9f1239', '#a7f3d0'], ['#0369a1', '#fef08a'], ['#4c1d95', '#f8fafc'], ['#f8fafc', '#0f172a']
];
export const KIT_SW = [
  '#c0392b', '#991b1b', '#e67e22', '#f4c63d', '#84cc16', '#1c7a4a',
  '#0e7c86', '#0ea5e9', '#2f6fd6', '#1e3a8a', '#7c3aed', '#d6336c',
  '#ffffff', '#cbd5e1', '#111111'
];

export const SIGL: Record<string, string> = {
  fin: 'จบสกอร์', pw: 'พลังยิง', cur: 'ยิงโค้ง', lsh: 'ยิงไกล', fk: 'ลูกตั้งเตะ', run: 'เข้าทำ',
  drb: 'เลี้ยงบอล', ctrl: 'จับบอล', spass: 'ส่งบอลสั้น', lpass: 'ส่งบอลยาว', crs: 'เปิดบอล', vis: 'ไหวพริบ',
  rd: 'อ่านเกม', tkl: 'เข้าสกัด', pos: 'ยืนตำแหน่ง', mrk: 'ประกบตัว', blk: 'บล็อกลูกยิง', hd: 'โหม่ง',
  spd: 'ความเร็ว', acc: 'สปีดต้น', str: 'แข็งแกร่ง', sta: 'ความอึด', agi: 'ความคล่องตัว', jmp: 'กระโดดสูง',
  tol: 'ทนต่อบาดเจ็บ', rec: 'ฟื้นตัวเร็ว', end: 'ยืนระยะเกม', bal: 'สมดุลร่างกาย', con: 'ความสม่ำเสมอ',
  comp: 'นิ่งในนัดใหญ่', foc: 'สมาธิในเกม', ldr: 'ภาวะผู้นำ', det: 'ความมุ่งมั่น',
  sv: 'พุ่งเซฟ', rfx: 'ปฏิกิริยา', hnd: 'รับบอล', cl: 'ปิดมุมยิง', dist: 'เปิดเกม'
};

export const FOOTBALL_TRAITS: FootballTraitDef[] = [
  // Attacking
  {
    id: 'poacher_instinct',
    icon: '🎯',
    name: 'จมูกไวหน้าประตู',
    desc: 'เข้าฮอสในกรอบเขตโทษเฉียบขาด หาจังหวะซ้ำดาบสองเก่ง',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CF', 'CAM']
  },
  {
    id: 'outside_curler',
    icon: '🌀',
    name: 'ชอบปั่นไซด์โค้ง',
    desc: 'ถนัดปั่นไซด์โป้งและไซด์ก้อยทริเวล่าโค้งหนีมือผู้รักษาประตู',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['LW', 'RW', 'CAM', 'CF', 'LM', 'RM']
  },
  {
    id: 'long_shot_lover',
    icon: '🚀',
    name: 'บ้ายิงไกล',
    desc: 'เห็นพื้นที่หน้ากรอบมักสับไกเต็มข้อจากระยะไกลทันที',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['CAM', 'CM', 'ST', 'LW', 'RW']
  },
  {
    id: 'chip_artist',
    icon: '🪶',
    name: 'ชอบชิพข้ามหัว',
    desc: 'ใจเย็นเหนือชั้น ยกบอลข้ามหัวผู้รักษาประตูเวลาหลุดเดี่ยว',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CF', 'CAM']
  },
  {
    id: 'acrobatic_finisher',
    icon: '🤸',
    name: 'จอมตีลังกา/วอลเลย์',
    desc: 'ชอบยิงท่าผาดโผน ฟาดวอลเลย์และจักรยานอากาศในกรอบ',
    tone: 'att',
    pos: ['FW'],
    roles: ['ST', 'CF', 'LW', 'RW']
  },
  {
    id: 'selfish_shooter',
    icon: '😈',
    name: 'หวงบอล/บ้ายิง',
    desc: 'ได้บอลใกล้ประตูมักเลือกยิงเองมากกว่าจ่ายให้เพื่อน',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'LW', 'RW'],
    conflicts: ['team_first']
  },
  {
    id: 'offside_trap_breaker',
    icon: '⚡',
    name: 'เช็กไลน์หลุดกับดัก',
    desc: 'อ่านไลน์กองหลังเก่ง ออกตัวหลุดกับดักล้ำหน้าได้บ่อย',
    tone: 'att',
    pos: ['FW'],
    roles: ['ST', 'LW', 'RW']
  },
  {
    id: 'aerial_menace',
    icon: '🦅',
    name: 'เจ้าเวหาชอบโขก',
    desc: 'ชิงจังหวะโหม่งกลางอากาศได้เปรียบทั้งลูกเปิดและลูกตั้งเตะ',
    tone: 'att',
    pos: ['FW', 'DF'],
    roles: ['ST', 'CB']
  },
  {
    id: 'near_post_runner',
    icon: '🏃',
    name: 'ชอบโฉบเสาแรก',
    desc: 'พุ่งโฉบตัดหน้าแนวรับตรงเสาแรกเมื่อเพื่อนเตรียมเปิดบอล',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CF', 'CAM']
  },

  // Playmaking / Dribbling
  {
    id: 'killer_passer',
    icon: '🪄',
    name: 'ชอบแทงทะลุช่อง',
    desc: 'มองเห็นช่องว่างแนวรับและกล้าแทงคิลเลอร์พาสให้เพื่อนหลุดเดี่ยว',
    tone: 'play',
    pos: ['MF', 'FW'],
    roles: ['CAM', 'CM', 'LCM', 'RCM', 'CF']
  },
  {
    id: 'flair_dribbler',
    icon: '🎭',
    name: 'สายสับขา/ลีลาจัด',
    desc: 'กล้าดวลเดี่ยวเลี้ยงหลบคู่แข่ง โชว์สเต็ปแหวกแนวรับและเรียกฟาวล์',
    tone: 'play',
    pos: ['FW', 'MF', 'DF'],
    roles: ['LW', 'RW', 'LM', 'RM', 'CAM', 'LWB', 'RWB']
  },
  {
    id: 'early_crosser',
    icon: '🎯',
    name: 'ชอบเปิดบอลเร็ว',
    desc: 'ได้จังหวะริมเส้นมักครอสบอลโค้งเข้ากรอบทันทีก่อนแนวรับตั้งตัว',
    tone: 'play',
    pos: ['MF', 'DF', 'FW'],
    roles: ['LM', 'RM', 'LB', 'RB', 'LWB', 'RWB', 'LW', 'RW']
  },
  {
    id: 'long_diagonal',
    icon: '📡',
    name: 'ชอบวางบอลเปลี่ยนแกน',
    desc: 'ถนัดเปิดบอลยาวข้ามฟากแม่นยำเพื่อฉีกแนวรับคู่แข่ง',
    tone: 'play',
    pos: ['MF', 'DF'],
    roles: ['CM', 'CDM', 'LCM', 'RCM', 'CB', 'LB', 'RB']
  },
  {
    id: 'one_two_lover',
    icon: '🔁',
    name: 'ชอบเล่นชิ่ง 1-2',
    desc: 'ชอบฝากบอลให้เพื่อนแล้ววิ่งสอดหาพื้นที่รับบอลคืนทันที',
    tone: 'play',
    pos: ['MF', 'FW'],
    roles: ['CF', 'CAM', 'CM', 'LW', 'RW']
  },
  {
    id: 'setpiece_specialist',
    icon: '📐',
    name: 'เจ้าพ่อลูกนิ่ง',
    desc: 'รับหน้าที่ปั่นฟรีคิกและเปิดลูกเตะมุมโค้งอันตรายอย่างแม่นยำ',
    tone: 'play',
    pos: ['MF', 'FW', 'DF'],
    roles: ['CAM', 'CM', 'LW', 'RW', 'LB', 'RB']
  },
  {
    id: 'tempo_controller',
    icon: '🕰️',
    name: 'ตัวคุมจังหวะเกม',
    desc: 'เก็บบอลเหนียวแน่น คุมสปีดการต่อบอลของทีมไม่ให้เสียจังหวะ',
    tone: 'play',
    pos: ['MF', 'DF'],
    roles: ['CM', 'CDM', 'LCM', 'RCM', 'LDM', 'RDM']
  },
  {
    id: 'team_first',
    icon: '🤝',
    name: 'สายทีมเวิร์กจ่ายชัวร์',
    desc: 'เล่นเพื่อทีม เชื่อมบอลปลอดภัยและส่งให้เพื่อนที่ยืนตำแหน่งดีกว่า',
    tone: 'play',
    pos: ['MF', 'DF', 'FW'],
    roles: ['CM', 'CDM', 'CF', 'LB', 'RB'],
    conflicts: ['selfish_shooter']
  },

  // Defending
  {
    id: 'slide_tackler',
    icon: '🛷',
    name: 'ชอบเสียบสไลด์',
    desc: 'กล้าพุ่งสไลด์กวาดบอลเด็ดขาดในจังหวะสำคัญ (เสี่ยงฟาวล์เล็กน้อย)',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'LB', 'RB', 'CDM', 'LDM', 'RDM']
  },
  {
    id: 'interception_hawk',
    icon: '👁️',
    name: 'ดักทางบอลเฉียบ',
    desc: 'อ่านจังหวะจ่ายบอลคู่แข่งขาด ชอบชิงตัดบอลก่อนถึงเป้าหมาย',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'CDM', 'LDM', 'RDM', 'CM']
  },
  {
    id: 'man_marker',
    icon: '🔒',
    name: 'กัดไม่ปล่อย',
    desc: 'ประกบตัวรุกคู่แข่งติดแจ เบียดปะทะหนักหน่วงไม่ให้พลิกบอล',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'CDM', 'LB', 'RB']
  },
  {
    id: 'body_blocker',
    icon: '🧱',
    name: 'เอาตัวขวางทุกช็อต',
    desc: 'กล้าทิ้งตัวบล็อกลูกยิงหน้าเขตโทษ ช่วยเซฟจังหวะอันตรายได้บ่อย',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'CDM']
  },
  {
    id: 'ball_playing_cb',
    icon: '🧠',
    name: 'หลังชอบลากขึ้นเกม',
    desc: 'กล้าพาบอลขึ้นหน้าและจ่ายบอลทะลุไลน์จากแดนหลัง',
    tone: 'def',
    pos: ['DF'],
    roles: ['CB', 'LB', 'RB']
  },
  {
    id: 'overlapping_runner',
    icon: '🚂',
    name: 'แบ็กจอมเติมเกม',
    desc: 'ชอบวิ่งสปีดอ้อมหลังปีกขึ้นสุดเส้นหลังเพื่อเปิดบอลกดดัน',
    tone: 'def',
    pos: ['DF'],
    roles: ['LB', 'RB', 'LWB', 'RWB']
  },

  // Goalkeeper
  {
    id: 'sweeper_keeper',
    icon: '🦅',
    name: 'โกลชอบออกมาตัดบอล',
    desc: 'กล้าออกมานอกเส้นประตูตัดบอลยาวและปิดมุมยิงเร็ว',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'penalty_saver',
    icon: '🧤',
    name: 'จอมเซฟจุดโทษ',
    desc: 'อ่านใจคนยิงเก่งเป็นพิเศษในจังหวะจุดโทษและดวลชี้ขาด',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'reflex_cat',
    icon: '🐱',
    name: 'ปฏิกิริยาแมวป่า',
    desc: 'พุ่งปัดลูกยิงจ่อๆ และบอลแฉลบเปลี่ยนทางได้อย่างเหลือเชื่อ',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'long_throw_counter',
    icon: '🚀',
    name: 'เปิดเกมสวนกลับเร็ว',
    desc: 'เซฟบอลได้มักขว้างหรือเตะยาวสวนกลับให้แนวรุกทันที',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },

  // Universal Tactical Roles & Physical Styles
  {
    id: 'pressing_machine',
    icon: '🐺',
    name: 'จอมเพรสไล่บี้',
    desc: 'วิ่งบีบพื้นที่กดดันคู่แข่งตลอดเวลา ช่วยทีมแย่งบอลแดนบน',
    tone: 'phys',
    pos: ['FW', 'MF', 'DF'],
    roles: ['ST', 'CF', 'CM', 'CDM', 'LW', 'RW']
  },
  {
    id: 'super_sub',
    icon: '💥',
    name: 'ซูเปอร์ซับทีเด็ด',
    desc: 'ลงสนามเป็นตัวสำรองทีไร มักพลิกเกมและยิงประตูสำคัญได้เสมอ',
    tone: 'ment',
    pos: ['FW', 'MF']
  },
  {
    id: 'finesse_shot',
    icon: '🎯',
    name: 'ปั่นโค้งเสียบเสา',
    desc: 'ถนัดวางเท้าปั่นบอลโค้งหนีมือผู้รักษาประตูเข้ามุมสามเหลี่ยม',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CF', 'LW', 'RW', 'CAM']
  },
  {
    id: 'hold_up_play',
    icon: '🪨',
    name: 'พักบอลค้ำแนวรับ',
    desc: 'บังบอลเหนียวแน่น รอเพื่อนเติมขึ้นมาเล่นต่อในแดนหน้าเก่ง',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CF', 'CAM']
  },
  {
    id: 'trivela_cross',
    icon: '🌪️',
    name: 'เปิดบอลไซด์ก้อย',
    desc: 'ครอสบอลด้วยข้างเท้าด้านนอกโค้งเข้าหัวกองหน้าได้อย่างคาดไม่ถึง',
    tone: 'play',
    pos: ['MF', 'DF', 'FW'],
    roles: ['LM', 'RM', 'LW', 'RW', 'LB', 'RB', 'LWB', 'RWB']
  },
  {
    id: 'through_ball_vision',
    icon: '🔭',
    name: 'มองทะลุแนวรับ',
    desc: 'สายตาเฉียบคม หาช่องจ่ายคิลเลอร์พาสฉีกกองหลังได้แม้พื้นที่แคบ',
    tone: 'play',
    pos: ['MF', 'FW'],
    roles: ['CAM', 'CM', 'CDM', 'CF']
  },
  {
    id: 'one_touch_wizard',
    icon: '⚡',
    name: 'เล่นจังหวะเดียวเร็ว',
    desc: 'ออกบอลสัมผัสน้อยจังหวะเดียวแม่นยำ ช่วยเร่งสปีดเกมรุกของทีม',
    tone: 'play',
    pos: ['MF', 'FW'],
    roles: ['CM', 'CAM', 'CF', 'LM', 'RM']
  },
  {
    id: 'late_box_crasher',
    icon: '💨',
    name: 'สอดเข้ากรอบแถวสอง',
    desc: 'เติมจากแดนกลางสอดเข้ากรอบเขตโทษในจังหวะสุดท้ายแล้วยิงได้บ่อย',
    tone: 'att',
    pos: ['MF', 'DF'],
    roles: ['CM', 'CAM', 'LCM', 'RCM', 'LWB', 'RWB']
  },
  {
    id: 'last_ditch_hero',
    icon: '🦸',
    name: 'สกัดเส้นยาแดง',
    desc: 'วิ่งไล่กวดและเข้าสกัดกู้สถานการณ์จังหวะสุดท้ายหน้าปากประตูเก่ง',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'LB', 'RB', 'CDM']
  },
  {
    id: 'aerial_wall',
    icon: '🗼',
    name: 'กำแพงลูกกลางอากาศ',
    desc: 'อ่านจังหวะโหม่งเคลียร์บอลและดวลลูกตั้งเตะในกรอบเขตโทษชนะขาด',
    tone: 'def',
    pos: ['DF'],
    roles: ['CB']
  },
  {
    id: 'command_area',
    icon: '📣',
    name: 'คุมกรอบเขตโทษขาด',
    desc: 'ออกมาตัดลูกครอสและลูกเตะมุมกลางอากาศอย่างมั่นใจ ลดโอกาสเสียประตู',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'one_on_one_wall',
    icon: '🧱',
    name: 'ดวลเดี่ยวไม่หวั่น',
    desc: 'ยืนตำแหน่งปิดมุมยอดเยี่ยมยามกองหน้าคู่แข่งหลุดเดี่ยวมาดวลตัวต่อตัว',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  // Expanded Skills & Traits (45..64)
  {
    id: 'fox_in_box',
    icon: '🦊',
    name: 'จิ้งจอกในกรอบ 6 หลา',
    desc: 'หาจังหวะเก็บบอลกระฉอกและแปจ่อๆ หน้าปากประตูได้เฉียบคมเป็นพิเศษ',
    tone: 'att',
    pos: ['FW'],
    roles: ['ST', 'CF']
  },
  {
    id: 'knuckleball_king',
    icon: '💥',
    name: 'ซัดลูกส่ายไร้ทิศ',
    desc: 'ยิงไกลและฟรีคิกลูกส่ายหักมุมรุนแรง ทำให้ผู้รักษาประตูรับกระฉอกได้บ่อย',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['ST', 'CAM', 'LW', 'RW', 'CM']
  },
  {
    id: 'inverted_winger',
    icon: '🔪',
    name: 'ปีกตัดเข้าในยิง',
    desc: 'ลากเลื้อยจากริมเส้นตัดเข้ากลางแล้วซัดปั่นโค้งเข้าเสาไกลอย่างอันตราย',
    tone: 'att',
    pos: ['FW', 'MF'],
    roles: ['LW', 'RW', 'LM', 'RM']
  },
  {
    id: 'target_man',
    icon: '🏔️',
    name: 'หอกตัวเป้าชนแหลก',
    desc: 'ปะทะค้ำกองหลังสองคนได้สบาย พักบอลและโหม่งชงให้เพื่อนแถวสองสอดยิง',
    tone: 'att',
    pos: ['FW'],
    roles: ['ST', 'CF']
  },
  {
    id: 'shadow_striker',
    icon: '👻',
    name: 'ตัวสอดเงามรณะ',
    desc: 'แอบซ่อนตัวหลังแนวรับแล้วโผล่ทะลุเข้าไปยิงโล่งๆ ในเขตโทษอย่างเงียบเชียบ',
    tone: 'att',
    pos: ['MF', 'FW'],
    roles: ['CAM', 'CF', 'CM', 'LM', 'RM']
  },
  {
    id: 'deep_lying_playmaker',
    icon: '🎼',
    name: 'จอมทัพแนวลึก',
    desc: 'ยืนคุมเกมหน้าแผงหลังแล้ววางบอลแม่นยำข้ามแดนเปิดเกมรุกให้แนวหน้า',
    tone: 'play',
    pos: ['MF', 'DF'],
    roles: ['CDM', 'LDM', 'RDM', 'CM', 'CB']
  },
  {
    id: 'nutmeg_master',
    icon: '🪄',
    name: 'จอมลอดดาก',
    desc: 'คล่องตัวจัดในพื้นที่แคบ ชอบแตะบอลลอดขาหลบตัวประกบและเรียกฟาวล์หน้ากรอบ',
    tone: 'play',
    pos: ['FW', 'MF'],
    roles: ['LW', 'RW', 'CAM', 'CF', 'LM', 'RM']
  },
  {
    id: 'deadball_curler',
    icon: '🌀',
    name: 'ปั่นฟรีคิกมุมแคบ',
    desc: 'ลูกนิ่งระยะหวังผลโค้งข้ามกำแพงเสียบสามเหลี่ยมได้ลุ้นสกอร์ทุกจังหวะ',
    tone: 'play',
    pos: ['MF', 'FW', 'DF'],
    roles: ['CAM', 'CM', 'LW', 'RW', 'CF']
  },
  {
    id: 'giant_thrower',
    icon: '💪',
    name: 'ทุ่มไกลเข้ากรอบ',
    desc: 'สร้างโอกาสกดดันจากลูกทุ่มไกลและลูกเปิดริมเส้นเข้ากรอบเขตโทษ',
    tone: 'play',
    pos: ['DF', 'MF'],
    roles: ['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM']
  },
  {
    id: 'sweeper_cb',
    icon: '🧹',
    name: 'เซนเตอร์เก็บกวาด',
    desc: 'อ่านบอลทะลุช่องขาด วิ่งสปีดซ้อนด้านหลังแนวรับได้อย่างแม่นยำ',
    tone: 'def',
    pos: ['DF'],
    roles: ['CB', 'LB', 'RB']
  },
  {
    id: 'wing_lockdown',
    icon: '🚧',
    name: 'ปิดตายริมเส้น',
    desc: 'ดักทางปีกความเร็วสูงได้ดี ไม่หลงเหลี่ยมจังหวะล็อกหลบฝั่งริมเส้น',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['LB', 'RB', 'LWB', 'RWB', 'CDM']
  },
  {
    id: 'ball_winner_dm',
    icon: '🦈',
    name: 'ตัวตัดเกมกัดขาด',
    desc: 'เข้าชนและชิงบอลคืนกลางสนามอย่างดุดัน ตัดเกมรุกก่อนถึงเขตโทษ',
    tone: 'def',
    pos: ['MF', 'DF'],
    roles: ['CDM', 'LDM', 'RDM', 'CM', 'CB']
  },
  {
    id: 'acrobat_clearance',
    icon: '🤸',
    name: 'กายกรรมสกัดหน้าเส้น',
    desc: 'พุ่งบล็อกและเตะสกัดบอลพ้นอันตรายในจังหวะชุลมุนหน้าประตูเก่ง',
    tone: 'def',
    pos: ['DF', 'MF'],
    roles: ['CB', 'CDM', 'LB', 'RB']
  },
  {
    id: 'cross_claimer',
    icon: '✋',
    name: 'รวบลูกกลางอากาศหนึบ',
    desc: 'ออกมารับลูกเปิดและลูกเตะมุมติดมือ ลดโอกาสโดนโหม่งซ้ำ',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'distribution_master',
    icon: '🎯',
    name: 'โกล์เปิดบอลแม่นเท้า',
    desc: 'เตะเปิดเกมยาวแม่นยำเหมือนเพลย์เมกเกอร์ วางบอลให้กองหน้าสวนกลับทันที',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'penalty_box_boss',
    icon: '🦁',
    name: 'สั่งการแนวรับเด็ดขาด',
    desc: 'จัดระเบียบกองหลังลดช่องโหว่และเพิ่มความนิ่งให้เกมรับทั้งแผง',
    tone: 'gk',
    pos: ['GK'],
    roles: ['GK']
  },
  {
    id: 'box_to_box_engine',
    icon: '⚙️',
    name: 'มิดฟิลด์ขึ้นสุดลงสุด',
    desc: 'เติมช่วยเกมรับหน้าเขตโทษและสอดยิงในกรอบได้อย่างสมดุลตลอด 90 นาที',
    tone: 'phys',
    pos: ['MF', 'DF'],
    roles: ['CM', 'LCM', 'RCM', 'LWB', 'RWB']
  },
  {
    id: 'speed_demon',
    icon: '⚡',
    name: 'จรวดทางเรียบ',
    desc: 'ออกตัวสปีดต้นจัดและเร่งความเร็วฉีกตัวประกบในจังหวะสวนกลับขาดลอย',
    tone: 'phys',
    pos: ['FW', 'MF', 'DF'],
    roles: ['LW', 'RW', 'ST', 'LB', 'RB', 'LWB', 'RWB']
  }
];

export interface PlayerPersonalityDef {
  id: number;
  icon: string;
  name: string;
  label: string;
  desc: string;
  tone: 'pos' | 'warn' | 'gold' | 'neutral';
}

export const PLAYER_PERSONALITIES: PlayerPersonalityDef[] = [
  { id: 0, icon: '👑', name: 'ผู้นำ', label: '👑 ผู้นำ', desc: 'ช่วยเพิ่มโบนัสเล็กน้อยให้ทีมเมื่อลงตัวจริงและช่วยคุมขวัญเพื่อนร่วมทีม', tone: 'pos' },
  { id: 1, icon: '😤', name: 'สายเกเร', label: '😤 สายเกเร', desc: 'เล่นดุดันทุ่มเท แต่มีโอกาสโดนใบเหลือง/ใบแดงบ่อยกว่าปกติ', tone: 'warn' },
  { id: 2, icon: '🏃', name: 'ขยัน', label: '🏃 ขยัน', desc: 'ฟิตลดช้าลงระหว่างแข่งและพัฒนาค่าพลังจากการฝึกซ้อมไวขึ้นเล็กน้อย', tone: 'pos' },
  { id: 3, icon: '😐', name: 'ปกติ', label: '😐 ปกติ', desc: 'บุคลิกสมดุล เล่นตามมาตรฐานปกติ ไม่มีผลบวกหรือลบพิเศษ', tone: 'neutral' },
  { id: 4, icon: '🔥', name: 'นัดใหญ่ยิ่งเก่ง', label: '🔥 นัดใหญ่ยิ่งเก่ง', desc: 'ยิ่งเกมสำคัญ ดาร์บี้แมตช์ หรือบอลถ้วย ยิ่งนิ่งและเล่นดีขึ้นชัดเจน', tone: 'pos' },
  { id: 5, icon: '🎭', name: 'ศิลปินลูกหนัง', label: '🎭 ศิลปินลูกหนัง', desc: 'สร้างจังหวะหวือหวาเหนือคาดได้ดี ฟอร์มพุ่งสูงได้แต่บางวันอาจหลุดสมาธิ', tone: 'gold' },
  { id: 6, icon: '🧘', name: 'ใจเย็นสุขุม', label: '🧘 ใจเย็นสุขุม', desc: 'คุมสติในสนามดี เสียฟาวล์และโดนใบเหลืองยาก ฟื้นสภาพร่างกายสม่ำเสมอ', tone: 'pos' },
  { id: 7, icon: '⚡', name: 'ใจร้อนมุทะลุ', label: '⚡ ใจร้อนมุทะลุ', desc: 'เข้าบอลไวและกล้าเสี่ยงทุกจังหวะ แต่เสียฟิตเร็วกว่าปกติและเสี่ยงใบเตือน', tone: 'warn' },
  { id: 8, icon: '🤝', name: 'เข้ากับทีมง่าย', label: '🤝 เข้ากับทีมง่าย', desc: 'นิสัยเป็นกันเอง เข้ากับเพื่อนร่วมทีมและระบบโค้ชได้ดี ช่วยเสริมสปิริตในทีม', tone: 'pos' },
  { id: 9, icon: '🦁', name: 'ใจสู้ไม่ถอย', label: '🦁 ใจสู้ไม่ถอย', desc: 'ไม่ยอมแพ้ง่าย ยิ่งท้ายเกมหรือตามหลังยิ่งกัดฟันสู้และยืนระยะได้ดี', tone: 'gold' },
  { id: 10, icon: '🎓', name: 'นักเรียนแท็กติก', label: '🎓 นักเรียนแท็กติก', desc: 'เข้าใจระบบโค้ชเร็ว ปรับตัวเวลาเล่นตำแหน่งใหม่ได้ไวและพัฒนาพลังสม่ำเสมอ', tone: 'pos' },
  { id: 11, icon: '😎', name: 'มั่นใจสูง', label: '😎 มั่นใจสูง', desc: 'เชื่อมั่นในตัวเองสูง ไม่ประหม่าง่าย และโชว์ฟอร์มเด่นเมื่อทีมกำลังคึกคัก', tone: 'neutral' },
  { id: 12, icon: '🎯', name: 'มุ่งมั่นสมบูรณ์แบบ', label: '🎯 มุ่งมั่นสมบูรณ์แบบ', desc: 'ตั้งใจซ้อมหนัก รักษามาตรฐานสูง และพัฒนาค่าพลังจากการฝึกต่อเนื่อง', tone: 'pos' },
  { id: 13, icon: '🐺', name: 'รักสันโดษมุ่งมั่นเงียบ', label: '🐺 รักสันโดษมุ่งมั่นเงียบ', desc: 'พูดน้อยเก็บตัว โฟกัสกับเป้าหมายส่วนตัวและการฝึกซ้อมในแบบของตัวเอง', tone: 'neutral' },
  { id: 14, icon: '🛡️', name: 'ถ่อมตัวเสียสละเพื่อทีม', label: '🛡️ ถ่อมตัวเสียสละเพื่อทีม', desc: 'ไม่เกี่ยงบทบาท ยอมทำหน้าที่ปิดทองหลังพระและซัพพอร์ตเพื่อนร่วมทีมเสมอ', tone: 'pos' },
  { id: 15, icon: '🌪️', name: 'จอมปั่นประสาท', label: '🌪️ จอมปั่นประสาท', desc: 'ยั่วอารมณ์คู่แข่งเก่ง แต่ตัวเองก็เสี่ยงหลุดอารมณ์โดนใบเหลือง/แดงง่ายกว่าปกติ', tone: 'warn' },
  { id: 16, icon: '🌟', name: 'ขวัญใจแฟนบอล', label: '🌟 ขวัญใจแฟนบอล', desc: 'ลงเล่นทีไรแฟนบอลคึกคัก เล่นในบ้านและแมตช์สำคัญฟอร์มพุ่งแรง', tone: 'gold' },
  { id: 17, icon: '🧊', name: 'เลือดเย็นไร้ความกดดัน', label: '🧊 เลือดเย็นไร้ความกดดัน', desc: 'นิ่งสุดๆ ในจังหวะจุดโทษ ท้ายเกม และสถานการณ์ชี้เป็นชี้ตาย', tone: 'pos' },
  { id: 18, icon: '🔋', name: 'เครื่องจักรไม่รู้จักเหนื่อย', label: '🔋 เครื่องจักรไม่รู้จักเหนื่อย', desc: 'ความอึดสูงกว่ามาตรฐาน เสียความฟิตระหว่างแข่งช้าและฟื้นตัวได้ไว', tone: 'pos' },
  { id: 19, icon: '🤕', name: 'เปราะบางขี้กังวล', label: '🤕 เปราะบางขี้กังวล', desc: 'ฟิตตกไวเมื่อเจอเกมหนัก บาดเจ็บง่ายกว่าปกติ และฟอร์มแกว่งตอนทีมตามหลัง', tone: 'warn' },
  { id: 20, icon: '💡', name: 'หัวไวช่างสังเกต', label: '💡 หัวไวช่างสังเกต', desc: 'จับทางสถานการณ์ในเกมและอ่านจังหวะคู่แข่งได้ไว ทำให้ตัดสินใจได้นิ่งขึ้น', tone: 'gold' },
  { id: 21, icon: '📢', name: 'หัวหน้าห้องแต่งตัว', label: '📢 หัวหน้าห้องแต่งตัว', desc: 'ช่วยคุมบรรยากาศในทีม ลดโอกาสเสียสมาธิและเสริมพลังใจเพื่อนร่วมทีม', tone: 'pos' },
  { id: 22, icon: '🎲', name: 'สายเสี่ยงดวงคาดเดายาก', label: '🎲 สายเสี่ยงดวงคาดเดายาก', desc: 'อารมณ์ขึ้นลงคาดเดายาก บางวันฟอร์มเฉิดฉายระดับโลกแต่บางวันอาจหลุดฟอร์ม', tone: 'warn' },
  { id: 23, icon: '🏅', name: 'มืออาชีพไร้ที่ติ', label: '🏅 มืออาชีพไร้ที่ติ', desc: 'รักษาวินัยและสภาพร่างกายเยี่ยม บาดเจ็บยาก ฟื้นตัวไว และเล่นสม่ำเสมอทุกนัด', tone: 'pos' },
  { id: 24, icon: '🌾', name: 'บ้านนอก', label: '🌾 บ้านนอก', desc: 'ติดดินไม่เรื่องมาก ขอค่าเหนื่อยและค่าเซ็นต่ำกว่าปกติ 25% ไม่งอแงเวลานั่งสำรอง แกร่งในเกมเยือนและไม่เสียสภาพกายจากแดดร้อน/ฝนตก', tone: 'pos' },
  { id: 25, icon: '🤡', name: 'ตัวโจ้ก', label: '🤡 ตัวโจ้ก', desc: 'สายฮาคลายดราม่า ล้างความน้อยใจและช่วยประคองขวัญทีมยามพ่ายแพ้ ในสนามปั่นคู่แข่งให้หลุดฟาวล์โดนใบเหลืองง่ายขึ้น', tone: 'gold' },
  { id: 26, icon: '😈', name: 'ปีศาจ', label: '😈 ปีศาจ', desc: 'ออร่าข่มขวัญลดพลังทีมคู่แข่งที่ลงเจอ ยิงคมและโอกาสสับไกสูงมาก แลกกับเสียฟิตไวกว่าปกติและเสี่ยงโดนใบเตือน', tone: 'gold' }
];

export const TRAIT_BY_ID: Record<string, FootballTraitDef> = Object.fromEntries(
  FOOTBALL_TRAITS.map((t) => [t.id, t])
);


export const ROLE_BASE_ATTRS = (pos: Position, sp: SubRole): CoreAttrs => {
  const map: Partial<Record<SubRole, CoreAttrs>> = {
    ST: { sh: 63, ps: 37, dr: 45, tk: 27, ph: 49 },
    LS: { sh: 63, ps: 37, dr: 45, tk: 27, ph: 49 },
    RS: { sh: 63, ps: 37, dr: 45, tk: 27, ph: 49 },
    CF: { sh: 58, ps: 50, dr: 49, tk: 29, ph: 46 },
    LW: { sh: 52, ps: 48, dr: 60, tk: 30, ph: 44 },
    RW: { sh: 52, ps: 48, dr: 60, tk: 30, ph: 44 },
    CAM: { sh: 48, ps: 58, dr: 54, tk: 34, ph: 42 },
    LM: { sh: 44, ps: 54, dr: 56, tk: 38, ph: 46 },
    RM: { sh: 44, ps: 54, dr: 56, tk: 38, ph: 46 },
    CM: { sh: 42, ps: 58, dr: 48, tk: 46, ph: 46 },
    LCM: { sh: 42, ps: 58, dr: 48, tk: 46, ph: 46 },
    RCM: { sh: 42, ps: 58, dr: 48, tk: 46, ph: 46 },
    CDM: { sh: 36, ps: 52, dr: 42, tk: 58, ph: 52 },
    LDM: { sh: 36, ps: 52, dr: 42, tk: 58, ph: 52 },
    RDM: { sh: 36, ps: 52, dr: 42, tk: 58, ph: 52 },
    LWB: { sh: 36, ps: 48, dr: 50, tk: 52, ph: 50 },
    RWB: { sh: 36, ps: 48, dr: 50, tk: 52, ph: 50 },
    LB: { sh: 32, ps: 46, dr: 46, tk: 56, ph: 50 },
    RB: { sh: 32, ps: 46, dr: 46, tk: 56, ph: 50 },
    CB: { sh: 28, ps: 40, dr: 34, tk: 60, ph: 58 },
    LCB: { sh: 28, ps: 40, dr: 34, tk: 60, ph: 58 },
    RCB: { sh: 28, ps: 40, dr: 34, tk: 60, ph: 58 },
    GK: { sh: 22, ps: 44, dr: 28, tk: 56, ph: 62 }
  };
  const fallback: Record<Position, CoreAttrs> = {
    FW: { sh: 60, ps: 42, dr: 50, tk: 28, ph: 46 },
    MF: { sh: 44, ps: 58, dr: 50, tk: 46, ph: 44 },
    DF: { sh: 30, ps: 44, dr: 40, tk: 58, ph: 54 },
    GK: { sh: 22, ps: 44, dr: 28, tk: 56, ph: 62 }
  };
  return { ...(map[sp] || fallback[pos]) };
};

export const PLAYER_ARCHETYPES: PlayerArchetype[] = [
  {
    id: 'poacher',
    pos: ['FW'],
    icon: '🎯',
    name: 'เพชฌฆาตหน้ากรอบ',
    desc: 'คมกริบทุกจังหวะสุดท้าย จบสกอร์เด็ดขาดและนิ่งในเกมใหญ่',
    tr: 'sh',
    sig: 'fin',
    coreBonus: { sh: 3, dr: 1 },
    sbBonus: { pw: 4, run: 5, comp: 4 },
    autoCorePts: { sh: 6, dr: 3, ph: 2, ps: 1 },
    autoSubPts: { fin: 4, run: 2, comp: 2 }
  },
  {
    id: 'winger',
    pos: ['FW', 'MF'],
    icon: '⚡',
    name: 'ปีกจรวดกระชาก',
    desc: 'สปีดจัดจ้าน ลากเลื้อยฉีกแนวรับและเปิดบอลแม่นยำ',
    tr: 'dr',
    sig: 'spd',
    coreBonus: { dr: 3, ps: 1 },
    sbBonus: { crs: 5, run: 4, sta: 4 },
    autoCorePts: { dr: 6, ps: 3, sh: 2, ph: 1 },
    autoSubPts: { spd: 4, crs: 2, run: 2 }
  },
  {
    id: 'cannon',
    pos: ['FW', 'MF'],
    icon: '💣',
    name: 'จอมซัดไกล & ลูกนิ่ง',
    desc: 'เท้าหนัก ยิงโค้งเสียบมุมอันตรายทั้งโอเพ่นเพลย์และฟรีคิก',
    tr: 'sh',
    sig: 'pw',
    coreBonus: { sh: 2, ph: 2 },
    sbBonus: { cur: 6, fin: 4, comp: 3 },
    autoCorePts: { sh: 6, ps: 3, ph: 2, dr: 1 },
    autoSubPts: { pw: 3, cur: 3, fin: 2 }
  },
  {
    id: 'target',
    pos: ['FW', 'DF'],
    icon: '🗼',
    name: 'เจ้าเวหาตัวชน',
    desc: 'แข็งแกร่งกลางอากาศ เบียดปะทะชนะขาดและโหม่งอันตราย',
    tr: 'ph',
    sig: 'hd',
    coreBonus: { ph: 3, sh: 1 },
    sbBonus: { str: 6, tol: 4, run: 3 },
    autoCorePts: { ph: 5, sh: 4, tk: 2, dr: 1 },
    autoSubPts: { hd: 4, str: 3, comp: 1 }
  },
  {
    id: 'maestro',
    pos: ['MF'],
    icon: '🧭',
    name: 'จอมทัพคิลเลอร์พาส',
    desc: 'คุมจังหวะเกม วางบอลทะลุช่องและอ่านเกมเฉียบคม',
    tr: 'ps',
    sig: 'crs',
    coreBonus: { ps: 3, dr: 1 },
    sbBonus: { spass: 5, lpass: 4, rd: 4, comp: 3 },
    autoCorePts: { ps: 6, dr: 3, sh: 2, tk: 1 },
    autoSubPts: { spass: 3, lpass: 2, crs: 2, rd: 1 }
  },
  {
    id: 'b2b',
    pos: ['MF'],
    icon: '🔋',
    name: 'ห้องเครื่องปอดเหล็ก',
    desc: 'วิ่งไม่มีหมด ขึ้นสุดลงสุดช่วยทั้งเกมรุกและเกมรับทั้ง 90 นาที',
    tr: 'ph',
    sig: 'sta',
    coreBonus: { ph: 2, tk: 1, ps: 1 },
    sbBonus: { rec: 6, spass: 4, run: 3, rd: 3 },
    autoCorePts: { ph: 4, ps: 4, tk: 3, dr: 1 },
    autoSubPts: { sta: 4, rec: 2, spass: 2 }
  },
  {
    id: 'destroyer',
    pos: ['MF', 'DF'],
    icon: '🛡️',
    name: 'ตัวรับตัดเกมดุดัน',
    desc: 'อ่านทางบอลขาด เข้าสกัดแม่นยำ ประกบติดและปิดพื้นที่เก่ง',
    tr: 'tk',
    sig: 'tkl',
    coreBonus: { tk: 3, ph: 1 },
    sbBonus: { rd: 5, mrk: 4, str: 4 },
    autoCorePts: { tk: 6, ph: 3, ps: 2, dr: 1 },
    autoSubPts: { tkl: 3, rd: 3, mrk: 2 }
  },
  {
    id: 'stopper',
    pos: ['DF'],
    icon: '🧱',
    name: 'เซนเตอร์กำแพงเหล็ก',
    desc: 'ปักหลักเหนียวแน่น ประกบตัวติดหนึบ บล็อกลูกยิงและปะทะแข็งแกร่ง',
    tr: 'tk',
    sig: 'pos',
    coreBonus: { tk: 3, ph: 2 },
    sbBonus: { mrk: 5, blk: 5, hd: 4 },
    autoCorePts: { tk: 6, ph: 4, ps: 2 },
    autoSubPts: { pos: 3, mrk: 3, blk: 2 }
  },
  {
    id: 'sweeper_df',
    pos: ['DF'],
    icon: '🧠',
    name: 'กองหลังออกบอลสวย',
    desc: 'ดักบอลนุ่มนวล บล็อกจังหวะสำคัญ นิ่งและเปิดเกมจากแนวหลัง',
    tr: 'ps',
    sig: 'rd',
    coreBonus: { ps: 2, tk: 2 },
    sbBonus: { lpass: 5, spass: 4, blk: 4, comp: 3 },
    autoCorePts: { tk: 5, ps: 4, ph: 2, dr: 1 },
    autoSubPts: { rd: 3, lpass: 3, blk: 2 }
  },
  {
    id: 'shotstopper',
    pos: ['GK'],
    icon: '🧤',
    name: 'ปฏิกิริยาไวซูเปอร์เซฟ',
    desc: 'บินปัดลูกยากได้บ่อย นิ่งในจังหวะดวลเดี่ยวและฟื้นตัวไว',
    tr: 'ph',
    sig: 'sv',
    coreBonus: { ph: 3, tk: 1 },
    sbBonus: { comp: 6, rec: 4, cl: 3 },
    autoCorePts: { ph: 6, tk: 4, ps: 2 },
    autoSubPts: { sv: 4, comp: 2, cl: 2 }
  },
  {
    id: 'sweeper_gk',
    pos: ['GK'],
    icon: '🦅',
    name: 'สวีปเปอร์คีปเปอร์ปิดมุม',
    desc: 'ออกมาตัดบอลและปิดมุมยิงเร็ว คล่องแคล่ว ทนต่อการปะทะ',
    tr: 'tk',
    sig: 'cl',
    coreBonus: { tk: 3, ph: 1 },
    sbBonus: { spd: 5, tol: 5, sv: 4 },
    autoCorePts: { tk: 6, ph: 4, ps: 2 },
    autoSubPts: { cl: 4, sv: 2, tol: 2 }
  },
  {
    id: 'ballplay_gk',
    pos: ['GK'],
    icon: '🎯',
    name: 'เปิดบอลแม่นสั่งเกมรับ',
    desc: 'วางบอลสวนกลับจากแนวหลังแม่นยำ คุมแผงหลังนิ่งและอึด',
    tr: 'ps',
    sig: 'dist',
    coreBonus: { ps: 3, tk: 1 },
    sbBonus: { comp: 5, sta: 5, sv: 3 },
    autoCorePts: { ps: 5, ph: 4, tk: 3 },
    autoSubPts: { dist: 4, comp: 2, sv: 2 }
  }
];

export const ROLE_L: Record<string, string> = { key: 'ตัวหลัก', rot: 'หมุนเวียน', pro: 'ดาวรุ่ง/สำรอง' };
export const AR_C: Record<string, string> = { tr: 'ตามอยู่', dr: 'เสมอ', ld: 'นำอยู่', rc: 'เหลือ 10 คน' };
export const AR_T: Record<Mentality, string> = { X: 'บุกหนัก', A: 'บุก', B: 'สมดุล', D: 'รับ', Z: 'ปิดเกม' };

export const PRE: [string, { form: string; tac: Mentality; press: number; tempo: number; wid: number; line: number; pass: number }][] = [
  ['ติกิตาก้า', { form: '4-3-3', tac: 'A', press: 2, tempo: 1, wid: 1, line: 2, pass: 0 }],
  ['เพรสซิ่งสูง', { form: '4-2-3-1', tac: 'A', press: 2, tempo: 2, wid: 1, line: 2, pass: 1 }],
  ['เกมสวน', { form: '5-3-2', tac: 'D', press: 0, tempo: 2, wid: 1, line: 0, pass: 3 }],
  ['ปิดเกมรับ', { form: '5-4-1', tac: 'Z', press: 0, tempo: 0, wid: 0, line: 0, pass: 2 }],
  ['บอลยาวปีก', { form: '3-4-3', tac: 'B', press: 1, tempo: 2, wid: 2, line: 1, pass: 2 }]
];

export interface ClubPhilosophyDef {
  id: string;
  name: string;
  form: string;
  tac: Mentality;
  press: number;
  tempo: number;
  wid: number;
  line: number;
  pass: number;
  styleGroup: 'attack' | 'control' | 'balanced' | 'counter';
}

export const CLUB_PHILOSOPHIES: ClubPhilosophyDef[] = [
  { id: 'tikitaka', name: 'ติกิตาก้า ครองบอลบุก', form: '4-3-3 (F9)', tac: 'A', press: 2, tempo: 1, wid: 1, line: 2, pass: 0, styleGroup: 'control' },
  { id: 'gegenpress', name: 'เกเก้นเพรสซิ่ง ดุดัน', form: '4-2-3-1', tac: 'A', press: 2, tempo: 2, wid: 1, line: 2, pass: 1, styleGroup: 'attack' },
  { id: 'wing_blitz', name: 'เปิดเกมรุกริมเส้น', form: '4-3-3', tac: 'A', press: 1, tempo: 2, wid: 2, line: 2, pass: 2, styleGroup: 'attack' },
  { id: 'total_343', name: 'โททัลฟุตบอลบุกแหลก', form: '3-4-3', tac: 'X', press: 2, tempo: 2, wid: 2, line: 2, pass: 1, styleGroup: 'attack' },
  { id: 'diamond_mid', name: 'ไดมอนด์คุมแดนกลาง', form: '4-1-2-1-2', tac: 'B', press: 1, tempo: 1, wid: 0, line: 1, pass: 0, styleGroup: 'control' },
  { id: 'wingback_352', name: 'วิงแบ็กเติมเกมคู่หน้า', form: '3-5-2', tac: 'B', press: 1, tempo: 1, wid: 2, line: 1, pass: 1, styleGroup: 'balanced' },
  { id: 'classic_442', name: 'สมดุลคู่หน้าคลาสสิก', form: '4-4-2', tac: 'B', press: 1, tempo: 1, wid: 1, line: 1, pass: 1, styleGroup: 'balanced' },
  { id: 'linkup_4411', name: 'เพรสซิ่งจังหวะสอง', form: '4-4-1-1', tac: 'B', press: 1, tempo: 0, wid: 1, line: 1, pass: 0, styleGroup: 'balanced' },
  { id: 'counter_532', name: 'รับแน่นสวนกลับเร็ว', form: '5-3-2', tac: 'D', press: 0, tempo: 2, wid: 1, line: 0, pass: 3, styleGroup: 'counter' },
  { id: 'fortress_541', name: 'ป้อมปราการเกมรับ', form: '5-4-1', tac: 'Z', press: 0, tempo: 0, wid: 0, line: 0, pass: 2, styleGroup: 'counter' },
  { id: 'direct_4231', name: 'บอลไดเรกต์จู่โจมไว', form: '4-2-3-1', tac: 'B', press: 1, tempo: 2, wid: 2, line: 1, pass: 3, styleGroup: 'attack' },
  { id: 'counter_442', name: '4-4-2 รัดกุมรอสวน', form: '4-4-2', tac: 'D', press: 0, tempo: 2, wid: 1, line: 0, pass: 3, styleGroup: 'counter' }
];

export const PACT = [
  { i: '💪', n: 'ซ้อมหนัก', d: 'พัฒนาค่าพลังหลักไวสุด แต่ฟื้นความฟิตน้อย', en: 5, gr: 0.17 },
  { i: '🏃', n: 'ซ้อมเบา', d: 'พัฒนาค่าพลังได้สม่ำเสมอ · ความฟิตฟื้นตัวดี', en: 18, gr: 0.085 },
  { i: '😴', n: 'พักผ่อน', d: 'ฟื้นความฟิตได้มากที่สุด · พร้อมลงสนามเต็มร้อย', en: 36, gr: 0 },
  { i: '📺', n: 'ดูวิดีโอวิเคราะห์เกม', d: 'นัดหน้าเล่นดีขึ้น (เรตติ้ง +0.3) · โอกาสพัฒนาไหวพริบ', en: 12, gr: 0, vid: 0.3, pt: 0.13 },
  { i: '🏋️', n: 'ยิม / วิ่งนอกสนาม', d: 'เน้นเพิ่มค่าความแข็งแกร่งร่างกาย · เหนื่อยพอสมควร', en: 10, gr: 0.15, k: 'ph' as StatKey },
  { i: '🤝', n: 'พบปะแฟนบอล', d: 'ขวัญแฟนบอลเพิ่ม ช่วยให้เล่นดีขึ้น · โอกาสพัฒนาความนิ่ง', en: 14, gr: 0, fan: 6, pt: 0.14 }
];

export const CAREER_PERKS: { id: string; name: string; desc: string; cost: number }[] = [
  { id: 'clutch', name: '🔥 นิ่งในเกมใหญ่', desc: 'นัดดาร์บี้/บอลถ้วย มีโอกาสยิงและเรตติ้งสูงขึ้น', cost: 25 },
  { id: 'engine', name: '🔋 ปอดเหล็ก', desc: 'เสียความฟิตต่อแมตช์น้อยลง 25%', cost: 30 },
  { id: 'prodigy', name: '🌟 พรสวรรค์พุ่งทะยาน', desc: 'โอกาสค่าพลังขึ้นจากการซ้อมและภารกิจ +10%', cost: 35 },
  { id: 'captain', name: '👑 ขวัญใจมหาชน', desc: 'ขวัญแฟนบอลเพิ่มเร็วขึ้นและช่วยดึงเรตติ้งทีม', cost: 20 },
  { id: 'quick_healer', name: '✚ ฟื้นตัวเหนือมนุษย์', desc: 'ซ้อมแล้วฟื้นความฟิตเพิ่ม +6% และหายจากอาการบาดเจ็บไวขึ้น', cost: 24 },
  { id: 'fame_magnet', name: '⭐ ซูเปอร์สตาร์กระแสแรง', desc: 'ได้รับค่าชื่อเสียง ★ หลังจบแมตช์เพิ่มขึ้น +2 ต่อเกม', cost: 22 },
  { id: 'sharp_shooter', name: '🎯 จมูกไวล่าตาข่าย', desc: 'เรตติ้งพุ่งเพิ่มเมื่อยิงประตูหรือ 👟 ได้ในแมตช์', cost: 32 },
  { id: 'adaptable', name: '🧩 สารพัดประโยชน์', desc: 'ปรับตัวเล่นตำแหน่งใหม่ได้ไวขึ้น 2 เท่าและลดผลกระทบเวลาหลุดตำแหน่ง', cost: 26 },
  { id: 'discipline_pro', name: '🧘 วินัยลูกหนัง', desc: 'ลดโอกาสโดนหักเรตติ้งจากใบเหลืองและช่วยคุมอารมณ์ในเกมเดือด', cost: 20 },
  { id: 'media_darling', name: '📸 ขวัญใจสื่อ', desc: 'ได้โบนัสเรตติ้งพื้นฐาน +0.25 ทุกนัดที่ลงสนามอย่างสม่ำเสมอ', cost: 28 },
  { id: 'tactical_mind', name: '🧠 สมองเพชรอ่านเกม', desc: 'อ่านจังหวะเกมขาด ช่วยยกระดับเรตติ้งในเกมที่ทีมชนะหรือเสมอ', cost: 28 },
  { id: 'iron_will', name: '🦁 จิตใจแกร่งเกินร้อย', desc: 'แม้ความฟิตต่ำกว่า 65% ก็ยังรักษามาตรฐานเรตติ้งได้ดีกว่าปกติ', cost: 24 },
  { id: 'playmaker_eye', name: '🪄 วิชั่นจ่ายบอลเฉียบ', desc: 'จ่ายบอลสร้างโอกาสเก่ง ได้โบนัสเรตติ้งพิเศษเมื่อมี 👟', cost: 30 },
  { id: 'wall_defender', name: '🛡️ กำแพงเหล็กแดนหลัง', desc: 'ได้โบนัสเรตติ้งเพิ่มเมื่อช่วยทีมเก็บคลีนชีตหรือเสียไม่เกิน 1 ประตู', cost: 26 }
];


export const TEAM_TRAINING_PROGRAMS: Record<TrainingProgramId, TrainingProgramMeta> = {
  balanced: {
    id: 'balanced',
    icon: '⚖️',
    name: 'ซ้อมสมดุลทุกสาย',
    short: 'สมดุล',
    tf: 'MF',
    positions: ['FW', 'MF', 'DF', 'GK'],
    fitMod: 0,
    devMult: 1.0,
    tacFamBonus: 1,
    morBonus: 0,
    injMult: 1.0,
    desc: 'ฝึกครบทั้งเทคนิค แท็กติก และรักษาสภาพร่างกายอย่างสมดุล',
    effectTag: 'พัฒนาทุกตำแหน่ง · เข้าใจแผน +1%'
  },
  attack: {
    id: 'attack',
    icon: '⚽',
    name: 'จบสกอร์ & เกมรุก',
    short: 'เกมรุก',
    tf: 'FW',
    positions: ['FW', 'MF'],
    fitMod: -1,
    devMult: 1.2,
    tacFamBonus: 1,
    morBonus: 0,
    injMult: 1.06,
    desc: 'ติวเข้มการยิงประตู เข้าทำ และประสานงานแนวรุก (FW/MF)',
    effectTag: 'เน้น FW/MF 1.2x · ฟิต -1%'
  },
  defense: {
    id: 'defense',
    icon: '🛡️',
    name: 'เกมรับ & ยืนโซน',
    short: 'เกมรับ',
    tf: 'DF',
    positions: ['DF', 'GK'],
    fitMod: -1,
    devMult: 1.2,
    tacFamBonus: 2,
    morBonus: 0,
    injMult: 1.05,
    desc: 'ซ้อมวินัยเกมรับ การประกบตัว และจังหวะเซฟประตู (DF/GK)',
    effectTag: 'เน้น DF/GK 1.2x · เข้าใจแผน +2%'
  },
  tactics: {
    id: 'tactics',
    icon: '🧭',
    name: 'แท็กติก & ความเข้าใจแผน',
    short: 'แท็กติก',
    tf: 'MF',
    positions: ['MF', 'DF', 'FW'],
    fitMod: 1,
    devMult: 0.9,
    tacFamBonus: 4,
    morBonus: 1,
    injMult: 0.88,
    desc: 'ซ้อมระบบทีม การเพรสซิ่ง และการเปลี่ยนจังหวะเล่นตามแผน',
    effectTag: 'เข้าใจแผน +4%/นัด · ขวัญ +1%'
  },
  setpiece: {
    id: 'setpiece',
    icon: '🎯',
    name: 'ลูกตั้งเตะ & ลูกโหม่ง',
    short: 'ตั้งเตะ',
    tf: 'FW',
    positions: ['FW', 'DF'],
    fitMod: 0,
    devMult: 1.08,
    tacFamBonus: 2,
    morBonus: 1,
    injMult: 0.95,
    desc: 'ฝึกเตะมุม ฟรีคิก การเปิดบอล และลูกโหม่งทั้งรุก-รับ',
    effectTag: 'เน้น FW/DF · เข้าใจแผน +2% · ขวัญ +1%'
  },
  fitness: {
    id: 'fitness',
    icon: '🏃',
    name: 'ฟิตเนส & ปั้นดาวรุ่ง',
    short: 'ฟิตเนส',
    tf: 'MF',
    positions: 'YOUNG',
    fitMod: -2,
    devMult: 1.25,
    tacFamBonus: 0,
    morBonus: 0,
    injMult: 1.12,
    desc: 'รีดความอึดและเร่งพัฒนาการนักเตะอายุไม่เกิน 25 ปีเป็นพิเศษ',
    effectTag: 'ดาวรุ่ง <25 ปี 1.25x · ฟิต -2%'
  },
  recovery: {
    id: 'recovery',
    icon: '😴',
    name: 'พักผ่อน & ฟื้นฟูร่างกาย',
    short: 'พักฟื้น',
    tf: 'F',
    positions: [],
    fitMod: 10,
    devMult: 0,
    tacFamBonus: 0,
    morBonus: 2,
    injMult: 0.45,
    desc: 'ลดโปรแกรมหนัก เน้นนวดคลายกล้ามเนื้อ ฟื้นฟิตทั้งทีมและลดเสี่ยงเจ็บ',
    effectTag: 'ฟิต +10% · ลดโอกาสเจ็บ 55% · ขวัญ +2%'
  }
};

export const TRAINING_INTENSITY_META: Record<TrainingIntensity, { label: string; icon: string; fitDelta: number; devMult: number; injMult: number; tacAdd: number; desc: string }> = {
  light: {
    label: 'ซ้อมเบา / ถนอมตัว',
    icon: '🟢',
    fitDelta: 4,
    devMult: 0.75,
    injMult: 0.65,
    tacAdd: 0,
    desc: 'ฟิตฟื้นดี +4% · ลดโอกาสเจ็บ 35% · พัฒนา 0.75x'
  },
  normal: {
    label: 'มาตรฐานสมดุล',
    icon: '🟡',
    fitDelta: 0,
    devMult: 1.0,
    injMult: 1.0,
    tacAdd: 0,
    desc: 'ฟิตปกติ · ความเสี่ยงปกติ · พัฒนา 1.0x'
  },
  heavy: {
    label: 'เข้มข้น / ติวหนัก',
    icon: '🔴',
    fitDelta: -5,
    devMult: 1.45,
    injMult: 1.38,
    tacAdd: 1,
    desc: 'พัฒนา 1.45x · เข้าใจแผน +1% · ฟิต -5% (เสี่ยงล้า/เจ็บสูง)'
  }
};

export function getTeamTrainingPlan(s: GameState): TeamTrainingPlan {
  const existing = s.trainingPlan;
  const fallbackProgram: TrainingProgramId =
    s.tf === 'F' ? 'recovery' : s.tf === 'FW' ? 'attack' : s.tf === 'DF' ? 'defense' : 'balanced';
  if (!existing) {
    return { program: fallbackProgram, intensity: 'normal', restStarters: false, individualFocus: {} };
  }
  const prog = TEAM_TRAINING_PROGRAMS[existing.program] ? existing.program : fallbackProgram;
  return {
    ...existing,
    program: prog,
    intensity: TRAINING_INTENSITY_META[existing.intensity] ? existing.intensity : 'normal',
    individualFocus: existing.individualFocus || {}
  };
}

export function syncTrainingFocusToPlan(d: GameState, tf: TrainingFocus) {
  d.tf = tf;
  const cur = getTeamTrainingPlan(d);
  const nextProg: TrainingProgramId =
    tf === 'F' ? 'recovery' : tf === 'FW' ? 'attack' : tf === 'DF' ? 'defense' : cur.program === 'recovery' || cur.program === 'attack' || cur.program === 'defense' ? 'tactics' : cur.program;
  d.trainingPlan = { ...cur, program: nextProg };
}

export const COACH_STYLES: Array<{
  id: CoachStyleId;
  icon: string;
  name: string;
  shortDesc: string;
  effectDesc: string;
}> = [
  {
    id: 'balanced',
    icon: '⚖️',
    name: 'สมดุลรอบด้าน',
    shortDesc: 'ปรับแท็กติกไว เล่นเป็นระบบ',
    effectDesc: 'เข้าใจแผนหลังเกม +2%'
  },
  {
    id: 'attack',
    icon: '🔥',
    name: 'เกมรุกดุดัน',
    shortDesc: 'เดินหน้าบุก สร้างจังหวะจบสกอร์',
    effectDesc: 'พลังเกมรุกในสนาม +1.5'
  },
  {
    id: 'defense',
    icon: '🛡️',
    name: 'วินัยเกมรับ',
    shortDesc: 'คุมโซนแน่น เสียประตูยาก',
    effectDesc: 'พลังเกมรับในสนาม +1.5'
  },
  {
    id: 'youth',
    icon: '🌱',
    name: 'ปั้นดาวรุ่ง',
    shortDesc: 'ดันและเคี่ยวดาวรุ่งอย่างต่อเนื่อง',
    effectDesc: 'โอกาสดาวรุ่ง (≤23 ปี) โต +25%'
  },
  {
    id: 'motivator',
    icon: '📣',
    name: 'จิตวิทยาปลุกใจ',
    shortDesc: 'ปลุกใจลูกทีม สู้ยิบตาจนจบเกม',
    effectDesc: 'ฟิต & ขวัญทีมหลังเกม +2% / +1'
  }
];

export const COACH_OUTFITS: Array<{
  id: 'suit_navy' | 'suit_black' | 'suit_charcoal' | 'suit_camel' | 'tracksuit' | 'polo' | 'shirt';
  name: string;
  desc: string;
  coat: string;
  lapel: string;
  shirt: string;
  mode: 'suit' | 'tracksuit' | 'polo' | 'shirt';
}> = [
  {
    id: 'suit_navy',
    name: 'สูทกรมท่า',
    desc: 'คลาสสิกสุภาพ',
    coat: '#1e293b',
    lapel: '#0f172a',
    shirt: '#f8fafc',
    mode: 'suit'
  },
  {
    id: 'suit_black',
    name: 'สูทดำเข้ม',
    desc: 'สุขุมน่าเกรงขาม',
    coat: '#18181b',
    lapel: '#09090b',
    shirt: '#f8fafc',
    mode: 'suit'
  },
  {
    id: 'suit_charcoal',
    name: 'สูทเทาโมเดิร์น',
    desc: 'สมาร์ตข้างสนาม',
    coat: '#475569',
    lapel: '#334155',
    shirt: '#f8fafc',
    mode: 'suit'
  },
  {
    id: 'suit_camel',
    name: 'สูทน้ำตาลหรู',
    desc: 'มาดกุนซือสไตล์ยุโรป',
    coat: '#6b4423',
    lapel: '#4a2e16',
    shirt: '#faf5ee',
    mode: 'suit'
  },
  {
    id: 'tracksuit',
    name: 'วอร์มสโมสร',
    desc: 'คล่องตัวสีประจำทีม',
    coat: '#1e293b',
    lapel: '#0f172a',
    shirt: '#f8fafc',
    mode: 'tracksuit'
  },
  {
    id: 'polo',
    name: 'โปโลคุมทีม',
    desc: 'ลุคฝึกซ้อมสบายๆ',
    coat: '#1e293b',
    lapel: '#0f172a',
    shirt: '#f8fafc',
    mode: 'polo'
  },
  {
    id: 'shirt',
    name: 'เชิ้ตผูกไท',
    desc: 'เรียบหรูคล่องแคล่ว',
    coat: '#f8fafc',
    lapel: '#e2e8f0',
    shirt: '#f8fafc',
    mode: 'shirt'
  }
];
