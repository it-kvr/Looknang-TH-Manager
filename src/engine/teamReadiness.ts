import type { FacilityKey, GameState, MainTab } from '../types/game';
import { getTeamTrainingPlan } from '../data/thaiFootballData';
import { fmtMoney, fmtMoneyNum } from '../utils/math';
import { ensureCon, xi } from './playerCore';
import {
  getActiveBoardEffects,
  getActiveClubDemands,
  getActivePartnerDeals,
  getBoardDirectiveProgress,
  getFacilityCondition,
  getFacilityRenovateCost,
  getFacilityUpgradeCost,
  getIncomingOffers,
  getLeagueTransferContext
} from './simulation';
import {
  getActiveFavBoost,
  getPlayerMentalScore,
  getPlayerPhysScore,
  getTeamCareQuotaInfo,
  getTeamFavoritePlayers,
  isTeamFavoritePlayer
} from './wellbeing';
import { getPlayerMissionView } from './missions';

export type ReadinessTone = 'urg' | 'warn' | 'ok';

export interface TeamReadinessQuickAction {
  type: 'rest_recovery' | 'player_rest' | 'ticket_standard' | 'renovate_fac';
  fk?: FacilityKey;
  baseCost?: number;
}

export interface TeamReadinessTask {
  id: string;
  kind: 'alert' | 'req';
  tone: ReadinessTone;
  icon: string;
  iconKind?: 'injury';
  shortLabel: string;
  tag: string;
  title: string;
  detail: string;
  actionLabel?: string;
  nav?: {
    tab: MainTab;
    sub?: string;
    focus?: string;
    hint?: string;
  };
  quickAction?: TeamReadinessQuickAction;
}

export interface TeamReadinessSummary {
  tasks: TeamReadinessTask[];
  totalCount: number;
  urgentCount: number;
  topTone: ReadinessTone | 'ready';
  avgXiFit: number;
  unreadyStarterCount: number;
  readyLabel: string;
  compactLabel: string;
  tooltipText: string;
  missionHighlight: {
    label: string;
    pct: number;
    tab: MainTab;
    sub: string;
  } | null;
}

const FAC_BASE_COST_MAP: Record<FacilityKey, number> = {
  st: 100,
  tr: 90,
  ya: 80,
  med: 80,
  merchLv: 75,
  turfLv: 75,
  analyticsLv: 85,
  travelLv: 70
};

