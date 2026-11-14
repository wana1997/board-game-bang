import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { endTurn, playCard, respondPending, useSkill } from "./actions";
import { killPlayer } from "./state";
import { canShoot } from "./distance";
import { card, fourPlayers } from "./testUtils";

describe("캐릭터 능력", () => {
  test("도크 해밀턴: 맥주로 체력 2 회복", () => {
    const beer = card("beer");
    const s = fourPlayers({ A: { character: "doc_hamilton", hp: 2, hand: [beer] } });
    playCard(s, "A", beer.id, undefined, undefined);
    assert.equal(s.players.A.hp, 4);
  });

  test("도크 해밀턴: 다이너마이트 3 피해도 맥주 1장으로 버팀", () => {
    const s = fourPlayers(
      { B: { character: "doc_hamilton", hp: 2, hand: [card("beer")], equipment: { dynamite: card("dynamite") } } },
      [card("bang", "spades", 4)]
    );
    endTurn(s, "A");
    assert.equal(s.players.B.alive, true);
    assert.equal(s.players.B.hp, 1);
  });

  test("리버 존: 빗나감!으로 막으면 1장 드로우", () => {
    const bang = card("bang");
    const s = fourPlayers({ A: { hand: [bang] }, B: { character: "river_john", hand: [card("missed")] } });
    playCard(s, "A", bang.id, "B", undefined);
    respondPending(s, "B", true);
    assert.equal(s.players.B.hand.length, 1);
  });

  test("리버 존: 술통으로 막아도 1장 드로우", () => {
    const bang = card("bang");
    const s = fourPlayers(
      { A: { hand: [bang] }, B: { character: "river_john", equipment: { barrel: card("barrel") } } },
      [card("bang", "hearts", 9)]
    );
    playCard(s, "A", bang.id, "B", undefined);
    assert.equal(s.players.B.hand.length, 1);
  });

  test("카스 몰리나: 무기 없으면 뱅! 2회, 무기 장착하면 1회", () => {
    const [b1, b2, b3] = [card("bang"), card("bang"), card("bang")];
    const s = fourPlayers({ A: { character: "cass_molina", hand: [b1, b2, b3] } });
    playCard(s, "A", b1.id, "B", undefined);
    respondPending(s, "B", false);
    assert.deepEqual(playCard(s, "A", b2.id, "B", undefined), { ok: true });
    respondPending(s, "B", false);
    assert.deepEqual(playCard(s, "A", b3.id, "B", undefined), { ok: false, error: "bang_already_used" });

    const s2 = fourPlayers({ A: { character: "cass_molina", hand: [card("bang"), card("bang")], equipment: { weapon: card("schofield") } } });
    const [c1, c2] = s2.players.A.hand;
    playCard(s2, "A", c1.id, "B", undefined);
    respondPending(s2, "B", false);
    assert.deepEqual(playCard(s2, "A", c2.id, "B", undefined), { ok: false, error: "bang_already_used" });
  });

  test("새디 크로우: 다른 플레이어가 쓰러지면 2장 드로우", () => {
    const s = fourPlayers({ D: { character: "sadie_crow" } });
    killPlayer(s, s.players.C, null);
    assert.equal(s.players.D.hand.length, 2);
  });

  test("엘리아스 그레이: 턴당 1회 카드 교체", () => {
    const junk = card("missed");
    const s = fourPlayers({ A: { character: "elias_grey", hand: [junk, card("bang")] } });
    assert.deepEqual(useSkill(s, "A", [junk.id]), { ok: true });
    assert.equal(s.players.A.hand.length, 2);
    assert.ok(!s.players.A.hand.some((c) => c.id === junk.id));
    assert.deepEqual(useSkill(s, "A", [s.players.A.hand[0].id]), { ok: false, error: "skill_already_used" });
  });

  test("액티브 스킬이 없는 캐릭터는 스킬 사용 불가", () => {
    const s = fourPlayers({ A: { character: "maggie_hale", hand: [card("bang")] } });
    assert.deepEqual(useSkill(s, "A", [s.players.A.hand[0].id]), { ok: false, error: "no_active_skill" });
  });

  test("톰 레이놀즈: 손패를 체력 +2장까지 보유", () => {
    const hand = Array.from({ length: 5 }, () => card("bang"));
    const s = fourPlayers({ A: { character: "tom_reynolds", hp: 3, hand } });
    endTurn(s, "A");
    assert.equal(s.order[s.currentPlayerIndex], "B");
  });

  test("루시 페어웨더: 드로우 단계에 3장", () => {
    const s = fourPlayers({ B: { character: "lucy_fairweather" } });
    endTurn(s, "A");
    assert.equal(s.players.B.hand.length, 3);
  });

  test("매기 헤일: 무기 없이도 거리 2를 쏠 수 있음", () => {
    const s = fourPlayers({ A: { character: "maggie_hale" } });
    assert.equal(canShoot(s, "A", "C"), true);
  });
});
