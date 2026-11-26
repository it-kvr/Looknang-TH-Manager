import React from 'react';
import type { FacilityKey, StadiumStyleId, StaffRoleKey } from '../types/game';
import { clamp } from '../utils/math';

export const getFacilityTierLabel = (lv: number): string => {
  if (lv <= 0) return 'ถูกทำลาย / รื้อถอนแล้ว';
  if (lv >= 9) return 'ระดับทวีป · เวิลด์คลาส';
  if (lv >= 6) return 'ระดับลีกสูงสุด';
  if (lv >= 3) return 'มาตรฐานสโมสรอาชีพ';
  return 'ระดับพื้นฐาน';
};

export const getStaffTierLabel = (lv: number): string => {
  if (lv >= 5) return 'ปรมาจารย์';
  if (lv >= 3) return 'มืออาชีพ';
  if (lv >= 1) return 'ประจำการ';
  return 'ยังไม่จ้าง';
};

export const getTravelTierLabel = (lv: number): string => {
  if (lv <= 0) return 'เดินทางตามมีตามเกิด';
  if (lv >= 9) return 'เครื่องบินเหมาลำ & ทีมทวีป';
  if (lv >= 6) return 'โค้ช VIP + โรงแรมแคมป์';
  if (lv >= 3) return 'รถบัสปรับอากาศสโมสร';
  return 'รถตู้ / มินิบัสทีม';
};

