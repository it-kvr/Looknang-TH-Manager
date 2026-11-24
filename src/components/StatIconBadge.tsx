import React from 'react';

export type StatIconKind = 'goal' | 'assist' | 'yellow' | 'red' | 'subIn' | 'subOut' | 'save';

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
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <circle cx="10" cy="10" r="8.8" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
          {showNum ? (
            <>
              <path
                d="M10 1.4 L12.3 3.4 M10 1.4 L7.7 3.4 M18.6 10 L16.5 11.9 M18.6 10 L16.5 8.1 M1.4 10 L3.5 11.9 M1.4 10 L3.5 8.1 M10 18.6 L12.3 16.6 M10 18.6 L7.7 16.6"
                stroke="#334155"
                strokeWidth="1.15"
                strokeLinecap="round"
                opacity="0.72"
              />
              <text
                x="10"
                y="10.6"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a"
                fontSize={numFont}
                fontWeight="900"
                fontFamily="Kanit, Sarabun, system-ui, sans-serif"
              >
                {numText}
              </text>
            </>
          ) : (
            <>
              <polygon points="10,5.8 13.6,8.4 12.2,12.6 7.8,12.6 6.4,8.4" fill="#0f172a" />
              <path
                d="M10 1.4 V5.8 M13.6 8.4 L17.9 7.1 M12.2 12.6 L15.2 16.5 M7.8 12.6 L4.8 16.5 M6.4 8.4 L2.1 7.1"
                stroke="#0f172a"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </span>
    );
  }

  if (kind === 'assist') {
    return (
      <span
        title={title || (n > 1 ? `แอสซิสต์ ${n} ครั้ง` : 'แอสซิสต์')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <circle cx="10" cy="10" r="8.8" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.35" />
          {showNum ? (
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
          ) : (
            <path
              d="M5.5 13.2 C7.8 10.5 9.8 9.2 13.8 7.5 M11.2 5.8 L14.4 7.3 L12.8 10.5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
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
          <rect x="4" y="2" width="12" height="16" rx="2.4" fill="#facc15" stroke="#422006" strokeWidth="1.4" />
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

  if (kind === 'red') {
    return (
      <span
        title={title || (n > 1 ? `ใบแดง ${n} ใบ` : 'ใบแดง')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <rect x="4" y="2" width="12" height="16" rx="2.4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.25" />
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

  if (kind === 'save') {
    return (
      <span
        title={title || (n > 1 ? `คลีนชีต/เซฟ ${n}` : 'คลีนชีต')}
        className="inline-flex items-center justify-center shrink-0 select-none leading-none align-middle"
        style={{ width: px, height: px }}
      >
        <svg viewBox="0 0 20 20" width={px} height={px} aria-hidden="true">
          <path
            d="M10 1.8 L17 4.6 V10.2 C17 14.3 13.9 17.2 10 18.6 C6.1 17.2 3 14.3 3 10.2 V4.6 Z"
            fill="#0d9488"
            stroke="#ccfbf1"
            strokeWidth="1.35"
          />
          {showNum ? (
            <text
              x="10"
              y="10.6"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={numFont - 0.4}
              fontWeight="900"
              fontFamily="Kanit, Sarabun, system-ui, sans-serif"
            >
              {numText}
            </text>
          ) : (
            <path
              d="M6.8 10.2 L9 12.4 L13.4 7.8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
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
