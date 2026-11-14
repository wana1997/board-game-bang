import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { discardCards, endTurn, forfeit, pickGeneralStore, playCard, respondPending } from "./actions";
import { checkWinner, killPlayer } from "./state";
import { canShoot, effectiveDistance } from "./distance";
import { card, fourPlayers, makeState } from "./testUtils";

describe("거리 시스템", () => {
  test("원탁 거리: 양옆 1, 맞은편 2", () => {
    const s = fourPlayers();
    assert.equal(effectiveDistance(s, "A", "B"), 1);
    assert.equal(effectiveDistance(s, "A", "D"), 1);
    assert.equal(effectiveDistance(s, "A", "C"), 2);
  });

  test("조준경 -1, 야생마 +1, 사망자는 거리에서 제외", () => {
    const s = fourPlayers({ A: { equipment: { scope: card("scope") } }, C: { equipment: { mustang: card("mustang") } } });
    assert.equal(effectiveDistance(s, "A", "C"), 2); // 2 - 1 + 1
    s.players.B.alive = false;
    assert.equal(effectiveDistance(s, "A", "C"), 1); // 생존 3인 원탁 → 1 - 1 + 1
  });

  test("무기 없으면 사거리 1, 스콜필드는 2", () => {
    const s = fourPlayers();
    assert.equal(canShoot(s, "A", "C"), false);
    s.players.A.equipment.weapon = card("schofield");
    assert.equal(canShoot(s, "A", "C"), true);
  });
});

describe("뱅! / 빗나감!", () => {
  test("빗나감!으로 막으면 체력 유지", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] }, B: { hand: [card("missed")] } });
    assert.deepEqual(playCard(s, "A", bang.id, "B", undefined), { ok: true });
    assert.equal(s.pending?.kind, "bang");
    assert.deepEqual(respondPending(s, "B", true), { ok: true });
    assert.equal(s.players.B.hp, 4);
    assert.equal(s.pending, null);
  });

  test("그냥 맞으면 체력 1 감소", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] } });
    playCard(s, "A", bang.id, "B", undefined);
    respondPending(s, "B", false);
    assert.equal(s.players.B.hp, 3);
  });

  test("턴당 1회 제한, 볼칸이면 무제한", () => {
    const [b1, b2] = [card("bang"), card("bang")];
    const s = fourPlayers({ A: { hand: [b1, b2] } });
    playCard(s, "A", b1.id, "B", undefined);
    respondPending(s, "B", false);
    assert.deepEqual(playCard(s, "A", b2.id, "B", undefined), { ok: false, error: "bang_already_used" });

    s.players.A.equipment.weapon = card("volcanic");
    assert.deepEqual(playCard(s, "A", b2.id, "B", undefined), { ok: true });
  });

  test("사거리 밖이면 거부", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] } });
    assert.deepEqual(playCard(s, "A", bang.id, "C", undefined), { ok: false, error: "out_of_range" });
  });

  test("술통: 하트가 나오면 자동 방어", () => {
    const bang = card("bang");
    const s = fourPlayers(
      { A: { hand: [bang] }, B: { equipment: { barrel: card("barrel") } } },
      [card("bang", "hearts", 7)]
    );
    playCard(s, "A", bang.id, "B", undefined);
    assert.equal(s.pending, null);
    assert.equal(s.players.B.hp, 4);
  });

  test("술통: 하트가 아니면 응답 대기로 넘어감", () => {
    const bang = card("bang");
    const s = fourPlayers(
      { A: { hand: [bang] }, B: { equipment: { barrel: card("barrel") } } },
      [card("bang", "spades", 7)]
    );
    playCard(s, "A", bang.id, "B", undefined);
    assert.equal(s.pending?.kind, "bang");
  });
});

