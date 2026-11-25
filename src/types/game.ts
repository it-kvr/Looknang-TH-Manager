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
export type MatchKind = 'league' | 'cup' | 'ac' | 'lc' | 'sc' | 'dc';
export type MainTab = 't' | 's' | 'q' | 'r' | 'k' | 'f' | 'u' | 'c' | 'p';
export type TrainingFocus = 'FW' | 'MF' | 'DF' | 'F';
export type TrainingProgramId = 'balanced' | 'attack' | 'defense' | 'tactics' | 'setpiece' | 'fitness' | 'recovery';
export type TrainingIntensity = 'light' | 'normal' | 'heavy';
export type PreferredFoot = 'L' | 'R' | 'B';

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

export interface PlayerSeasonProgressPoint {
  md: number;
  ov: number;
  a: CoreAttrs;
}

export interface PlayerSeasonProgression {
  s: number;
  pts: PlayerSeasonProgressPoint[];
}

export interface Player {
  id?: string;
  n: string;
  pos: Position;
  ro: SubRole;
  sp?: number;
  ov: number;
  age: number;
  ht?: number;
  wt?: number;
  foot?: PreferredFoot;
  pot: number;
  talent?: number;
  traits?: string[];
  altRoles?: SubRole[];
  roleExp?: Record<string, number>;
  customPers?: number;
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
  hg?: number;
  customCreated?: number;
  sb?: Record<string, number>;
  coreSb?: Partial<CoreAttrs>;
  missions?: PlayerMissionsState;
  srs?: number;
  sra?: number;
  motm?: number;
  tyc?: number;
  history?: PlayerSeasonHistoryRecord[];
  careerLog?: string[];
  seasonProg?: PlayerSeasonProgression;
  retired?: boolean;
  retiredSeason?: number;
}

export interface CreatedPlayerTemplate {
  id: string;
  createdAt: number;
  profile: Omit<PlayerCareerProfile, 'b' | 'gl' | 'as' | 'ap' | 'rs' | 'en' | 'plan'>;
  ov: number;
  pot: number;
}

export type PersonalMissionMetric =
  | 'setpieces'
  | 'passes'
  | 'shots'
  | 'onTarget'
  | 'goals'
  | 'assists'
  | 'crossAssists'
  | 'keyPasses'
  | 'dribbles'
  | 'tackles'
  | 'interceptions'
  | 'blocks'
  | 'headers'
  | 'saves'
  | 'cleanSheets'
  | 'wins'
  | 'highRatings'
  | 'motm'
  | 'cleanGames'
  | 'matches'
  | 'braces'
  | 'clutchActions'
  | 'cleanWins'
  | 'awayWins';

export type MissionStageOutcome = 'ok' | 'fail';

export interface MissionAttemptLog {
  missionId: string;
  missionName: string;
  icon: string;
  stage: number;
  success: boolean;
  chance: number;
  rewardText?: string;
  md?: number;
  season?: number;
}

export interface MissionSeasonRecord {
  season: number;
  teamName?: string;
  metrics: Partial<Record<PersonalMissionMetric, number>>;
  passed: Record<string, number>;
  failed: Record<string, number>;
  endStage: Record<string, number>;
}

export interface PlayerMissionsState {
  stats: Partial<Record<PersonalMissionMetric, number>>;
  claimed: Record<string, number>;
  outcomes?: Record<string, MissionStageOutcome[]>;
  recentLogs?: MissionAttemptLog[];
  focusId?: string;
  seasonLog?: Record<number, MissionSeasonRecord>;
  seasonPlans?: Record<number, string[]>;
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
  philosophy?: string;
  history?: TeamSeasonHistoryRecord[];
  trophies?: TrophyRecord[];
  tacticTrialMd?: number;
  tacticTrialLabel?: string;
  fans?: number;
}

export type CoachStyleId = 'balanced' | 'attack' | 'defense' | 'youth' | 'motivator';

export type CoachOutfitId =
  | 'suit_navy'
  | 'suit_black'
  | 'suit_charcoal'
  | 'suit_camel'
  | 'tracksuit'
  | 'polo'
  | 'shirt';

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
  managerVis?: number[];
  managerStyle?: CoachStyleId;
  managerOutfit?: CoachOutfitId;
  managerRandomOutfitPerMatch?: boolean;
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
  acc?: number;
  no?: number;
  pts: number;
  b: CoreAttrs;
  a: CoreAttrs;
  sb?: Record<string, number>;
  customD?: Record<string, number>;
  age: number;
  ht?: number;
  wt?: number;
  foot?: PreferredFoot;
  talent?: number;
  traits?: string[];
  altRoles?: SubRole[];
  roleExp?: Record<string, number>;
  customPers?: number;
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
  history?: PlayerSeasonHistoryRecord[];
  roleTrain?: SubRole | null;
  sigDrills?: number;
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
  og?: boolean;
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
  kind: 'var' | 'penalty' | 'woodwork' | 'save' | 'injury' | 'skill' | 'shootout' | 'clutch' | 'miracle' | 'blessed' | 'own_goal' | 'slip' | 'whiff';
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
  playedSlots?: Record<number, Record<string, SubRole>>;
  incidents?: MatchDramaticEvent[];
  highlights?: MatchHighlightsSummary;
  att?: number;
  cap?: number;
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

