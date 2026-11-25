import React, { useEffect, useRef, useState } from 'react';
import type { Position, SubRole, StatKey, CoreAttrs, Player, Team, GameState, PreferredFoot } from '../types/game';
import { clamp } from '../utils/math';
import {
  ATT,
  LINE,
  ALL_SUB_ROLES,
  SPN,
  SIGL,
  FOOTBALL_TRAITS,
  PLAYER_PERSONALITIES,
  CAREER_PERKS,
  SKIN_P,
  HAIR_P,
  HS_N,
  FH_N,
  FS_N,
  EY_N,
  ACC_N
} from '../data/thaiFootballData';
import { SFX, vibrate } from '../utils/audioTheme';
import { OVF, dtInfo, rollPlayerTraits, rollPlayerBio, getPlayerBio, visOf, rndVis } from '../engine/playerCore';
import { ovColor, statTierMeta, getPlayerTalent } from '../engine/missions';
import { applyGodBlessingToPlayer, resetGodBlessingOnPlayer } from '../engine/blessings';
import { PlayerFace } from './SvgVisuals';
import { FootPairIcon, getFootColorMeta } from './PlayerBioStrip';

const RISKY_TRAIT_IDS = new Set(['hot_headed', 'selfish_shooter', 'glass_cannon', 'slide_tackler', 'risk_taker']);
const GK_SIG_KEYS = ['sv', 'rfx', 'cl', 'dist', 'spass', 'lpass', 'sta', 'comp'];

