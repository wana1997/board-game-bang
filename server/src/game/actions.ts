import { config } from "../config";
import { canShoot, WEAPON_NAMES } from "./distance";
import { advanceTurn, currentPlayer, drawCards, killPlayer } from "./state";
import {
  cardCheckLabel,
  CARD_LABEL,
  err,
  ok,
  type ActionResult,
  type GameState,
} from "./types";

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
    const unlimitedBang = player.equipment.weapon?.name === "volcanic";
    if (state.bangPlayedThisTurn && !unlimitedBang) return err("bang_already_used");
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");
    if (!canShoot(state, playerId, targetId)) return err("out_of_range");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    if (!unlimitedBang) state.bangPlayedThisTurn = true;

    if (target.equipment.barrel) {
      const [check] = drawCards(state, 1);
      if (check) {
        state.discard.push(check);
        state.log.push(`${target.nickname}의 술통 체크: ${cardCheckLabel(check)}`);
        if (check.suit === "hearts") {
          state.log.push(`${target.nickname}가 술통으로 공격을 막았습니다.`);
          return ok();
        }
      }
    }

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

  if (WEAPON_NAMES.has(card.name)) {
    player.hand.splice(cardIndex, 1);
    if (player.equipment.weapon) state.discard.push(player.equipment.weapon);
    player.equipment.weapon = card;
    state.log.push(`${player.nickname}가 ${CARD_LABEL[card.name]}을(를) 장착했습니다.`);
    return ok();
  }

  if (card.name === "barrel" || card.name === "mustang" || card.name === "scope") {
    if (player.equipment[card.name]) return err("already_equipped");
    player.hand.splice(cardIndex, 1);
    player.equipment[card.name] = card;
    state.log.push(`${player.nickname}가 ${CARD_LABEL[card.name]}을(를) 장착했습니다.`);
    return ok();
  }

  if (card.name === "dynamite") {
    if (player.equipment.dynamite) return err("already_equipped");
    player.hand.splice(cardIndex, 1);
    player.equipment.dynamite = card;
    state.log.push(`${player.nickname}가 다이너마이트를 자신에게 설치했습니다.`);
    return ok();
  }

  if (card.name === "jail") {
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");
    if (target.role === "sheriff") return err("cannot_jail_sheriff");
    if (target.equipment.jail) return err("already_equipped");

    player.hand.splice(cardIndex, 1);
    target.equipment.jail = card;
    state.log.push(`${player.nickname}가 ${target.nickname}을(를) 감옥에 가뒀습니다.`);
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
