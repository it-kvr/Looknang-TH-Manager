import type { Position, SubRole, StatKey, Mentality, TrainingFocus, TrainingProgramId, TrainingIntensity, TeamTrainingPlan, CoreAttrs, GameState, PlayerArchetype, TrainingProgramMeta, FootballTraitDef } from '../types/game';

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

export const NG = [
  ['โคกมะตูม', 'วังชมพู', 'ท่าขนุน', 'ห้วยกะปิ', 'ดอนลำไย', 'บึงกระจับ', 'คลองรำลึก', 'แก่งสำราญ', 'โนนขมิ้น', 'นาตะไคร้', 'ปากน้ำใส', 'สันป่ายาง', 'แหลมทองคำ', 'บางสนม', 'ทุ่งรวงทอง', 'เขาชะเมา', 'คุ้งไผ่', 'โพธิ์สามต้น', 'ปางสวรรค์', 'หนองโสน', 'บ้านหมี่', 'กุดรัง', 'ดอยสกาว', 'สวนส้มโอ', 'ม่อนแจ่มศรี', 'สะพานไม้', 'ลำน้ำพอง', 'ตลิ่งชันเหนือ', 'อ่างศิลาแก้ว', 'ด่านแม่ละเมา', 'ร่องกล้า', 'ไร่อ้อยพัฒนา'],
  ['ภูผาเพชร', 'ธารามรกต', 'คีรีบูลย์', 'ไพลินนคร', 'สายชลาธาร', 'มณีจันทร์', 'พฤกษาสยาม', 'รัตนคีรี', 'สุริยเทพ', 'อรุณรุ่ง', 'ปฐพีทอง', 'ชลธีใต้', 'สิงขรเหนือ', 'เวียงพิงค์หลวง', 'ธนบุรีศรี', 'กัลปพฤกษ์', 'จันทราทวีป', 'บุษราคัม', 'อัมรินทร์', 'วิมานเมฆ', 'ทักษิณาวุธ', 'บูรพาสินธุ์', 'อิศรานคร', 'ประจิมพนา', 'นทีทิพย์', 'ศิลานิล', 'เหมันต์นคร', 'วสันต์บุรี', 'คิมหันต์ราช', 'ไตรรัตน์', 'พรหมพิราม', 'ชลาลัย'],
  ['พยัคฆ์คำราม', 'มังกรอัคนี', 'อินทรีเวหา', 'สิงโตคำรณ', 'นาคราช', 'วายุภักษ์', 'ราชสีห์ทอง', 'กิเลนฟ้า', 'หงส์เพลิง', 'คชสาร', 'เหยี่ยวสายฟ้า', 'เสือสมิง', 'กระเรียนเหล็ก', 'ครุฑา', 'ฉลามคลั่ง', 'ม้าศึก', 'กระทิงดุ', 'หมาป่าเงิน', 'จงอางพิฆาต', 'ต่อเพชฌฆาต', 'ราชันตะวัน', 'จอมทัพสยาม', 'อสุรา', 'ไกรสร', 'เทพพิทักษ์', 'พิชิตมาร', 'ศรนารายณ์', 'นพเก้า', 'จักรพรรดิ', 'แสงสุริยา', 'ดาราฉาย', 'ป้อมปราการ']
];

export const AN = [
  'ฮาคุโร เอฟซี', 'คิตะซึกิ ยูไนเต็ด', 'ชินโดก ไทเกอร์ส', 'มูจิน มารีนส์',
  'เหลียงซาน ดราก้อน', 'เทียนหลง อิมพีเรียล', 'จินหลิง พยัคฆ์ใต้', 'อัลซาฮิล ฟอลคอนส์',
  'ซันดาร์ สตาร์', 'คาวีร์ ไลออนส์', 'อัลมาส เอ็มไพร์', 'ลองซา ริเวอร์',
  'นุสันตรา การูด้า', 'เมอร์ลิน วอร์ริเออร์ส', 'ราชปุระ สไปซ์', 'อาซูร่า ฮาร์เบอร์'
];

export const RN = ['รอบ 16 ทีม', 'รอบ 8 ทีม', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];
export const TN = ['ลีกระดับจังหวัด', 'ลีกในประเทศ ดิวิชั่น 2', 'ลีกในประเทศ ดิวิชั่น 1', 'ทีมต่างแดน'];
export const BASE = [40, 54, 68, 72];
export const POS: Position[] = ['GK', 'DF', 'MF', 'FW'];
export const ATT: [StatKey, string][] = [['sh', 'ยิง'], ['ps', 'จ่าย'], ['dr', 'เลี้ยง'], ['tk', 'แย่ง'], ['ph', 'กาย']];
export const GN: Record<Position, string> = { GK: 'ผู้รักษาประตู', DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };

