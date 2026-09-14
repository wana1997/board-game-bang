export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type CardName =
  | "bang"
  | "missed"
  | "beer"
  | "indians"
  | "gatling"
  | "duel"
  | "panic"
  | "cat_balou"
  | "stagecoach"
  | "general_store"
  | "saloon"
  | "wells_fargo"
  | "schofield"
  | "volcanic"
  | "remington"
  | "carabine"
  | "winchester"
  | "barrel"
  | "mustang"
  | "scope"
  | "jail"
  | "dynamite";

export type Card = {
  id: string;
  name: CardName;
  suit: Suit;
  value: number; // 2-14 (11=J, 12=Q, 13=K, 14=A)
};

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";
export type Team = "sheriff" | "outlaw" | "renegade";

export type TurnPhase = "play" | "discard";

/** 단일 대상 응답: 뱅!(빗나감!로 방어) */
export type PendingBang = {
  kind: "bang";
  attackerId: string;
  targetId: string;
  respondBy: number;
};

/** 순번 응답: 결투(뱅!을 번갈아 냄, 먼저 못 내는 쪽이 패배) */
export type PendingDuel = {
  kind: "duel";
  casterId: string;
  targetId: string;
  currentResponderId: string;
  respondBy: number;
};

/** 동시 응답: 인디언!(뱅!으로 방어)/기관총(빗나감!으로 방어) — 대상 전원이 병렬로 응답 */
export type PendingBroadcast = {
  kind: "indians" | "gatling";
  casterId: string;
  requiredCard: "bang" | "missed";
  targets: string[]; // 아직 응답하지 않은 대상 id 목록
  respondBy: number;
};

/** 선택 응답: 제너럴 스토어(공개된 카드 중 순서대로 한 장씩 선택) */
export type PendingGeneralStore = {
  kind: "general_store";
  cards: Card[];
  pickOrder: string[]; // 아직 선택하지 않은 플레이어 id, 차례대로
  respondBy: number;
};

export type PendingResponse = PendingBang | PendingDuel | PendingBroadcast | PendingGeneralStore;

export type EquipmentSlot = "weapon" | "scope" | "mustang" | "barrel" | "jail" | "dynamite";

export type Equipment = Record<EquipmentSlot, Card | null>;

export function createEquipment(): Equipment {
  return { weapon: null, scope: null, mustang: null, barrel: null, jail: null, dynamite: null };
}

export type PlayerState = {
  id: string;
  nickname: string;
  role: Role;
  hp: number;
  maxHp: number;
  hand: Card[];
  equipment: Equipment;
  alive: boolean;
};

export type GameState = {
  roomId: string;
  order: string[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  bangPlayedThisTurn: boolean;
  requiredDiscardCount: number;
  deck: Card[];
  discard: Card[];
  players: Record<string, PlayerState>;
  pending: PendingResponse | null;
  winner: Team | null;
  log: string[];
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export const ok = (): ActionResult => ({ ok: true });
export const err = (error: string): ActionResult => ({ ok: false, error });

export const ROLE_LABEL: Record<Role, string> = {
  sheriff: "보안관",
  deputy: "부관",
  outlaw: "무법자",
  renegade: "배신자",
};

export const TEAM_LABEL: Record<Team, string> = {
  sheriff: "보안관 진영",
  outlaw: "무법자",
  renegade: "배신자",
};

export const CARD_LABEL: Record<CardName, string> = {
  bang: "뱅!",
  missed: "빗나감!",
  beer: "맥주",
  indians: "인디언!",
  gatling: "기관총",
  duel: "결투",
  panic: "강탈",
  cat_balou: "캣 벌루",
  stagecoach: "스테이지코치",
  general_store: "제너럴 스토어",
  saloon: "살룬",
  wells_fargo: "웰스 파고",
  schofield: "스콜필드",
  volcanic: "볼칸",
  remington: "레밍턴",
  carabine: "카라빈",
  winchester: "윈체스터",
  barrel: "술통",
  mustang: "야생마",
  scope: "조준경",
  jail: "감옥",
  dynamite: "다이너마이트",
};

export const SUIT_LABEL: Record<Suit, string> = {
  spades: "스페이드",
  hearts: "하트",
  diamonds: "다이아몬드",
  clubs: "클로버",
};

export function cardCheckLabel(card: Card): string {
  const valueLabel = card.value === 14 ? "A" : card.value === 13 ? "K" : card.value === 12 ? "Q" : card.value === 11 ? "J" : String(card.value);
  return `${SUIT_LABEL[card.suit]} ${valueLabel}`;
}
