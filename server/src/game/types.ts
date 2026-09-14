export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type CardName = "bang" | "missed" | "beer";

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

export type PlayerState = {
  id: string;
  nickname: string;
  role: Role;
  hp: number;
  maxHp: number;
  hand: Card[];
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
