import React, { useState } from 'react';
import type { MainTab, Player, Team, GameState } from '../types/game';
import { RN, TN, PACT, TEAM_TRAINING_PROGRAMS, TRAINING_INTENSITY_META, getTeamTrainingPlan, syncTrainingFocusToPlan } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { fmtMoney, fmtMoneyNum } from '../utils/math';
import { xi, vlu, ensureCon } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { sortTable, getTransferWindowInfo, teamStats, getIncomingOffers } from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { StatIconBadge } from '../components/StatIconBadge';
import { CupView } from './CupView';

export const LeagueView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onToast?: (msg: string) => void;
}> = ({ state, onInspectTeam, onInspectPlayer, onUpdateState, onNavigate, onToast }) => {
  const me = state.teams[state.me];
  const vt = state.lg ?? me.tier;
  const sub = state.v === 'c' ? 4 : (state.tv ?? 0);
  const [cmpSort, setCmpSort] = useState<'ovSq' | 'ovXi' | 'at' | 'df'>('ovSq');
  const [sideStatTab, setSideStatTab] = useState<'sg' | 'sa' | 'cs' | 'ov'>('sg');
  const [newsFilter, setNewsFilter] = useState<'all' | 'urg' | 'deal' | 'act' | 'train'>('all');

  const tb = sortTable(state.teams.filter((t) => t.tier === vt));
  const myTierTable = vt === me.tier ? tb : sortTable(state.teams.filter((t) => t.tier === me.tier));
  const myRank = myTierTable.findIndex((t) => t.id === state.me) + 1;
  const ms = teamStats(me, state);

  const leagueRows = state.teams
    .filter((t) => t.tier === vt)
    .map((t) => ({ t, st: teamStats(t, state) }))
    .sort((a, b) => b.st[cmpSort] - a.st[cmpSort] || b.st.ovXi - a.st.ovXi);

  const renderFormDots = (fm?: string) => {
    const chars = (fm || '').slice(-5).split('');
    if (!chars.length) return <span className="text-[10px] text-[var(--mut)]">—</span>;
    return (
      <div className="flex items-center justify-center gap-0.5" title={`ฟอร์ม 5 นัดหลัง: ${chars.join('')}`}>
        {chars.map((c, idx) => (
          <span
            key={idx}
            className={`w-2 h-2 mland:w-1.5 mland:h-1.5 rounded-full shrink-0 ${
              c === 'W' ? 'bg-emerald-500' : c === 'D' ? 'bg-amber-400' : 'bg-rose-500'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderImportantNewsPanel = () => {
    type NewsCat = 'deal' | 'act' | 'train' | 'news';
    type NewsTone = 'urg' | 'warn' | 'ok' | 'info';
    interface ImportantNewsItem {
      id: string;
      cat: NewsCat;
      tone: NewsTone;
      icon: string;
      tag: string;
      title: string;
      detail: string;
      urgent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      quickTraining?: boolean;
    }

    const items: ImportantNewsItem[] = [];
    const isMgr = state.mode === 'm';

    if (isMgr) {
      const starters = xi(me);
      const avgXiFit = Math.round(starters.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, starters.length));
      const tiredStarters = starters.filter((q) => (q.fit ?? 100) < 74);
      const lowFitAll = me.sq.filter((q) => !q.inj && (q.fit ?? 100) < 62);
      const injuredList = me.sq.filter((q) => q.inj > 0);
      const suspendedList = me.sq.filter((q) => (q.sus || 0) > 0);

      // 1. สัญญานักเตะ & สัญญาสปอนเซอร์ & ข้อเสนอ
      const ownPlayers = me.sq.filter((q) => !q.loan);
      const expiredCon = ownPlayers.filter((q) => ensureCon(q).yr <= 0);
      const expiringSoon = ownPlayers.filter((q) => ensureCon(q).yr === 1);
      const incomingOffers = getIncomingOffers(state);

      if (expiredCon.length > 0 || expiringSoon.length > 0) {
        const namesPreview = [...expiredCon, ...expiringSoon]
          .slice(0, 2)
          .map((q) => q.n.split(' ')[0])
          .join(', ');
        const totalNeed = expiredCon.length + expiringSoon.length;
        items.push({
          id: 'contracts-expiring',
          cat: 'deal',
          tone: expiredCon.length > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: '📄',
          tag: 'สัญญา',
          title:
            expiredCon.length > 0
              ? `มีนักเตะหมดสัญญา ${expiredCon.length} คน${expiringSoon.length ? ` · ใกล้หมด ${expiringSoon.length} คน` : ''}`
              : `สัญญาเหลือ ≤ 1 ปี (${expiringSoon.length} คน)`,
          detail: `${namesPreview}${totalNeed > 2 ? ` +อีก ${totalNeed - 2} คน` : ''} · รีบต่อก่อนค่าเหนื่อยพุ่ง +25%`,
          actionLabel: 'ต่อสัญญา',
          onAction: () => onNavigate?.('k', 'con')
        });
      } else {
        items.push({
          id: 'contracts-ok',
          cat: 'deal',
          tone: 'ok',
          icon: '📄',
          tag: 'สัญญา',
          title: `สัญญานักเตะมั่นคง (${ownPlayers.length} คนเหลือ ≥ 2 ปี)`,
          detail: 'ยังไม่พบผู้เล่นที่เสี่ยงหมดสัญญาในฤดูกาลนี้',
          actionLabel: 'ดูสัญญา',
          onAction: () => onNavigate?.('k', 'con')
        });
      }

      if (incomingOffers.length > 0) {
        const topOff = incomingOffers[0];
        items.push({
          id: 'transfer-offers',
          cat: 'deal',
          tone: 'warn',
          urgent: true,
          icon: '💼',
          tag: 'ข้อเสนอ',
          title: `มี ${incomingOffers.length} ข้อเสนอซื้อตัวรอพิจารณา`,
          detail: `${topOff.t} ยื่นซื้อ ${topOff.n} (${fmtMoney(topOff.p)})`,
          actionLabel: 'เปิดดู',
          onAction: () => onNavigate?.('k', 'sell')
        });
      }

      // 2. สปอนเซอร์ที่ไม่ได้เลือก & ดีลสปอนเซอร์ปัจจุบัน
      const tierMult = 1 + me.tier * 0.45;
      const availableDeals = [
        { name: 'เครื่องดื่มเกลือแร่', perMatch: Math.round(5 * tierMult), signBonus: Math.round(12 * tierMult), ok: true },
        { name: 'ชุดกีฬาลูกหนังไทย', perMatch: Math.round(7 * tierMult), signBonus: Math.round(15 * tierMult), ok: (state.fan ?? 55) >= 45 },
        { name: 'เครือข่าย & ถ่ายทอดสด', perMatch: Math.round(10 * tierMult), signBonus: Math.round(22 * tierMult), ok: me.tier >= 1 || (state.fan ?? 55) >= 65 }
      ].filter((d) => d.ok);

      if (!state.sponsorDeal) {
        const bestDeal = availableDeals[availableDeals.length - 1] || availableDeals[0];
        items.push({
          id: 'sponsor-unselected',
          cat: 'deal',
          tone: 'warn',
          urgent: true,
          icon: '🤝',
          tag: 'สปอนเซอร์',
          title: `ยังไม่ได้เลือกดีลพาร์ทเนอร์ (ว่าง ${availableDeals.length} ดีล)`,
          detail: bestDeal
            ? `พร้อมเซ็นรับสูงสุด +${fmtMoneyNum(bestDeal.perMatch)}/นัด + โบนัสเซ็น +${fmtMoney(bestDeal.signBonus)}`
            : 'เข้าไปเลือกเซ็นสัญญาเพิ่มรายได้ทุกแมตช์',
          actionLabel: 'เลือกสปอน',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      } else {
        const lowLeft = state.sponsorDeal.left <= 2;
        items.push({
          id: 'sponsor-active',
          cat: 'deal',
          tone: lowLeft ? 'warn' : 'ok',
          urgent: lowLeft,
          icon: '🤝',
          tag: 'สปอนเซอร์',
          title: `ดีล ${state.sponsorDeal.name} (+${fmtMoneyNum(state.sponsorDeal.perMatch)}/นัด)`,
          detail: lowLeft
            ? `ใกล้ครบกำหนด! เหลืออีกเพียง ${state.sponsorDeal.left} นัด`
            : `เหลืออายุสัญญาอีก ${state.sponsorDeal.left} นัด · สปอนหลัก ${['แพ็กเกจมั่นคง', 'โบนัสชัยชนะ', 'บิ๊กแมตช์'][state.sp ?? 0]}`,
          actionLabel: 'จัดการ',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      }

      if (!state.promo && state.money >= 15) {
        items.push({
          id: 'promo-unselected',
          cat: 'deal',
          tone: 'info',
          icon: '📣',
          tag: 'โปรโมต',
          title: 'ยังไม่ได้เลือกแคมเปญวันแข่งนัดถัดไป',
          detail: 'สามารถเปิดโปรโมตตั๋ว (+35%) หรือบูสต์สปอนเซอร์ (+35%) ได้',
          actionLabel: 'ตั้งค่า',
          onAction: () => onNavigate?.('f', 'overview')
        });
      }

      // 3. กิจกรรมต่างๆ & เหตุการณ์ & แมวมอง
      if (state.dilemma) {
        items.push({
          id: 'active-dilemma',
          cat: 'act',
          tone: 'urg',
          urgent: true,
          icon: '📌',
          tag: 'เหตุการณ์ด่วน',
          title: state.dilemma.title,
          detail: `${state.dilemma.category} · มีหน้าต่างเหตุการณ์รอการตัดสินใจ`,
        });
      }

      const curTurn = state.season * 40 + state.md;
      const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
      const remCd = state.clubActMd != null ? Math.max(0, 3 - (curTurn - state.clubActMd)) : 0;
      if (!actCool) {
        items.push({
          id: 'club-activity-ready',
          cat: 'act',
          tone: 'ok',
          urgent: true,
          icon: '🎉',
          tag: 'กิจกรรม',
          title: 'กิจกรรมสโมสรพร้อมจัดรอบใหม่แล้ว!',
          detail: 'พบปะแฟนบอล · Open House · แคมป์ทีม · ติวแท็กติก · การกุศล',
          actionLabel: 'จัดกิจกรรม',
          onAction: () => onNavigate?.('u', 'activities')
        });
      } else {
        items.push({
          id: 'club-activity-cd',
          cat: 'act',
          tone: 'info',
          icon: '⏳',
          tag: 'กิจกรรม',
          title: `กิจกรรมสโมสรรอคูลดาวน์อีก ${remCd} นัด`,
          detail: 'จัดได้ทุก 3 นัด เพื่อปลุกขวัญทีมและแฟนบอล',
          actionLabel: 'ดูกิจกรรม',
          onAction: () => onNavigate?.('u', 'activities')
        });
      }

      if (state.scout?.results) {
        items.push({
          id: 'scout-ready',
          cat: 'act',
          tone: 'ok',
          urgent: true,
          icon: '🔍',
          tag: 'แมวมอง',
          title: `รายงานแมวมอง "${state.scout.label}" ส่งมาแล้ว`,
          detail: `พบเป้าหมาย ${state.scout.results.length} รายพร้อมยื่นซื้อ`,
          actionLabel: 'ดูรายงาน',
          onAction: () => onNavigate?.('k', 'scout')
        });
      }

      // 4. การซ้อมทีม
      const curPlan = getTeamTrainingPlan(state);
      const curProg = TEAM_TRAINING_PROGRAMS[curPlan.program];
      const curInt = TRAINING_INTENSITY_META[curPlan.intensity];
      items.push({
        id: 'team-training',
        cat: 'train',
        tone: 'info',
        icon: curProg.icon,
        tag: 'การซ้อมทีม',
        title: `${curProg.name} · ${curInt.icon} ${curInt.label} (ศูนย์ฝึก Lv.${state.tr ?? 1})`,
        detail: state.focusPlayer
          ? `โฟกัสปั้นพิเศษ: ${state.focusPlayer} (2.2x)`
          : curProg.effectTag,
        quickTraining: true,
        actionLabel: 'ห้องซ้อมทีม',
        onAction: () => onNavigate?.('r')
      });

      // 5. การพักผ่อน & สภาพร่างกาย
      const needRest = (tiredStarters.length > 0 || lowFitAll.length > 0 || avgXiFit < 78) && curPlan.program !== 'recovery';
      if (needRest) {
        items.push({
          id: 'rest-needed',
          cat: 'train',
          tone: avgXiFit < 68 || lowFitAll.length >= 3 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'การพักผ่อน',
          title: `ทีมเริ่มล้า ควรสลับพักผ่อน (ฟิตตัวจริง ${avgXiFit}%)`,
          detail: `ตัวจริงล้า ${tiredStarters.length} คน${injuredList.length ? ` · เจ็บ ${injuredList.length}` : ''}${suspendedList.length ? ` · แบน ${suspendedList.length}` : ''}`,
          actionLabel: 'สลับพักฟื้น',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => {
              syncTrainingFocusToPlan(d, 'F');
            });
            onToast?.('สลับโปรแกรมเป็น "😴 พักผ่อน & ฟื้นฟูร่างกาย" แล้ว (ฟิต +10%/นัด ลดเสี่ยงเจ็บ 55%)');
          }
        });
      } else if (curPlan.program === 'recovery') {
        items.push({
          id: 'rest-active',
          cat: 'train',
          tone: 'ok',
          icon: '😴',
          tag: 'การพักผ่อน',
          title: `กำลังเข้าโปรแกรมพักผ่อน/ฟื้นร่าง (ฟิตตัวจริง ${avgXiFit}%)`,
          detail: `ฟื้นฟูความฟิต +10% และลดโอกาสเจ็บ 55%${injuredList.length ? ` · เจ็บ ${injuredList.length} คน` : ''}`,
          actionLabel: avgXiFit >= 88 ? 'กลับมาซ้อม' : 'ห้องซ้อมทีม',
          onAction:
            avgXiFit >= 88
              ? () => {
                  SFX.tap();
                  onUpdateState((d) => {
                    syncTrainingFocusToPlan(d, 'MF');
                  });
                  onToast?.('ร่างกายฟื้นเต็มที่แล้ว! สลับกลับสู่โหมดซ้อมสมดุล');
                }
              : () => onNavigate?.('r')
        });
      } else {
        items.push({
          id: 'rest-ok',
          cat: 'train',
          tone: 'ok',
          icon: '💪',
          tag: 'การพักผ่อน',
          title: `สภาพร่างกายพร้อมลุย (ฟิตตัวจริง ${avgXiFit}%)`,
          detail:
            injuredList.length || suspendedList.length
              ? `${injuredList.length ? `🩹 บาดเจ็บ ${injuredList.length} คน` : ''}${injuredList.length && suspendedList.length ? ' · ' : ''}${suspendedList.length ? `🟥 ติดแบน ${suspendedList.length} คน` : ''}`
              : 'ไม่มีนักเตะบาดเจ็บหรือติดโทษแบน',
          actionLabel: 'เช็กทีม',
          onAction: () => onNavigate?.('q', 'squad')
        });
      }

      if (injuredList.length > 0) {
        const injNames = injuredList.slice(0, 2).map((q) => `${q.n.split(' ')[0]} (${q.inj}นัด)`).join(', ');
        items.push({
          id: 'club-injured-rehab',
          cat: 'train',
          tone: 'urg',
          urgent: true,
          icon: '🩹',
          tag: 'กายภาพฟื้นฟู',
          title: `มีนักเตะบาดเจ็บ ${injuredList.length} คน — กดทำกายภาพเร่งหายได้`,
          detail: `${injNames}${injuredList.length > 2 ? ` +${injuredList.length - 2} คน` : ''} · คลิกดูรายชื่อหรือจัดคลินิกกายภาพ`,
          actionLabel: 'ฟื้นฟูทีม',
          onAction: () => onNavigate?.('q', 'squad')
        });
      }

      // 6. การเงิน / บอร์ด / บอลถ้วย / ฟีดข่าวสารล่าสุด
      if (state.money < 0 || (state.bd ?? 55) < 35) {
        items.push({
          id: 'club-alert-fin-bd',
          cat: 'news',
          tone: 'urg',
          urgent: true,
          icon: '⚠️',
          tag: 'แจ้งเตือนด่วน',
          title: state.money < 0 ? `งบสโมสรติดลบ (${fmtMoney(state.money)})` : `ความเชื่อมั่นบอร์ดต่ำ (${state.bd ?? 55}%)`,
          detail: state.money < 0 ? 'ตลาดซื้อตัวถูกล็อกชั่วคราว ควรปรับสมดุลงบหรือกู้หมุนเวียน' : 'เร่งเก็บชัยชนะเพื่อเรียกศรัทธาบอร์ดบริหาร',
          actionLabel: 'ดูการเงิน',
          onAction: () => onNavigate?.('f', 'overview')
        });
      }
    } else if (state.p) {
      // โหมดนักเตะอาชีพ
      const p = state.p;
      const curPlan = PACT[p.plan ?? 1] || PACT[1];
      if ((p.en ?? 100) < 70 && (p.plan ?? 1) !== 3) {
        items.push({
          id: 'player-rest-warn',
          cat: 'train',
          tone: p.en < 52 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'การพักผ่อน',
          title: `พลังกายเหลือ ${p.en}% — แนะนำพักผ่อน`,
          detail: 'หากพลังกายต่ำกว่า 58% โค้ชอาจดรอปเป็นสำรองหรือเปลี่ยนออก',
          actionLabel: 'ตั้งพักผ่อน',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => {
              if (d.p) d.p.plan = 3;
            });
            onToast?.('ปรับแผนสัปดาห์นี้เป็น "พักผ่อน" แล้ว');
          }
        });
      } else {
        items.push({
          id: 'player-plan-info',
          cat: 'train',
          tone: 'ok',
          icon: curPlan.i,
          tag: 'การซ้อม/พัก',
          title: `แผนสัปดาห์นี้: ${curPlan.n} (พลังกาย ${p.en}%)`,
          detail: curPlan.d,
          actionLabel: 'เปลี่ยนแผน',
          onAction: () => onNavigate?.('p')
        });
      }
      if ((p.inj || 0) > 0) {
        items.push({
          id: 'player-inj-warn',
          cat: 'train',
          tone: 'urg',
          urgent: true,
          icon: '🩹',
          tag: 'ฟื้นฟูอาการเจ็บ',
          title: `คุณบาดเจ็บพักอีก ${p.inj} นัด — ตั้ง "😴 พักผ่อน" หายไวขึ้น (-2 นัด/สัปดาห์)`,
          detail: 'สามารถกดทำกายภาพส่วนตัวได้ที่หน้าอาชีพนักเตะเพื่อลดวันพักทันที',
          actionLabel: 'ไปฟื้นฟู',
          onAction: () => onNavigate?.('p')
        });
      }
      if ((p.sus || 0) > 0 || (p.yc || 0) >= 2) {
        items.push({
          id: 'player-card-warn',
          cat: 'news',
          tone: (p.sus || 0) > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: (p.sus || 0) > 0 ? '🟥' : '🟨',
          tag: 'วินัยสนาม',
          title: (p.sus || 0) > 0 ? `ติดโทษแบน ${p.sus} นัด` : `สะสมใบเหลือง ${p.yc}/3 ใบ`,
          detail: (p.sus || 0) > 0 ? 'รอชดใช้โทษแบนให้ครบก่อนลงสนาม' : 'อีก 1 ใบเหลืองจะโดนแบนอัตโนมัติ 1 นัด'
        });
      }
    }

    // Add recent state.feed news items
    (state.feed || []).slice(0, 5).forEach((f, idx) => {
      items.push({
        id: `feed-${idx}-${f.m}`,
        cat: f.cat === 'ฝึกซ้อม' ? 'train' : f.cat === 'การเงิน' || f.cat === 'ข้อเสนอ' ? 'deal' : 'news',
        tone: f.tone === 'urg' ? 'urg' : f.tone === 'offer' ? 'warn' : f.tone === 'ok' ? 'ok' : 'info',
        urgent: f.tone === 'urg' || f.tone === 'offer',
        icon: f.tone === 'urg' ? '🚨' : f.tone === 'offer' ? '💼' : f.tone === 'ok' ? '✨' : '📰',
        tag: `${f.cat} · นัด ${f.m}`,
        title: f.txt,
        detail: `ซีซั่น ${f.s}`
      });
    });

    const urgentCount = items.filter((it) => it.urgent).length;
    const filteredItems = items.filter((it) => {
      if (newsFilter === 'all') return true;
      if (newsFilter === 'urg') return !!it.urgent;
      return it.cat === newsFilter;
    });

    const toneCls: Record<NewsTone, string> = {
      urg: 'border-l-[var(--red)] bg-[var(--red-soft)]/45 border-[var(--red)]/25',
      warn: 'border-l-[var(--lamp)] bg-[var(--lamp-soft)]/55 border-[var(--lamp)]/30',
      ok: 'border-l-[var(--g)] bg-[var(--g-soft)]/45 border-[var(--g)]/25',
      info: 'border-l-[var(--mut)]/50 bg-[var(--surface-2)]/65 border-[var(--line)]/70'
    };

    const tagCls: Record<NewsTone, string> = {
      urg: 'bg-[var(--red)] text-white',
      warn: 'bg-[var(--lamp)] text-[#261900]',
      ok: 'bg-[var(--g)] text-white',
      info: 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)]'
    };

    return (
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2 mland:space-y-1.5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">📰 ข่าวสารสำคัญ</span>
            {urgentCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[var(--red)] text-white text-[9.5px] mland:text-[8px] font-extrabold tabular shrink-0">
                {urgentCount} เรื่องต้องดู
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {vt !== me.tier && (
              <button
                type="button"
                onClick={() => onUpdateState((d) => { d.lg = me.tier; })}
                className="px-2 py-0.5 rounded-lg bg-[var(--g)] text-white text-[10px] mland:text-[8.5px] font-bold cursor-pointer shadow-xs hover:brightness-105"
              >
                ลีกฉัน
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 mland:pb-0">
          {(
            [
              ['all', 'ทั้งหมด'],
              ['urg', `สำคัญ (${urgentCount})`],
              ['deal', 'สัญญา·สปอน'],
              ['act', 'กิจกรรม'],
              ['train', 'ซ้อม·พัก']
            ] as const
          ).map(([fid, flbl]) => (
            <button
              key={fid}
              type="button"
              onClick={() => { SFX.tap(); setNewsFilter(fid); }}
              className={`px-2 py-0.5 rounded-lg text-[10px] mland:text-[8.5px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                newsFilter === fid
                  ? 'bg-[var(--g)] text-white shadow-xs'
                  : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
              }`}
            >
              {flbl}
            </button>
          ))}
        </div>

        {/* News Items List */}
        <div className="max-h-[240px] sm:max-h-[270px] mland:max-h-[168px] overflow-y-auto space-y-1.5 mland:space-y-1 pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-3 text-center">
              ไม่มีข่าวสารเร่งด่วนในหมวดนี้
            </div>
          ) : (
            filteredItems.map((it) => (
              <div
                key={it.id}
                className={`p-2 mland:p-1.5 rounded-xl mland:rounded-lg border border-l-[3px] space-y-1 mland:space-y-0.5 ${toneCls[it.tone]}`}
              >
                <div className="flex items-start justify-between gap-2 mland:gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] mland:text-[7.5px] font-extrabold leading-tight shrink-0 ${tagCls[it.tone]}`}>
                        {it.icon} {it.tag}
                      </span>
                      <span className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] leading-tight truncate">
                        {it.title}
                      </span>
                    </div>
                    <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug mt-0.5 mland:mt-0 truncate">
                      {it.detail}
                    </div>
                  </div>
                  {it.actionLabel && it.onAction && (
                    <button
                      type="button"
                      onClick={() => { SFX.tap(); it.onAction?.(); }}
                      className="px-2 py-1 mland:px-1.5 mland:py-0.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--g)] hover:text-white border border-[var(--line)] text-[10px] mland:text-[8.5px] font-bold shrink-0 cursor-pointer transition-colors"
                    >
                      {it.actionLabel}
                    </button>
                  )}
                </div>

                {it.quickTraining && (
                  <div className="flex items-center gap-1 pt-0.5">
                    <span className="text-[9.5px] mland:text-[8px] text-[var(--mut)] font-semibold shrink-0">สลับเร็ว:</span>
                    {(
                      [
                        ['FW', 'หน้า'],
                        ['MF', 'กลาง'],
                        ['DF', 'หลัง'],
                        ['F', 'พักฟื้น']
                      ] as const
                    ).map(([tk, tl]) => (
                      <button
                        key={tk}
                        type="button"
                        onClick={() => {
                          SFX.tap();
                          onUpdateState((d) => { syncTrainingFocusToPlan(d, tk); });
                          onToast?.(`เปลี่ยนโปรแกรมซ้อมทีมเป็น "${tk === 'F' ? 'พักผ่อน/ฟื้นร่าง' : `โฟกัส${tl}`}"`);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] mland:text-[8px] font-bold cursor-pointer transition-colors ${
                          (state.tf || 'MF') === tk
                            ? 'bg-[var(--g)] text-white shadow-xs'
                            : 'bg-[var(--surface)] border border-[var(--line)]/80 text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {tl}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderSideLeagueStats = () => {
    const tierTeams = state.teams.filter((t) => t.tier === vt);
    const tierPlayers = tierTeams.flatMap((t) => t.sq.map((q) => ({ q, t })));
    const topBy = (fn: (q: Player) => number, filterFn?: (q: Player) => boolean) =>
      tierPlayers
        .filter((x) => (!filterFn || filterFn(x.q)) && fn(x.q) > 0)
        .sort((a, b) => fn(b.q) - fn(a.q) || b.q.ov - a.q.ov);

    const cfg: Record<typeof sideStatTab, { label: string; fn: (q: Player) => number; fmt: (q: Player) => string; filter?: (q: Player) => boolean }> = {
      sg: { label: '⚽ ยิง', fn: (q) => q.sg || 0, fmt: (q) => `${q.sg} ลูก` },
      sa: { label: '🎯 จ่าย', fn: (q) => q.sa || 0, fmt: (q) => `${q.sa} ครั้ง` },
      cs: { label: '🧤 คลีนชีต', fn: (q) => q.cs || 0, fmt: (q) => `${q.cs} นัด`, filter: (q) => q.pos === 'GK' },
      ov: { label: '⭐ OVR', fn: (q) => q.ov, fmt: (q) => `${q.ov}` }
    };
    const active = cfg[sideStatTab];
    const list = topBy(active.fn, active.filter).slice(0, 5);
    const topScorer = topBy((q) => q.sg || 0)[0];
    const topAssist = topBy((q) => q.sa || 0)[0];

    return (
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2 mland:space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] flex items-center gap-1">
            <span>⭐ สถิติลีก</span>
            <span className="text-[10px] mland:text-[9px] font-medium text-[var(--mut)]">· {TN[vt]}</span>
          </div>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]/70">
            {(['sg', 'sa', 'cs', 'ov'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { SFX.tap(); setSideStatTab(k); }}
                className={`px-1.5 py-0.5 rounded-md text-[10px] mland:text-[8.5px] font-bold cursor-pointer transition-colors ${
                  sideStatTab === k ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                }`}
              >
                {cfg[k].label}
              </button>
            ))}
          </div>
        </div>

        {(topScorer || topAssist) && (
          <div className="grid grid-cols-2 gap-1 text-[10px] mland:text-[9px]">
            <div className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/70 truncate flex items-center gap-1">
              <StatIconBadge kind="goal" count={topScorer ? Math.max(1, topScorer.q.sg || 0) : 1} size="xs" />
              <span className="text-[var(--mut)] shrink-0">ดาวซัลโว:</span>
              <b className="text-[var(--ink)] truncate">{topScorer ? `${topScorer.q.n}${(topScorer.q.sg || 0) <= 1 ? ` (${topScorer.q.sg})` : ''}` : '—'}</b>
            </div>
            <div className="px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--surface-2)]/70 truncate flex items-center gap-1">
              <StatIconBadge kind="assist" count={topAssist ? Math.max(1, topAssist.q.sa || 0) : 1} size="xs" />
              <span className="text-[var(--mut)] shrink-0">แอสซิสต์:</span>
              <b className="text-[var(--ink)] truncate">{topAssist ? `${topAssist.q.n}${(topAssist.q.sa || 0) <= 1 ? ` (${topAssist.q.sa})` : ''}` : '—'}</b>
            </div>
          </div>
        )}

        {list.length ? (
          <div className="space-y-1 mland:space-y-0.5">
            {list.map((x, idx) => (
              <button
                key={`${x.t.id}-${x.q.n}`}
                type="button"
                onClick={() => onInspectPlayer(x.q, x.t)}
                className={`w-full flex items-center gap-2 mland:gap-1.5 px-2 py-1 mland:py-0.5 rounded-xl mland:rounded-lg text-left cursor-pointer transition-colors ${
                  x.t.id === state.me ? 'bg-[var(--lamp-soft)]' : 'hover:bg-[var(--surface-2)]/80'
                }`}
              >
                <span className={`w-3.5 text-[10.5px] mland:text-[9px] font-bold text-center tabular ${idx === 0 ? 'text-[var(--lamp)]' : 'text-[var(--mut)]'}`}>
                  {idx + 1}
                </span>
                <PlayerFace player={x.q} team={x.t} state={state} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11px] mland:text-[9.5px] truncate leading-tight">{x.q.n}</div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] truncate leading-tight">{x.t.name} · {x.q.pos}</div>
                </div>
                <span className="px-1.5 py-0.5 rounded-md bg-[var(--g-soft)] text-[var(--g)] text-[10.5px] mland:text-[9px] font-bold tabular shrink-0">
                  {active.fmt(x.q)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-1">ยังไม่มีข้อมูลสถิติในหมวดนี้</p>
        )}
      </div>
    );
  };

  const renderStandings = () => (
    <div className="space-y-2.5 lg:space-y-0 mland:space-y-0 lg:flex-1 lg:min-h-0 mland:flex-1 mland:min-h-0 lg:grid lg:grid-cols-[1.46fr_0.84fr] lg:gap-3 mland:grid mland:grid-cols-[1.45fr_0.85fr] mland:gap-2 mland:overflow-hidden">
      <div className="space-y-2 mland:space-y-1 mland:h-full mland:flex mland:flex-col mland:min-h-0">
        <div className="lg:hidden mland:hidden">{renderImportantNewsPanel()}</div>
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
          {/* Table Header */}
          <div className="shrink-0 grid grid-cols-[20px_18px_minmax(0,1fr)_19px_19px_19px_19px_27px_32px] sm:grid-cols-[24px_22px_minmax(0,1fr)_42px_22px_22px_22px_22px_32px_36px] mland:grid-cols-[20px_18px_minmax(0,1fr)_18px_18px_18px_18px_26px_30px] items-center gap-0.5 sm:gap-1 px-2 sm:px-3 mland:px-1.5 py-1.5 mland:py-1 bg-[var(--surface-2)]/90 text-[10px] sm:text-[11px] mland:text-[9px] text-[var(--mut)] border-b border-[var(--line)] font-bold">
            <span className="text-center">#</span>
            <span />
            <span className="truncate text-[var(--ink)]">{TN[vt]}</span>
            <span className="hidden sm:block mland:hidden text-center">ฟอร์ม</span>
            <span className="text-center" title="แข่ง">ล</span>
            <span className="text-center" title="ชนะ">ช</span>
            <span className="text-center" title="เสมอ">ส</span>
            <span className="text-center" title="แพ้">พ</span>
            <span className="text-center" title="ประตูได้-เสีย">+/-</span>
            <span className="text-center text-[var(--ink)]">แต้ม</span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[var(--line)]/50 mland:flex-1 mland:min-h-0 mland:overflow-y-auto">
            {tb.map((t, i) => {
              const isPromo = i < 3 && vt < 2;
              const isRel = i >= tb.length - 3 && vt > 0;
              const isMe = t.id === state.me;
              const gd = t.gf - t.ga;
              const zoneBorder = isMe
                ? 'border-l-[var(--lamp)] bg-[var(--lamp-soft)]/85 font-semibold'
                : isPromo
                  ? 'border-l-[var(--g)] even:bg-[var(--surface-2)]/25 hover:bg-[var(--g-soft)]/60'
                  : isRel
                    ? 'border-l-[var(--red)] even:bg-[var(--surface-2)]/25 hover:bg-[var(--red-soft)]/60'
                    : 'border-l-transparent even:bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/75';
              const rankBadge = isPromo
                ? 'bg-[var(--g-soft)] text-[var(--g)]'
                : isRel
                  ? 'bg-[var(--red-soft)] text-[var(--red)]'
                  : isMe
                    ? 'bg-[var(--lamp)] text-[#261900]'
                    : 'text-[var(--mut)]';

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                  className={`w-full grid grid-cols-[20px_18px_minmax(0,1fr)_19px_19px_19px_19px_27px_32px] sm:grid-cols-[24px_22px_minmax(0,1fr)_42px_22px_22px_22px_22px_32px_36px] mland:grid-cols-[20px_18px_minmax(0,1fr)_18px_18px_18px_18px_26px_30px] items-center gap-0.5 sm:gap-1 px-2 sm:px-3 mland:px-1.5 py-1.5 mland:py-1 border-l-[3px] text-left text-[11px] sm:text-xs mland:text-[10px] transition-colors cursor-pointer ${zoneBorder}`}
                >
                  <span className={`text-center tabular font-bold text-[10px] mland:text-[9px] rounded-md py-0.5 leading-none ${rankBadge}`}>
                    {i + 1}
                  </span>
                  <div className="flex items-center justify-center mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                    <ClubCrest name={t.name} size={17} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                  </div>
                  <div className="min-w-0 flex items-center gap-1 pr-0.5">
                    <span className="whitespace-normal break-words text-[11px] sm:text-[12.5px] mland:text-[10px] leading-[1.18]">
                      {t.name}
                    </span>
                    {isMe && <span className="text-[10px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] shrink-0">★</span>}
                  </div>
                  <div className="hidden sm:flex mland:hidden items-center justify-center">
                    {renderFormDots(t.fm)}
                  </div>
                  <span className="text-center tabular text-[var(--mut)]">{t.p}</span>
                  <span className="text-center tabular">{t.w}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.d}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.l}</span>
                  <span className={`text-center tabular font-semibold ${gd > 0 ? 'text-[var(--g)]' : gd < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </span>
                  <span className={`text-center tabular font-extrabold text-[11px] sm:text-xs mland:text-[10px] rounded-md py-0.5 leading-none ${isMe ? 'bg-[var(--lamp)] text-[#261900]' : 'bg-[var(--surface-2)]/85 text-[var(--ink)]'}`}>
                    {t.pts}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] mland:text-[9.5px] text-[var(--mut)] px-1 shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {vt < 2 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[var(--g)] inline-block" />
                <span>อันดับ 1-3 เลื่อนชั้น</span>
              </span>
            )}
            {vt > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[var(--red)] inline-block" />
                <span>3 อันดับท้ายตกชั้น</span>
              </span>
            ) : (
              <span>ลีกระดับจังหวัดไม่มีตกชั้น</span>
            )}
          </div>
          <span className="opacity-80">แตะชื่อทีมเพื่อส่องข้อมูล</span>
        </div>
      </div>

      {/* Right Column: Summary + Live League Stats + Recent Results + History */}
      <div className="space-y-2.5 mland:space-y-1.5 mland:h-full mland:overflow-y-auto mland:pr-0.5">
        <div className="hidden lg:block mland:block">{renderImportantNewsPanel()}</div>
        {renderSideLeagueStats()}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 mland:grid-cols-1 gap-2.5 mland:gap-1.5">
          <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs">
            <div className="font-bold text-xs sm:text-sm mland:text-[11px] mb-2 mland:mb-1 flex items-center justify-between">
              <span>📋 ผลล่าสุดของคุณ</span>
              {me.fm && <div className="flex items-center gap-1">{renderFormDots(me.fm)}</div>}
            </div>
            {(state.res || []).length ? (
              <div className="space-y-1">
                {state.res!.map((r, i) => {
                  const isWin = r.includes('ชนะ') || r.startsWith('W');
                  const isDraw = r.includes('เสมอ') || r.startsWith('D');
                  const toneCls = isWin
                    ? 'border-l-emerald-500 bg-emerald-500/8'
                    : isDraw
                      ? 'border-l-amber-400 bg-amber-400/8'
                      : 'border-l-rose-500 bg-rose-500/8';
                  return (
                    <div key={i} className={`text-[11px] mland:text-[10px] px-2 py-1 mland:py-0.5 rounded-lg border-l-2 leading-snug ${toneCls}`}>
                      {r}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ยังไม่มีการแข่งขัน</p>
            )}
          </div>

          <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs">
            <div className="font-bold text-xs sm:text-sm mland:text-[11px] mb-2 mland:mb-1">🏅 ประวัติสโมสร/อาชีพ</div>
            {state.hist.length ? (
              <div className="space-y-1 max-h-36 mland:max-h-28 overflow-y-auto pr-0.5">
                {state.hist.slice().reverse().map((h, i) => (
                  <div key={i} className="text-[11px] mland:text-[10px] text-[var(--mut)] pl-2 border-l-2 border-[var(--g)]/40 py-0.5 leading-snug">
                    {h}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ยังไม่มีประวัติจบซีซั่น</p>
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
      <div className="p-3 sm:p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs mland:flex-1 mland:min-h-0 mland:flex mland:flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 mland:mb-1.5 shrink-0">
          <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📊 เทียบพลังทีม · {TN[vt]}</h3>
          <div className="flex flex-wrap gap-1">
            {(['ovSq', 'ovXi', 'at', 'df'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setCmpSort(k)} className={`px-2 mland:px-1.5 py-1 mland:py-0.5 rounded-lg text-[11px] mland:text-[9.5px] font-semibold cursor-pointer ${cmpSort === k ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
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
                className={`w-full grid grid-cols-[22px_22px_minmax(0,1fr)_auto] sm:grid-cols-[24px_24px_minmax(0,1fr)_90px_auto] mland:grid-cols-[20px_20px_minmax(0,1fr)_auto] items-center gap-2 mland:gap-1.5 p-2 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  isMe ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]' : 'bg-[var(--surface-2)]/55 border-[var(--line)] hover:border-[var(--g)]'
                }`}
              >
                <span className="text-xs mland:text-[10px] font-bold text-center text-[var(--mut)] tabular">{idx + 1}</span>
                <ClubCrest name={t.name} size={20} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                <div className="min-w-0">
                  <div className="font-bold text-xs mland:text-[10.5px] whitespace-normal break-words leading-tight">{t.name} {isMe && <span className="text-[var(--lamp)]">★</span>}</div>
                  <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">ตัวจริง {st.ovXi} · หน้า {st.f} กลาง {st.m} หลัง {st.d} โกล์ {st.gk}</div>
                </div>
                <div className="hidden sm:block mland:hidden">
                  <div className="flex justify-between text-[10.5px] font-bold mb-0.5">
                    <span className="text-[var(--mut)]">{sortLabels[cmpSort]}</span>
                    <span className="tabular">{val}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ovColor(st.ovXi) }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-lg text-white text-[11px] mland:text-[10px] font-bold tabular" style={{ background: ovColor(st.ovSq) }}>{st.ovSq}</span>
                  {!isMe && (
                    <span className={`text-[10.5px] mland:text-[9.5px] font-bold tabular ${df > 0 ? 'text-[var(--red)]' : df < 0 ? 'text-[var(--g)]' : 'text-[var(--mut)]'}`}>
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
    const board = (ic: React.ReactNode, title: string, valFn: (q: Player) => number, fmt: (q: Player) => React.ReactNode, filterFn?: (q: Player) => boolean) => {
      const list = ps.filter((x) => (!filterFn || filterFn(x.q)) && valFn(x.q) > 0).sort((a, b) => valFn(b.q) - valFn(a.q) || b.q.ov - a.q.ov).slice(0, 5);
      return (
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs">
          <h4 className="font-bold text-xs sm:text-sm mland:text-[11px] mb-2 mland:mb-1 flex items-center gap-1.5">{ic} <span>{title}</span></h4>
          {list.length ? (
            <div className="space-y-1">
              {list.map((x, idx) => (
                <button
                  key={`${x.t.id}-${x.q.n}`}
                  type="button"
                  onClick={() => onInspectPlayer(x.q, x.t)}
                  className={`w-full flex items-center gap-2 mland:gap-1.5 p-1.5 mland:p-1 rounded-xl text-left cursor-pointer transition-colors ${x.t.id === state.me ? 'bg-[var(--lamp-soft)]' : 'hover:bg-[var(--surface-2)]'}`}
                >
                  <span className={`w-4 text-[11px] font-bold text-center tabular ${idx === 0 ? 'text-[var(--lamp)]' : 'text-[var(--mut)]'}`}>{idx + 1}</span>
                  <PlayerFace player={x.q} team={x.t} state={state} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[11.5px] mland:text-[10px] truncate">{x.q.n}</div>
                    <div className="text-[10.5px] mland:text-[9px] text-[var(--mut)] truncate">{x.t.name} · {x.q.pos}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--g)] text-white text-[11px] mland:text-[9.5px] font-bold tabular inline-flex items-center justify-center">{fmt(x.q)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--mut)]">ยังไม่มีข้อมูล</p>
          )}
        </div>
      );
    };
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 mland:grid-cols-3 gap-2.5 mland:gap-1.5 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5">
        {board(<StatIconBadge kind="goal" size="sm" />, 'ดาวซัลโว', (q) => q.sg || 0, (q) => ((q.sg || 0) > 1 ? <StatIconBadge kind="goal" count={q.sg} size="sm" /> : `${q.sg}`))}
        {board(<StatIconBadge kind="assist" size="sm" />, 'แอสซิสต์สูงสุด', (q) => q.sa || 0, (q) => ((q.sa || 0) > 1 ? <StatIconBadge kind="assist" count={q.sa} size="sm" /> : `${q.sa}`))}
        {board('✨', 'ประตู + แอสซิสต์', (q) => (q.sg || 0) + (q.sa || 0), (q) => `${(q.sg || 0) + (q.sa || 0)}`)}
        {board(<StatIconBadge kind="save" size="sm" />, 'คลีนชีต (ผู้รักษาประตู)', (q) => q.cs || 0, (q) => ((q.cs || 0) > 1 ? <StatIconBadge kind="save" count={q.cs} size="sm" /> : `${q.cs}`), (q) => q.pos === 'GK')}
        {board('💎', 'ค่าตัวสูงสุด', vlu, (q) => fmtMoneyNum(vlu(q)))}
        {board('⭐', 'พลังรวมสูงสุด', (q) => q.ov, (q) => `${q.ov}`)}
      </div>
    );
  };

  const renderLeagueAwards = () => {
    const ts = state.teams.filter((t) => t.tier === vt);
    const ps = ts.flatMap((t) => t.sq.map((q) => ({ q, t })));
    const totalPlayedInTier = ts.reduce((s, t) => s + t.p, 0);
    const maxPlayedInTier = ts.reduce((m, t) => Math.max(m, t.p), 0);
    const totalRounds = state.fx.length || 30;
    const isSeasonDone = maxPlayedInTier >= totalRounds && totalRounds > 0;
    const teamRankMap = new Map<number, number>(tb.map((t, idx) => [t.id, idx]));

    interface AwardEntry {
      q: Player;
      t: Team;
      primaryValue: string;
      runnerValue: string;
      breakdown: string;
      scoreNum: number;
    }

    const goldenBootList: AwardEntry[] = ps
      .filter((x) => (x.q.sg || 0) > 0)
      .sort(
        (a, b) =>
          (b.q.sg || 0) - (a.q.sg || 0) ||
          (a.q.sp || 999) - (b.q.sp || 999) ||
          (b.q.sa || 0) - (a.q.sa || 0) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5)
      .map(({ q, t }) => {
        const apps = q.sp || t.p || 1;
        const gpg = ((q.sg || 0) / Math.max(1, apps)).toFixed(2);
        return {
          q,
          t,
          primaryValue: `${q.sg || 0} ประตู`,
          runnerValue: `${q.sg || 0} ลูก`,
          breakdown: `${q.sa || 0} จ่าย · ${q.sp || t.p || 0} นัด · เฉลี่ย ${gpg}/นัด`,
          scoreNum: q.sg || 0
        };
      });

    const goldenGloveList: AwardEntry[] = (totalPlayedInTier > 0
      ? ps.filter((x) => x.q.pos === 'GK' && ((x.q.cs || 0) > 0 || (x.q.sp || 0) > 0))
      : []
    )
      .sort(
        (a, b) =>
          (b.q.cs || 0) - (a.q.cs || 0) ||
          a.t.ga - b.t.ga ||
          (b.q.sp || 0) - (a.q.sp || 0) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5)
      .map(({ q, t }) => {
        const apps = q.sp || t.p || 1;
        const csPct = Math.round(((q.cs || 0) / Math.max(1, apps)) * 100);
        return {
          q,
          t,
          primaryValue: `${q.cs || 0} คลีนชีต`,
          runnerValue: `${q.cs || 0} CS`,
          breakdown: `ทีมเสีย ${t.ga} ลูก · ${q.sp || t.p || 0} นัด · ${csPct}%`,
          scoreNum: q.cs || 0
        };
      });

    const mvpList: AwardEntry[] = (totalPlayedInTier > 0
      ? ps.filter((x) => (x.q.sp || 0) > 0 || (x.q.sg || 0) > 0 || (x.q.sa || 0) > 0 || (x.q.cs || 0) > 0)
      : []
    )
      .map(({ q, t }) => {
        const rankIdx = teamRankMap.get(t.id) ?? Math.max(0, tb.length - 1);
        const goalWeight = q.pos === 'DF' ? 5.5 : q.pos === 'MF' ? 4.5 : 3.8;
        const assistWeight = q.pos === 'DF' ? 3.8 : 3.0;
        const csScore = q.pos === 'GK' ? (q.cs || 0) * 4.2 : 0;
        const defScore = q.pos === 'DF' && t.p > 0 ? (q.sp || 0) * Math.max(0, 1.4 - (t.ga / Math.max(1, t.p)) * 0.45) : 0;
        const appScore = Math.min(q.sp || 0, t.p || 30) * 0.45;
        const teamBonus = Math.max(0, (tb.length - rankIdx) / Math.max(1, tb.length)) * 6;
        const qualAdj = (q.ov - 50) * 0.25 - (q.yc || 0) * 0.5 - (q.rc || 0) * 2.5;
        const score = Math.max(
          0,
          Math.round(
            ((q.sg || 0) * goalWeight +
              (q.sa || 0) * assistWeight +
              csScore +
              defScore +
              appScore +
              teamBonus +
              qualAdj) *
              10
          ) / 10
        );
        const detailLine =
          q.pos === 'GK'
            ? `${q.cs || 0} คลีนชีต · ${q.sp || t.p || 0} นัด · อันดับ ${rankIdx + 1}`
            : `${q.sg || 0} ประตู · ${q.sa || 0} จ่าย · ${q.sp || t.p || 0} นัด · อันดับ ${rankIdx + 1}`;
        return {
          q,
          t,
          primaryValue: `${score.toFixed(1)} คะแนน`,
          runnerValue: `${score.toFixed(1)}`,
          breakdown: detailLine,
          scoreNum: score
        };
      })
      .sort(
        (a, b) =>
          b.scoreNum - a.scoreNum ||
          (b.q.sg || 0) + (b.q.sa || 0) - ((a.q.sg || 0) + (a.q.sa || 0)) ||
          b.q.ov - a.q.ov
      )
      .slice(0, 5);

    const awards: {
      id: string;
      icon: string;
      title: string;
      enTitle: string;
      criteria: string;
      accentText: string;
      accentBg: string;
      entries: AwardEntry[];
      emptyText: string;
    }[] = [
      {
        id: 'golden-boot',
        icon: '🥾',
        title: 'รองเท้าทองคำ',
        enTitle: 'Golden Boot',
        criteria: 'ผู้ทำประตูสูงสุดประจำลีก (วัดอัตราส่วนต่อนัดเมื่อเท่ากัน)',
        accentText: 'text-[#b45309] dark:text-[var(--lamp)]',
        accentBg: 'bg-[var(--lamp-soft)]/70 border-[var(--lamp)]/40',
        entries: goldenBootList,
        emptyText: 'ยังไม่มีผู้ทำประตูในลีกนี้ ลงสนามเพื่อเปิดบัญชีดาวยิง'
      },
      {
        id: 'golden-glove',
        icon: '🧤',
        title: 'ถุงมือทองคำ',
        enTitle: 'Golden Glove',
        criteria: 'ผู้รักษาประตูคลีนชีตสูงสุด (วัดประตูเสียทีมเมื่อเท่ากัน)',
        accentText: 'text-[var(--g)]',
        accentBg: 'bg-[var(--g-soft)]/70 border-[var(--g)]/35',
        entries: goldenGloveList,
        emptyText: 'ยังไม่มีสถิติคลีนชีตในลีกนี้ รอการลงสนามนัดแรก'
      },
      {
        id: 'poy',
        icon: '🌟',
        title: 'นักเตะยอดเยี่ยมประจำฤดูกาล',
        enTitle: 'Player of the Season',
        criteria: 'คะแนนรวมจากประตู แอสซิสต์ คลีนชีต วินัย และอันดับทีม',
        accentText: 'text-[var(--ink)]',
        accentBg: 'bg-[var(--surface-2)] border-[var(--line)]',
        entries: mvpList,
        emptyText: 'ยังไม่มีคะแนนผลงานประจำฤดูกาล รอการลงสนามนัดแรก'
      }
    ];

    return (
      <div className="space-y-3 mland:space-y-1.5 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:overflow-hidden">
        {/* Clean Context Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm mland:text-[11px]">
            <span className="font-bold text-[var(--ink)]">🎖️ ทำเนียบรางวัลประจำลีก</span>
            <span aria-hidden="true" className="text-[var(--mut)]">·</span>
            <span className="text-[var(--mut)] font-medium">{TN[vt]}</span>
          </div>
          <div className="text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--mut)] tabular-nums">
            ซีซั่น {state.season} · แข่งแล้ว {maxPlayedInTier}/{totalRounds} นัด · {isSeasonDone ? 'สรุปผลประจำฤดูกาล' : 'กำลังลุ้นรางวัล'}
          </div>
        </div>

        {/* 3-Column Awards Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-3 mland:grid-cols-3 gap-3 mland:gap-2 mland:flex-1 mland:min-h-0 mland:overflow-y-auto mland:pr-0.5 items-stretch">
          {awards.map((aw) => {
            const leader = aw.entries[0];
            const runners = aw.entries.slice(1);
            const leaderIsMe = leader?.t.id === state.me;

            return (
              <section
                key={aw.id}
                className="p-4 mland:p-2.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-3 mland:gap-2"
              >
                <div className="space-y-3 mland:space-y-2">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base mland:text-sm leading-none" aria-hidden="true">{aw.icon}</span>
                        <h3 className="font-bold text-sm sm:text-base mland:text-xs text-[var(--ink)] truncate">{aw.title}</h3>
                      </div>
                      <p className="text-[11px] mland:text-[9px] text-[var(--mut)] mt-0.5">{aw.enTitle} · {aw.criteria}</p>
                    </div>
                  </div>

                  {/* Current #1 Leader Spotlight */}
                  {leader ? (
                    <button
                      type="button"
                      onClick={() => { SFX.tap(); onInspectPlayer(leader.q, leader.t); }}
                      className={`w-full p-3 mland:p-2 rounded-xl border text-left cursor-pointer transition-colors hover:border-[var(--g)] ${
                        leaderIsMe ? 'bg-[var(--lamp-soft)]/65 border-[var(--lamp)]' : aw.accentBg
                      }`}
                    >
                      <div className="flex items-center gap-3 mland:gap-2">
                        <div className="shrink-0">
                          <PlayerFace player={leader.q} team={leader.t} state={state} size={46} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">
                              อันดับ 1{leaderIsMe ? ' · ทีมของคุณ' : ''}
                            </span>
                            <span className={`text-sm sm:text-base mland:text-xs font-extrabold tabular-nums shrink-0 ${aw.accentText}`}>
                              {leader.primaryValue}
                            </span>
                          </div>
                          <div className="font-bold text-sm sm:text-base mland:text-xs text-[var(--ink)] truncate mt-0.5">
                            {leader.q.n}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] mland:text-[9px] text-[var(--mut)] min-w-0">
                            <ClubCrest name={leader.t.name} size={14} team={leader.t} club={state.club} isMyClub={leaderIsMe && state.mode === 'm'} />
                            <span className="truncate font-medium text-[var(--ink)]/85">{leader.t.name}</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0">{leader.q.ro}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 mland:mt-1.5 pt-2 mland:pt-1 border-t border-[var(--line)]/70 text-[11px] mland:text-[9px] text-[var(--mut)] tabular-nums">
                        {leader.breakdown}
                      </div>
                    </button>
                  ) : (
                    <div className="p-4 mland:p-2.5 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] text-center space-y-1">
                      <div className="text-xs mland:text-[10px] font-semibold text-[var(--ink)]">ยังไม่มีผู้ครองอันดับ 1</div>
                      <p className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-snug">{aw.emptyText}</p>
                    </div>
                  )}
                </div>

                {/* Contenders #2 - #5 */}
                <div className="border-t border-[var(--line)] pt-2.5 mland:pt-1.5 space-y-1 mland:space-y-0.5">
                  <div className="text-[11px] mland:text-[9px] font-semibold text-[var(--mut)] mb-1">
                    ผู้ท้าชิงอันดับถัดไป
                  </div>
                  {runners.length ? (
                    <div className="divide-y divide-[var(--line)]/50">
                      {runners.map((entry, idx) => {
                        const isMine = entry.t.id === state.me;
                        return (
                          <button
                            key={`${aw.id}-${entry.t.id}-${entry.q.n}`}
                            type="button"
                            onClick={() => { SFX.tap(); onInspectPlayer(entry.q, entry.t); }}
                            className={`w-full min-h-[40px] mland:min-h-[28px] flex items-center gap-2 mland:gap-1.5 px-2 py-1.5 mland:py-0.5 rounded-lg text-left cursor-pointer transition-colors ${
                              isMine ? 'bg-[var(--lamp-soft)]/50 hover:bg-[var(--lamp-soft)]/80' : 'hover:bg-[var(--surface-2)]/75'
                            }`}
                          >
                            <span className="w-4 text-xs mland:text-[9.5px] font-bold text-[var(--mut)] tabular-nums text-center shrink-0">
                              {idx + 2}
                            </span>
                            <ClubCrest name={entry.t.name} size={16} team={entry.t} club={state.club} isMyClub={isMine && state.mode === 'm'} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs mland:text-[10px] font-semibold text-[var(--ink)] truncate">
                                {entry.q.n}
                              </div>
                              <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                                {entry.t.name} · {entry.q.ro}
                              </div>
                            </div>
                            <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)] tabular-nums shrink-0">
                              {entry.runnerValue}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-2">
                      {leader ? 'ยังไม่มีผู้ท้าชิงอันดับรอง' : 'รอกรรมการบันทึกสถิติการแข่งขัน'}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5 mland:space-y-0 mland:flex-1 mland:min-h-0 mland:flex mland:flex-col mland:gap-1.5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mland:flex-row mland:items-center mland:justify-between gap-1.5 shrink-0">
        {sub !== 4 ? (
          <div className="w-full lg:w-auto mland:w-auto grid grid-cols-3 lg:inline-flex mland:inline-flex items-center gap-0.5 p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs shrink-0">
            {['จังหวัด', 'ในประเทศ 2', 'ในประเทศ 1'].map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                onClick={() => { SFX.tap(); onUpdateState((d) => { d.lg = idx; }); }}
                className={`flex items-center justify-center gap-1 px-2 sm:px-3 mland:px-2 py-1.5 sm:py-1 mland:py-0.5 rounded-lg text-[11px] sm:text-xs mland:text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap min-w-0 ${vt === idx ? 'bg-[var(--g)] text-white shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/70'}`}
              >
                <span className="truncate">{lbl}</span>
                {idx === me.tier && <span className="shrink-0">★</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="hidden lg:flex mland:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold text-[var(--ink)] shadow-xs shrink-0">
            <span>🏅</span>
            <span>รายการแข่งขันบอลถ้วย</span>
          </div>
        )}
        <div className="w-full lg:w-auto mland:w-auto mland:max-w-full grid grid-cols-3 sm:grid-cols-6 lg:inline-flex mland:inline-flex items-center gap-0.5 p-1 mland:p-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs mland:overflow-x-auto">
          {['🏆 ตาราง', '📊 พลังทีม', '⭐ สถิติ', '📅 ปฏิทิน', '🏅 บอลถ้วย', '🎖️ รางวัล'].map((lbl, idx) => (
            <button
              key={lbl}
              type="button"
              onClick={() => {
                SFX.tap();
                onUpdateState((d) => {
                  if (d.v === 'c') d.v = 't';
                  d.tv = idx;
                });
              }}
              className={`flex items-center justify-center px-1.5 sm:px-2.5 mland:px-1.5 py-2 sm:py-1.5 lg:py-1 mland:py-0.5 rounded-lg text-[10.5px] sm:text-xs mland:text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 min-w-0 ${sub === idx ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs' : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]/70'}`}
            >
              <span className="truncate">{lbl}</span>
            </button>
          ))}
        </div>
      </div>
      {sub === 0 && renderStandings()}
      {sub === 1 && renderPowerComparison()}
      {sub === 2 && renderPlayerStats()}
      {sub === 3 && <ScheduleCalendarView state={state} onInspectTeam={onInspectTeam} />}
      {sub === 4 && <CupView state={state} onInspectTeam={onInspectTeam} />}
      {sub === 5 && renderLeagueAwards()}
    </div>
  );
};

export const ScheduleCalendarView: React.FC<{
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
                  <button type="button" onClick={() => onInspectTeam(hid)} className="flex-1 text-right whitespace-normal break-words leading-tight hover:text-[var(--g)] cursor-pointer">
                    {ht.name}
                  </button>
                  <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[11px] font-bold tabular shrink-0">
                    {rec ? `${rec.gh}-${rec.ga}` : 'vs'}
                  </span>
                  <button type="button" onClick={() => onInspectTeam(aid)} className="flex-1 text-left whitespace-normal break-words leading-tight hover:text-[var(--g)] cursor-pointer">
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


