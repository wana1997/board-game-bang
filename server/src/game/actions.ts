import { config } from "../config";
import { canShoot, effectiveDistance, WEAPON_NAMES } from "./distance";
import {
  advanceTurn,
  aliveOrderFrom,
  aliveOthers,
  applyDamage,
  beerHasEffect,
  beerHealAmount,
  currentPlayer,
  drawCards,
  killPlayer,
  settleTurn,
} from "./state";
import { characterHas } from "./characters";
import {
  cardCheckLabel,
  CARD_LABEL,
  err,
  ok,
  type ActionResult,
  type Card,
  type CardName,
  type EquipmentSlot,
  type GameState,
  type PendingBroadcast,
  type PendingDuel,
  type PlayerState,
} from "./types";

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "scope", "mustang", "barrel", "jail", "dynamite"];

function takeCardFromHand(player: PlayerState, cardName: CardName): Card | null {
  const idx = player.hand.findIndex((c) => c.name === cardName);
  if (idx === -1) return null;
  const [card] = player.hand.splice(idx, 1);
  return card;
}

/** 강탈/캣벌루가 상대에게서 카드 한 장을 빼내는 공통 로직. option이 장착 슬롯이면 그 카드, 아니면(기본) 손패에서 무작위. */
function takeCardFromPlayer(target: PlayerState, option: string | undefined): Card | null {
  if (option && EQUIPMENT_SLOTS.includes(option as EquipmentSlot)) {
    const slot = option as EquipmentSlot;
    const card = target.equipment[slot];
    if (!card) return null;
    target.equipment[slot] = null;
    return card;
  }
  if (target.hand.length === 0) return null;
  const idx = Math.floor(Math.random() * target.hand.length);
  return target.hand.splice(idx, 1)[0];
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targetId: string | undefined,
  option: string | undefined
): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pending) return err("awaiting_response");

  const player = state.players[playerId];
  if (!player || !player.alive) return err("not_alive");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "play") return err("wrong_phase");

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return err("card_not_found");
  const card = player.hand[cardIndex];

  if (card.name === "bang") {
    if (state.bangsPlayedThisTurn >= maxBangsPerTurn(player)) return err("bang_already_used");
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");
    if (!canShoot(state, playerId, targetId)) return err("out_of_range");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    state.bangsPlayedThisTurn += 1;

    if (checkBarrel(state, target)) return ok();

    state.pending = {
      kind: "bang",
      attackerId: playerId,
      targetId,
      respondBy: Date.now() + config.responseTimeoutMs,
    };
    state.log.push(`${player.nickname}가 ${target.nickname}에게 뱅!을 사용했습니다.`);
    return ok();
  }

  if (card.name === "beer") {
    if (!beerHasEffect(state)) return err("beer_no_effect");
    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    player.hp = Math.min(player.maxHp, player.hp + beerHealAmount(player));
    state.log.push(`${player.nickname}가 맥주를 마셔 체력을 회복했습니다. (${player.hp}/${player.maxHp})`);
    return ok();
  }

  if (card.name === "indians" || card.name === "gatling") {
    const targets = aliveOthers(state, playerId);
    if (targets.length === 0) return err("invalid_target");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);

    const requiredCard = card.name === "indians" ? "bang" : "missed";
    const remaining =
      card.name === "gatling"
        ? targets.filter((id) => !checkBarrel(state, state.players[id]))
        : targets;

    state.log.push(
      `${player.nickname}가 ${CARD_LABEL[card.name]}을(를) 사용했습니다. 모두 ${CARD_LABEL[requiredCard]}을(를) 내거나 체력을 잃습니다.`
    );

    if (remaining.length === 0) return ok();

    state.pending = {
      kind: card.name,
      casterId: playerId,
      requiredCard,
      targets: remaining,
      respondBy: Date.now() + config.responseTimeoutMs,
    };
    return ok();
  }

  if (card.name === "duel") {
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    state.pending = {
      kind: "duel",
      casterId: playerId,
      targetId,
      currentResponderId: targetId,
      respondBy: Date.now() + config.responseTimeoutMs,
    };
    state.log.push(`${player.nickname}가 ${target.nickname}에게 결투를 신청했습니다.`);
    return ok();
  }

  if (card.name === "panic" || card.name === "cat_balou") {
    if (!targetId || targetId === playerId) return err("invalid_target");
    const target = state.players[targetId];
    if (!target || !target.alive) return err("invalid_target");
    if (card.name === "panic" && effectiveDistance(state, playerId, targetId) > 1) {
      return err("out_of_range");
    }

    const taken = takeCardFromPlayer(target, option);
    if (!taken) return err("invalid_target");

    player.hand.splice(cardIndex, 1);
    state.discard.push(card);

    if (card.name === "panic") {
      player.hand.push(taken);
      state.log.push(`${player.nickname}가 ${target.nickname}의 카드를 강탈했습니다.`);
    } else {
      state.discard.push(taken);
      state.log.push(`${player.nickname}가 ${target.nickname}의 카드를 파괴했습니다.`);
    }
    return ok();
  }

  if (card.name === "stagecoach" || card.name === "wells_fargo") {
    const amount = card.name === "stagecoach" ? 2 : 3;
    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    player.hand.push(...drawCards(state, amount));
    state.log.push(`${player.nickname}가 ${CARD_LABEL[card.name]}(으)로 카드 ${amount}장을 뽑았습니다.`);
    return ok();
  }

  if (card.name === "saloon") {
    player.hand.splice(cardIndex, 1);
    state.discard.push(card);
    for (const id of state.order) {
      const p = state.players[id];
      if (p.alive) p.hp = Math.min(p.maxHp, p.hp + 1);
    }
    state.log.push(`${player.nickname}가 살룬을 사용해 모두 체력을 회복했습니다.`);
    return ok();
  }

  if (card.name === "general_store") {
    player.hand.splice(cardIndex, 1);
    state.discard.push(card);

    const pickOrder = aliveOrderFrom(state, playerId);
    const revealed = drawCards(state, pickOrder.length);
    state.log.push(`${player.nickname}가 제너럴 스토어를 사용했습니다. 카드 ${revealed.length}장이 공개되었습니다.`);

    if (revealed.length === 0) return ok();
    state.pending = {
      kind: "general_store",
      cards: revealed,
      pickOrder,
      respondBy: Date.now() + config.responseTimeoutMs,
    };
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

/** 턴당 뱅! 사용 가능 횟수: 볼칸이면 무제한, 카스 몰리나는 무기 미장착 시 2회. */
export function maxBangsPerTurn(player: PlayerState): number {
  if (player.equipment.weapon?.name === "volcanic") return Infinity;
  if (characterHas(player, "cass_molina") && !player.equipment.weapon) return 2;
  return 1;
}

/** 뱅!/기관총 공격을 빗나감!이나 술통으로 막았을 때의 캐릭터 훅 (리버 존: 1장 드로우). */
function onDefended(state: GameState, player: PlayerState) {
  if (characterHas(player, "river_john")) {
    player.hand.push(...drawCards(state, 1));
    state.log.push(`${player.nickname}(리버 존)가 방어에 성공해 카드 1장을 뽑았습니다.`);
  }
}

/** 술통 자동 체크. 막았으면 true(로그도 남김). */
function checkBarrel(state: GameState, target: PlayerState): boolean {
  if (!target.equipment.barrel) return false;
  const [check] = drawCards(state, 1);
  if (!check) return false;
  state.discard.push(check);
  state.log.push(`${target.nickname}의 술통 체크: ${cardCheckLabel(check)}`);
  if (check.suit === "hearts") {
    state.log.push(`${target.nickname}가 술통으로 공격을 막았습니다.`);
    onDefended(state, target);
    return true;
  }
  return false;
}

/** 응답 처리 후 턴 주인이 쓰러졌으면 턴을 넘긴다. */
export function respondPending(state: GameState, playerId: string, play: boolean): ActionResult {
  const result = respondPendingInner(state, playerId, play);
  if (result.ok) settleTurn(state);
  return result;
}

function respondPendingInner(state: GameState, playerId: string, play: boolean): ActionResult {
  if (state.winner) return err("game_over");
  const pending = state.pending;
  if (!pending) return err("no_pending_response");

  if (pending.kind === "bang") {
    if (pending.targetId !== playerId) return err("not_your_response");
    const target = state.players[playerId];
    const attacker = state.players[pending.attackerId];

    if (play) {
      const card = takeCardFromHand(target, "missed");
      if (!card) return err("no_missed_card");
      state.discard.push(card);
      state.log.push(`${target.nickname}가 빗나감!으로 ${attacker.nickname}의 공격을 막았습니다.`);
      onDefended(state, target);
    } else {
      state.log.push(`${target.nickname}가 뱅!을 맞았습니다.`);
      applyDamage(state, target, 1, pending.attackerId);
    }
    state.pending = null;
    return ok();
  }

  if (pending.kind === "duel") {
    if (pending.currentResponderId !== playerId) return err("not_your_response");
    resolveDuelResponse(state, pending, play);
    return ok();
  }

  if (pending.kind === "indians" || pending.kind === "gatling") {
    if (!pending.targets.includes(playerId)) return err("not_your_response");
    resolveBroadcastResponse(state, pending, playerId, play);
    return ok();
  }

  return err("no_pending_response");
}

function resolveDuelResponse(state: GameState, pending: PendingDuel, play: boolean) {
  const responderId = pending.currentResponderId;
  const responder = state.players[responderId];
  const opponentId = responderId === pending.casterId ? pending.targetId : pending.casterId;

  if (play) {
    const card = takeCardFromHand(responder, "bang");
    if (!card) {
      state.log.push(`${responder.nickname}는 뱅! 카드가 없어 결투에서 패배했습니다.`);
      applyDamage(state, responder, 1, opponentId);
      state.pending = null;
      return;
    }
    state.discard.push(card);
    state.log.push(`${responder.nickname}가 결투에서 뱅!을 냈습니다.`);
    pending.currentResponderId = opponentId;
    pending.respondBy = Date.now() + config.responseTimeoutMs;
  } else {
    state.log.push(`${responder.nickname}가 결투에서 패배했습니다.`);
    applyDamage(state, responder, 1, opponentId);
    state.pending = null;
  }
}

function resolveBroadcastResponse(
  state: GameState,
  pending: PendingBroadcast,
  playerId: string,
  play: boolean
) {
  const player = state.players[playerId];

  if (play) {
    const card = takeCardFromHand(player, pending.requiredCard);
    if (!card) {
      state.log.push(`${player.nickname}는 ${CARD_LABEL[pending.requiredCard]} 카드가 없어 체력을 잃습니다.`);
      applyDamage(state, player, 1, pending.casterId);
    } else {
      state.discard.push(card);
      state.log.push(`${player.nickname}가 ${CARD_LABEL[pending.requiredCard]}(으)로 버텼습니다.`);
      if (pending.kind === "gatling") onDefended(state, player);
    }
  } else {
    state.log.push(`${player.nickname}가 체력을 잃습니다.`);
    applyDamage(state, player, 1, pending.casterId);
  }

  pending.targets = pending.targets.filter((id) => id !== playerId);
  if (pending.targets.length === 0 && state.pending === pending) {
    state.pending = null;
  }
}

export function pickGeneralStore(state: GameState, playerId: string, cardId: string): ActionResult {
  if (state.winner) return err("game_over");
  const pending = state.pending;
  if (!pending || pending.kind !== "general_store") return err("no_pending_response");
  if (pending.pickOrder[0] !== playerId) return err("not_your_response");

  const idx = pending.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return err("card_not_found");

  const [card] = pending.cards.splice(idx, 1);
  const player = state.players[playerId];
  player.hand.push(card);
  state.log.push(`${player.nickname}가 제너럴 스토어에서 카드를 가져갔습니다.`);

  pending.pickOrder.shift();
  if (pending.pickOrder.length === 0) {
    state.pending = null;
    settleTurn(state);
  } else {
    pending.respondBy = Date.now() + config.responseTimeoutMs;
  }
  return ok();
}

export function discardCards(state: GameState, playerId: string, cardIds: string[]): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pending) return err("awaiting_response");
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
  if (state.pending) return err("awaiting_response");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "play") return err("wrong_phase");

  const player = currentPlayer(state);
  const handLimit = player.hp + (characterHas(player, "tom_reynolds") ? 2 : 0);
  const overflow = player.hand.length - handLimit;
  if (overflow > 0) {
    state.turnPhase = "discard";
    state.requiredDiscardCount = overflow;
    state.log.push(`${player.nickname}는 카드 ${overflow}장을 버려야 합니다.`);
    return ok();
  }

  advanceTurn(state);
  return ok();
}