export const FacilityUpgradeSvg: React.FC<{
  kind: FacilityKey;
  level: number;
  condition?: number;
  stadiumStyle?: StadiumStyleId;
  c1?: string;
  c2?: string;
  className?: string;
}> = ({ kind, level, condition = 100, stadiumStyle = 'modern_bowl', c1 = '#177c45', c2 = '#f5c242', className = '' }) => {
  const lv = clamp(level, 0, 10);
  const destroyed = lv <= 0;
  const tier = lv >= 9 ? 4 : lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
  const needsRepair = !destroyed && condition < 75;
  const severelyDamaged = !destroyed && condition < 55;
  const styleTag = kind === 'st' ? stadiumStyle : 'std';
  const uid = `${kind}-${styleTag}-${lv}-${tier}-${destroyed ? 'r' : severelyDamaged ? 's' : needsRepair ? 'd' : 'ok'}`;

  return (
    <svg
      viewBox="0 0 120 76"
      className={`rounded-xl border ${
        destroyed
          ? 'border-[var(--red)]/55 bg-[#1a1512]'
          : needsRepair
            ? 'border-[#f59e0b]/60 bg-[#1a1610]'
            : 'border-[var(--line)]/80 bg-[#0b1f16]'
      } shrink-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={
              destroyed
                ? '#292524'
                : needsRepair
                  ? '#3f352c'
                  : tier === 4
                    ? '#0f172a'
                    : tier === 3
                      ? '#132a3a'
                      : tier === 2
                        ? '#1c4d6b'
                        : '#256380'
            }
          />
          <stop
            offset="100%"
            stopColor={destroyed ? '#44403c' : needsRepair ? '#524536' : tier >= 3 ? '#183f33' : '#225946'}
          />
        </linearGradient>
        <linearGradient id={`grass-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={destroyed ? '#57534e' : needsRepair ? '#5a5f2c' : '#166534'} />
          <stop offset="50%" stopColor={destroyed ? '#44403c' : needsRepair ? '#6e6a2e' : '#1e7d43'} />
          <stop offset="100%" stopColor={destroyed ? '#57534e' : needsRepair ? '#525627' : '#155e31'} />
        </linearGradient>
      </defs>

      {/* Sky & ground backdrop */}
      <rect width="120" height="76" fill={`url(#sky-${uid})`} />
      <rect y="52" width="120" height="24" fill={`url(#grass-${uid})`} />

      {/* Sun / night stars / overcast storm accent */}
      {destroyed || needsRepair ? (
        <g opacity="0.55">
          <ellipse cx="95" cy="14" rx="14" ry="5" fill="#78716c" />
          <ellipse cx="84" cy="15" rx="9" ry="4" fill="#57534e" />
          <ellipse cx="38" cy="18" rx="11" ry="4" fill="#78716c" opacity="0.6" />
        </g>
      ) : tier >= 4 ? (
        <g fill="#fef08a" opacity="0.85">
          <circle cx="18" cy="12" r="1.1" />
          <circle cx="34" cy="9" r="0.9" />
          <circle cx="88" cy="11" r="1.2" />
          <circle cx="104" cy="15" r="0.9" />
        </g>
      ) : (
        <circle cx="102" cy="14" r={tier === 1 ? 5 : 6} fill="#fde047" opacity={tier === 3 ? 0.45 : 0.8} />
      )}

      {/* DEMOLISHED / RUBBLE STATE (Lv.0) */}
      {destroyed && (
        <g>
          {/* Cracked foundation slab */}
          <polygon points="14,54 24,47 96,47 106,54" fill="#78716c" stroke="#292524" strokeWidth="1" />
          <path d="M36 48 L42 52 L50 50 L56 54" fill="none" stroke="#1c1917" strokeWidth="1.2" />
          <path d="M74 47 L70 51 L80 54" fill="none" stroke="#1c1917" strokeWidth="1.1" />

          {/* Broken pillar & exposed bent rebar */}
          <rect x="26" y="36" width="11" height="14" rx="1" fill="#57534e" stroke="#292524" strokeWidth="0.9" />
          <polygon points="26,36 31,32 37,37" fill="#44403c" />
          <path d="M29 34 L27 27 M33 35 L36 28" stroke="#94a3b8" strokeWidth="1.1" />

          {/* Collapsed roof beam & concrete rubble piles */}
          <polygon points="48,50 61,40 72,49 64,53 50,53" fill="#44403c" stroke="#1c1917" strokeWidth="0.9" />
          <rect x="76" y="42" width="14" height="8" rx="1" transform="rotate(-12 83 46)" fill="#57534e" stroke="#292524" strokeWidth="0.8" />
          <polygon points="36,56 42,50 47,55 43,58" fill="#a8a29e" />
          <polygon points="78,56 85,51 91,56 84,59" fill="#78716c" />
          <circle cx="67" cy="57" r="2.3" fill="#a8a29e" />
          <circle cx="52" cy="59" r="1.9" fill="#57534e" />

          {/* Construction hazard sawhorse barrier */}
          <g transform="translate(42, 54)">
            <line x1="3" y1="7" x2="6" y2="16" stroke="#9ca3af" strokeWidth="1.5" />
            <line x1="33" y1="7" x2="30" y2="16" stroke="#9ca3af" strokeWidth="1.5" />
            <rect x="0" y="2" width="36" height="6" rx="1" fill="#f59e0b" stroke="#1c1917" strokeWidth="0.8" />
            <polygon points="5,2 10,2 7,8 2,8" fill="#1c1917" />
            <polygon points="15,2 20,2 17,8 12,8" fill="#1c1917" />
            <polygon points="25,2 30,2 27,8 22,8" fill="#1c1917" />
          </g>
        </g>
      )}

      {/* Dry dirt patches on pitch/lawn when damaged */}
      {needsRepair && kind !== 'turfLv' && kind !== 'analyticsLv' && kind !== 'travelLv' && (
        <g opacity="0.72">
          <ellipse cx="28" cy="64" rx="13" ry="3.5" fill="#78350f" />
          <ellipse cx="89" cy="67" rx="15" ry="4" fill="#713f12" />
          <ellipse cx="62" cy="70" rx="10" ry="2.6" fill="#451a03" opacity="0.65" />
        </g>
      )}

      {/* 1. STADIUM (st) - 6 Distinct Architectural Styles */}
      {!destroyed && kind === 'st' && (
        <g>
          {/* Running track surround for open_track */}
          {stadiumStyle === 'open_track' && (
            <g>
              <path d="M8 76 Q60 47 112 76 L120 76 Q60 41 0 76 Z" fill="#b45309" opacity={needsRepair ? 0.45 : 0.78} />
              <path d="M14 76 Q60 50 106 76" fill="none" stroke="#fef3c7" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.65" />
              {/* Main single covered grandstand + side open bleachers */}
              <path d="M22 52 L27 33 L93 33 L98 52 Z" fill="#334155" stroke="#94a3b8" strokeWidth="0.9" />
              <rect x="29" y="38" width="62" height={tier >= 3 ? 9 : 6} rx="1.2" fill={c1} opacity={needsRepair ? 0.52 : 0.92} />
              <path d="M24 33 L32 25 L88 25 L96 33 Z" fill={needsRepair ? '#64748b' : '#cbd5e1'} />
              <rect x="47" y="21" width="26" height="5" rx="1" fill="#0f172a" stroke={c2} strokeWidth="0.9" />
              {tier >= 2 && (
                <g stroke="#cbd5e1" strokeWidth="1.6">
                  <line x1="15" y1="53" x2="17" y2={tier >= 3 ? 17 : 23} />
                  <line x1="105" y1="53" x2="103" y2={tier >= 3 ? 17 : 23} />
                  <rect x="12" y={tier >= 3 ? 13 : 19} width="9" height="4.5" rx="1" fill="#fef08a" stroke="none" />
                  <rect x="99" y={tier >= 3 ? 13 : 19} width="9" height="4.5" rx="1" fill="#fef08a" stroke="none" />
                </g>
              )}
            </g>
          )}

          {/* Thai Heritage Arena (ทรงไทยประยุกต์) */}
          {stadiumStyle === 'thai_heritage' && (
            <g>
              <path d="M14 54 L20 31 L100 31 L106 54 Z" fill="#292524" stroke="#f59e0b" strokeWidth="0.9" />
              <rect x="22" y="37" width="76" height="7" rx="1.5" fill={c1} opacity={needsRepair ? 0.55 : 0.95} />
              <rect x="24" y="45" width="72" height="5" rx="1" fill={c2} opacity={needsRepair ? 0.5 : 0.85} />
              {/* Tiered Thai gable roofs (จั่วซ้อนชั้น) */}
              <polygon points="10,32 34,21 58,32" fill="#991b1b" stroke="#fbbf24" strokeWidth="1" />
              <polygon points="62,32 86,21 110,32" fill="#991b1b" stroke="#fbbf24" strokeWidth="1" />
              <polygon points="34,30 60,13 86,30" fill="#b91c1c" stroke="#fde047" strokeWidth="1.2" />
              {/* Golden spire / gable apex */}
              <path d="M58 14 L60 7 L62 14 Z" fill="#fde047" />
              <path d="M33 21 L34 16 L35 21 Z M85 21 L86 16 L87 21 Z" fill="#fbbf24" />
              <rect x="49" y="23" width="22" height="5" rx="1" fill="#1c1917" stroke="#fbbf24" strokeWidth="0.8" />
              {tier >= 3 && (
                <g stroke="#fde047" strokeWidth="1.3">
                  <line x1="12" y1="53" x2="13" y2="17" />
                  <line x1="108" y1="53" x2="107" y2="17" />
                  <circle cx="13" cy="16" r="2.5" fill="#fef08a" stroke="none" />
                  <circle cx="107" cy="16" r="2.5" fill="#fef08a" stroke="none" />
                </g>
              )}
            </g>
          )}

          {/* Fortress Kop (ป้อมปราการหลังโกล - steep vertical walls close to pitch) */}
          {stadiumStyle === 'fortress_kop' && (
            <g>
              {/* Steep towering twin-wall stands */}
              <path d="M12 54 L14 22 L106 22 L108 54 Z" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
              <rect x="17" y="25" width="86" height="9" rx="1" fill={c1} opacity={needsRepair ? 0.55 : 1} />
              <rect x="17" y="36" width="86" height="9" rx="1" fill={c2} opacity={needsRepair ? 0.5 : 0.92} />
              <rect x="17" y="47" width="86" height="5" rx="0.5" fill={c1} opacity="0.85" />
              {/* Vertical steel roof truss & floodlight gantries */}
              <rect x="10" y="18" width="100" height="5" rx="1" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
              <path d="M18 18 L24 12 L96 12 L102 18" fill="none" stroke={c2} strokeWidth="1.4" />
              <rect x="16" y="10" width="12" height="4" rx="0.8" fill="#fef08a" />
              <rect x="92" y="10" width="12" height="4" rx="0.8" fill="#fef08a" />
              {tier >= 3 && (
                <rect x="44" y="13" width="32" height="5.5" rx="1" fill="#020617" stroke={c2} strokeWidth="0.9" />
              )}
            </g>
          )}

          {/* Glass Pavilion (พาวิลเลียนกระจกพรีเมียม) */}
          {stadiumStyle === 'glass_pavilion' && (
            <g>
              <path d="M14 54 L20 29 L100 29 L106 54 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.9" />
              <rect x="22" y="34" width="76" height="7" rx="1.5" fill={c1} opacity={needsRepair ? 0.5 : 0.92} />
              {/* Translucent glass VIP hospitality suite deck */}
              <rect x="26" y="42" width="68" height="7" rx="1.5" fill="#bae6fd" opacity="0.72" stroke="#38bdf8" strokeWidth="0.8" />
              <line x1="40" y1="42" x2="40" y2="49" stroke="#0284c7" strokeWidth="0.7" />
              <line x1="60" y1="42" x2="60" y2="49" stroke="#0284c7" strokeWidth="0.7" />
              <line x1="80" y1="42" x2="80" y2="49" stroke="#0284c7" strokeWidth="0.7" />
              {/* Sleek cantilevered glass roof */}
              <path d="M8 28 Q60 15 112 24 L104 31 Q60 24 16 31 Z" fill="#7dd3fc" opacity="0.65" stroke="#e0f2fe" strokeWidth="1.2" />
              <path d="M22 26 L28 21 M45 23 L49 19 M72 23 L75 19 M95 25 L98 21" stroke="#f8fafc" strokeWidth="0.9" opacity="0.8" />
              <rect x="46" y="21" width="28" height="5" rx="1.5" fill="#0f172a" stroke={c2} strokeWidth="0.9" />
            </g>
          )}

          {/* Cyber Dome (เมกะโดมหลังคาคลุม) */}
          {stadiumStyle === 'cyber_dome' && (
            <g>
              {/* Enclosed geodesic arena dome */}
              <path d="M6 54 Q6 10 60 10 Q114 10 114 54 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
              <path d="M12 52 Q16 18 60 18 Q104 18 108 52 Z" fill="#1e293b" stroke={c2} strokeWidth="0.9" />
              {/* Glowing skylight oculus + radial dome ribs */}
              <ellipse cx="60" cy="18" rx="22" ry="5" fill="#38bdf8" opacity="0.28" stroke="#7dd3fc" strokeWidth="1" />
              <path d="M60 13 L60 32 M36 16 L28 34 M84 16 L92 34" stroke="#475569" strokeWidth="0.9" />
              {/* LED wraparound ribbon & tiered club bowl */}
              <rect x="15" y="34" width="90" height="7" rx="2" fill={c1} opacity={needsRepair ? 0.55 : 1} />
              <rect x="18" y="43" width="84" height="6" rx="2" fill={c2} opacity={needsRepair ? 0.5 : 0.9} />
              <rect x="14" y="31" width="92" height="2.4" rx="1" fill={needsRepair ? '#ef4444' : '#38bdf8'} />
              <rect x="42" y="21" width="36" height="6" rx="1.5" fill="#020617" stroke="#38bdf8" strokeWidth="1" />
              <rect x="46" y="23" width="28" height="2.2" rx="1" fill={needsRepair ? '#f59e0b' : '#4ade80'} />
            </g>
          )}

          {/* Modern Bowl 360° (default / modern_bowl) */}
          {(stadiumStyle === 'modern_bowl' || !['open_track', 'thai_heritage', 'fortress_kop', 'glass_pavilion', 'cyber_dome'].includes(stadiumStyle)) && (
            <g>
              {tier >= 2 && (
                <g stroke={needsRepair ? '#94a3b8' : '#cbd5e1'} strokeWidth="1.8">
                  <line
                    x1="16"
                    y1="52"
                    x2={needsRepair ? 13 : 18}
                    y2={tier >= 3 ? (needsRepair ? 21 : 16) : needsRepair ? 27 : 24}
                  />
                  <line x1="104" y1="52" x2="102" y2={tier >= 3 ? 16 : 24} />
                  <rect
                    x={needsRepair ? 8 : 13}
                    y={tier >= 3 ? (needsRepair ? 17 : 12) : needsRepair ? 23 : 20}
                    width="10"
                    height="5"
                    rx="1"
                    transform={needsRepair ? 'rotate(-16 13 20)' : undefined}
                    fill={needsRepair ? '#334155' : '#fef08a'}
                    stroke="none"
                  />
                  <rect
                    x="97"
                    y={tier >= 3 ? 12 : 20}
                    width="10"
                    height="5"
                    rx="1"
                    fill={needsRepair ? '#94a3b8' : '#fef08a'}
                    stroke="none"
                  />
                </g>
              )}
              {tier === 1 && (
                <g>
                  <rect x="22" y="38" width="76" height="15" rx="4" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                  <rect x="26" y="42" width="68" height="4" fill={c1} opacity={needsRepair ? 0.55 : 1} />
                  <rect x="24" y="33" width="72" height="5" rx="2" fill={c2} opacity={needsRepair ? 0.55 : 1} />
                </g>
              )}
              {tier === 2 && (
                <g>
                  <path d="M16 53 L22 31 L98 31 L104 53 Z" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="24" y="36" width="72" height="11" rx="2" fill={c1} opacity={needsRepair ? 0.5 : 0.9} />
                  <path
                    d={needsRepair ? 'M20 32 L54 26 M62 27 L100 32' : 'M18 31 Q60 21 102 31'}
                    fill="none"
                    stroke={needsRepair ? '#94a3b8' : '#e2e8f0'}
                    strokeWidth="2.6"
                  />
                  <rect x="48" y="27" width="24" height="6" rx="1.5" fill={c2} opacity={needsRepair ? 0.6 : 1} />
                </g>
              )}
              {tier === 3 && (
                <g>
                  <path d="M12 54 L18 26 L102 26 L108 54 Z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="20" y="31" width="80" height="8" rx="2" fill={c1} opacity={needsRepair ? 0.52 : 1} />
                  <rect x="22" y="41" width="76" height="8" rx="2" fill={c2} opacity={needsRepair ? 0.48 : 0.85} />
                  <path d="M10 26 Q60 13 110 26 L102 31 L18 31 Z" fill={needsRepair ? '#94a3b8' : '#e2e8f0'} opacity="0.92" />
                  <rect x="44" y="18" width="32" height="7" rx="2" fill="#0f172a" stroke={c2} strokeWidth="1" />
                  <rect x="48" y="20" width="24" height="3" rx="1" fill={needsRepair ? '#ef4444' : '#38bdf8'} />
                </g>
              )}
              {tier === 4 && (
                <g>
                  <path d="M8 54 L15 24 L105 24 L112 54 Z" fill="#0f172a" stroke={c2} strokeWidth="1.2" />
                  <rect x="17" y="29" width="86" height="9" rx="2" fill={c1} opacity={needsRepair ? 0.55 : 1} />
                  <rect x="19" y="40" width="82" height="9" rx="2" fill={c2} opacity={needsRepair ? 0.5 : 0.9} />
                  <path d="M7 24 Q60 6 113 24 L105 29 Q60 15 15 29 Z" fill={needsRepair ? '#94a3b8' : '#f8fafc'} />
                  <path d="M22 22 Q60 3 98 22" fill="none" stroke={c2} strokeWidth="2" />
                  <rect x="41" y="12" width="38" height="8" rx="2" fill="#020617" stroke={c2} strokeWidth="1.1" />
                  <rect x="45" y="14.5" width="30" height="3" rx="1" fill={needsRepair ? '#f59e0b' : '#4ade80'} />
                  <rect x="20" y="51.5" width="80" height="2.5" rx="1" fill={needsRepair ? '#64748b' : '#38bdf8'} />
                </g>
              )}
            </g>
          )}

          {/* Foreground pitch goal box */}
          <rect
            x="34"
            y="58"
            width="52"
            height="14"
            fill="none"
            stroke={needsRepair ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.75)'}
            strokeWidth="1.1"
            strokeDasharray={needsRepair ? '4 3' : undefined}
          />
          <rect
            x="50"
            y="53"
            width="20"
            height="6"
            transform={needsRepair ? 'skewX(-6)' : undefined}
            fill="rgba(255,255,255,0.22)"
            stroke="#ffffff"
            strokeWidth="1.1"
          />
          {/* Stadium structural cracks & missing roof tile */}
          {needsRepair && (
            <g>
              <polygon points="73,25 87,25 83,31 71,30" fill="#1e293b" opacity="0.88" />
              <path d="M35 34 L39 42 L36 50" fill="none" stroke="#090d0b" strokeWidth="1.5" />
              <path d="M78 33 L74 41 L79 49" fill="none" stroke="#090d0b" strokeWidth="1.5" />
              <path d="M56 39 L60 46 L57 52" fill="none" stroke="#090d0b" strokeWidth="1.2" />
            </g>
          )}
        </g>
      )}

      {/* 2. TRAINING GROUND (tr) */}
      {!destroyed && kind === 'tr' && (
        <g>
          {/* Practice field lines */}
          <line x1="8" y1="59" x2="112" y2="59" stroke={needsRepair ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.45)'} strokeWidth="1" />
          <line x1="60" y1="52" x2="60" y2="75" stroke={needsRepair ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="1" />
          {/* Indoor pavilion / campus building scaling with tier */}
          {tier >= 2 && (
            <g>
              <rect x="12" y={tier >= 3 ? 25 : 33} width={tier >= 4 ? 54 : 40} height={tier >= 3 ? 27 : 19} rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
              <rect x="15" y={tier >= 3 ? 28 : 36} width={tier >= 4 ? 48 : 34} height="4" rx="1" fill={c1} opacity={needsRepair ? 0.55 : 1} />
              <rect x="17" y={tier >= 3 ? 35 : 42} width="12" height="10" rx="1" fill={needsRepair ? '#334155' : '#38bdf8'} opacity="0.78" />
              <rect x="33" y={tier >= 3 ? 35 : 42} width="12" height="10" rx="1" fill={needsRepair ? '#0f172a' : '#38bdf8'} opacity="0.78" />
              {tier >= 4 && <rect x="49" y="35" width="12" height="10" rx="1" fill={needsRepair ? '#334155' : c2} opacity="0.85" />}
              {needsRepair && (
                <g stroke="#090d0b" strokeWidth="1.2">
                  <path d="M19 36 L27 44 M27 36 L19 44" stroke="#94a3b8" strokeWidth="1" />
                  <path d="M36 28 L41 37 L38 48" fill="none" stroke="#090d0b" strokeWidth="1.4" />
                </g>
              )}
            </g>
          )}
          {/* Dome / indoor turf hall at tier >= 3 */}
          {tier >= 3 && (
            <g>
              <path d="M68 52 Q90 24 112 52 Z" fill={needsRepair ? '#94a3b8' : '#e2e8f0'} stroke={c1} strokeWidth="1.4" />
              <path d="M74 52 Q90 32 106 52" fill="none" stroke={c2} strokeWidth="1.6" />
              {needsRepair && <path d="M84 34 L88 43 L83 50" fill="none" stroke="#0f172a" strokeWidth="1.4" />}
            </g>
          )}
          {/* Portable practice goal (tilted/broken net if damaged) */}
          <rect
            x="76"
            y="45"
            width="22"
            height="11"
            transform={needsRepair ? 'rotate(8 87 55)' : undefined}
            fill="rgba(255,255,255,0.14)"
            stroke={needsRepair ? '#cbd5e1' : '#ffffff'}
            strokeWidth="1.4"
            strokeDasharray={needsRepair ? '4 2' : undefined}
          />
          {/* Orange training cones (toppled when damaged) */}
          {needsRepair ? (
            <g>
              <polygon points="21,65 29,63 23,68" fill="#ea580c" />
              <polygon points="34,68 37,60 40,68" fill="#fb923c" />
              <polygon points="45,65 53,67 46,69" fill="#c2410c" />
            </g>
          ) : (
            <g>
              <polygon points="22,66 25,58 28,66" fill="#fb923c" />
              <polygon points="34,68 37,60 40,68" fill="#fb923c" />
              <polygon points="46,66 49,58 52,66" fill="#fb923c" />
            </g>
          )}
          {/* Free-kick mannequin silhouettes */}
          <g fill={needsRepair ? '#94a3b8' : c2} stroke="#0f172a" strokeWidth="0.7" transform={needsRepair ? 'rotate(-14 66 64)' : undefined}>
            <rect x="64" y="55" width="5" height="10" rx="2" />
            <circle cx="66.5" cy="52.5" r="2.2" />
            {tier >= 2 && (
              <>
                <rect x="71" y="55" width="5" height="10" rx="2" />
                <circle cx="73.5" cy="52.5" r="2.2" />
              </>
            )}
          </g>
        </g>
      )}

      {/* 3. YOUTH ACADEMY (ya) */}
      {!destroyed && kind === 'ya' && (
        <g>
          <rect
            x={tier >= 3 ? 20 : 28}
            y={tier === 1 ? 33 : tier === 2 ? 26 : 20}
            width={tier >= 3 ? 66 : 54}
            height={tier === 1 ? 20 : tier === 2 ? 27 : 33}
            rx="3"
            fill={needsRepair ? '#cbd5e1' : '#f8fafc'}
            stroke="#64748b"
            strokeWidth="1"
          />
          <polygon
            points={
              tier === 1
                ? '24,34 55,22 86,34'
                : tier === 2
                  ? '24,27 55,15 86,27'
                  : '16,21 53,9 90,21'
            }
            fill={needsRepair ? '#475569' : c1}
            stroke={c2}
            strokeWidth="1.2"
          />
          <circle cx="53" cy={tier === 1 ? 29 : tier === 2 ? 22 : 16} r="3.4" fill={c2} stroke="#0f172a" strokeWidth="0.7" opacity={needsRepair ? 0.6 : 1} />
          {/* Classroom / dorm windows */}
          <g fill={needsRepair ? '#334155' : '#38bdf8'} stroke="#0f172a" strokeWidth="0.6">
            <rect x="33" y="38" width="8" height="7" rx="1" />
            <rect x="49" y="38" width="8" height="7" rx="1" />
            <rect x="65" y="38" width="8" height="7" rx="1" />
            {tier >= 2 && (
              <>
                <rect x="33" y="28" width="8" height="6" rx="1" />
                <rect x="49" y="28" width="8" height="6" rx="1" />
                <rect x="65" y="28" width="8" height="6" rx="1" />
              </>
            )}
          </g>
          {/* Boarded window & wall cracks when damaged */}
          {needsRepair && (
            <g>
              <line x1="32" y1="39" x2="42" y2="44" stroke="#b45309" strokeWidth="1.6" />
              <line x1="32" y1="44" x2="42" y2="39" stroke="#92400e" strokeWidth="1.6" />
              <path d="M58 24 L54 32 L59 39 L55 51" fill="none" stroke="#1e293b" strokeWidth="1.4" />
              <path d="M72 34 L77 42 L74 52" fill="none" stroke="#1e293b" strokeWidth="1.2" />
            </g>
          )}
          {tier >= 3 && (
            <g>
              <rect x="82" y="45" width="28" height="12" rx="3" fill={needsRepair ? '#475569' : c1} stroke={c2} strokeWidth="1" />
              <rect x="85" y="47" width="8" height="4" rx="1" fill={needsRepair ? '#64748b' : '#bae6fd'} />
              <rect x="95" y="47" width="8" height="4" rx="1" fill={needsRepair ? '#334155' : '#bae6fd'} />
              <circle cx="88" cy="57" r="2.6" fill="#0f172a" />
              <circle cx="103" cy="57" r="2.6" fill="#0f172a" />
            </g>
          )}
          {/* Foreground seedling icon (wilted brown when damaged) */}
          <g transform="translate(18, 60)">
            <circle cx="0" cy={needsRepair ? 3 : 0} r="3" fill={needsRepair ? '#a16207' : '#4ade80'} />
            <path d={needsRepair ? 'M0 3 Q2 7 0 10' : 'M0 3 L0 10'} stroke={needsRepair ? '#a16207' : '#4ade80'} strokeWidth="1.8" fill="none" />
            <path d="M0 6 Q-5 2 -6 6 Q-2 8 0 6 Z" fill={needsRepair ? '#ca8a04' : '#86efac'} />
            <path d="M0 5 Q5 1 6 5 Q2 7 0 5 Z" fill={needsRepair ? '#ca8a04' : '#86efac'} />
          </g>
        </g>
      )}

      {/* 4. MEDICAL & REHAB CENTER (med) */}
      {!destroyed && kind === 'med' && (
        <g>
          <rect
            x={tier >= 3 ? 16 : 26}
            y={tier === 1 ? 30 : tier === 2 ? 23 : 17}
            width={tier >= 3 ? 88 : 68}
            height={tier === 1 ? 24 : tier === 2 ? 31 : 37}
            rx="4"
            fill={needsRepair ? '#cbd5e1' : '#f8fafc'}
            stroke="#94a3b8"
            strokeWidth="1.1"
          />
          <rect
            x={tier >= 3 ? 16 : 26}
            y={tier === 1 ? 30 : tier === 2 ? 23 : 17}
            width={tier >= 3 ? 88 : 68}
            height="5"
            rx="2"
            fill={needsRepair ? '#475569' : '#0ea5e9'}
          />
          <circle cx="60" cy={tier >= 3 ? 32 : 40} r="9" fill={needsRepair ? '#991b1b' : '#ef4444'} />
          <rect x="58" y={tier >= 3 ? 26.5 : 34.5} width="4" height="11" rx="1" fill={needsRepair ? '#e2e8f0' : '#ffffff'} />
          <rect x="54.5" y={tier >= 3 ? 30 : 38} width="11" height="4" rx="1" fill={needsRepair ? '#e2e8f0' : '#ffffff'} />
          {tier >= 2 && (
            <g fill={needsRepair ? '#334155' : '#bae6fd'} stroke={needsRepair ? '#475569' : '#0284c7'} strokeWidth="0.8">
              <rect x="28" y="38" width="14" height="12" rx="2" />
              <rect x="78" y="38" width="14" height="12" rx="2" />
            </g>
          )}
          {tier >= 3 && (
            <g>
              <rect x="44" y="45" width="32" height="8" rx="2" fill="#0f172a" />
              <polyline
                points={needsRepair ? '46,49 58,49 60,51 74,49' : '46,49 52,49 55,46 58,52 61,47 64,49 74,49'}
                fill="none"
                stroke={needsRepair ? '#f87171' : '#34d399'}
                strokeWidth="1.3"
              />
            </g>
          )}
          {tier >= 4 && (
            <g>
              <rect x="19" y="26" width="6" height="23" rx="3" fill={needsRepair ? '#475569' : '#67e8f9'} stroke={needsRepair ? '#64748b' : '#0ea5e9'} strokeWidth="0.9" />
              <rect x="95" y="26" width="6" height="23" rx="3" fill={needsRepair ? '#475569' : '#67e8f9'} stroke={needsRepair ? '#64748b' : '#0ea5e9'} strokeWidth="0.9" />
            </g>
          )}
          {needsRepair && (
            <g>
              <path d="M29 39 L40 49 M36 39 L30 49" stroke="#cbd5e1" strokeWidth="1" />
              <path d="M68 20 L63 29 L69 36 L65 44" fill="none" stroke="#1e293b" strokeWidth="1.4" />
              <path d="M32 25 L36 33 L33 38" fill="none" stroke="#1e293b" strokeWidth="1.3" />
            </g>
          )}
        </g>
      )}

      {/* 5. MERCH & FAN ZONE (merchLv) */}
      {!destroyed && kind === 'merchLv' && (
        <g>
          {tier === 1 ? (
            <g>
              <rect x="34" y="34" width="52" height="20" rx="2" fill="#1e293b" stroke={c2} strokeWidth="1" />
              <polygon
                points={needsRepair ? '29,37 60,25 91,33' : '30,35 60,22 90,35'}
                fill={needsRepair ? '#475569' : c1}
                stroke={c2}
                strokeWidth="1"
              />
              <rect x="42" y="40" width="36" height="10" rx="1" fill={needsRepair ? '#475569' : '#fef9c3'} />
            </g>
          ) : (
            <g>
              <rect
                x={tier >= 3 ? 18 : 26}
                y={tier >= 3 ? 22 : 28}
                width={tier >= 3 ? 84 : 68}
                height={tier >= 3 ? 32 : 26}
                rx="3"
                fill="#0f172a"
                stroke={c2}
                strokeWidth="1.2"
              />
              <rect
                x={tier >= 3 ? 16 : 24}
                y="32"
                width={tier >= 3 ? 88 : 72}
                height="5"
                rx="1.5"
                transform={needsRepair ? 'rotate(-3 60 34)' : undefined}
                fill={needsRepair ? '#475569' : c1}
              />
              <rect x="28" y="39" width="64" height="13" rx="1.5" fill={needsRepair ? '#334155' : '#bae6fd'} opacity="0.85" />
              <path d="M54 41 L58 41 L60 43 L62 41 L66 41 L68 45 L65 46 L65 51 L55 51 L55 46 L52 45 Z" fill={c1} stroke={c2} strokeWidth="0.8" opacity={needsRepair ? 0.55 : 1} />
              <path d="M35 42 L39 42 L41 44 L43 42 L47 42 L48 45 L46 46 L46 50 L36 50 L36 46 L34 45 Z" fill={c2} opacity={needsRepair ? 0.55 : 1} />
              <path d="M73 42 L77 42 L79 44 L81 42 L85 42 L86 45 L84 46 L84 50 L74 50 L74 46 L72 45 Z" fill={c1} opacity={needsRepair ? 0.55 : 1} />
              <rect
                x="38"
                y={tier >= 3 ? 14 : 20}
                width="44"
                height="8"
                rx="2"
                transform={needsRepair ? 'rotate(5 60 18)' : undefined}
                fill={needsRepair ? '#78350f' : c2}
                stroke="#0f172a"
                strokeWidth="0.8"
              />
              <rect x="44" y={tier >= 3 ? 16.5 : 22.5} width="32" height="3" rx="1" fill="#0f172a" />
            </g>
          )}
          {/* Cracked storefront glass */}
          {needsRepair && (
            <g stroke="#e2e8f0" strokeWidth="1" opacity="0.8">
              <path d="M40 40 L48 46 L44 51 M72 40 L67 45 L75 51" fill="none" />
              <line x1="14" y1="38" x2="10" y2="56" stroke="#94a3b8" strokeWidth="1.4" />
            </g>
          )}
          {!needsRepair && (
            <>
              <line x1="14" y1="34" x2="14" y2="56" stroke="#e2e8f0" strokeWidth="1.4" />
              <polygon points="14,34 24,37 14,40" fill={c1} />
            </>
          )}
          <line x1="106" y1="34" x2="106" y2="56" stroke="#e2e8f0" strokeWidth="1.4" />
          <polygon points="106,34 96,37 106,40" fill={c2} opacity={needsRepair ? 0.5 : 1} />
        </g>
      )}

      {/* 6. PITCH TURF & DRAINAGE (turfLv) */}
      {!destroyed && kind === 'turfLv' && (
        <g>
          <rect x="10" y="38" width="100" height="14" rx="2" fill={needsRepair ? '#717126' : '#16a34a'} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={10 + i * 12.5}
              y="38"
              width="6.25"
              height="14"
              fill={needsRepair ? '#857e2e' : '#22c55e'}
              opacity="0.55"
            />
          ))}
          {needsRepair && (
            <g>
              <ellipse cx="32" cy="45" rx="11" ry="5" fill="#78350f" />
              <ellipse cx="86" cy="44" rx="12" ry="5.5" fill="#57534e" />
              <ellipse cx="59" cy="48" rx="9" ry="3.5" fill="#3f2712" />
            </g>
          )}
          <line x1="60" y1="38" x2="60" y2="52" stroke={needsRepair ? 'rgba(255,255,255,0.35)' : '#ffffff'} strokeWidth="1.4" />
          <ellipse cx="60" cy="45" rx="9" ry="4.5" fill="none" stroke={needsRepair ? 'rgba(255,255,255,0.35)' : '#ffffff'} strokeWidth="1.2" />
          <rect x="10" y="52" width="100" height="16" rx="2" fill="#451a03" stroke="#78350f" strokeWidth="0.8" />
          {tier >= 2 && (
            <g>
              <circle cx="28" cy="60" r="3.5" fill={needsRepair ? '#7f1d1d' : '#0284c7'} stroke="#bae6fd" strokeWidth="1" />
              <circle cx="60" cy="60" r="3.5" fill={needsRepair ? '#78350f' : '#0284c7'} stroke="#bae6fd" strokeWidth="1" />
              <circle cx="92" cy="60" r="3.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
              <line
                x1="28"
                y1="60"
                x2="92"
                y2="60"
                stroke={needsRepair ? '#f87171' : '#38bdf8'}
                strokeWidth="1.4"
                strokeDasharray="3 2"
              />
            </g>
          )}
          {!needsRepair && (
            <>
              <path d="M32 38 Q22 26 16 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
              <path d="M32 38 Q42 26 48 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
              {tier >= 3 && (
                <>
                  <path d="M88 38 Q78 26 72 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
                  <path d="M88 38 Q98 26 104 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
                </>
              )}
            </>
          )}
          {tier >= 4 && (
            <g opacity={needsRepair ? 0.45 : 1}>
              <line x1="25" y1="22" x2="95" y2="22" stroke="#e2e8f0" strokeWidth="2" />
              <line x1="30" y1="22" x2="30" y2="38" stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1="90" y1="22" x2="90" y2="38" stroke="#cbd5e1" strokeWidth="1.2" />
              {!needsRepair && (
                <>
                  <polygon points="32,23 52,23 56,38 28,38" fill="#f472b6" opacity="0.24" />
                  <polygon points="68,23 88,23 92,38 64,38" fill="#f472b6" opacity="0.24" />
                </>
              )}
            </g>
          )}
        </g>
      )}

      {/* 7. ANALYTICS & VIDEO LAB (analyticsLv) */}
      {!destroyed && kind === 'analyticsLv' && (
        <g>
          <rect x="14" y="16" width="92" height="44" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
          <rect
            x={tier >= 3 ? 34 : 26}
            y="21"
            width={tier >= 3 ? 52 : 68}
            height="24"
            rx="2"
            fill={needsRepair ? '#1e293b' : '#064e3b'}
            stroke={needsRepair ? '#ef4444' : '#38bdf8'}
            strokeWidth="1.2"
          />
          {needsRepair ? (
            <g>
              {/* Glitched & cracked monitor screen */}
              <rect x="38" y="25" width="38" height="3" fill="#ef4444" opacity="0.55" />
              <rect x="42" y="31" width="30" height="2.5" fill="#f59e0b" opacity="0.6" />
              <rect x="37" y="37" width="44" height="3" fill="#64748b" opacity="0.5" />
              <path d="M52 21 L58 32 L54 45" fill="none" stroke="#f8fafc" strokeWidth="1.3" />
              <path d="M58 32 L69 27" fill="none" stroke="#f8fafc" strokeWidth="1" />
            </g>
          ) : (
            <>
              <line x1="60" y1="22" x2="60" y2="44" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />
              <circle cx="60" cy="33" r="4.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />
              <circle cx="46" cy="29" r="2.2" fill={c2} />
              <circle cx="72" cy="36" r="2.2" fill="#38bdf8" />
              <line x1="46" y1="29" x2="72" y2="36" stroke="#fde047" strokeWidth="1" strokeDasharray="2 1.5" />
            </>
          )}
          {tier >= 2 && (
            <g>
              <rect x="17" y="23" width="14" height="20" rx="1.5" fill="#1e293b" stroke={needsRepair ? '#64748b' : '#38bdf8'} strokeWidth="0.8" />
              {!needsRepair && (
                <>
                  <rect x="19" y="34" width="3" height="7" fill="#34d399" />
                  <rect x="23" y="29" width="3" height="12" fill="#facc15" />
                  <rect x="27" y="26" width="3" height="15" fill="#38bdf8" />
                </>
              )}
            </g>
          )}
          {tier >= 3 && (
            <g>
              <rect x="89" y="23" width="14" height="20" rx="1.5" fill="#1e293b" stroke={needsRepair ? '#ef4444' : '#a855f7'} strokeWidth="0.8" />
              {!needsRepair && (
                <polygon points="96,26 101,32 98,39 92,38 91,30" fill="rgba(168,85,247,0.45)" stroke="#c084fc" strokeWidth="0.8" />
              )}
            </g>
          )}
          {tier >= 4 && !needsRepair && (
            <g>
              <circle cx="60" cy="11" r="2.5" fill="#38bdf8" />
              <line x1="53" y1="11" x2="67" y2="11" stroke="#e2e8f0" strokeWidth="1.2" />
            </g>
          )}
          <rect x="22" y="48" width="76" height="6" rx="2" fill="#334155" />
        </g>
      )}

      {/* 8. AWAY TRAVEL & ROAD LOGISTICS (travelLv) */}
      {!destroyed && kind === 'travelLv' && (
        <g>
          {/* Asphalt Highway / Airport Tarmac */}
          <rect y="50" width="120" height="26" fill={needsRepair ? '#3f3f46' : '#1e293b'} />
          <line x1="0" y1="50" x2="120" y2="50" stroke={tier >= 4 ? '#38bdf8' : '#64748b'} strokeWidth="1" opacity="0.7" />
          <line
            x1="4"
            y1="62"
            x2="116"
            y2="62"
            stroke={needsRepair ? '#9ca3af' : '#facc15'}
            strokeWidth="1.4"
            strokeDasharray="7 5"
            opacity={tier >= 4 ? 0.55 : 0.85}
          />

          {/* Tier 3+: Away Recovery Camp Hotel / Executive Lounge Backdrop */}
          {tier >= 3 && (
            <g opacity={needsRepair ? 0.72 : 1}>
              <rect x="72" y="21" width="38" height="29" rx="2.5" fill="#0f172a" stroke="#64748b" strokeWidth="0.9" />
              <rect x="72" y="21" width="38" height="4.5" rx="1.5" fill={c1} />
              <rect x="76" y="28" width="7" height="5" rx="0.8" fill={needsRepair ? '#475569' : '#fde047'} opacity="0.85" />
              <rect x="86" y="28" width="7" height="5" rx="0.8" fill={needsRepair ? '#334155' : '#7dd3fc'} opacity="0.85" />
              <rect x="96" y="28" width="7" height="5" rx="0.8" fill={needsRepair ? '#475569' : '#fde047'} opacity="0.85" />
              <rect x="76" y="36" width="7" height="5" rx="0.8" fill={needsRepair ? '#334155' : '#7dd3fc'} opacity="0.85" />
              <rect x="86" y="36" width="7" height="5" rx="0.8" fill={needsRepair ? '#475569' : '#fde047'} opacity="0.85" />
              <rect x="96" y="36" width="7" height="5" rx="0.8" fill={needsRepair ? '#334155' : '#38bdf8'} opacity="0.85" />
              <rect x="86" y="44" width="10" height="6" rx="1" fill="#334155" />
            </g>
          )}

          {/* Tier 4 (Lv.9-10): Club-liveried Charter Jet */}
          {tier >= 4 && (
            <g opacity={needsRepair ? 0.65 : 1}>
              {/* Jet tail fin */}
              <polygon points="18,29 12,15 24,15 30,29" fill={c1} stroke={c2} strokeWidth="0.9" />
              {/* Jet fuselage */}
              <path d="M16 28 L66 28 Q78 28 82 32.5 Q77 36 66 36 L18 36 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.9" />
              {/* Club stripe along fuselage */}
              <path d="M19 32 L76 32" stroke={c1} strokeWidth="2.2" />
              <path d="M22 33.8 L72 33.8" stroke={c2} strokeWidth="1.1" />
              {/* Cockpit & cabin windows */}
              <polygon points="69,29.3 76,30.5 74,31.8 69,31.5" fill="#0f172a" />
              <g fill="#0f172a" opacity="0.8">
                <circle cx="32" cy="30.3" r="1" />
                <circle cx="38" cy="30.3" r="1" />
                <circle cx="44" cy="30.3" r="1" />
                <circle cx="50" cy="30.3" r="1" />
                <circle cx="56" cy="30.3" r="1" />
                <circle cx="62" cy="30.3" r="1" />
              </g>
              {/* Swept wing & turbine */}
              <polygon points="40,34 54,34 45,42 35,42" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.7" />
              <rect x="42" y="37" width="7" height="3.2" rx="1.5" fill="#334155" />
            </g>
          )}

          {/* Tier 1 (Lv.1-2): Compact Team Minibus / Van */}
          {tier === 1 && (
            <g transform={needsRepair ? 'rotate(-2 60 48)' : undefined}>
              <path d="M30 49 L34 34 Q36 31 41 31 L77 31 Q84 31 87 38 L89 49 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.1" />
              <rect x="31" y="42" width="57" height="4.5" fill={c1} opacity={needsRepair ? 0.55 : 1} />
              <rect x="33" y="46" width="54" height="1.5" fill={c2} opacity={needsRepair ? 0.5 : 0.95} />
              <rect x="37" y="34" width="11" height="6.5" rx="1" fill="#0f172a" />
              <rect x="51" y="34" width="12" height="6.5" rx="1" fill="#0f172a" />
              <polygon points="66,34 80,34 84,40.5 66,40.5" fill="#38bdf8" opacity="0.82" />
              {/* Headlight */}
              <rect x="86" y="43" width="3" height="3" rx="0.8" fill={needsRepair ? '#94a3b8' : '#fef08a'} />
              {/* Wheels */}
              <circle cx="43" cy="51.5" r="5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.2" />
              <circle cx="43" cy="51.5" r="2" fill="#cbd5e1" />
              <circle cx="75" cy="51.5" r="5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.2" />
              <circle cx="75" cy="51.5" r="2" fill="#cbd5e1" />
            </g>
          )}

          {/* Tier 2-4 (Lv.3-10): Sleek Club Team Coach Bus */}
          {tier >= 2 && (
            <g transform={tier >= 4 ? 'translate(-8, 4) scale(0.84)' : undefined}>
              {/* Bus Body */}
              <path
                d="M16 50 L18 30 Q19 27 24 27 L88 27 Q96 27 99 35 L100 50 Z"
                fill="#0f172a"
                stroke={needsRepair ? '#64748b' : c2}
                strokeWidth="1.2"
              />
              {/* Club Livery Band */}
              <path d="M17 40 L99 40 L99 47 L17 47 Z" fill={c1} opacity={needsRepair ? 0.52 : 0.96} />
              <path d="M17 38.5 L98 38.5" stroke={c2} strokeWidth="1.4" />
              {/* Panoramic Tinted Windows */}
              <rect x="22" y="30" width="13" height="7" rx="1.2" fill={needsRepair ? '#334155' : '#38bdf8'} opacity="0.82" />
              <rect x="37" y="30" width="14" height="7" rx="1.2" fill={needsRepair ? '#334155' : '#7dd3fc'} opacity="0.82" />
              <rect x="53" y="30" width="14" height="7" rx="1.2" fill={needsRepair ? '#334155' : '#38bdf8'} opacity="0.82" />
              <rect x="69" y="30" width="12" height="7" rx="1.2" fill={needsRepair ? '#334155' : '#7dd3fc'} opacity="0.82" />
              <polygon points="83,30 94,30 97,37 83,37" fill={needsRepair ? '#475569' : '#bae6fd'} opacity="0.9" />
              {/* Crest emblem & luggage bays */}
              <circle cx="29" cy="43.5" r="2.6" fill={c2} stroke="#0f172a" strokeWidth="0.6" />
              <rect x="39" y="42" width="16" height="6" rx="0.8" fill="rgba(15,23,42,0.45)" stroke={c2} strokeWidth="0.6" />
              <rect x="58" y="42" width="16" height="6" rx="0.8" fill="rgba(15,23,42,0.45)" stroke={c2} strokeWidth="0.6" />
              {/* Headlight glow */}
              {!needsRepair && (
                <>
                  <polygon points="99,45 112,41 112,50 99,47.5" fill="#fef08a" opacity="0.24" />
                  <rect x="97.5" y="44.5" width="2.8" height="3" rx="0.8" fill="#fef08a" />
                </>
              )}
              {/* Wheels */}
              <circle cx="33" cy="52" r="5.2" fill="#020617" stroke="#cbd5e1" strokeWidth="1.2" />
              <circle cx="33" cy="52" r="2.2" fill={c2} />
              <circle cx="81" cy="52" r="5.2" fill="#020617" stroke="#cbd5e1" strokeWidth="1.2" />
              <circle cx="81" cy="52" r="2.2" fill={c2} />
            </g>
          )}

          {/* Damage / Breakdown markers when condition < 75 */}
          {needsRepair && (
            <g>
              <path d="M56 32 L61 36 L58 39" fill="none" stroke="#f8fafc" strokeWidth="1.2" />
              <polygon points="103,56 106.5,47 110,56" fill="#f97316" stroke="#0f172a" strokeWidth="0.7" />
              <rect x="102" y="55" width="9" height="2" rx="0.8" fill="#ea580c" />
            </g>
          )}
        </g>
      )}

      {/* Heavy disrepair caution stripe overlay when condition < 55 */}
      {severelyDamaged && (
        <g opacity="0.92">
          <rect x="12" y="64" width="96" height="6" rx="1.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="0.8" />
          <polygon points="18,64 25,64 21,70 14,70" fill="#0f172a" />
          <polygon points="34,64 41,64 37,70 30,70" fill="#0f172a" />
          <polygon points="50,64 57,64 53,70 46,70" fill="#0f172a" />
          <polygon points="66,64 73,64 69,70 62,70" fill="#0f172a" />
          <polygon points="82,64 89,64 85,70 78,70" fill="#0f172a" />
          <polygon points="98,64 105,64 101,70 94,70" fill="#0f172a" />
        </g>
      )}

      {/* Level crown/badge on top-left */}
      <g>
        <rect
          x="5"
          y="5"
          width="27"
          height="12"
          rx="4"
          fill="rgba(2, 6, 23, 0.88)"
          stroke={destroyed ? '#ef4444' : tier >= 4 ? '#facc15' : tier >= 3 ? '#38bdf8' : 'rgba(255,255,255,0.28)'}
          strokeWidth="0.9"
        />
        <text x="18.5" y="13" textAnchor="middle" fill={destroyed ? '#fca5a5' : tier >= 4 ? '#fde047' : '#ffffff'} fontSize="7.5" fontWeight="800">
          Lv.{lv}
        </text>
      </g>

      {/* Condition / Destroyed warning badge on top-right */}
      {destroyed && (
        <g>
          <rect x="74" y="5" width="41" height="12" rx="4" fill="rgba(127, 29, 29, 0.94)" stroke="#f87171" strokeWidth="0.9" />
          <text x="94.5" y="13" textAnchor="middle" fill="#fecaca" fontSize="6.8" fontWeight="800">
            ถูกทำลาย
          </text>
        </g>
      )}
      {needsRepair && (
        <g>
          <rect
            x="72"
            y="5"
            width="43"
            height="12"
            rx="4"
            fill={severelyDamaged ? 'rgba(153, 27, 27, 0.94)' : 'rgba(120, 53, 15, 0.92)'}
            stroke={severelyDamaged ? '#f87171' : '#fbbf24'}
            strokeWidth="0.9"
          />
          <text x="93.5" y="13" textAnchor="middle" fill={severelyDamaged ? '#fecaca' : '#fef08a'} fontSize="6.8" fontWeight="800">
            {severelyDamaged ? 'ชำรุดหนัก' : 'ควรปรับปรุง'}
          </text>
        </g>
      )}
    </svg>
  );
};

