import React from 'react';
import type { PlayerBio, StatCategorySummary } from '../engine/playerCore';
import { clamp } from '../utils/math';
import { statBarColor, statTierMeta } from '../engine/missions';
import { PlayerFace } from './SvgVisuals';
import { TalentBadge } from './TalentBadge';
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
  shirtNo: number | string;
  onShirtClick?: () => void;
  shirtButtonTitle?: string;
  renderBadges?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  renderHeaderAction?: (palette: AthleteCardPalette, tone: CardStudioTone) => React.ReactNode;
  kit1: string;
  kit2: string;
  faceProps: Omit<React.ComponentProps<typeof PlayerFace>, 'size' | 'bare'>;
  name: string;
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
  shirtNo,
  onShirtClick,
  shirtButtonTitle,
  renderBadges,
  renderHeaderAction,
  kit1,
  kit2,
  faceProps,
  name,
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

      {/* Top Corner Header: OVR / Role #NO + POT / TL / Context Badges / Optional Action */}
      <div className="px-2.5 pt-1.5 pb-0.5 mland:px-2 mland:pt-1 mland:pb-0 flex items-start justify-between gap-1.5 shrink-0">
        <div className="leading-none min-w-0">
          <div
            className={`text-xl sm:text-[22px] mland:text-[15px] font-extrabold font-display tabular leading-none ${
              isLight ? statTierMeta(ov).textClass : statTierMeta(ov).darkTextClass
            }`}
          >
            {ov}
          </div>
          <div className="mt-0.5 flex items-center gap-1 leading-none min-w-0">
            <span
              className={`text-[9.5px] mland:text-[7.5px] font-bold tracking-wide truncate max-w-[88px] ${cardPalette.subText}`}
            >
              {roleLabel}
            </span>
            {onShirtClick ? (
              <button
                type="button"
                onClick={onShirtClick}
                title={shirtButtonTitle || 'สลับเบอร์เสื้อ'}
                className={`px-1.5 py-[1px] rounded text-[8.5px] mland:text-[7px] font-extrabold tabular cursor-pointer transition-colors shrink-0 ${cardPalette.lockerBtn}`}
              >
                #{shirtNo} ▾
              </button>
            ) : (
              <span
                className={`text-[9.5px] mland:text-[7.5px] font-bold tabular shrink-0 ${cardPalette.subText}`}
              >
                · #{shirtNo}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-1.5 mland:gap-1 min-w-0">
          <div className="flex flex-col items-end gap-0.5 min-w-0">
            <div className="flex items-center gap-1">
              {pot !== undefined && (
                <span
                  className={`text-[9.5px] mland:text-[7.5px] font-bold tabular ${
                    isLight ? statTierMeta(pot).textClass : statTierMeta(pot).darkTextClass
                  }`}
                >
                  POT {pot}
                </span>
              )}
              <TalentBadge talent={talent} variant="card" tone={cardTone} size="xs" />
            </div>
            {badgeNodes && (
              <div className="flex items-center justify-end gap-1 min-h-[14px] mland:min-h-[12px] max-w-full">
                {badgeNodes}
              </div>
            )}
          </div>
          {actionNode}
        </div>
      </div>

      {/* Neutral Studio Spotlight Portrait Stage */}
      <div
        className={`relative mx-2.5 my-1 mland:mx-1.5 mland:my-0.5 rounded-xl mland:rounded-lg border pt-1.5 mland:pt-1 flex items-end justify-center overflow-hidden ${
          stretchStage ? 'flex-1 min-h-[64px] mland:min-h-[42px]' : ''
        } ${cardPalette.stageBox}`}
      >
        <CardStudioToggleButton
          tone={cardTone}
          onToggle={toggleCardTone}
          className="absolute top-1 right-1 z-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: cardPalette.stageGlow }}
        />
        <div
          className={`relative z-10 ${
            stretchStage
              ? '[&>svg]:w-[76px] [&>svg]:h-[82px] sm:[&>svg]:w-[88px] sm:[&>svg]:h-[94px] mland:[&>svg]:w-[48px] mland:[&>svg]:h-[52px]'
              : '[&>svg]:w-[60px] [&>svg]:h-[64px] mland:[&>svg]:w-[40px] mland:[&>svg]:h-[42px]'
          }`}
        >
          <PlayerFace
            {...faceProps}
            kitColor={kit1}
            trimColor={kit2}
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
          className={`text-[9.5px] mland:text-[7.5px] truncate tabular leading-tight ${cardPalette.metaText}`}
        >
          {subtitle}
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
