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
  '4-4-2': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 49], ['CM', 38, 54], ['CM', 62, 54], ['RM', 88, 49], ['ST', 38, 19], ['ST', 62, 19]],
  '4-3-3': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 27, 47], ['CDM', 50, 58], ['CM', 73, 47], ['LW', 15, 22], ['ST', 50, 14], ['RW', 85, 22]],
  '4-3-3 (F9)': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CM', 28, 48], ['CDM', 50, 59], ['CM', 72, 48], ['LW', 18, 18], ['CF', 50, 26], ['RW', 82, 18]],
  '3-5-2': [['GK', 50, 93], ['CB', 24, 76], ['CB', 50, 79], ['CB', 76, 76], ['LM', 8, 45], ['CM', 30, 52], ['CDM', 50, 60], ['CM', 70, 52], ['RM', 92, 45], ['ST', 38, 18], ['ST', 62, 18]],
  '4-2-3-1': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 36, 60], ['CDM', 64, 60], ['LM', 14, 39], ['CAM', 50, 38], ['RM', 86, 39], ['ST', 50, 13]],
  '5-3-2': [['GK', 50, 93], ['LWB', 8, 62], ['CB', 28, 76], ['CB', 50, 79], ['CB', 72, 76], ['RWB', 92, 62], ['CM', 27, 46], ['CDM', 50, 59], ['CM', 73, 46], ['ST', 38, 18], ['ST', 62, 18]],
  '3-4-3': [['GK', 50, 93], ['CB', 24, 76], ['CB', 50, 79], ['CB', 76, 76], ['LM', 10, 51], ['CM', 38, 55], ['CM', 62, 55], ['RM', 90, 51], ['LW', 18, 20], ['ST', 50, 13], ['RW', 82, 20]],
  '5-4-1': [['GK', 50, 93], ['LWB', 8, 64], ['CB', 28, 76], ['CB', 50, 79], ['CB', 72, 76], ['RWB', 92, 64], ['LM', 14, 46], ['CM', 38, 52], ['CM', 62, 52], ['RM', 86, 46], ['ST', 50, 16]],
  '4-4-1-1': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['LM', 12, 52], ['CM', 38, 56], ['CM', 62, 56], ['RM', 88, 52], ['CF', 50, 29], ['ST', 50, 12]],
  '4-1-2-1-2': [['GK', 50, 93], ['LB', 14, 72], ['CB', 38, 77], ['CB', 62, 77], ['RB', 86, 72], ['CDM', 50, 60], ['CM', 27, 48], ['CM', 73, 48], ['CAM', 50, 38], ['ST', 38, 15], ['ST', 62, 15]]
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
export const PM = [1, 0.94, 0.85];
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
  { id: 23, icon: '🏅', name: 'มืออาชีพไร้ที่ติ', label: '🏅 มืออาชีพไร้ที่ติ', desc: 'รักษาวินัยและสภาพร่างกายเยี่ยม บาดเจ็บยาก ฟื้นตัวไว และเล่นสม่ำเสมอทุกนัด', tone: 'pos' }
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
  { id: 'sharp_shooter', name: '🎯 จมูกไวล่าตาข่าย', desc: 'เรตติ้งพุ่งเพิ่มเมื่อยิงประตูหรือแอสซิสต์ได้ในแมตช์', cost: 32 },
  { id: 'adaptable', name: '🧩 สารพัดประโยชน์', desc: 'ปรับตัวเล่นตำแหน่งใหม่ได้ไวขึ้น 2 เท่าและลดผลกระทบเวลาหลุดตำแหน่ง', cost: 26 },
  { id: 'discipline_pro', name: '🧘 วินัยลูกหนัง', desc: 'ลดโอกาสโดนหักเรตติ้งจากใบเหลืองและช่วยคุมอารมณ์ในเกมเดือด', cost: 20 },
  { id: 'media_darling', name: '📸 ขวัญใจสื่อ', desc: 'ได้โบนัสเรตติ้งพื้นฐาน +0.25 ทุกนัดที่ลงสนามอย่างสม่ำเสมอ', cost: 28 },
  { id: 'tactical_mind', name: '🧠 สมองเพชรอ่านเกม', desc: 'อ่านจังหวะเกมขาด ช่วยยกระดับเรตติ้งในเกมที่ทีมชนะหรือเสมอ', cost: 28 },
  { id: 'iron_will', name: '🦁 จิตใจแกร่งเกินร้อย', desc: 'แม้ความฟิตต่ำกว่า 65% ก็ยังรักษามาตรฐานเรตติ้งได้ดีกว่าปกติ', cost: 24 },
  { id: 'playmaker_eye', name: '🪄 วิชั่นจ่ายบอลเฉียบ', desc: 'จ่ายบอลสร้างโอกาสเก่ง ได้โบนัสเรตติ้งพิเศษเมื่อมีแอสซิสต์', cost: 30 },
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
