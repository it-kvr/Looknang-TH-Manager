import React from 'react';

export type StatIconKind = 'goal' | 'assist' | 'yellow' | 'red' | 'yellowRed' | 'subIn' | 'subOut' | 'save' | 'cleansheet' | 'injury';

interface StatIconBadgeProps {
  kind: StatIconKind;
  count?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  title?: string;
}

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 13,
  sm: 16,
  md: 20,
  lg: 24
};

export const StatIconBadge: React.FC<StatIconBadgeProps> = ({
  kind,
  count = 1,
  size = 'sm',
  title
}) => {
  const px = SIZE_PX[size];
  const n = Math.max(0, Math.round(count));
  const showNum = n > 1;
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
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true" className="shrink-0">
          <circle cx="10" cy="10" r="8.6" fill="#ffffff" stroke="#0f172a" strokeWidth="1.25" />
          <polygon points="10,6.1 13.7,8.8 12.3,13.1 7.7,13.1 6.3,8.8" fill="#0f172a" />
          <line x1="10" y1="6.1" x2="10" y2="1.6" stroke="#0f172a" strokeWidth="1.05" />
          <line x1="13.7" y1="8.8" x2="17.9" y2="7.2" stroke="#0f172a" strokeWidth="1.05" />
          <line x1="12.3" y1="13.1" x2="15.1" y2="16.9" stroke="#0f172a" strokeWidth="1.05" />
          <line x1="7.7" y1="13.1" x2="4.9" y2="16.9" stroke="#0f172a" strokeWidth="1.05" />
          <line x1="6.3" y1="8.8" x2="2.1" y2="7.2" stroke="#0f172a" strokeWidth="1.05" />
          <polygon points="8.3,1.8 11.7,1.8 10,3.2" fill="#0f172a" />
          <polygon points="18.3,6.0 18.5,9.0 17.0,7.5" fill="#0f172a" />
          <polygon points="1.7,6.0 1.5,9.0 3.0,7.5" fill="#0f172a" />
          <polygon points="3.7,16.1 6.2,17.8 4.9,15.6" fill="#0f172a" />
          <polygon points="16.3,16.1 13.8,17.8 15.1,15.6" fill="#0f172a" />
        </svg>
      </span>
    );
  }

  if (kind === 'assist') {
    return (
      <span
        title={title || (n > 1 ? `แอสซิสต์ ${n} ครั้ง` : 'แอสซิสต์')}
        className="inline-flex items-center justify-center gap-0.5 shrink-0 select-none leading-none align-middle tabular bg-transparent"
        style={{ minHeight: px, fontSize: Math.max(10, Math.round(px * 0.78)) }}
      >
        {showNum && <span className="font-extrabold tracking-tight">{numText}</span>}
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true" className="shrink-0">
          <circle cx="10" cy="10" r="8.8" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.25" />
          <path
            d="M4.8 6.3 H8.2 L10.3 9.2 C12.1 9.6 14.3 10.2 15.2 11.3 C15.7 11.9 15.4 12.7 14.4 12.7 H4.7 Z"
            fill="#ffffff"
          />
          <rect x="5.1" y="12.7" width="1.8" height="1.7" rx="0.45" fill="#ffffff" />
          <rect x="9.1" y="12.7" width="1.8" height="1.7" rx="0.45" fill="#ffffff" />
          <rect x="13.0" y="12.7" width="1.8" height="1.7" rx="0.45" fill="#ffffff" />
        </svg>
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
          <rect x="3.8" y="1.8" width="12.4" height="16.4" rx="2.5" fill="#facc15" stroke="#713f12" strokeWidth="1.45" />
          <rect x="5.4" y="3.2" width="3.2" height="10.5" rx="1" fill="#fef08a" opacity="0.55" />
          {showNum && (
            <text
              x="10"
              y="10.6"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1c1917"
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
          <rect x="2.0" y="1.5" width="9.8" height="13.6" rx="2" fill="#facc15" stroke="#713f12" strokeWidth="1.25" />
          <rect x="9.6" y="4.8" width="10.2" height="13.8" rx="2.1" fill="#ef4444" stroke="#ffffff" strokeWidth="1.35" />
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
          <rect x="3.8" y="1.8" width="12.4" height="16.4" rx="2.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.35" />
          <rect x="5.4" y="3.2" width="3.0" height="10.5" rx="1" fill="#fca5a5" opacity="0.35" />
          {showNum && (
            <text
              x="10"
              y="10.6"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
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
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true" className="shrink-0">
          <path
            d="M10 1.5 L17.1 4.2 V9.6 C17.1 14.0 14.0 17.2 10 18.6 C6.0 17.2 2.9 14.0 2.9 9.6 V4.2 Z"
            fill="#d97706"
            stroke="#fef3c7"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M6.8 12.9 V9.1 C6.8 8.45 7.4 8.3 7.65 8.9 V7.45 C7.65 6.85 8.4 6.75 8.6 7.35 V6.4 C8.6 5.7 9.55 5.7 9.7 6.4 V7.1 C9.95 6.6 10.9 6.65 10.9 7.35 V8.3 C11.25 7.85 12.1 8.05 12.1 8.75 V10.9 L13.1 9.9 C13.6 9.45 14.2 10.05 13.75 10.65 L12.0 12.95 C11.55 13.55 10.9 13.85 10.0 13.85 H8.0 C7.3 13.85 6.8 13.45 6.8 12.9 Z"
            fill="#ffffff"
          />
        </svg>
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
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true" className="shrink-0">
          <circle cx="10" cy="10" r="8.8" fill="#0d9488" stroke="#ccfbf1" strokeWidth="1.25" />
          <path
            d="M6.4 13.5 V9.1 C6.4 8.3 7.1 8.1 7.4 8.8 V7.1 C7.4 6.4 8.3 6.3 8.5 7 V5.9 C8.5 5.1 9.6 5.1 9.8 5.9 V6.7 C10.1 6.1 11.2 6.2 11.2 7 V8.1 C11.6 7.6 12.6 7.8 12.6 8.6 V11.2 L13.8 10 C14.4 9.5 15.1 10.2 14.6 10.9 L12.5 13.6 C12 14.3 11.2 14.6 10.2 14.6 H7.8 C7 14.6 6.4 14.1 6.4 13.5 Z"
            fill="#ffffff"
          />
        </svg>
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