export const SFX0 = [
  ['เอฟซี', 'เอสซี', 'สปอร์ตคลับ', 'ยูธ', 'ซิตี้', 'เอซี', ''],
  ['เอฟซี', 'เอสซี', 'แอธเลติก', 'ทาวน์', 'เรนเจอร์ส', 'ยูไนเต็ด', 'ซิตี้', ''],
  ['เอฟซี', 'แอธเลติก', 'เรนเจอร์ส', 'โรเวอร์ส', 'เวนเจอร์ส', 'แอสโตร', 'เอสซี', 'สตาร์', 'ยูไนเต็ด', 'ซิตี้', 'อะคาเดมี', '']
];

export const FSD: Record<string, [SubRole, number, number][]> = {
  '4-4-2': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 50], ['CM', 38, 55], ['CM', 62, 55], ['RM', 88, 50], ['ST', 38, 22], ['ST', 62, 22]],
  '4-3-3': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 27, 49], ['CDM', 50, 60], ['CM', 73, 49], ['LW', 15, 24], ['ST', 50, 17], ['RW', 85, 24]],
  '4-3-3 (F9)': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 28, 50], ['CDM', 50, 62], ['CM', 72, 50], ['LW', 18, 20], ['CF', 50, 27], ['RW', 82, 20]],
  '3-5-2': [['GK', 50, 92], ['CB', 24, 76], ['CB', 50, 80], ['CB', 76, 76], ['LM', 8, 46], ['CM', 30, 54], ['CDM', 50, 63], ['CM', 70, 54], ['RM', 92, 46], ['ST', 38, 21], ['ST', 62, 21]],
  '4-2-3-1': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 36, 63], ['CDM', 64, 63], ['LM', 14, 40], ['CAM', 50, 38], ['RM', 86, 40], ['ST', 50, 15]],
  '5-3-2': [['GK', 50, 92], ['LWB', 8, 62], ['CB', 28, 76], ['CB', 50, 80], ['CB', 72, 76], ['RWB', 92, 62], ['CM', 27, 48], ['CDM', 50, 57], ['CM', 73, 48], ['ST', 38, 20], ['ST', 62, 20]],
  '3-4-3': [['GK', 50, 92], ['CB', 24, 76], ['CB', 50, 80], ['CB', 76, 76], ['LM', 10, 52], ['CM', 38, 56], ['CM', 62, 56], ['RM', 90, 52], ['LW', 18, 22], ['ST', 50, 15], ['RW', 82, 22]],
  '5-4-1': [['GK', 50, 92], ['LWB', 8, 64], ['CB', 28, 76], ['CB', 50, 80], ['CB', 72, 76], ['RWB', 92, 64], ['LM', 14, 46], ['CM', 38, 52], ['CM', 62, 52], ['RM', 86, 46], ['ST', 50, 18]],
  '4-4-1-1': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 54], ['CM', 38, 58], ['CM', 62, 58], ['RM', 88, 54], ['CF', 50, 28], ['ST', 50, 15]],
  '4-1-2-1-2': [['GK', 50, 92], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 50, 63], ['CM', 27, 50], ['CM', 73, 50], ['CAM', 50, 38], ['ST', 38, 17], ['ST', 62, 17]]
};

export const LINE: Record<string, Position> = {
  GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF',
  CDM: 'MF', LDM: 'MF', RDM: 'MF', CM: 'MF', LCM: 'MF', RCM: 'MF', CAM: 'MF', LM: 'MF', RM: 'MF',
  ST: 'FW', CF: 'FW', LW: 'FW', RW: 'FW'
};

// CF (False 9 / Link-up) is kept distinct from ST (Poacher)
export const EQ: Record<string, string> = { LCM: 'CM', RCM: 'CM', LDM: 'CDM', RDM: 'CDM' };
export const SIMP = [
  'LB LWB', 'RB RWB', 'CDM CM', 'CM CAM', 'CM LM', 'CM RM', 'LM LW', 'RM RW',
  'ST CF', 'CF CAM', 'CF LW', 'CF RW',
  'LW ST', 'RW ST', 'LW CF', 'RW CF', 'LWB LM', 'RWB RM', 'CB CDM'
];
export const PM = [1, 0.97, 0.92];
export const PCOL = ['#ffffff', '#ffc247', '#ff6b6b'];

export const SPX: Record<Position, SubRole[]> = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  FW: ['ST', 'CF', 'LW', 'RW']
};

export const ALL_SUB_ROLES: SubRole[] = [
  'GK',
  'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'ST', 'CF', 'LW', 'RW'
];

