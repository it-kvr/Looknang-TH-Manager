import React from 'react';

interface TransferMarketIconProps {
  size?: number;
  className?: string;
  title?: string;
}

export const TransferMarketIcon: React.FC<TransferMarketIconProps> = ({
  size = 18,
  className = '',
  title
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    className={`inline-block shrink-0 align-middle select-none ${className}`}
  >
    {title && <title>{title}</title>}
    {/* Football Jersey (Center) */}
    <path
      d="M8.6 5.2L5.1 7.7L7.1 10.7L8.6 9.6V18.7H15.4V9.6L16.9 10.7L18.9 7.7L15.4 5.2C14.3 6.5 9.7 6.5 8.6 5.2Z"
      fill="#f8fafc"
      stroke="#0f172a"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    {/* Emerald Club Vertical Stripe & Collar */}
    <path d="M10.7 6.4H13.3V18.1H10.7V6.4Z" fill="#16a34a" />
    <path
      d="M9.4 5.5C10.5 7 13.5 7 14.6 5.5"
      stroke="#0f172a"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    {/* Top-Right Incoming Transfer Arrow (Gold) */}
    <path
      d="M12.4 3.3H17.8V1.4L22.5 4.3L17.8 7.2V5.3H12.4V3.3Z"
      fill="#facc15"
      stroke="#422006"
      strokeWidth="1.15"
      strokeLinejoin="round"
    />
    {/* Bottom-Left Outgoing Transfer Arrow (Sky Blue) */}
    <path
      d="M11.6 20.7H6.2V22.6L1.5 19.7L6.2 16.8V18.7H11.6V20.7Z"
      fill="#38bdf8"
      stroke="#0c4a6e"
      strokeWidth="1.15"
      strokeLinejoin="round"
    />
  </svg>
);