export const PlayerBlessingEditor: React.FC<{
  player: Player;
  team: Team | null;
  state: GameState;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
  onSaved?: () => void;
}> = ({ player, team, state, onUpdateState, onToast, onSaved }) => {
  const isMePlayer = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
  const careerRef = isMePlayer ? state.p : null;
  const initInfo = dtInfo(player, careerRef);

  const [ro, setRo] = useState<SubRole>(player.ro || 'CM');
  const [sig, setSig] = useState<string>(initInfo.D0.sig || 'fin');
  const [ov, setOv] = useState<number>(player.ov || 60);
  const [pot, setPot] = useState<number>(Math.max(player.pot || player.ov || 65, player.ov || 60));
  const [talent, setTalent] = useState<number>(() => getPlayerTalent(player, careerRef));
  const [traits, setTraits] = useState<string[]>(() => initInfo.traits.map((t) => t.id));
  const [customPers, setCustomPers] = useState<number>(initInfo.D0.tr);
  const [altRoles, setAltRoles] = useState<SubRole[]>(() =>
    isMePlayer && state.p?.altRoles ? [...state.p.altRoles] : player.altRoles ? [...player.altRoles] : []
  );
  const [vis, setVis] = useState<number[]>(() => visOf(player, careerRef));
  const [perks, setPerks] = useState<string[]>(() => (isMePlayer && state.p?.perks ? [...state.p.perks] : []));
  const [traitSearch, setTraitSearch] = useState('');
  const [traitFilterPos, setTraitFilterPos] = useState(true);
  const [showAppearance, setShowAppearance] = useState(false);

  const [age, setAge] = useState<number>(player.age || 24);
  const [ht, setHt] = useState<number>(() => initInfo.bio.heightCm);
  const [wt, setWt] = useState<number>(() => initInfo.bio.weightKg);
  const [foot, setFoot] = useState<PreferredFoot>(() => initInfo.bio.foot);
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
        ps: g('dist') * 0.52 + g('spass') * 0.2 + g('lpass') * 0.18 + g('cl') * 0.1,
        dr: g('spd') * 0.3 + g('acc') * 0.25 + g('agi') * 0.2 + g('rfx') * 0.25,
        tk: g('cl') * 0.5 + g('sv') * 0.3 + g('rfx') * 0.2,
        ph: g('sv') * 0.38 + g('str') * 0.2 + g('sta') * 0.2 + g('jmp') * 0.12 + g('rfx') * 0.1
      };
    }
    return {
      sh: g('fin') * 0.32 + g('pw') * 0.2 + g('cur') * 0.15 + g('lsh') * 0.13 + g('run') * 0.12 + g('fk') * 0.08,
      ps: g('spass') * 0.24 + g('lpass') * 0.2 + g('crs') * 0.16 + g('ctrl') * 0.14 + g('vis') * 0.14 + g('fk') * 0.12,
      dr: g('drb') * 0.28 + g('ctrl') * 0.18 + g('spd') * 0.2 + g('acc') * 0.14 + g('agi') * 0.12 + g('run') * 0.08,
      tk: g('tkl') * 0.26 + g('pos') * 0.22 + g('mrk') * 0.2 + g('rd') * 0.18 + g('blk') * 0.14,
      ph: g('str') * 0.26 + g('sta') * 0.22 + g('hd') * 0.16 + g('jmp') * 0.14 + g('spd') * 0.12 + g('acc') * 0.1
    };
  };

  const subAnchorRef = useRef<{ core: CoreAttrs; raw: CoreAttrs }>({
    core: { ...initInfo.a },
    raw: calcCoreFromSub(LINE[player.ro || 'CM'] || player.pos, initInfo.D0.d, initInfo.a)
  });

  useEffect(() => {
    const nextMe = !!player.me || (state.mode === 'p' && state.p?.name === player.n);
    const nextCareer = nextMe ? state.p : null;
    const nextInfo = dtInfo(player, nextCareer);
    const nextRo = player.ro || 'CM';
    const nextPos = LINE[nextRo] || player.pos;
    setRo(nextRo);
    setSig(nextInfo.D0.sig || (nextPos === 'GK' ? 'sv' : 'fin'));
    setOv(player.ov || 60);
    setPot(Math.max(player.pot || player.ov || 65, player.ov || 60));
    setTalent(getPlayerTalent(player, nextCareer));
    setTraits(nextInfo.traits.map((t) => t.id));
    setCustomPers(nextInfo.D0.tr);
    setAltRoles(
      nextMe && state.p?.altRoles ? [...state.p.altRoles] : player.altRoles ? [...player.altRoles] : []
    );
    setVis(visOf(player, nextCareer));
    setPerks(nextMe && state.p?.perks ? [...state.p.perks] : []);
    setTraitSearch('');
    setAge(player.age || 24);
    const nextBio = getPlayerBio(player, nextCareer);
    setHt(nextBio.heightCm);
    setWt(nextBio.weightKg);
    setFoot(nextBio.foot);
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
  const persDef = PLAYER_PERSONALITIES[customPers] || PLAYER_PERSONALITIES[3];

  const sigOptions = Object.keys(SIGL).filter((k) =>
    curPos === 'GK' ? GK_SIG_KEYS.includes(k) : !['sv', 'rfx', 'cl', 'dist'].includes(k)
  );

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
        sh: ['fin', 'pw', 'cur', 'lsh', 'fk', 'run'],
        ps: ['spass', 'lpass', 'crs', 'ctrl', 'dist', 'rd', 'fk', 'vis'],
        dr: ['drb', 'ctrl', 'spd', 'acc', 'agi', 'run', 'bal'],
        tk: ['rd', 'tkl', 'pos', 'mrk', 'blk'],
        ph: ['str', 'sta', 'acc', 'jmp', 'hd', 'tol', 'end', 'sv', 'rfx']
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
    const nextSigPool = Object.keys(SIGL).filter((k) =>
      nextPos === 'GK' ? GK_SIG_KEYS.includes(k) : !['sv', 'rfx', 'cl', 'dist'].includes(k)
    );
    if (!nextSigPool.includes(sig)) {
      setSig(nextPos === 'GK' ? 'sv' : 'fin');
    }
    setAltRoles((prev) =>
      prev.filter((r) => r !== nextRo && (nextPos === 'GK' ? LINE[r] === 'GK' : LINE[r] !== 'GK'))
    );
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
      ? [[
          '🧤 ผู้รักษาประตู',
          [
            ['sv', 'เซฟ'],
            ['rfx', 'ปฏิกิริยา'],
            ['cl', 'ออกมาปิดมุม'],
            ['dist', 'จ่ายจากแนวหลัง'],
            ['spass', 'ส่งบอลสั้น'],
            ['lpass', 'ส่งบอลยาว']
          ]
        ] as [string, [string, string][]]]
      : ([
          [
            '⚔️ โจมตี',
            [
              ['fin', 'จบสกอร์'],
              ['pw', 'พลังยิง'],
              ['cur', 'ยิงโค้ง'],
              ['lsh', 'ยิงไกล'],
              ['fk', 'ลูกตั้งเตะ'],
              ['run', 'เข้าทำ']
            ]
          ],
          [
            '⚽ การเล่น',
            [
              ['drb', 'เลี้ยงบอล'],
              ['ctrl', 'จับบอล'],
              ['spass', 'ส่งบอลสั้น'],
              ['lpass', 'ส่งบอลยาว'],
              ['crs', 'เปิดบอล'],
              ['vis', 'ไหวพริบ']
            ]
          ],
          [
            '🛡️ ป้องกัน',
            [
              ['rd', 'อ่านเกม'],
              ['tkl', 'เข้าสกัด'],
              ['pos', 'ยืนตำแหน่ง'],
              ['mrk', 'ประกบตัว'],
              ['blk', 'บล็อกลูกยิง'],
              ['hd', 'โหม่ง']
            ]
          ]
        ] as [string, [string, string][]][])),
    [
      '💪 ร่างกาย',
      [
        ['spd', 'ความเร็ว'],
        ['acc', 'สปีดต้น'],
        ['str', 'แข็งแกร่ง'],
        ['sta', 'ความอึด'],
        ['agi', 'ความคล่องตัว'],
        ['jmp', 'พลังกระโดด']
      ]
    ],
    [
      '❤️ ความฟิต',
      [
        ['tol', 'ทนต่อบาดเจ็บ'],
        ['rec', 'ฟื้นตัวเร็ว'],
        ['end', 'ยืนระยะเกม'],
        ['bal', 'สมดุลร่างกาย'],
        ['con', 'ความสม่ำเสมอ']
      ]
    ],
    [
      '🌟 พรสวรรค์',
      [
        ['comp', 'นิ่งในนัดใหญ่'],
        ['foc', 'สมาธิในเกม'],
        ['ldr', 'ภาวะผู้นำ'],
        ['det', 'ความมุ่งมั่น']
      ]
    ]
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
        altRoles,
        customPers,
        perks: isMePlayer ? perks : undefined,
        vis,
        age,
        ht,
        wt,
        foot,
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

  const updateVisIdx = (idx: number, val: number) => {
    SFX.tap();
    setVis((prev) => {
      const next = prev.slice();
      next[idx] = val;
      return next;
    });
  };

  const filteredTraits = FOOTBALL_TRAITS.filter((tr) => {
    if (traitFilterPos && tr.pos && !tr.pos.includes(curPos) && !traits.includes(tr.id)) return false;
    const q = traitSearch.trim().toLowerCase();
    if (!q) return true;
    return tr.name.toLowerCase().includes(q) || tr.desc.toLowerCase().includes(q);
  });

  const compatibleAltRoles = ALL_SUB_ROLES.filter(
    (r) => r !== ro && (curPos === 'GK' ? false : LINE[r] !== 'GK')
  );

  const previewPlayer: Player = {
    ...player,
    ro,
    pos: curPos,
    vis
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
            <button type="button" onClick={() => shiftAllStatsBy(5)} className="btn btn-xs btn-surface">
              ⚡ +5 ทุกค่า
            </button>
            <button type="button" onClick={() => shiftAllStatsBy(10)} className="btn btn-xs btn-surface">
              🔥 +10 ทุกค่า
            </button>
            <button type="button" onClick={applyMax99} className="btn btn-xs btn-gold font-extrabold">
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
              className="btn btn-xs bg-[var(--g-soft)] text-[var(--g)] border border-[var(--g)]/35 hover:bg-[var(--g)] hover:text-white"
            >
              💚 ฟิต 100% / หายเจ็บ
            </button>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                setShowAppearance((v) => !v);
              }}
              className={`btn btn-xs ${
                showAppearance
                  ? 'btn-primary'
                  : 'btn-surface'
              }`}
            >
              💈 หน้าตา/ทรงผม
            </button>
          </div>
        </div>

        {/* Appearance Customizer (Collapsible) */}
        {showAppearance && (
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <PlayerFace player={previewPlayer} team={team} state={state} size={46} />
                <div>
                  <div className="text-[11px] font-bold">ปรับโฉมหน้าตา & ทรงผม</div>
                  <div className="text-[10px] text-[var(--mut)]">
                    {HS_N[vis[2] % HS_N.length]} · {EY_N[vis[4] % EY_N.length]} · {FS_N[(vis[6] ?? 0) % FS_N.length]}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  const next = rndVis(curPos, age < 20);
                  next[5] = player.no || vis[5] || 10;
                  setVis(next);
                }}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[var(--lamp-soft)] to-[var(--g-soft)] border border-[var(--lamp)]/50 text-[10.5px] font-extrabold cursor-pointer"
              >
                ✨ สุ่มหน้าหล่อเท่
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px]">
              <div className="space-y-1">
                <div className="text-[var(--mut)] font-semibold">สีผิว</div>
                <div className="flex flex-wrap gap-1">
                  {SKIN_P.map((c, idx) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateVisIdx(0, idx)}
                      className={`w-5 h-5 rounded-full border-2 cursor-pointer ${vis[0] === idx ? 'border-[var(--g)] scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[var(--mut)] font-semibold">สีผม</div>
                <div className="flex flex-wrap gap-1">
                  {HAIR_P.map((c, idx) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateVisIdx(1, idx)}
                      className={`w-5 h-5 rounded-full border-2 cursor-pointer ${vis[1] === idx ? 'border-[var(--g)] scale-110' : 'border-white/30'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <label className="block space-y-0.5">
                <span className="text-[var(--mut)] font-semibold">ทรงผม</span>
                <select
                  value={vis[2] % HS_N.length}
                  onChange={(e) => updateVisIdx(2, Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-bold"
                >
                  {HS_N.map((lbl, i) => (
                    <option key={lbl} value={i}>{lbl}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[var(--mut)] font-semibold">แววตา / อารมณ์</span>
                <select
                  value={vis[4] % EY_N.length}
                  onChange={(e) => updateVisIdx(4, Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-bold"
                >
                  {EY_N.map((lbl, i) => (
                    <option key={lbl} value={i}>{lbl}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[var(--mut)] font-semibold">โครงหน้า</span>
                <select
                  value={(vis[6] ?? 0) % FS_N.length}
                  onChange={(e) => updateVisIdx(6, Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[11px] font-bold"
                >
                  {FS_N.map((lbl, i) => (
                    <option key={lbl} value={i}>{lbl}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[var(--mut)] font-semibold">หนวด/เครา & เครื่องประดับ</span>
                <div className="flex gap-1">
                  <select
                    value={(vis[3] ?? 0) % FH_N.length}
                    onChange={(e) => updateVisIdx(3, Number(e.target.value))}
                    className="w-1/2 px-1.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold"
                  >
                    {FH_N.map((lbl, i) => (
                      <option key={lbl} value={i}>{lbl}</option>
                    ))}
                  </select>
                  <select
                    value={(vis[7] ?? 0) % ACC_N.length}
                    onChange={(e) => updateVisIdx(7, Number(e.target.value))}
                    className="w-1/2 px-1.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px] font-bold"
                  >
                    {ACC_N.map((lbl, i) => (
                      <option key={lbl} value={i}>{lbl}</option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Role, Signature & Basic Vitals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mland:gap-1.5">
          <label className="block space-y-0.5">
            <span className="text-[10px] font-semibold text-[var(--mut)]">ตำแหน่งหลัก / บทบาท</span>
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

          <label className="block space-y-0.5">
            <span className="text-[10px] font-semibold text-[var(--mut)]">🌟 ท่าไม้ตาย (+8 ค่าพลัง)</span>
            <select
              value={sig}
              onChange={(e) => { SFX.tap(); setSig(e.target.value); }}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold"
            >
              {sigOptions.map((sKey) => (
                <option key={sKey} value={sKey}>
                  {SIGL[sKey]}
                </option>
              ))}
            </select>
          </label>

          <div className="col-span-2 sm:col-span-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--mut)]">🧠 นิสัยประจำตัว</span>
              <button
                type="button"
                onClick={() => {
                  SFX.tap();
                  setCustomPers(Math.floor(Math.random() * PLAYER_PERSONALITIES.length));
                }}
                className="text-[9.5px] font-bold text-[var(--g)] hover:underline cursor-pointer"
              >
                🎲 สุ่ม
              </button>
            </div>
            <select
              value={customPers}
              onChange={(e) => { SFX.tap(); setCustomPers(Number(e.target.value)); }}
              className="w-full px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-xs font-bold"
            >
              {PLAYER_PERSONALITIES.map((pDef) => (
                <option key={pDef.id} value={pDef.id}>
                  {pDef.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--line)] flex items-center gap-2 text-[10.5px]">
          <span className="font-bold shrink-0">{persDef.label}:</span>
          <span className="text-[var(--mut)] leading-snug">{persDef.desc}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mland:gap-1.5">
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

        {/* Secondary Playable Positions */}
        {compatibleAltRoles.length > 0 && (
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-[var(--ink)]">
                🧩 ตำแหน่งถนัดเพิ่ม ({altRoles.length}) <span className="font-normal text-[var(--mut)]">· ลดโทษเวลาหลุดตำแหน่ง</span>
              </span>
              {altRoles.length > 0 && (
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setAltRoles([]); }}
                  className="text-[10px] font-bold text-[var(--mut)] hover:text-[var(--red)] cursor-pointer"
                >
                  ล้าง
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {compatibleAltRoles.map((rKey) => {
                const active = altRoles.includes(rKey);
                return (
                  <button
                    key={rKey}
                    type="button"
                    title={SPN[rKey] || rKey}
                    onClick={() => {
                      SFX.tap();
                      setAltRoles((prev) =>
                        prev.includes(rKey) ? prev.filter((x) => x !== rKey) : [...prev, rKey]
                      );
                    }}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--g)] text-white border-[var(--g)]'
                        : 'bg-[var(--surface-2)]/80 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {rKey}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Multi Football Traits Selector */}
        <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-bold text-[var(--ink)]">
              🎭 สกิลติดตัว / นิสัยลูกหนัง ({traits.length}/6) <span className="font-normal text-[var(--mut)]">· มีผลจริงในการแข่งขัน</span>
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => { SFX.tap(); setTraitFilterPos((v) => !v); }}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                  traitFilterPos
                    ? 'bg-[var(--g-soft)] border-[var(--g)]/40 text-[var(--g)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--mut)]'
                }`}
              >
                {traitFilterPos ? `เฉพาะ ${curPos}` : 'ทั้งหมด'}
              </button>
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
          </div>
          <input
            type="text"
            value={traitSearch}
            onChange={(e) => setTraitSearch(e.target.value)}
            placeholder="🔍 ค้นหาสกิลติดตัว..."
            className="w-full px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10.5px]"
          />
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
            {filteredTraits.map((tr) => {
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
                        : prev.length >= 6
                          ? [...prev.slice(1), tr.id]
                          : [...prev, tr.id]
                    );
                  }}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                    active
                      ? RISKY_TRAIT_IDS.has(tr.id)
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

        {/* Career Perks (Player Career Mode only) */}
        {isMePlayer && (
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-[var(--ink)]">
                👑 สกิลอาชีพ (Career Perks {perks.length}/{CAREER_PERKS.length})
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => { SFX.tap(); setPerks(CAREER_PERKS.map((pk) => pk.id)); }}
                  className="px-2 py-0.5 rounded-lg bg-[var(--lamp-soft)] border border-[var(--lamp)]/50 text-[#8a5b00] dark:text-[var(--lamp)] text-[10px] font-bold cursor-pointer"
                >
                  🔓 ปลดล็อกทั้งหมด
                </button>
                {perks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { SFX.tap(); setPerks([]); }}
                    className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[10px] font-bold text-[var(--mut)] cursor-pointer"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
              {CAREER_PERKS.map((pk) => {
                const active = perks.includes(pk.id);
                return (
                  <button
                    key={pk.id}
                    type="button"
                    title={pk.desc}
                    onClick={() => {
                      SFX.tap();
                      setPerks((prev) =>
                        prev.includes(pk.id) ? prev.filter((id) => id !== pk.id) : [...prev, pk.id]
                      );
                    }}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--lamp)] text-[#261900] border-[#ca8a04]/50'
                        : 'bg-[var(--surface-2)]/80 border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {pk.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Physical Bio: Height, Weight, Preferred Foot */}
        <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold text-[var(--ink)]">📐 รูปร่าง &amp; เท้าที่ถนัด</span>
            <button
              type="button"
              onClick={() => {
                SFX.tap();
                const rb = rollPlayerBio(curPos, ro);
                setHt(rb.ht);
                setWt(rb.wt);
                setFoot(rb.foot);
              }}
              className="btn btn-xs btn-secondary"
            >
              🎲 สุ่มสัดส่วน
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mland:gap-1.5">
            <div className="p-1.5 rounded-lg border bg-teal-500/8 border-teal-500/30 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-teal-700 dark:text-teal-300 font-bold">📏 ส่วนสูง</span>
                <b className="tabular text-xs text-teal-700 dark:text-teal-300">{ht} ซม.</b>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setHt((v) => clamp(v - 1, 155, 205))} className="btn-icon w-6 h-6 text-xs">-</button>
                <input type="range" min={155} max={205} value={ht} onChange={(e) => setHt(Number(e.target.value))} className="flex-1 accent-teal-500 min-w-0" />
                <button type="button" onClick={() => setHt((v) => clamp(v + 1, 155, 205))} className="btn-icon w-6 h-6 text-xs">+</button>
              </div>
            </div>

            <div className="p-1.5 rounded-lg border bg-emerald-500/8 border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">⚖️ น้ำหนัก</span>
                <b className="tabular text-xs text-emerald-700 dark:text-emerald-300">{wt} กก.</b>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setWt((v) => clamp(v - 1, 50, 110))} className="btn-icon w-6 h-6 text-xs">-</button>
                <input type="range" min={50} max={110} value={wt} onChange={(e) => setWt(Number(e.target.value))} className="flex-1 accent-emerald-500 min-w-0" />
                <button type="button" onClick={() => setWt((v) => clamp(v + 1, 50, 110))} className="btn-icon w-6 h-6 text-xs">+</button>
              </div>
            </div>

            <div className="p-1.5 rounded-lg border bg-[var(--surface-2)]/65 border-[var(--line)] space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--mut)] font-bold">ถนัดเท้า</span>
                <span className={`inline-flex items-center gap-1 text-[10.5px] font-extrabold ${getFootColorMeta(foot).textCls}`}>
                  <FootPairIcon foot={foot} size="xs" />
                  <span>{getFootColorMeta(foot).label}</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['L', 'R', 'B'] as const).map((fk) => {
                  const fm = getFootColorMeta(fk);
                  const active = foot === fk;
                  return (
                    <button
                      key={fk}
                      type="button"
                      onClick={() => { SFX.tap(); setFoot(fk); }}
                      className={`btn btn-xs px-1 ${
                        active ? fm.buttonActiveCls : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--mut)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <FootPairIcon foot={fk} size="xs" />
                      <span>{fm.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mland:gap-1.5">
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">อายุ</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAge((v) => clamp(v - 1, 15, 45))} className="btn-icon w-6 h-6 text-xs">-</button>
              <span className="text-xs font-bold tabular w-6 text-center">{age}</span>
              <button type="button" onClick={() => setAge((v) => clamp(v + 1, 15, 45))} className="btn-icon w-6 h-6 text-xs">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">ความฟิต</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setFit((v) => clamp(v - 5, 1, 100))} className="btn-icon w-6 h-6 text-xs">-</button>
              <span className="text-xs font-bold tabular w-8 text-center">{fit}%</span>
              <button type="button" onClick={() => setFit((v) => clamp(v + 5, 1, 100))} className="btn-icon w-6 h-6 text-xs">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">บาดเจ็บ (นัด)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setInj((v) => Math.max(0, v - 1))} className="btn-icon w-6 h-6 text-xs">-</button>
              <span className="text-xs font-bold tabular w-5 text-center">{inj}</span>
              <button type="button" onClick={() => setInj((v) => Math.min(20, v + 1))} className="btn-icon w-6 h-6 text-xs">+</button>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-1">
            <span className="text-[10.5px] font-semibold text-[var(--mut)]">โทษแบน (นัด)</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSus((v) => Math.max(0, v - 1))} className="btn-icon w-6 h-6 text-xs">-</button>
              <span className="text-xs font-bold tabular w-5 text-center">{sus}</span>
              <button type="button" onClick={() => setSus((v) => Math.min(10, v + 1))} className="btn-icon w-6 h-6 text-xs">+</button>
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
            className="btn btn-md btn-danger"
          >
            🔄 คืนค่าเดิม
          </button>
        ) : (
          <span className="text-[11px] text-[var(--mut)]">ปรับแล้วมีผลทันทีทั้งในสนาม 2D และสถิติ</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-md btn-gold ml-auto px-5 font-extrabold"
        >
          ✨ บันทึกพรของพระเจ้า ({player.n.split(' ')[0]})
        </button>
      </div>
    </div>
  );
};