export const SPN: Record<string, string> = {
  GK: 'ผู้รักษาประตู', CB: 'กองหลังกลาง', LB: 'แบ็กซ้าย', RB: 'แบ็กขวา',
  CDM: 'กองกลางตัวรับ', CM: 'กองกลาง', CAM: 'กองกลางตัวรุก', LM: 'ปีกซ้าย(กลาง)', RM: 'ปีกขวา(กลาง)',
  ST: 'หน้าเป้า (ปักหลักจบสกอร์)', CF: 'หน้าเชื่อม (False 9 / พักบอล)', LCM: 'กองกลางซ้าย', RCM: 'กองกลางขวา',
  LDM: 'ตัวรับซ้าย', RDM: 'ตัวรับขวา', LWB: 'วิงแบ็กซ้าย', RWB: 'วิงแบ็กขวา',
  LW: 'ปีกซ้าย', RW: 'ปีกขวา'
};

export const ROLE_HINT: Partial<Record<SubRole, string>> = {
  ST: 'ปักหลักค้ำแนวรับคู่แข่ง รอแทงทะลุช่องและเข้าฮอสในกรอบ 6 หลา',
  CF: 'ถอยลงมารับบอลเชื่อมเกม ดึงเซนเตอร์หลุดตำแหน่งเพื่อเปิดช่องให้ปีกและตัวสอดเข้ายิง'
};

export const POSL: SubRole[] = ['ST', 'CF', 'CAM', 'LW', 'RW', 'LM', 'RM', 'CM', 'CDM', 'LCM', 'RCM', 'LDM', 'RDM', 'CB', 'RWB', 'LWB', 'LB', 'RB'];
export const SKIN_P = ['#f6d4b3', '#f1c9a0', '#d9a273', '#a8744a', '#6b4630'];
export const HAIR_P = ['#16161a', '#4a2e16', '#8b5a2b', '#c9a227', '#7a2e22'];
export const HS_N = ['คลาสสิก', 'สไปกี้', 'ปัดข้าง', 'หยิกฟู', 'สกินเฮด', 'เสยเรียบ', 'คาดผม', 'แสกกลาง'];
export const FH_N = ['ไม่มี', 'เคราแพะ', 'เคราเต็ม', 'หนวด'];
export const FS_N = ['เรียว', 'กลม', 'กรามคม'];
export const EY_N = ['มุ่งมั่น', 'จริงจัง', 'ยิ้มมั่นใจ', 'สุขุม'];

export const KIT_P: [string, string][] = [
  ['#c0392b', '#ffffff'], ['#2f6fd6', '#f4c63d'], ['#e67e22', '#1d2d44'], ['#6d28d9', '#fde68a'],
  ['#111827', '#38bdf8'], ['#0e7c86', '#fff7ed'], ['#be185d', '#e0f2fe'], ['#15803d', '#fef08a'],
  ['#b45309', '#f8fafc'], ['#1d4ed8', '#fb7185'], ['#7c2d12', '#bae6fd'], ['#374151', '#fbbf24'],
  ['#9f1239', '#a7f3d0'], ['#0369a1', '#fde047'], ['#4c1d95', '#ffffff'], ['#dc2626', '#1e293b']
];
export const KIT_SW = [
  '#c0392b', '#991b1b', '#e67e22', '#f4c63d', '#84cc16', '#1c7a4a',
  '#0e7c86', '#0ea5e9', '#2f6fd6', '#1e3a8a', '#7c3aed', '#d6336c',
  '#ffffff', '#cbd5e1', '#111111'
];

