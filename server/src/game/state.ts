import type { Card, GameState, PlayerState, Role, Team } from "./types";
import { buildDeck, shuffle } from "./deck";
import { assignRoles, buildTurnOrder } from "./roles";
import type { Room } from "../rooms";

// 캐릭터 시스템(Phase 5) 이전까지 쓰는 임시 기본 체력값. 보안관만 +1.
const MAX_HP: Record<Role, number> = {
  sheriff: 5,
  deputy: 4,
  outlaw: 4,
  renegade: 4,
};

export function createGame(room: Room): GameState {
  const playerIds = room.players.map((p) => p.id);
  const roles = assignRoles(playerIds);
  const order = buildTurnOrder(playerIds, roles);
  const deck = shuffle(buildDeck());

  const players: Record<string, PlayerState> = {};
  for (const p of room.players) {
    const role = roles[p.id];
    const maxHp = MAX_HP[role];
    players[p.id] = {
      id: p.id,
      nickname: p.nickname,
      role,
      hp: maxHp,
      maxHp,
      hand: deck.splice(0, maxHp),
      alive: true,
    };
  }

  const state: GameState = {
    roomId: room.id,
    order,
    currentPlayerIndex: 0,
    turnPhase: "play",
    bangPlayedThisTurn: false,
    requiredDiscardCount: 0,
    deck,
    discard: [],
    players,
    pendingBang: null,
    winner: null,
    log: [],
  };

  const first = players[order[0]];
  first.hand.push(...drawCards(state, 2));
  state.log.push(`게임이 시작되었습니다. 선 플레이어: ${first.nickname}`);

  return state;
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.order[state.currentPlayerIndex]];
}

export function drawCards(state: GameState, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;
      state.deck = shuffle(state.discard);
      state.discard = [];
      state.log.push("드로우 더미가 비어 버림 더미를 섞었습니다.");
    }
    const card = state.deck.pop();
    if (card) drawn.push(card);
  }
  return drawn;
}

function teamOf(role: Role): Team {
  if (role === "sheriff" || role === "deputy") return "sheriff";
  if (role === "outlaw") return "outlaw";
  return "renegade";
}

/** GAME_RULE.MD 2절 승리 조건 판정. 승리 팀이 없으면 null. */
export function checkWinner(state: GameState): Team | null {
  const alive = Object.values(state.players).filter((p) => p.alive);
  const sheriff = Object.values(state.players).find((p) => p.role === "sheriff")!;

  if (!sheriff.alive) {
    if (alive.length === 1 && alive[0].role === "renegade") return "renegade";
    return "outlaw";
  }

  const hasEnemies = alive.some((p) => teamOf(p.role) !== "sheriff");
  if (!hasEnemies) return "sheriff";
  return null;
}

export function advanceTurn(state: GameState) {
  const n = state.order.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.currentPlayerIndex + i) % n;
    if (state.players[state.order[idx]].alive) {
      state.currentPlayerIndex = idx;
      break;
    }
  }

  state.turnPhase = "play";
  state.bangPlayedThisTurn = false;
  state.requiredDiscardCount = 0;

  const player = currentPlayer(state);
  player.hand.push(...drawCards(state, 2));
  state.log.push(`${player.nickname}의 턴입니다. (카드 2장 드로우)`);
}
