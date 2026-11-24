import React, { useRef, useState } from 'react';
import { PWAInstallButton } from '../pwa.tsx';
import type { GameState, AppSettings } from '../types/game';
import { getSettings, saveSettings, getDefaultMatchSpeed, applyTheme, SFX, refreshAudioSettings, unlockAudio } from '../utils/audioTheme';
import { enterImmersiveFullscreen, exitFullscreenSafe, isMobileDevice } from '../utils/fullscreen';
import { exportSaveCode } from '../engine/saveCodec';

const VIP_UNLOCKED_KEY = 'lk_vip_unlocked';

export const SettingsModal: React.FC<{
  state: GameState;
  onClose: () => void;
  onExitToMenu: () => void;
  onOpenSecretBoost: () => void;
  onToast: (msg: string) => void;
  onSettingsChange?: (next: AppSettings) => void;
}> = ({ state, onClose, onExitToMenu, onOpenSecretBoost, onToast, onSettingsChange }) => {
  const [st, setSt] = useState<AppSettings>(() => getSettings());
  const [saveCode, setSaveCode] = useState('');
  const [vipUnlocked, setVipUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(VIP_UNLOCKED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const vipTapRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });

  const handleSecretVersionTap = () => {
    if (vipUnlocked) {
      SFX.tap();
      onOpenSecretBoost();
      return;
    }
    const now = Date.now();
    const ref = vipTapRef.current;
    ref.count = now - ref.lastTs > 2400 ? 1 : ref.count + 1;
    ref.lastTs = now;
    if (ref.count >= 5) {
      ref.count = 0;
      SFX.win();
      setVipUnlocked(true);
      try {
        sessionStorage.setItem(VIP_UNLOCKED_KEY, '1');
      } catch {
        // ignore
      }
      onToast('🔓 ปลดล็อกโหมดลับผู้สนับสนุน (VIP) แล้ว!');
      onOpenSecretBoost();
    } else if (ref.count >= 3) {
      SFX.tap();
      onToast(`แตะอีก ${5 - ref.count} ครั้ง...`);
    }
  };

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...st, ...patch };
    setSt(next);
    saveSettings(next);
    if ('theme' in patch) applyTheme(next.theme);
    if ('mute' in patch || 'nocrowd' in patch || 'sfxVolume' in patch || 'crowdVolume' in patch) {
      refreshAudioSettings();
    }
    onSettingsChange?.(next);
  };

  const curMatchSpeed = getDefaultMatchSpeed(st);
  const autoFsMobileOn = st.preferFullscreen !== false;
  const onMobile = isMobileDevice();

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-3xl max-h-[95dvh] rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 mland:px-3 mland:py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-sm sm:text-base mland:text-xs font-display">⚙️ ตั้งค่าเกม</h3>
            <button
              type="button"
              onClick={handleSecretVersionTap}
              title="เวอร์ชันแอปพลิเคชัน"
              className={`px-2 py-0.5 rounded-md text-[10px] mland:text-[9px] font-bold transition-colors cursor-pointer select-none ${
                vipUnlocked
                  ? 'bg-[var(--lamp-soft)] text-[#8a5b00] dark:text-[var(--lamp)] border border-[var(--lamp)]/45 hover:brightness-105'
                  : 'text-[var(--mut)]/65 hover:text-[var(--mut)]'
              }`}
            >
              {vipUnlocked ? 'v1.2 · 👑 VIP' : 'v1.2'}
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดตั้งค่า" className="w-7 h-7 mland:w-6 mland:h-6 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer">✕</button>
        </div>

        {/* Organized Horizontal 2-Column Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2 grid grid-cols-2 gap-3 mland:gap-2 items-start">
          {/* Left Column: Match & Audio */}
          <div className="space-y-3 mland:space-y-1.5">
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                <span>⚽</span>
                <span>การแข่งขัน &amp; เสียง</span>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] mland:text-[9.5px] font-semibold text-[var(--mut)]">ความเร็วการแข่งเริ่มต้น</div>
                <div className="grid grid-cols-5 gap-1">
                  {([
                    [0.25, '0.25x'],
                    [0.5, '0.5x'],
                    [1, '1x ปกติ'],
                    [2, '2x เร็ว'],
                    [5, '5x สูงสุด']
                  ] as const).map(([sp, lbl]) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => { SFX.tap(); update({ matchSpeed: sp, quick: sp === 5 }); }}
                      className={`py-2 mland:py-1 px-1 rounded-xl mland:rounded-lg text-[10.5px] mland:text-[9px] font-bold cursor-pointer transition-colors ${
                        curMatchSpeed === sp ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface)] border border-[var(--line)]/70 text-[var(--ink)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { SFX.tap(); update({ autoSkipMatch: !st.autoSkipMatch }); }}
                className={`w-full flex items-center justify-between gap-2.5 p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer ${
                  st.autoSkipMatch ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold">⏭️ ข้ามแข่งอัตโนมัติ</div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">จำลองผลทันทีโดยไม่เปิดหน้าต่างสนาม 2D</div>
                </div>
                <span className={`px-2.5 mland:px-2 py-0.5 rounded-full text-[10.5px] mland:text-[9px] font-bold shrink-0 ${st.autoSkipMatch ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {st.autoSkipMatch ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <div className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]/70 space-y-2 mland:space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10px] font-bold">🎚️ ระดับเสียงเกม</span>
                  <button
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      SFX.whistle();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)] text-[10px] mland:text-[8.5px] font-bold cursor-pointer hover:brightness-95 whitespace-nowrap"
                  >
                    🔊 ทดสอบ
                  </button>
                </div>

                <div className="space-y-1.5 mland:space-y-1">
                  <label className="grid grid-cols-[58px_1fr_34px] mland:grid-cols-[50px_1fr_30px] items-center gap-2 text-[11px] mland:text-[9px]">
                    <span className="text-[var(--mut)] font-semibold truncate">เอฟเฟกต์</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!!st.mute}
                      value={st.sfxVolume ?? 85}
                      onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--g)] h-1.5 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-bold tabular text-right">{st.mute ? 'ปิด' : `${st.sfxVolume ?? 85}%`}</span>
                  </label>

                  <label className="grid grid-cols-[58px_1fr_34px] mland:grid-cols-[50px_1fr_30px] items-center gap-2 text-[11px] mland:text-[9px]">
                    <span className="text-[var(--mut)] font-semibold truncate">เสียงเชียร์</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      disabled={!!st.mute || !!st.nocrowd}
                      value={st.crowdVolume ?? 70}
                      onChange={(e) => update({ crowdVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--g)] h-1.5 cursor-pointer disabled:opacity-40"
                    />
                    <span className="font-bold tabular text-right">{st.mute || st.nocrowd ? 'ปิด' : `${st.crowdVolume ?? 70}%`}</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mland:gap-1 pt-0.5">
                  {(
                    [
                      ['mute', '🔇 ปิดเสียง', !!st.mute],
                      ['nocrowd', '🏟️ ปิดเชียร์', !!st.nocrowd],
                      ['novib', '📳 ปิดสั่น', !!st.novib]
                    ] as [keyof AppSettings, string, boolean][]
                  ).map(([key, label, active]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { unlockAudio(); SFX.tap(); update({ [key]: !active }); }}
                      className={`py-1.5 mland:py-1 px-1.5 rounded-lg text-[10.5px] mland:text-[8.5px] font-bold cursor-pointer transition-colors truncate ${
                        active
                          ? 'bg-[var(--g)] text-white shadow-xs'
                          : 'bg-[var(--surface-2)] text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Display, App Update & Helpers */}
          <div className="space-y-3 mland:space-y-1.5">
            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2.5 mland:space-y-1.5">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                <span>🎨</span>
                <span>หน้าจอ &amp; แอปพลิเคชัน</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mland:gap-1">
                {([['', 'ตามระบบ'], ['light', '☀️ สว่าง'], ['dark', '🌙 มืด']] as const).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => { SFX.tap(); update({ theme: val }); }}
                    className={`py-2 mland:py-1 rounded-xl mland:rounded-lg text-xs mland:text-[10px] font-bold cursor-pointer transition-colors ${
                      (st.theme || '') === val ? 'bg-[var(--g)] text-white shadow-xs' : 'bg-[var(--surface)] border border-[var(--line)]/70'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-no-auto-fs="1"
                onClick={() => {
                  SFX.tap();
                  const nextVal = !autoFsMobileOn;
                  update({ preferFullscreen: nextVal });
                  if (!nextVal) {
                    exitFullscreenSafe().catch(() => undefined);
                    onToast('ปิดเต็มจออัตโนมัติบนมือถือแล้ว');
                  } else if (onMobile) {
                    enterImmersiveFullscreen().catch(() => undefined);
                    onToast('📱 เปิดเต็มจออัตโนมัติบนมือถือแล้ว');
                  } else {
                    onToast('📱 เปิดเต็มจออัตโนมัติแล้ว (ทำงานเมื่อเล่นบนมือถือ)');
                  }
                }}
                className={`w-full flex items-center justify-between gap-2.5 p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg border text-left cursor-pointer transition-colors ${
                  autoFsMobileOn ? 'bg-[var(--g-soft)] border-[var(--g)]/50' : 'bg-[var(--surface)] border-[var(--line)]/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs mland:text-[10px] font-bold truncate">📱 เต็มจออัตโนมัติบนมือถือ</div>
                  <div className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] truncate">
                    {autoFsMobileOn
                      ? onMobile
                        ? 'เข้าเต็มจอและล็อกแนวนอนอัตโนมัติขณะเล่น'
                        : 'พร้อมเข้าเต็มจออัตโนมัติเมื่อเปิดเล่นบนมือถือ'
                      : 'ปิดเต็มจออัตโนมัติ (แสดงแถบเบราว์เซอร์ปกติ)'}
                  </div>
                </div>
                <span className={`px-2.5 mland:px-2 py-0.5 rounded-full text-[10.5px] mland:text-[9px] font-bold shrink-0 ${autoFsMobileOn ? 'bg-[var(--g)] text-white' : 'bg-[var(--surface-2)] text-[var(--mut)]'}`}>
                  {autoFsMobileOn ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <PWAInstallButton variant="settings" onToast={onToast} />
            </div>

            <div className="p-3 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/55 border border-[var(--line)] space-y-2 mland:space-y-1.5">
              <div className="text-xs mland:text-[10px] font-bold text-[var(--ink)] flex items-center gap-1.5">
                <span>💾</span>
                <span>จัดการเซฟเกม</span>
              </div>

              <div className="p-2.5 mland:p-1.5 rounded-xl mland:rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs mland:text-[10px] font-bold truncate">📤 ส่งออกโค้ดเซฟ</div>
                    {saveCode && (
                      <div className="text-[10px] mland:text-[8.5px] text-[var(--g)] font-semibold tabular">
                        ขนาด {saveCode.length.toLocaleString()} ตัวอักษร · คัดลอกแล้ว
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      const code = exportSaveCode(state);
                      setSaveCode(code);
                      navigator.clipboard?.writeText(code).catch(() => undefined);
                      onToast(`สร้างและคัดลอกโค้ดเซฟแบบย่อ (${code.length.toLocaleString()} ตัวอักษร) แล้ว`);
                    }}
                    className="px-3 mland:px-2 py-1 mland:py-0.5 rounded-lg bg-[var(--g)] text-white text-xs mland:text-[9.5px] font-bold cursor-pointer shrink-0"
                  >
                    สร้างโค้ด
                  </button>
                </div>
                {saveCode && (
                  <textarea
                    readOnly
                    value={saveCode}
                    rows={2}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full p-2 mland:p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-mono"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 sm:p-4 mland:p-1.5 bg-[var(--surface-2)] border-t border-[var(--line)] flex gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onExitToMenu();
            }}
            className="flex-1 py-2.5 mland:py-1 rounded-xl bg-[var(--red-soft)] text-[var(--red)] font-bold text-xs mland:text-[10.5px] cursor-pointer"
          >
            🏠 กลับหน้าเมนูหลัก
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 mland:py-1 rounded-xl bg-[var(--g)] text-white font-bold text-xs mland:text-[10.5px] cursor-pointer">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
};

