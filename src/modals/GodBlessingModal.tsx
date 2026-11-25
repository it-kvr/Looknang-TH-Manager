import React, { useMemo, useState } from 'react';
import type { Position, Player, Team, GameState } from '../types/game';
import { TN, SPN } from '../data/thaiFootballData';
import { SFX } from '../utils/audioTheme';
import { ovColor } from '../engine/missions';
import { getPlayerBio } from '../engine/playerCore';
import { PlayerFace } from '../components/SvgVisuals';
import { PlayerBlessingEditor } from '../components/PlayerBlessingEditor';
import { PlayerBioStrip } from '../components/PlayerBioStrip';

export const GodBlessingModal: React.FC<{
  state: GameState;
  onClose: () => void;
  onUpdateState: (updater: (draft: GameState) => void) => void;
  onToast: (msg: string) => void;
}> = ({ state, onClose, onUpdateState, onToast }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | 'mk' | 'yth'>(state.me);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | Position>('ALL');
  const [editingName, setEditingName] = useState<string | null>(() => {
    if (state.mode === 'p' && state.p?.name) return state.p.name;
    return state.teams[state.me]?.sq[0]?.n || null;
  });

  const roster: { pl: Player; team: Team | null }[] = useMemo(() => {
    if (selectedTeamId === 'mk') return state.mk.map((pl) => ({ pl, team: null }));
    if (selectedTeamId === 'yth') return state.yth.map((pl) => ({ pl, team: state.teams[state.me] || null }));
    const tm = state.teams[selectedTeamId] || state.teams[state.me];
    return (tm?.sq || []).map((pl) => ({ pl, team: tm }));
  }, [state, selectedTeamId]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = roster.filter((x) => {
      if (posFilter !== 'ALL' && x.pl.pos !== posFilter) return false;
      if (!q) return true;
      return x.pl.n.toLowerCase().includes(q) || x.pl.ro.toLowerCase().includes(q);
    });
    return list.slice().sort((a, b) => (b.pl.me ? 1 : 0) - (a.pl.me ? 1 : 0) || b.pl.ov - a.pl.ov);
  }, [roster, search, posFilter]);

  const activeItem = roster.find((x) => x.pl.n === editingName) || filteredRoster[0] || roster[0] || null;

  return (
    <div className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 mland:p-1.5 overflow-hidden">
      <div className="w-full max-w-4xl mland:max-w-[97vw] h-[calc(var(--app-dvh,1dvh)*92)] mland:h-[calc(var(--app-dvh,1dvh)*96)] max-h-[calc(var(--app-dvh,1dvh)*94)] mland:max-h-[calc(var(--app-dvh,1dvh)*96)] rounded-3xl mland:rounded-2xl bg-[var(--surface)] border border-[var(--lamp)]/55 flex flex-col overflow-hidden shadow-2xl">
        <div className="shrink-0 px-4 py-3 mland:px-3 mland:py-1.5 bg-gradient-to-r from-[#2e2000] via-[#17281e] to-[#0c1c14] text-white border-b border-[var(--lamp)]/35 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-base mland:text-xs font-display flex items-center gap-1.5 truncate">
              <span>✨</span>
              <span>พรของพระเจ้า · ปรับแต่งค่าพลังนักเตะแต่ละคน</span>
            </h3>
            <p className="text-[11px] mland:text-[9px] text-amber-200/85 truncate">
              เลือกนักเตะคนใดก็ได้เพื่อปรับ OVR พรสวรรค์ ตำแหน่งถนัดเพิ่ม นิสัย สกิลติดตัว หน้าตา และค่าพลังย่อยทั้งหมด
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="btn-icon rounded-full bg-white/15 hover:bg-white/25 border-white/20 text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[245px_1fr] mland:grid-cols-[220px_1fr] overflow-hidden">
          {/* Left Column: Team & Player Selector */}
          <div className="shrink-0 max-h-[30vh] md:max-h-none md:h-full mland:max-h-none mland:h-full flex flex-col border-b md:border-b-0 md:border-r mland:border-b-0 mland:border-r border-[var(--line)] bg-[var(--surface-2)]/55 min-h-0">
            <div className="p-2.5 mland:p-1.5 space-y-1.5 border-b border-[var(--line)] shrink-0">
              <select
                value={String(selectedTeamId)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const nextId = raw === 'mk' || raw === 'yth' ? raw : Number(raw);
                  setSelectedTeamId(nextId);
                  setSearch('');
                  if (nextId === 'mk') setEditingName(state.mk[0]?.n || null);
                  else if (nextId === 'yth') setEditingName(state.yth[0]?.n || null);
                  else setEditingName(state.teams[nextId]?.sq[0]?.n || null);
                }}
                className="w-full px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px] font-bold"
              >
                <option value={String(state.me)}>⭐ ทีมของเรา · {state.teams[state.me]?.name}</option>
                <option value="yth">🎓 อคาเดมีเยาวชน ({state.yth.length})</option>
                <option value="mk">🛒 ตลาดซื้อขาย / ฟรีเอเยนต์ ({state.mk.length})</option>
                {state.teams
                  .filter((t) => t.id !== state.me)
                  .map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {TN[t.tier]} · {t.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 ค้นหาชื่อ หรือตำแหน่ง (เช่น ST, CB)..."
                className="w-full px-2.5 py-1.5 mland:py-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-xs mland:text-[10.5px]"
              />
              <div className="flex flex-wrap gap-1">
                {(['ALL', 'FW', 'MF', 'DF', 'GK'] as const).map((pf) => (
                  <button
                    key={pf}
                    type="button"
                    onClick={() => { SFX.tap(); setPosFilter(pf); }}
                    className={`btn btn-xs ${
                      posFilter === pf
                        ? 'btn-gold'
                        : 'btn-surface text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {pf === 'ALL' ? 'ทั้งหมด' : pf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
              {filteredRoster.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--mut)]">ไม่พบนักเตะ</div>
              ) : (
                filteredRoster.map(({ pl, team: pTeam }) => {
                  const isSel = activeItem?.pl.n === pl.n;
                  return (
                    <button
                      key={pl.n}
                      type="button"
                      onClick={() => { SFX.tap(); setEditingName(pl.n); }}
                      className={`w-full px-2 py-1.5 mland:py-1 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[var(--lamp-soft)] border-[var(--lamp)] ring-1 ring-[var(--lamp)]/50'
                          : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--g)]'
                      }`}
                    >
                      <PlayerFace player={pl} team={pTeam} state={state} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs mland:text-[10.5px] font-bold truncate flex items-center gap-1">
                          {pl.blessed && <span title="ได้รับพรของพระเจ้า">✨</span>}
                          <span className="truncate">{pl.n}</span>
                        </div>
                        <div className="text-[10px] mland:text-[9px] text-[var(--mut)]">
                          {pl.ro}{pl.altRoles?.length ? `+${pl.altRoles.slice(0, 2).join(',')}` : ''} · อายุ {pl.age}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-white text-[10.5px] font-bold tabular shrink-0" style={{ background: ovColor(pl.ov) }}>
                        {pl.ov}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Individual Stat Editor */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 mland:p-2">
            {activeItem ? (
              <div className="space-y-3 mland:space-y-2">
                <div className="flex items-center gap-3 p-2.5 mland:p-1.5 rounded-2xl mland:rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                  <PlayerFace
                    player={activeItem.pl}
                    team={activeItem.team}
                    state={state}
                    careerProfile={activeItem.pl.me ? state.p : null}
                    size={42}
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="font-bold text-sm mland:text-xs truncate flex items-center gap-1.5">
                      {activeItem.pl.blessed && <span className="px-1.5 py-0.5 rounded bg-[var(--lamp)] text-[#261900] text-[9.5px] font-extrabold shrink-0">✨ พรของพระเจ้า</span>}
                      <span className="truncate">{activeItem.pl.n}</span>
                    </div>
                    <div className="text-[11px] mland:text-[9.5px] text-[var(--mut)] truncate">
                      {activeItem.team ? activeItem.team.name : 'ตลาดซื้อขาย / ฟรีเอเยนต์'} · {activeItem.pl.ro} ({SPN[activeItem.pl.ro] || activeItem.pl.pos})
                      {activeItem.pl.altRoles?.length ? ` · ถนัดเพิ่ม: ${activeItem.pl.altRoles.join(', ')}` : ''}
                    </div>
                    <PlayerBioStrip
                      bio={getPlayerBio(activeItem.pl, activeItem.pl.me ? state.p : null)}
                      variant="inline"
                    />
                  </div>
                </div>
                <PlayerBlessingEditor
                  key={`${selectedTeamId}:${activeItem.pl.n}`}
                  player={activeItem.pl}
                  team={activeItem.team}
                  state={state}
                  onUpdateState={onUpdateState}
                  onToast={onToast}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-[var(--mut)]">เลือกนักเตะจากรายการทางซ้ายเพื่อปรับแต่งค่าพลัง</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