export const StaffRoleSvg: React.FC<{
  role: StaffRoleKey;
  level: number;
  c1?: string;
  c2?: string;
  className?: string;
}> = ({ role, level, c1 = '#177c45', c2 = '#f5c242', className = '' }) => {
  const lv = clamp(level, 0, 6);
  const active = lv > 0;
  const jacket =
    role === 'physio'
      ? '#0ea5e9'
      : role === 'gkCoach'
        ? '#f59e0b'
        : role === 'scout'
          ? '#334155'
          : role === 'setPieceCoach'
            ? '#8b5cf6'
            : c1;
  const ringCol = lv >= 5 ? '#facc15' : lv >= 3 ? '#38bdf8' : active ? '#34d399' : '#64748b';

  return (
    <svg
      viewBox="0 0 72 64"
      className={`rounded-xl border border-[var(--line)]/80 bg-[#0b1f16] shrink-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <rect width="72" height="64" fill={active ? '#0f291e' : '#111827'} />
      <circle cx="36" cy="30" r="24" fill={jacket} opacity={active ? 0.16 : 0.06} />

      {/* Coach/Specialist character silhouette */}
      <g opacity={active ? 1 : 0.48}>
        {/* Torso / Track Jacket */}
        <path d="M16 62 C16 44 25 40 36 40 C47 40 56 44 56 62 Z" fill={jacket} stroke="#0f172a" strokeWidth="1" />
        {/* Collar / zip */}
        <line x1="36" y1="41" x2="36" y2="62" stroke={c2} strokeWidth="1.6" />
        {/* Head */}
        <circle cx="36" cy="26" r="10.5" fill="#f1c27d" stroke="#0f172a" strokeWidth="0.9" />
        {/* Hair / Cap unique per role */}
        {role === 'asst' && (
          <path d="M25.5 23 Q36 12 46.5 23 L49 24 L25 24 Z" fill="#1e293b" />
        )}
        {role === 'fit' && (
          <>
            <path d="M26 22 Q36 14 46 22" fill="#0f172a" />
            <rect x="25.5" y="20" width="21" height="3" rx="1.5" fill={c2} />
          </>
        )}
        {role === 'scout' && (
          <path d="M23 21 Q36 10 49 21 L44 17 L28 17 Z" fill="#475569" />
        )}
        {role === 'physio' && (
          <path d="M26 24 Q36 13 46 24 Q42 18 36 18 Q30 18 26 24 Z" fill="#1e293b" />
        )}
        {role === 'gkCoach' && (
          <path d="M25 22 Q36 12 47 22 L51 23 L25 23 Z" fill={c1} />
        )}
        {role === 'setPieceCoach' && (
          <path d="M26 23 Q36 12 46 23 L45 19 L27 19 Z" fill="#312e81" />
        )}
        {/* Eyes */}
        <circle cx="32.5" cy="27" r="1.1" fill="#0f172a" />
        <circle cx="39.5" cy="27" r="1.1" fill="#0f172a" />
        {/* Headset mic at Lv.3+ */}
        {lv >= 3 && (
          <path d="M25 27 L31 31" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
        )}
      </g>

      {/* UNIQUE ROLE-SPECIFIC EQUIPMENT PROP ON FOREGROUND CORNER */}
      {role === 'asst' && (
        /* Tactical Clipboard */
        <g transform="translate(46, 36)">
          <rect x="0" y="2" width="16" height="21" rx="2" fill="#065f46" stroke="#fde047" strokeWidth="1" />
          <rect x="5" y="0" width="6" height="3" rx="1" fill="#cbd5e1" />
          <circle cx="5" cy="10" r="1.4" fill="#fde047" />
          <circle cx="11" cy="14" r="1.4" fill="#38bdf8" />
          <line x1="5" y1="10" x2="11" y2="14" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 1" />
        </g>
      )}
      {role === 'fit' && (
        /* Stopwatch + Orange Cone */
        <g transform="translate(45, 36)">
          <circle cx="10" cy="12" r="8" fill="#0f172a" stroke="#facc15" strokeWidth="1.4" />
          <rect x="8.5" y="2" width="3" height="2.5" fill="#facc15" />
          <line x1="10" y1="12" x2="10" y2="7" stroke="#34d399" strokeWidth="1.4" />
          <line x1="10" y1="12" x2="14" y2="12" stroke="#ffffff" strokeWidth="1.2" />
        </g>
      )}
      {role === 'scout' && (
        /* Binoculars & Radar Lens */
        <g transform="translate(43, 38)">
          <circle cx="6" cy="11" r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.4" />
          <circle cx="17" cy="11" r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.4" />
          <rect x="9" y="9" width="5" height="3" fill="#94a3b8" />
          <circle cx="6" cy="11" r="2.2" fill="#7dd3fc" opacity="0.7" />
          <circle cx="17" cy="11" r="2.2" fill="#7dd3fc" opacity="0.7" />
        </g>
      )}
      {role === 'physio' && (
        /* Medical First-Aid Bag */
        <g transform="translate(44, 38)">
          <rect x="2" y="4" width="18" height="14" rx="2.5" fill="#ffffff" stroke="#ef4444" strokeWidth="1.2" />
          <path d="M8 4 L8 1.5 L14 1.5 L14 4" fill="none" stroke="#ef4444" strokeWidth="1.3" />
          <rect x="9.8" y="7" width="2.4" height="8" rx="0.6" fill="#ef4444" />
          <rect x="7" y="9.8" width="8" height="2.4" rx="0.6" fill="#ef4444" />
        </g>
      )}
      {role === 'gkCoach' && (
        /* Goalkeeper Glove + Football */
        <g transform="translate(44, 36)">
          <circle cx="12" cy="14" r="6.5" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
          <polygon points="12,10 15,13 13.8,17 10.2,17 9,13" fill="#0f172a" />
          <rect x="1" y="6" width="9" height="12" rx="4" fill="#facc15" stroke="#0f172a" strokeWidth="1" />
        </g>
      )}
      {role === 'setPieceCoach' && (
        /* Curved Free-Kick Playbook & Wall Target */
        <g transform="translate(44, 36)">
          <rect x="1" y="2" width="19" height="18" rx="2.5" fill="#1e1b4b" stroke="#c084fc" strokeWidth="1.1" />
          <path d="M4 16 Q10 4 17 8" fill="none" stroke="#fde047" strokeWidth="1.5" strokeDasharray="2.2 1.5" />
          <circle cx="17" cy="8" r="2" fill="#f43f5e" />
          <circle cx="4" cy="16" r="1.8" fill="#ffffff" />
        </g>
      )}

      {/* Level badge */}
      <g>
        <rect x="4" y="4" width="26" height="11" rx="4" fill="rgba(2, 6, 23, 0.88)" stroke={ringCol} strokeWidth="0.9" />
        <text x="17" y="11.5" textAnchor="middle" fill={active ? '#ffffff' : '#94a3b8'} fontSize="7" fontWeight="800">
          Lv.{lv}
        </text>
      </g>
    </svg>
  );
};
