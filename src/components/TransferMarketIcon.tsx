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
  <span
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    title={title}
    style={{ fontSize: Math.max(11, Math.round(size * 0.9)), lineHeight: 1 }}
    className={`inline-flex items-center justify-center shrink-0 align-middle select-none leading-none ${className}`}
  >
    ✍🏻
  </span>
);
