export type Player = {
  id: string;
  nickname: string;
  isHost: boolean;
};

export type RoomStatus = "waiting" | "playing";

export type Room = {
  id: string;
  capacity: number;
  status: RoomStatus;
  players: Player[];
};

export type RoomError =
  | "invalid_nickname"
  | "invalid_capacity"
  | "not_found"
  | "full"
  | "already_started"
  | "nickname_taken"
  | "not_host"
  | "not_full";

export type AckResponse =
  | { ok: true; room: Room }
  | { ok: false; error: RoomError };

// ---- 게임 (Phase 3: 뱅!/빗나감!/맥주 + 거리 시스템/장착 카드) ----

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
  value: number;
};

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";
export type Team = "sheriff" | "outlaw" | "renegade";
export type TurnPhase = "play" | "discard";

export type PendingBang = {
  kind: "bang";
  attackerId: string;
  targetId: string;
  respondBy: number;
};

export type PendingDuel = {
  kind: "duel";
  casterId: string;
  targetId: string;
  currentResponderId: string;
  respondBy: number;
};

export type PendingBroadcast = {
  kind: "indians" | "gatling";
  casterId: string;
  requiredCard: "bang" | "missed";
  targets: string[];
  respondBy: number;
};

export type PendingGeneralStore = {
  kind: "general_store";
  cards: Card[];
  pickOrder: string[];
  respondBy: number;
};

export type PendingResponse = PendingBang | PendingDuel | PendingBroadcast | PendingGeneralStore;

export type EquipmentSlot = "weapon" | "scope" | "mustang" | "barrel" | "jail" | "dynamite";

export type PublicEquipmentView = {
  weapon: CardName | null;
  scope: boolean;
  mustang: boolean;
  barrel: boolean;
  jail: boolean;
  dynamite: boolean;
};

export type PublicPlayerView = {
  id: string;
  nickname: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  handCount: number;
  role: Role | null;
  equipment: PublicEquipmentView;
};

export type GameView = {
  roomId: string;
  order: string[];
  currentPlayerId: string;
  turnPhase: TurnPhase;
  bangPlayedThisTurn: boolean;
  requiredDiscardCount: number;
  deckCount: number;
  players: PublicPlayerView[];
  self: { id: string; role: Role; hand: Card[] };
  pending: PendingResponse | null;
  winner: Team | null;
  log: string[];
};

export type GameActionError =
  | "game_not_found"
  | "game_over"
  | "awaiting_response"
  | "not_alive"
  | "not_your_turn"
  | "wrong_phase"
  | "card_not_found"
  | "bang_already_used"
  | "invalid_target"
  | "out_of_range"
  | "already_equipped"
  | "cannot_jail_sheriff"
  | "cannot_play_outside_response"
  | "no_pending_response"
  | "not_your_response"
  | "no_missed_card"
  | "wrong_discard_count"
  | "duplicate_card";

export type GameActionResponse = { ok: true } | { ok: false; error: GameActionError };

export interface ServerToClientEvents {
  "room:update": (room: Room) => void;
  "game:update": (game: GameView) => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: { nickname: string; capacity: number },
    ack: (res: AckResponse) => void
  ) => void;
  "room:join": (
    payload: { roomId: string; nickname: string },
    ack: (res: AckResponse) => void
  ) => void;
  "room:start": (
    payload: { roomId: string },
    ack: (res: AckResponse) => void
  ) => void;
  "room:leave": () => void;
  "game:play_card": (
    payload: { roomId: string; cardId: string; targetId?: string; option?: string },
    ack: (res: GameActionResponse) => void
  ) => void;
  "game:respond": (
    payload: { roomId: string; play: boolean },
    ack: (res: GameActionResponse) => void
  ) => void;
  "game:discard_cards": (
    payload: { roomId: string; cardIds: string[] },
    ack: (res: GameActionResponse) => void
  ) => void;
  "game:end_turn": (
    payload: { roomId: string },
    ack: (res: GameActionResponse) => void
  ) => void;
  "game:pick_general_store": (
    payload: { roomId: string; cardId: string },
    ack: (res: GameActionResponse) => void
  ) => void;
}

export const ROOM_ERROR_MESSAGES: Record<RoomError, string> = {
  invalid_nickname: "닉네임은 1~12자로 입력해주세요.",
  invalid_capacity: "인원수는 4~7명 중에서 선택해주세요.",
  not_found: "존재하지 않는 방 코드입니다.",
  full: "이미 정원이 가득 찬 방입니다.",
  already_started: "이미 게임이 시작된 방입니다.",
  nickname_taken: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.",
  not_host: "방장만 게임을 시작할 수 있습니다.",
  not_full: "정원이 다 차야 게임을 시작할 수 있습니다.",
};

