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

/** Phase 6 완성 덱: CARDS.MD 갈색 63장 + 파란 17장 = 80장 전체. */
export function buildDeck(): Card[] {
  return [
    ...makeCards("bang", 25, "bang"),
    ...makeCards("missed", 12, "missed"),
    ...makeCards("beer", 6, "beer"),
    ...makeCards("panic", 4, "panic"),
    ...makeCards("cat_balou", 4, "cat_balou"),
    ...makeCards("duel", 3, "duel"),
    ...makeCards("indians", 2, "indians"),
    ...makeCards("stagecoach", 2, "stagecoach"),
    ...makeCards("general_store", 2, "general_store"),
    ...makeCards("gatling", 1, "gatling"),
    ...makeCards("saloon", 1, "saloon"),
    ...makeCards("wells_fargo", 1, "wells_fargo"),
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
