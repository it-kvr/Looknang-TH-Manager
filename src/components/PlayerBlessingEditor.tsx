import React, { useEffect, useRef, useState } from 'react';
import type { Position, SubRole, StatKey, CoreAttrs, Player, Team, GameState } from '../types/game';
import { clamp } from '../utils/math';
import { ATT, LINE, ALL_SUB_ROLES, SPN, FOOTBALL_TRAITS } from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { OVF, dtInfo, rollPlayerTraits } from '../engine/playerCore';
import { ovColor, statTierMeta, getPlayerTalent } from '../engine/missions';
import { applyGodBlessingToPlayer, resetGodBlessingOnPlayer } from '../engine/blessings';

export const PlayerBlessingEditor: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onSaved?: () => void;
}> = ({ player, team, state, onUpdateState, onToast, onSaved }) => {
  const isMePlayer = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const initInfo = dtInfo(player, isMePlayer ? state.p : null);

  const [ro, setRo] = useState<SubRole>(player.ro || 'CM');
  const [sig, setSig] = useState<string>(initInfo.D0.sig || 'fin');
  const [ov, setOv] = useState<number>(player.ov || 60);
  const [pot, setPot] = useState<number>(Math.max(player.pot || player.ov || 65, player.ov || 60));
  const [talent, setTalent] = useState<number>(() => getPlayerTalent(player, isMePlayer ? state.p : null));
  const [traits, setTraits] = useState<string[]>(() => initInfo.traits.map((t) => t.id));
  const [age, setAge] = useState<number>(player.age || 24);
  const [fit, setFit] = useState<number>(Math.round(player.fit ?? 100));
  const [inj, setInj] = useState<number>(player.inj || 0);
  const [sus, setSus] = useState<number>(player.sus || 0);
  const [coreA, setCoreA] = useState<CoreAttrs>(() => ({ ...initInfo.a }));
  const [subD, setSubD] = useState<Record<string, number>>(() => ({ ...initInfo.D0.d }));

  const calcCoreFromSub = (pos: Position, sub: Record<string, number>, fb: CoreAttrs): CoreAttrs => {
    const g = (k: string, d = 60) => sub[k] ?? d;
    if (pos === 'GK') {
      return {
        sh: fb.sh,
        ps: g('dist') * 0.75 + g('cl') * 0.25,
        dr: g('spd') * 0.6 + g('cl') * 0.4,
        tk: g('cl') * 0.6 + g('sv') * 0.4,
        ph: g('sv') * 0.5 + g('str') * 0.25 + g('sta') * 0.25
      };
    }
    return {
      sh: g('fin') * 0.36 + g('pw') * 0.23 + g('cur') * 0.18 + g('run') * 0.13 + g('fk') * 0.10,
      ps: g('crs') * 0.40 + g('cur') * 0.25 + g('rd') * 0.22 + g('fk') * 0.13,
      dr: g('spd') * 0.45 + g('run') * 0.25 + g('cur') * 0.15 + g('crs') * 0.15,
      tk: g('pos') * 0.3 + g('mrk') * 0.25 + g('rd') * 0.25 + g('blk') * 0.2,
      ph: g('str') * 0.35 + g('sta') * 0.3 + g('hd') * 0.2 + g('spd') * 0.15
    };
  };

  const subAnchorRef = useRef<{ core: CoreAttrs; raw: CoreAttrs }>({
    core: { ...initInfo.a },
    raw: calcCoreFromSub(LINE[player.ro || 'CM'] || player.pos, initInfo.D0.d, initInfo.a)
  });

  useEffect(() => {
    const nextMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
    const nextInfo = dtInfo(player, nextMe ? state.p : null);
    const nextRo = player.ro || 'CM';
    const nextPos = LINE[nextRo] || player.pos;
    setRo(nextRo);
    setSig(nextInfo.D0.sig || 'fin');
    setOv(player.ov || 60);
    setPot(Math.max(player.pot || player.ov || 65, player.ov || 60));
    setTalent(getPlayerTalent(player, nextMe ? state.p : null));
    setTraits(nextInfo.traits.map((t) => t.id));
    setAge(player.age || 24);
    setFit(Math.round(player.fit ?? 100));
    setInj(player.inj || 0);
    setSus(player.sus || 0);
    setCoreA({ ...nextInfo.a });
    setSubD({ ...nextInfo.D0.d });
    subAnchorRef.current = {
      core: { ...nextInfo.a },
      raw: calcCoreFromSub(nextPos, nextInfo.D0.d, nextInfo.a)
    };
  }, [player.n, team?.id]);

  const curPos = LINE[ro] || player.pos;

  const shiftAllStatsBy = (delta: number) => {
    SFX.tap();
    const nextOv = clamp(ov + delta, 1, 99);
    const nextCore: CoreAttrs = {
      sh: clamp(coreA.sh + delta, 1, 99),
      ps: clamp(coreA.ps + delta, 1, 99),
      dr: clamp(coreA.dr + delta, 1, 99),
      tk: clamp(coreA.tk + delta, 1, 99),
      ph: clamp(coreA.ph + delta, 1, 99)
    };
    const nextSub: Record<string, number> = {};
    Object.keys(subD).forEach((k) => {
      nextSub[k] = clamp(subD[k] + delta, 1, 99);
    });
    setOv(nextOv);
    setPot((p) => clamp(Math.max(p + (delta > 0 ? delta : 0), nextOv), 1, 99));
    setCoreA(nextCore);
    setSubD(nextSub);
    subAnchorRef.current = { core: nextCore, raw: calcCoreFromSub(curPos, nextSub, nextCore) };
  };

  const handleOvChange = (nextOvVal: number) => {
    const clampedOv = clamp(nextOvVal, 1, 99);
    const diff = clampedOv - ov;
    setOv(clampedOv);
    if (clampedOv > pot) setPot(clampedOv);
    if (diff !== 0) {
      const nextCore: CoreAttrs = {
        sh: clamp(coreA.sh + diff, 1, 99),
        ps: clamp(coreA.ps + diff, 1, 99),
        dr: clamp(coreA.dr + diff, 1, 99),
        tk: clamp(coreA.tk + diff, 1, 99),
        ph: clamp(coreA.ph + diff, 1, 99)
      };
      const nextSub: Record<string, number> = {};
      Object.keys(subD).forEach((k) => {
        nextSub[k] = clamp(subD[k] + diff, 1, 99);
      });
      setCoreA(nextCore);
      setSubD(nextSub);
      subAnchorRef.current = { core: nextCore, raw: calcCoreFromSub(curPos, nextSub, nextCore) };
    }
  };

  const handleCoreChange = (key: StatKey, val: number) => {
    const clamped = clamp(val, 1, 99);
    const diff = clamped - coreA[key];
    const nextCore = { ...coreA, [key]: clamped };
    setCoreA(nextCore);
    const computedOv = clamp(OVF(curPos, nextCore), 1, 99);
    setOv(computedOv);
    if (computedOv > pot) setPot(computedOv);
    let nextSub = subD;
    if (diff !== 0) {
      const linkMap: Record<StatKey, string[]> = {
        sh: ['fin', 'pw', 'cur', 'fk', 'run'],
        ps: ['crs', 'dist', 'rd', 'fk'],
        dr: ['spd', 'run', 'cur'],
        tk: ['rd', 'pos', 'mrk', 'blk'],
        ph: ['str', 'sta', 'hd', 'tol', 'sv']
      };
      nextSub = { ...subD };
      (linkMap[key] || []).forEach((sk) => {
        if (nextSub[sk] != null) nextSub[sk] = clamp(nextSub[sk] + Math.round(diff * 0.7), 1, 99);
      });
      setSubD(nextSub);
    }
    subAnchorRef.current = { core: nextCore, raw: calcCoreFromSub(curPos, nextSub, nextCore) };
  };

  const handleSubChange = (sk: string, val: number) => {
    const clampedVal = clamp(Math.round(val), 1, 99);
    const nextSub = { ...subD, [sk]: clampedVal };
    setSubD(nextSub);
    const anchor = subAnchorRef.current;
    const rawNow = calcCoreFromSub(curPos, nextSub, coreA);
    const nextCore: CoreAttrs = { ...coreA };
    (['sh', 'ps', 'dr', 'tk', 'ph'] as StatKey[]).forEach((k) => {
      if (curPos === 'GK' && k === 'sh') return;
      const initR = anchor.raw[k];
      const offset = anchor.core[k] - initR;
      const diffFromAnchor = rawNow[k] - initR;
      const scale =
        diffFromAnchor >= 0
          ? initR >= 99
            ? 0
            : clamp((99 - rawNow[k]) / Math.max(1, 99 - initR), 0, 1)
          : initR <= 1
            ? 0
            : clamp((rawNow[k] - 1) / Math.max(1, initR - 1), 0, 1);
      nextCore[k] = clamp(Math.round(rawNow[k] + offset * scale), 1, 99);
    });
    setCoreA(nextCore);
    const computedOv = clamp(OVF(curPos, nextCore), 1, 99);
    setOv(computedOv);
    if (computedOv > pot) setPot(computedOv);
  };

  const handleRoleChange = (nextRo: SubRole) => {
    setRo(nextRo);
    const nextPos = LINE[nextRo] || curPos;
    const computedOv = clamp(OVF(nextPos, coreA), 1, 99);
    setOv(computedOv);
    if (computedOv > pot) setPot(computedOv);
    subAnchorRef.current = { core: coreA, raw: calcCoreFromSub(nextPos, subD, coreA) };
  };

  const applyMax99 = () => {
    SFX.win();
    const maxCore: CoreAttrs = { sh: 99, ps: 99, dr: 99, tk: 99, ph: 99 };
    const maxSub: Record<string, number> = {};
    Object.keys(subD).forEach((k) => {
      maxSub[k] = 99;
    });
    setOv(99);
    setPot(99);
    setTalent(99);
    setFit(100);
    setInj(0);
    setSus(0);
    setCoreA(maxCore);
    setSubD(maxSub);
    subAnchorRef.current = { core: maxCore, raw: calcCoreFromSub(curPos, maxSub, maxCore) };
  };

  const subGroups: [string, [string, string][]][] = [
    ...(curPos === 'GK'
      ? [['🧤 ผู้รักษาประตู', [['sv', 'เซฟ'], ['cl', 'ออกมาปิดมุม'], ['dist', 'จ่ายจากแนวหลัง']]] as [string, [string, string][]]]
      : ([
          ['⚔️ โจมตี', [['pw', 'พลังยิง'], ['fin', 'จบสกอร์'], ['cur', 'ยิงโค้ง'], ['fk', 'ลูกตั้งเตะ'], ['crs', 'เปิดบอล'], ['run', 'เข้าทำตำแหน่ง']]],
          ['🛡️ ป้องกัน & กลางอากาศ', [['rd', 'อ่านเกม'], ['pos', 'สกัด/ยืนตำแหน่ง'], ['mrk', 'ประกบตัว'], ['blk', 'บล็อกลูกยิง'], ['hd', 'โหม่ง']]]
        ] as [string, [string, string][]][])),
    ['💪 ร่างกาย & ฟื้นตัว', [['spd', 'ความเร็ว'], ['str', 'ความแข็งแรง'], ['sta', 'ความอึด'], ['tol', 'ทนต่อบาดเจ็บ'], ['rec', 'ฟื้นตัวเร็ว']]],
    ['🌟 จิตใจ', [['comp', 'นิ่งในนัดใหญ่']]]
  ];

  const handleSave = () => {
    SFX.win();
    vibrate(35);
    const tid = team ? team.id : null;
    onUpdateState((d) => {
      applyGodBlessingToPlayer(d, player.n, tid, {
        ov,
        pot,
        talent,
        traits,
        age,
        fit,
        inj,
        sus,
        ro,
        sig,
        coreA,
        subD
      });
    });
    onToast(`✨ มอบพรของพระเจ้าให้ ${player.n} (OVR ${ov}) สำเร็จ!`);
    onSaved?.();
  };

  const handleReset = () => {
    SFX.tap();
    const tid = team ? team.id : null;
    onUpdateState((d) => {
      resetGodBlessingOnPlayer(d, player.n, tid);
    });
    onToast(`🔄 คืนค่าพลังพื้นฐานให้ ${player.n} แล้ว`);
    onSaved?.();
  };

  return (
    <div className="space-y-3 mland:space-y-2">
      {/* Quick Miracle Bar */}
      <div className="p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-gradient-to-r from-[var(--lamp-soft)]/70 via-[var(--surface-2)] to-[var(--g-soft)] border border-[var(--lamp)]/45 space-y-2 mland:space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs mland:text-[10.5px] font-bold text-[#8a5b00] dark:text-[var(--lamp)] flex items-center gap-1.5">
            <span>✨ พรของพระเจ้า · ปรับแต่งค่าพลังเฉพาะตัว</span>
            <span className="px-2 py-0.5 rounded-lg text-white text-[11px] font-extrabold tabular" style={{ background: ovColor(ov) }}>
              OVR {ov}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => shiftAllStatsBy(5)} className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-[10.5px] font-bold cursor-pointer">
              ⚡ +5 ทุกค่า
            </button>
            <button type="button" onClick={() => shiftAllStatsBy(10)} className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--g)] text-[10.5px] font-bold cursor-pointer">
              🔥 +10 ทุกค่า
            </button>
            <button type="button" onClick={applyMax99} className="px-2.5 py-1 rounded-lg bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] text-[10.5px] font-extrabold cursor-pointer shadow-xs">
              👑 เทพ 99
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setFit(100);
                setInj(0);
                setSus(0);
              }}
              className="px-2 py-1 rounded-lg bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35 text-[10.5px] font-bold cursor-pointer"
            >
              💚 ฟิต 100% / หายเจ็บ
            </button>
          </div>
        </div>

        {/* Role, Signature & Basic Vitals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5">
          <label className="block space-y-0.5">
            <span className="text-[10px] font-semibold text-[var(--mut)]">ตำแหน่ง / บทบาท</span>
            <select
              value={ro}
              onChange={(e) => handleRoleChange(e.target.value as SubRole)}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold"
            >
              {ALL_SUB_ROLES.map((rKey) => (
                <option key={rKey} value={rKey}>
                  {rKey} · {SPN[rKey] || rKey}
                </option>
              ))}
            </select>
          </label>

          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--mut)] font-semibold">🌟 พรสวรรค์ (TL)</span>
              <b className={`tabular text-xs ${statTierMeta(talent).textClass}`}>{talent}</b>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setTalent((v) => clamp(v - 1, 25, 99))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <input type="range" min={25} max={99} value={talent} onChange={(e) => setTalent(Number(e.target.value))} className="flex-1 accent-[var(--g)] min-w-0" />
              <button type="button" onClick={() => setTalent((v) => clamp(v + 1, 25, 99))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--mut)] font-semibold">OVR รวม</span>
              <b className={`tabular text-xs ${statTierMeta(ov).textClass}`}>{ov}</b>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => handleOvChange(ov - 1)} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <input type="range" min={1} max={99} value={ov} onChange={(e) => handleOvChange(Number(e.target.value))} className="flex-1 accent-[var(--g)] min-w-0" />
              <button type="button" onClick={() => handleOvChange(ov + 1)} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>

          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--mut)] font-semibold">ศักยภาพ (POT)</span>
              <b className={`tabular text-xs ${statTierMeta(pot).textClass}`}>{pot}</b>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPot((v) => clamp(v - 1, 1, 99))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <input type="range" min={1} max={99} value={pot} onChange={(e) => setPot(Number(e.target.value))} className="flex-1 accent-[var(--lamp)] min-w-0" />
              <button type="button" onClick={() => setPot((v) => clamp(v + 1, 1, 99))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>
        </div>

        {/* Multi Football Traits Selector */}
        <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold text-[var(--ink)]">
              🎭 นิสัยลูกหนัง / จุดเด่น ({traits.length}/5) <span className="font-normal text-[var(--mut)]">· มีผลจริงในการแข่งขัน</span>
            </span>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setTraits(rollPlayerTraits(curPos, ro, ov, talent));
              }}
              className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--g)] text-[10px] font-bold cursor-pointer"
            >
              🎲 สุ่มตามตำแหน่ง
            </button>
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
            {FOOTBALL_TRAITS.filter((tr) => !tr.pos || tr.pos.includes(curPos) || traits.includes(tr.id)).map((tr) => {
              const active = traits.includes(tr.id);
              return (
                <button
                  key={tr.id}
                  type="button"
                  title={tr.desc}
                  onClick={() => {
                    SFX.tap();
                    setTraits((prev) =>
                      prev.includes(tr.id)
                        ? prev.filter((id) => id !== tr.id)
                        : prev.length >= 5
                          ? [...prev.slice(1), tr.id]
                          : [...prev, tr.id]
                    );
                  }}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                    active
                      ? ['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler'].includes(tr.id)
                        ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] text-[#8a5b00] dark:text-[var(--lamp)]'
                        : 'bg-[var(--g)] text-white border-[var(--g)]'
                      : 'bg-[var(--surface-2)]/80 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tr.icon} {tr.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5">
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">อายุ</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAge((v) => clamp(v - 1, 15, 45))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <span className="text-xs font-bold tabular w-6 text-center">{age}</span>
              <button type="button" onClick={() => setAge((v) => clamp(v + 1, 15, 45))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">ความฟิต</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setFit((v) => clamp(v - 5, 1, 100))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <span className="text-xs font-bold tabular w-8 text-center">{fit}%</span>
              <button type="button" onClick={() => setFit((v) => clamp(v + 5, 1, 100))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">บาดเจ็บ (นัด)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setInj((v) => Math.max(0, v - 1))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <span className="text-xs font-bold tabular w-5 text-center">{inj}</span>
              <button type="button" onClick={() => setInj((v) => Math.min(20, v + 1))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">โทษแบน (นัด)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSus((v) => Math.max(0, v - 1))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">-</button>
              <span className="text-xs font-bold tabular w-5 text-center">{sus}</span>
              <button type="button" onClick={() => setSus((v) => Math.min(10, v + 1))} className="w-5 h-5 rounded bg-[var(--surface-2)] text-xs font-bold cursor-pointer">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Core Attributes */}
      <div className="p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)] space-y-2">
        <div className="text-xs mland:text-[10.5px] font-bold flex items-center justify-between">
          <span>🎯 ค่าพลังหลัก 5 ด้าน</span>
          <span className="text-[10px] font-normal text-[var(--mut)]">ปรับแล้วคำนวณ OVR ให้อัตโนมัติ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 mland:grid-cols-5 gap-2 mland:gap-1">
          {ATT.map(([k, lbl]) => {
            const val = coreA[k];
            return (
              <div key={k} className="p-2 mland:p-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1">
                <div className="flex items-center justify-between text-xs mland:text-[10px]">
                  <span className="font-semibold text-[var(--mut)]">{lbl}</span>
                  <b className={`tabular font-extrabold ${statTierMeta(val).textClass}`}>{val}</b>
                </div>
                <input
                  type="range"
                  min={1}
                  max={99}
                  value={val}
                  onChange={(e) => handleCoreChange(k, Number(e.target.value))}
                  className="w-full accent-[var(--g)]"
                />
                <div className="flex justify-between gap-1">
                  <button type="button" onClick={() => handleCoreChange(k, val - 1)} className="flex-1 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-bold cursor-pointer">-1</button>
                  <button type="button" onClick={() => handleCoreChange(k, val + 1)} className="flex-1 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-bold cursor-pointer">+1</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Sub-attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mland:gap-1.5">
        {subGroups.map(([grp, rows]) => (
          <div key={grp} className="p-2.5 mland:p-2 rounded-2xl mland:rounded-xl bg-[var(--surface-2)]/75 border border-[var(--line)] space-y-1.5">
            <div className="font-bold text-xs mland:text-[10.5px] pb-1 border-b border-[var(--line)]/70">{grp}</div>
            <div className="space-y-1.5">
              {rows.map(([sk, lbl]) => {
                const v = clamp(Math.round(subD[sk] ?? 60), 1, 99);
                return (
                  <div key={sk} className="flex items-center gap-1.5 text-[11px] mland:text-[10px]">
                    <span className="w-24 shrink-0 truncate text-[var(--ink)]">
                      {lbl}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSubChange(sk, v - 1)}
                      className="w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={99}
                      value={v}
                      onChange={(e) => handleSubChange(sk, Number(e.target.value))}
                      className="flex-1 min-w-0 accent-[var(--g)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSubChange(sk, v + 1)}
                      className="w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      +
                    </button>
                    <span className={`w-6 text-right font-extrabold tabular shrink-0 ${statTierMeta(v).textClass}`}>
                      {v}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save / Reset Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {player.blessed ? (
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 mland:py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--red)] text-xs mland:text-[10.5px] font-bold text-[var(--red)] cursor-pointer"
          >
            🔄 คืนค่าเดิม
          </button>
        ) : (
          <span className="text-[11px] text-[var(--mut)]">ปรับแล้วมีผลทันทีทั้งในสนาม 2D และสถิติ</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="ml-auto px-5 py-2 mland:py-1.5 rounded-xl bg-gradient-to-b from-[#fad05a] to-[#eab308] text-[#261900] border border-[#ca8a04]/40 text-xs sm:text-sm mland:text-xs font-extrabold shadow-sm hover:brightness-105 cursor-pointer"
        >
          ✨ บันทึกพรของพระเจ้า ({player.n.split(' ')[0]})
        </button>
      </div>
    </div>
  );
};
