import {
  cardCheckLabel,
  createEquipment,
  ROLE_LABEL,
  TEAM_LABEL,
  type Card,
  type GameState,
  type PlayerState,
  type Role,
  type Team,
} from "./types";
import { buildDeck, shuffle } from "./deck";
import { assignRoles, buildTurnOrder } from "./roles";
import { assignCharacters, CHARACTERS, characterHas } from "./characters";
import type { Room } from "../rooms";

export function createGame(room: Room): GameState {
  const playerIds = room.players.map((p) => p.id);
  const roles = assignRoles(playerIds);
  const order = buildTurnOrder(playerIds, roles);
  const characters = assignCharacters(playerIds);
  const deck = shuffle(buildDeck());

  const players: Record<string, PlayerState> = {};
  for (const p of room.players) {
    const role = roles[p.id];
    const character = characters[p.id];
    // 캐릭터 기본 체력 + 보안관 보너스 1
    const maxHp = CHARACTERS[character].maxHp + (role === "sheriff" ? 1 : 0);
    players[p.id] = {
      id: p.id,
      nickname: p.nickname,
      role,
      character,
      hp: maxHp,
      maxHp,
      hand: deck.splice(0, maxHp),
      equipment: createEquipment(),
      alive: true,
    };
  }

  const state: GameState = {
    roomId: room.id,
    order,
    currentPlayerIndex: 0,
    turnPhase: "play",
    bangsPlayedThisTurn: 0,
    skillUsedThisTurn: false,
    requiredDiscardCount: 0,
    deck,
    discard: [],
    players,
    pending: null,
    winner: null,
    log: [],
  };

  state.log.push(`게임이 시작되었습니다. 선 플레이어: ${players[order[0]].nickname}`);
  beginTurn(state);

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

export function aliveOthers(state: GameState, excludeId: string): string[] {
  return state.order.filter((id) => id !== excludeId && state.players[id].alive);
}

/** 생존자만 좌석 순서대로, startId부터 시작해서 한 바퀴 (startId 포함). */
export function aliveOrderFrom(state: GameState, startId: string): string[] {
  const alive = state.order.filter((id) => state.players[id].alive);
  const idx = alive.indexOf(startId);
  if (idx === -1) return alive;
  return [...alive.slice(idx), ...alive.slice(0, idx)];
}

export function nextAlivePlayerId(state: GameState, fromId: string): string | null {
  const n = state.order.length;
  const fromIdx = state.order.indexOf(fromId);
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    const candidate = state.players[state.order[idx]];
    if (candidate.alive) return candidate.id;
  }
  return null;
}

const EQUIPMENT_KEYS = ["weapon", "scope", "mustang", "barrel", "jail", "dynamite"] as const;

/** 사망 처리: 손패/장착 카드 버림, 처치 보상/페널티, 승리 판정까지 한 번에 처리. */
export function killPlayer(state: GameState, victim: PlayerState, killerId: string | null) {
  victim.alive = false;
  state.discard.push(...victim.hand);
  victim.hand = [];

  const eq = victim.equipment;
  for (const key of EQUIPMENT_KEYS) {
    const card = eq[key];
    if (card) {
      state.discard.push(card);
      eq[key] = null;
    }
  }

  state.log.push(`${victim.nickname}가 쓰러졌습니다. (역할: ${ROLE_LABEL[victim.role]})`);

  if (killerId && killerId !== victim.id) {
    const killer = state.players[killerId];
    if (killer?.alive) {
      if (victim.role === "outlaw") {
        killer.hand.push(...drawCards(state, 3));
        state.log.push(`${killer.nickname}가 무법자를 처치하여 카드 3장을 뽑았습니다.`);
      }
      if (killer.role === "sheriff" && victim.role === "deputy") {
        state.discard.push(...killer.hand);
        killer.hand = [];
        for (const key of EQUIPMENT_KEYS) {
          const card = killer.equipment[key];
          if (card) {
            state.discard.push(card);
            killer.equipment[key] = null;
          }
        }
        state.log.push(`${killer.nickname}가 부관을 죽여 손패와 장착 카드를 모두 버렸습니다.`);
      }
    }
  }

  for (const id of state.order) {
    const p = state.players[id];
    if (p.alive && p.id !== victim.id && characterHas(p, "sadie_crow")) {
      p.hand.push(...drawCards(state, 2));
      state.log.push(`${p.nickname}(새디 크로우)가 장의 수당으로 카드 2장을 뽑았습니다.`);
    }
  }

  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    state.log.push(`게임 종료! 승리 진영: ${TEAM_LABEL[winner]}`);
  }
}

export function aliveCount(state: GameState): number {
  return state.order.filter((id) => state.players[id].alive).length;
}