export const GAME_ERROR_MESSAGES: Record<GameActionError, string> = {
  game_not_found: "게임을 찾을 수 없습니다.",
  game_over: "이미 종료된 게임입니다.",
  awaiting_response: "다른 플레이어의 응답을 기다리는 중입니다.",
  not_alive: "탈락한 플레이어는 행동할 수 없습니다.",
  not_your_turn: "내 턴이 아닙니다.",
  wrong_phase: "지금은 할 수 없는 행동입니다.",
  card_not_found: "손패에 없는 카드입니다.",
  bang_already_used: "이번 턴에는 이미 뱅!을 사용했습니다.",
  invalid_target: "대상을 다시 선택해주세요.",
  out_of_range: "사거리 밖에 있는 대상입니다.",
  already_equipped: "이미 장착되어 있어 낼 수 없습니다.",
  cannot_jail_sheriff: "보안관에게는 감옥을 사용할 수 없습니다.",
  cannot_play_outside_response: "지금은 낼 수 없는 카드입니다.",
  no_pending_response: "응답할 대상이 없습니다.",
  not_your_response: "내가 응답할 차례가 아닙니다.",
  no_missed_card: "빗나감! 카드가 없습니다.",
  wrong_discard_count: "버려야 할 카드 수가 맞지 않습니다.",
  duplicate_card: "같은 카드를 중복해서 선택했습니다.",
};

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

export const CARD_ICON: Record<CardName, string> = {
  bang: "🔫",
  missed: "🛡️",
  beer: "🍺",
  indians: "🏹",
  gatling: "⚙️",
  duel: "⚔️",
  panic: "😱",
  cat_balou: "🐈",
  stagecoach: "🚃",
  general_store: "🏪",
  saloon: "🍻",
  wells_fargo: "💰",
  schofield: "🔫",
  volcanic: "🔫",
  remington: "🔫",
  carabine: "🔫",
  winchester: "🔫",
  barrel: "🛢️",
  mustang: "🐎",
  scope: "🔭",
  jail: "⛓️",
  dynamite: "🧨",
};

export const WEAPON_CARDS = new Set<CardName>([
  "schofield",
  "volcanic",
  "remington",
  "carabine",
  "winchester",
]);

export const WEAPON_RANGE: Partial<Record<CardName, number>> = {
  schofield: 2,
  volcanic: 1,
  remington: 3,
  carabine: 4,
  winchester: 5,
};

export function weaponRangeOf(weapon: CardName | null): number {
  if (!weapon) return 1;
  return WEAPON_RANGE[weapon] ?? 1;
}

/** 파란(장착형) 카드 전체 — 카드 색상 톤 분기에 사용. */
export const BLUE_CARDS = new Set<CardName>([
  ...WEAPON_CARDS,
  "scope",
  "mustang",
  "barrel",
  "jail",
  "dynamite",
]);

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  spades: false,
  hearts: true,
  diamonds: true,
  clubs: false,
};

export function cardValueLabel(value: number): string {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value);
}

export const ROLE_ICON: Record<Role, string> = {
  sheriff: "★",
  deputy: "🛡",
  outlaw: "💀",
  renegade: "🃏",
};

/** 생존자만 놓고 원탁에서 몇 칸 떨어져 있는지 (양옆 = 1). 서버 game/distance.ts와 동일 로직. */
export function seatDistance(order: string[], players: PublicPlayerView[], aId: string, bId: string): number {
  const aliveIds = order.filter((id) => players.find((p) => p.id === id)?.alive);
  const ai = aliveIds.indexOf(aId);
  const bi = aliveIds.indexOf(bId);
  if (ai === -1 || bi === -1) return Infinity;
  const n = aliveIds.length;
  const diff = Math.abs(ai - bi);
  return Math.min(diff, n - diff);
}

export function effectiveDistance(
  order: string[],
  players: PublicPlayerView[],
  fromId: string,
  toId: string
): number {
  const base = seatDistance(order, players, fromId, toId);
  const attacker = players.find((p) => p.id === fromId);
  const target = players.find((p) => p.id === toId);
  const scopeBonus = attacker?.equipment.scope ? 1 : 0;
  const mustangBonus = target?.equipment.mustang ? 1 : 0;
  return Math.max(1, base - scopeBonus + mustangBonus);
}
