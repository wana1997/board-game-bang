// 테스트 전용 헬퍼: 무작위 요소(역할 배정, 덱 셔플) 없이 원하는 상황의 GameState를 직접 만든다.
import type { CharacterId } from "./characters";
import { createEquipment, type Card, type CardName, type Equipment, type GameState, type PlayerState, type Role, type Suit } from "./types";

let seq = 0;

export function card(name: CardName, suit: Suit = "clubs", value = 5): Card {
  seq += 1;
  return { id: `${name}_t${seq}`, name, suit, value };
}

export type PlayerSpec = {
  id: string;
  role: Role;
  character?: CharacterId;
  hp?: number;
  maxHp?: number;
  hand?: Card[];
  equipment?: Partial<Equipment>;
  alive?: boolean;
};

/**
 * order는 specs 순서 그대로, 현재 턴은 첫 번째 플레이어.
 * deck은 "다음에 뽑힐 카드가 배열의 앞"이 되도록 넘긴다(내부적으로 pop 순서에 맞춰 뒤집음).
 */
export function makeState(specs: PlayerSpec[], opts: { deck?: Card[]; currentIndex?: number } = {}): GameState {
  const players: Record<string, PlayerState> = {};
  for (const s of specs) {
    const maxHp = s.maxHp ?? 4;
    players[s.id] = {
      id: s.id,
      nickname: s.id,
      role: s.role,
      // 기본값은 패시브 능력이 없는(액티브 스킬만 있는) 엘리아스 그레이 — 다른 테스트 결과에 끼어들지 않는다.
      character: s.character ?? "elias_grey",
      hp: s.hp ?? maxHp,
      maxHp,
      hand: s.hand ?? [],
      equipment: { ...createEquipment(), ...s.equipment },
      alive: s.alive ?? true,
    };
  }
  return {
    roomId: "TEST",
    order: specs.map((s) => s.id),
    currentPlayerIndex: opts.currentIndex ?? 0,
    turnPhase: "play",
    bangsPlayedThisTurn: 0,
    skillUsedThisTurn: false,
    requiredDiscardCount: 0,
    deck: [...(opts.deck ?? Array.from({ length: 20 }, () => card("bang")))].reverse(),
    discard: [],
    players,
    pending: null,
    winner: null,
    log: [],
  };
}

/** 4인 기본 테이블: A(보안관) B(무법자) C(무법자) D(배신자). */
export function fourPlayers(overrides: Partial<Record<"A" | "B" | "C" | "D", Partial<PlayerSpec>>> = {}, deck?: Card[]) {
  const base: PlayerSpec[] = [
    { id: "A", role: "sheriff", maxHp: 5 },
    { id: "B", role: "outlaw" },
    { id: "C", role: "outlaw" },
    { id: "D", role: "renegade" },
  ];
  return makeState(
    base.map((p) => ({ ...p, ...overrides[p.id as "A" | "B" | "C" | "D"] })),
    { deck }
  );
}
