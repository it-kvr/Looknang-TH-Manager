import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MainTab, Player, Team, GameState } from '../types/game';
import { RN, TN, PACT, getTeamTrainingPlan, syncTrainingFocusToPlan } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { fmtMoney, fmtMoneyNum } from '../utils/math';
import { xi, vlu, ensureCon } from '../engine/playerCore';
import { ovColor } from '../engine/missions';
import { sortTable, getTransferWindowInfo, teamStats, getIncomingOffers, getActiveBoardEffects, getBoardDirectiveProgress } from '../engine/simulation';
import { ClubCrest, PlayerFace } from '../components/SvgVisuals';
import { CupView } from './CupView';

export const LeagueView: React.FC<{
  state: GameState;
  onInspectTeam: (teamId: number) => void;
  onInspectPlayer: (player: Player, team: Team) => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onNavigate?: (tab: MainTab, sub?: string) => void;
  onOpenSeasonStats?: (season?: number) => void;
  onToast?: (msg: string) => void;
}> = ({ state, onInspectTeam, onInspectPlayer, onUpdateState, onNavigate, onOpenSeasonStats, onToast }) => {
  const me = state.teams[state.me];
  const vt = state.lg ?? me.tier;
  const rawSub = state.v === 'c' ? 4 : (state.tv ?? 0);
  const sub = rawSub === 5 ? 2 : rawSub;
  const [cmpSort, setCmpSort] = useState<'ovSq' | 'ovXi' | 'at' | 'df'>('ovSq');
  const [newsFilter, setNewsFilter] = useState<'all' | 'urg' | 'feed'>('all');

  const tb = sortTable(state.teams.filter((t) => t.tier === vt));
  const ms = teamStats(me, state);

  const leagueRows = state.teams
    .filter((t) => t.tier === vt)
    .map((t) => ({ t, st: teamStats(t, state) }))
    .sort((a, b) => b.st[cmpSort] - a.st[cmpSort] || b.st.ovXi - a.st.ovXi);

  const renderFormDots = (fm?: string) => {
    const chars = (fm || '').slice(-5).split('');
    if (!chars.length) return <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)]">—</span>;
    const thaiForm = chars.map((c) => (c === 'W' ? 'ชนะ' : c === 'D' ? 'เสมอ' : 'แพ้')).join(' · ');
    return (
      <div
        className="flex items-center justify-center gap-[2px] sm:gap-0.5 mland:gap-[2px]"
        title={`ฟอร์ม 5 นัดหลัง: ${thaiForm}`}
      >
        {chars.map((c, idx) => (
          <span
            key={idx}
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 mland:w-1.5 mland:h-1.5 rounded-full shrink-0 ${
              c === 'W' ? 'bg-emerald-500' : c === 'D' ? 'bg-amber-400' : 'bg-rose-500'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderNextMatchCard = () => {
    let kind: 'league' | 'cup' | 'asia' = 'league';
    let homeId = -1;
    let awayId = -1;
    let isDerby = false;

    if (state.pa && state.ac && state.ac.alive && !state.ac.done) {
      const idx = state.ac.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        kind = 'asia';
        homeId = state.ac.ids[pairIdx];
        awayId = state.ac.ids[pairIdx + 1];
      }
    } else if (state.pc && state.cup && state.cup.alive && !state.cup.done) {
      const idx = state.cup.ids.indexOf(state.me);
      if (idx >= 0) {
        const pairIdx = Math.floor(idx / 2) * 2;
        kind = 'cup';
        homeId = state.cup.ids[pairIdx];
        awayId = state.cup.ids[pairIdx + 1];
      }
    } else if (state.md < state.fx.length) {
      const pair = state.fx[state.md].find((p) => p.includes(state.me));
      if (pair) {
        homeId = pair[0];
        awayId = pair[1];
        isDerby = (pair[0] ^ 1) === pair[1];
      }
    }

    if (homeId < 0 || awayId < 0 || !state.teams[homeId] || !state.teams[awayId]) {
      return (
        <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-center space-y-1">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] text-[#7a4f00] dark:text-[var(--lamp)]">
            🏁 จบโปรแกรมลีกฤดูกาลที่ {state.season} แล้ว
          </div>
          <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)]">
            กดปุ่ม &ldquo;สรุปจบฤดูกาล&rdquo; ด้านขวาบนเพื่อรับรางวัลและขึ้นฤดูกาลใหม่
          </p>
        </div>
      );
    }

    const H = state.teams[homeId];
    const A = state.teams[awayId];
    const oppId = homeId === state.me ? awayId : homeId;
    const oppTeam = state.teams[oppId];
    const oppSt = teamStats(oppTeam, state);
    const isHome = homeId === state.me;
    const compLabel =
      kind === 'asia'
        ? `🌏 ถ้วยทวีป · ${state.ac ? RN[state.ac.r] || `รอบ ${state.ac.r + 1}` : ''}`
        : kind === 'cup'
          ? `🏆 ถ้วยประชาชน · ${RN[state.cup.r] || `รอบ ${state.cup.r + 1}`}`
          : `⚽ นัดที่ ${state.md + 1}/${state.fx.length} · ${isHome ? 'เกมเหย้า' : 'เกมเยือน'}`;

    return (
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2.5 mland:space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] mland:text-[9.5px]">
          <span className="font-bold text-[var(--g)] truncate">{compLabel}</span>
          {isDerby && <span className="font-bold text-[var(--red)] shrink-0">🔥 ดาร์บี้แมตช์</span>}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mland:gap-1.5 py-1 mland:py-0.5 px-2 rounded-xl bg-[var(--surface-2)]/70">
          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(H.id); }}
            className="flex flex-col items-center gap-1 min-w-0 cursor-pointer group"
          >
            <div className="mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={H.name} size={32} team={H} club={state.club} isMyClub={H.id === state.me && state.mode === 'm'} />
            </div>
            <span className={`text-[11px] mland:text-[9.5px] text-center truncate max-w-full leading-tight group-hover:text-[var(--g)] ${H.id === state.me ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--mut)]'}`}>
              {H.name}
            </span>
          </button>

          <div className="text-center px-1 shrink-0">
            <div className="text-xs mland:text-[10px] font-black text-[var(--mut)] tracking-wider">VS</div>
            <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] tabular mt-0.5">
              XI {ms.ovXi} : {oppSt.ovXi}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(A.id); }}
            className="flex flex-col items-center gap-1 min-w-0 cursor-pointer group"
          >
            <div className="mland:[&>svg]:w-7 mland:[&>svg]:h-7">
              <ClubCrest name={A.name} size={32} team={A} club={state.club} isMyClub={A.id === state.me && state.mode === 'm'} />
            </div>
            <span className={`text-[11px] mland:text-[9.5px] text-center truncate max-w-full leading-tight group-hover:text-[var(--g)] ${A.id === state.me ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--mut)]'}`}>
              {A.name}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => { SFX.tap(); onInspectTeam(oppId); }}
            className="btn btn-sm btn-secondary w-full"
          >
            🔍 ส่องคู่แข่ง
          </button>
          <button
            type="button"
            onClick={() => { SFX.tap(); onNavigate?.('q'); }}
            className="btn btn-sm btn-primary w-full"
          >
            ⚽ จัดทัพ 11 ตัวจริง
          </button>
        </div>
      </div>
    );
  };

  const renderImportantNewsPanel = () => {
    type NewsTone = 'urg' | 'warn' | 'ok' | 'info';
    interface InboxItem {
      id: string;
      kind: 'alert' | 'feed';
      tone: NewsTone;
      icon: string;
      tag: string;
      title: string;
      detail: string;
      urgent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
    }

    const items: InboxItem[] = [];
    const isMgr = state.mode === 'm';

    if (isMgr) {
      const starters = xi(me);
      const avgXiFit = Math.round(starters.reduce((sum, q) => sum + (q.fit ?? 100), 0) / Math.max(1, starters.length));
      const tiredStarters = starters.filter((q) => (q.fit ?? 100) < 74);
      const lowFitAll = me.sq.filter((q) => !q.inj && (q.fit ?? 100) < 62);
      const injuredList = me.sq.filter((q) => q.inj > 0);
      const ownPlayers = me.sq.filter((q) => !q.loan);
      const expiredCon = ownPlayers.filter((q) => ensureCon(q).yr <= 0);
      const expiringSoon = ownPlayers.filter((q) => ensureCon(q).yr === 1);
      const incomingOffers = getIncomingOffers(state);
      const curPlan = getTeamTrainingPlan(state);

      if (state.dilemma) {
        items.push({
          id: 'active-dilemma',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '📌',
          tag: 'เหตุการณ์ด่วน',
          title: state.dilemma.title,
          detail: `${state.dilemma.category} · รอการตัดสินใจ`,
        });
      }

      if (state.money < 0 || (state.bd ?? 55) < 35) {
        items.push({
          id: 'club-alert-fin-bd',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '⚠️',
          tag: 'แจ้งเตือนด่วน',
          title: state.money < 0 ? `งบติดลบ (${fmtMoney(state.money)})` : `ความเชื่อมั่นบอร์ดต่ำ (${state.bd ?? 55}%)`,
          detail: state.money < 0 ? 'ตลาดถูกระงับชั่วคราว ควรปรับสมดุลงบ' : 'เร่งทำผลงานเพื่อเรียกศรัทธาบอร์ด',
          actionLabel: state.money < 0 ? 'ดูการเงิน' : 'ดูบอร์ด',
          onAction: () => onNavigate?.(state.money < 0 ? 'f' : 'u')
        });
      }

      if (state.boardDirective && state.boardDirective.status === 'active') {
        const dir = state.boardDirective;
        const prog = getBoardDirectiveProgress(state, dir);
        const remMd = Math.max(0, dir.dueMd - (state.md ?? 0));
        items.push({
          id: 'board-directive-active',
          kind: 'alert',
          tone: prog.isComplete ? 'ok' : remMd <= 1 ? 'urg' : 'warn',
          urgent: true,
          icon: '📋',
          tag: `คำสั่งบอร์ด · อีก ${remMd} นัด`,
          title: dir.title,
          detail: `${prog.progressText} (${Math.round(prog.ratio * 100)}%)`,
          actionLabel: 'ดูรายละเอียด',
          onAction: () => onNavigate?.('u', 'info')
        });
      } else {
        const activeBoardFx = getActiveBoardEffects(state);
        if (activeBoardFx.length > 0) {
          const topFx = activeBoardFx[0];
          items.push({
            id: 'board-effect-active',
            kind: 'alert',
            tone: topFx.tone === 'bonus' ? 'ok' : 'urg',
            urgent: false,
            icon: topFx.tone === 'bonus' ? '✨' : '📢',
            tag: 'ผลกระทบบอร์ด',
            title: topFx.label,
            detail: `มีผลอีก ${Math.max(1, topFx.expiresMd - (state.md ?? 0))} นัด`,
            actionLabel: 'ดูบอร์ด',
            onAction: () => onNavigate?.('u', 'info')
          });
        }
      }

      if (incomingOffers.length > 0) {
        const topOff = incomingOffers[0];
        items.push({
          id: 'transfer-offers',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '💼',
          tag: 'ข้อเสนอซื้อตัว',
          title: `${incomingOffers.length} ข้อเสนอรอพิจารณา`,
          detail: `${topOff.t} ยื่นซื้อ ${topOff.n} (${fmtMoney(topOff.p)})`,
          actionLabel: 'เปิดดู',
          onAction: () => onNavigate?.('k', 'sell')
        });
      }

      if (state.scout?.results) {
        items.push({
          id: 'scout-ready',
          kind: 'alert',
          tone: 'ok',
          urgent: true,
          icon: '🔍',
          tag: 'แมวมอง',
          title: `รายงาน "${state.scout.label}" พร้อมแล้ว`,
          detail: `พบนักเตะเป้าหมาย ${state.scout.results.length} ราย`,
          actionLabel: 'ดูรายงาน',
          onAction: () => onNavigate?.('k', 'scout')
        });
      }

      if (expiredCon.length > 0 || expiringSoon.length > 0) {
        const namesPreview = [...expiredCon, ...expiringSoon].slice(0, 2).map((q) => q.n.split(' ')[0]).join(', ');
        const totalNeed = expiredCon.length + expiringSoon.length;
        items.push({
          id: 'contracts-expiring',
          kind: 'alert',
          tone: expiredCon.length > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: '📄',
          tag: 'สัญญาใกล้หมด',
          title: expiredCon.length > 0 ? `หมดสัญญา ${expiredCon.length} คน` : `สัญญาเหลือ 1 ปี (${expiringSoon.length} คน)`,
          detail: `${namesPreview}${totalNeed > 2 ? ` +${totalNeed - 2}` : ''}`,
          actionLabel: 'ต่อสัญญา',
          onAction: () => onNavigate?.('k', 'con')
        });
      }

      if (!state.sponsorDeal) {
        items.push({
          id: 'sponsor-unselected',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '🤝',
          tag: 'สปอนเซอร์',
          title: 'ยังไม่ได้เซ็นดีลพาร์ทเนอร์',
          detail: 'เลือกเซ็นสัญญาเพื่อรับรายได้เสริมทุกนัด',
          actionLabel: 'เลือกดีล',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      } else if (state.sponsorDeal.left <= 2) {
        items.push({
          id: 'sponsor-expiring',
          kind: 'alert',
          tone: 'warn',
          urgent: true,
          icon: '🤝',
          tag: 'สปอนเซอร์',
          title: `ดีล ${state.sponsorDeal.name} เหลือ ${state.sponsorDeal.left} นัด`,
          detail: 'เตรียมต่อสัญญาใหม่หลังครบกำหนด',
          actionLabel: 'ดูดีล',
          onAction: () => onNavigate?.('f', 'commercial')
        });
      }

      const curTurn = state.season * 40 + state.md;
      const actCool = state.clubActMd != null && curTurn - state.clubActMd < 3;
      if (!actCool) {
        items.push({
          id: 'club-activity-ready',
          kind: 'alert',
          tone: 'ok',
          urgent: true,
          icon: '🎉',
          tag: 'กิจกรรมสโมสร',
          title: 'พร้อมจัดกิจกรรมกระตุ้นทีม',
          detail: 'เพิ่มขวัญแฟนบอลและกำลังใจในห้องแต่งตัว',
          actionLabel: 'จัดเลย',
          onAction: () => onNavigate?.('u', 'activities')
        });
      }

      const needRest = (tiredStarters.length > 0 || lowFitAll.length > 0 || avgXiFit < 76) && curPlan.program !== 'recovery';
      if (needRest) {
        items.push({
          id: 'rest-needed',
          kind: 'alert',
          tone: avgXiFit < 68 || lowFitAll.length >= 3 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'ความฟิตทีม',
          title: `นักเตะเริ่มล้า (ฟิตตัวจริง ${avgXiFit}%)`,
          detail: `ตัวจริงล้า ${tiredStarters.length} คน · แนะนำพักฟื้น`,
          actionLabel: 'สลับพักฟื้น',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => { syncTrainingFocusToPlan(d, 'F'); });
            onToast?.('สลับโปรแกรมซ้อมเป็น "😴 พักผ่อน & ฟื้นฟู" แล้ว');
          }
        });
      }

      if (injuredList.length > 0) {
        items.push({
          id: 'club-injured-rehab',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '🩹',
          tag: 'ห้องพยาบาล',
          title: `นักเตะบาดเจ็บ ${injuredList.length} คน`,
          detail: injuredList.slice(0, 2).map((q) => `${q.n.split(' ')[0]} (${q.inj}นัด)`).join(', '),
          actionLabel: 'ฟื้นฟูทีม',
          onAction: () => onNavigate?.('r')
        });
      }
    } else if (state.p) {
      const p = state.p;
      if ((p.en ?? 100) < 70 && (p.plan ?? 1) !== 3) {
        items.push({
          id: 'player-rest-warn',
          kind: 'alert',
          tone: p.en < 52 ? 'urg' : 'warn',
          urgent: true,
          icon: '😴',
          tag: 'พลังกาย',
          title: `พลังกายเหลือ ${p.en}% — แนะนำพักผ่อน`,
          detail: 'ต่ำกว่า 58% โค้ชอาจดรอปเป็นสำรอง',
          actionLabel: 'ตั้งพักผ่อน',
          onAction: () => {
            SFX.tap();
            onUpdateState((d) => { if (d.p) d.p.plan = 3; });
            onToast?.('ปรับแผนสัปดาห์นี้เป็น "พักผ่อน" แล้ว');
          }
        });
      }
      if ((p.inj || 0) > 0) {
        items.push({
          id: 'player-inj-warn',
          kind: 'alert',
          tone: 'urg',
          urgent: true,
          icon: '🩹',
          tag: 'อาการเจ็บ',
          title: `บาดเจ็บพักอีก ${p.inj} นัด`,
          detail: 'ทำกายภาพส่วนตัวได้ที่หน้าอาชีพนักเตะ',
          actionLabel: 'ไปฟื้นฟู',
          onAction: () => onNavigate?.('p')
        });
      }
      if ((p.sus || 0) > 0 || (p.yc || 0) >= 2) {
        items.push({
          id: 'player-card-warn',
          kind: 'alert',
          tone: (p.sus || 0) > 0 ? 'urg' : 'warn',
          urgent: true,
          icon: (p.sus || 0) > 0 ? '🟥' : '🟨',
          tag: 'วินัยสนาม',
          title: (p.sus || 0) > 0 ? `ติดโทษแบน ${p.sus} นัด` : `สะสมใบเหลือง ${p.yc}/3 ใบ`,
          detail: (p.sus || 0) > 0 ? 'รอชดใช้โทษแบนให้ครบ' : 'อีก 1 เหลืองจะโดนแบน 1 นัด'
        });
      }
    }

    (state.feed || []).slice(0, 6).forEach((f, idx) => {
      items.push({
        id: `feed-${idx}-${f.m}`,
        kind: 'feed',
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
      return it.kind === 'feed';
    });

    const toneCls: Record<NewsTone, string> = {
      urg: 'bg-[var(--red-soft)]/35 border-[var(--red)]/30',
      warn: 'bg-[var(--lamp-soft)]/45 border-[var(--lamp)]/40',
      ok: 'bg-[var(--g-soft)]/35 border-[var(--g)]/30',
      info: 'bg-[var(--surface-2)]/65 border-[var(--line)]/70'
    };

    return (
      <div className="p-2.5 sm:p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-2 mland:space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-xs sm:text-sm mland:text-[11px] truncate">
            📬 งานด่วน &amp; ข่าวสโมสร
          </div>
          <div className="seg-bar shrink-0">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['urg', `ด่วน (${urgentCount})`],
                ['feed', 'ข่าวทีม']
              ] as const
            ).map(([fid, flbl]) => (
              <button
                key={fid}
                type="button"
                onClick={() => { SFX.tap(); setNewsFilter(fid); }}
                className={`seg-btn ${newsFilter === fid ? 'seg-btn-active' : ''}`}
              >
                {flbl}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[210px] sm:max-h-[240px] mland:max-h-[148px] overflow-y-auto space-y-1.5 mland:space-y-1 pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-3 text-center">
              ไม่มีเรื่องเร่งด่วนในขณะนี้ ทีมพร้อมลงสนาม!
            </div>
          ) : (
            filteredItems.map((it) => (
              <div
                key={it.id}
                className={`p-2 mland:p-1.5 rounded-xl mland:rounded-lg border flex items-center justify-between gap-2 mland:gap-1.5 ${toneCls[it.tone]}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] mland:text-[8px] font-semibold text-[var(--mut)] truncate">
                    {it.icon} {it.tag}
                  </div>
                  <div className="font-bold text-[11px] mland:text-[9.5px] text-[var(--ink)] leading-tight truncate">
                    {it.title}
                  </div>
                  <div className="text-[10px] mland:text-[8.5px] text-[var(--mut)] leading-snug truncate">
                    {it.detail}
                  </div>
                </div>
                {it.actionLabel && it.onAction && (
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); it.onAction?.(); }}
                    className="btn btn-xs btn-surface hover:bg-[var(--g)] hover:text-white shrink-0"
                  >
                    {it.actionLabel}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderStandings = () => (
    <div className="flex-1 min-h-0 grid grid-cols-[1.42fr_0.88fr] gap-2.5 mland:gap-2 overflow-hidden">
      <div className="space-y-1.5 mland:space-y-1 h-full flex flex-col min-h-0">
        <div className="rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
          {/* Table Column Header */}
          <div className="shrink-0 grid grid-cols-[18px_17px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_22px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_17px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-1.5 mland:py-1 bg-[var(--surface-2)]/90 text-[9.5px] sm:text-[11px] mland:text-[8.5px] text-[var(--mut)] border-b border-[var(--line)] font-bold">
            <span className="text-center">#</span>
            <span />
            <span className="truncate">สโมสร</span>
            <span className="text-center text-[9px] sm:text-[11px] mland:text-[8px] whitespace-nowrap" title="ฟอร์ม 5 นัดหลังสุด">5 นัด</span>
            <span className="text-center whitespace-nowrap">แข่ง</span>
            <span className="text-center whitespace-nowrap">ชนะ</span>
            <span className="text-center whitespace-nowrap">เสมอ</span>
            <span className="text-center whitespace-nowrap">แพ้</span>
            <span className="text-center whitespace-nowrap" title="ประตูได้-เสีย">+/-</span>
            <span className="text-center text-[var(--ink)] whitespace-nowrap">แต้ม</span>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[var(--line)]/50 flex-1 min-h-0 overflow-y-auto">
            {tb.map((t, i) => {
              const isPromo = i < 3 && vt < 2;
              const isRel = i >= tb.length - 3 && vt > 0;
              const isMe = t.id === state.me;
              const gd = t.gf - t.ga;
              const rankBadge = isPromo
                ? 'bg-[var(--g)] text-white'
                : isRel
                  ? 'bg-[var(--red)] text-white'
                  : 'text-[var(--mut)]';

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { SFX.tap(); onInspectTeam(t.id); }}
                  className={`w-full grid grid-cols-[18px_17px_minmax(0,1fr)_38px_24px_22px_26px_22px_25px_28px] sm:grid-cols-[24px_22px_minmax(0,1fr)_52px_30px_28px_32px_28px_32px_36px] mland:grid-cols-[18px_17px_minmax(0,1fr)_38px_24px_22px_26px_22px_24px_28px] items-center gap-0.5 sm:gap-1 mland:gap-0.5 px-1.5 sm:px-3 mland:px-1.5 py-1.5 mland:py-0.5 text-left text-[11px] sm:text-xs mland:text-[10px] transition-colors cursor-pointer ${
                    isPromo
                      ? 'bg-[var(--g-soft)]/25 hover:bg-[var(--g-soft)]/55'
                      : isRel
                        ? 'bg-[var(--red-soft)]/20 hover:bg-[var(--red-soft)]/45'
                        : 'even:bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/75'
                  }`}
                >
                  <span className={`text-center tabular font-bold text-[10px] mland:text-[9px] rounded-md py-0.5 leading-none ${rankBadge}`}>
                    {i + 1}
                  </span>
                  <div className="flex items-center justify-center mland:[&>svg]:w-4 mland:[&>svg]:h-4">
                    <ClubCrest name={t.name} size={17} team={t} club={state.club} isMyClub={state.mode === 'm' && isMe} />
                  </div>
                  <div className="min-w-0 pr-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`whitespace-normal break-words text-[11px] sm:text-[12.5px] mland:text-[10px] leading-[1.18] ${isMe ? 'font-bold text-[var(--ink)]' : ''}`}>
                        {t.name}
                      </span>
                      {isMe && (
                        <span
                          title="ทีมของคุณ"
                          aria-label="ทีมของคุณ"
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black shrink-0"
                        >
                          ★
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {renderFormDots(t.fm)}
                  </div>
                  <span className="text-center tabular text-[var(--mut)]">{t.p}</span>
                  <span className="text-center tabular">{t.w}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.d}</span>
                  <span className="text-center tabular text-[var(--mut)]">{t.l}</span>
                  <span className={`text-center tabular font-semibold ${gd > 0 ? 'text-[var(--g)]' : gd < 0 ? 'text-[var(--red)]' : 'text-[var(--mut)]'}`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </span>
                  <span className="text-center tabular font-extrabold text-[11px] sm:text-xs mland:text-[10px] rounded-md py-0.5 leading-none bg-[var(--surface-2)]/85 text-[var(--ink)]">
                    {t.pts}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] mland:text-[9px] text-[var(--mut)] px-1 shrink-0">
          {vt < 2 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[var(--g)] inline-block" />
              <span>1-3 เลื่อนชั้น</span>
            </span>
          )}
          {vt > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[var(--red)] inline-block" />
              <span>3 ท้ายตกชั้น</span>
            </span>
          ) : (
            <span>ลีกจังหวัดไม่ตกชั้น</span>
          )}
        </div>

      </div>

      {/* Right Column: Matchday Command Hub (Next Match + Actionable Inbox + Recent Form) */}
      <div className="space-y-2 mland:space-y-1.5 h-full overflow-y-auto pr-0.5">
        {renderNextMatchCard()}
        {renderImportantNewsPanel()}
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
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : isDraw
                    ? 'bg-amber-400/12 border-amber-500/25'
                    : 'bg-rose-500/10 border-rose-500/25';
                return (
                  <div key={i} className={`text-[11px] mland:text-[10px] px-2.5 py-1 mland:py-0.5 rounded-lg border leading-snug tabular ${toneCls}`}>
                    {r}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] mland:text-[10px] text-[var(--mut)]">ยังไม่มีการแข่งขัน</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderPowerComparison = () => {
    const minV = Math.min(...leagueRows.map((x) => x.st[cmpSort])) - 4;
    const maxV = Math.max(...leagueRows.map((x) => x.st[cmpSort]), minV + 8);
    const sortLabels: Record<'ovSq' | 'ovXi' | 'at' | 'df', string> = { ovSq: 'เฉลี่ยทีม', ovXi: '11 ตัวจริง', at: 'พลังบุก', df: 'พลังรับ' };
    return (
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 mland:mb-1.5 shrink-0">
          <h3 className="font-bold text-xs sm:text-sm mland:text-[11px]">📊 เทียบพลังทีม · {TN[vt]}</h3>
          <div className="seg-bar shrink-0">
            {(['ovSq', 'ovXi', 'at', 'df'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setCmpSort(k)} className={`seg-btn ${cmpSort === k ? 'seg-btn-active' : ''}`}>
                {sortLabels[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1.5 pr-0.5 content-start">
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

  const renderStatsAndAwards = () => {
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
        icon: '👟',
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
        icon: '👑',
        title: 'นักเตะยอดเยี่ยมประจำฤดูกาล',
        enTitle: 'Player of the Season',
        criteria: 'คะแนนรวมจากประตู แอสซิสต์ คลีนชีต วินัย และอันดับทีม',
        accentText: 'text-[var(--ink)]',
        accentBg: 'bg-[var(--surface-2)] border-[var(--line)]',
        entries: mvpList,
        emptyText: 'ยังไม่มีคะแนนผลงานประจำฤดูกาล รอการลงสนามนัดแรก'
      }
    ];

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
      <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
        {/* Unified Context Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mland:px-2.5 mland:py-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] shrink-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm mland:text-[11px]">
            <span className="font-bold text-[var(--ink)]">🏅 สถิติและรางวัลส่วนตัวนักเตะ</span>
            <span aria-hidden="true" className="text-[var(--mut)]">·</span>
            <span className="text-[var(--mut)] font-medium">{TN[vt]}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs mland:text-[9.5px] text-[var(--mut)] tabular-nums">
            <span>ซีซั่น {state.season} · แข่งแล้ว {maxPlayedInTier}/{totalRounds} นัด · {isSeasonDone ? 'สรุปผลประจำฤดูกาล' : 'กำลังลุ้นรางวัล'}</span>
            {onOpenSeasonStats && (state.seasonArchives?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  onOpenSeasonStats();
                }}
                className="btn btn-xs btn-primary"
              >
                📜 สถิติซีซั่นที่จบแล้ว ({state.seasonArchives!.length})
              </button>
            )}
          </div>
        </div>

        {/* Unified Scrollable Body: Awards Showcase + Stat Leaderboards */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3 mland:space-y-2">
          {/* 3-Column Awards Showcase */}
          <div className="grid grid-cols-3 gap-2.5 mland:gap-2 items-stretch">
            {awards.map((aw) => {
              const leader = aw.entries[0];
              const runners = aw.entries.slice(1);
              const leaderIsMe = leader?.t.id === state.me;

              return (
                <section
                  key={aw.id}
                  className="p-3.5 sm:p-4 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col justify-between gap-2.5 mland:gap-1.5"
                >
                  <div className="space-y-2.5 mland:space-y-1.5">
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
                        className={`w-full p-2.5 sm:p-3 mland:p-1.5 rounded-xl border text-left cursor-pointer transition-colors hover:border-[var(--g)] ${
                          leaderIsMe ? 'bg-[var(--lamp-soft)]/65 border-[var(--lamp)]' : aw.accentBg
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mland:gap-2">
                          <div className="shrink-0">
                            <PlayerFace player={leader.q} team={leader.t} state={state} size={42} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)] flex items-center gap-1">
                                <span>อันดับ 1</span>
                                {leaderIsMe && (
                                  <span
                                    title="ทีมของคุณ"
                                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--lamp)] text-[#261900] text-[8.5px] font-black"
                                  >
                                    ★
                                  </span>
                                )}
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
                        <div className="mt-2 mland:mt-1 pt-1.5 mland:pt-1 border-t border-[var(--line)]/70 text-[11px] mland:text-[9px] text-[var(--mut)] tabular-nums">
                          {leader.breakdown}
                        </div>
                      </button>
                    ) : (
                      <div className="p-3.5 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] text-center space-y-1">
                        <div className="text-xs mland:text-[10px] font-semibold text-[var(--ink)]">ยังไม่มีผู้ครองอันดับ 1</div>
                        <p className="text-[11px] mland:text-[9px] text-[var(--mut)] leading-snug">{aw.emptyText}</p>
                      </div>
                    )}
                  </div>

                  {/* Contenders #2 - #5 */}
                  <div className="border-t border-[var(--line)] pt-2 mland:pt-1.5 space-y-1 mland:space-y-0.5">
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
                              className={`w-full min-h-[36px] mland:min-h-[26px] flex items-center gap-2 mland:gap-1.5 px-2 py-1 mland:py-0.5 rounded-lg text-left cursor-pointer transition-colors ${
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
                      <p className="text-[11px] mland:text-[9.5px] text-[var(--mut)] py-1.5">
                        {leader ? 'ยังไม่มีผู้ท้าชิงอันดับรอง' : 'รอกรรมการบันทึกสถิติการแข่งขัน'}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* 6 Stat Leaderboards */}
          <div className="grid grid-cols-3 gap-2 mland:gap-1.5 content-start">
            {board('⚽', 'ดาวซัลโว', (q) => q.sg || 0, (q) => `${q.sg || 0}`)}
            {board('🎯', 'แอสซิสต์สูงสุด', (q) => q.sa || 0, (q) => `${q.sa || 0}`)}
            {board('🔥', 'ประตู + แอสซิสต์', (q) => (q.sg || 0) + (q.sa || 0), (q) => `${(q.sg || 0) + (q.sa || 0)}`)}
            {board('🧤', 'คลีนชีต (ผู้รักษาประตู)', (q) => q.cs || 0, (q) => `${q.cs || 0}`, (q) => q.pos === 'GK')}
            {board('💎', 'ค่าตัวสูงสุด', vlu, (q) => fmtMoneyNum(vlu(q)))}
            {board('⚡', 'พลังรวมสูงสุด', (q) => q.ov, (q) => `${q.ov}`)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mland:gap-1.5 overflow-hidden">
      <div className="flex flex-row items-center justify-between gap-1.5 shrink-0">
        {/* Competition Sub-Navigation Menu: Single compact horizontal pill strip */}
        <div className="order-2 w-auto max-w-full seg-bar bg-[var(--surface)] shadow-xs overflow-x-auto">
          {(
            [
              [0, '🏆', 'บอลลีก'],
              [4, '🏅', 'บอลถ้วย'],
              [2, '⭐', 'สถิติ & รางวัล'],
              [3, '📅', 'ปฏิทิน'],
              [1, '📊', 'พลังทีม']
            ] as const
          ).map(([tabIdx, ic, fullLbl]) => (
            <button
              key={fullLbl}
              type="button"
              onClick={() => {
                SFX.tap();
                onUpdateState((d) => {
                  if (d.v === 'c') d.v = 't';
                  d.tv = tabIdx;
                });
              }}
              className={`seg-btn shrink-0 min-w-0 ${
                sub === tabIdx
                  ? 'seg-btn-active'
                  : 'hover:bg-[var(--surface-2)]/70'
              }`}
            >
              <span className="text-xs mland:text-[10.5px] leading-none">{ic}</span>
              <span className="truncate">{fullLbl}</span>
            </button>
          ))}
        </div>

        {/* Left Header Slot: Standings puts Season label in front of League Switcher; Stats/Power use tier pills */}
        {sub === 0 ? (
          <div className="order-1 flex items-center gap-1.5 min-w-0 shrink">
            <div className="flex items-center gap-1.5 px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold text-[var(--ink)] shadow-xs shrink-0 whitespace-nowrap">
              <span>🏆</span>
              <span>ตารางคะแนน · ซีซั่น {state.season}</span>
            </div>
            <div className="relative inline-flex items-center min-w-0">
              <select
                aria-label="เลือกลีกในตารางคะแนน"
                value={vt}
                onChange={(e) => {
                  const nextTier = Number(e.target.value);
                  SFX.tap();
                  onUpdateState((d) => { d.lg = nextTier; });
                }}
                className="appearance-none bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] focus:border-[var(--g)] focus:outline-none rounded-xl pl-2.5 pr-7 mland:pl-2 mland:pr-5 py-1 mland:py-0.5 font-bold text-xs mland:text-[10px] text-[var(--ink)] cursor-pointer truncate max-w-[175px] sm:max-w-none transition-colors shadow-xs"
              >
                {[0, 1, 2].map((tierIdx) => (
                  <option key={tierIdx} value={tierIdx}>
                    {TN[tierIdx]}{tierIdx === me.tier ? ' ★' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 mland:w-3 mland:h-3 text-[var(--mut)] pointer-events-none absolute right-2 mland:right-1.5 top-1/2 -translate-y-1/2" />
            </div>
            {vt !== me.tier && (
              <button
                type="button"
                title="กลับลีกของฉัน"
                aria-label="กลับลีกของฉัน"
                onClick={() => { SFX.tap(); onUpdateState((d) => { d.lg = me.tier; }); }}
                className="btn btn-xs btn-gold shrink-0"
              >
                <span>↩</span>
                <span>กลับลีกฉัน ★</span>
              </button>
            )}
          </div>
        ) : sub === 1 || sub === 2 ? (
          <div className="order-1 w-auto seg-bar bg-[var(--surface)] shadow-xs shrink-0">
            {['จังหวัด', 'ในประเทศ 2', 'ในประเทศ 1'].map((lbl, idx) => {
              const isMyTier = idx === me.tier;
              const active = vt === idx;
              return (
                <button
                  key={lbl}
                  type="button"
                  title={isMyTier ? `${lbl} (ลีกของคุณ)` : lbl}
                  onClick={() => { SFX.tap(); onUpdateState((d) => { d.lg = idx; }); }}
                  className={`seg-btn min-w-0 ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs hover:text-[var(--bg)]'
                      : 'hover:bg-[var(--surface-2)]/70'
                  }`}
                >
                  <span className="truncate">{lbl}</span>
                  {isMyTier && (
                    <span
                      aria-label="ลีกของคุณ"
                      className={`text-[10px] mland:text-[9px] leading-none shrink-0 ${active ? 'text-[var(--lamp)]' : 'text-[#c98a00] dark:text-[var(--lamp)]'}`}
                    >
                      ★
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="order-1 flex items-center gap-1.5 px-2.5 py-1 mland:px-2 mland:py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-bold text-[var(--ink)] shadow-xs shrink-0">
            <span>{sub === 4 ? '🏅' : '📅'}</span>
            <span>{sub === 4 ? 'รายการแข่งขันบอลถ้วย' : 'โปรแกรมการแข่งขัน'}</span>
          </div>
        )}
      </div>
      {sub === 0 && renderStandings()}
      {sub === 1 && renderPowerComparison()}
      {sub === 2 && renderStatsAndAwards()}
      {sub === 3 && <ScheduleCalendarView state={state} onInspectTeam={onInspectTeam} />}
      {sub === 4 && <CupView state={state} onInspectTeam={onInspectTeam} />}
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
    <div className="grid grid-cols-[0.88fr_1.12fr] grid-rows-[auto_1fr] gap-2.5 mland:gap-2 flex-1 min-h-0 overflow-hidden">
      {/* Top Season Calendar Overview */}
      <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1 col-start-1 row-start-1">
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
                className={`btn btn-xs ${
                  tw.open
                    ? 'bg-[var(--g-soft)] border border-[var(--g)]/50 text-[var(--g)] hover:border-[var(--g)]'
                    : 'btn-secondary text-[var(--mut)]'
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
                className="btn btn-xs btn-gold"
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
              <button type="button" onClick={onPlayNext} className="btn btn-xs btn-gold">
                ▶ ลงสนามนัดนี้
              </button>
            )}
          </div>
        )}
      </div>

      {/* Month / View Selector + Calendar Grid */}
      <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5 col-start-2 row-start-1 row-span-2 h-full flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-1.5 mland:gap-1 shrink-0">
          {months.map((m) => {
            const isCurMonth = state.md >= m.start && state.md < m.end;
            return (
              <button
                key={m.idx}
                type="button"
                onClick={() => { SFX.tap(); setMonthIdx(m.idx); }}
                className={`btn btn-xs ${
                  monthIdx === m.idx
                    ? 'btn-primary'
                    : isCurMonth
                      ? 'bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-[var(--ink)] hover:border-[var(--lamp)]'
                      : 'btn-secondary text-[var(--mut)]'
                }`}
              >
                {m.label} <span className="opacity-80 text-[9.5px]">({m.range})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { SFX.tap(); setMonthIdx(-1); }}
            className={`btn btn-xs ml-auto ${
              monthIdx === -1 ? 'bg-[var(--ink)] text-[var(--bg)] border border-[var(--ink)]' : 'btn-secondary text-[var(--mut)]'
            }`}
          >
            📋 ดูทั้ง 30 นัด
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mland:gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 content-start">
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

      {/* Bottom Left: Weekly League Fixtures & Cup Log */}
      <div className="grid grid-cols-1 gap-2.5 mland:gap-2 col-start-1 row-start-2 min-h-0 overflow-y-auto pr-0.5">
        <div className="p-3 mland:p-2 rounded-2xl bg-[var(--surface)] border border-[var(--line)] space-y-2 mland:space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-xs sm:text-sm">📋 โปรแกรมคู่อื่นในลีก · นัดที่ {roundPreview + 1}</h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={roundPreview <= 0}
                onClick={() => setRoundPreview((r) => Math.max(0, r - 1))}
                className="btn btn-xs btn-secondary"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={roundPreview >= totalMd - 1}
                onClick={() => setRoundPreview((r) => Math.min(totalMd - 1, r + 1))}
                className="btn btn-xs btn-secondary"
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