export interface PlayerSeasonHistoryRecord {
  season: number;
  teamId: number;
  teamName: string;
  tier: number;
  ov: number;
  a?: CoreAttrs;
  startOv?: number;
  startA?: CoreAttrs;
  sp: number;
  sg: number;
  sa: number;
  cs: number;
  motm: number;
  yc: number;
  rc: number;
  avgRating: number;
  honor?: string;
}

export interface TeamSeasonHistoryRecord {
  season: number;
  tier: number;
  nextTier: number;
  rank: number;
  totalTeams: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  champion?: boolean;
  cupChampion?: boolean;
  asiaChampion?: boolean;
  leagueCupChampion?: boolean;
  superCupChampion?: boolean;
  divCupChampion?: boolean;
  cupStatus?: string;
  asiaStatus?: string;
  leagueCupStatus?: string;
  superCupStatus?: string;
  divCupStatus?: string;
  topScorer?: string;
}

export interface ClubAllTimePlayerRecord {
  name: string;
  pos: Position;
  ro?: SubRole;
  no?: number;
  vis?: number[];
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  motm: number;
  seasons: number;
  firstSeason?: number;
  lastSeason: number;
  playedSeasons?: number[];
  bestAvgRating: number;
  stillAtClub?: boolean;
  retired?: boolean;
  retiredSeason?: number;
  retiredAge?: number;
  snapshot?: Player;
}

export interface TrophyRecord {
  season: number;
  title: string;
  tier?: number;
  type: 'league' | 'cup' | 'asia' | 'league_cup' | 'super_cup' | 'div_cup' | 'award' | 'nt';
}

export interface ClubRecords {
  bestWin?: { txt: string; diff: number };
  worstLoss?: { txt: string; diff: number };
  topSeasonScorer?: { n: string; g: number; s: number };
  topSeasonAssist?: { n: string; a: number; s: number };
  mostPoints?: { pts: number; s: number; tier?: number };
  mostGoalsSeason?: { gf: number; s: number; tier?: number };
  bestDefenseSeason?: { ga: number; s: number; tier?: number };
  winStreak?: number;
  curStreak?: number;
  unbeatenStreak?: number;
  curUnbeatenStreak?: number;
  highestAttendance?: { att: number; cap: number; txt: string; opp?: string; kind?: string; s: number };
  allTimePlayers?: ClubAllTimePlayerRecord[];
}

export interface SeasonPlayerStatRecord {
  name: string;
  pos: Position;
  ro: SubRole;
  no?: number;
  age: number;
  ov: number;
  isMe?: boolean;
  sp: number;
  sg: number;
  sa: number;
  cs: number;
  yc: number;
  rc: number;
  motm: number;
  avgRating: number;
}

export interface SeasonArchiveRecord {
  season: number;
  teamId: number;
  teamName: string;
  tier: number;
  nextTier: number;
  rank: number;
  totalTeams: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  champion: boolean;
  statusText: string;
  cupStatus: string;
  asiaStatus?: string;
  leagueCupStatus?: string;
  superCupStatus?: string;
  divCupStatus?: string;
  leagueBestScorer?: string;
  leagueBestAssist?: string;
  topScorer?: { name: string; pos: Position; sg: number; sp: number } | null;
  topAssist?: { name: string; pos: Position; sa: number; sp: number } | null;
  topRating?: { name: string; pos: Position; avgRating: number; sp: number; motm: number } | null;
  topCleanSheet?: { name: string; pos: Position; cs: number; sp: number } | null;
  players: SeasonPlayerStatRecord[];
}

export type BoardDirectiveKind =
  | 'reduce_wages'
  | 'youth_focus'
  | 'tighten_defense'
  | 'attack_spark'
  | 'boost_finances'
  | 'win_form';

