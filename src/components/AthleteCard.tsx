import React from 'react';
import type { PlayerBio, StatCategorySummary } from '../engine/playerCore';
import { getCountryMetaByCode, getForeignTeamCountryMeta } from '../data/thaiFootballData';
import { clamp } from '../utils/math';
import { statBarColor, statTierMeta } from '../engine/missions';
import { PlayerFace, resolveGkKitPalette } from './SvgVisuals';
import { TalentBadge } from './TalentBadge';
import { PotentialBadge } from './PotentialBadge';
import { FootPairIcon, getFootColorMeta } from './PlayerBioStrip';
import { PositionBadge } from './PositionBadge';
import { StatIconBadge } from './StatIconBadge';
import { OvrBadge } from './OvrBadge';
import {
  CardStudioToggleButton,
  getAthleteCardPalette,
  useCardStudioTone,
  type AthleteCardPalette,
  type CardStudioTone
} from './CardStudioTheme';

export interface AthleteCardProps {
  ov: number;
  boost?: number;
  pot?: number;
  talent: number;
  roleLabel: string;
  altRolesCount?: number;
  shirtNo: number | string;
  onShirtClick?: () => void;
  shirtButtonTitle?: string;
  renderBadges?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  renderHeaderAction?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  renderStageTopLeft?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  renderStageTopRight?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  kit1: string;
  kit2: string;
  faceProps: Omit<React.ComponentProps<typeof PlayerFace>, 'size' | 'bare'>;
  name: string;
  nationalityCode?: string | null;
  clubCrest?: React.ReactNode;
  subtitle: string;
  bio: PlayerBio;
  discipline?: {
    yc?: number;
    rc?: number;
    inj?: number;
  };
  categories: StatCategorySummary[];
  stretchStage?: boolean;
  className?: string;
}

