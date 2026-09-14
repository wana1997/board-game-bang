import { config } from "../config";
import { advanceTurn, checkWinner, currentPlayer, drawCards } from "./state";
import {
  err,
  ok,
  ROLE_LABEL,
  TEAM_LABEL,
  type ActionResult,
  type GameState,
  type PlayerState,
} from "./types";

function killPlayer(state: GameState, victim: PlayerState, killerId: string | null) {
  victim.alive = false;
  state.discard.push(...victim.hand);
  victim.hand = [];
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
        state.log.push(`${killer.nickname}가 부관을 죽여 손패를 모두 버렸습니다.`);
      }
    }
  }

  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    state.log.push(`게임 종료! 승리 진영: ${TEAM_LABEL[winner]}`);
  }
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targetId: string | undefined
): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pendingBang) return err("awaiting_response");

  const player = state.players[playerId];
  if (!player || !player.alive) return err("not_alive");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "play") return err("wrong_phase");

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return err("card_not_found");
  const card = player.hand[cardIndex];

  if (card.name === "bang") {
    if (state.bangPlayedThisTurn) return err("bang_already_used");
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    state.bangPlayedThisTurn = true;
    state.pendingBang = {
      attackerId: playerId,
      targetId,
      respondBy: Date.now() + config.responseTimeoutMs,
    };
    state.log.push(`${player.nickname}가 ${target.nickname}에게 뱅!을 사용했습니다.`);
    return ok();
  }

  if (card.name === "beer") {
    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    player.hp = Math.min(player.maxHp, player.hp + 1);
    state.log.push(`${player.nickname}가 맥주를 마셔 체력을 회복했습니다. (${player.hp}/${player.maxHp})`);
    return ok();
  }

  return err("cannot_play_outside_response");
}

export function respondBang(state: GameState, playerId: string, play: boolean): ActionResult {
  if (state.winner) return err("game_over");
  const pending = state.pendingBang;
  if (!pending) return err("no_pending_bang");
  if (pending.targetId !== playerId) return err("not_your_response");

  const target = state.players[playerId];
  const attacker = state.players[pending.attackerId];

  if (play) {
    const idx = target.hand.findIndex((c) => c.name === "missed");
    if (idx === -1) return err("no_missed_card");
    const [card] = target.hand.splice(idx, 1);
    state.discard.push(card);
    state.log.push(`${target.nickname}가 빗나감!으로 ${attacker.nickname}의 공격을 막았습니다.`);
  } else {
    target.hp -= 1;
    state.log.push(`${target.nickname}가 뱅!을 맞았습니다. (체력 ${target.hp}/${target.maxHp})`);
    if (target.hp <= 0) {
      killPlayer(state, target, pending.attackerId);
    }
  }

  state.pendingBang = null;
  return ok();
}

export function discardCards(state: GameState, playerId: string, cardIds: string[]): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pendingBang) return err("awaiting_response");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "discard") return err("wrong_phase");
  if (cardIds.length !== state.requiredDiscardCount) return err("wrong_discard_count");

  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) return err("duplicate_card");

  const player = state.players[playerId];
  const cardsToDiscard = [];
  for (const id of cardIds) {
    const card = player.hand.find((c) => c.id === id);
    if (!card) return err("card_not_found");
    cardsToDiscard.push(card);
  }

  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  state.discard.push(...cardsToDiscard);
  state.log.push(`${player.nickname}가 카드 ${cardIds.length}장을 버렸습니다.`);

  advanceTurn(state);
  return ok();
}

export function endTurn(state: GameState, playerId: string): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pendingBang) return err("awaiting_response");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "play") return err("wrong_phase");

  const player = currentPlayer(state);
  const overflow = player.hand.length - player.hp;
  if (overflow > 0) {
    state.turnPhase = "discard";
    state.requiredDiscardCount = overflow;
    state.log.push(`${player.nickname}는 카드 ${overflow}장을 버려야 합니다.`);
    return ok();
  }

  advanceTurn(state);
  return ok();
}