export interface BoardDirective {
  id: string;
  kind: BoardDirectiveKind;
  title: string;
  feedback: string;
  targetLabel: string;
  rewardText: string;
  penaltyText: string;
  issuedSeason: number;
  issuedMd: number;
  dueMd: number;
  startValue: number;
  targetValue: number;
  status: 'active' | 'passed' | 'failed';
  evaluatedMd?: number;
}

export interface BoardTempEffect {
  id: string;
  label: string;
  tone: 'bonus' | 'penalty';
  stat: 'mor' | 'fan' | 'att' | 'def' | 'tacFam';
  delta: number;
  expiresMd: number;
  season: number;
}

export interface BoardFeedbackEntry {
  season: number;
  md: number;
  tone: 'ok' | 'warn' | 'urg';
  msg: string;
}

export interface FinanceHistoryPoint {
  s: number;
  md: number;
  bal: number;
  inc: number;
  exp: number;
}

export interface ActivePartnerDeal {
  id: string;
  name: string;
  category?: string;
  perMatch: number;
  left: number;
  merchBoost?: number;
}

export interface PlayerJerseySaleRecord {
  name: string;
  no: number;
  pos: Position;
  ro: SubRole;
  units: number;
  revenue: number;
}

export interface SouvenirSaleRecord {
  id: 'scarf' | 'cap' | 'keychain' | 'mug' | 'ball' | 'poster';
  name: string;
  icon: string;
  unitPriceBaht: number;
  units: number;
  revenue: number;
}

export interface MegastoreSeasonArchive {
  season: number;
  capitalInvested: number;
  productionCost: number;
  totalRevenue: number;
  netProfit: number;
  blankJerseys: { units: number; revenue: number };
  printedJerseysTotal: { units: number; revenue: number };
  souvenirsTotal: { units: number; revenue: number };
  topPlayer: PlayerJerseySaleRecord | null;
  playerJerseys: PlayerJerseySaleRecord[];
  souvenirs: SouvenirSaleRecord[];
}

export interface ClubMegastoreState {
  capital: number;
  stockTier: number;
  capitalInvestedSeason: number;
  blankJerseyUnits: number;
  blankJerseyRev: number;
  playerJerseys: Record<string, PlayerJerseySaleRecord>;
  souvenirs: Record<string, number>;
  souvenirRevs: Record<string, number>;
  seasonCost: number;
  seasonRev: number;
  allTimeBlankUnits: number;
  allTimeBlankRev: number;
  allTimePrintedUnits: number;
  allTimePrintedRev: number;
  allTimeSouvenirUnits: number;
  allTimeSouvenirRev: number;
  allTimePlayerJerseys: Record<string, PlayerJerseySaleRecord>;
  seasonHistory: MegastoreSeasonArchive[];
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
  plc?: boolean;
  psc?: boolean;
  pdc?: boolean;
  cup: CupState;
  ac?: AsiaCupState;
  lc?: CupState;
  sc?: CupState;
  dc?: CupState;
  aq?: number[];
  aqs?: number;
  asia?: number[];
  prevLeagueChampId?: number;
  prevCupChampId?: number;
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
  ticketPlan?: string;
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
  finHist?: FinanceHistoryPoint[];
  finPendIn?: number;
  finPendOut?: number;
  esd?: number;
  mgrRep?: number;
  trophies?: TrophyRecord[];
  records?: ClubRecords;
  scout?: ScoutMission | null;
  dilemma?: ActiveDilemma | null;
  dilemmaCd?: number;
  boardDirective?: BoardDirective | null;
  boardDirectiveCd?: number;
  boardEffects?: BoardTempEffect[];
  boardFeedbackLog?: BoardFeedbackEntry[];
  schedRes?: Record<number, { h: number; a: number; gh: number; ga: number }>;
  cupLog?: { md: number; comp: 'cup' | 'asia' | 'lc' | 'sc' | 'dc'; r: number; h: number; a: number; gh: number; ga: number; penText?: string }[];
  med?: number;
  merchLv?: number;
  turfLv?: number;
  analyticsLv?: number;
  facCond?: Partial<Record<FacilityKey, number>>;
  staff?: { asst: number; fit: number; scout: number; physio: number; gkCoach?: number; setPieceCoach?: number };
  sponsorDeal?: ActivePartnerDeal | null;
  sponsorDeals?: ActivePartnerDeal[];
  megastore?: ClubMegastoreState;
  seasonArchives?: SeasonArchiveRecord[];
}

export type FacilityKey = 'st' | 'tr' | 'ya' | 'med' | 'merchLv' | 'turfLv' | 'analyticsLv';
export type StaffRoleKey = 'asst' | 'fit' | 'scout' | 'physio' | 'gkCoach' | 'setPieceCoach';

