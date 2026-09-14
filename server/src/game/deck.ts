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

/** Phase 2 MVP 덱: 뱅!/빗나감!/맥주만 포함 (CARDS.MD 갈색 카드 수량 기준). */
export function buildDeck(): Card[] {
  return [
    ...makeCards("bang", 25, "bang"),
    ...makeCards("missed", 12, "missed"),
    ...makeCards("beer", 6, "beer"),
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