/** 맥주 한 잔의 회복량 (도크 해밀턴은 2). */
export function beerHealAmount(player: PlayerState): number {
  return characterHas(player, "doc_hamilton") ? 2 : 1;
}

/** 맥주는 생존자가 2명 이하일 때 효과가 없다. */
export function beerHasEffect(state: GameState): boolean {
  return aliveCount(state) > 2;
}

/**
 * 체력 감소 + 필요 시 사망 처리. 로그 메시지는 호출부에서 상황에 맞게 남긴다.
 * 체력이 0 이하가 되면 손패의 맥주를 자동으로 마셔 버틸 수 있으면 버틴다(마지막 한 모금).
 */
export function applyDamage(state: GameState, victim: PlayerState, amount: number, sourceId: string | null) {
  victim.hp -= amount;
  if (victim.hp > 0) return;

  if (beerHasEffect(state)) {
    const beers = victim.hand.filter((c) => c.name === "beer");
    const heal = beerHealAmount(victim);
    if (beers.length * heal >= 1 - victim.hp) {
      while (victim.hp <= 0) {
        const beer = beers.shift()!;
        victim.hand.splice(victim.hand.indexOf(beer), 1);
        state.discard.push(beer);
        victim.hp = Math.min(victim.maxHp, victim.hp + heal);
      }
      state.log.push(`${victim.nickname}가 쓰러지기 직전 맥주를 마셔 버텼습니다! (${victim.hp}/${victim.maxHp})`);
      return;
    }
  }

  killPlayer(state, victim, sourceId);
}

/** 응답 처리 후 호출: 턴 주인이 자기 턴에 쓰러졌다면 다음 사람에게 턴을 넘긴다. */
export function settleTurn(state: GameState) {
  if (state.winner || state.pending) return;
  if (!currentPlayer(state).alive) advanceTurn(state);
}

/**
 * 현재 플레이어의 턴을 시작. 다이너마이트 체크 → (생존 시) 감옥 체크 → 드로우 순서.
 * 감옥에 걸리면 이번 턴을 통째로 건너뛰고 advanceTurn을 재귀 호출한다.
 */
function beginTurn(state: GameState) {
  const player = currentPlayer(state);
  state.turnPhase = "play";
  state.bangsPlayedThisTurn = 0;
  state.skillUsedThisTurn = false;
  state.requiredDiscardCount = 0;

  if (player.equipment.dynamite) {
    const [check] = drawCards(state, 1);
    const dynamiteCard = player.equipment.dynamite;
    player.equipment.dynamite = null;

    if (check) {
      state.discard.push(check);
      state.log.push(`${player.nickname}의 다이너마이트 체크: ${cardCheckLabel(check)}`);

      const exploded = check.suit === "spades" && check.value >= 2 && check.value <= 9;
      if (exploded) {
        state.discard.push(dynamiteCard);
        state.log.push(`다이너마이트가 폭발했습니다! ${player.nickname} 체력 3 감소`);
        applyDamage(state, player, 3, null);
      } else {
        const nextId = nextAlivePlayerId(state, player.id);
        if (nextId) {
          state.players[nextId].equipment.dynamite = dynamiteCard;
          state.log.push(`다이너마이트가 ${state.players[nextId].nickname}에게 넘어갔습니다.`);
        } else {
          state.discard.push(dynamiteCard);
        }
      }
    } else {
      state.discard.push(dynamiteCard);
    }
  }

  if (state.winner) return;

  if (!player.alive) {
    advanceTurn(state);
    return;
  }

  if (player.equipment.jail) {
    const [check] = drawCards(state, 1);
    const jailCard = player.equipment.jail;
    player.equipment.jail = null;

    if (check) {
      state.discard.push(check);
      state.discard.push(jailCard);
      state.log.push(`${player.nickname}의 감옥 체크: ${cardCheckLabel(check)}`);

      if (check.suit === "hearts") {
        state.log.push(`${player.nickname}가 감옥에서 탈출했습니다.`);
      } else {
        state.log.push(`${player.nickname}는 이번 턴을 감옥에서 보냅니다.`);
        advanceTurn(state);
        return;
      }
    } else {
      state.discard.push(jailCard);
    }
  }

  const drawCount = characterHas(player, "lucy_fairweather") ? 3 : 2;
  player.hand.push(...drawCards(state, drawCount));
  state.log.push(`${player.nickname}의 턴입니다. (카드 ${drawCount}장 드로우)`);
}

export function advanceTurn(state: GameState) {
  const nextId = nextAlivePlayerId(state, currentPlayer(state).id);
  if (!nextId) return;
  state.currentPlayerIndex = state.order.indexOf(nextId);
  beginTurn(state);
}
