import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import type { GameModPack, GameState, ModClubOverride, ModRealismSettings } from '../types/game';
import {
  BUILTIN_REALISTIC_MOD_PRESETS,
  DEFAULT_TIER_NAMES,
  applyActiveModToRuntimeData,
  buildTemplateModPack,
  deleteInstalledMod,
  exportModPackJson,
  getActiveMod,
  getEditableClubCatalog,
  getInstalledMods,
  installBuiltinModPreset,
  parseModPackJson,
  saveInstalledMod,
  setActiveModId
} from '../engine/mods';
import { SFX } from '../utils/audioTheme';

interface ModManagerModalProps {
  state?: GameState | null;
  onApplyModToState?: (mod: GameModPack | null) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

export const ModManagerModal: React.FC<ModManagerModalProps> = ({
  state = null,
  onApplyModToState,
  onClose,
  onToast
}) => {
  const [tab, setTab] = useState<'list' | 'import' | 'editor'>('list');
  const [mods, setMods] = useState<GameModPack[]>(() => getInstalledMods());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveMod()?.id ?? null);

  // Import state
  const [importRaw, setImportRaw] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const DEFAULT_CUP_NAMES = {
    fa: 'ถ้วยประชาชน',
    leagueCup: 'ไทยลีก คัพ',
    divCup: 'ถ้วยดิวิชั่น & ภูมิภาค',
    superCup: 'ไทยแลนด์ แชมเปี้ยนส์ คัพ',
    asia: 'ชิงแชมป์สโมสรทวีป'
  };

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edName, setEdName] = useState('Mod ลีกและสโมสรของฉัน');
  const [edAuthor, setEdAuthor] = useState('ผู้เล่น');
  const [edVersion, setEdVersion] = useState('1.0');
  const [edRealism, setEdRealism] = useState<Required<ModRealismSettings>>({
    disableSupernatural: true,
    realisticScoring: true,
    realisticFatigue: true
  });
  const [edTierNames, setEdTierNames] = useState<[string, string, string, string]>([...DEFAULT_TIER_NAMES]);
  const [edCupNames, setEdCupNames] = useState({ ...DEFAULT_CUP_NAMES });
  const [edClubs, setEdClubs] = useState<Record<string, ModClubOverride>>({});
  const [edPlayers, setEdPlayers] = useState<Record<string, string>>({});
  const [clubQuery, setClubQuery] = useState('');
  const [clubScope, setClubScope] = useState<'all' | 'domestic' | 'foreign'>('all');
  const [playerTeamKey, setPlayerTeamKey] = useState<string>('');
  const [batchInput, setBatchInput] = useState('');
  const [batchTarget, setBatchTarget] = useState<'club' | 'player'>('club');

  const catalog = useMemo(() => getEditableClubCatalog(state), [state]);

  const refreshStore = () => {
    const nextMods = getInstalledMods();
    const curActive = getActiveMod();
    setMods(nextMods);
    setActiveId(curActive?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsedImport = useMemo(
    () => (importRaw.trim() ? parseModPackJson(importRaw) : null),
    [importRaw]
  );

  const activeMod = useMemo(
    () => mods.find((m) => m.id === activeId) || null,
    [mods, activeId]
  );

  const loadPackIntoEditor = (pack: GameModPack | null) => {
    if (!pack) {
      setEditingId(null);
      setEdName('Mod ฟุตบอลสมจริงของฉัน');
      setEdAuthor('ผู้เล่น');
      setEdVersion('1.0');
      setEdRealism({
        disableSupernatural: true,
        realisticScoring: true,
        realisticFatigue: true
      });
      setEdTierNames([...DEFAULT_TIER_NAMES]);
      setEdCupNames({ ...DEFAULT_CUP_NAMES });
      setEdClubs({});
      setEdPlayers({});
    } else {
      setEditingId(pack.id);
      setEdName(pack.name);
      setEdAuthor(pack.author || 'ผู้เล่น');
      setEdVersion(pack.version || '1.0');
      setEdRealism({
        disableSupernatural: Boolean(pack.realism?.disableSupernatural),
        realisticScoring: Boolean(pack.realism?.realisticScoring),
        realisticFatigue: Boolean(pack.realism?.realisticFatigue)
      });
      setEdTierNames([
        pack.tierNames?.[0] || DEFAULT_TIER_NAMES[0],
        pack.tierNames?.[1] || DEFAULT_TIER_NAMES[1],
        pack.tierNames?.[2] || DEFAULT_TIER_NAMES[2],
        pack.tierNames?.[3] || DEFAULT_TIER_NAMES[3]
      ]);
      setEdCupNames({
        fa: pack.cupNames?.fa || DEFAULT_CUP_NAMES.fa,
        leagueCup: pack.cupNames?.leagueCup || DEFAULT_CUP_NAMES.leagueCup,
        divCup: pack.cupNames?.divCup || DEFAULT_CUP_NAMES.divCup,
        superCup: pack.cupNames?.superCup || DEFAULT_CUP_NAMES.superCup,
        asia: pack.cupNames?.asia || DEFAULT_CUP_NAMES.asia
      });
      setEdClubs({ ...(pack.clubOverrides || {}) });
      setEdPlayers({ ...(pack.playerOverrides || {}) });
    }
    setTab('editor');
  };

  const handleInstallPreset = (presetId: string) => {
    const installed = installBuiltinModPreset(presetId, true);
    if (!installed) return;
    applyActiveModToRuntimeData(installed);
    if (onApplyModToState) {
      onApplyModToState(installed);
    }
    refreshStore();
    SFX.win();
    onToast(`⚽ ติดตั้งและเปิดใช้ "${installed.name}" แล้ว`);
  };

  const handleActivateMod = (mod: GameModPack | null) => {
    setActiveModId(mod?.id ?? null);
    applyActiveModToRuntimeData(mod);
    if (onApplyModToState) {
      onApplyModToState(mod);
    }
    refreshStore();
    if (mod) {
      SFX.win();
      onToast(`✅ เปิดใช้ Mod "${mod.name}" แล้ว`);
    } else {
      SFX.tap();
      onToast('🔄 ปิดการใช้งาน Mod และคืนค่าชื่อเดิมแล้ว');
    }
  };

  const handleSaveEditorPack = (alsoDownload = false) => {
    const cleanName = edName.trim();
    if (!cleanName) {
      onToast('กรุณาระบุชื่อแพ็ก Mod');
      return;
    }

    const tierNames: Partial<Record<0 | 1 | 2 | 3, string>> = {};
    edTierNames.forEach((val, idx) => {
      const trimmed = val.trim();
      if (trimmed && trimmed !== DEFAULT_TIER_NAMES[idx]) {
        tierNames[idx as 0 | 1 | 2 | 3] = trimmed;
      }
    });

    const cupNames: NonNullable<GameModPack['cupNames']> = {};
    (Object.keys(DEFAULT_CUP_NAMES) as (keyof typeof DEFAULT_CUP_NAMES)[]).forEach((k) => {
      const trimmed = edCupNames[k].trim();
      if (trimmed && trimmed !== DEFAULT_CUP_NAMES[k]) {
        cupNames[k] = trimmed;
      }
    });

    const cleanClubs: Record<string, ModClubOverride> = {};
    Object.entries(edClubs).forEach(([key, ov]) => {
      const base = catalog.find((c) => c.key === key);
      const nextOv: ModClubOverride = {};
      if (ov.name?.trim() && ov.name.trim() !== (base?.defaultName || key)) {
        nextOv.name = ov.name.trim();
      }
      if (ov.stadium?.trim() && ov.stadium.trim() !== (base?.defaultStadium || '')) {
        nextOv.stadium = ov.stadium.trim();
      }
      if (ov.c1 && ov.c1 !== base?.defaultC1) nextOv.c1 = ov.c1;
      if (ov.c2 && ov.c2 !== base?.defaultC2) nextOv.c2 = ov.c2;
      if (Object.keys(nextOv).length > 0) {
        cleanClubs[key] = nextOv;
      }
    });

    const cleanPlayers: Record<string, string> = {};
    Object.entries(edPlayers).forEach(([orig, next]) => {
      const o = orig.trim();
      const n = next.trim();
      if (o && n && o !== n) {
        cleanPlayers[o] = n;
      }
    });

    const saved = saveInstalledMod(
      {
        v: 1,
        id: editingId || `mod_${Date.now()}`,
        name: cleanName,
        author: edAuthor.trim() || 'ผู้เล่น',
        version: edVersion.trim() || '1.0',
        realism: edRealism,
        tierNames,
        cupNames,
        clubOverrides: cleanClubs,
        playerOverrides: cleanPlayers
      },
      true
    );

    setEditingId(saved.id);
    applyActiveModToRuntimeData(saved);
    if (onApplyModToState) {
      onApplyModToState(saved);
    }
    refreshStore();

    if (alsoDownload) {
      downloadTextFile(`${cleanName.replace(/[^\w\u0E00-\u0E7F-]+/g, '_')}.json`, exportModPackJson(saved));
      onToast(`💾 บันทึกและดาวน์โหลด "${saved.name}.json" แล้ว`);
    } else {
      SFX.win();
      onToast(`✅ บันทึกและเปิดใช้ Mod "${saved.name}" แล้ว`);
      setTab('list');
    }
  };

  const handleApplyBatchText = () => {
    const lines = batchInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      onToast('กรุณาวางข้อความรูปแบบ ชื่อเดิม = ชื่อใหม่ ก่อน');
      return;
    }
    let count = 0;
    if (batchTarget === 'club') {
      const next = { ...edClubs };
      lines.forEach((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) return;
        const from = line.slice(0, eqIdx).trim();
        const rhs = line.slice(eqIdx + 1).trim();
        if (!from || !rhs) return;
        const parts = rhs.split('|').map((s) => s.trim());
        const matched = catalog.find(
          (c) => c.key === from || c.defaultName === from || next[c.key]?.name === from
        );
        const key = matched?.key || from;
        next[key] = {
          ...next[key],
          name: parts[0] || next[key]?.name,
          ...(parts[1] ? { stadium: parts[1] } : {})
        };
        count++;
      });
      setEdClubs(next);
    } else {
      const next = { ...edPlayers };
      lines.forEach((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) return;
        const from = line.slice(0, eqIdx).trim();
        const to = line.slice(eqIdx + 1).trim();
        if (!from || !to) return;
        next[from] = to;
        count++;
      });
      setEdPlayers(next);
    }
    if (count > 0) {
      SFX.tap();
      setBatchInput('');
      onToast(`⚡ อัปเดตชื่อสำเร็จ ${count} รายการ (อย่าลืมกดบันทึก Mod)`);
    } else {
      onToast('ไม่พบรูปแบบ ชื่อเดิม = ชื่อใหม่ ที่ถูกต้อง');
    }
  };

  const handleSelectModFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setImportFileName(file.name);
      setImportRaw(text);
      SFX.tap();
    } catch {
      onToast('❌ ไม่สามารถอ่านไฟล์จากเครื่องได้');
    }
  };

  const filteredCatalog = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (clubScope === 'domestic' && item.isForeign) return false;
      if (clubScope === 'foreign' && !item.isForeign) return false;
      if (!q) return true;
      const curName = edClubs[item.key]?.name || '';
      return (
        item.defaultName.toLowerCase().includes(q) ||
        curName.toLowerCase().includes(q) ||
        (item.countryName || '').toLowerCase().includes(q)
      );
    });
  }, [catalog, clubScope, clubQuery, edClubs]);

  return (
    <div
      className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 mland:p-1.5 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-manager-title"
    >
      <div className="w-full max-w-3xl max-h-[calc(var(--app-dvh,1dvh)*94)] rounded-2xl mland:rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 sm:px-5 sm:py-3 mland:px-3 mland:py-2 border-b border-[var(--line)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 mland:gap-2 min-w-0">
            <div className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/45 text-[#9a6700] dark:text-[var(--lamp)] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 id="mod-manager-title" className="font-bold text-sm sm:text-base mland:text-xs font-display text-[var(--ink)] truncate">
                จัดการ Mod &amp; Data Pack (.json)
              </h3>
              <p className="text-[11px] mland:text-[9px] text-[var(--mut)] truncate">
                ปรับแต่งชื่อลีก ชื่อสโมสร ชื่อสนาม และสีชุดแข่งด้วยไฟล์ .json หรือแก้ไขในตัวเกม
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง Mod"
            className="w-9 h-9 mland:w-7 mland:h-7 rounded-xl mland:rounded-lg bg-[var(--surface-2)]/75 border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)] inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 mland:w-3.5 mland:h-3.5" />
          </button>
        </header>

        {/* Active Status + Navigation Bar */}
        <div className="shrink-0 px-4 py-2.5 sm:px-5 mland:px-3 mland:py-1.5 border-b border-[var(--line)]/70 bg-[var(--surface-2)]/45 space-y-2 mland:space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mland:text-[10px]">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-[var(--mut)] font-semibold shrink-0">สถานะปัจจุบัน:</span>
              {activeMod ? (
                <span className="font-extrabold text-[var(--g)] truncate">
                  ✓ เปิดใช้ "{activeMod.name}" (v{activeMod.version || '1.0'} · {Object.keys(activeMod.clubOverrides || {}).length} ทีม)
                </span>
              ) : (
                <span className="font-bold text-[var(--ink)]">ค่าเริ่มต้นของเกม (ไม่ได้เปิดใช้ Mod)</span>
              )}
            </div>
            {activeMod && (
              <button
                type="button"
                onClick={() => handleActivateMod(null)}
                className="btn btn-xs btn-surface text-[var(--red)] border-[var(--red)]/35 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ปิด Mod (กลับค่าเดิม)</span>
              </button>
            )}
          </div>

          <div className="seg-bar grid grid-cols-3 w-full">
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('list'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'list' ? 'seg-btn-active' : ''}`}
            >
              📦 แพ็ก Mod ({mods.length})
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('import'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'import' ? 'seg-btn-active' : ''}`}
            >
              📥 นำเข้า / แม่แบบ
            </button>
            <button
              type="button"
              onClick={() => { SFX.tap(); setTab('editor'); }}
              className={`seg-btn py-1.5 mland:py-1 ${tab === 'editor' ? 'seg-btn-active' : ''}`}
            >
              ✏️ สร้าง / แก้ไข Mod
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 mland:px-3 mland:py-2 space-y-3 mland:space-y-2">
          {tab === 'list' && (
            <div className="space-y-3">
              {/* Built-in Realistic Football Mod Presets */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/45 border border-[var(--lamp)]/45 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    ⚽ แพ็ก Mod ฟุตบอลสมจริงสำเร็จรูป (ติดตั้งใน 1 คลิก)
                  </div>
                  <span className="text-[10px] text-[var(--mut)] font-semibold">ปลอดภัย 100%</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUILTIN_REALISTIC_MOD_PRESETS.map((preset) => {
                    const installedCopy = mods.find((m) => m.id === preset.id);
                    const isPresetActive = activeId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 ${
                          isPresetActive
                            ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/60'
                            : 'bg-[var(--surface)]/90 border-[var(--line)]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-extrabold text-[var(--ink)] leading-snug">{preset.name}</div>
                          <p className="text-[10.5px] text-[var(--mut)] leading-relaxed">{preset.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] font-bold text-[var(--g)]">
                            {isPresetActive ? '✓ เปิดใช้งานอยู่' : installedCopy ? 'ติดตั้งแล้ว' : 'พร้อมติดตั้ง'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInstallPreset(preset.id)}
                            className={`btn btn-xs whitespace-nowrap ${
                              isPresetActive ? 'btn-surface' : 'btn-gold'
                            }`}
                          >
                            {isPresetActive ? 'อัปเดตค่าแนะนำ' : installedCopy ? 'เปิดใช้งาน' : 'ติดตั้ง & เปิดใช้'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {mods.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-2)]/50 p-4 mland:p-3 text-center space-y-2">
                  <div className="text-xs sm:text-sm mland:text-xs font-bold text-[var(--ink)]">
                    ยังไม่มี Mod ที่ปรับแต่งเอง
                  </div>
                  <p className="text-[11px] mland:text-[10px] text-[var(--mut)] max-w-md mx-auto leading-relaxed">
                    คลิกเลือกแพ็กฟุตบอลสมจริงด้านบน หรือสร้าง/นำเข้าไฟล์ .json เพื่อปรับชื่อลีก ชื่อสโมสร และรายชื่อนักเตะตามต้องการ
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        loadPackIntoEditor(null);
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>สร้าง Mod เอง</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SFX.tap();
                        setTab('import');
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>นำเข้าไฟล์ .json</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {mods.map((mod) => {
                    const isActive = mod.id === activeId;
                    const tierCount = Object.keys(mod.tierNames || {}).length;
                    const cupCount = Object.keys(mod.cupNames || {}).length;
                    const clubCount = Object.keys(mod.clubOverrides || {}).length;
                    const playerCount = Object.keys(mod.playerOverrides || {}).length;
                    const hasRealism = Boolean(
                      mod.realism?.disableSupernatural || mod.realism?.realisticScoring || mod.realism?.realisticFatigue
                    );
                    return (
                      <div
                        key={mod.id}
                        className={`p-3 mland:p-2 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 ${
                          isActive
                            ? 'bg-[var(--g-soft)]/55 border-[var(--g)]/60'
                            : 'bg-[var(--surface-2)]/55 border-[var(--line)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm mland:text-xs text-[var(--ink)] truncate">
                              {mod.name}
                            </span>
                            <span className="text-[10.5px] mland:text-[8.5px] text-[var(--mut)] tabular">
                              v{mod.version || '1.0'} · โดย {mod.author || 'ผู้เล่น'}
                            </span>
                          </div>
                          <div className="text-[11px] mland:text-[9px] text-[var(--mut)] tabular">
                            {hasRealism ? '⚽ โหมดสมจริง · ' : ''}
                            ลีก {tierCount} · ถ้วย {cupCount} · สโมสร {clubCount} ทีม
                            {playerCount > 0 ? ` · นักเตะ ${playerCount} คน` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (state && onApplyModToState) {
                                  handleActivateMod(mod);
                                } else {
                                  handleActivateMod(null);
                                }
                              }}
                              className="btn btn-xs btn-primary whitespace-nowrap"
                            >
                              <Check className="w-3 h-3" />
                              <span>{state ? 'อัปเดตลงเซฟนี้' : 'กำลังใช้งาน'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateMod(mod)}
                              className="btn btn-xs btn-gold whitespace-nowrap"
                            >
                              เปิดใช้งาน
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              loadPackIntoEditor(mod);
                            }}
                            title="แก้ไข Mod นี้"
                            className="btn btn-xs btn-surface whitespace-nowrap"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>แก้ไข</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              downloadTextFile(
                                `${mod.name.replace(/[^\w\u0E00-\u0E7F-]+/g, '_')}.json`,
                                exportModPackJson(mod)
                              );
                              onToast(`⬇️ ส่งออก "${mod.name}.json" แล้ว`);
                            }}
                            title="ดาวน์โหลดไฟล์ .json"
                            className="btn btn-xs btn-surface whitespace-nowrap"
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              SFX.tap();
                              const wasActive = mod.id === activeId;
                              deleteInstalledMod(mod.id);
                              if (wasActive && onApplyModToState) {
                                onApplyModToState(null);
                              }
                              refreshStore();
                              onToast(`🗑️ ลบ Mod "${mod.name}" แล้ว`);
                            }}
                            title="ลบ Mod นี้"
                            className="btn btn-xs btn-danger whitespace-nowrap"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'import' && (
            <div className="space-y-3 mland:space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = '';
                  void handleSelectModFile(file);
                }}
              />

              {/* Template Box */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--lamp-soft)]/50 border border-[var(--lamp)]/50 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-[#9a6700] dark:text-[var(--lamp)] shrink-0" />
                    <span>ไฟล์แม่แบบ Mod สำหรับแก้ไขภายนอก (.json)</span>
                  </div>
                  <div className="text-[11px] mland:text-[9px] text-[var(--mut)]">
                    มีรายชื่อลีกและสโมสรทั้งหมดในเกมเตรียมไว้ให้แล้ว นำไปแก้ชื่อ/สีเสื้อ แล้วอัปโหลดกลับมาใช้ได้ทันที
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const json = exportModPackJson(buildTemplateModPack(state));
                      try {
                        await navigator.clipboard.writeText(json);
                        SFX.tap();
                        onToast('📋 คัดลอกแม่แบบ JSON แล้ว');
                      } catch {
                        setImportRaw(json);
                        onToast('วางแม่แบบลงในช่องด้านล่างให้แล้ว');
                      }
                    }}
                    className="btn btn-xs btn-surface whitespace-nowrap"
                  >
                    <Copy className="w-3 h-3" />
                    <span>คัดลอก JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      const tpl = buildTemplateModPack(state);
                      downloadTextFile('looknang_mod_template.json', exportModPackJson(tpl));
                      onToast('⬇️ ดาวน์โหลด looknang_mod_template.json แล้ว');
                    }}
                    className="btn btn-xs btn-gold whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    <span>โหลดแม่แบบ .json</span>
                  </button>
                </div>
              </div>

              {/* Import Box */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs mland:text-[10px] font-bold text-[var(--ink)] truncate">
                    {importFileName ? `ไฟล์ที่เลือก: ${importFileName}` : 'เลือกไฟล์ .json หรือวางโค้ด Mod ด้านล่าง'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      SFX.tap();
                      fileInputRef.current?.click();
                    }}
                    className="btn btn-xs btn-primary shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>เลือกไฟล์ .json</span>
                  </button>
                </div>

                <textarea
                  value={importRaw}
                  onChange={(e) => {
                    setImportFileName('');
                    setImportRaw(e.target.value);
                  }}
                  rows={5}
                  placeholder='{ "v": 1, "name": "My League Pack", "tierNames": { "2": "..." }, "clubOverrides": { ... } }'
                  className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[11px] font-mono text-[var(--ink)]"
                />

                {parsedImport && !parsedImport.ok && (
                  <div className="text-[11px] text-[var(--red)] font-semibold">
                    ❌ {parsedImport.error}
                  </div>
                )}

                {parsedImport && parsedImport.ok && (
                  <div className="p-2.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/45 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[var(--ink)] truncate">
                        ✓ พร้อมติดตั้ง: {parsedImport.pack.name} (v{parsedImport.pack.version || '1.0'})
                      </div>
                      <div className="text-[10.5px] text-[var(--mut)] tabular">
                        แก้ชื่อลีก {Object.keys(parsedImport.pack.tierNames || {}).length} ระดับ · สโมสร {Object.keys(parsedImport.pack.clubOverrides || {}).length} ทีม
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const saved = saveInstalledMod(parsedImport.pack, true);
                        applyActiveModToRuntimeData(saved);
                        if (onApplyModToState) onApplyModToState(saved);
                        refreshStore();
                        setImportRaw('');
                        setImportFileName('');
                        SFX.win();
                        onToast(`✅ ติดตั้งและเปิดใช้ Mod "${saved.name}" แล้ว`);
                        setTab('list');
                      }}
                      className="btn btn-sm btn-primary shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ติดตั้งและเปิดใช้งาน</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="space-y-3 mland:space-y-2">
              {/* Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mland:gap-1.5">
                <label className="space-y-1">
                  <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">ชื่อแพ็ก Mod</span>
                  <input
                    type="text"
                    value={edName}
                    onChange={(e) => setEdName(e.target.value)}
                    className="w-full h-9 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] font-bold text-[var(--ink)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">ผู้สร้าง</span>
                  <input
                    type="text"
                    value={edAuthor}
                    onChange={(e) => setEdAuthor(e.target.value)}
                    className="w-full h-9 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] text-[var(--ink)]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] mland:text-[9px] font-bold text-[var(--mut)]">เวอร์ชัน</span>
                  <input
                    type="text"
                    value={edVersion}
                    onChange={(e) => setEdVersion(e.target.value)}
                    className="w-full h-9 mland:h-7 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs mland:text-[10px] tabular text-[var(--ink)]"
                  />
                </label>
              </div>

              {/* Realism Rules */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--g-soft)]/35 border border-[var(--g)]/35 space-y-2">
                <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                  ⚽ กติกาและความสมจริงของฟุตบอล (Realism Rules)
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs mland:text-[10px]">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edRealism.disableSupernatural}
                      onChange={(e) => setEdRealism((p) => ({ ...p, disableSupernatural: e.target.checked }))}
                      className="mt-0.5 accent-[var(--g)]"
                    />
                    <span className="text-[var(--ink)] font-semibold">
                      ตัดเหตุการณ์แฟนตาซี <span className="text-[var(--mut)] font-normal">(ปิดฟ้าผ่า +50, พรสิ่งศักดิ์สิทธิ์ และปาฏิหาริย์พลิกนรก)</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edRealism.realisticScoring}
                      onChange={(e) => setEdRealism((p) => ({ ...p, realisticScoring: e.target.checked }))}
                      className="mt-0.5 accent-[var(--g)]"
                    />
                    <span className="text-[var(--ink)] font-semibold">
                      สมดุลสกอร์และ xG สมจริง <span className="text-[var(--mut)] font-normal">(สกอร์เฉลี่ยใกล้เคียงลีกจริง แท็กติกและ OVR ตัดสินผลชัด)</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edRealism.realisticFatigue}
                      onChange={(e) => setEdRealism((p) => ({ ...p, realisticFatigue: e.target.checked }))}
                      className="mt-0.5 accent-[var(--g)]"
                    />
                    <span className="text-[var(--ink)] font-semibold">
                      ความล้าและการโรเตชั่นสมจริง <span className="text-[var(--mut)] font-normal">(นักเตะล้าท้ายเกมส่งผลต่อฟอร์มและจำเป็นต้องหมุนเวียนตัว)</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* League Names */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                  🏆 ชื่อลีกทั้ง 4 ระดับ
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                  {([0, 1, 2, 3] as const).map((tierIdx) => (
                    <label key={tierIdx} className="space-y-0.5">
                      <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">
                        ระดับ {tierIdx + 1} (เดิม: {DEFAULT_TIER_NAMES[tierIdx]})
                      </span>
                      <input
                        type="text"
                        value={edTierNames[tierIdx]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEdTierNames((prev) => {
                            const next = [...prev] as [string, string, string, string];
                            next[tierIdx] = val;
                            return next;
                          });
                        }}
                        className="w-full h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Cup Names */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                  🥇 ชื่อรายการฟุตบอลถ้วย
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mland:gap-1.5">
                  {(
                    [
                      ['fa', 'เอฟเอ คัพ / ถ้วยประชาชน'],
                      ['leagueCup', 'ลีก คัพ'],
                      ['divCup', 'ถ้วยดิวิชั่น & ภูมิภาค'],
                      ['superCup', 'ซูเปอร์ คัพ'],
                      ['asia', 'ถ้วยทวีป / นานาชาติ']
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="space-y-0.5">
                      <span className="text-[10px] mland:text-[8.5px] text-[var(--mut)] font-semibold">
                        {label}
                      </span>
                      <input
                        type="text"
                        value={edCupNames[key]}
                        onChange={(e) => setEdCupNames((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full h-8 mland:h-7 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10px] font-semibold text-[var(--ink)]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick Batch Rename */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    ⚡ แก้ชื่อด่วนทีละหลายรายการ (ชื่อเดิม = ชื่อใหม่)
                  </div>
                  <div className="seg-bar bg-[var(--surface)]">
                    <button
                      type="button"
                      onClick={() => setBatchTarget('club')}
                      className={`seg-btn py-0.5 px-2 text-[10px] ${batchTarget === 'club' ? 'seg-btn-active' : ''}`}
                    >
                      สโมสร
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchTarget('player')}
                      className={`seg-btn py-0.5 px-2 text-[10px] ${batchTarget === 'player' ? 'seg-btn-active' : ''}`}
                    >
                      นักเตะ
                    </button>
                  </div>
                </div>
                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  rows={2}
                  placeholder={
                    batchTarget === 'club'
                      ? 'ตัวอย่าง: ลอนดอน รอยัล เอฟซี = ชื่อทีมใหม่ | ชื่อสนามใหม่'
                      : 'ตัวอย่าง: ชื่อนักเตะเดิม = ชื่อนักเตะใหม่'
                  }
                  className="w-full p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-mono text-[var(--ink)]"
                />
                <div className="flex justify-end">
                  <button type="button" onClick={handleApplyBatchText} className="btn btn-xs btn-secondary">
                    นำเข้าบรรทัดนี้เข้า Mod
                  </button>
                </div>
              </div>

              {/* Clubs Editor */}
              <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                    🛡️ แก้ไขชื่อสโมสร สนาม และสีชุดแข่ง ({filteredCatalog.length} ทีม)
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="seg-bar bg-[var(--surface)]">
                      {([
                        ['all', 'ทั้งหมด'],
                        ['domestic', 'ในประเทศ'],
                        ['foreign', 'ต่างชาติ']
                      ] as const).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setClubScope(k)}
                          className={`seg-btn py-0.5 px-2 text-[10px] ${clubScope === k ? 'seg-btn-active' : ''}`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[var(--mut)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={clubQuery}
                        onChange={(e) => setClubQuery(e.target.value)}
                        placeholder="ค้นหาชื่อทีม..."
                        className="h-7 pl-7 pr-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--ink)] w-36 sm:w-44"
                      />
                    </div>
                  </div>
                </div>

                <div className="max-h-60 mland:max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {filteredCatalog.map((item) => {
                    const cur = edClubs[item.key] || {};
                    const patchClub = (patch: Partial<ModClubOverride>) => {
                      setEdClubs((prev) => ({
                        ...prev,
                        [item.key]: {
                          ...prev[item.key],
                          ...patch
                        }
                      }));
                    };
                    return (
                      <div
                        key={item.key}
                        className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 grid grid-cols-1 sm:grid-cols-[150px_1fr_1fr_auto] gap-1.5 items-center"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[var(--ink)] truncate">
                            {item.countryFlag ? `${item.countryFlag} ` : ''}{item.defaultName}
                          </div>
                          <div className="text-[9.5px] text-[var(--mut)] truncate">
                            {item.countryName || DEFAULT_TIER_NAMES[item.tier] || `Tier ${item.tier + 1}`}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={cur.name ?? ''}
                          placeholder={`ชื่อใหม่ (${item.defaultName})`}
                          onChange={(e) => patchClub({ name: e.target.value })}
                          className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                        />

                        <input
                          type="text"
                          value={cur.stadium ?? ''}
                          placeholder={`สนาม (${item.defaultStadium})`}
                          onChange={(e) => patchClub({ stadium: e.target.value })}
                          className="h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                        />

                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="color"
                            title="สีชุดหลัก"
                            value={cur.c1 || item.defaultC1}
                            onChange={(e) => patchClub({ c1: e.target.value })}
                            className="w-7 h-7 p-0.5 rounded border border-[var(--line)] bg-transparent cursor-pointer"
                          />
                          <input
                            type="color"
                            title="สีชุดรอง"
                            value={cur.c2 || item.defaultC2}
                            onChange={(e) => patchClub({ c2: e.target.value })}
                            className="w-7 h-7 p-0.5 rounded border border-[var(--line)] bg-transparent cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Players Editor (when save teams exist) */}
              {state && state.teams && state.teams.length > 0 && (
                <div className="p-3 mland:p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs mland:text-[10px] font-extrabold text-[var(--ink)]">
                      👤 แก้ชื่อนักเตะในเซฟนี้ ({Object.keys(edPlayers).length} คน)
                    </div>
                    <select
                      value={playerTeamKey || (state.teams[state.me]?.origName || state.teams[state.me]?.name || '')}
                      onChange={(e) => setPlayerTeamKey(e.target.value)}
                      className="h-7 px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] font-semibold text-[var(--ink)] max-w-[220px]"
                    >
                      {state.teams
                        .slice()
                        .sort((a, b) => a.tier - b.tier || a.id - b.id)
                        .map((t) => {
                          const k = t.origName || t.name;
                          return (
                            <option key={t.id} value={k}>
                              {t.name} ({t.sq.length})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                    {(
                      state.teams.find(
                        (t) =>
                          (t.origName || t.name) ===
                          (playerTeamKey || state.teams[state.me]?.origName || state.teams[state.me]?.name)
                      )?.sq || []
                    ).map((pl) => {
                      const origP = pl.origName || pl.n;
                      return (
                        <div
                          key={origP}
                          className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)]/80 flex items-center gap-1.5"
                        >
                          <span className="text-[10px] font-bold text-[var(--mut)] w-7 shrink-0">{pl.pos}</span>
                          <input
                            type="text"
                            value={edPlayers[origP] ?? ''}
                            placeholder={origP}
                            onChange={(e) =>
                              setEdPlayers((prev) => ({
                                ...prev,
                                [origP]: e.target.value
                              }))
                            }
                            className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--surface-2)]/70 border border-[var(--line)] text-[11px] text-[var(--ink)]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-4 py-3 sm:px-5 mland:px-3 mland:py-2 border-t border-[var(--line)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2">
          {tab === 'editor' ? (
            <>
              <button
                type="button"
                onClick={() => handleSaveEditorPack(true)}
                className="btn btn-sm btn-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                <span>บันทึก &amp; ส่งออก .json</span>
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={onClose} className="btn btn-sm btn-surface">
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditorPack(false)}
                  className="btn btn-sm btn-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>บันทึก &amp; เปิดใช้ Mod</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-end w-full">
              <button type="button" onClick={onClose} className="btn btn-sm btn-primary min-w-[100px]">
                <Check className="w-3.5 h-3.5" />
                <span>ตกลง</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
