export const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const P = <T,>(a: T[]): T => a[R(0, a.length - 1)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const MAX_CLUB_MONEY = 9_999_000;
export const capMoney = (kVal: number): number =>
  Math.min(MAX_CLUB_MONEY, Number.isFinite(kVal) ? kVal : 0);

export const fmtMoneyNum = (kVal: number): string => {
  const num = Number.isFinite(kVal) ? kVal : 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000) {
    const m = abs / 1000;
    const str = m >= 100 ? Math.round(m).toLocaleString() : Number(m.toFixed(m >= 10 ? 1 : 2)).toString();
    return `${sign}${str}m`;
  }
  const rounded = abs < 100 && Math.abs(abs - Math.round(abs)) >= 0.05 ? Number(abs.toFixed(1)).toString() : Math.round(abs).toLocaleString();
  return `${sign}${rounded}k`;
};

export const fmtMoney = (kVal: number): string => `${fmtMoneyNum(kVal)} ฿`;

