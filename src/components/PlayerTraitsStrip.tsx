import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FootballTraitDef, Player, PlayerCareerProfile, Position } from '../types/game';
import { FOOTBALL_TRAITS, PLAYER_ARCHETYPES, PLAYER_PERSONALITIES, SIGL } from '../data/thaiFootballData';
import { talentTierMeta } from '../engine/missions';
import { ROLE_ADAPT_THRESHOLD_ADJ, ROLE_ADAPT_THRESHOLD_CROSS } from '../engine/simulation';
import { playerPen } from '../engine/playerCore';
import { SFX } from '../utils/audioTheme';

interface GuideEntry {
  id: string;
  section: 'personality' | 'style' | 'insight';
  subGroup: string;
  title: string;
  desc: string;
  owned: boolean;
  badgeText?: string;
  tone?: 'pos' | 'warn' | 'gold' | 'sig' | 'neutral';
  meta?: string;
}

const RISKY_TRAIT_IDS = new Set(['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler', 'risk_taker']);

const TALENT_TIERS: Array<{ id: string; range: string; label: string; emoji: string; desc: string; check: (tl: number) => boolean }> = [
  { id: 'tl_legend', range: '85–99', label: 'อัจฉริยะลูกหนัง', emoji: '💎', desc: 'พรสวรรค์ระดับสูงสุด พัฒนาค่าพลังไวมากและทำภารกิจอัปพลังติดง่ายที่สุด', check: (tl) => tl >= 85 },
  { id: 'tl_high', range: '70–84', label: 'พรสวรรค์สูง', emoji: '🌟', desc: 'มีแววระดับตัวท็อป เติบโตไวและมีโอกาสอัปพลังจากภารกิจสูง', check: (tl) => tl >= 70 && tl < 85 },
  { id: 'tl_pro', range: '50–69', label: 'มาตรฐานอาชีพ', emoji: '⚡', desc: 'พัฒนาตามมาตรฐานนักเตะอาชีพ เติบโตต่อเนื่องเมื่อซ้อมและลงเล่นสม่ำเสมอ', check: (tl) => tl >= 50 && tl < 70 },
  { id: 'tl_hard', range: 'ต่ำกว่า 50', label: 'ต้องฝึกหนักเป็นพิเศษ', emoji: '🧱', desc: 'เติบโตช้ากว่าสายพรสวรรค์ ต้องอาศัยความขยัน ภารกิจ และสนามซ้อมระดับสูงช่วยหนุน', check: (tl) => tl < 50 }
];

const POS_LABEL: Record<Position, string> = {
  FW: 'กองหน้า',
  MF: 'กองกลาง',
  DF: 'กองหลัง',
  GK: 'ผู้รักษาประตู'
};

const GK_SIG_KEYS = ['sv', 'rfx', 'hnd', 'cl', 'pos', 'dist', 'sta', 'comp'];
const OUTFIELD_SIG_KEYS = [
  'fin', 'pw', 'cur', 'lsh', 'fk', 'run',
  'drb', 'ctrl', 'spass', 'lpass', 'crs', 'vis',
  'rd', 'tkl', 'pos', 'mrk', 'blk', 'hd',
  'spd', 'acc', 'str', 'sta', 'agi', 'jmp',
  'comp', 'foc', 'ldr', 'det'
];