export interface AppSettings {
  mute?: boolean;
  novib?: boolean;
  quick?: boolean;
  matchSpeed?: 0.25 | 0.5 | 1 | 2 | 5;
  autoSkipMatch?: boolean;
  theme?: 'light' | 'dark' | '';
  nocrowd?: boolean;
  sfxVolume?: number;
  crowdVolume?: number;
  preferFullscreen?: boolean;
  subAlertEnabled?: boolean;
  subAlertFitThreshold?: number;
  subAlertFormThreshold?: number;
  autoSubMatch?: boolean;
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

export interface FootballTraitDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  tone: 'att' | 'play' | 'def' | 'gk' | 'ment' | 'phys';
  pos: Position[];
  roles?: SubRole[];
  conflicts?: string[];
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
  category?: 'attack' | 'playmaking' | 'defense' | 'gk' | 'physical';
  metric: PersonalMissionMetric;
  unit: string;
  targets: number[];
  subRewards: Record<string, number>[];
  coreReward: StatKey;
  coreRewards?: number[];
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
  playedSlots?: Record<number, Record<string, SubRole>>;
  injuries?: { teamId: number; name: string; games: number }[];
  playerActions?: Record<string, Partial<Record<PersonalMissionMetric, number>>>;
  att?: number;
  cap?: number;
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
  | 'cutback'
  | 'trivela_pass'
  | 'throwin'
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
    | 'dragback'
    | 'cutinside'
    | 'supersave'
    | 'slip'
    | 'whiff'
    | 'kick'
    | 'shoot_power'
    | 'shoot_finesse'
    | 'shoot_chip';
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
  traits?: string[];
  tr: number;
  ov: number;
  vis: number[];
  blessedMins?: number;
  blessedTag?: string;
}

export interface LiveBallState {
  x: number;
  y: number;
  z: number;
  startZ?: number;
  endZ?: number;
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
    ownGoalCulpritId?: string;
    isPureOwnGoal?: boolean;
    parryCorner?: boolean;
    shootoutScored?: boolean;
    gkDiveTargetY?: number;
    gkDiveDir?: number;
    gkDiveStartProg?: number;
    gkDiveStartY?: number;
    gkSaveX?: number;
  };
  bounceNext?: {
    setPiece?: PendingSetPiece;
    isOffsideCall?: boolean;
    offsideFx?: Omit<LivePitchFx, 'id'>;
    offsideLog?: string;
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
    | 'through'
    | 'cutback'
    | 'trivela'
    | 'dragback'
    | 'press'
    | 'cutinside'
    | 'solo'
    | 'throwin'
    | 'slip'
    | 'whiff'
    | 'kick_burst';
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
  type: 'kickoff' | 'freekick' | 'penalty' | 'corner' | 'goalkick' | 'offside' | 'throwin';
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

export interface MatchPitchPuddle {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  alpha: number;
}

export interface MatchEnvironment {
  season: 'rainy' | 'summer';
  timeOfDay: 'day' | 'night';
  puddles: MatchPitchPuddle[];
  sunAngle: number;
}

export interface LiveMatchWorld {
  env?: MatchEnvironment;
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
    isOwnGoal?: boolean;
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
  miracle?: {
    side: 'H' | 'A';
    minsLeft: number;
    maxDeficit: number;
    goalsDuring: number;
  } | null;
  sideline?: {
    benchH: LiveBenchSeat[];
    benchA: LiveBenchSeat[];
    coachH: LiveSidelineCoach;
    coachA: LiveSidelineCoach;
    warmupPhase: number;
  };
}

export interface LiveBenchSeat {
  id: string;
  shortName: string;
  no: number;
  role: SubRole;
  vis: number[];
  subbedOut?: boolean;
  isMe?: boolean;
}

export interface LiveSidelineCoach {
  side: 'H' | 'A';
  x: number;
  y: number;
  tx: number;
  ty: number;
  facing: number;
  pacePhase: number;
  gestureTimer: number;
  shoutText: string | null;
  shoutTimer: number;
  moodEmoji?: string | null;
  moodTimer?: number;
  moodCooldown?: number;
  isUserCoach: boolean;
  vis?: number[];
  tieColor?: string;
  outfit?: CoachOutfitId;
}

export interface GodBlessingPatch {
  ov: number;
  pot: number;
  talent?: number;
  age: number;
  ht?: number;
  wt?: number;
  foot?: PreferredFoot;
  fit: number;
  inj: number;
  sus: number;
  ro: SubRole;
  sig: string;
  traits?: string[];
  altRoles?: SubRole[];
  customPers?: number;
  perks?: string[];
  vis?: number[];
  coreA: CoreAttrs;
  subD: Record<string, number>;
}
