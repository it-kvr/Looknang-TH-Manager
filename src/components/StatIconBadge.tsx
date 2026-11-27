import React from 'react';

export type StatIconKind = 'goal' | 'assist' | 'yellow' | 'red' | 'yellowRed' | 'subIn' | 'subOut' | 'save' | 'cleansheet' | 'injury';

interface StatIconBadgeProps {
  kind: StatIconKind;
  count?: number;
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
  title?: string;
  alwaysShowCount?: boolean;
}

const SIZE_PX: Record<'2xs' | 'xs' | 'sm' | 'md' | 'lg', number> = {
  '2xs': 10,
  xs: 13,
  sm: 16,
  md: 20,
  lg: 24
};

export const StatIconBadge: React.FC<StatIconBadgeProps> = ({
  kind,
  count = 1,
  size = 'sm',
  title,
  alwaysShowCount = false
}) => {
  const px = SIZE_PX[size];
  const n = Math.max(0, Math.round(count));
  const showNum = alwaysShowCount ? true : n > 1;
  const numText = n > 99 ? '99' : String(n);
  const numFont = n >= 10 ? 8.6 : 11.2;

  if (kind === 'goal') {
    return (
      <span
        title={title || (n > 1 ? `ทำประตู ${n} ลูก` : 'ทำประตู')}
        className="inline-flex items-center justify-center gap-0.5 shrink-0 select-none leading-none align-middle tabular bg-transparent"
        style={{ minHeight: px, fontSize: Math.max(10, Math.round(px * 0.78)) }}
      >
        {showNum && <span className="font-extrabold tracking-tight">{numText}</span>}
        <span
          aria-hidden="true"
          className="shrink-0 leading-none"
          style={{ fontSize: Math.round(px * 0.92), lineHeight: 1 }}
        >
          ⚽
        </span>
      </span>
    );
  }

  if (kind === 'assist') {
    return (
      <span
        title={title || (n > 1 ? `👟 ${n}` : '👟')}
        className="inline-flex items-center justify-center gap-0.5 shrink-0 select-none leading-none align-middle tabular bg-transparent"
        style={{ minHeight: px, fontSize: Math.max(10, Math.round(px * 0.78)) }}
      >
        {showNum && <span className="font-extrabold tracking-tight">{numText}</span>}
        <span
          aria-hidden="true"
          className="shrink-0 leading-none"
          style={{ fontSize: Math.round(px * 0.92), lineHeight: 1 }}
        >
          👟
        </span>
      </span>
    );
  }

  if (kind === 'yellow') {
    return (
      <span
        title={title || (n > 1 ? `ใบเหลือง ${n} ใบ` : 'ใบเหลือง')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <rect x="3.8" y="1.8" width="12.4" height="16.4" rx="2.5" fill="#facc15" stroke="#000000" strokeWidth="1.5" />
          <rect x="5.4" y="3.2" width="3.0" height="10.5" rx="1" fill="#fef08a" opacity={showNum ? 0.25 : 0.5} />
          {showNum && (
            <text
              x="10"
              y="10.4"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#111827"
              fontSize={numFont}
              fontWeight="900"
              fontFamily="Kanit, Sarabun, system-ui, sans-serif"
            >
              {numText}
            </text>
          )}
        </svg>
      </span>
    );
  }

  if (kind === 'yellowRed') {
    return (
      <span
        title={title || 'ใบเหลืองที่ 2 (ใบแดง)'}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: Math.round(px * 1.12), height: px }}
      >
        <svg viewBox="0 0 22 20" width={Math.round(px * 1.12)} height={px} aria-hidden="true">
          <rect x="2.0" y="1.5" width="9.8" height="13.6" rx="2" fill="#facc15" stroke="#000000" strokeWidth="1.35" />
          <rect x="9.6" y="4.8" width="10.2" height="13.8" rx="2.1" fill="#ef4444" stroke="#000000" strokeWidth="1.4" />
          {showNum && (
            <text
              x="14.7"
              y="11.8"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth="0.6"
              paintOrder="stroke"
              fontSize={n >= 10 ? 7.4 : 9.2}
              fontWeight="900"
              fontFamily="Kanit, Sarabun, system-ui, sans-serif"
            >
              {numText}
            </text>
          )}
        </svg>
      </span>
    );
  }

  if (kind === 'red') {
    return (
      <span
        title={title || (n > 1 ? `ใบแดง ${n} ใบ` : 'ใบแดง')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <rect x="3.8" y="1.8" width="12.4" height="16.4" rx="2.5" fill="#ef4444" stroke="#000000" strokeWidth="1.5" />
          <rect x="5.4" y="3.2" width="3.0" height="10.5" rx="1" fill="#fca5a5" opacity={showNum ? 0.18 : 0.32} />
          {showNum && (
            <text
              x="10"
              y="10.4"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth="0.65"
              paintOrder="stroke"
              fontSize={numFont}
              fontWeight="900"
              fontFamily="Kanit, Sarabun, system-ui, sans-serif"
            >
              {numText}
            </text>
          )}
        </svg>
      </span>
    );
  }

  if (kind === 'injury') {
    return (
      <span
        title={title || (n > 1 ? `บาดเจ็บ ${n} นัด` : 'บาดเจ็บ')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <circle cx="10" cy="10" r="8.8" fill="#ffffff" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="8.2" y="4.5" width="3.6" height="11" rx="1" fill="#ef4444" />
          <rect x="4.5" y="8.2" width="11" height="3.6" rx="1" fill="#ef4444" />
        </svg>
      </span>
    );
  }

  if (kind === 'cleansheet') {
    return (
      <span
        title={title || (n > 1 ? `คลีนชีต ${n} นัด` : 'คลีนชีต')}
        className="inline-flex items-center justify-center gap-0.5 shrink-0 select-none leading-none align-middle tabular bg-transparent"
        style={{ minHeight: px, fontSize: Math.max(10, Math.round(px * 0.78)) }}
      >
        {showNum && <span className="font-extrabold tracking-tight">{numText}</span>}
        <span
          aria-hidden="true"
          className="shrink-0 leading-none"
          style={{ fontSize: Math.round(px * 0.92), lineHeight: 1 }}
        >
          🧤
        </span>
      </span>
    );
  }

  if (kind === 'save') {
    return (
      <span
        title={title || (n > 1 ? `เซฟ ${n} ครั้ง` : 'เซฟ')}
        className="inline-flex items-center justify-center gap-0.5 shrink-0 select-none leading-none align-middle tabular bg-transparent"
        style={{ minHeight: px, fontSize: Math.max(10, Math.round(px * 0.78)) }}
      >
        {showNum && <span className="font-extrabold tracking-tight">{numText}</span>}
        <span
          aria-hidden="true"
          className="shrink-0 leading-none"
          style={{ fontSize: Math.round(px * 0.92), lineHeight: 1 }}
        >
          👋🏻
        </span>
      </span>
    );
  }

  const isUp = kind === 'subIn';
  return (
    <span
      title={title || (isUp ? 'เปลี่ยนตัวลงสนาม' : 'ถูกเปลี่ยนตัวออก')}
      className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="8.8"
          fill={isUp ? '#10b981' : '#f43f5e'}
          stroke="#ffffff"
          strokeWidth="1.25"
        />
        {isUp ? (
          <path d="M10 5.5 L14.2 10.5 H11.6 V14.8 H8.4 V10.5 H5.8 Z" fill="#ffffff" />
        ) : (
          <path d="M10 14.5 L14.2 9.5 H11.6 V5.2 H8.4 V9.5 H5.8 Z" fill="#ffffff" />
        )}
      </svg>
    </span>
  );
};