export const PlayerTraitsStrip: React.FC<{
  player: Partial<Player>;
  careerProfile?: PlayerCareerProfile | null;
  trPair: readonly string[];
  traits: FootballTraitDef[];
  talent: number;
  growthStage: string;
  peakAge: number;
  sigKey: string;
  archName?: string;
}> = ({
  player,
  careerProfile,
  trPair,
  traits,
  talent,
  growthStage,
  peakAge,
  sigKey,
  archName
}) => {
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [sectionTab, setSectionTab] = useState<'all' | 'personality' | 'style' | 'insight'>('all');
  const [ownFilter, setOwnFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const [query, setQuery] = useState('');

  const tlMeta = talentTierMeta(talent);
  const sigLabel = SIGL[sigKey] || sigKey;
  const age = player.age || careerProfile?.age || 24;
  const rawTrTitle = trPair[0] || '😐 ปกติ';
  const trShortName = rawTrTitle.replace(/^[^\u0E00-\u0E7F]+/u, '').trim() || rawTrTitle;
  const pos: Position = player.pos || careerProfile?.pos || 'MF';

  const ownedTraitIds = useMemo(() => new Set(traits.map((t) => t.id)), [traits]);

  const allGuideEntries = useMemo<GuideEntry[]>(() => {
    const entries: GuideEntry[] = [];

    // 1) Personalities (all dynamic)
    PLAYER_PERSONALITIES.forEach((p) => {
      const owned = rawTrTitle === p.label || trShortName === p.name;
      entries.push({
        id: `pers_${p.id}`,
        section: 'personality',
        subGroup: `นิสัยประจำตัว (${PLAYER_PERSONALITIES.length} แบบ)`,
        title: p.label,
        desc: p.desc,
        owned,
        tone: p.tone
      });
    });

    // 2) Career Archetypes (if in career or has archName)
    if (archName || careerProfile) {
      PLAYER_ARCHETYPES.forEach((arc) => {
        const owned = !!archName && arc.name === archName;
        entries.push({
          id: `arch_${arc.id}`,
          section: 'style',
          subGroup: 'สายการเล่นอาชีพ (Archetypes)',
          title: `${arc.icon} ${arc.name}`,
          desc: arc.desc,
          owned,
          tone: 'gold',
          meta: arc.pos.map((x) => POS_LABEL[x]).join(' / ')
        });
      });
    }

    // 3) All Football Traits
    FOOTBALL_TRAITS.forEach((t) => {
      const owned = ownedTraitIds.has(t.id);
      const isRisk = RISKY_TRAIT_IDS.has(t.id);
      entries.push({
        id: `trait_${t.id}`,
        section: 'style',
        subGroup: `สไตล์การเล่น & สกิลติดตัว (${FOOTBALL_TRAITS.length} แบบ)`,
        title: `${t.icon} ${t.name}`,
        desc: t.desc,
        owned,
        tone: isRisk ? 'warn' : 'pos',
        meta: `${t.pos.map((x) => POS_LABEL[x]).join(' / ')}${isRisk ? ' · ข้อควรระวัง' : ''}`
      });
    });

    // 4) Talent Tiers
    TALENT_TIERS.forEach((tier) => {
      const owned = tier.check(talent);
      entries.push({
        id: tier.id,
        section: 'insight',
        subGroup: 'ระดับพรสวรรค์ (Talent)',
        title: `${tier.emoji} ${tier.label} (TL ${tier.range})`,
        desc: tier.desc,
        owned,
        badgeText: owned ? `มี (TL ${talent})` : undefined,
        tone: 'gold'
      });
    });

    // 5) Growth Phases
    const growthDefs: Array<{ id: string; name: string; icon: string; desc: string; tone: 'pos' | 'gold' | 'warn' }> = [
      {
        id: 'gr_grow',
        name: 'กำลังเติบโต',
        icon: '🌱',
        desc: `วัยพัฒนา ค่าพลังมีโอกาสพุ่งขึ้นไวจากการซ้อมและการลงสนาม (ก่อนอายุ ${peakAge - 2} ปี)`,
        tone: 'pos'
      },
      {
        id: 'gr_peak',
        name: 'ช่วงพีค',
        icon: '🔥',
        desc: `ช่วงท็อปฟอร์มของอาชีพ ฟอร์มการเล่นและสภาพร่างกายสมดุลที่สุด (อายุ ${peakAge - 2}–${peakAge + 4} ปี)`,
        tone: 'gold'
      },
      {
        id: 'gr_dec',
        name: 'เริ่มถดถอย',
        icon: '⏳',
        desc: `เข้าสู่ช่วงปลายอาชีพ (หลังอายุ ${peakAge + 4} ปี) เน้นประสบการณ์ คุมความฟิต และช่วยประคองทีม`,
        tone: 'warn'
      }
    ];
    growthDefs.forEach((g) => {
      const owned = growthStage === g.name;
      entries.push({
        id: g.id,
        section: 'insight',
        subGroup: 'ช่วงวัยพัฒนาการ (3 ช่วง)',
        title: `${g.icon} ${g.name}`,
        desc: g.desc,
        owned,
        badgeText: owned ? `ปัจจุบัน (อายุ ${age})` : undefined,
        tone: g.tone
      });
    });

    // 6) Signature Skills (+8)
    const relevantSigKeys = Array.from(
      new Set([sigKey, ...(pos === 'GK' ? GK_SIG_KEYS : OUTFIELD_SIG_KEYS)])
    ).filter((k) => SIGL[k]);

    relevantSigKeys.forEach((k) => {
      const label = SIGL[k] || k;
      const owned = k === sigKey;
      entries.push({
        id: `sig_${k}`,
        section: 'insight',
        subGroup: `ทีเด็ดประจำตัว (+8 ทักษะ${pos === 'GK' ? 'ผู้รักษาประตู' : 'นักเตะสนาม'})`,
        title: `⭐ ${label}`,
        desc: `ได้รับโบนัสพิเศษ +8 ในทักษะ "${label}" เหนือค่าพื้นฐาน ทำให้นักเตะโดดเด่นเป็นพิเศษในจังหวะสำคัญ`,
        owned,
        badgeText: owned ? 'มี (+8)' : undefined,
        tone: 'sig'
      });
    });

    return entries;
  }, [rawTrTitle, trShortName, archName, careerProfile, ownedTraitIds, talent, growthStage, peakAge, age, sigKey, pos]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allGuideEntries.filter((item) => {
      if (sectionTab !== 'all' && item.section !== sectionTab) return false;
      if (ownFilter === 'owned' && !item.owned) return false;
      if (ownFilter === 'unowned' && item.owned) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q) && !item.subGroup.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allGuideEntries, sectionTab, ownFilter, query]);

  const groupedEntries = useMemo(() => {
    const map = new Map<string, GuideEntry[]>();
    filteredEntries.forEach((item) => {
      const arr = map.get(item.subGroup) || [];
      arr.push(item);
      map.set(item.subGroup, arr);
    });
    return Array.from(map.entries());
  }, [filteredEntries]);

  const ownedCount = useMemo(() => allGuideEntries.filter((x) => x.owned).length, [allGuideEntries]);
  const unownedCount = allGuideEntries.length - ownedCount;

  const matchedPers = PLAYER_PERSONALITIES.find((p) => rawTrTitle === p.label || trShortName === p.name);
  const persTone = matchedPers?.tone || 'neutral';
  const persBadgeCls =
    persTone === 'warn'
      ? 'bg-amber-500/12 border-amber-500/40 text-amber-800 dark:text-amber-200'
      : persTone === 'gold'
        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#7a4f00] dark:text-[#fde047]'
        : persTone === 'neutral'
          ? 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]'
          : 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]';

  const growthBadgeCls =
    growthStage === 'เริ่มถดถอย'
      ? 'bg-amber-500/12 border-amber-500/40 text-amber-800 dark:text-amber-200'
      : growthStage === 'ช่วงพีค'
        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#7a4f00] dark:text-[#fde047]'
        : 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]';

  return (
    <>
      <div className="shrink-0 rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2 mland:p-1.5 shadow-xs space-y-1.5 mland:space-y-1">
        {/* Header + ? Button */}
        <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[var(--line)]/60">
          <span className="text-[10.5px] mland:text-[8.5px] font-bold text-[var(--ink)] truncate">
            🧠 นิสัย · สไตล์ · เชิงลึก
          </span>
          <button
            type="button"
            onClick={() => {
              SFX.tap();
              setSectionTab('all');
              setOwnFilter('all');
              setQuery('');
              setShowGuideModal(true);
            }}
            title="ดูนิสัย สไตล์ และข้อมูลเชิงลึกทั้งหมด (ทั้งที่มีและไม่มี)"
            aria-label="ดูนิสัย สไตล์ และข้อมูลเชิงลึกทั้งหมด"
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--g-soft)] border border-[var(--line)] hover:border-[var(--g)] text-[9.5px] mland:text-[7.5px] font-extrabold text-[var(--ink)] cursor-pointer transition-colors"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-[var(--g)] text-white inline-flex items-center justify-center text-[9px] font-black leading-none">
              ?
            </span>
            <span>ทั้งหมด</span>
          </button>
        </div>

        {/* Section 1: นิสัย */}
        <div className="space-y-0.5">
          <div className="text-[9px] mland:text-[7.5px] font-bold text-[var(--mut)]">นิสัย</div>
          <div className="flex flex-wrap gap-1">
            <span className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight ${persBadgeCls}`}>
              {rawTrTitle}
            </span>
          </div>
        </div>

        {/* Section 2: สไตล์การเล่น */}
        <div className="space-y-0.5 pt-1 border-t border-[var(--line)]/45">
          <div className="flex items-center justify-between text-[9px] mland:text-[7.5px] font-bold text-[var(--mut)]">
            <span>สไตล์การเล่น</span>
            <span className="tabular opacity-80">{traits.length} สไตล์</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {archName && (
              <span className="px-2 mland:px-1.5 py-0.5 rounded-lg border bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#7a4f00] dark:text-[#fde047] text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight">
                🎭 {archName}
              </span>
            )}
            {traits.length > 0 ? (
              traits.map((t) => {
                const isRisk = RISKY_TRAIT_IDS.has(t.id);
                return (
                  <span
                    key={t.id}
                    className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight ${
                      isRisk
                        ? 'bg-amber-500/12 border-amber-500/40 text-amber-800 dark:text-amber-200'
                        : 'bg-[var(--g-soft)] border-[var(--g)]/35 text-[var(--g)]'
                    }`}
                  >
                    {t.icon} {t.name}
                  </span>
                );
              })
            ) : (
              <span className="px-2 py-0.5 rounded-lg border border-dashed border-[var(--line)] text-[9.5px] mland:text-[7.5px] text-[var(--mut)]">
                ยังไม่มีสไตล์เฉพาะตัว
              </span>
            )}
          </div>
        </div>

        {/* Section 3: ข้อมูลเชิงลึก */}
        <div className="space-y-0.5 pt-1 border-t border-[var(--line)]/45">
          <div className="text-[9px] mland:text-[7.5px] font-bold text-[var(--mut)]">ข้อมูลเชิงลึก</div>
          <div className="flex flex-wrap gap-1">
            <span className="px-2 mland:px-1.5 py-0.5 rounded-lg border bg-[var(--lamp-soft)] border-[var(--lamp)]/55 text-[#7a4f00] dark:text-[#fde047] text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight tabular">
              {tlMeta.emoji} TL {talent} ({tlMeta.label})
            </span>
            <span className={`px-2 mland:px-1.5 py-0.5 rounded-lg border text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight ${growthBadgeCls}`}>
              📈 {growthStage} ({age} ปี)
            </span>
            <span className="px-2 mland:px-1.5 py-0.5 rounded-lg border bg-sky-500/12 border-sky-500/40 text-sky-800 dark:text-sky-200 text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight">
              ⭐ ทีเด็ด: {sigLabel} +8
            </span>
          </div>
        </div>

        {/* Section 3b: ตำแหน่งถนัดรอง & การปรับตัว */}
        {(() => {
          const altRoles = careerProfile?.altRoles?.length ? careerProfile.altRoles : player.altRoles || [];
          const roleExp = careerProfile?.roleExp && Object.keys(careerProfile.roleExp).length ? careerProfile.roleExp : player.roleExp || {};
          const expEntries = Object.entries(roleExp).filter(([r, exp]) => exp > 0 && r !== (player.ro || careerProfile?.sp) && !altRoles.includes(r as never));
          if (!altRoles.length && !expEntries.length) return null;
          return (
            <div className="space-y-0.5 pt-1 border-t border-[var(--line)]/45">
              <div className="text-[9px] mland:text-[7.5px] font-bold text-[var(--mut)]">ตำแหน่งที่เล่นได้ &amp; กำลังปรับตัว</div>
              <div className="flex flex-wrap gap-1">
                {altRoles.map((r) => (
                  <span
                    key={r}
                    className="px-2 mland:px-1.5 py-0.5 rounded-lg border bg-emerald-500/12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight"
                  >
                    🧩 {r} (ถนัดเพิ่ม)
                  </span>
                ))}
                {expEntries.map(([r, exp]) => {
                  const need = playerPen({ ro: player.ro || careerProfile?.sp || 'CM', altRoles }, r as never) === 1
                    ? ROLE_ADAPT_THRESHOLD_ADJ
                    : ROLE_ADAPT_THRESHOLD_CROSS;
                  return (
                    <span
                      key={r}
                      title={`กำลังซึมซับตำแหน่ง ${r} (${exp}/${need} นัด) — ยิ่งลงตำแหน่งนี้ ค่าพลังจะพัฒนาไปตามบทบาทและปลดล็อกเป็นตำแหน่งถนัด`}
                      className="px-2 mland:px-1.5 py-0.5 rounded-lg border bg-sky-500/10 border-sky-500/35 text-sky-700 dark:text-sky-300 text-[10px] mland:text-[8px] font-bold inline-flex items-center leading-tight tabular"
                    >
                      🔄 ฝึก {r} ({exp}/{need})
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {showGuideModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] bg-black/72 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-hidden"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              className="w-full max-w-3xl h-[min(calc(var(--app-dvh,1dvh)*90),680px)] rounded-3xl bg-[var(--bg)] border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <header className="shrink-0 px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold font-display text-[var(--ink)] truncate">
                    📖 คู่มือนิสัย สไตล์ &amp; ข้อมูลเชิงลึกทั้งหมด
                  </div>
                  <div className="text-[11px] text-[var(--mut)] truncate tabular">
                    {player.n || careerProfile?.name || 'นักเตะ'} · มีแล้ว <b className="text-[var(--g)]">{ownedCount}</b> รายการ · ยังไม่มี <b className="text-[var(--ink)]">{unownedCount}</b> รายการ
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="ปิดหน้าต่างคู่มือ"
                  className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--line)]/60 border border-[var(--line)] text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </header>

              {/* Filters Bar */}
              <div className="shrink-0 px-3.5 py-2 bg-[var(--surface)]/70 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {([
                    ['all', `ทั้งหมด (${allGuideEntries.length})`],
                    ['personality', `นิสัย (${PLAYER_PERSONALITIES.length})`],
                    ['style', `สไตล์ (${FOOTBALL_TRAITS.length})`],
                    ['insight', 'ข้อมูลเชิงลึก']
                  ] as const).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { SFX.tap(); setSectionTab(k); }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                        sectionTab === k
                          ? 'bg-[var(--g)] text-white shadow-xs'
                          : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)] border border-[var(--line)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                    {([
                      ['all', 'ทุกสถานะ'],
                      ['owned', `✅ ที่มี (${ownedCount})`],
                      ['unowned', `⬜ ไม่มี (${unownedCount})`]
                    ] as const).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { SFX.tap(); setOwnFilter(k); }}
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors ${
                          ownFilter === k
                            ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                            : 'text-[var(--mut)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อ/ผลลัพธ์..."
                    className="w-36 sm:w-44 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)] focus:outline-none focus:border-[var(--g)]"
                  />
                </div>
              </div>

              {/* Scrollable All-Items Directory */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
                {groupedEntries.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--mut)]">
                    ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                  </div>
                ) : (
                  groupedEntries.map(([groupName, groupItems]) => {
                    const ownedInGroup = groupItems.filter((x) => x.owned).length;
                    const sorted = groupItems.slice().sort((a, b) => Number(b.owned) - Number(a.owned));
                    return (
                      <section key={groupName} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--line)]/70">
                          <h4 className="font-bold text-xs text-[var(--ink)]">{groupName}</h4>
                          <span className="text-[10.5px] font-bold text-[var(--mut)] tabular">
                            มี {ownedInGroup}/{groupItems.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sorted.map((item) => {
                            const ownedToneCls =
                              item.tone === 'warn'
                                ? 'bg-amber-500/12 border-amber-500/50'
                                : item.tone === 'gold'
                                  ? 'bg-[var(--lamp-soft)] border-[var(--lamp)]/60'
                                  : item.tone === 'sig'
                                    ? 'bg-sky-500/12 border-sky-500/50'
                                    : 'bg-[var(--g-soft)] border-[var(--g)]/50';
                            return (
                              <div
                                key={item.id}
                                className={`p-2.5 rounded-2xl border transition-colors space-y-1 ${
                                  item.owned
                                    ? `${ownedToneCls} shadow-xs`
                                    : 'bg-[var(--surface)]/65 border-[var(--line)]/75 opacity-80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-bold text-xs text-[var(--ink)] leading-snug">
                                    {item.title}
                                  </div>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold ${
                                      item.owned
                                        ? 'bg-[var(--g)] text-white'
                                        : 'bg-[var(--surface-2)] text-[var(--mut)] border border-[var(--line)]'
                                    }`}
                                  >
                                    {item.badgeText || (item.owned ? '✓ มี' : 'ไม่มี')}
                                  </span>
                                </div>
                                {item.meta && (
                                  <div className="text-[9.5px] font-semibold text-[var(--mut)]">{item.meta}</div>
                                )}
                                <p className="text-[11px] text-[var(--mut)] leading-snug">{item.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
