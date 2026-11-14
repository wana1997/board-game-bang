export type Player = {
  id: string;
  nickname: string;
  isHost: boolean;
  /** 소켓 연결 여부. 게임 중 연결이 끊겨도 자리는 유지되고, 재접속하면 true로 돌아온다. */
  connected: boolean;
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

const rooms = new Map<string, Room>();

// O/0/I/1 제외 (오인 방지)
const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_LENGTH = 4;
const MIN_CAPACITY = 4;
const MAX_CAPACITY = 7;
const NICKNAME_MAX_LENGTH = 12;

function generateRoomId(): string {
  let id: string;
  do {
    id = Array.from(
      { length: ROOM_ID_LENGTH },
      () => ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)]
    ).join("");
  } while (rooms.has(id));
  return id;
}

export function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > NICKNAME_MAX_LENGTH) return null;
  return trimmed;
}

export function isValidCapacity(raw: unknown): raw is number {
  return (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= MIN_CAPACITY &&
    raw <= MAX_CAPACITY
  );
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function createRoom(
  capacity: number,
  hostId: string,
  hostNickname: string
): Room {
  const room: Room = {
    id: generateRoomId(),
    capacity,
    status: "waiting",
    players: [{ id: hostId, nickname: hostNickname, isHost: true, connected: true }],
  };
  rooms.set(room.id, room);
  return room;
}

export function joinRoom(
  roomId: string,
  playerId: string,
  nickname: string
): Room | RoomError {
  const room = getRoom(roomId);
  if (!room) return "not_found";
  // 이미 이 방에 있는 플레이어(새로고침 후 재입장)는 그대로 통과
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    existing.connected = true;
    return room;
  }
  if (room.status !== "waiting") return "already_started";
  if (room.players.length >= room.capacity) return "full";
  if (room.players.some((p) => p.nickname === nickname)) return "nickname_taken";
  room.players.push({ id: playerId, nickname, isHost: false, connected: true });
  return room;
}

export function startRoom(roomId: string, requesterId: string): Room | RoomError {
  const room = getRoom(roomId);
  if (!room) return "not_found";
  const host = room.players.find((p) => p.isHost);
  if (!host || host.id !== requesterId) return "not_host";
  if (room.status !== "waiting") return "already_started";
  if (room.players.length !== room.capacity) return "not_full";
  room.status = "playing";
  return room;
}

/** 플레이어를 소속 방에서 제거. 방이 비면 삭제하고, 호스트였다면 다음 플레이어에게 위임. */
export function removePlayer(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) continue;

    const wasHost = room.players[idx].isHost;
    room.players.splice(idx, 1);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      return undefined;
    }
    if (wasHost) {
      room.players[0].isHost = true;
    }
    return room;
  }
  return undefined;
}

export function findRoomByPlayer(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.id === playerId)) return room;
  }
  return undefined;
}

export function setConnected(room: Room, playerId: string, connected: boolean) {
  const player = room.players.find((p) => p.id === playerId);
  if (player) player.connected = connected;
}

export function deleteRoom(roomId: string) {
  rooms.delete(roomId.toUpperCase());
}

/** 게임 종료 후 같은 멤버로 대기실로 복귀. 방장만 가능. */
export function restartRoom(roomId: string, requesterId: string): Room | RoomError {
  const room = getRoom(roomId);
  if (!room) return "not_found";
  const host = room.players.find((p) => p.isHost);
  if (!host || host.id !== requesterId) return "not_host";
  room.status = "waiting";
  return room;
}
