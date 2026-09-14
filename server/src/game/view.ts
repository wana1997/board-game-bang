import type { Card, CardName, Equipment, GameState, PendingBang, Role, TurnPhase, Team } from "./types";

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
  equipment: PublicEquipmentView;
};

export type GameView = {
  roomId: string;
  order: string[];
  currentPlayerId: string;
  turnPhase: TurnPhase;
  bangPlayedThisTurn: boolean;
  requiredDiscardCount: number;
  deckCount: number;
  players: PublicPlayerView[];
  self: { id: string; role: Role; hand: Card[] };
  pendingBang: PendingBang | null;
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
      equipment: publicEquipment(p.equipment),
    };
  });

  return {
    roomId: state.roomId,
    order: state.order,
    currentPlayerId: state.order[state.currentPlayerIndex],
    turnPhase: state.turnPhase,
    bangPlayedThisTurn: state.bangPlayedThisTurn,
    requiredDiscardCount: state.requiredDiscardCount,
    deckCount: state.deck.length,
    players,
    self: { id: self.id, role: self.role, hand: self.hand },
    pendingBang: state.pendingBang,
    winner: state.winner,
    log: state.log.slice(-30),
  };
}
