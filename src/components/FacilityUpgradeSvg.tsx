import React from 'react';
import type { FacilityKey, StaffRoleKey } from '../types/game';
import { clamp } from '../utils/math';

export const getFacilityTierLabel = (lv: number): string => {
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

export const FacilityUpgradeSvg: React.FC<{
  kind: FacilityKey;
  level: number;
  condition?: number;
  c1?: string;
  c2?: string;
  className?: string;
}> = ({ kind, level, condition = 100, c1 = '#177c45', c2 = '#f5c242', className = '' }) => {
  const lv = clamp(level, 1, 10);
  const tier = lv >= 9 ? 4 : lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
  const needsRepair = condition < 75;
  const uid = `${kind}-${lv}-${tier}`;

  return (
    <svg
      viewBox="0 0 120 76"
      className={`rounded-xl border border-[var(--line)]/80 bg-[#0b1f16] shrink-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tier === 4 ? '#0f172a' : tier === 3 ? '#132a3a' : tier === 2 ? '#1c4d6b' : '#256380'} />
          <stop offset="100%" stopColor={tier >= 3 ? '#183f33' : '#225946'} />
        </linearGradient>
        <linearGradient id={`grass-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#166534" />
          <stop offset="50%" stopColor="#1e7d43" />
          <stop offset="100%" stopColor="#155e31" />
        </linearGradient>
      </defs>

      {/* Sky & ground backdrop */}
      <rect width="120" height="76" fill={`url(#sky-${uid})`} />
      <rect y="52" width="120" height="24" fill={`url(#grass-${uid})`} />

      {/* Sun / night stars accent */}
      {tier >= 4 ? (
        <g fill="#fef08a" opacity="0.85">
          <circle cx="18" cy="12" r="1.1" />
          <circle cx="34" cy="9" r="0.9" />
          <circle cx="88" cy="11" r="1.2" />
          <circle cx="104" cy="15" r="0.9" />
        </g>
      ) : (
        <circle cx="102" cy="14" r={tier === 1 ? 5 : 6} fill="#fde047" opacity={tier === 3 ? 0.45 : 0.8} />
      )}

      {/* 1. STADIUM (st) */}
      {kind === 'st' && (
        <g>
          {/* Outer floodlight towers at tier >= 2 */}
          {tier >= 2 && (
            <g stroke="#cbd5e1" strokeWidth="1.8">
              <line x1="16" y1="52" x2="18" y2={tier >= 3 ? 16 : 24} />
              <line x1="104" y1="52" x2="102" y2={tier >= 3 ? 16 : 24} />
              <rect x="13" y={tier >= 3 ? 12 : 20} width="10" height="5" rx="1" fill="#fef08a" stroke="none" />
              <rect x="97" y={tier >= 3 ? 12 : 20} width="10" height="5" rx="1" fill="#fef08a" stroke="none" />
            </g>
          )}
          {/* Stadium bowl & tiered stands */}
          {tier === 1 && (
            <g>
              <rect x="26" y="39" width="68" height="14" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
              <rect x="30" y="42" width="60" height="4" fill={c1} />
              <rect x="28" y="34" width="64" height="5" rx="1.5" fill={c2} />
            </g>
          )}
          {tier === 2 && (
            <g>
              <path d="M18 53 L24 31 L96 31 L102 53 Z" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
              <rect x="26" y="36" width="68" height="11" rx="1.5" fill={c1} opacity="0.9" />
              <path d="M20 31 Q60 22 100 31" fill="none" stroke="#e2e8f0" strokeWidth="2.6" />
              <rect x="48" y="27" width="24" height="6" rx="1.5" fill={c2} />
            </g>
          )}
          {tier === 3 && (
            <g>
              <path d="M12 54 L18 26 L102 26 L108 54 Z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="20" y="31" width="80" height="8" rx="1.5" fill={c1} />
              <rect x="22" y="41" width="76" height="8" rx="1.5" fill={c2} opacity="0.85" />
              <path d="M12 26 Q60 14 108 26 L102 31 L18 31 Z" fill="#e2e8f0" opacity="0.92" />
              <rect x="44" y="18" width="32" height="7" rx="2" fill="#0f172a" stroke={c2} strokeWidth="1" />
              <rect x="48" y="20" width="24" height="3" rx="1" fill="#38bdf8" />
            </g>
          )}
          {tier === 4 && (
            <g>
              {/* Iconic sweeping dual-arch arena */}
              <path d="M8 54 L15 24 L105 24 L112 54 Z" fill="#0f172a" stroke={c2} strokeWidth="1.2" />
              <rect x="17" y="29" width="86" height="9" rx="2" fill={c1} />
              <rect x="19" y="40" width="82" height="9" rx="2" fill={c2} opacity="0.9" />
              <path d="M7 24 Q60 6 113 24 L105 29 Q60 15 15 29 Z" fill="#f8fafc" />
              <path d="M22 22 Q60 3 98 22" fill="none" stroke={c2} strokeWidth="2" />
              <rect x="41" y="12" width="38" height="8" rx="2" fill="#020617" stroke={c2} strokeWidth="1.1" />
              <rect x="45" y="14.5" width="30" height="3" rx="1" fill="#4ade80" />
              {/* Glowing LED pitch perimeter */}
              <rect x="20" y="51.5" width="80" height="2.5" rx="1" fill="#38bdf8" />
            </g>
          )}
          {/* Foreground pitch goal box */}
          <rect x="34" y="58" width="52" height="14" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.1" />
          <rect x="50" y="53" width="20" height="6" fill="rgba(255,255,255,0.22)" stroke="#ffffff" strokeWidth="1.1" />
        </g>
      )}

      {/* 2. TRAINING GROUND (tr) */}
      {kind === 'tr' && (
        <g>
          {/* Practice field lines */}
          <line x1="8" y1="59" x2="112" y2="59" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          <line x1="60" y1="52" x2="60" y2="75" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          {/* Indoor pavilion / campus building scaling with tier */}
          {tier >= 2 && (
            <g>
              <rect x="12" y={tier >= 3 ? 25 : 33} width={tier >= 4 ? 54 : 40} height={tier >= 3 ? 27 : 19} rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
              <rect x="15" y={tier >= 3 ? 28 : 36} width={tier >= 4 ? 48 : 34} height="4" rx="1" fill={c1} />
              <rect x="17" y={tier >= 3 ? 35 : 42} width="12" height="10" rx="1" fill="#38bdf8" opacity="0.7" />
              <rect x="33" y={tier >= 3 ? 35 : 42} width="12" height="10" rx="1" fill="#38bdf8" opacity="0.7" />
              {tier >= 4 && <rect x="49" y="35" width="12" height="10" rx="1" fill={c2} opacity="0.85" />}
            </g>
          )}
          {/* Dome / indoor turf hall at tier >= 3 */}
          {tier >= 3 && (
            <g>
              <path d="M68 52 Q90 24 112 52 Z" fill="#e2e8f0" stroke={c1} strokeWidth="1.4" />
              <path d="M74 52 Q90 32 106 52" fill="none" stroke={c2} strokeWidth="1.6" />
            </g>
          )}
          {/* Portable practice goal */}
          <rect x="76" y="45" width="22" height="11" fill="rgba(255,255,255,0.16)" stroke="#ffffff" strokeWidth="1.4" />
          {/* Orange training cones */}
          <polygon points="22,66 25,58 28,66" fill="#fb923c" />
          <polygon points="34,68 37,60 40,68" fill="#fb923c" />
          <polygon points="46,66 49,58 52,66" fill="#fb923c" />
          {/* Free-kick mannequin silhouettes */}
          <g fill={c2} stroke="#0f172a" strokeWidth="0.7">
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
      {kind === 'ya' && (
        <g>
          {/* Main Academy Campus / Residence */}
          <rect
            x={tier >= 3 ? 20 : 28}
            y={tier === 1 ? 33 : tier === 2 ? 26 : 20}
            width={tier >= 3 ? 66 : 54}
            height={tier === 1 ? 20 : tier === 2 ? 27 : 33}
            rx="3"
            fill="#f8fafc"
            stroke="#64748b"
            strokeWidth="1"
          />
          {/* Pitched Campus Roof */}
          <polygon
            points={
              tier === 1
                ? '24,34 55,22 86,34'
                : tier === 2
                  ? '24,27 55,15 86,27'
                  : '16,21 53,9 90,21'
            }
            fill={c1}
            stroke={c2}
            strokeWidth="1.2"
          />
          {/* Academy crest badge on roof gable */}
          <circle cx="53" cy={tier === 1 ? 29 : tier === 2 ? 22 : 16} r="3.4" fill={c2} stroke="#0f172a" strokeWidth="0.7" />
          {/* Classroom / dorm windows */}
          <g fill="#38bdf8" stroke="#0f172a" strokeWidth="0.6">
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
          {/* Sprout / rising talent star emblem + academy bus at tier >= 3 */}
          {tier >= 3 && (
            <g>
              <rect x="82" y="45" width="28" height="12" rx="3" fill={c1} stroke={c2} strokeWidth="1" />
              <rect x="85" y="47" width="8" height="4" rx="1" fill="#bae6fd" />
              <rect x="95" y="47" width="8" height="4" rx="1" fill="#bae6fd" />
              <circle cx="88" cy="57" r="2.6" fill="#0f172a" />
              <circle cx="103" cy="57" r="2.6" fill="#0f172a" />
            </g>
          )}
          {/* Foreground U-youth players / seedling icon */}
          <g transform="translate(18, 60)">
            <circle cx="0" cy="0" r="3" fill="#4ade80" />
            <path d="M0 3 L0 10" stroke="#4ade80" strokeWidth="1.8" />
            <path d="M0 6 Q-5 2 -6 6 Q-2 8 0 6 Z" fill="#86efac" />
            <path d="M0 5 Q5 1 6 5 Q2 7 0 5 Z" fill="#86efac" />
          </g>
        </g>
      )}

      {/* 4. MEDICAL & REHAB CENTER (med) */}
      {kind === 'med' && (
        <g>
          {/* Clean clinical hospital / sports science building */}
          <rect
            x={tier >= 3 ? 16 : 26}
            y={tier === 1 ? 30 : tier === 2 ? 23 : 17}
            width={tier >= 3 ? 88 : 68}
            height={tier === 1 ? 24 : tier === 2 ? 31 : 37}
            rx="4"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="1.1"
          />
          {/* Accent roof band */}
          <rect x={tier >= 3 ? 16 : 26} y={tier === 1 ? 30 : tier === 2 ? 23 : 17} width={tier >= 3 ? 88 : 68} height="5" rx="2" fill="#0ea5e9" />
          {/* Iconic Medical Cross Shield */}
          <circle cx="60" cy={tier >= 3 ? 32 : 40} r="9" fill="#ef4444" />
          <rect x="58" y={tier >= 3 ? 26.5 : 34.5} width="4" height="11" rx="1" fill="#ffffff" />
          <rect x="54.5" y={tier >= 3 ? 30 : 38} width="11" height="4" rx="1" fill="#ffffff" />
          {/* Glass cryo/hydro bays at higher levels */}
          {tier >= 2 && (
            <g fill="#bae6fd" stroke="#0284c7" strokeWidth="0.8">
              <rect x="28" y="38" width="14" height="12" rx="2" />
              <rect x="78" y="38" width="14" height="12" rx="2" />
            </g>
          )}
          {tier >= 3 && (
            <g>
              {/* ECG heartbeat pulse display */}
              <rect x="44" y="45" width="32" height="8" rx="2" fill="#0f172a" />
              <polyline
                points="46,49 52,49 55,46 58,52 61,47 64,49 74,49"
                fill="none"
                stroke="#34d399"
                strokeWidth="1.3"
              />
            </g>
          )}
          {tier >= 4 && (
            <g>
              {/* Cryo-pod tubes on side */}
              <rect x="19" y="26" width="6" height="23" rx="3" fill="#67e8f9" stroke="#0ea5e9" strokeWidth="0.9" />
              <rect x="95" y="26" width="6" height="23" rx="3" fill="#67e8f9" stroke="#0ea5e9" strokeWidth="0.9" />
            </g>
          )}
        </g>
      )}

      {/* 5. MERCH & FAN ZONE (merchLv) */}
      {kind === 'merchLv' && (
        <g>
          {tier === 1 ? (
            /* Kiosk tent */
            <g>
              <rect x="34" y="34" width="52" height="20" rx="2" fill="#1e293b" stroke={c2} strokeWidth="1" />
              <polygon points="30,35 60,22 90,35" fill={c1} stroke={c2} strokeWidth="1" />
              <rect x="42" y="40" width="36" height="10" rx="1" fill="#fef9c3" />
            </g>
          ) : (
            /* Official Club Megastore & Plaza */
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
              {/* Striped awning */}
              <rect x={tier >= 3 ? 16 : 24} y="32" width={tier >= 3 ? 88 : 72} height="5" rx="1.5" fill={c1} />
              {/* Large illuminated glass storefront */}
              <rect x="28" y="39" width="64" height="13" rx="1.5" fill="#bae6fd" opacity="0.85" />
              {/* Hanging Club Jersey silhouette in window */}
              <path d="M54 41 L58 41 L60 43 L62 41 L66 41 L68 45 L65 46 L65 51 L55 51 L55 46 L52 45 Z" fill={c1} stroke={c2} strokeWidth="0.8" />
              <path d="M35 42 L39 42 L41 44 L43 42 L47 42 L48 45 L46 46 L46 50 L36 50 L36 46 L34 45 Z" fill={c2} />
              <path d="M73 42 L77 42 L79 44 L81 42 L85 42 L86 45 L84 46 L84 50 L74 50 L74 46 L72 45 Z" fill={c1} />
              {/* Rooftop Megastore Billboard */}
              <rect x="38" y={tier >= 3 ? 14 : 20} width="44" height="8" rx="2" fill={c2} stroke="#0f172a" strokeWidth="0.8" />
              <rect x="44" y={tier >= 3 ? 16.5 : 22.5} width="32" height="3" rx="1" fill="#0f172a" />
            </g>
          )}
          {/* Fan plaza scarf flags */}
          <line x1="14" y1="34" x2="14" y2="56" stroke="#e2e8f0" strokeWidth="1.4" />
          <polygon points="14,34 24,37 14,40" fill={c1} />
          <line x1="106" y1="34" x2="106" y2="56" stroke="#e2e8f0" strokeWidth="1.4" />
          <polygon points="106,34 96,37 106,40" fill={c2} />
        </g>
      )}

      {/* 6. PITCH TURF & DRAINAGE (turfLv) */}
      {kind === 'turfLv' && (
        <g>
          {/* Cross-section of hybrid turf & drainage pipes */}
          <rect x="10" y="38" width="100" height="14" rx="2" fill="#16a34a" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={10 + i * 12.5} y="38" width="6.25" height="14" fill="#22c55e" opacity="0.55" />
          ))}
          {/* Pitch center line */}
          <line x1="60" y1="38" x2="60" y2="52" stroke="#ffffff" strokeWidth="1.4" />
          <ellipse cx="60" cy="45" rx="9" ry="4.5" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          {/* Soil & sub-surface drainage layer */}
          <rect x="10" y="52" width="100" height="16" rx="2" fill="#451a03" stroke="#78350f" strokeWidth="0.8" />
          {tier >= 2 && (
            <g>
              {/* Drainage pipes */}
              <circle cx="28" cy="60" r="3.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
              <circle cx="60" cy="60" r="3.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
              <circle cx="92" cy="60" r="3.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
              <line x1="28" y1="60" x2="92" y2="60" stroke="#38bdf8" strokeWidth="1.4" strokeDasharray="3 2" />
            </g>
          )}
          {/* Pop-up water sprinkler arcs */}
          <path d="M32 38 Q22 26 16 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
          <path d="M32 38 Q42 26 48 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
          {tier >= 3 && (
            <>
              <path d="M88 38 Q78 26 72 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
              <path d="M88 38 Q98 26 104 36" fill="none" stroke="#7dd3fc" strokeWidth="1.3" strokeDasharray="2 2" />
            </>
          )}
          {/* Grow-light UV rig at tier 4 */}
          {tier >= 4 && (
            <g>
              <line x1="25" y1="22" x2="95" y2="22" stroke="#e2e8f0" strokeWidth="2" />
              <line x1="30" y1="22" x2="30" y2="38" stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1="90" y1="22" x2="90" y2="38" stroke="#cbd5e1" strokeWidth="1.2" />
              <polygon points="32,23 52,23 56,38 28,38" fill="#f472b6" opacity="0.24" />
              <polygon points="68,23 88,23 92,38 64,38" fill="#f472b6" opacity="0.24" />
            </g>
          )}
        </g>
      )}

      {/* 7. ANALYTICS & VIDEO LAB (analyticsLv) */}
      {kind === 'analyticsLv' && (
        <g>
          {/* Modern control room housing */}
          <rect x="14" y="16" width="92" height="44" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
          {/* Main tactical screen */}
          <rect x={tier >= 3 ? 34 : 26} y="21" width={tier >= 3 ? 52 : 68} height="24" rx="2" fill="#064e3b" stroke="#38bdf8" strokeWidth="1.2" />
          {/* Pitch lines + tactical heatmap inside screen */}
          <line x1="60" y1="22" x2="60" y2="44" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />
          <circle cx="60" cy="33" r="4.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />
          <circle cx="46" cy="29" r="2.2" fill={c2} />
          <circle cx="72" cy="36" r="2.2" fill="#38bdf8" />
          <line x1="46" y1="29" x2="72" y2="36" stroke="#fde047" strokeWidth="1" strokeDasharray="2 1.5" />
          {/* Side dual telemetry screens at tier >= 2 */}
          {tier >= 2 && (
            <g>
              <rect x="17" y="23" width="14" height="20" rx="1.5" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" />
              <rect x="19" y="34" width="3" height="7" fill="#34d399" />
              <rect x="23" y="29" width="3" height="12" fill="#facc15" />
              <rect x="27" y="26" width="3" height="15" fill="#38bdf8" />
            </g>
          )}
          {tier >= 3 && (
            <g>
              <rect x="89" y="23" width="14" height="20" rx="1.5" fill="#1e293b" stroke="#a855f7" strokeWidth="0.8" />
              <polygon points="96,26 101,32 98,39 92,38 91,30" fill="rgba(168,85,247,0.45)" stroke="#c084fc" strokeWidth="0.8" />
            </g>
          )}
          {/* Drone / camera feed glow at tier >= 4 */}
          {tier >= 4 && (
            <g>
              <circle cx="60" cy="11" r="2.5" fill="#38bdf8" />
              <line x1="53" y1="11" x2="67" y2="11" stroke="#e2e8f0" strokeWidth="1.2" />
            </g>
          )}
          {/* Console desk */}
          <rect x="22" y="48" width="76" height="6" rx="2" fill="#334155" />
        </g>
      )}

      {/* Level crown/badge on top-left */}
      <g>
        <rect x="5" y="5" width="27" height="12" rx="4" fill="rgba(2, 6, 23, 0.85)" stroke={tier >= 4 ? '#facc15' : tier >= 3 ? '#38bdf8' : 'rgba(255,255,255,0.28)'} strokeWidth="0.9" />
        <text x="18.5" y="13" textAnchor="middle" fill={tier >= 4 ? '#fde047' : '#ffffff'} fontSize="7.5" fontWeight="800">
          Lv.{lv}
        </text>
      </g>

      {/* Condition warning badge when facility needs renovation */}
      {needsRepair && (
        <g>
          <rect x="74" y="5" width="41" height="12" rx="4" fill="rgba(120, 53, 15, 0.92)" stroke="#fbbf24" strokeWidth="0.9" />
          <text x="94.5" y="13" textAnchor="middle" fill="#fef08a" fontSize="6.8" fontWeight="800">
            ควรปรับปรุง
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