describe("광역/결투/상점", () => {
  test("인디언!: 뱅!을 낸 사람은 무사, 안 낸 사람은 피해", () => {
    const indians = card("indians");
    const s = fourPlayers({ A: { hand: [indians] }, B: { hand: [card("bang")] } });
    playCard(s, "A", indians.id, undefined, undefined);
    respondPending(s, "B", true);
    respondPending(s, "C", false);
    assert.notEqual(s.pending, null);
    respondPending(s, "D", false);
    assert.equal(s.pending, null);
    assert.deepEqual([s.players.B.hp, s.players.C.hp, s.players.D.hp], [4, 3, 3]);
  });

  test("결투: 뱅!을 번갈아 내다 먼저 포기한 쪽이 피해", () => {
    const duel = card("duel");
    const s = fourPlayers({ A: { hand: [duel, card("bang")] }, C: { hand: [card("bang")] } });
    playCard(s, "A", duel.id, "C", undefined);
    respondPending(s, "C", true);
    respondPending(s, "A", true);
    respondPending(s, "C", false);
    assert.equal(s.players.C.hp, 3);
    assert.equal(s.players.A.hp, 5);
  });

  test("제너럴 스토어: 시전자부터 순서대로 1장씩", () => {
    const gs = card("general_store");
    const s = fourPlayers({ A: { hand: [gs] } });
    playCard(s, "A", gs.id, undefined, undefined);
    const pending = s.pending;
    assert.equal(pending?.kind, "general_store");
    if (pending?.kind !== "general_store") return;
    assert.equal(pending.cards.length, 4);
    assert.deepEqual(pickGeneralStore(s, "B", pending.cards[0].id), { ok: false, error: "not_your_response" });
    for (const id of ["A", "B", "C", "D"]) pickGeneralStore(s, id, pending.cards[0].id);
    assert.equal(s.pending, null);
    assert.equal(s.players.D.hand.length, 1);
  });

  test("강탈은 거리 1까지만, 캣 벌루는 거리 무관", () => {
    const panic = card("panic");
    const cat = card("cat_balou");
    const s = fourPlayers({ A: { hand: [panic, cat] }, C: { equipment: { barrel: card("barrel") } } });
    assert.deepEqual(playCard(s, "A", panic.id, "C", "barrel"), { ok: false, error: "out_of_range" });
    assert.deepEqual(playCard(s, "A", cat.id, "C", "barrel"), { ok: true });
    assert.equal(s.players.C.equipment.barrel, null);
  });
});

describe("턴 진행", () => {
  test("턴 종료 시 손패가 체력보다 많으면 버리기 단계", () => {
    const s = fourPlayers({ A: { hp: 2, hand: [card("bang"), card("bang"), card("bang"), card("bang")] } });
    endTurn(s, "A");
    assert.equal(s.turnPhase, "discard");
    assert.equal(s.requiredDiscardCount, 2);
    const ids = s.players.A.hand.slice(0, 2).map((c) => c.id);
    assert.deepEqual(discardCards(s, "A", ids), { ok: true });
    assert.equal(s.order[s.currentPlayerIndex], "B");
    assert.equal(s.players.B.hand.length, 2); // 드로우 2장
  });

  test("감옥: 하트가 아니면 턴을 건너뜀", () => {
    const s = fourPlayers({ B: { equipment: { jail: card("jail") } } }, [card("bang", "clubs", 3)]);
    endTurn(s, "A");
    assert.equal(s.order[s.currentPlayerIndex], "C");
    assert.equal(s.players.B.equipment.jail, null);
  });

  test("다이너마이트: 스페이드 2~9면 폭발해 체력 3 감소", () => {
    const s = fourPlayers({ B: { equipment: { dynamite: card("dynamite") } } }, [card("bang", "spades", 4)]);
    endTurn(s, "A");
    assert.equal(s.players.B.hp, 1);
    assert.equal(s.players.B.equipment.dynamite, null);
  });

  test("다이너마이트: 폭발하지 않으면 다음 사람에게 이동", () => {
    const s = fourPlayers({ B: { equipment: { dynamite: card("dynamite") } } }, [card("bang", "hearts", 4)]);
    endTurn(s, "A");
    assert.equal(s.players.B.equipment.dynamite, null);
    assert.notEqual(s.players.C.equipment.dynamite, null);
  });
});

describe("사망과 승리 조건", () => {
  test("무법자를 처치하면 카드 3장 보상", () => {
    const s = fourPlayers({ B: { hp: 1 } });
    killPlayer(s, s.players.B, "D");
    assert.equal(s.players.D.hand.length, 3);
  });

  test("보안관이 부관을 죽이면 손패와 장착 카드를 모두 잃음", () => {
    const s = makeState([
      { id: "A", role: "sheriff", hand: [card("bang")], equipment: { weapon: card("schofield") } },
      { id: "B", role: "deputy" },
      { id: "C", role: "outlaw" },
      { id: "D", role: "outlaw" },
      { id: "E", role: "renegade" },
    ]);
    killPlayer(s, s.players.B, "A");
    assert.equal(s.players.A.hand.length, 0);
    assert.equal(s.players.A.equipment.weapon, null);
  });

  test("승리 판정", () => {
    const s = fourPlayers();
    assert.equal(checkWinner(s), null);
    s.players.A.alive = false;
    assert.equal(checkWinner(s), "outlaw");
    s.players.B.alive = false;
    s.players.C.alive = false;
    assert.equal(checkWinner(s), "renegade");
    s.players.A.alive = true;
    s.players.D.alive = false;
    assert.equal(checkWinner(s), "sheriff");
  });
});