export function buildTeamReadinessSummary(state: GameState): TeamReadinessSummary {
  const me = state.teams[state.me];
  const tasks: TeamReadinessTask[] = [];
  let avgXiFit = 100;
  let unreadyStarterCount = 0;
  let missionHighlight: TeamReadinessSummary['missionHighlight'] = null;

  if (!me) {
    return {
      tasks,
      totalCount: 0,
      urgentCount: 0,
      topTone: 'ready',
      avgXiFit: 100,
      unreadyStarterCount: 0,
      readyLabel: 'ทีมพร้อม',
      compactLabel: 'พร้อม',
      tooltipText: 'ทีมพร้อมลงสนามนัดถัดไป',
      missionHighlight: null
    };
  }

  if (state.mode === 'm') {
    const starters = xi(me);
    const unreadyXi = starters.filter((q) => (q.inj || 0) > 0 || (q.sus || 0) > 0);
    unreadyStarterCount = unreadyXi.length;
    avgXiFit = Math.round(starters.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, starters.length));
    const tiredStarters = starters.filter((q) => (q.fit ?? 100) < 74);
    const lowFitAll = me.sq.filter((q) => !q.inj && (q.fit ?? 100) < 62);
    const injuredList = me.sq.filter((q) => q.inj > 0);
    const ownPlayers = me.sq.filter((q) => !q.loan);
    const expiredCon = ownPlayers.filter((q) => ensureCon(q).yr <= 0);
    const expiringSoon = ownPlayers.filter((q) => ensureCon(q).yr === 1);
    const incomingOffers = getIncomingOffers(state);
    const curPlan = getTeamTrainingPlan(state);
    const tx = getLeagueTransferContext(state, me);
    const activeDeals = getActivePartnerDeals(state);
    const careQuota = getTeamCareQuotaInfo(state, me);
    const favList = getTeamFavoritePlayers(me);
    const unboostedFavs = favList.filter((fp) => getActiveFavBoost(fp, me, fp.me ? state.p : null) === 0);
    const avgMental = Math.round(
      me.sq.reduce((sum, q) => sum + getPlayerMentalScore(q, q.me ? state.p : null), 0) / Math.max(1, me.sq.length)
    );

    if (state.dilemma) {
      tasks.push({
        id: 'active-dilemma',
        kind: 'alert',
        tone: 'urg',
        icon: '📌',
        shortLabel: 'รอตัดสินใจ',
        tag: 'รอตัดสินใจ',
        title: state.dilemma.title,
        detail: state.dilemma.category,
        actionLabel: 'จัดการ',
        nav: { tab: 't' }
      });
    }

    if (unreadyXi.length > 0) {
      const unreadyNames = unreadyXi.slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
      tasks.push({
        id: 'xi-unready',
        kind: 'alert',
        tone: 'urg',
        icon: '⚠️',
        shortLabel: `ตัวจริงขาด ${unreadyXi.length}`,
        tag: 'จัดทัพ 11 ตัวจริง',
        title: `ตัวจริงไม่พร้อม ${unreadyXi.length} คน`,
        detail: unreadyXi
          .slice(0, 2)
          .map((q) => `${q.n.split(' ')[0]} (${q.inj > 0 ? 'เจ็บ' : 'แบน'})`)
          .join(', '),
        actionLabel: 'จัดทัพ',
        nav: {
          tab: 'q',
          focus: 'xi-unready',
          hint: `เปลี่ยนตัวจริงที่เจ็บ/แบน (${unreadyNames}) ออก — กด "⚡ สลับตัวพร้อมลง" ที่แถบแจ้งเตือนหรือลากสลับกับตัวสำรอง`
        }
      });
    }

    if (state.money < 0 || (state.bd ?? 55) < 40) {
      const isMoneyNeg = state.money < 0;
      tasks.push({
        id: 'club-alert-fin-bd',
        kind: 'alert',
        tone: 'urg',
        icon: '⚠️',
        shortLabel: isMoneyNeg ? 'งบติดลบ' : `บอร์ด ${Math.round(state.bd ?? 55)}%`,
        tag: isMoneyNeg ? 'การเงิน' : 'บอร์ดบริหาร',
        title: isMoneyNeg ? `งบติดลบ ${fmtMoney(state.money)}` : `บอร์ดกังวล (${Math.round(state.bd ?? 55)}%)`,
        detail: isMoneyNeg ? 'ตลาดถูกระงับชั่วคราว' : 'เร่งเก็บแต้มเรียกความเชื่อมั่น',
        actionLabel: isMoneyNeg ? 'ดูการเงิน' : 'ดูบอร์ด',
        nav: isMoneyNeg
          ? {
              tab: 'f',
              sub: 'overview',
              focus: 'fin-cashflow',
              hint: 'ตรวจดูสมดุลรายรับ-รายจ่าย และหาทุนเพิ่มหรือลดรายจ่ายเพื่อพ้นตัวแดง'
            }
          : {
              tab: 'u',
              sub: 'info',
              focus: 'board-directive',
              hint: 'ตรวจดูความเชื่อมั่นบอร์ดและเป้าหมายซีซั่นในกรอบที่ไฮไลต์'
            }
      });
    }

    const activeDemands = getActiveClubDemands(state);
    activeDemands.forEach((req) => {
      const remMd = Math.max(0, req.dueMd - (state.md ?? 0));
      const srcBadge = req.source === 'player' ? 'นักเตะขอ' : 'แฟนบอลขอ';
      let actionLabel = 'จัดการ';
      let detailText = `รางวัล: ${req.rewardText}`;
      let nav: TeamReadinessTask['nav'] = { tab: 'u', sub: 'infra' };
      let quickAction: TeamReadinessQuickAction | undefined;

      if (req.kind === 'renovate_fac') {
        const fk = req.targetKey as FacilityKey;
        const lv = state[fk] ?? 1;
        const cond = getFacilityCondition(state, fk);
        const baseCost = FAC_BASE_COST_MAP[fk] ?? 80;
        const renCost = lv > 0 ? getFacilityRenovateCost(baseCost, lv, cond) : 0;
        if (lv > 0 && state.money >= renCost) {
          actionLabel = `ซ่อม ${fmtMoneyNum(renCost)}`;
          quickAction = { type: 'renovate_fac', fk, baseCost };
        } else {
          actionLabel = 'ไปซ่อม';
          nav = {
            tab: 'u',
            sub: 'infra',
            focus: `fac:${fk}`,
            hint: `กดปุ่ม "🔧 ซ่อม" ที่การ์ดที่ไฮไลต์ด้านซ้าย (${req.title})`
          };
        }
      } else if (req.kind === 'upgrade_fac') {
        const fk = req.targetKey as FacilityKey;
        const lv = state[fk] ?? 1;
        const upgCost = getFacilityUpgradeCost(FAC_BASE_COST_MAP[fk] ?? 80, lv);
        detailText = `ค่าใช้จ่าย -${fmtMoneyNum(upgCost)} · ${req.rewardText}`;
        actionLabel = 'อัปเกรด';
        nav = {
          tab: 'u',
          sub: 'infra',
          focus: `fac:${fk}`,
          hint: `กดปุ่ม "อัปเกรด" ที่การ์ดสิ่งอำนวยความสะดวกที่ไฮไลต์ด้านซ้าย (${req.title})`
        };
      } else if (req.kind === 'hire_staff') {
        actionLabel = 'จ้างทีมงาน';
        nav = {
          tab: 'u',
          sub: 'infra',
          focus: `staff:${req.targetKey}`,
          hint: `กดปุ่ม "จ้าง / อัป" ที่การ์ดทีมงานสตาฟฟ์ที่ไฮไลต์ฝั่งขวา (${req.title})`
        };
      } else if (req.kind === 'ticket_price') {
        actionLabel = 'ปรับตั๋ว';
        quickAction = { type: 'ticket_standard' };
      } else if (req.kind === 'live_stream') {
        actionLabel = 'เปิดสตรีม';
        nav = {
          tab: 'f',
          sub: 'commercial',
          focus: 'stream',
          hint: 'เลือกแพ็กเกจถ่ายทอดสดที่ต้องการในกรอบที่ไฮไลต์ แล้วกด "💾 บันทึกการเปลี่ยนแปลง"'
        };
      } else if (req.kind === 'megastore_stock') {
        actionLabel = 'เติมร้าน';
        nav = {
          tab: 'f',
          sub: 'megastore',
          focus: 'megastore-stock',
          hint: 'กด "+ทุน 25k" / "+พอดี 4 นัด" หรือเปิด "เติมอัตโนมัติ" ในกรอบที่ไฮไลต์'
        };
      }

      tasks.push({
        id: `demand-${req.id}`,
        kind: 'req',
        tone: remMd <= 1 ? 'urg' : 'warn',
        icon: req.source === 'player' ? '🗣️' : '📣',
        shortLabel: srcBadge,
        tag: `${srcBadge} · อีก ${remMd} นัด`,
        title: req.title,
        detail: detailText,
        actionLabel,
        nav,
        quickAction
      });
    });

    if (state.boardDirective && state.boardDirective.status === 'active') {
      const dir = state.boardDirective;
      const prog = getBoardDirectiveProgress(state, dir);
      const remMd = Math.max(0, dir.dueMd - (state.md ?? 0));
      tasks.push({
        id: 'board-directive-active',
        kind: 'alert',
        tone: prog.isComplete ? 'ok' : remMd <= 1 ? 'urg' : 'warn',
        icon: '📋',
        shortLabel: prog.isComplete ? 'บอร์ดครบเป้า' : 'คำสั่งบอร์ด',
        tag: `คำสั่งบอร์ด · อีก ${remMd} นัด`,
        title: dir.title,
        detail: `${prog.progressText} (${Math.round(prog.ratio * 100)}%)`,
        actionLabel: 'ดูเป้า',
        nav: {
          tab: 'u',
          sub: 'info',
          focus: 'board-directive',
          hint: `ตรวจดูความคืบหน้าและกำหนดส่งคำสั่งบอร์ดในกรอบที่ไฮไลต์ (${dir.title})`
        }
      });
      missionHighlight = {
        label: `คำสั่งบอร์ด: ${dir.title}`,
        pct: Math.round(prog.ratio * 100),
        tab: 'u',
        sub: 'info'
      };
    } else {
      const activeBoardFx = getActiveBoardEffects(state);
      if (activeBoardFx.length > 0) {
        const topFx = activeBoardFx[0];
        missionHighlight = {
          label: `${topFx.label} (${Math.max(1, topFx.expiresMd - (state.md ?? 0))} นัด)`,
          pct: 100,
          tab: 'u',
          sub: 'info'
        };
      }
    }

    if (incomingOffers.length > 0) {
      const topOff = incomingOffers[0];
      const isLoan = topOff.kind === 'loan' || topOff.kind === 'loanopt';
      tasks.push({
        id: 'transfer-offers',
        kind: 'alert',
        tone: 'warn',
        icon: isLoan ? '🤝' : '💼',
        shortLabel: `ข้อเสนอ ${incomingOffers.length}`,
        tag: 'ข้อเสนอซื้อ-ยืม',
        title: `${incomingOffers.length} ข้อเสนอรอตอบ`,
        detail: `${topOff.t} ${isLoan ? 'ยืม' : 'ซื้อ'} ${topOff.n} (+${fmtMoney(topOff.p)})`,
        actionLabel: 'เปิดดู',
        nav: {
          tab: 'k',
          sub: 'sell',
          focus: 'incoming-offers',
          hint: 'กด "ขาย / ยอมรับ", "ต่อรองราคา" หรือ "ปฏิเสธ" ที่ข้อเสนอฝั่งซ้าย'
        }
      });
    }

    if (state.scout?.results) {
      tasks.push({
        id: 'scout-ready',
        kind: 'alert',
        tone: 'ok',
        icon: '🔍',
        shortLabel: `แมวมอง (${state.scout.results.length})`,
        tag: 'แมวมอง',
        title: `พบนักเตะ ${state.scout.results.length} ราย`,
        detail: state.scout.label,
        actionLabel: 'ดูรายชื่อ',
        nav: {
          tab: 'k',
          sub: 'scout',
          focus: 'scout-report',
          hint: 'เลือกนักเตะจากรายงานฝั่งขวาเพื่อยื่นซื้อ/ยืมตัว หรือกดดาว ★ เก็บลงลิสต์'
        }
      });
    }

    if (expiredCon.length > 0 || expiringSoon.length > 0) {
      const namesPreview = [...expiredCon, ...expiringSoon].slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
      const totalNeed = expiredCon.length + expiringSoon.length;
      tasks.push({
        id: 'contracts-expiring',
        kind: 'alert',
        tone: expiredCon.length > 0 ? 'urg' : 'warn',
        icon: '📄',
        shortLabel: expiredCon.length > 0 ? `หมดสัญญา ${expiredCon.length}` : `ต่อสัญญา ${expiringSoon.length}`,
        tag: 'สัญญานักเตะ',
        title: expiredCon.length > 0 ? `หมดสัญญา ${expiredCon.length} คน` : `สัญญาเหลือ 1 ปี (${expiringSoon.length} คน)`,
        detail: `${namesPreview}${totalNeed > 2 ? ` +${totalNeed - 2}` : ''}`,
        actionLabel: 'ต่อสัญญา',
        nav: {
          tab: 'k',
          sub: 'con',
          focus: 'contracts-expiring',
          hint: 'กรองเฉพาะ "ใกล้หมด" ไว้ให้แล้ว — กดปุ่ม "ต่อสัญญา" ที่นักเตะแต่ละคน'
        }
      });
    }

    const needRest = (tiredStarters.length > 0 || lowFitAll.length > 0 || avgXiFit < 76) && curPlan.program !== 'recovery';
    if (needRest) {
      tasks.push({
        id: 'rest-needed',
        kind: 'alert',
        tone: avgXiFit < 68 || lowFitAll.length >= 3 ? 'urg' : 'warn',
        icon: '😴',
        shortLabel: `ตัวจริงล้า (${avgXiFit}%)`,
        tag: 'ความฟิตทีม',
        title: `ตัวจริงล้า (ฟิต ${avgXiFit}%)`,
        detail: `ล้า ${tiredStarters.length} คน · แนะนำพักฟื้น`,
        actionLabel: 'พักฟื้น',
        nav: {
          tab: 'r',
          sub: 'program',
          hint: 'เลือกโปรแกรมซ้อม "😴 พักผ่อน & ฟื้นฟู" เพื่อฟื้นความฟิตนักเตะก่อนลงแข่ง'
        },
        quickAction: { type: 'rest_recovery' }
      });
    }

    if (injuredList.length > 0) {
      tasks.push({
        id: 'club-injured-rehab',
        kind: 'alert',
        tone: 'urg',
        icon: '✚',
        iconKind: 'injury',
        shortLabel: `บาดเจ็บ ${injuredList.length} คน`,
        tag: 'ห้องพยาบาล',
        title: `บาดเจ็บ ${injuredList.length} คน`,
        detail: injuredList.slice(0, 2).map((q) => `${q.n.split(' ')[0]} (${q.inj} นัด)`).join(', '),
        actionLabel: 'ฟื้นฟู',
        nav: {
          tab: 'r',
          sub: 'program',
          focus: 'rehab',
          hint: 'กด "✚ กายภาพกลุ่ม" ในกรอบที่ไฮไลต์ฝั่งซ้าย หรือกด "😴 พัก" ที่คนเจ็บฝั่งขวา'
        }
      });
    }

    if (unboostedFavs.length > 0 && careQuota.remaining > 0) {
      const favPl = unboostedFavs[0];
      const fm = getPlayerMentalScore(favPl, favPl.me ? state.p : null);
      const fp = getPlayerPhysScore(favPl, favPl.me ? state.p : null);
      const favShort = favPl.n.split(' ')[0];
      tasks.push({
        id: 'fav-needs-care',
        kind: 'alert',
        tone: 'warn',
        icon: '💖',
        shortLabel: unboostedFavs.length > 1 ? `ปลุกลูกรัก ${unboostedFavs.length}` : 'ปลุกลูกรัก',
        tag: 'ลูกรัก & จิตใจ',
        title:
          unboostedFavs.length === 1
            ? `ลูกรักรอปลุกพลัง (${favShort})`
            : `ลูกรักรอปลุกพลัง ${unboostedFavs.length} คน (${favShort})`,
        detail: `ใจ ${fm} · กาย ${fp} (ต้อง ≥72)`,
        actionLabel: 'ดูแลทีม',
        nav: {
          tab: 'r',
          sub: 'talk',
          focus: `talk:${favPl.n}`,
          hint: `เลือกหัวข้อพูดคุยหรือกดฟื้นฟูกล้ามเนื้อให้ ${favPl.n} ในกรอบที่ไฮไลต์ (ทำ ใจ≥72 และ กาย≥72)`
        }
      });
    } else if (avgMental < 60 && careQuota.remaining > 0) {
      tasks.push({
        id: 'team-morale-low',
        kind: 'alert',
        tone: 'warn',
        icon: '💬',
        shortLabel: `ขวัญทีม ${avgMental}`,
        tag: 'ทีมทอล์ก',
        title: `ขวัญทีมต่ำ (${avgMental}/100)`,
        detail: `เหลือโควตาดูแล ${careQuota.remaining}/${careQuota.limit} ครั้ง`,
        actionLabel: 'พูดคุย',
        nav: {
          tab: 'r',
          sub: 'talk',
          focus: 'team-talk',
          hint: 'เลือกหัวข้อ "ประชุมทีมทอล์ก" ฝั่งซ้ายเพื่อปลุกขวัญทั้งทีม หรือคุยรายคนฝั่งขวา'
        }
      });
    }

    const expiringDeal = activeDeals.find((d) => d.left <= 2);
    if (expiringDeal) {
      tasks.push({
        id: `sponsor-expiring-${expiringDeal.id}`,
        kind: 'alert',
        tone: 'warn',
        icon: '🤝',
        shortLabel: 'ดีลใกล้หมด',
        tag: 'พาร์ทเนอร์',
        title: `ดีล ${expiringDeal.name} เหลือ ${expiringDeal.left} นัด`,
        detail: 'ใกล้ครบสัญญา เตรียมเลือกดีลใหม่',
        actionLabel: 'ดูดีล',
        nav: {
          tab: 'f',
          sub: 'commercial',
          focus: 'partner-deals',
          hint: `ตรวจสอบดีล ${expiringDeal.name} และเลือกเซ็นดีลใหม่ในกรอบที่ไฮไลต์`
        }
      });
    }

    const bankRemain = state.bankLoan ? state.bankLoan.left * state.bankLoan.per : 0;
    const payDue = state.payDue || 0;
    if (payDue > 0 || (state.bankLoan && state.money < state.bankLoan.per * 2)) {
      tasks.push({
        id: 'fin-debt-watch',
        kind: 'alert',
        tone: payDue > 0 ? 'warn' : 'urg',
        icon: '🏦',
        shortLabel: 'หนี้ค้าง',
        tag: 'ภาระหนี้',
        title: `หนี้คงค้าง ${fmtMoney(bankRemain + payDue)}`,
        detail: payDue > 0 ? `ผ่อนปลายปี ${fmtMoneyNum(payDue)}` : 'ค่างวดใกล้ถึงกำหนด',
        actionLabel: 'ดูหนี้',
        nav: {
          tab: 'f',
          sub: 'ledger',
          focus: 'bank-loan',
          hint: 'กด "จ่าย 1 งวด" หรือ "โปะปิดทั้งหมด" ในกรอบธนาคารที่ไฮไลต์'
        }
      });
    }

    if (tx.wagePct >= 95) {
      tasks.push({
        id: 'fin-ffp-wage',
        kind: 'alert',
        tone: 'urg',
        icon: '📊',
        shortLabel: 'ค่าเหนื่อยเต็ม',
        tag: 'เพดานค่าเหนื่อย',
        title: `ค่าเหนื่อยใกล้เต็ม (${tx.wagePct}%)`,
        detail: `${fmtMoneyNum(tx.curWage)} / ${fmtMoneyNum(tx.wageCap)}`,
        actionLabel: 'ดูงบ',
        nav: {
          tab: 'f',
          sub: 'overview',
          focus: 'ffp-wage',
          hint: 'ตรวจเพดานค่าเหนื่อย (FFP) ในกรอบที่ไฮไลต์ — ปล่อยยืมหรือขายนักเตะเพื่อลดภาระค่าเหนื่อย'
        }
      });
    }
  } else if (state.p) {
    const p = state.p;
    const mePl = me.sq.find((q) => q.me || q.n === p.name) || null;
    avgXiFit = Math.round(p.en ?? 100);

    if ((p.en ?? 100) < 70 && (p.plan ?? 1) !== 3) {
      tasks.push({
        id: 'player-rest-warn',
        kind: 'alert',
        tone: p.en < 52 ? 'urg' : 'warn',
        icon: '😴',
        shortLabel: `ฟิตเหลือ ${p.en}%`,
        tag: 'ความฟิต',
        title: `ความฟิตเหลือ ${p.en}%`,
        detail: 'ต่ำกว่า 58% เสี่ยงหลุดตัวจริง',
        actionLabel: 'ตั้งพักผ่อน',
        nav: {
          tab: 'p',
          sub: 'plan',
          focus: 'wellbeing',
          hint: 'ปรับแผนสัปดาห์นี้เป็น "พักผ่อน" เพื่อฟื้นความฟิตก่อนลงสนาม'
        },
        quickAction: { type: 'player_rest' }
      });
    }

    if ((p.inj || 0) > 0) {
      unreadyStarterCount = 1;
      tasks.push({
        id: 'player-inj-warn',
        kind: 'alert',
        tone: 'urg',
        icon: '✚',
        iconKind: 'injury',
        shortLabel: `เจ็บ ${p.inj} นัด`,
        tag: 'อาการเจ็บ',
        title: `บาดเจ็บพัก ${p.inj} นัด`,
        detail: 'ฟื้นฟูร่างกายได้ที่หน้าอาชีพ',
        actionLabel: 'ฟื้นฟู',
        nav: {
          tab: 'p',
          sub: 'plan',
          focus: 'wellbeing',
          hint: 'เลือกแผน "พักผ่อน" และกดปุ่มฟื้นฟู/กายภาพในการ์ดสุขภาพที่ไฮไลต์ด้านล่าง'
        }
      });
    }

    if ((p.sus || 0) > 0 || (p.yc || 0) >= 2) {
      if ((p.sus || 0) > 0) unreadyStarterCount = 1;
      tasks.push({
        id: 'player-card-warn',
        kind: 'alert',
        tone: (p.sus || 0) > 0 ? 'urg' : 'warn',
        icon: (p.sus || 0) > 0 ? '🟥' : '🟨',
        shortLabel: (p.sus || 0) > 0 ? `ติดแบน ${p.sus} นัด` : `เหลือง ${p.yc}/3 ใบ`,
        tag: 'วินัยสนาม',
        title: (p.sus || 0) > 0 ? `ติดโทษแบน ${p.sus} นัด` : `ใบเหลือง ${p.yc}/3 ใบ`,
        detail: (p.sus || 0) > 0 ? 'รอพ้นโทษแบน' : 'อีก 1 เหลืองโดนแบน 1 นัด',
        actionLabel: 'ดูสถานะ',
        nav: { tab: 'p', sub: 'plan' }
      });
    }

    if ((p.mental ?? 70) < 58 || (p.phys ?? 70) < 58) {
      tasks.push({
        id: 'player-wellbeing-low',
        kind: 'alert',
        tone: 'warn',
        icon: '💬',
        shortLabel: `ใจ/กายต่ำ`,
        tag: 'สุขภาพใจ/กาย',
        title: `ใจ ${p.mental ?? 70} · กาย ${p.phys ?? 70} ค่อนข้างต่ำ`,
        detail: 'คุยปรับใจหรือฟื้นฟูกล้ามเนื้อ',
        actionLabel: 'ดูแลตัวเอง',
        nav: {
          tab: 'p',
          sub: 'plan',
          focus: 'wellbeing',
          hint: 'กดปุ่มคุยปรับใจหรือฟื้นฟูกล้ามเนื้อในการ์ดสุขภาพที่ไฮไลต์ด้านล่าง'
        }
      });
    } else if (mePl && isTeamFavoritePlayer(me, p.name) && getActiveFavBoost(mePl, me, p) === 0) {
      tasks.push({
        id: 'player-fav-boost-wait',
        kind: 'alert',
        tone: 'ok',
        icon: '💖',
        shortLabel: 'ลูกรักรอปลุกพลัง',
        tag: 'ลูกรักทีม',
        title: 'ลูกรักรอปลุกพลัง (+5~10)',
        detail: `ทำใจ ${p.mental ?? 70} และกาย ${p.phys ?? 70} ให้ถึง 72`,
        actionLabel: 'ฟื้นฟู',
        nav: {
          tab: 'p',
          sub: 'plan',
          focus: 'wellbeing',
          hint: 'ดูแลจิตใจและร่างกายให้ถึง 72 ในการ์ดสุขภาพที่ไฮไลต์เพื่อเปิดโบนัส +5~10 OVR'
        }
      });
    }

    const refPlayer = mePl || {
      n: p.name,
      pos: p.pos,
      ro: p.sp,
      ov: 65,
      age: p.age,
      pot: 90,
      fit: p.en ?? 100,
      inj: p.inj ?? 0,
      me: 1 as const,
      missions: p.missions
    };
    const mv = getPlayerMissionView(refPlayer, p, state);
    const activeItems = mv.items.filter((x) => !x.completedAll);
    const pinnedIds = new Set(mv.mState.seasonPlans?.[state.season] || []);
    const candidate =
      activeItems
        .filter((x) => pinnedIds.has(x.def.id))
        .sort((a, b) => b.pct - a.pct)[0] ||
      activeItems.sort((a, b) => b.pct - a.pct)[0];
    if (candidate) {
      missionHighlight = {
        label: `${candidate.def.icon} ${candidate.def.name} (${candidate.curVal}/${candidate.target})`,
        pct: candidate.pct,
        tab: 'p',
        sub: 'missions'
      };
    }
  }

  const totalCount = tasks.length;
  const urgentCount = tasks.filter((t) => t.tone === 'urg').length;
  const topTask = tasks[0];
  const topTone: TeamReadinessSummary['topTone'] =
    totalCount === 0
      ? 'ready'
      : urgentCount > 0
        ? 'urg'
        : tasks.some((t) => t.tone === 'warn')
          ? 'warn'
          : 'ok';

  const readyLabel =
    state.mode === 'm'
      ? `ทีมพร้อม · ฟิต ${avgXiFit}%`
      : `พร้อมแข่ง · ฟิต ${avgXiFit}%`;

  const compactLabel = topTask
    ? topTask.shortLabel
    : state.mode === 'm'
      ? 'ทีมพร้อม'
      : 'พร้อมแข่ง';

  const tooltipText =
    totalCount === 0
      ? `${readyLabel} — ไม่มีรายการค้าง กดเพื่อดูเช็กลิสต์ก่อนแข่ง`
      : `ต้องทำ ${totalCount} รายการ (${tasks.slice(0, 3).map((t) => t.title).join(' · ')}) — กดเพื่อดูและจัดการ`;

  return {
    tasks,
    totalCount,
    urgentCount,
    topTone,
    avgXiFit,
    unreadyStarterCount,
    readyLabel,
    compactLabel,
    tooltipText,
    missionHighlight
  };
}