/** 액티브 캐릭터 스킬. 현재는 엘리아스 그레이(손패 1장 버리고 1장 드로우, 턴당 1회)만 존재. */
export function useSkill(state: GameState, playerId: string, cardIds: string[]): ActionResult {
  if (state.winner) return err("game_over");
  if (state.pending) return err("awaiting_response");
  const player = state.players[playerId];
  if (!player || !player.alive) return err("not_alive");
  if (currentPlayer(state).id !== playerId) return err("not_your_turn");
  if (state.turnPhase !== "play") return err("wrong_phase");

  if (characterHas(player, "elias_grey")) {
    if (state.skillUsedThisTurn) return err("skill_already_used");
    if (cardIds.length !== 1) return err("wrong_discard_count");
    const idx = player.hand.findIndex((c) => c.id === cardIds[0]);
    if (idx === -1) return err("card_not_found");

    const [discarded] = player.hand.splice(idx, 1);
    state.discard.push(discarded);
    player.hand.push(...drawCards(state, 1));
    state.skillUsedThisTurn = true;
    state.log.push(`${player.nickname}(엘리아스 그레이)가 카드 1장을 버리고 새로 뽑았습니다.`);
    return ok();
  }

  return err("no_active_skill");
}

/**
 * 게임 도중 나간 플레이어를 기권(탈락) 처리. 처치 보상/페널티는 없다.
 * 이 플레이어가 응답해야 하던 대기 상태는 먼저 정리한다.
 */
export function forfeit(state: GameState, playerId: string): ActionResult {
  const player = state.players[playerId];
  if (state.winner || !player || !player.alive) return ok();

  const pending = state.pending;
  if (pending) {
    if (pending.kind === "bang" && (pending.targetId === playerId || pending.attackerId === playerId)) {
      state.pending = null;
    } else if (pending.kind === "duel" && (pending.casterId === playerId || pending.targetId === playerId)) {
      state.pending = null;
    } else if (pending.kind === "indians" || pending.kind === "gatling") {
      pending.targets = pending.targets.filter((id) => id !== playerId);
      if (pending.targets.length === 0) state.pending = null;
    } else if (pending.kind === "general_store") {
      const wasPicking = pending.pickOrder[0] === playerId;
      pending.pickOrder = pending.pickOrder.filter((id) => id !== playerId);
      if (pending.pickOrder.length === 0) {
        state.discard.push(...pending.cards);
        state.pending = null;
      } else if (wasPicking) {
        pending.respondBy = Date.now() + config.responseTimeoutMs;
      }
    }
  }

  state.log.push(`${player.nickname}가 게임을 떠났습니다.`);
  killPlayer(state, player, null);
  settleTurn(state);
  return ok();
}
