import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OfflineIndicator, PWAInstallButton } from './pwa.tsx';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
type Position = 'GK' | 'DF' | 'MF' | 'FW';
type SubRole =
  | 'GK'
  | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'LDM' | 'RDM' | 'CM' | 'LCM' | 'RCM' | 'CAM' | 'LM' | 'RM'
  | 'ST' | 'CF' | 'SS' | 'LW' | 'RW';

type StatKey = 'sh' | 'ps' | 'dr' | 'tk' | 'ph';
type Mentality = 'X' | 'A' | 'B' | 'D' | 'Z';
type GameMode = 'm' | 'p';
type MainTab = 't' | 's' | 'q' | 'k' | 'f' | 'u' | 'c' | 'p';
type TrainingFocus = 'FW' | 'MF' | 'DF' | 'F';

interface CoreAttrs {
  sh: number;
  ps: number;
  dr: number;
  tk: number;
  ph: number;
}

interface PlayerContract {
  yr: number;
  wg: number;
  role: 'key' | 'rot' | 'pro';
}

interface Player {
  id?: string;
  n: string;
  pos: Position;
  ro: SubRole;
  sp?: number;
  ov: number;
  age: number;
  pot: number;
  fit: number;
  inj: number;
  sus?: number;
  yc?: number;
  rc?: number;
  no?: number;
  me?: number;
  vis?: number[];
  con?: PlayerContract;
  loan?: number;
  loanOpt?: number;
  price?: number;
  free?: number;
  askWg?: number;
  tries?: number;
  locked?: number;
  sg?: number;
  sa?: number;
  cs?: number;
  ap?: number;
  g?: number;
  scouted?: boolean;
  formStreak?: number;
  listed?: number;
  askPrice?: number;
  offerCoolMd?: number;
  signedSeason?: number;
  signedMd?: number;
}

type CustomSlot = [SubRole, number, number];

interface Team {
  id: number;
  name: string;
  tier: number;
  kc: [string, string];
  sq: Player[];
  form: string;
  cf?: CustomSlot[];
  lu?: string[] | null;
  cap?: string;
  tac: Mentality;
  press?: number;
  tempo?: number;
  wid?: number;
  line?: number;
  pass?: number;
  pts: number;
  gf: number;
  ga: number;
  w: number;
  d: number;
  l: number;
  p: number;
  fm?: string;
  foreign?: number;
  tacFam?: number;
}

interface ClubIdentity {
  name: string;
  nick: string;
  std: string;
  c1: string;
  c2: string;
  c3?: string;
  shape: number;
  pat: number;
  icon: string;
  kit: number;
  awayKit?: number;
  collar?: number;
  crestBorder?: number;
  stars?: number;
  cuffTrim?: boolean;
  motto?: string;
  founded?: number;
  managerName?: string;
}

interface PlayerCareerProfile {
  name: string;
  pos: Position;
  sp: SubRole;
  tr: StatKey;
  sig?: string;
  archName?: string;
  c: string;
  k: string;
  h: string;
  hs: number;
  fh: number;
  fs: number;
  ey: number;
  no?: number;
  pts: number;
  b: CoreAttrs;
  a: CoreAttrs;
  sb?: Record<string, number>;
  age: number;
  gl: number;
  as: number;
  ap: number;
  rs: number;
  en: number;
  plan: number;
  trn?: number;
  vid?: number;
  gd?: number;
  sat?: number;
  last?: string;
  fm?: number[];
  s0?: { gl: number; as: number; ap: number };
  rep?: number;
  ntCaps?: number;
  ntGoals?: number;
  perks?: string[];
  careerLog?: string[];
  yc?: number;
  rc?: number;
  sus?: number;
}

interface AutoRule {
  c: 'tr' | 'dr' | 'ld' | 'rc';
  min: number;
  tac: Mentality;
}

interface MatchEvent {
  m: number;
  t: number;
  who: string;
  as?: string;
}

interface MatchCardEvent {
  m: number;
  t: number;
  who: string;
  type: 'Y' | 'Y2R' | 'R';
}

interface MatchSubEvent {
  m: number;
  t: number;
  inPlayer: string;
  outPlayer: string;
}

interface PlayerPerfResult {
  rt: number;
  gl: number;
  as: number;
  my: number;
  op: number;
  vid: number;
  en: number;
  pts: number;
  grew?: string;
  played?: boolean;
  mins?: number;
  subIn?: boolean;
  subOut?: boolean;
  yc?: number;
  rc?: number;
}

interface MatchResult {
  gh: number;
  ga: number;
  evs: MatchEvent[];
  pen?: boolean;
  nw?: string;
  pf?: PlayerPerfResult;
  xgH?: number;
  xgA?: number;
  ratings?: Record<string, number>;
  motm?: string;
  cards?: MatchCardEvent[];
  subs?: MatchSubEvent[];
  playedNames?: Record<number, string[]>;
}

interface CupState {
  alive: boolean;
  r: number;
  done: boolean;
  log: string[];
  ids: number[];
}

interface AsiaCupState {
  r: number;
  p: number[];
  ids: number[];
  alive: boolean;
  done: boolean;
  log: string[];
}

interface FeedItem {
  cat: string;
  txt: string;
  tone?: '' | 'urg' | 'offer' | 'ok';
  s: number;
  m: number;
}

interface FinLogItem {
  t: string;
  amt: number;
  m: number;
  s: number;
}

interface TransferOffer {
  n: string;
  p: number;
  t: string;
  teamId?: number;
  cnt?: number;
}

interface ActiveDilemma {
  id: string;
  title: string;
  desc: string;
  category: string;
  options: { label: string; hint: string }[];
}

interface ScoutMission {
  id: string;
  focus: 'wonderkid' | 'free' | 'gk' | 'striker' | 'defender' | 'midfielder';
  targetRole?: SubRole | '';
  label: string;
  turnsLeft: number;
  results?: Player[];
}

interface TrophyRecord {
  season: number;
  title: string;
  tier?: number;
  type: 'league' | 'cup' | 'asia' | 'award' | 'nt';
}

interface ClubRecords {
  bestWin?: { txt: string; diff: number };
  topSeasonScorer?: { n: string; g: number; s: number };
  mostPoints?: { pts: number; s: number };
  winStreak?: number;
  curStreak?: number;
}

interface GameState {
  ver: number;
  mode: GameMode;
  season: number;
  md: number;
  teams: Team[];
  me: number;
  money: number;
  v: MainTab;
  lg?: number | null;
  tv?: number;
  sub?: number;
  sel?: string | null;
  hist: string[];
  mk: Player[];
  st: number;
  tr: number;
  ya: number;
  tf: TrainingFocus;
  focusPlayer?: string | null;
  yth: Player[];
  fx: [number, number][][];
  fxo?: Record<number, [number, number][][]>;
  pc: boolean;
  pa?: boolean;
  cup: CupState;
  ac?: AsiaCupState;
  aq?: number[];
  aqs?: number;
  asia?: number[];
  p?: PlayerCareerProfile;
  club?: ClubIdentity;
  fan?: number;
  mor?: number;
  bd?: number;
  obj?: number;
  sack?: number;
  derby?: number;
  diff?: number;
  tp?: number;
  sp?: number;
  winBonus?: number;
  promo?: number;
  payDue?: number;
  bankLoan?: { left: number; per: number } | null;
  clubActMd?: number;
  rules?: AutoRule[];
  slots?: (Record<string, unknown> | null)[];
  off?: TransferOffer | null;
  offers?: TransferOffer[];
  res?: string[];
  news?: string;
  feed?: FeedItem[];
  finLog?: FinLogItem[];
  esd?: number;
  mgrRep?: number;
  trophies?: TrophyRecord[];
  records?: ClubRecords;
  scout?: ScoutMission | null;
  dilemma?: ActiveDilemma | null;
  dilemmaCd?: number;
  schedRes?: Record<number, { h: number; a: number; gh: number; ga: number }>;
  cupLog?: { md: number; comp: 'cup' | 'asia'; r: number; h: number; a: number; gh: number; ga: number; penText?: string }[];
  med?: number;
  merchLv?: number;
  staff?: { asst: number; fit: number; scout: number; physio: number };
  sponsorDeal?: { id: string; name: string; perMatch: number; left: number } | null;
}

interface AppSettings {
  mute?: boolean;
  novib?: boolean;
  quick?: boolean;
  matchSpeed?: 1 | 2 | 4;
  autoSkipMatch?: boolean;
  theme?: 'light' | 'dark' | '';
  nocrowd?: boolean;
  subAlertEnabled?: boolean;
  subAlertFitThreshold?: number;
  subAlertFormThreshold?: number;
}

// ============================================================================
// 2. CONSTANTS & THAI FOOTBALL DATA
// ============================================================================
const A1 = ['ธน', 'กิต', 'วีร', 'ภัค', 'ศุภ', 'นรา', 'อนุ', 'ชัย', 'พงศ์', 'กฤษ', 'ปริญ', 'รัฐ', 'เมธ', 'ณัฐ'];
const A2 = ['พล', 'ภัทร', 'วัฒน์', 'ศักดิ์', 'เดช', 'พัฒน์', 'ชนม์', 'ธร', 'นนท์', 'กร'];
const S1 = ['วงษ์', 'แสง', 'บุญ', 'ทอง', 'สุข', 'คำ', 'ศรี', 'ใจ', 'เพชร', 'มณี'];
const S2 = ['ทอง', 'เจริญ', 'รัตน์', 'สกุล', 'ชัย', 'งาม', 'ดี', 'มั่น'];

const FN = [
  'สมชาย', 'วิชัย', 'ประเสริฐ', 'อนุชา', 'ธีรพงษ์', 'สุรชัย', 'ณรงค์', 'มานะ', 'สมศักดิ์', 'ประวิทย์',
  'ชาญชัย', 'วีระ', 'สุเทพ', 'อดิศักดิ์', 'เกียรติศักดิ์', 'ภานุ', 'ธนากร', 'พีรพล', 'รชต', 'ศิวกร',
  'ปฏิภาณ', 'จักรกฤษณ์', 'นัฐวุฒิ', 'อภิชาติ', 'ชัยวัฒน์', 'สิทธิพล', 'พิสิษฐ์', 'เจษฎา', 'ธเนศ', 'คมสัน',
  'ภูมิพัฒน์', 'กิตติพงษ์', 'อรรถพล', 'ศุภชัย', 'วรเชษฐ์', 'ปุริม', 'ธีรเดช', 'นพดล', 'เอกชัย', 'ชนาวิน'
];

const SN = [
  'แสนดี', 'ใจดี', 'รักษา', 'มั่นคง', 'พรหมมา', 'สีสุข', 'ทองสุข', 'บุญมา', 'คำแก้ว', 'ศรีสวัสดิ์',
  'วงษ์ประเสริฐ', 'เพ็งสุข', 'จันทร์แจ่ม', 'โพธิ์ทอง', 'ชูเกียรติ', 'สุวรรณ', 'พิมพ์ทอง', 'อินทร์แก้ว',
  'ปัญญาดี', 'แก้วมณี', 'ไชยวงศ์', 'เรืองศรี', 'สายทอง', 'บัวผัน', 'ดวงดี', 'มีสุข', 'นาคสุข', 'ธนะสาร', 'ศรีจันทร์', 'หอมหวล'
];

const NG = [
  ['โคกมะตูม', 'วังชมพู', 'ท่าขนุน', 'ห้วยกะปิ', 'ดอนลำไย', 'บึงกระจับ', 'คลองรำลึก', 'แก่งสำราญ', 'โนนขมิ้น', 'นาตะไคร้', 'ปากน้ำใส', 'สันป่ายาง', 'แหลมทองคำ', 'บางสนม', 'ทุ่งรวงทอง', 'เขาชะเมา', 'คุ้งไผ่', 'โพธิ์สามต้น', 'ปางสวรรค์', 'หนองโสน', 'บ้านหมี่', 'กุดรัง', 'ดอยสกาว', 'สวนส้มโอ', 'ม่อนแจ่มศรี', 'สะพานไม้', 'ลำน้ำพอง', 'ตลิ่งชันเหนือ', 'อ่างศิลาแก้ว', 'ด่านแม่ละเมา', 'ร่องกล้า', 'ไร่อ้อยพัฒนา'],
  ['ภูผาเพชร', 'ธารามรกต', 'คีรีบูลย์', 'ไพลินนคร', 'สายชลาธาร', 'มณีจันทร์', 'พฤกษาสยาม', 'รัตนคีรี', 'สุริยเทพ', 'อรุณรุ่ง', 'ปฐพีทอง', 'ชลธีใต้', 'สิงขรเหนือ', 'เวียงพิงค์หลวง', 'ธนบุรีศรี', 'กัลปพฤกษ์', 'จันทราทวีป', 'บุษราคัม', 'อัมรินทร์', 'วิมานเมฆ', 'ทักษิณาวุธ', 'บูรพาสินธุ์', 'อิศรานคร', 'ประจิมพนา', 'นทีทิพย์', 'ศิลานิล', 'เหมันต์นคร', 'วสันต์บุรี', 'คิมหันต์ราช', 'ไตรรัตน์', 'พรหมพิราม', 'ชลาลัย'],
  ['พยัคฆ์คำราม', 'มังกรอัคนี', 'อินทรีเวหา', 'สิงโตคำรณ', 'นาคราช', 'วายุภักษ์', 'ราชสีห์ทอง', 'กิเลนฟ้า', 'หงส์เพลิง', 'คชสาร', 'เหยี่ยวสายฟ้า', 'เสือสมิง', 'กระเรียนเหล็ก', 'ครุฑา', 'ฉลามคลั่ง', 'ม้าศึก', 'กระทิงดุ', 'หมาป่าเงิน', 'จงอางพิฆาต', 'ต่อเพชฌฆาต', 'ราชันตะวัน', 'จอมทัพสยาม', 'อสุรา', 'ไกรสร', 'เทพพิทักษ์', 'พิชิตมาร', 'ศรนารายณ์', 'นพเก้า', 'จักรพรรดิ', 'แสงสุริยา', 'ดาราฉาย', 'ป้อมปราการ']
];

const AN = [
  'ฮาคุโร เอฟซี', 'คิตะซึกิ ยูไนเต็ด', 'ชินโดก ไทเกอร์ส', 'มูจิน มารีนส์',
  'เหลียงซาน ดราก้อน', 'เทียนหลง อิมพีเรียล', 'จินหลิง พยัคฆ์ใต้', 'อัลซาฮิล ฟอลคอนส์',
  'ซันดาร์ สตาร์', 'คาวีร์ ไลออนส์', 'อัลมาส เอ็มไพร์', 'ลองซา ริเวอร์',
  'นุสันตรา การูด้า', 'เมอร์ลิน วอร์ริเออร์ส', 'ราชปุระ สไปซ์', 'อาซูร่า ฮาร์เบอร์'
];

const RN = ['รอบ 16 ทีม', 'รอบ 8 ทีม', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];
const TN = ['ลีกระดับจังหวัด', 'ลีกในประเทศ ดิวิชั่น 2', 'ลีกในประเทศ ดิวิชั่น 1', 'ทีมต่างแดน'];
const BASE = [40, 54, 68, 72];
const POS: Position[] = ['GK', 'DF', 'MF', 'FW'];
const ATT: [StatKey, string][] = [['sh', 'ยิง'], ['ps', 'จ่าย'], ['dr', 'เลี้ยง'], ['tk', 'แย่ง'], ['ph', 'กาย']];
const GN: Record<Position, string> = { GK: 'ผู้รักษาประตู', DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };

const SFX0 = [
  ['เอฟซี', 'เอสซี', 'สปอร์ตคลับ', 'ยูธ', 'ซิตี้', 'เอซี', ''],
  ['เอฟซี', 'เอสซี', 'แอธเลติก', 'ทาวน์', 'เรนเจอร์ส', 'ยูไนเต็ด', 'ซิตี้', ''],
  ['เอฟซี', 'แอธเลติก', 'เรนเจอร์ส', 'โรเวอร์ส', 'เวนเจอร์ส', 'แอสโตร', 'เอสซี', 'สตาร์', 'ยูไนเต็ด', 'ซิตี้', 'อะคาเดมี', '']
];

const FSD: Record<string, [SubRole, number, number][]> = {
  '4-4-2': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 50], ['CM', 38, 55], ['CM', 62, 55], ['RM', 88, 50], ['ST', 38, 22], ['ST', 62, 22]],
  '4-3-3': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 27, 49], ['CDM', 50, 60], ['CM', 73, 49], ['LW', 15, 24], ['ST', 50, 17], ['RW', 85, 24]],
  '4-3-3 (F9)': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 28, 50], ['CDM', 50, 62], ['CM', 72, 50], ['LW', 18, 20], ['CF', 50, 27], ['RW', 82, 20]],
  '3-5-2': [['GK', 50, 92], ['CB', 24, 76], ['CB', 50, 80], ['CB', 76, 76], ['LM', 8, 46], ['CM', 30, 54], ['CDM', 50, 63], ['CM', 70, 54], ['RM', 92, 46], ['ST', 38, 21], ['SS', 62, 28]],
  '4-2-3-1': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 36, 63], ['CDM', 64, 63], ['LM', 14, 40], ['CAM', 50, 38], ['RM', 86, 40], ['ST', 50, 15]],
  '5-3-2': [['GK', 50, 92], ['LWB', 8, 62], ['CB', 28, 76], ['CB', 50, 80], ['CB', 72, 76], ['RWB', 92, 62], ['CM', 27, 48], ['CDM', 50, 57], ['CM', 73, 48], ['ST', 38, 20], ['ST', 62, 20]],
  '3-4-3': [['GK', 50, 92], ['CB', 24, 76], ['CB', 50, 80], ['CB', 76, 76], ['LM', 10, 52], ['CM', 38, 56], ['CM', 62, 56], ['RM', 90, 52], ['LW', 18, 22], ['ST', 50, 15], ['RW', 82, 22]],
  '5-4-1': [['GK', 50, 92], ['LWB', 8, 64], ['CB', 28, 76], ['CB', 50, 80], ['CB', 72, 76], ['RWB', 92, 64], ['LM', 14, 46], ['CM', 38, 52], ['CM', 62, 52], ['RM', 86, 46], ['ST', 50, 18]],
  '4-4-1-1': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 54], ['CM', 38, 58], ['CM', 62, 58], ['RM', 88, 54], ['SS', 50, 34], ['ST', 50, 15]],
  '4-1-2-1-2': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 50, 63], ['CM', 27, 50], ['CM', 73, 50], ['CAM', 50, 38], ['ST', 38, 17], ['ST', 62, 17]]
};

const LINE: Record<string, Position> = {
  GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF',
  CDM: 'MF', LDM: 'MF', RDM: 'MF', CM: 'MF', LCM: 'MF', RCM: 'MF', CAM: 'MF', LM: 'MF', RM: 'MF',
  ST: 'FW', CF: 'FW', SS: 'FW', LW: 'FW', RW: 'FW'
};

// CF (False 9 / Link-up) is kept distinct from ST (Poacher) and SS (Shadow Striker)
const EQ: Record<string, string> = { LCM: 'CM', RCM: 'CM', LDM: 'CDM', RDM: 'CDM' };
const SIMP = [
  'LB LWB', 'RB RWB', 'CDM CM', 'CM CAM', 'CM LM', 'CM RM', 'LM LW', 'RM RW',
  'ST CF', 'CF SS', 'CF CAM', 'ST SS', 'SS CAM', 'SS LW', 'SS RW',
  'LW ST', 'RW ST', 'LW CF', 'RW CF', 'LWB LM', 'RWB RM', 'CB CDM'
];
const PM = [1, 0.97, 0.92];
const PCOL = ['#ffffff', '#ffc247', '#ff6b6b'];

const SPX: Record<Position, SubRole[]> = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  FW: ['ST', 'CF', 'SS', 'LW', 'RW']
};

const ALL_SUB_ROLES: SubRole[] = [
  'GK',
  'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'CF', 'SS', 'LW', 'RW'
];

const SPN: Record<string, string> = {
  GK: 'ผู้รักษาประตู', CB: 'กองหลังกลาง', LB: 'แบ็กซ้าย', RB: 'แบ็กขวา',
  CDM: 'กองกลางตัวรับ', CM: 'กองกลาง', CAM: 'กองกลางตัวรุก', LM: 'ปีกซ้าย(กลาง)', RM: 'ปีกขวา(กลาง)',
  ST: 'หน้าเป้า (ปักหลักจบสกอร์)', CF: 'หน้าเชื่อม (False 9 / พักบอล)', LCM: 'กองกลางซ้าย', RCM: 'กองกลางขวา',
  LDM: 'ตัวรับซ้าย', RDM: 'ตัวรับขวา', SS: 'หน้าต่ำ/เงา (สอดเข้าช่อง)', LWB: 'วิงแบ็กซ้าย', RWB: 'วิงแบ็กขวา',
  LW: 'ปีกซ้าย', RW: 'ปีกขวา'
};

const ROLE_HINT: Partial<Record<SubRole, string>> = {
  ST: 'ปักหลักค้ำแนวรับคู่แข่ง รอแทงทะลุช่องและเข้าฮอสในกรอบ 6 หลา',
  CF: 'ถอยลงมารับบอลเชื่อมเกม ดึงเซนเตอร์หลุดตำแหน่งเพื่อเปิดช่องให้ปีกและหน้าต่ำสอดเข้ายิง',
  SS: 'เล่นหลังกองหน้าตัวหลัก หาจังหวะสอดทะลุช่อง (ทำทาง) เข้าเขตโทษและซัดไกลจังหวะสอง'
};

const POSL: SubRole[] = ['ST', 'CF', 'SS', 'CAM', 'LW', 'RW', 'LM', 'RM', 'CM', 'CDM', 'LCM', 'RCM', 'LDM', 'RDM', 'CB', 'RWB', 'LWB', 'LB', 'RB'];
const SKIN_P = ['#f6d4b3', '#f1c9a0', '#d9a273', '#a8744a', '#6b4630'];
const HAIR_P = ['#16161a', '#4a2e16', '#8b5a2b', '#c9a227', '#7a2e22'];
const HS_N = ['คลาสสิก', 'สไปกี้', 'ปัดข้าง', 'หยิกฟู', 'สกินเฮด', 'เสยเรียบ', 'คาดผม', 'แสกกลาง'];
const FH_N = ['ไม่มี', 'เคราแพะ', 'เคราเต็ม', 'หนวด'];
const FS_N = ['เรียว', 'กลม', 'กรามคม'];
const EY_N = ['มุ่งมั่น', 'จริงจัง', 'ยิ้มมั่นใจ', 'สุขุม'];

const KIT_P: [string, string][] = [
  ['#c0392b', '#ffffff'], ['#2f6fd6', '#f4c63d'], ['#e67e22', '#1d2d44'], ['#6d28d9', '#fde68a'],
  ['#111827', '#38bdf8'], ['#0e7c86', '#fff7ed'], ['#be185d', '#e0f2fe'], ['#15803d', '#fef08a'],
  ['#b45309', '#f8fafc'], ['#1d4ed8', '#fb7185'], ['#7c2d12', '#bae6fd'], ['#374151', '#fbbf24'],
  ['#9f1239', '#a7f3d0'], ['#0369a1', '#fde047'], ['#4c1d95', '#ffffff'], ['#dc2626', '#1e293b']
];
const KIT_SW = [
  '#c0392b', '#991b1b', '#e67e22', '#f4c63d', '#84cc16', '#1c7a4a',
  '#0e7c86', '#0ea5e9', '#2f6fd6', '#1e3a8a', '#7c3aed', '#d6336c',
  '#ffffff', '#cbd5e1', '#111111'
];

const SIGL: Record<string, string> = {
  fin: 'จบสกอร์', pw: 'พลังยิง', cur: 'ยิงโค้ง', run: 'เข้าทำตำแหน่ง (วิ่งหาช่อง)',
  crs: 'เปิดบอล', rd: 'อ่านเกม', pos: 'สกัด/ยืนตำแหน่ง', mrk: 'ประกบตัว', blk: 'บล็อกลูกยิง', hd: 'โหม่ง',
  spd: 'ความเร็ว', str: 'ความแข็งแรง', sta: 'ความอึด', tol: 'ทนต่อบาดเจ็บ', rec: 'ฟื้นตัวเร็ว',
  comp: 'ความนิ่งในนัดใหญ่', sv: 'เซฟ', cl: 'ออกมาปิดมุม', dist: 'จ่ายจากแนวหลัง'
};

interface PlayerArchetype {
  id: string;
  pos: Position[];
  icon: string;
  name: string;
  desc: string;
  tr: StatKey;
  sig: string;
  coreBonus: Partial<CoreAttrs>;
  sbBonus: Record<string, number>;
  autoCorePts: Partial<Record<StatKey, number>>;
  autoSubPts: Record<string, number>;
}

const ROLE_BASE_ATTRS = (pos: Position, sp: SubRole): CoreAttrs => {
  const map: Partial<Record<SubRole, CoreAttrs>> = {
    ST: { sh: 63, ps: 37, dr: 45, tk: 27, ph: 49 },
    CF: { sh: 58, ps: 50, dr: 49, tk: 29, ph: 46 },
    SS: { sh: 56, ps: 47, dr: 55, tk: 30, ph: 42 },
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

const PLAYER_ARCHETYPES: PlayerArchetype[] = [
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
    sbBonus: { cur: 5, rd: 5, comp: 4 },
    autoCorePts: { ps: 6, dr: 3, sh: 2, tk: 1 },
    autoSubPts: { crs: 4, rd: 2, cur: 2 }
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
    sbBonus: { rec: 6, run: 4, rd: 4 },
    autoCorePts: { ph: 4, ps: 4, tk: 3, dr: 1 },
    autoSubPts: { sta: 4, rec: 2, rd: 2 }
  },
  {
    id: 'destroyer',
    pos: ['MF', 'DF'],
    icon: '🛡️',
    name: 'ตัวรับตัดเกมดุดัน',
    desc: 'อ่านทางบอลขาด เข้าสกัดแม่นยำ ประกบติดและปิดพื้นที่เก่ง',
    tr: 'tk',
    sig: 'rd',
    coreBonus: { tk: 3, ph: 1 },
    sbBonus: { pos: 5, mrk: 4, str: 4 },
    autoCorePts: { tk: 6, ph: 3, ps: 2, dr: 1 },
    autoSubPts: { rd: 3, pos: 3, mrk: 2 }
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
    sbBonus: { crs: 5, blk: 4, comp: 4 },
    autoCorePts: { tk: 5, ps: 4, ph: 2, dr: 1 },
    autoSubPts: { rd: 3, crs: 3, blk: 2 }
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

const ROLE_L: Record<string, string> = { key: 'ตัวหลัก', rot: 'หมุนเวียน', pro: 'ดาวรุ่ง/สำรอง' };
const AR_C: Record<string, string> = { tr: 'ตามอยู่', dr: 'เสมอ', ld: 'นำอยู่', rc: 'เหลือ 10 คน' };
const AR_T: Record<Mentality, string> = { X: 'บุกหนัก', A: 'บุก', B: 'สมดุล', D: 'รับ', Z: 'ปิดเกม' };

const PRE: [string, { form: string; tac: Mentality; press: number; tempo: number; wid: number; line: number; pass: number }][] = [
  ['ติกิตาก้า', { form: '4-3-3', tac: 'A', press: 2, tempo: 1, wid: 1, line: 2, pass: 0 }],
  ['เพรสซิ่งสูง', { form: '4-2-3-1', tac: 'A', press: 2, tempo: 2, wid: 1, line: 2, pass: 1 }],
  ['เกมสวน', { form: '5-3-2', tac: 'D', press: 0, tempo: 2, wid: 1, line: 0, pass: 3 }],
  ['ปิดเกมรับ', { form: '5-4-1', tac: 'Z', press: 0, tempo: 0, wid: 0, line: 0, pass: 2 }],
  ['บอลยาวปีก', { form: '3-4-3', tac: 'B', press: 1, tempo: 2, wid: 2, line: 1, pass: 2 }]
];

const PACT = [
  { i: '💪', n: 'ซ้อมหนัก', d: 'พัฒนาค่าพลังหลักไวสุด แต่ฟื้นพลังกายน้อย', en: 5, gr: 0.28 },
  { i: '🏃', n: 'ซ้อมเบา', d: 'พัฒนาค่าพลังได้สม่ำเสมอ · พลังกายฟื้นตัวดี', en: 18, gr: 0.14 },
  { i: '😴', n: 'พักผ่อน', d: 'ฟื้นพลังกายได้มากที่สุด · รักษาความฟิตเต็มร้อย', en: 36, gr: 0 },
  { i: '📺', n: 'ดูวิดีโอวิเคราะห์เกม', d: 'นัดหน้าเล่นดีขึ้น (เรตติ้ง +0.3) · โอกาสพัฒนาไหวพริบ', en: 12, gr: 0, vid: 0.3, pt: 0.25 },
  { i: '🏋️', n: 'ยิม / วิ่งนอกสนาม', d: 'เน้นเพิ่มค่าความแข็งแรงร่างกาย · เหนื่อยพอสมควร', en: 10, gr: 0.25, k: 'ph' as StatKey },
  { i: '🤝', n: 'พบปะแฟนบอล', d: 'ขวัญแฟนบอลเพิ่ม ช่วยให้เล่นดีขึ้น · โอกาสพัฒนาความนิ่ง', en: 14, gr: 0, fan: 6, pt: 0.28 }
];

const CAREER_PERKS: { id: string; name: string; desc: string; cost: number }[] = [
  { id: 'clutch', name: 'นิ่งในเกมใหญ่', desc: 'นัดดาร์บี้/บอลถ้วย มีโอกาสยิงและเรตติ้งสูงขึ้น', cost: 25 },
  { id: 'engine', name: 'ปอดเหล็ก', desc: 'เสียพลังกายต่อแมตช์น้อยลง 25%', cost: 30 },
  { id: 'prodigy', name: 'พรสวรรค์พุ่งทะยาน', desc: 'โอกาสค่าพลังขึ้นจากการซ้อม +10%', cost: 35 },
  { id: 'captain', name: 'ขวัญใจมหาชน', desc: 'ขวัญแฟนบอลเพิ่มเร็วขึ้นและช่วยดึงเรตติ้งทีม', cost: 20 }
];


// ============================================================================
// 3. AUDIO, THEME & HAPTICS
// ============================================================================
const SET_KEY = 'lkset';

function getSettings(): AppSettings {
  try {
    return JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

function getDefaultMatchSpeed(st: AppSettings): 1 | 2 | 4 {
  if (st.matchSpeed === 1 || st.matchSpeed === 2 || st.matchSpeed === 4) return st.matchSpeed;
  return 1;
}

function applyTheme(theme?: 'light' | 'dark' | '') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

let audioCtx: AudioContext | null = null;
let crowdSource: AudioBufferSourceNode | null = null;

function snd(freq: number, dur = 0.12, type: OscillatorType = 'square', vol = 0.05, delay = 0) {
  const st = getSettings();
  if (st.mute) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AudioCtx();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const now = audioCtx.currentTime + delay;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + dur);
  } catch {
    // ignore audio block
  }
}

const SFX = {
  tap: () => snd(520, 0.06, 'triangle', 0.035),
  pass: () => snd(260, 0.04, 'sine', 0.022),
  kick: () => snd(180, 0.055, 'triangle', 0.032),
  foul: () => snd(1480, 0.14, 'sine', 0.042),
  goal: () => [523, 659, 784, 1047].forEach((f, i) => snd(f, 0.18, 'square', 0.045, i * 0.1)),
  whistle: () => {
    snd(1800, 0.24, 'sine', 0.055);
    snd(1800, 0.36, 'sine', 0.055, 0.28);
  },
  win: () => [392, 523, 659, 784].forEach((f, i) => snd(f, 0.2, 'triangle', 0.055, i * 0.12)),
  lose: () => [330, 262, 196].forEach((f, i) => snd(f, 0.24, 'sawtooth', 0.035, i * 0.14))
};

function setCrowdAudio(on: boolean) {
  try {
    if (crowdSource) {
      crowdSource.stop();
      crowdSource = null;
    }
    const st = getSettings();
    if (!on || st.mute || st.nocrowd) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AudioCtx();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    const filt = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    src.buffer = buf;
    src.loop = true;
    filt.type = 'bandpass';
    filt.frequency.value = 500;
    gain.gain.value = 0.014;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    crowdSource = src;
  } catch {
    // ignore
  }
}

function vibrate(pattern: number | number[]) {
  const st = getSettings();
  if (st.novib) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

function triggerConfetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f5c242', '#2fc476', '#ff7a5c', '#60a5fa', '#ffffff'];
  for (let i = 0; i < 45; i++) {
    const el = document.createElement('i');
    el.className = 'confetti-piece';
    el.style.left = `${Math.floor(Math.random() * 100)}%`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ============================================================================
// 4. SIMULATION ENGINE
// ============================================================================
const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const P = <T,>(a: T[]): T => a[R(0, a.length - 1)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const NMU = new Set<string>();
function genPlayerName(): string {
  let n = '';
  for (let i = 0; i < 40; i++) {
    const first = Math.random() < 0.5 ? P(A1) + P(A2) : P(FN);
    const last = Math.random() < 0.5 ? P(S1) + P(S2) : P(SN);
    n = `${first} ${last}`;
    if (!NMU.has(n)) break;
  }
  NMU.add(n);
  return n;
}

function clearNamePool() {
  NMU.clear();
}

function genClubNames(): string[][] {
  const u = new Set<string>();
  const tg = [
    ['เอฟซี', 'เอสซี', 'สปอร์ตคลับ', 'ยูธ', 'ซิตี้', ''],
    ['เอฟซี', 'ยูไนเต็ด', 'ซิตี้', 'แอธเลติก', 'เรนเจอร์ส', 'ทาวน์', ''],
    ['', 'ยูไนเต็ด', 'ซิตี้', 'เอฟซี', 'สตาร์', 'โรเวอร์ส', '']
  ];
  return [0, 1, 2].map((t) => {
    const pool = NG[t].slice().sort(() => Math.random() - 0.5);
    const out: string[] = [];
    for (const base of pool) {
      if (out.length >= 16) break;
      const sx = P(tg[t]);
      const n = base + (sx ? ' ' + sx : '');
      if (!u.has(n)) {
        u.add(n);
        out.push(n);
      }
    }
    return out;
  });
}

const NSL = 5;
const slotKey = (m: GameMode, k = 1) => (m === 'p' ? 'lk_p' : 'lk_m') + (k > 1 ? `_${k}` : '');

function saveGameToSlot(s: GameState, slot: number) {
  try {
    localStorage.setItem(slotKey(s.mode, slot), JSON.stringify(s));
  } catch {
    // ignore quota errors
  }
}

function loadGameFromSlot(m: GameMode, slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(m, slot));
    if (!raw) return null;
    const d = JSON.parse(raw) as GameState;
    if (Array.isArray(d?.teams)) {
      d.teams.forEach(assignTeamShirtNumbers);
      if (d.mode === 'p' && d.p) {
        const mePl = d.teams[d.me]?.sq.find((q) => q.me);
        if (mePl?.no) d.p.no = mePl.no;
      }
    }
    return d;
  } catch {
    return null;
  }
}

function deleteSlot(m: GameMode, slot: number) {
  try {
    localStorage.removeItem(slotKey(m, slot));
  } catch {
    // ignore
  }
}

function firstEmptySlot(m: GameMode): number {
  for (let k = 1; k <= NSL; k++) {
    if (!loadGameFromSlot(m, k)) return k;
  }
  return 0;
}

const SPW = (p: Position): SubRole =>
  p === 'DF'
    ? P(['CB', 'CB', 'CB', 'LB', 'RB', 'LWB', 'RWB'])
    : p === 'MF'
      ? P(['CM', 'CM', 'CDM', 'CAM', 'LM', 'RM'])
      : p === 'FW'
        ? P(['ST', 'ST', 'CF', 'SS', 'LW', 'RW'])
        : 'GK';

const NOP: Record<string, number[]> = {
  GK: [1, 12, 13, 23, 30, 31],
  DF: [2, 3, 4, 5, 15, 16, 22, 24, 25, 26],
  MF: [6, 8, 10, 7, 14, 17, 18, 20, 21, 27, 28],
  FW: [9, 11, 19, 29, 32, 33, 34]
};

function getShirtNo(team: Team | null | undefined, q: Partial<Player>): number {
  if (q.no && q.no >= 1 && q.no <= 99) return q.no;
  if (!team) return Array.isArray(q.vis) && q.vis[5] ? q.vis[5] : q.pos === 'GK' ? 1 : 10;
  const used = new Set(team.sq.map((z) => z.no).filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 99));
  let n = (NOP[q.pos || 'MF'] || []).find((v) => !used.has(v));
  if (!n) {
    for (let i = 35; i <= 99; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  if (!n) {
    for (let i = 1; i <= 34; i++) {
      if (!used.has(i)) { n = i; break; }
    }
  }
  return n || 10;
}

function assignTeamShirtNumbers(team: Team) {
  const used = new Set<number>();
  const ordered = [
    ...team.sq.filter((q) => q.me),
    ...team.sq.filter((q) => !q.me)
  ];
  ordered.forEach((q) => {
    if (q.no && q.no >= 1 && q.no <= 99 && !used.has(q.no)) {
      used.add(q.no);
    } else {
      q.no = undefined;
    }
  });
  ordered.forEach((q) => {
    if (!q.no) {
      let n = (NOP[q.pos] || []).find((v) => !used.has(v));
      if (!n) {
        for (let i = 35; i <= 99; i++) {
          if (!used.has(i)) { n = i; break; }
        }
      }
      if (!n) {
        for (let i = 1; i <= 34; i++) {
          if (!used.has(i)) { n = i; break; }
        }
      }
      q.no = n || 10;
      used.add(q.no);
    }
    if (Array.isArray(q.vis) && q.vis.length >= 6) {
      q.vis[5] = q.no;
    }
  });
}

function rndVis(pos: Position, yo?: boolean): number[] {
  return [
    P([0, 1, 1, 2, 2, 2, 3, 4]),
    P([0, 0, 0, 1, 1, 2, 3, 4]),
    R(0, 7),
    yo || R(0, 9) < 6 ? 0 : R(1, 3),
    R(0, 3),
    pos === 'GK' ? 1 : 10,
    R(0, 2)
  ];
}

function visOf(q: Partial<Player>, careerP?: PlayerCareerProfile | null): number[] {
  if (q.me && careerP) {
    const ki = SKIN_P.indexOf(careerP.k);
    const hi = HAIR_P.indexOf(careerP.h);
    const no = q.no || careerP.no || 10;
    return [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, careerP.hs ?? 0, careerP.fh ?? 0, careerP.ey ?? 0, no, careerP.fs ?? 0];
  }
  if (Array.isArray(q.vis) && q.vis.length >= 5) {
    const v = q.vis;
    const no = q.no || v[5] || 10;
    return [v[0], v[1], v[2], v[3], v[4], no, v.length >= 7 ? v[6] : (v[0] + v[1] + v[2] + no) % 3];
  }
  const s = q.n || 'นักเตะ';
  const h = [...s].reduce((a, c, i) => ((a * 33) ^ (c.charCodeAt(0) * (i + 1))) >>> 0, 5381);
  const no = q.no || (q.pos === 'GK' ? [1, 13, 22, 25, 30][h % 5] : 2 + (h % 98));
  return [
    h % 5,
    (h >> 3) % 5,
    (h >> 6) % 8,
    (q.age && q.age < 19) || ((h >> 9) % 10 < 6) ? 0 : 1 + ((h >> 11) % 3),
    (h >> 13) % 4,
    no,
    (h >> 16) % 3
  ];
}

function mkPlayer(pos: Position, baseOv: number, yo?: boolean, forceRo?: SubRole): Player {
  const age = yo ? R(16, 18) : R(17, 34);
  const ov = yo ? clamp(baseOv + R(-6, 4), 20, 82) : clamp(baseOv + R(-9, 9), 25, 92);
  return {
    n: genPlayerName(),
    pos,
    ro: forceRo || SPW(pos),
    sp: 0,
    ov,
    age,
    pot: clamp(ov + (age < 24 ? R(4, 25) : R(0, 3)), ov, 95),
    fit: 100,
    inj: 0,
    vis: rndVis(pos, yo)
  };
}

function mkTeam(name: string, tier: number, id: number, diff = R(-7, 7)): Team {
  const kp = KIT_P[(id + tier * 5) % KIT_P.length];
  const hasSpace = name.includes(' ');
  const sx = hasSpace ? '' : P(SFX0[tier] || ['']);
  const team: Team = {
    id,
    name: name + (sx ? ' ' + sx : ''),
    tier,
    kc: [kp[0], kp[1]],
    sq: (
      [
        ['GK', 3],
        ['DF', 8],
        ['MF', 7],
        ['FW', 5]
      ] as [Position, number][]
    ).flatMap(([p, c]) => Array.from({ length: c }, () => mkPlayer(p, BASE[tier] + diff + R(-4, 4)))),
    form: '4-4-2',
    tac: 'B',
    press: 1,
    tempo: 1,
    wid: 1,
    line: 1,
    pass: 1,
    pts: 0,
    gf: 0,
    ga: 0,
    w: 0,
    d: 0,
    l: 0,
    p: 0,
    fm: '',
    tacFam: 65
  };
  assignTeamShirtNumbers(team);
  return team;
}

const getFormationSlots = (t?: Team): { sp: SubRole; x: number; y: number; pos: Position }[] => {
  const raw = t?.form === 'custom' && t.cf && t.cf.length === 11 ? t.cf : FSD[t?.form || '4-4-2'] || FSD['4-4-2'];
  return raw.map(([sp, x, y]) => ({ sp, x, y, pos: LINE[sp] || 'MF' }));
};

const getFormationCounts = (t?: Team): number[] => {
  const slots = getFormationSlots(t);
  return ['GK', 'DF', 'MF', 'FW'].map((p) => slots.filter((z) => z.pos === p).length);
};

const pen = (r: string, sp: string) => {
  const r2 = EQ[r] || r;
  const s2 = EQ[sp] || sp;
  if (!s2 || r2 === s2) return 0;
  if (SIMP.includes(`${r2} ${s2}`) || SIMP.includes(`${s2} ${r2}`)) return 1;
  if (LINE[r] && LINE[sp] && LINE[r] === LINE[sp]) return 1;
  return 2;
};

const fixRo = (q: Player) => {
  if (!q.ro) {
    q.ro = typeof q.sp === 'string' && LINE[q.sp] === q.pos ? (q.sp as SubRole) : SPW(q.pos);
  }
  if (typeof q.sp === 'string') q.sp = 0;
};

const OVF = (p: Position, a: CoreAttrs) =>
  Math.round(
    p === 'FW'
      ? a.sh * 0.45 + a.dr * 0.25 + a.ps * 0.15 + a.ph * 0.15
      : p === 'MF'
        ? a.ps * 0.4 + a.dr * 0.2 + a.sh * 0.15 + a.tk * 0.15 + a.ph * 0.1
        : p === 'GK'
          ? a.ph * 0.5 + a.tk * 0.3 + a.ps * 0.15 + a.dr * 0.05
          : a.tk * 0.45 + a.ph * 0.3 + a.ps * 0.15 + a.dr * 0.1
  );

function fitA(q: Player, a: CoreAttrs): CoreAttrs {
  for (let n = 0; n < 4; n++) {
    const d = q.ov - OVF(q.pos, a);
    if (!d) break;
    ATT.forEach(([k]) => {
      a[k] = clamp(a[k] + d, 10, 99);
    });
  }
  return a;
}

const ef = (q: Player) => {
  const fitVal = q.fit ?? 100;
  const tiredPenalty = fitVal < 58 ? (58 - fitVal) * 0.45 : 0;
  return q.ov * (0.75 + (0.25 * fitVal) / 100) - tiredPenalty - (q.inj > 0 || (q.sus || 0) > 0 ? 60 : 0);
};

function xi(t: Team): Player[] {
  const sl = getFormationSlots(t);
  t.sq.forEach(fixRo);
  const auto = () => {
    const o: Player[] = [];
    POS.forEach((p) => {
      const ix = sl.map((z, i) => (z.pos === p ? i : -1)).filter((i) => i >= 0);
      const pr: [number, Player, number][] = [];
      t.sq
        .filter((q) => q.pos === p)
        .forEach((q) => ix.forEach((i) => pr.push([ef(q) * PM[pen(q.ro, sl[i].sp)], q, i])));
      pr.sort((a, b) => b[0] - a[0]);
      const uq = new Set<Player>();
      const ui = new Set<number>();
      pr.forEach(([, q, i]) => {
        if (uq.has(q) || ui.has(i)) return;
        uq.add(q);
        ui.add(i);
        o[i] = q;
      });
    });
    return o.filter(Boolean);
  };
  if (!t.lu) return auto();
  const x = t.lu.map((n) => t.sq.find((q) => q.n === n)).filter((q): q is Player => Boolean(q));
  if (x.length !== 11 || new Set(x).size !== 11) {
    t.lu = null;
    return auto();
  }
  const used = new Set(x);
  return x.map((q, i) => {
    if (!(q.inj > 0 || (q.sus || 0) > 0)) return q;
    const slotPos = sl[i]?.pos || q.pos;
    const avail = t.sq.filter((z) => !used.has(z) && !(z.inj > 0 || (z.sus || 0) > 0));
    const s =
      avail.filter((z) => z.pos === slotPos).sort((a, b) => ef(b) - ef(a))[0] ||
      avail.sort((a, b) => ef(b) - ef(a))[0];
    if (s) {
      used.add(s);
      return s;
    }
    return q;
  });
}

function DT(q: Player, careerP?: PlayerCareerProfile | null) {
  const po = q.me ? careerP : null;
  const aSrc = po?.a;
  const sb = po?.sb;
  const h = [...(q.n || 'นักเตะ')].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const o: Record<string, Partial<CoreAttrs>> = {
    FW: { sh: 8, dr: 4, tk: -12 },
    MF: { ps: 8, dr: 2, tk: 2 },
    DF: { tk: 8, ph: 4, sh: -12 },
    GK: { ph: 6, tk: 6, sh: -20, dr: -15 }
  };
  const roleMod: Partial<Record<SubRole, Partial<CoreAttrs>>> = {
    CF: { ps: 5, dr: 2, sh: -2 },
    SS: { dr: 5, ps: 3, sh: -1 },
    ST: { sh: 4, ph: 2, ps: -4 }
  };
  const baseA: CoreAttrs = aSrc
    ? { ...aSrc }
    : fitA(
        q,
        Object.fromEntries(
          ATT.map(([kk], i) => [kk, clamp(q.ov + (o[q.pos][kk] || 0) + (roleMod[q.ro]?.[kk] || 0) + ((h * (i + 3)) % 11) - 5, 10, 99)])
        ) as unknown as CoreAttrs
      );
  const hv = (n: number) => {
    const raw = (((h * (n * 7 + 3)) ^ (h >> (n % 5))) % 21) - 10;
    return po ? Math.round(raw * 0.2) : raw;
  };
  const cl = (v: number) => clamp(Math.round(v), 10, 99);
  const ag = q.age || 24;
  const wing = ['LB', 'RB', 'LM', 'RM', 'LW', 'RW', 'LWB', 'RWB'].includes(q.ro);

  const d: Record<string, number> = {
    pw: cl(baseA.sh * 0.6 + baseA.ph * 0.4 + hv(1)),
    fin: cl(baseA.sh + hv(2) + (q.pos === 'FW' ? 4 : 0) + (q.ro === 'ST' ? 2 : 0)),
    cur: cl(baseA.sh * 0.5 + baseA.ps * 0.5 + hv(3) + (q.ro === 'SS' ? 3 : 0)),
    crs: cl(baseA.ps * 0.7 + baseA.dr * 0.3 + hv(4) + (wing ? 6 : 0) + (q.ro === 'CF' ? 4 : 0)),
    run: cl(baseA.sh * 0.5 + baseA.dr * 0.3 + baseA.ph * 0.2 + hv(5) + (q.ro === 'SS' ? 4 : 0)),
    rd: cl(baseA.tk * 0.6 + baseA.ps * 0.4 + hv(6)),
    pos: cl(baseA.tk * 0.7 + baseA.ps * 0.2 + baseA.ph * 0.1 + hv(7)),
    mrk: cl(baseA.tk * 0.65 + baseA.ph * 0.2 + baseA.ps * 0.15 + hv(18) + (q.pos === 'DF' ? 4 : 0)),
    blk: cl(baseA.tk * 0.55 + baseA.ph * 0.35 + baseA.ps * 0.1 + hv(19) + (q.ro === 'CB' ? 4 : 0)),
    hd: cl(baseA.ph * 0.7 + baseA.tk * 0.3 + hv(8)),
    spd: cl(baseA.dr * 0.5 + baseA.ph * 0.5 + hv(9) - Math.max(0, ag - 31) * 2),
    str: cl(baseA.ph + hv(10)),
    sta: cl(baseA.ph * 0.8 + hv(11) + (ag < 30 ? 3 : -3)),
    tol: cl(55 + baseA.ph * 0.3 + hv(12)),
    rec: cl(82 - Math.max(0, ag - 24) * 2 + hv(0)),
    comp: cl(q.ov * 0.7 + 22 + hv(14)),
    sv: cl(q.ov * 0.7 + baseA.ph * 0.3 + hv(15)),
    cl: cl(q.ov * 0.85 + hv(16)),
    dist: cl(baseA.ps * 0.8 + hv(17))
  };

  const sk = q.pos === 'GK' ? ['sv', 'cl', 'dist', 'sta', 'comp'] : ['fin', 'pw', 'cur', 'run', 'crs', 'rd', 'pos', 'mrk', 'blk', 'hd', 'spd', 'str', 'sta', 'comp'];
  const sig = po?.sig
    ? po.sig
    : po?.tr
      ? q.pos === 'GK'
        ? { sh: 'cl', ps: 'dist', dr: 'cl', tk: 'sv', ph: 'sv' }[po.tr] || 'sv'
        : { sh: 'fin', ps: 'crs', dr: 'spd', tk: 'pos', ph: 'str' }[po.tr] || sk[h % sk.length]
      : sk[h % sk.length];

  d[sig] = cl(d[sig] + 8);
  if (sb) {
    Object.keys(sb).forEach((z) => {
      if (d[z] != null) d[z] = cl(d[z] + sb[z]);
    });
  }
  return { a: baseA, h, d, sig, tr: h % 4, pk: 26 + ((h >> 2) % 4) };
}

function dtInfo(q: Player, careerP?: PlayerCareerProfile | null) {
  const D0 = DT(q, careerP);
  const a = D0.a;
  const f = Math.round(q.fit ?? 100);
  const d = D0.d;
  const gk = q.pos === 'GK';
  const G: [string, [string, number, string?][]][] = [
    ...((gk
      ? [['🧤 ผู้รักษาประตู', [['เซฟ', d.sv, 'sv'], ['ออกมาปิดมุม', d.cl, 'cl'], ['จ่ายจากแนวหลัง', d.dist, 'dist']]]]
      : [
          ['⚔️ โจมตี', [['พลังยิง', d.pw, 'pw'], ['จบสกอร์', d.fin, 'fin'], ['ยิงโค้ง', d.cur, 'cur'], ['เปิดบอล', d.crs, 'crs'], ['เข้าทำตำแหน่ง', d.run, 'run']]],
          ['🛡️ ป้องกัน', [['อ่านเกม', d.rd, 'rd'], ['สกัด/ยืนตำแหน่ง', d.pos, 'pos'], ['ประกบตัว', d.mrk, 'mrk'], ['บล็อกลูกยิง', d.blk, 'blk'], ['โหม่ง', d.hd, 'hd']]]
        ]) as [string, [string, number, string?][]][]),
    ['💪 ร่างกาย', [['ความเร็ว', d.spd, 'spd'], ['ความแข็งแรง', d.str, 'str'], ['ความอึด', d.sta, 'sta']]],
    ['❤️ ความฟิต', [['ฟิตปัจจุบัน', f], ['ทนต่อบาดเจ็บ', d.tol, 'tol'], ['ฟื้นตัวเร็ว', d.rec, 'rec']]],
    ['🌟 พรสวรรค์', [['ศักยภาพสูงสุด', q.pot || q.ov], ['นิ่งในนัดใหญ่', d.comp, 'comp']]]
  ];
  const allD = G.flatMap((g) => g[1]).filter((z) => !['ฟิตปัจจุบัน', 'ศักยภาพสูงสุด'].includes(z[0]));
  const sg = allD.find((z) => z[2] === D0.sig) || allD.find((z) => z[0] === SIGL[D0.sig]);
  const ot = allD.filter((z) => z !== sg).sort((u, w) => w[1] - u[1])[0];
  const top = [sg, ot].filter((z): z is [string, number, string?] => Boolean(z));
  const TR = [
    ['👑 ผู้นำ', 'ช่วยเพิ่มโบนัสเล็กน้อยให้ทีมเมื่อลงตัวจริง'],
    ['😤 สายเกเร', 'โดนใบเหลือง/แดงบ่อยกว่าปกติ'],
    ['🏃 ขยัน', 'ฟิตลดช้าลงและพัฒนาไวขึ้นเล็กน้อย'],
    ['😐 ปกติ', 'ไม่มีลักษณะนิสัยพิเศษ']
  ][D0.tr];
  const ag = q.age || 24;
  const gro = ag < D0.pk - 2 ? 'กำลังเติบโต' : ag <= D0.pk + 4 ? 'ช่วงพีค' : 'เริ่มถดถอย';
  const stCls = (q.sus || 0) > 0 || q.inj > 0 ? 'bad' : f < 60 ? 'wrn' : 'ok';
  const stTxt =
    (q.sus || 0) > 0
      ? `🟥 โดนแบน ${q.sus} นัด`
      : q.inj > 0
        ? `🩹 บาดเจ็บ ${q.inj} นัด`
        : f < 60
          ? `⚠️ เหนื่อยล้า (${f}%)`
          : `✅ พร้อมลง (${f}%)`;
  return { D0, a, f, d, gk, G, top, TR, ag, gro, stCls, stTxt };
}

function injD(q: Player, n: number, careerP?: PlayerCareerProfile | null): number {
  const r = DT(q, careerP).d.rec;
  return Math.max(1, n + (r >= 80 ? -1 : r < 55 ? 1 : 0));
}

function rate(
  t: Team,
  s?: GameState | null,
  big?: boolean,
  matchMin?: number,
  subsEntered?: string[],
  sentOffNames?: string[]
): { at: number; df: number; x: Player[] } {
  const x = xi(t).filter((q) => !sentOffNames?.includes(q.n));
  const f = getFormationCounts(t);
  const sl = getFormationSlots(t);
  const av = (p: Position) => {
    const idxs = x.map((q, i) => ((sl[i]?.pos || q.pos) === p ? i : -1)).filter((i) => i >= 0);
    return (
      idxs.reduce((sum, i) => sum + Math.max(0, ef(x[i])) * PM[pen(x[i].ro, (sl[i] || {}).sp)], 0) /
      (idxs.length || 1)
    );
  };
  let at = av('FW') * 0.55 + av('MF') * 0.45 + (f[3] - 2) * 2;
  let df = av('DF') * 0.6 + av('GK') * 0.4 + (f[1] - 4) * 2;

  const DL = x.map((q, i) => [q, DT(q, s?.p), sl[i]?.pos || q.pos] as const);
  const M = (ps: Position[], fn: (q: Player, d: Record<string, number>, a: CoreAttrs) => number) => {
    const l = DL.filter(([, , slotPos]) => ps.includes(slotPos));
    return l.length ? l.reduce((sum, [q, D]) => sum + fn(q, D.d, D.a), 0) / l.length : 0;
  };
  at += M(['FW', 'MF'], (q, d) => d.fin * 0.35 + d.pw * 0.15 + d.cur * 0.1 + d.run * 0.25 + d.crs * 0.15 - q.ov) * 0.35;
  at += M(['FW', 'MF'], (q, d, a) => d.spd * 0.65 + a.dr * 0.35 - q.ov) * 0.14;
  at += M(['FW'], (q, d) => d.str - q.ov) * 0.06;
  at += M(['GK'], (q, d) => d.dist - q.ov) * 0.08;
  df += M(['DF'], (q, d) => d.rd * 0.25 + d.pos * 0.25 + d.mrk * 0.2 + d.blk * 0.15 + d.hd * 0.15 - q.ov) * 0.4;
  df += M(['MF'], (q, d) => d.rd * 0.35 + d.pos * 0.35 + d.mrk * 0.3 - q.ov) * 0.14;
  df += M(['GK'], (q, d) => d.sv * 0.5 + d.cl * 0.3 + d.dist * 0.2 - q.ov) * 0.3;
  df += M(['DF', 'MF'], (q, d) => d.str * 0.65 + d.tol * 0.35 - q.ov) * 0.07;
  const sa = M(['FW', 'MF', 'DF', 'GK'], (q, d) => d.sta - q.ov) * 0.12;
  at += sa;
  df += sa;

  if (matchMin && matchMin > 60) {
    const pressLoad = 0.7 + ((t.press ?? 1) + (t.tempo ?? 1)) * 0.25;
    const minFactor = (matchMin - 60) / 30;
    const fatiguePenalty =
      DL.reduce((sum, [q, D]) => {
        if (subsEntered?.includes(q.n)) return sum;
        const resist = clamp((D.d.sta * 0.7 + (q.fit ?? 100) * 0.3) / 100, 0.35, 1.05);
        return sum + Math.max(0, 1.05 - resist) * 5.2 * pressLoad * minFactor;
      }, 0) / (DL.length || 1);
    at -= fatiguePenalty;
    df -= fatiguePenalty;
  }

  if (big || (matchMin && matchMin >= 70)) {
    const cmWeight = big ? 0.2 : 0.12;
    const cm = M(['FW', 'MF', 'DF', 'GK'], (q, d) => d.comp - q.ov) * cmWeight;
    at += cm;
    df += cm;
  }
  if (x.some((q) => DT(q, s?.p).tr === 0)) {
    at += 0.5;
    df += 0.5;
  }

  if (t.tac === 'A') { at += 4; df -= 4; }
  if (t.tac === 'D') { at -= 4; df += 4; }
  if (t.tac === 'X') { at += 7; df -= 7; }
  if (t.tac === 'Z') { at -= 7; df += 7; }

  const pr = (t.press ?? 1) - 1;
  at += pr * 2.5;
  df += pr * 1.5;
  const tm = (t.tempo ?? 1) - 1;
  at += tm * 2;
  df -= tm;
  const wd = (t.wid ?? 1) - 1;
  const ln = (t.line ?? 1) - 1;
  const pa = t.pass ?? 1;
  at += wd * 1.5 + ln * 1.5 + (pa === 0 ? (av('MF') - 60) / 10 : pa === 2 ? (av('FW') - 60) / 10 : pa === 3 ? 1 : 0);
  df += -wd - ln * 2.5 + (pa === 3 ? 1 : 0);

  const cp = t.cap && x.find((q) => q.n === t.cap);
  if (cp) {
    at += (cp.ov - 60) / 30;
    df += (cp.ov - 60) / 30;
  }
  const famBonus = (((t.tacFam ?? 65) - 50) / 50) * 2;
  at += famBonus;
  df += famBonus;

  if (s && t.id !== s.me) {
    const d = [-2.5, 0, 3][s.diff ?? 1];
    at += d;
    df += d;
  }
  if (s && s.mode === 'm' && t.id === s.me) {
    const mo = ((s.mor ?? 50) - 50) / 25 + (s.winBonus === 25 ? 1.5 : s.winBonus === 10 ? 0.8 : 0);
    at += mo;
    df += mo;
  }
  if (sentOffNames && sentOffNames.length) {
    at -= sentOffNames.length * 4.5;
    df -= sentOffNames.length * 4.5;
  }
  return { at, df, x };
}

const pois = (l: number) => {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

function genMatchGoals(t: Team, x: Player[], n: number, careerP?: PlayerCareerProfile | null): MatchEvent[] {
  if (!x.length) return [];
  return Array.from({ length: n }, () => {
    const W = (q: Player, b: number, f: number) => Array(Math.max(1, Math.round(b * Math.pow(f / 70, 2)))).fill(q);
    const w = x.flatMap((q) => {
      const D = DT(q, careerP);
      const b = q.pos === 'FW' ? 5 : q.pos === 'MF' ? 3 : q.pos === 'DF' ? 1 : 0;
      const sc = q.pos === 'DF'
        ? D.d.hd * 0.7 + D.d.str * 0.3
        : D.d.fin * 0.45 + D.d.pw * 0.2 + D.d.run * 0.15 + D.d.cur * 0.1 + D.d.spd * 0.1;
      return b ? W(q, b, sc) : [];
    });
    const q = w.length ? P(w) : P(x);
    const o = x
      .filter((z) => z !== q && z.pos !== 'GK')
      .flatMap((z) => {
        const D = DT(z, careerP);
        return W(z, z.pos === 'MF' ? 4 : z.pos === 'FW' ? 3 : 1, D.d.crs * 0.4 + D.a.ps * 0.35 + D.d.cur * 0.1 + D.a.dr * 0.1 + D.d.rd * 0.05);
      });
    return { m: R(1, 90), t: t.id, who: q.n, as: Math.random() < 0.75 && o.length ? P(o).n : '' };
  });
}

function simMatchCardsAndSubs(h: Team, a: Team, s?: GameState | null): {
  cards: MatchCardEvent[];
  subs: MatchSubEvent[];
  playedNames: Record<number, string[]>;
} {
  const cards: MatchCardEvent[] = [];
  const subs: MatchSubEvent[] = [];
  const playedNames: Record<number, string[]> = {};
  const big = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));

  [h, a].forEach((tm) => {
    const starters = xi(tm);
    const active = starters.map((q) => q.n);
    const bench = tm.sq.filter((q) => !active.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0).sort((x, y) => y.ov - x.ov);
    const subCount = Math.min(3, bench.length);
    const currentLineup = starters.slice();
    const played = new Set(active);

    // Simulate 1-3 substitutions between minutes 58-82
    for (let k = 0; k < subCount; k++) {
      if (Math.random() > 0.72) continue;
      const candidateOut = currentLineup
        .filter((q) => q.pos !== 'GK')
        .sort((x, y) => (x.fit ?? 100) - (y.fit ?? 100) || x.ov - y.ov)[0];
      if (!candidateOut) break;
      const candidateIn =
        bench.find((b) => !played.has(b.n) && b.pos === candidateOut.pos) ||
        bench.find((b) => !played.has(b.n) && b.pos !== 'GK');
      if (!candidateIn) break;
      const min = R(58, 83);
      const idx = currentLineup.indexOf(candidateOut);
      if (idx >= 0) currentLineup[idx] = candidateIn;
      played.add(candidateIn.n);
      subs.push({ m: min, t: tm.id, inPlayer: candidateIn.n, outPlayer: candidateOut.n });
    }
    playedNames[tm.id] = Array.from(played);

    // Simulate cards (0-3 yellows per team, ~3.5% direct or 2nd yellow red)
    const pool = currentLineup.filter((q) => q.pos !== 'GK');
    const cardRoll = (tm.press ?? 1) === 2 ? 0.65 : 0.48;
    const numYellows = (Math.random() < cardRoll ? 1 : 0) + (Math.random() < cardRoll * 0.55 ? 1 : 0) + (big && Math.random() < 0.3 ? 1 : 0);
    const matchY: Record<string, number> = {};
    for (let c = 0; c < numYellows && pool.length; c++) {
      const weighted = pool.flatMap((q) => {
        const D = DT(q, s?.p);
        const w = (D.tr === 1 ? 3 : 1) + (D.d.pos < 58 ? 1 : 0);
        return Array(w).fill(q);
      });
      const culprit = P(weighted);
      const min = R(12, 89);
      matchY[culprit.n] = (matchY[culprit.n] || 0) + 1;
      if (matchY[culprit.n] >= 2) {
        cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y2R' });
      } else {
        cards.push({ m: min, t: tm.id, who: culprit.n, type: 'Y' });
      }
    }
    if (pool.length && Math.random() < (big ? 0.045 : 0.025)) {
      const rough = pool.filter((q) => DT(q, s?.p).tr === 1);
      const culprit = rough.length ? P(rough) : P(pool);
      if (!cards.some((c) => c.t === tm.id && c.who === culprit.n && (c.type === 'R' || c.type === 'Y2R'))) {
        cards.push({ m: R(25, 86), t: tm.id, who: culprit.n, type: 'R' });
      }
    }
  });

  return { cards, subs, playedNames };
}

function simMatch(h: Team, a: Team, s?: GameState | null): MatchResult {
  const bg = !!(s && (s.pc || s.pa || (s.derby && (h.id === s.me || a.id === s.me))));
  const H = rate(h, s, bg);
  const G = rate(a, s, bg);
  if (h.pass === 3 && G.at > H.at) H.at += 3;
  if (a.pass === 3 && H.at > G.at) G.at += 3;
  const lamH = Math.min(5, 1.35 * Math.exp((H.at - G.df) / 20 + 0.1));
  const lamA = Math.min(5, 1.35 * Math.exp((G.at - H.df) / 20 - 0.05));
  const gh = pois(lamH);
  const ga = pois(lamA);
  const evs = [...genMatchGoals(h, H.x, gh, s?.p), ...genMatchGoals(a, G.x, ga, s?.p)].sort((x, y) => x.m - y.m);
  const xgH = Math.round((lamH * 0.85 + gh * 0.18 + R(-10, 15) / 100) * 100) / 100;
  const xgA = Math.round((lamA * 0.85 + ga * 0.18 + R(-10, 15) / 100) * 100) / 100;
  const { cards, subs, playedNames } = simMatchCardsAndSubs(h, a, s);
  return { gh, ga, evs, xgH: Math.max(0.1, xgH), xgA: Math.max(0.1, xgA), cards, subs, playedNames };
}

function computePlayerRatings(
  h: Team,
  a: Team,
  r: MatchResult,
  careerP?: PlayerCareerProfile | null,
  matchStats?: { savesH: number; savesA: number; blocksH: number; blocksA: number }
): { ratings: Record<string, number>; motm: string } {
  const ratings: Record<string, number> = {};
  let bestN = '';
  let bestR = 0;
  [
    [h, r.gh, r.ga, matchStats?.savesH || 0, matchStats?.blocksH || 0],
    [a, r.ga, r.gh, matchStats?.savesA || 0, matchStats?.blocksA || 0]
  ].forEach(([tm, gf, ga, saves, blocks]) => {
    const team = tm as Team;
    const starterSet = xi(team);
    const x = r.playedNames?.[team.id]?.length
      ? team.sq.filter((q) => r.playedNames![team.id].includes(q.n))
      : starterSet;
    const diff = (gf as number) - (ga as number);
    x.forEach((q) => {
      const D = DT(q, careerP);
      const gl = r.evs.filter((e) => e.t === team.id && e.who === q.n).length;
      const as = r.evs.filter((e) => e.t === team.id && e.as === q.n).length;
      const csBonus = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) === 0 ? 0.65 : 0;
      const concedePenalty = (q.pos === 'GK' || q.pos === 'DF') && (ga as number) >= 3 ? -0.35 : 0;
      const roleScore =
        q.pos === 'FW'
          ? (D.d.fin * 0.35 + D.d.run * 0.25 + D.d.pw * 0.15 + D.d.cur * 0.15 + D.d.spd * 0.1)
          : q.pos === 'MF'
            ? (D.a.ps * 0.3 + D.a.dr * 0.2 + D.d.crs * 0.2 + D.d.rd * 0.15 + D.d.sta * 0.15)
            : q.pos === 'DF'
              ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15)
              : (D.d.sv * 0.45 + D.d.cl * 0.3 + D.d.dist * 0.15 + D.d.comp * 0.1);
      const statEdge = (roleScore - 60) / 85 + (D.d.comp - 60) / 240;
      const defWorkBonus =
        q.pos === 'GK'
          ? Math.min(0.6, (saves as number) * 0.08)
          : q.pos === 'DF'
            ? Math.min(0.45, (blocks as number) * 0.07)
            : 0;
      const raw =
        6.2 +
        (diff > 0 ? 0.45 : diff < 0 ? -0.35 : 0) +
        gl * 1.1 +
        as * 0.7 +
        csBonus +
        concedePenalty +
        statEdge +
        defWorkBonus +
        ((q.ov - 55) / 90) +
        (Math.random() - 0.5) * 0.7;
      const rt = clamp(Math.round(raw * 10) / 10, 4.8, 10.0);
      ratings[q.n] = rt;
      if (rt > bestR) {
        bestR = rt;
        bestN = q.n;
      }
    });
  });
  return { ratings, motm: bestN };
}

function applyMatchResult(h: Team, gh: number, a: Team, ga: number) {
  h.fm = (h.fm || '') + (gh > ga ? 'W' : gh < ga ? 'L' : 'D');
  a.fm = (a.fm || '') + (gh < ga ? 'W' : gh > ga ? 'L' : 'D');
  h.p++;
  a.p++;
  h.gf += gh;
  h.ga += ga;
  a.gf += ga;
  a.ga += gh;
  if (gh > ga) {
    h.w++;
    h.pts += 3;
    a.l++;
  } else if (gh < ga) {
    a.w++;
    a.pts += 3;
    h.l++;
  } else {
    h.d++;
    a.d++;
    h.pts++;
    a.pts++;
  }
}

const sortTable = (a: Team[]) =>
  [...a].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);

function roundRobin(ids: number[]): [number, number][][] {
  const arr = [...ids].sort(() => Math.random() - 0.5);
  const n = arr.length;
  const o: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const m: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      m.push(r % 2 ? [b, a] : [a, b]);
    }
    o.push(m);
    arr.splice(1, 0, arr.pop()!);
  }
  return o;
}

const doubleRoundRobin = (ids: number[]) => {
  const a = roundRobin(ids);
  return [...a, ...a.map((r) => r.map(([h, x]) => [x, h] as [number, number]))];
};

const ovMe = (p: PlayerCareerProfile) => OVF(p.pos, p.a);

function autoGrow(p: PlayerCareerProfile, n = 1): string {
  const map: Record<Position, StatKey[]> = {
    FW: ['sh', 'sh', 'sh', 'dr', 'dr', 'ps', 'ph'],
    MF: ['ps', 'ps', 'ps', 'dr', 'dr', 'sh', 'tk', 'ph'],
    DF: ['tk', 'tk', 'tk', 'ph', 'ph', 'ps', 'dr'],
    GK: ['ph', 'ph', 'ph', 'tk', 'tk', 'ps']
  };
  const w = (map[p.pos] || ['sh', 'ps', 'dr']).slice();
  if (p.tr) w.push(p.tr, p.tr);
  const add: Partial<Record<StatKey, number>> = {};
  for (let i = 0; i < n; i++) {
    const av = w.filter((k) => p.a[k] < 99);
    const k = av.length ? P(av) : ATT.map((z) => z[0]).find((z) => p.a[z] < 99);
    if (!k) break;
    p.a[k]++;
    p.trn = (p.trn || 0) + 1;
    add[k] = (add[k] || 0) + 1;
  }
  return Object.entries(add)
    .map(([k, v]) => `${ATT.find((z) => z[0] === k)?.[1] || k} +${v}`)
    .join(', ');
}

function syncMe(s: GameState) {
  if (s.mode !== 'p' || !s.p) return;
  if (s.p.pts > 0) {
    autoGrow(s.p, s.p.pts);
    s.p.pts = 0;
  }
  const q = s.teams[s.me]?.sq.find((x) => x.me);
  if (q) {
    q.ov = ovMe(s.p);
    q.fit = s.p.en ?? 100;
    q.sp = s.p.ap ?? q.sp ?? 0;
    q.sg = s.p.gl ?? q.sg ?? 0;
    q.sa = s.p.as ?? q.sa ?? 0;
    q.yc = s.p.yc ?? q.yc ?? 0;
    q.rc = s.p.rc ?? q.rc ?? 0;
    q.sus = s.p.sus ?? q.sus ?? 0;
    if (s.p.no) q.no = s.p.no;
    else if (q.no) s.p.no = q.no;
    q.vis = visOf(q, s.p);
    if (!q.pot || q.pot < q.ov) q.pot = clamp(92, q.ov + 12, 95);
    if (q.age && (!s.p.age || s.p.age < q.age)) s.p.age = q.age;
    else if (s.p.age) q.age = s.p.age;
  }
}

const vlu = (q: Player) => Math.round((q.ov * q.ov) / 40);
const wagOf = (q: Player) => +((q.ov * q.ov) / 3000).toFixed(1);

function ensureCon(q: Player) {
  if (!q.con) {
    q.con = {
      yr: q.loan ? 1 : 1 + ((q.ov + (q.age || 24)) % 3),
      wg: wagOf(q),
      role: q.ov >= 72 ? 'key' : (q.age || 24) <= 20 ? 'pro' : 'rot'
    };
  } else if (!q.con.wg) {
    q.con.wg = wagOf(q);
  }
  return q.con;
}

const squadWage = (t: Team) =>
  Math.round(
    t.sq.reduce((sum, q) => {
      const c = ensureCon(q);
      return sum + (c.wg || wagOf(q)) * (c.yr <= 0 ? 1.25 : 1);
    }, 0)
  );

function logFin(s: GameState, t: string, amt: number) {
  if (!amt) return;
  s.finLog = s.finLog || [];
  s.finLog.unshift({ t, amt: Math.round(amt), m: s.md + 1, s: s.season });
  if (s.finLog.length > 40) s.finLog.length = 40;
}

function pushFeed(s: GameState, cat: string, txt: string, tone: '' | 'urg' | 'offer' | 'ok' = '') {
  if (!txt) return;
  s.feed = s.feed || [];
  if (s.feed[0] && s.feed[0].txt === txt) return;
  s.feed.unshift({ cat, txt, tone, s: s.season, m: s.md + 1 });
  if (s.feed.length > 8) s.feed.length = 8;
}

function getTransferWindowInfo(s: Pick<GameState, 'md' | 'fx'>) {
  const total = s.fx?.length || 30;
  const md = s.md || 0;
  if (md >= total) {
    return {
      open: false,
      phase: 'closed2' as const,
      label: '🔒 จบฤดูกาล (รอรอบตลาดใหม่)',
      shortLabel: '🔒 จบฤดูกาล',
      subLabel: 'สรุปจบฤดูกาลเพื่อเข้าสู่ตลาดเปิดรอบต้นฤดูกาลหน้า (นัด 1–6)',
      remaining: 0,
      rangeText: 'หลังจบฤดูกาล'
    };
  }
  if (md < 6) {
    const rem = 6 - md;
    return {
      open: true,
      phase: 'open1' as const,
      label: '🟢 เปิดตลาดรอบแรก (ต้นฤดูกาล)',
      shortLabel: `🟢 ตลาดเปิด (${rem} นัด)`,
      subLabel: `ช่วงนัดที่ 1–6 · เหลืออีก ${rem} นัดก่อนปิดตลาดรอบแรก`,
      remaining: rem,
      rangeText: 'นัด 1–6'
    };
  }
  if (md < 14) {
    const wait = 14 - md;
    return {
      open: false,
      phase: 'closed1' as const,
      label: '🔒 ตลาดซื้อขายปิดชั่วคราว',
      shortLabel: `🔒 เปิดนัด 15 (อีก ${wait} นัด)`,
      subLabel: `ตลาดเลกสองจะเปิดช่วงนัดที่ 15–20 (อีก ${wait} นัด)`,
      remaining: wait,
      rangeText: 'นัด 15–20'
    };
  }
  if (md < 20) {
    const rem = 20 - md;
    return {
      open: true,
      phase: 'open2' as const,
      label: '🟢 เปิดตลาดรอบสอง (เลกสอง)',
      shortLabel: `🟢 ตลาดเปิด (${rem} นัด)`,
      subLabel: `ช่วงนัดที่ 15–20 · เหลืออีก ${rem} นัดก่อนปิดตลาดฤดูกาลนี้`,
      remaining: rem,
      rangeText: 'นัด 15–20'
    };
  }
  const toEnd = Math.max(0, total - md);
  return {
    open: false,
    phase: 'closed2' as const,
    label: '🔒 ตลาดซื้อขายปิดแล้วจนจบฤดูกาล',
    shortLabel: '🔒 ตลาดปิด (รอซีซั่นหน้า)',
    subLabel: `เปิดตลาดอีกครั้งต้นฤดูกาลหน้า (เหลืออีก ${toEnd} นัดจบฤดูกาล)`,
    remaining: toEnd,
    rangeText: 'ฤดูกาลหน้า'
  };
}

const LEAGUE_TRANSFER_RULES = {
  minSquad: 18,
  maxSquad: 28,
  maxLoans: 4,
  minPos: { GK: 2, DF: 4, MF: 4, FW: 2 } as Record<Position, number>
};

function getStaffState(s: Pick<GameState, 'staff'>) {
  return {
    asst: s.staff?.asst ?? 0,
    fit: s.staff?.fit ?? 0,
    scout: s.staff?.scout ?? 0,
    physio: s.staff?.physio ?? 0
  };
}

function getStaffWage(s: Pick<GameState, 'staff'>) {
  const st = getStaffState(s);
  return (st.asst + st.fit + st.scout + st.physio) * 1.5;
}

function getLeagueTransferContext(s: GameState, me: Team) {
  const tw = getTransferWindowInfo(s);
  const loansCount = me.sq.filter((q) => !!q.loan).length;
  const curWage = squadWage(me);
  const baseCap = [26, 44, 70, 95][me.tier] ?? 44;
  const infraMult = 1 + ((s.st ?? 1) - 1) * 0.1 + ((s.merchLv ?? 1) - 1) * 0.05;
  const wageCap = Math.round(baseCap * infraMult);
  const wagePct = Math.round((curWage / Math.max(1, wageCap)) * 100);
  const posCounts: Record<Position, number> = {
    GK: me.sq.filter((q) => q.pos === 'GK').length,
    DF: me.sq.filter((q) => q.pos === 'DF').length,
    MF: me.sq.filter((q) => q.pos === 'MF').length,
    FW: me.sq.filter((q) => q.pos === 'FW').length
  };
  return {
    tw,
    loansCount,
    maxLoans: LEAGUE_TRANSFER_RULES.maxLoans,
    minSquad: LEAGUE_TRANSFER_RULES.minSquad,
    maxSquad: LEAGUE_TRANSFER_RULES.maxSquad,
    minPos: LEAGUE_TRANSFER_RULES.minPos,
    posCounts,
    curWage,
    wageCap,
    wagePct,
    ffpLocked: s.money < 0
  };
}

function calcMatchdayFinanceEstimate(s: GameState, me: Team) {
  const stLv = s.st ?? 1;
  const merchLv = s.merchLv ?? 1;
  const cap = [3500, 8000, 15000, 26000, 42000][stLv - 1] || 3500;
  const tpIdx = s.tp ?? 1;
  const spIdx = s.sp ?? 0;
  const fanVal = s.fan ?? 55;
  const attRate = clamp((0.36 + (fanVal / 100) * 0.56) * [1.15, 1.0, 0.8][tpIdx] * (s.promo === 1 ? 1.15 : 1), 0.2, 0.98);
  const estAtt = Math.round(cap * attRate);
  const ticketPriceMult = [0.82, 1.0, 1.24][tpIdx];
  const estTicket = Math.round((8 + stLv * 7) * (fanVal / 60) * ticketPriceMult * (s.promo === 1 ? 1.35 : 1));
  const estMerch = Math.round((2 + merchLv * 3) * (fanVal / 55));
  const baseSponsor = spIdx === 0 ? 8 + me.tier * 6 : spIdx === 1 ? 4 + me.tier * 4 : 5 + me.tier * 5;
  const estSponsor = Math.round(baseSponsor * (s.promo === 2 ? 1.35 : 1));
  const dealIncome = s.sponsorDeal ? s.sponsorDeal.perMatch : 0;
  const wageCost = squadWage(me);
  const staffCost = Math.round(getStaffWage(s));
  const loanCost = s.bankLoan ? s.bankLoan.per : 0;
  const totalOut = wageCost + staffCost + loanCost;
  const homeIn = estTicket + estMerch + estSponsor + dealIncome;
  const awayIn = estSponsor + dealIncome;
  return {
    cap,
    estAtt,
    attPct: Math.round(attRate * 100),
    estTicket,
    estMerch,
    estSponsor,
    dealIncome,
    wageCost,
    staffCost,
    loanCost,
    totalOut,
    homeIn,
    awayIn,
    homeNet: homeIn - totalOut,
    awayNet: awayIn - totalOut
  };
}

function mkMarket(s: GameState) {
  const b0 = BASE[s.teams[s.me].tier];
  const rolePool: Player[] = ALL_SUB_ROLES.map((role, i) => {
    const pos = LINE[role] || 'MF';
    const yo = role !== 'GK' && i % 5 === 3;
    const p = mkPlayer(pos, b0 + R(-1, 12), yo, role);
    p.price = Math.round((p.ov * p.ov) / 40);
    if (i === 0 || (i % 6 === 2 && Math.random() < 0.45)) {
      p.free = 1;
      p.price = 0;
    }
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.tries = 0;
    p.locked = 0;
    return p;
  });

  // Guarantee free agents across all 4 core lines so every position is signable even when transfer window closes
  const extraFreeAgents: Player[] = POS.map((pos) => {
    const p = mkPlayer(pos, b0 + R(-2, 9), false, P(SPX[pos]));
    p.free = 1;
    p.price = 0;
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.tries = 0;
    p.locked = 0;
    return p;
  });

  const posRank: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
  s.mk = [...rolePool, ...extraFreeAgents].sort(
    (a, b) => posRank[a.pos] - posRank[b.pos] || b.ov - a.ov
  );
}

function teamStats(t: Team, s?: GameState | null) {
  const x = xi(t);
  const r = rate(t, s);
  const avg = (a: Player[]) => (a.length ? a.reduce((sum, q) => sum + q.ov, 0) / a.length : 0);
  const ovSq = Math.round(avg(t.sq));
  const ovXi = Math.round(avg(x));
  const pos = (p: Position) => {
    const l = x.filter((q) => q.pos === p);
    const src = l.length ? l : t.sq.filter((q) => q.pos === p);
    return Math.round(avg(src));
  };
  const age = Math.round((t.sq.reduce((sum, q) => sum + (q.age || 24), 0) / (t.sq.length || 1)) * 10) / 10;
  return { ovSq, ovXi, at: Math.round(r.at), df: Math.round(r.df), gk: pos('GK'), d: pos('DF'), m: pos('MF'), f: pos('FW'), age };
}

const colRgb = (c: string): [number, number, number] => {
  const s = (c || '').trim();
  if (s[0] === '#') {
    const hex = s.length === 4 ? s.slice(1).replace(/./g, (x) => x + x) : s.slice(1);
    return [parseInt(hex.slice(0, 2), 16) || 0, parseInt(hex.slice(2, 4), 16) || 0, parseInt(hex.slice(4, 6), 16) || 0];
  }
  return [128, 128, 128];
};

const colDist = (a: string, b: string) => {
  const [r1, g1, b1] = colRgb(a);
  const [r2, g2, b2] = colRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
};

const awayOf = (c1: string) => {
  const pool = ['#ffffff', '#f4c63d', '#111827', '#2f6fd6', '#c0392b', '#38bdf8', '#7c3aed', '#e67e22'];
  return pool.slice().sort((x, y) => colDist(c1, y) - colDist(c1, x))[0];
};

function teamKits(t: Team, s?: GameState | null): [string, string] {
  if (s?.mode === 'm' && s.club && t.id === s.me) {
    return [s.club.c1, colDist(s.club.c1, s.club.c2) >= 150 ? s.club.c2 : awayOf(s.club.c1)];
  }
  if (t.kc && t.kc.length >= 2 && colDist(t.kc[0], t.kc[1]) >= 180) return t.kc;
  const kp = KIT_P[t.id % KIT_P.length];
  return [kp[0], kp[1]];
}

const tc = (t: Team, s?: GameState | null, aw = false) => teamKits(t, s)[aw ? 1 : 0];

function matchKits(h: Team, a: Team, s?: GameState | null): [string, string, string, string] {
  const hk = tc(h, s, false);
  const ht = tc(h, s, true);
  const a2 = tc(a, s, true);
  const a1 = tc(a, s, false);
  let ak = a2;
  let at = a1;
  if (colDist(hk, ak) < 190) {
    ak = colDist(hk, a1) >= 190 ? a1 : awayOf(hk);
    at = colDist(ak, a1) >= 160 ? a1 : hk;
  }
  return [hk, ak, ht, at];
}

function pickGK(c1: string, c2 = '', c3 = '') {
  const pool = ['#0d9488', '#f4c63d', '#7dd3fc', '#f472b6', '#fb923c', '#a3e635', '#6d28d9'];
  return pool
    .slice()
    .sort((a, b) => {
      const sa = Math.min(colDist(a, c1), c2 ? colDist(a, c2) : 999, c3 ? colDist(a, c3) : 999);
      const sb = Math.min(colDist(b, c1), c2 ? colDist(b, c2) : 999, c3 ? colDist(b, c3) : 999);
      return sb - sa;
    })[0];
}

function ensureClubIdentity(s: GameState): ClubIdentity {
  if (!s.club) {
    const t = s.teams[s.me];
    s.club = {
      name: t.name,
      nick: '',
      std: 'สนาม' + t.name,
      c1: t.kc?.[0] || '#c0392b',
      c2: t.kc?.[1] || '#f4c63d',
      shape: 0,
      pat: 0,
      icon: '',
      kit: 0
    };
  }
  return s.club;
}

function setBoardObjective(s: GameState) {
  const t = s.teams[s.me];
  const ts = s.teams
    .filter((x) => x.tier === t.tier)
    .map((x) => {
      const r = rate(x, s);
      return [x.id, r.at + r.df] as const;
    })
    .sort((a, b) => b[1] - a[1]);
  const rank = ts.findIndex((a) => a[0] === s.me) + 1;
  s.obj = clamp(Math.ceil(rank * 0.8), 1, ts.length - 1);
  s.bd = s.bd ?? 55;
}

function ensureAsia(s: GameState) {
  if (s.asia) return;
  s.asia = AN.map((n) => {
    const t = mkTeam(n, 2, s.teams.length, R(0, 8));
    t.tier = 3;
    t.foreign = 1;
    s.teams.push(t);
    return t.id;
  });
}

function initAsia(s: GameState) {
  ensureAsia(s);
  const th = (s.aq || []).filter((i) => s.teams[i] && s.teams[i].tier < 3).slice(0, 3);
  if (th.length < 3) {
    const rs = s.teams
      .filter((t) => t.tier === 2 && !th.includes(t.id))
      .map((t) => {
        const r = rate(t, s);
        return [t.id, r.at + r.df] as const;
      })
      .sort((a, b) => b[1] - a[1]);
    while (th.length < 3 && rs.length) th.push(rs.shift()![0]);
  }
  const fo = s.asia!.slice().sort(() => Math.random() - 0.5).slice(0, 13);
  const ids = [...th, ...fo].sort(() => Math.random() - 0.5);
  s.ac = { r: 0, p: ids.slice(), ids, alive: ids.includes(s.me), done: false, log: [] };
  s.pa = false;
}

function createNewGame(
  mode: GameMode,
  opts: {
    names?: string[][];
    t0?: Team[];
    pick?: number;
    player?: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>;
  }
): GameState {
  clearNamePool();
  const teams: Team[] = [];
  let id = 0;
  const pv = mode === 'm' && opts.names && opts.t0;
  (pv ? opts.names! : genClubNames()).forEach((arr, ti) => {
    arr.forEach((n) => {
      teams.push(pv && ti === 0 ? opts.t0![id] : mkTeam(n, ti, id));
      id++;
    });
  });

  const meId = pv && opts.pick != null && opts.pick >= 0 && opts.pick < 16 ? opts.pick : R(0, 15);
  const s: GameState = {
    ver: 2,
    mode,
    season: 1,
    md: 0,
    teams,
    me: meId,
    money: 450,
    v: 't',
    hist: [],
    mk: [],
    st: 1,
    tr: 1,
    ya: 1,
    tf: 'MF',
    yth: [],
    fx: [],
    pc: false,
    cup: { alive: true, r: 0, done: false, log: [], ids: [] },
    mgrRep: 50,
    trophies: [],
    records: {},
    fan: 55,
    mor: 55,
    bd: 55
  };

  if (mode === 'm') {
    ensureClubIdentity(s);
    setBoardObjective(s);
  } else if (opts.player) {
    const p = opts.player;
    const chosenNo = clamp(p.no || (p.pos === 'GK' ? 1 : p.pos === 'DF' ? 4 : p.pos === 'MF' ? 8 : 10), 1, 99);
    s.p = {
      ...p,
      no: chosenNo,
      b: { ...p.a },
      sb: p.sb ? { ...p.sb } : {},
      age: 17,
      pts: p.pts || 0,
      gl: 0,
      as: 0,
      ap: 0,
      rs: 0,
      en: 100,
      plan: 1,
      rep: 10,
      ntCaps: 0,
      ntGoals: 0,
      perks: [],
      careerLog: []
    };
    const t = teams[meId];
    const i = t.sq.findIndex((q) => q.pos === p.pos);
    const ov = ovMe(s.p);
    const ki = SKIN_P.indexOf(p.k);
    const hi = HAIR_P.indexOf(p.h);
    t.sq.splice(i >= 0 ? i : 0, 1, {
      n: p.name,
      pos: p.pos,
      ro: p.sp,
      sp: 0,
      ov,
      age: 17,
      pot: clamp(R(87, 95), ov + 18, 95),
      fit: 100,
      inj: 0,
      no: chosenNo,
      me: 1,
      vis: [ki >= 0 ? ki : 2, hi >= 0 ? hi : 0, p.hs ?? 0, p.fh ?? 0, p.ey ?? 0, chosenNo, p.fs ?? 0]
    });
    assignTeamShirtNumbers(t);
  }

  startSeason(s);
  return s;
}

function startSeason(s: GameState) {
  s.teams.forEach((t) => {
    t.sq = t.sq.filter((q) => !q.loan);
    Object.assign(t, { pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, p: 0, fm: '' });
    t.sq.forEach((q) => {
      q.fit = 100;
      q.inj = 0;
      q.sus = 0;
      q.yc = 0;
      q.rc = 0;
      q.sg = 0;
      q.sa = 0;
      q.sp = 0;
      q.cs = 0;
    });
    assignTeamShirtNumbers(t);
  });

  if (s.p) {
    s.p.en = 100;
    s.p.gd = 0;
    s.p.yc = 0;
    s.p.rc = 0;
    s.p.sus = 0;
    s.p.s0 = { gl: s.p.gl, as: s.p.as, ap: s.p.ap };
  }

  const mt = s.teams[s.me].tier;
  s.fx = doubleRoundRobin(s.teams.filter((t) => t.tier === mt).map((t) => t.id));
  s.fxo = {};
  [0, 1, 2]
    .filter((i) => i !== mt)
    .forEach((i) => {
      s.fxo![i] = doubleRoundRobin(s.teams.filter((t) => t.tier === i).map((t) => t.id));
    });
  s.md = 0;
  s.pc = false;
  s.cup = {
    alive: true,
    r: 0,
    done: false,
    log: [],
    ids: [
      s.me,
      ...s.teams
        .filter((t) => t.id !== s.me && t.tier < 3)
        .map((t) => t.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 15)
    ].sort(() => Math.random() - 0.5)
  };
  initAsia(s);
  mkMarket(s);
  s.schedRes = {};
  s.cupLog = [];
  if (s.mode === 'm') setBoardObjective(s);
}

function sTeamSafe(h: Team, a: Team, id: number): Team | null {
  if (h.id === id) return h;
  if (a.id === id) return a;
  return null;
}

function tallyMatchPlayers(h: Team, a: Team, r: MatchResult) {
  [
    [h, r.ga],
    [a, r.gh]
  ].forEach(([tm, ga]) => {
    const team = tm as Team;
    const starterSet = xi(team);
    const playedList = r.playedNames?.[team.id]?.length
      ? team.sq.filter((q) => r.playedNames![team.id].includes(q.n))
      : starterSet;
    playedList.forEach((q) => {
      q.sp = (q.sp || 0) + 1;
      if (q.pos === 'GK' && (ga as number) === 0 && starterSet.includes(q)) q.cs = (q.cs || 0) + 1;
    });
  });
  r.evs.forEach((e) => {
    const t = sTeamSafe(h, a, e.t);
    if (!t) return;
    const q = t.sq.find((z) => z.n === e.who);
    if (q) q.sg = (q.sg || 0) + 1;
    const w = e.as && t.sq.find((z) => z.n === e.as);
    if (w) w.sa = (w.sa || 0) + 1;
  });
}

function applyMatchCards(s: GameState, h: Team, a: Team, cards?: MatchCardEvent[]) {
  if (!cards || !cards.length) return;
  cards.forEach((c) => {
    const tm = sTeamSafe(h, a, c.t);
    if (!tm) return;
    const q = tm.sq.find((z) => z.n === c.who);
    if (!q) return;
    const isMyTeam = tm.id === s.me;
    if (c.type === 'R') {
      q.rc = (q.rc || 0) + 1;
      q.sus = (q.sus || 0) + 2;
      if (isMyTeam) {
        pushFeed(s, 'โดนแบน', `🟥 ${q.n} โดนใบแดงโดยตรง! ติดโทษแบน 2 นัด`, 'urg');
      }
    } else if (c.type === 'Y2R') {
      q.rc = (q.rc || 0) + 1;
      q.sus = (q.sus || 0) + 1;
      if (isMyTeam) {
        pushFeed(s, 'โดนแบน', `🟨🟨➡🟥 ${q.n} โดนใบเหลือง-แดง! ติดโทษแบน 1 นัด`, 'urg');
      }
    } else {
      q.yc = (q.yc || 0) + 1;
      if (q.yc >= 3) {
        q.yc -= 3;
        q.sus = (q.sus || 0) + 1;
        if (isMyTeam) {
          pushFeed(s, 'โดนแบน', `🟨 ${q.n} สะสมครบ 3 ใบเหลือง! ติดโทษแบนนัดหน้า 1 นัด`, 'urg');
        }
      }
    }
    if (q.me && s.p) {
      s.p.yc = q.yc || 0;
      s.p.rc = q.rc || 0;
      s.p.sus = q.sus || 0;
    }
  });
}

function calcPlayerPerf(
  s: GameState,
  r: MatchResult,
  H: Team,
  _A: Team,
  matchRatings?: Record<string, number>,
  meta?: { played: boolean; mins: number; subIn: boolean; subOut: boolean; yc: number; rc: number }
): PlayerPerfResult {
  const p = s.p!;
  const home = H.id === s.me;
  const my = home ? r.gh : r.ga;
  const op = home ? r.ga : r.gh;
  const played = meta ? meta.played : true;
  const mins = meta ? meta.mins : 90;
  const gl = r.evs.filter((e) => e.t === s.me && e.who === p.name).length;
  const as = r.evs.filter((e) => e.t === s.me && e.as === p.name).length;
  const en = p.en ?? 100;
  const vid = p.vid || 0;

  if (!played || mins <= 0) {
    return {
      rt: 0,
      gl: 0,
      as: 0,
      my,
      op,
      vid: 0,
      en,
      pts: 0,
      played: false,
      mins: 0,
      subIn: false,
      subOut: false,
      yc: 0,
      rc: 0
    };
  }

  const bk = p.pos === 'GK' || p.pos === 'DF';
  const perks = p.perks || [];
  const bigBonus = perks.includes('clutch') && (s.pc || s.pa || s.derby) ? 0.5 : 0;
  const fanBonus = perks.includes('captain') ? ((s.fan ?? 50) - 50) / 140 : ((s.fan ?? 50) - 50) / 250;
  const mePlayer: Player = s.teams[s.me]?.sq.find((q) => q.me) || {
    n: p.name, pos: p.pos, ro: p.sp, ov: ovMe(p), age: p.age, pot: 95, fit: en, inj: 0, me: 1
  };
  const D = DT(mePlayer, p);
  const subEdge =
    p.pos === 'FW'
      ? (D.d.fin * 0.35 + D.d.run * 0.25 + D.d.pw * 0.15 + D.d.cur * 0.15 + D.d.spd * 0.1 - 60) / 90
      : p.pos === 'MF'
        ? (D.a.ps * 0.3 + D.a.dr * 0.2 + D.d.crs * 0.2 + D.d.rd * 0.15 + D.d.sta * 0.15 - 60) / 90
        : p.pos === 'DF'
          ? (D.d.rd * 0.25 + D.d.pos * 0.25 + D.d.mrk * 0.2 + D.d.blk * 0.15 + D.d.hd * 0.15 - 60) / 90
          : (D.d.sv * 0.45 + D.d.cl * 0.3 + D.d.dist * 0.15 + D.d.comp * 0.1 - 60) / 90;

  const baseRt =
    matchRatings?.[p.name] != null
      ? matchRatings[p.name]
      : 6.2 +
        (my > op ? 0.5 : my < op ? -0.4 : 0) +
        gl * 0.9 +
        as * 0.6 +
        (bk ? (op === 0 ? 0.6 : op >= 3 ? -0.5 : 0) : 0) +
        clamp((ovMe(p) - 60) / 70, -0.4, 0.5) +
        subEdge +
        (Math.random() - 0.5) * 0.8;

  const minAdj = mins < 35 ? -0.2 : 0;
  const cardPenalty = (meta?.yc || 0) * 0.25 + (meta?.rc || 0) * 1.4;
  let rt =
    baseRt +
    (en - 70) / 140 +
    (D.d.tol - 65) / 350 +
    vid +
    bigBonus +
    fanBonus +
    minAdj -
    cardPenalty;

  rt = clamp(Math.round(rt * 10) / 10, 3.8, 10);
  const b = () => (Math.random() < (mins >= 60 ? 0.42 : 0.28) ? 1 : 0);
  return {
    rt,
    gl,
    as,
    my,
    op,
    vid,
    en,
    pts: b() + (rt >= 7 ? b() : 0) + (rt >= 8.5 ? b() : 0),
    played: true,
    mins,
    subIn: meta?.subIn,
    subOut: meta?.subOut,
    yc: meta?.yc || 0,
    rc: meta?.rc || 0
  };
}

function creditPlayerPerf(s: GameState, f: PlayerPerfResult) {
  const p = s.p!;
  if (f.played === false) {
    p.vid = 0;
    p.sat = 1;
    syncMe(s);
    return;
  }
  p.sat = 0;
  p.ap++;
  p.fm = [...(p.fm || []), f.rt].slice(-5);
  p.rs += f.rt;
  p.gl += f.gl;
  p.as += f.as;
  p.rep = (p.rep || 0) + (f.rt >= 7.5 ? 3 : f.rt >= 6.8 ? 1 : 0) + f.gl * 2 + f.as;
  if (f.pts > 0) f.grew = autoGrow(p, f.pts);
  p.vid = 0;
  const fanGain = (p.perks || []).includes('captain') ? 3 : 2;
  s.fan = clamp((s.fan ?? 50) + (f.my > f.op ? fanGain : f.my < f.op ? -2 : 0) + (f.gl ? 1 : 0), 5, 100);
  syncMe(s);
}

function runPlayerWeek(s: GameState) {
  const p = s.p!;
  const ac = PACT[p.plan ?? 1] || PACT[1];
  const perks = p.perks || [];
  const mePlayer: Player = s.teams[s.me]?.sq.find((q) => q.me) || {
    n: p.name, pos: p.pos, ro: p.sp, ov: ovMe(p), age: p.age, pot: 95, fit: p.en ?? 100, inj: 0, me: 1
  };
  const D = DT(mePlayer, p);
  const staBonus = Math.round((D.d.sta - 65) / 7);
  const recBonus = Math.round((D.d.rec - 65) / 8);
  const tolBonus = Math.round((D.d.tol - 65) / 14);
  const baseFatigue = p.sat ? -8 : perks.includes('engine') ? -16 : -22;
  const fatigueCost = Math.min(-4, baseFatigue + staBonus + tolBonus);
  p.en = clamp((p.en ?? 100) + fatigueCost + ac.en + recBonus + R(0, 7), 20, 100);
  let m = `${ac.i} ${ac.n}`;
  const focus = ({ FW: 'sh', MF: 'ps', DF: 'tk', GK: 'ph' } as Record<Position, StatKey>)[p.pos] || 'sh';
  const prodigyBonus = perks.includes('prodigy') ? 0.1 : 0;

  if (ac.gr) {
    const k = ac.k || P([focus, focus, p.tr || 'sh', P(['sh', 'ps', 'dr', 'tk', 'ph'] as StatKey[])]);
    const kn = ATT.find((z) => z[0] === k)?.[1] || k;
    if (p.a[k] < 99 && Math.random() < ac.gr + prodigyBonus + (p.tr === k || (p.tr === 'tk' && k === 'ph') ? 0.06 : 0)) {
      p.a[k]++;
      p.trn = (p.trn || 0) + 1;
      m += ` · ${kn} เพิ่มเป็น ${p.a[k]}`;
    } else {
      m += ' · ยังไม่ก้าวหน้าในรอบนี้';
    }
  }
  if (ac.vid) {
    p.vid = ac.vid;
    m += ' · นัดหน้าได้เปรียบ';
  }
  if (ac.fan) {
    s.fan = clamp((s.fan ?? 50) + ac.fan, 5, 100);
    m += ` · ขวัญแฟนบอล ${s.fan}%`;
  }
  if (ac.pt && Math.random() < ac.pt + prodigyBonus) {
    const g = autoGrow(p, 1);
    if (g) m += ` · พัฒนาอัตโนมัติ (${g})`;
  }
  p.last = m;
  s.news = (s.news ? s.news + ' · ' : '') + m;
  syncMe(s);
}

function createScoutMission(focus: ScoutMission['focus'], targetRole?: SubRole | ''): ScoutMission {
  const labels: Record<ScoutMission['focus'], string> = {
    wonderkid: 'ส่องดาวรุ่งพรสวรรค์สูง (U20)',
    free: 'ค้นหานักเตะฟรีเอเยนต์ฝีเท้าดี',
    gk: 'เฟ้นหาผู้รักษาประตู (GK)',
    striker: 'เฟ้นหากองหน้าตัวจบสกอร์',
    midfielder: 'เฟ้นหากองกลางจอมคุมเกม',
    defender: 'เฟ้นหากองหลังครบทุกตำแหน่ง'
  };
  const roleLabel = targetRole ? `ส่องตำแหน่ง ${targetRole} (${SPN[targetRole] || targetRole})` : labels[focus];
  return {
    id: `${focus}_${targetRole || 'any'}_${Date.now()}`,
    focus,
    targetRole: targetRole || '',
    label: roleLabel,
    turnsLeft: 2
  };
}

function resolveScoutResults(s: GameState, m: ScoutMission): Player[] {
  const scoutStaff = getStaffState(s).scout;
  const b0 = BASE[s.teams[s.me].tier] + (s.ya ?? 1) * 2 + scoutStaff * 2;
  return Array.from({ length: 3 }, (_, idx) => {
    let pos: Position = P(POS);
    let forceRo: SubRole | undefined;
    let yo = false;
    let boost = R(2, 9);

    if (m.targetRole) {
      forceRo = m.targetRole;
      pos = LINE[m.targetRole] || 'MF';
    } else if (m.focus === 'wonderkid') {
      yo = true;
      boost = R(4, 10 + scoutStaff);
      forceRo = P(ALL_SUB_ROLES.filter((r) => r !== 'GK'));
      pos = LINE[forceRo] || 'MF';
    } else if (m.focus === 'gk') {
      pos = 'GK';
      forceRo = 'GK';
    } else if (m.focus === 'striker') {
      pos = 'FW';
      forceRo = SPX.FW[(idx + R(0, 4)) % SPX.FW.length];
    } else if (m.focus === 'midfielder') {
      pos = 'MF';
      forceRo = SPX.MF[(idx + R(0, 4)) % SPX.MF.length];
    } else if (m.focus === 'defender') {
      pos = 'DF';
      forceRo = SPX.DF[(idx + R(0, 4)) % SPX.DF.length];
    }

    const p = mkPlayer(pos, b0 + boost, yo, forceRo);
    if (m.focus === 'wonderkid') p.pot = clamp(Math.max(p.pot, p.ov + R(12, 24)), p.ov, 96);
    if (m.focus === 'free') {
      p.free = 1;
      p.price = 0;
    } else {
      p.price = Math.round((p.ov * p.ov) / 40);
    }
    p.askWg = +((p.ov * p.ov) / 3000).toFixed(1);
    p.scouted = true;
    p.tries = 0;
    p.locked = 0;
    return p;
  });
}

interface DilemmaTemplate {
  id: string;
  mode: GameMode | 'both';
  category: string;
  title: string;
  desc: (s: GameState) => string;
  options: {
    label: string;
    hint: string;
    apply: (s: GameState) => string;
  }[];
}

const DILEMMAS: DilemmaTemplate[] = [
  {
    id: 'bench_unhappy',
    mode: 'm',
    category: 'ห้องแต่งตัว',
    title: '🗣️ นักเตะสำรองขอลงตัวจริง',
    desc: (s) => {
      const me = s.teams[s.me];
      const bn = me.sq.filter((q) => !xi(me).includes(q)).sort((a, b) => b.ov - a.ov)[0];
      return `${bn ? bn.n : 'นักเตะสำรอง'} เข้ามาคุยกับคุณว่าอยากได้โอกาสลงสนามมากขึ้นในสัปดาห์นี้`;
    },
    options: [
      {
        label: 'ให้คำมั่นว่าจะโรเตชั่นนัดหน้า',
        hint: 'ขวัญทีม +6%',
        apply: (s) => {
          s.mor = clamp((s.mor ?? 50) + 6, 0, 100);
          return 'ทีมมีกำลังใจดีขึ้น (ขวัญทีม +6%)';
        }
      },
      {
        label: 'บอกให้พิสูจน์ตัวเองในการซ้อม',
        hint: 'นักเตะสำรองพลัง +1',
        apply: (s) => {
          const me = s.teams[s.me];
          const bn = me.sq.filter((q) => !xi(me).includes(q)).sort((a, b) => b.ov - a.ov)[0];
          if (bn && bn.ov < (bn.pot || 90)) bn.ov++;
          return bn ? `${bn.n} ตั้งใจซ้อมหนักจนพัฒนาพลัง +1` : 'นักเตะตั้งใจซ้อมมากขึ้น';
        }
      },
      {
        label: 'จัดซ้อมพิเศษปรับความเข้าใจ',
        hint: 'งบ -10k · ความคุ้นเคยแผน +8%',
        apply: (s) => {
          s.money -= 10;
          logFin(s, 'กิจกรรมปรับความเข้าใจในทีม', -10);
          s.teams[s.me].tacFam = clamp((s.teams[s.me].tacFam ?? 65) + 8, 20, 100);
          return 'ความเข้าใจแผนการเล่นเพิ่มขึ้น (+8%)';
        }
      }
    ]
  },
  {
    id: 'local_sponsor',
    mode: 'm',
    category: 'ธุรกิจสโมสร',
    title: '🏪 ธุรกิจท้องถิ่นชวนออกงาน',
    desc: () => 'ห้างร้านในจังหวัดติดต่อขอให้นักเตะไปร่วมกิจกรรมเปิดสาขา แลกค่าตอบแทนพิเศษ',
    options: [
      {
        label: 'ส่งนักเตะไปร่วมงานรับเงินก้อน',
        hint: 'งบ +40k · ฟิตตัวจริง -5%',
        apply: (s) => {
          s.money += 40;
          logFin(s, 'ค่าตัวออกงานสปอนเซอร์', 40);
          xi(s.teams[s.me]).forEach((q) => {
            q.fit = clamp((q.fit ?? 100) - 5, 30, 100);
          });
          return 'รับเงินสนับสนุน +40k ฿ (นักเตะล้าลงเล็กน้อย)';
        }
      },
      {
        label: 'ปฏิเสธเพื่อโฟกัสการฝึกซ้อม',
        hint: 'ฟิต +4% · บอร์ด +3%',
        apply: (s) => {
          s.teams[s.me].sq.forEach((q) => {
            q.fit = clamp((q.fit ?? 100) + 4, 30, 100);
          });
          s.bd = clamp((s.bd ?? 50) + 3, 0, 100);
          return 'นักเตะได้พักซ้อมเต็มที่ (ฟิต +4%, บอร์ด +3%)';
        }
      }
    ]
  },
  {
    id: 'youth_trial',
    mode: 'm',
    category: 'อะคาเดมี่',
    title: '🌟 พบเพชรเม็ดงามจากบอลนักเรียน',
    desc: () => 'แมวมองท้องถิ่นแจ้งว่ามีเด็กหนุ่มฝีเท้าจัดจ้านอยากมาทดสอบฝีเท้ากับสโมสร (ค่าดำเนินการ 25k)',
    options: [
      {
        label: 'รับเข้าสู่ชุดสำรองทันที (-25k)',
        hint: 'ได้ดาวรุ่งศักยภาพสูงเข้าทีม',
        apply: (s) => {
          const me = s.teams[s.me];
          if (s.money < 25 || me.sq.length >= 28) return 'งบไม่พอหรือทีมเต็ม 28 คนแล้ว';
          s.money -= 25;
          logFin(s, 'ค่าธรรมเนียมเซ็นดาวรุ่งบอลนักเรียน', -25);
          const y = mkPlayer(P(POS), BASE[me.tier] + 3, true);
          y.pot = clamp(R(84, 94), y.ov + 10, 95);
          y.con = { yr: 4, wg: wagOf(y), role: 'pro' };
          me.sq.push(y);
          return `เซ็น ${y.n} (${y.pos} ${y.ov}) ดาวรุ่งเข้าทีมแล้ว!`;
        }
      },
      {
        label: 'ส่งเข้าลิสต์เยาวชนรอเซ็นฟรี',
        hint: 'เพิ่มในรายชื่อเยาวชนอะคาเดมี่',
        apply: (s) => {
          const me = s.teams[s.me];
          const y = mkPlayer(P(POS), BASE[me.tier] - 2, true);
          s.yth.push(y);
          return `เพิ่ม ${y.n} ในรายชื่อเยาวชนอะคาเดมี่แล้ว`;
        }
      }
    ]
  },
  {
    id: 'media_interview',
    mode: 'both',
    category: 'สื่อมวลชน',
    title: '🎙️ นักข่าวขอสัมภาษณ์ก่อนเกม',
    desc: () => 'สื่อกีฬาเจ้าใหญ่ถามถึงเป้าหมายของทีมในฤดูกาลนี้ คุณจะตอบอย่างไร?',
    options: [
      {
        label: 'ประกาศกร้าวว่าพร้อมลุ้นแชมป์!',
        hint: 'แฟน +5% · ขวัญ +4%',
        apply: (s) => {
          s.fan = clamp((s.fan ?? 50) + 5, 5, 100);
          s.mor = clamp((s.mor ?? 50) + 4, 0, 100);
          return 'แฟนบอลคึกคักสุดขีด! (แฟน +5%, ขวัญ +4%)';
        }
      },
      {
        label: 'ถ่อมตัว เน้นทำผลงานทีละนัด',
        hint: 'บอร์ด +3% · ลดความกดดันทีม',
        apply: (s) => {
          s.bd = clamp((s.bd ?? 50) + 3, 0, 100);
          if (s.p) s.p.en = clamp((s.p.en ?? 100) + 4, 20, 100);
          return 'คำตอบสุขุมได้รับคำชม (ความเชื่อมั่น +3%)';
        }
      }
    ]
  },
  {
    id: 'player_charity',
    mode: 'p',
    category: 'นอกสนาม',
    title: '🤝 คลินิกฟุตบอลเยาวชนท้องถิ่น',
    desc: () => 'โรงเรียนใกล้สนามชวนคุณไปสอนทักษะฟุตบอลให้น้องๆ ในวันหยุด',
    options: [
      {
        label: 'ไปร่วมกิจกรรมอย่างเต็มใจ',
        hint: 'ชื่อเสียง +5 · แฟน +6% · พลังกาย -6%',
        apply: (s) => {
          if (s.p) {
            s.p.rep = (s.p.rep || 0) + 5;
            s.p.en = clamp((s.p.en ?? 100) - 6, 20, 100);
          }
          s.fan = clamp((s.fan ?? 50) + 6, 5, 100);
          return 'คุณกลายเป็นขวัญใจเยาวชน! (ชื่อเสียง +5, แฟน +6%)';
        }
      },
      {
        label: 'ขอตัวฝึกซ้อมเสริมคนเดียว',
        hint: 'พัฒนาค่าพลัง +1',
        apply: (s) => {
          const g = s.p ? autoGrow(s.p, 1) : '';
          syncMe(s);
          return g ? `ซ้อมเดี่ยวได้ผล! (${g})` : 'ได้ฝึกซ้อมรักษาฟอร์มเต็มที่';
        }
      }
    ]
  }
];

function maybeTriggerDilemma(s: GameState) {
  if (s.dilemma) return;
  if ((s.dilemmaCd ?? 0) > 0) {
    s.dilemmaCd = (s.dilemmaCd || 1) - 1;
    return;
  }
  if (Math.random() < 0.22) {
    const pool = DILEMMAS.filter((d) => d.mode === 'both' || d.mode === s.mode);
    const pick = P(pool);
    s.dilemma = {
      id: pick.id,
      title: pick.title,
      desc: pick.desc(s),
      category: pick.category,
      options: pick.options.map((o) => ({ label: o.label, hint: o.hint }))
    };
    s.dilemmaCd = 4;
  }
}

function applyDilemmaChoice(s: GameState, optIndex: number): string {
  if (!s.dilemma) return '';
  const tmpl = DILEMMAS.find((d) => d.id === s.dilemma!.id);
  const opt = tmpl?.options[optIndex];
  const msg = opt ? opt.apply(s) : '';
  s.dilemma = null;
  if (msg) pushFeed(s, 'เหตุการณ์', msg, 'ok');
  return msg;
}

const pickWinner = (h: Team, a: Team, r: MatchResult, s?: GameState | null) =>
  r.gh !== r.ga
    ? r.gh > r.ga
      ? h
      : a
    : r.pen != null
      ? r.pen
        ? h
        : a
      : Math.random() < 0.5 + (rate(h, s).at - rate(a, s).at) / 200
        ? h
        : a;

function simulateCpuAsiaRound(s: GameState) {
  const c = s.ac;
  if (!c || c.done) return;
  const nx: number[] = [];
  for (let i = 0; i < c.ids.length; i += 2) {
    const H = s.teams[c.ids[i]];
    const A = s.teams[c.ids[i + 1]];
    const r = simMatch(H, A, s);
    const w = pickWinner(H, A, r, s);
    nx[i / 2] = w.id;
    c.log.push(`${RN[c.r]}: ${H.name} ${r.gh}-${r.ga} ${A.name}`);
  }
  c.ids = nx;
  c.r++;
  s.pa = false;
  if (c.alive && !nx.includes(s.me)) c.alive = false;
  if (nx.length === 1) {
    c.done = true;
    const w = nx[0];
    if (c.p.includes(s.me)) {
      s.hist.push(`🌏 ซีซั่น ${s.season}: บอลถ้วยในทวีป ${w === s.me ? 'แชมป์!' : `ตกรอบ (${s.teams[w].name} แชมป์)`}`);
    }
    if (w === s.me && s.mode === 'm') {
      s.money += 500;
      logFin(s, 'รางวัลแชมป์ทวีป', 500);
      s.trophies = [...(s.trophies || []), { season: s.season, title: 'แชมป์สโมสรทวีป', type: 'asia' }];
      s.mgrRep = (s.mgrRep || 50) + 120;
    }
  }
}

function simulateCpuCupRound(s: GameState) {
  const c = s.cup;
  if (!c || c.done) return;
  const nx: number[] = [];
  for (let i = 0; i < c.ids.length; i += 2) {
    const H = s.teams[c.ids[i]];
    const A = s.teams[c.ids[i + 1]];
    const r = simMatch(H, A, s);
    const w = pickWinner(H, A, r, s);
    nx[i / 2] = w.id;
    c.log.push(`${RN[c.r]}: ${H.name} ${r.gh}-${r.ga} ${A.name}`);
  }
  c.ids = nx;
  c.r++;
  s.pc = false;
  if (c.alive && !nx.includes(s.me)) c.alive = false;
  if (nx.length === 1) {
    c.done = true;
    const w = nx[0];
    if (w === s.me && s.mode === 'm') {
      s.money += 250;
      logFin(s, 'รางวัลแชมป์ถ้วยประชาชน', 250);
      s.trophies = [...(s.trophies || []), { season: s.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' }];
      s.mgrRep = (s.mgrRep || 50) + 75;
    }
  }
}

function getIncomingOffers(s: GameState): TransferOffer[] {
  const me = s.teams[s.me];
  if (!me) return [];
  const raw: TransferOffer[] = [];
  if (Array.isArray(s.offers)) raw.push(...s.offers);
  if (s.off) raw.push(s.off);
  const seen = new Set<string>();
  const valid: TransferOffer[] = [];
  raw.forEach((o) => {
    if (!o || !o.n || !o.t) return;
    if (!me.sq.some((q) => q.n === o.n)) return;
    const key = `${o.n}__${o.teamId ?? o.t}`;
    if (seen.has(key)) return;
    seen.add(key);
    valid.push(o);
  });
  return valid;
}

function syncOffersField(s: GameState, list: TransferOffer[]) {
  s.offers = list;
  s.off = list[0] || null;
}

function addIncomingOffer(s: GameState, off: TransferOffer) {
  const list = getIncomingOffers(s).filter(
    (x) => !(x.n === off.n && (x.teamId != null && off.teamId != null ? x.teamId === off.teamId : x.t === off.t))
  );
  list.unshift(off);
  syncOffersField(s, list.slice(0, 4));
}

function removeIncomingOffer(s: GameState, playerName: string, clubName?: string) {
  const list = getIncomingOffers(s).filter((x) => {
    if (x.n !== playerName) return true;
    if (!clubName) return false;
    return x.t !== clubName;
  });
  syncOffersField(s, list);
}

function getPlayerSellCheck(s: GameState, me: Team, q: Player) {
  const tx = getLeagueTransferContext(s, me);
  const sameDayLock = q.signedSeason === s.season && q.signedMd === s.md;
  const minRequired = tx.minPos[q.pos];
  const samePosCount = tx.posCounts[q.pos];
  const turnKey = s.season * 40 + s.md;
  const pitchedThisTurn = q.offerCoolMd === turnKey;
  let reason = '';
  if (!tx.tw.open) reason = `ตลาดปิดอยู่! ขายได้เฉพาะช่วง ${tx.tw.rangeText} (กด 🏷️ ขึ้นบัญชีขายรอไว้ได้)`;
  else if (q.loan) reason = 'นักเตะยืมตัวไม่สามารถขายได้';
  else if (q.inj > 0) reason = 'นักเตะบาดเจ็บอยู่ ยังปล่อยตัวไม่ได้จนกว่าจะหาย';
  else if (sameDayLock) reason = 'เพิ่งเซ็นสัญญานัดนี้ ขายต่อทันทีไม่ได้ตามกฎลีก';
  else if (me.sq.length <= tx.minSquad) reason = `ขนาดทีมต้องมีอย่างน้อย ${tx.minSquad} คนตามกฎลีก`;
  else if (samePosCount <= minRequired) reason = `ต้องเหลือนักเตะ ${q.pos} อย่างน้อย ${minRequired} คน`;
  return {
    twOpen: tx.tw.open,
    sameDayLock,
    minRequired,
    samePosCount,
    pitchedThisTurn,
    canList: !q.loan,
    canPitch:
      tx.tw.open &&
      !q.loan &&
      q.inj === 0 &&
      !sameDayLock &&
      me.sq.length > tx.minSquad &&
      samePosCount > minRequired,
    reason
  };
}

function canAcceptTransferOffer(s: GameState, off: TransferOffer): { ok: boolean; err?: string; buyerName?: string } {
  const me = s.teams[s.me];
  const tx = getLeagueTransferContext(s, me);
  if (!tx.tw.open) return { ok: false, err: `ตลาดซื้อขายปิดแล้ว (${tx.tw.rangeText})` };
  const q = me.sq.find((x) => x.n === off.n);
  if (!q) return { ok: false, err: 'ไม่พบนักเตะคนนี้ในทีมแล้ว' };
  if (q.loan) return { ok: false, err: 'นักเตะยืมตัวขายไม่ได้' };
  if (me.sq.length <= tx.minSquad || tx.posCounts[q.pos] <= tx.minPos[q.pos]) {
    return { ok: false, err: `ขายไม่ได้ ต้องเหลือขนาดทีม ≥ ${tx.minSquad} และ ${q.pos} ≥ ${tx.minPos[q.pos]}` };
  }
  const buyer =
    (off.teamId != null ? s.teams.find((tm) => tm.id === off.teamId) : undefined) ||
    s.teams.find((tm) => tm.name === off.t);
  return { ok: true, buyerName: buyer?.name || off.t };
}

function acceptTransferOffer(d: GameState, off: TransferOffer): { ok: boolean; err?: string; buyerName?: string } {
  const chk = canAcceptTransferOffer(d, off);
  if (!chk.ok) return chk;
  const me = d.teams[d.me];
  const idx = me.sq.findIndex((q) => q.n === off.n);
  if (idx < 0) return { ok: false, err: 'ไม่พบนักเตะคนนี้ในทีมแล้ว' };
  const sold = me.sq.splice(idx, 1)[0];
  me.lu = null;
  if (me.cap === sold.n) me.cap = '';
  if (d.focusPlayer === sold.n) d.focusPlayer = null;
  delete sold.listed;
  delete sold.askPrice;
  delete sold.offerCoolMd;
  sold.no = undefined;
  sold.signedSeason = d.season;
  sold.signedMd = d.md;

  const buyer =
    (off.teamId != null ? d.teams.find((tm) => tm.id === off.teamId) : undefined) ||
    d.teams.find((tm) => tm.name === off.t);
  if (buyer && buyer.id !== d.me && buyer.sq.length < LEAGUE_TRANSFER_RULES.maxSquad) {
    buyer.sq.push(sold);
    buyer.lu = null;
    assignTeamShirtNumbers(buyer);
  }

  const buyerName = buyer?.name || off.t;
  d.money += off.p;
  logFin(d, `ขาย ${off.n} ให้ ${buyerName}`, off.p);
  pushFeed(d, 'ตลาดซื้อขาย', `✅ ขาย ${off.n} ให้ ${buyerName} รับค่าตัว +${off.p}k ฿`, 'ok');
  removeIncomingOffer(d, off.n);
  return { ok: true, buyerName };
}

function resolveCounterOfferOutcome(s: GameState, off: TransferOffer): { accepted: boolean; newPrice?: number } {
  const me = s.teams[s.me];
  const q = me.sq.find((x) => x.n === off.n);
  const fairVal = q ? vlu(q) : off.p;
  const acceptProb = off.p < fairVal ? 0.68 : 0.56;
  if (Math.random() < acceptProb) {
    return { accepted: true, newPrice: Math.max(off.p + 2, Math.round(off.p * 1.15)) };
  }
  return { accepted: false };
}

function applyCounterOfferOutcome(d: GameState, off: TransferOffer, out: { accepted: boolean; newPrice?: number }) {
  if (out.accepted && out.newPrice != null) {
    const list = getIncomingOffers(d).map((item) =>
      item.n === off.n && item.t === off.t ? { ...item, p: out.newPrice!, cnt: 1 } : item
    );
    syncOffersField(d, list);
  } else {
    removeIncomingOffer(d, off.n, off.t);
  }
}

function resolvePitchPlayerOutcome(
  s: GameState,
  playerName: string,
  askPct: number
): { ok: boolean; askPrice: number; turnKey: number; offers: TransferOffer[]; err?: string } {
  const me = s.teams[s.me];
  const q = me.sq.find((x) => x.n === playerName);
  if (!q) return { ok: false, askPrice: 0, turnKey: 0, offers: [], err: 'ไม่พบนักเตะในทีม' };
  const chk = getPlayerSellCheck(s, me, q);
  if (!chk.canPitch) return { ok: false, askPrice: 0, turnKey: 0, offers: [], err: chk.reason || 'ยังไม่สามารถเสนอขายได้ในตอนนี้' };
  const turnKey = s.season * 40 + s.md;
  if (q.offerCoolMd === turnKey) {
    return { ok: false, askPrice: 0, turnKey, offers: [], err: 'เสนอนักเตะคนนี้ให้สโมสรอื่นไปแล้วในนัดนี้ ลองใหม่หลังจบแมตช์หน้าหรือรอข้อเสนออัตโนมัติ' };
  }

  const marketVal = Math.max(5, vlu(q));
  const askPrice = Math.max(5, Math.round((marketVal * askPct) / 100));

  const existingBuyerNames = new Set(
    getIncomingOffers(s)
      .filter((o) => o.n === q.n)
      .map((o) => o.t)
  );
  const candidates = s.teams
    .filter(
      (tm) =>
        tm.id !== s.me &&
        tm.sq.length < LEAGUE_TRANSFER_RULES.maxSquad &&
        !existingBuyerNames.has(tm.name) &&
        Math.abs(tm.tier - me.tier) <= 1
    )
    .sort((a, b) => Math.abs(a.tier - me.tier) - Math.abs(b.tier - me.tier) || Math.random() - 0.5)
    .slice(0, 6);

  const created: TransferOffer[] = [];
  const baseInterest = askPct <= 90 ? 0.62 : askPct <= 105 ? 0.42 : 0.24;
  const ageBonus = q.age <= 24 ? 0.12 : q.age >= 32 ? -0.1 : 0;
  const ovBonus = q.ov >= 70 ? 0.1 : 0;

  for (const opp of candidates) {
    if (created.length >= 2) break;
    const posNeed = opp.sq.filter((z) => z.pos === q.pos).length <= (LEAGUE_TRANSFER_RULES.minPos[q.pos] + 2) ? 0.12 : 0;
    const prob = clamp(baseInterest + ageBonus + ovBonus + posNeed, 0.14, 0.85);
    if (Math.random() < prob) {
      const bidMult =
        askPct <= 90
          ? 0.94 + Math.random() * 0.12
          : askPct <= 105
            ? 0.9 + Math.random() * 0.15
            : 0.86 + Math.random() * 0.16;
      const bidPrice = Math.max(5, Math.round(askPrice * bidMult));
      created.push({ n: q.n, p: bidPrice, t: opp.name, teamId: opp.id });
    }
  }

  return { ok: true, askPrice, turnKey, offers: created };
}

function applyPitchPlayerOutcome(
  d: GameState,
  playerName: string,
  outcome: { ok: boolean; askPrice: number; turnKey: number; offers: TransferOffer[] }
) {
  if (!outcome.ok) return;
  const q = d.teams[d.me]?.sq.find((x) => x.n === playerName);
  if (!q) return;
  q.listed = 1;
  q.askPrice = outcome.askPrice;
  q.offerCoolMd = outcome.turnKey;
  outcome.offers.forEach((off) => addIncomingOffer(d, off));

  if (outcome.offers.length > 0) {
    pushFeed(
      d,
      'ข้อเสนอ',
      `💼 เสนอขาย ${q.n} (${outcome.askPrice}k) — มี ${outcome.offers.length} ทีมยื่นซื้อเข้ามาแล้ว!`,
      'offer'
    );
  } else {
    pushFeed(
      d,
      'ตลาดซื้อขาย',
      `🏷️ ขึ้นบัญชีขาย ${q.n} (${outcome.askPrice}k) แล้ว ยังไม่มีทีมยื่นข้อเสนอในทันที`,
      ''
    );
  }
}

function afterMatchDay(s: GameState) {
  const me = s.teams[s.me];
  const mg = s.mode === 'm';
  const lv = s.tr ?? 1;
  const medLv = s.med ?? 1;
  const stf = getStaffState(s);

  me.tacFam = clamp((me.tacFam ?? 65) + 2 + stf.asst, 30, 100);

  s.teams
    .filter((t) => t.tier === me.tier)
    .forEach((t) => {
      const pl = xi(t);
      const mine = t.id === s.me;
      const ps = mine ? (t.press ?? 1) + (t.tempo ?? 1) - 1 : 1;
      t.sq.forEach((q) => {
        if (q.me) {
          if ((q.sus || 0) > 0) {
            q.sus = (q.sus || 0) - 1;
            if (s.p) s.p.sus = q.sus;
          }
          return;
        }
        const pi = pl.includes(q);
        const Dq = DT(q, s.p);
        q.fit = clamp(
          (q.fit ?? 100) +
            (pi
              ? -Math.round(R(7, 13) * (Dq.tr === 2 ? 0.8 : 1)) - ps * 3 + Math.round((Dq.d.sta - 70) / 8)
              : R(8, 16) + Math.round((Dq.d.rec - 70) / 8)) +
            (mine ? lv * 2 + stf.fit * 2 + (s.tf === 'F' ? 8 : 0) : 0),
          30,
          100
        );
        if ((q.sus || 0) > 0) q.sus = (q.sus || 0) - 1;
        if (q.inj > 0) {
          q.inj--;
          if (q.inj > 0 && (Dq.d.rec >= 85 || (mine && (medLv >= 3 || stf.physio >= 2))) && Math.random() < 0.3 + (mine ? (medLv - 1) * 0.08 + stf.physio * 0.08 : 0)) {
            q.inj--;
          }
        } else if (
          pi &&
          Math.random() <
            (q.fit < 60 ? 0.07 : 0.024) *
              (mine && s.tf === 'F' ? 0.5 : 1) *
              (mine ? Math.max(0.5, 1 - (medLv - 1) * 0.08 - stf.physio * 0.08) : 1) *
              ((130 - Dq.d.tol) / 60)
        ) {
          q.inj = injD(q, R(1, 5), s.p);
          if (mine) {
            s.news = `${q.n} บาดเจ็บ ${q.inj} นัด`;
            pushFeed(s, 'บาดเจ็บ', `🩹 ${q.n} บาดเจ็บพัก ${q.inj} นัด`, 'urg');
          }
        }
      });
    });

  if (mg) {
    const gMap: Record<string, Position[]> = { FW: ['FW'], MF: ['MF'], DF: ['DF', 'GK'] };
    const g = gMap[s.tf];
    const gr: string[] = [];
    if (g) {
      me.sq.forEach((q) => {
        const isFocus = s.focusPlayer && q.n === s.focusPlayer;
        const chance = (0.05 + 0.03 * lv + stf.asst * 0.02) * (isFocus ? 2.2 : 1);
        if ((g.includes(q.pos) || isFocus) && q.age < 31 && q.ov < (q.pot || 92) && Math.random() < chance) {
          q.ov++;
          gr.push(`${q.n} (${q.ov})`);
        }
      });
    }
    if (gr.length) {
      pushFeed(s, 'ฝึกซ้อม', `🏋️ พัฒนาจากซ้อม: ${gr.slice(0, 2).join(', ')}${gr.length > 2 ? ` +${gr.length - 2} คน` : ''}`, 'ok');
    }
    const wg = squadWage(me);
    const stfWg = Math.round(getStaffWage(s));
    s.money -= wg + stfWg;
    logFin(s, `ค่าเหนื่อยนักเตะ (${me.sq.length} คน)`, -wg);
    if (stfWg > 0) logFin(s, 'ค่าจ้างทีมงานสตาฟฟ์โค้ช', -stfWg);

    if (s.sponsorDeal && s.sponsorDeal.left > 0) {
      s.money += s.sponsorDeal.perMatch;
      logFin(s, `ดีลพาร์ทเนอร์: ${s.sponsorDeal.name}`, s.sponsorDeal.perMatch);
      s.sponsorDeal.left--;
      if (s.sponsorDeal.left <= 0) {
        pushFeed(s, 'การเงิน', `📄 สัญญาสปอนเซอร์ "${s.sponsorDeal.name}" ครบกำหนดแล้ว`, '');
        s.sponsorDeal = null;
      }
    }

    if (s.bankLoan && s.bankLoan.left > 0) {
      s.money -= s.bankLoan.per;
      s.bankLoan.left--;
      logFin(s, 'ผ่อนชำระเงินกู้ธนาคาร', -s.bankLoan.per);
      if (s.bankLoan.left <= 0) {
        s.bankLoan = null;
        pushFeed(s, 'ข่าวสาร', '🏦 ผ่อนชำระเงินกู้สโมสรครบทั้งหมดแล้ว', 'ok');
      }
    }

    if (s.scout && !s.scout.results) {
      s.scout.turnsLeft--;
      if (s.scout.turnsLeft <= 0) {
        s.scout.results = resolveScoutResults(s, s.scout);
        pushFeed(s, 'แมวมอง', `🔍 แมวมองส่งรายงาน "${s.scout.label}" แล้ว! ดูได้ที่แท็บตลาด`, 'ok');
      }
    }
  } else {
    runPlayerWeek(s);
    if (s.p?.last) pushFeed(s, 'ฝึกซ้อม', s.p.last, /เพิ่มเป็น|ได้ \+1|พัฒนา/.test(s.p.last) ? 'ok' : '');
  }

  if (mg) {
    const l = (me.fm || '').slice(-1);
    let d = l === 'W' ? 3 : l === 'L' ? -4 : 0;
    if (s.derby) {
      d *= 2;
      if (l === 'W') {
        s.money += 20;
        logFin(s, 'โบนัสชนะดาร์บี้แมตช์', 20);
      }
      s.news = '🔥 ดาร์บี้แมตช์! ' + (l === 'W' ? 'ชนะคู่ปรับ แฟนบอลคลั่ง' : l === 'L' ? 'แพ้คู่ปรับ แฟนบอลโกรธ' : 'เสมอกัน');
      pushFeed(s, 'ข่าวสาร', s.news, l === 'W' ? 'ok' : l === 'L' ? 'urg' : '');
      s.derby = 0;
    }
    if (s.money < 0) d--;
    s.bd = clamp((s.bd ?? 50) + d, 0, 100);
    if (s.bd <= 0 && s.md >= 3) s.sack = 1;

    const tw = getTransferWindowInfo(s);
    if (s.md === 6) {
      syncOffersField(s, []);
      pushFeed(s, 'ตลาดซื้อขาย', '🔒 ตลาดซื้อขายรอบแรกปิดแล้ว (จะเปิดรอบสองอีกครั้งนัดที่ 15–20)', '');
    } else if (s.md === 14) {
      mkMarket(s);
      pushFeed(s, 'ตลาดซื้อขาย', '🟢 ตลาดซื้อขายเลกสอง (นัดที่ 15–20) เปิดทำการแล้ว!', 'ok');
    } else if (s.md === 20) {
      syncOffersField(s, []);
      pushFeed(s, 'ตลาดซื้อขาย', '🔒 ตลาดซื้อขายเลกสองปิดแล้ว จนถึงต้นฤดูกาลหน้า', '');
    }

    const activeOffers = getIncomingOffers(s);
    const listedCands = me.sq.filter(
      (x) =>
        !!x.listed &&
        !x.loan &&
        x.inj === 0 &&
        me.sq.length > LEAGUE_TRANSFER_RULES.minSquad &&
        me.sq.filter((z) => z.pos === x.pos).length > LEAGUE_TRANSFER_RULES.minPos[x.pos] &&
        activeOffers.filter((o) => o.n === x.n).length < 2
    );
    const bidProb = listedCands.length ? 0.68 : 0.22;
    if (tw.open && activeOffers.length < 3 && Math.random() < bidProb) {
      const cands = listedCands.length
        ? listedCands
        : me.sq
            .slice()
            .sort((a, b) => b.ov - a.ov)
            .slice(0, 6)
            .filter(
              (x) =>
                !x.loan &&
                x.inj === 0 &&
                me.sq.length > LEAGUE_TRANSFER_RULES.minSquad &&
                me.sq.filter((z) => z.pos === x.pos).length > LEAGUE_TRANSFER_RULES.minPos[x.pos] &&
                !activeOffers.some((o) => o.n === x.n)
            );
      if (cands.length) {
        const q = P(cands);
        const existingClubs = new Set(activeOffers.filter((o) => o.n === q.n).map((o) => o.t));
        const oppPool = s.teams.filter(
          (x) => x.id !== s.me && x.sq.length < LEAGUE_TRANSFER_RULES.maxSquad && !existingClubs.has(x.name)
        );
        if (oppPool.length) {
          const opp = P(oppPool);
          const baseVal = q.askPrice || Math.max(5, vlu(q));
          const mult = q.listed ? 0.9 + Math.random() * 0.2 : 1.08 + Math.random() * 0.35;
          const newOff: TransferOffer = {
            n: q.n,
            p: Math.max(5, Math.round(baseVal * mult)),
            t: opp.name,
            teamId: opp.id
          };
          addIncomingOffer(s, newOff);
          pushFeed(s, 'ข้อเสนอ', `💼 ${newOff.t} ยื่นซื้อ ${newOff.n} (${newOff.p}k)`, 'offer');
        }
      }
    }
  } else {
    s.derby = 0;
  }

  // Trigger Thai FA Cup every 7 matchdays starting md 6 (when not clashing with Asia cup)
  const cup = s.cup;
  const n = s.md + 1;
  if (cup && !cup.done && cup.r < 4 && n === 7 * cup.r + 6) {
    if (cup.alive && cup.ids.includes(s.me)) {
      s.pc = true;
      s.news = `🏆 ถึงคิวแข่งถ้วยประชาชน ${RN[cup.r]}`;
    } else {
      simulateCpuCupRound(s);
    }
  }

  // Trigger Asian Cup
  const c = s.ac;
  if (c && !c.done && c.r < 4 && n === 7 * c.r + 3) {
    if (c.alive && c.ids.includes(s.me)) {
      s.pa = true;
      s.news = `🌏 ถึงคิวแข่งบอลถ้วยในทวีป ${RN[c.r]}`;
    } else {
      simulateCpuAsiaRound(s);
    }
  }

  maybeTriggerDilemma(s);
}

function growPlayers(s: GameState) {
  s.teams.forEach((t) =>
    t.sq.forEach((q) => {
      q.age++;
      if (q.me) {
        if (s.p) s.p.age = q.age;
        return;
      }
      if (q.con && !q.loan) q.con.yr = Math.max(0, (q.con.yr ?? 2) - 1);
      const D = DT(q, s.p);
      const delta =
        q.age < D.pk - 2
          ? R(0, 3) + (D.tr === 2 && Math.random() < 0.3 ? 1 : 0)
          : q.age > D.pk + 4
            ? -R(0, 3)
            : R(-1, 1);
      q.ov = clamp(q.ov + delta + (t.id === s.me && q.age < 24 && (s.tr ?? 1) > 2 ? 1 : 0), 25, q.pot || 92);
      if (q.age > 35) {
        Object.assign(q, mkPlayer(q.pos, BASE[t.tier], true));
        delete q.con;
        delete q.loan;
        delete q.loanOpt;
      }
    })
  );
}

function buildMatchExtraEvents(h: Team, a: Team, s?: GameState | null) {
  const X = [h, a].map((t) => rate(t, s).x.filter((q) => q.pos !== 'GK'));
  const N = [h.name, a.name];
  const templates: ((q: Player, t: string) => string)[] = [
    (q, t) => `🟨 ${q.n} (${t}) เข้าสกัดหนักโดนใบเหลืองเตือน`,
    (q, t) => `😮 ${q.n} (${t}) ยิงเฉียดเสาไปนิดเดียว`,
    (q) => `🎯 ${q.n} ปั่นโค้งเกือบเสียบสามเหลี่ยม`,
    (q, t) => `🩹 ${q.n} (${t}) ปะทะหนักลงไปนอน แต่ลุกมาเล่นต่อได้`,
    (_, t) => `🚩 ${t} ได้ลูกเตะมุมกดดันหน้ากรอบ`,
    (q) => `🎙️ ${q.n} คุมจังหวะจ่ายบอลกลางสนามได้เนียนตา`,
    (_, t) => `👏 แฟนบอล${t}ร้องเชียร์สนั่นสนาม`,
    (q) => `🔥 ${q.n} ซัดไกลเต็มข้อแต่บอลลอยข้ามคานไป`,
    (_, t) => `⚠️ ลูกฟรีคิกอันตรายของ ${t}`,
    (q, t) => `⚡ ${q.n} (${t}) สปีดกระชากหนีตัวประกบสร้างโอกาส`,
    (q, t) => `🧱 ${q.n} (${t}) เทกตัวโหม่งชนคานอย่างจัง!`
  ];
  return Array.from({ length: R(4, 7) }, () => {
    const i = R(0, 1);
    const k = R(0, templates.length - 1);
    const pl = X[i].length ? X[i] : rate(i ? a : h, s).x;
    const pickWeighted = (fn: (z: Player) => number) =>
      pl.flatMap((z) => Array(Math.max(1, Math.round(fn(z)))).fill(z));
    const q = P(
      k === 0
        ? pickWeighted((z) => (DT(z, s?.p).tr === 1 ? 3 : 1))
        : k === 3
          ? pickWeighted((z) => (105 - DT(z, s?.p).d.tol) / 12)
          : k === 2 || k === 7
            ? pickWeighted((z) => DT(z, s?.p).d.cur + DT(z, s?.p).d.pw - 90)
            : k === 5
              ? pickWeighted((z) => DT(z, s?.p).a.ps - 35)
              : k === 9
                ? pickWeighted((z) => DT(z, s?.p).d.spd + DT(z, s?.p).a.dr - 90)
                : k === 10
                  ? pickWeighted((z) => DT(z, s?.p).d.hd - 40)
                  : pl
    );
    return { m: R(3, 89), t: templates[k](q, N[i]), i, k, q };
  });
}

function finishSeasonComputation(s: GameState) {
  const mt = s.teams[s.me].tier;
  const lp = s.teams.filter((t) => t.tier === mt).flatMap((t) => t.sq.map((q) => ({ q, t })));
  const top = (k: 'sg' | 'sa') => lp.slice().sort((a, b) => (b.q[k] || 0) - (a.q[k] || 0))[0];
  const bs = top('sg');
  const ba = top('sa');

  [0, 1, 2]
    .filter((i) => i !== mt)
    .forEach((i) => {
      const rounds = s.fxo?.[i] ? s.fxo[i].slice(s.md) : roundRobin(s.teams.filter((t) => t.tier === i).map((t) => t.id));
      rounds.forEach((rd) =>
        rd.forEach(([h, a]) => {
          const r = simMatch(s.teams[h], s.teams[a], s);
          applyMatchResult(s.teams[h], r.gh, s.teams[a], r.ga);
          tallyMatchPlayers(s.teams[h], s.teams[a], r);
        })
      );
    });

  const tb = [0, 1, 2].map((i) => sortTable(s.teams.filter((t) => t.tier === i)));
  const meTeam = s.teams[s.me];
  const pos = tb[mt].indexOf(meTeam) + 1;
  const ch = tb[mt][0].id === s.me;
  const up: Team[] = [];
  const dn: Team[] = [];
  [0, 1].forEach((i) => {
    up.push(...tb[i].slice(0, 3));
    dn.push(...tb[i + 1].slice(-3));
  });

  if (s.aqs !== s.season) {
    s.aqs = s.season;
    s.aq = tb[2].slice(0, 3).map((t) => t.id);
  }

  up.forEach((t) => t.tier++);
  dn.forEach((t) => t.tier--);
  const nt = s.teams[s.me].tier;

  s.trophies = s.trophies || [];
  s.records = s.records || {};
  if (ch) {
    s.trophies.push({ season: s.season, title: `แชมป์ ${TN[mt]}`, tier: mt, type: 'league' });
    s.mgrRep = (s.mgrRep || 50) + (mt === 2 ? 100 : mt === 1 ? 60 : 40);
  } else if (nt > mt) {
    s.mgrRep = (s.mgrRep || 50) + 30;
  }

  const meTopScorer = meTeam.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  if (meTopScorer && (meTopScorer.sg || 0) > (s.records.topSeasonScorer?.g || 0)) {
    s.records.topSeasonScorer = { n: meTopScorer.n, g: meTopScorer.sg || 0, s: s.season };
  }
  if (meTeam.pts > (s.records.mostPoints?.pts || 0)) {
    s.records.mostPoints = { pts: meTeam.pts, s: s.season };
  }

  if (s.mode === 'm') {
    const pr = Math.max(0, 150 - pos * 10);
    if (pr) {
      s.money += pr;
      logFin(s, `เงินรางวัลจบอันดับ ${pos}`, pr);
    }
    if (s.payDue) {
      s.money -= s.payDue;
      logFin(s, 'ชำระค่าตัวผ่อนงวดปลายปี', -s.payDue);
      s.payDue = 0;
    }
    if (s.esd !== s.season) {
      s.esd = s.season;
      if (s.obj != null) {
        s.bd = clamp((s.bd ?? 50) + (pos <= s.obj ? 25 : pos <= s.obj + 3 ? -8 : -25), 0, 100);
        s.hist.push(`บอร์ด: เป้า อันดับ ${s.obj} · จบอันดับ ${pos}`);
        if (s.bd <= 0) s.sack = 1;
      }
    }
  } else if (s.p && s.esd !== s.season) {
    s.esd = s.season;
    const p = s.p;
    const av = p.ap ? p.rs / p.ap : 0;
    if (ovMe(p) >= 62 && av >= 6.8) {
      const gw = autoGrow(p, 3);
      p.ntCaps = (p.ntCaps || 0) + R(2, 4);
      const ntG = p.pos === 'FW' ? R(1, 3) : p.pos === 'MF' ? R(0, 2) : 0;
      p.ntGoals = (p.ntGoals || 0) + ntG;
      s.trophies.push({ season: s.season, title: 'ติดทีมชาติชุดใหญ่', type: 'nt' });
      s.hist.push(`🇹🇭 ซีซั่น ${s.season}: ติดทีมชาติลงเล่นให้ทัพทีมชาติไทย${ntG ? ` (ยิง ${ntG} ประตู)` : ''}${gw ? ` · ${gw}` : ''}`);
    }
  }

  const cupStatus = s.cup.done && s.cup.ids[0] === s.me ? 'แชมป์ถ้วย' : s.cup.alive ? 'ถึงรอบสุดท้าย' : 'ตกรอบ';
  s.hist.push(`ซีซั่น ${s.season}: ${TN[mt]} อันดับ ${pos} · ${cupStatus}`);

  let offers: Team[] = [];
  if (s.mode === 'p' && s.p) {
    const av = s.p.ap ? s.p.rs / s.p.ap : 0;
    if (av >= 6.6 || ovMe(s.p) >= BASE[nt] + 8) {
      const targetTier = nt < 2 ? nt + 1 : 2;
      offers = s.teams
        .filter((t) => t.tier === targetTier && t.id !== s.me)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
    }
  }

  return {
    mt,
    nt,
    pos,
    totalTeams: tb[mt].length,
    ch,
    cupStatus,
    bestScorer: bs && bs.q.sg ? `${bs.q.n} (${bs.t.name}) ${bs.q.sg} ประตู` : '',
    bestAssist: ba && ba.q.sa ? `${ba.q.n} (${ba.t.name}) ${ba.q.sa} ครั้ง` : '',
    offers,
    stText: nt > mt ? 'เลื่อนชั้น! 🎉' : nt < mt ? 'ตกชั้น' : ch ? 'แชมป์ลีก!' : 'อยู่ชั้นเดิม'
  };
}

const ovColor = (v: number) => (v >= 80 ? '#158049' : v >= 65 ? '#2563eb' : v >= 50 ? '#c98a00' : '#64748b');

const statBarColor = (v: number) =>
  v >= 82 ? '#158049' : v >= 68 ? '#1f9d5a' : v >= 54 ? '#c98a00' : '#64748b';

const StatBarRow: React.FC<{ label: string; value: number; isSig?: boolean; compact?: boolean }> = ({
  label,
  value,
  isSig,
  compact
}) => {
  const pct = Math.max(8, Math.min(100, Math.round(value)));
  const col = isSig ? 'var(--g)' : statBarColor(value);
  return (
    <div className={compact ? 'py-0.5' : 'py-1'}>
      <div className="flex items-center justify-between gap-2 text-xs mb-1">
        <span className={`truncate ${isSig ? 'font-bold text-[var(--g)]' : 'text-[var(--mut)]'}`}>
          {isSig ? '⭐ ' : ''}{label}
        </span>
        <span className="font-bold tabular text-[var(--ink)]" style={{ color: value >= 80 || isSig ? col : undefined }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: col }}
        />
      </div>
    </div>
  );
};

const cleanImportJson = (raw: string): GameState | null => {
  try {
    const json = decodeURIComponent(escape(atob(raw.trim())));
    const d = JSON.parse(json) as GameState;
    if (!d || !Array.isArray(d.teams) || !Array.isArray(d.fx) || !['m', 'p'].includes(d.mode)) return null;
    return d;
  } catch {
    try {
      const d = JSON.parse(raw.trim()) as GameState;
      if (!d || !Array.isArray(d.teams) || !Array.isArray(d.fx) || !['m', 'p'].includes(d.mode)) return null;
      return d;
    } catch {
      return null;
    }
  }
};

const exportSaveCode = (s: GameState): string => btoa(unescape(encodeURIComponent(JSON.stringify(s))));


// ============================================================================
// 5. SVG VISUAL COMPONENTS
// ============================================================================
const CREST_SHAPES: { label: string; d: string }[] = [
  { label: 'โล่คลาสสิก', d: 'M3 2h18v11c0 5-4 8-9 10-5-2-9-5-9-10z' },
  { label: 'วงกลม', d: 'M12 1.2a10.8 10.8 0 100 21.6 10.8 10.8 0 000-21.6z' },
  { label: 'หกเหลี่ยม', d: 'M12 1.2l9.2 5v11.3L12 23l-9.2-5.5V6.2z' },
  { label: 'โล่โค้งยุโรป', d: 'M3.5 3q8.5 2 17 0v9.5c0 5.2-3.7 8.4-8.5 10.5C7.2 20.9 3.5 17.7 3.5 12.5z' },
  { label: 'เพชร', d: 'M12 1.2L22.2 12 12 22.8 1.8 12z' },
  { label: 'โล่มงกุฎ', d: 'M4 5.2l4-3.2 4 2.2 4-2.2 4 3.2v8c0 4.8-3.5 7.9-8 9.9-4.5-2-8-5.1-8-9.9z' },
  { label: 'วงรี', d: 'M12 1.3c5.3 0 8.7 4.8 8.7 10.7S17.3 22.7 12 22.7 3.3 17.9 3.3 12 6.7 1.3 12 1.3z' },
  { label: 'แปดเหลี่ยม', d: 'M8 1.8h8l5.8 5.8v8.8L16 22.2H8l-5.8-5.8V7.6z' }
];

const CREST_PATTERNS = [
  'แถบขวาง', 'ครึ่งตั้ง', 'คาดทแยง', 'สองแถบ', 'ริ้วตั้ง',
  'ผ่าสี่ส่วน', 'เชฟรอน V', 'กากบาท', 'วงแหวน', 'ไล่เฉด'
];

const CREST_IC: Record<string, string> = {
  '⚽': '<circle cx="12" cy="12" r="8"/><path d="M12 8l3.2 2.4-1.2 3.8H10l-1.2-3.8zM12 4v4M15.2 10.4L19 9M14 14.2l2.3 3.4M10 14.2l-2.3 3.4M8.8 10.4L5 9"/>',
  '🦅': '<path d="M3 9c4-3 7-2 9 2 2-4 5-5 9-2-2 3-4 4-6 4l-3 6-3-6c-2 0-4-1-6-4zM12 6l1.5 2.5h-3z"/>',
  '🐘': '<path d="M6 17V9a5 5 0 0110 0v3c0 2 1 3 2.5 3 .8 0 1.5-.6 1.5-1.5V12M8 10c-2 0-3 1.5-3 3.5S6 17 8 17M10 17v2M14 17v2M12.5 9.5h.01"/>',
  '🐯': '<path d="M5 8l1.5-3.5L10 6.5h4L17.5 4.5 19 8a7 7 0 01-7 11A7 7 0 015 8zM9 11h.01M15 11h.01M10.5 14h3l-1.5 1.5z"/>',
  '🦁': '<path d="M12 4l2.5 2 3-.5 1 2.8 2 1.7-1.2 2.5.7 2.5-2.5 1.5-.5 2.5-2.5-.8L12 20l-2.5-1.8-2.5.8-.5-2.5L4 15l.7-2.5L3.5 10l2-1.7 1-2.8 3 .5zM9.5 11.5h.01M14.5 11.5h.01M10.5 14.5h3"/>',
  '🐉': '<path d="M5 17c1-6 4-10 9-11l3-2-1 4 3 1-2 3c2 2 1 6-2 7-3 1-6-1-7-4M8 9l2 1"/>',
  '🦈': '<path d="M4 14c3-5 8-7 16-6-3 3-4 5-4 8-3-1-5-1-8 1l1-2c-2 0-3.5 0-5-1zM13 8l1.5-4 2.5 3.5"/>',
  '🐂': '<path d="M5 6c0 3 2 4 4 4h6c2 0 4-1 4-4M7 10l1 6 4 3 4-3 1-6M10 13h.01M14 13h.01"/>',
  '🦢': '<path d="M6 17c2-2 5-2 8-1 2.5.8 4.5-.5 4.5-3 0-3-3-5-2-8 1-2 3-1 2.5 1M8 14l-3-2"/>',
  '🔥': '<path d="M12 3c1.5 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-.5-5 1-8.5z"/>',
  '⚡': '<path d="M13 2L5 13h6l-1 9 9-12h-6z"/>',
  '⭐': '<path d="M12 3l2.6 5.4 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z"/>',
  '👑': '<path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4zM5 20h14"/>',
  '⚔️': '<path d="M5 19L19 5M14 5h5v5M5 5l14 14M10 5H5v5"/>',
  '🔱': '<path d="M12 3v18M7 5v5c0 2.8 2.2 4.5 5 4.5s5-1.7 5-4.5V5M10 18h4"/>',
  '🛡️': '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM12 7v10"/>',
  '🌙': '<path d="M16 4.5A8 8 0 1019.5 16 6.5 6.5 0 0116 4.5z"/>',
  '🏔️': '<path d="M3 18l6-10 4 6 3-4 5 8zM9 8l2 2"/>'
};

const KIT_PATTERNS = [
  'เรียบ', 'ริ้วตั้ง', 'ริ้วขวาง', 'ครึ่งตัว', 'คาดทแยง',
  'แถบอก', 'เชฟรอน V', 'หมากรุก', 'ผ่าสี่ส่วน', 'กากบาท',
  'แขนทูโทน', 'ไล่เฉด', 'ลายเส้นตั้ง', 'ลายสายฟ้า'
];

const KIT_COLLARS = ['คอกลม', 'คอวี', 'คอปก', 'คอทูโทน'];

const ClubCrest: React.FC<{
  name: string;
  size?: number;
  team?: Team | null;
  club?: ClubIdentity | null;
  isMyClub?: boolean;
}> = ({ name, size = 24, team, club, isMyClub }) => {
  const uid = React.useId().replace(/:/g, '');
  const h = ([...(name || 'T')].reduce((a, c, idx) => a + c.charCodeAt(0) * (idx + 3), 0) * 37) >>> 0;
  const k = isMyClub && club ? club : null;
  const kp = team?.kc;
  const c1 = k ? k.c1 : kp ? kp[0] : `hsl(${h % 360} 55% 38%)`;
  const c2 = k ? k.c2 : kp ? kp[1] : `hsl(${h % 360} 70% 70%)`;
  const c3 = k?.c3 || '#f4c63d';
  const sh = (k ? k.shape : h % CREST_SHAPES.length) % CREST_SHAPES.length;
  const d = CREST_SHAPES[sh]?.d || CREST_SHAPES[0].d;
  const pat = (k ? k.pat : (h >> 4) % CREST_PATTERNS.length) % CREST_PATTERNS.length;
  const ic = k?.icon ?? '';
  const borderStyle = k?.crestBorder ?? 0;
  const strokeCol = borderStyle === 1 ? '#f4c63d' : borderStyle === 3 ? '#0f172a' : '#ffffff';
  const stars = clamp(k?.stars || 0, 0, 3);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <defs>
        <clipPath id={`cp-${uid}`}>
          <path d={d} />
        </clipPath>
        {pat === 9 && (
          <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#cp-${uid})`}>
        <rect width="24" height="24" fill={pat === 9 ? `url(#cg-${uid})` : c1} />
        {pat === 0 && <rect y="7" width="24" height="5" fill={c2} />}
        {pat === 1 && <rect x="12" width="12" height="24" fill={c2} />}
        {pat === 2 && <path d="M0 24L24 0v8L8 24z" fill={c2} />}
        {pat === 3 && (
          <>
            <rect y="5" width="24" height="3" fill={c2} />
            <rect y="11" width="24" height="3" fill={c2} />
          </>
        )}
        {pat === 4 && [0, 1, 2, 3].map((i) => <rect key={i} x={i * 6 + 1.5} width="2.8" height="24" fill={c2} />)}
        {pat === 5 && (
          <>
            <rect x="12" y="0" width="12" height="12" fill={c2} />
            <rect x="0" y="12" width="12" height="12" fill={c2} />
          </>
        )}
        {pat === 6 && <path d="M0 6l12 9 12-9v5l-12 9-12-9z" fill={c2} />}
        {pat === 7 && (
          <>
            <rect x="9.5" y="0" width="5" height="24" fill={c2} />
            <rect x="0" y="9.5" width="24" height="5" fill={c2} />
          </>
        )}
        {pat === 8 && <circle cx="12" cy="12" r="7.5" fill="none" stroke={c2} strokeWidth="2.4" />}
        {k?.c3 && pat !== 8 && <path d={d} fill="none" stroke={c3} strokeWidth="2.2" opacity="0.6" />}
      </g>
      <path d={d} fill="none" stroke={strokeCol} strokeWidth={borderStyle === 2 ? '2' : '1.5'} />
      {borderStyle === 2 && <path d={d} fill="none" stroke={c3} strokeWidth="0.7" opacity="0.9" />}
      {stars > 0 &&
        Array.from({ length: stars }).map((_, idx) => {
          const sx = 12 + (idx - (stars - 1) / 2) * 4.5;
          return <circle key={idx} cx={sx} cy="2.6" r="1.25" fill="#facc15" stroke="#1e293b" strokeWidth="0.35" />;
        })}
      {ic && CREST_IC[ic] ? (
        <g
          transform={`translate(5.4 ${stars > 0 ? 6.2 : 5.4}) scale(.55)`}
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: CREST_IC[ic] }}
        />
      ) : (
        <text
          x="12"
          y={stars > 0 ? '17.2' : '16.5'}
          fontSize="10"
          fontWeight="700"
          fill="#fff"
          stroke="#0006"
          strokeWidth="0.4"
          textAnchor="middle"
          fontFamily="Sarabun"
        >
          {ic || name?.[0] || 'ส'}
        </text>
      )}
    </svg>
  );
};

const KitJersey: React.FC<{ club: ClubIdentity; away?: boolean; size?: number; team?: Team | null; hideNumber?: boolean }> = ({
  club,
  away = false,
  size = 84,
  team = null,
  hideNumber = false
}) => {
  const uid = React.useId().replace(/:/g, '');
  const c = away ? club.c2 : club.c1;
  const d = away ? club.c1 : club.c2;
  const accent = club.c3 || (colDist(d, '#ffffff') < 100 ? '#f4c63d' : '#ffffff');
  const p = ((away && club.awayKit != null ? club.awayKit : club.kit) || 0) % KIT_PATTERNS.length;
  const collar = (club.collar ?? 0) % 4;
  const cuffTrim = club.cuffTrim ?? true;
  const J = 'M30 10l-22 14 8 18 10-5v48h48V37l10 5 8-18-22-14c-4 8-10 10-20 10s-16-2-20-10z';
  const numLightBg = colDist(c, '#ffffff') < 130 && [0, 5, 6, 10, 12, 13].includes(p);
  const numFill = numLightBg ? '#111827' : p === 4 || p === 5 || p === 8 || p === 9 || p === 11 ? '#ffffff' : d;

  return (
    <svg width={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={`kc-${uid}`}>
          <path d={J} />
        </clipPath>
        {p === 11 && (
          <linearGradient id={`kg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={d} />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#kc-${uid})`}>
        <rect width="100" height="100" fill={p === 11 ? `url(#kg-${uid})` : c} />
        {p === 1 && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={i * 14} width="7" height="100" fill={d} />)}
        {p === 2 && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} y={i * 16} width="100" height="8" fill={d} />)}
        {p === 3 && <rect x="50" width="50" height="100" fill={d} />}
        {p === 4 && (
          <>
            <path d="M8 100L70 0h22L30 100z" fill={d} />
            <path d="M5 100L67 0h3L8 100z" fill={accent} opacity="0.85" />
          </>
        )}
        {p === 5 && (
          <>
            <rect y="36" width="100" height="18" fill={d} />
            <rect y="34" width="100" height="2" fill={accent} />
            <rect y="54" width="100" height="2" fill={accent} />
          </>
        )}
        {p === 6 && (
          <>
            <path d="M18 22l32 22 32-22v14L50 58 18 36z" fill={d} />
            <path d="M18 36l32 22 32-22v4L50 62 18 40z" fill={accent} />
          </>
        )}
        {p === 7 &&
          [0, 1, 2, 3, 4, 5].flatMap((row) =>
            [0, 1, 2, 3, 4, 5].map((col) =>
              (row + col) % 2 === 0 ? (
                <rect key={`${row}-${col}`} x={col * 17} y={row * 17} width="17" height="17" fill={d} />
              ) : null
            )
          )}
        {p === 8 && (
          <>
            <rect x="50" y="0" width="50" height="46" fill={d} />
            <rect x="0" y="46" width="50" height="54" fill={d} />
          </>
        )}
        {p === 9 && (
          <>
            <rect x="42" y="0" width="16" height="100" fill={d} />
            <rect x="0" y="38" width="100" height="15" fill={d} />
          </>
        )}
        {p === 10 && (
          <>
            <rect x="0" y="0" width="27" height="50" fill={d} />
            <rect x="73" y="0" width="27" height="50" fill={d} />
            <rect x="25" y="10" width="2.5" height="35" fill={accent} />
            <rect x="72.5" y="10" width="2.5" height="35" fill={accent} />
          </>
        )}
        {p === 12 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 12 + 4} width="2.2" height="100" fill={d} opacity="0.9" />)}
        {p === 13 && (
          <>
            <path d="M0 32l24-12 20 14 22-14 34 16v13L66 33 44 47 24 33 0 45z" fill={d} opacity="0.92" />
            <path d="M0 54l24-12 20 14 22-14 34 16v7L66 49 44 63 24 49 0 61z" fill={accent} opacity="0.8" />
          </>
        )}

        {/* Cuff & Hem Trim */}
        {cuffTrim && (
          <>
            <path d="M8 24l10 18 4-2-10-18z" fill={accent} opacity="0.92" />
            <path d="M92 24L82 42l-4-2 10-18z" fill={accent} opacity="0.92" />
            <rect x="24" y="81" width="52" height="5" fill={d} opacity="0.85" />
          </>
        )}

        {/* Collar Styles */}
        {collar === 0 && <path d="M30 10c4 9 10 11 20 11s16-2 20-11" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />}
        {collar === 1 && <path d="M30 10l20 17 20-17" fill="none" stroke={accent} strokeWidth="4" strokeLinejoin="round" />}
        {collar === 2 && (
          <>
            <path d="M30 10l12 12 8-4 8 4 12-12z" fill={d} stroke={accent} strokeWidth="1.5" />
            <line x1="50" y1="18" x2="50" y2="29" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {collar === 3 && (
          <>
            <path d="M30 10c4 9 10 11 20 11s16-2 20-11" fill="none" stroke={d} strokeWidth="5.5" />
            <path d="M32 11c4 7 9 9 18 9s14-2 18-9" fill="none" stroke={accent} strokeWidth="2" />
          </>
        )}
      </g>

      <path d={J} fill="none" stroke="#0e2b1f" strokeWidth="2" />

      {/* Mini Club Crest on Left Chest */}
      <g transform="translate(57, 27)">
        <circle cx="5.5" cy="5.5" r="5" fill={club.c1} stroke="#ffffff" strokeWidth="1" />
        <circle cx="5.5" cy="5.5" r="2.2" fill={club.c2} />
      </g>

      {!hideNumber && (
        <text
          x="50"
          y="71"
          textAnchor="middle"
          fontSize="23"
          fontWeight="800"
          fontFamily="Sarabun"
          fill={numFill}
          stroke="#0008"
          strokeWidth="1.1"
        >
          {team ? '10' : '10'}
        </text>
      )}
    </svg>
  );
};

function faceBodySvg(
  v: number[],
  kit: string,
  trim: string,
  w = 38,
  bg = 'none',
  bare = false,
  showNo = true
): string {
  const ki = v[0] ?? 2;
  const hi = v[1] ?? 0;
  const hs = v[2] ?? 0;
  const fh = v[3] ?? 0;
  const ey = (v[4] ?? 0) % 4;
  const no = v[5] ?? 10;
  const fs = (v[6] ?? ((ki + hi + hs + no) % 3)) % 3;
  const sk = SKIN_P[ki] || SKIN_P[2];
  const hr = HAIR_P[hi] || HAIR_P[0];

  const headD = [
    'M16 25c0-10 6-15 14-15s14 5 14 15c0 9-5 16-14 16s-14-7-14-16z',
    'M14.5 25.5c0-10 6.5-15.5 15.5-15.5s15.5 5.5 15.5 15.5c0 8.8-6 15.5-15.5 15.5s-15.5-6.7-15.5-15.5z',
    'M15.5 24.5c0-9.5 6-14.5 14.5-14.5s14.5 5 14.5 14.5l-1 9.5c-.8 3.8-6.5 7-13.5 7s-12.7-3.2-13.5-7z'
  ][fs];

  const hHtml = [
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/>`,
    `<path d="M15 24c0-9 5-15 15-16c4 0 8 2 11 5l3-4-2 8c2 2 3 4 3 7c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M20 12l4-5 4 4 4-6 4 5 5-3-2 7z" fill="${hr}"/>`,
    `<path d="M15 25c0-12 7-18 16-18s14 6 14 17c-4-4-12-5-20-2c-5 2-8 4-10 3z" fill="${hr}"/>`,
    `<path d="M14 25c-2-5 1-11 5-13c2-5 8-7 13-6c6-1 11 2 12 7c4 2 5 8 2 12c-3-5-9-8-16-8s-13 3-16 8z" fill="${hr}"/>`,
    `<path d="M16 23c1-9 6-14 14-14s13 5 14 14c-3-5-8-7-14-7s-11 2-14 7z" fill="${hr}" opacity="0.58"/>`,
    `<path d="M15 23c1-11 7-17 15-17s14 6 15 17c-2-8-8-10-15-10s-13 2-15 10z" fill="${hr}"/><path d="M21 11q9-3 18 0" stroke="#fff" stroke-width="0.9" opacity="0.25" fill="none"/>`,
    `<path d="M15 24c0-11 7-17 15-17s15 6 15 17c-3-6-9-8-15-8s-12 2-15 8z" fill="${hr}"/><path d="M16 18q14-3 28 0" stroke="${trim}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    `<path d="M15 25c0-11 7-17 15-17s15 6 15 17c-3-5-7-8-12-8l-3 5-3-5c-5 0-9 3-12 8z" fill="${hr}"/>`
  ][hs % 8];

  const fhHtml =
    fh === 1
      ? `<path d="M25 37c2 3 8 3 10 0c-1 4-9 4-10 0z" fill="${hr}" opacity="0.88"/>`
      : fh === 2
        ? `<path d="M17 29c1 9 6 13 13 13s12-4 13-13c-2 5-6 8-13 8s-11-3-13-8z" fill="${hr}" opacity="0.82"/>`
        : fh === 3
          ? `<path d="M24 33q6-2.5 12 0q-6 1-12 0z" fill="${hr}" opacity="0.9"/>`
          : '';

  const br =
    ey === 1
      ? `<path d="M19.5 22.2l7 1.4M40.5 22.2l-7 1.4" stroke="${hr}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : ey === 3
        ? `<path d="M19.5 22.8h7.2M33.3 22.8h7.2" stroke="${hr}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
        : `<path d="M19.8 22.5q3.7-1.6 7 0M33.2 22.5q3.7-1.6 7 0" stroke="${hr}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.9"/>`;

  const eyes =
    ey === 3
      ? `<path d="M21 26.8h5.5M33.5 26.8h5.5" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>`
      : `<ellipse cx="23.8" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><ellipse cx="36.2" cy="27" rx="2.5" ry="1.9" fill="#fff" opacity="0.92"/><circle cx="23.8" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="36.2" cy="27" r="1.75" fill="#1a1a1a"/><circle cx="23.2" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/><circle cx="35.6" cy="26.3" r="0.65" fill="#fff" opacity="0.9"/>`;

  const mo =
    ey === 2
      ? `<path d="M25 34q5 4.2 10 0z" fill="#fff" stroke="#222" stroke-width="0.8"/>`
      : ey === 1
        ? `<path d="M26 35h8" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>`
        : ey === 3
          ? `<path d="M26 35q4 1.5 8-.6" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
          : `<path d="M26 34.5q4 2.8 8 0" stroke="#222" fill="none" stroke-width="1.4" stroke-linecap="round"/>`;

  return `${bare ? '' : `<rect width="60" height="64" fill="${bg}"/><path d="M0 0h60v26L0 42z" fill="#fff" opacity="0.1"/>`}<path d="M8 64c0-14 7-20 22-20s22 6 22 20z" fill="${kit}"/><path d="M21 44l9 8 9-8" stroke="${trim}" stroke-width="2.5" fill="none" stroke-linejoin="round"/><path d="M12 52l4 12M48 52l-4 12" stroke="${trim}" stroke-width="2" opacity="0.35"/>${showNo && w >= 44 ? `<text x="30" y="60" text-anchor="middle" font-size="10" font-weight="700" font-family="Sarabun" fill="#fff" stroke="#0005" stroke-width="0.6" opacity="0.92">${no || 10}</text>` : ''}<rect x="25" y="36" width="10" height="11" rx="3" fill="${sk}"/><ellipse cx="30" cy="40" rx="5" ry="2.4" fill="#000" opacity="0.14"/><circle cx="14.6" cy="28" r="3.2" fill="${sk}"/><circle cx="45.4" cy="28" r="3.2" fill="${sk}"/><path d="${headD}" fill="${sk}"/>${fhHtml}<path d="M30 27.5v3.8l-1.3.9" stroke="#000" opacity="0.16" stroke-width="1.2" fill="none" stroke-linecap="round"/>${br}${eyes}${mo}${hHtml}`;
}

const PlayerFace: React.FC<{
  player?: Partial<Player> | null;
  team?: Team | null;
  state?: GameState | null;
  careerProfile?: PlayerCareerProfile | null;
  size?: number;
  bare?: boolean;
  kitColor?: string;
  trimColor?: string;
}> = ({ player, team, state, careerProfile, size = 38, bare = false, kitColor, trimColor }) => {
  const q = player || {};
  const resolvedNo = q.no || (team && q.n ? getShirtNo(team, q) : undefined) || (q.me ? (careerProfile || state?.p)?.no : undefined);
  const v = visOf(resolvedNo ? { ...q, no: resolvedNo } : q, careerProfile || state?.p);
  const teamKit = team ? tc(team, state) : null;
  const kc = kitColor
    ? kitColor
    : q.pos === 'GK'
      ? pickGK(teamKit || '#2f6fd6')
      : teamKit
        ? teamKit
        : q.me && (careerProfile || state?.p)
          ? (careerProfile || state?.p)!.c
          : '#2f6fd6';
  const tr = trimColor ? trimColor : team ? tc(team, state, true) : '#ffd75e';
  const bg = bare ? 'transparent' : `color-mix(in srgb, ${kc} 18%, transparent)`;
  return (
    <svg
      className={`shrink-0 ${bare ? '' : 'rounded-xl border border-[var(--line)]'}`}
      width={size}
      height={Math.round((size * 64) / 60)}
      viewBox="0 0 60 64"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: faceBodySvg(v, kc, tr, size, bg, bare, true) }}
    />
  );
};

const PITCH_SVG_BASE =
  '<rect width="300" height="340" fill="#25834f"/><path fill="#2d965c" d="M0 0h300v42H0zM0 85h300v42H0zM0 170h300v42H0zM0 255h300v42H0z"/><g fill="none" stroke="#eef2e6" stroke-width="1.6" opacity="0.85"><rect x="6" y="6" width="288" height="328"/><path d="M6 170h288M90 6v52h120V6M90 334v-62h120v62"/><circle cx="150" cy="170" r="34"/></g>';

const TacticsMiniPitch: React.FC<{ team: Team; state?: GameState | null }> = ({ team, state }) => {
  const uid = React.useId().replace(/:/g, '');
  const col = tc(team, state);
  const trCol = tc(team, state, true);
  const gkCol = pickGK(col);
  const slots = getFormationSlots(team);
  const starters = xi(team);
  return (
    <svg className="w-full max-w-[200px] mx-auto rounded-xl block" viewBox="0 0 300 340" role="img" aria-label={`ผังแผน ${team.form}`}>
      <defs>
        <clipPath id={`mfc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
      {slots.map((z, idx) => {
        const q = starters[idx];
        const cx = 18 + z.x * 2.64;
        const cy = 24 + z.y * 2.9;
        const kc = z.sp === 'GK' ? gkCol : col;
        const isMe = !!(q?.me || (state?.mode === 'p' && state?.p?.name === q?.n));
        const sc = 0.5;
        return (
          <g key={idx}>
            <circle cx={cx} cy={cy} r={16} fill={kc} stroke={isMe ? '#f5c242' : '#fff'} strokeWidth={isMe ? 2.8 : 2.2} />
            {q && (
              <g
                transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
                clipPath={`url(#mfc-${uid})`}
                dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(q, state?.p), kc, trCol, 32, '#10281d', true, false) }}
              />
            )}
            <rect x={cx - 14} y={cy + 10} width="28" height="11" rx="4" fill="#0b2018" stroke={isMe ? '#f5c242' : '#fff8'} strokeWidth="0.9" />
            <text
              x={cx}
              y={cy + 18.2}
              textAnchor="middle"
              fontSize="8.2"
              fontWeight="700"
              fontFamily="Sarabun"
              fill={isMe ? '#fde047' : '#fff'}
            >
              {z.sp}
            </text>
          </g>
        );
      })}
    </svg>
  );
};



interface PitchPositionZone {
  id: string;
  sp: SubRole;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  line: Position;
}

const PITCH_POSITION_ZONES: PitchPositionZone[] = [
  { id: 'LW', sp: 'LW', label: 'ปีกซ้าย', x1: 3, y1: 7, x2: 26, y2: 29, line: 'FW' },
  { id: 'ST', sp: 'ST', label: 'หน้าเป้า', x1: 26, y1: 7, x2: 74, y2: 20, line: 'FW' },
  { id: 'CF', sp: 'CF', label: 'หน้าต่ำ/เชื่อม', x1: 26, y1: 20, x2: 74, y2: 29.5, line: 'FW' },
  { id: 'RW', sp: 'RW', label: 'ปีกขวา', x1: 74, y1: 7, x2: 97, y2: 29, line: 'FW' },
  { id: 'LM', sp: 'LM', label: 'กลางซ้าย', x1: 3, y1: 29, x2: 25, y2: 57, line: 'MF' },
  { id: 'CAM', sp: 'CAM', label: 'กลางรุก', x1: 25, y1: 29.5, x2: 75, y2: 43, line: 'MF' },
  { id: 'RM', sp: 'RM', label: 'กลางขวา', x1: 75, y1: 29, x2: 97, y2: 57, line: 'MF' },
  { id: 'CM', sp: 'CM', label: 'กองกลาง', x1: 25, y1: 43, x2: 75, y2: 57, line: 'MF' },
  { id: 'LWB', sp: 'LWB', label: 'วิงแบ็กซ้าย', x1: 3, y1: 57, x2: 25, y2: 69, line: 'DF' },
  { id: 'CDM', sp: 'CDM', label: 'กลางตัวรับ', x1: 25, y1: 57, x2: 75, y2: 69, line: 'MF' },
  { id: 'RWB', sp: 'RWB', label: 'วิงแบ็กขวา', x1: 75, y1: 57, x2: 97, y2: 69, line: 'DF' },
  { id: 'LB', sp: 'LB', label: 'แบ็กซ้าย', x1: 3, y1: 69, x2: 23, y2: 85, line: 'DF' },
  { id: 'CB', sp: 'CB', label: 'เซนเตอร์แบ็ก', x1: 23, y1: 69, x2: 77, y2: 85, line: 'DF' },
  { id: 'RB', sp: 'RB', label: 'แบ็กขวา', x1: 77, y1: 69, x2: 97, y2: 85, line: 'DF' },
  { id: 'GK', sp: 'GK', label: 'ผู้รักษาประตู', x1: 28, y1: 85, x2: 72, y2: 96, line: 'GK' }
];

const getPitchZoneAt = (x: number, y: number): PitchPositionZone => {
  const found = PITCH_POSITION_ZONES.find(
    (z) => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2
  );
  if (found) return found;
  if (y >= 85) return PITCH_POSITION_ZONES[PITCH_POSITION_ZONES.length - 1];
  return PITCH_POSITION_ZONES[7]; // CM fallback
};

interface PitchDragPreview {
  slotIdx: number;
  player: Player;
  x: number;
  y: number;
  sp: SubRole;
  zoneId: string;
  zoneLabel: string;
}

const FormationPitch: React.FC<{
  team: Team;
  state: GameState;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  showPositionZones?: boolean;
  dragSourceName?: string | null;
  dropTargetName?: string | null;
  dragPreview?: PitchDragPreview | null;
  onPlayerPointerDown: (e: React.PointerEvent, player: Player, slotSp: SubRole, slotIdx?: number) => void;
}> = ({
  team,
  state,
  svgRef,
  showPositionZones = false,
  dragSourceName,
  dropTargetName,
  dragPreview,
  onPlayerPointerDown
}) => {
  const uid = React.useId().replace(/:/g, '');
  const starters = xi(team);
  const slots = getFormationSlots(team);
  const col = tc(team, state);
  const trCol = tc(team, state, true);
  const gkCol = pickGK(col);
  const zoneLineColors: Record<Position, { stroke: string; fill: string; text: string }> = {
    FW: { stroke: 'rgba(110, 231, 183, 0.55)', fill: 'rgba(16, 185, 129, 0.08)', text: 'rgba(209, 250, 229, 0.85)' },
    MF: { stroke: 'rgba(252, 211, 77, 0.55)', fill: 'rgba(245, 158, 11, 0.08)', text: 'rgba(254, 243, 199, 0.85)' },
    DF: { stroke: 'rgba(125, 211, 252, 0.55)', fill: 'rgba(56, 189, 248, 0.08)', text: 'rgba(224, 242, 254, 0.85)' },
    GK: { stroke: 'rgba(216, 180, 254, 0.55)', fill: 'rgba(168, 85, 247, 0.09)', text: 'rgba(243, 232, 255, 0.85)' }
  };

  return (
    <svg
      ref={svgRef}
      className="w-full max-w-[440px] mland:h-full mland:max-h-full mland:w-auto mland:max-w-full mx-auto rounded-2xl mland:rounded-xl block select-none"
      viewBox="0 0 300 340"
    >
      <defs>
        <clipPath id={`fc-${uid}`}>
          <circle cx="30" cy="31" r="27" />
        </clipPath>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />

      {showPositionZones && (
        <g className="pointer-events-none">
          {PITCH_POSITION_ZONES.map((z) => {
            const x = 18 + z.x1 * 2.64 + 1.2;
            const y = 24 + z.y1 * 2.9 + 1.2;
            const w = Math.max(8, (z.x2 - z.x1) * 2.64 - 2.4);
            const h = Math.max(8, (z.y2 - z.y1) * 2.9 - 2.4);
            const isActiveZone = dragPreview?.zoneId === z.id;
            const pal = zoneLineColors[z.line];
            const fitPen = isActiveZone && dragPreview ? pen(dragPreview.player.ro, z.sp) : 0;
            const activeStroke = fitPen === 0 ? '#4ade80' : fitPen === 1 ? '#facc15' : '#f87171';
            const activeFill = fitPen === 0 ? 'rgba(74, 222, 128, 0.24)' : fitPen === 1 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(248, 113, 113, 0.24)';

            return (
              <g key={z.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="4.5"
                  fill={isActiveZone ? activeFill : pal.fill}
                  stroke={isActiveZone ? activeStroke : pal.stroke}
                  strokeWidth={isActiveZone ? '1.8' : '0.9'}
                  strokeDasharray={isActiveZone ? undefined : '3.5 2.5'}
                  opacity={dragPreview ? (isActiveZone ? 1 : 0.65) : 0.72}
                />
                <text
                  x={x + 4}
                  y={y + 8.5}
                  fontSize={isActiveZone ? '8' : '6.8'}
                  fontWeight="800"
                  fontFamily="Sarabun"
                  fill={isActiveZone ? '#ffffff' : pal.text}
                  stroke="rgba(5, 22, 13, 0.8)"
                  strokeWidth="1.6"
                  paintOrder="stroke"
                >
                  {isActiveZone ? `${z.sp} · ${z.label}` : z.sp}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {starters.map((q, i) => {
        const z = slots[i] || { sp: 'CM', x: 50, y: 50 };
        const cx = 18 + z.x * 2.64;
        const cy = 24 + z.y * 2.9;
        const pn = pen(q.ro, z.sp);
        const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
        const isSource = dragSourceName === q.n;
        const isMovingSelf = dragPreview?.slotIdx === i;
        const isTarget = dropTargetName === q.n && dragSourceName !== q.n;
        const ed = q.inj > 0 || (q.sus || 0) > 0 ? '#ef4444' : isTarget || isMe ? '#f5c242' : PCOL[pn];
        const kc = z.sp === 'GK' ? gkCol : col;
        const rad = isTarget ? 19 : 16;
        const sc = isTarget ? 0.58 : 0.5;
        const no = getShirtNo(team, q);
        const efVal = q.inj > 0 || (q.sus || 0) > 0 ? 0 : Math.max(0, Math.min(100, Math.round(q.fit ?? 100)));
        const efc = efVal >= 85 ? '#3fcf7f' : efVal >= 65 ? '#f4c63d' : '#ff7a5c';

        return (
          <g
            key={`${q.n}-${i}`}
            data-drop-player={q.n}
            data-drop-slot={z.sp}
            onPointerDown={(e) => onPlayerPointerDown(e, q, z.sp, i)}
            style={{ touchAction: 'none', opacity: isMovingSelf ? 0.24 : isSource ? 0.45 : 1 }}
            className={dragSourceName ? 'cursor-grabbing' : 'cursor-pointer'}
          >
            <circle cx={cx} cy={cy} r={22} fill="transparent" />
            {isMe && !isTarget && (
              <circle cx={cx} cy={cy} r={22.5} fill="#f5c2422e" stroke="#fde047" strokeWidth="2.2" />
            )}
            {isTarget && (
              <circle cx={cx} cy={cy} r={24} fill="#f5c24228" stroke="#f5c242" strokeWidth="2.2" strokeDasharray="4 2" />
            )}
            <ellipse cx={cx} cy={cy + 16} rx="13" ry="3.8" fill="#0005" />
            {isMe ? (
              <g transform={`translate(${cx},${cy - (isTarget ? 27 : 24)})`}>
                <rect x="-24" y="-9.5" width="48" height="12.5" rx="6" fill="#f5c242" stroke="#111" strokeWidth="0.9" />
                <text x="0" y="-0.6" textAnchor="middle" fontSize="8.3" fontWeight="800" fontFamily="Sarabun" fill="#1a1200">
                  ★ ฉัน · {z.sp}
                </text>
              </g>
            ) : (
              <text
                x={cx}
                y={cy - (isTarget ? 24 : 21)}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="Sarabun"
                fill={PCOL[pn]}
                stroke="#0b2018"
                strokeWidth="2.6"
                paintOrder="stroke"
              >
                {z.sp}
              </text>
            )}
            <circle cx={cx} cy={cy} r={rad} fill={kc} stroke={ed} strokeWidth="2.8" />
            <g
              transform={`translate(${(cx - 30 * sc).toFixed(1)},${(cy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(q, state.p), kc, trCol, 32, '#10281d', true, false) }}
            />
            <rect x={cx + 4} y={cy + 6} width="18" height="11" rx="4.5" fill="#0b2018" stroke={ed} strokeWidth="1.1" />
            <text x={cx + 13} y={cy + 14.2} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Sarabun" fill="#fff">
              {q.ov}
            </text>
            <rect x={cx - 22} y={cy + 6} width="18" height="11" rx="4.5" fill="#0b2018" stroke={ed} strokeWidth="1.1" />
            <text x={cx - 13} y={cy + 14.2} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Sarabun" fill="#ffd75e">
              {no}
            </text>
            {team.cap === q.n && (
              <g transform={`translate(${cx - 12},${cy - 15})`}>
                <circle r="6" fill="#f4c63d" stroke="#111" strokeWidth="1" />
                <text y="3" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="Sarabun" fill="#111">
                  C
                </text>
              </g>
            )}
            {(q.sus || 0) > 0 ? (
              <rect x={cx + 9} y={cy - 20} width="7" height="10" rx="1.5" fill="#e5484d" stroke="#fff" strokeWidth="1.2" />
            ) : q.inj > 0 ? (
              <g transform={`translate(${cx + 12},${cy - 15})`}>
                <circle r="6" fill="#fff" stroke="#e5484d" strokeWidth="1.2" />
                <path d="M-3 0h6M0-3v6" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : null}
            <text
              x={clamp(cx, 26, 274)}
              y={cy + 31.5}
              textAnchor="middle"
              fontSize={isMe ? '8.8' : '8.4'}
              fontWeight={isMe ? '800' : '600'}
              fontFamily="Sarabun"
              fill={isMe ? '#fde047' : '#fff'}
              stroke="#0b2018"
              strokeWidth="2.3"
              paintOrder="stroke"
            >
              {q.n.split(' ')[0]}
            </text>
            <rect x={cx - 23} y={cy + 18.5} width="28" height="4.5" rx="2.2" fill="#0b2018" stroke="#fff7" strokeWidth="0.6" />
            <rect x={cx - 23} y={cy + 18.5} width={(28 * efVal) / 100} height="4.5" rx="2.2" fill={efc} />
            <text
              x={cx + 7}
              y={cy + 23}
              fontSize="8"
              fontWeight="700"
              fontFamily="Sarabun"
              fill={efc}
              stroke="#0b2018"
              strokeWidth="2.2"
              paintOrder="stroke"
            >
              {efVal}%
            </text>
          </g>
        );
      })}

      {/* Live Dragged Player Preview on Pitch */}
      {dragPreview && (() => {
        const pq = dragPreview.player;
        const gx = 18 + dragPreview.x * 2.64;
        const gy = 24 + dragPreview.y * 2.9;
        const pn = pen(pq.ro, dragPreview.sp);
        const ed = pn === 0 ? '#4ade80' : pn === 1 ? '#facc15' : '#f87171';
        const kc = dragPreview.sp === 'GK' ? gkCol : col;
        const sc = 0.56;
        return (
          <g className="pointer-events-none">
            <circle cx={gx} cy={gy} r={23} fill={`${ed}30`} stroke={ed} strokeWidth="2" strokeDasharray="3 2" />
            <circle cx={gx} cy={gy} r={18} fill={kc} stroke="#fff" strokeWidth="2.5" />
            <g
              transform={`translate(${(gx - 30 * sc).toFixed(1)},${(gy - 31 * sc).toFixed(1)}) scale(${sc})`}
              clipPath={`url(#fc-${uid})`}
              dangerouslySetInnerHTML={{ __html: faceBodySvg(visOf(pq, state.p), kc, trCol, 32, '#10281d', true, false) }}
            />
            <rect x={gx - 22} y={gy - 33} width="44" height="13" rx="6" fill="#0b2018" stroke={ed} strokeWidth="1.2" />
            <text x={gx} y={gy - 23.6} textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="Sarabun" fill={ed}>
              {dragPreview.sp}
            </text>
            <text
              x={clamp(gx, 28, 272)}
              y={gy + 29}
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fontFamily="Sarabun"
              fill="#fde047"
              stroke="#0b2018"
              strokeWidth="2.6"
              paintOrder="stroke"
            >
              {pq.n.split(' ')[0]}
            </text>
          </g>
        );
      })()}
    </svg>
  );
};

// Live 2D Match Pitch Canvas is rendered inside MatchModal (Section 13)


// ============================================================================
// 6. MAIN MENU VIEW
// ============================================================================
const MainMenu: React.FC<{
  onStartManager: (slot: number, names: string[][], t0: Team[], pick: number, diff: number) => void;
  onStartPlayer: (slot: number, profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>) => void;
  onLoadSave: (mode: GameMode, slot: number, state: GameState) => void;
  onToast: (msg: string) => void;
}> = ({ onStartManager, onStartPlayer, onLoadSave, onToast }) => {
  const [step, setStep] = useState<'menu' | 'ms' | 'cr'>('menu');
  const [targetSlot, setTargetSlot] = useState<number>(1);
  const [previewClubs, setPreviewClubs] = useState<{ names: string[][]; t0: Team[] } | null>(null);
  const [diff, setDiff] = useState<number>(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, setRefresh] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [crMobTab, setCrMobTab] = useState<'info' | 'face' | 'arch' | 'stats'>('info');

  const rollFaceTraits = () => ({
    c: P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111']),
    k: P(SKIN_P),
    h: P(HAIR_P),
    hs: R(0, 7),
    fh: R(0, 3),
    fs: R(0, 2),
    ey: R(0, 3)
  });

  const defaultNoForPos = (pos: Position) => (pos === 'GK' ? 1 : pos === 'DF' ? 4 : pos === 'MF' ? 8 : 10);

  const [cName, setCName] = useState('');
  const [cPos, setCPos] = useState<Position>('FW');
  const [cSp, setCSp] = useState<SubRole>('ST');
  const [cNo, setCNo] = useState<number>(10);
  const [cArchId, setCArchId] = useState<string>('poacher');
  const [cColor, setCColor] = useState(() => P(['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111']));
  const [cSkin, setCSkin] = useState(() => P(SKIN_P));
  const [cHair, setCHair] = useState(() => P(HAIR_P));
  const [cHs, setCHs] = useState(() => R(0, 7));
  const [cFh, setCFh] = useState(() => R(0, 3));
  const [cFs, setCFs] = useState(() => R(0, 2));
  const [cEy, setCEy] = useState(() => R(0, 3));
  const [faceChoices, setFaceChoices] = useState(() => Array.from({ length: 6 }, rollFaceTraits));
  const [cSubMap, setCSubMap] = useState<Record<string, number>>({});
  const [cBase, setCBase] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));
  const [cAttrs, setCAttrs] = useState<CoreAttrs>(() => ({ sh: 65, ps: 38, dr: 47, tk: 28, ph: 48 }));

  const computeBaseWithArch = (pos: Position, sp: SubRole, arch: PlayerArchetype): CoreAttrs => {
    const base = ROLE_BASE_ATTRS(pos, sp);
    (Object.keys(arch.coreBonus) as StatKey[]).forEach((k) => {
      base[k] = clamp(base[k] + (arch.coreBonus[k] || 0), 10, 99);
    });
    return base;
  };

  const rollStartingStats = (pos: Position, sp: SubRole, arch: PlayerArchetype) => {
    const base = computeBaseWithArch(pos, sp, arch);
    const attrs: CoreAttrs = { ...base };

    // Weighted pool for 12 random core points based on position + archetype
    const posCorePool: Record<Position, StatKey[]> = {
      FW: ['sh', 'sh', 'sh', 'dr', 'dr', 'ps', 'ph'],
      MF: ['ps', 'ps', 'ps', 'dr', 'dr', 'sh', 'tk', 'ph'],
      DF: ['tk', 'tk', 'tk', 'ph', 'ph', 'ps', 'dr'],
      GK: ['ph', 'ph', 'ph', 'tk', 'tk', 'ps']
    };
    const corePool: StatKey[] = [...posCorePool[pos], arch.tr, arch.tr];
    (Object.keys(arch.autoCorePts) as StatKey[]).forEach((k) => {
      const w = arch.autoCorePts[k] || 0;
      for (let i = 0; i < Math.ceil(w / 2); i++) corePool.push(k);
    });
    for (let i = 0; i < 12; i++) {
      const avail = corePool.filter((k) => attrs[k] < 99);
      if (!avail.length) break;
      const pick = P(avail);
      attrs[pick] = clamp(attrs[pick] + 1, 10, 99);
    }

    // Weighted pool for 8 random detailed sub-stat points
    const subPoolKeys: string[] =
      pos === 'GK'
        ? ['sv', 'sv', 'cl', 'cl', 'dist', 'comp', 'sta', 'tol', 'rec']
        : pos === 'FW'
          ? ['fin', 'fin', 'pw', 'cur', 'run', 'spd', 'crs', 'hd', 'str', 'sta', 'comp']
          : pos === 'MF'
            ? ['crs', 'cur', 'rd', 'run', 'fin', 'pw', 'pos', 'mrk', 'spd', 'sta', 'comp', 'rec']
            : ['pos', 'pos', 'rd', 'rd', 'mrk', 'mrk', 'blk', 'blk', 'hd', 'str', 'spd', 'crs', 'sta', 'tol', 'comp'];
    const subPool = [
      ...subPoolKeys,
      arch.sig,
      arch.sig,
      arch.sig,
      ...Object.keys(arch.sbBonus).flatMap((k) => [k, k]),
      ...Object.keys(arch.autoSubPts).flatMap((k) => [k, k])
    ];
    const subMap: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      const pick = P(subPool);
      if ((subMap[pick] || 0) < 8) {
        subMap[pick] = (subMap[pick] || 0) + 1;
      } else {
        const alt = P(subPoolKeys);
        subMap[alt] = (subMap[alt] || 0) + 1;
      }
    }
    return { base, attrs, subMap };
  };

  const openManagerSetup = (slot: number) => {
    if (!slot) {
      onToast('เซฟเต็ม กรุณาลบเซฟเก่าก่อน');
      return;
    }
    SFX.tap();
    clearNamePool();
    const names = genClubNames();
    const t0 = names[0].map((n, i) => mkTeam(n, 0, i));
    setTargetSlot(slot);
    setPreviewClubs({ names, t0 });
    setStep('ms');
  };

  const applyFaceTraits = (f: ReturnType<typeof rollFaceTraits>) => {
    setCColor(f.c);
    setCSkin(f.k);
    setCHair(f.h);
    setCHs(f.hs);
    setCFh(f.fh);
    setCFs(f.fs);
    setCEy(f.ey);
  };

  const openPlayerSetup = (slot: number) => {
    if (!slot) {
      onToast('เซฟเต็ม กรุณาลบเซฟเก่าก่อน');
      return;
    }
    SFX.tap();
    setTargetSlot(slot);
    const defaultArch = PLAYER_ARCHETYPES.find((a) => a.pos.includes('FW'))!;
    const rolled = rollStartingStats('FW', 'ST', defaultArch);
    const gallery = Array.from({ length: 6 }, rollFaceTraits);
    setFaceChoices(gallery);
    applyFaceTraits(gallery[0]);
    setCPos('FW');
    setCSp('ST');
    setCNo(defaultNoForPos('FW'));
    setCArchId(defaultArch.id);
    setCBase(rolled.base);
    setCAttrs(rolled.attrs);
    setCSubMap(rolled.subMap);
    setStep('cr');
  };

  const handleDeleteSlot = (mode: GameMode, k: number) => {
    const key = `${mode}_${k}`;
    if (confirmDel === key) {
      deleteSlot(mode, k);
      setConfirmDel(null);
      setRefresh((x) => x + 1);
      onToast('ลบเซฟเรียบร้อย');
    } else {
      setConfirmDel(key);
      setTimeout(() => setConfirmDel((cur) => (cur === key ? null : cur)), 3000);
    }
  };

  const handleImport = () => {
    const parsed = cleanImportJson(importText);
    if (!parsed) {
      onToast('โค้ดเซฟไม่ถูกต้อง');
      return;
    }
    const slot = firstEmptySlot(parsed.mode) || 1;
    onLoadSave(parsed.mode, slot, parsed);
    setShowImport(false);
    onToast(`นำเข้าเซฟลงสล็อต ${slot} แล้ว`);
  };

  const renderSlotList = (m: GameMode) => {
    const rows: React.ReactNode[] = [];
    let shownEmpty = false;
    for (let k = 1; k <= NSL; k++) {
      const d = loadGameFromSlot(m, k);
      if (d && Array.isArray(d.teams) && (m === 'm' || d.p)) {
        const name = m === 'm' ? d.club?.name || d.teams[d.me]?.name : d.p?.name;
        const delKey = `${m}_${k}`;
        const isConfirm = confirmDel === delKey;
        rows.push(
          <div key={k} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                onLoadSave(m, k, d);
              }}
              className="flex-1 min-w-0 text-left px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/75 hover:bg-[var(--surface-2)] hover:border-[var(--g)] transition-colors cursor-pointer"
            >
              <div className="font-semibold text-sm mland:text-[10.5px] truncate">▶ สล็อต {k} · {name}</div>
              <div className="text-xs mland:text-[9px] text-[var(--mut)] truncate tabular">
                ซีซั่น {d.season} · นัด {d.md}/{d.fx?.length || 30}
                {m === 'p' && d.p ? ` · ${d.p.pos} · ${d.p.ap} นัด` : ''}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteSlot(m, k)}
              aria-label="ลบเซฟ"
              className={`min-h-[42px] mland:min-h-[34px] px-3 mland:px-2.5 rounded-xl border text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors shrink-0 ${
                isConfirm ? 'bg-[var(--red-soft)] border-[var(--red)] text-[var(--red)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--mut)] hover:text-[var(--red)]'
              }`}
            >
              {isConfirm ? 'ยืนยันลบ?' : '🗑'}
            </button>
          </div>
        );
      } else if (!shownEmpty) {
        shownEmpty = true;
        rows.push(
          <button
            key={k}
            type="button"
            onClick={() => (m === 'm' ? openManagerSetup(k) : openPlayerSetup(k))}
            className="w-full text-left px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-xl border border-dashed border-[var(--line)] hover:border-[var(--g)] hover:bg-[var(--g-soft)]/40 transition-colors cursor-pointer"
          >
            <div className="font-semibold text-sm mland:text-[10.5px]">＋ สล็อต {k} · ว่าง</div>
            <div className="text-xs mland:text-[9px] text-[var(--mut)]">เริ่มเกมใหม่</div>
          </button>
        );
      }
    }
    return <div className="flex flex-col gap-1.5 mland:gap-1">{rows}</div>;
  };

  if (step === 'ms' && previewClubs) {
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-3 mland:py-1 flex flex-wrap items-center justify-between gap-2.5 mland:gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl mland:text-sm font-bold font-display truncate">🏟️ เลือกสโมสรเริ่มต้น</h2>
              <p className="text-xs text-[var(--mut)] truncate mland:hidden">เริ่มจากลีกระดับจังหวัด · แก้ชื่อ ตรา และสีชุดได้ภายหลัง</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 p-1 mland:p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                {(['ง่าย', 'ปกติ', 'ยาก'] as const).map((lbl, idx) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => { SFX.tap(); setDiff(idx); }}
                    className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors ${
                      diff === idx ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="px-3.5 mland:px-2.5 py-1.5 mland:py-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs sm:text-sm mland:text-[10.5px] font-semibold cursor-pointer"
              >
                ‹ กลับ
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-5xl mland:max-w-none mx-auto p-3 sm:p-5 mland:p-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mland:grid-cols-4 gap-2.5 mland:gap-1 mland:min-h-full mland:auto-rows-fr">
            {previewClubs.t0.map((t, idx) => {
              const avg = Math.round(t.sq.reduce((sum, q) => sum + q.ov, 0) / t.sq.length);
              const tierTag = avg >= 42 ? 'เต็งลีก' : avg >= 39 ? 'กลางตาราง' : 'ท้าทาย';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onStartManager(targetSlot, previewClubs.names, previewClubs.t0, idx, diff); }}
                  className="flex items-center gap-3 mland:gap-1.5 p-3 mland:p-1.5 rounded-2xl mland:rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--g)] active:scale-[0.99] text-left transition-all cursor-pointer shadow-xs min-w-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6 mland:[&>svg]:shrink-0"
                >
                  <ClubCrest name={t.name} size={34} team={t} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm mland:text-[10.5px] truncate leading-tight">{t.name}</div>
                    <div className="text-xs mland:text-[9px] text-[var(--mut)] truncate leading-tight">{tierTag} · {t.sq.length} คน</div>
                  </div>
                  <span className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg text-white text-xs mland:text-[10px] font-bold tabular shrink-0" style={{ background: ovColor(avg) }}>
                    {avg}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'cr') {
    const posArchs = PLAYER_ARCHETYPES.filter((a) => a.pos.includes(cPos));
    const curArch = posArchs.find((a) => a.id === cArchId) || posArchs[0];
    const combinedSb: Record<string, number> = { ...curArch.sbBonus };
    Object.entries(cSubMap).forEach(([k, v]) => {
      if (v) combinedSb[k] = (combinedSb[k] || 0) + v;
    });

    const ov = OVF(cPos, cAttrs);
    const previewPlayer: Player = { n: cName.trim() || 'นักเตะใหม่', pos: cPos, ro: cSp, ov, age: 17, pot: 92, fit: 100, inj: 0, no: cNo, me: 1 };
    const previewProfile: PlayerCareerProfile = {
      name: cName.trim() || 'นักเตะใหม่', pos: cPos, sp: cSp, no: cNo, tr: curArch.tr, sig: curArch.sig, archName: `${curArch.icon} ${curArch.name}`,
      sb: combinedSb, c: cColor, k: cSkin, h: cHair, hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, b: cBase, a: cAttrs,
      age: 17, gl: 0, as: 0, ap: 0, rs: 0, en: 100, plan: 1
    };
    const previewDt = dtInfo(previewPlayer, previewProfile);
    const subStats = previewDt.G;

    const applyRolledStats = (pos: Position, sp: SubRole, arch: PlayerArchetype) => {
      const rolled = rollStartingStats(pos, sp, arch);
      setCBase(rolled.base);
      setCAttrs(rolled.attrs);
      setCSubMap(rolled.subMap);
    };

    const changePosition = (pos: Position) => {
      SFX.tap();
      const sp = SPX[pos][0];
      const nextArch = PLAYER_ARCHETYPES.find((a) => a.pos.includes(pos))!;
      setCPos(pos);
      setCSp(sp);
      setCNo(defaultNoForPos(pos));
      setCArchId(nextArch.id);
      applyRolledStats(pos, sp, nextArch);
    };

    const changeSubRole = (sp: SubRole) => {
      SFX.tap();
      setCSp(sp);
      applyRolledStats(cPos, sp, curArch);
    };

    const changeArchetype = (arch: PlayerArchetype) => {
      SFX.tap();
      setCArchId(arch.id);
      applyRolledStats(cPos, cSp, arch);
    };

    const rerollStartingPoints = () => {
      SFX.tap();
      applyRolledStats(cPos, cSp, curArch);
    };

    const randomizeFaceOnly = () => {
      SFX.tap();
      const next = rollFaceTraits();
      applyFaceTraits({ ...next, c: cColor });
    };

    const rerollFaceGallery = () => {
      SFX.tap();
      const nextGallery = Array.from({ length: 6 }, rollFaceTraits);
      setFaceChoices(nextGallery);
      applyFaceTraits(nextGallery[0]);
    };

    const randomizeAll = () => {
      SFX.tap();
      setCName(genPlayerName());
      const nextGallery = Array.from({ length: 6 }, rollFaceTraits);
      setFaceChoices(nextGallery);
      applyFaceTraits(nextGallery[0]);
      const rSp = P(SPX[cPos]);
      const rArch = P(posArchs);
      setCSp(rSp);
      setCArchId(rArch.id);
      applyRolledStats(cPos, rSp, rArch);
    };

    const startCareerNow = () => {
      SFX.tap();
      onStartPlayer(targetSlot, {
        name: (cName || genPlayerName()).trim(), pos: cPos, sp: cSp, no: clamp(cNo || 10, 1, 99), tr: curArch.tr, sig: curArch.sig,
        archName: `${curArch.icon} ${curArch.name}`, sb: combinedSb, c: cColor, k: cSkin, h: cHair,
        hs: cHs, fh: cFh, fs: cFs, ey: cEy, pts: 0, a: { ...cAttrs }
      });
    };

    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)]">
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-2.5 mland:py-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl mland:text-sm font-bold font-display truncate">⚽ สร้างนักเตะอาชีพ</h2>
              <p className="text-[11px] sm:text-xs text-[var(--mut)] truncate mland:hidden">เลือกตำแหน่งและสไตล์ แล้วระบบจะสุ่มแต้มเริ่มต้นให้เข้ากับบทบาท</p>
            </div>
            <button type="button" onClick={() => setStep('menu')} className="px-3.5 mland:px-2.5 py-1.5 mland:py-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs sm:text-sm mland:text-[10.5px] font-semibold shrink-0 cursor-pointer">
              ‹ กลับ
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden overflow-x-hidden">
          <div className="max-w-5xl mland:max-w-none mx-auto p-3 sm:p-5 mland:p-1.5 grid grid-cols-1 lg:grid-cols-[280px_1fr] mland:grid-cols-[190px_1fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:h-full">
            <div className="lg:sticky lg:top-3 mland:static flex flex-col gap-2.5 mland:gap-1 mland:h-full mland:justify-between">
              <div className="rounded-3xl mland:rounded-2xl p-4 mland:p-2 text-white border border-white/20" style={{ background: `linear-gradient(155deg, ${ovColor(ov)}, #0b1f15 78%)` }}>
                <div className="flex items-center justify-between gap-3 mland:gap-1.5 mland:[&_svg]:w-12 mland:[&_svg]:h-12">
                  <div className="text-center">
                    <div className="text-4xl mland:text-xl font-bold font-display leading-none">{ov}</div>
                    <div className="text-xs mland:text-[9px] font-bold mt-1 mland:mt-0.5 border-t border-white/40 pt-1 mland:pt-0.5">{cSp} · #{cNo}</div>
                  </div>
                  <PlayerFace player={previewPlayer} careerProfile={previewProfile} size={68} bare />
                </div>
                <div className="text-center font-bold text-lg mland:text-xs border-b border-white/30 py-2 mland:py-0.5 truncate">{cName.trim() || 'ชื่อนักเตะ'}</div>
                <div className="text-center text-[11px] mland:text-[9px] font-semibold text-white/90 pt-1.5 mland:pt-0.5 truncate">
                  {curArch.icon} {curArch.name} · ⭐ {SIGL[curArch.sig]}
                </div>
                <div className="grid grid-cols-5 gap-1 pt-2 mland:pt-1 text-center text-[11px] mland:text-[9px]">
                  {ATT.map(([k, l]) => (
                    <div key={k}>
                      <div className="text-base mland:text-xs font-bold tabular">{cAttrs[k]}</div>
                      <div className="opacity-85">{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mland:gap-1 text-center">
                <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">อายุเริ่มต้น</div>
                  <div className="font-bold text-sm mland:text-[10.5px]">17 ปี</div>
                </div>
                <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">แต้มสุ่ม</div>
                  <div className="font-bold text-sm mland:text-[10.5px] text-[var(--g)]">+12 หลัก · +8 ย่อย</div>
                </div>
              </div>
            </div>

          <div className="flex flex-col gap-4 mland:gap-1 mland:h-full mland:min-h-0">
            <div className="hidden mland:grid mland:grid-cols-4 gap-1 p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              {(
                [
                  ['info', '📝 ข้อมูล & ตำแหน่ง'],
                  ['face', '🎭 หน้าตา & ชุด'],
                  ['arch', '⭐ จุดเด่น & แต้ม'],
                  ['stats', '📊 ค่าพลังละเอียด']
                ] as const
              ).map(([tid, tlbl]) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => { SFX.tap(); setCrMobTab(tid); }}
                  className={`py-1 px-1 rounded-lg text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                    crMobTab === tid ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tlbl}
                </button>
              ))}
            </div>
            <div className={`p-4 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'info' ? '' : 'mland:hidden'}`}>
              <h3 className="font-bold text-base mland:text-xs mb-2.5 mland:mb-1.5">ข้อมูล & ตำแหน่ง</h3>
              <div className="flex flex-wrap gap-2 mland:gap-1.5 mb-3 mland:mb-2">
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value.replace(/["'<>`]/g, ''))}
                  placeholder="กรอกชื่อนักเตะ (เว้นว่างจะสุ่มให้)"
                  maxLength={22}
                  className="flex-1 min-w-[160px] px-3 py-2.5 mland:py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm mland:text-xs"
                />
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
                  <span className="text-xs text-[var(--mut)] font-semibold">#</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    aria-label="หมายเลขเสื้อ"
                    value={cNo}
                    onChange={(e) => setCNo(clamp(parseInt(e.target.value, 10) || 1, 1, 99))}
                    className="w-11 bg-transparent text-sm font-bold text-center tabular focus:outline-none"
                  />
                </div>
                <button type="button" onClick={() => { SFX.tap(); setCName(genPlayerName()); }} className="px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm font-semibold shrink-0 cursor-pointer">
                  🔄 สุ่มชื่อ
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                {([['FW', 'กองหน้า'], ['MF', 'กองกลาง'], ['DF', 'กองหลัง'], ['GK', 'ผู้รักษาประตู']] as [Position, string][]).map(([p, l]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => changePosition(p)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
                      cPos === p ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {SPX[cPos].length > 1 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {SPX[cPos].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => changeSubRole(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          cSp === s ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s} · {SPN[s]}
                      </button>
                    ))}
                  </div>
                  {ROLE_HINT[cSp] && (
                    <p className="text-[11px] text-[var(--g)] font-semibold bg-[var(--g-soft)] px-2.5 py-1 rounded-lg">
                      💡 {cSp}: {ROLE_HINT[cSp]}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'face' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mland:mb-2">
                <div>
                  <h3 className="font-bold text-base mland:text-sm">รูปลักษณ์ & ใบหน้าแบบสุ่ม</h3>
                  <p className="text-xs text-[var(--mut)] mland:hidden">เลือกใบหน้าที่สุ่มมาให้หรือปรับแต่งทรงผม สีผิว และแววตาได้ตามใจ</p>
                </div>
                <button
                  type="button"
                  onClick={rerollFaceGallery}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer hover:border-[var(--g)]"
                >
                  🎲 สุ่มชุดใบหน้าใหม่
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-6 gap-2 mland:gap-1.5 mb-4 mland:mb-2.5">
                {faceChoices.map((f, idx) => {
                  const isPicked =
                    cSkin === f.k && cHair === f.h && cHs === f.hs && cFh === f.fh && cFs === f.fs && cEy === f.ey;
                  const sampleProfile: PlayerCareerProfile = {
                    ...previewProfile,
                    c: f.c,
                    k: f.k,
                    h: f.h,
                    hs: f.hs,
                    fh: f.fh,
                    fs: f.fs,
                    ey: f.ey
                  };
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        applyFaceTraits(f);
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        isPicked
                          ? 'bg-[var(--g-soft)] border-[var(--g)] ring-2 ring-[var(--g)]/30'
                          : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <PlayerFace player={previewPlayer} careerProfile={sampleProfile} size={48} />
                      <span className="text-[10px] font-semibold text-[var(--mut)] truncate w-full text-center">
                        {HS_N[f.hs]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2 mb-3 mland:mb-2">
                {[
                  ['สีชุด', ['#e4572e', '#2f6fd6', '#f4c63d', '#7c3aed', '#111111'], cColor, setCColor],
                  ['สีผิว', SKIN_P, cSkin, setCSkin],
                  ['สีผม', HAIR_P, cHair, setCHair]
                ].map(([lbl, cols, cur, setter]) => (
                  <div key={lbl as string}>
                    <div className="text-xs text-[var(--mut)] mb-1.5">{lbl as string}</div>
                    <div className="flex flex-wrap gap-2">
                      {(cols as string[]).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => (setter as React.Dispatch<React.SetStateAction<string>>)(col)}
                          className={`w-7 h-7 rounded-full border-2 border-white cursor-pointer ${cur === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                          style={{ background: col }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ['รูปหน้า', FS_N, cFs, setCFs],
                  ['แววตา', EY_N, cEy, setCEy],
                  ['ทรงผม', HS_N, cHs, setCHs],
                  ['หนวดเครา', FH_N, cFh, setCFh]
                ].map(([lbl, arr, cur, setter]) => (
                  <div key={lbl as string}>
                    <span className="text-[var(--mut)]">{lbl as string}:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(arr as string[]).map((l, i) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => (setter as React.Dispatch<React.SetStateAction<number>>)(i)}
                          className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${cur === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-4 mland:space-y-2.5 mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'arch' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base mland:text-sm">จุดเด่น & แต้มเริ่มต้น (สุ่มอัตโนมัติ)</h3>
                  <p className="text-xs text-[var(--mut)]">เลือกจุดเด่นที่ชอบ ระบบจะสุ่มอัปเกรดแต้มเริ่มต้นให้เข้ากับตำแหน่งและสายการเล่น</p>
                </div>
                <button
                  type="button"
                  onClick={rerollStartingPoints}
                  className="px-3 py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs font-bold cursor-pointer hover:brightness-105"
                >
                  🎲 สุ่มแต้มเริ่มต้นใหม่
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {posArchs.map((arch) => {
                  const active = curArch.id === arch.id;
                  const coreTags = (Object.entries(arch.coreBonus) as [StatKey, number][]).map(
                    ([k, v]) => `${ATT.find((x) => x[0] === k)?.[1]} +${v}`
                  );
                  const subTags = [
                    `${SIGL[arch.sig]} +8`,
                    ...Object.entries(arch.sbBonus).map(([k, v]) => `${SIGL[k] || k} +${v}`)
                  ];
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => changeArchetype(arch)}
                      className={`p-3 rounded-xl text-left border cursor-pointer transition-all ${
                        active ? 'bg-[var(--g)] text-white border-[var(--g)] shadow-sm' : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm">{arch.icon} {arch.name}</span>
                        {active && <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">เลือกอยู่</span>}
                      </div>
                      <div className={`text-[11px] mt-1 ${active ? 'text-white/90' : 'text-[var(--mut)]'}`}>{arch.desc}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {coreTags.map((tg) => (
                          <span key={tg} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-[var(--g-soft)] text-[var(--g)]'}`}>
                            {tg}
                          </span>
                        ))}
                        {subTags.map((tg) => (
                          <span key={tg} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${active ? 'bg-black/20 text-white/95' : 'bg-[var(--surface)] text-[var(--mut)] border border-[var(--line)]'}`}>
                            {tg}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">พลังหลักหลังสุ่มแต้มเริ่มต้น</span>
                  <span className="text-xs text-[var(--mut)]">สุ่มเพิ่ม +12 แต้มตามสาย</span>
                </div>
                <div className="space-y-2">
                  {ATT.map(([k, l]) => {
                    const rolledAdd = cAttrs[k] - cBase[k];
                    const archCoreAdd = curArch.coreBonus[k] || 0;
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-24 text-sm flex items-center gap-1">
                          <span>{l}</span>
                          {archCoreAdd > 0 && <span className="text-[10px] font-bold text-[var(--g)]">+{archCoreAdd}</span>}
                          {rolledAdd > 0 && <span className="text-[10px] font-bold text-[var(--lamp)]">+{rolledAdd}</span>}
                        </span>
                        <div className="flex-1 h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${cAttrs[k]}%`, background: rolledAdd > 0 ? 'var(--lamp)' : 'var(--g)' }} />
                        </div>
                        <span className="w-8 text-right font-bold tabular text-sm">{cAttrs[k]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`p-4 mland:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto ${crMobTab === 'stats' ? '' : 'mland:hidden'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm">ค่าพลังหลายด้าน (อัปเดตตามจุดเด่น & สุ่มแต้มเริ่มต้น)</h3>
                  <p className="text-[11px] text-[var(--mut)]">แสดงผลรวมจากพลังหลัก + จุดเด่น (⭐ / สีเขียว) + แต้มสุ่มเฉพาะทาง (+8, สีเหลือง)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2">
                {subStats.map((g) => (
                  <div key={g[0]} className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5">
                    <div className="font-bold text-xs mb-1">{g[0]}</div>
                    {g[1].map(([lbl, val, statKey]) => {
                      const isSig = statKey && statKey === curArch.sig;
                      const archBonus = statKey ? curArch.sbBonus[statKey] || 0 : 0;
                      const rolledSub = statKey ? cSubMap[statKey] || 0 : 0;
                      return (
                        <div key={lbl} className="flex items-center justify-between gap-2 text-xs py-0.5">
                          <span className="truncate flex items-center gap-1 min-w-0">
                            <span className={isSig ? 'font-bold text-[var(--g)]' : 'text-[var(--mut)]'}>{isSig ? '⭐ ' : ''}{lbl}</span>
                            {archBonus > 0 && <span className="text-[10px] font-bold text-[var(--g)]">+{archBonus}</span>}
                            {rolledSub > 0 && <span className="text-[10px] font-bold text-[var(--lamp)]">+{rolledSub}</span>}
                          </span>
                          <b className="tabular">{val}</b>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Pinned Bottom Action Bar inside Screen */}
        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-md">
          <div className="max-w-5xl mland:max-w-none mx-auto px-3 sm:px-5 py-2.5 mland:py-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={randomizeFaceOnly} className="px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)]">
                🎭 สุ่มใบหน้า
              </button>
              <button type="button" onClick={randomizeAll} className="px-3 py-2 mland:px-2.5 mland:py-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-xs mland:text-[10.5px] cursor-pointer hover:border-[var(--g)]">
                🔄 สุ่มทั้งหมด
              </button>
            </div>
            <button
              type="button"
              onClick={startCareerNow}
              className="flex-1 sm:flex-initial sm:min-w-[220px] py-2.5 mland:py-1 px-5 mland:px-4 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-[11px] hover:brightness-105 transition-all cursor-pointer shadow-sm"
            >
              ⚽ เริ่มอาชีพนักเตะ ({cSp} · OVR {ov})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-y-auto mland:overflow-hidden overflow-x-hidden flex flex-col bg-[var(--bg)]">
      <div className="w-full max-w-5xl mland:max-w-none m-auto mland:m-0 mland:h-full p-3 sm:p-5 mland:p-2.5 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] mland:grid-cols-[0.76fr_1.24fr] gap-4 lg:gap-6 mland:gap-3 items-center mland:items-stretch">
        <div className="text-center lg:text-left mland:text-left mland:flex mland:flex-col mland:justify-between mland:h-full mland:min-h-0 mland:game-card mland:p-2.5">
          <div>
            <svg viewBox="0 0 320 155" className="w-full max-w-[380px] mland:max-w-full mland:max-h-[86px] mx-auto lg:mx-0 mland:mx-0 rounded-3xl mland:rounded-xl border border-[var(--line)] mb-4 mland:mb-1.5 shadow-xs">
              <defs>
                <linearGradient id="sk_hero" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0b2018" />
                  <stop offset="1" stopColor="#1d6b42" />
                </linearGradient>
                <radialGradient id="gw_hero">
                  <stop offset="0" stopColor="#fff7c2" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#fff7c2" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="320" height="155" fill="url(#sk_hero)" />
              <circle cx="48" cy="34" r="44" fill="url(#gw_hero)" />
              <circle cx="272" cy="34" r="44" fill="url(#gw_hero)" />
              <path d="M48 34v70M272 34v70" stroke="#9fb3a5" strokeWidth="3" />
              <path d="M38 28h20v12H38zM262 28h20v12h-20z" fill="#fffbe0" />
              <path d="M60 90h200l60 65H0z" fill="#2a8f58" />
              <path d="M110 90h25l-15 65H40zM185 90h25l50 65h-40z" fill="#33a063" />
              <g fill="none" stroke="#eef2e6" strokeWidth="2" opacity="0.85">
                <path d="M160 90v65" />
                <ellipse cx="160" cy="124" rx="42" ry="12" />
              </g>
              <circle cx="160" cy="124" r="8" fill="#fff" stroke="#111" strokeWidth="1.5" />
            </svg>
            <h1 className="text-4xl md:text-5xl mland:text-xl font-bold font-display tracking-tight mb-2 mland:mb-0.5 leading-none">ลูกหนังไทย</h1>
            <p className="text-base mland:text-[10.5px] mland:leading-snug text-[var(--mut)] mb-3 mland:mb-1.5">จากลีกระดับจังหวัด สู่ลีกสูงสุดในประเทศ บอลถ้วยประชาชน และเวทีชิงแชมป์ทวีป</p>
            <p className="text-xs mland:text-[9.5px] text-[var(--mut)] leading-relaxed">
              ไต่ 3 ระดับ 48 ทีม · แข่งสด 2 มิติปรับแผนเรียลไทม์ · แมวมองและเส้นทางทีมชาติ
            </p>
          </div>
          <div className="hidden mland:block mt-auto pt-1.5">
            <PWAInstallButton variant="card" onToast={onToast} />
          </div>
        </div>

        <div className="flex flex-col gap-4 mland:gap-2 mland:h-full mland:min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openManagerSetup(firstEmptySlot('m'))}
              className="group relative overflow-hidden p-4 mland:p-2.5 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#fad05a] via-[#f5c242] to-[#e5ac24] text-[#261900] font-bold text-left shadow-sm hover:shadow-md hover:brightness-[1.03] transition-all cursor-pointer flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
                <span className="w-10 h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-black/10 flex items-center justify-center text-xl mland:text-base shrink-0">📋</span>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg mland:text-xs font-display leading-tight">โหมดผู้จัดการทีม</div>
                  <div className="text-xs mland:text-[9px] font-medium opacity-80 mt-0.5 mland:line-clamp-1">คุมแท็กติก แก้เกมสด ซื้อขายนักเตะ อัปเกรดสโมสร</div>
                </div>
              </div>
              <span className="text-lg mland:text-sm opacity-60 group-hover:translate-x-0.5 transition-transform shrink-0">›</span>
            </button>
            <button
              type="button"
              onClick={() => openPlayerSetup(firstEmptySlot('p'))}
              className="group relative overflow-hidden p-4 mland:p-2.5 rounded-2xl mland:rounded-xl bg-gradient-to-br from-[#1b9958] via-[#158049] to-[#0f6338] text-white font-bold text-left shadow-sm hover:shadow-md hover:brightness-[1.05] transition-all cursor-pointer flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
                <span className="w-10 h-10 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-white/15 flex items-center justify-center text-xl mland:text-base shrink-0">⚽</span>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg mland:text-xs font-display leading-tight">โหมดนักเตะอาชีพ</div>
                  <div className="text-xs mland:text-[9px] font-medium opacity-85 mt-0.5 mland:line-clamp-1">สร้างตัวละคร ฝึกซ้อม ปลดล็อกสกิล และติดทีมชาติ</div>
                </div>
              </div>
              <span className="text-lg mland:text-sm opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0">›</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-3 mland:gap-2 mland:flex-1 mland:min-h-0">
            <div className="p-3.5 mland:p-2.5 game-card mland:flex mland:flex-col mland:min-h-0">
              <div className="font-bold text-sm mland:text-[10.5px] mb-2 mland:mb-1.5 shrink-0 flex items-center justify-between text-[var(--ink)]">
                <span>เซฟโหมดผู้จัดการ</span>
                <span className="text-[10px] mland:text-[9px] font-medium text-[var(--mut)]">3 ช่อง</span>
              </div>
              <div className="mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5">{renderSlotList('m')}</div>
            </div>
            <div className="p-3.5 mland:p-2.5 game-card mland:flex mland:flex-col mland:min-h-0">
              <div className="font-bold text-sm mland:text-[10.5px] mb-2 mland:mb-1.5 shrink-0 flex items-center justify-between text-[var(--ink)]">
                <span>เซฟโหมดนักเตะ</span>
                <span className="text-[10px] mland:text-[9px] font-medium text-[var(--mut)]">3 ช่อง</span>
              </div>
              <div className="mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5">{renderSlotList('p')}</div>
            </div>
          </div>

          <div className="flex justify-end shrink-0">
            <button type="button" onClick={() => setShowImport(!showImport)} className="text-xs mland:text-[10px] font-semibold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer">
              📥 นำเข้าโค้ดเซฟจากเครื่องอื่น
            </button>
          </div>

          {showImport && (
            <div className="p-3.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="วางโค้ดเซฟที่นี่..."
                rows={1}
                className="w-full p-2 mland:p-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs mland:text-[10px] font-mono mb-1.5 mland:mb-1"
              />
              <button type="button" onClick={handleImport} className="px-4 py-1.5 mland:py-1 rounded-xl bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer">
                ยืนยันนำเข้าเซฟ
              </button>
            </div>
          )}

          <div className="mland:hidden">
            <PWAInstallButton variant="card" onToast={onToast} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. LEAGUE VIEW
// ============================================================================
const LeagueView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
}> = ({ state, onInspectTeam, onInspectPlayer, onUpdateState }) => {
  const me = state.teams[state.me];
  const vt = state.lg ?? me.tier;
  const sub = state.tv ?? 0;
  const [cmpSort, setCmpSort] = useState<'ovSq' | 'ovXi' | 'at' | 'df'>('ovSq');

  const tb = sortTable(state.teams.filter((t) => t.tier === vt));
  const myTierTable = vt === me.tier ? tb : sortTable(state.teams.filter((t) => t.tier === me.tier));
  const myRank = myTierTable.findIndex((t) => t.id === state.me) + 1;
  const ms = teamStats(me, state);

  const leagueRows = state.teams
    .filter((t) => t.tier === vt)
    .map((t) => ({ t, st: teamStats(t, state) }))
    .sort((a, b) => b.st[cmpSort] - a.st[cmpSort] || b.st.ovXi - a.st.ovXi);

  const renderMySummaryBanner = () => {
    const myRankPow =
      state.teams
        .filter((t) => t.tier === me.tier)
        .map((t) => ({ t, st: teamStats(t, state) }))
        .sort((a, b) => b.st.ovSq - a.st.ovSq)
        .findIndex((x) => x.t.id === state.me) + 1;
    const nTeams = myTierTable.length;
    const avgOf = (k: 'ovSq' | 'ovXi' | 'at' | 'df') => {
      const same = state.teams.filter((t) => t.tier === me.tier).map((t) => teamStats(t, state));
      return Math.round(same.reduce((sum, x) => sum + x[k], 0) / (same.length || 1));
    };

    return (
      <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex flex-wrap items-center justify-between gap-3 mland:gap-1.5">
        <div className="flex items-center gap-2.5 mland:gap-1.5 min-w-0">
          <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
            <ClubCrest name={me.name} size={30} team={me} club={state.club} isMyClub={state.mode === 'm'} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm mland:text-[11px] truncate flex items-center gap-1.5">
              <span className="truncate">{me.name}</span>
              <span className="text-[10px] mland:text-[9px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] shrink-0">★ ทีมฉัน</span>
            </div>
            <div className="text-xs mland:text-[9.5px] text-[var(--mut)] tabular">{TN[me.tier]} · อันดับ {myRank}/{nTeams} · {me.pts} แต้ม</div>
          </div>
        </div>
        <div className="flex items-center divide-x divide-[var(--line)] rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70 border border-[var(--line)]/80 ml-auto overflow-hidden">
          {(
            [
              ['พลัง', `#${myRankPow}/${nTeams}`, null],
              ['เฉลี่ย', ms.ovSq, ms.ovSq - avgOf('ovSq')],
              ['ตัวจริง', ms.ovXi, ms.ovXi - avgOf('ovXi')],
              ['บุก', ms.at, ms.at - avgOf('at')],
              ['รับ', ms.df, ms.df - avgOf('df')]
            ] as const
          ).map(([lbl, val, diff]) => (
            <div key={lbl} className="px-2.5 mland:px-1.5 py-1 mland:py-0.5 text-center min-w-[44px] mland:min-w-[34px]">
              <div className="text-[10px] mland:text-[8px] text-[var(--mut)] leading-tight">{lbl}</div>
              <div className="font-bold text-xs mland:text-[9.5px] tabular leading-tight">
                {val}
                {diff !== null && (
                  <span className={`ml-0.5 text-[9.5px] mland:text-[8px] ${diff > 0 ? 'text-[var(--g)]' : diff < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {vt !== me.tier && (
          <button type="button" onClick={() => onUpdateState((d) => { d.lg = me.tier; })} className="px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)] text-xs mland:text-[9.5px] font-bold cursor-pointer shrink-0">
            ดูลีกฉัน
          </button>
        )}
      </div>
    );
  };

  const renderStandings = () => (
    <div className="space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:grid mland:grid-cols-[1.42fr_0.85fr] mland:gap-2 mland:overflow-hidden">
      <div className="space-y-2.5 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="mland:hidden">{renderMySummaryBanner()}</div>
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
          <div className="shrink-0 grid grid-cols-[24px_22px_minmax(0,1fr)_22px_22px_22px_22px_30px_34px] sm:grid-cols-[26px_28px_1fr_28px_28px_28px_28px_36px_42px] items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 mland:py-0.5 text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--mut)] border-b border-[var(--line)] font-semibold">
            <span className="text-center">#</span>
            <span />
            <span className="truncate">{TN[vt]}</span>
            <span className="text-center">ล</span>
            <span className="text-center">ช</span>
            <span className="text-center">ส</span>
            <span className="text-center">พ</span>
            <span className="text-center">+/-</span>
            <span className="text-center">แต้ม</span>
          </div>
          <div className="divide-y divide-[var(--line)]/60 mland:flex-1 mland:min-h-0 mland:overflow-y-auto">
            {tb.map((t, i) => {
              const isPromo = i < 3 && vt < 2;
              const isRel = i >= tb.length - 3 && vt > 0;
              const isMe = t.id === state.me;
              const gd = t.gf - t.ga;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                  className={`w-full grid grid-cols-[24px_22px_minmax(0,1fr)_22px_22px_22px_22px_30px_34px] sm:grid-cols-[26px_28px_1fr_28px_28px_28px_28px_36px_42px] items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 mland:py-0.5 text-left text-[11px] sm:text-xs mland:text-[10px] transition-colors cursor-pointer ${
                    isMe ? 'bg-[var(--lamp-soft)] font-semibold' : isPromo ? 'bg-[var(--g-soft)] hover:bg-[var(--surface-2)]' : isRel ? 'bg-[var(--red-soft)] hover:bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="text-center tabular font-bold">
                    {i + 1}
                    {isPromo && <span className="text-[var(--g)]">▲</span>}
                    {isRel && <span className="text-[var(--red)]">▼</span>}
                  </span>
                  <ClubCrest name={t.name} size={20} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                  <div className="min-w-0">
                    <div className="truncate text-xs sm:text-[13px] mland:text-[10.5px]">
                      {t.name}
                      {isMe && <span className="ml-1 text-[10px] font-bold text-[var(--lamp)]">★</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 mland:hidden text-[10px] font-mono text-[var(--mut)]">
                      {(t.fm || '').slice(-5) || '—'}
                    </div>
                  </div>
                  <span className="text-center tabular">{t.p}</span>
                  <span className="text-center tabular">{t.w}</span>
                  <span className="text-center tabular">{t.d}</span>
                  <span className="text-center tabular">{t.l}</span>
                  <span className="text-center tabular">{gd > 0 ? `+${gd}` : gd}</span>
                  <span className="text-center tabular font-bold text-xs sm:text-sm mland:text-[10.5px]">{t.pts}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mland:text-[10px] text-[var(--mut)] px-1 shrink-0">
          <span>แตะชื่อทีมเพื่อส่องขุมกำลัง</span>
          {vt < 2 && <span><b className="text-[var(--g)]">▲</b> อันดับ 1-3 เลื่อนชั้น</span>}
          {vt > 0 ? <span><b className="text-[var(--red)]">▼</b> 3 อันดับท้ายตกชั้น</span> : <span>ลีกระดับจังหวัดไม่มีการตกชั้น</span>}
        </div>
      </div>

      <div className="space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
        <div className="hidden mland:block">{renderMySummaryBanner()}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-1 gap-3 mland:gap-2">
          <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="font-bold text-sm mland:text-xs mb-2 mland:mb-1.5">ผลล่าสุดของคุณ</div>
            {(state.res || []).length ? (
              <div className="space-y-1.5 mland:space-y-1">
                {state.res!.map((r, i) => (
                  <div key={i} className="text-xs mland:text-[11px] py-1 mland:py-0.5 border-b border-[var(--line)]/60 last:border-0">{r}</div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--mut)]">ยังไม่มีการแข่งขัน</p>
            )}
          </div>
          <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="font-bold text-sm mland:text-xs mb-2 mland:mb-1.5">ประวัติสโมสร/อาชีพ</div>
            {state.hist.length ? (
              <div className="space-y-1 max-h-36 mland:max-h-28 overflow-y-auto">
                {state.hist.slice().reverse().map((h, i) => (
                  <div key={i} className="text-xs mland:text-[11px] text-[var(--mut)] py-0.5">{h}</div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--mut)]">ยังไม่มีประวัติจบซีซั่น</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPowerComparison = () => {
    const minV = Math.min(...leagueRows.map((x) => x.st[cmpSort])) - 4;
    const maxV = Math.max(...leagueRows.map((x) => x.st[cmpSort]), minV + 8);
    const sortLabels: Record<'ovSq' | 'ovXi' | 'at' | 'df', string> = { ovSq: 'เฉลี่ยทีม', ovXi: '11 ตัวจริง', at: 'พลังบุก', df: 'พลังรับ' };
    return (
      <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mland:mb-2 shrink-0">
          <h3 className="font-bold text-sm mland:text-xs">📊 เทียบพลังทีม · {TN[vt]}</h3>
          <div className="flex flex-wrap gap-1">
            {(['ovSq', 'ovXi', 'at', 'df'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setCmpSort(k)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${cmpSort === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                {sortLabels[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:grid mland:grid-cols-2 mland:gap-1.5 mland:pr-0.5">
          {leagueRows.map(({ t, st }, idx) => {
            const val = st[cmpSort];
            const pct = Math.max(8, Math.min(100, Math.round(((val - minV) / (maxV - minV)) * 100)));
            const isMe = t.id === state.me;
            const df = val - ms[cmpSort];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onInspectTeam(t.id)}
                className={`w-full grid grid-cols-[24px_24px_minmax(0,1fr)_auto] sm:grid-cols-[24px_24px_minmax(0,1fr)_90px_auto] mland:grid-cols-[20px_22px_minmax(0,1fr)_auto] items-center gap-2 mland:gap-1.5 p-2 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  isMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/60 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <span className="text-xs font-bold text-center text-[var(--mut)] tabular">{idx + 1}</span>
                <ClubCrest name={t.name} size={22} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">{t.name} {isMe && <span className="text-[var(--lamp)]">★</span>}</div>
                  <div className="text-[11px] mland:text-[10px] text-[var(--mut)] truncate">ตัวจริง {st.ovXi} · หน้า {st.f} กลาง {st.m} หลัง {st.d} โกล์ {st.gk}</div>
                </div>
                <div className="hidden sm:block mland:hidden">
                  <div className="flex justify-between text-[11px] font-bold mb-0.5">
                    <span className="text-[var(--mut)]">{sortLabels[cmpSort]}</span>
                    <span className="tabular">{val}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ovColor(st.ovXi) }} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(st.ovSq) }}>{st.ovSq}</span>
                  {!isMe && (
                    <span className={`text-[11px] font-bold tabular ${df > 0 ? 'text-[var(--red)]' : df < 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                      {df > 0 ? `+${df}` : df}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPlayerStats = () => {
    const ts = state.teams.filter((t) => t.tier === vt);
    const ps = ts.flatMap((t) => t.sq.map((q) => ({ q, t })));
    const board = (ic: string, title: string, valFn: (q: Player) => number, fmt: (q: Player) => string, filterFn?: (q: Player) => boolean) => {
      const list = ps.filter((x) => (!filterFn || filterFn(x.q)) && valFn(x.q) > 0).sort((a, b) => valFn(b.q) - valFn(a.q) || b.q.ov - a.q.ov).slice(0, 5);
      return (
        <div className="p-3.5 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
          <h4 className="font-bold text-sm mland:text-xs mb-2 mland:mb-1.5">{ic} {title}</h4>
          {list.length ? (
            <div className="space-y-1.5 mland:space-y-1">
              {list.map((x, idx) => (
                <button
                  key={`${x.t.id}-${x.q.n}`}
                  type="button"
                  onClick={() => onInspectPlayer(x.q, x.t)}
                  className={`w-full flex items-center gap-2.5 mland:gap-1.5 p-1.5 mland:p-1 rounded-xl text-left cursor-pointer transition-colors ${x.t.id === state.me ? 'bg-[var(--lamp-soft)]' : 'hover:bg-[var(--surface-2)]'}`}
                >
                  <span className="w-4 text-xs font-bold text-[var(--mut)] text-center tabular">{idx + 1}</span>
                  <PlayerFace player={x.q} team={x.t} state={state} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{x.q.n}</div>
                    <div className="text-[11px] mland:text-[10px] text-[var(--mut)] truncate">{x.t.name} · {x.q.pos}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--g)] text-white text-xs font-bold tabular">{fmt(x.q)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--mut)]">ยังไม่มีข้อมูล</p>
          )}
        </div>
      );
    };
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-3 gap-3 mland:gap-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        {board('⚽', 'ดาวซัลโว', (q) => q.sg || 0, (q) => `${q.sg}`)}
        {board('🎯', 'แอสซิสต์สูงสุด', (q) => q.sa || 0, (q) => `${q.sa}`)}
        {board('✨', 'ประตู + แอสซิสต์', (q) => (q.sg || 0) + (q.sa || 0), (q) => `${(q.sg || 0) + (q.sa || 0)}`)}
        {board('🧤', 'คลีนชีต (ผู้รักษาประตู)', (q) => q.cs || 0, (q) => `${q.cs}`, (q) => q.pos === 'GK')}
        {board('💎', 'ค่าตัวสูงสุด', vlu, (q) => `${vlu(q)}k`)}
        {board('⭐', 'พลังรวมสูงสุด', (q) => q.ov, (q) => `${q.ov}`)}
      </div>
    );
  };

  return (
    <div className="space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      <div className="flex items-center justify-between gap-2 mland:gap-1.5 flex-nowrap overflow-x-auto shrink-0 pb-0.5">
        <div className="flex items-center p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {['จังหวัด', 'ในประเทศ 2', 'ในประเทศ 1'].map((lbl, idx) => (
            <button key={lbl} type="button" onClick={() => { SFX.tap(); onUpdateState((d) => { d.lg = idx; }); }} className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${vt === idx ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
              {lbl}{idx === me.tier ? ' ⭐' : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {['ตารางคะแนน', 'เทียบพลังทีม', 'สถิติผู้เล่น', 'ปฏิทินแข่ง'].map((lbl, idx) => (
            <button key={lbl} type="button" onClick={() => { SFX.tap(); onUpdateState((d) => { d.tv = idx; }); }} className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${sub === idx ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      {sub === 0 && renderStandings()}
      {sub === 1 && renderPowerComparison()}
      {sub === 2 && renderPlayerStats()}
      {sub === 3 && <ScheduleCalendarView state={state} onInspectTeam={onInspectTeam} />}
    </div>
  );
};

const ScheduleCalendarView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onPlayNext?: () => void;
  onOpenMarket?: () => void;
}> = ({ state, onInspectTeam, onPlayNext, onOpenMarket }) => {
  const me = state.teams[state.me];
  const totalMd = state.fx.length || 30;
  const defaultMonth = state.md >= totalMd ? 4 : Math.min(4, Math.floor(state.md / 6));
  const [monthIdx, setMonthIdx] = useState<number>(defaultMonth);
  const [roundPreview, setRoundPreview] = useState<number>(Math.min(state.md, Math.max(0, totalMd - 1)));
  const tw = getTransferWindowInfo(state);

  const months = [
    { idx: 0, label: 'เดือน 1', range: 'นัด 1–6', start: 0, end: 6 },
    { idx: 1, label: 'เดือน 2', range: 'นัด 7–12', start: 6, end: 12 },
    { idx: 2, label: 'เดือน 3', range: 'นัด 13–18', start: 12, end: 18 },
    { idx: 3, label: 'เดือน 4', range: 'นัด 19–24', start: 18, end: 24 },
    { idx: 4, label: 'เดือน 5', range: 'นัด 25–30', start: 24, end: totalMd }
  ];

  const visibleMdIndices =
    monthIdx === -1
      ? Array.from({ length: totalMd }, (_, i) => i)
      : Array.from(
          { length: Math.max(0, (months[monthIdx]?.end ?? totalMd) - (months[monthIdx]?.start ?? 0)) },
          (_, i) => (months[monthIdx]?.start ?? 0) + i
        ).filter((i) => i < totalMd);

  const previewRoundPairs = state.fx[roundPreview] || [];
  const cupLogs = state.cupLog || [];
  const progressPct = Math.round((Math.min(state.md, totalMd) / totalMd) * 100);

  return (
    <div className="grid grid-cols-1 gap-3 mland:grid-cols-[0.88fr_1.12fr] mland:grid-rows-[auto_1fr] mland:gap-2 mland:flex-1 mland:min-h-0 mland:overflow-hidden">
      {/* Top Season Calendar Overview */}
      <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-1 mland:col-start-1 mland:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1">
          <div>
            <h3 className="font-bold text-sm sm:text-base mland:text-[11px] flex items-center gap-1.5">
              <span>📅 ปฏิทิน & ตารางแข่ง · ซีซั่น {state.season}</span>
              <span className="text-xs mland:text-[9.5px] font-normal text-[var(--mut)]">({TN[me.tier]})</span>
            </h3>
            <p className="text-xs mland:text-[9.5px] text-[var(--mut)]">
              ความคืบหน้า: แข่งแล้ว {Math.min(state.md, totalMd)}/{totalMd} นัด ({progressPct}%)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mland:gap-1">
            {onOpenMarket && state.mode === 'm' ? (
              <button
                type="button"
                onClick={onOpenMarket}
                className={`px-3 mland:px-1.5 py-1.5 mland:py-0.5 rounded-xl text-xs mland:text-[9.5px] font-bold cursor-pointer border transition-colors ${
                  tw.open
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
                }`}
              >
                {tw.shortLabel} ›
              </button>
            ) : (
              <span
                className={`px-3 mland:px-1.5 py-1.5 mland:py-0.5 rounded-xl text-xs mland:text-[9.5px] font-bold border ${
                  tw.open
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/50 text-[var(--g)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
                }`}
              >
                {tw.shortLabel}
              </span>
            )}
            {onPlayNext && (
              <button
                type="button"
                onClick={onPlayNext}
                className="px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs mland:text-[10px] font-bold cursor-pointer"
              >
                {state.md >= totalMd ? '🏁 สรุปจบฤดูกาล' : state.pa ? '🌏 แข่งถ้วยทวีป' : state.pc ? '🏆 แข่งถ้วยประชาชน' : `▶ แข่งนัดที่ ${state.md + 1}`}
              </button>
            )}
          </div>
        </div>

        {/* Season Progress Bar */}
        <div className="h-2 mland:h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--g)] transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Key Calendar Events Legend */}
        <div className="flex flex-wrap gap-1.5 mland:gap-1 text-[11px] mland:text-[9px]">
          <span className="px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-semibold">🟢 ตลาดเปิดรอบ 1: นัด 1–6</span>
          <span className="px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-semibold">🟢 ตลาดเปิดรอบ 2: นัด 15–20</span>
          <span className="px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--lamp-soft)] text-[#7a4f00] dark:text-[var(--lamp)] font-semibold">🏆 ถ้วยประชาชน: นัด 6, 13, 20, 27</span>
          <span className="px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] text-[var(--ink)] font-semibold">🌏 ถ้วยทวีป: นัด 3, 10, 17, 24</span>
        </div>

        {/* Immediate Cup / Asia Banner */}
        {(state.pc || state.pa) && (
          <div className="p-3 mland:p-1.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
            <span className="font-bold">
              {state.pa && state.ac
                ? `🌏 คิวแข่งคั่นกลางสัปดาห์นี้: บอลถ้วยในทวีป ${RN[state.ac.r] || `รอบ ${state.ac.r + 1}`}`
                : `🏆 คิวแข่งคั่นกลางสัปดาห์นี้: ถ้วยประชาชน ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`}
            </span>
            {onPlayNext && (
              <button type="button" onClick={onPlayNext} className="px-3 py-1 mland:py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] font-bold cursor-pointer">
                ▶ ลงสนามนัดนี้
              </button>
            )}
          </div>
        )}
      </div>

      {/* Month / View Selector + Calendar Grid */}
      <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:col-start-2 mland:row-start-1 mland:row-span-2 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="flex flex-wrap items-center gap-1.5 mland:gap-1 shrink-0">
          {months.map((m) => {
            const isCurMonth = state.md >= m.start && state.md < m.end;
            return (
              <button
                key={m.idx}
                type="button"
                onClick={() => { SFX.tap(); setMonthIdx(m.idx); }}
                className={`px-2.5 mland:px-2 py-1.5 mland:py-1 rounded-xl text-xs mland:text-[11px] font-semibold cursor-pointer transition-colors border ${
                  monthIdx === m.idx
                    ? 'bg-[var(--g)] text-white border-[var(--g)]'
                    : isCurMonth
                      ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/50 text-[var(--ink)]'
                      : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                {m.label} <span className="opacity-80 text-[10px]">({m.range})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { SFX.tap(); setMonthIdx(-1); }}
            className={`px-2.5 mland:px-2 py-1.5 mland:py-1 rounded-xl text-xs mland:text-[11px] font-semibold cursor-pointer border ml-auto ${
              monthIdx === -1 ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
            }`}
          >
            📋 ดูทั้ง 30 นัด
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mland:grid-cols-2 gap-2.5 mland:gap-1.5 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
          {visibleMdIndices.map((mdIdx) => {
            const mdNum = mdIdx + 1;
            const rd = state.fx[mdIdx];
            const pair = rd?.find((x) => x.includes(state.me));
            if (!pair) return null;
            const isHome = pair[0] === state.me;
            const opp = state.teams[isHome ? pair[1] : pair[0]];
            const isDerby = (pair[0] ^ 1) === pair[1];
            const ost = teamStats(opp, state);
            const isNext = mdIdx === state.md && !state.pc && !state.pa;
            const isPast = mdIdx < state.md;
            const isWindowOpen = mdIdx < 6 || (mdIdx >= 14 && mdIdx < 20);
            const rec = state.schedRes?.[mdIdx];

            const cupIdx = [6, 13, 20, 27].indexOf(mdNum);
            const asiaIdx = [3, 10, 17, 24].indexOf(mdNum);

            let resLabel = '';
            let resCls = 'bg-[var(--surface-2)] text-[var(--mut)]';
            if (rec) {
              const myG = rec.h === state.me ? rec.gh : rec.ga;
              const opG = rec.h === state.me ? rec.ga : rec.gh;
              if (myG > opG) {
                resLabel = `ชนะ ${myG}-${opG}`;
                resCls = 'bg-[var(--g)] text-white';
              } else if (myG < opG) {
                resLabel = `แพ้ ${myG}-${opG}`;
                resCls = 'bg-[var(--red)] text-white';
              } else {
                resLabel = `เสมอ ${myG}-${opG}`;
                resCls = 'bg-[var(--lamp)] text-[#261900]';
              }
            } else if (isPast) {
              resLabel = 'แข่งแล้ว';
            }

            return (
              <div
                key={mdNum}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 transition-colors ${
                  isNext
                    ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] shadow-xs'
                    : isPast
                      ? 'bg-[var(--surface-2)]/45 border-[var(--line)]/80'
                      : 'bg-[var(--surface-2)]/80 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md font-bold tabular ${isNext ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)]'}`}>
                      นัด {mdNum}
                    </span>
                    <span className="font-semibold text-[var(--mut)]">{isHome ? '🏠 เหย้า' : '✈️ เยือน'}</span>
                    {isDerby && <span className="text-[var(--red)] font-bold">🔥 ดาร์บี้</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isWindowOpen && <span title="ช่วงเปิดตลาดซื้อขาย" className="text-[10px] font-bold text-[var(--g)]">🟢 ตลาด</span>}
                    {cupIdx >= 0 && <span title={`กำหนดถ้วยประชาชน ${RN[cupIdx]}`} className="text-[10px] font-bold text-[#9a6300] dark:text-[var(--lamp)]">🏆 ถ้วย</span>}
                    {asiaIdx >= 0 && <span title={`กำหนดถ้วยทวีป ${RN[asiaIdx]}`} className="text-[10px] font-bold text-[var(--g)]">🌏 ทวีป</span>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onInspectTeam(opp.id)}
                  className="flex items-center gap-2.5 text-left cursor-pointer group"
                >
                  <ClubCrest name={opp.name} size={30} team={opp} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs sm:text-sm truncate group-hover:text-[var(--g)] transition-colors">
                      {opp.name}
                    </div>
                    <div className="text-[11px] text-[var(--mut)]">
                      เฉลี่ย {ost.ovSq} · ตัวจริง {ost.ovXi}
                    </div>
                  </div>
                  {isPast ? (
                    <span className={`px-2 py-1 rounded-lg text-[11px] font-bold tabular shrink-0 ${resCls}`}>
                      {resLabel}
                    </span>
                  ) : isNext ? (
                    <span className="px-2 py-1 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-bold shrink-0">
                      ถัดไป
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--g)] font-semibold shrink-0">ส่องทีม ›</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom 2 Columns: Weekly League Fixtures & Cup Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-1 gap-3 mland:gap-2 mland:col-start-1 mland:row-start-2 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-xs sm:text-sm">📋 โปรแกรมคู่อื่นในลีก · นัดที่ {roundPreview + 1}</h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={roundPreview <= 0}
                onClick={() => setRoundPreview((r) => Math.max(0, r - 1))}
                className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-bold disabled:opacity-35 cursor-pointer"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={roundPreview >= totalMd - 1}
                onClick={() => setRoundPreview((r) => Math.min(totalMd - 1, r + 1))}
                className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-bold disabled:opacity-35 cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {previewRoundPairs.map(([hid, aid], i) => {
              const ht = state.teams[hid];
              const at = state.teams[aid];
              const involvesMe = hid === state.me || aid === state.me;
              const rec = involvesMe ? state.schedRes?.[roundPreview] : undefined;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs ${
                    involvesMe ? 'bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 font-semibold' : 'bg-[var(--surface-2)]/65'
                  }`}
                >
                  <button type="button" onClick={() => onInspectTeam(hid)} className="flex-1 text-right truncate hover:text-[var(--g)] cursor-pointer">
                    {ht.name}
                  </button>
                  <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[11px] font-bold tabular shrink-0">
                    {rec ? `${rec.gh}-${rec.ga}` : 'vs'}
                  </span>
                  <button type="button" onClick={() => onInspectTeam(aid)} className="flex-1 text-left truncate hover:text-[var(--g)] cursor-pointer">
                    {at.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
          <h4 className="font-bold text-xs sm:text-sm">🏆 ประวัติบอลถ้วยในฤดูกาลนี้</h4>
          {cupLogs.length ? (
            <div className="space-y-1.5">
              {cupLogs.map((cl, idx) => {
                const ht = state.teams[cl.h];
                const at = state.teams[cl.a];
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs">
                    <span className="font-bold shrink-0">
                      {cl.comp === 'asia' ? '🌏' : '🏆'} {RN[cl.r] || `รอบ ${cl.r + 1}`}
                    </span>
                    <span className="truncate text-center flex-1">
                      {ht?.name} <b>{cl.gh}-{cl.ga}</b> {at?.name}
                    </span>
                    {cl.penText && <span className="text-[10px] text-[var(--mut)] shrink-0">({cl.penText})</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-[var(--mut)] space-y-1">
              <p>ยังไม่มีผลบอลถ้วยในฤดูกาลนี้</p>
              <p>• บอลถ้วยทวีปจะแข่งช่วงนัดที่ 3, 10, 17, 24</p>
              <p>• ถ้วยประชาชนจะแข่งช่วงนัดที่ 6, 13, 20, 27</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 8. SQUAD & TACTICS VIEW
// ============================================================================
const CustomFormationModal: React.FC<{
  team: Team;
  kitColor: string;
  onClose: () => void;
  onSave: (cf: CustomSlot[]) => void;
}> = ({ team, kitColor, onClose, onSave }) => {
  const initial = (team.form === 'custom' && team.cf ? team.cf : FSD[team.form] || FSD['4-4-2']).map(
    (z) => [z[0], z[1], z[2]] as CustomSlot
  );
  const [slots, setSlots] = useState<CustomSlot[]>(initial);
  const [selIdx, setSelIdx] = useState(1);
  const [dragIdx, setDragIdx] = useState(-1);

  const autoRole = (x: number, y: number): SubRole => {
    const L = x < 22;
    const R_ = x > 78;
    if (y >= 70) return L ? 'LB' : R_ ? 'RB' : 'CB';
    if (y >= 58) return L ? 'LWB' : R_ ? 'RWB' : x < 45 ? 'LDM' : x > 55 ? 'RDM' : 'CDM';
    if (y >= 42) return L ? 'LM' : R_ ? 'RM' : x < 45 ? 'LCM' : x > 55 ? 'RCM' : 'CM';
    if (y >= 30) return L ? 'LM' : R_ ? 'RM' : 'CAM';
    return x < 26 ? 'LW' : x > 74 ? 'RW' : y > 20 ? 'CF' : 'ST';
  };

  const countPos = (p: string) => slots.filter((z) => LINE[z[0]] === p).length;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx < 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 300;
    const py = ((e.clientY - rect.top) / rect.height) * 340;
    const nx = Math.max(3, Math.min(97, Math.round((px - 18) / 2.64)));
    const ny = Math.max(8, Math.min(86, Math.round((py - 24) / 2.9)));
    setSlots((prev) => prev.map((z, idx) => (idx === dragIdx ? [autoRole(nx, ny), nx, ny] : z)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl max-h-[92dvh] mland:max-w-[96vw] mland:h-[96dvh] mland:max-h-[96dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 mland:px-3 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div>
            <h3 className="font-bold text-sm sm:text-base mland:text-xs">✏️ ปรับผังแผนเอง ({countPos('DF')}-{countPos('MF')}-{countPos('FW')})</h3>
            <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ลากวงกลมในสนามเพื่อวางตำแหน่ง หรือแตะเลือกตำแหน่งด้านข้าง</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 mland:w-7 mland:h-7 rounded-full bg-[var(--surface)] font-bold cursor-pointer shrink-0">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-3 sm:p-4 mland:p-2 grid grid-cols-1 md:grid-cols-[260px_1fr] mland:grid-cols-[205px_1fr] gap-4 mland:gap-2.5 items-start mland:items-stretch">
          <div className="mland:flex mland:flex-col mland:items-center mland:justify-center mland:h-full mland:min-h-0">
            <svg
              viewBox="0 0 300 340"
              className="w-full max-w-[260px] mland:h-full mland:max-h-[210px] mland:w-auto mland:max-w-full mx-auto rounded-xl select-none touch-none border border-[var(--line)]"
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDragIdx(-1)}
              onPointerCancel={() => setDragIdx(-1)}
            >
              <g dangerouslySetInnerHTML={{ __html: PITCH_SVG_BASE }} />
              {slots.map((z, i) => {
                const cx = 18 + z[1] * 2.64;
                const cy = 24 + z[2] * 2.9;
                return (
                  <g
                    key={i}
                    transform={`translate(${cx},${cy})`}
                    onPointerDown={(e) => {
                      if (i === 0) return;
                      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                      setDragIdx(i);
                      setSelIdx(i);
                    }}
                    className={i ? 'cursor-grab' : 'cursor-default'}
                  >
                    <circle r={i === selIdx ? 18 : 15} fill={kitColor} stroke={i === selIdx ? '#f5c242' : '#fff'} strokeWidth={3} />
                    <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" className="pointer-events-none">{z[0]}</text>
                  </g>
                );
              })}
            </svg>
            {countPos('DF') < 3 && <p className="text-xs text-[var(--red)] mt-1 text-center">⚠️ กองหลังน้อยกว่า 3 คน เกมรับจะเปราะบาง</p>}
            {countPos('FW') < 1 && <p className="text-xs text-[var(--red)] mt-1 text-center">⚠️ ไม่มีกองหน้าตัวเป้าเลย</p>}
          </div>

          <div className="space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-1">
            <div>
              <div className="text-xs font-bold mb-1">บทบาทของตำแหน่งที่เลือก: <span className="text-[var(--g)]">{slots[selIdx]?.[0]} · {SPN[slots[selIdx]?.[0]] || ''}</span></div>
              {ROLE_HINT[slots[selIdx]?.[0]] && (
                <p className="text-[11px] text-[var(--mut)] mb-1.5">💡 {ROLE_HINT[slots[selIdx]?.[0]]}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {POSL.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (selIdx <= 0) return;
                      setSlots((prev) => prev.map((z, idx) => (idx === selIdx ? [p, z[1], z[2]] : z)));
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer ${slots[selIdx]?.[0] === p ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold mb-1.5">เริ่มจากเทมเพลตมาตรฐาน</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(FSD).map((f) => (
                  <button key={f} type="button" onClick={() => { setSlots(FSD[f].map((z) => [z[0], z[1], z[2]])); setSelIdx(1); }} className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold cursor-pointer">
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 mland:px-3 mland:py-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-sm mland:text-xs cursor-pointer">ยกเลิก</button>
          <button type="button" onClick={() => onSave(slots)} className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs cursor-pointer">✅ ใช้แผนนี้</button>
        </div>
      </div>
    </div>
  );
};

const PitchPlayerModal: React.FC<{
  state: GameState;
  player: Player;
  onClose: () => void;
  onConfirm: (askPct: number) => void;
}> = ({ state, player, onClose, onConfirm }) => {
  const me = state.teams[state.me];
  const baseVal = Math.max(5, vlu(player));
  const [askPct, setAskPct] = useState<85 | 100 | 118>(100);
  const askAmt = Math.max(5, Math.round((baseVal * askPct) / 100));
  const options: { pct: 85 | 100 | 118; title: string; hint: string }[] = [
    { pct: 85, title: 'ขายด่วน (85%)', hint: 'โอกาสมีสโมสรยื่นข้อเสนอสูง รีบปล่อยตัว' },
    { pct: 100, title: 'ราคาตลาด (100%)', hint: 'สมดุลระหว่างค่าตัวกับความสนใจของสโมสรอื่น' },
    { pct: 118, title: 'ตั้งราคาสูง (118%)', hint: 'ได้ราคาดีหากมีทีมต้องการ แต่บางทีมอาจไม่ยื่น' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-md mland:max-w-xl mland:max-h-[95dvh] mland:flex mland:flex-col rounded-2xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden shadow-2xl">
        <div className="shrink-0 flex items-center gap-3 p-3.5 mland:p-2.5 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <PlayerFace player={player} team={me} state={state} size={44} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm mland:text-xs truncate">
              เสนอขาย {player.n} <span className="text-xs text-[var(--g)]">({player.ro})</span>
            </div>
            <div className="text-[11px] text-[var(--mut)]">
              อายุ {player.age} ปี · ประเมินตลาด {baseVal}k ฿ · ค่าเหนื่อย {ensureCon(player).wg}k/นัด
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-white font-bold text-sm tabular shrink-0" style={{ background: ovColor(player.ov) }}>
            {player.ov}
          </span>
        </div>

        <div className="p-4 mland:p-2.5 space-y-3 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto">
          <p className="text-xs mland:text-[11px] text-[var(--mut)] leading-relaxed mland:leading-snug">
            ระบบจะขึ้นบัญชีขาย <b>{player.n}</b> ในตลาดและส่งโปรไฟล์ให้สโมสรในระดับใกล้เคียงพิจารณา สโมสรที่สนใจจะยื่นข้อเสนอเข้ามาให้คุณกดตอบรับหรือโก่งราคา
          </p>

          <div className="space-y-2 mland:space-y-1.5">
            {options.map((opt) => {
              const price = Math.max(5, Math.round((baseVal * opt.pct) / 100));
              const active = askPct === opt.pct;
              return (
                <button
                  key={opt.pct}
                  type="button"
                  onClick={() => setAskPct(opt.pct)}
                  className={`w-full text-left p-2.5 mland:p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    active ? 'border-[var(--g)] bg-[var(--g-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--mut)]'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{opt.title}</div>
                    <div className="text-[11px] text-[var(--mut)]">{opt.hint}</div>
                  </div>
                  <div className="font-bold text-sm tabular shrink-0 text-[var(--g)]">{price}k ฿</div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => onConfirm(askPct)}
              className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold cursor-pointer"
            >
              📨 เสนอขายในราคา ~{askAmt}k ฿
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SquadTacticsView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectPlayer, onToast }) => {
  const me = state.teams[state.me];
  const isMgr = state.mode === 'm';
  const sub = state.sub ?? 0;
  const [luTab, setLuTab] = useState<0 | 1 | 2>(0);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [showFormationSheet, setShowFormationSheet] = useState(false);
  const [squadPosFilter, setSquadPosFilter] = useState<'ALL' | Position>('ALL');
  const [squadSort, setSquadSort] = useState<'pos' | 'ov' | 'fit' | 'age' | 'val' | 'goals'>('pos');
  const [pitchTargetName, setPitchTargetName] = useState<string | null>(null);
  const pitchSvgRef = useRef<SVGSVGElement | null>(null);

  const starters = xi(me);
  const slots = getFormationSlots(me);
  const r = rate(me, state);
  const bench = me.sq
    .filter((q) => !starters.includes(q))
    .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov);
  const offPosCount = starters.filter((q, i) => pen(q.ro, slots[i]?.sp || '') > 0).length;
  const avgFit = Math.round(starters.reduce((s, q) => s + (q.fit ?? 100), 0) / (starters.length || 1));

  const dragRef = useRef<{
    player: Player;
    fromSlot?: SubRole;
    fromPitchIdx?: number;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [dragUi, setDragUi] = useState<{ player: Player; fromSlot?: SubRole; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ name: string; slot?: string } | null>(null);
  const [pitchDragPreview, setPitchDragPreview] = useState<PitchDragPreview | null>(null);
  const pitchDragPreviewRef = useRef<PitchDragPreview | null>(null);

  const swapAnyPlayers = (nameA: string, nameB: string) => {
    const s = me.sq.find((q) => q.n === nameA);
    const p = me.sq.find((q) => q.n === nameB);
    if (!s || !p || s === p) return;
    const isS = starters.includes(s);
    const isP = starters.includes(p);
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      if (isS || isP) {
        const curXi = xi(t).map((q) => q.n);
        if (isS && isP) {
          const i1 = curXi.indexOf(s.n);
          const i2 = curXi.indexOf(p.n);
          if (i1 >= 0 && i2 >= 0) [curXi[i1], curXi[i2]] = [curXi[i2], curXi[i1]];
        } else {
          const starter = isS ? s : p;
          const subPlayer = isS ? p : s;
          const idx = curXi.indexOf(starter.n);
          if (idx >= 0) curXi[idx] = subPlayer.n;
        }
        t.lu = curXi;
      } else {
        const i1 = t.sq.findIndex((q) => q.n === s.n);
        const i2 = t.sq.findIndex((q) => q.n === p.n);
        if (i1 >= 0 && i2 >= 0) [t.sq[i1], t.sq[i2]] = [t.sq[i2], t.sq[i1]];
      }
    });
    onToast(`สลับ ${s.n.split(' ')[0]} ↔ ${p.n.split(' ')[0]} แล้ว`);
  };

  const moveStarterToZone = (slotIdx: number, nx: number, ny: number, newRole: SubRole, zoneLabel: string, playerName: string) => {
    if (slotIdx < 1 || slotIdx >= 11) return;
    SFX.tap();
    onUpdateState((draft) => {
      const t = draft.teams[draft.me];
      const curXi = xi(t).map((q) => q.n);
      const baseSlots = getFormationSlots(t);
      const nextCf: CustomSlot[] = baseSlots.map((z, idx) =>
        idx === slotIdx ? [newRole, nx, ny] : [z.sp, z.x, z.y]
      );
      t.lu = curXi;
      t.cf = nextCf;
      t.form = 'custom';
      t.tacFam = Math.max(45, t.tacFam ?? 65);
    });
    onToast(`📍 ย้าย ${playerName.split(' ')[0]} → ${newRole} (${zoneLabel})`);
  };

  const findDropAt = (x: number, y: number): { name: string; slot?: string } | null => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const hit = (el as Element).closest?.('[data-drop-player]');
      if (hit) {
        const name = hit.getAttribute('data-drop-player');
        if (name) return { name, slot: hit.getAttribute('data-drop-slot') || undefined };
      }
    }
    return null;
  };

  const clientToPitchCoords = (clientX: number, clientY: number): { px: number; py: number; inside: boolean } | null => {
    const svg = pitchSvgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    const ctm = svg.getScreenCTM?.();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const inv = pt.matrixTransform(ctm.inverse());
      return { px: inv.x, py: inv.y, inside };
    }
    return {
      px: ((clientX - rect.left) / Math.max(1, rect.width)) * 300,
      py: ((clientY - rect.top) / Math.max(1, rect.height)) * 340,
      inside
    };
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, q: Player, slotSp?: SubRole, slotIdx?: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      player: q,
      fromSlot: slotSp,
      fromPitchIdx: slotIdx,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false
    };
  };

  const dragActionsRef = useRef({
    onInspectPlayer,
    swapAnyPlayers,
    moveStarterToZone,
    me,
    isMgr,
    starters,
    slots
  });
  dragActionsRef.current = {
    onInspectPlayer,
    swapAnyPlayers,
    moveStarterToZone,
    me,
    isMgr,
    starters,
    slots
  };

  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null;
      pitchDragPreviewRef.current = null;
      setDragUi(null);
      setDropTarget(null);
      setPitchDragPreview(null);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!dragActionsRef.current.isMgr) return;
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (!d.active && dist > 6) {
        d.active = true;
      }
      if (!d.active) return;

      d.x = e.clientX;
      d.y = e.clientY;

      const pitchPt = clientToPitchCoords(e.clientX, e.clientY);
      if (d.fromPitchIdx !== undefined && d.fromPitchIdx >= 1 && pitchPt?.inside) {
        const { starters: curStarters, slots: curSlots } = dragActionsRef.current;
        let closestSwap: { name: string; slot?: string; dist: number } | null = null;
        curStarters.forEach((other, idx) => {
          if (idx === d.fromPitchIdx) return;
          const oz = curSlots[idx];
          if (!oz) return;
          const ox = 18 + oz.x * 2.64;
          const oy = 24 + oz.y * 2.9;
          const sDist = Math.hypot(pitchPt.px - ox, pitchPt.py - oy);
          if (sDist < 13 && (!closestSwap || sDist < closestSwap.dist)) {
            closestSwap = { name: other.n, slot: oz.sp, dist: sDist };
          }
        });
        if (closestSwap) {
          const swapObj = closestSwap as { name: string; slot?: string };
          pitchDragPreviewRef.current = null;
          setPitchDragPreview(null);
          setDropTarget({ name: swapObj.name, slot: swapObj.slot });
          setDragUi({ player: d.player, fromSlot: d.fromSlot, x: e.clientX, y: e.clientY });
          return;
        }

        const nx = clamp(Math.round((pitchPt.px - 18) / 2.64), 4, 96);
        const ny = clamp(Math.round((pitchPt.py - 24) / 2.9), 8, 84);
        const zone = getPitchZoneAt(nx, ny);
        const curSlotSp = curSlots[d.fromPitchIdx]?.sp;
        const resolvedSp: SubRole =
          zone.id === 'CF' && curSlotSp === 'SS'
            ? 'SS'
            : zone.sp;
        const preview: PitchDragPreview = {
          slotIdx: d.fromPitchIdx,
          player: d.player,
          x: nx,
          y: ny,
          sp: resolvedSp,
          zoneId: zone.id,
          zoneLabel: zone.label
        };
        pitchDragPreviewRef.current = preview;
        setPitchDragPreview(preview);
        setDropTarget(null);
        setDragUi(null);
        return;
      }

      pitchDragPreviewRef.current = null;
      setPitchDragPreview(null);
      setDragUi({ player: d.player, fromSlot: d.fromSlot, x: e.clientX, y: e.clientY });
      const hit = findDropAt(e.clientX, e.clientY);
      setDropTarget(hit && hit.name !== d.player.n ? hit : null);
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const preview = pitchDragPreviewRef.current;
      const wasActive = d.active;
      clearDrag();

      if (!wasActive) {
        SFX.tap();
        dragActionsRef.current.onInspectPlayer(d.player, dragActionsRef.current.me);
        return;
      }
      if (preview) {
        dragActionsRef.current.moveStarterToZone(
          preview.slotIdx,
          preview.x,
          preview.y,
          preview.sp,
          preview.zoneLabel,
          d.player.n
        );
        return;
      }
      const hit = findDropAt(e.clientX, e.clientY);
      if (hit && hit.name !== d.player.n) {
        dragActionsRef.current.swapAnyPlayers(d.player.n, hit.name);
      }
    };

    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      clearDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  const formName = (t: Team) => {
    if (t.form === 'custom') {
      const cnt = getFormationCounts(t);
      return `${cnt[1]}-${cnt[2]}-${cnt[3]} (ปรับเอง)`;
    }
    return t.form;
  };

  const coachAdvice = () => {
    const av = (p: 'MF' | 'FW' | 'DF') => {
      const idxList = starters.map((q, i) => ((slots[i]?.pos || q.pos) === p ? i : -1)).filter((i) => i >= 0);
      return idxList.reduce((s, i) => s + starters[i].ov, 0) / (idxList.length || 1);
    };
    const m = av('MF');
    const f = av('FW');
    const out: string[] = [];
    if (m > f + 4) out.push('กองกลางเด่น เหมาะบอลสั้น');
    if (f > m + 4) out.push('กองหน้าเด่น เหมาะบอลยาวหรือเกมสวน');
    if (av('DF') < m - 5) out.push('แนวรับอ่อน อย่าตั้งแนวรับสูง');
    if (starters.some((q) => (q.fit ?? 100) < 60)) out.push('มีตัวจริงเหนื่อย ลดเพรสซิ่งหรือโรเตชั่น');
    return 'คำแนะนำโค้ช: ' + (out.join(' · ') || 'ทีมสมดุล เลือกแผนได้ตามต้องการ');
  };

  const renderPlayerRow = (q: Player, slotSp?: SubRole) => {
    const f = Math.round(q.fit ?? 100);
    const fCol = q.inj > 0 || (q.sus || 0) > 0 ? 'var(--red)' : f >= 85 ? 'var(--g)' : f >= 65 ? '#c98a00' : 'var(--red)';
    const isSource = dragUi?.player.n === q.n;
    const isTarget = dropTarget?.name === q.n && dragUi?.player.n !== q.n;
    const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
    const pn = slotSp ? pen(q.ro, slotSp) : 0;
    const no = getShirtNo(me, q);

    return (
      <div
        key={q.n}
        role="button"
        tabIndex={0}
        data-drop-player={q.n}
        data-drop-slot={slotSp || ''}
        onPointerDown={(e) => handlePlayerPointerDown(e, q, slotSp)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            SFX.tap();
            onInspectPlayer(q, me);
          }
        }}
        className={`w-full flex items-center gap-1 px-1.5 py-1 mland:py-0.5 rounded-lg border text-left select-none transition-all ${
          isTarget
            ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-2 ring-[var(--lamp)]/40 scale-[1.01]'
            : isSource
              ? 'opacity-45 border-dashed border-[var(--lamp)] bg-[var(--surface-2)]'
              : isMe
                ? 'bg-[var(--lamp-soft)]/75 border-[var(--lamp)] ring-1 ring-[var(--lamp)]/45'
                : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
        } ${dragUi ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <span
          data-drag-grip={isMgr ? '1' : undefined}
          style={isMgr ? { touchAction: 'none' } : undefined}
          title={isMgr ? 'ลากเพื่อเปลี่ยนหรือสลับตำแหน่ง' : 'กด 1 ครั้งเพื่อดูข้อมูล'}
          className={`flex items-center shrink-0 [&_svg]:w-4 [&_svg]:h-4 ${isMgr ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
          <PlayerFace player={q} team={me} state={state} size={20} />
        </span>
        <span className="text-[9.5px] font-bold tabular text-[var(--mut)] min-w-[21px] text-center shrink-0 whitespace-nowrap">#{no}</span>
        <span className={`px-1 py-0.2 rounded text-[9px] font-bold text-white shrink-0 ${(slotSp ? LINE[slotSp] : q.pos) === 'DF' ? 'bg-blue-600' : (slotSp ? LINE[slotSp] : q.pos) === 'MF' ? 'bg-amber-600' : (slotSp ? LINE[slotSp] : q.pos) === 'GK' ? 'bg-purple-600' : 'bg-[var(--g)]'}`}>
          {slotSp || q.ro}
        </span>
        <span className="flex-1 min-w-0 text-[10.5px] mland:text-[9.5px] leading-tight font-semibold truncate">
          {isMe && <span className="inline-block px-1 mr-1 rounded bg-[var(--lamp)] text-[#261900] text-[8.5px] font-extrabold">ฉัน</span>}
          {me.cap === q.n && <span className="inline-block px-1 mr-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[8.5px] font-bold">C</span>}
          {q.n}
          {slotSp && slotSp !== q.ro && (
            <span className="ml-1 text-[8.5px] text-[var(--mut)]">({q.ro}{pn === 2 ? ' ⚠️' : ''})</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0 w-8 xl:w-10 mland:w-7">
          <div className="hidden xl:block mland:hidden flex-1 h-1 rounded-full bg-[var(--surface)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${q.inj > 0 || (q.sus || 0) > 0 ? 0 : f}%`, background: fCol }} />
          </div>
          <span className="text-[9.5px] mland:text-[8.5px] text-[var(--mut)] tabular w-full text-right">
            {(q.sus || 0) > 0 ? `🟥${q.sus}` : q.inj > 0 ? `🩹${q.inj}` : `${f}%`}
          </span>
        </div>
        <span className="px-1.5 py-0.2 rounded-md text-white text-[10px] mland:text-[9px] font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
          {q.ov}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      {dragUi && (
        <div
          className="fixed z-[100] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border-2 border-[var(--lamp)] shadow-2xl max-w-[200px]"
          style={{
            left: typeof window !== 'undefined' ? clamp(dragUi.x + 12, 8, window.innerWidth - 208) : dragUi.x + 12,
            top: typeof window !== 'undefined' ? clamp(dragUi.y - 24, 8, window.innerHeight - 68) : dragUi.y - 24
          }}
        >
          <PlayerFace player={dragUi.player} team={me} state={state} size={30} />
          <div className="text-xs min-w-0">
            <div className="font-bold truncate">{dragUi.player.n.split(' ')[0]} · {dragUi.fromSlot || dragUi.player.ro}</div>
            <div className="text-[11px] text-[var(--g)] font-semibold truncate">
              {dropTarget ? `↔ ${dropTarget.name.split(' ')[0]}${dropTarget.slot ? ` (${dropTarget.slot})` : ''}` : 'ลากไปวางเพื่อสลับ/ย้าย'}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mland:gap-1.5 flex-nowrap overflow-x-auto shrink-0">
        <div className="flex items-center p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 0; })} className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 0 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            ⚽ ตัวจริง<span className="hidden lg:inline mland:hidden"> & จัดตำแหน่ง</span>
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 1; })} className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 1 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            🧭 แผนเกม<span className="hidden lg:inline mland:hidden"> & ยุทธวิธี</span>
          </button>
          <button type="button" onClick={() => onUpdateState((d) => { d.sub = 2; })} className={`px-2.5 sm:px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${sub === 2 ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}>
            📋 ทั้งทีม ({me.sq.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 mland:gap-1 text-xs mland:text-[10px] font-semibold tabular whitespace-nowrap shrink-0 px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
          <span>แผน {formName(me)} · {AR_T[me.tac]}</span>
          <span className="opacity-35">·</span>
          <span>⚔️ {Math.round(r.at)} · 🛡️ {Math.round(r.df)}</span>
          <span className="opacity-35">·</span>
          <span>❤️ {avgFit}%</span>
          {offPosCount > 0 && (
            <>
              <span className="opacity-35">·</span>
              <span className="text-[var(--red)] font-bold">⚠️ นอกตำแหน่ง {offPosCount}</span>
            </>
          )}
        </div>
      </div>

      {sub === 0 ? (
        isMgr ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.22fr_0.78fr] mland:flex-1 mland:min-h-0 mland:grid-cols-[1.18fr_0.82fr] gap-3 mland:gap-2 items-stretch mland:overflow-hidden">
            {/* CENTER STAGE: Full-Size Pitch First + Collapsed 🧭 เปลี่ยนแผน Bar at Bottom */}
            <div className="relative p-2.5 sm:p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-1.5 mland:gap-1 mland:h-full mland:min-h-0 mland:overflow-hidden">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm mland:text-[10.5px] min-w-0">
                  <ClubCrest name={me.name} size={20} team={me} club={state.club} isMyClub={true} />
                  <span className="truncate">ตัวจริง 11 · {formName(me)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pitchDragPreview ? (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--g-soft)] text-[var(--g)] text-[10.5px] mland:text-[9px] font-bold whitespace-nowrap">
                      📍 {pitchDragPreview.player.n.split(' ')[0]} → {pitchDragPreview.sp} ({pitchDragPreview.zoneLabel})
                    </span>
                  ) : (
                    <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] whitespace-nowrap">
                      เข้าใจ <b className="text-[var(--g)] tabular">{me.tacFam ?? 65}%</b>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateState((d) => { d.sub = 1; })}
                    className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g)] hover:text-white border border-[var(--line)] text-[10.5px] mland:text-[9px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    ⚙️ ปรับละเอียด
                  </button>
                </div>
              </div>

              <div className="w-full max-w-[430px] mland:max-w-none mland:w-full mx-auto flex-1 min-h-0 h-full flex items-center justify-center">
                <FormationPitch
                  team={me}
                  state={state}
                  svgRef={pitchSvgRef}
                  showPositionZones={Boolean(pitchDragPreview)}
                  dragSourceName={dragUi?.player.n || null}
                  dropTargetName={dropTarget?.name || null}
                  dragPreview={pitchDragPreview}
                  onPlayerPointerDown={handlePlayerPointerDown}
                />
              </div>

              {showFormationSheet && (
                <div className="absolute inset-x-2 bottom-11 mland:inset-x-1.5 mland:bottom-8 z-20 p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)]/98 backdrop-blur-md border border-[var(--g)]/50 shadow-2xl space-y-2 mland:space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs mland:text-[10px]">
                    <span className="font-bold text-[var(--ink)]">🧭 เปลี่ยนแผน & สไตล์การเล่น</span>
                    <button
                      type="button"
                      onClick={() => setShowFormationSheet(false)}
                      className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[10.5px] mland:text-[9px] font-bold cursor-pointer"
                    >
                      ✕ ปิด
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.keys(FSD).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => {
                            const t = d.teams[d.me];
                            if (t.form !== f) {
                              t.form = f;
                              t.lu = null;
                              t.tacFam = Math.max(40, (t.tacFam ?? 65) - 10);
                            }
                          });
                        }}
                        className={`px-1 py-1.5 mland:py-1 rounded-lg text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                          me.form === f
                            ? 'bg-[var(--g)] text-white shadow-xs'
                            : 'bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--g)]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onUpdateState((d) => { d.teams[d.me].tac = k; })}
                        className={`px-1 py-1.5 mland:py-1 rounded-lg text-[10.5px] mland:text-[9.5px] font-bold cursor-pointer truncate transition-colors ${
                          me.tac === k ? 'bg-[var(--lamp)] text-[#261900] shadow-xs' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsed Slim Trigger Bar at Bottom */}
              <div className="pt-1 mland:pt-0.5 border-t border-[var(--line)]/60 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    setShowFormationSheet((v) => !v);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 mland:px-2 py-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:border-[var(--g)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer transition-colors"
                >
                  <span className="truncate">
                    🧭 เปลี่ยนแผน · <span className="text-[var(--g)]">{formName(me)}</span> · <span className="text-[var(--mut)]">{AR_T[me.tac]}</span>
                  </span>
                  <span className="text-[10.5px] mland:text-[9px] text-[var(--g)] shrink-0">
                    {showFormationSheet ? 'ซ่อน ▾' : 'เลือกแผน ▲'}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT: Squad & Bench List */}
            <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col lg:max-h-[calc(100dvh-215px)] min-h-[260px] mland:min-h-0 mland:max-h-none mland:h-full">
              <div className="flex items-center justify-between gap-1.5 mb-1.5 mland:mb-1 shrink-0">
                <div className="font-bold text-xs mland:text-[10px] truncate">
                  👥 รายชื่อ <span className="text-[10px] mland:text-[8.5px] font-normal text-[var(--mut)]">({me.lu ? 'จัดเอง' : 'อัตโนมัติ'})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    onUpdateState((d) => { d.teams[d.me].lu = null; });
                    onToast('จัด 11 ตัวจริงอัตโนมัติแล้ว');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[10.5px] mland:text-[9px] font-semibold hover:bg-[var(--g)] hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  จัดอัตโนมัติ
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] mb-1.5 mland:mb-1 shrink-0">
                {([['ทั้งหมด', 0], ['ตัวจริง (11)', 1], [`สำรอง (${bench.length})`, 2]] as const).map(([l, k]) => (
                  <button key={k} type="button" onClick={() => setLuTab(k)} className={`py-0.5 rounded-lg text-[10.5px] mland:text-[9px] font-semibold cursor-pointer truncate ${luTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}>{l}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mland:space-y-0.5 pr-0.5">
                {luTab !== 2 && (<><div className="text-[11px] mland:text-[9px] font-bold text-[var(--g)] pt-0.5">ตัวจริง (11 คน)</div>{starters.map((q, i) => renderPlayerRow(q, slots[i]?.sp))}</>)}
                {luTab !== 1 && (<><div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] pt-1.5 mland:pt-1">ตัวสำรอง ({bench.length} คน)</div>{bench.map((q) => renderPlayerRow(q))}</>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] mland:flex-1 mland:min-h-0 mland:grid-cols-[1.18fr_0.82fr] gap-3 mland:gap-2 items-stretch mland:overflow-hidden">
            <div className="p-3 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-2 mland:gap-1 mland:h-full mland:min-h-0 mland:overflow-hidden">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 mland:gap-1 font-bold text-sm mland:text-[10.5px] min-w-0">
                  <ClubCrest name={me.name} size={22} team={me} club={state.club} isMyClub={false} />
                  <span className="truncate">ตัวจริง 11 · {formName(me)}</span>
                </div>
                <span className="text-[11px] mland:text-[9.5px] text-[var(--mut)] shrink-0">เข้าใจ <b className="text-[var(--g)] tabular">{me.tacFam ?? 65}%</b></span>
              </div>

              <div className="w-full max-w-[400px] mland:max-w-none mland:w-full mx-auto mland:flex-1 mland:min-h-0 mland:h-full mland:flex mland:items-center mland:justify-center">
                <FormationPitch
                  team={me}
                  state={state}
                  showPositionZones={false}
                  onPlayerPointerDown={handlePlayerPointerDown}
                />
              </div>

              {(() => {
                const myIdx = starters.findIndex((q) => q.me || q.n === state.p?.name);
                const mySlot = myIdx >= 0 ? slots[myIdx]?.sp : null;
                const mySq = me.sq.find((q) => q.me || q.n === state.p?.name);
                const isBanned = (mySq?.sus || state.p?.sus || 0) > 0;
                return (
                  <div className="pt-2 mland:pt-1 border-t border-[var(--line)] text-center space-y-1 shrink-0">
                    <div className="text-xs mland:text-[10px]">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${isBanned ? 'bg-[var(--red-soft)] text-[var(--red)]' : mySlot ? 'bg-[var(--lamp-soft)] text-[#9a6700] dark:text-[var(--lamp)]' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                        {isBanned ? `🟥 ติดโทษแบน (เหลือ ${mySq?.sus || state.p?.sus} นัด)` : mySlot ? `★ ฉัน: ตัวจริง (${mySlot})` : '🪑 ฉัน: ตัวสำรอง (มีโอกาสลงสำรองครึ่งหลัง)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--mut)] mland:hidden">💡 กด 1 ครั้งเพื่อดูข้อมูลนักเตะ · โค้ชเลือกตัวจริงจากพลังและพลังกาย (Energy)</p>
                  </div>
                );
              })()}
            </div>

            <div className="p-2.5 mland:p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col lg:max-h-[calc(100dvh-250px)] min-h-[280px] mland:min-h-0 mland:max-h-none mland:h-full">
              <div className="font-bold text-xs mland:text-[10.5px] mb-1.5 mland:mb-1 shrink-0">👥 รายชื่อทีม</div>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] mb-1.5 mland:mb-1 shrink-0">
                {([['ทั้งหมด', 0], ['ตัวจริง (11)', 1], [`สำรอง (${bench.length})`, 2]] as const).map(([l, k]) => (
                  <button key={k} type="button" onClick={() => setLuTab(k)} className={`py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-semibold cursor-pointer truncate ${luTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}>{l}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mland:space-y-0.5 pr-0.5">
                {luTab !== 2 && (<><div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--g)] pt-0.5">ตัวจริง (11 คน)</div>{starters.map((q, i) => renderPlayerRow(q, slots[i]?.sp))}</>)}
                {luTab !== 1 && (<><div className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] pt-1.5 mland:pt-1">ตัวสำรอง ({bench.length} คน)</div>{bench.map((q) => renderPlayerRow(q))}</>)}
              </div>
            </div>
          </div>
        )
      ) : sub === 1 ? (
        <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-4 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mland:pb-1.5 border-b border-[var(--line)] shrink-0">
            <div>
              <h3 className="font-bold text-base mland:text-xs">🧭 แผนเกม & ยุทธวิธี · {formName(me)}</h3>
              <p className="text-xs mland:text-[10px] text-[var(--mut)]">ความเข้าใจแผน: <b className="text-[var(--g)]">{me.tacFam ?? 65}%</b> · ยิ่งใช้แผนเดิมนาน ยิ่งได้โบนัสพลังทีม</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs mland:text-[10px]">
              <span className="px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">สไตล์: {AR_T[me.tac]}</span>
              <span className="px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">เพรส: {['ต่ำ', 'กลาง', 'สูง'][me.press ?? 1]}</span>
              <span className="px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)] font-semibold">จังหวะ: {['ช้า', 'กลาง', 'เร็ว'][me.tempo ?? 1]}</span>
            </div>
          </div>

          {isMgr ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-3 mland:flex-1 mland:min-h-0 mland:overflow-hidden">
              <div className="space-y-4 mland:space-y-2.5 mland:h-full mland:overflow-y-auto mland:pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] mland:grid-cols-[120px_1fr] gap-3 mland:gap-2 items-center">
                  <TacticsMiniPitch team={me} state={state} />
                  <div>
                    <div className="text-xs font-bold mb-1.5">เลือกระบบการเล่น</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(FSD).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              const t = d.teams[d.me];
                              if (t.form !== f) {
                                t.form = f;
                                t.lu = null;
                                t.tacFam = Math.max(40, (t.tacFam ?? 65) - 10);
                              }
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${me.form === f ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)]'}`}
                        >
                          {f}
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowCustomEditor(true)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${me.form === 'custom' ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--ink)]'}`}>
                        ✏️ ปรับแผนเอง
                      </button>
                    </div>
                    <p className="text-xs text-[var(--mut)] mt-2">{coachAdvice()}</p>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1.5">⚡ ชุดยุทธวิธีสำเร็จรูป</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {PRE.map(([lbl, cfg]) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => { Object.assign(d.teams[d.me], cfg); d.teams[d.me].lu = null; });
                          onToast(`ใช้ยุทธวิธี "${lbl}"`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g)] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-bold mb-1.5">💾 บันทึก / โหลดแผนด่วน</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1].map((idx) => (
                      <React.Fragment key={idx}>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateState((d) => {
                              const t = d.teams[d.me];
                              d.slots = d.slots || [null, null];
                              d.slots[idx] = { form: t.form, cf: t.cf, tac: t.tac, press: t.press, tempo: t.tempo, wid: t.wid, line: t.line, pass: t.pass };
                            });
                            onToast(`บันทึกแผน ${idx + 1} แล้ว`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold cursor-pointer"
                        >
                          บันทึก {idx + 1}
                        </button>
                        <button
                          type="button"
                          disabled={!state.slots?.[idx]}
                          onClick={() => {
                            onUpdateState((d) => {
                              const s = d.slots?.[idx];
                              if (s) { Object.assign(d.teams[d.me], s); d.teams[d.me].lu = null; }
                            });
                            onToast(`โหลดแผน ${idx + 1} แล้ว`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          โหลด {idx + 1}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-1">
                <div>
                  <div className="text-xs font-bold mb-1">สไตล์การเล่น (Mentality)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((k) => (
                      <button key={k} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tac = k; })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${me.tac === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
                        {AR_T[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">เพรสซิ่ง</div>
                    <div className="flex gap-1">
                      {['ต่ำ', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].press = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.press ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">จังหวะเกม</div>
                    <div className="flex gap-1">
                      {['ช้า', 'กลาง', 'เร็ว'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].tempo = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.tempo ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold mb-1">ความกว้าง</div>
                    <div className="flex gap-1">
                      {['แคบ', 'กลาง', 'กว้าง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].wid = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.wid ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-1">แนวรับ</div>
                    <div className="flex gap-1">
                      {['ลึก', 'กลาง', 'สูง'].map((l, k) => (
                        <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].line = k; })} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.line ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1">สไตล์การจ่ายบอล</div>
                  <div className="flex flex-wrap gap-1.5">
                    {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((l, k) => (
                      <button key={l} type="button" onClick={() => onUpdateState((d) => { d.teams[d.me].pass = k; })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${(me.pass ?? 1) === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold block mb-1">👑 กัปตันทีม</label>
                    <select
                      value={me.cap || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => { d.teams[d.me].cap = val; });
                        onToast('อัปเดตกัปตันทีมแล้ว');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                    >
                      <option value="">ไม่ระบุ</option>
                      {me.sq.slice().sort((a, b) => b.ov - a.ov).slice(0, 10).map((q) => (
                        <option key={q.n} value={q.n}>{q.n} (OVR {q.ov})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">🌟 โฟกัสปั้นพิเศษ (ซ้อมเร็ว 2.2x)</label>
                    <select
                      value={state.focusPlayer || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateState((d) => { d.focusPlayer = val || null; });
                        onToast(val ? `โฟกัสฝึกซ้อมพิเศษให้ ${val}` : 'ยกเลิกโฟกัสรายบุคคล');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                    >
                      <option value="">ไม่เจาะจง</option>
                      {me.sq.filter((q) => q.age < 28).sort((a, b) => (b.pot || b.ov) - (a.pot || a.ov)).slice(0, 12).map((q) => (
                        <option key={q.n} value={q.n}>{q.n} ({q.age} ปี · {q.ov}→{q.pot})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold">🤖 กฎปรับแผนอัตโนมัติในแมตช์</span>
                    {(state.rules || []).length < 3 && (
                      <button
                        type="button"
                        onClick={() => onUpdateState((d) => {
                          d.rules = [...(d.rules || []), { c: 'tr', min: 65, tac: 'A' }];
                        })}
                        className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[11px] font-semibold cursor-pointer"
                      >
                        ＋ เพิ่มกฎ
                      </button>
                    )}
                  </div>
                  {(state.rules || []).length === 0 ? (
                    <p className="text-[11px] text-[var(--mut)]">ยังไม่มีกฎอัตโนมัติ (เช่น ถ้าตามอยู่ หลังนาที 65 ให้เปลี่ยนเป็นบุกหนัก)</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(state.rules || []).map((rl, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-[var(--surface-2)] text-xs">
                          <select
                            value={rl.c}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].c = e.target.value as AutoRule['c']; })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_C).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <span>หลังนาที</span>
                          <select
                            value={rl.min}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].min = Number(e.target.value); })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {[45, 60, 70, 75, 80].map((m) => <option key={m} value={m}>{m}&apos;</option>)}
                          </select>
                          <span>→</span>
                          <select
                            value={rl.tac}
                            onChange={(e) => onUpdateState((d) => { if (d.rules?.[idx]) d.rules[idx].tac = e.target.value as Mentality; })}
                            className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold"
                          >
                            {Object.entries(AR_T).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => onUpdateState((d) => { d.rules = (d.rules || []).filter((_, j) => j !== idx); })}
                            className="ml-auto px-2 py-1 text-[var(--red)] font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-4 items-center">
              <TacticsMiniPitch team={me} state={state} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">ระบบการเล่น</div>
                  <div className="font-bold mt-0.5">{formName(me)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">สไตล์ & การจ่าย</div>
                  <div className="font-bold mt-0.5">{AR_T[me.tac]} · {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'][me.pass ?? 1]}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">แนวรับ & ความกว้าง</div>
                  <div className="font-bold mt-0.5">{['ลึก', 'กลาง', 'สูง'][me.line ?? 1]} · {['แคบ', 'กลาง', 'กว้าง'][me.wid ?? 1]}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[11px] text-[var(--mut)]">กัปตันทีม</div>
                  <div className="font-bold mt-0.5 truncate">{me.cap || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 sm:p-4 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-1.5 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden">
          {(() => {
            const tx = getLeagueTransferContext(state, me);
            const posCounts: Record<Position, number> = {
              GK: me.sq.filter((q) => q.pos === 'GK').length,
              DF: me.sq.filter((q) => q.pos === 'DF').length,
              MF: me.sq.filter((q) => q.pos === 'MF').length,
              FW: me.sq.filter((q) => q.pos === 'FW').length
            };
            const listRows = me.sq
              .filter((q) => squadPosFilter === 'ALL' || q.pos === squadPosFilter)
              .slice()
              .sort((a, b) => {
                if (squadSort === 'ov') return b.ov - a.ov || (b.pot || b.ov) - (a.pot || a.ov);
                if (squadSort === 'fit') return (b.fit ?? 100) - (a.fit ?? 100) || b.ov - a.ov;
                if (squadSort === 'age') return a.age - b.age || b.ov - a.ov;
                if (squadSort === 'val') return vlu(b) - vlu(a) || b.ov - a.ov;
                if (squadSort === 'goals') return (b.sg || 0) - (a.sg || 0) || (b.sa || 0) - (a.sa || 0) || b.ov - a.ov;
                return POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ov - a.ov;
              });

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-center shrink-0">
                  <div className="p-2.5 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ขนาดทีม (18–28)</div><div className="font-bold text-base sm:text-lg mland:text-[11px] tabular">{me.sq.length}/28</div></div>
                  <div className="p-2.5 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ค่าเหนื่อย/เพดาน</div><div className={`font-bold text-base sm:text-lg mland:text-[11px] tabular ${tx.wagePct > 95 ? 'text-[var(--red)]' : ''}`}>{tx.curWage}/{tx.wageCap}k</div></div>
                  <div className="p-2.5 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">โควตายืมตัว</div><div className="font-bold text-base sm:text-lg mland:text-[11px] tabular">{tx.loansCount}/{tx.maxLoans}</div></div>
                  <div className="p-2.5 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ตลาดซื้อขาย</div><div className={`font-bold text-xs mland:text-[10px] mt-1 mland:mt-0 ${tx.tw.open ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>{tx.tw.shortLabel}</div></div>
                </div>

                {/* List Filter & Sort Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1 pb-2 mland:pb-1 border-b border-[var(--line)] shrink-0">
                  <div className="flex flex-wrap mland:flex-nowrap mland:overflow-x-auto gap-1 max-w-full">
                    {([
                      ['ALL', `ทั้งหมด (${me.sq.length})`],
                      ['GK', `GK (${posCounts.GK})`],
                      ['DF', `DF (${posCounts.DF})`],
                      ['MF', `MF (${posCounts.MF})`],
                      ['FW', `FW (${posCounts.FW})`]
                    ] as const).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSquadPosFilter(k)}
                        className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${squadPosFilter === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap mland:flex-nowrap mland:overflow-x-auto items-center gap-1 text-[11px] mland:text-[9.5px] max-w-full">
                    <span className="text-[var(--mut)] font-semibold mr-1 shrink-0">เรียง:</span>
                    {([
                      ['pos', 'ตำแหน่ง'],
                      ['ov', 'OVR'],
                      ['fit', 'ความฟิต'],
                      ['age', 'อายุ'],
                      ['val', 'มูลค่า'],
                      ['goals', 'ฟอร์ม/ประตู']
                    ] as const).map(([sKey, sLbl]) => (
                      <button
                        key={sKey}
                        type="button"
                        onClick={() => setSquadSort(sKey)}
                        className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg font-semibold whitespace-nowrap shrink-0 cursor-pointer ${squadSort === sKey ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'}`}
                      >
                        {sLbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-1">
                {/* Incoming Club Bids Alert */}
                {isMgr && (() => {
                  const incomingOffers = getIncomingOffers(state);
                  if (!incomingOffers.length) return null;
                  return (
                    <div className="p-3 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-xs">💼 ข้อเสนอซื้อนักเตะจากสโมสรอื่น ({incomingOffers.length})</div>
                        <button
                          type="button"
                          onClick={() => onUpdateState((d) => { d.v = 'k'; })}
                          className="text-[11px] font-bold text-[#9a6300] dark:text-[var(--lamp)] underline cursor-pointer"
                        >
                          ไปที่หน้าตลาด →
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {incomingOffers.map((off) => {
                          const targetQ = me.sq.find((z) => z.n === off.n);
                          if (!targetQ) return null;
                          return (
                            <div key={`${off.n}__${off.t}`} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                              <div className="text-xs min-w-0">
                                <b>{off.t}</b> ยื่นซื้อ <b>{off.n}</b> ({targetQ.ro} · {targetQ.ov}) ราคา <b className="text-[var(--g)] tabular">{off.p}k ฿</b>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = canAcceptTransferOffer(state, off);
                                    if (!res.ok) { onToast(res.err || 'ขายไม่สำเร็จ'); return; }
                                    onUpdateState((d) => { acceptTransferOffer(d, off); });
                                    SFX.win();
                                    onToast(`ขาย ${off.n} ให้ ${res.buyerName || off.t} รับ +${off.p}k ฿`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--g)] text-white text-[11px] font-bold cursor-pointer"
                                >
                                  ✅ ตอบรับขาย
                                </button>
                                {!off.cnt && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const out = resolveCounterOfferOutcome(state, off);
                                      onUpdateState((d) => applyCounterOfferOutcome(d, off, out));
                                      onToast(
                                        out.accepted
                                          ? `${off.t} ยอมเพิ่มราคาเป็น ${out.newPrice}k ฿!`
                                          : `${off.t} ถอนข้อเสนอซื้อ ${off.n}`
                                      );
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-semibold cursor-pointer"
                                  >
                                    💰 โก่ง +15%
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateState((d) => removeIncomingOffer(d, off.n, off.t));
                                    onToast(`ปฏิเสธข้อเสนอจาก ${off.t} แล้ว`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-semibold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Squad List Header (Desktop) */}
                <div className="hidden md:grid grid-cols-[44px_1.7fr_90px_54px_86px_88px_100px_115px_auto] items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-[var(--mut)] bg-[var(--surface-2)]/70 rounded-xl">
                  <div className="text-center">#</div>
                  <div>นักเตะ</div>
                  <div>ตำแหน่ง</div>
                  <div className="text-center">อายุ</div>
                  <div className="text-center">OVR / ศักย</div>
                  <div className="text-center">ฟิต</div>
                  <div className="text-center">ผลงาน</div>
                  <div className="text-right">ค่าเหนื่อย / ค่าตัว</div>
                  {isMgr && <div className="text-right min-w-[152px]">จัดการขาย</div>}
                </div>

                {/* Squad List Rows */}
                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface)]">
                  {listRows.map((q) => {
                    const f = Math.round(q.fit ?? 100);
                    const isStarter = starters.includes(q);
                    const isMe = !!q.me || (!isMgr && state.p?.name === q.n);
                    const no = getShirtNo(me, q);
                    const chk = getPlayerSellCheck(state, me, q);
                    const offerCount = getIncomingOffers(state).filter((o) => o.n === q.n).length;
                    const wg = ensureCon(q).wg;
                    const fitBarCol = f >= 75 ? 'var(--g)' : f >= 50 ? 'var(--lamp)' : 'var(--red)';

                    return (
                      <div
                        key={q.n}
                        className={`px-3 py-2 mland:px-2 mland:py-1 flex flex-col md:grid md:grid-cols-[44px_1.7fr_90px_54px_86px_88px_100px_115px_auto] md:items-center gap-2 mland:gap-1 transition-colors hover:bg-[var(--surface-2)]/45 ${
                          isMe ? 'bg-[var(--lamp-soft)]/50' : q.listed ? 'bg-[var(--lamp-soft)]/25' : ''
                        }`}
                      >
                        {/* Mobile Top Row / Desktop First Columns */}
                        <div className="hidden md:flex items-center justify-center text-xs font-bold text-[var(--mut)] tabular">
                          #{no}
                        </div>

                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="md:hidden text-xs font-bold text-[var(--mut)] tabular w-7 shrink-0">#{no}</span>
                          <PlayerFace player={q} team={me} state={state} size={32} />
                          <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                            <div className="font-bold text-xs truncate flex items-center gap-1">
                              {isMe && <span className="px-1.5 rounded bg-[var(--lamp)] text-[#261900] text-[9px] font-extrabold shrink-0">ฉัน</span>}
                              {isStarter && <span title="ตัวจริง" className="shrink-0">⭐</span>}
                              {me.cap === q.n && <span className="text-[var(--lamp)] shrink-0">[C]</span>}
                              <span className="truncate">{q.n}</span>
                              {q.loan ? <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold shrink-0">[ยืม]</span> : null}
                              {q.listed ? <span className="text-[10px] text-[#b45309] dark:text-[var(--lamp)] font-bold shrink-0">[ในตลาด {q.askPrice || vlu(q)}k]</span> : null}
                              {offerCount > 0 ? <span className="px-1.5 rounded bg-[var(--g)] text-white text-[9px] font-bold shrink-0">{offerCount} ข้อเสนอ</span> : null}
                            </div>
                            <div className="text-[10px] text-[var(--mut)] truncate">
                              {(q.sus || 0) > 0
                                ? `🟥 ติดโทษแบน ${q.sus} นัด`
                                : q.inj > 0
                                  ? `🩹 บาดเจ็บ ${q.inj} นัด`
                                  : (q.yc || 0) > 0
                                    ? `🟨 ใบเหลือง ${q.yc}/3`
                                    : isStarter
                                      ? '11 ตัวจริง'
                                      : 'ตัวสำรอง'}
                            </div>
                          </button>
                          <span className="md:hidden px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular shrink-0" style={{ background: ovColor(q.ov) }}>
                            {q.ov}
                          </span>
                        </div>

                        {/* Mobile compact info row / Desktop structured columns */}
                        <div className="flex md:contents flex-wrap items-center justify-between gap-2 text-xs pl-9 md:pl-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] font-bold text-[11px]">{q.ro}</span>
                            <span className="text-[10px] text-[var(--mut)] hidden lg:inline truncate">{SPN[q.ro] || q.pos}</span>
                          </div>

                          <div className="text-center text-xs tabular font-semibold">
                            <span className="md:hidden text-[var(--mut)]">อายุ </span>
                            {q.age}
                          </div>

                          <div className="hidden md:flex items-center justify-center gap-1">
                            <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(q.ov) }}>
                              {q.ov}
                            </span>
                            <span className="text-[10px] text-[var(--mut)] tabular">/{q.pot || q.ov}</span>
                          </div>

                          <div className="flex items-center gap-1.5 min-w-[74px]">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${f}%`, background: fitBarCol }} />
                            </div>
                            <span className="text-[11px] font-bold tabular w-7 text-right">{f}%</span>
                          </div>

                          <div className="text-center text-[11px] tabular text-[var(--mut)]">
                            {q.sg || q.sa || q.ap ? (
                              <span>
                                {q.ap ? `${q.ap}น` : ''}{q.sg ? ` ⚽${q.sg}` : ''}{q.sa ? ` 🎯${q.sa}` : ''}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>

                          <div className="text-right text-[11px] tabular">
                            <span className="font-bold text-[var(--ink)]">{wg}k</span>
                            <span className="text-[var(--mut)]"> · {vlu(q)}k</span>
                          </div>

                          {isMgr && (
                            <div className="flex items-center justify-end gap-1 shrink-0 min-w-[152px]">
                              {!q.loan && (
                                <button
                                  type="button"
                                  title={q.listed ? 'ถอดออกจากบัญชีขาย' : 'ขึ้นบัญชีขายในตลาด (รอทีมอื่นยื่นซื้อ)'}
                                  onClick={() => {
                                    SFX.tap();
                                    onUpdateState((d) => {
                                      const target = d.teams[d.me].sq.find((z) => z.n === q.n);
                                      if (!target) return;
                                      if (target.listed) {
                                        target.listed = 0;
                                        delete target.askPrice;
                                      } else {
                                        target.listed = 1;
                                        target.askPrice = Math.max(5, vlu(target));
                                      }
                                    });
                                    onToast(q.listed ? `ถอด ${q.n} ออกจากบัญชีขายแล้ว` : `ขึ้นบัญชีขาย ${q.n} แล้ว ทีมอื่นสามารถยื่นข้อเสนอได้`);
                                  }}
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${q.listed ? 'bg-[var(--lamp)] text-[#261900] border-[var(--lamp)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'}`}
                                >
                                  {q.listed ? '🏷️ ในตลาด' : '🏷️ ขึ้นตลาด'}
                                </button>
                              )}
                              <button
                                type="button"
                                title={chk.pitchedThisTurn ? 'เสนอขายไปแล้วในนัดนี้' : chk.canPitch ? 'ส่งเสนอขายให้สโมสรอื่นยื่นราคา' : chk.reason}
                                onClick={() => {
                                  if (!chk.canPitch) { onToast(chk.reason || 'ยังไม่สามารถเสนอขายได้'); return; }
                                  if (chk.pitchedThisTurn) { onToast('เสนอขายนักเตะคนนี้ไปแล้วในนัดนี้ รอหลังจบแมตช์หน้าหรือรอข้อเสนอจากทีมอื่น'); return; }
                                  SFX.tap();
                                  setPitchTargetName(q.n);
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                  chk.canPitch && !chk.pitchedThisTurn
                                    ? 'bg-[var(--surface)] border-[var(--g)] text-[var(--g)] hover:bg-[var(--g-soft)]'
                                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)] opacity-65'
                                }`}
                              >
                                {!tx.tw.open ? '🔒' : chk.pitchedThisTurn ? '⏳ เสนอแล้ว' : '📨 เสนอขาย'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!listRows.length && (
                    <div className="p-6 text-center text-xs text-[var(--mut)]">ไม่มีนักเตะในตำแหน่งนี้</div>
                  )}
                </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {isMgr && showCustomEditor && (
        <CustomFormationModal
          team={me}
          kitColor={tc(me, state)}
          onClose={() => setShowCustomEditor(false)}
          onSave={(cf) => {
            onUpdateState((d) => {
              const t = d.teams[d.me];
              t.cf = cf;
              t.form = 'custom';
              t.lu = null;
            });
            setShowCustomEditor(false);
            onToast('บันทึกแผนที่ปรับเองแล้ว!');
          }}
        />
      )}

      {isMgr && pitchTargetName && (() => {
        const pitchPlayer = me.sq.find((z) => z.n === pitchTargetName);
        if (!pitchPlayer) return null;
        return (
          <PitchPlayerModal
            state={state}
            player={pitchPlayer}
            onClose={() => setPitchTargetName(null)}
            onConfirm={(askPct) => {
              const result = resolvePitchPlayerOutcome(state, pitchPlayer.n, askPct);
              setPitchTargetName(null);
              if (!result.ok) {
                onToast(result.err || 'เสนอขายไม่สำเร็จ');
                return;
              }
              onUpdateState((d) => applyPitchPlayerOutcome(d, pitchPlayer.n, result));
              if (result.offers.length > 0) {
                SFX.win();
                onToast(`มี ${result.offers.length} สโมสรยื่นข้อเสนอซื้อ ${pitchPlayer.n} แล้ว! ดูด้านบนหรือแท็บตลาด`);
              } else {
                onToast(`ขึ้นบัญชีขาย ${pitchPlayer.n} แล้ว แต่รอบนี้ยังไม่มีทีมยื่นซื้อเข้ามาทันที`);
              }
            }}
          />
        );
      })()}
    </div>
  );
};


// ============================================================================
// 9. MARKET VIEW
// ============================================================================
interface OfferDraft {
  source: 'mk' | 'scout' | 'club';
  idx: number;
  clubTeamId?: number;
  playerName?: string;
  type: 'free' | 'cash' | 'inst' | 'swap' | 'loan' | 'loanopt';
  pct: number;
  yr: number;
  role: 'key' | 'rot' | 'pro';
  wb: 0 | 1 | 2;
  swapIdx: number | null;
  msg: string;
  counter?: ReturnType<typeof evalOffer> | null;
}

function evalOffer(q: Player, st: OfferDraft, me: Team) {
  const p0 = q.price || vlu(q);
  const wgAsk = q.askWg || wagOf(q);
  const type = q.free ? 'free' : st.type;
  const yr = type === 'loan' || type === 'loanopt' ? 1 : st.yr;
  const role = st.role;
  const wb = st.wb;
  const wf = [0.85, 1, 1.2][wb];
  const sgBonus = wb === 2 ? Math.max(4, Math.round(q.ov / 8)) : 0;
  const swapQ = type === 'swap' && st.swapIdx != null ? me.sq[st.swapIdx] : null;
  const swapVal = swapQ ? Math.round(vlu(swapQ) * 0.8) : 0;

  let cashNow = 0;
  let dueLater = 0;
  let loanOpt = 0;
  let clubScore = 0;

  if (type === 'free') {
    cashNow = sgBonus;
    clubScore = 100;
  } else if (type === 'cash') {
    cashNow = Math.round((p0 * st.pct) / 100) + sgBonus;
    clubScore = st.pct;
  } else if (type === 'inst') {
    cashNow = Math.round(((p0 * st.pct) / 100) * 0.55) + sgBonus;
    dueLater = Math.round(((p0 * st.pct) / 100) * 0.5);
    clubScore = st.pct - 6;
  } else if (type === 'swap') {
    cashNow = Math.max(0, Math.round((p0 * st.pct) / 100) - swapVal) + sgBonus;
    clubScore = (swapQ ? 100 : 0) + (st.pct - 100) + (swapVal >= p0 * 0.45 ? 6 : 0);
  } else if (type === 'loan') {
    cashNow = Math.max(3, Math.round(p0 * 0.28)) + sgBonus;
    clubScore = 96;
  } else if (type === 'loanopt') {
    cashNow = Math.max(4, Math.round(p0 * 0.32)) + sgBonus;
    loanOpt = Math.round(p0 * 0.78);
    clubScore = 98;
  }

  const roleBonus = role === 'key' ? 12 : role === 'rot' ? 2 : q.ov >= 68 ? -14 : 6;
  const yrBonus = q.age >= 30 ? (yr >= 3 ? 8 : -4) : yr >= 3 ? 6 : 0;
  const plScore = 74 + (wf - 1) * 65 + roleBonus + yrBonus + me.tier * 4;
  const chance = clamp(Math.round(q.free ? plScore : clubScore * 0.55 + plScore * 0.45 - 18), 8, 98);
  const wg = +(wgAsk * wf).toFixed(1);

  return { type, yr, role, wb, wg, sgBonus, swapQ, swapVal, cashNow, dueLater, loanOpt, chance, p0 };
}

const MarketView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onInspectPlayer: (player: Player, team: Team | null) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onInspectPlayer, onToast }) => {
  const me = state.teams[state.me];
  const tx = getLeagueTransferContext(state, me);
  const [marketSource, setMarketSource] = useState<'mk' | 'club'>('mk');
  const [filter, setFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW' | 'FREE'>('ALL');
  const [subFilter, setSubFilter] = useState<'ALL' | SubRole>('ALL');
  const [clubTierFilter, setClubTierFilter] = useState<'ALL' | 'MY_TIER'>('MY_TIER');
  const [scoutRole, setScoutRole] = useState<SubRole | ''>('');
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);
  const [pitchTargetName, setPitchTargetName] = useState<string | null>(null);
  const [quickListName, setQuickListName] = useState('');
  const [renewIdx, setRenewIdx] = useState<number | null>(null);
  const [renewYr, setRenewYr] = useState(3);
  const [renewRole, setRenewRole] = useState<'key' | 'rot' | 'pro'>('rot');
  const [renewWb, setRenewWb] = useState<0 | 1 | 2>(1);
  const [renewMsg, setRenewMsg] = useState('');
  const [mktMobTab, setMktMobTab] = useState<'sell' | 'scout' | 'con'>('sell');

  const availableSubRoles: SubRole[] = useMemo(() => {
    if (filter === 'GK' || filter === 'DF' || filter === 'MF' || filter === 'FW') return SPX[filter];
    return ALL_SUB_ROLES;
  }, [filter]);

  const marketList = useMemo(() => {
    return (state.mk || [])
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => {
        const lineOk = filter === 'ALL' || (filter === 'FREE' ? !!q.free : q.pos === filter);
        const subOk = subFilter === 'ALL' || q.ro === subFilter;
        return lineOk && subOk;
      });
  }, [state.mk, filter, subFilter]);

  const clubMarketList = useMemo(() => {
    const items: { q: Player; team: Team; idx: number; price: number }[] = [];
    state.teams.forEach((t) => {
      if (t.id === state.me) return;
      if (clubTierFilter === 'MY_TIER' && Math.abs(t.tier - me.tier) > 1) return;
      t.sq.forEach((q, idx) => {
        if (q.me || q.loan) return;
        const lineOk = filter === 'ALL' || filter === 'FREE' || q.pos === filter;
        const subOk = subFilter === 'ALL' || q.ro === subFilter;
        if (!lineOk || !subOk) return;
        items.push({ q, team: t, idx, price: Math.max(8, vlu(q)) });
      });
    });
    return items.sort((a, b) => b.q.ov - a.q.ov).slice(0, 48);
  }, [state.teams, state.me, me.tier, clubTierFilter, filter, subFilter]);

  const loanPlayers = me.sq.map((q, i) => ({ q, i })).filter(({ q }) => q.loan && q.loanOpt);
  const contractList = me.sq
    .map((q, i) => ({ q, i, c: ensureCon(q) }))
    .filter(({ q }) => !q.loan)
    .sort((a, b) => a.c.yr - b.c.yr || b.q.ov - a.q.ov)
    .slice(0, 6);

  const getDraftTarget = (draft: OfferDraft, s: GameState): { q: Player | undefined; sellerTeam?: Team } => {
    if (draft.source === 'club' && draft.clubTeamId != null) {
      const seller = s.teams.find((t) => t.id === draft.clubTeamId);
      if (!seller) return { q: undefined };
      const q = seller.sq[draft.idx] || seller.sq.find((p) => p.n === draft.playerName);
      return { q, sellerTeam: seller };
    }
    const list = draft.source === 'mk' ? s.mk : s.scout?.results || [];
    const q = list[draft.idx] || list.find((p) => p.n === draft.playerName);
    return { q };
  };

  const openNegotiation = (source: 'mk' | 'scout' | 'club', idx: number, q: Player, sellerTeam?: Team) => {
    if (!tx.tw.open && !q.free) {
      onToast(`ตลาดซื้อขายปิดอยู่! ช่วงนี้เซ็นได้เฉพาะฟรีเอเยนต์ (เปิดรอบหน้า: ${tx.tw.rangeText})`);
      return;
    }
    if (source === 'club' && sellerTeam) {
      if (sellerTeam.sq.length <= 16) {
        onToast(`${sellerTeam.name} มีนักเตะเหลือขั้นต่ำ (${sellerTeam.sq.length} คน) ไม่ปล่อยขาย`);
        return;
      }
      if (q.pos === 'GK' && sellerTeam.sq.filter((z) => z.pos === 'GK').length <= 2) {
        onToast(`${sellerTeam.name} เหลือผู้รักษาประตูเพียง 2 คน ไม่ปล่อยขาย`);
        return;
      }
    }
    SFX.tap();
    const swCands = me.sq
      .map((z, i) => ({ z, i }))
      .filter(({ z }) => !z.loan && !z.me && z.inj === 0 && tx.posCounts[z.pos] > tx.minPos[z.pos])
      .sort((a, b) => vlu(b.z) - vlu(a.z));

    const targetWithPrice: Player = source === 'club' && !q.price ? { ...q, price: Math.max(8, vlu(q)) } : q;
    setOfferDraft({
      source,
      idx,
      clubTeamId: sellerTeam?.id,
      playerName: q.n,
      type: targetWithPrice.free ? 'free' : 'cash',
      pct: 100,
      yr: 3,
      role: targetWithPrice.ov >= 70 ? 'key' : targetWithPrice.age <= 20 ? 'pro' : 'rot',
      wb: 1,
      swapIdx: swCands[0] ? swCands[0].i : null,
      msg: '',
      counter: null
    });
  };

  const submitOffer = (useCounter = false) => {
    if (!offerDraft) return;
    const { q: rawQ, sellerTeam } = getDraftTarget(offerDraft, state);
    if (!rawQ) return;
    const q: Player = offerDraft.source === 'club' && !rawQ.price ? { ...rawQ, price: Math.max(8, vlu(rawQ)) } : rawQ;
    const deal = useCounter && offerDraft.counter ? offerDraft.counter : evalOffer(q, offerDraft, me);
    if (!tx.tw.open && !q.free) { onToast('ตลาดซื้อขายปิดอยู่ ไม่สามารถย้ายสังกัดสโมสรอื่นได้'); return; }
    if (offerDraft.source === 'club' && sellerTeam && deal.type !== 'swap' && sellerTeam.sq.length <= 16) {
      onToast(`${sellerTeam.name} มีขนาดทีมถึงขั้นต่ำแล้ว (ใช้การแลกตัวแทนได้)`);
      return;
    }
    if ((deal.type === 'loan' || deal.type === 'loanopt') && tx.loansCount >= tx.maxLoans) {
      onToast(`ครบโควตายืมตัวสูงสุด ${tx.maxLoans} คนแล้ว`);
      return;
    }
    if (tx.ffpLocked && deal.cashNow > 0) { onToast('งบติดลบตามกฎ FFP ห้ามจ่ายค่าตัวจนกว่างบจะกลับมาเป็นบวก'); return; }
    if (state.money < deal.cashNow) { onToast('งบสโมสรไม่พอจ่ายทันที'); return; }
    if (me.sq.length >= tx.maxSquad && deal.type !== 'swap') { onToast(`ทีมเต็ม ${tx.maxSquad} คนแล้ว`); return; }
    const freedWage = deal.type === 'swap' && deal.swapQ ? ensureCon(deal.swapQ).wg : 0;
    if (tx.curWage - freedWage + deal.wg > tx.wageCap) {
      onToast(`เกินเพดานค่าเหนื่อยลีก (${tx.wageCap}k/นัด) กรุณาขายหรือลดค่าเหนื่อยก่อน`);
      return;
    }
    const accepted = useCounter || Math.random() * 100 < deal.chance;
    if (accepted) {
      onUpdateState((d) => {
        const t = d.teams[d.me];
        let target: Player | undefined;
        let removeFromSrc: (() => void) | null = null;
        let sellerRef: Team | undefined;

        if (offerDraft.source === 'club' && offerDraft.clubTeamId != null) {
          sellerRef = d.teams.find((tm) => tm.id === offerDraft.clubTeamId);
          if (sellerRef) {
            const sIdx = sellerRef.sq.findIndex((p) => p.n === (offerDraft.playerName || q.n));
            if (sIdx >= 0) {
              target = sellerRef.sq[sIdx];
              removeFromSrc = () => {
                sellerRef!.sq.splice(sIdx, 1);
                sellerRef!.lu = null;
              };
            }
          }
        } else {
          const srcList = offerDraft.source === 'mk' ? d.mk : d.scout?.results || [];
          const mIdx = srcList[offerDraft.idx] ? offerDraft.idx : srcList.findIndex((p) => p.n === (offerDraft.playerName || q.n));
          if (mIdx >= 0) {
            target = srcList[mIdx];
            removeFromSrc = () => srcList.splice(mIdx, 1);
          }
        }
        if (!target || !removeFromSrc) return;

        d.money -= deal.cashNow;
        logFin(d, `${deal.type === 'loan' || deal.type === 'loanopt' ? 'ค่ายืมตัว ' : 'ซื้อตัว '}${target.n}${sellerRef ? ` (${sellerRef.name})` : ''}`, -deal.cashNow);
        if (deal.dueLater) d.payDue = (d.payDue || 0) + deal.dueLater;

        let swappedOutPlayer: Player | null = null;
        if (deal.type === 'swap' && deal.swapQ) {
          const si = t.sq.findIndex((z) => z.n === deal.swapQ!.n);
          if (si >= 0) {
            swappedOutPlayer = t.sq.splice(si, 1)[0];
            t.lu = null;
          }
        }

        removeFromSrc();
        const incoming: Player = { ...target };
        if (deal.type === 'loan' || deal.type === 'loanopt') {
          incoming.loan = 1;
          if (deal.loanOpt) incoming.loanOpt = deal.loanOpt;
        }
        incoming.con = { yr: deal.yr, wg: deal.wg, role: deal.role };
        incoming.no = undefined;
        incoming.signedSeason = d.season;
        incoming.signedMd = d.md;
        delete incoming.listed;
        t.sq.push(incoming);
        assignTeamShirtNumbers(t);

        if (sellerRef && swappedOutPlayer) {
          swappedOutPlayer.no = undefined;
          sellerRef.sq.push(swappedOutPlayer);
          assignTeamShirtNumbers(sellerRef);
        }
      });
      setOfferDraft(null);
      SFX.win();
      onToast(`เซ็นสัญญา ${q.n} (${q.ro} · ${deal.yr} ปี · ${deal.wg}k/นัด) สำเร็จ!`);
    } else {
      onUpdateState((d) => {
        if (offerDraft.source === 'club' && offerDraft.clubTeamId != null) {
          const sellerRef = d.teams.find((tm) => tm.id === offerDraft.clubTeamId);
          const target = sellerRef?.sq.find((p) => p.n === (offerDraft.playerName || q.n));
          if (!target) return;
          target.tries = (target.tries || 0) + 1;
          if (target.tries >= 3 || deal.chance < 20) target.locked = 1;
        } else {
          const srcList = offerDraft.source === 'mk' ? d.mk : d.scout?.results || [];
          const target = srcList[offerDraft.idx];
          if (!target) return;
          target.tries = (target.tries || 0) + 1;
          if (target.tries >= 3 || (deal.chance < 20 && !target.free)) target.locked = 1;
        }
      });
      const nextTries = (q.tries || 0) + 1;
      if (nextTries >= 3 || (deal.chance < 20 && !q.free)) {
        setOfferDraft({ ...offerDraft, counter: null, msg: 'อีกฝ่ายปฏิเสธและยุติการเจรจาในรอบนี้แล้ว' });
      } else {
        const cPct = deal.type === 'free' ? 100 : Math.min(125, offerDraft.pct + 10);
        const cWb = Math.min(2, offerDraft.wb + 1) as 0 | 1 | 2;
        const cDraft: OfferDraft = { ...offerDraft, pct: cPct, wb: cWb, role: q.ov >= 70 ? 'key' : offerDraft.role };
        const counter = evalOffer(q, cDraft, me);
        setOfferDraft({
          ...offerDraft,
          counter,
          msg: `ขอปรับเงื่อนไขเป็น${deal.type === 'free' ? '' : ` ${cPct}% · `}จ่ายทันที ${counter.cashNow}k · ค่าเหนื่อย ${counter.wg}k/นัด · ${ROLE_L[counter.role]}`
        });
      }
    }
  };

  const renderNegotiationModal = () => {
    if (!offerDraft) return null;
    const { q: rawQ, sellerTeam } = getDraftTarget(offerDraft, state);
    if (!rawQ) return null;
    const q: Player = offerDraft.source === 'club' && !rawQ.price ? { ...rawQ, price: Math.max(8, vlu(rawQ)) } : rawQ;
    const swCands = me.sq.map((z, i) => ({ z, i })).filter(({ z }) => !z.loan && !z.me && z.inj === 0 && tx.posCounts[z.pos] > tx.minPos[z.pos]).sort((a, b) => vlu(b.z) - vlu(a.z));
    const E = evalOffer(q, offerDraft, me);
    const canAfford = state.money >= E.cashNow && !(tx.ffpLocked && E.cashNow > 0);
    const needSwapOk = offerDraft.type !== 'swap' || !!E.swapQ;
    const fullSq = me.sq.length >= tx.maxSquad && offerDraft.type !== 'swap';
    const loanCapHit = (offerDraft.type === 'loan' || offerDraft.type === 'loanopt') && tx.loansCount >= tx.maxLoans;
    const freedWage = offerDraft.type === 'swap' && E.swapQ ? ensureCon(E.swapQ).wg : 0;
    const wageOverCap = tx.curWage - freedWage + E.wg > tx.wageCap;
    const types: [OfferDraft['type'], string][] = q.free
      ? [['free', '🆓 เซ็นฟรีเอเยนต์']]
      : [['cash', '💰 จ่ายสด'], ['inst', '📅 ผ่อน 2 งวด'], ['swap', '🔄 แลกตัว+เงิน'], ['loan', '🤝 ยืม 1 ซีซั่น'], ['loanopt', '🤝 ยืม+ซื้อขาด']];
    const chCol = E.chance >= 75 ? 'var(--g)' : E.chance >= 45 ? '#c98a00' : 'var(--red)';

    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
        <div className="w-full max-w-xl mland:max-w-3xl max-h-[92dvh] mland:max-h-[95dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
          <div className="shrink-0 flex items-center gap-3 mland:gap-2 p-3.5 mland:px-3 mland:py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={sellerTeam} state={state} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm sm:text-base mland:text-xs truncate">
                {q.n} <span className="text-xs mland:text-[10px] text-[var(--g)]">({q.ro} · {SPN[q.ro] || q.pos})</span>
              </div>
              <div className="text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--mut)] truncate">
                {sellerTeam ? `${sellerTeam.name} · ` : ''}อายุ {q.age} ปี · {q.free ? <b className="text-[var(--g)]">ฟรีเอเยนต์</b> : `ค่าตัว ${q.price}k ฿`} · ค่าเหนื่อย ~{q.askWg || wagOf(q)}k
              </div>
            </div>
            <span className="px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl text-white font-bold text-sm sm:text-base mland:text-xs tabular shrink-0" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-0 mland:grid mland:grid-cols-2 mland:gap-2.5 mland:items-start">
            <div className="space-y-3 mland:space-y-1.5">
              <div>
                <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">1) รูปแบบข้อเสนอ</div>
                <div className="flex flex-wrap gap-1.5 mland:gap-1">
                  {types.map(([k, l]) => {
                    const isLoanType = k === 'loan' || k === 'loanopt';
                    const disabledLoan = isLoanType && tx.loansCount >= tx.maxLoans;
                    return (
                      <button key={k} type="button" disabled={disabledLoan} onClick={() => setOfferDraft({ ...offerDraft, type: k, counter: null, msg: '' })} className={`px-3 py-1.5 mland:px-2 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer disabled:opacity-40 ${offerDraft.type === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
                        {l}{disabledLoan ? ' (เต็ม 4)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {['cash', 'inst', 'swap'].includes(offerDraft.type) && (
                <div>
                  <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">ระดับค่าตัวเทียบตลาด ({offerDraft.pct}%)</div>
                  <div className="flex flex-wrap gap-1.5 mland:gap-1">
                    {[85, 95, 100, 115].map((p) => (
                      <button key={p} type="button" onClick={() => setOfferDraft({ ...offerDraft, pct: p, counter: null, msg: '' })} className={`px-3 py-1 mland:px-2 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${offerDraft.pct === p ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{p}%</button>
                    ))}
                  </div>
                </div>
              )}

              {offerDraft.type === 'swap' && (
                <div>
                  <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">เลือกนักเตะที่ใช้แลก (ลด 80% ของค่าตัว)</div>
                  <div className="flex flex-wrap gap-1.5 mland:gap-1">
                    {swCands.slice(0, 5).map(({ z, i }) => (
                      <button key={z.n} type="button" onClick={() => setOfferDraft({ ...offerDraft, swapIdx: i, counter: null, msg: '' })} className={`px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${offerDraft.swapIdx === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>
                        {z.pos} {z.n.split(' ')[0]} ({z.ov} · ลด {Math.round(vlu(z) * 0.8)}k)
                      </button>
                    ))}
                    {!swCands.length && <span className="text-xs text-[var(--red)]">ไม่มีนักเตะเกินโควตาตำแหน่งให้แลก</span>}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)] mb-1">2) เงื่อนไขสัญญา</div>
                {!['loan', 'loanopt'].includes(offerDraft.type) && (
                  <div className="flex flex-wrap gap-1.5 mland:gap-1 mb-1.5 mland:mb-1">
                    {[1, 2, 3, 5].map((y) => (
                      <button key={y} type="button" onClick={() => setOfferDraft({ ...offerDraft, yr: y, counter: null, msg: '' })} className={`px-3 py-1 mland:px-2 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${offerDraft.yr === y ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>สัญญา {y} ปี</button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mland:gap-1 mb-1.5 mland:mb-1">
                  {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง/สำรอง']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setOfferDraft({ ...offerDraft, role: k, counter: null, msg: '' })} className={`px-3 py-1 mland:px-2 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${offerDraft.role === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mland:gap-1">
                  {([['ประหยัด (-15%)', 0], ['มาตรฐาน', 1], ['จัดเต็ม (+20%+โบนัส)', 2]] as const).map(([l, k]) => (
                    <button key={k} type="button" onClick={() => setOfferDraft({ ...offerDraft, wb: k, counter: null, msg: '' })} className={`px-3 py-1 mland:px-2 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${offerDraft.wb === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 mland:space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-2 gap-2 mland:gap-1.5 text-center p-2.5 mland:p-2 rounded-xl bg-[var(--surface-2)]">
                <div><div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">จ่ายทันที</div><b className={`text-sm mland:text-xs tabular ${!canAfford ? 'text-[var(--red)]' : ''}`}>{E.cashNow}k</b></div>
                <div><div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">ค่าเหนื่อยรวมหลังดีล</div><b className={`text-sm mland:text-xs tabular ${wageOverCap ? 'text-[var(--red)]' : ''}`}>{Math.round(tx.curWage - freedWage + E.wg)}/{tx.wageCap}k</b></div>
                <div><div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">{E.dueLater ? 'ผ่อนปลายปี' : E.loanOpt ? 'ซื้อขาด' : 'สัญญา'}</div><b className="text-sm mland:text-xs tabular">{E.dueLater ? `${E.dueLater}k` : E.loanOpt ? `${E.loanOpt}k` : `${E.yr} ปี`}</b></div>
                <div><div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">งบคงเหลือ</div><b className="text-sm mland:text-xs tabular">{state.money}k</b></div>
              </div>

              <div className="flex items-center gap-2 text-xs mland:text-[10.5px]">
                <span>โอกาสตอบรับ</span>
                <div className="flex-1 h-2.5 mland:h-2 rounded-full bg-[var(--surface-2)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${E.chance}%`, background: chCol }} /></div>
                <b className="tabular" style={{ color: chCol }}>{E.chance}%</b>
              </div>

              {offerDraft.msg && (
                <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)] text-xs mland:text-[10.5px] space-y-2 mland:space-y-1">
                  <div className="font-bold">💬 ผลการเจรจา ({q.tries || 0}/3)</div>
                  <p>{offerDraft.msg}</p>
                  {offerDraft.counter && (
                    <button type="button" onClick={() => submitOffer(true)} className="px-3 py-1.5 mland:py-1 rounded-lg bg-[var(--g)] text-white font-bold cursor-pointer">
                      ✅ ตกลงตามข้อเสนอสวน (จ่ายทันที {offerDraft.counter.cashNow}k · ค่าเหนื่อย {offerDraft.counter.wg}k)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 p-3 mland:p-1.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
            <button type="button" onClick={() => setOfferDraft(null)} className="px-4 py-2 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-sm mland:text-xs cursor-pointer">ปิด</button>
            <button type="button" disabled={!canAfford || !needSwapOk || fullSq || loanCapHit || wageOverCap || !!q.locked} onClick={() => submitOffer(false)} className="flex-1 py-2 mland:py-1 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs disabled:opacity-40 cursor-pointer">
              {q.locked ? 'การเจรจาล่มแล้ว' : loanCapHit ? `โควตายืมเต็ม ${tx.maxLoans} คน` : wageOverCap ? `เกินเพดานค่าเหนื่อย ${tx.wageCap}k` : fullSq ? `ทีมเต็ม ${tx.maxSquad} คน` : !canAfford ? 'งบไม่พอ / ติดกฎ FFP' : '🤝 ยื่นข้อเสนอเจรจา'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRenewModal = () => {
    if (renewIdx === null) return null;
    const q = me.sq[renewIdx];
    if (!q) return null;
    const con = ensureCon(q);
    const wf = [0.9, 1.05, 1.25][renewWb];
    const newWg = +(wagOf(q) * wf).toFixed(1);
    const bonus = renewWb === 2 ? Math.max(5, Math.round(q.ov / 7)) : renewWb === 1 ? 2 : 0;
    const ch = clamp(Math.round(58 + (wf - 1) * 120 + (renewRole === 'key' ? 14 : renewRole === 'rot' ? 4 : -10) + (renewYr >= 3 ? 6 : 0)), 15, 98);
    const wageDelta = newWg - con.wg;
    const renewOverCap = tx.curWage + wageDelta > tx.wageCap;

    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
        <div className="w-full max-w-md mland:max-w-lg max-h-[92dvh] mland:max-h-[96dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
          <div className="shrink-0 flex items-center gap-3 p-3.5 mland:p-2 border-b border-[var(--line)] bg-[var(--surface-2)]">
            <PlayerFace player={q} team={me} state={state} size={46} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mland:text-xs truncate">📋 ต่อสัญญา · {q.n}</div>
              <div className="text-xs mland:text-[11px] text-[var(--mut)]">เหลือสัญญา <b>{con.yr} ปี</b> · ค่าเหนื่อยเดิม {con.wg}k</div>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-white font-bold text-xs shrink-0" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-1.5">
            <div>
              <div className="text-xs mland:text-[10px] font-bold mb-1">ระยะเวลาสัญญาใหม่</div>
              <div className="flex gap-1.5 mland:gap-1">
                {[2, 3, 4, 5].map((y) => (
                  <button key={y} type="button" onClick={() => setRenewYr(y)} className={`flex-1 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${renewYr === y ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{y} ปี</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mland:text-[10px] font-bold mb-1">บทบาท</div>
              <div className="flex gap-1.5 mland:gap-1">
                {([['key', '⭐ ตัวหลัก'], ['rot', '🔄 หมุนเวียน'], ['pro', '🌱 ดาวรุ่ง']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setRenewRole(k)} className={`flex-1 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${renewRole === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mland:text-[10px] font-bold mb-1">ค่าเหนื่อยที่เสนอ</div>
              <div className="flex flex-wrap gap-1.5 mland:gap-1">
                {([['รัดเข็มขัด (-10%)', 0], ['เพิ่มเล็กน้อย (+5%)', 1], ['จัดเต็ม (+25% +โบนัส)', 2]] as const).map(([l, k]) => (
                  <button key={k} type="button" onClick={() => setRenewWb(k)} className={`px-3 py-1.5 mland:px-2 mland:py-1 rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${renewWb === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs mland:text-[10.5px]">
              <span>โอกาสตกลง</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden"><div className="h-full rounded-full bg-[var(--g)]" style={{ width: `${ch}%` }} /></div>
              <b className="tabular">{ch}%</b>
            </div>
            {renewOverCap && <p className="text-xs mland:text-[10px] text-[var(--red)] font-semibold">⚠️ ค่าเหนื่อยใหม่จะทำให้ทีมเกินเพดาน {tx.wageCap}k/นัด</p>}
            {renewMsg && <p className="text-xs mland:text-[10px] text-[var(--red)]">{renewMsg}</p>}
          </div>
          <div className="shrink-0 p-3 mland:p-2 border-t border-[var(--line)] bg-[var(--surface-2)] flex gap-2">
            <button type="button" onClick={() => setRenewIdx(null)} className="px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] font-semibold text-xs cursor-pointer">ปิด</button>
            <button
              type="button"
              disabled={state.money < bonus || renewOverCap}
              onClick={() => {
                if (Math.random() * 100 < ch) {
                  onUpdateState((d) => {
                    d.money -= bonus;
                    if (bonus) logFin(d, `โบนัสต่อสัญญา ${q.n}`, -bonus);
                    d.teams[d.me].sq[renewIdx].con = { yr: renewYr, wg: newWg, role: renewRole };
                  });
                  setRenewIdx(null);
                  onToast(`ต่อสัญญา ${q.n} อีก ${renewYr} ปีแล้ว!`);
                } else {
                  setRenewMsg('นักเตะยังไม่พอใจข้อเสนอ ลองเพิ่มค่าเหนื่อยหรือบทบาท');
                }
              }}
              className="flex-1 py-2 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs disabled:opacity-40 cursor-pointer"
            >
              {renewOverCap ? `เกินเพดาน ${tx.wageCap}k` : `✅ ยืนยัน (${newWg}k/นัด${bonus ? `, โบนัส ${bonus}k` : ''})`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderScoutCard = (extraClass = '') => (
    <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${extraClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm mland:text-xs">🔍 ส่งแมวมองเจาะจงตำแหน่ง (20k)</h3>
        <span className="text-xs mland:text-[10px] text-[var(--mut)]">ใช้เวลา 2 นัด · ทำได้ตลอดปี</span>
      </div>
      {!state.scout ? (
        <div className="space-y-2.5 mland:space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-semibold text-[var(--mut)]">เลือกตำแหน่งเจาะจง:</label>
            <select
              value={scoutRole}
              onChange={(e) => setScoutRole(e.target.value as SubRole | '')}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
            >
              <option value="">ตามหมวดหมู่ที่กดด้านล่าง</option>
              {ALL_SUB_ROLES.map((r) => (
                <option key={r} value={r}>{r} — {SPN[r] || r}</option>
              ))}
            </select>
            {scoutRole && (
              <button
                type="button"
                disabled={state.money < 20}
                onClick={() => {
                  SFX.tap();
                  const lineFocus: ScoutMission['focus'] = LINE[scoutRole] === 'GK' ? 'gk' : LINE[scoutRole] === 'DF' ? 'defender' : LINE[scoutRole] === 'MF' ? 'midfielder' : 'striker';
                  onUpdateState((d) => { d.money -= 20; logFin(d, `ส่งแมวมองหาตำแหน่ง ${scoutRole}`, -20); d.scout = createScoutMission(lineFocus, scoutRole); });
                  onToast(`ส่งแมวมองหาตำแหน่ง ${scoutRole} แล้ว! รอรายงานในอีก 2 นัด`);
                }}
                className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                🎯 ส่งหา {scoutRole} (20k)
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['wonderkid', '🌟 ดาวรุ่ง U20'], ['free', '🆓 ฟรีเอเยนต์'], ['gk', '🧤 ผู้รักษาประตู'], ['defender', '🛡️ กองหลัง'], ['midfielder', '🧭 กองกลาง'], ['striker', '⚽ กองหน้า']] as [ScoutMission['focus'], string][]).map(([focus, lbl]) => (
              <button
                key={focus}
                type="button"
                disabled={state.money < 20}
                onClick={() => {
                  SFX.tap();
                  onUpdateState((d) => { d.money -= 20; logFin(d, 'ค่าส่งแมวมองส่องนักเตะ', -20); d.scout = createScoutMission(focus, scoutRole); });
                  onToast('ส่งแมวมองออกเดินทางแล้ว! รอรายงานในอีก 2 นัด');
                }}
                className="px-3 py-1.5 mland:px-2 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-xs mland:text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      ) : !state.scout.results ? (
        <div className="p-3 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 text-xs">
          กำลังปฏิบัติภารกิจ: <b>{state.scout.label}</b> · จะกลับมารายงานผลในอีก <b>{state.scout.turnsLeft} นัด</b>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--g)]">รายงานจากแมวมอง: {state.scout.label}</span>
            <button type="button" onClick={() => onUpdateState((d) => { d.scout = null; })} className="text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer">ปิดรายงาน</button>
          </div>
          {state.scout.results.map((q, i) => {
            const blockedByWindow = !tx.tw.open && !q.free;
            return (
              <div key={`${q.n}-${i}`} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--g)]/30">
                <PlayerFace player={q} size={34} />
                <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                  <div className="font-bold text-xs truncate"><span className="text-[var(--g)]">{q.ro}</span> · {q.n}</div>
                  <div className="text-[11px] text-[var(--mut)]">{SPN[q.ro] || q.pos} · อายุ {q.age} · ศักยภาพ {q.pot} · {q.free ? 'ฟรี' : `${q.price}k`}</div>
                </button>
                <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                <button type="button" disabled={!!q.locked || blockedByWindow} onClick={() => openNegotiation('scout', i, q)} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-45 ${blockedByWindow ? 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] text-white'}`}>
                  {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : 'เจรจา'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      {/* League Transfer Window & FFP Rules Header */}
      <div className={`p-3.5 sm:p-4 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl border space-y-2.5 mland:space-y-1 shrink-0 ${tx.tw.open ? 'bg-[var(--g-soft)] border-[var(--g)]/45' : 'bg-[var(--surface)] border-[var(--line)]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm sm:text-base mland:text-[11px] truncate">{tx.tw.label}</div>
            <p className="text-xs mland:hidden text-[var(--mut)]">
              {tx.tw.open
                ? `${tx.tw.subLabel} · ซื้อ-ขาย-ยืมตัวสโมสรอื่นได้เต็มรูปแบบ`
                : `${tx.tw.subLabel} · ช่วงตลาดปิดเซ็นได้เฉพาะฟรีเอเยนต์ไร้สังกัด และเยาวชนอะคาเดมี่`}
            </p>
          </div>
          <span className="text-xs mland:text-[10.5px] font-bold tabular text-[var(--ink)] shrink-0">
            งบสโมสร {state.money}k ฿
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-xs mland:text-[9.5px]">
          <div className="px-3 py-2 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)]">ลงทะเบียนทีม</div>
            <div className="font-bold tabular">{me.sq.length}/{tx.maxSquad} คน (ขั้นต่ำ {tx.minSquad})</div>
          </div>
          <div className="px-3 py-2 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)]">โควตายืมตัว</div>
            <div className={`font-bold tabular ${tx.loansCount >= tx.maxLoans ? 'text-[var(--red)]' : ''}`}>{tx.loansCount}/{tx.maxLoans} คน/ซีซั่น</div>
          </div>
          <div className="px-3 py-2 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)]">เพดานค่าเหนื่อยลีก</div>
            <div className={`font-bold tabular ${tx.wagePct > 95 ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>{tx.curWage}/{tx.wageCap}k ({tx.wagePct}%)</div>
          </div>
          <div className="px-3 py-2 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)]">กฎการเงิน (FFP)</div>
            <div className={`font-bold ${tx.ffpLocked ? 'text-[var(--red)]' : 'text-[var(--g)]'}`}>{tx.ffpLocked ? 'งบติดลบ · ห้ามซื้อ' : 'ผ่านเกณฑ์ปกติ'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 mland:flex-1 mland:min-h-0 mland:grid-cols-[1.18fr_0.82fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:overflow-hidden">
      <div className="space-y-4 mland:space-y-0 mland:h-full mland:min-h-0 mland:flex mland:flex-col">
        <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mland:gap-1 shrink-0">
            <div>
              <h3 className="font-bold text-sm mland:text-[11px]">🤝 ตลาดนักเตะทุกตำแหน่ง · งบ {state.money}k ฿</h3>
              <p className="text-xs text-[var(--mut)] mland:hidden">
                {marketSource === 'club'
                  ? 'ยื่นซื้อ-แลกตัว-ยืมตัวตรงจากสโมสรในลีก (ครบทั้ง 16 ตำแหน่ง)'
                  : tx.tw.open
                    ? 'เปิดตลาด: มีนักเตะครบทุกตำแหน่ง (GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, ST, CF, SS, LW, RW)'
                    : 'ตลาดปิด: เซ็นได้เฉพาะนักเตะฟรีเอเยนต์ [ฟรี] ครบทุกสาย'}
              </p>
            </div>
            {marketSource === 'mk' ? (
              <button
                type="button"
                disabled={state.money < 15}
                onClick={() => {
                  SFX.tap();
                  onUpdateState((d) => { d.money -= 15; logFin(d, 'รีเฟรชตลาดซื้อขาย', -15); mkMarket(d); });
                  onToast('อัปเดตรายชื่อตลาดใหม่ครบทุกตำแหน่งแล้ว');
                }}
                className="px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-semibold disabled:opacity-40 cursor-pointer"
              >
                🔄 {tx.tw.open ? 'หาตลาดใหม่ 15k' : 'หาฟรีเอเยนต์ 15k'}
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setClubTierFilter('MY_TIER')}
                  className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold cursor-pointer ${clubTierFilter === 'MY_TIER' ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}
                >
                  ลีกใกล้เคียง
                </button>
                <button
                  type="button"
                  onClick={() => setClubTierFilter('ALL')}
                  className={`px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[10px] font-semibold cursor-pointer ${clubTierFilter === 'ALL' ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}
                >
                  ทุกลีก
                </button>
              </div>
            )}
          </div>

          {/* Market Source Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 mland:p-0.5 rounded-xl bg-[var(--surface-2)] shrink-0">
            <button
              type="button"
              onClick={() => { setMarketSource('mk'); }}
              className={`py-1.5 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer ${marketSource === 'mk' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--mut)]'}`}
            >
              🏪 ตลาดกลาง &amp; ฟรีเอเยนต์
            </button>
            <button
              type="button"
              onClick={() => { setMarketSource('club'); if (filter === 'FREE') setFilter('ALL'); }}
              className={`py-1.5 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer ${marketSource === 'club' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs' : 'text-[var(--mut)]'}`}
            >
              🏟️ ซื้อจากสโมสรในลีก
            </button>
          </div>

          {/* Main Line Filter */}
          <div className="flex flex-wrap mland:flex-nowrap mland:overflow-x-auto gap-1.5 mland:gap-1 shrink-0 pb-0.5">
            {([['ALL', 'ทุกสาย'], ['GK', '🧤 GK'], ['DF', '🛡️ กองหลัง'], ['MF', '🧭 กองกลาง'], ['FW', '⚽ กองหน้า'], ...(marketSource === 'mk' ? [['FREE', '🆓 ฟรีเอเยนต์'] as const] : [])] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setFilter(k); setSubFilter('ALL'); }}
                className={`px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg text-xs mland:text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${filter === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Sub-role Exact Position Chips */}
          <div className="flex flex-wrap mland:flex-nowrap mland:overflow-x-auto gap-1 shrink-0 pb-0.5">
            <button
              type="button"
              onClick={() => setSubFilter('ALL')}
              className={`px-2 py-0.5 rounded-md text-[11px] mland:text-[9.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${subFilter === 'ALL' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface-2)]/80 text-[var(--mut)]'}`}
            >
              ทุกตำแหน่งย่อย
            </button>
            {availableSubRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSubFilter(role)}
                title={SPN[role] || role}
                className={`px-2 py-0.5 rounded-md text-[11px] mland:text-[9.5px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${subFilter === role ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]/80 text-[var(--mut)] hover:text-[var(--ink)]'}`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="space-y-2 mland:space-y-1 max-h-[540px] mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto pr-0.5">
            {marketSource === 'mk' ? (
              <>
                {marketList.map(({ q, i }) => {
                  const blockedByWindow = !tx.tw.open && !q.free;
                  return (
                    <div key={`${q.n}-${i}`} className={`flex items-center gap-2.5 mland:gap-1.5 p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] ${blockedByWindow ? 'opacity-70' : ''}`}>
                      <PlayerFace player={q} size={36} />
                      <button type="button" onClick={() => onInspectPlayer(q, null)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs mland:text-[10.5px] truncate">
                          <span className="text-[var(--g)]">{q.ro}</span> · {q.n}{' '}
                          {q.free ? <span className="text-[var(--g)] font-bold">[ฟรี]</span> : q.age <= 19 ? <span className="text-[var(--lamp)] font-bold">[ดาวรุ่ง]</span> : null}
                        </div>
                        <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                          {SPN[q.ro] || q.pos} · อายุ {q.age} · {'★'.repeat(Math.round((q.pot || q.ov) / 20))} · ค่าเหนื่อย ~{q.askWg || wagOf(q)}k
                        </div>
                      </button>
                      <span className="px-2 py-0.5 rounded-lg text-white text-xs mland:text-[10.5px] font-bold tabular" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                      <button
                        type="button"
                        disabled={!!q.locked || blockedByWindow}
                        onClick={() => openNegotiation('mk', i, q)}
                        className={`px-3 py-1.5 mland:px-2 mland:py-1 rounded-xl text-xs mland:text-[10px] font-bold shrink-0 cursor-pointer disabled:opacity-45 ${blockedByWindow ? 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] text-white'}`}
                      >
                        {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : q.free ? 'เจรจาฟรี' : `ยื่น ${q.price}k`}
                      </button>
                    </div>
                  );
                })}
                {!marketList.length && (
                  <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะในหมวดนี้ — ลองกด &quot;หาตลาดใหม่&quot; หรือสลับไป &quot;ซื้อจากสโมสรในลีก&quot;</p>
                )}
              </>
            ) : (
              <>
                {clubMarketList.map(({ q, team, idx, price }) => {
                  const blockedByWindow = !tx.tw.open;
                  return (
                    <div key={`${team.id}-${q.n}-${idx}`} className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] ${blockedByWindow ? 'opacity-70' : ''}`}>
                      <PlayerFace player={q} team={team} state={state} size={36} />
                      <button type="button" onClick={() => onInspectPlayer(q, team)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="font-bold text-xs truncate">
                          <span className="text-[var(--g)]">{q.ro}</span> · {q.n}
                        </div>
                        <div className="text-[11px] text-[var(--mut)] truncate">
                          {team.name} ({TN[team.tier]}) · {SPN[q.ro] || q.pos} · อายุ {q.age}
                        </div>
                      </button>
                      <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                      <button
                        type="button"
                        disabled={!!q.locked || blockedByWindow}
                        onClick={() => openNegotiation('club', idx, q, team)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer disabled:opacity-45 ${blockedByWindow ? 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]' : 'bg-[var(--g)] text-white'}`}
                      >
                        {q.locked ? 'ล่ม' : blockedByWindow ? '🔒 ปิดตลาด' : `ยื่น ~${price}k`}
                      </button>
                    </div>
                  );
                })}
                {!clubMarketList.length && <p className="text-xs text-[var(--mut)]">ไม่พบนักเตะตำแหน่งนี้ในสโมสรอื่น</p>}
              </>
            )}
          </div>
        </div>

        {renderScoutCard('mland:hidden')}
      </div>

      <div className="space-y-4 mland:space-y-1.5 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="hidden mland:grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {([
            ['sell', `🏷️ ขาย/ดีล (${getIncomingOffers(state).length})`],
            ['scout', '🔍 แมวมอง'],
            ['con', '📋 สัญญา/เด็ก']
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMktMobTab(k)}
              className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer ${mktMobTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="space-y-4 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        <div className={mktMobTab === 'sell' ? '' : 'mland:hidden'}>
        {(() => {
          const incomingOffers = getIncomingOffers(state);
          if (!incomingOffers.length) return null;
          return (
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--lamp-soft)] border border-[var(--lamp)] space-y-2.5 mland:space-y-1.5">
              <div className="font-bold text-sm">💼 ข้อเสนอซื้อนักเตะจากทีมอื่น ({incomingOffers.length})</div>
              <div className="space-y-2">
                {incomingOffers.map((off) => {
                  const targetQ = me.sq.find((q) => q.n === off.n);
                  if (!targetQ) return null;
                  const marketVal = vlu(targetQ);
                  const buyerTeam =
                    (off.teamId != null ? state.teams.find((t) => t.id === off.teamId) : undefined) ||
                    state.teams.find((t) => t.name === off.t);
                  return (
                    <div key={`${off.n}__${off.t}`} className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
                      <div className="flex items-center gap-2.5">
                        <PlayerFace player={targetQ} team={me} state={state} size={34} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">
                            {off.t}{buyerTeam ? ` (${TN[buyerTeam.tier] || ''})` : ''}
                          </div>
                          <div className="text-[11px] text-[var(--mut)]">
                            ขอซื้อ <b>{off.n}</b> ({targetQ.ro} · {targetQ.ov}) ราคา <b className="text-[var(--g)]">{off.p}k ฿</b> (ประเมิน {marketVal}k)
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const res = canAcceptTransferOffer(state, off);
                            if (!res.ok) { onToast(res.err || 'ขายไม่สำเร็จ'); return; }
                            onUpdateState((d) => { acceptTransferOffer(d, off); });
                            SFX.win();
                            onToast(`ขาย ${off.n} ให้ ${res.buyerName || off.t} รับ +${off.p}k ฿`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[var(--g)] text-white text-xs font-bold cursor-pointer"
                        >
                          ✅ ตอบรับขาย
                        </button>
                        {!off.cnt && (
                          <button
                            type="button"
                            onClick={() => {
                              const out = resolveCounterOfferOutcome(state, off);
                              onUpdateState((d) => applyCounterOfferOutcome(d, off, out));
                              onToast(
                                out.accepted
                                  ? `${off.t} ยอมเพิ่มราคาเป็น ${out.newPrice}k ฿!`
                                  : `${off.t} ถอนข้อเสนอซื้อ ${off.n}`
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-bold cursor-pointer"
                          >
                            💰 โก่งราคา +15%
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateState((d) => removeIncomingOffer(d, off.n, off.t));
                            onToast(`ปฏิเสธข้อเสนอจาก ${off.t} แล้ว`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold cursor-pointer"
                        >
                          ✕ ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        </div>

        <div className={mktMobTab === 'sell' ? '' : 'mland:hidden'}>
        {(() => {
          const listedPlayers = me.sq.filter((q) => q.listed && !q.loan);
          const unlistedEligible = me.sq
            .filter((q) => !q.listed && !q.loan)
            .slice()
            .sort((a, b) => b.ov - a.ov);
          return (
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm">🏷️ นักเตะที่ขึ้นบัญชีขายของทีมเรา ({listedPlayers.length})</h3>
                <span className="text-[11px] text-[var(--mut)]">{tx.tw.open ? 'ยื่นเสนอทีมอื่นได้' : 'รอตลาดเปิด'}</span>
              </div>
              {listedPlayers.length > 0 ? (
                <div className="space-y-2">
                  {listedPlayers.map((q) => {
                    const chk = getPlayerSellCheck(state, me, q);
                    const ask = q.askPrice || vlu(q);
                    return (
                      <div key={q.n} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface-2)]">
                        <PlayerFace player={q} team={me} state={state} size={34} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs truncate">{q.ro} · {q.n} ({q.ov})</div>
                          <div className="text-[11px] text-[var(--mut)]">
                            ตั้งขาย {ask}k ฿ · ประเมิน {vlu(q)}k
                          </div>
                        </div>
                        <button
                          type="button"
                          title={chk.pitchedThisTurn ? 'เสนอขายไปแล้วในนัดนี้' : chk.canPitch ? 'ส่งเสนอขายให้ทีมอื่น' : chk.reason}
                          onClick={() => {
                            if (!chk.canPitch) { onToast(chk.reason || 'ยังไม่สามารถเสนอขายได้'); return; }
                            if (chk.pitchedThisTurn) { onToast('เสนอขายคนนี้ไปแล้วในนัดนี้'); return; }
                            SFX.tap();
                            setPitchTargetName(q.n);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            chk.canPitch && !chk.pitchedThisTurn
                              ? 'bg-[var(--g)] text-white border-[var(--g)]'
                              : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)] opacity-65'
                          }`}
                        >
                          {!tx.tw.open ? '🔒' : chk.pitchedThisTurn ? '⏳ รอนัดหน้า' : '📨 เสนอขาย'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateState((d) => {
                              const t = d.teams[d.me].sq.find((z) => z.n === q.n);
                              if (t) {
                                t.listed = 0;
                                delete t.askPrice;
                              }
                            });
                            onToast(`ถอด ${q.n} ออกจากบัญชีขายแล้ว`);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-semibold cursor-pointer"
                        >
                          ถอด
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--mut)]">
                  ยังไม่มีนักเตะในบัญชีขาย เลือกด้านล่างหรือกด 🏷️ ที่หน้า &quot;ทีม &amp; แผน → ทั้งทีม&quot; เพื่อขึ้นตลาดให้สโมสรอื่นยื่นข้อเสนอ
                </p>
              )}

              {unlistedEligible.length > 0 && (
                <div className="flex gap-1.5 pt-1">
                  <select
                    value={quickListName}
                    onChange={(e) => setQuickListName(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
                  >
                    <option value="">+ เลือกนักเตะขึ้นบัญชีขาย...</option>
                    {unlistedEligible.map((q) => (
                      <option key={q.n} value={q.n}>
                        {q.ro} · {q.n} (OVR {q.ov} · {vlu(q)}k)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!quickListName}
                    onClick={() => {
                      const targetName = quickListName;
                      if (!targetName) return;
                      SFX.tap();
                      onUpdateState((d) => {
                        const target = d.teams[d.me].sq.find((z) => z.n === targetName);
                        if (target) {
                          target.listed = 1;
                          target.askPrice = Math.max(5, vlu(target));
                        }
                      });
                      setQuickListName('');
                      onToast(`ขึ้นบัญชีขาย ${targetName} แล้ว`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--lamp)] text-[#261900] text-xs font-bold cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    🏷️ ขึ้นตลาด
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        </div>

        {mktMobTab === 'scout' && renderScoutCard('hidden mland:block')}

        <div className={`space-y-4 mland:space-y-2 ${mktMobTab === 'con' ? '' : 'mland:hidden'}`}>
        {loanPlayers.length > 0 && (
          <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
            <h3 className="font-bold text-sm">📌 นักเตะยืมตัวที่มีออปชันซื้อขาด</h3>
            {loanPlayers.map(({ q, i }) => (
              <div key={q.n} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface-2)]">
                <PlayerFace player={q} team={me} state={state} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate">{q.pos} · {q.n}</div>
                  <div className="text-[11px] text-[var(--mut)]">ออปชันซื้อขาด {q.loanOpt}k ฿</div>
                </div>
                <button
                  type="button"
                  disabled={!tx.tw.open || state.money < (q.loanOpt || 0)}
                  onClick={() => {
                    const cost = q.loanOpt || 0;
                    onUpdateState((d) => {
                      d.money -= cost;
                      logFin(d, `ใช้ออปชันซื้อขาด ${q.n}`, -cost);
                      const target = d.teams[d.me].sq[i];
                      delete target.loan;
                      delete target.loanOpt;
                      target.signedSeason = d.season;
                      target.signedMd = d.md;
                      target.con = { yr: 3, wg: wagOf(target), role: target.ov >= 70 ? 'key' : 'rot' };
                    });
                    onToast(`ซื้อขาด ${q.n} ถาวรแล้ว!`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  {!tx.tw.open ? '🔒 รอตลาดเปิด' : `ซื้อขาด ${q.loanOpt}k`}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
          <h3 className="font-bold text-sm">📋 สัญญานักเตะ &amp; ต่อสัญญา</h3>
          <p className="text-xs text-[var(--mut)]">นักเตะเหลือสัญญา ≤ 1 ปี ควรรีบต่อสัญญา ก่อนค่าเหนื่อยจะพุ่งขึ้น +25%</p>
          <div className="space-y-1.5">
            {contractList.map(({ q, i, c }) => (
              <div key={q.n} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                <PlayerFace player={q} team={me} state={state} size={34} />
                <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                  <div className="font-bold text-xs truncate">
                    {q.pos} · {q.n}{' '}
                    <span className={c.yr <= 1 ? 'text-[var(--red)]' : 'text-[var(--lamp)]'}>({c.yr <= 0 ? 'หมดสัญญา!' : `เหลือ ${c.yr} ปี`})</span>
                  </div>
                  <div className="text-[11px] text-[var(--mut)]">{ROLE_L[c.role]} · ค่าเหนื่อย {c.wg}k/นัด</div>
                </button>
                <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                <button
                  type="button"
                  onClick={() => { setRenewIdx(i); setRenewYr(Math.max(2, c.yr + 2 > 5 ? 3 : c.yr + 2)); setRenewRole(c.role); setRenewWb(1); setRenewMsg(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${c.yr <= 1 ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] border border-[var(--line)]'}`}
                >
                  ต่อสัญญา
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
          <h3 className="font-bold text-sm">🌱 เด็กเยาวชนอะคาเดมี่ (เซ็นฟรี · ลงทะเบียนได้ตลอดปี)</h3>
          <p className="text-xs text-[var(--mut)]">อัปเกรดอะคาเดมี่เพื่อรับเยาวชนฝีเท้าดีขึ้นทุกต้นฤดูกาล</p>
          {(state.yth || []).length ? (
            <div className="space-y-1.5">
              {state.yth.map((q, i) => (
                <div key={q.n} className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)]">
                  <PlayerFace player={q} team={me} state={state} size={34} />
                  <button type="button" onClick={() => onInspectPlayer(q, me)} className="flex-1 min-w-0 text-left cursor-pointer">
                    <div className="font-bold text-xs truncate">{q.pos} · {q.n}</div>
                    <div className="text-[11px] text-[var(--mut)]">อายุ {q.age} ปี · {'★'.repeat(Math.round(q.pot / 20))}</div>
                  </button>
                  <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold tabular" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                  <button
                    type="button"
                    disabled={me.sq.length >= tx.maxSquad || tx.curWage + wagOf(q) > tx.wageCap}
                    onClick={() => {
                      onUpdateState((d) => {
                        const t = d.teams[d.me];
                        const y = d.yth[i];
                        if (!y || t.sq.length >= LEAGUE_TRANSFER_RULES.maxSquad) return;
                        y.con = { yr: 3, wg: wagOf(y), role: 'pro' };
                        y.no = undefined;
                        y.signedSeason = d.season;
                        y.signedMd = d.md;
                        t.sq.push(y);
                        assignTeamShirtNumbers(t);
                        d.yth.splice(i, 1);
                      });
                      onToast(`เซ็นเยาวชน ${q.n} สัญญา 3 ปี`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-xs font-bold cursor-pointer disabled:opacity-40"
                  >
                    เซ็น 3 ปี
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--mut)]">ปลายซีซั่นจะมีเด็กเยาวชนชุดใหม่เข้ามา</p>
          )}
        </div>
        </div>
      </div>
      </div>
      </div>

      {renderNegotiationModal()}
      {renderRenewModal()}
      {pitchTargetName && (() => {
        const pitchPlayer = me.sq.find((z) => z.n === pitchTargetName);
        if (!pitchPlayer) return null;
        return (
          <PitchPlayerModal
            state={state}
            player={pitchPlayer}
            onClose={() => setPitchTargetName(null)}
            onConfirm={(askPct) => {
              const result = resolvePitchPlayerOutcome(state, pitchPlayer.n, askPct);
              setPitchTargetName(null);
              if (!result.ok) {
                onToast(result.err || 'เสนอขายไม่สำเร็จ');
                return;
              }
              onUpdateState((d) => applyPitchPlayerOutcome(d, pitchPlayer.n, result));
              if (result.offers.length > 0) {
                SFX.win();
                onToast(`มี ${result.offers.length} สโมสรยื่นข้อเสนอซื้อ ${pitchPlayer.n} แล้ว!`);
              } else {
                onToast(`ขึ้นบัญชีขาย ${pitchPlayer.n} แล้ว แต่รอบนี้ยังไม่มีทีมยื่นซื้อเข้ามาทันที`);
              }
            }}
          />
        );
      })()}
    </div>
  );
};


// ============================================================================
// 10. FINANCE & CLUB IDENTITY VIEW
// ============================================================================
const FinanceClubView: React.FC<{
  tab: 'f' | 'u';
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ tab, state, onUpdateState, onToast }) => {
  const [finTab, setFinTab] = useState<'overview' | 'commercial' | 'infra' | 'ledger'>('overview');
  const [clubTab, setClubTab] = useState<'info' | 'identity' | 'activities' | 'legacy'>('info');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out'>('all');

  const me = state.teams[state.me];

  if (tab === 'f') {
    const est = calcMatchdayFinanceEstimate(state, me);
    const tx = getLeagueTransferContext(state, me);
    const stf = getStaffState(state);
    const bd = clamp(state.bd ?? 50, 0, 100);
    const rep = state.mgrRep ?? 50;
    const repRank =
      rep >= 180 ? 'ตำนานลูกหนังไทย' : rep >= 130 ? 'ยอดกุนซือระดับทวีป' : rep >= 90 ? 'กุนซือมือทอง' : rep >= 65 ? 'โค้ชฝีมือดี' : 'กุนซือหน้าใหม่';
    const tierTbl = sortTable(state.teams.filter((t) => t.tier === me.tier));
    const curRank = Math.max(1, tierTbl.findIndex((t) => t.id === me.id) + 1);
    const targetRank = state.obj || 8;
    const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
    const totalDebt = bankRemain + (state.payDue || 0);
    const tierMult = 1 + me.tier * 0.45;

    const upgradeFac = (key: 'st' | 'tr' | 'ya' | 'med' | 'merchLv', title: string, baseCost: number) => {
      const lv = state[key] ?? 1;
      const cost = lv * baseCost;
      if (lv >= 5 || state.money < cost) {
        onToast(lv >= 5 ? 'ระดับสูงสุดแล้ว' : 'งบสโมสรไม่พอ');
        return;
      }
      SFX.tap();
      onUpdateState((d) => {
        d.money -= cost;
        d[key] = (d[key] ?? 1) + 1;
        logFin(d, `อัปเกรด${title} Lv.${d[key]}`, -cost);
      });
      onToast(`อัปเกรด${title}เป็น Lv.${lv + 1} สำเร็จ!`);
    };

    const hireStaff = (role: 'asst' | 'fit' | 'scout' | 'physio', title: string) => {
      const cur = stf[role];
      if (cur >= 3) {
        onToast(`${title} ระดับสูงสุดแล้ว`);
        return;
      }
      const cost = [45, 75, 110][cur];
      if (state.money < cost) {
        onToast(`งบไม่พอ (ต้องการ ${cost}k ฿)`);
        return;
      }
      SFX.tap();
      onUpdateState((d) => {
        d.money -= cost;
        d.staff = { ...getStaffState(d), [role]: cur + 1 };
        logFin(d, `จ้าง/อัปเกรด${title} Lv.${cur + 1}`, -cost);
      });
      onToast(`จ้าง${title} Lv.${cur + 1} เรียบร้อย`);
    };

    const fireStaff = (role: 'asst' | 'fit' | 'scout' | 'physio', title: string) => {
      const cur = stf[role];
      if (cur <= 0) return;
      SFX.tap();
      onUpdateState((d) => {
        d.staff = { ...getStaffState(d), [role]: cur - 1 };
      });
      onToast(`ลดระดับ${title}เหลือ Lv.${cur - 1} (ประหยัดค่าจ้าง 1.5k/นัด)`);
    };

    const partnerDeals = [
      {
        id: 'drink',
        name: 'เครื่องดื่มเกลือแร่สปอร์ต',
        perMatch: Math.round(5 * tierMult),
        matches: 8,
        signBonus: Math.round(12 * tierMult),
        reqOk: true,
        reqText: 'พร้อมเซ็นสัญญาได้ทันที'
      },
      {
        id: 'apparel',
        name: 'แบรนด์ชุดกีฬาลูกหนังไทย',
        perMatch: Math.round(7 * tierMult),
        matches: 10,
        signBonus: Math.round(15 * tierMult),
        reqOk: (state.fan ?? 55) >= 45,
        reqText: 'ต้องการขวัญแฟนบอล ≥ 45%'
      },
      {
        id: 'telecom',
        name: 'เครือข่ายมือถือ & ถ่ายทอดสด',
        perMatch: Math.round(10 * tierMult),
        matches: 12,
        signBonus: Math.round(22 * tierMult),
        reqOk: me.tier >= 1 || (state.fan ?? 55) >= 65,
        reqText: 'ต้องการอยู่ระดับ D2 ขึ้นไป หรือแฟนบอล ≥ 65%'
      }
    ];

    const loanPackages = [
      { id: 'short', title: 'สินเชื่อหมุนเวียนระยะสั้น', amount: 80, per: 9, left: 10, desc: 'ดอกเบี้ยต่ำ เหมาะอุดงบขาดมือชั่วคราว' },
      { id: 'std', title: 'สินเชื่อมาตรฐานสโมสร', amount: 150, per: 18, left: 10, desc: 'วงเงินสมดุลสำหรับเสริมทัพหรืออัปสิ่งก่อสร้าง' },
      { id: 'big', title: 'สินเชื่อลงทุนโครงสร้างใหญ่', amount: 300, per: 30, left: 12, desc: 'ทุนก้อนโตสำหรับขยายสนามและทีมงาน' }
    ];

    const finEntries = state.finLog || [];
    const totalLogIn = finEntries.filter((x) => x.amt > 0).reduce((a, x) => a + x.amt, 0);
    const totalLogOut = finEntries.filter((x) => x.amt < 0).reduce((a, x) => a + Math.abs(x.amt), 0);
    const filteredEntries = finEntries.filter((x) => (ledgerFilter === 'in' ? x.amt > 0 : ledgerFilter === 'out' ? x.amt < 0 : true));

    const posWageMap: Record<Position, number> = {
      GK: me.sq.filter((q) => q.pos === 'GK').reduce((a, q) => a + wagOf(q), 0),
      DF: me.sq.filter((q) => q.pos === 'DF').reduce((a, q) => a + wagOf(q), 0),
      MF: me.sq.filter((q) => q.pos === 'MF').reduce((a, q) => a + wagOf(q), 0),
      FW: me.sq.filter((q) => q.pos === 'FW').reduce((a, q) => a + wagOf(q), 0)
    };
    const topEarners = me.sq.slice().sort((a, b) => wagOf(b) - wagOf(a)).slice(0, 3);

    return (
      <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
        {/* Top 4 Financial KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 mland:grid-cols-4 gap-2.5 mland:gap-1.5 shrink-0">
          <div className="p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[10px] font-semibold text-[var(--mut)]">งบสโมสรปัจจุบัน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-sm tabular mt-0.5 mland:mt-0 ${state.money < 0 ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
              {state.money.toLocaleString()}k ฿
            </div>
            <div className={`text-[11px] mland:text-[9px] mt-0.5 mland:mt-0 truncate ${state.money < 0 ? 'text-[var(--red)] font-bold' : 'text-[var(--mut)]'}`}>
              {state.money < 0 ? '⚠️ ติดลบ (ล็อก FFP ซื้อตัว)' : 'สถานะการเงินพร้อมดำเนินการ'}
            </div>
          </div>

          <div className="p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[10px] font-semibold text-[var(--mut)]">คาดการณ์สุทธิ / นัดเหย้า</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-sm tabular mt-0.5 mland:mt-0 ${est.homeNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
              {est.homeNet >= 0 ? `+${est.homeNet}k` : `${est.homeNet}k`}
            </div>
            <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              เกมเยือน: <b className={est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}>{est.awayNet >= 0 ? `+${est.awayNet}k` : `${est.awayNet}k`}</b>
            </div>
          </div>

          <div className="p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[10px] font-semibold text-[var(--mut)]">ค่าเหนื่อยนักเตะ / เพดาน</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-sm tabular mt-0.5 mland:mt-0 ${tx.wagePct >= 95 ? 'text-[var(--red)]' : ''}`}>
              {tx.curWage}k <span className="text-xs mland:text-[10px] font-semibold text-[var(--mut)]">/ {tx.wageCap}k</span>
            </div>
            <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ใช้ไป {tx.wagePct}% · สตาฟฟ์ -{est.staffCost}k/นัด
            </div>
          </div>

          <div className="p-3.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)]">
            <div className="text-[11px] mland:text-[10px] font-semibold text-[var(--mut)]">ภาระหนี้คงค้างรวม</div>
            <div className={`font-bold text-xl sm:text-2xl mland:text-sm tabular mt-0.5 mland:mt-0 ${totalDebt > 0 ? 'text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {totalDebt.toLocaleString()}k ฿
            </div>
            <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular mt-0.5 mland:mt-0 truncate">
              ธนาคาร {bankRemain}k · ค่าตัวปลายปี {state.payDue || 0}k
            </div>
          </div>
        </div>

        {/* Finance Sub-navigation */}
        <div className="flex flex-wrap mland:flex-nowrap gap-1.5 mland:gap-1 p-1.5 mland:p-0.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0 overflow-x-auto">
          {(
            [
              ['overview', '📊 ภาพรวม & บอร์ด'],
              ['commercial', '💼 สปอนเซอร์ & ตั๋ว'],
              ['infra', '🏟️ สนาม & ทีมงาน'],
              ['ledger', '📒 บัญชี & สินเชื่อ']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFinTab(id)}
              className={`flex-1 min-w-[125px] mland:min-w-0 px-3 mland:px-1.5 py-2 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                finTab === id ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tab 1: Overview & Board */}
        {finTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm mland:text-xs">👔 บอร์ดบริหาร &amp; เครดิตกุนซือ</h3>
                  <p className="text-xs text-[var(--mut)]">
                    อันดับปัจจุบัน: <b className="text-[var(--ink)] tabular">#{curRank}/{tierTbl.length}</b> · เป้าหมายบอร์ด: <b className="text-[var(--g)] tabular">อันดับ {targetRank} ขึ้นไป</b>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--lamp)] tabular">ชื่อเสียง {rep}</div>
                  <div className="text-[11px] text-[var(--mut)]">{repRank}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--mut)]">ความเชื่อมั่นบอร์ดบริหาร</span>
                  <b className={`tabular ${bd < 30 ? 'text-[var(--red)]' : bd >= 70 ? 'text-[var(--g)]' : ''}`}>{bd}%</b>
                </div>
                <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${bd}%`, background: bd < 30 ? 'var(--red)' : bd < 55 ? 'var(--lamp)' : 'var(--g)' }}
                  />
                </div>
                <div className="text-[11px] text-[var(--mut)]">
                  {bd < 30
                    ? '⚠️ ความเชื่อมั่นวิกฤติ! ต้องรีบทำผลงานและคุมงบไม่ให้ติดลบ มิฉะนั้นอาจถูกปลดกลางคัน'
                    : curRank <= targetRank
                      ? '✅ ผลงานเป็นไปตามเป้าหมายบอร์ดบริหาร'
                      : '📌 อันดับยังต่ำกว่าเป้าหมายบอร์ด — เร่งเก็บแต้มในลีก'}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--line)]/60 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ขวัญแฟนบอล</div>
                  <div className="font-bold text-sm tabular">{state.fan ?? 55}%</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ขวัญห้องแต่งตัว</div>
                  <div className="font-bold text-sm tabular">{state.mor ?? 55}%</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ความจุสนาม</div>
                  <div className="font-bold text-sm tabular">{est.cap.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="contents mland:block mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
              <h3 className="font-bold text-sm mland:text-xs">💰 ประมาณการกระแสเงินสดต่อแมตช์</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                  <div className="font-bold text-[var(--g)] flex justify-between">
                    <span>🏠 เกมเหย้า</span>
                    <span className="tabular">{est.homeNet >= 0 ? `+${est.homeNet}k` : `${est.homeNet}k`}</span>
                  </div>
                  <div className="flex justify-between text-[var(--mut)]"><span>ค่าตั๋วเข้าชม (~{est.estAtt.toLocaleString()} คน)</span><b className="text-[var(--g)] tabular">+{est.estTicket}k</b></div>
                  <div className="flex justify-between text-[var(--mut)]"><span>ขายของที่ระลึก (Lv.{state.merchLv ?? 1})</span><b className="text-[var(--g)] tabular">+{est.estMerch}k</b></div>
                  <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก + พาร์ทเนอร์</span><b className="text-[var(--g)] tabular">+{est.estSponsor + est.dealIncome}k</b></div>
                  <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60"><span>รายจ่ายรวม/นัด</span><b className="text-[var(--red)] tabular">-{est.totalOut}k</b></div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-1.5 text-xs">
                  <div className="font-bold flex justify-between">
                    <span>✈️ เกมเยือน</span>
                    <span className={`tabular ${est.awayNet >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>{est.awayNet >= 0 ? `+${est.awayNet}k` : `${est.awayNet}k`}</span>
                  </div>
                  <div className="flex justify-between text-[var(--mut)]"><span>สปอนเซอร์หลัก</span><b className="text-[var(--g)] tabular">+{est.estSponsor}k</b></div>
                  <div className="flex justify-between text-[var(--mut)]"><span>ดีลพาร์ทเนอร์</span><b className="text-[var(--g)] tabular">+{est.dealIncome}k</b></div>
                  <div className="flex justify-between text-[var(--mut)]"><span>ค่าเหนื่อยนักเตะ + สตาฟฟ์</span><b className="text-[var(--red)] tabular">-{est.wageCost + est.staffCost}k</b></div>
                  <div className="flex justify-between text-[var(--mut)] pt-1 border-t border-[var(--line)]/60"><span>ผ่อนเงินกู้ธนาคาร</span><b className="text-[var(--red)] tabular">-{est.loanCost}k</b></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 mland:col-span-1 p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm mland:text-xs">⚡ มาตรการกระตุ้นนัดถัดไป</h3>
                <span className="text-[11px] text-[var(--mut)]">มีผลทันทีในแมตช์ที่กำลังจะลงแข่ง</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="font-bold text-xs">🏆 โบนัสอัดฉีดชัยชนะ (จ่ายเฉพาะเมื่อชนะ)</div>
                  <div className="text-[11px] text-[var(--mut)]">เพิ่มความมุ่งมั่นและโอกาสทำผลงานดีในนัดสำคัญ</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      [0, 'ไม่มีโบนัส'],
                      [10, '10k (ขวัญ +)'],
                      [25, '25k (ขวัญ ++)']
                    ] as const).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onUpdateState((d) => { d.winBonus = v; })}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                          (state.winBonus || 0) === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] border border-[var(--line)]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
                  <div className="font-bold text-xs">📣 แคมเปญโปรโมตวันแข่ง</div>
                  <div className="text-[11px] text-[var(--mut)]">
                    {state.promo === 1
                      ? '✅ กำลังใช้งาน: แคมเปญดึงดูดผู้ชม (ตั๋วนัดหน้า +35% และแฟนเข้าชม +15%)'
                      : state.promo === 2
                        ? '✅ กำลังใช้งาน: บูสต์สปอนเซอร์วันแข่ง (+35% รายได้สปอนเซอร์)'
                        : 'เลือกลงทุนโปรโมต 1 นัด เพื่อดันรายได้วันแข่งขัน'}
                  </div>
                  {!state.promo && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={state.money < 15}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 15;
                            d.promo = 1;
                            logFin(d, 'โปรโมตตั๋ววันแข่ง', -15);
                          });
                          onToast('เปิดแคมเปญโปรโมตตั๋ววันแข่งแล้ว');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer hover:border-[var(--g)]"
                      >
                        โปรโมตตั๋ว (15k)
                      </button>
                      <button
                        type="button"
                        disabled={state.money < 25}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= 25;
                            d.promo = 2;
                            logFin(d, 'บูสต์สปอนเซอร์วันแข่ง', -25);
                          });
                          onToast('เปิดแคมเปญบูสต์สปอนเซอร์แล้ว');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer hover:border-[var(--g)]"
                      >
                        บูสต์สปอนฯ (25k)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Sub-tab 2: Sponsors, Partner Deals, Tickets & Merch */}
        {finTab === 'commercial' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="space-y-4 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <h3 className="font-bold text-sm">🤝 สปอนเซอร์หลักคาดอกเสื้อ</h3>
                <div className="space-y-2">
                  {[
                    { idx: 0, title: 'แพ็กเกจมั่นคงสม่ำเสมอ', base: `${8 + me.tier * 6}k / นัด`, note: 'รับรายได้คงที่ทุกแมตช์ทั้งเหย้าและเยือน' },
                    { idx: 1, title: 'แพ็กเกจโบนัสชัยชนะ', base: `${4 + me.tier * 4}k + โบนัสชนะ ${10 + me.tier * 6}k`, note: 'พื้นฐานต่ำกว่า แต่ถ้าชนะรับเงินก้อนโต' },
                    { idx: 2, title: 'แพ็กเกจบิ๊กแมตช์ & ดาร์บี้', base: `${5 + me.tier * 5}k + ดาร์บี้ ${18 + me.tier * 8}k`, note: 'จ่ายหนักพิเศษเมื่อลงเล่นเกมดาร์บี้แมตช์' }
                  ].map((opt) => {
                    const active = (state.sp ?? 0) === opt.idx;
                    return (
                      <button
                        key={opt.idx}
                        type="button"
                        onClick={() => onUpdateState((d) => { d.sp = opt.idx; })}
                        className={`w-full p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                          active ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--line)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span>{opt.title}</span>
                          <span className="text-[var(--g)] tabular">{opt.base}</span>
                        </div>
                        <div className="text-[11px] text-[var(--mut)] mt-0.5">{opt.note}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">📄 ดีลพาร์ทเนอร์ระยะสั้น</h3>
                  <span className="text-[11px] text-[var(--mut)]">{state.sponsorDeal ? 'มีสัญญาใช้งานอยู่' : 'เลือกเซ็นสัญญาเพิ่มรายได้'}</span>
                </div>
                {state.sponsorDeal ? (
                  <div className="p-3.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{state.sponsorDeal.name}</span>
                      <span className="text-[var(--g)] tabular">+{state.sponsorDeal.perMatch}k / นัด</span>
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">
                      เหลืออายุสัญญาอีก {state.sponsorDeal.left} นัด (คาดการณ์รับเพิ่ม {state.sponsorDeal.left * state.sponsorDeal.perMatch}k ฿)
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partnerDeals.map((deal) => (
                      <div key={deal.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{deal.name}</div>
                          <div className="text-[11px] text-[var(--mut)] tabular">
                            +{deal.perMatch}k/นัด · {deal.matches} นัด · โบนัสเซ็น +{deal.signBonus}k
                          </div>
                          <div className={`text-[10px] mt-0.5 ${deal.reqOk ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>{deal.reqText}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!deal.reqOk}
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.sponsorDeal = { id: deal.id, name: deal.name, perMatch: deal.perMatch, left: deal.matches };
                              d.money += deal.signBonus;
                              logFin(d, `โบนัสเซ็นสัญญา: ${deal.name}`, deal.signBonus);
                            });
                            onToast(`เซ็นสัญญากับ ${deal.name} สำเร็จ (+${deal.signBonus}k ฿)`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          เซ็นสัญญา
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">🎫 นโยบายราคาตั๋วเข้าชม</h3>
                  <span className="text-xs font-bold text-[var(--g)] tabular">~{est.estAtt.toLocaleString()} / {est.cap.toLocaleString()} ({est.attPct}%)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { idx: 0, label: 'ตั๋วถูก', desc: 'คนดูเยอะ +ขวัญแฟน' },
                    { idx: 1, label: 'ตั๋วกลาง', desc: 'สมดุลคนดู & รายรับ' },
                    { idx: 2, label: 'ตั๋วแพง', desc: 'ทำเงินสูง / คนดูลด' }
                  ].map((opt) => (
                    <button
                      key={opt.idx}
                      type="button"
                      onClick={() => onUpdateState((d) => { d.tp = opt.idx; })}
                      className={`p-2.5 rounded-xl text-left border cursor-pointer ${
                        (state.tp ?? 1) === opt.idx ? 'bg-[var(--g)] text-white border-[var(--g)]' : 'bg-[var(--surface-2)] border-transparent'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className={`text-[10px] mt-0.5 ${(state.tp ?? 1) === opt.idx ? 'text-white/85' : 'text-[var(--mut)]'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--surface-2)] flex items-center justify-between text-xs">
                  <span className="text-[var(--mut)]">รายได้ค่าตั๋วเหย้าโดยประมาณ</span>
                  <b className="text-[var(--g)] tabular">+{est.estTicket}k ฿ / นัดเหย้า</b>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">🛍️ ร้านค้าของที่ระลึกสโมสร</h3>
                  <span className="text-xs font-bold tabular">Lv.{state.merchLv ?? 1}/5</span>
                </div>
                <p className="text-xs text-[var(--mut)]">
                  สร้างรายได้เสริมทุกนัดเหย้า ({est.estMerch}k ฿/นัด) และช่วยขยายเพดานค่าเหนื่อยลีก +5% ต่อเลเวล
                </p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((lv) => (
                      <span key={lv} className={`h-2 w-7 rounded-full ${lv <= (state.merchLv ?? 1) ? 'bg-[var(--g)]' : 'bg-[var(--surface-2)]'}`} />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={(state.merchLv ?? 1) >= 5 || state.money < (state.merchLv ?? 1) * 75}
                    onClick={() => upgradeFac('merchLv', 'ร้านค้าของที่ระลึก', 75)}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {(state.merchLv ?? 1) >= 5 ? 'เต็มแล้ว' : `ขยายร้าน ${(state.merchLv ?? 1) * 75}k`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab 3: Facilities, Backroom Staff & Training Focus */}
        {finTab === 'infra' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto">
              <h3 className="font-bold text-sm mland:text-xs">🏟️ สิ่งอำนวยความสะดวกสโมสร (สูงสุด Lv.5)</h3>
              {(
                [
                  ['st', 'สนามกีฬา', `ความจุ ${est.cap.toLocaleString()} ที่นั่ง · เพิ่มตั๋ว & เพดานค่าจ้าง +10%/Lv`, 100],
                  ['tr', 'ศูนย์ฝึกซ้อม', 'เพิ่มโอกาสอัปค่าพลังซ้อม & ฟื้นความฟิต +2%/Lv', 80],
                  ['ya', 'อะคาเดมี่เยาวชน', 'สร้างเยาวชน OVR สูงขึ้น & เพิ่มคุณภาพแมวมอง', 80],
                  ['med', 'ศูนย์การแพทย์ & ฟื้นฟู', 'ลดโอกาสบาดเจ็บ -8%/Lv และเร่งฟื้นฟูอาการเจ็บ', 75]
                ] as const
              ).map(([k, title, desc, baseCost]) => {
                const lv = state[k] ?? 1;
                const cost = lv * baseCost;
                return (
                  <div key={k} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)]/60 last:border-0">
                    <div className="min-w-0">
                      <div className="font-bold text-xs">{title} · Lv.{lv}/5</div>
                      <div className="text-[11px] text-[var(--mut)]">{desc}</div>
                      <div className="flex gap-1 mt-1.5">
                        {[1, 2, 3, 4, 5].map((x) => (
                          <span key={x} className={`h-1.5 w-5 rounded-full ${x <= lv ? 'bg-[var(--g)]' : 'bg-[var(--surface-2)]'}`} />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={lv >= 5 || state.money < cost}
                      onClick={() => upgradeFac(k, title, baseCost)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {lv >= 5 ? 'เต็มแล้ว' : `อัป ${cost}k`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">🧑‍🏫 ทีมงานสตาฟฟ์โค้ช (สูงสุด Lv.3)</h3>
                  <span className="text-xs font-bold text-[var(--red)] tabular">ค่าจ้างรวม -{est.staffCost}k/นัด</span>
                </div>
                {(
                  [
                    ['asst', 'ผู้ช่วยโค้ช', 'เพิ่มความคุ้นเคยแท็กติก & โอกาสซ้อมพัฒนา +2%/Lv'],
                    ['fit', 'โค้ชฟิตเนส', 'ฟื้นฟูความฟิตทั้งทีมหลังจบแมตช์ +2%/Lv'],
                    ['scout', 'หัวหน้าแมวมอง', 'เพิ่มคุณภาพ & จำนวนนักเตะจากภารกิจแมวมอง'],
                    ['physio', 'นักกายภาพบำบัด', 'ลดความเสี่ยงบาดเจ็บ -8%/Lv & หายเจ็บไวขึ้น']
                  ] as const
                ).map(([role, title, desc]) => {
                  const lv = stf[role];
                  const nextCost = [45, 75, 110][lv] ?? 0;
                  return (
                    <div key={role} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--line)]/60 last:border-0">
                      <div className="min-w-0">
                        <div className="font-bold text-xs">{title} · Lv.{lv}/3</div>
                        <div className="text-[11px] text-[var(--mut)]">{desc}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {lv > 0 && (
                          <button
                            type="button"
                            onClick={() => fireStaff(role, title)}
                            className="px-2 py-1.5 rounded-lg bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--mut)] hover:text-[var(--red)] cursor-pointer"
                          >
                            ลด
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={lv >= 3 || state.money < nextCost}
                          onClick={() => hireStaff(role, title)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                          {lv >= 3 ? 'เต็ม' : `จ้าง ${nextCost}k`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
                <h3 className="font-bold text-sm">🏋️ โฟกัสโปรแกรมซ้อมประจำสัปดาห์</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([['FW', 'กองหน้า'], ['MF', 'กองกลาง'], ['DF', 'กองหลัง'], ['F', 'ฟื้นร่าง']] as const).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onUpdateState((d) => { d.tf = k; })}
                      className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${state.tf === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--mut)]">นักเตะตำแหน่งที่เลือกมีโอกาสอัป OVR หลังแข่ง (ฟื้นร่างช่วยเร่งฟิตและลดเจ็บ)</p>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab 4: Bank Loans, Wage Structure & Filterable Ledger */}
        {finTab === 'ledger' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="space-y-4 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
              <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
                <h3 className="font-bold text-sm">🏦 ธนาคาร &amp; จัดการหนี้สิน</h3>
                {state.bankLoan ? (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-2)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>เงินกู้ธนาคารคงค้าง</span>
                      <span className="text-[var(--red)] tabular">{bankRemain.toLocaleString()}k ฿ ({state.bankLoan.left} งวด)</span>
                    </div>
                    <div className="text-[11px] text-[var(--mut)] tabular">ผ่อนชำระงวดละ {state.bankLoan.per}k ฿ ทุกแมตช์</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={state.money < state.bankLoan.per}
                        onClick={() => {
                          const per = state.bankLoan!.per;
                          onUpdateState((d) => {
                            if (!d.bankLoan) return;
                            d.money -= per;
                            d.bankLoan.left--;
                            logFin(d, 'ชำระล่วงหน้าเงินกู้ 1 งวด', -per);
                            if (d.bankLoan.left <= 0) d.bankLoan = null;
                          });
                          onToast('ชำระเงินกู้ล่วงหน้า 1 งวดแล้ว');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        จ่าย 1 งวด ({state.bankLoan.per}k)
                      </button>
                      <button
                        type="button"
                        disabled={state.money < bankRemain}
                        onClick={() => {
                          onUpdateState((d) => {
                            d.money -= bankRemain;
                            logFin(d, 'โปะปิดเงินกู้ธนาคาร', -bankRemain);
                            d.bankLoan = null;
                          });
                          onToast('ปิดยอดหนี้ธนาคารทั้งหมดแล้ว');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        โปะปิดทั้งหมด ({bankRemain}k)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loanPackages.map((lp) => (
                      <div key={lp.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-xs">{lp.title} (+{lp.amount}k ฿)</div>
                          <div className="text-[11px] text-[var(--mut)] tabular">ผ่อน {lp.per}k × {lp.left} นัด · {lp.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            SFX.tap();
                            onUpdateState((d) => {
                              d.money += lp.amount;
                              d.bankLoan = { left: lp.left, per: lp.per };
                              logFin(d, `กู้${lp.title}`, lp.amount);
                            });
                            onToast(`รับเงินกู้ +${lp.amount}k ฿ เข้าคลังสโมสรแล้ว`);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs font-bold cursor-pointer shrink-0"
                        >
                          กู้ +{lp.amount}k
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(state.payDue || 0) > 0 && (
                  <div className="p-3 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold">ค้างผ่อนค่าตัวนักเตะปลายปี</div>
                      <div className="text-[11px] text-[var(--mut)] tabular">ยอดคงเหลือ {state.payDue}k ฿ (หักอัตโนมัติเมื่อจบซีซั่น)</div>
                    </div>
                    <button
                      type="button"
                      disabled={state.money < (state.payDue || 0)}
                      onClick={() => {
                        const amt = state.payDue || 0;
                        onUpdateState((d) => {
                          d.money -= amt;
                          d.payDue = 0;
                          logFin(d, 'ชำระยอดผ่อนค่าตัวล่วงหน้า', -amt);
                        });
                        onToast('ชำระยอดค้างผ่อนค่าตัวครบแล้ว');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      ปิดยอด {state.payDue}k
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                <h3 className="font-bold text-sm">📊 โครงสร้างค่าเหนื่อยรายตำแหน่ง</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(['GK', 'DF', 'MF', 'FW'] as Position[]).map((pos) => (
                    <div key={pos} className="p-2 rounded-xl bg-[var(--surface-2)]">
                      <div className="text-[10px] font-bold text-[var(--mut)]">{pos}</div>
                      <div className="font-bold text-xs tabular mt-0.5">{posWageMap[pos].toFixed(1)}k</div>
                    </div>
                  ))}
                </div>
                <div className="pt-1 space-y-1">
                  <div className="text-[11px] font-bold text-[var(--mut)]">นักเตะค่าเหนื่อยสูงสุด 3 อันดับ</div>
                  {topEarners.map((q) => (
                    <div key={q.n} className="flex justify-between text-xs py-1 border-b border-[var(--line)]/50 last:border-0">
                      <span className="truncate">{q.ro} · {q.n}</span>
                      <b className="tabular text-[var(--mut)]">{wagOf(q).toFixed(1)}k/นัด</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:h-full mland:flex mland:flex-col mland:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <h3 className="font-bold text-sm mland:text-xs">📒 สมุดบัญชีรายรับ-รายจ่าย</h3>
                <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--surface-2)] text-[11px]">
                  {([['all', 'ทั้งหมด'], ['in', 'รายรับ'], ['out', 'รายจ่าย']] as const).map(([fId, fLbl]) => (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => setLedgerFilter(fId)}
                      className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${ledgerFilter === fId ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
                    >
                      {fLbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mland:gap-1.5 text-center text-xs shrink-0">
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายรับ (บันทึก)</div>
                  <div className="font-bold text-[var(--g)] tabular">+{totalLogIn.toLocaleString()}k</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">รายจ่าย (บันทึก)</div>
                  <div className="font-bold text-[var(--red)] tabular">-{totalLogOut.toLocaleString()}k</div>
                </div>
                <div className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-[10px] text-[var(--mut)]">ดุลสุทธิ</div>
                  <div className={`font-bold tabular ${totalLogIn - totalLogOut >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                    {totalLogIn - totalLogOut >= 0 ? `+${(totalLogIn - totalLogOut).toLocaleString()}k` : `${(totalLogIn - totalLogOut).toLocaleString()}k`}
                  </div>
                </div>
              </div>
              <div className="max-h-80 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto space-y-1 pr-1">
                {filteredEntries.length === 0 ? (
                  <div className="text-xs text-[var(--mut)] py-8 text-center">ยังไม่มีรายการบัญชีในหมวดนี้</div>
                ) : (
                  filteredEntries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--line)]/50 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.t}</div>
                        <div className="text-[10px] text-[var(--mut)] tabular">ซีซั่น {e.s} · นัดที่ {e.m}</div>
                      </div>
                      <b className={`tabular shrink-0 ${e.amt >= 0 ? 'text-[var(--g)]' : 'text-[var(--red)]'}`}>
                        {e.amt >= 0 ? `+${e.amt}k` : `${e.amt}k`}
                      </b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Club Identity & Legacy View (tab === 'u')
  const k = ensureClubIdentity(state);
  const ts = teamStats(me, state);
  const cap = [3500, 8000, 15000, 26000, 42000][(state.st ?? 1) - 1] || 3500;
  const totV = me.sq.reduce((a, q) => a + Math.round((q.ov * q.ov) / 40), 0);
  const avgAge = (me.sq.reduce((a, q) => a + q.age, 0) / Math.max(1, me.sq.length)).toFixed(1);
  const trophies = state.trophies || [];
  const bs = me.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0))[0];
  const ba = me.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0))[0];
  const bm = me.sq.slice().sort((a, b) => (b.ap || 0) - (a.ap || 0))[0];
  const topO = me.sq.slice().sort((a, b) => b.ov - a.ov)[0];
  const curTurn = state.season * 40 + state.md;
  const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
  const remCd = state.clubActMd != null ? Math.max(0, 3 - (curTurn - state.clubActMd)) : 0;

  const clubPresets: { label: string; c1: string; c2: string; c3?: string }[] = [
    { label: 'แดง-ทอง', c1: '#c0392b', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'น้ำเงิน-ขาว', c1: '#2f6fd6', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'เขียว-ขาว', c1: '#1c7a4a', c2: '#ffffff', c3: '#f4c63d' },
    { label: 'กรมท่า-ทอง', c1: '#1b263b', c2: '#f4c63d', c3: '#0ea5e9' },
    { label: 'ส้ม-ดำ', c1: '#e67e22', c2: '#111111', c3: '#ffffff' },
    { label: 'ม่วง-ทอง', c1: '#7c3aed', c2: '#f4c63d', c3: '#ffffff' },
    { label: 'ฟ้า-ขาว', c1: '#0ea5e9', c2: '#ffffff', c3: '#1b263b' },
    { label: 'ชมพู-กรมท่า', c1: '#d6336c', c2: '#1b263b', c3: '#ffffff' },
    { label: 'เลือดหมู-ฟ้า', c1: '#881337', c2: '#0ea5e9', c3: '#f4c63d' },
    { label: 'เหลือง-ดำ', c1: '#facc15', c2: '#111111', c3: '#ffffff' }
  ];

  return (
    <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      {/* Club Hero Identity Banner */}
      <div
        className="p-4 sm:p-5 mland:p-2 rounded-3xl mland:rounded-2xl border border-[var(--line)] space-y-4 mland:space-y-0 shrink-0"
        style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${k.c1} 18%, var(--surface)), var(--surface) 58%)` }}
      >
        <div className="flex flex-col md:flex-row mland:flex-row items-center justify-between gap-4 mland:gap-2">
          <div className="flex flex-col sm:flex-row mland:flex-row items-center gap-4 mland:gap-2.5 text-center sm:text-left mland:text-left min-w-0">
            <div className="flex items-end gap-3 mland:gap-1.5 shrink-0 mland:[&_svg]:w-10 mland:[&_svg]:h-10">
              <div className="text-center">
                <ClubCrest name={me.name} size={74} team={me} club={k} isMyClub />
                <div className="text-[10px] text-[var(--mut)] font-semibold mt-0.5 mland:hidden">ตราสโมสร</div>
              </div>
              <div className="text-center">
                <KitJersey club={k} away={false} size={64} />
                <div className="text-[10px] text-[var(--mut)] font-semibold mt-0.5 mland:hidden">เหย้า</div>
              </div>
              <div className="text-center">
                <KitJersey club={k} away={true} size={64} />
                <div className="text-[10px] text-[var(--mut)] font-semibold mt-0.5 mland:hidden">เยือน</div>
              </div>
            </div>
            <div className="space-y-1 mland:space-y-0 min-w-0">
              <div className="text-[11px] mland:text-[10px] font-bold text-[var(--g)]">
                {TN[me.tier]} · ก่อตั้งปี {k.founded || 2568}
              </div>
              <h2 className="font-bold text-2xl mland:text-base font-display leading-tight truncate">
                {me.name} {k.nick ? <span className="text-base mland:text-xs font-semibold text-[var(--mut)]">«{k.nick}»</span> : null}
              </h2>
              <p className="text-xs mland:text-[10px] text-[var(--mut)] truncate">
                🏟️ {k.std} ({cap.toLocaleString()} ที่นั่ง · Lv.{state.st ?? 1}) · 👔 กุนซือ: {k.managerName || 'หัวหน้าผู้ฝึกสอน'}
              </p>
              {k.motto && <p className="text-xs italic text-[var(--ink)]/85 mland:hidden">&ldquo;{k.motto}&rdquo;</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mland:gap-1 w-full md:w-auto mland:w-auto text-center shrink-0">
            <div className="p-2.5 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">พลัง XI / ทีม</div>
              <b className="text-sm mland:text-[10.5px] tabular">{ts.ovXi} / {ts.ovSq}</b>
            </div>
            <div className="p-2.5 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">แฟนบอล</div>
              <b className="text-sm mland:text-[10.5px] tabular">{state.fan ?? 50}%</b>
            </div>
            <div className="p-2.5 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">บอร์ด</div>
              <b className="text-sm mland:text-[10.5px] tabular">{state.bd ?? 50}%</b>
            </div>
            <div className="p-2.5 mland:px-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)]/85 border border-[var(--line)]/60">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">มูลค่าทีม</div>
              <b className="text-sm mland:text-[10.5px] tabular">{totV}k</b>
            </div>
          </div>
        </div>
      </div>

      {/* Club Sub-navigation */}
      <div className="flex flex-wrap mland:flex-nowrap gap-1.5 mland:gap-1 p-1.5 mland:p-0.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0 overflow-x-auto">
        {(
          [
            ['info', '🏛️ ข้อมูล & ทีม'],
            ['identity', '🎨 ตรา & ชุดแข่ง'],
            ['activities', '🤝 กิจกรรมสโมสร'],
            ['legacy', '🏆 เกียรติยศ & ประวัติ']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setClubTab(id)}
            className={`flex-1 min-w-[125px] mland:min-w-0 px-3 mland:px-1.5 py-2 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
              clubTab === id ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Club Tab 1: Basic Info & Squad Key Stats */}
      {clubTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
          <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto">
            <h3 className="font-bold text-sm mland:text-xs">✏️ แก้ไขข้อมูลพื้นฐานสโมสร</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อสโมสร</label>
                <input
                  value={k.name}
                  maxLength={20}
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => {
                      const cl = ensureClubIdentity(d);
                      cl.name = val;
                      d.teams[d.me].name = val.trim() || 'ทีมของฉัน';
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ฉายาสโมสร</label>
                <input
                  value={k.nick}
                  maxLength={20}
                  placeholder="เช่น เสือล้านนา"
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).nick = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อสนามเหย้า</label>
                <input
                  value={k.std}
                  maxLength={24}
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).std = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--mut)] block mb-1">ชื่อผู้จัดการทีม</label>
                <input
                  value={k.managerName || ''}
                  maxLength={22}
                  placeholder="เช่น โค้ชต้น"
                  onChange={(e) => {
                    const val = e.target.value.replace(/["'<>`]/g, '');
                    onUpdateState((d) => { ensureClubIdentity(d).managerName = val; });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-[var(--mut)] block mb-1">คำขวัญสโมสร</label>
                  <input
                    value={k.motto || ''}
                    maxLength={40}
                    placeholder="เช่น สู้สุดใจเพื่อชัยชนะ"
                    onChange={(e) => {
                      const val = e.target.value.replace(/["'<>`]/g, '');
                      onUpdateState((d) => { ensureClubIdentity(d).motto = val; });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--mut)] block mb-1">ปีก่อตั้ง (พ.ศ.)</label>
                  <input
                    type="number"
                    min={2450}
                    max={2600}
                    value={k.founded || 2568}
                    onChange={(e) => {
                      const yr = clamp(Number(e.target.value) || 2568, 2450, 2600);
                      onUpdateState((d) => { ensureClubIdentity(d).founded = yr; });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold tabular"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:h-full mland:overflow-y-auto">
            <h3 className="font-bold text-sm mland:text-xs">📊 บรรยากาศห้องแต่งตัว &amp; แกนหลักทีม</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] text-[var(--mut)]">ขวัญทีม</div>
                <div className="font-bold text-sm tabular">{state.mor ?? 55}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] text-[var(--mut)]">คุ้นเคยแผน</div>
                <div className="font-bold text-sm tabular">{me.tacFam ?? 65}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] text-[var(--mut)]">อายุเฉลี่ย</div>
                <div className="font-bold text-sm tabular">{avgAge} ปี</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-2)]">
                <div className="text-[10px] text-[var(--mut)]">จำนวนนักเตะ</div>
                <div className="font-bold text-sm tabular">{me.sq.length} คน</div>
              </div>
            </div>
            <div className="space-y-1 text-xs pt-1">
              <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                <span className="text-[var(--mut)]">กัปตันทีม</span>
                <b>{me.cap || topO?.n || '-'}</b>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                <span className="text-[var(--mut)]">ดาวเด่นพลังสูงสุด</span>
                <b>{topO ? `${topO.n} (${topO.ro} · OVR ${topO.ov})` : '-'}</b>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                <span className="text-[var(--mut)]">ดาวซัลโวซีซั่นนี้</span>
                <b>{bs && bs.sg ? `${bs.n} (${bs.sg} ประตู)` : 'ยังไม่มีประตู'}</b>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                <span className="text-[var(--mut)]">จอมแอสซิสต์ซีซั่นนี้</span>
                <b>{ba && ba.sa ? `${ba.n} (${ba.sa} ครั้ง)` : 'ยังไม่มีข้อมูล'}</b>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--mut)]">ลงสนามมากที่สุด</span>
                <b>{bm && bm.ap ? `${bm.n} (${bm.ap} นัด)` : 'ยังไม่มีข้อมูล'}</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Club Tab 2: Crest & Jersey Studio */}
      {clubTab === 'identity' && (
        <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5 mland:overflow-hidden">
          {/* Sticky Live Preview Bar */}
          <div className="sticky top-0 z-20 mland:static p-3 sm:p-4 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--g)]/35 shadow-md flex flex-wrap items-center justify-between gap-3 mland:gap-2 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 mland:gap-2 mland:[&_svg]:w-9 mland:[&_svg]:h-9">
              <div className="flex flex-col items-center">
                <ClubCrest name={me.name} size={60} team={me} club={k} isMyClub />
                <span className="text-[10px] font-bold text-[var(--mut)] mt-0.5 mland:hidden">ตรา</span>
              </div>
              <div className="flex flex-col items-center">
                <KitJersey club={k} away={false} size={56} />
                <span className="text-[10px] font-bold text-[var(--mut)] mt-0.5 mland:hidden">ชุดเหย้า</span>
              </div>
              <div className="flex flex-col items-center">
                <KitJersey club={k} away={true} size={56} />
                <span className="text-[10px] font-bold text-[var(--mut)] mt-0.5 mland:hidden">ชุดเยือน</span>
              </div>
              <div className="hidden sm:block pl-2 border-l border-[var(--line)] space-y-0.5 text-[11px] mland:text-[10px]">
                <div className="font-bold text-xs mland:text-[11px] text-[var(--ink)]">ตัวอย่างแบบเรียลไทม์ · {me.name}</div>
                <div className="text-[var(--mut)]">
                  ตรา: <b>{CREST_SHAPES[k.shape]?.label || 'โล่คลาสสิก'}</b> · <b>{CREST_PATTERNS[k.pat] || 'แถบขวาง'}</b>
                </div>
                <div className="text-[var(--mut)]">
                  เสื้อ: <b>{KIT_PATTERNS[k.kit || 0]}</b> / เยือน <b>{KIT_PATTERNS[(k.awayKit ?? k.kit) || 0]}</b> · <b>{KIT_COLLARS[(k.collar ?? 0) % 4]}</b>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const kp = P(KIT_P);
                const icons = ['', ...Object.keys(CREST_IC)];
                onUpdateState((d) => {
                  const cl = ensureClubIdentity(d);
                  cl.c1 = kp[0];
                  cl.c2 = kp[1];
                  cl.c3 = P(['', '#f4c63d', '#ffffff', '#0ea5e9', '#111111']);
                  cl.shape = R(0, CREST_SHAPES.length - 1);
                  cl.pat = R(0, CREST_PATTERNS.length - 1);
                  cl.crestBorder = R(0, 3);
                  cl.kit = R(0, KIT_PATTERNS.length - 1);
                  cl.awayKit = Math.random() < 0.5 ? R(0, KIT_PATTERNS.length - 1) : undefined;
                  cl.collar = R(0, KIT_COLLARS.length - 1);
                  cl.cuffTrim = Math.random() < 0.75;
                  cl.icon = P(icons);
                  d.teams[d.me].kc = [cl.c1, cl.c2];
                });
                onToast('สุ่มตราสโมสรและชุดแข่งใหม่แล้ว!');
              }}
              className="px-3.5 py-2 mland:px-2.5 mland:py-1 rounded-xl bg-[var(--lamp)] text-[#261900] text-xs mland:text-[11px] font-bold cursor-pointer shadow-xs shrink-0"
            >
              🎲 สุ่มดีไซน์ทั้งหมด
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            {/* Crest Studio */}
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3.5 mland:space-y-2 mland:h-full mland:overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm mland:text-xs">🛡️ สตูดิโอออกแบบตราสโมสร</h3>
                <span className="text-[11px] font-semibold text-[var(--g)]">
                  {CREST_SHAPES[k.shape]?.label} · {CREST_PATTERNS[k.pat]}
                </span>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">รูปทรงตรา ({CREST_SHAPES.length} แบบ)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {CREST_SHAPES.map((sh, i) => (
                    <button
                      key={sh.label}
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).shape = i; })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer truncate ${k.shape === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] hover:text-[var(--ink)]'}`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ลวดลายพื้นหลังตรา ({CREST_PATTERNS.length} แบบ)</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {CREST_PATTERNS.map((l, i) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).pat = i; })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer truncate ${k.pat === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">สไตล์ขอบตรา</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['ขาว', 'ทอง', 'ขอบคู่', 'ดำเข้ม'] as const).map((lbl, i) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).crestBorder = i; })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${(k.crestBorder ?? 0) === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ดาวเกียรติยศบนตรา</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((stCnt) => (
                      <button
                        key={stCnt}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).stars = stCnt; })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${(k.stars ?? 0) === stCnt ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                      >
                        {stCnt === 0 ? 'ไม่มี' : '⭐'.repeat(stCnt)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">สัญลักษณ์กลางตรา ({Object.keys(CREST_IC).length} แบบ + ตัวอักษร)</div>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...Object.keys(CREST_IC)].map((ic) => (
                    <button
                      key={ic || 'txt'}
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).icon = ic; })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${k.icon === ic ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                    >
                      {ic || 'อักษรแรก'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Jersey Studio */}
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3.5 mland:space-y-2 mland:h-full mland:overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm mland:text-xs">🎽 สตูดิโอสีชุดแข่ง &amp; ลายเสื้อ</h3>
                <span className="text-[11px] font-semibold text-[var(--g)]">
                  เหย้า: {KIT_PATTERNS[k.kit || 0]}
                </span>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ชุดสีสโมสรยอดนิยม</div>
                <div className="flex flex-wrap gap-1.5">
                  {clubPresets.map((pr) => {
                    const active = k.c1.toLowerCase() === pr.c1.toLowerCase() && k.c2.toLowerCase() === pr.c2.toLowerCase();
                    return (
                      <button
                        key={pr.label}
                        type="button"
                        onClick={() => {
                          onUpdateState((d) => {
                            const cl = ensureClubIdentity(d);
                            cl.c1 = pr.c1;
                            cl.c2 = pr.c2;
                            cl.c3 = pr.c3 || '';
                            d.teams[d.me].kc = [pr.c1, pr.c2];
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                          active ? 'bg-[var(--g-soft)] border-[var(--g)] text-[var(--ink)]' : 'bg-[var(--surface-2)] border-transparent hover:border-[var(--g)]'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full border border-white/60" style={{ background: pr.c1 }} />
                        <span className="w-3 h-3 rounded-full border border-black/20" style={{ background: pr.c2 }} />
                        {pr.c3 && <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: pr.c3 }} />}
                        <span>{pr.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1">สีหลัก · ชุดเหย้า</div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        disabled={colDist(col, k.c2) < 150}
                        onClick={() => onUpdateState((d) => {
                          const cl = ensureClubIdentity(d);
                          cl.c1 = col;
                          d.teams[d.me].kc = [cl.c1, cl.c2];
                        })}
                        className={`w-6 h-6 rounded-full border-2 border-white disabled:opacity-25 cursor-pointer ${k.c1 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1">สีหลัก · ชุดเยือน / ลายรอง</div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        disabled={colDist(col, k.c1) < 150}
                        onClick={() => onUpdateState((d) => {
                          const cl = ensureClubIdentity(d);
                          cl.c2 = col;
                          d.teams[d.me].kc = [cl.c1, cl.c2];
                        })}
                        className={`w-6 h-6 rounded-full border-2 border-white disabled:opacity-25 cursor-pointer ${k.c2 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[var(--mut)] font-semibold">สีขลิบ &amp; เส้นตัด (Accent)</span>
                    <button
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).c3 = ''; })}
                      className={`text-[11px] font-semibold cursor-pointer ${!k.c3 ? 'text-[var(--g)] underline' : 'text-[var(--mut)]'}`}
                    >
                      อัตโนมัติ
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {KIT_SW.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).c3 = col; })}
                        className={`w-6 h-6 rounded-full border-2 border-white cursor-pointer ${k.c3 === col ? 'ring-2 ring-[var(--lamp)] scale-110' : ''}`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ลายเสื้อชุดเหย้า ({KIT_PATTERNS.length} ลาย)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {KIT_PATTERNS.map((l, i) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => onUpdateState((d) => { ensureClubIdentity(d).kit = i; })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer truncate ${k.kit === i ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ลายเสื้อชุดเยือน (แยกได้)</div>
                  <select
                    value={k.awayKit != null ? String(k.awayKit) : 'same'}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateState((d) => {
                        ensureClubIdentity(d).awayKit = v === 'same' ? undefined : Number(v);
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-semibold"
                  >
                    <option value="same">ใช้ลายเดียวกับชุดเหย้า</option>
                    {KIT_PATTERNS.map((l, i) => (
                      <option key={l} value={i}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-[var(--mut)] font-semibold mb-1.5">ทรงคอเสื้อ ({KIT_COLLARS.length} แบบ)</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {KIT_COLLARS.map((clbl, ci) => (
                      <button
                        key={clbl}
                        type="button"
                        onClick={() => onUpdateState((d) => { ensureClubIdentity(d).collar = ci; })}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${(k.collar ?? 0) === ci ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                      >
                        {clbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateState((d) => {
                  const cl = ensureClubIdentity(d);
                  cl.cuffTrim = !(cl.cuffTrim ?? true);
                })}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--surface-2)] text-xs font-semibold cursor-pointer"
              >
                <span>แถบขลิบปลายแขนเสื้อ &amp; ชายเสื้อ</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${(k.cuffTrim ?? true) ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'}`}>
                  {(k.cuffTrim ?? true) ? 'เปิด' : 'ปิด'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Club Tab 3: Club Activities */}
      {clubTab === 'activities' && (
        <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="font-bold text-sm mland:text-xs">🤝 กิจกรรมสโมสร &amp; มวลชนสัมพันธ์</h3>
              <p className="text-xs mland:text-[10px] text-[var(--mut)]">จัดกิจกรรมเพื่อปลุกขวัญนักเตะ ดึงดูดแฟนบอล และเสริมความเชื่อมั่นบอร์ด (คูลดาวน์ 3 นัดต่อครั้ง)</p>
            </div>
            <span className={`text-xs mland:text-[11px] font-bold ${actCool ? 'text-[var(--lamp)]' : 'text-[var(--g)]'}`}>
              {actCool ? `⏳ รออีก ${remCd} นัด` : '✅ พร้อมจัดกิจกรรม'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
            <button
              type="button"
              disabled={actCool}
              onClick={() => {
                onUpdateState((d) => {
                  d.fan = clamp((d.fan ?? 50) + 6, 5, 100);
                  d.clubActMd = curTurn;
                });
                onToast('แฟนบอลประทับใจ! ขวัญแฟนบอล +6%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>📣 พบปะแฟนบอล</span>
                <span className="text-[var(--g)]">ฟรี</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ขวัญแฟนบอล +6%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 20}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 20;
                  logFin(d, 'จัดงาน Open House สโมสร', -20);
                  d.fan = clamp((d.fan ?? 50) + 8, 5, 100);
                  d.mor = clamp((d.mor ?? 50) + 5, 0, 100);
                  d.bd = clamp((d.bd ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('Open House สำเร็จ! แฟน +8% ขวัญ +5% บอร์ด +3%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🎉 Open House สโมสร</span>
                <span className="tabular">20k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +8% · ขวัญ +5% · บอร์ด +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 25}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 25;
                  logFin(d, 'แคมป์กระชับความสัมพันธ์ทีม', -25);
                  d.mor = clamp((d.mor ?? 50) + 8, 0, 100);
                  d.teams[d.me].sq.forEach((q) => {
                    q.fit = clamp((q.fit ?? 100) + 6, 30, 100);
                  });
                  d.clubActMd = curTurn;
                });
                onToast('เข้าแคมป์สำเร็จ! ขวัญทีม +8% ความฟิต +6%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🏃 แคมป์กระชับทีม</span>
                <span className="tabular">25k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ขวัญทีม +8% · ฟิตทั้งทีม +6%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 15}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 15;
                  logFin(d, 'ติวเข้มแท็กติกทีม', -15);
                  d.teams[d.me].tacFam = clamp((d.teams[d.me].tacFam ?? 65) + 10, 30, 100);
                  d.mor = clamp((d.mor ?? 50) + 3, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('ติวเข้มแท็กติกสำเร็จ! ความคุ้นเคยแผน +10% · ขวัญ +3%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>🎯 ติวเข้มแท็กติก</span>
                <span className="tabular">15k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">ความคุ้นเคยแผน +10% · ขวัญ +3%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 10}
              onClick={() => {
                onUpdateState((d) => {
                  d.money -= 10;
                  logFin(d, 'จัดแมตช์การกุศลสโมสร', -10);
                  d.fan = clamp((d.fan ?? 50) + 10, 5, 100);
                  d.mgrRep = (d.mgrRep ?? 50) + 4;
                  d.bd = clamp((d.bd ?? 50) + 2, 0, 100);
                  d.clubActMd = curTurn;
                });
                onToast('แมตช์การกุศลสุดประทับใจ! แฟน +10% · ชื่อเสียง +4');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>⚽ แมตช์การกุศล</span>
                <span className="tabular">10k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +10% · ชื่อเสียงกุนซือ +4 · บอร์ด +2%</div>
            </button>

            <button
              type="button"
              disabled={actCool || state.money < 12}
              onClick={() => {
                let boostedName = '';
                onUpdateState((d) => {
                  d.money -= 12;
                  logFin(d, 'แคมเปญโซเชียลสโมสร', -12);
                  d.fan = clamp((d.fan ?? 50) + 7, 5, 100);
                  const yPool = d.teams[d.me].sq.filter((q) => q.age <= 22 && q.ov < (q.pot || 90));
                  if (yPool.length) {
                    const pick = P(yPool);
                    pick.ov++;
                    boostedName = pick.n;
                  }
                  d.clubActMd = curTurn;
                });
                onToast(boostedName ? `แฟน +7% และ ${boostedName} มีกำลังใจพัฒนา +1 OVR!` : 'แคมเปญโซเชียลปังมาก! ขวัญแฟนบอล +7%');
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-left disabled:opacity-45 cursor-pointer hover:border-[var(--g)] space-y-1"
            >
              <div className="flex justify-between font-bold text-xs">
                <span>📱 แคมเปญโซเชียล</span>
                <span className="tabular">12k</span>
              </div>
              <div className="text-[11px] text-[var(--mut)]">แฟน +7% · กระตุ้นดาวรุ่งในทีม</div>
            </button>
          </div>
        </div>
      )}

      {/* Club Tab 4: Hall of Fame & Season History */}
      {clubTab === 'legacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 mland:grid-cols-2 gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
          <div className="space-y-4 mland:space-y-2 mland:h-full mland:overflow-y-auto mland:pr-0.5">
            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-3 mland:space-y-2">
              <h3 className="font-bold text-sm mland:text-xs">🏆 ตู้โชว์ถ้วยรางวัล ({trophies.length})</h3>
              {trophies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {trophies.map((tr, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/40 text-xs font-bold flex items-center justify-between gap-2">
                      <span className="truncate">🏆 {tr.title}</span>
                      <span className="text-[11px] text-[var(--mut)] shrink-0 tabular">S{tr.season}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--mut)] py-4 text-center">ยังไม่มีถ้วยรางวัลในตู้โชว์</p>
              )}
            </div>

            <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
              <h3 className="font-bold text-sm mland:text-xs">📈 สถิติสโมสรตลอดกาล</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">ชัยชนะขาดลอยที่สุด</span>
                  <b>{state.records?.bestWin?.txt || 'ยังไม่มีบันทึก'}</b>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">สถิติชนะรวดสูงสุด</span>
                  <b className="tabular">{state.records?.winStreak || 0} นัด</b>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--line)]/60">
                  <span className="text-[var(--mut)]">แต้มสูงสุดต่อฤดูกาล</span>
                  <b className="tabular">{state.records?.mostPoints ? `${state.records.mostPoints.pts} แต้ม (S${state.records.mostPoints.s})` : 'ยังไม่มีบันทึก'}</b>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--mut)]">ดาวซัลโวตลอดกาลต่อซีซั่น</span>
                  <b className="tabular">{state.records?.topSeasonScorer ? `${state.records.topSeasonScorer.n} (${state.records.topSeasonScorer.g} ลูก · S${state.records.topSeasonScorer.s})` : 'ยังไม่มีบันทึก'}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 mland:h-full mland:flex mland:flex-col mland:min-h-0">
            <h3 className="font-bold text-sm mland:text-xs shrink-0">📜 ประวัติศาสตร์สโมสรรายฤดูกาล</h3>
            {state.hist && state.hist.length > 0 ? (
              <div className="max-h-80 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto space-y-1.5 pr-1">
                {state.hist
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-[var(--surface-2)] text-xs leading-relaxed">
                      {h}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--mut)] py-6 text-center">ยังไม่มีบันทึกประวัติศาสตร์ — จบฤดูกาลแรกเพื่อเริ่มบันทึกตำนาน</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 11. CUP & CONTINENTAL COMPETITIONS VIEW
// ============================================================================
const CupView: React.FC<{ state: GameState; onInspectTeam: (id: number) => void }> = ({ state, onInspectTeam }) => {
  const [cupTab, setCupTab] = useState<'fa' | 'asia'>('fa');
  const cup = state.cup;
  const ac = state.ac;

  const renderBracketCard = (
    title: string,
    subtitle: string,
    done: boolean,
    alive: boolean,
    round: number,
    ids: number[],
    log: string[],
    prize: string
  ) => {
    const pairs: [Team, Team][] = [];
    if (!done) {
      for (let i = 0; i < ids.length; i += 2) {
        if (state.teams[ids[i]] && state.teams[ids[i + 1]]) {
          pairs.push([state.teams[ids[i]], state.teams[ids[i + 1]]]);
        }
      }
    }
    const champ = done && ids[0] != null ? state.teams[ids[0]] : null;
    return (
      <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
        <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-3 mland:gap-1.5 shrink-0">
          <div>
            <h3 className="font-bold text-base mland:text-[11px]">{title}</h3>
            <p className="text-xs mland:text-[9.5px] text-[var(--mut)]">{subtitle} · รางวัลแชมป์ {prize}</p>
          </div>
          <div className="text-xs mland:text-[10px] font-bold px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--surface-2)]">
            {done ? (champ ? `🏆 แชมป์: ${champ.name}` : 'จบการแข่งขันแล้ว') : alive ? `✅ อยู่ในเส้นทาง (${RN[round] || 'รอบถัดไป'})` : `❌ ตกรอบแล้ว (${RN[round] || 'กำลังแข่งขัน'})`}
          </div>
        </div>

        <div className="space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:grid mland:grid-cols-2 mland:gap-2 mland:overflow-hidden mland:items-stretch">
        {!done && pairs.length > 0 && (
          <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
            <h4 className="font-bold text-sm mland:text-[11px] shrink-0">ประกบคู่ {RN[round]} ({pairs.length} คู่)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-1 gap-2.5 mland:gap-1 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
              {pairs.map(([h, a], idx) => {
                const involvesMe = h.id === state.me || a.id === state.me;
                return (
                  <div key={idx} className={`flex items-center justify-between gap-2 p-2.5 mland:p-1.5 rounded-xl border ${involvesMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                    <button type="button" onClick={() => onInspectTeam(h.id)} className="flex items-center gap-2 mland:gap-1.5 min-w-0 flex-1 text-left cursor-pointer">
                      <ClubCrest name={h.name} size={22} team={h} club={state.club} isMyClub={h.id === state.me && state.mode === 'm'} />
                      <span className={`text-xs mland:text-[10.5px] truncate ${h.id === state.me ? 'font-bold' : ''}`}>{h.name}</span>
                    </button>
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] px-1">vs</span>
                    <button type="button" onClick={() => onInspectTeam(a.id)} className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0 flex-1 text-right cursor-pointer">
                      <span className={`text-xs mland:text-[10.5px] truncate ${a.id === state.me ? 'font-bold' : ''}`}>{a.name}</span>
                      <ClubCrest name={a.name} size={22} team={a} club={state.club} isMyClub={a.id === state.me && state.mode === 'm'} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:h-full mland:flex mland:flex-col mland:min-h-0 ${done || pairs.length === 0 ? 'mland:col-span-2' : ''}`}>
          <h4 className="font-bold text-sm mland:text-xs shrink-0">📜 ผลการแข่งขันในรายการ</h4>
          {log.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-1 gap-1.5 max-h-64 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto pr-0.5">
              {log.slice().reverse().map((l, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg bg-[var(--surface-2)]/70 ${l.includes(state.teams[state.me].name) ? 'font-bold border border-[var(--lamp)]/50' : ''}`}>
                  {l}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--mut)]">ยังไม่เริ่มการแข่งขันรอบแรก</p>
          )}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      <div className="flex flex-wrap items-center p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] w-fit max-w-full shrink-0">
        <button type="button" onClick={() => setCupTab('fa')} className={`px-3 sm:px-4 mland:px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[11px] font-semibold cursor-pointer ${cupTab === 'fa' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}>
          🏆 ถ้วยประชาชน
        </button>
        <button type="button" onClick={() => setCupTab('asia')} className={`px-3 sm:px-4 mland:px-3 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[11px] font-semibold cursor-pointer ${cupTab === 'asia' ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}>
          🌏 บอลถ้วยทวีป
        </button>
      </div>
      {cupTab === 'fa'
        ? renderBracketCard('🏆 ถ้วยประชาชน (น็อกเอาต์ 16 ทีม)', 'รวมทีมจากทุกระดับลีกในประเทศ แข่งนัดเดียวรู้ผล (เสมอตัดสินจุดโทษ)', cup.done, cup.alive, cup.r, cup.ids, cup.log, '250k ฿')
        : ac
          ? renderBracketCard('🌏 ชิงแชมป์สโมสรทวีป (16 ทีม)', 'ตัวแทนลีกสูงสุดไทยปะทะยอดทีมต่างแดนทั่วเอเชีย', ac.done, ac.alive, ac.r, ac.ids, ac.log, '500k ฿')
          : null}
    </div>
  );
};

// ============================================================================
// 12. PLAYER CAREER VIEW
// ============================================================================
const PlayerCareerView: React.FC<{
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, onUpdateState, onToast }) => {
  const [careerTab, setCareerTab] = useState<'plan' | 'perks' | 'stats'>('plan');
  const p = state.p;
  if (!p) return null;
  const meTeam = state.teams[state.me];
  const meSq = meTeam.sq.find((q) => q.me);
  const myShirtNo = p.no || meSq?.no || getShirtNo(meTeam, { n: p.name, pos: p.pos, ro: p.sp });
  const ov = ovMe(p);
  const avgRt = p.ap ? (p.rs / p.ap).toFixed(2) : '-';
  const perks = p.perks || [];
  const susCount = meSq?.sus ?? p.sus ?? 0;
  const ycCount = meSq?.yc ?? p.yc ?? 0;
  const rcCount = meSq?.rc ?? p.rc ?? 0;
  const fakePlayer: Player = { n: p.name, pos: p.pos, ro: p.sp, ov, age: p.age, pot: 95, fit: p.en, inj: 0, sus: susCount, yc: ycCount, rc: rcCount, no: myShirtNo, me: 1 };
  const details = dtInfo(fakePlayer, p);
  const starters = xi(meTeam);
  const starterIdx = starters.findIndex((q) => q.me || q.n === p.name);
  const mySlot = starterIdx >= 0 ? getFormationSlots(meTeam)[starterIdx]?.sp : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] mland:flex-1 mland:min-h-0 mland:grid-cols-[215px_1fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:overflow-hidden">
      <div className="space-y-4 mland:space-y-1.5 mland:h-full mland:overflow-y-auto mland:pr-0.5">
        <div className="rounded-3xl mland:rounded-2xl p-4 mland:p-2 text-white border border-white/20" style={{ background: `linear-gradient(155deg, ${ovColor(ov)}, #0b1f15 78%)` }}>
          <div className="flex items-center justify-between gap-3 mland:gap-1.5 mland:[&_svg]:w-14 mland:[&_svg]:h-14">
            <div className="text-center">
              <div className="text-4xl mland:text-xl font-bold font-display leading-none">{ov}</div>
              <div className="text-xs mland:text-[9px] font-bold mt-1 mland:mt-0.5 border-t border-white/40 pt-1 mland:pt-0.5">{p.sp} · #{myShirtNo}</div>
            </div>
            <PlayerFace player={fakePlayer} team={meTeam} state={state} careerProfile={p} size={86} bare />
          </div>
          <div className="text-center font-bold text-lg mland:text-xs border-b border-white/30 py-2 mland:py-0.5 truncate">{p.name}</div>
          <div className="text-center text-xs mland:text-[9.5px] opacity-85 py-1.5 mland:py-0.5">{meTeam.name} · เสื้อ #{myShirtNo} · อายุ {p.age} ปี · ชื่อเสียง {p.rep ?? 10}</div>
          {(p.archName || details.D0.sig) && (
            <div className="text-center text-[11px] mland:text-[9px] font-semibold text-white/90 pb-1 mland:pb-0.5">
              {p.archName || 'สไตล์เฉพาะตัว'} · ⭐ {SIGL[details.D0.sig] || details.D0.sig}
            </div>
          )}
          <div className="grid grid-cols-5 gap-1 pt-2 mland:pt-1 text-center text-[11px] mland:text-[9px]">
            {ATT.map(([k, l]) => (
              <div key={k}>
                <div className="text-base mland:text-xs font-bold tabular">{p.a[k]}</div>
                <div className="opacity-85">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
          <div className="flex items-center justify-between text-xs mland:text-[10.5px] font-bold">
            <span>⚡ พลังกาย (Energy)</span>
            <span className="tabular">{p.en}%</span>
          </div>
          <div className="h-2.5 mland:h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${p.en}%`, background: p.en >= 70 ? 'var(--g)' : p.en >= 45 ? 'var(--lamp)' : 'var(--red)' }} />
          </div>

          <div className={`p-2.5 mland:p-1.5 rounded-xl border text-xs mland:text-[10px] space-y-1 mland:space-y-0.5 ${susCount > 0 ? 'bg-[var(--red-soft)] border-[var(--red)]/40' : mySlot ? 'bg-[var(--g-soft)] border-[var(--g)]/35' : 'bg-[var(--lamp-soft)] border-[var(--lamp)]/45'}`}>
            <div className="flex items-center justify-between font-bold">
              <span>{susCount > 0 ? `🟥 โดนแบน ${susCount} นัด` : mySlot ? `⭐ สถานะ: ตัวจริง (${mySlot})` : '🪑 สถานะ: ตัวสำรอง'}</span>
              <span className="tabular text-[11px] mland:text-[9.5px]">🟨 {ycCount}/3 · 🟥 {rcCount}</span>
            </div>
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
              {susCount > 0
                ? 'ชดใช้โทษแบนหมดแล้วจึงจะกลับมาลงสนามได้ (สะสม 3 เหลือง = แบน 1 นัด)'
                : mySlot
                  ? 'หากพลังกายต่ำกว่า 58% หรือฟอร์มตก โค้ชอาจดรอปเป็นตัวสำรองหรือเปลี่ยนออก'
                  : 'มีคู่แข่งตำแหน่งเดียวกันพลังสูงกว่า หรือพลังกายยังล้า — รอโอกาสเปลี่ยนตัวลงครึ่งหลัง'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mland:gap-1 pt-1 mland:pt-0 text-center">
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ลงสนาม / ประตู</div><b className="text-sm mland:text-[10.5px] tabular">{p.ap} นัด · ⚽ {p.gl}</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">แอสซิสต์ / เรตติ้ง</div><b className="text-sm mland:text-[10.5px] tabular">🎯 {p.as} · ⭐ {avgRt}</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ทีมชาติไทย 🇹🇭</div><b className="text-sm mland:text-[10.5px] tabular">{p.ntCaps || 0} นัด · {p.ntGoals || 0} ประตู</b></div>
            <div className="p-2 mland:p-1 rounded-xl bg-[var(--surface-2)]"><div className="text-[11px] mland:text-[9px] text-[var(--mut)]">ฟอร์ม 5 นัดหลัง</div><b className="text-xs mland:text-[9.5px] tabular">{(p.fm || []).length ? p.fm!.join(' · ') : '-'}</b></div>
          </div>
        </div>
      </div>

      <div className="space-y-4 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="hidden mland:grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          {([
            ['plan', '📅 แผนฝึกซ้อม'],
            ['perks', `🌟 สกิล (${perks.length})`],
            ['stats', '📊 ค่าพลังละเอียด']
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCareerTab(k)}
              className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer ${careerTab === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="space-y-4 mland:space-y-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'plan' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">📅 แผนฝึกซ้อมประจำสัปดาห์</h3>
            {p.vid ? <span className="text-xs mland:text-[10px] font-bold text-[var(--g)]">📺 มีบัฟวิดีโอนัดหน้า (+0.3 เรตติ้ง)</span> : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PACT.map((ac, idx) => (
              <button
                key={ac.n}
                type="button"
                onClick={() => {
                  SFX.tap();
                  onUpdateState((d) => { if (d.p) d.p.plan = idx; });
                  onToast(`ตั้งแผนสัปดาห์นี้เป็น "${ac.n}"`);
                }}
                className={`p-3 mland:p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  (p.plan ?? 1) === idx ? 'bg-[var(--g-soft)] border-[var(--g)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>{ac.i} {ac.n}</span>
                  {(p.plan ?? 1) === idx && <span className="text-[var(--g)]">● เลือกอยู่</span>}
                </div>
                <div className="text-[11px] text-[var(--mut)] mt-0.5">{ac.d}</div>
              </button>
            ))}
          </div>
          {p.last && <p className="text-xs text-[var(--g)] font-semibold pt-1">สัปดาห์ล่าสุด: {p.last}</p>}
        </div>

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'perks' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm mland:text-xs">🌟 สกิลติดตัวนักเตะ (Career Perks)</h3>
            <span className="text-xs font-bold text-[var(--lamp)]">ชื่อเสียงคงเหลือ: {p.rep ?? 10}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CAREER_PERKS.map((pk) => {
              const owned = perks.includes(pk.id);
              const canBuy = !owned && (p.rep ?? 10) >= pk.cost;
              return (
                <div key={pk.id} className={`p-3 mland:p-2 rounded-xl border flex items-center justify-between gap-2 ${owned ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/70 border-[var(--line)]'}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-xs">{pk.name}</div>
                    <div className="text-[11px] text-[var(--mut)]">{pk.desc}</div>
                  </div>
                  <button
                    type="button"
                    disabled={owned || !canBuy}
                    onClick={() => {
                      SFX.win();
                      onUpdateState((d) => {
                        if (!d.p) return;
                        d.p.rep = (d.p.rep ?? 10) - pk.cost;
                        d.p.perks = [...(d.p.perks || []), pk.id];
                      });
                      onToast(`ปลดล็อกสกิล "${pk.name}" แล้ว!`);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer disabled:opacity-45 ${owned ? 'bg-[var(--g)] text-white' : 'bg-[var(--lamp)] text-[#261900]'}`}
                  >
                    {owned ? 'มีแล้ว' : `ปลด ${pk.cost}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`p-4 mland:p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2.5 mland:space-y-2 ${careerTab === 'stats' ? '' : 'mland:hidden'}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm mland:text-xs">📊 รายละเอียดค่าพลัง</h3>
            <span className="text-[11px] text-[var(--mut)]">จุดเด่น: <b className="text-[var(--g)]">⭐ {SIGL[details.D0.sig] || details.D0.sig}</b></span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mland:gap-2">
            {details.G.map(([grp, items]) => (
              <div key={grp} className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/75 space-y-1">
                <div className="font-bold text-xs mb-1.5 pb-1 border-b border-[var(--line)]/60">{grp}</div>
                {items.map(([lbl, val, statKey]) => (
                  <StatBarRow
                    key={lbl}
                    label={lbl}
                    value={val}
                    isSig={!!(statKey && statKey === details.D0.sig)}
                    compact
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 13. MODALS (MATCH SIMULATOR, INSPECTORS, SEASON END, DILEMMA, SETTINGS)
// ============================================================================
interface FinishedMatchPayload {
  gh: number;
  ga: number;
  evs: MatchEvent[];
  xgH: number;
  xgA: number;
  pen?: boolean;
  penText?: string;
  ratings: Record<string, number>;
  motm: string;
  pf?: PlayerPerfResult;
  finalTac: Mentality;
  finalLu: string[];
  cards: MatchCardEvent[];
  subs: MatchSubEvent[];
  playedNames: Record<number, string[]>;
}

type PitchIntent =
  | 'CARRY'
  | 'PASS_TARGET'
  | 'MAKE_RUN'
  | 'OVERLAP'
  | 'SUPPORT'
  | 'PRESS'
  | 'MARK'
  | 'WALL'
  | 'DIVE'
  | 'CELEBRATE'
  | 'RESET';

type BallFlightType =
  | 'carry'
  | 'pass'
  | 'through'
  | 'cross'
  | 'shot'
  | 'freekick'
  | 'penalty'
  | 'shootout_kick'
  | 'corner'
  | 'goalkick'
  | 'bounce';

interface LivePitchAgent {
  id: string;
  shortName: string;
  no: number;
  side: 'H' | 'A';
  slotIndex: number;
  role: SubRole;
  pos: Position;
  slotX: number; // 0..100 wing
  slotY: number; // 0..100 depth (92=GK, 15=ST)
  isMe: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  facing: number;
  stride: number;
  intent: PitchIntent;
  intentTimer: number;
  diveDir: number;
  diveProgress: number;
  runToX?: number;
  runToY?: number;
  fit: number;
  hasYellow: boolean;
  sentOff: boolean;
  d: Record<string, number>;
  tr: number;
  ov: number;
  vis: number[];
}

interface LiveBallState {
  x: number;
  y: number;
  z: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curve: number;
  maxZ: number;
  progress: number;
  duration: number;
  flightType: BallFlightType;
  carrierId: string | null;
  targetId: string | null;
  shooterId: string | null;
  lastPasserId: string | null;
  possessionSide: 'H' | 'A';
  trail: { x: number; y: number; z: number }[];
}

interface LivePitchFx {
  id: number;
  type: 'offside' | 'foul' | 'save' | 'block' | 'woodwork' | 'goal' | 'freekick' | 'corner' | 'card' | 'var' | 'penalty';
  x: number;
  y: number;
  offsideX?: number;
  label: string;
  color: string;
  ttl: number;
  maxTtl: number;
  wallPlayers?: { x: number; y: number }[];
  goalSide?: 'H' | 'A';
}

interface PendingSetPiece {
  type: 'kickoff' | 'freekick' | 'penalty' | 'corner' | 'goalkick' | 'offside';
  side: 'H' | 'A';
  x: number;
  y: number;
  waitSec: number;
  wallPlayers?: { x: number; y: number }[];
}

interface VarReviewState {
  kind: 'goal' | 'penalty' | 'foul_card';
  side: 'H' | 'A';
  waitSec: number;
  totalSec: number;
  shooterId?: string;
  shooterShort?: string;
  assisterName?: string;
  finishVerb?: string;
  x: number;
  y: number;
  culpritId?: string;
  culpritShort?: string;
  culpritSide?: 'H' | 'A';
  overturn: boolean;
  cardRes?: 'Y' | 'R' | null;
  pendingCardUpgrade?: 'Y' | 'R' | null;
  distToGoal?: number;
  reasonText: string;
}

interface ShootoutState {
  round: number;
  turn: 'H' | 'A';
  hKicks: ('G' | 'M')[];
  aKicks: ('G' | 'M')[];
  hScore: number;
  aScore: number;
  waitSec: number;
  lastMsg: string;
  kickerName: string;
  gkName: string;
  activeShot: boolean;
  finished: boolean;
}

interface LiveMatchWorld {
  agents: LivePitchAgent[];
  ball: LiveBallState;
  fx: LivePitchFx[];
  nextFxId: number;
  pendingSetPiece: PendingSetPiece | null;
  phase: 'play1' | 'stop1' | 'halftime' | 'play2' | 'stop2' | 'shootout' | 'ft';
  added1: number;
  added2: number;
  stoppageFloat: number;
  varChecks: number;
  varReview: VarReviewState | null;
  shootout: ShootoutState | null;
  phaseLabel: string;
  phaseTone: 'normal' | 'attack' | 'danger' | 'setpiece' | 'offside' | 'goal';
  minuteFloat: number;
  lastTickedMin: number;
  possTicksH: number;
  possTicksTotal: number;
  goalNetRippleH: number;
  goalNetRippleA: number;
  celebrateTimer: number;
  dramaSlowSec: number;
  dramaLabel: string | null;
  sparkles: { x: number; y: number; vx: number; vy: number; color: string; size: number; ttl: number; maxTtl: number }[];
  goalBanner: {
    scorer: string;
    teamName: string;
    assister?: string;
    side: 'H' | 'A';
    kit: string;
    isMyGoal: boolean;
    isMeScorer: boolean;
    ttl: number;
    maxTtl: number;
  } | null;
  cardBanner: {
    who: string;
    shortName: string;
    teamName: string;
    type: 'Y' | 'Y2R' | 'R';
    kit: string;
    ttl: number;
    maxTtl: number;
  } | null;
  passesH: number;
  passesA: number;
  shotsH: number;
  shotsA: number;
  onTargetH: number;
  onTargetA: number;
  savesH: number;
  savesA: number;
  blocksH: number;
  blocksA: number;
  cornersH: number;
  cornersA: number;
  foulsH: number;
  foulsA: number;
  offsidesH: number;
  offsidesA: number;
  freeKicksH: number;
  freeKicksA: number;
  xgH: number;
  xgA: number;
}

const buildAgentsForTeam = (
  team: Team,
  side: 'H' | 'A',
  luNames: string[],
  sentOffNames: string[],
  yellowsMap: Record<string, number>,
  fitMap: Record<string, number>,
  careerP?: PlayerCareerProfile | null,
  myPlayerName?: string
): LivePitchAgent[] => {
  const slots = getFormationSlots(team);
  return luNames.map((name, i) => {
    const pl = team.sq.find((q) => q.n === name) || team.sq[i] || team.sq[0];
    const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
    const homeBaseX = clamp(100 - slot.y, 4.5, 95.5);
    const baseX = side === 'H' ? homeBaseX : 100 - homeBaseX;
    const baseY = side === 'H' ? clamp(slot.x, 6, 94) : clamp(100 - slot.x, 6, 94);
    const kickoffX = side === 'H' ? Math.min(baseX, 47) : Math.max(baseX, 53);
    const dt = pl ? DT(pl, careerP) : { d: { spd: 60, fin: 60, pw: 60, cur: 60, crs: 60, run: 60, rd: 60, pos: 60, mrk: 60, blk: 60, hd: 60, sv: 60, cl: 60, dist: 60, sta: 65 }, tr: 3 };
    return {
      id: name,
      shortName: name.split(' ')[0] || name,
      no: pl ? getShirtNo(team, pl) : i + 1,
      side,
      slotIndex: i,
      role: slot.sp,
      pos: slot.pos,
      slotX: slot.x,
      slotY: slot.y,
      isMe: Boolean(pl?.me || (myPlayerName && name === myPlayerName)),
      x: kickoffX,
      y: baseY,
      vx: 0,
      vy: 0,
      tx: kickoffX,
      ty: baseY,
      facing: side === 'H' ? 0 : Math.PI,
      stride: Math.random() * Math.PI * 2,
      intent: 'SUPPORT',
      intentTimer: 0,
      diveDir: 0,
      diveProgress: 0,
      fit: fitMap[name] ?? pl?.fit ?? 100,
      hasYellow: (yellowsMap[name] || 0) > 0,
      sentOff: sentOffNames.includes(name),
      d: dt.d,
      tr: dt.tr,
      ov: pl?.ov || 60,
      vis: pl ? visOf(pl, careerP) : [2, 0, 0, 0, 0, i + 1, 0]
    };
  });
};

const PITCH_FACE_CACHE = new Map<string, HTMLCanvasElement | 'loading'>();

const getPitchFaceCanvas = (vis: number[], kit: string, trim: string): HTMLCanvasElement | null => {
  const key = `${vis.join(',')}|${kit}|${trim}`;
  const existing = PITCH_FACE_CACHE.get(key);
  if (existing && existing !== 'loading') return existing;
  if (existing === 'loading' || typeof Image === 'undefined' || typeof document === 'undefined') return null;

  PITCH_FACE_CACHE.set(key, 'loading');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="64" viewBox="0 0 60 64">${faceBodySvg(vis, kit, trim, 32, '#10281d', true, false)}</svg>`;
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 68;
    const octx = off.getContext('2d');
    if (octx) {
      octx.drawImage(img, 0, 0, 64, 68);
      PITCH_FACE_CACHE.set(key, off);
    } else {
      PITCH_FACE_CACHE.delete(key);
    }
  };
  img.onerror = () => {
    PITCH_FACE_CACHE.delete(key);
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return null;
};

const drawLivePitchToCanvas = (
  canvas: HTMLCanvasElement,
  world: LiveMatchWorld,
  homeKit: string,
  awayKit: string,
  homeGkKit: string,
  awayGkKit: string,
  showRunVectors: boolean,
  homeTrim = '#ffffff',
  awayTrim = '#ffffff'
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, Math.round(rect.width || 640));
  const cssH = Math.max(180, Math.round(rect.height || 330));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padX = Math.max(20, cssW * 0.042);
  const padY = Math.max(14, cssH * 0.055);
  const pw = cssW - padX * 2;
  const ph = cssH - padY * 2;
  const px = (x: number) => padX + (x / 100) * pw;
  const py = (y: number) => padY + (y / 100) * ph;

  // 1. Stadium apron & mowed turf stripes
  ctx.fillStyle = '#144d2e';
  ctx.fillRect(0, 0, cssW, cssH);

  const stripeCount = 12;
  const stripeW = pw / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1e6e42' : '#25814f';
    ctx.fillRect(padX + i * stripeW, padY, stripeW + 0.5, ph);
  }

  // Subtle top/bottom stadium light sheen
  const sheen = ctx.createRadialGradient(cssW * 0.5, cssH * 0.5, pw * 0.1, cssW * 0.5, cssH * 0.5, pw * 0.65);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, cssW, cssH);

  // 2. Pitch markings
  ctx.strokeStyle = 'rgba(240, 248, 240, 0.86)';
  ctx.lineWidth = Math.max(1.2, cssW * 0.0024);
  ctx.strokeRect(padX, padY, pw, ph);

  // Halfway line & center circle
  ctx.beginPath();
  ctx.moveTo(px(50), py(0));
  ctx.lineTo(px(50), py(100));
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px(50), py(50), ph * 0.155, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(240,248,240,0.9)';
  ctx.beginPath();
  ctx.arc(px(50), py(50), 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Penalty boxes & 6-yard boxes
  const boxTop = py(21);
  const boxH = ph * 0.58;
  const boxW = pw * 0.165;
  const sixTop = py(36.5);
  const sixH = ph * 0.27;
  const sixW = pw * 0.055;

  ctx.strokeRect(padX, boxTop, boxW, boxH);
  ctx.strokeRect(padX + pw - boxW, boxTop, boxW, boxH);
  ctx.strokeRect(padX, sixTop, sixW, sixH);
  ctx.strokeRect(padX + pw - sixW, sixTop, sixW, sixH);

  // Penalty spots & arcs
  ctx.beginPath();
  ctx.arc(px(11), py(50), 2, 0, Math.PI * 2);
  ctx.arc(px(89), py(50), 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px(11), py(50), ph * 0.135, -0.68, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(89), py(50), ph * 0.135, Math.PI - 0.68, Math.PI + 0.68);
  ctx.stroke();

  // Corner arcs
  const cr = Math.max(5, ph * 0.032);
  [
    [padX, padY, 0, Math.PI / 2],
    [padX + pw, padY, Math.PI / 2, Math.PI],
    [padX + pw, padY + ph, Math.PI, Math.PI * 1.5],
    [padX, padY + ph, Math.PI * 1.5, Math.PI * 2]
  ].forEach(([cx, cy, sa, ea]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, sa, ea);
    ctx.stroke();
  });

  // Goal frames & animated rippling nets
  const goalTop = py(42);
  const goalBot = py(58);
  const goalD = Math.max(9, padX * 0.55);
  const drawGoal = (isLeft: boolean, ripple: number) => {
    const gx = isLeft ? padX - goalD : padX + pw;
    const bulge = ripple > 0 ? Math.sin(ripple * 24) * 3.5 * ripple : 0;
    ctx.save();
    ctx.fillStyle = ripple > 0 ? 'rgba(245, 194, 66, 0.25)' : 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(padX, goalTop);
      ctx.lineTo(gx - bulge, goalTop + 2);
      ctx.lineTo(gx - bulge, goalBot - 2);
      ctx.lineTo(padX, goalBot);
    } else {
      ctx.moveTo(padX + pw, goalTop);
      ctx.lineTo(gx + goalD + bulge, goalTop + 2);
      ctx.lineTo(gx + goalD + bulge, goalBot - 2);
      ctx.lineTo(padX + pw, goalBot);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawGoal(true, world.goalNetRippleA);
  drawGoal(false, world.goalNetRippleH);

  // 3. Visual FX under players (Offside line, Foul ring, Free kick wall spray & barrier)
  if (world.pendingSetPiece?.type === 'freekick' && world.pendingSetPiece.wallPlayers?.length) {
    const wallPts = world.pendingSetPiece.wallPlayers;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(wallPts[0].x), py(wallPts[0].y));
    ctx.lineTo(px(wallPts[wallPts.length - 1].x), py(wallPts[wallPts.length - 1].y));
    ctx.stroke();
    ctx.restore();
  }
  world.fx.forEach((fx) => {
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    if (fx.type === 'offside' && fx.offsideX != null) {
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(px(fx.offsideX), padY);
      ctx.lineTo(px(fx.offsideX), padY + ph);
      ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'foul' || fx.type === 'save' || fx.type === 'block' || fx.type === 'woodwork' || fx.type === 'goal') {
      const expand = (1 - alpha) * (fx.type === 'goal' ? 32 : 18) + 6;
      ctx.save();
      ctx.strokeStyle = fx.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px(fx.x), py(fx.y), expand, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 4. Off-ball run arrows ("ทำทาง") + Pass / Shot trajectory line
  if (showRunVectors) {
    world.agents.forEach((ag) => {
      if (ag.sentOff || (ag.intent !== 'MAKE_RUN' && ag.intent !== 'OVERLAP')) return;
      if (ag.runToX == null || ag.runToY == null) return;
      const dist = Math.hypot(ag.runToX - ag.x, ag.runToY - ag.y);
      if (dist < 4) return;
      const sx = px(ag.x);
      const sy = py(ag.y);
      const ex = px(ag.runToX);
      const ey = py(ag.runToY);
      ctx.save();
      ctx.strokeStyle = ag.intent === 'OVERLAP' ? 'rgba(56, 189, 248, 0.72)' : 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Arrowhead
      const ang = Math.atan2(ey - sy, ex - sx);
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * 6, ey - Math.sin(ang - 0.5) * 6);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 6, ey - Math.sin(ang + 0.5) * 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // Ball trail & target line when in flight
  const b = world.ball;
  if (!b.carrierId && b.flightType !== 'carry') {
    const startPx = px(b.fromX);
    const startPy = py(b.fromY);
    const endPx = px(b.toX);
    const endPy = py(b.toY);
    const midX = (startPx + endPx) * 0.5;
    const midY = (startPy + endPy) * 0.5 + b.curve * (ph / 100);
    ctx.save();
    ctx.strokeStyle =
      b.flightType === 'shot' || b.flightType === 'freekick'
        ? 'rgba(248, 113, 113, 0.52)'
        : b.flightType === 'through'
          ? 'rgba(250, 204, 21, 0.55)'
          : b.flightType === 'cross' || b.flightType === 'corner'
            ? 'rgba(96, 165, 250, 0.55)'
            : 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = b.flightType === 'shot' ? 2 : 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startPx, startPy);
    ctx.quadraticCurveTo(midX, midY, endPx, endPy);
    ctx.stroke();
    ctx.restore();
  }

  if (b.trail.length > 1) {
    for (let i = 1; i < b.trail.length; i++) {
      const p0 = b.trail[i - 1];
      const p1 = b.trail[i];
      const a = (i / b.trail.length) * 0.55;
      ctx.strokeStyle = b.flightType === 'shot' ? `rgba(254, 240, 138, ${a})` : `rgba(255, 255, 255, ${a * 0.7})`;
      ctx.lineWidth = 1.5 + (i / b.trail.length) * 2;
      ctx.beginPath();
      ctx.moveTo(px(p0.x), py(p0.y) - p0.z * 0.65);
      ctx.lineTo(px(p1.x), py(p1.y) - p1.z * 0.65);
      ctx.stroke();
    }
  }

  // 5. Render 22 Players with natural running strides, orientation, GK dives, stamina, portraits & labels
  const playerRadius = clamp(cssW * 0.018, 9, 13.5);
  const sortedAgents = world.agents.slice().sort((a, b2) => a.y - b2.y);

  sortedAgents.forEach((ag) => {
    if (ag.sentOff) return;
    const cx = px(ag.x);
    const cy = py(ag.y);
    const speed = Math.hypot(ag.vx, ag.vy);
    const strideSin = Math.sin(ag.stride) * clamp(speed / 12, 0, 1);
    const isCarrier = b.carrierId === ag.id;
    const isTarget = b.targetId === ag.id;
    const kit = ag.pos === 'GK' ? (ag.side === 'H' ? homeGkKit : awayGkKit) : ag.side === 'H' ? homeKit : awayKit;
    const trim = ag.pos === 'GK' ? '#ffffff' : ag.side === 'H' ? homeTrim : awayTrim;

    ctx.save();
    ctx.translate(cx, cy);

    // Carrier or "Me" highlight ring
    if (ag.isMe) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isCarrier) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isTarget) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, playerRadius + 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, playerRadius * 0.82, playerRadius * 0.92, playerRadius * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // GK diving stretch offset
    if (ag.intent === 'DIVE' && ag.diveProgress > 0) {
      const diveShiftY = ag.diveDir * Math.sin(ag.diveProgress * Math.PI) * playerRadius * 1.15;
      ctx.translate(0, diveShiftY);
      ctx.rotate(ag.diveDir * Math.sin(ag.diveProgress * Math.PI) * 0.55);
    }

    // Animated running feet / boots oriented along facing direction
    const cosF = Math.cos(ag.facing);
    const sinF = Math.sin(ag.facing);
    const perpX = -sinF;
    const perpY = cosF;
    const legSwing = strideSin * (playerRadius * 0.52);

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(perpX * (playerRadius * 0.42) + cosF * legSwing, perpY * (playerRadius * 0.42) + sinF * legSwing + playerRadius * 0.35, playerRadius * 0.28, 0, Math.PI * 2);
    ctx.arc(-perpX * (playerRadius * 0.42) - cosF * legSwing, -perpY * (playerRadius * 0.42) - sinF * legSwing + playerRadius * 0.35, playerRadius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders sway & facing indicator
    const bobY = -Math.abs(strideSin) * 1.5;
    ctx.translate(0, bobY);

    // Direction nose/shoulder cue
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cosF * (playerRadius * 0.82), sinF * (playerRadius * 0.82), 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Jersey circle backdrop
    ctx.fillStyle = kit;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Clipped player portrait inside circle
    const faceCanvas = getPitchFaceCanvas(ag.vis, kit, trim);
    if (faceCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, playerRadius - 0.8), 0, Math.PI * 2);
      ctx.clip();
      const fw = playerRadius * 2.06;
      const fh = (fw * 68) / 64;
      ctx.drawImage(faceCanvas, -fw / 2, -fh * 0.47, fw, fh);
      ctx.restore();
    }

    // Crisp outer ring
    ctx.strokeStyle = ag.isMe ? '#fde047' : ag.intent === 'PRESS' ? '#fca5a5' : '#ffffff';
    ctx.lineWidth = ag.isMe ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Shirt number (center fallback before SVG image decodes, otherwise compact corner badge)
    if (!faceCanvas) {
      ctx.fillStyle = colDist(kit, '#ffffff') < 110 ? '#111827' : '#ffffff';
      ctx.font = `800 ${Math.round(playerRadius * 0.88)}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ag.no), 0, 0.5);
    } else {
      const noStr = String(ag.no);
      const badgeW = Math.max(10.5, noStr.length * 5.2 + 4);
      const badgeH = 9.5;
      const bx0 = -playerRadius * 0.98;
      const by0 = playerRadius * 0.25;
      ctx.fillStyle = 'rgba(11, 32, 24, 0.92)';
      ctx.strokeStyle = kit;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx0, by0, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd75e';
      ctx.font = '800 7.5px Sarabun, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noStr, bx0 + badgeW / 2, by0 + badgeH / 2 + 0.3);
    }

    // Yellow card mini indicator on shoulder
    if (ag.hasYellow) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 0.8;
      ctx.fillRect(playerRadius * 0.55, -playerRadius * 1.05, 4.5, 6.2);
      ctx.strokeRect(playerRadius * 0.55, -playerRadius * 1.05, 4.5, 6.2);
    }

    // Live stamina micro-bar under every player on the pitch
    const stamPct = clamp(ag.fit, 0, 100) / 100;
    const barW = playerRadius * 1.9;
    const barH = 2.6;
    const barY = playerRadius + 1.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(-barW / 2 - 0.5, barY - 0.5, barW + 1, barH + 1);
    ctx.fillStyle = ag.fit >= 70 ? '#22c55e' : ag.fit >= 45 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(-barW / 2, barY, barW * stamPct, barH);

    // Compact label for carrier, target, shooter, or "★ ฉัน"
    if (isCarrier || isTarget || ag.isMe || ag.intent === 'CELEBRATE' || ag.intent === 'MAKE_RUN') {
      const label = ag.isMe ? `★ ${ag.shortName} ${Math.round(ag.fit)}%` : ag.shortName;
      ctx.font = `700 ${Math.max(9, Math.round(playerRadius * 0.86))}px Sarabun, sans-serif`;
      const tw = ctx.measureText(label).width;
      const bw = tw + 8;
      const by = playerRadius + 11.5;
      ctx.fillStyle = ag.isMe ? 'rgba(250, 204, 21, 0.92)' : 'rgba(8, 22, 15, 0.78)';
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by - 6.5, bw, 13, 4);
      ctx.fill();
      ctx.fillStyle = ag.isMe ? '#1a1200' : '#ffffff';
      ctx.fillText(label, 0, by);
    }

    ctx.restore();
  });

  // 6. Ball with 3D ground shadow + elevation scale
  const bx = px(b.x);
  const by = py(b.y);
  const ballScale = 1 + clamp(b.z / 28, 0, 0.55);
  const ballR = clamp(cssW * 0.0085, 4.4, 6.2) * ballScale;

  // Ground shadow
  ctx.fillStyle = `rgba(0, 0, 0, ${clamp(0.38 - b.z * 0.012, 0.14, 0.38)})`;
  ctx.beginPath();
  ctx.ellipse(bx + b.z * 0.18, by + 3 + b.z * 0.25, ballR * 0.85, ballR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Elevated ball
  const drawBy = by - b.z * 0.65;
  ctx.save();
  ctx.translate(bx, drawBy);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, ballR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Pentagon pattern detail
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(0, 0, ballR * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Floating event callouts (Offside flag, Foul, Save, Woodwork, Goal!)
  world.fx.forEach((fx) => {
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    const fxX = clamp(px(fx.x), 58, cssW - 58);
    const fxY = clamp(py(fx.y) - 22 - (1 - alpha) * 10, 18, cssH - 18);
    ctx.font = '800 11px Sarabun, sans-serif';
    const tw = ctx.measureText(fx.label).width;
    const bw = tw + 14;
    ctx.fillStyle = 'rgba(10, 24, 17, 0.9)';
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(fxX - bw / 2, fxY - 10, bw, 20, 999);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fx.label, fxX, fxY);
    ctx.restore();
  });

  // 8. Subtle Goal Sparkles & Broadcast Goal Strip
  if (world.sparkles.length > 0) {
    world.sparkles.forEach((sp) => {
      const a = clamp(sp.ttl / sp.maxTtl, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(px(sp.x), py(sp.y), sp.size * (0.6 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  if (world.goalBanner && world.goalBanner.ttl > 0) {
    const gb = world.goalBanner;
    const prog = clamp(1 - gb.ttl / Math.max(0.01, gb.maxTtl), 0, 1);
    const enterT = clamp(prog / 0.22, 0, 1);
    const easeIn = 1 - Math.pow(1 - enterT, 3);
    const fadeOut = clamp(gb.ttl / 0.34, 0, 1);
    const easeExit = Math.pow(1 - fadeOut, 2);
    const alpha = Math.min(clamp(enterT * 2.4, 0, 1), fadeOut);
    ctx.save();
    ctx.globalAlpha = alpha;
    const title = gb.isMeScorer
      ? `🌟 คุณยิงประตู!! ${gb.scorer}`
      : `⚽ GOAL!! ${gb.scorer} (${gb.teamName})`;
    const sub = gb.assister ? `🎯 แอสซิสต์: ${gb.assister}` : gb.isMyGoal ? '🎉 เฮลั่นสนาม!' : '🔥 ตุงตาข่าย!';
    ctx.font = '800 13px Sarabun, sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '600 10px Sarabun, sans-serif';
    const w2 = ctx.measureText(sub).width;
    const cardW = clamp(Math.max(w1, w2) + 38, 180, cssW - 24);
    const cardH = 40;
    const targetY = 12;
    const startY = -(cardH + 12);
    const cy = enterT < 1 ? startY + (targetY - startY) * easeIn : targetY - 22 * easeExit;
    const cx = cssW / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(9, 23, 16, 0.94)';
    ctx.strokeStyle = gb.isMyGoal ? '#facc15' : '#4ade80';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Team color accent strip on left
    ctx.fillStyle = gb.kit;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2 + 5, cy + 5, 5, cardH - 10, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gb.isMyGoal ? '#fde047' : '#ffffff';
    ctx.font = '800 12.5px Sarabun, sans-serif';
    ctx.fillText(title, cx + 3, cy + 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.font = '600 10px Sarabun, sans-serif';
    ctx.fillText(sub, cx + 3, cy + 29);
    ctx.restore();
  }

  // 8b. Card Broadcast Banner (Yellow / 2nd Yellow / Direct Red)
  if (world.cardBanner && world.cardBanner.ttl > 0 && !world.goalBanner && !world.varReview) {
    const cb = world.cardBanner;
    const prog = clamp(1 - cb.ttl / Math.max(0.01, cb.maxTtl), 0, 1);
    const enterT = clamp(prog / 0.2, 0, 1);
    const fadeOut = clamp(cb.ttl / 0.35, 0, 1);
    const alpha = Math.min(clamp(enterT * 2.5, 0, 1), fadeOut);
    const isRed = cb.type === 'R' || cb.type === 'Y2R';
    const accent = isRed ? '#ef4444' : '#facc15';
    const title =
      cb.type === 'R'
        ? `🟥 ใบแดงไล่ออก!! ${cb.shortName}`
        : cb.type === 'Y2R'
          ? `🟨🟨➡🟥 เหลืองที่สอง!! ${cb.shortName}`
          : `🟨 ใบเหลือง · ${cb.shortName}`;
    const sub = isRed ? `${cb.teamName} เหลือผู้เล่นน้อยกว่า` : `${cb.teamName} · เตือนจังหวะเข้าหนัก`;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 12px Sarabun, sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '600 10px Sarabun, sans-serif';
    const w2 = ctx.measureText(sub).width;
    const cardW = clamp(Math.max(w1, w2) + 46, 178, cssW - 24);
    const cardH = 38;
    const cx = cssW / 2;
    const cy = 12;
    ctx.fillStyle = 'rgba(11, 18, 28, 0.94)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Mini card icon badge on left
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2 + 10, cy + 9, 12, 18, 2.5);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = '800 11.5px Sarabun, sans-serif';
    ctx.fillText(title, cx - cardW / 2 + 29, cy + 13.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9.5px Sarabun, sans-serif';
    ctx.fillText(sub, cx - cardW / 2 + 29, cy + 27);
    ctx.restore();
  }

  // 9. VAR Check Broadcast Box
  if (world.varReview) {
    const vr = world.varReview;
    const pct = clamp(1 - vr.waitSec / Math.max(0.1, vr.totalSec), 0, 1);
    const accent = vr.kind === 'foul_card' ? '#f59e0b' : '#38bdf8';
    ctx.save();
    const boxW = Math.min(286, cssW - 24);
    const boxH = 44;
    const cx = cssW / 2;
    const cy = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, cy, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    // Static broadcast REC indicator
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx - boxW / 2 + 16, cy + 15, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = '800 12px Sarabun, sans-serif';
    ctx.fillText(
      vr.kind === 'goal'
        ? '📺 VAR CHECK · ตรวจสอบประตู'
        : vr.kind === 'foul_card'
          ? '📺 VAR CHECK · ฟาวล์รุนแรง / ใบแดง'
          : '📺 VAR CHECK · ตรวจสอบจุดโทษ & ใบ',
      cx - boxW / 2 + 26,
      cy + 15
    );
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 10px Sarabun, sans-serif';
    ctx.fillText(vr.reasonText, cx - boxW / 2 + 26, cy + 29);

    // Progress bar at bottom of VAR box
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(cx - boxW / 2 + 10, cy + boxH - 6, boxW - 20, 2.5);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - boxW / 2 + 10, cy + boxH - 6, (boxW - 20) * pct, 2.5);
    ctx.restore();
  }

  // 10. Subtle Dramatic Slow-Mo Broadcast Cue
  const isSlowShot =
    world.ball.flightType === 'shot' ||
    world.ball.flightType === 'freekick' ||
    world.ball.flightType === 'penalty' ||
    world.ball.flightType === 'shootout_kick';
  if (world.dramaSlowSec > 0 || isSlowShot) {
    const cue = world.dramaLabel || (isSlowShot ? '🎬 จังหวะสำคัญ · สโลว์โมชัน' : '🎬 ภาพช้าเหตุการณ์สำคัญ');
    ctx.save();
    ctx.font = '700 9.5px Sarabun, sans-serif';
    const tw = ctx.measureText(cue).width;
    const bw = Math.min(tw + 16, cssW - 24);
    const bx0 = 10;
    const by0 = cssH - 25;
    ctx.fillStyle = 'rgba(7, 19, 13, 0.84)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx0, by0, bw, 18, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cue, bx0 + 8, by0 + 9.5);
    ctx.restore();
  }
};

const MatchModal: React.FC<{
  state: GameState;
  kind: 'league' | 'cup' | 'asia';
  homeId: number;
  awayId: number;
  isDerby: boolean;
  onFinish: (payload: FinishedMatchPayload) => void;
}> = ({ state, kind, homeId, awayId, isDerby, onFinish }) => {
  const settings = useMemo(() => getSettings(), []);
  const homeOrig = state.teams[homeId];
  const awayOrig = state.teams[awayId];
  const meIsHome = homeId === state.me;
  const [homeKit, awayKit, homeTrim, awayTrim] = useMemo(() => matchKits(homeOrig, awayOrig, state), [homeOrig, awayOrig, state]);
  const homeGkKit = useMemo(() => pickGK(homeKit, awayKit), [homeKit, awayKit]);
  const awayGkKit = useMemo(() => pickGK(awayKit, homeKit, homeGkKit), [awayKit, homeKit, homeGkKit]);

  const meTeamOrig = meIsHome ? homeOrig : awayOrig;
  const oppTeamOrig = meIsHome ? awayOrig : homeOrig;
  const isPlayerMode = state.mode === 'p' && !!state.p;
  const myPlayerName = state.p?.name || '';
  const myPlayerSquadObj = isPlayerMode ? meTeamOrig.sq.find((q) => q.me || q.n === myPlayerName) : undefined;
  const myInitialBanned = isPlayerMode && ((myPlayerSquadObj?.sus || state.p?.sus || 0) > 0);

  const initialHomeXi = useMemo(() => xi(homeOrig).map((q) => q.n), [homeOrig]);
  const initialAwayXi = useMemo(() => xi(awayOrig).map((q) => q.n), [awayOrig]);
  const initialMeXi = meIsHome ? initialHomeXi : initialAwayXi;
  const myInitialStarted = isPlayerMode && !myInitialBanned && initialMeXi.includes(myPlayerName);

  const [minute, setMinute] = useState(0);
  const [clockLabel, setClockLabel] = useState("0'");
  const [stoppageBadge, setStoppageBadge] = useState<number>(0);
  const [matchPhaseUi, setMatchPhaseUi] = useState<LiveMatchWorld['phase']>('play1');
  const [halftimeTalkUsed, setHalftimeTalkUsed] = useState(false);
  const [shootoutUi, setShootoutUi] = useState<ShootoutState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(() => getDefaultMatchSpeed(settings));
  const [showRunVectors, setShowRunVectors] = useState(true);
  const [gh, setGh] = useState(0);
  const [ga, setGa] = useState(0);
  const [goalFlashSide, setGoalFlashSide] = useState<'H' | 'A' | null>(null);
  const goalFlashTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
  }, []);
  const [evs, setEvs] = useState<MatchEvent[]>([]);
  const [actionBanner, setActionBanner] = useState<{ label: string; tone: LiveMatchWorld['phaseTone'] }>({
    label: '⚽ เขี่ยบอลเริ่มเกม',
    tone: 'normal'
  });
  const [logs, setLogs] = useState<{ m: number; text: string; tone?: 'goal' | 'card' | 'sys' | 'sub' }[]>(() => {
    const base: { m: number; text: string; tone?: 'goal' | 'card' | 'sys' | 'sub' }[] = [
      { m: 0, text: `📣 กรรมการเป่านกหวีดเริ่มเกม! ${homeOrig.name} พบ ${awayOrig.name}`, tone: 'sys' }
    ];
    if (isPlayerMode) {
      if (myInitialBanned) {
        base.unshift({ m: 0, text: `🟥 คุณติดโทษแบนนัดนี้ (เหลือ ${myPlayerSquadObj?.sus || state.p?.sus} นัด) — ชมการแข่งขันจากอัฒจันทร์`, tone: 'card' });
      } else if (myInitialStarted) {
        base.unshift({ m: 0, text: `⭐ คุณได้ลงสนามเป็น 11 ตัวจริงของ ${meTeamOrig.name}`, tone: 'sys' });
      } else {
        base.unshift({ m: 0, text: `🪑 นัดนี้คุณเริ่มต้นที่ม้านั่งสำรอง รอโอกาสโค้ชส่งลงสนาม`, tone: 'sys' });
      }
    }
    return base;
  });

  const [matchStats, setMatchStats] = useState({
    possH: 50,
    shotsH: 0,
    shotsA: 0,
    onTargetH: 0,
    onTargetA: 0,
    savesH: 0,
    savesA: 0,
    blocksH: 0,
    blocksA: 0,
    cornersH: 0,
    cornersA: 0,
    foulsH: 0,
    foulsA: 0,
    offsidesH: 0,
    offsidesA: 0,
    freeKicksH: 0,
    freeKicksA: 0,
    passesH: 0,
    passesA: 0,
    xgH: 0,
    xgA: 0
  });

  const [liveTac, setLiveTac] = useState<Mentality>(meTeamOrig.tac);
  const [livePress, setLivePress] = useState<number>(meTeamOrig.press ?? 1);
  const [liveTempo, setLiveTempo] = useState<number>(meTeamOrig.tempo ?? 1);
  const [liveLine, setLiveLine] = useState<number>(meTeamOrig.line ?? 1);
  const [liveWid, setLiveWid] = useState<number>(meTeamOrig.wid ?? 1);
  const [livePass, setLivePass] = useState<number>(meTeamOrig.pass ?? 1);

  const [liveLu, setLiveLu] = useState<string[]>(() => initialMeXi);
  const [liveOppLu, setLiveOppLu] = useState<string[]>(() => (meIsHome ? initialAwayXi : initialHomeXi));
  const [subsUsed, setSubsUsed] = useState<string[]>([]);
  const [subLog, setSubLog] = useState<MatchSubEvent[]>([]);
  const [liveFitMap, setLiveFitMap] = useState<Record<string, number>>(() =>
    Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, Math.round(q.fit ?? 100)]))
  );
  const [liveFormMap, setLiveFormMap] = useState<Record<string, number>>(() =>
    Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, 6.5]))
  );
  const [subAlertEnabled, setSubAlertEnabled] = useState<boolean>(() => settings.subAlertEnabled ?? true);
  const [subAlertFitTh, setSubAlertFitTh] = useState<number>(() => clamp(settings.subAlertFitThreshold ?? 58, 45, 75));
  const [subAlertFormTh, setSubAlertFormTh] = useState<number>(() => clamp(settings.subAlertFormThreshold ?? 5.8, 5.0, 6.4));
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, string>>({});
  const [matchYellows, setMatchYellows] = useState<Record<string, number>>({});
  const [matchCards, setMatchCards] = useState<MatchCardEvent[]>([]);
  const [sentOff, setSentOff] = useState<string[]>([]);
  const [subPickOut, setSubPickOut] = useState<string | null>(null);
  const [showTacticsDrawer, setShowTacticsDrawer] = useState(false);
  const [mlandMatchTab, setMlandMatchTab] = useState<'events' | 'stats' | 'tactics'>('events');
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'sub'>('all');
  const [ftPitchMode, setFtPitchMode] = useState<'all' | 'H' | 'A'>('all');
  const [ftPickedPlayer, setFtPickedPlayer] = useState<string | null>(null);

  const [penResult, setPenResult] = useState<{ winnerHome: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const triggeredRulesRef = useRef<number[]>([]);
  const lastSoundMinRef = useRef(-1);
  const alertLoggedRef = useRef<Set<string>>(new Set());

  const simRef = useRef({
    homeLu: initialHomeXi.slice(),
    awayLu: initialAwayXi.slice(),
    homePlayed: initialHomeXi.slice(),
    awayPlayed: initialAwayXi.slice(),
    homeSubsCount: 0,
    awaySubsCount: 0,
    yellows: {} as Record<string, number>,
    sentOff: [] as string[],
    cards: [] as MatchCardEvent[],
    subs: [] as MatchSubEvent[],
    liveFit: Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, Math.round(q.fit ?? 100)])) as Record<string, number>,
    liveForm: Object.fromEntries([...homeOrig.sq, ...awayOrig.sq].map((q) => [q.n, 6.5])) as Record<string, number>,
    userStarted: myInitialStarted,
    userSubInMin: null as number | null,
    userSubOutMin: null as number | null,
    userSentOffMin: null as number | null,
    aiSubMinH: [R(56, 64), R(68, 76), R(78, 86)],
    aiSubMinA: [R(56, 64), R(68, 76), R(78, 86)],
    gh: 0,
    ga: 0,
    evs: [] as MatchEvent[],
    done: false
  });

  const liveTacticsRef = useRef({
    tac: meTeamOrig.tac,
    press: meTeamOrig.press ?? 1,
    tempo: meTeamOrig.tempo ?? 1,
    line: meTeamOrig.line ?? 1,
    wid: meTeamOrig.wid ?? 1,
    pass: meTeamOrig.pass ?? 1
  });
  liveTacticsRef.current = {
    tac: liveTac,
    press: livePress,
    tempo: liveTempo,
    line: liveLine,
    wid: liveWid,
    pass: livePass
  };

  const subAlertCfgRef = useRef({ enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh });
  subAlertCfgRef.current = { enabled: subAlertEnabled, fitTh: subAlertFitTh, formTh: subAlertFormTh };

  const buildInitialWorld = (): LiveMatchWorld => {
    const sr = simRef.current;
    const hAgents = buildAgentsForTeam(homeOrig, 'H', sr.homeLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
    const aAgents = buildAgentsForTeam(awayOrig, 'A', sr.awayLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
    const firstCarrier = hAgents.find((a) => a.pos === 'FW') || hAgents.find((a) => a.pos === 'MF') || hAgents[9];
    if (firstCarrier) {
      firstCarrier.x = 49;
      firstCarrier.y = 50;
      firstCarrier.intent = 'CARRY';
    }
    return {
      agents: [...hAgents, ...aAgents],
      ball: {
        x: 50,
        y: 50,
        z: 0,
        fromX: 50,
        fromY: 50,
        toX: 50,
        toY: 50,
        curve: 0,
        maxZ: 0,
        progress: 1,
        duration: 0.45,
        flightType: 'carry',
        carrierId: firstCarrier?.id || null,
        targetId: null,
        shooterId: null,
        lastPasserId: null,
        possessionSide: 'H',
        trail: []
      },
      fx: [],
      nextFxId: 1,
      pendingSetPiece: { type: 'kickoff', side: 'H', x: 50, y: 50, waitSec: 0.3 },
      phase: 'play1',
      added1: 0,
      added2: 0,
      stoppageFloat: 0,
      varChecks: 0,
      varReview: null,
      shootout: null,
      phaseLabel: '⚽ เขี่ยบอลเริ่มเกม',
      phaseTone: 'normal',
      minuteFloat: 0,
      lastTickedMin: 0,
      possTicksH: 5,
      possTicksTotal: 10,
      goalNetRippleH: 0,
      goalNetRippleA: 0,
      celebrateTimer: 0,
      dramaSlowSec: 0,
      dramaLabel: null,
      sparkles: [],
      goalBanner: null,
      cardBanner: null,
      passesH: 0,
      passesA: 0,
      shotsH: 0,
      shotsA: 0,
      onTargetH: 0,
      onTargetA: 0,
      savesH: 0,
      savesA: 0,
      blocksH: 0,
      blocksA: 0,
      cornersH: 0,
      cornersA: 0,
      foulsH: 0,
      foulsA: 0,
      offsidesH: 0,
      offsidesA: 0,
      freeKicksH: 0,
      freeKicksA: 0,
      xgH: 0,
      xgA: 0
    };
  };

  const worldRef = useRef<LiveMatchWorld | null>(null);
  if (!worldRef.current) {
    worldRef.current = buildInitialWorld();
  }

  const getEffectiveTeamCfg = (side: 'H' | 'A', curMin: number) => {
    const isUserSide = (side === 'H' && meIsHome) || (side === 'A' && !meIsHome);
    const orig = side === 'H' ? homeOrig : awayOrig;
    const base = isUserSide && state.mode === 'm'
      ? liveTacticsRef.current
      : {
          tac: orig.tac,
          press: orig.press ?? 1,
          tempo: orig.tempo ?? 1,
          line: orig.line ?? 1,
          wid: orig.wid ?? 1,
          pass: orig.pass ?? 1
        };

    const myScore = side === 'H' ? simRef.current.gh : simRef.current.ga;
    const oppScore = side === 'H' ? simRef.current.ga : simRef.current.gh;
    let pushShift = base.tac === 'X' ? 12 : base.tac === 'A' ? 6 : base.tac === 'D' ? -7 : base.tac === 'Z' ? -13 : 0;
    let pressLvl = base.press;
    let lineLvl = base.line;

    // Adaptive AI response to scoreline & match clock
    if (!isUserSide || state.mode === 'p') {
      if (myScore < oppScore && curMin >= 64) {
        pushShift += 7;
        pressLvl = Math.min(2, pressLvl + 1);
        lineLvl = Math.min(2, lineLvl + 1);
      } else if (myScore > oppScore && curMin >= 74) {
        pushShift -= 6;
        lineLvl = Math.max(0, lineLvl - 1);
      }
    }
    const downMen = worldRef.current
      ? worldRef.current.agents.filter((a) => a.side === side && a.sentOff).length
      : 0;
    if (downMen > 0) pushShift -= downMen * 5;

    return {
      tac: base.tac,
      press: pressLvl,
      tempo: base.tempo,
      line: lineLvl,
      wid: base.wid,
      pass: base.pass,
      pushShift
    };
  };

  const getLiveHomeTeam = (): Team => ({
    ...homeOrig,
    tac: meIsHome ? liveTacticsRef.current.tac : homeOrig.tac,
    press: meIsHome ? liveTacticsRef.current.press : homeOrig.press,
    tempo: meIsHome ? liveTacticsRef.current.tempo : homeOrig.tempo,
    line: meIsHome ? liveTacticsRef.current.line : homeOrig.line,
    wid: meIsHome ? liveTacticsRef.current.wid : homeOrig.wid,
    pass: meIsHome ? liveTacticsRef.current.pass : homeOrig.pass,
    lu: simRef.current.homeLu
  });

  const getLiveAwayTeam = (): Team => ({
    ...awayOrig,
    tac: !meIsHome ? liveTacticsRef.current.tac : awayOrig.tac,
    press: !meIsHome ? liveTacticsRef.current.press : awayOrig.press,
    tempo: !meIsHome ? liveTacticsRef.current.tempo : awayOrig.tempo,
    line: !meIsHome ? liveTacticsRef.current.line : awayOrig.line,
    wid: !meIsHome ? liveTacticsRef.current.wid : awayOrig.wid,
    pass: !meIsHome ? liveTacticsRef.current.pass : awayOrig.pass,
    lu: simRef.current.awayLu
  });

  const liveHome = useMemo<Team>(
    () => ({
      ...homeOrig,
      tac: meIsHome ? liveTac : homeOrig.tac,
      press: meIsHome ? livePress : homeOrig.press,
      tempo: meIsHome ? liveTempo : homeOrig.tempo,
      line: meIsHome ? liveLine : homeOrig.line,
      wid: meIsHome ? liveWid : homeOrig.wid,
      pass: meIsHome ? livePass : homeOrig.pass,
      lu: simRef.current.homeLu
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeOrig, meIsHome, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length]
  );

  const liveAway = useMemo<Team>(
    () => ({
      ...awayOrig,
      tac: !meIsHome ? liveTac : awayOrig.tac,
      press: !meIsHome ? livePress : awayOrig.press,
      tempo: !meIsHome ? liveTempo : awayOrig.tempo,
      line: !meIsHome ? liveLine : awayOrig.line,
      wid: !meIsHome ? liveWid : awayOrig.wid,
      pass: !meIsHome ? livePass : awayOrig.pass,
      lu: simRef.current.awayLu
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awayOrig, meIsHome, liveTac, livePress, liveTempo, liveLine, liveWid, livePass, liveLu, subLog.length]
  );

  useEffect(() => {
    SFX.whistle();
    setCrowdAudio(true);
    return () => setCrowdAudio(false);
  }, []);

  const pushLog = (m: number, text: string, tone?: 'goal' | 'card' | 'sys' | 'sub') => {
    setLogs((prev) => [{ m, text, tone }, ...prev].slice(0, 160));
  };

  const addWorldFx = (w: LiveMatchWorld, fx: Omit<LivePitchFx, 'id'>) => {
    w.fx.push({ ...fx, id: w.nextFxId++ });
    if (w.fx.length > 8) w.fx.shift();
  };

  const adjustLiveForm = (playerName: string | null | undefined, delta: number) => {
    if (!playerName) return;
    const sr = simRef.current;
    const cur = sr.liveForm[playerName] ?? 6.5;
    sr.liveForm[playerName] = clamp(Math.round((cur + delta) * 10) / 10, 4.5, 10.0);
  };

  const persistSubAlertPrefs = (enabled: boolean, fitTh: number, formTh: number) => {
    const cur = getSettings();
    saveSettings({
      ...cur,
      subAlertEnabled: enabled,
      subAlertFitThreshold: fitTh,
      subAlertFormThreshold: formTh
    });
  };

  const triggerDramaSlow = (w: LiveMatchWorld, sec: number, label: string) => {
    w.dramaSlowSec = Math.max(w.dramaSlowSec, sec);
    w.dramaLabel = label;
  };

  const issueCard = (culprit: LivePitchAgent, curMin: number, directRedBias = 0.04, forceType?: 'Y' | 'R') => {
    const sr = simRef.current;
    const w = worldRef.current;
    const team = culprit.side === 'H' ? homeOrig : awayOrig;
    const kit = culprit.side === 'H' ? homeKit : awayKit;
    const directRed = forceType === 'R' ? true : forceType === 'Y' ? false : Math.random() < (culprit.tr === 1 ? 0.09 : directRedBias);
    if (directRed) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.7);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'R' });
      setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      pushLog(curMin, `🟥 ใบแดงโดยตรง!! ${culprit.id} (${team.name}) เสียบสกัดอันตราย โดนไล่ออก (แบน 2 นัด)`, 'card');
      setSentOff(sr.sentOff.slice());
      if (w) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟥 ใบแดง!! ${culprit.shortName}`);
      }
      return 'R' as const;
    }
    sr.yellows[culprit.id] = (sr.yellows[culprit.id] || 0) + 1;
    culprit.hasYellow = true;
    setMatchYellows({ ...sr.yellows });
    if (sr.yellows[culprit.id] >= 2) {
      culprit.sentOff = true;
      sr.sentOff.push(culprit.id);
      adjustLiveForm(culprit.id, -0.65);
      sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y2R' });
      setMatchCards(sr.cards.slice());
      if (isPlayerMode && culprit.id === myPlayerName) sr.userSentOffMin = curMin;
      pushLog(curMin, `🟨🟨➡🟥 ใบแดง! ${culprit.id} (${team.name}) โดนเหลืองที่สองไล่ออก (แบน 1 นัด)`, 'card');
      setSentOff(sr.sentOff.slice());
      if (w) {
        w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y2R', kit, ttl: 3.4, maxTtl: 3.4 };
        triggerDramaSlow(w, 2.5, `🟨🟥 เหลืองที่สอง!! ${culprit.shortName}`);
      }
      return 'Y2R' as const;
    }
    adjustLiveForm(culprit.id, -0.35);
    const origPl = team.sq.find((q) => q.n === culprit.id);
    const totalSeasonY = (origPl?.yc || 0) + 1;
    sr.cards.push({ m: curMin, t: team.id, who: culprit.id, type: 'Y' });
    setMatchCards(sr.cards.slice());
    pushLog(
      curMin,
      `🟨 ใบเหลือง! ${culprit.id} (${team.name}) เข้าสกัดหนัก${totalSeasonY >= 3 ? ' (ครบ 3 ใบ แบนนัดหน้า!)' : ` (สะสม ${totalSeasonY}/3)`}`,
      'card'
    );
    if (w) {
      w.cardBanner = { who: culprit.id, shortName: culprit.shortName, teamName: team.name, type: 'Y', kit, ttl: 2.6, maxTtl: 2.6 };
      triggerDramaSlow(w, 1.5, `🟨 ใบเหลือง · ${culprit.shortName}`);
    }
    return 'Y' as const;
  };

  // Update all 22 AI agents' tactical targets & off-ball runs ("ทำทาง") smoothly
  const updateAgentTargets = (w: LiveMatchWorld, curMin: number) => {
    const b = w.ball;
    const hCfg = getEffectiveTeamCfg('H', curMin);
    const aCfg = getEffectiveTeamCfg('A', curMin);

    const activeAgents = w.agents.filter((a) => !a.sentOff);
    const hOut = activeAgents.filter((a) => a.side === 'H' && a.pos !== 'GK');
    const aOut = activeAgents.filter((a) => a.side === 'A' && a.pos !== 'GK');

    const oppSecondLastX = (defSide: 'H' | 'A') => {
      const defs = activeAgents.filter((a) => a.side === defSide).map((a) => a.x);
      defs.sort((u, v) => (defSide === 'H' ? u - v : v - u));
      return defs[1] ?? (defSide === 'H' ? 18 : 82);
    };
    const hDefLineX = oppSecondLastX('H');
    const aDefLineX = oppSecondLastX('A');

    // Find 2 closest defenders to ball for pressing/covering
    const defSide = b.possessionSide === 'H' ? 'A' : 'H';
    const defPressers = activeAgents
      .filter((a) => a.side === defSide && a.pos !== 'GK')
      .sort((u, v) => Math.hypot(u.x - b.x, u.y - b.y) - Math.hypot(v.x - b.x, v.y - b.y));
    const primaryPresserId = defPressers[0]?.id;
    const secondaryCoverId = defPressers[1]?.id;

    // Identify attacking triangle support candidates
    const carrier = b.carrierId ? activeAgents.find((a) => a.id === b.carrierId) : null;
    const attMids = activeAgents
      .filter((a) => a.side === b.possessionSide && a.pos === 'MF' && a.id !== carrier?.id)
      .sort((u, v) => Math.hypot(u.x - b.x, u.y - b.y) - Math.hypot(v.x - b.x, v.y - b.y))
      .slice(0, 2);

    const setPiece = w.pendingSetPiece;

    activeAgents.forEach((ag) => {
      if (ag.intentTimer > 0) {
        if (ag.intent === 'CELEBRATE' || ag.intent === 'DIVE') return;
      }

      const isH = ag.side === 'H';
      const cfg = isH ? hCfg : aCfg;
      const inPoss = b.possessionSide === ag.side;
      const dir = isH ? 1 : -1;

      // Celebration run!
      if (w.celebrateTimer > 0 && inPoss && ag.pos !== 'GK') {
        ag.intent = 'CELEBRATE';
        const cornerY = b.y < 50 ? 12 : 88;
        const cornerX = isH ? 92 : 8;
        ag.tx = clamp(cornerX + (((ag.slotIndex % 3) - 1) * 4), 6, 94);
        ag.ty = clamp(cornerY + (((ag.slotIndex % 4) - 1.5) * 4), 8, 92);
        ag.runToX = undefined;
        ag.runToY = undefined;
        return;
      }

      // Penalty Shootout positioning
      if (w.phase === 'shootout' && w.shootout) {
        const sh = w.shootout;
        const kickSide = sh.turn;
        const gkSide = kickSide === 'H' ? 'A' : 'H';
        if (ag.side === gkSide && ag.pos === 'GK') {
          ag.tx = 98.2;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        if (ag.id === sh.kickerName && ag.side === kickSide) {
          ag.tx = 86.2;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        // Rest of players watch from center circle
        const angle = (ag.slotIndex / 11) * Math.PI * 2 + (isH ? 0 : Math.PI);
        ag.tx = clamp(47 + Math.cos(angle) * 6 + (isH ? -4 : 4), 35, 58);
        ag.ty = clamp(50 + Math.sin(angle) * 14, 24, 76);
        ag.intent = 'SUPPORT';
        return;
      }

      // In-match Penalty Kick positioning
      if (setPiece && setPiece.type === 'penalty') {
        const isAtt = ag.side === setPiece.side;
        const spotX = setPiece.side === 'H' ? 88.5 : 11.5;
        if (!isAtt && ag.pos === 'GK') {
          ag.tx = setPiece.side === 'H' ? 98.2 : 1.8;
          ag.ty = 50;
          ag.intent = 'SUPPORT';
          return;
        }
        if (ag.pos !== 'GK') {
          const lineBackX = setPiece.side === 'H' ? 80.5 : 19.5;
          ag.tx = setPiece.side === 'H' ? Math.min(spotX - 7, lineBackX - (ag.slotIndex % 3) * 2.5) : Math.max(spotX + 7, lineBackX + (ag.slotIndex % 3) * 2.5);
          ag.ty = clamp(24 + ((ag.slotIndex * 5.3) % 52), 20, 80);
          ag.intent = 'SUPPORT';
          return;
        }
      }

      // Free-kick defensive wall & set piece positioning
      if (setPiece && setPiece.type === 'freekick') {
        if (ag.side !== setPiece.side && setPiece.wallPlayers) {
          const wallIdx = activeAgents
            .filter((z) => z.side === ag.side && (z.pos === 'DF' || z.pos === 'MF'))
            .sort((u, v) => Math.hypot(u.x - setPiece.x, u.y - setPiece.y) - Math.hypot(v.x - setPiece.x, v.y - setPiece.y))
            .slice(0, setPiece.wallPlayers.length)
            .findIndex((z) => z.id === ag.id);
          if (wallIdx >= 0 && setPiece.wallPlayers[wallIdx]) {
            ag.intent = 'WALL';
            ag.tx = setPiece.wallPlayers[wallIdx].x;
            ag.ty = setPiece.wallPlayers[wallIdx].y;
            return;
          }
        }
      }

      // Corner kick box crowding
      if (setPiece && setPiece.type === 'corner' && ag.pos !== 'GK') {
        const isAtt = ag.side === setPiece.side;
        const targetGoalX = setPiece.side === 'H' ? 91 : 9;
        if (isAtt && (ag.pos === 'FW' || ag.role === 'CB' || ag.role === 'CM')) {
          ag.intent = 'MAKE_RUN';
          ag.tx = clamp(targetGoalX + (ag.role === 'CB' ? -3 * (setPiece.side === 'H' ? 1 : -1) : 0) + ((ag.slotIndex % 3) - 1) * 2.5, 6, 94);
          ag.ty = clamp(40 + (ag.slotIndex % 5) * 5, 34, 66);
          ag.runToX = ag.tx;
          ag.runToY = ag.ty;
          return;
        }
        if (!isAtt && (ag.pos === 'DF' || ag.role === 'CDM')) {
          ag.intent = 'MARK';
          ag.tx = clamp(targetGoalX + ((ag.slotIndex % 2) * 3 - 1.5), 5, 95);
          ag.ty = clamp(39 + (ag.slotIndex % 4) * 6, 35, 65);
          return;
        }
      }

      // Goalkeeper AI
      if (ag.pos === 'GK') {
        const goalX = isH ? 3.8 : 96.2;
        const ballThreat = isH ? clamp((30 - b.x) / 30, 0, 1) : clamp((b.x - 70) / 30, 0, 1);
        const sweepPush = (ag.d.cl > 68 ? 3.2 : 1.6) * (inPoss ? 1.4 : ballThreat);
        ag.tx = clamp(goalX + dir * (1.2 + sweepPush), 3, 97);
        ag.ty = clamp(50 + (b.y - 50) * 0.24, 42.5, 57.5);
        ag.intent = 'SUPPORT';
        ag.runToX = undefined;
        ag.runToY = undefined;
        return;
      }

      // Outfield Base Formation Projection
      const homeBaseX = clamp(100 - ag.slotY, 10, 90);
      const rawSlotY = isH ? ag.slotX : 100 - ag.slotX;
      const widthScale = cfg.wid === 2 ? 1.16 : cfg.wid === 0 ? 0.82 : 1;
      const widenedY = clamp(50 + (rawSlotY - 50) * widthScale, 5, 95);

      // Shift team longitudinally with ball + tactical line + possession
      const ballXNorm = isH ? b.x : 100 - b.x;
      const lineOffset = cfg.line === 2 ? 6.5 : cfg.line === 0 ? -6.5 : 0;
      const possBoost = inPoss ? 7.5 : -6.5;
      const zoneFactor = ag.pos === 'DF' ? 0.42 : ag.pos === 'MF' ? 0.62 : 0.72;
      let tx = homeBaseX + (ballXNorm - 50) * zoneFactor + cfg.pushShift * 0.55 + lineOffset + possBoost;
      if (!isH) tx = 100 - tx;

      // Shift horizontally toward ball flank (zonal compactness)
      const flankPull = inPoss ? 0.14 : 0.26;
      let ty = widenedY + (b.y - 50) * flankPull;

      ag.intent = inPoss ? 'SUPPORT' : 'MARK';
      ag.runToX = undefined;
      ag.runToY = undefined;

      if (b.carrierId === ag.id) {
        ag.intent = 'CARRY';
        // Carrier advances slightly toward goal / inside
        tx = clamp(ag.x + dir * 4, 6, 94);
        ty = clamp(ag.y + (50 - ag.y) * 0.08, 7, 93);
      } else if (b.targetId === ag.id) {
        ag.intent = 'PASS_TARGET';
        tx = clamp(b.toX, 5, 95);
        ty = clamp(b.toY, 5, 95);
      } else if (inPoss) {
        const oppDefLine = isH ? aDefLineX : hDefLineX;
        const attProgress = isH ? b.x : 100 - b.x;

        // ROLE-DISTINCT OFF-BALL INTELLIGENCE ("ทำทาง")
        if (ag.role === 'ST') {
          // ST pins opponent's last defender and darts across the 6-yard/penalty box
          const shoulderX = oppDefLine - dir * 1.2;
          const runLead = attProgress > 52 ? dir * 7.5 : dir * 2.5;
          tx = clamp(isH ? Math.max(tx, shoulderX + runLead) : Math.min(tx, shoulderX + runLead), 8, 92);
          ty = clamp(50 + Math.sin(w.minuteFloat * 1.3 + ag.slotIndex) * 14, 30, 70);
          if (attProgress > 48 && carrier && carrier.side === ag.side) {
            ag.intent = 'MAKE_RUN';
            ag.runToX = clamp(tx + dir * 8, 6, 94);
            ag.runToY = clamp(ty + (50 - ty) * 0.25, 32, 68);
          }
        } else if (ag.role === 'CF') {
          // CF (False 9) drops deeper into pocket toward carrier to link play and pull CBs out!
          const pocketX = carrier ? carrier.x + dir * 13 : oppDefLine - dir * 11;
          tx = clamp(isH ? Math.min(oppDefLine - 5, pocketX) : Math.max(oppDefLine + 5, pocketX), 14, 86);
          ty = clamp(b.y + (50 - b.y) * 0.45, 28, 72);
          ag.intent = 'SUPPORT';
        } else if (ag.role === 'SS') {
          // SS (Shadow Striker) floats in half-space pocket, then makes explosive third-man sprint!
          const halfSpaceY = b.y < 50 ? 60 : 40;
          const surge = attProgress > 46;
          if (surge) {
            tx = clamp(oppDefLine + dir * 5.5, 8, 92);
            ty = clamp(halfSpaceY + (50 - halfSpaceY) * 0.2, 26, 74);
            ag.intent = 'MAKE_RUN';
            ag.runToX = clamp(tx + dir * 8, 7, 93);
            ag.runToY = clamp(50 + (ty - 50) * 0.5, 33, 67);
          } else {
            tx = clamp((carrier ? carrier.x + dir * 16 : tx), 15, 85);
            ty = clamp(halfSpaceY, 28, 72);
          }
        } else if (ag.role === 'LW' || ag.role === 'RW' || ag.role === 'LM' || ag.role === 'RM') {
          const isLeftWing = ag.role === 'LW' || ag.role === 'LM';
          const sideY = isH ? (isLeftWing ? 13 : 87) : isLeftWing ? 87 : 13;
          const ballOnSameFlank = Math.abs(b.y - sideY) < 28;
          if (attProgress > 55 && !ballOnSameFlank) {
            // Far-side winger cuts diagonally inside toward far post!
            tx = clamp(oppDefLine + dir * 3, 9, 91);
            ty = clamp(isH ? (isLeftWing ? 36 : 64) : isLeftWing ? 64 : 36, 26, 74);
            ag.intent = 'MAKE_RUN';
            ag.runToX = clamp(tx + dir * 7, 7, 93);
            ag.runToY = ty;
          } else if (attProgress > 50) {
            // Ball-side winger pushes toward byline for cross or cutback
            tx = clamp(tx + dir * 10, 8, 93);
            ty = clamp(sideY, 6, 94);
            ag.intent = 'MAKE_RUN';
            ag.runToX = clamp(tx + dir * 6, 7, 93);
            ag.runToY = ty;
          }
        } else if (ag.role === 'LB' || ag.role === 'RB' || ag.role === 'LWB' || ag.role === 'RWB') {
          const isLeftFb = ag.role === 'LB' || ag.role === 'LWB';
          const fbY = isH ? (isLeftFb ? 10 : 90) : isLeftFb ? 90 : 10;
          const ballOnMySide = Math.abs(b.y - fbY) < 34;
          if (attProgress > 46 && ballOnMySide && (cfg.tac === 'A' || cfg.tac === 'X' || ag.role === 'LWB' || ag.role === 'RWB' || attMids.length > 0)) {
            // Wingback overlapping run outside the winger!
            tx = clamp(b.x + dir * 14, 10, 90);
            ty = clamp(fbY, 5, 95);
            ag.intent = 'OVERLAP';
            ag.runToX = clamp(tx + dir * 9, 8, 92);
            ag.runToY = ty;
          }
        } else if (attMids.some((m) => m.id === ag.id) && carrier) {
          // Passing triangle support around the ball carrier
          const idxM = attMids.findIndex((m) => m.id === ag.id);
          const angleOffset = idxM === 0 ? 0.65 : -0.75;
          const triDist = cfg.pass === 0 ? 12 : 16;
          tx = clamp(carrier.x + dir * Math.cos(angleOffset) * triDist * 0.7, 10, 90);
          ty = clamp(carrier.y + Math.sin(angleOffset) * triDist, 10, 90);
          ag.intent = 'SUPPORT';
        }
      } else {
        // OUT OF POSSESSION: Pressing, Covering, & Zonal Marking
        const pressReach = cfg.press === 2 ? 1.0 : cfg.press === 1 ? 0.72 : 0.42;
        if (ag.id === primaryPresserId) {
          ag.intent = 'PRESS';
          tx = clamp(b.x - dir * 1.5, 5, 95);
          ty = clamp(b.y, 6, 94);
          if (pressReach < 0.6) {
            // Low press: jockey between ball and own goal instead of lunging
            tx = clamp(b.x + dir * 6, 7, 93);
          }
        } else if (ag.id === secondaryCoverId) {
          ag.intent = 'MARK';
          tx = clamp(b.x + dir * 9, 7, 93);
          ty = clamp(b.y + (50 - b.y) * 0.25, 10, 90);
        } else if (ag.pos === 'DF') {
          // Hold coherent defensive line and track nearest forward
          const targetDefX = isH ? clamp(Math.min(b.x - 10, 34 + (cfg.line - 1) * 7), 8, 46) : clamp(Math.max(b.x + 10, 66 - (cfg.line - 1) * 7), 54, 92);
          tx = clamp(tx * 0.35 + targetDefX * 0.65, 8, 92);
        }
      }

      // Soft separation between teammates so dots don't overlap on top of each other
      const teamMates = isH ? hOut : aOut;
      teamMates.forEach((other) => {
        if (other.id === ag.id) return;
        const dx = tx - other.x;
        const dy = ty - other.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.1 && d < 5.5) {
          tx += (dx / d) * (5.5 - d) * 0.5;
          ty += (dy / d) * (5.5 - d) * 0.5;
        }
      });

      ag.tx = clamp(tx, 4, 96);
      ag.ty = clamp(ty, 5, 95);
    });
  };

  // Start next micro-play when ball finishes current movement/segment
  const scheduleNextPlay = (w: LiveMatchWorld, curMin: number) => {
    if (simRef.current.done) return;
    const b = w.ball;
    const active = w.agents.filter((a) => !a.sentOff);
    const getTeamPool = (side: 'H' | 'A') => active.filter((a) => a.side === side);

    // 1. Pending Set Piece Execution (Kickoff, Free Kick, Corner, Offside Restart, Goal Kick)
    if (w.pendingSetPiece) {
      const sp = w.pendingSetPiece;
      if (sp.waitSec > 0) return;
      w.pendingSetPiece = null;
      const attPool = getTeamPool(sp.side);
      const defSide = sp.side === 'H' ? 'A' : 'H';
      const defPool = getTeamPool(defSide);
      const dir = sp.side === 'H' ? 1 : -1;
      const attTeam = sp.side === 'H' ? homeOrig : awayOrig;
      const attCfg = getEffectiveTeamCfg(sp.side, curMin);
      const defCfg = getEffectiveTeamCfg(defSide, curMin);

      if (sp.type === 'kickoff') {
        const kicker = attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.pos === 'MF') || attPool[0];
        const midTarget = attPool.find((a) => a.pos === 'MF' && a.id !== kicker?.id) || attPool[1] || kicker;
        if (kicker && midTarget) {
          kicker.x = 50;
          kicker.y = 50;
          b.x = 50;
          b.y = 50;
          b.fromX = 50;
          b.fromY = 50;
          b.toX = midTarget.x;
          b.toY = midTarget.y;
          b.curve = 0;
          b.maxZ = 0;
          b.progress = 0;
          b.duration = 0.42;
          b.flightType = 'pass';
          b.carrierId = null;
          b.targetId = midTarget.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `⚽ ${attTeam.name} ครองบอลขึ้นเกม`;
          w.phaseTone = 'normal';
        }
        return;
      }

      if (sp.type === 'goalkick' || sp.type === 'offside') {
        const kicker = sp.type === 'goalkick' ? attPool.find((a) => a.pos === 'GK') || attPool[0] : attPool.find((a) => a.pos === 'DF') || attPool[0];
        const receiver =
          attCfg.pass >= 2
            ? attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.pos === 'MF')
            : attPool.find((a) => (a.pos === 'DF' || a.pos === 'MF') && a.id !== kicker?.id);
        if (kicker && receiver) {
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = receiver.x;
          b.toY = receiver.y;
          b.curve = (Math.random() - 0.5) * 3;
          b.maxZ = attCfg.pass >= 2 ? 12 : 4;
          b.progress = 0;
          b.duration = attCfg.pass >= 2 ? 0.72 : 0.48;
          b.flightType = 'goalkick';
          b.carrierId = null;
          b.targetId = receiver.id;
          b.lastPasserId = kicker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = sp.type === 'offside' ? `⚽ เตะฟรีคิกล้ำหน้า (${attTeam.name})` : `🥅 เปิดเกมจากประตู (${attTeam.name})`;
          w.phaseTone = 'normal';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'freekick') {
        const distToGoal = Math.hypot((sp.side === 'H' ? 100 : 0) - sp.x, 50 - sp.y);
        const taker =
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => v.d.cur + v.d.pw - (u.d.cur + u.d.pw))[0] || attPool[0];
        if (!taker) return;
        taker.x = clamp(sp.x - dir * 1.5, 4, 96);
        taker.y = sp.y;
        const canShootDirect = distToGoal < 35;
        if (canShootDirect) {
          const targetGoalX = sp.side === 'H' ? 99.5 : 0.5;
          const targetGoalY = 44 + Math.random() * 12;
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = targetGoalX;
          b.toY = targetGoalY;
          b.curve = (sp.y < 50 ? 1 : -1) * (6 + Math.random() * 5);
          b.maxZ = 10.5;
          b.progress = 0;
          b.duration = 0.85;
          b.flightType = 'freekick';
          b.carrierId = null;
          b.targetId = null;
          b.shooterId = taker.id;
          b.lastPasserId = null;
          b.possessionSide = sp.side;
          w.phaseLabel = `🎯 ${taker.shortName} ปั่นฟรีคิก!`;
          w.phaseTone = 'danger';
          triggerDramaSlow(w, 1.0, `🎯 ฟรีคิกลุ้นประตู · ${taker.shortName}`);
          SFX.kick();
          pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) วิ่งเข้ามาปั่นฟรีคิกข้ามกำแพง!`);
        } else {
          // Whipped set-piece delivery into the box
          const boxTarget =
            attPool.filter((a) => a.pos === 'FW' || a.role === 'CB').sort((u, v) => v.d.hd - u.d.hd)[0] ||
            attPool[1] ||
            taker;
          const destX = clamp(sp.side === 'H' ? 88 + Math.random() * 6 : 6 + Math.random() * 6, 6, 94);
          const destY = clamp(38 + Math.random() * 24, 30, 70);
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * 7;
          b.maxZ = 13;
          b.progress = 0;
          b.duration = 0.72;
          b.flightType = 'cross';
          b.carrierId = null;
          b.targetId = boxTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `⚠️ ${taker.shortName} เปิดฟรีคิกเข้ากรอบเขตโทษ`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }

      if (sp.type === 'corner') {
        const taker =
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => v.d.crs + v.d.cur - (u.d.crs + u.d.cur))[0] || attPool[0];
        const headerTarget =
          attPool
            .filter((a) => a.id !== taker?.id && a.pos !== 'GK')
            .sort((u, v) => v.d.hd + v.d.str - (u.d.hd + u.d.str))[0] || attPool[1];
        if (taker && headerTarget) {
          taker.x = sp.x;
          taker.y = sp.y;
          const destX = sp.side === 'H' ? 91.5 + Math.random() * 3.5 : 5 + Math.random() * 3.5;
          const destY = 41 + Math.random() * 18;
          b.fromX = sp.x;
          b.fromY = sp.y;
          b.toX = destX;
          b.toY = destY;
          b.curve = (sp.y < 50 ? 1 : -1) * 7.5;
          b.maxZ = 13.5;
          b.progress = 0;
          b.duration = 0.72;
          b.flightType = 'corner';
          b.carrierId = null;
          b.targetId = headerTarget.id;
          b.lastPasserId = taker.id;
          b.possessionSide = sp.side;
          w.phaseLabel = `🚩 ${taker.shortName} เปิดเตะมุมเข้ากลาง`;
          w.phaseTone = 'setpiece';
          SFX.kick();
        }
        return;
      }
      if (sp.type === 'penalty') {
        const taker =
          attPool
            .filter((a) => a.pos !== 'GK')
            .sort((u, v) => (v.d.fin + (v.d.comp || 60)) - (u.d.fin + (u.d.comp || 60)))[0] || attPool[0];
        if (!taker) return;
        const spotX = sp.side === 'H' ? 88.5 : 11.5;
        taker.x = spotX - dir * 1.8;
        taker.y = 50;
        b.fromX = spotX;
        b.fromY = 50;
        b.toX = sp.side === 'H' ? 99.6 : 0.4;
        b.toY = 43.2 + Math.random() * 13.6;
        b.curve = (Math.random() - 0.5) * 2;
        b.maxZ = 4.2;
        b.progress = 0;
        b.duration = 0.68;
        b.flightType = 'penalty';
        b.carrierId = null;
        b.targetId = null;
        b.shooterId = taker.id;
        b.lastPasserId = null;
        b.possessionSide = sp.side;
        w.phaseLabel = `🎯 ${taker.shortName} สังหารจุดโทษ!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 1.2, `🎯 ดวลจุดโทษ · ${taker.shortName}`);
        SFX.kick();
        pushLog(curMin, `🎯 ${taker.id} (${attTeam.name}) รับหน้าที่สังหารจุดโทษ!`);
        return;
      }
    }

    // 2. Open Play Decision from Carrier
    let side = b.possessionSide;
    let attPool = getTeamPool(side);
    const defSide = side === 'H' ? 'A' : 'H';
    let defPool = getTeamPool(defSide);
    let carrier = (b.carrierId ? attPool.find((a) => a.id === b.carrierId) : null) || attPool.find((a) => a.pos !== 'GK') || attPool[0];
    if (!carrier) return;

    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const defTeam = defSide === 'H' ? homeOrig : awayOrig;
    const attCfg = getEffectiveTeamCfg(side, curMin);
    const defCfg = getEffectiveTeamCfg(defSide, curMin);
    const dir = side === 'H' ? 1 : -1;
    const distToGoal = Math.hypot((side === 'H' ? 100 : 0) - carrier.x, 50 - carrier.y);

    // Check pressing duel / tackle / foul when defender is close!
    const nearestDef = defPool
      .filter((d) => d.pos !== 'GK')
      .sort((u, v) => Math.hypot(u.x - carrier.x, u.y - carrier.y) - Math.hypot(v.x - carrier.x, v.y - carrier.y))[0];
    const nearestDefDist = nearestDef ? Math.hypot(nearestDef.x - carrier.x, nearestDef.y - carrier.y) : 99;

    if (nearestDef && nearestDefDist < (defCfg.press === 2 ? 8.5 : 6.2) && carrier.pos !== 'GK') {
      const foulProb = clamp(
        0.065 + (defCfg.press === 2 ? 0.04 : 0) + (nearestDef.tr === 1 ? 0.045 : 0) + (isDerby ? 0.025 : 0) - (nearestDef.d.pos - 60) * 0.001,
        0.04,
        0.2
      );
      if (Math.random() < foulProb && curMin >= 2) {
        // FOUL + FREE KICK OR PENALTY (+ VAR Check)!
        if (defSide === 'H') w.foulsH++;
        else w.foulsA++;
        SFX.foul();

        const inBox = (side === 'H' ? carrier.x >= 83.5 : carrier.x <= 16.5) && Math.abs(carrier.y - 50) <= 21.5;
        const onBoxEdge = !inBox && (side === 'H' ? carrier.x >= 80.5 : carrier.x <= 19.5) && Math.abs(carrier.y - 50) <= 23;
        const shouldVarPen = (inBox && Math.random() < 0.42) || (onBoxEdge && Math.random() < 0.35);
        const isHardFoul = nearestDef.tr === 1 || distToGoal < 30 || Math.random() < 0.25;
        const shouldVarFoulCard = !shouldVarPen && w.varChecks < 2 && isHardFoul && Math.random() < 0.26;

        if (shouldVarPen && w.varChecks < 2) {
          w.varChecks++;
          const spotX = side === 'H' ? 88.5 : 11.5;
          const overturn = inBox ? Math.random() < 0.24 : Math.random() < 0.48;
          const willAwardPen = !overturn;
          w.varReview = {
            kind: 'penalty',
            side,
            waitSec: 3.5,
            totalSec: 3.5,
            x: willAwardPen ? spotX : carrier.x,
            y: willAwardPen ? 50 : carrier.y,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: !willAwardPen,
            distToGoal,
            reasonText: `เช็กจุดโทษ & ใบเหลือง/แดงของ ${nearestDef.shortName}`
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: '📺 VAR เช็กจุดโทษ!',
            color: '#38bdf8',
            ttl: 3.5,
            maxTtl: 3.5
          });
          triggerDramaSlow(w, 3.5, '📺 VAR เช็กจุดโทษ');
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          w.phaseLabel = `📺 VAR กำลังเช็กจังหวะฟาวล์ในเขตโทษ!`;
          w.phaseTone = 'setpiece';
          pushLog(curMin, `📺 ผู้ตัดสินขอเช็ก VAR จังหวะ ${nearestDef.id} (${defTeam.name}) สกัดใส่ ${carrier.id} ในกรอบเขตโทษ!`, 'sys');
          return;
        }

        if (shouldVarFoulCard) {
          w.varChecks++;
          const upgradeRed = Math.random() < (nearestDef.tr === 1 ? 0.48 : 0.36);
          w.varReview = {
            kind: 'foul_card',
            side,
            waitSec: 3.4,
            totalSec: 3.4,
            x: carrier.x,
            y: carrier.y,
            culpritId: nearestDef.id,
            culpritShort: nearestDef.shortName,
            culpritSide: defSide,
            overturn: upgradeRed,
            pendingCardUpgrade: upgradeRed ? 'R' : 'Y',
            distToGoal,
            reasonText: `เช็กจังหวะฟาวล์รุนแรงของ ${nearestDef.shortName} (ลุ้นใบแดง)`
          };
          addWorldFx(w, {
            type: 'var',
            x: carrier.x,
            y: carrier.y,
            label: '📺 VAR เช็กฟาวล์/ใบแดง!',
            color: '#f59e0b',
            ttl: 3.4,
            maxTtl: 3.4
          });
          triggerDramaSlow(w, 3.4, '📺 VAR เช็กใบแดง');
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          w.phaseLabel = `📺 VAR กำลังเช็กจังหวะฟาวล์รุนแรงของ ${nearestDef.shortName}!`;
          w.phaseTone = 'danger';
          pushLog(curMin, `📺 ผู้ตัดสินเดินไปดูจอ VAR เช็กจังหวะฟาวล์อันตรายของ ${nearestDef.id} (${defTeam.name})!`, 'sys');
          return;
        }

        const cardChance = clamp(0.16 + (nearestDef.tr === 1 ? 0.16 : 0) + (distToGoal < 30 ? 0.12 : 0) + (isDerby ? 0.06 : 0), 0.12, 0.48);
        let cardLbl = '⚠️ ฟาวล์!';
        let cardCol = '#f59e0b';
        let cardRes: 'Y' | 'R' | null = null;
        if (Math.random() < cardChance && simRef.current.cards.length < 7) {
          const r = issueCard(nearestDef, curMin);
          cardRes = r === 'Y' ? 'Y' : 'R';
          cardLbl = r === 'Y' ? `🟨 ใบเหลือง ${nearestDef.shortName}` : `🟥 ใบแดง ${nearestDef.shortName}!`;
          cardCol = r === 'Y' ? '#facc15' : '#ef4444';
        }

        if (inBox) {
          // Direct Penalty Kick!
          const spotX = side === 'H' ? 88.5 : 11.5;
          addWorldFx(w, {
            type: 'penalty',
            x: spotX,
            y: 50,
            label: `⚠️ จุดโทษ! (${attTeam.name})`,
            color: '#ef4444',
            ttl: 2.8,
            maxTtl: 2.8
          });
          triggerDramaSlow(w, 2.0, `🚨 จุดโทษ!! (${attTeam.name})`);
          b.carrierId = null;
          b.targetId = null;
          b.progress = 1;
          b.flightType = 'carry';
          w.pendingSetPiece = { type: 'penalty', side, x: spotX, y: 50, waitSec: 1.9 };
          w.phaseLabel = `🚨 จุดโทษ!! ${attTeam.name} ได้ลูกโทษที่จุด 11 เมตร!`;
          w.phaseTone = 'danger';
          pushLog(curMin, `🚨 จุดโทษ!! ${nearestDef.id} ทำฟาวล์ ${carrier.id} ในเขตโทษ · ${attTeam.name} ได้ยิงจุดโทษ!`, 'card');
          return;
        }

        if (side === 'H') w.freeKicksH++;
        else w.freeKicksA++;
        if (!cardRes) {
          pushLog(curMin, `⚠️ ${nearestDef.id} (${defTeam.name}) ทำฟาวล์ใส่ ${carrier.id} · ${attTeam.name} ได้ฟรีคิก`);
        }

        // Build defensive wall if in shooting/dangerous range
        const wallCount = distToGoal < 36 ? 3 : 0;
        const wallPlayers: { x: number; y: number }[] = [];
        if (wallCount > 0) {
          const gX = side === 'H' ? 100 : 0;
          const ang = Math.atan2(50 - carrier.y, gX - carrier.x);
          const wx = clamp(carrier.x + Math.cos(ang) * 9.5, 5, 95);
          const wy = clamp(carrier.y + Math.sin(ang) * 9.5, 10, 90);
          for (let k = 0; k < wallCount; k++) {
            const off = (k - (wallCount - 1) / 2) * 2.3;
            wallPlayers.push({ x: wx - Math.sin(ang) * off, y: wy + Math.cos(ang) * off });
          }
        }

        const fxTtl = cardRes === 'R' ? 3.2 : cardRes === 'Y' ? 2.4 : 1.9;
        addWorldFx(w, {
          type: 'foul',
          x: carrier.x,
          y: carrier.y,
          label: cardLbl,
          color: cardCol,
          ttl: fxTtl,
          maxTtl: fxTtl,
          wallPlayers
        });

        b.carrierId = null;
        b.targetId = null;
        b.progress = 1;
        b.flightType = 'carry';
        w.pendingSetPiece = {
          type: 'freekick',
          side,
          x: carrier.x,
          y: carrier.y,
          waitSec: cardRes === 'R' ? 1.85 : cardRes === 'Y' ? 1.35 : distToGoal < 36 ? 1.45 : 0.75,
          wallPlayers
        };
        w.phaseLabel = distToGoal < 36 ? `⚠️ ฟรีคิกระยะ ${Math.round(distToGoal * 0.9)} หลา!` : `⚠️ ฟาวล์ (${attTeam.name} ได้ฟรีคิก)`;
        w.phaseTone = cardRes === 'R' ? 'danger' : 'setpiece';
        return;
      }

      // Clean tackle / interception check
      const tackleProb = clamp(
        0.16 + (nearestDef.d.rd + nearestDef.d.pos - carrier.d.dr - 60) * 0.002 + (defCfg.press === 2 ? 0.05 : -0.02),
        0.09,
        0.34
      );
      if (Math.random() < tackleProb) {
        // Dispossessed cleanly! Flip possession
        b.possessionSide = defSide;
        b.carrierId = nearestDef.id;
        b.lastPasserId = null;
        b.targetId = null;
        b.x = nearestDef.x;
        b.y = nearestDef.y;
        b.fromX = nearestDef.x;
        b.fromY = nearestDef.y;
        b.toX = nearestDef.x;
        b.toY = nearestDef.y;
        b.progress = 1;
        b.flightType = 'carry';
        w.phaseLabel = `🛡️ ${nearestDef.shortName} แย่งบอลสำเร็จ!`;
        w.phaseTone = 'normal';
        SFX.pass();
        // Immediate counter-attack vertical pass if pass===3
        side = defSide;
        attPool = getTeamPool(side);
        defPool = getTeamPool(side === 'H' ? 'A' : 'H');
        carrier = nearestDef;
        if (getEffectiveTeamCfg(side, curMin).pass === 3 && Math.random() < 0.7) {
          const counterTarget = attPool.find((a) => a.pos === 'FW') || attPool.find((a) => a.role === 'SS' || a.role === 'CAM');
          if (counterTarget) {
            b.fromX = carrier.x;
            b.fromY = carrier.y;
            b.toX = clamp(counterTarget.x + (side === 'H' ? 6 : -6), 8, 92);
            b.toY = counterTarget.y;
            b.curve = (Math.random() - 0.5) * 4;
            b.maxZ = 7;
            b.progress = 0;
            b.duration = 0.52;
            b.flightType = 'through';
            b.carrierId = null;
            b.targetId = counterTarget.id;
            b.lastPasserId = carrier.id;
            w.phaseLabel = `⚡ ${defTeam.name} สวนกลับเร็ว!`;
            w.phaseTone = 'attack';
            SFX.kick();
            return;
          }
        }
      }
    }

    // 3. Should Carrier Shoot?
    const inShootZone = distToGoal < 26 || (distToGoal < 33 && (carrier.d.pw > 68 || attCfg.tac === 'X'));
    const shootChance = inShootZone
      ? clamp(0.28 + (32 - distToGoal) * 0.025 + (carrier.pos === 'FW' ? 0.14 : 0), 0.25, 0.72)
      : 0;
    if (carrier.pos !== 'GK' && Math.random() < shootChance) {
      const targetGoalX = side === 'H' ? 99.6 : 0.4;
      const targetGoalY = 42.5 + Math.random() * 15;
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = targetGoalX;
      b.toY = targetGoalY;
      b.curve = (carrier.d.cur > 65 ? 1 : 0.4) * (carrier.y < 50 ? 1 : -1) * (3 + Math.random() * 4);
      b.maxZ = 6 + Math.random() * 4;
      b.progress = 0;
      b.duration = clamp(distToGoal / 38, 0.52, 0.78);
      b.flightType = 'shot';
      b.carrierId = null;
      b.targetId = null;
      b.shooterId = carrier.id;
      w.phaseLabel = `🔥 ${carrier.shortName} ซัดด้วย${carrier.d.cur > carrier.d.pw + 4 ? 'ลูกปั่นโค้ง' : 'เต็มข้อ'}!`;
      w.phaseTone = 'danger';
      triggerDramaSlow(w, 0.95, `🔥 จังหวะยิง · ${carrier.shortName}`);
      SFX.kick();
      return;
    }

    // 4. Wing Cross?
    const inWingZone = (carrier.y < 23 || carrier.y > 77) && (side === 'H' ? carrier.x > 64 : carrier.x < 36);
    if (inWingZone && Math.random() < 0.62) {
      const boxRunners = attPool
        .filter((a) => a.id !== carrier.id && (a.pos === 'FW' || a.role === 'CAM' || a.role === 'CM'))
        .sort((u, v) => (side === 'H' ? v.x - u.x : u.x - v.x) + (v.d.hd + v.d.run) * 0.15);
      const target = boxRunners[0];
      if (target) {
        const boxX = clamp(side === 'H' ? 86 + Math.random() * 7 : 7 + Math.random() * 7, 6, 94);
        const boxY = clamp(39 + Math.random() * 22, 32, 68);
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = boxX;
        b.toY = boxY;
        b.curve = (carrier.y < 50 ? 1 : -1) * 7.5;
        b.maxZ = 14.5;
        b.progress = 0;
        b.duration = 0.62;
        b.flightType = 'cross';
        b.carrierId = null;
        b.targetId = target.id;
        b.lastPasserId = carrier.id;
        w.phaseLabel = `🪽 ${carrier.shortName} เปิดครอสเข้ากรอบ!`;
        w.phaseTone = 'attack';
        SFX.kick();
        return;
      }
    }

    // 5. Through-Ball onto an Off-Ball Run ("ทำทาง") with Real Offside Check!
    const forwardRunners = attPool
      .filter((a) => a.id !== carrier.id && (a.role === 'ST' || a.role === 'SS' || a.role === 'LW' || a.role === 'RW' || a.intent === 'MAKE_RUN' || a.intent === 'OVERLAP'))
      .filter((a) => (side === 'H' ? a.x > carrier.x - 4 : a.x < carrier.x + 4));

    const throughWeight = attCfg.pass === 3 ? 0.42 : attCfg.pass === 2 ? 0.34 : attCfg.pass === 1 ? 0.28 : 0.2;
    if (forwardRunners.length && (side === 'H' ? carrier.x > 36 : carrier.x < 64) && Math.random() < throughWeight) {
      const runner =
        forwardRunners.sort((u, v) => v.d.run + v.d.spd - (u.d.run + u.d.spd))[0] || P(forwardRunners);
      const defs = defPool.map((a) => a.x).sort((u, v) => (side === 'H' ? v - u : u - v));
      const oppLineX = defs[1] ?? (side === 'H' ? 80 : 20);

      // Real offside check! (High def line catches runners more often; high `run` attr beats the trap)
      const isAheadOfLine = side === 'H' ? runner.x > oppLineX + 0.6 : runner.x < oppLineX - 0.6;
      const trapEdge = defCfg.line === 2 ? 0.24 : defCfg.line === 1 ? 0.14 : 0.07;
      const offsideChance = isAheadOfLine ? 0.62 : clamp(trapEdge - (runner.d.run - 60) * 0.004, 0.03, 0.26);

      if (Math.random() < offsideChance && (side === 'H' ? oppLineX > 52 : oppLineX < 48)) {
        // Caught OFFSIDE!
        if (side === 'H') w.offsidesH++;
        else w.offsidesA++;
        const flagX = side === 'H' ? Math.max(runner.x, oppLineX + 1.5) : Math.min(runner.x, oppLineX - 1.5);
        b.fromX = carrier.x;
        b.fromY = carrier.y;
        b.toX = clamp(flagX, 6, 94);
        b.toY = runner.y;
        b.curve = (Math.random() - 0.5) * 3;
        b.maxZ = 4.5;
        b.progress = 0;
        b.duration = 0.44;
        b.flightType = 'through';
        b.carrierId = null;
        b.targetId = runner.id;
        b.lastPasserId = carrier.id;
        addWorldFx(w, {
          type: 'offside',
          x: clamp(flagX, 8, 92),
          y: runner.y,
          offsideX: oppLineX,
          label: `🚩 ล้ำหน้า (${runner.shortName})`,
          color: '#facc15',
          ttl: 2.3,
          maxTtl: 2.3
        });
        w.pendingSetPiece = {
          type: 'offside',
          side: defSide,
          x: clamp(oppLineX, 8, 92),
          y: runner.y,
          waitSec: 1.35
        };
        w.phaseLabel = `🚩 ล้ำหน้า! ${runner.shortName} วิ่งออกตัวเร็วไปนิด`;
        w.phaseTone = 'offside';
        SFX.foul();
        pushLog(curMin, `🚩 ล้ำหน้า! ${runner.id} (${attTeam.name}) วิ่งทะลุไลน์เร็วเกินจังหวะ`);
        return;
      }

      // Clean killer through-ball!
      const leadX = clamp(runner.x + dir * (9 + Math.random() * 6), 7, 93);
      const leadY = clamp(runner.y + (50 - runner.y) * 0.25, 10, 90);
      runner.tx = leadX;
      runner.ty = leadY;
      runner.intent = 'PASS_TARGET';
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = leadX;
      b.toY = leadY;
      b.curve = (Math.random() - 0.5) * 4;
      b.maxZ = 3.5;
      b.progress = 0;
      b.duration = 0.46;
      b.flightType = 'through';
      b.carrierId = null;
      b.targetId = runner.id;
      b.lastPasserId = carrier.id;
      w.phaseLabel = `👟 ${carrier.shortName} แทงทะลุช่องให้ ${runner.shortName}!`;
      w.phaseTone = 'attack';
      SFX.pass();
      return;
    }

    // 6. Dribble forward / cut inside
    const dribbleBias = carrier.pos === 'FW' || carrier.role === 'CAM' || carrier.role === 'CF' ? 0.36 : 0.22;
    if (carrier.pos !== 'GK' && Math.random() < dribbleBias) {
      const advX = clamp(carrier.x + dir * (6 + Math.random() * 8), 8, 92);
      const advY = clamp(carrier.y + (50 - carrier.y) * 0.22 + (Math.random() - 0.5) * 14, 8, 92);
      carrier.tx = advX;
      carrier.ty = advY;
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = advX;
      b.toY = advY;
      b.curve = 0;
      b.maxZ = 0;
      b.progress = 0;
      b.duration = attCfg.tempo === 2 ? 0.36 : attCfg.tempo === 0 ? 0.56 : 0.45;
      b.flightType = 'carry';
      b.carrierId = carrier.id;
      b.targetId = null;
      w.phaseLabel = `⚡ ${carrier.shortName} พาบอลลุยขึ้นหน้า`;
      w.phaseTone = side === 'H' ? (carrier.x > 65 ? 'attack' : 'normal') : carrier.x < 35 ? 'attack' : 'normal';
      return;
    }

    // 7. Ground Pass / Triangle / Switch of Play
    const passCandidates = attPool.filter((a) => a.id !== carrier.id && (a.pos !== 'GK' || (side === 'H' ? carrier.x < 32 : carrier.x > 68)));
    if (passCandidates.length) {
      const scored = passCandidates.map((cand) => {
        const dist = Math.hypot(cand.x - carrier.x, cand.y - carrier.y);
        const prog = (cand.x - carrier.x) * dir;
        let wgt = 10;
        if (attCfg.pass === 0) {
          // Tiki-taka short triangles
          wgt += dist < 24 ? 26 : -dist * 0.5;
          if (cand.role === 'CF' || cand.role === 'CM' || cand.role === 'CAM') wgt += 10;
        } else if (attCfg.pass === 2) {
          // Direct / wing switch
          wgt += prog > 12 ? 22 : 0;
          if (Math.abs(cand.y - carrier.y) > 25) wgt += 12;
        } else if (attCfg.pass === 3) {
          // Counter forward
          wgt += prog > 8 ? 25 : -10;
        } else {
          // Mixed
          wgt += prog > 0 ? 14 : 4;
          wgt -= Math.abs(dist - 20) * 0.4;
        }
        // Check if defender is right in the lane
        const blocked = defPool.some((d) => Math.hypot(d.x - cand.x, d.y - cand.y) < 4.5);
        if (blocked) wgt -= 12;
        return { cand, wgt: Math.max(1, wgt) };
      });
      const pool = scored.flatMap((s) => Array(Math.round(s.wgt)).fill(s.cand));
      const receiver = P(pool) || passCandidates[0];
      const dist = Math.hypot(receiver.x - carrier.x, receiver.y - carrier.y);
      b.fromX = carrier.x;
      b.fromY = carrier.y;
      b.toX = clamp(receiver.x + dir * 2, 5, 95);
      b.toY = receiver.y;
      b.curve = dist > 26 ? (Math.random() - 0.5) * 5 : 0;
      b.maxZ = dist > 28 ? 8 : 0;
      b.progress = 0;
      b.duration = clamp(dist / (attCfg.tempo === 2 ? 78 : 58), 0.28, 0.58);
      b.flightType = 'pass';
      b.carrierId = null;
      b.targetId = receiver.id;
      b.lastPasserId = carrier.id;
      w.phaseLabel =
        dist > 28
          ? `↗️ ${carrier.shortName} วางบอลเปลี่ยนแกนให้ ${receiver.shortName}`
          : `⚽ ${carrier.shortName} เคาะบอลให้ ${receiver.shortName}`;
      w.phaseTone = 'normal';
      SFX.pass();
    }
  };

  const awardGoalToTeam = (
    w: LiveMatchWorld,
    side: 'H' | 'A',
    curMin: number,
    scorerName: string,
    scorerShort: string,
    assisterName: string,
    finishVerb: string,
    goalX: number,
    goalY: number
  ) => {
    const sr = simRef.current;
    const defSide = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    if (side === 'H') {
      sr.gh++;
      setGh(sr.gh);
      w.goalNetRippleH = 1.0;
    } else {
      sr.ga++;
      setGa(sr.ga);
      w.goalNetRippleA = 1.0;
    }
    const newEv: MatchEvent = { m: curMin, t: attTeam.id, who: scorerName, as: assisterName };
    sr.evs.push(newEv);
    setEvs(sr.evs.slice());

    adjustLiveForm(scorerName, 0.95);
    if (assisterName) adjustLiveForm(assisterName, 0.55);
    const concLu = defSide === 'H' ? sr.homeLu : sr.awayLu;
    const concTeam = defSide === 'H' ? homeOrig : awayOrig;
    concLu.forEach((dn) => {
      if (sr.sentOff.includes(dn)) return;
      const dPl = concTeam.sq.find((q) => q.n === dn);
      if (dPl?.pos === 'GK') adjustLiveForm(dn, -0.22);
      else if (dPl?.pos === 'DF') adjustLiveForm(dn, -0.12);
    });

    pushLog(
      curMin,
      `⚽ ประตู!! ${scorerName} (${attTeam.name}) ${finishVerb}${assisterName ? ` · แอสซิสต์ ${assisterName}` : ''}`,
      'goal'
    );
    addWorldFx(w, {
      type: 'goal',
      x: goalX,
      y: goalY,
      label: `⚽ GOAL!! ${scorerShort}`,
      color: '#22c55e',
      ttl: 3.4,
      maxTtl: 3.4,
      goalSide: side
    });
    if (lastSoundMinRef.current !== curMin) {
      lastSoundMinRef.current = curMin;
      SFX.goal();
      vibrate([50, 40, 80]);
    }
    const isMyTeamGoal = (side === 'H') === meIsHome;
    const isMeScorer = isPlayerMode && scorerName === myPlayerName;
    const scoringKit = side === 'H' ? homeKit : awayKit;
    const sparkCols = [scoringKit, '#facc15', '#ffffff', '#4ade80'];
    for (let i = 0; i < 22; i++) {
      const ang = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.4;
      const spd = 8 + Math.random() * 18;
      w.sparkles.push({
        x: goalX,
        y: goalY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: sparkCols[i % sparkCols.length],
        size: 1.8 + Math.random() * 2.2,
        ttl: 1.8 + Math.random() * 0.6,
        maxTtl: 2.4
      });
    }
    w.goalBanner = {
      scorer: scorerShort,
      teamName: attTeam.name,
      assister: assisterName || undefined,
      side,
      kit: scoringKit,
      isMyGoal: isMyTeamGoal,
      isMeScorer,
      ttl: 4.2,
      maxTtl: 4.2
    };
    setGoalFlashSide(side);
    if (goalFlashTimerRef.current) window.clearTimeout(goalFlashTimerRef.current);
    goalFlashTimerRef.current = window.setTimeout(() => setGoalFlashSide(null), 3200);
    if (isMeScorer) {
      triggerConfetti();
    }
    w.celebrateTimer = 2.8;
    triggerDramaSlow(w, 2.5, `⚽ GOAL!! ${scorerShort} (${attTeam.name})`);
    w.pendingSetPiece = { type: 'kickoff', side: defSide, x: 50, y: 50, waitSec: 2.8 };
    w.phaseLabel = `⚽ ประตู!! ${scorerName} ยิงให้ ${attTeam.name}!`;
    w.phaseTone = 'goal';
  };

  const resolveVarReview = (w: LiveMatchWorld, curMin: number) => {
    const vr = w.varReview;
    if (!vr) return;
    w.varReview = null;
    const attTeam = vr.side === 'H' ? homeOrig : awayOrig;
    const defSide = vr.side === 'H' ? 'A' : 'H';

    if (vr.kind === 'goal') {
      if (vr.overturn) {
        // Disallowed by VAR!
        SFX.foul();
        if (vr.side === 'H') w.offsidesH++;
        else w.offsidesA++;
        const offX = vr.side === 'H' ? 84 : 16;
        addWorldFx(w, {
          type: 'offside',
          x: offX,
          y: vr.y,
          offsideX: offX,
          label: `📺❌ VAR ริบประตู!`,
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4
        });
        triggerDramaSlow(w, 2.2, `📺❌ VAR ริบประตู!`);
        w.pendingSetPiece = { type: 'offside', side: defSide, x: offX, y: 50, waitSec: 2.1 };
        w.phaseLabel = `📺❌ VAR ริบประตูของ ${vr.shooterShort || attTeam.name}!`;
        w.phaseTone = 'offside';
        pushLog(curMin, `📺❌ VAR ริบประตู!! พบจังหวะล้ำหน้าก่อนยิงของ ${vr.shooterId || attTeam.name} สกอร์ยังคงเดิม`, 'card');
      } else {
        // Goal stands!
        addWorldFx(w, {
          type: 'var',
          x: 50,
          y: 22,
          label: '📺✅ VAR ยืนยันให้ประตู!',
          color: '#22c55e',
          ttl: 3.0,
          maxTtl: 3.0
        });
        pushLog(curMin, `📺✅ VAR ยืนยัน: ไม่มีการล้ำหน้า — ให้เป็นประตูของ ${attTeam.name}!`, 'goal');
        awardGoalToTeam(
          w,
          vr.side,
          curMin,
          vr.shooterId || 'นักเตะ',
          vr.shooterShort || 'นักเตะ',
          vr.assisterName || '',
          vr.finishVerb || 'ส่งบอลตุงตาข่าย!',
          vr.x,
          vr.y
        );
      }
      return;
    }

    // Foul / Red Card VAR Check
    if (vr.kind === 'foul_card') {
      const defTeam = vr.culpritSide === 'H' ? homeOrig : awayOrig;
      const culprit = vr.culpritId ? w.agents.find((a) => a.id === vr.culpritId && !a.sentOff) : undefined;
      if (vr.side === 'H') w.freeKicksH++;
      else w.freeKicksA++;
      const dGoal = vr.distToGoal ?? 28;
      const wallCount = dGoal < 36 ? 3 : 0;
      const wallPlayers: { x: number; y: number }[] = [];
      if (wallCount > 0) {
        const gX = vr.side === 'H' ? 100 : 0;
        const ang = Math.atan2(50 - vr.y, gX - vr.x);
        const wx = clamp(vr.x + Math.cos(ang) * 9.5, 5, 95);
        const wy = clamp(vr.y + Math.sin(ang) * 9.5, 10, 90);
        for (let k = 0; k < wallCount; k++) {
          const off = (k - (wallCount - 1) / 2) * 2.3;
          wallPlayers.push({ x: wx - Math.sin(ang) * off, y: wy + Math.cos(ang) * off });
        }
      }
      if (vr.pendingCardUpgrade === 'R' && culprit) {
        SFX.whistle();
        issueCard(culprit, curMin, 1, 'R');
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: `📺🟥 VAR ใบแดง! ${vr.culpritShort || ''}`,
          color: '#ef4444',
          ttl: 3.4,
          maxTtl: 3.4,
          wallPlayers
        });
        triggerDramaSlow(w, 2.5, `📺🟥 VAR ใบแดง!! ${vr.culpritShort || ''}`);
        w.phaseLabel = `📺🟥 VAR ยกระดับเป็นใบแดง! ${vr.culpritShort || ''} โดนไล่ออก`;
        w.phaseTone = 'danger';
        pushLog(curMin, `📺🟥 VAR ยกระดับเป็นใบแดงโดยตรง!! ${culprit.id} (${defTeam.name}) เสียบสกัดอันตราย โดนไล่ออก!`, 'card');
      } else {
        SFX.foul();
        const issued = culprit ? issueCard(culprit, curMin, 0, 'Y') : 'Y';
        const isSecondRed = issued === 'Y2R' || issued === 'R';
        addWorldFx(w, {
          type: 'foul',
          x: vr.x,
          y: vr.y,
          label: isSecondRed ? `📺🟨🟥 เหลืองแดง! ${vr.culpritShort || ''}` : `📺🟨 VAR ใบเหลือง ${vr.culpritShort || ''}`,
          color: isSecondRed ? '#ef4444' : '#facc15',
          ttl: 3.0,
          maxTtl: 3.0,
          wallPlayers
        });
        triggerDramaSlow(w, isSecondRed ? 2.4 : 1.7, isSecondRed ? `📺🟨🟥 เหลืองแดง!!` : `📺🟨 VAR ใบเหลือง`);
        w.phaseLabel = isSecondRed
          ? `📺🟨🟥 VAR เหลืองที่สอง! ${vr.culpritShort || ''} โดนไล่ออก`
          : `📺🟨 VAR ให้ใบเหลือง ${vr.culpritShort || ''} · ฟรีคิก`;
        w.phaseTone = isSecondRed ? 'danger' : 'setpiece';
        pushLog(
          curMin,
          isSecondRed
            ? `📺🟨🟥 VAR ให้ใบเหลืองที่สองไล่ออก ${vr.culpritId || ''} (${defTeam.name})!`
            : `📺🟨 VAR ให้ใบเหลืองแก่ ${vr.culpritId || ''} (${defTeam.name}) รอดพ้นใบแดงหวุดหวิด`,
          'card'
        );
      }
      w.pendingSetPiece = {
        type: 'freekick',
        side: vr.side,
        x: vr.x,
        y: vr.y,
        waitSec: wallCount > 0 ? 1.8 : 1.4,
        wallPlayers
      };
      return;
    }

    // Penalty VAR Check (+ Card Verdict!)
    const culprit = vr.culpritId ? w.agents.find((a) => a.id === vr.culpritId && !a.sentOff) : undefined;
    if (vr.overturn) {
      SFX.pass();
      if (vr.side === 'H') w.freeKicksH++;
      else w.freeKicksA++;
      const edgeX = vr.side === 'H' ? 80.5 : 19.5;
      let fkCardTxt = '';
      if (culprit && Math.random() < 0.45 && simRef.current.cards.length < 7) {
        const res = issueCard(culprit, curMin, 0, 'Y');
        fkCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 ใบแดง';
      }
      addWorldFx(w, {
        type: 'var',
        x: edgeX,
        y: vr.y,
        label: `📺 VAR: ฟาวล์นอกเขต${fkCardTxt}`,
        color: '#38bdf8',
        ttl: 3.0,
        maxTtl: 3.0
      });
      triggerDramaSlow(w, 1.8, `📺 VAR ฟาวล์นอกเขต${fkCardTxt}`);
      w.pendingSetPiece = { type: 'freekick', side: vr.side, x: edgeX, y: vr.y, waitSec: 1.65 };
      w.phaseLabel = `📺 VAR ชี้ฟาวล์นอกเขต${fkCardTxt} (${attTeam.name})`;
      w.phaseTone = 'setpiece';
      pushLog(curMin, `📺 VAR ยืนยัน: จุดปะทะอยู่นอกกรอบเขตโทษ — ${attTeam.name} ได้ฟรีคิก${fkCardTxt}`, fkCardTxt ? 'card' : 'sys');
    } else {
      SFX.foul();
      const spotX = vr.side === 'H' ? 88.5 : 11.5;
      let penCardTxt = '';
      if (culprit && simRef.current.cards.length < 7) {
        const roll = Math.random();
        if (roll < (culprit.tr === 1 ? 0.24 : 0.14)) {
          issueCard(culprit, curMin, 1, 'R');
          penCardTxt = ' + 🟥 ใบแดง!';
        } else if (roll < 0.68) {
          const res = issueCard(culprit, curMin, 0, 'Y');
          penCardTxt = res === 'Y' ? ' + 🟨 ใบเหลือง' : ' + 🟥 เหลืองแดง!';
        }
      }
      addWorldFx(w, {
        type: 'penalty',
        x: spotX,
        y: 50,
        label: `📺✅ VAR จุดโทษ!${penCardTxt}`,
        color: '#ef4444',
        ttl: 3.2,
        maxTtl: 3.2
      });
      triggerDramaSlow(w, 2.2, `📺🚨 VAR จุดโทษ!!${penCardTxt}`);
      w.pendingSetPiece = { type: 'penalty', side: vr.side, x: spotX, y: 50, waitSec: 2.0 };
      w.phaseLabel = `📺🚨 VAR ให้จุดโทษ${penCardTxt} (${attTeam.name})!`;
      w.phaseTone = 'danger';
      pushLog(curMin, `📺🚨 VAR ชี้จุดโทษ!! ${attTeam.name} ได้ลูกจุดโทษหลังเช็กภาพช้า${penCardTxt}!`, 'card');
    }
  };

  // Resolve ball arrival at destination (pass, cross, through-ball, shot, corner, freekick, penalty, shootout)
  const resolveSegmentArrival = (w: LiveMatchWorld, curMin: number) => {
    const b = w.ball;
    const sr = simRef.current;
    const side = b.possessionSide;
    const defSide = side === 'H' ? 'A' : 'H';
    const attTeam = side === 'H' ? homeOrig : awayOrig;
    const defTeam = defSide === 'H' ? homeOrig : awayOrig;
    const active = w.agents.filter((a) => !a.sentOff);
    const attPool = active.filter((a) => a.side === side);
    const defPool = active.filter((a) => a.side === defSide);

    if (w.pendingSetPiece) return;

    // 0. Resolve Live Cup/Asia Penalty Shootout Kick
    if (b.flightType === 'shootout_kick' && w.shootout) {
      const sh = w.shootout;
      const kicker = active.find((a) => a.id === sh.kickerName);
      const gk = active.find((a) => a.side !== sh.turn && a.pos === 'GK');
      const kickScore = kicker ? kicker.d.fin * 0.5 + (kicker.d.comp || 62) * 0.5 : 64;
      const gkScore = gk ? gk.d.sv * 0.58 + gk.d.cl * 0.42 : 60;
      const scored = Math.random() < clamp(0.75 + (kickScore - gkScore) * 0.0045, 0.56, 0.88);
      if (scored) {
        if (sh.turn === 'H') {
          sh.hKicks.push('G');
          sh.hScore++;
          w.goalNetRippleH = 1.0;
        } else {
          sh.aKicks.push('G');
          sh.aScore++;
          w.goalNetRippleH = 1.0;
        }
        SFX.goal();
        sh.lastMsg = `⚽ ${kicker?.shortName || sh.kickerName} ยิงเข้า! (${sh.hScore}-${sh.aScore})`;
        addWorldFx(w, { type: 'goal', x: 99, y: b.toY, label: `⚽ เข้า! ${kicker?.shortName || ''}`, color: '#22c55e', ttl: 2.2, maxTtl: 2.2 });
        triggerDramaSlow(w, 1.4, `⚽ ยิงเข้า! ${kicker?.shortName || ''}`);
      } else {
        if (sh.turn === 'H') sh.hKicks.push('M');
        else sh.aKicks.push('M');
        SFX.whistle();
        sh.lastMsg = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} เซฟ/หลุดกรอบ! (${sh.hScore}-${sh.aScore})`;
        addWorldFx(w, { type: 'save', x: 97.5, y: 50, label: `🧤 พลาด!`, color: '#ef4444', ttl: 2.2, maxTtl: 2.2 });
        triggerDramaSlow(w, 1.4, `🧤 เซฟ/พลาด! ${gk?.shortName || ''}`);
      }
      sh.activeShot = false;

      // Check if shootout is mathematically decided
      const hRem = Math.max(0, 5 - sh.hKicks.length);
      const aRem = Math.max(0, 5 - sh.aKicks.length);
      const bothSameCount = sh.hKicks.length === sh.aKicks.length;
      const clinchedEarly =
        sh.hKicks.length <= 5 &&
        sh.aKicks.length <= 5 &&
        (sh.hScore > sh.aScore + aRem || sh.aScore > sh.hScore + hRem);
      const suddenDeathWin = sh.hKicks.length >= 5 && bothSameCount && sh.hScore !== sh.aScore;

      if (clinchedEarly || suddenDeathWin) {
        sh.finished = true;
        const winnerHome = sh.hScore > sh.aScore;
        const text = `ดวลจุดโทษ: ${homeOrig.name} ${sh.hScore}-${sh.aScore} ${awayOrig.name}`;
        setPenResult({ winnerHome, text });
        setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
        pushLog(90, `🎯 ${text}`, 'sys');
        finalizeMatch(winnerHome, text);
        return;
      }

      // Advance turn to next kicker
      sh.turn = sh.turn === 'H' ? 'A' : 'H';
      if (sh.turn === 'H') sh.round++;
      const nextPool = active.filter((a) => a.side === sh.turn && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin);
      const nextIdx = (sh.turn === 'H' ? sh.hKicks.length : sh.aKicks.length) % Math.max(1, nextPool.length);
      const nextGk = active.find((a) => a.side !== sh.turn && a.pos === 'GK');
      sh.kickerName = nextPool[nextIdx]?.id || nextPool[0]?.id || 'นักเตะ';
      sh.gkName = nextGk?.id || 'ผู้รักษาประตู';
      sh.waitSec = 1.75;
      b.x = 88.5;
      b.y = 50;
      b.z = 0;
      b.trail = [];
      setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
      return;
    }

    // 1. Resolve Shot, Penalty Kick, or Direct Free Kick
    if (b.flightType === 'shot' || b.flightType === 'freekick' || b.flightType === 'penalty') {
      const shooter = active.find((a) => a.id === b.shooterId) || attPool.find((a) => a.pos === 'FW') || attPool[0];
      const gk = defPool.find((a) => a.pos === 'GK') || defPool[0];
      const defenders = defPool.filter((a) => a.pos === 'DF' || a.pos === 'MF');
      const dist = Math.hypot(b.fromX - b.toX, b.fromY - b.toY);

      // Defender block / Free-kick wall deflection check (skip for Penalty Kick!)
      if (b.flightType !== 'penalty') {
        const wallDef = b.flightType === 'freekick' ? defenders.find((d) => d.intent === 'WALL') || defenders[0] : undefined;
        const nearDef =
          wallDef ||
          defenders.find((d) => Math.hypot(d.x - (b.fromX + b.toX) * 0.5, d.y - (b.fromY + b.toY) * 0.5) < 9);
        const blockChance = nearDef
          ? b.flightType === 'freekick'
            ? clamp(0.24 - ((shooter?.d.cur || 60) - 60) * 0.0025, 0.12, 0.3)
            : clamp(0.11 + (nearDef.d.blk - 60) * 0.004, 0.06, 0.25)
          : 0;
        if (nearDef && Math.random() < blockChance) {
          if (defSide === 'H') w.blocksH++;
          else w.blocksA++;
          adjustLiveForm(nearDef.id, 0.2);
          adjustLiveForm(shooter?.id, -0.08);
          addWorldFx(w, {
            type: 'block',
            x: nearDef.x,
            y: nearDef.y,
            label: b.flightType === 'freekick' ? `🧱 ติดกำแพง (${nearDef.shortName})` : `🛡️ ${nearDef.shortName} บล็อก!`,
            color: '#60a5fa',
            ttl: 2.0,
            maxTtl: 2.0
          });
          if (Math.random() < 0.48) {
            pushLog(
              curMin,
              b.flightType === 'freekick'
                ? `🧱 ฟรีคิกของ ${shooter?.id || 'คู่แข่ง'} พุ่งไปติดกำแพงของ ${defTeam.name}!`
                : `🛡️ ${nearDef.id} พุ่งสไลด์บล็อกลูกยิงของ ${shooter?.id || 'คู่แข่ง'} ได้ทัน!`
            );
          }
          if (Math.random() < 0.45) {
            if (side === 'H') w.cornersH++;
            else w.cornersA++;
            const cy = b.y < 50 ? 2 : 98;
            const cx = side === 'H' ? 98.5 : 1.5;
            b.carrierId = null;
            w.pendingSetPiece = { type: 'corner', side, x: cx, y: cy, waitSec: 1.0 };
            w.phaseLabel = `🚩 บอลแฉลบออกหลัง · ${attTeam.name} ได้เตะมุม!`;
            w.phaseTone = 'setpiece';
          } else {
            b.possessionSide = defSide;
            b.carrierId = nearDef.id;
            b.flightType = 'carry';
            w.phaseLabel = `🛡️ ${nearDef.shortName} บล็อกและเก็บบอลได้`;
            w.phaseTone = 'normal';
          }
          return;
        }
      }

      // Shot registered!
      const shotXg =
        b.flightType === 'penalty'
          ? 0.78
          : clamp(0.05 + (32 - dist) * 0.011 + ((shooter?.d.fin || 60) - 60) * 0.002, 0.04, 0.42);
      if (side === 'H') {
        w.shotsH++;
        w.xgH = Math.round((w.xgH + shotXg) * 100) / 100;
      } else {
        w.shotsA++;
        w.xgA = Math.round((w.xgA + shotXg) * 100) / 100;
      }

      // Animate GK diving!
      if (gk) {
        gk.intent = 'DIVE';
        gk.intentTimer = 0.95;
        gk.diveDir = b.toY >= gk.y ? 1 : -1;
        gk.diveProgress = 0.01;
      }

      // Off-target / Woodwork / On-target resolution
      const hR = rate(getLiveHomeTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
      const aR = rate(getLiveAwayTeam(), state, kind !== 'league' || isDerby, curMin, sr.subs.map((s) => s.inPlayer), sr.sentOff);
      const edge = side === 'H' ? (hR.at - aR.df) : (aR.at - hR.df);

      const accuracy =
        b.flightType === 'penalty'
          ? 0.91
          : clamp(0.46 + ((shooter?.d.fin || 60) - 60) * 0.004 - Math.max(0, dist - 22) * 0.008, 0.25, 0.68);
      if (Math.random() > accuracy) {
        adjustLiveForm(shooter?.id, -0.12);
        const hitWoodwork = Math.random() < (b.flightType === 'penalty' ? 0.35 : 0.16);
        if (hitWoodwork) {
          addWorldFx(w, {
            type: 'woodwork',
            x: b.toX,
            y: b.toY,
            label: '🧱 ชนเสา/คาน!',
            color: '#f59e0b',
            ttl: 2.6,
            maxTtl: 2.6
          });
          triggerDramaSlow(w, 1.5, `🧱 ชนเสา/คาน! · ${shooter?.shortName || ''}`);
          pushLog(curMin, `🧱 โอ้โห! ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ซัดบอลพุ่งชนคานอย่างจัง!`);
        } else if (b.flightType === 'penalty' || Math.random() < 0.45) {
          pushLog(curMin, `😮 ${shooter?.id || 'กองหน้า'} (${attTeam.name}) ยิงหลุดกรอบออกหลังไปอย่างน่าเสียดาย`);
        }
        w.pendingSetPiece = {
          type: 'goalkick',
          side: defSide,
          x: defSide === 'H' ? 5.5 : 94.5,
          y: 50,
          waitSec: hitWoodwork || b.flightType === 'penalty' ? 1.45 : 0.75
        };
        w.phaseLabel = hitWoodwork ? `🧱 ชนเสา/คานอย่างจัง! หวุดหวิดเป็นประตู` : `😮 ยิงหลุดกรอบ · ตั้งเตะจากประตู`;
        w.phaseTone = hitWoodwork ? 'danger' : 'normal';
        return;
      }

      // On target!
      if (side === 'H') w.onTargetH++;
      else w.onTargetA++;

      const gkSaveScore = gk ? gk.d.sv * 0.55 + gk.d.cl * 0.45 : 58;
      const shooterScore = shooter ? shooter.d.fin * 0.5 + shooter.d.cur * 0.25 + shooter.d.pw * 0.25 : 60;
      const goalProb =
        b.flightType === 'penalty'
          ? clamp(0.79 + (shooterScore - gkSaveScore) * 0.004, 0.65, 0.9)
          : clamp(0.27 + edge * 0.0065 + (shooterScore - gkSaveScore) * 0.004 + (b.flightType === 'freekick' ? 0.03 : 0), 0.14, 0.54);

      if (Math.random() < goalProb) {
        const scorerName = shooter?.id || attPool[0]?.id || 'นักเตะ';
        const scorerShort = shooter?.shortName || scorerName;
        const assisterName =
          b.flightType !== 'penalty' && b.lastPasserId && b.lastPasserId !== scorerName && Math.random() < 0.85 ? b.lastPasserId : '';
        const finishVerb =
          b.flightType === 'penalty'
            ? 'สังหารจุดโทษไม่พลาดเป้า!'
            : b.flightType === 'freekick'
              ? 'ปั่นฟรีคิกเสียบสามเหลี่ยมสุดสวย!'
              : shooter && shooter.d.cur >= shooter.d.pw + 6
                ? 'ปั่นโค้งเสียบเสาอย่างเหนือชั้น!'
                : shooter && shooter.d.pw >= shooter.d.fin + 6
                  ? 'ซัดเต็มข้อบอลพุ่งเสียบตาข่าย!'
                  : 'จบสกอร์ตุงตาข่ายอย่างเฉียบขาด!';

        // Tight-call VAR Goal Check (~16% chance on open-play goals)
        if (b.flightType === 'shot' && w.varChecks < 2 && Math.random() < 0.16) {
          w.varChecks++;
          const overturn = Math.random() < 0.34;
          w.varReview = {
            kind: 'goal',
            side,
            waitSec: 3.6,
            totalSec: 3.6,
            shooterId: scorerName,
            shooterShort: scorerShort,
            assisterName,
            finishVerb,
            x: b.toX,
            y: b.toY,
            overturn,
            reasonText: `กำลังตีเส้นเช็กจังหวะล้ำหน้าของ ${scorerShort}`
          };
          addWorldFx(w, {
            type: 'var',
            x: b.toX,
            y: b.toY,
            label: '📺 VAR เช็กประตู!',
            color: '#38bdf8',
            ttl: 3.6,
            maxTtl: 3.6
          });
          triggerDramaSlow(w, 3.6, `📺 VAR เช็กประตู · ${scorerShort}`);
          w.phaseLabel = `📺 VAR กำลังตรวจสอบประตูของ ${attTeam.name}!`;
          w.phaseTone = 'setpiece';
          pushLog(curMin, `📺 บอลตุงตาข่ายแล้ว แต่ VAR เรียกเช็กจังหวะล้ำหน้าของ ${scorerName}!`, 'sys');
          return;
        }

        awardGoalToTeam(w, side, curMin, scorerName, scorerShort, assisterName, finishVerb, b.toX, b.toY);
      } else {
        // SUPER SAVE by GK!
        if (defSide === 'H') w.savesH++;
        else w.savesA++;
        adjustLiveForm(gk?.id, 0.25);
        adjustLiveForm(shooter?.id, -0.06);
        addWorldFx(w, {
          type: 'save',
          x: gk?.x ?? (defSide === 'H' ? 4 : 96),
          y: gk?.y ?? 50,
          label: `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} เซฟ!`,
          color: '#38bdf8',
          ttl: 2.5,
          maxTtl: 2.5
        });
        triggerDramaSlow(w, b.flightType === 'penalty' ? 1.85 : 1.35, `🧤 ซูเปอร์เซฟ! · ${gk?.shortName || 'ผู้รักษาประตู'}`);
        if (b.flightType === 'penalty' || Math.random() < 0.65) {
          pushLog(
            curMin,
            b.flightType === 'penalty'
              ? `🧤 ซูเปอร์เซฟ!! ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) พุ่งปัดจุดโทษของ ${shooter?.id || 'คู่แข่ง'} ไว้ได้อย่างเหลือเชื่อ!`
              : `🧤 ${gk?.id || 'ผู้รักษาประตู'} (${defTeam.name}) พุ่งปัดลูกยิงของ ${shooter?.id || 'คู่แข่ง'} ไว้ได้หวุดหวิด!`
          );
        }
        if (Math.random() < 0.45) {
          if (side === 'H') w.cornersH++;
          else w.cornersA++;
          const cy = b.toY < 50 ? 2 : 98;
          const cx = side === 'H' ? 98.5 : 1.5;
          w.pendingSetPiece = { type: 'corner', side, x: cx, y: cy, waitSec: 1.25 };
          w.phaseLabel = `🧤 ปัดออกหลัง! ${attTeam.name} ได้เตะมุม`;
          w.phaseTone = 'setpiece';
        } else {
          b.possessionSide = defSide;
          b.carrierId = gk?.id || null;
          b.flightType = 'carry';
          w.phaseLabel = `🧤 ${gk?.shortName || 'ผู้รักษาประตู'} รับบอลไว้ได้`;
          w.phaseTone = 'normal';
        }
      }
      return;
    }

    // 2. Resolve Cross or Corner Delivery in the Box
    if (b.flightType === 'cross' || b.flightType === 'corner') {
      const target = active.find((a) => a.id === b.targetId) || attPool.find((a) => a.pos === 'FW') || attPool[0];
      const topDef = defPool
        .filter((d) => d.pos === 'DF' || d.pos === 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];

      const attAir = target ? target.d.hd * 0.65 + target.d.run * 0.35 : 58;
      const defAir = topDef ? (topDef.pos === 'GK' ? topDef.d.cl * 0.7 + topDef.d.sv * 0.3 : topDef.d.hd * 0.6 + topDef.d.pos * 0.4) : 60;
      const winHeaderProb = clamp(0.45 + (attAir - defAir) * 0.007, 0.24, 0.72);

      if (target && Math.random() < winHeaderProb) {
        // Attacker wins the header/volley -> immediate shot!
        const goalX = side === 'H' ? 99.6 : 0.4;
        const goalY = 43 + Math.random() * 14;
        b.fromX = b.toX;
        b.fromY = b.toY;
        b.toX = goalX;
        b.toY = goalY;
        b.curve = 0;
        b.maxZ = 4.5;
        b.progress = 0;
        b.duration = 0.52;
        b.flightType = 'shot';
        b.carrierId = null;
        b.targetId = null;
        b.shooterId = target.id;
        w.phaseLabel = `🗣️ ${target.shortName} เทกตัวโหม่งเต็มๆ!`;
        w.phaseTone = 'danger';
        triggerDramaSlow(w, 0.95, `🗣️ โหม่งลุ้นประตู · ${target.shortName}`);
        SFX.kick();
      } else if (topDef) {
        // Defender or GK clears/punches!
        b.possessionSide = defSide;
        b.carrierId = topDef.id;
        b.lastPasserId = null;
        b.targetId = null;
        b.x = topDef.x;
        b.y = topDef.y;
        b.flightType = 'carry';
        w.phaseLabel = `🛡️ ${topDef.shortName} โหม่งสกัดบอลพ้นอันตราย`;
        w.phaseTone = 'normal';
      }
      return;
    }

    // 3. Resolve Ground Pass / Through-Ball / Carry
    if (b.flightType === 'pass' || b.flightType === 'through' || b.flightType === 'goalkick') {
      if (side === 'H') w.passesH++;
      else w.passesA++;
      const receiver = active.find((a) => a.id === b.targetId);
      const nearestOpp = defPool
        .filter((d) => d.pos !== 'GK')
        .sort((u, v) => Math.hypot(u.x - b.toX, u.y - b.toY) - Math.hypot(v.x - b.toX, v.y - b.toY))[0];

      // Interception check if pass was ambitious and defender is tight
      const oppDist = nearestOpp ? Math.hypot(nearestOpp.x - b.toX, nearestOpp.y - b.toY) : 99;
      const interceptProb =
        oppDist < 6.5
          ? clamp(0.18 + ((nearestOpp?.d.rd || 60) - 60) * 0.004 + (b.flightType === 'through' ? 0.14 : 0), 0.1, 0.45)
          : 0;
      if (nearestOpp && Math.random() < interceptProb) {
        b.possessionSide = defSide;
        b.carrierId = nearestOpp.id;
        adjustLiveForm(nearestOpp.id, 0.14);
        adjustLiveForm(b.lastPasserId, -0.07);
        b.lastPasserId = null;
        b.targetId = null;
        b.x = nearestOpp.x;
        b.y = nearestOpp.y;
        b.flightType = 'carry';
        w.phaseLabel = `🔀 ${nearestOpp.shortName} อ่านทางบอลดักตัดไว้ได้!`;
        w.phaseTone = 'normal';
        SFX.pass();
        return;
      }

      if (receiver) {
        b.carrierId = receiver.id;
        b.targetId = null;
        b.x = receiver.x;
        b.y = receiver.y;
        b.flightType = 'carry';
      }
    } else if (b.flightType === 'carry') {
      // Carry ended cleanly, keep carrier ready for next decision
      b.progress = 1;
    }
  };

  // Synchronous instant minute resolver (used when clicking "ข้ามจบเกม")
  const stepInstantMinute = (curMin: number, curTac: Mentality) => {
    const sr = simRef.current;
    const w = worldRef.current!;

    // Drain stamina & update live match form
    [...sr.homeLu, ...sr.awayLu].forEach((n) => {
      if (sr.sentOff.includes(n)) return;
      const isH = sr.homeLu.includes(n);
      const pl = homeOrig.sq.find((q) => q.n === n) || awayOrig.sq.find((q) => q.n === n);
      if (!pl) return;
      const D = DT(pl, state.p);
      const drain = (0.34 - (D.d.sta - 65) * 0.0022) * (pl.pos === 'GK' ? 0.25 : 1);
      sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
      const curFit = sr.liveFit[n];
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
      if (curFit < 48) formDelta -= 0.055;
      else if (curFit < 58) formDelta -= 0.025;
      if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * 0.12;
      if (formDelta !== 0) adjustLiveForm(n, formDelta);
    });

    const runAiSubForSide = (isHomeSide: boolean) => {
      const sideOrig = isHomeSide ? homeOrig : awayOrig;
      const isUserTeamInMgr = state.mode === 'm' && sideOrig.id === state.me;
      if (isUserTeamInMgr) return;
      const schedule = isHomeSide ? sr.aiSubMinH : sr.aiSubMinA;
      if (!schedule.includes(curMin)) return;
      const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
      if (subsCount >= 4) return;
      const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
      const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
      const availableBench = sideOrig.sq
        .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n))
        .sort((a, b) => b.ov - a.ov);
      if (!availableBench.length) return;
      const onPitchPlayers = curLu
        .map((n) => sideOrig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => !sr.sentOff.includes(q.n) && q.pos !== 'GK');
      if (!onPitchPlayers.length) return;

      let outPlayer: Player | undefined;
      let inPlayer: Player | undefined;
      if (isPlayerMode && sideOrig.id === state.me && !myInitialBanned && myPlayerSquadObj) {
        const userCurrentlyOnPitch = curLu.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName);
        if (!userCurrentlyOnPitch && !curPlayed.includes(myPlayerName) && myPlayerSquadObj.pos !== 'GK' && availableBench.some((b) => b.n === myPlayerName)) {
          inPlayer = myPlayerSquadObj;
          outPlayer =
            onPitchPlayers.filter((q) => q.pos === inPlayer!.pos).sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0] ||
            onPitchPlayers.sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0];
          if (outPlayer && inPlayer) sr.userSubInMin = curMin;
        } else if (userCurrentlyOnPitch && ((sr.liveFit[myPlayerName] ?? 100) < 52 || (curMin >= 74 && Math.random() < 0.25))) {
          const userObj = onPitchPlayers.find((q) => q.n === myPlayerName);
          if (userObj) {
            outPlayer = userObj;
            inPlayer = availableBench.find((b) => b.pos === userObj.pos) || availableBench.find((b) => b.pos !== 'GK');
            if (inPlayer) sr.userSubOutMin = curMin;
          }
        }
      }
      if (!outPlayer || !inPlayer) {
        outPlayer = onPitchPlayers.slice().sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.yellows[a.n] || 0) * 18 - ((sr.liveFit[b.n] ?? 100) - (sr.yellows[b.n] || 0) * 18))[0];
        if (!outPlayer) return;
        inPlayer = availableBench.find((b) => b.pos === outPlayer!.pos) || availableBench.find((b) => b.pos !== 'GK');
      }
      if (!outPlayer || !inPlayer) return;
      const idx = curLu.indexOf(outPlayer.n);
      if (idx < 0) return;
      curLu[idx] = inPlayer.n;
      curPlayed.push(inPlayer.n);
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      const subEv: MatchSubEvent = { m: curMin, t: sideOrig.id, inPlayer: inPlayer.n, outPlayer: outPlayer.n };
      sr.subs.push(subEv);
      // Sync live pitch agent
      const agIdx = w.agents.findIndex((a) => a.id === outPlayer!.n);
      if (agIdx >= 0) {
        const rep = buildAgentsForTeam(sideOrig, isHomeSide ? 'H' : 'A', curLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          w.agents[agIdx] = rep[idx];
        }
      }
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🟢 ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} เข้าแทน 🔴 ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub');
    };

    runAiSubForSide(true);
    runAiSubForSide(false);

    // Auto-tactical rules
    if (state.mode === 'm' && state.rules && state.rules.length) {
      const myGoals = meIsHome ? sr.gh : sr.ga;
      const oppGoals = meIsHome ? sr.ga : sr.gh;
      state.rules.forEach((rule, idx) => {
        if (triggeredRulesRef.current.includes(idx) || curMin < rule.min) return;
        const condMet =
          (rule.c === 'tr' && myGoals < oppGoals) ||
          (rule.c === 'dr' && myGoals === oppGoals) ||
          (rule.c === 'ld' && myGoals > oppGoals) ||
          (rule.c === 'rc' && curMin >= rule.min);
        if (condMet) {
          triggeredRulesRef.current.push(idx);
          if (curTac !== rule.tac) {
            setLiveTac(rule.tac);
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
    }

    // Fast-forward 4 tactical plays for this minute inside world
    w.pendingSetPiece = null;
    for (let k = 0; k < 4; k++) {
      updateAgentTargets(w, curMin);
      w.agents.forEach((a) => {
        if (!a.sentOff) {
          a.x = a.x * 0.4 + a.tx * 0.6;
          a.y = a.y * 0.4 + a.ty * 0.6;
        }
      });
      scheduleNextPlay(w, curMin);
      if (w.varReview) resolveVarReview(w, curMin);
      w.ball.x = w.ball.toX;
      w.ball.y = w.ball.toY;
      w.ball.progress = 1;
      resolveSegmentArrival(w, curMin);
      if (w.varReview) resolveVarReview(w, curMin);
      w.possTicksTotal++;
      if (w.ball.possessionSide === 'H') w.possTicksH++;
    }
  };

  // Run minute-level maintenance (stamina, AI subs, auto rules) during real-time animation
  const onMinuteTick = (curMin: number) => {
    const sr = simRef.current;
    const w = worldRef.current!;

    [...sr.homeLu, ...sr.awayLu].forEach((n) => {
      if (sr.sentOff.includes(n)) return;
      const isH = sr.homeLu.includes(n);
      const pl = homeOrig.sq.find((q) => q.n === n) || awayOrig.sq.find((q) => q.n === n);
      if (!pl) return;
      const D = DT(pl, state.p);
      const drain = (0.34 - (D.d.sta - 65) * 0.0022) * (pl.pos === 'GK' ? 0.25 : 1);
      sr.liveFit[n] = clamp((sr.liveFit[n] ?? 100) - Math.max(0.1, drain), 18, 100);
      const curFit = sr.liveFit[n];
      const gd = isH ? sr.gh - sr.ga : sr.ga - sr.gh;
      let formDelta = gd > 0 ? 0.01 : gd < 0 ? -0.015 : 0;
      if (curFit < 48) formDelta -= 0.055;
      else if (curFit < 58) formDelta -= 0.025;
      if (Math.random() < 0.22) formDelta += (Math.random() - 0.52) * 0.12;
      if (formDelta !== 0) adjustLiveForm(n, formDelta);
      const ag = w.agents.find((a) => a.id === n);
      if (ag) ag.fit = sr.liveFit[n];
    });

    const runAiSubForSide = (isHomeSide: boolean) => {
      const sideOrig = isHomeSide ? homeOrig : awayOrig;
      const isUserTeamInMgr = state.mode === 'm' && sideOrig.id === state.me;
      if (isUserTeamInMgr) return;
      const schedule = isHomeSide ? sr.aiSubMinH : sr.aiSubMinA;
      if (!schedule.includes(curMin)) return;
      const subsCount = isHomeSide ? sr.homeSubsCount : sr.awaySubsCount;
      if (subsCount >= 4) return;
      const curLu = isHomeSide ? sr.homeLu : sr.awayLu;
      const curPlayed = isHomeSide ? sr.homePlayed : sr.awayPlayed;
      const availableBench = sideOrig.sq
        .filter((q) => !curPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sr.sentOff.includes(q.n))
        .sort((a, b) => b.ov - a.ov);
      if (!availableBench.length) return;
      const onPitchPlayers = curLu
        .map((n) => sideOrig.sq.find((q) => q.n === n))
        .filter((q): q is Player => Boolean(q))
        .filter((q) => !sr.sentOff.includes(q.n) && q.pos !== 'GK');
      if (!onPitchPlayers.length) return;

      let outPlayer: Player | undefined;
      let inPlayer: Player | undefined;
      if (isPlayerMode && sideOrig.id === state.me && !myInitialBanned && myPlayerSquadObj) {
        const userCurrentlyOnPitch = curLu.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName);
        if (!userCurrentlyOnPitch && !curPlayed.includes(myPlayerName) && myPlayerSquadObj.pos !== 'GK' && availableBench.some((b) => b.n === myPlayerName)) {
          inPlayer = myPlayerSquadObj;
          outPlayer =
            onPitchPlayers.filter((q) => q.pos === inPlayer!.pos).sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0] ||
            onPitchPlayers.sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.liveFit[b.n] ?? 100))[0];
          if (outPlayer && inPlayer) sr.userSubInMin = curMin;
        } else if (userCurrentlyOnPitch && ((sr.liveFit[myPlayerName] ?? 100) < 52 || (curMin >= 74 && Math.random() < 0.25))) {
          const userObj = onPitchPlayers.find((q) => q.n === myPlayerName);
          if (userObj) {
            outPlayer = userObj;
            inPlayer = availableBench.find((b) => b.pos === userObj.pos) || availableBench.find((b) => b.pos !== 'GK');
            if (inPlayer) sr.userSubOutMin = curMin;
          }
        }
      }
      if (!outPlayer || !inPlayer) {
        outPlayer = onPitchPlayers.slice().sort((a, b) => (sr.liveFit[a.n] ?? 100) - (sr.yellows[a.n] || 0) * 18 - ((sr.liveFit[b.n] ?? 100) - (sr.yellows[b.n] || 0) * 18))[0];
        if (!outPlayer) return;
        inPlayer = availableBench.find((b) => b.pos === outPlayer!.pos) || availableBench.find((b) => b.pos !== 'GK');
      }
      if (!outPlayer || !inPlayer) return;
      const idx = curLu.indexOf(outPlayer.n);
      if (idx < 0) return;
      curLu[idx] = inPlayer.n;
      curPlayed.push(inPlayer.n);
      if (isHomeSide) sr.homeSubsCount++;
      else sr.awaySubsCount++;
      const subEv: MatchSubEvent = { m: curMin, t: sideOrig.id, inPlayer: inPlayer.n, outPlayer: outPlayer.n };
      sr.subs.push(subEv);

      const agIdx = w.agents.findIndex((a) => a.id === outPlayer!.n);
      if (agIdx >= 0) {
        const rep = buildAgentsForTeam(sideOrig, isHomeSide ? 'H' : 'A', curLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
        if (rep[idx]) {
          rep[idx].x = w.agents[agIdx].x;
          rep[idx].y = w.agents[agIdx].y;
          w.agents[agIdx] = rep[idx];
        }
      }
      const isMeIn = isPlayerMode && inPlayer.n === myPlayerName;
      const isMeOut = isPlayerMode && outPlayer.n === myPlayerName;
      pushLog(curMin, `🔄 เปลี่ยนตัว (${sideOrig.name}): 🟢 ${inPlayer.n}${isMeIn ? ' (คุณ!)' : ''} เข้าแทน 🔴 ${outPlayer.n}${isMeOut ? ' (คุณ)' : ''}`, 'sub');
      setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
      setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
      setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
      setSubLog(sr.subs.slice());
    };

    runAiSubForSide(true);
    runAiSubForSide(false);

    if (state.mode === 'm' && state.rules && state.rules.length) {
      const myGoals = meIsHome ? sr.gh : sr.ga;
      const oppGoals = meIsHome ? sr.ga : sr.gh;
      state.rules.forEach((rule, idx) => {
        if (triggeredRulesRef.current.includes(idx) || curMin < rule.min) return;
        const condMet =
          (rule.c === 'tr' && myGoals < oppGoals) ||
          (rule.c === 'dr' && myGoals === oppGoals) ||
          (rule.c === 'ld' && myGoals > oppGoals) ||
          (rule.c === 'rc' && curMin >= rule.min);
        if (condMet) {
          triggeredRulesRef.current.push(idx);
          if (liveTacticsRef.current.tac !== rule.tac) {
            setLiveTac(rule.tac);
            pushLog(curMin, `⚙️ แผนอัตโนมัติทำงาน: ปรับแท็กติกเป็น "${AR_T[rule.tac]}"`, 'sys');
          }
        }
      });
    }

    const alertCfg = subAlertCfgRef.current;
    if (alertCfg.enabled && !sr.done) {
      const myOnPitch = meIsHome ? sr.homeLu : sr.awayLu;
      const mySubsUsedNow = sr.subs.filter((s) => s.t === meTeamOrig.id).length;
      if (state.mode === 'm' && mySubsUsedNow < 5) {
        myOnPitch.forEach((name) => {
          if (sr.sentOff.includes(name)) return;
          const pl = meTeamOrig.sq.find((q) => q.n === name);
          if (!pl) return;
          const fVal = Math.round(sr.liveFit[name] ?? pl.fit ?? 100);
          const fmVal = Number((sr.liveForm[name] ?? 6.5).toFixed(1));
          const lowFit = fVal <= alertCfg.fitTh;
          const lowForm = fmVal <= alertCfg.formTh;
          if (!lowFit && !lowForm) return;
          const logKey = `${name}:${lowFit ? 'fit' : ''}:${lowForm ? 'form' : ''}`;
          if (alertLoggedRef.current.has(logKey)) return;
          alertLoggedRef.current.add(logKey);
          const reasons: string[] = [];
          if (lowFit) reasons.push(`พลังงานเหลือ ${fVal}% (เสี่ยงบาดเจ็บ)`);
          if (lowForm) reasons.push(`ฟอร์มตก ${fmVal.toFixed(1)}`);
          pushLog(curMin, `🩺 แจ้งเตือนเปลี่ยนตัว (${pl.ro} ${pl.n}): ${reasons.join(' · ')} — แนะนำพักเพื่อป้องกันบาดเจ็บ`, 'sys');
          SFX.tap();
          vibrate(35);
        });
      } else if (state.mode === 'p' && myPlayerName && myOnPitch.includes(myPlayerName) && !sr.sentOff.includes(myPlayerName)) {
        const myF = Math.round(sr.liveFit[myPlayerName] ?? 100);
        const myFm = Number((sr.liveForm[myPlayerName] ?? 6.5).toFixed(1));
        if (myF <= alertCfg.fitTh && !alertLoggedRef.current.has(`${myPlayerName}:pfit`)) {
          alertLoggedRef.current.add(`${myPlayerName}:pfit`);
          pushLog(curMin, `🩺 คำเตือนร่างกาย: พลังงานคุณเหลือ ${myF}% เสี่ยงบาดเจ็บหากฝืนเร่งสปีดต่อเนื่อง`, 'sys');
        } else if (myFm <= alertCfg.formTh && !alertLoggedRef.current.has(`${myPlayerName}:pform`)) {
          alertLoggedRef.current.add(`${myPlayerName}:pform`);
          pushLog(curMin, `📉 ฟอร์มการเล่นของคุณตกลงมาที่ ${myFm.toFixed(1)} ต้องรีบเรียกจังหวะเกมกลับมา!`, 'sys');
        }
      }
    }

    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });
  };

  const syncUiStatsFromWorld = (w: LiveMatchWorld, nextMin: number) => {
    setMinute(nextMin);
    setMatchPhaseUi(w.phase);
    if (w.phase === 'stop1') {
      const sMin = Math.max(1, Math.min(w.added1, Math.ceil(w.stoppageFloat)));
      setClockLabel(`45+${sMin}'`);
      setStoppageBadge(w.added1);
    } else if (w.phase === 'halftime') {
      setClockLabel('HT');
      setStoppageBadge(0);
    } else if (w.phase === 'stop2') {
      const sMin = Math.max(1, Math.min(w.added2, Math.ceil(w.stoppageFloat)));
      setClockLabel(`90+${sMin}'`);
      setStoppageBadge(w.added2);
    } else if (w.phase === 'shootout') {
      setClockLabel('PEN');
      setStoppageBadge(0);
    } else if (w.phase === 'ft') {
      setClockLabel('FT');
      setStoppageBadge(0);
    } else {
      setClockLabel(`${nextMin}'`);
      setStoppageBadge(0);
    }
    setActionBanner({ label: w.phaseLabel, tone: w.phaseTone });
    setMatchStats({
      possH: clamp(Math.round((w.possTicksH / Math.max(1, w.possTicksTotal)) * 100), 28, 72),
      shotsH: w.shotsH,
      shotsA: w.shotsA,
      onTargetH: w.onTargetH,
      onTargetA: w.onTargetA,
      savesH: w.savesH,
      savesA: w.savesA,
      blocksH: w.blocksH,
      blocksA: w.blocksA,
      cornersH: w.cornersH,
      cornersA: w.cornersA,
      foulsH: w.foulsH,
      foulsA: w.foulsA,
      offsidesH: w.offsidesH,
      offsidesA: w.offsidesA,
      freeKicksH: w.freeKicksH,
      freeKicksA: w.freeKicksA,
      passesH: w.passesH,
      passesA: w.passesA,
      xgH: Math.max(0.05, Math.round(w.xgH * 100) / 100),
      xgA: Math.max(0.05, Math.round(w.xgA * 100) / 100)
    });
  };

  const computePenWinnerInstant = () => {
    const sr = simRef.current;
    const finalHomeTeam = { ...homeOrig, tac: meIsHome ? liveTacticsRef.current.tac : homeOrig.tac, lu: sr.homeLu };
    const finalAwayTeam = { ...awayOrig, tac: !meIsHome ? liveTacticsRef.current.tac : awayOrig.tac, lu: sr.awayLu };
    const H = rate(finalHomeTeam, state, true, 90, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const A = rate(finalAwayTeam, state, true, 90, sr.subs.map((s) => s.inPlayer), sr.sentOff);
    const penCompEdge = (teamXi: Player[]) => {
      const gk = teamXi.find((q) => q.pos === 'GK');
      const gkSv = gk ? DT(gk, state.p).d.sv : 60;
      const avgComp = teamXi.reduce((s, q) => s + DT(q, state.p).d.comp, 0) / (teamXi.length || 1);
      return avgComp * 0.6 + gkSv * 0.4;
    };
    const penDiff = penCompEdge(H.x) - penCompEdge(A.x);
    const winnerHome = Math.random() < clamp(0.5 + (H.at - A.at) / 260 + penDiff / 160, 0.25, 0.75);
    const sH = winnerHome ? R(4, 5) : R(2, 4);
    const sA = winnerHome ? Math.max(1, sH - R(1, 2)) : sH + R(1, 2);
    const text = `ดวลจุดโทษ: ${homeOrig.name} ${sH}-${sA} ${awayOrig.name}`;
    return { winnerHome, text };
  };

  const startLiveShootout = (w: LiveMatchWorld) => {
    const active = w.agents.filter((a) => !a.sentOff);
    const firstKicker = active.filter((a) => a.side === 'H' && a.pos !== 'GK').sort((u, v) => v.d.fin - u.d.fin)[0];
    const firstGk = active.find((a) => a.side === 'A' && a.pos === 'GK');
    w.phase = 'shootout';
    w.varReview = null;
    w.pendingSetPiece = null;
    w.ball.carrierId = null;
    w.ball.targetId = null;
    w.ball.flightType = 'carry';
    w.ball.x = 88.5;
    w.ball.y = 50;
    w.ball.z = 0;
    w.ball.trail = [];
    w.shootout = {
      round: 1,
      turn: 'H',
      hKicks: [],
      aKicks: [],
      hScore: 0,
      aScore: 0,
      waitSec: 1.65,
      lastMsg: `🎯 เสมอกัน ${simRef.current.gh}-${simRef.current.ga} ต้องตัดสินด้วยการดวลจุดโทษ!`,
      kickerName: firstKicker?.id || 'นักเตะ',
      gkName: firstGk?.id || 'ผู้รักษาประตู',
      activeShot: false,
      finished: false
    };
    triggerDramaSlow(w, 1.65, '🎯 ดวลจุดโทษตัดสิน!');
    w.phaseLabel = `🎯 ดวลจุดโทษตัดสิน! (${homeOrig.name} vs ${awayOrig.name})`;
    w.phaseTone = 'danger';
    SFX.whistle();
    pushLog(90, `🎯 เสมอหลังจบ 90 นาที (${simRef.current.gh}-${simRef.current.ga}) — เข้าสู่การดวลจุดโทษตัดสิน!`, 'sys');
    setMatchPhaseUi('shootout');
    setClockLabel('PEN');
    setStoppageBadge(0);
    setShootoutUi({ ...w.shootout });
  };

  const handleStartSecondHalf = (talkTone?: 'attack' | 'balanced' | 'defend' | 'fit') => {
    const w = worldRef.current;
    if (!w || w.phase !== 'halftime') return;
    SFX.whistle();
    const sr = simRef.current;
    // Halftime stamina recovery (+5%)
    w.agents.forEach((ag) => {
      if (!ag.sentOff) {
        ag.fit = clamp(ag.fit + 5, 25, 100);
        sr.liveFit[ag.id] = ag.fit;
      }
      // Reset to kickoff positions
      const homeBaseX = clamp(100 - ag.slotY, 4.5, 95.5);
      const baseX = ag.side === 'H' ? homeBaseX : 100 - homeBaseX;
      const baseY = ag.side === 'H' ? clamp(ag.slotX, 6, 94) : clamp(100 - ag.slotX, 6, 94);
      ag.x = ag.side === 'H' ? Math.min(baseX, 47) : Math.max(baseX, 53);
      ag.y = baseY;
      ag.tx = ag.x;
      ag.ty = ag.y;
    });
    if (state.mode === 'm' && talkTone) {
      if (talkTone === 'attack') {
        setLiveTac('A');
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "ลุยเต็มที่! เปิดเกมบุกครึ่งหลัง"`, 'sys');
      } else if (talkTone === 'defend') {
        setLiveTac('D');
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "คุมโซนให้แน่น รัดกุมครึ่งหลัง"`, 'sys');
      } else {
        pushLog(45, `📣 ปลุกใจพักครึ่ง: "รักษาฟอร์มและจังหวะการเล่นต่อไป!"`, 'sys');
      }
    } else if (state.mode === 'p' && talkTone === 'fit' && myPlayerName) {
      const meAg = w.agents.find((a) => a.id === myPlayerName);
      if (meAg) {
        meAg.fit = clamp(meAg.fit + 6, 25, 100);
        sr.liveFit[meAg.id] = meAg.fit;
      }
      pushLog(45, `💪 คุณวอร์มอัพเรียกความฟิตช่วงพักครึ่งพร้อมลุย 45 นาทีหลัง!`, 'sys');
    }
    w.phase = 'play2';
    w.stoppageFloat = 0;
    w.pendingSetPiece = { type: 'kickoff', side: 'A', x: 50, y: 50, waitSec: 0.45 };
    w.phaseLabel = `⚽ เริ่มครึ่งหลัง! (${awayOrig.name} เขี่ยบอล)`;
    w.phaseTone = 'normal';
    setHalftimeTalkUsed(false);
    setPaused(false);
    setMatchPhaseUi('play2');
    setClockLabel("46'");
    setStoppageBadge(0);
    setLiveFitMap({ ...sr.liveFit });
    pushLog(46, `▶️ กรรมการเป่าเริ่มครึ่งหลัง!`, 'sys');
  };

  const finalizeMatch = (precomputedWinnerHome?: boolean, precomputedPenText?: string) => {
    const sr = simRef.current;
    if (sr.done) return;
    sr.done = true;
    const w = worldRef.current!;
    w.phase = 'ft';
    w.varReview = null;
    w.pendingSetPiece = null;
    syncUiStatsFromWorld(w, 90);
    setDone(true);
    setMatchPhaseUi('ft');
    setClockLabel('FT');
    setStoppageBadge(0);
    SFX.whistle();
    setCrowdAudio(false);

    setLiveLu((meIsHome ? sr.homeLu : sr.awayLu).slice());
    setLiveOppLu((meIsHome ? sr.awayLu : sr.homeLu).slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    setMatchYellows({ ...sr.yellows });
    setMatchCards(sr.cards.slice());
    setSentOff(sr.sentOff.slice());
    setLiveFitMap({ ...sr.liveFit });
    setLiveFormMap({ ...sr.liveForm });

    const finalGh = sr.gh;
    const finalGa = sr.ga;
    if (kind !== 'league' && finalGh === finalGa) {
      if (precomputedWinnerHome !== undefined && precomputedPenText) {
        setPenResult({ winnerHome: precomputedWinnerHome, text: precomputedPenText });
      } else {
        const pen = computePenWinnerInstant();
        setPenResult(pen);
        pushLog(90, `🎯 ${pen.text}`, 'sys');
      }
    } else {
      pushLog(90, `🏁 จบเกม! ${homeOrig.name} ${finalGh}-${finalGa} ${awayOrig.name}`, 'sys');
    }
    setActionBanner({ label: `🏁 จบเกม ${finalGh} - ${finalGa}`, tone: 'normal' });
  };

  // High-FPS 60fps Animation + Simulation Loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncAccum = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const w = worldRef.current;
      const canvas = canvasRef.current;
      if (!w) return;

      if (!paused && !done && !simRef.current.done && w.phase !== 'halftime') {
        const speedMul = speed === 4 ? 4.4 : speed === 2 ? 2.15 : 1.0;

        // Decay FX, banners & dramatic slow-mo timers in real time for key moments
        const isSlowShot =
          w.ball.flightType === 'shot' ||
          w.ball.flightType === 'freekick' ||
          w.ball.flightType === 'penalty' ||
          w.ball.flightType === 'shootout_kick';
        const isBigFx = (t: LivePitchFx['type']) =>
          t === 'goal' || t === 'var' || t === 'foul' || t === 'penalty' || t === 'save' || t === 'woodwork' || t === 'offside';

        w.fx.forEach((f) => {
          f.ttl -= rawDt * (isBigFx(f.type) ? 1 : speedMul > 2 ? 1.4 : 1);
        });
        w.fx = w.fx.filter((f) => f.ttl > 0);
        w.sparkles.forEach((sp) => {
          sp.x += sp.vx * rawDt;
          sp.y += sp.vy * rawDt;
          sp.vx *= 0.95;
          sp.vy *= 0.95;
          sp.ttl -= rawDt;
        });
        w.sparkles = w.sparkles.filter((sp) => sp.ttl > 0);
        if (w.goalBanner) {
          w.goalBanner.ttl -= rawDt;
          if (w.goalBanner.ttl <= 0) w.goalBanner = null;
        }
        if (w.cardBanner) {
          w.cardBanner.ttl -= rawDt;
          if (w.cardBanner.ttl <= 0) w.cardBanner = null;
        }
        w.goalNetRippleH = Math.max(0, w.goalNetRippleH - rawDt * 0.85);
        w.goalNetRippleA = Math.max(0, w.goalNetRippleA - rawDt * 0.85);
        w.celebrateTimer = Math.max(0, w.celebrateTimer - rawDt);
        w.dramaSlowSec = Math.max(0, w.dramaSlowSec - rawDt);
        if (w.dramaSlowSec <= 0 && !isSlowShot) {
          w.dramaLabel = null;
        }

        // Penalty Shootout Phase
        if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
          const sh = w.shootout;
          updateAgentTargets(w, 90);
          w.agents.forEach((ag) => {
            if (ag.sentOff) return;
            const dx = ag.tx - ag.x;
            const dy = ag.ty - ag.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.15) {
              ag.x = clamp(ag.x + (dx / dist) * Math.min(dist * 6, 22) * rawDt, 3, 98.5);
              ag.y = clamp(ag.y + (dy / dist) * Math.min(dist * 6, 22) * rawDt, 4, 96);
              ag.facing = Math.atan2(dy, dx);
            } else {
              ag.facing = ag.side === sh.turn && ag.id === sh.kickerName ? 0 : Math.PI;
            }
          });

          if (!sh.activeShot) {
            sh.waitSec -= rawDt * (speedMul > 2 ? 1.15 : 1.0);
            w.ball.x = 88.5;
            w.ball.y = 50;
            w.ball.z = 0;
            if (sh.waitSec <= 0) {
              sh.activeShot = true;
              const b = w.ball;
              b.fromX = 88.5;
              b.fromY = 50;
              b.toX = 99.6;
              b.toY = 43.2 + Math.random() * 13.6;
              b.curve = (Math.random() - 0.5) * 2.4;
              b.maxZ = 4.5;
              b.progress = 0;
              b.duration = 0.68;
              b.flightType = 'shootout_kick';
              b.possessionSide = sh.turn;
              b.shooterId = sh.kickerName;
              const gk = w.agents.find((a) => !a.sentOff && a.side !== sh.turn && a.pos === 'GK');
              if (gk) {
                gk.intent = 'DIVE';
                gk.intentTimer = 0.95;
                gk.diveDir = b.toY >= gk.y ? 1 : -1;
                gk.diveProgress = 0.01;
              }
              SFX.kick();
              setShootoutUi({ ...sh, hKicks: sh.hKicks.slice(), aKicks: sh.aKicks.slice() });
            }
          } else {
            const b = w.ball;
            b.progress = Math.min(1, b.progress + (rawDt * 0.72) / Math.max(0.24, b.duration));
            const t = b.progress;
            const omt = 1 - t;
            b.x = omt * omt * b.fromX + 2 * omt * t * ((b.fromX + b.toX) * 0.5) + t * t * b.toX;
            b.y = omt * omt * b.fromY + 2 * omt * t * ((b.fromY + b.toY) * 0.5 + b.curve) + t * t * b.toY;
            b.z = Math.sin(t * Math.PI) * b.maxZ;
            b.trail.push({ x: b.x, y: b.y, z: b.z });
            if (b.trail.length > 12) b.trail.shift();
            if (b.progress >= 1) {
              resolveSegmentArrival(w, 90);
            }
          }
          if (canvas) {
            drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim);
          }
          rafId = window.requestAnimationFrame(frame);
          return;
        }

        // Open play & Stoppage clock progression (pause during key slow-mo / VAR / goals / penalties)
        const minDelta = rawDt * 1.45 * speedMul;
        const pauseClock =
          Boolean(w.varReview) ||
          w.celebrateTimer > 0 ||
          w.dramaSlowSec > 0 ||
          w.pendingSetPiece?.type === 'penalty' ||
          isSlowShot;
        if (!pauseClock) {
          if (w.phase === 'play1') {
            w.minuteFloat = Math.min(45, w.minuteFloat + minDelta);
          } else if (w.phase === 'play2') {
            w.minuteFloat = Math.min(90, w.minuteFloat + minDelta);
          } else if (w.phase === 'stop1' || w.phase === 'stop2') {
            w.stoppageFloat += minDelta;
          }
        }
        const curIntMin = Math.floor(w.minuteFloat);

        // Process any crossed minute ticks cleanly
        while (w.lastTickedMin < curIntMin) {
          w.lastTickedMin++;
          onMinuteTick(w.lastTickedMin);
        }

        // Update tactical targets
        updateAgentTargets(w, Math.max(1, curIntMin));

        // Smooth physical player movement + running stride + GK dive (slow-mo dampened during dramatic events)
        const baseMoveScale = speedMul > 2 ? 2.2 : speedMul > 1.5 ? 1.45 : 1.0;
        const moveScale = w.dramaSlowSec > 0 || isSlowShot ? 0.58 : baseMoveScale;
        w.agents.forEach((ag) => {
          if (ag.sentOff) return;
          if (ag.intent === 'DIVE' && ag.intentTimer > 0) {
            ag.intentTimer -= rawDt;
            ag.diveProgress = clamp(1 - ag.intentTimer / 0.95, 0, 1);
            if (ag.intentTimer <= 0) {
              ag.intent = 'SUPPORT';
              ag.diveProgress = 0;
            }
          }
          const dx = ag.tx - ag.x;
          const dy = ag.ty - ag.y;
          const dist = Math.hypot(dx, dy);
          const maxSpd =
            (18 + ((ag.d.spd || 60) - 55) * 0.22) *
            (ag.intent === 'MAKE_RUN' || ag.intent === 'OVERLAP' || ag.intent === 'PRESS' ? 1.32 : 1.0) *
            (ag.fit < 50 ? 0.82 : 1.0) *
            moveScale;
          const stepSpd = Math.min(dist * 6.5 * moveScale, maxSpd);
          if (dist > 0.15) {
            ag.vx = (dx / dist) * stepSpd;
            ag.vy = (dy / dist) * stepSpd;
            ag.x = clamp(ag.x + ag.vx * rawDt, 3, 97);
            ag.y = clamp(ag.y + ag.vy * rawDt, 4, 96);
            const targetAngle = Math.atan2(ag.vy, ag.vx);
            let angleDiff = targetAngle - ag.facing;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            ag.facing += angleDiff * Math.min(1, rawDt * 10);
            ag.stride += stepSpd * rawDt * 0.85;
          } else {
            ag.vx *= 0.8;
            ag.vy *= 0.8;
            const bAngle = Math.atan2(w.ball.y - ag.y, w.ball.x - ag.x);
            let angleDiff = bAngle - ag.facing;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            ag.facing += angleDiff * Math.min(1, rawDt * 6);
          }
        });

        // VAR Review countdown, Set-piece wait countdown, or Ball physics progression
        if (w.varReview) {
          w.varReview.waitSec = Math.max(0, w.varReview.waitSec - rawDt * (speedMul > 2 ? 1.1 : 1));
          if (w.varReview.waitSec <= 0) {
            resolveVarReview(w, Math.max(1, curIntMin));
          }
        } else if (w.pendingSetPiece && w.pendingSetPiece.waitSec > 0) {
          const spType = w.pendingSetPiece.type;
          const isImportantSetPiece =
            spType === 'penalty' ||
            spType === 'kickoff' ||
            spType === 'offside' ||
            spType === 'corner' ||
            (spType === 'freekick' && (w.pendingSetPiece.wallPlayers?.length || 0) > 0);
          const spRate = isImportantSetPiece ? (speedMul > 2 ? 1.15 : 1.0) : speedMul > 2 ? 1.55 : 1.0;
          w.pendingSetPiece.waitSec = Math.max(0, w.pendingSetPiece.waitSec - rawDt * spRate);
          w.ball.x = w.pendingSetPiece.x;
          w.ball.y = w.pendingSetPiece.y;
          w.ball.z = 0;
          if (w.pendingSetPiece.waitSec <= 0) {
            scheduleNextPlay(w, Math.max(1, curIntMin));
          }
        } else {
          const b = w.ball;
          const ballRate = isSlowShot
            ? 0.62
            : w.dramaSlowSec > 0
              ? 0.72
              : speedMul > 2
                ? 2.05
                : speedMul > 1.5
                  ? 1.4
                  : 1.0;
          const stepProg = (rawDt * ballRate) / Math.max(0.18, b.duration);
          b.progress = Math.min(1, b.progress + stepProg);

          if (b.carrierId && b.flightType === 'carry') {
            const car = w.agents.find((a) => a.id === b.carrierId && !a.sentOff);
            if (car) {
              b.x = clamp(car.x + Math.cos(car.facing) * 1.4, 2, 98);
              b.y = clamp(car.y + Math.sin(car.facing) * 1.4, 3, 97);
              b.z = 0;
            }
          } else {
            const t = b.progress;
            const omt = 1 - t;
            const ctrlX = (b.fromX + b.toX) * 0.5;
            const ctrlY = (b.fromY + b.toY) * 0.5 + b.curve;
            b.x = omt * omt * b.fromX + 2 * omt * t * ctrlX + t * t * b.toX;
            b.y = omt * omt * b.fromY + 2 * omt * t * ctrlY + t * t * b.toY;
            b.z = Math.sin(t * Math.PI) * b.maxZ;
          }

          b.trail.push({ x: b.x, y: b.y, z: b.z });
          if (b.trail.length > (isSlowShot ? 13 : 9)) b.trail.shift();

          if (b.progress >= 1) {
            resolveSegmentArrival(w, Math.max(1, curIntMin));
            if (!w.pendingSetPiece && !w.varReview) {
              scheduleNextPlay(w, Math.max(1, curIntMin));
            }
          }
        }

        // Possession accumulator
        w.possTicksTotal++;
        if (w.ball.possessionSide === 'H') w.possTicksH++;

        // Phase transitions: Added time & Halftime & Fulltime / Shootout
        const activePlayInFlight =
          Boolean(w.varReview) ||
          w.celebrateTimer > 0 ||
          w.dramaSlowSec > 0 ||
          w.ball.flightType === 'shot' ||
          w.ball.flightType === 'freekick' ||
          w.ball.flightType === 'penalty' ||
          w.pendingSetPiece?.type === 'penalty';
        if (w.phase === 'play1' && w.minuteFloat >= 45) {
          w.phase = 'stop1';
          w.stoppageFloat = 0;
          const evCount1 = simRef.current.evs.filter((e) => e.m <= 45).length + simRef.current.cards.filter((c) => c.m <= 45).length;
          w.added1 = clamp(1 + Math.floor(evCount1 * 0.6) + (w.varChecks > 0 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0), 1, 4);
          pushLog(45, `⏱️ ทดเวลาบาดเจ็บครึ่งแรก +${w.added1} นาที`, 'sys');
          w.phaseLabel = `⏱️ ทดเวลาบาดเจ็บครึ่งแรก +${w.added1} น.`;
          w.phaseTone = 'setpiece';
        } else if (w.phase === 'stop1' && w.stoppageFloat >= w.added1 && !activePlayInFlight) {
          w.phase = 'halftime';
          SFX.whistle();
          pushLog(45, `☕ พักครึ่งเวลา: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
          w.phaseLabel = `☕ พักครึ่งเวลา (${simRef.current.gh} - ${simRef.current.ga})`;
          w.phaseTone = 'normal';
          syncUiStatsFromWorld(w, 45);
        } else if (w.phase === 'play2' && w.minuteFloat >= 90) {
          w.phase = 'stop2';
          w.stoppageFloat = 0;
          const evCount2 = simRef.current.evs.filter((e) => e.m > 45).length + simRef.current.cards.filter((c) => c.m > 45).length + simRef.current.subs.length;
          w.added2 = clamp(2 + Math.floor(evCount2 * 0.45) + (w.varChecks > 0 ? 1 : 0), 2, 6);
          pushLog(90, `⏱️ ทดเวลาบาดเจ็บครึ่งหลัง +${w.added2} นาที`, 'sys');
          w.phaseLabel = `⏱️ ทดเวลาบาดเจ็บครึ่งหลัง +${w.added2} น.`;
          w.phaseTone = 'setpiece';
        } else if (w.phase === 'stop2' && w.stoppageFloat >= w.added2 && !activePlayInFlight) {
          if (kind !== 'league' && simRef.current.gh === simRef.current.ga) {
            startLiveShootout(w);
          } else {
            finalizeMatch();
          }
        }

        uiSyncAccum += rawDt;
        if (uiSyncAccum >= 0.16) {
          uiSyncAccum = 0;
          syncUiStatsFromWorld(w, curIntMin);
        }
      }

      if (canvas) {
        drawLivePitchToCanvas(canvas, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim);
      }
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, done, speed, showRunVectors, homeKit, awayKit, homeGkKit, awayGkKit, homeTrim, awayTrim]);

  const skipToEnd = () => {
    if (done || simRef.current.done) return;
    SFX.tap();
    const w = worldRef.current!;
    w.dramaSlowSec = 0;
    w.dramaLabel = null;
    w.celebrateTimer = 0;
    w.cardBanner = null;
    if (w.varReview) {
      resolveVarReview(w, Math.max(1, Math.floor(w.minuteFloat)));
    }
    if (w.phase === 'shootout' && w.shootout && !w.shootout.finished) {
      const pen = computePenWinnerInstant();
      w.shootout = null;
      setShootoutUi(null);
      pushLog(90, `🎯 ${pen.text}`, 'sys');
      finalizeMatch(pen.winnerHome, pen.text);
      return;
    }
    const startMin = Math.floor(w.minuteFloat);
    for (let m = startMin + 1; m <= 90; m++) {
      stepInstantMinute(m, liveTacticsRef.current.tac);
      if (m === 45) pushLog(45, `⏱️ จบครึ่งแรก: ${homeOrig.name} ${simRef.current.gh}-${simRef.current.ga} ${awayOrig.name}`, 'sys');
    }
    w.minuteFloat = 90;
    w.lastTickedMin = 90;
    w.dramaSlowSec = 0;
    w.dramaLabel = null;
    w.celebrateTimer = 0;
    w.cardBanner = null;
    setLiveFitMap({ ...simRef.current.liveFit });
    if (canvasRef.current) {
      drawLivePitchToCanvas(canvasRef.current, w, homeKit, awayKit, homeGkKit, awayGkKit, showRunVectors, homeTrim, awayTrim);
    }
    finalizeMatch();
  };

  const handleSubstitute = (benchPlayer: Player) => {
    if (!subPickOut) return;
    const sr = simRef.current;
    const w = worldRef.current!;
    const myLu = meIsHome ? sr.homeLu : sr.awayLu;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    const mySubsCount = meIsHome ? sr.homeSubsCount : sr.awaySubsCount;
    if (mySubsCount >= 5) return;
    if (sr.sentOff.includes(subPickOut)) return;
    const idx = myLu.indexOf(subPickOut);
    if (idx < 0) return;

    SFX.tap();
    myLu[idx] = benchPlayer.n;
    if (!myPlayed.includes(benchPlayer.n)) myPlayed.push(benchPlayer.n);
    if (meIsHome) sr.homeSubsCount++;
    else sr.awaySubsCount++;
    const subEv: MatchSubEvent = { m: minute, t: meTeamOrig.id, inPlayer: benchPlayer.n, outPlayer: subPickOut };
    sr.subs.push(subEv);

    // Swap live pitch agent immediately so the sub enters right on the pitch!
    const agIdx = w.agents.findIndex((a) => a.id === subPickOut);
    if (agIdx >= 0) {
      const updated = buildAgentsForTeam(meTeamOrig, meIsHome ? 'H' : 'A', myLu, sr.sentOff, sr.yellows, sr.liveFit, state.p, myPlayerName);
      if (updated[idx]) {
        updated[idx].x = w.agents[agIdx].x;
        updated[idx].y = w.agents[agIdx].y;
        w.agents[agIdx] = updated[idx];
      }
      if (w.ball.carrierId === subPickOut) w.ball.carrierId = benchPlayer.n;
      if (w.ball.targetId === subPickOut) w.ball.targetId = benchPlayer.n;
    }

    setLiveLu(myLu.slice());
    setSubsUsed(sr.subs.filter((s) => s.t === meTeamOrig.id).map((s) => s.inPlayer));
    setSubLog(sr.subs.slice());
    pushLog(minute, `🔄 เปลี่ยนตัว (${meTeamOrig.name}): 🟢 ${benchPlayer.n} เข้าแทน 🔴 ${subPickOut}`, 'sub');
    setSubPickOut(null);
  };

  const fullTimeAnalysis = useMemo(() => {
    if (!done) return null;
    const sr = simRef.current;
    const playedNames: Record<number, string[]> = {
      [homeId]: sr.homePlayed.slice(),
      [awayId]: sr.awayPlayed.slice()
    };
    const xgH = Math.max(0.12, Math.round((matchStats.xgH + sr.gh * 0.12) * 100) / 100);
    const xgA = Math.max(0.12, Math.round((matchStats.xgA + sr.ga * 0.12) * 100) / 100);
    const tmpRes: MatchResult = { gh: sr.gh, ga: sr.ga, evs: sr.evs, xgH, xgA, pen: penResult?.winnerHome, playedNames };
    const { ratings, motm } = computePlayerRatings(liveHome, liveAway, tmpRes, state.p, {
      savesH: matchStats.savesH,
      savesA: matchStats.savesA,
      blocksH: matchStats.blocksH,
      blocksA: matchStats.blocksA
    });

    let pf: PlayerPerfResult | undefined;
    if (isPlayerMode && state.p) {
      const userPlayed = sr.userStarted || sr.userSubInMin != null;
      const mins = !userPlayed
        ? 0
        : sr.userStarted
          ? (sr.userSentOffMin ?? sr.userSubOutMin ?? 90)
          : Math.max(1, (sr.userSentOffMin ?? 90) - (sr.userSubInMin ?? 90));
      const userCards = sr.cards.filter((c) => c.t === state.me && c.who === myPlayerName);
      const yc = userCards.filter((c) => c.type === 'Y').length;
      const rc = userCards.filter((c) => c.type === 'R' || c.type === 'Y2R').length;
      pf = calcPlayerPerf(state, tmpRes, liveHome, liveAway, ratings, {
        played: userPlayed,
        mins,
        subIn: sr.userSubInMin != null,
        subOut: sr.userSubOutMin != null,
        yc,
        rc
      });
    }
    return { xgH, xgA, ratings, motm, pf, playedNames, cards: sr.cards.slice(), subs: sr.subs.slice() };
  }, [done, matchStats, penResult, liveHome, liveAway, state, homeId, awayId, isPlayerMode, myPlayerName]);

  const benchList = useMemo(() => {
    const sr = simRef.current;
    const myPlayed = meIsHome ? sr.homePlayed : sr.awayPlayed;
    return meTeamOrig.sq
      .filter((q) => !liveLu.includes(q.n) && !myPlayed.includes(q.n) && q.inj === 0 && (q.sus || 0) === 0 && !sentOff.includes(q.n))
      .sort((a, b) => b.ov - a.ov);
  }, [meTeamOrig.sq, liveLu, sentOff, meIsHome]);

  const subAlertItems = useMemo(() => {
    if (state.mode !== 'm' || done || !subAlertEnabled || subsUsed.length >= 5) return [];
    const items: {
      name: string;
      role: SubRole;
      no: number;
      fitVal: number;
      formVal: number;
      lowFit: boolean;
      lowForm: boolean;
      urgent: boolean;
      reasonSig: string;
      suggestedSub: Player | null;
    }[] = [];

    liveLu.forEach((name) => {
      if (sentOff.includes(name)) return;
      const pl = meTeamOrig.sq.find((q) => q.n === name);
      if (!pl) return;
      const fitVal = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
      const formVal = Number((liveFormMap[name] ?? 6.5).toFixed(1));
      const lowFit = fitVal <= subAlertFitTh;
      const lowForm = formVal <= subAlertFormTh;
      if (!lowFit && !lowForm) return;
      const reasonSig = `${lowFit ? 'F' : ''}${lowForm ? 'R' : ''}`;
      if (dismissedAlerts[name] === reasonSig) return;
      const urgent = fitVal <= Math.max(35, subAlertFitTh - 8) || (lowFit && lowForm);
      const suggestedSub =
        benchList.find((b) => b.pos === pl.pos) ||
        (pl.pos !== 'GK' ? benchList.find((b) => b.pos !== 'GK') || null : null);
      items.push({
        name,
        role: pl.ro,
        no: getShirtNo(meTeamOrig, pl),
        fitVal,
        formVal,
        lowFit,
        lowForm,
        urgent,
        reasonSig,
        suggestedSub
      });
    });

    return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.fitVal - b.fitVal || a.formVal - b.formVal);
  }, [
    state.mode,
    done,
    subAlertEnabled,
    subsUsed.length,
    liveLu,
    sentOff,
    meTeamOrig,
    liveFitMap,
    liveFormMap,
    subAlertFitTh,
    subAlertFormTh,
    dismissedAlerts,
    benchList
  ]);

  const compTitle =
    kind === 'asia'
      ? `🌏 บอลถ้วยทวีป · ${RN[state.ac?.r ?? 0] || 'รอบคัดเลือก'}`
      : kind === 'cup'
        ? `🏆 ถ้วยประชาชน · ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
        : `⚽ ${TN[homeOrig.tier]} · นัดที่ ${state.md + 1}${isDerby ? ' 🔥 ดาร์บี้แมตช์' : ''}`;


  const mySubsList = subLog.filter((s) => s.t === meTeamOrig.id);

  const bannerCls =
    actionBanner.tone === 'goal'
      ? 'bg-[var(--g)] text-white border-[var(--g)]'
      : actionBanner.tone === 'danger'
        ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--red)]/40'
        : actionBanner.tone === 'offside' || actionBanner.tone === 'setpiece'
          ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border-[var(--lamp)]/50'
          : actionBanner.tone === 'attack'
            ? 'bg-[var(--g-soft)] text-[var(--g)] border-[var(--g)]/40'
            : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)]';

  const handleConfirmFinish = () => {
    if (!fullTimeAnalysis) return;
    const srDone = simRef.current;
    SFX.tap();
    onFinish({
      gh: srDone.gh,
      ga: srDone.ga,
      evs: srDone.evs,
      xgH: fullTimeAnalysis.xgH,
      xgA: fullTimeAnalysis.xgA,
      pen: penResult ? penResult.winnerHome : undefined,
      penText: penResult?.text,
      ratings: fullTimeAnalysis.ratings,
      motm: fullTimeAnalysis.motm,
      pf: fullTimeAnalysis.pf,
      finalTac: liveTac,
      finalLu: liveLu,
      cards: fullTimeAnalysis.cards,
      subs: fullTimeAnalysis.subs,
      playedNames: fullTimeAnalysis.playedNames
    });
  };

  const renderMatchStatsPanel = () => {
    const yH = matchCards.filter((c) => c.t === homeOrig.id && c.type === 'Y').length;
    const yA = matchCards.filter((c) => c.t === awayOrig.id && c.type === 'Y').length;
    const rH = matchCards.filter((c) => c.t === homeOrig.id && (c.type === 'R' || c.type === 'Y2R')).length;
    const rA = matchCards.filter((c) => c.t === awayOrig.id && (c.type === 'R' || c.type === 'Y2R')).length;
    const statRows: { label: string; hVal: number; aVal: number; hText: string; aText: string }[] = [
      { label: 'ครองบอล', hVal: matchStats.possH, aVal: 100 - matchStats.possH, hText: `${matchStats.possH}%`, aText: `${100 - matchStats.possH}%` },
      { label: 'โอกาสยิง (เข้ากรอบ)', hVal: matchStats.shotsH, aVal: matchStats.shotsA, hText: `${matchStats.shotsH} (${matchStats.onTargetH})`, aText: `${matchStats.shotsA} (${matchStats.onTargetA})` },
      { label: 'ความแม่นยำประตู (xG)', hVal: matchStats.xgH, aVal: matchStats.xgA, hText: matchStats.xgH.toFixed(2), aText: matchStats.xgA.toFixed(2) },
      { label: 'จ่ายบอล · เตะมุม', hVal: matchStats.passesH, aVal: matchStats.passesA, hText: `${matchStats.passesH} · 🚩${matchStats.cornersH}`, aText: `🚩${matchStats.cornersA} · ${matchStats.passesA}` },
      {
        label: 'ฟาวล์ · ล้ำหน้า · ใบ',
        hVal: matchStats.foulsH + yH * 2 + rH * 4,
        aVal: matchStats.foulsA + yA * 2 + rA * 4,
        hText: `${matchStats.foulsH} · ${matchStats.offsidesH} · 🟨${yH}${rH > 0 ? ` 🟥${rH}` : ''}`,
        aText: `${rA > 0 ? `🟥${rA} ` : ''}🟨${yA} · ${matchStats.offsidesA} · ${matchStats.foulsA}`
      }
    ];
    return (
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold pb-1 border-b border-[var(--line)]/60">
          <span className="flex items-center gap-1.5 truncate max-w-[38%]">
            <span className="w-2.5 h-2.5 rounded-full border border-white/70 shrink-0" style={{ background: homeKit }} />
            <span className="truncate">{homeOrig.name}</span>
          </span>
          <span className="text-[10px] text-[var(--mut)] shrink-0">📊 สถิติในสนาม</span>
          <span className="flex items-center justify-end gap-1.5 truncate max-w-[38%]">
            <span className="truncate">{awayOrig.name}</span>
            <span className="w-2.5 h-2.5 rounded-full border border-white/70 shrink-0" style={{ background: awayKit }} />
          </span>
        </div>
        <div className="space-y-1.5 mland:space-y-1">
          {statRows.map((row) => {
            const tot = Math.max(0.01, row.hVal + row.aVal);
            const hPct = row.hVal === 0 && row.aVal === 0 ? 50 : clamp((row.hVal / tot) * 100, 8, 92);
            return (
              <div key={row.label} className="space-y-0.5 text-[11px] mland:text-[10px]">
                <div className="flex items-center justify-between gap-2 tabular">
                  <span className="font-bold text-[var(--ink)]">{row.hText}</span>
                  <span className="text-[10px] text-[var(--mut)] font-semibold">{row.label}</span>
                  <span className="font-bold text-[var(--ink)]">{row.aText}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface)] flex">
                  <div className="h-full transition-all duration-300" style={{ width: `${hPct}%`, backgroundColor: 'var(--g)' }} />
                  <div className="h-full transition-all duration-300 bg-amber-500/80" style={{ width: `${100 - hPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLiveEnergyPanel = () => {
    if (done && fullTimeAnalysis) return null;
    const hNames = (meIsHome ? liveLu : liveOppLu).filter((n) => !sentOff.includes(n));
    const aNames = (meIsHome ? liveOppLu : liveLu).filter((n) => !sentOff.includes(n));
    const hAvg = Math.round(hNames.reduce((a, n) => a + (liveFitMap[n] ?? 100), 0) / Math.max(1, hNames.length));
    const aAvg = Math.round(aNames.reduce((a, n) => a + (liveFitMap[n] ?? 100), 0) / Math.max(1, aNames.length));
    const tiredCount = liveLu.filter((n) => !sentOff.includes(n) && (liveFitMap[n] ?? 100) <= subAlertFitTh).length;
    const lowFormCount = liveLu.filter((n) => !sentOff.includes(n) && (liveFormMap[n] ?? 6.5) <= subAlertFormTh).length;
    const fitColor = (v: number) => (v >= 70 ? 'var(--g)' : v >= subAlertFitTh ? '#f59e0b' : 'var(--red)');
    const fitTextCls = (v: number) => (v >= 70 ? 'text-[var(--g)]' : v >= subAlertFitTh ? 'text-[#c98a00] dark:text-[var(--lamp)]' : 'text-[var(--red)]');

    if (isPlayerMode && myPlayerName) {
      const myFit = Math.round(liveFitMap[myPlayerName] ?? myPlayerSquadObj?.fit ?? 100);
      const myForm = Number((liveFormMap[myPlayerName] ?? 6.5).toFixed(1));
      const onPitchNow = liveLu.includes(myPlayerName) && !sentOff.includes(myPlayerName);
      const subOutEv = subLog.find((s) => s.t === meTeamOrig.id && s.outPlayer === myPlayerName);
      const statusTxt = myInitialBanned
        ? 'ติดโทษแบน (ชมข้างสนาม)'
        : sentOff.includes(myPlayerName)
          ? 'โดนใบแดงไล่ออก'
          : onPitchNow
            ? 'กำลังลงสนาม'
            : subOutEv
              ? `ถูกเปลี่ยนออก น.${subOutEv.m}'`
              : 'รอโอกาสที่ม้านั่งสำรอง';
      const myWarnFit = onPitchNow && subAlertEnabled && myFit <= subAlertFitTh;
      const myWarnForm = onPitchNow && subAlertEnabled && myForm <= subAlertFormTh;
      return (
        <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
            <span className="font-bold flex items-center gap-1.5">
              <span>⚡ พลังงานในสนาม</span>
              <span className="text-[var(--mut)] font-semibold">· {statusTxt}</span>
            </span>
            <span className="text-[var(--mut)] tabular">
              เฉลี่ยทีม: <b className={fitTextCls(meIsHome ? hAvg : aAvg)}>{meIsHome ? hAvg : aAvg}%</b> vs คู่แข่ง <b className={fitTextCls(meIsHome ? aAvg : hAvg)}>{meIsHome ? aAvg : hAvg}%</b>
            </span>
          </div>
          {(myWarnFit || myWarnForm) && (
            <div className="px-2.5 py-2 mland:py-1 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/50 text-[11px] mland:text-[10px] flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-bold text-[var(--red)]">
                🩺 {myWarnFit ? `พลังงานต่ำ ${myFit}% เสี่ยงบาดเจ็บ!` : ''}
                {myWarnFit && myWarnForm ? ' · ' : ''}
                {myWarnForm ? `ฟอร์มตกเหลือ ${myForm.toFixed(1)}` : ''}
              </span>
              <span className="text-[10px] text-[var(--mut)]">ระวังจังหวะปะทะหนัก</span>
            </div>
          )}
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-bold truncate">★ {myPlayerName} ({myPlayerSquadObj?.ro || state.p?.sp})</span>
              <span className="flex items-center gap-2 shrink-0 tabular">
                <span className={`font-bold text-[11px] ${myForm <= subAlertFormTh ? 'text-[var(--red)]' : myForm >= 7.2 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                  ฟอร์ม {myForm.toFixed(1)}
                </span>
                <span className={`font-extrabold ${fitTextCls(myFit)}`}>
                  {myFit}% · {myFit >= 70 ? 'ฟิตสมบูรณ์' : myFit >= subAlertFitTh ? 'เริ่มล้า' : 'เสี่ยงเจ็บ'}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${clamp(myFit, 0, 100)}%`, background: fitColor(myFit) }} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 mland:space-y-1.5">
        {subAlertItems.length > 0 && (
          <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--red-soft)]/80 border border-[var(--red)]/55 space-y-2 mland:space-y-1.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
              <div className="flex items-center gap-1.5 font-extrabold text-[var(--red)]">
                <span className="animate-pulse">🩺</span>
                <span>แจ้งเตือนเปลี่ยนตัว ({subAlertItems.length} คน) · ป้องกันบาดเจ็บ &amp; ฟอร์มตก</span>
              </div>
              <span className="text-[10px] text-[var(--mut)] font-semibold">
                เกณฑ์: ฟิต ≤ {subAlertFitTh}% หรือ ฟอร์ม ≤ {subAlertFormTh.toFixed(1)}
              </span>
            </div>
            <div className="space-y-1.5 mland:space-y-1">
              {subAlertItems.slice(0, 3).map((al) => (
                <div
                  key={al.name}
                  className="p-2 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--red)]/35 flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[10px] font-bold text-[var(--mut)]">
                        #{al.no} {al.role}
                      </span>
                      <span className="font-bold text-[var(--ink)] truncate">{al.name}</span>
                      {al.lowFit && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[var(--red-soft)] text-[var(--red)] text-[10px] font-extrabold tabular">
                          ⚡ ฟิต {al.fitVal}% (เสี่ยงเจ็บ)
                        </span>
                      )}
                      {al.lowForm && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] text-[10px] font-extrabold tabular">
                          📉 ฟอร์ม {al.formVal.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {al.suggestedSub && (
                      <div className="text-[10px] text-[var(--mut)] truncate">
                        แนะนำสำรอง: <b className="text-[var(--g)]">🟢 {al.suggestedSub.n}</b> ({al.suggestedSub.ro} · OVR {al.suggestedSub.ov} · ฟิต {Math.round(al.suggestedSub.fit ?? 100)}%)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setSubPickOut(al.name);
                        setShowTacticsDrawer(true);
                        setMlandMatchTab('tactics');
                        setPaused(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--g)] text-white text-[10px] font-bold cursor-pointer hover:brightness-105"
                    >
                      🔄 เปลี่ยนตัว
                    </button>
                    <button
                      type="button"
                      title="ปิดการเตือนนักเตะคนนี้ชั่วคราว"
                      onClick={() => setDismissedAlerts((prev) => ({ ...prev, [al.name]: al.reasonSig }))}
                      className="w-6 h-6 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {subAlertItems.length > 3 && (
                <div className="text-[10px] text-[var(--mut)] text-right font-semibold">
                  และอีก {subAlertItems.length - 3} คนในแผงพลังงานด้านล่าง
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mland:text-[10px]">
            <span className="font-bold">⚡ พลังงาน &amp; ฟอร์ม 11 คนในสนาม ({meTeamOrig.name})</span>
            <div className="flex flex-wrap items-center gap-2 tabular text-[var(--mut)]">
              <span>
                เหย้า <b className={fitTextCls(hAvg)}>{hAvg}%</b> · เยือน <b className={fitTextCls(aAvg)}>{aAvg}%</b>
              </span>
              {(tiredCount > 0 || lowFormCount > 0) && (
                <span className="font-bold text-[var(--red)]">
                  · เตือน {tiredCount > 0 ? `ล้า ${tiredCount}` : ''}{tiredCount > 0 && lowFormCount > 0 ? '/' : ''}{lowFormCount > 0 ? `ฟอร์มตก ${lowFormCount}` : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowAlertConfig((v) => !v)}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                  showAlertConfig || !subAlertEnabled
                    ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--g)]'
                }`}
              >
                ⚙️ เกณฑ์เตือน
              </button>
            </div>
          </div>

          {showAlertConfig && (
            <div className="p-2.5 mland:p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--ink)]">🩺 ระบบแจ้งเตือนเปลี่ยนตัว (ป้องกันบาดเจ็บ/ฟอร์มตก)</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !subAlertEnabled;
                    setSubAlertEnabled(next);
                    persistSubAlertPrefs(next, subAlertFitTh, subAlertFormTh);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    subAlertEnabled ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'
                  }`}
                >
                  {subAlertEnabled ? 'เปิดเตือน' : 'ปิดเตือน'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between gap-2 bg-[var(--surface-2)] px-2.5 py-1.5 rounded-lg">
                  <span className="text-[10px] font-semibold text-[var(--mut)]">เตือนเมื่อพลังงาน ≤</span>
                  <div className="flex items-center gap-1">
                    {[50, 55, 58, 65].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSubAlertFitTh(v);
                          setDismissedAlerts({});
                          persistSubAlertPrefs(subAlertEnabled, v, subAlertFormTh);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular cursor-pointer ${
                          subAlertFitTh === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[var(--surface-2)] px-2.5 py-1.5 rounded-lg">
                  <span className="text-[10px] font-semibold text-[var(--mut)]">เตือนเมื่อฟอร์ม ≤</span>
                  <div className="flex items-center gap-1">
                    {[5.4, 5.8, 6.0].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSubAlertFormTh(v);
                          setDismissedAlerts({});
                          persistSubAlertPrefs(subAlertEnabled, subAlertFitTh, v);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular cursor-pointer ${
                          subAlertFormTh === v ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'
                        }`}
                      >
                        {v.toFixed(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 mland:grid-cols-3 gap-1.5 mland:gap-1">
            {liveLu.map((name) => {
              const pl = meTeamOrig.sq.find((q) => q.n === name);
              if (!pl) return null;
              const isRed = sentOff.includes(name);
              const fitVal = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
              const formVal = Number((liveFormMap[name] ?? 6.5).toFixed(1));
              const warnFit = !isRed && subAlertEnabled && fitVal <= subAlertFitTh;
              const warnForm = !isRed && subAlertEnabled && formVal <= subAlertFormTh;
              const canSubClick = !isRed && subsUsed.length < 5;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={!canSubClick}
                  onClick={() => {
                    setSubPickOut(name);
                    setShowTacticsDrawer(true);
                    setMlandMatchTab('tactics');
                    setPaused(true);
                  }}
                  title={canSubClick ? 'คลิกเพื่อเปลี่ยนตัวนักเตะคนนี้' : undefined}
                  className={`p-1.5 mland:p-1 rounded-xl bg-[var(--surface)] border text-left transition-colors ${
                    isRed
                      ? 'opacity-45 border-[var(--red)]/40 cursor-not-allowed'
                      : subPickOut === name && showTacticsDrawer
                        ? 'border-[var(--lamp)] ring-1 ring-[var(--lamp)] cursor-pointer'
                        : warnFit
                          ? 'border-[var(--red)]/80 bg-[var(--red-soft)]/30 cursor-pointer'
                          : warnForm
                            ? 'border-[var(--lamp)]/80 bg-[var(--lamp-soft)]/30 cursor-pointer'
                            : 'border-[var(--line)] hover:border-[var(--g)] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-bold truncate">
                      <span className="text-[var(--mut)]">{pl.ro}</span> {pl.n.split(' ')[0]}
                    </span>
                    <span className={`font-extrabold tabular shrink-0 ${isRed ? 'text-[var(--red)]' : fitTextCls(fitVal)}`}>
                      {isRed ? '🟥' : `${fitVal}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${isRed ? 0 : clamp(fitVal, 0, 100)}%`, background: fitColor(fitVal) }}
                    />
                  </div>
                  {!isRed && (
                    <div className="mt-1 flex items-center justify-between gap-1 text-[9px] tabular">
                      <span className={warnForm ? 'font-extrabold text-[#b45309] dark:text-[var(--lamp)]' : formVal >= 7.2 ? 'font-bold text-[var(--g)]' : 'text-[var(--mut)]'}>
                        {warnForm ? `📉 ${formVal.toFixed(1)}` : `★ ${formVal.toFixed(1)}`}
                      </span>
                      {warnFit ? (
                        <span className="font-extrabold text-[var(--red)]">🩺 เสี่ยงเจ็บ</span>
                      ) : warnForm ? (
                        <span className="font-bold text-[#b45309] dark:text-[var(--lamp)]">ฟอร์มตก</span>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderLiveTacticsPanel = () => (
    <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--g)]/40 space-y-3 mland:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-xs mland:text-[11px]">⚡ ปรับแผนสด &amp; เปลี่ยนตัว ({meTeamOrig.name}) · เหลือโควต้า {5 - subsUsed.length} คน</span>
        <button
          type="button"
          onClick={() => {
            setShowTacticsDrawer(false);
            setMlandMatchTab('events');
            setPaused(false);
          }}
          className="px-3 py-1 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[11px] font-bold cursor-pointer"
        >
          ใช้แผน &amp; เล่นต่อ ▶
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
        <div>
          <div className="text-[11px] mland:text-[10px] font-bold text-[var(--mut)] mb-1">สไตล์ (Mentality)</div>
          <div className="flex flex-wrap gap-1">
            {(['X', 'A', 'B', 'D', 'Z'] as Mentality[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setLiveTac(m);
                  pushLog(minute, `📣 สั่งการข้างสนาม: ปรับแผนเป็น "${AR_T[m]}"`, 'sys');
                }}
                className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg font-semibold cursor-pointer ${liveTac === m ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}
              >
                {AR_T[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] mland:text-[10px] font-bold text-[var(--mut)] mb-1">สไตล์จ่ายบอล</div>
          <div className="flex flex-wrap gap-1">
            {['บอลสั้น', 'ผสม', 'บอลยาว', 'เกมสวน'].map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                onClick={() => {
                  setLivePass(idx);
                  pushLog(minute, `📣 สั่งการข้างสนาม: เน้นจ่ายแบบ "${lbl}"`, 'sys');
                }}
                className={`px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg font-semibold cursor-pointer ${livePass === idx ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-2 gap-2 mland:gap-1.5 text-[11px] mland:text-[10px]">
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">เพรสซิ่ง</div>
          <div className="flex gap-1">
            {['ต่ำ', 'กลาง', 'สูง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLivePress(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${livePress === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">จังหวะ</div>
          <div className="flex gap-1">
            {['ช้า', 'กลาง', 'เร็ว'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveTempo(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveTempo === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">แนวรับ</div>
          <div className="flex gap-1">
            {['ลึก', 'กลาง', 'สูง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveLine(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveLine === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-bold text-[var(--mut)] mb-1">ความกว้าง</div>
          <div className="flex gap-1">
            {['แคบ', 'กลาง', 'กว้าง'].map((lbl, k) => (
              <button key={lbl} type="button" onClick={() => setLiveWid(k)} className={`flex-1 py-1 mland:py-0.5 rounded-md font-semibold cursor-pointer ${liveWid === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)]'}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {subsUsed.length < 5 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-1.5">
          <div>
            <div className="text-[11px] mland:text-[10px] font-bold text-[var(--red)] mb-1">1. 🔴 เลือกนักเตะในสนามที่ต้องการ &ldquo;เปลี่ยนออก&rdquo;</div>
            <div className="max-h-36 mland:max-h-28 overflow-y-auto space-y-1 pr-0.5">
              {liveLu.map((name) => {
                const pl = meTeamOrig.sq.find((q) => q.n === name);
                if (!pl) return null;
                const isRed = sentOff.includes(name);
                const hasY = (matchYellows[name] || 0) > 0;
                const curF = Math.round(liveFitMap[name] ?? pl.fit ?? 100);
                const curForm = Number((liveFormMap[name] ?? 6.5).toFixed(1));
                const flagFit = !isRed && subAlertEnabled && curF <= subAlertFitTh;
                const flagForm = !isRed && subAlertEnabled && curForm <= subAlertFormTh;
                const activePick = subPickOut === name;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={isRed}
                    onClick={() => setSubPickOut(activePick ? null : name)}
                    className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 mland:py-1 rounded-lg text-xs mland:text-[10px] cursor-pointer disabled:opacity-45 ${
                      activePick
                        ? 'bg-[var(--lamp)] text-[#261900] font-bold'
                        : flagFit
                          ? 'bg-[var(--red-soft)]/50 border border-[var(--red)]/50 hover:bg-[var(--red-soft)]'
                          : flagForm
                            ? 'bg-[var(--lamp-soft)]/50 border border-[var(--lamp)]/50 hover:bg-[var(--lamp-soft)]'
                            : 'bg-[var(--surface)] hover:bg-[var(--surface)]/80'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      <span className="text-[10px] font-bold text-[var(--mut)]">#{getShirtNo(meTeamOrig, pl)}</span>
                      <span className="font-bold">{pl.ro}</span>
                      <span className="truncate">{pl.n}</span>
                      {isRed && <span>🟥</span>}
                      {!isRed && hasY && <span>🟨</span>}
                      {flagFit && <span className="text-[9px] font-extrabold text-[var(--red)]">🩺</span>}
                      {!flagFit && flagForm && <span className="text-[9px] font-extrabold text-[#b45309] dark:text-[var(--lamp)]">📉</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 tabular text-[11px] mland:text-[10px]">
                      <span className={flagForm ? 'text-[#b45309] dark:text-[var(--lamp)] font-bold' : 'text-[var(--mut)]'}>
                        ★{curForm.toFixed(1)}
                      </span>
                      <span className={curF <= subAlertFitTh ? 'text-[var(--red)] font-bold' : curF < 75 ? 'text-[#c98a00]' : 'text-[var(--g)]'}>
                        {curF}%
                      </span>
                      <span className="font-bold">{pl.ov}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] mland:text-[10px] font-bold text-[var(--g)] mb-1">
              2. 🟢 เลือกตัวสำรอง &ldquo;ส่งเข้าแทน&rdquo; {subPickOut ? `(${subPickOut.split(' ')[0]})` : ''}
            </div>
            <div className="max-h-36 mland:max-h-28 overflow-y-auto space-y-1 pr-0.5">
              {(() => {
                const outObj = subPickOut ? meTeamOrig.sq.find((q) => q.n === subPickOut) : null;
                return benchList.map((pl) => {
                  const fitMatch = outObj && pl.pos === outObj.pos;
                  const curF = Math.round(pl.fit ?? 100);
                  return (
                    <button
                      key={pl.n}
                      type="button"
                      disabled={!subPickOut}
                      onClick={() => handleSubstitute(pl)}
                      className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 mland:py-1 rounded-lg bg-[var(--surface)] border text-xs mland:text-[10px] cursor-pointer disabled:opacity-45 ${fitMatch ? 'border-[var(--g)]/60' : 'border-transparent hover:border-[var(--g)]'}`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <span className="text-[10px] font-bold text-[var(--mut)]">#{getShirtNo(meTeamOrig, pl)}</span>
                        <span className="font-bold">{pl.ro}</span>
                        <span className="truncate">{pl.n}</span>
                        {fitMatch && <span className="text-[10px] text-[var(--g)] font-bold">ตรงตำแหน่ง</span>}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 tabular text-[11px] mland:text-[10px]">
                        <span className="text-[var(--mut)]">{curF}%</span>
                        <span className="font-bold text-[var(--g)]">{pl.ov}</span>
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs font-semibold text-[var(--mut)]">ใช้โควต้าเปลี่ยนตัวครบ 5 คนแล้ว</div>
      )}
      {mySubsList.length > 0 && (
        <div className="pt-2 mland:pt-1 border-t border-[var(--line)] flex flex-wrap gap-1.5 text-[11px] mland:text-[10px]">
          <span className="font-bold text-[var(--mut)]">เปลี่ยนตัวแล้ว:</span>
          {mySubsList.map((sb, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--line)] tabular">
              {sb.m}&apos; 🟢{sb.inPlayer.split(' ')[0]} ↔ 🔴{sb.outPlayer.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-3 mland:p-1 overflow-hidden">
      <div className="w-full max-w-5xl mland:max-w-[98vw] max-h-[95dvh] mland:h-[97dvh] mland:max-h-[97dvh] rounded-2xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Pinned Top Scoreboard Header */}
        <div className="shrink-0 px-3 sm:px-4 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)]/90 border-b border-[var(--line)]">
          <div className="flex items-center justify-between text-xs mland:text-[9.5px] text-[var(--mut)] mb-1 mland:mb-0.5 gap-2">
            <span className="font-semibold truncate">{compTitle}</span>
            <div className="flex items-center gap-1.5 mland:gap-1 shrink-0">
              <span className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] sm:text-[11px] mland:text-[9px] font-bold truncate max-w-[160px] sm:max-w-[320px] mland:max-w-[210px] ${bannerCls}`}>
                {actionBanner.label}
              </span>
              {stoppageBadge > 0 && (
                <span className="px-2 mland:px-1.5 py-0.5 rounded-lg bg-[var(--lamp)] text-[#261900] font-extrabold tabular text-[10px] mland:text-[9px]">
                  +{stoppageBadge}&apos;
                </span>
              )}
              <span className="px-2.5 mland:px-2 py-0.5 rounded-lg bg-[var(--g)] text-white font-bold tabular text-[11px] mland:text-[9.5px]">
                {done ? 'FT' : clockLabel}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 mland:gap-2">
            <div className="flex items-center justify-end gap-2 mland:gap-1.5 min-w-0">
              <div className="text-right min-w-0">
                <div className={`font-bold text-xs sm:text-base mland:text-xs truncate flex items-center justify-end gap-1 ${homeId === state.me ? 'text-[var(--g)]' : ''}`}>
                  {goalFlashSide === 'H' && <span className="px-1.5 py-0.2 rounded bg-[var(--lamp)] text-[#261900] text-[10px] font-extrabold shrink-0">⚽ +1</span>}
                  <span className="truncate">{homeOrig.name}</span>
                </div>
                <div className="text-[10px] sm:text-[11px] mland:text-[9px] text-[var(--mut)] flex items-center justify-end gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shrink-0" style={{ background: homeKit }} />
                  <span>เหย้า {homeId === state.me ? '★' : ''}</span>
                </div>
              </div>
              <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                <ClubCrest name={homeOrig.name} size={30} team={homeOrig} club={state.club} isMyClub={homeId === state.me && state.mode === 'm'} />
              </div>
            </div>
            <div className={`px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-2xl mland:rounded-xl border text-center min-w-[74px] sm:min-w-[88px] mland:min-w-[62px] transition-all duration-300 ${goalFlashSide ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-2 ring-[var(--lamp)] scale-105' : 'bg-[var(--surface)] border-[var(--line)]'}`}>
              <div className="text-xl sm:text-3xl mland:text-lg font-bold font-display tabular leading-none">{gh} - {ga}</div>
              {penResult && <div className="text-[10px] font-bold text-[var(--lamp)] mt-0.5">{penResult.text}</div>}
            </div>
            <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
              <div className="shrink-0 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
                <ClubCrest name={awayOrig.name} size={30} team={awayOrig} club={state.club} isMyClub={awayId === state.me && state.mode === 'm'} />
              </div>
              <div className="min-w-0">
                <div className={`font-bold text-xs sm:text-base mland:text-xs truncate flex items-center gap-1 ${awayId === state.me ? 'text-[var(--g)]' : ''}`}>
                  <span className="truncate">{awayOrig.name}</span>
                  {goalFlashSide === 'A' && <span className="px-1.5 py-0.2 rounded bg-[var(--lamp)] text-[#261900] text-[10px] font-extrabold shrink-0">⚽ +1</span>}
                </div>
                <div className="text-[10px] sm:text-[11px] mland:text-[9px] text-[var(--mut)] flex items-center gap-1">
                  <span>เยือน {awayId === state.me ? '★' : ''}</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shrink-0" style={{ background: awayKit }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Game Broadcast Stage */}
        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-2.5 sm:p-3.5 mland:p-1.5 space-y-2.5 mland:space-y-0 mland:flex mland:flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] mland:grid-cols-[1.32fr_1fr] gap-3 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            {/* Left Stage: Live 2D Pitch / Full-Time Pitch Ratings + MOTM + Match Stats */}
            <div className="space-y-2.5 mland:space-y-1.5 min-w-0 mland:h-full mland:flex mland:flex-col mland:min-h-0 mland:justify-center">
              {!(done && fullTimeAnalysis) ? (
                <div className="relative rounded-2xl mland:rounded-xl overflow-hidden border border-[var(--line)] bg-[#144d2e] shadow-inner mland:mx-auto mland:w-full">
                  <canvas
                    ref={canvasRef}
                    className="w-full aspect-[16/8.2] mland:max-h-[calc(97dvh-106px)] mland:w-auto mland:max-w-full mland:mx-auto block select-none"
                    aria-label="สนามแข่งขัน 2 มิติแบบเรียลไทม์ 11 ต่อ 11"
                  />

                  {/* Halftime Break Tactical Overlay */}
                  {matchPhaseUi === 'halftime' && !done && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 mland:p-1 mland:overflow-y-auto">
                      <div className="w-full max-w-md mland:max-w-sm mland:max-h-full mland:overflow-y-auto rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-3.5 sm:p-4 mland:p-1.5 text-center space-y-2.5 mland:space-y-1 shadow-2xl">
                        <div className="inline-flex items-center gap-1.5 px-3 mland:px-2 py-0.5 rounded-full bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] text-[11px] mland:text-[9px] font-bold">
                          ☕ พักครึ่งเวลา (HALFTIME)
                        </div>
                        <div className="text-lg sm:text-xl mland:text-xs font-bold font-display tabular leading-tight">
                          {homeOrig.name} {gh} - {ga} {awayOrig.name}
                        </div>
                        <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                          ครองบอล {matchStats.possH}%-{100 - matchStats.possH}% · ยิง {matchStats.shotsH}-{matchStats.shotsA} · xG {matchStats.xgH.toFixed(2)}-{matchStats.xgA.toFixed(2)}
                        </div>
                        {!halftimeTalkUsed && (
                          <div className="space-y-1.5 mland:space-y-0.5 pt-1 mland:pt-0">
                            <div className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">
                              {state.mode === 'm' ? '🗣️ สั่งการปลุกใจช่วงพักครึ่ง:' : '⚡ เตรียมความพร้อมครึ่งหลัง:'}
                            </div>
                            {state.mode === 'm' ? (
                              <div className="grid grid-cols-3 gap-1.5 mland:gap-1 text-[11px] mland:text-[9.5px]">
                                <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('attack'); }} className="py-2 mland:py-0.5 px-1.5 rounded-xl mland:rounded-lg bg-[var(--red-soft)] text-[var(--red)] font-bold cursor-pointer hover:brightness-105">
                                  🔥 บุกแหลก
                                </button>
                                <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('balanced'); }} className="py-2 mland:py-0.5 px-1.5 rounded-xl mland:rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-bold cursor-pointer hover:brightness-105">
                                  ⚖️ คงทรงเกม
                                </button>
                                <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('defend'); }} className="py-2 mland:py-0.5 px-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] font-bold cursor-pointer hover:border-[var(--g)]">
                                  🛡️ แน่นไว้
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5 mland:gap-1 text-[11px] mland:text-[9.5px]">
                                <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('fit'); }} className="py-2 mland:py-0.5 px-2 rounded-xl mland:rounded-lg bg-[var(--g-soft)] text-[var(--g)] font-bold cursor-pointer">
                                  💪 วอร์มเติมฟิต (+6%)
                                </button>
                                <button type="button" onClick={() => { setHalftimeTalkUsed(true); handleStartSecondHalf('balanced'); }} className="py-2 mland:py-0.5 px-2 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] font-bold cursor-pointer">
                                  🎯 ลุยครึ่งหลังเลย
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mland:gap-1 pt-1 mland:pt-0">
                          {state.mode === 'm' && (
                            <button
                              type="button"
                              onClick={() => { setShowTacticsDrawer(true); setMlandMatchTab('tactics'); }}
                              className="px-3 mland:px-2 py-2 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[9.5px] font-bold cursor-pointer"
                            >
                              🔄 เปลี่ยนตัว/แผน
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartSecondHalf()}
                            className="flex-1 py-2 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--lamp)] text-[#261900] font-bold text-xs sm:text-sm mland:text-[10px] cursor-pointer hover:brightness-105"
                          >
                            ▶ เริ่มครึ่งหลัง
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (() => {
                const hSlots = getFormationSlots(homeOrig);
                const aSlots = getFormationSlots(awayOrig);
                const buildPitchNodes = (team: Team, xiNames: string[], slots: ReturnType<typeof getFormationSlots>, side: 'H' | 'A', kit: string, gkKit: string) =>
                  xiNames.map((name, i) => {
                    const pl = team.sq.find((q) => q.n === name) || team.sq[i];
                    const slot = slots[i] || { sp: pl?.ro || 'CM', x: 50, y: 50, pos: pl?.pos || 'MF' };
                    const no = pl ? getShirtNo(team, pl) : i + 1;
                    const rt = fullTimeAnalysis.ratings[name] ?? 6.5;
                    const goals = evs.filter((e) => e.t === team.id && e.who === name).length;
                    const assists = evs.filter((e) => e.t === team.id && e.as === name).length;
                    const pCards = fullTimeAnalysis.cards.filter((c) => c.t === team.id && c.who === name);
                    const hasRed = pCards.some((c) => c.type === 'R' || c.type === 'Y2R');
                    const hasYellow = !hasRed && pCards.some((c) => c.type === 'Y');
                    const subOutEv = fullTimeAnalysis.subs.find((s) => s.t === team.id && s.outPlayer === name);
                    const isMotm = fullTimeAnalysis.motm === name;
                    const isMe = Boolean(pl?.me || (isPlayerMode && name === myPlayerName));
                    let xPct = 50;
                    let yPct = 50;
                    if (ftPitchMode === 'all') {
                      xPct = side === 'H' ? clamp(6.5 + ((92 - slot.y) / 78) * 37.5, 6.5, 44) : clamp(93.5 - ((92 - slot.y) / 78) * 37.5, 56, 93.5);
                      yPct = side === 'H' ? clamp(12 + (slot.x / 100) * 76, 12, 86) : clamp(88 - (slot.x / 100) * 76, 12, 86);
                    } else {
                      xPct = clamp(9 + ((92 - slot.y) / 78) * 82, 9, 91);
                      yPct = clamp(13 + (slot.x / 100) * 74, 13, 86);
                    }
                    const nodeKit = slot.pos === 'GK' ? gkKit : kit;
                    const nodeTrim = slot.pos === 'GK' ? '#ffffff' : side === 'H' ? homeTrim : awayTrim;
                    return {
                      name,
                      shortName: name.split(' ')[0] || name,
                      player: pl,
                      team,
                      side,
                      no,
                      role: slot.sp,
                      rt,
                      goals,
                      assists,
                      hasRed,
                      hasYellow,
                      subOutEv,
                      isMotm,
                      isMe,
                      xPct,
                      yPct,
                      kit: nodeKit,
                      trim: nodeTrim
                    };
                  });

                const homeNodes = buildPitchNodes(homeOrig, initialHomeXi, hSlots, 'H', homeKit, homeGkKit);
                const awayNodes = buildPitchNodes(awayOrig, initialAwayXi, aSlots, 'A', awayKit, awayGkKit);
                const visibleNodes = ftPitchMode === 'H' ? homeNodes : ftPitchMode === 'A' ? awayNodes : [...homeNodes, ...awayNodes];

                const motmHome = homeOrig.sq.find((q) => q.n === fullTimeAnalysis.motm);
                const motmAway = awayOrig.sq.find((q) => q.n === fullTimeAnalysis.motm);
                const motmPlayer = motmHome || motmAway;
                const motmTeam = motmHome ? homeOrig : awayOrig;
                const motmNo = motmPlayer ? getShirtNo(motmTeam, motmPlayer) : 10;
                const motmRt = fullTimeAnalysis.ratings[fullTimeAnalysis.motm] ?? 8.2;
                const motmGoals = evs.filter((e) => e.t === motmTeam.id && e.who === fullTimeAnalysis.motm).length;
                const motmAssists = evs.filter((e) => e.t === motmTeam.id && e.as === fullTimeAnalysis.motm).length;

                const pickedInfo = ftPickedPlayer
                  ? (() => {
                      const t = homeOrig.sq.find((q) => q.n === ftPickedPlayer) ? homeOrig : awayOrig;
                      const p = t.sq.find((q) => q.n === ftPickedPlayer);
                      const no = p ? getShirtNo(t, p) : 0;
                      const rt = fullTimeAnalysis.ratings[ftPickedPlayer] ?? 6.5;
                      const gl = evs.filter((e) => e.t === t.id && e.who === ftPickedPlayer).length;
                      const as = evs.filter((e) => e.t === t.id && e.as === ftPickedPlayer).length;
                      const subIn = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.inPlayer === ftPickedPlayer);
                      const subOut = fullTimeAnalysis.subs.find((s) => s.t === t.id && s.outPlayer === ftPickedPlayer);
                      const cards = fullTimeAnalysis.cards.filter((c) => c.t === t.id && c.who === ftPickedPlayer);
                      return { name: ftPickedPlayer, team: t, role: p?.ro || 'CM', no, rt, gl, as, subIn, subOut, cards };
                    })()
                  : null;

                const ratingBadgeCls = (rt: number, isMotm: boolean) =>
                  isMotm || rt >= 8.5
                    ? 'bg-[#facc15] text-[#1c1300] border-[#fef08a]'
                    : rt >= 7.4
                      ? 'bg-emerald-500 text-white border-emerald-200/80'
                      : rt >= 6.4
                        ? 'bg-slate-800 text-white border-slate-400/60'
                        : 'bg-rose-600 text-white border-rose-200/80';

                return (
                  <div className="rounded-2xl overflow-hidden border border-[var(--line)] bg-[#0c351f] shadow-lg mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
                    {/* Pitch Top Bar */}
                    <div className="px-3 py-2 mland:px-2 mland:py-0.5 bg-[#072113] border-b border-white/15 flex flex-wrap items-center justify-between gap-2 mland:gap-1 text-white shrink-0">
                      <span className="text-xs mland:text-[9.5px] font-bold flex items-center gap-1">
                        🏟️ เรตติ้งในสนาม &amp; MOTM
                      </span>
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/10 text-[10px] sm:text-[11px] mland:text-[9px]">
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('all')}
                          className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap ${ftPitchMode === 'all' ? 'bg-emerald-500 text-white shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          11v11 ทั้งสนาม
                        </button>
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('H')}
                          className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap max-w-[100px] truncate ${ftPitchMode === 'H' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          {homeOrig.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFtPitchMode('A')}
                          className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap max-w-[100px] truncate ${ftPitchMode === 'A' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/75 hover:text-white'}`}
                        >
                          {awayOrig.name}
                        </button>
                      </div>
                    </div>

                    {/* Full-Time Turf Stage */}
                    <div
                      className="relative w-full aspect-[16/10] sm:aspect-[16/9.2] min-h-[290px] sm:min-h-[340px] mland:min-h-0 mland:aspect-auto mland:flex-1 select-none overflow-hidden"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(90deg, #175c36 0%, #175c36 8.333%, #1d6b40 8.333%, #1d6b40 16.666%)'
                      }}
                    >
                      {/* Stadium Light Vignette */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.34) 100%)' }}
                      />

                      {/* Pitch Line Markings SVG */}
                      <svg viewBox="0 0 1000 560" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                        <g stroke="rgba(240,253,244,0.68)" strokeWidth="2.5" fill="none">
                          <rect x="26" y="20" width="948" height="520" />
                          <line x1="500" y1="20" x2="500" y2="540" />
                          <circle cx="500" cy="280" r="76" />
                          <circle cx="500" cy="280" r="4" fill="rgba(240,253,244,0.85)" />
                          {/* Left Penalty Area */}
                          <rect x="26" y="130" width="145" height="300" />
                          <rect x="26" y="205" width="52" height="150" />
                          <circle cx="122" cy="280" r="3" fill="rgba(240,253,244,0.85)" />
                          <path d="M 171 214 A 72 72 0 0 1 171 346" />
                          {/* Right Penalty Area */}
                          <rect x="829" y="130" width="145" height="300" />
                          <rect x="922" y="205" width="52" height="150" />
                          <circle cx="878" cy="280" r="3" fill="rgba(240,253,244,0.85)" />
                          <path d="M 829 214 A 72 72 0 0 0 829 346" />
                          {/* Goals */}
                          <rect x="10" y="232" width="16" height="96" strokeWidth="2" />
                          <rect x="974" y="232" width="16" height="96" strokeWidth="2" />
                        </g>
                      </svg>

                      {/* Selected Player Detail Inspector Popover */}
                      {pickedInfo && (
                        <div className="absolute top-2 left-2 z-30 max-w-[260px] px-2.5 py-1.5 rounded-xl bg-slate-950/92 border border-white/25 text-white text-[11px] shadow-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold truncate">
                              #{pickedInfo.no} · {pickedInfo.role} · {pickedInfo.name}
                            </div>
                            <div className="text-[10px] text-white/75 flex flex-wrap items-center gap-1.5 tabular">
                              <span>{pickedInfo.team.name}</span>
                              <span className="text-[#facc15] font-bold">⭐ {pickedInfo.rt.toFixed(1)}</span>
                              {pickedInfo.gl > 0 && <span>⚽{pickedInfo.gl}</span>}
                              {pickedInfo.as > 0 && <span>🎯{pickedInfo.as}</span>}
                              {pickedInfo.cards.map((c, idx) => (
                                <span key={idx}>{c.type === 'Y' ? '🟨' : '🟥'}</span>
                              ))}
                              {pickedInfo.subOut && <span>↓{pickedInfo.subOut.m}&apos;</span>}
                              {pickedInfo.subIn && <span>↑{pickedInfo.subIn.m}&apos;</span>}
                            </div>
                          </div>
                          <button type="button" onClick={() => setFtPickedPlayer(null)} className="text-white/65 hover:text-white font-bold px-1 cursor-pointer">
                            ✕
                          </button>
                        </div>
                      )}

                      {/* 22 (or 11) Player Nodes on Pitch */}
                      {visibleNodes.map((n) => {
                        const sizeCls = ftPitchMode === 'all' ? 'w-8 h-8 sm:w-9 sm:h-9 mland:w-6 mland:h-6' : 'w-10 h-10 sm:w-11 sm:h-11 mland:w-7 mland:h-7';
                        const faceSize = ftPitchMode === 'all' ? 35 : 43;
                        return (
                          <button
                            key={`${n.side}-${n.name}`}
                            type="button"
                            onClick={() => setFtPickedPlayer((prev) => (prev === n.name ? null : n.name))}
                            style={{ left: `${n.xPct}%`, top: `${n.yPct}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer focus:outline-none ${n.isMotm ? 'z-20' : 'z-10 hover:z-20'}`}
                          >
                            {/* MOTM Crown Tag */}
                            {n.isMotm && (
                              <div className="mb-0.5 mland:mb-0 px-1.5 mland:px-1 py-0.2 rounded-full bg-[#facc15] text-[#1c1300] text-[8px] sm:text-[9px] mland:text-[7px] font-black shadow-md whitespace-nowrap tracking-wide border border-white/80">
                                👑 MOTM
                              </div>
                            )}

                            {/* Player Portrait Circle + Position + Rating + Number + Event Icons */}
                            <div className="relative">
                              <div
                                className={`${sizeCls} rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110 mland:[&_svg]:w-full mland:[&_svg]:h-full ${
                                  n.isMotm
                                    ? 'ring-2 ring-[#facc15] shadow-[0_0_16px_rgba(250,204,21,0.8)] border-2 border-white'
                                    : n.isMe
                                      ? 'ring-2 ring-amber-300 border-2 border-white shadow-md'
                                      : 'border-2 mland:border border-white/95 shadow-md'
                                }`}
                                style={{ backgroundColor: n.kit }}
                              >
                                <PlayerFace
                                  player={n.player || { n: n.name, no: n.no, pos: n.role === 'GK' ? 'GK' : 'MF' }}
                                  team={n.team}
                                  state={state}
                                  careerProfile={state.p}
                                  size={faceSize}
                                  kitColor={n.kit}
                                  trimColor={n.trim}
                                  bare
                                />
                              </div>

                              {/* Position Tag (Top-Left) */}
                              <span className="absolute -top-1.5 -left-2 mland:-top-1 mland:-left-1.5 px-1 mland:px-0.5 py-0.2 rounded bg-slate-950/90 border border-white/30 text-white text-[7.5px] sm:text-[8.5px] mland:text-[6.5px] font-extrabold leading-none">
                                {n.role}
                              </span>

                              {/* Rating Badge (Top-Right) */}
                              <span
                                className={`absolute -top-1.5 -right-2.5 mland:-top-1 mland:-right-2 px-1 mland:px-0.5 py-0.2 rounded border text-[8.5px] sm:text-[9.5px] mland:text-[7px] font-black tabular leading-none shadow-sm ${ratingBadgeCls(
                                  n.rt,
                                  n.isMotm
                                )}`}
                              >
                                {n.rt.toFixed(1)}
                              </span>

                              {/* Shirt Number Badge (Bottom-Left) */}
                              <span className="absolute -bottom-1 -left-1.5 mland:-left-1 px-1 mland:px-0.5 py-0.2 rounded bg-[#0b2018]/95 border border-white/30 text-[#ffd75e] text-[7.5px] sm:text-[8.5px] mland:text-[6.5px] font-extrabold tabular leading-none">
                                {n.no}
                              </span>

                              {/* Event Micro-Badges (Bottom-Right) */}
                              {(n.goals > 0 || n.assists > 0 || n.hasRed || n.hasYellow || n.subOutEv) && (
                                <div className="absolute -bottom-1 -right-2.5 mland:-right-2 flex items-center gap-0.5 text-[9px] mland:text-[7px] leading-none drop-shadow">
                                  {n.goals > 0 && <span>{n.goals > 1 ? `⚽${n.goals}` : '⚽'}</span>}
                                  {n.assists > 0 && <span>🎯</span>}
                                  {n.hasRed && <span>🟥</span>}
                                  {n.hasYellow && <span>🟨</span>}
                                  {n.subOutEv && <span className="px-0.5 rounded bg-black/80 text-rose-300 text-[7.5px] mland:text-[6.5px] font-bold">↓</span>}
                                </div>
                              )}
                            </div>

                            {/* Player Nameplate */}
                            <div
                              className={`mt-0.5 mland:mt-0 px-1.5 mland:px-1 py-0.2 rounded text-[8.5px] sm:text-[10px] mland:text-[7.5px] font-bold leading-tight truncate max-w-[68px] sm:max-w-[92px] mland:max-w-[54px] shadow-xs ${
                                n.isMotm
                                  ? 'bg-[#facc15] text-[#1c1300]'
                                  : n.isMe
                                    ? 'bg-amber-400/95 text-[#1c1300]'
                                    : 'bg-[#05120b]/88 text-white/95'
                              }`}
                            >
                              {ftPitchMode === 'all' ? n.shortName : n.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Substitutes Who Played Touchline Strip (Inside Pitch Card) */}
                    {fullTimeAnalysis.subs.length > 0 && (
                      <div className="px-3 py-1.5 mland:px-2 mland:py-0.5 bg-[#082414] border-t border-white/10 flex flex-wrap mland:flex-nowrap mland:overflow-x-auto items-center gap-1.5 mland:gap-1 text-[10px] mland:text-[9px] text-white/90 shrink-0">
                        <span className="font-bold text-white/70 shrink-0">🔄 สำรอง:</span>
                        {fullTimeAnalysis.subs.map((sb, idx) => {
                          const subTeam = sb.t === homeOrig.id ? homeOrig : awayOrig;
                          const subSideKit = sb.t === homeOrig.id ? homeKit : awayKit;
                          const subPl = subTeam.sq.find((q) => q.n === sb.inPlayer);
                          const subNo = subPl ? getShirtNo(subTeam, subPl) : 0;
                          const subRt = fullTimeAnalysis.ratings[sb.inPlayer] ?? 6.5;
                          const isSubMotm = fullTimeAnalysis.motm === sb.inPlayer;
                          const subGl = evs.filter((e) => e.t === subTeam.id && e.who === sb.inPlayer).length;
                          const subAs = evs.filter((e) => e.t === subTeam.id && e.as === sb.inPlayer).length;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFtPickedPlayer(sb.inPlayer)}
                              className={`inline-flex items-center gap-1 px-1.5 mland:px-1 py-0.5 mland:py-0 rounded border text-[10px] mland:text-[9px] tabular cursor-pointer shrink-0 ${
                                isSubMotm ? 'bg-[#facc15] text-[#1c1300] border-white font-extrabold' : 'bg-white/10 border-white/15 hover:bg-white/20'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full border border-white/70 shrink-0" style={{ background: subSideKit }} />
                              <span className="font-bold">#{subNo}</span>
                              <span className="opacity-80">{subPl?.ro || 'MF'}</span>
                              <span>{sb.inPlayer.split(' ')[0]}</span>
                              <span className={`px-1 rounded font-black ${isSubMotm ? 'bg-[#1c1300] text-[#facc15]' : 'bg-black/40 text-emerald-300'}`}>
                                {subRt.toFixed(1)}
                              </span>
                              {subGl > 0 && <span>⚽{subGl > 1 ? subGl : ''}</span>}
                              {subAs > 0 && <span>🎯</span>}
                              {isSubMotm && <span>👑</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Integrated MOTM Broadcast Banner Inside Pitch Frame */}
                    <div
                      className="px-3 py-2 mland:px-2 mland:py-0.5 border-t border-[#facc15]/45 flex items-center justify-between gap-2.5 mland:gap-1.5 text-white shrink-0"
                      style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.22) 0%, rgba(10,33,20,0.96) 55%, rgba(7,22,14,0.98) 100%)' }}
                    >
                      <div className="flex items-center gap-2.5 mland:gap-1.5 min-w-0">
                        <div className="shrink-0 mland:[&_svg]:w-7 mland:[&_svg]:h-7">
                          <PlayerFace
                            player={motmPlayer || { n: fullTimeAnalysis.motm }}
                            team={motmTeam}
                            state={state}
                            careerProfile={motmPlayer?.me ? state.p : null}
                            size={38}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] mland:text-[8.5px] font-extrabold text-[#facc15] tracking-wide flex items-center gap-1.5 leading-tight">
                            <span>👑 MAN OF THE MATCH</span>
                            <span className="text-white/70 truncate">· {motmTeam.name}</span>
                          </div>
                          <div className="text-xs sm:text-sm mland:text-[10.5px] font-bold truncate flex items-center gap-1.5 mland:gap-1 leading-tight">
                            <span className="px-1.5 mland:px-1 py-0.2 rounded bg-white/15 text-[10px] mland:text-[8.5px] font-extrabold tabular">
                              #{motmNo} {motmPlayer?.ro || ''}
                            </span>
                            <span className="truncate">{fullTimeAnalysis.motm}</span>
                            {motmGoals > 0 && <span className="text-xs mland:text-[10px]">⚽{motmGoals > 1 ? motmGoals : ''}</span>}
                            {motmAssists > 0 && <span className="text-xs mland:text-[10px]">🎯{motmAssists > 1 ? motmAssists : ''}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[9px] mland:text-[8px] text-[#fde047] font-bold leading-none">RATING</div>
                        <div className="text-lg sm:text-xl mland:text-sm font-black tabular text-[#facc15] leading-none">{motmRt.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Live Penalty Shootout Strip */}
              {shootoutUi && (
                <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--lamp)]/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#8a5b00] dark:text-[var(--lamp)]">
                      🎯 ดวลจุดโทษตัดสิน (รอบที่ {shootoutUi.round})
                    </span>
                    <span className="font-bold tabular text-sm">
                      {shootoutUi.hScore} - {shootoutUi.aScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                      <span className="font-bold truncate max-w-[110px]">{homeOrig.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(5, shootoutUi.hKicks.length) }).map((_, i) => {
                          const res = shootoutUi.hKicks[i];
                          return (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                              }`}
                            >
                              {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]">
                      <span className="font-bold truncate max-w-[110px]">{awayOrig.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(5, shootoutUi.aKicks.length) }).map((_, i) => {
                          const res = shootoutUi.aKicks[i];
                          return (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                res === 'G' ? 'bg-[var(--g)] text-white' : res === 'M' ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--mut)]'
                              }`}
                            >
                              {res === 'G' ? '✓' : res === 'M' ? '✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--mut)] flex items-center justify-between gap-2">
                    <span className="truncate">{shootoutUi.lastMsg}</span>
                    {!shootoutUi.finished && (
                      <span className="shrink-0 font-semibold text-[var(--ink)]">
                        คนยิง: {shootoutUi.kickerName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Desktop/Portrait Match Stats + Live Pitch Energy & Alerts (hidden on mobile landscape, shown in Right Stage Stats tab) */}
              <div className="space-y-2.5 mland:hidden">
                {renderMatchStatsPanel()}
                {renderLiveEnergyPanel()}
              </div>
            </div>

            {/* Right Stage: Unified Match Events Feed (including Substitutions) & Mobile Landscape Tabbed Pane */}
            <div className="space-y-2.5 mland:space-y-1.5 min-w-0 mland:h-full mland:flex mland:flex-col mland:min-h-0">
              {/* Mobile Landscape Only Tab Bar */}
              <div className={`hidden mland:grid shrink-0 gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[10px] ${state.mode === 'm' && !done ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('events')}
                  className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer whitespace-nowrap truncate ${mlandMatchTab === 'events' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                >
                  🎙️ เกม
                </button>
                <button
                  type="button"
                  onClick={() => setMlandMatchTab('stats')}
                  className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap truncate ${mlandMatchTab === 'stats' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                >
                  <span>📊 สถิติ</span>
                  {subAlertItems.length > 0 && (
                    <span className="px-1 rounded-full bg-[var(--red)] text-white text-[8.5px] font-black leading-tight tabular">
                      {subAlertItems.length}
                    </span>
                  )}
                </button>
                {state.mode === 'm' && !done && (
                  <button
                    type="button"
                    onClick={() => {
                      setMlandMatchTab('tactics');
                      setShowTacticsDrawer(true);
                      setPaused(true);
                    }}
                    className={`min-h-[26px] py-0.5 px-1 rounded-lg font-bold cursor-pointer whitespace-nowrap truncate ${mlandMatchTab === 'tactics' ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                  >
                    ⚡ แผน ({5 - subsUsed.length})
                  </button>
                )}
              </div>

              <div className="mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden space-y-2.5 mland:space-y-1">
                <div className={`p-2.5 sm:p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-2 mland:space-y-1 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col ${mlandMatchTab === 'events' ? '' : 'mland:hidden'}`}>
                  <div className="flex items-center justify-between gap-1 pb-1.5 mland:pb-1 border-b border-[var(--line)]/60 shrink-0 overflow-x-auto">
                    <span className="text-[11px] mland:text-[9.5px] font-bold text-[var(--mut)] uppercase tracking-wide whitespace-nowrap shrink-0">
                      🎙️ เหตุการณ์
                    </span>
                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] mland:text-[8.5px] shrink-0">
                      {(
                        [
                          ['all', 'ทั้งหมด'],
                          ['goal', '⚽ ประตู'],
                          ['card', '🟨🟥 VAR'],
                          ['sub', `🔄 เปลี่ยน${subLog.length ? ` (${subLog.length})` : ''}`]
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setEventFilter(k)}
                          className={`px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                            eventFilter === k ? 'bg-[var(--g)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-56 lg:max-h-[340px] mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto space-y-1 pr-0.5">
                    {eventFilter === 'sub' ? (
                      subLog.length === 0 ? (
                        <div className="text-xs text-[var(--mut)] py-6 text-center">ยังไม่มีการเปลี่ยนตัวในแมตช์นี้</div>
                      ) : (
                        subLog
                          .slice()
                          .reverse()
                          .map((sb, i) => {
                            const tObj = sb.t === homeOrig.id ? homeOrig : awayOrig;
                            return (
                              <div key={i} className="text-xs mland:text-[10.5px] flex items-start gap-2 py-1 px-1.5 rounded-lg bg-blue-500/8">
                                <span className="w-7 shrink-0 tabular font-bold text-blue-600 dark:text-blue-400">{sb.m}&apos;</span>
                                <div className="min-w-0">
                                  <span className="font-bold text-[var(--ink)]">{tObj.name}: </span>
                                  <span className="font-semibold text-[var(--g)]">🟢 {sb.inPlayer}</span>
                                  <span className="text-[var(--mut)]"> แทน </span>
                                  <span className="text-[var(--red)]">🔴 {sb.outPlayer}</span>
                                </div>
                              </div>
                            );
                          })
                      )
                    ) : (() => {
                      const filteredLogs = logs.filter((l) => {
                        if (eventFilter === 'goal') return l.tone === 'goal';
                        if (eventFilter === 'card') return l.tone === 'card' || l.text.includes('VAR') || l.text.includes('จุดโทษ');
                        return true;
                      });
                      if (!filteredLogs.length) {
                        return <div className="text-xs text-[var(--mut)] py-6 text-center">ยังไม่มีเหตุการณ์ในหมวดนี้</div>;
                      }
                      return filteredLogs.map((l, i) => (
                        <div
                          key={i}
                          className={`text-xs mland:text-[10.5px] flex items-start gap-2 rounded-lg transition-colors ${
                            l.tone === 'goal'
                              ? 'px-2 py-1 bg-[var(--g-soft)] border border-[var(--g)]/25 font-bold text-[var(--g)]'
                              : l.tone === 'card'
                                ? 'px-2 py-1 bg-[var(--red-soft)] border border-[var(--red)]/20 font-semibold text-[var(--red)]'
                                : l.tone === 'sub'
                                  ? 'px-2 py-0.5 bg-blue-500/8 font-semibold text-blue-600 dark:text-blue-400'
                                  : l.tone === 'sys'
                                    ? 'px-1 py-0.5 font-semibold text-[var(--ink)]'
                                    : 'px-1 py-0.5 text-[var(--mut)]'
                          }`}
                        >
                          <span className="w-7 shrink-0 tabular font-bold">{l.m}&apos;</span>
                          <span>{l.text}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Mobile Landscape Stats & Energy / Tactics Tab Content */}
                {mlandMatchTab !== 'events' && (
                  <div className="hidden mland:block mland:flex-1 mland:min-h-0 mland:overflow-y-auto pr-0.5 space-y-2">
                    {mlandMatchTab === 'stats' && (
                      <div className="space-y-2">
                        {renderMatchStatsPanel()}
                        {renderLiveEnergyPanel()}
                      </div>
                    )}
                    {mlandMatchTab === 'tactics' && state.mode === 'm' && !done && renderLiveTacticsPanel()}
                  </div>
                )}

                {done && fullTimeAnalysis?.pf && (
                  <div className="p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[11px] shrink-0">
                    {fullTimeAnalysis.pf.played === false ? (
                      <span className="font-semibold text-[var(--mut)]">
                        {myInitialBanned ? '🟥 ไม่ได้ลงสนาม (ติดโทษแบน)' : '🪑 ตัวสำรองไม่ได้ถูกส่งลงสนาม (0 นาที)'}
                      </span>
                    ) : (
                      <>
                        <span>
                          ฟอร์มคุณ ({fullTimeAnalysis.pf.mins} น.): <b>⭐ {fullTimeAnalysis.pf.rt.toFixed(1)}</b> · ⚽ {fullTimeAnalysis.pf.gl} · 🎯 {fullTimeAnalysis.pf.as}
                          {fullTimeAnalysis.pf.subIn ? ' · 🟢 สำรอง' : ''}
                          {fullTimeAnalysis.pf.subOut ? ' · 🔴 เปลี่ยนออก' : ''}
                          {(fullTimeAnalysis.pf.yc || 0) > 0 ? ' · 🟨' : ''}
                          {(fullTimeAnalysis.pf.rc || 0) > 0 ? ' · 🟥' : ''}
                        </span>
                        {fullTimeAnalysis.pf.pts > 0 && (
                          <span className="font-bold text-[var(--g)]">+{fullTimeAnalysis.pf.pts} แต้มพัฒนา!</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manager Live Tactics & Substitutions Drawer (Desktop / Mobile Portrait) */}
          {state.mode === 'm' && showTacticsDrawer && !done && (
            <div className="mland:hidden">{renderLiveTacticsPanel()}</div>
          )}
        </div>

        {/* Pinned Bottom Match Action Dock */}
        <div className="shrink-0 px-3 sm:px-4 py-2 mland:px-2.5 mland:py-1 bg-[var(--surface-2)] border-t border-[var(--line)]">
          {!done ? (
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 mland:gap-1.5 flex-nowrap overflow-x-auto">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="min-h-[34px] mland:min-h-[30px] px-2.5 sm:px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {paused ? '▶ เล่นต่อ' : '⏸ พักเกม'}
                </button>
                <div className="inline-flex items-center p-0.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)] shrink-0">
                  {([1, 2, 4] as const).map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpeed(sp)}
                      className={`min-h-[28px] mland:min-h-[24px] px-2 sm:px-2.5 mland:px-2 py-0.5 rounded-lg mland:rounded-md text-xs mland:text-[10px] font-bold cursor-pointer tabular transition-colors whitespace-nowrap ${speed === sp ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'}`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRunVectors((v) => !v)}
                  className={`min-h-[34px] mland:min-h-[30px] px-2 sm:px-2.5 mland:px-2 py-1 mland:py-0.5 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${showRunVectors ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/50 text-[#8a5b00] dark:text-[var(--lamp)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--mut)]'}`}
                >
                  {showRunVectors ? '↗️ เส้น: เปิด' : '↗️ เส้น: ปิด'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 mland:gap-1 ml-auto shrink-0">
                {state.mode === 'm' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTacticsDrawer((v) => !v);
                      setMlandMatchTab((prev) => (prev === 'tactics' ? 'events' : 'tactics'));
                      setPaused(true);
                    }}
                    className="min-h-[34px] mland:min-h-[30px] px-2.5 sm:px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--g-soft)] border border-[var(--g)] text-[var(--g)] text-xs mland:text-[10px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    🔄 แก้เกม ({subsUsed.length}/5)
                  </button>
                )}
                {matchPhaseUi === 'halftime' ? (
                  <button
                    type="button"
                    onClick={() => handleStartSecondHalf()}
                    className="min-h-[34px] mland:min-h-[30px] px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    ▶ เริ่มครึ่งหลัง
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={skipToEnd}
                    className="min-h-[34px] mland:min-h-[30px] px-3 mland:px-2.5 py-1 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--lamp)] text-[#261900] text-xs mland:text-[10px] font-bold cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {matchPhaseUi === 'shootout' ? '⏩ ข้ามดวลจุดโทษ' : '⏩ ข้ามจบเกม'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirmFinish}
              className="w-full py-2.5 sm:py-3 mland:py-1.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-sm mland:text-xs hover:brightness-105 cursor-pointer shadow-sm"
            >
              ✅ ดำเนินการต่อ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerInspectorModal: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ player, team, state, onClose, onUpdateState, onToast }) => {
  const liveTeam = team ? state.teams[team.id] || team : null;
  const livePlayer = liveTeam ? liveTeam.sq.find((q) => q.n === player.n) || player : player;
  const isMyTeam = !!liveTeam && liveTeam.id === state.me;
  const isMePlayer = !!livePlayer.me || (state.mode === 'p' && state.p?.name === livePlayer.n);
  const currentNo = liveTeam ? getShirtNo(liveTeam, livePlayer) : livePlayer.no || 10;
  const info = dtInfo(livePlayer, isMePlayer ? state.p : null);
  const [shirtNo, setShirtNo] = useState(String(currentNo));
  const isCap = !!liveTeam && liveTeam.cap === livePlayer.n;
  const con = liveTeam ? ensureCon(livePlayer) : null;
  const sigLabel = SIGL[info.D0.sig] || info.D0.sig;

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-2xl mland:max-w-[96vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 text-white flex items-center justify-between gap-3 mland:gap-2" style={{ background: `linear-gradient(135deg, ${ovColor(livePlayer.ov)}, #0d2218 82%)` }}>
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="shrink-0 mland:[&_svg]:w-10 mland:[&_svg]:h-10">
              <PlayerFace
                player={{ ...livePlayer, no: currentNo }}
                team={liveTeam}
                state={state}
                careerProfile={isMePlayer ? state.p : null}
                size={64}
                bare
              />
            </div>
            <div className="min-w-0 space-y-0.5 mland:space-y-0">
              <div className="font-bold text-base sm:text-lg mland:text-xs truncate flex items-center gap-1.5">
                {isMePlayer && <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">ฉัน</span>}
                <span className="opacity-85 tabular">#{currentNo}</span>
                <span className="truncate">{livePlayer.n}</span>
                {isCap && <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] mland:text-[8.5px] font-bold shrink-0">© กัปตัน</span>}
              </div>
              <div className="text-xs mland:text-[9.5px] opacity-90 flex items-center gap-1.5 flex-wrap">
                {liveTeam && <ClubCrest name={liveTeam.name} size={16} team={liveTeam} club={state.club} isMyClub={isMyTeam && state.mode === 'm'} />}
                <span>{liveTeam ? liveTeam.name : livePlayer.free ? 'ฟรีเอเยนต์' : 'ตลาดซื้อขาย'}</span>
                <span>· {livePlayer.ro} ({SPN[livePlayer.ro]})</span>
                <span>· อายุ {livePlayer.age} ปี ({info.gro})</span>
              </div>
              <div className="text-[11px] mland:text-[9px] opacity-85 flex flex-wrap items-center gap-x-2">
                <span>{info.TR[0]}</span>
                <span>· ศักยภาพ {livePlayer.pot}</span>
                <span>· {info.stTxt}</span>
                {((livePlayer.yc || 0) > 0 || (livePlayer.rc || 0) > 0) && (
                  <span>· 🟨 {livePlayer.yc || 0}/3 · 🟥 {livePlayer.rc || 0}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-2xl sm:text-3xl mland:text-lg font-bold font-display leading-none tabular">{livePlayer.ov}</div>
            <div className="text-[10px] mland:text-[8.5px] opacity-80">OVR</div>
            <button type="button" onClick={onClose} className="mt-1.5 mland:mt-0.5 px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs mland:text-[10px] font-bold cursor-pointer">ปิด ✕</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-0 mland:grid mland:grid-cols-[0.95fr_1.05fr] mland:gap-2">
          <div className="contents mland:block mland:h-full mland:overflow-y-auto mland:pr-1 mland:space-y-1.5">
            {/* Trait & Signature Spotlight */}
            <div className="px-3 mland:px-2 py-2 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
              <span className="text-[var(--mut)]">{info.TR[0]}: <b className="text-[var(--ink)] font-semibold">{info.TR[1]}</b></span>
              <span className="font-bold text-[var(--g)]">⭐ จุดเด่น: {sigLabel}</span>
            </div>

            {/* 5 Core Attributes with bars */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mland:gap-1">
              {ATT.map(([k, l]) => {
                const val = info.a[k];
                return (
                  <div key={k} className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)] text-center">
                    <div className="text-base mland:text-xs font-bold tabular leading-tight" style={{ color: statBarColor(val) }}>{val}</div>
                    <div className="text-[11px] mland:text-[9px] text-[var(--mut)] mb-1 mland:mb-0.5">{l}</div>
                    <div className="h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(10, Math.min(100, val))}%`, background: statBarColor(val) }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Season & Contract summary */}
            <div className="grid grid-cols-3 sm:grid-cols-6 mland:grid-cols-3 gap-2 mland:gap-1 text-center text-xs mland:text-[10px]">
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ลงเล่น</div><b className="tabular">{livePlayer.sp || 0}</b></div>
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ประตู</div><b className="tabular">⚽ {livePlayer.sg || 0}</b></div>
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">แอสซิสต์</div><b className="tabular">🎯 {livePlayer.sa || 0}</b></div>
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">{livePlayer.pos === 'GK' ? 'คลีนชีต' : 'เหลือง/แดง'}</div><b className="tabular">{livePlayer.pos === 'GK' ? `🧤 ${livePlayer.cs || 0}` : `🟨${livePlayer.yc || 0} 🟥${livePlayer.rc || 0}`}</b></div>
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">ค่าตัว</div><b className="tabular">{vlu(livePlayer)}k ฿</b></div>
              <div className="p-2 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]"><div className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">สัญญา/เหนื่อย</div><b className="tabular">{con ? `${con.yr}ปี · ${con.wg}k` : `${wagOf(livePlayer)}k`}</b></div>
            </div>

            {isMyTeam && state.mode === 'm' && (
              <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">เบอร์เสื้อ</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={shirtNo}
                    onChange={(e) => setShirtNo(e.target.value)}
                    className="w-16 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs text-center tabular"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = clamp(parseInt(shirtNo, 10) || currentNo, 1, 99);
                      onUpdateState((d) => {
                        const sq = d.teams[d.me].sq;
                        const pl = sq.find((q) => q.n === livePlayer.n);
                        if (!pl) return;
                        const oldNo = getShirtNo(d.teams[d.me], pl);
                        const holder = sq.find((q) => q !== pl && q.no === n);
                        if (holder) {
                          holder.no = oldNo;
                          if (Array.isArray(holder.vis) && holder.vis.length >= 6) holder.vis[5] = oldNo;
                        }
                        pl.no = n;
                        if (Array.isArray(pl.vis) && pl.vis.length >= 6) pl.vis[5] = n;
                        if (pl.me && d.p) d.p.no = n;
                      });
                      setShirtNo(String(n));
                      onToast(`เปลี่ยนเบอร์เสื้อ ${livePlayer.n} เป็น #${n}`);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--g)] text-white text-xs font-bold cursor-pointer"
                  >
                    บันทึก
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState((d) => {
                      d.teams[d.me].cap = livePlayer.n;
                    });
                    onToast(`แต่งตั้ง ${livePlayer.n} เป็นกัปตันทีม`);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${isCap ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface)] border border-[var(--line)]'}`}
                >
                  {isCap ? '© กัปตันทีมคนปัจจุบัน' : 'ตั้งเป็นกัปตันทีม'}
                </button>
              </div>
            )}
          </div>

          {/* Detailed Sub-attributes with progress bars */}
          <div className="contents mland:block mland:h-full mland:overflow-y-auto mland:pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2.5 mland:gap-1.5">
              {info.G.map(([grp, rows]) => (
                <div key={grp} className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/75 space-y-0.5">
                  <div className="font-bold text-xs mland:text-[11px] mb-1.5 mland:mb-1 pb-1 border-b border-[var(--line)]/60">{grp}</div>
                  {rows.map(([lbl, val, statKey]) => (
                    <StatBarRow
                      key={lbl}
                      label={lbl}
                      value={val}
                      isSig={!!(statKey && statKey === info.D0.sig)}
                      compact
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

const TeamInspectorModal: React.FC<{
  team: Team;
  state: GameState;
  onClose: () => void;
  onInspectPlayer: (p: Player, t: Team) => void;
}> = ({ team, state, onClose, onInspectPlayer }) => {
  const [posFilter, setPosFilter] = useState<'ALL' | 'XI' | Position>('ALL');
  const st = teamStats(team, state);
  const myTeam = state.teams[state.me];
  const mySt = teamStats(myTeam, state);
  const isMeTeam = team.id === state.me;
  const tierTable = sortTable(state.teams.filter((t) => t.tier === team.tier));
  const rank = team.tier < 3 ? tierTable.findIndex((t) => t.id === team.id) + 1 : null;
  const starters = xi(team);
  const starterNames = new Set(starters.map((q) => q.n));
  const topScorer = team.sq.slice().sort((a, b) => (b.sg || 0) - (a.sg || 0) || b.ov - a.ov)[0];
  const topAssist = team.sq.slice().sort((a, b) => (b.sa || 0) - (a.sa || 0) || b.ov - a.ov)[0];
  const totalVal = team.sq.reduce((s, q) => s + vlu(q), 0);
  const formChars = (team.fm || '').slice(-5).split('');
  const gd = team.gf - team.ga;

  const filteredSquad = useMemo(() => {
    const base = team.sq.slice().sort((a, b) => {
      const aIn = starterNames.has(a.n) ? 1 : 0;
      const bIn = starterNames.has(b.n) ? 1 : 0;
      return bIn - aIn || b.ov - a.ov;
    });
    if (posFilter === 'XI') return base.filter((q) => starterNames.has(q.n));
    if (posFilter === 'ALL') return base;
    return base.filter((q) => q.pos === posFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.sq, posFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl mland:max-w-[96vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-3.5 sm:p-4 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2.5 mland:gap-1.5">
          <div className="flex items-center gap-3 mland:gap-2 min-w-0">
            <div className="shrink-0 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={team.name} size={40} team={team} club={state.club} isMyClub={isMeTeam && state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg mland:text-xs truncate flex items-center gap-1.5">
                <span>{team.name}</span>
                {isMeTeam && <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[10px] mland:text-[8.5px] font-extrabold shrink-0">ทีมฉัน</span>}
              </div>
              <div className="text-xs mland:text-[9.5px] text-[var(--mut)] flex flex-wrap items-center gap-x-2">
                <span>{TN[team.tier] || 'สโมสรทวีป'}</span>
                {rank ? <span>· อันดับ <b className="text-[var(--ink)] tabular">{rank}</b> ({team.pts} แต้ม)</span> : null}
                <span className="tabular">· ช{team.w} ส{team.d} พ{team.l} ({gd >= 0 ? `+${gd}` : gd})</span>
                <span className="tabular">· อายุเฉลี่ย {st.age} ปี</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {formChars.length > 0 && (
              <div className="flex items-center gap-0.5">
                {formChars.map((c, idx) => (
                  <span
                    key={idx}
                    className={`w-5 h-5 mland:w-4 mland:h-4 rounded-md text-[10px] mland:text-[8.5px] font-bold flex items-center justify-center text-white ${
                      c === 'W' ? 'bg-[var(--g)]' : c === 'L' ? 'bg-[var(--red)]' : 'bg-amber-500'
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            <button type="button" onClick={onClose} className="px-3 mland:px-2 py-1.5 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold cursor-pointer">ปิด ✕</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden p-3.5 sm:p-4 mland:p-2 space-y-3 mland:space-y-1 mland:flex mland:flex-col">
          {/* Team Power + Head-to-Head + Tactical Identity */}
          <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-center text-xs mland:text-[10px] shrink-0">
            {(
              [
                ['ตัวจริง (XI)', st.ovXi, mySt.ovXi],
                ['เฉลี่ยทีม', st.ovSq, mySt.ovSq],
                ['เกมรุก', st.at, mySt.at],
                ['เกมรับ', st.df, mySt.df]
              ] as const
            ).map(([lbl, val, myVal]) => {
              const diff = val - myVal;
              return (
                <div key={lbl} className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]">
                  <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] leading-tight">{lbl}</div>
                  <div className="font-bold text-base mland:text-xs tabular leading-tight">
                    {val}
                    {!isMeTeam && (
                      <span className={`ml-1 text-[11px] mland:text-[9px] ${diff > 0 ? 'text-[var(--red)]' : diff < 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
                        ({diff > 0 ? `+${diff}` : diff})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 mland:grid-cols-4 gap-2 mland:gap-1 text-xs mland:text-[10px] shrink-0">
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">ระบบ &amp; แท็กติก</div>
              <div className="font-bold truncate mt-0.5">{team.form} · {AR_T[team.tac]}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">⚽ ดาวซัลโว</div>
              <div className="font-bold truncate mt-0.5">{topScorer ? `${topScorer.n.split(' ')[0]} (${topScorer.sg || 0})` : '-'}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">🎯 จอมแอสซิสต์</div>
              <div className="font-bold truncate mt-0.5">{topAssist ? `${topAssist.n.split(' ')[0]} (${topAssist.sa || 0})` : '-'}</div>
            </div>
            <div className="p-2.5 mland:p-1 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/70">
              <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-tight">💰 มูลค่ารวม</div>
              <div className="font-bold tabular mt-0.5">{totalVal}k ฿</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] mland:grid-cols-[1.15fr_0.85fr] gap-4 mland:gap-2 items-start mland:items-stretch mland:flex-1 mland:min-h-0 mland:overflow-hidden">
            <div className="space-y-1.5 mland:space-y-0.5 mland:h-full mland:flex mland:flex-col mland:items-center mland:min-h-0 mland:overflow-hidden">
              <div className="text-xs mland:text-[9px] font-bold text-[var(--mut)] text-center shrink-0">ผัง 11 ตัวจริง · แตะเพื่อส่องพลัง</div>
              <div className="max-w-[330px] mland:max-w-none mland:w-full mland:flex-1 mland:min-h-0 mland:h-full mland:flex mland:items-center mland:justify-center mx-auto">
                <FormationPitch
                  team={team}
                  state={state}
                  onPlayerPointerDown={(e, q) => {
                    e.stopPropagation();
                    SFX.tap();
                    onInspectPlayer(q, team);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0 mland:overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
                <div className="font-bold text-xs mland:text-[10px] text-[var(--mut)]">ขุมกำลัง ({team.sq.length} คน)</div>
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'XI', 'FW', 'MF', 'DF', 'GK'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPosFilter(f)}
                      className={`px-2 mland:px-1.5 py-0.5 rounded-lg text-[11px] mland:text-[9px] font-semibold cursor-pointer ${posFilter === f ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}
                    >
                      {f === 'ALL' ? 'ทั้งหมด' : f === 'XI' ? 'ตัวจริง' : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-[var(--line)]/60 max-h-72 mland:max-h-none mland:flex-1 mland:min-h-0 overflow-y-auto rounded-xl border border-[var(--line)]">
                {filteredSquad.map((q) => {
                  const isStarter = starterNames.has(q.n);
                  const isMe = !!q.me || (state.mode === 'p' && state.p?.name === q.n);
                  return (
                    <button
                      key={q.n}
                      type="button"
                      onClick={() => onInspectPlayer(q, team)}
                      className={`w-full flex items-center justify-between gap-2 px-3 mland:px-2 py-2 mland:py-0.5 hover:bg-[var(--surface-2)] text-left text-xs mland:text-[10.5px] cursor-pointer ${isMe ? 'bg-[var(--lamp-soft)]/50' : ''}`}
                    >
                      <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                        <div className="shrink-0 mland:[&_svg]:w-5 mland:[&_svg]:h-5">
                          <PlayerFace player={q} team={team} state={state} careerProfile={isMe ? state.p : null} size={28} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-1">
                            {isMe && <span className="px-1 rounded bg-[var(--lamp)] text-[#261900] text-[9px] font-extrabold shrink-0">ฉัน</span>}
                            <span className="text-[var(--mut)] tabular shrink-0">#{getShirtNo(team, q)}</span>
                            {isStarter && <span className="text-[var(--g)] shrink-0" title="ตัวจริง">★</span>}
                            {team.cap === q.n && <span className="text-[var(--lamp)] font-bold shrink-0">©</span>}
                            <span className="truncate">{q.n}</span>
                          </div>
                          <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                            {q.ro} · อายุ {q.age} · ⚽ {q.sg || 0} · 🎯 {q.sa || 0}
                            {(q.sus || 0) > 0 ? ` · 🟥แบน ${q.sus}` : q.inj > 0 ? ` · 🩹${q.inj}` : (q.yc || 0) > 0 ? ` · 🟨${q.yc}/3` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 mland:px-1.5 py-0.5 rounded-lg text-white font-bold tabular shrink-0 mland:text-[10px]" style={{ background: ovColor(q.ov) }}>{q.ov}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

type SeasonSummaryData = ReturnType<typeof finishSeasonComputation>;

const SeasonEndModal: React.FC<{
  state: GameState;
  summary: SeasonSummaryData;
  onStartNextSeason: (transferToTeamId?: number) => void;
}> = ({ state, summary, onStartNextSeason }) => {
  const me = state.teams[state.me];
  useEffect(() => {
    if (summary.ch || summary.nt > summary.mt) {
      SFX.win();
      triggerConfetti();
    } else {
      SFX.whistle();
    }
  }, [summary]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-xl mland:max-w-[94vw] max-h-[92dvh] mland:h-[96dvh] mland:max-h-[96dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 p-4 sm:p-5 mland:p-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] text-center space-y-2 mland:space-y-0.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 mland:py-0.5 rounded-full bg-[var(--lamp-soft)] text-xs mland:text-[9.5px] font-bold text-[#7a4f00] dark:text-[var(--lamp)]">
            🏁 สรุปจบฤดูกาลที่ {state.season}
          </div>
          <div className="flex items-center justify-center gap-3 mland:gap-2">
            <div className="shrink-0 mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={me.name} size={42} team={me} club={state.club} isMyClub={state.mode === 'm'} />
            </div>
            <div className="text-left min-w-0">
              <h3 className="font-bold text-lg sm:text-xl mland:text-xs font-display truncate">{me.name}</h3>
              <p className="text-xs mland:text-[9.5px] text-[var(--mut)]">{TN[summary.mt]} · จบอันดับ {summary.pos}/{summary.totalTeams} ({me.pts} แต้ม)</p>
            </div>
          </div>
          <div className="text-base sm:text-lg mland:text-[11px] font-bold text-[var(--g)] pt-0.5 mland:pt-0">{summary.stText}</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 mland:p-2 space-y-3 mland:space-y-0 mland:grid mland:grid-cols-2 mland:gap-1.5 mland:items-start">
          <div className="grid grid-cols-2 gap-2 mland:gap-1.5 text-xs mland:text-[10px]">
            <div className="p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
              <div className="text-[var(--mut)] mland:text-[9px]">ผลงานถ้วยประชาชน</div>
              <b className="text-sm mland:text-[11px]">{summary.cupStatus}</b>
            </div>
            <div className="p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)]">
              <div className="text-[var(--mut)] mland:text-[9px]">ดิวิชั่นฤดูกาลหน้า</div>
              <b className="text-sm mland:text-[11px]">{TN[summary.nt]}</b>
            </div>
          </div>

          {(summary.bestScorer || summary.bestAssist) && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] space-y-1 text-xs mland:text-[10px]">
              <div className="font-bold">🏅 รางวัลประจำฤดูกาล ({TN[summary.mt]})</div>
              {summary.bestScorer && <div>⚽ ดาวซัลโว: <b>{summary.bestScorer}</b></div>}
              {summary.bestAssist && <div>🎯 จอมแอสซิสต์: <b>{summary.bestAssist}</b></div>}
            </div>
          )}

          {state.mode === 'm' && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/70 border border-[var(--line)] text-xs mland:text-[10px] space-y-1">
              <div className="font-bold">📋 ประเมินจากบอร์ดบริหาร</div>
              <div>เป้าหมาย: จบอันดับ 1-{state.obj || '-'} · ความเชื่อมั่นบอร์ด: <b>{state.bd ?? 50}%</b></div>
              {state.sack === 1 && (
                <div className="text-[var(--red)] font-bold">❌ บอร์ดบริหารมีมติปลดคุณออกจากตำแหน่งหลังผลงานต่ำกว่าเป้า</div>
              )}
            </div>
          )}

          {state.mode === 'p' && summary.offers.length > 0 && (
            <div className="p-3 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 space-y-2 mland:space-y-1 mland:col-span-2">
              <div className="font-bold text-xs mland:text-[10px]">✉️ ข้อเสนอย้ายทีมจากลีกที่สูงกว่า!</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 mland:grid-cols-2 gap-2 mland:gap-1.5">
                {summary.offers.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => onStartNextSeason(club.id)}
                    className="p-2.5 mland:p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] flex items-center gap-2.5 mland:gap-1.5 text-left cursor-pointer"
                  >
                    <ClubCrest name={club.name} size={28} team={club} />
                    <div className="min-w-0">
                      <div className="font-bold text-xs mland:text-[10.5px] truncate">{club.name}</div>
                      <div className="text-[11px] mland:text-[9.5px] text-[var(--g)] font-semibold">ย้ายร่วมทีม ({TN[club.tier]}) ›</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)]">
          <button
            type="button"
            onClick={() => onStartNextSeason()}
            className="w-full py-3 mland:py-1 rounded-xl bg-[var(--g)] text-white font-bold text-sm mland:text-xs hover:brightness-105 cursor-pointer shadow-sm"
          >
            {state.sack === 1 ? '🔄 กลับสู่หน้าหลัก' : `🚀 เริ่มฤดูกาลที่ ${state.season + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const DilemmaModal: React.FC<{
  dilemma: ActiveDilemma;
  onChoose: (idx: number) => void;
}> = ({ dilemma, onChoose }) => (
  <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
    <div className="w-full max-w-md mland:max-w-xl max-h-[92dvh] mland:max-h-[95dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
      <div className="shrink-0 px-5 pt-4 pb-2 mland:px-3 mland:pt-1.5 mland:pb-1 border-b border-[var(--line)]/60">
        <div className="text-xs mland:text-[9.5px] font-bold text-[var(--lamp)]">📌 เหตุการณ์ · {dilemma.category}</div>
        <h3 className="font-bold text-lg mland:text-xs font-display mt-0.5">{dilemma.title}</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5 mland:p-2 space-y-3 mland:space-y-1.5">
        <p className="text-xs mland:text-[10.5px] text-[var(--mut)] leading-relaxed">{dilemma.desc}</p>
        <div className="space-y-2 mland:space-y-0 mland:grid mland:grid-cols-2 mland:gap-1.5 pt-1 mland:pt-0">
          {dilemma.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                SFX.tap();
                onChoose(idx);
              }}
              className="w-full p-3 mland:p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-xs mland:text-[10.5px]">{opt.label}</div>
              <div className="text-[11px] mland:text-[9.5px] text-[var(--g)] mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SettingsModal: React.FC<{
  state: GameState;
  onClose: () => void;
  onExitToMenu: () => void;
  onToast: (msg: string) => void;
  onSettingsChange?: (next: AppSettings) => void;
}> = ({ state, onClose, onExitToMenu, onToast, onSettingsChange }) => {
  const [st, setSt] = useState<AppSettings>(() => getSettings());
  const [saveCode, setSaveCode] = useState('');

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...st, ...patch };
    setSt(next);
    saveSettings(next);
    if ('theme' in patch) applyTheme(next.theme);
    onSettingsChange?.(next);
  };

  const curMatchSpeed = getDefaultMatchSpeed(st);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-md mland:max-w-2xl max-h-[92dvh] mland:max-h-[95dvh] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 px-5 py-3.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between">
          <h3 className="font-bold text-base mland:text-xs font-display">⚙️ ตั้งค่าเกม</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 mland:w-6 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] mland:text-xs font-bold cursor-pointer">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 mland:p-2 space-y-4 mland:space-y-0 mland:grid mland:grid-cols-2 mland:gap-2 mland:items-start">
          <div className="contents mland:block mland:space-y-1.5">
            <div className="space-y-2 mland:space-y-1">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)]">ธีมหน้าจอ</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([['', 'ตามระบบ'], ['light', '☀️ สว่าง'], ['dark', '🌙 มืด']] as const).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => update({ theme: val })}
                    className={`py-2 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${(st.theme || '') === val ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 mland:space-y-1">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--mut)]">⚡ ความเร็วการแข่งเริ่มต้น</div>
              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([
                  [1, '1x (มาตรฐาน)'],
                  [2, '2x (เร็ว)'],
                  [4, '4x (สูงสุด)']
                ] as const).map(([sp, lbl]) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => update({ matchSpeed: sp, quick: sp === 4 })}
                    className={`py-2 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-semibold cursor-pointer ${curMatchSpeed === sp ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)]'}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 mland:space-y-1">
              <button
                type="button"
                onClick={() => update({ autoSkipMatch: !st.autoSkipMatch })}
                className={`w-full flex items-center justify-between gap-3 mland:gap-2 p-3 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer ${
                  st.autoSkipMatch ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface-2)] border-transparent'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10.5px] font-bold">⏭️ ข้ามแข่งอัตโนมัติ</div>
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">กดปุ่มแข่งแล้วจำลองผลทันที โดยไม่เปิดสนาม 2D</div>
                </div>
                <span className={`px-2.5 mland:px-2 py-0.5 rounded-full text-[11px] mland:text-[9.5px] font-bold shrink-0 ${st.autoSkipMatch ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'}`}>
                  {st.autoSkipMatch ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              {(
                [
                  ['mute', '🔇 ปิดเสียงเอฟเฟกต์ทั้งหมด', !!st.mute],
                  ['nocrowd', '🏟️ ปิดเสียงเชียร์ในสนามแข่ง', !!st.nocrowd],
                  ['novib', '📳 ปิดการสั่นแจ้งเตือน', !!st.novib]
                ] as [keyof AppSettings, string, boolean][]
              ).map(([key, label, active]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ [key]: !active })}
                  className="w-full flex items-center justify-between p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] text-xs mland:text-[10.5px] font-semibold cursor-pointer"
                >
                  <span>{label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] mland:text-[9.5px] font-bold ${active ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface)] text-[var(--mut)]'}`}>
                    {active ? 'เปิด' : 'ปิด'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="contents mland:block mland:space-y-1.5">
            <PWAInstallButton variant="settings" onToast={onToast} />

            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] space-y-2 mland:space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs mland:text-[10.5px] font-bold">📤 ส่งออกโค้ดเซฟ</span>
                <button
                  type="button"
                  onClick={() => {
                    const code = exportSaveCode(state);
                    setSaveCode(code);
                    navigator.clipboard?.writeText(code).catch(() => undefined);
                    onToast('สร้างและคัดลอกโค้ดเซฟแล้ว');
                  }}
                  className="px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[10px] font-bold cursor-pointer"
                >
                  สร้างโค้ด
                </button>
              </div>
              {saveCode && (
                <textarea
                  readOnly
                  value={saveCode}
                  rows={2}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[10px] font-mono"
                />
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onExitToMenu();
            }}
            className="flex-1 py-2.5 mland:py-1 rounded-xl bg-[var(--red-soft)] text-[var(--red)] font-bold text-xs mland:text-[10.5px] cursor-pointer"
          >
            🏠 กลับหน้าเมนูหลัก
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 mland:py-1 rounded-xl bg-[var(--g)] text-white font-bold text-xs mland:text-[10.5px] cursor-pointer">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 14. ROOT APPLICATION
// ============================================================================
function simulateInstantMatchPayload(
  s: GameState,
  kind: 'league' | 'cup' | 'asia',
  homeId: number,
  awayId: number
): FinishedMatchPayload {
  const H = s.teams[homeId];
  const A = s.teams[awayId];
  const meTeam = s.teams[s.me];
  const r = simMatch(H, A, s);
  const { ratings, motm } = computePlayerRatings(H, A, r, s.p);

  let pen = false;
  let penText: string | undefined;
  if (kind !== 'league' && r.gh === r.ga) {
    pen = true;
    const hWin = Math.random() < 0.5;
    const wPen = R(4, 5);
    const lPen = R(2, wPen - 1);
    penText = `ดวลจุดโทษ ${hWin ? `${wPen}-${lPen}` : `${lPen}-${wPen}`}`;
  }

  let pf: PlayerPerfResult | undefined;
  if (s.mode === 'p' && s.p) {
    const pName = s.p.name;
    const mySquadObj = meTeam.sq.find((q) => q.me || q.n === pName);
    const isBanned = ((mySquadObj?.sus || s.p.sus || 0) > 0);
    const starterNames = xi(meTeam).map((q) => q.n);
    const started = !isBanned && starterNames.includes(pName);
    const subInEv = r.subs?.find((sb) => sb.t === s.me && sb.inPlayer === pName);
    const subOutEv = r.subs?.find((sb) => sb.t === s.me && sb.outPlayer === pName);
    const played = !isBanned && (started || !!subInEv);
    const mins = !played ? 0 : started ? (subOutEv ? subOutEv.m : 90) : (90 - (subInEv?.m || 72));
    const myCards = (r.cards || []).filter((c) => c.t === s.me && c.who === pName);
    const yc = myCards.filter((c) => c.type === 'Y' || c.type === 'Y2R').length;
    const rc = myCards.some((c) => c.type === 'R' || c.type === 'Y2R') ? 1 : 0;
    pf = calcPlayerPerf(s, r, H, A, ratings, {
      played,
      mins,
      subIn: !!subInEv,
      subOut: !!subOutEv,
      yc,
      rc
    });
  }

  return {
    gh: r.gh,
    ga: r.ga,
    evs: r.evs,
    xgH: r.xgH || 1.1,
    xgA: r.xgA || 1.0,
    pen,
    penText,
    ratings,
    motm,
    pf,
    finalTac: meTeam.tac,
    finalLu: xi(meTeam).map((q) => q.n),
    cards: r.cards || [],
    subs: r.subs || [],
    playedNames: r.playedNames || {}
  };
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [slot, setSlot] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectPlayer, setInspectPlayer] = useState<{ player: Player; team: Team | null } | null>(null);
  const [inspectTeamId, setInspectTeamId] = useState<number | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ kind: 'league' | 'cup' | 'asia'; homeId: number; awayId: number; isDerby: boolean } | null>(null);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummaryData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getSettings());

  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const st = getSettings();
    applyTheme(st.theme);
  }, []);

  useEffect(() => {
    if (state) saveGameToSlot(state, slot);
  }, [state, slot]);

  const updateState = (updater: (draft: GameState) => void) => {
    setState((prev) => {
      if (!prev) return prev;
      const clone: GameState = JSON.parse(JSON.stringify(prev));
      updater(clone);
      return clone;
    });
  };

  const handleStartManager = (targetSlot: number, names: string[][], t0: Team[], pick: number, diff: number) => {
    const fresh = createNewGame('m', { names, t0, pick });
    fresh.diff = diff;
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`รับตำแหน่งผู้จัดการทีม ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleStartPlayer = (
    targetSlot: number,
    profile: Omit<PlayerCareerProfile, 'b' | 'age' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>
  ) => {
    const fresh = createNewGame('p', { player: profile });
    fresh.v = 'p';
    setSlot(targetSlot);
    setState(fresh);
    saveGameToSlot(fresh, targetSlot);
    showToast(`เซ็นสัญญาเริ่มต้นกับ ${fresh.teams[fresh.me].name} แล้ว!`);
  };

  const handleLoadSave = (_mode: GameMode, targetSlot: number, loaded: GameState) => {
    setSlot(targetSlot);
    setState(loaded);
    showToast('โหลดเซฟเรียบร้อย');
  };

  const nextMatchInfo = useMemo(() => {
    if (!state) return null;
    if (state.pa && state.ac && state.ac.alive && !state.ac.done) {
      const idx = state.ac.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'asia' as const, homeId: state.ac.ids[pairIdx], awayId: state.ac.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.pc && state.cup && state.cup.alive && !state.cup.done) {
      const idx = state.cup.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        return { kind: 'cup' as const, homeId: state.cup.ids[pairIdx], awayId: state.cup.ids[pairIdx + 1], isDerby: false };
      }
    }
    if (state.md < state.fx.length) {
      const pair = state.fx[state.md].find((p) => p.includes(state.me));
      if (pair) {
        return { kind: 'league' as const, homeId: pair[0], awayId: pair[1], isDerby: (pair[0] ^ 1) === pair[1] };
      }
    }
    return null;
  }, [state]);

  const commitFinishedMatch = (
    matchInfo: { kind: 'league' | 'cup' | 'asia'; homeId: number; awayId: number; isDerby: boolean },
    payload: FinishedMatchPayload
  ) => {
    const { kind, homeId, awayId, isDerby } = matchInfo;

    updateState((d) => {
      const me = d.teams[d.me];
      if (d.mode === 'm') {
        me.tac = payload.finalTac;
      }

      const H = d.teams[homeId];
      const A = d.teams[awayId];
      const resObj: MatchResult = {
        gh: payload.gh,
        ga: payload.ga,
        evs: payload.evs,
        pen: payload.pen,
        xgH: payload.xgH,
        xgA: payload.xgA,
        ratings: payload.ratings,
        motm: payload.motm,
        pf: payload.pf,
        cards: payload.cards,
        subs: payload.subs,
        playedNames: payload.playedNames
      };

      if (kind === 'cup') {
        const c = d.cup;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ch = d.teams[c.ids[i]];
          const ca = d.teams[c.ids[i + 1]];
          if (ch.id === homeId && ca.id === awayId) {
            nx[i / 2] = userWin.id;
            c.log.push(`${RN[c.r]}: ${ch.name} ${payload.gh}-${payload.ga} ${ca.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const cr = simMatch(ch, ca, d);
            const cw = pickWinner(ch, ca, cr, d);
            nx[i / 2] = cw.id;
            c.log.push(`${RN[c.r]}: ${ch.name} ${cr.gh}-${cr.ga} ${ca.name}`);
          }
        }
        c.ids = nx;
        c.r++;
        d.pc = false;
        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `🏆 ตกรอบถ้วยประชาชน (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'บอลถ้วย', d.news, 'urg');
        } else {
          d.news = `🏆 ผ่านเข้ารอบถ้วยประชาชน! (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'บอลถ้วย', d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          if (nx[0] === d.me && d.mode === 'm') {
            d.money += 250;
            logFin(d, 'รางวัลแชมป์ถ้วยประชาชน', 250);
            d.trophies = [...(d.trophies || []), { season: d.season, title: 'แชมป์ถ้วยประชาชน', type: 'cup' }];
            d.mgrRep = (d.mgrRep || 50) + 75;
            triggerConfetti();
          }
        }
        me.sq.forEach((q) => {
          if ((q.sus || 0) > 0) q.sus = q.sus! - 1;
          if (q.me && d.p) d.p.sus = q.sus || 0;
        });
        applyMatchCards(d, H, A, payload.cards);
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        return;
      }

      if (kind === 'asia' && d.ac) {
        const c = d.ac;
        const nx: number[] = [];
        const userWin = pickWinner(H, A, resObj, d);
        for (let i = 0; i < c.ids.length; i += 2) {
          const ah = d.teams[c.ids[i]];
          const aa = d.teams[c.ids[i + 1]];
          if (ah.id === homeId && aa.id === awayId) {
            nx[i / 2] = userWin.id;
            c.log.push(`${RN[c.r]}: ${ah.name} ${payload.gh}-${payload.ga} ${aa.name}${payload.penText ? ` (${payload.penText})` : ''}`);
          } else {
            const ar = simMatch(ah, aa, d);
            const aw = pickWinner(ah, aa, ar, d);
            nx[i / 2] = aw.id;
            c.log.push(`${RN[c.r]}: ${ah.name} ${ar.gh}-${ar.ga} ${aa.name}`);
          }
        }
        c.ids = nx;
        c.r++;
        d.pa = false;
        if (!nx.includes(d.me)) {
          c.alive = false;
          d.news = `🌏 ตกรอบบอลถ้วยทวีป (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'ถ้วยทวีป', d.news, 'urg');
        } else {
          d.news = `🌏 เข้ารอบบอลถ้วยทวีป! (${H.name} ${payload.gh}-${payload.ga} ${A.name})`;
          pushFeed(d, 'ถ้วยทวีป', d.news, 'ok');
        }
        if (nx.length === 1) {
          c.done = true;
          if (nx[0] === d.me && d.mode === 'm') {
            d.money += 500;
            logFin(d, 'รางวัลแชมป์ทวีป', 500);
            d.trophies = [...(d.trophies || []), { season: d.season, title: 'แชมป์สโมสรทวีป', type: 'asia' }];
            d.mgrRep = (d.mgrRep || 50) + 120;
            triggerConfetti();
          }
        }
        me.sq.forEach((q) => {
          if ((q.sus || 0) > 0) q.sus = q.sus! - 1;
          if (q.me && d.p) d.p.sus = q.sus || 0;
        });
        applyMatchCards(d, H, A, payload.cards);
        if (d.mode === 'p' && payload.pf) creditPlayerPerf(d, payload.pf);
        return;
      }

      // League Matchday
      if (isDerby) d.derby = 1;
      applyMatchResult(H, payload.gh, A, payload.ga);
      tallyMatchPlayers(H, A, resObj);

      const roundCards: { h: Team; a: Team; cards?: MatchCardEvent[] }[] = [
        { h: H, a: A, cards: payload.cards }
      ];

      // Simulate remaining fixtures in user's league & other tiers
      d.fx[d.md].forEach(([fidH, fidA]) => {
        if ((fidH === homeId && fidA === awayId) || (fidH === awayId && fidA === homeId)) return;
        const th = d.teams[fidH];
        const ta = d.teams[fidA];
        const r = simMatch(th, ta, d);
        applyMatchResult(th, r.gh, ta, r.ga);
        tallyMatchPlayers(th, ta, r);
        roundCards.push({ h: th, a: ta, cards: r.cards });
      });

      if (d.fxo) {
        Object.values(d.fxo).forEach((rounds) => {
          const rd = rounds[d.md];
          if (!rd) return;
          rd.forEach(([fidH, fidA]) => {
            const th = d.teams[fidH];
            const ta = d.teams[fidA];
            const r = simMatch(th, ta, d);
            applyMatchResult(th, r.gh, ta, r.ga);
            tallyMatchPlayers(th, ta, r);
            roundCards.push({ h: th, a: ta, cards: r.cards });
          });
        });
      }

      const myGoals = homeId === d.me ? payload.gh : payload.ga;
      const oppGoals = homeId === d.me ? payload.ga : payload.gh;
      const line = `นัด ${d.md + 1}: ${H.name} ${payload.gh}-${payload.ga} ${A.name}`;
      d.res = [line, ...(d.res || [])].slice(0, 5);
      d.news = line;

      d.records = d.records || {};
      const diff = myGoals - oppGoals;
      if (diff > (d.records.bestWin?.diff || 0)) {
        d.records.bestWin = { txt: line, diff };
      }
      if (diff > 0) {
        d.records.curStreak = (d.records.curStreak || 0) + 1;
        if (d.records.curStreak > (d.records.winStreak || 0)) d.records.winStreak = d.records.curStreak;
      } else {
        d.records.curStreak = 0;
      }

      if (d.mode === 'm') {
        const isHomeMatch = homeId === d.me;
        const tpIdx = d.tp ?? 1;
        const spIdx = d.sp ?? 0;
        const ticketMult = [0.82, 1.0, 1.24][tpIdx];
        const ticket = isHomeMatch
          ? Math.round((8 + (d.st ?? 1) * 7) * ((d.fan ?? 55) / 60) * ticketMult * (d.promo === 1 ? 1.35 : 1))
          : 0;
        const merch = isHomeMatch
          ? Math.round((2 + (d.merchLv ?? 1) * 3) * ((d.fan ?? 55) / 55))
          : 0;
        const baseSp = spIdx === 0 ? 8 + me.tier * 6 : spIdx === 1 ? 4 + me.tier * 4 : 5 + me.tier * 5;
        const winSpBonus = spIdx === 1 && diff > 0 ? 10 + me.tier * 6 : 0;
        const derbySpBonus = spIdx === 2 && isDerby ? 18 + me.tier * 8 : 0;
        const sponsor = Math.round((baseSp + winSpBonus + derbySpBonus) * (d.promo === 2 ? 1.35 : 1));
        if (ticket) {
          d.money += ticket;
          logFin(d, `ค่าตั๋วเข้าชมเกมเหย้า (${d.promo === 1 ? 'โปรโมชั่น' : ['ราคาถูก', 'ราคากลาง', 'ราคาแพง'][tpIdx]})`, ticket);
        }
        if (merch) {
          d.money += merch;
          logFin(d, 'ขายของที่ระลึกวันแข่งเหย้า', merch);
        }
        d.money += sponsor;
        logFin(d, `สปอนเซอร์หลัก${winSpBonus ? ' + โบนัสชนะ' : derbySpBonus ? ' + โบนัสดาร์บี้' : ''}`, sponsor);
        if (d.winBonus && diff > 0) {
          d.money -= d.winBonus;
          logFin(d, 'จ่ายโบนัสอัดฉีดชัยชนะ', -d.winBonus);
        }
        const ticketFanAdj = isHomeMatch ? (tpIdx === 0 ? 1 : tpIdx === 2 && diff <= 0 ? -1 : 0) : 0;
        d.promo = 0;
        d.winBonus = 0;
        d.fan = clamp((d.fan ?? 55) + (diff > 0 ? 3 : diff < 0 ? -3 : 0) + ticketFanAdj, 5, 100);
        d.mor = clamp((d.mor ?? 55) + (diff > 0 ? 5 : diff < 0 ? -5 : 1), 0, 100);
      } else if (payload.pf) {
        creditPlayerPerf(d, payload.pf);
      }

      d.md++;
      afterMatchDay(d);
      if (d.mode === 'm' && payload.subs.length > 0) {
        payload.subs.forEach((sb) => {
          if (sb.t !== d.me) return;
          const outPl = me.sq.find((q) => q.n === sb.outPlayer);
          if (outPl && sb.m < 85) {
            const restBonus = Math.round(clamp((90 - sb.m) / 8, 2, 7));
            outPl.fit = clamp((outPl.fit ?? 100) + restBonus, 30, 100);
          }
        });
      }
      roundCards.forEach((rc) => applyMatchCards(d, rc.h, rc.a, rc.cards));
    });
  };

  const handleMatchFinish = (payload: FinishedMatchPayload) => {
    if (!state || !activeMatch) return;
    const finished = activeMatch;
    setActiveMatch(null);
    commitFinishedMatch(finished, payload);
  };

  const handleTriggerNextStep = () => {
    if (!state) return;
    SFX.tap();
    if (nextMatchInfo) {
      if (appSettings.autoSkipMatch) {
        const simState: GameState = JSON.parse(JSON.stringify(state));
        if (nextMatchInfo.isDerby) simState.derby = 1;
        const payload = simulateInstantMatchPayload(simState, nextMatchInfo.kind, nextMatchInfo.homeId, nextMatchInfo.awayId);
        commitFinishedMatch(nextMatchInfo, payload);
        const H = state.teams[nextMatchInfo.homeId];
        const A = state.teams[nextMatchInfo.awayId];
        const myGf = nextMatchInfo.homeId === state.me ? payload.gh : payload.ga;
        const myGa = nextMatchInfo.homeId === state.me ? payload.ga : payload.gh;
        if (myGf > myGa) SFX.win();
        showToast(`⏭️ จบเกม: ${H.name} ${payload.gh}-${payload.ga} ${A.name}${payload.penText ? ` (${payload.penText})` : ''}`);
        return;
      }
      if (nextMatchInfo.isDerby) {
        updateState((d) => { d.derby = 1; });
      }
      setActiveMatch(nextMatchInfo);
      return;
    }
    if (state.md >= state.fx.length) {
      const clone: GameState = JSON.parse(JSON.stringify(state));
      const summary = finishSeasonComputation(clone);
      setState(clone);
      setSeasonSummary(summary);
    }
  };

  const handleStartNextSeason = (transferToTeamId?: number) => {
    if (!state) return;
    if (state.sack === 1) {
      setSeasonSummary(null);
      setState(null);
      return;
    }
    setSeasonSummary(null);
    updateState((d) => {
      growPlayers(d);
      if (d.mode === 'p' && d.p && transferToTeamId != null && d.teams[transferToTeamId]) {
        const oldT = d.teams[d.me];
        const idx = oldT.sq.findIndex((q) => q.me);
        const mePlayer = idx >= 0 ? oldT.sq.splice(idx, 1)[0] : null;
        if (mePlayer) {
          const newT = d.teams[transferToTeamId];
          const repIdx = newT.sq.findIndex((q) => q.pos === mePlayer.pos);
          newT.sq.splice(repIdx >= 0 ? repIdx : 0, 1, mePlayer);
          assignTeamShirtNumbers(newT);
          d.p.no = mePlayer.no;
          d.me = transferToTeamId;
          d.hist.push(`✍️ ย้ายซบ ${newT.name} (${TN[newT.tier]}) ในซีซั่น ${d.season + 1}`);
        }
      }
      d.season++;
      d.yth = Array.from({ length: 4 }, () => mkPlayer(P(POS), BASE[d.teams[d.me].tier] - 2 + (d.ya ?? 1) * 2, true));
      startSeason(d);
      pushFeed(d, 'ฤดูกาลใหม่', `🚀 เปิดฉากฤดูกาลที่ ${d.season} · ${TN[d.teams[d.me].tier]}`, 'ok');
    });
    showToast(`เริ่มต้นฤดูกาลที่ ${state.season + 1} แล้ว!`);
  };

  if (!state) {
    return (
      <>
        <MainMenu
          onStartManager={handleStartManager}
          onStartPlayer={handleStartPlayer}
          onLoadSave={handleLoadSave}
          onToast={showToast}
        />
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold shadow-lg">
            {toast}
          </div>
        )}
        <OfflineIndicator />
      </>
    );
  }

  const me = state.teams[state.me];
  const tabs: [MainTab, string, string][] =
    state.mode === 'm'
      ? [
          ['t', '🏆', 'ตารางลีก'],
          ['q', '⚽', 'ทีม & แผน'],
          ['k', '🤝', 'ตลาด'],
          ['f', '💰', 'การเงิน'],
          ['u', '🏟️', 'สโมสร'],
          ['c', '🏅', 'บอลถ้วย']
        ]
      : [
          ['p', '🌟', 'อาชีพ'],
          ['t', '🏆', 'ตารางลีก'],
          ['q', '⚽', 'ทีม & แผน'],
          ['c', '🏅', 'บอลถ้วย']
        ];

  const curTab: MainTab = tabs.some(([k]) => k === state.v) ? state.v : tabs[0][0];

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      {/* Pinned Top Game HUD Bar */}
      <header className="shrink-0 z-30 bg-[var(--surface)]/92 backdrop-blur-md border-b border-[var(--line)] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mland:max-w-none mx-auto px-3 sm:px-5 mland:px-2.5 py-2 mland:py-1 flex items-center justify-between gap-2 mland:gap-2">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="shrink-0 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]/70 mland:[&>svg]:w-6 mland:[&>svg]:h-6">
              <ClubCrest name={me.name} size={32} team={me} club={state.club} isMyClub={state.mode === 'm'} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-base mland:text-[12px] truncate font-display leading-tight tracking-tight">
                {state.mode === 'p' && state.p ? `${state.p.name} · ` : ''}
                {me.name}
              </div>
              <div className="text-[10px] sm:text-[11px] mland:text-[9.5px] text-[var(--mut)] flex flex-wrap mland:flex-nowrap items-center gap-x-1.5 truncate tabular">
                <span className="truncate font-medium">{TN[me.tier]}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">ซีซั่น {state.season}</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">นัด {Math.min(state.md, state.fx.length)}/{state.fx.length}</span>
                <span className="opacity-40 shrink-0">·</span>
                {state.mode === 'm' ? (
                  <span className="font-bold text-[var(--g)] tabular shrink-0">งบ {state.money}k ฿</span>
                ) : (
                  <span className="font-bold text-[var(--g)] tabular shrink-0">OVR {state.p ? ovMe(state.p) : 60} · ฟิต {state.p?.en ?? 100}%</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 mland:gap-1.5 shrink-0">
            <PWAInstallButton variant="compact" onToast={showToast} />
            <button
              type="button"
              onClick={handleTriggerNextStep}
              className="min-h-[36px] mland:min-h-[30px] px-3 sm:px-4 mland:px-3 py-1.5 mland:py-1 rounded-xl mland:rounded-lg bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] font-bold text-xs sm:text-sm mland:text-[11px] hover:brightness-105 transition-all cursor-pointer shadow-[0_2px_8px_rgba(234,179,8,0.28)] whitespace-nowrap border border-[#ca8a04]/30"
            >
              {nextMatchInfo
                ? appSettings.autoSkipMatch
                  ? nextMatchInfo.kind === 'asia'
                    ? '⏭️ ข้ามถ้วยทวีป'
                    : nextMatchInfo.kind === 'cup'
                      ? '⏭️ ข้ามถ้วยปชช.'
                      : `⏭️ ข้ามนัดที่ ${state.md + 1}`
                  : nextMatchInfo.kind === 'asia'
                    ? '🌏 แข่งถ้วยทวีป'
                    : nextMatchInfo.kind === 'cup'
                      ? '🏆 แข่งถ้วยปชช.'
                      : `▶ แข่งนัดที่ ${state.md + 1}`
                : '🏁 สรุปจบฤดูกาล'}
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setShowSettings(true); }}
              aria-label="ตั้งค่า"
              className="w-9 h-9 mland:w-8 mland:h-8 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:bg-[var(--line)]/50 border border-[var(--line)] flex items-center justify-center text-sm mland:text-xs cursor-pointer shrink-0"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col mland:flex-row overflow-hidden">
        {/* Center Scrollable Game Stage */}
        <main className="flex-1 min-h-0 overflow-y-auto mland:overflow-hidden mland:flex mland:flex-col overflow-x-hidden">
          <div className="max-w-6xl mland:max-w-none mland:w-full mx-auto px-3 sm:px-5 mland:px-2.5 py-3 sm:py-4 mland:py-1.5 space-y-3 sm:space-y-4 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
            {/* Next match + latest news compact bar (shown on overview tab only) */}
            {(state.mode === 'p' ? curTab === 'p' : curTab === 't') && (
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] mland:grid-cols-[1.28fr_1fr] gap-2.5 sm:gap-3 mland:gap-1.5 shrink-0">
                {nextMatchInfo ? (
                  <div className="p-2.5 sm:p-3 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex items-center justify-between gap-2.5 mland:gap-1.5">
                    <div className="flex items-center gap-2 mland:gap-1.5 min-w-0">
                      <div className="shrink-0 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                        <ClubCrest
                          name={state.teams[nextMatchInfo.homeId].name}
                          size={26}
                          team={state.teams[nextMatchInfo.homeId]}
                          club={state.club}
                          isMyClub={nextMatchInfo.homeId === state.me && state.mode === 'm'}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] font-semibold truncate leading-tight">
                          {nextMatchInfo.kind === 'asia' ? '🌏 ถ้วยทวีป' : nextMatchInfo.kind === 'cup' ? '🏆 ถ้วยประชาชน' : `⚽ นัดถัดไป · ${TN[me.tier]}`}
                          {nextMatchInfo.isDerby && <span className="ml-1.5 text-[var(--red)] font-bold">🔥 ดาร์บี้</span>}
                        </div>
                        <div className="font-bold text-xs sm:text-sm mland:text-[10.5px] truncate leading-tight">
                          {state.teams[nextMatchInfo.homeId].name} <span className="text-[var(--mut)] font-normal">vs</span> {state.teams[nextMatchInfo.awayId].name}
                        </div>
                      </div>
                      <div className="shrink-0 mland:[&>svg]:w-5 mland:[&>svg]:h-5">
                        <ClubCrest
                          name={state.teams[nextMatchInfo.awayId].name}
                          size={26}
                          team={state.teams[nextMatchInfo.awayId]}
                          club={state.club}
                          isMyClub={nextMatchInfo.awayId === state.me && state.mode === 'm'}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectTeamId(nextMatchInfo.homeId === state.me ? nextMatchInfo.awayId : nextMatchInfo.homeId)}
                      className="px-2.5 mland:px-2 py-1.5 mland:py-0.5 rounded-xl mland:rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g)] hover:text-white border border-[var(--line)]/70 text-xs mland:text-[9.5px] font-semibold shrink-0 cursor-pointer"
                    >
                      ส่องคู่แข่ง
                    </button>
                  </div>
                ) : (
                  <div className="p-3 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 flex items-center justify-between">
                    <span className="text-xs mland:text-[10px] font-bold truncate">🏁 แข่งครบโปรแกรมลีกฤดูกาลนี้แล้ว กดปุ่มสรุปจบฤดูกาลเพื่อเลื่อนชั้น/ตกชั้น</span>
                  </div>
                )}

                <div className="p-2.5 sm:p-3 mland:px-2.5 mland:py-1 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex items-center justify-between gap-2.5 mland:gap-1.5">
                  <div className="min-w-0">
                    <div className="text-[11px] mland:text-[8.5px] text-[var(--mut)] font-semibold leading-tight">📰 ข่าวสารสโมสร</div>
                    <div className="text-xs mland:text-[10px] font-semibold truncate leading-tight">{state.feed?.[0]?.txt || state.news || 'พร้อมลุยศึกฤดูกาลนี้!'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] mland:text-[9.5px] text-[var(--mut)] tabular">
                    <span>❤️ <b>{state.fan ?? 55}%</b></span>
                    {state.mode === 'm' && <span>👔 <b>{state.bd ?? 55}%</b></span>}
                  </div>
                </div>
              </div>
            )}

          {curTab === 't' && (
            <LeagueView
              state={state}
              onInspectTeam={(tid) => setInspectTeamId(tid)}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onUpdateState={updateState}
            />
          )}
          {curTab === 'q' && (
            <SquadTacticsView
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onToast={showToast}
            />
          )}
          {curTab === 'k' && state.mode === 'm' && (
            <MarketView
              state={state}
              onUpdateState={updateState}
              onInspectPlayer={(p, t) => setInspectPlayer({ player: p, team: t })}
              onToast={showToast}
            />
          )}
          {(curTab === 'f' || curTab === 'u') && state.mode === 'm' && (
            <FinanceClubView
              state={state}
              tab={curTab}
              onUpdateState={updateState}
              onToast={showToast}
            />
          )}
          {curTab === 'c' && <CupView state={state} onInspectTeam={(tid) => setInspectTeamId(tid)} />}
          {curTab === 'p' && state.mode === 'p' && (
            <PlayerCareerView state={state} onUpdateState={updateState} onToast={showToast} />
          )}
          </div>
        </main>

        {/* Pinned Bottom / Mobile-Landscape Left-Rail Navigation Dock */}
        <nav aria-label="เมนูหลักในเกม" className="shrink-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--line)] mland:order-first mland:w-[70px] mland:h-full mland:border-t-0 mland:border-r mland:px-1.5 mland:py-2 mland:overflow-y-auto">
          <div
            className="max-w-6xl mx-auto px-1.5 sm:px-5 py-1.5 grid gap-1 mland:!flex mland:flex-col mland:gap-1 mland:h-full mland:justify-center mland:px-0 mland:py-0"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map(([key, icon, label]) => {
              const active = curTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    SFX.tap();
                    updateState((d) => { d.v = key; });
                  }}
                  className={`relative py-1.5 px-1 sm:px-2 mland:!flex-col mland:py-1 mland:px-0.5 mland:text-[9px] mland:flex-1 mland:min-h-[38px] mland:max-h-[50px] rounded-xl mland:rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer transition-all min-w-0 ${
                    active
                      ? 'bg-gradient-to-b from-[#1a9657] to-[#147845] text-white shadow-[0_2px_8px_rgba(21,128,73,0.3)]'
                      : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/85'
                  }`}
                >
                  <span className="text-sm sm:text-base mland:text-xs leading-none">{icon}</span>
                  <span className="truncate max-w-full leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Modals */}
      {activeMatch && (
        <MatchModal
          state={state}
          kind={activeMatch.kind}
          homeId={activeMatch.homeId}
          awayId={activeMatch.awayId}
          isDerby={activeMatch.isDerby}
          onFinish={handleMatchFinish}
        />
      )}

      {inspectTeamId !== null && state.teams[inspectTeamId] && (
        <TeamInspectorModal
          team={state.teams[inspectTeamId]}
          state={state}
          onClose={() => setInspectTeamId(null)}
          onInspectPlayer={(p, t) => {
            setInspectPlayer({ player: p, team: t });
          }}
        />
      )}

      {inspectPlayer && (
        <PlayerInspectorModal
          player={inspectPlayer.player}
          team={inspectPlayer.team}
          state={state}
          onClose={() => setInspectPlayer(null)}
          onUpdateState={updateState}
          onToast={showToast}
        />
      )}

      {seasonSummary && (
        <SeasonEndModal
          state={state}
          summary={seasonSummary}
          onStartNextSeason={handleStartNextSeason}
        />
      )}

      {state.dilemma && !activeMatch && !seasonSummary && (
        <DilemmaModal
          dilemma={state.dilemma}
          onChoose={(idx) => {
            let msg = '';
            updateState((d) => {
              msg = applyDilemmaChoice(d, idx);
            });
            if (msg) showToast(msg);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          state={state}
          onClose={() => setShowSettings(false)}
          onExitToMenu={() => setState(null)}
          onToast={showToast}
          onSettingsChange={setAppSettings}
        />
      )}

      {toast && (
        <div className="fixed bottom-16 sm:bottom-20 mland:bottom-2.5 left-1/2 mland:left-[calc(50%+35px)] -translate-x-1/2 z-[70] max-w-[92vw] mland:max-w-[76vw] px-4 py-2 mland:py-1.5 rounded-xl bg-[var(--ink)]/92 backdrop-blur-md text-[var(--bg)] border border-white/10 text-xs mland:text-[10.5px] font-bold shadow-xl text-center pointer-events-none">
          {toast}
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
}