export const SIGL: Record<string, string> = {
  fin: 'จบสกอร์', pw: 'พลังยิง', cur: 'ยิงโค้ง', fk: 'ลูกตั้งเตะ', run: 'เข้าทำตำแหน่ง (วิ่งหาช่อง)',
  crs: 'เปิดบอล', rd: 'อ่านเกม', pos: 'สกัด/ยืนตำแหน่ง', mrk: 'ประกบตัว', blk: 'บล็อกลูกยิง', hd: 'โหม่ง',
  spd: 'ความเร็ว', str: 'ความแข็งแรง', sta: 'ความอึด', tol: 'ทนต่อบาดเจ็บ', rec: 'ฟื้นตัวเร็ว',
  comp: 'ความนิ่งในนัดใหญ่', sv: 'เซฟ', cl: 'ออกมาปิดมุม', dist: 'จ่ายจากแนวหลัง'
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

  // Universal Mental & Physical
  {
    id: 'clutch_player',
    icon: '🔥',
    name: 'นักเตะเกมใหญ่',
    desc: 'ยิ่งท้ายเกม ดาร์บี้แมตช์ หรือบอลถ้วย ยิ่งเล่นนิ่งและคมขึ้น',
    tone: 'ment',
    pos: ['FW', 'MF', 'DF', 'GK']
  },
  {
    id: 'iron_lungs',
    icon: '🔋',
    name: 'ปอดเหล็กวิ่งไม่หมด',
    desc: 'ฟิตอึดผิดปกติ พลังงานในสนามลดช้ากว่าผู้เล่นทั่วไป',
    tone: 'phys',
    pos: ['FW', 'MF', 'DF'],
    conflicts: ['glass_cannon']
  },
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
    id: 'hot_headed',
    icon: '😡',
    name: 'อารมณ์ร้อน/เข้าหนัก',
    desc: 'ทุ่มเทดุดันแต่หงุดหงิดง่าย เสี่ยงโดนใบเหลือง/แดงบ่อยขึ้น',
    tone: 'ment',
    pos: ['FW', 'MF', 'DF'],
    conflicts: ['calm_leader']
  },
  {
    id: 'calm_leader',
    icon: '👑',
    name: 'ผู้นำใจเย็น',
    desc: 'คุมสติในสนามดี ปลุกใจเพื่อนร่วมทีมและลดจังหวะเสียใบเหลือง',
    tone: 'ment',
    pos: ['FW', 'MF', 'DF', 'GK'],
    conflicts: ['hot_headed']
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
    id: 'consistency_pro',
    icon: '⭐',
    name: 'มืออาชีพสม่ำเสมอ',
    desc: 'รักษามาตรฐานการเล่นได้ดีทุกนัด ไม่ค่อยหลุดฟอร์ม',
    tone: 'ment',
    pos: ['FW', 'MF', 'DF', 'GK']
  },
  {
    id: 'glass_cannon',
    icon: '⚡',
    name: 'ทุ่มสุดตัวไม่กลัวเจ็บ',
    desc: 'สปีดและแรงปะทะจัดเต็มทุกจังหวะ แต่เสียฟิตและเสี่ยงเจ็บง่ายขึ้น',
    tone: 'phys',
    pos: ['FW', 'MF', 'DF'],
    conflicts: ['iron_lungs']
  }
];

export const TRAIT_BY_ID: Record<string, FootballTraitDef> = Object.fromEntries(
  FOOTBALL_TRAITS.map((t) => [t.id, t])
);


export const ROLE_BASE_ATTRS = (pos: Position, sp: SubRole): CoreAttrs => {
  const map: Partial<Record<SubRole, CoreAttrs>> = {
    ST: { sh: 63, ps: 37, dr: 45, tk: 27, ph: 49 },
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

export const PACT = [
  { i: '💪', n: 'ซ้อมหนัก', d: 'พัฒนาค่าพลังหลักไวสุด แต่ฟื้นพลังกายน้อย', en: 5, gr: 0.28 },
  { i: '🏃', n: 'ซ้อมเบา', d: 'พัฒนาค่าพลังได้สม่ำเสมอ · พลังกายฟื้นตัวดี', en: 18, gr: 0.14 },
  { i: '😴', n: 'พักผ่อน', d: 'ฟื้นพลังกายได้มากที่สุด · รักษาความฟิตเต็มร้อย', en: 36, gr: 0 },
  { i: '📺', n: 'ดูวิดีโอวิเคราะห์เกม', d: 'นัดหน้าเล่นดีขึ้น (เรตติ้ง +0.3) · โอกาสพัฒนาไหวพริบ', en: 12, gr: 0, vid: 0.3, pt: 0.25 },
  { i: '🏋️', n: 'ยิม / วิ่งนอกสนาม', d: 'เน้นเพิ่มค่าความแข็งแรงร่างกาย · เหนื่อยพอสมควร', en: 10, gr: 0.25, k: 'ph' as StatKey },
  { i: '🤝', n: 'พบปะแฟนบอล', d: 'ขวัญแฟนบอลเพิ่ม ช่วยให้เล่นดีขึ้น · โอกาสพัฒนาความนิ่ง', en: 14, gr: 0, fan: 6, pt: 0.28 }
];

export const CAREER_PERKS: { id: string; name: string; desc: string; cost: number }[] = [
  { id: 'clutch', name: 'นิ่งในเกมใหญ่', desc: 'นัดดาร์บี้/บอลถ้วย มีโอกาสยิงและเรตติ้งสูงขึ้น', cost: 25 },
  { id: 'engine', name: 'ปอดเหล็ก', desc: 'เสียพลังกายต่อแมตช์น้อยลง 25%', cost: 30 },
  { id: 'prodigy', name: 'พรสวรรค์พุ่งทะยาน', desc: 'โอกาสค่าพลังขึ้นจากการซ้อม +10%', cost: 35 },
  { id: 'captain', name: 'ขวัญใจมหาชน', desc: 'ขวัญแฟนบอลเพิ่มเร็วขึ้นและช่วยดึงเรตติ้งทีม', cost: 20 }
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
