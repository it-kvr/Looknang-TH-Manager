import React from 'react';
import type { PlayerBio, StatCategorySummary } from '../engine/playerCore';
import { clamp } from '../utils/math';
import { statBarColor, statTierMeta } from '../engine/missions';
import { PlayerFace, resolveGkKitPalette } from './SvgVisuals';
import { TalentBadge } from './TalentBadge';
import { PotentialBadge } from './PotentialBadge';
import { PlayerBioStrip } from './PlayerBioStrip';
import {
  CardStudioToggleButton,
  getAthleteCardPalette,
  useCardStudioTone,
  type AthleteCardPalette,
  type CardStudioTone
} from './CardStudioTheme';

export interface AthleteCardProps {
  ov: number;
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
  clubCrest?: React.ReactNode;
  subtitle: string;
  bio: PlayerBio;
  categories: StatCategorySummary[];
  stretchStage?: boolean;
  className?: string;
}

export const AthleteCard: React.FC<AthleteCardProps> = ({
  ov,
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
  clubCrest,
  subtitle,
  bio,
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
      <div className="px-2.5 pt-1.5 pb-1 mland:px-2 mland:pt-1 mland:pb-0.5 flex items-center justify-between gap-1.5 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 mland:gap-1 leading-none min-w-0">
          <span
            className={`text-[18px] sm:text-[19px] mland:text-[14px] font-extrabold font-display tabular leading-none shrink-0 ${
              isLight ? statTierMeta(ov).textClass : statTierMeta(ov).darkTextClass
            }`}
          >
            {ov}
          </span>
          <span
            aria-hidden="true"
            className={`w-px h-3 mland:h-2.5 shrink-0 ${isLight ? 'bg-slate-300' : 'bg-white/20'}`}
          />
          <span
            title={roleLabel}
            className={`inline-flex items-baseline gap-0.5 text-[10px] mland:text-[8px] font-extrabold tracking-tight whitespace-nowrap shrink-0 ${cardPalette.subText}`}
          >
            <span>{roleLabel}</span>
            {altRolesCount > 0 && (
              <span className={`text-[8px] mland:text-[6.5px] font-bold opacity-75`}>
                +{altRolesCount}
              </span>
            )}
          </span>
          {onShirtClick ? (
            <button
              type="button"
              onClick={onShirtClick}
              title={shirtButtonTitle || 'สลับเบอร์เสื้อ'}
              className={`px-1 py-[1px] rounded text-[8.5px] mland:text-[7px] font-extrabold tabular cursor-pointer transition-colors shrink-0 whitespace-nowrap ${cardPalette.lockerBtn}`}
            >
              #{shirtNo} ▾
            </button>
          ) : (
            <span
              className={`text-[9.5px] mland:text-[7.5px] font-bold tabular shrink-0 whitespace-nowrap ${cardPalette.mutedText}`}
            >
              #{shirtNo}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 mland:gap-0.5 shrink-0">
          {pot !== undefined && (
            <PotentialBadge pot={pot} variant="card" tone={cardTone} size="xs" />
          )}
          <TalentBadge talent={talent} variant="card" tone={cardTone} size="xs" />
          {actionNode}
        </div>
      </div>

      {/* Neutral Studio Spotlight Portrait Stage */}
      <div
        className={`relative mx-2.5 mb-1 mland:mx-1.5 mland:mb-0.5 rounded-xl mland:rounded-lg border pt-3.5 mland:pt-2.5 flex items-end justify-center overflow-hidden ${
          stretchStage ? 'flex-1 min-h-[84px] mland:min-h-[56px]' : 'min-h-[88px] mland:min-h-[58px]'
        } ${cardPalette.stageBox}`}
      >
        {resolvedStageTopLeft && (
          <div className="absolute top-1.5 left-1.5 mland:top-1 mland:left-1 z-20 flex items-center gap-1 max-w-[calc(100%-64px)] min-w-0">
            {resolvedStageTopLeft}
          </div>
        )}
        <div className="absolute top-1.5 right-1.5 mland:top-1 mland:right-1 z-20 flex items-center gap-1">
          {stageTopRightNode}
          <CardStudioToggleButton tone={cardTone} onToggle={toggleCardTone} />
        </div>
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
      </div>

      {/* Athlete Identity + Compact Physical Bio Bar */}
      <div className="px-2.5 pb-1.5 mland:px-2 mland:pb-1 text-center space-y-1 mland:space-y-0.5 shrink-0">
        <div
          className={`font-display font-extrabold text-[13px] mland:text-[10.5px] truncate leading-tight ${cardPalette.nameText}`}
        >
          {name}
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
        <PlayerBioStrip bio={bio} variant="card" tone={cardTone} />
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
          const tier = statTierMeta(val);
          return (
            <div
              key={cat.key}
              title={`${cat.fullLabel}: ${val}`}
              className={`rounded-lg py-0.5 px-[2px] space-y-0.5 min-w-0 ${cardPalette.statCell}`}
            >
              <div
                className={`text-[7.5px] sm:text-[8px] mland:text-[6px] font-bold tracking-tight leading-tight truncate ${cardPalette.statLabel}`}
              >
                {cat.shortLabel}
              </div>
              <div
                className={`text-[11px] mland:text-[8.5px] font-extrabold font-display tabular leading-tight ${
                  isLight ? tier.textClass : tier.darkTextClass
                }`}
              >
                {val}
              </div>
              <div
                className={`h-1.5 mland:h-1 rounded-full overflow-hidden mx-[2px] ${cardPalette.statTrack}`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${clamp(val, 8, 100)}%`,
                    background: statBarColor(val)
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
