import React from 'react';

export type DeltaVariant = 'default' | 'inverted';

export function getDeltaToneClasses(sign: 'pos' | 'neg' | 'zero', variant: DeltaVariant = 'default', zeroClassName = 'text-[var(--mut)]'): string {
  if (sign === 'pos') {
    return variant === 'inverted'
      ? 'text-emerald-400 dark:text-[#158049] font-bold'
      : 'text-[var(--g)] font-bold';
  }
  if (sign === 'neg') {
    return variant === 'inverted'
      ? 'text-rose-400 dark:text-[#dc2626] font-bold'
      : 'text-[var(--red)] font-bold';
  }
  return zeroClassName;
}

interface DeltaValueProps {
  value: number;
  format?: (v: number) => string;
  prefix?: string;
  suffix?: string;
  showPlus?: boolean;
  invert?: boolean;
  variant?: DeltaVariant;
  zeroClassName?: string;
  className?: string;
}

export function DeltaValue({
  value,
  format,
  prefix = '',
  suffix = '',
  showPlus = true,
  invert = false,
  variant = 'default',
  zeroClassName = 'text-[var(--mut)]',
  className = '',
}: DeltaValueProps) {
  const effective = invert ? -value : value;
  const sign: 'pos' | 'neg' | 'zero' = effective > 0 ? 'pos' : effective < 0 ? 'neg' : 'zero';
  const tone = getDeltaToneClasses(sign, variant, zeroClassName);
  const formatted = format ? format(value) : `${value > 0 && showPlus ? '+' : ''}${value}`;
  return (
    <span className={`${tone} ${className}`.trim()}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

interface EffectTextProps {
  text: string;
  variant?: DeltaVariant;
  className?: string;
  positiveClassName?: string;
  negativeClassName?: string;
}

// Order matters: beneficial negative-looking perks first so "-1 นัด" in "หายเร็วขึ้น -1 นัด" stays green,
// followed by explicit gains, negative penalties/costs/alerts, and signed deltas.
const EFFECT_TOKEN_REGEX =
  /(หายเร็วขึ้น\s*-?\d+\s*นัด|หายเจ็บ[^·|\n]*?-\d+\s*นัด|ลดล้า(?:เดินทาง|ในสนาม)?(?:\s*-?\d+(?:\.\d+)?%?)?|ลด(?:โอกาส|เสี่ยง)?เจ็บ(?:\s*-?\d+%?)?|ลดวัน(?:พัก|เจ็บ)\s*-?\d+|ลดความกดดัน[^·|\n]*|ประหยัด(?:ค่าจ้าง|เงิน|งบ|ค่าใช้จ่าย)?(?:\s*[\d,.]+(?:k|m|ล\.|฿|%)?(?:\/นัด)?)?|ได้รับ(?:คืนค่าวัสดุ)?\s*\+?[\d,.]+(?:k|m|ล\.|%|฿)?|รับ(?:ค่าตัว|เงิน|โบนัส|รางวัล)?\s*\+[\d,.]+(?:k|m|ล\.|%|฿)?|เข้าคลับ\s*\+[^\s·|]+|ปลอดภัยเสมอ|ตอบรับคำเรียกร้องแล้ว|สภาพ(?:สมบูรณ์)?\s*100%|เพิ่มขึ้น|โตไว(?:\s*[\d.]+x)?|⚠️\s*ข้อเสีย:\s*[^|\n]+|เสี่ยง\s*-\d+(?:\.\.\-?\d+)?%?[^·|\n)]*|เสี่ยงล้า\/เจ็บสูง|เสี่ยงหลุดตัวจริง|ปฏิเสธ(?:ข้อเสนอ[^\s·|!]*|=[^·|\n]+)|ถอนข้อเสนอ[^\s·|!]*|งบติดลบ(?:\s*-?[\d,.]+(?:k|m|ล\.|฿)?)?|ติดลบ(?:\s*-?[\d,.]+(?:k|m|ล\.|฿)?)?|งบ(?:สโมสร)?ไม่พอ(?:\s*\([^)]+\)|[^\n·|])*|เงินไม่พอ[^\n·|]*|ไม่พอใจ[^\n·|]*|ไม่พอจ่าย[^\n·|)]*|ตลาดถูกระงับชั่วคราว|หนี้คงค้าง\s*[\d,.]+(?:k|m|ล\.|฿)?|ผ่อนปลายปี\s*[\d,.]+(?:k|m|ล\.|฿)?|ค่าชดเชย\s*-?[\d,.]+(?:k|m|ล\.|฿)?|บอร์ดกังวล(?:\s*\([^)]+\))?|ขวัญทีมต่ำ(?:\s*\([^)]+\))?|ค่าเหนื่อยใกล้เต็ม(?:\s*\([^)]+\))?|เกินเพดาน[^\s·|)]*|ตัวจริงไม่พร้อม\s*\d+\s*คน|ตัวจริงล้า(?:\s*\(ฟิต\s*\d+%\))?|ความฟิตเหลือ\s*\d+%|ล้าลง(?:เล็กน้อย)?|ล้า\s*\d+\s*คน|บาดเจ็บ(?:ระหว่างแข่ง)?(?:\s*พัก\s*\d+\s*นัด|\s*\d+\s*คน)?|ติดโทษ?แบน(?:\s*\d+\s*นัด)?|โดนใบแดง[^\s·|!]*|ใบเหลือง-แดง|หมดสัญญา(?:\s*\d+\s*คน)?|ถูกปลด[^\s·|]*|ถูกปรับ[^\n·|)]*|ถูกระงับ[^\n·|)]*|ถูกทำลาย|ขาดทุน[^\n·|)]*|ตกชั้น[^\n·|)]*|พลาดอัปพลัง|ไม่สำเร็จ|เสียความมั่นใจ[^·|\n]*|เสียจังหวะ[^·|\n]*|หัก\s*\d[\d,.]*(?:k|m|ล\.|%|฿)?|ค่าใช้จ่าย\s*-?\d[\d,.]*(?:k|m|ล\.|%|฿)?|ต้นทุน\s*-?\d[\d,.]*(?:k|m|ล\.|%|฿)?|\+\d[\d,.]*(?:\.\.\+?\d[\d,.]*|~\d[\d,.]*)?(?:k|m|ล\.|%|฿|★|\s*(?:นัด|OVR|คน))?(?:\/นัด)?|(?<![\d.\-+])-\d[\d,.]*(?:\.\.-?\d[\d,.]*)?(?:k|m|ล\.|%|฿|★|\s*(?:นัด|OVR|คน))?(?:\/นัด)?|ลดลง)/g;

