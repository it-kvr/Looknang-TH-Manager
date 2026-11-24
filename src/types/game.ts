import { R } from '../utils/math';
import { pen } from '../engine/playerCore';

export type Position = 'GK' | 'DF' | 'MF' | 'FW';
export type SubRole =
  | 'GK'
  | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'LDM' | 'RDM' | 'CM' | 'LCM' | 'RCM' | 'CAM' | 'LM' | 'RM'
  | 'ST' | 'CF' | 'LW' | 'RW';

export type StatKey = 'sh' | 'ps' | 'dr' | 'tk' | 'ph';
export type Mentality = 'X' | 'A' | 'B' | 'D' | 'Z';
export type GameMode = 'm' | 'p';
export type MainTab = 't' | 's' | 'q' | 'r' | 'k' | 'f' | 'u' | 'c' | 'p';
export type TrainingFocus = 'FW' | 'MF' | 'DF' | 'F';
export type TrainingProgramId = 'balanced' | 'attack' | 'defense' | 'tactics' | 'setpiece' | 'fitness' | 'recovery';
export type TrainingIntensity = 'light' | 'normal' | 'heavy';

export interface TeamTrainingPlan {
  program: TrainingProgramId;
  intensity: TrainingIntensity;
  restStarters?: boolean;
  doubleSessionMd?: number;
  individualFocus?: Record<string, 'REST' | 'FOCUS'>;
  lastReport?: {
    md: number;
    programName: string;
    intensity: TrainingIntensity;
    fitDeltaAvg: number;
    tacFamDelta: number;
    morDelta: number;
    improved: string[];
    restedCount: number;
  };
}

export interface CoreAttrs {
  sh: number;
  ps: number;
  dr: number;
  tk: number;
  ph: number;
}

export interface PlayerContract {
  yr: number;
  wg: number;
  role: 'key' | 'rot' | 'pro';
}

export interface Player {
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
  treatedMd?: number;
  customA?: CoreAttrs;
  customD?: Record<string, number>;
  customSig?: string;
  blessed?: boolean;
  sb?: Record<string, number>;
  coreSb?: Partial<CoreAttrs>;
  missions?: PlayerMissionsState;
}

export type PersonalMissionMetric =
  | 'setpieces'
  | 'passes'
  | 'shots'
  | 'crossAssists'
  | 'dribbles'
  | 'tackles'
  | 'headers'
  | 'saves'
  | 'matches';

export interface PlayerMissionsState {
  stats: Partial<Record<PersonalMissionMetric, number>>;
  claimed: Record<string, number>;
  focusId?: string;
}

export type CustomSlot = [SubRole, number, number];

