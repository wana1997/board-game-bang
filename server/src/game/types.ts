export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type CardName =
  | "bang"
  | "missed"
  | "beer"
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

export type PendingBang = {
  attackerId: string;
  targetId: string;
  respondBy: number;
};

export type Equipment = {
  weapon: Card | null; // null = 기본 콜트(사거리 1)
  scope: Card | null;
  mustang: Card | null;
  barrel: Card | null;
  jail: Card | null;
  dynamite: Card | null;
};

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
  pendingBang: PendingBang | null;
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