export const AthleteCard: React.FC<AthleteCardProps> = ({
  ov,
  boost = 0,
  pot,
  talent,
  roleLabel,
  altRolesCount = 0,
  shirtNo,
  onShirtClick,
  shirtButtonTitle,
  renderBadges,
  renderHeaderAction,
  renderStageTopLeft,
  renderStageTopRight,
  kit1,
  kit2,
  faceProps,
  name,
  nationalityCode,
  clubCrest,
  subtitle,
  bio,
  discipline,
  categories,
  stretchStage = false,
  className = ''
}) => {
  const [cardTone, toggleCardTone] = useCardStudioTone();
  const cardPalette = getAthleteCardPalette(cardTone);
  const isLight = cardTone === 'light';
  const badgeNodes = renderBadges?.(cardPalette, cardTone);
  const actionNode = renderHeaderAction?.(cardPalette, cardTone);
  const stageTopLeftNode = renderStageTopLeft?.(cardPalette, cardTone);
  const stageTopRightNode = renderStageTopRight?.(cardPalette, cardTone);
  const resolvedStageTopLeft = stageTopLeftNode ?? badgeNodes;
  const isCardGK =
    faceProps.isGK ?? (faceProps.player?.pos === 'GK' || faceProps.player?.ro === 'GK');
  const gkPalette = isCardGK ? resolveGkKitPalette(kit1, kit2, faceProps.kitColor) : null;
  const cardShirtKit = faceProps.kitColor ?? (gkPalette ? gkPalette.kit : kit1);
  const cardShirtTrim = faceProps.trimColor ?? (gkPalette ? gkPalette.trim : kit2);
  const footMeta = getFootColorMeta(bio.foot);
  const ycCount = discipline?.yc ?? faceProps.player?.yc ?? faceProps.careerProfile?.yc ?? 0;
  const rcCount = discipline?.rc ?? faceProps.player?.rc ?? faceProps.careerProfile?.rc ?? 0;
  const injCount = discipline?.inj ?? faceProps.player?.inj ?? faceProps.careerProfile?.inj ?? 0;
  const resolvedNatCode =
    nationalityCode ||
    faceProps.player?.nat ||
    (faceProps.team && (faceProps.team.tier >= 3 || faceProps.team.foreign === 1)
      ? getForeignTeamCountryMeta(faceProps.team.name)?.code
      : undefined) ||
    'TH';
  const natMeta = getCountryMetaByCode(resolvedNatCode) || getCountryMetaByCode('TH');

  return (
    <div
      className={`relative rounded-2xl mland:rounded-xl border shadow-lg overflow-hidden flex flex-col justify-between shrink-0 ${cardPalette.cardShell} ${className}`}
    >
      {/* Top Kit Accent Strip */}
      <div
        aria-hidden="true"
        className="h-1 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${kit1}, #fad05a 52%, ${kit2})` }}
      />

      {/* Balanced Single-Row Top Header: OVR | Role · #NO  <->  Potential · Talent */}
      <div className="px-2.5 pt-2 pb-1.5 mland:px-2 mland:pt-1.5 mland:pb-1 flex items-center justify-between gap-1.5 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 mland:gap-1 leading-none min-w-0">
          <OvrBadge ov={ov} boost={boost} variant="card" tone={cardTone} />
          <span
            aria-hidden="true"
            className={`w-px h-3.5 mland:h-2.5 shrink-0 ${isLight ? 'bg-slate-300/90' : 'bg-white/20'}`}
          />
          <div className="inline-flex items-center gap-1 mland:gap-0.5 min-w-0">
            <span
              title={roleLabel}
              className="inline-flex items-center gap-0.5 whitespace-nowrap shrink-0"
            >
              <PositionBadge role={roleLabel} size="xs" />
              {altRolesCount > 0 && (
                <span className={`text-[8px] mland:text-[6.5px] font-bold opacity-80 ${cardPalette.subText}`}>
                  +{altRolesCount}
                </span>
              )}
            </span>
            {onShirtClick ? (
              <button
                type="button"
                onClick={onShirtClick}
                title={shirtButtonTitle || 'สลับเบอร์เสื้อ'}
                className={`inline-flex items-center justify-center h-[16px] mland:h-[14px] px-1.5 mland:px-1 rounded-[4px] font-display text-[9px] mland:text-[7.5px] font-extrabold leading-none tracking-tight tabular cursor-pointer transition-colors shrink-0 whitespace-nowrap ${cardPalette.lockerBtn}`}
              >
                #{shirtNo} ▾
              </button>
            ) : (
              <span
                className={`inline-flex items-center justify-center h-[16px] mland:h-[14px] px-1.5 mland:px-1 rounded-[4px] border font-display text-[9px] mland:text-[7.5px] font-extrabold leading-none tracking-tight tabular shrink-0 whitespace-nowrap ${
                  isLight
                    ? 'bg-slate-200/80 border-slate-300/80 text-slate-700'
                    : 'bg-white/10 border-white/15 text-white/85'
                }`}
              >
                #{shirtNo}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
          {pot !== undefined && (
            <PotentialBadge pot={pot} variant="card" tone={cardTone} size="xs" className="h-[19px] mland:h-[16px]" />
          )}
          <TalentBadge talent={talent} variant="card" tone={cardTone} size="xs" className="h-[19px] mland:h-[16px]" />
          {actionNode}
        </div>
      </div>

      {/* Studio Spotlight Portrait Stage */}
      <div
        className={`relative mx-2.5 mb-1 mland:mx-1.5 mland:mb-0.5 rounded-xl mland:rounded-lg border flex flex-col justify-between overflow-hidden ${
          stretchStage ? 'flex-1 min-h-[104px] mland:min-h-[72px]' : 'min-h-[104px] mland:min-h-[72px]'
        } ${cardPalette.stageBox}`}
      >
        {/* Soft Studio Kit Radial Spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 58%, ${kit1}${isLight ? '26' : '38'} 0%, transparent 72%)`
          }}
        />

        {/* Clean Top Utility Row inside Stage (Zero collision with head) */}
        <div className="relative z-20 px-1.5 pt-1.5 mland:px-1 mland:pt-1 flex items-center justify-between gap-1 min-h-[24px] mland:min-h-[20px]">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {resolvedStageTopLeft}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {stageTopRightNode}
            <CardStudioToggleButton tone={cardTone} onToggle={toggleCardTone} />
          </div>
        </div>

        {/* Portrait & Corner Telemetry Container */}
        <div className="relative flex-1 flex items-end justify-center pt-0.5">
          {/* Bottom-Left Inside Portrait: Height, Weight, Preferred Foot Stacked Vertically */}
          <div
            className="absolute bottom-1.5 left-1.5 mland:bottom-1 mland:left-1 z-20 flex flex-col items-start gap-[2px] mland:gap-[1px] pointer-events-none select-none"
            title={`ส่วนสูง ${bio.heightCm} ซม. · น้ำหนัก ${bio.weightKg} กก. · ${footMeta.titleText}`}
          >
            <div className="inline-flex items-baseline gap-0.5 text-[8.5px] mland:text-[7px] leading-tight tabular whitespace-nowrap">
              <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-white/65'}`}>สูง</span>
              <span className={`font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>{bio.heightCm}</span>
              <span className={`text-[7.5px] mland:text-[6px] font-semibold ${isLight ? 'text-slate-600' : 'text-white/65'}`}>ซม.</span>
            </div>
            <div className="inline-flex items-baseline gap-0.5 text-[8.5px] mland:text-[7px] leading-tight tabular whitespace-nowrap">
              <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-white/65'}`}>หนัก</span>
              <span className={`font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>{bio.weightKg}</span>
              <span className={`text-[7.5px] mland:text-[6px] font-semibold ${isLight ? 'text-slate-600' : 'text-white/65'}`}>กก.</span>
            </div>
            <div className="inline-flex items-center gap-1 text-[8.5px] mland:text-[7px] leading-tight font-extrabold whitespace-nowrap">
              <FootPairIcon foot={bio.foot} size="xs" className="!w-[13px] !h-[10px] mland:!w-[11px] mland:!h-[8.5px]" />
              <span className={isLight ? 'text-emerald-700' : 'text-emerald-300'}>{footMeta.shortLabel}</span>
            </div>
          </div>

          {/* Centered Player Portrait */}
          <div
            className={`relative z-10 [&>svg]:block ${
              stretchStage
                ? '[&>svg]:w-[76px] [&>svg]:h-[82px] sm:[&>svg]:w-[88px] sm:[&>svg]:h-[94px] mland:[&>svg]:w-[48px] mland:[&>svg]:h-[52px]'
                : '[&>svg]:w-[62px] [&>svg]:h-[66px] mland:[&>svg]:w-[42px] mland:[&>svg]:h-[44px]'
            }`}
          >
            <PlayerFace
              {...faceProps}
              isGK={isCardGK}
              kitColor={cardShirtKit}
              trimColor={cardShirtTrim}
              size={stretchStage ? 88 : 64}
              bare
            />
          </div>

          {/* Bottom-Right Inside Portrait: Yellow Card, Red Card, Injury Stacked Vertically */}
          <div
            className="absolute bottom-1.5 right-1.5 mland:bottom-1 mland:right-1 z-20 flex flex-col items-end gap-[2px] mland:gap-[1px] pointer-events-none select-none"
            title={`ใบเหลือง ${ycCount}/3 · ใบแดง ${rcCount} · บาดเจ็บ ${injCount > 0 ? `${injCount} นัด` : 'ไม่มี'}`}
          >
            <div className="inline-flex items-center justify-end gap-1 text-[8.5px] mland:text-[7px] leading-none tabular whitespace-nowrap">
              <span
                className={`font-extrabold ${
                  ycCount > 0
                    ? isLight
                      ? 'text-amber-700'
                      : 'text-amber-300'
                    : isLight
                      ? 'text-slate-700'
                      : 'text-white/75'
                }`}
              >
                {ycCount}/3
              </span>
              <span className="inline-flex items-center justify-center [&>span]:!w-[12px] [&>span]:!h-[12px] mland:[&>span]:!w-[10px] mland:[&>span]:!h-[10px] [&>span>svg]:!w-[12px] [&>span>svg]:!h-[12px] mland:[&>span>svg]:!w-[10px] mland:[&>span>svg]:!h-[10px]">
                <StatIconBadge kind="yellow" count={1} size="xs" />
              </span>
            </div>
            <div className="inline-flex items-center justify-end gap-1 text-[8.5px] mland:text-[7px] leading-none tabular whitespace-nowrap">
              <span
                className={`font-extrabold ${
                  rcCount > 0
                    ? isLight
                      ? 'text-rose-600'
                      : 'text-rose-400'
                    : isLight
                      ? 'text-slate-700'
                      : 'text-white/75'
                }`}
              >
                {rcCount}
              </span>
              <span className="inline-flex items-center justify-center [&>span]:!w-[12px] [&>span]:!h-[12px] mland:[&>span]:!w-[10px] mland:[&>span]:!h-[10px] [&>span>svg]:!w-[12px] [&>span>svg]:!h-[12px] mland:[&>span>svg]:!w-[10px] mland:[&>span>svg]:!h-[10px]">
                <StatIconBadge kind="red" count={1} size="xs" />
              </span>
            </div>
            <div className="inline-flex items-center justify-end gap-1 text-[8.5px] mland:text-[7px] leading-none tabular whitespace-nowrap">
              <span
                className={`font-extrabold ${
                  injCount > 0
                    ? isLight
                      ? 'text-rose-600'
                      : 'text-rose-400'
                    : isLight
                      ? 'text-slate-700'
                      : 'text-white/75'
                }`}
              >
                {injCount > 0 ? `${injCount} นัด` : '0'}
              </span>
              <span className="inline-flex items-center justify-center [&>span]:!w-[12px] [&>span]:!h-[12px] mland:[&>span]:!w-[10px] mland:[&>span]:!h-[10px] [&>span>svg]:!w-[12px] [&>span>svg]:!h-[12px] mland:[&>span>svg]:!w-[10px] mland:[&>span>svg]:!h-[10px]">
                <StatIconBadge kind="injury" count={1} size="xs" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Athlete Identity */}
      <div className="px-2.5 pt-0.5 pb-1.5 mland:px-2 mland:pt-0 mland:pb-1 text-center space-y-0.5 shrink-0">
        <div
          className={`flex items-center justify-center gap-1 min-w-0 font-display font-extrabold text-[13px] mland:text-[10.5px] leading-tight ${cardPalette.nameText}`}
        >
          {natMeta && (
            <span
              title={`สัญชาติ${natMeta.country} (${natMeta.code})`}
              aria-label={`สัญชาติ${natMeta.country}`}
              className="shrink-0 text-[12px] mland:text-[9.5px] leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
            >
              {natMeta.flag}
            </span>
          )}
          <span className="truncate">{name}</span>
        </div>
        <div
          className={`flex items-center justify-center gap-1 text-[9.5px] mland:text-[7.5px] tabular leading-tight min-w-0 ${cardPalette.metaText}`}
        >
          {clubCrest && (
            <span className="shrink-0 inline-flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5 mland:[&>svg]:w-3 mland:[&>svg]:h-3">
              {clubCrest}
            </span>
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      </div>

      {/* Bottom Status Category Boxes Strip (6 categories outfield / 4 categories GK) */}
      <div
        className={`px-1.5 py-1.5 mland:px-1 mland:py-1 grid ${
          categories.length >= 6
            ? 'grid-cols-6 gap-[3px] sm:gap-1 mland:gap-[2px]'
            : categories.length === 5
              ? 'grid-cols-5 gap-1 mland:gap-0.5'
              : 'grid-cols-4 gap-1 mland:gap-0.5'
        } text-center shrink-0 ${cardPalette.statsWrap}`}
      >
        {categories.map((cat) => {
          const val = cat.value;
          const activeBoost = Math.max(0, Math.round(boost || 0));
          const baseVal = Math.max(1, val - activeBoost);
          const tier = statTierMeta(val);
          const scaleMax = Math.max(100, val);
          const basePct = clamp(Math.round((baseVal / scaleMax) * 100), 8, 100);
          const totalPct = clamp(Math.round((val / scaleMax) * 100), basePct, 100);
          const boostPct = activeBoost > 0 ? Math.max(5, totalPct - basePct) : 0;
          const adjustedBasePct = boostPct > 0 ? Math.max(5, totalPct - boostPct) : basePct;
          return (
            <div
              key={cat.key}
              title={activeBoost > 0 ? `${cat.fullLabel}: พื้นฐาน ${baseVal} + ลูกรัก ${activeBoost} = ${val}` : `${cat.fullLabel}: ${val}`}
              className={`rounded-lg py-0.5 px-[2px] space-y-0.5 min-w-0 transition-colors ${
                activeBoost > 0 ? cardPalette.statCellBoosted : cardPalette.statCell
              }`}
            >
              <div
                className={`text-[7.5px] sm:text-[8px] mland:text-[6px] font-bold tracking-tight leading-tight truncate ${cardPalette.statLabel}`}
              >
                {cat.shortLabel}
              </div>
              <div
                className={`inline-flex items-baseline justify-center gap-[1px] font-display tabular leading-tight whitespace-nowrap ${
                  activeBoost > 0 ? 'text-[10px] mland:text-[7.5px]' : 'text-[11px] mland:text-[8.5px]'
                } font-extrabold ${
                  isLight ? tier.textClass : tier.darkTextClass
                }`}
              >
                <span>{val}</span>
                {activeBoost > 0 && (
                  <span className={`text-[7.5px] mland:text-[5.5px] font-black ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    +{activeBoost}
                  </span>
                )}
              </div>
              <div
                className={`h-1.5 mland:h-1 rounded-full overflow-hidden mx-[2px] flex items-stretch ${cardPalette.statTrack}`}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${adjustedBasePct}%`,
                    background: statBarColor(baseVal),
                    borderRadius: boostPct > 0 ? '9999px 0 0 9999px' : '9999px'
                  }}
                />
                {boostPct > 0 && (
                  <div
                    className="h-full rounded-r-full transition-all"
                    style={{
                      width: `${boostPct}%`,
                      background: 'linear-gradient(90deg, #f43f5e, #fb7185)'
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
