import type { Card, CardName, Suit } from "./types";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function makeCards(name: CardName, count: number, idPrefix: string): Card[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}_${i}`,
    name,
    suit: SUITS[i % SUITS.length],
    value: 2 + (i % 13),
  }));
}

/**
 * Phase 3 MVP 덱: CARDS.MD 갈색 카드 중 뱅!/빗나감!/맥주, 파란 카드 17장 전체(무기 5종/술통/야생마/조준경/감옥/다이너마이트).
 * 강탈/캣벌루/결투/인디언/기관총/웰스파고/스테이지코치/제너럴스토어/살룬은 Phase 4, 6에서 추가.
 */
export function buildDeck(): Card[] {
  return [
    ...makeCards("bang", 25, "bang"),
    ...makeCards("missed", 12, "missed"),
    ...makeCards("beer", 6, "beer"),
    ...makeCards("schofield", 3, "schofield"),
    ...makeCards("volcanic", 2, "volcanic"),
    ...makeCards("remington", 1, "remington"),
    ...makeCards("carabine", 1, "carabine"),
    ...makeCards("winchester", 1, "winchester"),
    ...makeCards("barrel", 2, "barrel"),
    ...makeCards("mustang", 2, "mustang"),
    ...makeCards("scope", 1, "scope"),
    ...makeCards("jail", 3, "jail"),
    ...makeCards("dynamite", 1, "dynamite"),
  ];
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
