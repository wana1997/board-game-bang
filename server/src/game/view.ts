import { CHARACTERS, type CharacterDef } from "./characters";
import { bangRange } from "./distance";
import { maxBangsPerTurn } from "./actions";
import type { Card, CardName, Equipment, GameState, PendingResponse, Role, TurnPhase, Team } from "./types";

export type PublicEquipmentView = {
  weapon: CardName | null;
  scope: boolean;
  mustang: boolean;
  barrel: boolean;
  jail: boolean;
  dynamite: boolean;
};

export type PublicPlayerView = {
  id: string;
  nickname: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  handCount: number;
  role: Role | null; // null = 아직 공개되지 않은 역할
  character: CharacterDef; // 캐릭터는 항상 공개
  equipment: PublicEquipmentView;
};

export type GameView = {
  roomId: string;
  order: string[];
  currentPlayerId: string;
  turnPhase: TurnPhase;
  bangsPlayedThisTurn: number;
  skillUsedThisTurn: boolean;
  requiredDiscardCount: number;
  deckCount: number;
  players: PublicPlayerView[];
  self: {
    id: string;
    role: Role;
    hand: Card[];
    /** 캐릭터 보너스 포함 뱅! 사거리 */
    bangRange: number;
    /** 이번 턴에 더 쓸 수 있는 뱅! 수 (무제한이면 null) */
    bangsLeft: number | null;
  };
  pending: PendingResponse | null;
  winner: Team | null;
  log: string[];
};

function publicEquipment(equipment: Equipment): PublicEquipmentView {
  return {
    weapon: equipment.weapon?.name ?? null,
    scope: !!equipment.scope,
    mustang: !!equipment.mustang,
    barrel: !!equipment.barrel,
    jail: !!equipment.jail,
    dynamite: !!equipment.dynamite,
  };
}

/** 보안관 역할은 항상 공개, 그 외는 사망하거나 게임이 끝나야 공개됨(자기 자신은 항상 확인 가능). */
export function buildGameView(state: GameState, viewerId: string): GameView {
  const self = state.players[viewerId];

  const players: PublicPlayerView[] = state.order.map((id) => {
    const p = state.players[id];
    const roleVisible = state.winner !== null || p.role === "sheriff" || !p.alive || id === viewerId;
    return {
      id: p.id,
      nickname: p.nickname,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      handCount: p.hand.length,
      role: roleVisible ? p.role : null,
      character: CHARACTERS[p.character],
      equipment: publicEquipment(p.equipment),
    };
  });

  return {
    roomId: state.roomId,
    order: state.order,
    currentPlayerId: state.order[state.currentPlayerIndex],
    turnPhase: state.turnPhase,
    bangsPlayedThisTurn: state.bangsPlayedThisTurn,
    skillUsedThisTurn: state.skillUsedThisTurn,
    requiredDiscardCount: state.requiredDiscardCount,
    deckCount: state.deck.length,
    players,
    self: {
      id: self.id,
      role: self.role,
      hand: self.hand,
      bangRange: bangRange(self),
      bangsLeft: Number.isFinite(maxBangsPerTurn(self)) ? Math.max(0, maxBangsPerTurn(self) - state.bangsPlayedThisTurn) : null,
    },
    pending: state.pending,
    winner: state.winner,
    log: state.log.slice(-30),
  };
}