const POSITIVE_MATCH_REGEX =
  /^(หายเร็วขึ้น|หายเจ็บ|ลดล้า|ลด(?:โอกาส|เสี่ยง)?เจ็บ|ลดวัน|ลดความกดดัน|ประหยัด|ได้รับ|รับ|เข้าคลับ|ปลอดภัยเสมอ|ตอบรับคำเรียกร้อง|สภาพ|เพิ่มขึ้น|โตไว|\+)/;

export function EffectText({
  text,
  variant = 'default',
  className = '',
  positiveClassName,
  negativeClassName,
}: EffectTextProps) {
  if (!text) return null;

  const posCls =
    positiveClassName ??
    (variant === 'inverted'
      ? 'text-emerald-400 dark:text-[#158049] font-bold'
      : 'text-[var(--g)] font-bold');
  const negCls =
    negativeClassName ??
    (variant === 'inverted'
      ? 'text-rose-400 dark:text-[#dc2626] font-bold'
      : 'text-[var(--red)] font-bold');

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  EFFECT_TOKEN_REGEX.lastIndex = 0;

  while ((match = EFFECT_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const isPos = POSITIVE_MATCH_REGEX.test(token);
    parts.push(
      <span key={`${match.index}-${token}`} className={isPos ? posCls : negCls}>
        {token}
      </span>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