describe("버그 수정 회귀 테스트", () => {
  test("치명상을 입으면 손패의 맥주를 자동으로 마셔 생존", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] }, B: { hp: 1, hand: [card("beer")] } });
    playCard(s, "A", bang.id, "B", undefined);
    respondPending(s, "B", false);
    assert.equal(s.players.B.alive, true);
    assert.equal(s.players.B.hp, 1);
    assert.equal(s.players.B.hand.length, 0);
  });

  test("다이너마이트(3 피해)는 맥주가 모자라면 마시지 않고 사망", () => {
    const s = fourPlayers(
      { B: { hp: 2, hand: [card("beer")], equipment: { dynamite: card("dynamite") } } },
      [card("bang", "spades", 4)]
    );
    endTurn(s, "A");
    assert.equal(s.players.B.alive, false);
    assert.equal(s.order[s.currentPlayerIndex], "C");
  });

  test("다이너마이트(3 피해)도 맥주 2장이면 버팀", () => {
    const s = fourPlayers(
      { B: { hp: 2, hand: [card("beer"), card("beer")], equipment: { dynamite: card("dynamite") } } },
      [card("bang", "spades", 4)]
    );
    endTurn(s, "A");
    assert.equal(s.players.B.alive, true);
    assert.equal(s.players.B.hp, 1);
  });

  test("생존자 2명이면 맥주는 효과 없음 (사용 불가, 자동 회생도 없음)", () => {
    const beer = card("beer");
    const bang = card("bang");
    const s = fourPlayers({ A: { hp: 3, hand: [beer, bang] }, B: { hp: 1, hand: [card("beer")] }, C: { alive: false } });
    s.players.D.alive = false;
    s.players.D.role = "outlaw";
    s.players.C.role = "renegade";
    assert.deepEqual(playCard(s, "A", beer.id, undefined, undefined), { ok: false, error: "beer_no_effect" });
    playCard(s, "A", bang.id, "B", undefined);
    respondPending(s, "B", false);
    assert.equal(s.players.B.alive, false);
  });

  test("자기가 건 결투에서 져서 죽으면 턴이 다음 사람에게 넘어감", () => {
    const duel = card("duel");
    const s = fourPlayers({ B: { hp: 1 }, C: { hand: [card("bang")] } });
    s.currentPlayerIndex = 1;
    s.players.B.hand.push(duel);
    playCard(s, "B", duel.id, "C", undefined);
    respondPending(s, "C", true);
    respondPending(s, "B", false);
    assert.equal(s.players.B.alive, false);
    assert.equal(s.order[s.currentPlayerIndex], "C");
    assert.equal(s.turnPhase, "play");
  });
});

describe("기권(게임 중 나가기)", () => {
  test("자기 턴에 나가면 탈락하고 다음 사람 턴", () => {
    const s = fourPlayers();
    s.currentPlayerIndex = 1;
    forfeit(s, "B");
    assert.equal(s.players.B.alive, false);
    assert.equal(s.order[s.currentPlayerIndex], "C");
  });

  test("뱅! 대상이 나가면 대기 상태 해제, 보상 없음", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] } });
    playCard(s, "A", bang.id, "B", undefined);
    forfeit(s, "B");
    assert.equal(s.pending, null);
    assert.equal(s.players.A.hand.length, 0);
  });

  test("인디언! 시전자가 나가도 나머지 응답이 끝나면 턴이 넘어감", () => {
    const indians = card("indians");
    const s = fourPlayers({ B: { hand: [indians] } });
    s.currentPlayerIndex = 1;
    playCard(s, "B", indians.id, undefined, undefined);
    forfeit(s, "B");
    assert.notEqual(s.pending, null);
    for (const id of ["C", "D", "A"]) respondPending(s, id, false);
    assert.equal(s.pending, null);
    assert.equal(s.order[s.currentPlayerIndex], "C");
  });

  test("제너럴 스토어 차례인 사람이 나가면 다음 사람이 고름, 남은 카드는 버림", () => {
    const gs = card("general_store");
    const s = fourPlayers({ A: { hand: [gs] } });
    playCard(s, "A", gs.id, undefined, undefined);
    const pending = s.pending;
    if (pending?.kind !== "general_store") return assert.fail();
    pickGeneralStore(s, "A", pending.cards[0].id);
    forfeit(s, "B");
    assert.equal(pending.pickOrder[0], "C");
    pickGeneralStore(s, "C", pending.cards[0].id);
    pickGeneralStore(s, "D", pending.cards[0].id);
    assert.equal(s.pending, null);
  });

  test("보안관이 나가면 무법자 승리", () => {
    const s = fourPlayers();
    forfeit(s, "A");
    assert.equal(s.winner, "outlaw");
  });
});