export interface Team {
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

export interface ClubIdentity {
  name: string;
  nick: string;
  std: string;
  c1: string;
  c2: string;
  c3?: string;
  shape: number;
  pat: number;
  icon: string;
  iconColor?: string;
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

export interface PlayerCareerProfile {
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
  customD?: Record<string, number>;
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
  inj?: number;
  missions?: PlayerMissionsState;
}

export interface AutoRule {
  c: 'tr' | 'dr' | 'ld' | 'rc';
  min: number;
  tac: Mentality;
}

export interface MatchEvent {
  m: number;
  t: number;
  who: string;
  as?: string;
  style?: string;
}

export interface MatchCardEvent {
  m: number;
  t: number;
  who: string;
  type: 'Y' | 'Y2R' | 'R';
}

export interface MatchSubEvent {
  m: number;
  t: number;
  inPlayer: string;
  outPlayer: string;
}

export interface MatchDramaticEvent {
  m: number;
  t?: number;
  kind: 'var' | 'penalty' | 'woodwork' | 'save' | 'injury' | 'skill' | 'shootout' | 'clutch';
  text: string;
}

export interface MatchHighlightLine {
  m: number;
  kind: 'goal' | 'card' | 'drama' | 'summary';
  teamId?: number;
  text: string;
}

export interface MatchHighlightsSummary {
  id: string;
  matchLabel: string;
  scoreLine: string;
  headline: string;
  summaryText: string;
  lines: MatchHighlightLine[];
}

export interface PlayerPerfResult {
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

export interface MatchResult {
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
  incidents?: MatchDramaticEvent[];
  highlights?: MatchHighlightsSummary;
}

export interface CupState {
  alive: boolean;
  r: number;
  done: boolean;
  log: string[];
  ids: number[];
}

export interface AsiaCupState {
  r: number;
  p: number[];
  ids: number[];
  alive: boolean;
  done: boolean;
  log: string[];
}

export interface FeedItem {
  cat: string;
  txt: string;
  tone?: '' | 'urg' | 'offer' | 'ok';
  s: number;
  m: number;
}

export interface FinLogItem {
  t: string;
  amt: number;
  m: number;
  s: number;
}

export interface TransferOffer {
  n: string;
  p: number;
  t: string;
  teamId?: number;
  cnt?: number;
}

export interface ActiveDilemma {
  id: string;
  title: string;
  desc: string;
  category: string;
  options: { label: string; hint: string }[];
}

export interface ScoutMission {
  id: string;
  focus: 'wonderkid' | 'free' | 'gk' | 'striker' | 'defender' | 'midfielder';
  targetRole?: SubRole | '';
  label: string;
  turnsLeft: number;
  results?: Player[];
}

export interface TrophyRecord {
  season: number;
  title: string;
  tier?: number;
  type: 'league' | 'cup' | 'asia' | 'award' | 'nt';
}

export interface ClubRecords {
  bestWin?: { txt: string; diff: number };
  topSeasonScorer?: { n: string; g: number; s: number };
  mostPoints?: { pts: number; s: number };
  winStreak?: number;
  curStreak?: number;
}

export interface GameState {
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
  trainingPlan?: TeamTrainingPlan;
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
  matchHighlights?: MatchHighlightsSummary[];
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

export interface AppSettings {
  mute?: boolean;
  novib?: boolean;
  quick?: boolean;
  matchSpeed?: 0.25 | 0.5 | 1 | 2 | 4;
  autoSkipMatch?: boolean;
  theme?: 'light' | 'dark' | '';
  nocrowd?: boolean;
  subAlertEnabled?: boolean;
  subAlertFitThreshold?: number;
  subAlertFormThreshold?: number;
  godBlessingEnabled?: boolean;
}

export interface PlayerArchetype {
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

export interface TrainingProgramMeta {
  id: TrainingProgramId;
  icon: string;
  name: string;
  short: string;
  tf: TrainingFocus;
  positions: Position[] | 'YOUNG';
  fitMod: number;
  devMult: number;
  tacFamBonus: number;
  morBonus: number;
  injMult: number;
  desc: string;
  effectTag: string;
}

export interface DilemmaTemplate {
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

export interface PersonalMissionDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  metric: PersonalMissionMetric;
  unit: string;
  targets: [number, number, number];
  subRewards: Record<string, number>[];
  coreReward: StatKey;
  posFilter?: Position[];
}

export interface PitchPositionZone {
  id: string;
  sp: SubRole;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  line: Position;
}

export interface PitchDragPreview {
  slotIdx: number;
  player: Player;
  x: number;
  y: number;
  sp: SubRole;
  zoneId: string;
  zoneLabel: string;
}

export interface FinishedMatchPayload {
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
  injuries?: { teamId: number; name: string; games: number }[];
  playerActions?: Record<string, Partial<Record<PersonalMissionMetric, number>>>;
}

export type PitchIntent =
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

export type BallFlightType =
  | 'carry'
  | 'pass'
  | 'onetwo'
  | 'through'
  | 'lofted'
  | 'cross'
  | 'shot'
  | 'freekick'
  | 'penalty'
  | 'shootout_kick'
  | 'corner'
  | 'goalkick'
  | 'bounce';

export interface LivePitchAgent {
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
  diveTargetY?: number;
  acrobatTimer?: number;
  acrobatMax?: number;
  acrobatType?:
    | 'bicycle'
    | 'volley'
    | 'header'
    | 'diving_header'
    | 'burst'
    | 'stepover'
    | 'spin'
    | 'shield'
    | 'slide'
    | 'tackle'
    | 'clash'
    | 'skill_pass'
    | 'supersave';
  skillSpinDir?: number;
  actionDirX?: number;
  actionDirY?: number;
  injuredOut?: boolean;
  runToX?: number;
  runToY?: number;
  fit: number;
  hasYellow: boolean;
  sentOff: boolean;
  d: Record<string, number>;
  sig: string;
  tr: number;
  ov: number;
  vis: number[];
}

export interface LiveBallState {
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
  shotStyle?: 'normal' | 'bicycle' | 'volley' | 'curler' | 'trivela' | 'knuckle' | 'header' | 'diving_header' | 'deflected' | 'screamer' | 'chip' | 'panenka';
  carrierId: string | null;
  targetId: string | null;
  shooterId: string | null;
  lastPasserId: string | null;
  possessionSide: 'H' | 'A';
  trail: { x: number; y: number; z: number }[];
  shotPlan?: {
    outcome: 'block' | 'deflect' | 'miss' | 'woodwork' | 'save' | 'goal';
    blockerId?: string;
    deflectorId?: string;
    deflectedFrom?: string;
    parryCorner?: boolean;
    shootoutScored?: boolean;
  };
  bounceNext?: {
    setPiece?: PendingSetPiece;
    carrierId?: string;
    possessionSide?: 'H' | 'A';
    phaseLabel?: string;
    phaseTone?: LiveMatchWorld['phaseTone'];
    trailLog?: string;
  };
}

export interface LivePitchFx {
  id: number;
  type:
    | 'offside'
    | 'foul'
    | 'save'
    | 'block'
    | 'woodwork'
    | 'goal'
    | 'freekick'
    | 'corner'
    | 'card'
    | 'var'
    | 'penalty'
    | 'skill'
    | 'slide'
    | 'clash'
    | 'tackle'
    | 'injury'
    | 'onetwo'
    | 'through';
  x: number;
  y: number;
  toX?: number;
  toY?: number;
  offsideX?: number;
  label: string;
  color: string;
  ttl: number;
  maxTtl: number;
  wallPlayers?: { x: number; y: number }[];
  goalSide?: 'H' | 'A';
}

export interface PendingSetPiece {
  type: 'kickoff' | 'freekick' | 'penalty' | 'corner' | 'goalkick' | 'offside';
  side: 'H' | 'A';
  x: number;
  y: number;
  waitSec: number;
  wallPlayers?: { x: number; y: number }[];
}

export interface VarReviewState {
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

export interface ShootoutState {
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

export interface LiveMatchWorld {
  agents: LivePitchAgent[];
  ball: LiveBallState;
  fx: LivePitchFx[];
  nextFxId: number;
  pendingSetPiece: PendingSetPiece | null;
  secondHalf: boolean;
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
  goalNetRippleLeft: number;
  goalNetRippleRight: number;
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
  inMatchInjuryCount: number;
}

export interface GodBlessingPatch {
  ov: number;
  pot: number;
  age: number;
  fit: number;
  inj: number;
  sus: number;
  ro: SubRole;
  sig: string;
  coreA: CoreAttrs;
  subD: Record<string, number>;
}
