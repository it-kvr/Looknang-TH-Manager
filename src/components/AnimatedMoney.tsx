import { useEffect, useRef, useState } from 'react';
import { fmtMoney } from '../utils/math';

export interface MoneyDeltaState {
  key: number;
  amount: number;
}

export interface AnimatedMoneyProps {
  value: number;
  resetKey?: string | number;
  className?: string;
  deltaPlacement?: 'below' | 'above' | 'inline' | 'none';
  deltaClassName?: string;
  onDeltaChange?: (delta: MoneyDeltaState | null) => void;
}

export function MoneyDeltaPill({
  delta,
  placement = 'inline',
  className = ''
}: {
  delta: MoneyDeltaState | null;
  placement?: 'below' | 'above' | 'inline';
  className?: string;
}) {
  if (!delta || Math.abs(delta.amount) < 0.05) return null;
  const isGain = delta.amount > 0;
  const label = isGain ? `+${fmtMoney(delta.amount)}` : fmtMoney(delta.amount);
  const animCls = isGain ? 'money-delta-gain' : 'money-delta-loss';
  const toneCls = isGain
    ? 'bg-emerald-600 text-white border-emerald-300/65 dark:bg-emerald-500 dark:text-[#031a0d] dark:border-emerald-200/55'
    : 'bg-rose-600 text-white border-rose-300/65 dark:bg-rose-500 dark:text-white dark:border-rose-200/50';

  const posCls =
    placement === 'below'
      ? 'pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50'
      : placement === 'above'
        ? 'pointer-events-none absolute bottom-full left-0 mb-1 z-50'
        : 'pointer-events-none inline-flex ml-1.5 align-middle';

  return (
    <span
      key={delta.key}
      aria-live="polite"
      className={`${posCls} items-center gap-0.5 px-1.5 py-[2px] rounded-md border text-[10px] mland:text-[8.5px] font-extrabold tabular leading-none whitespace-nowrap shadow-sm ${toneCls} ${animCls} ${className}`}
    >
      <span aria-hidden="true" className="text-[8px] mland:text-[7px] leading-none opacity-90">
        {isGain ? '▲' : '▼'}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function AnimatedMoney({
  value,
  resetKey,
  className = '',
  deltaPlacement = 'inline',
  deltaClassName = '',
  onDeltaChange
}: AnimatedMoneyProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const committedRef = useRef<number>(value);
  const displayRef = useRef<number>(value);
  const resetKeyRef = useRef<string | number | undefined>(resetKey);
  const seqRef = useRef<number>(0);
  const onDeltaRef = useRef(onDeltaChange);
  onDeltaRef.current = onDeltaChange;

  const [delta, setDelta] = useState<MoneyDeltaState | null>(null);

  useEffect(() => {
    let rafId = 0;
    let clearTimer = 0;

    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      committedRef.current = value;
      displayRef.current = value;
      if (textRef.current) textRef.current.textContent = fmtMoney(value);
      setDelta(null);
      onDeltaRef.current?.(null);
      return;
    }

    const diff = value - committedRef.current;
    committedRef.current = value;

    if (Math.abs(diff) < 0.05) {
      displayRef.current = value;
      if (textRef.current) textRef.current.textContent = fmtMoney(value);
      return;
    }

    const nextDelta: MoneyDeltaState = {
      key: ++seqRef.current,
      amount: diff
    };
    setDelta(nextDelta);
    onDeltaRef.current?.(nextDelta);

    clearTimer = window.setTimeout(() => {
      setDelta((cur) => (cur?.key === nextDelta.key ? null : cur));
      onDeltaRef.current?.(null);
    }, 1550);

    const el = textRef.current;
    const isReduced =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const isVisible = Boolean(el && el.getClientRects().length > 0);

    if (!el || isReduced || !isVisible) {
      displayRef.current = value;
      if (el) el.textContent = fmtMoney(value);
      return () => {
        window.clearTimeout(clearTimer);
      };
    }

    const startVal = displayRef.current;
    const durationMs = 420;
    const startTs = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = t >= 1 ? value : startVal + (value - startVal) * eased;
      displayRef.current = cur;
      if (textRef.current) {
        textRef.current.textContent = fmtMoney(cur);
      }
      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.clearTimeout(clearTimer);
    };
  }, [value, resetKey]);

  const popCls = delta
    ? delta.amount > 0
      ? 'money-val-pop-gain text-[#158049] dark:text-[#4ade80]'
      : 'money-val-pop-loss text-[#dc2626] dark:text-[#f87171]'
    : '';

  return (
    <span className={`relative inline-flex items-center tabular ${className}`}>
      <span
        key={delta ? `v-${delta.key}` : 'v-idle'}
        ref={textRef}
        className={`inline-block will-change-transform ${popCls}`}
      >
        {fmtMoney(value)}
      </span>
      {deltaPlacement !== 'none' && (
        <MoneyDeltaPill delta={delta} placement={deltaPlacement} className={deltaClassName} />
      )}
    </span>
  );
}
