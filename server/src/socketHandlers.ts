import type { Server, Socket } from "socket.io";
import { config } from "./config";
import {
  createRoom,
  deleteRoom,
  findRoomByPlayer,
  isValidCapacity,
  joinRoom,
  removePlayer,
  restartRoom,
  sanitizeNickname,
  setConnected,
  startRoom,
  type Room,
  type RoomError,
} from "./rooms";
import { endGameForRoom, forfeitInGame, isGameOver, sendGameTo, startGameForRoom } from "./gameHandlers";

export type AckResponse =
  | { ok: true; room: Room }
  | { ok: false; error: RoomError | "game_in_progress" };

type CreatePayload = { nickname?: unknown; capacity?: unknown };
type JoinPayload = { roomId?: unknown; nickname?: unknown };
type StartPayload = { roomId?: unknown };

const PLAYER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** 클라이언트가 보낸 탭별 토큰을 플레이어 id로 사용 (새로고침해도 유지). 없거나 이상하면 소켓 id. */
export function resolvePlayerId(socket: Socket): string {
  const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
  return typeof token === "string" && PLAYER_TOKEN_PATTERN.test(token) ? token : socket.id;
}

export function playerIdOf(socket: Socket): string {
  return socket.data.playerId as string;
}

/** 대기실에서 연결이 끊긴 플레이어를 내보내기까지의 유예 타이머 (새로고침 대비). */
const lobbyRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** 게임 중 방 전원이 끊겼을 때 방을 정리하는 타이머. */
const idleRoomTimers = new Map<string, ReturnType<typeof setTimeout>>();

function broadcastRoom(io: Server, room: Room) {
  io.to(room.id).emit("room:update", room);
}

function cancelTimer(map: Map<string, ReturnType<typeof setTimeout>>, key: string) {
  const timer = map.get(key);
  if (timer) {
    clearTimeout(timer);
    map.delete(key);
  }
}

function leaveRoomNow(io: Server, playerId: string) {
  const room = findRoomByPlayer(playerId);
  if (!room) return;

  if (room.status === "playing") forfeitInGame(io, room.id, playerId);

  const roomId = room.id;
  const remaining = removePlayer(playerId);
  if (remaining) {
    broadcastRoom(io, remaining);
  } else {
    endGameForRoom(roomId);
    cancelTimer(idleRoomTimers, roomId);
  }
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  const playerId = resolvePlayerId(socket);
  socket.data.playerId = playerId;
  socket.join(playerId); // 개인 채널: io.to(playerId)로 이 플레이어의 모든 탭에 전송

  // 재접속: 이미 속한 방이 있으면 방/게임 상태를 다시 보내준다.
  cancelTimer(lobbyRemovalTimers, playerId);
  const existingRoom = findRoomByPlayer(playerId);
  // 클라이언트가 자신이 아직 방에 속해 있는지 알 수 있도록 (서버 재시작 등으로 방이 사라졌으면 null)
  socket.emit("session", { playerId, roomId: existingRoom?.id ?? null });
  if (existingRoom) {
    cancelTimer(idleRoomTimers, existingRoom.id);
    socket.join(existingRoom.id);
    setConnected(existingRoom, playerId, true);
    broadcastRoom(io, existingRoom);
    if (existingRoom.status === "playing") sendGameTo(io, existingRoom.id, playerId);
  }

  socket.on("room:create", (payload: CreatePayload, ack?: (res: AckResponse) => void) => {
    const nickname = sanitizeNickname(payload?.nickname);
    if (!nickname) return ack?.({ ok: false, error: "invalid_nickname" });
    if (!isValidCapacity(payload?.capacity)) {
      return ack?.({ ok: false, error: "invalid_capacity" });
    }

    // 다른 방에 남아 있었다면 먼저 정리
    leaveRoomNow(io, playerId);
    const room = createRoom(payload.capacity, playerId, nickname);
    socket.join(room.id);
    ack?.({ ok: true, room });
  });

  socket.on("room:join", (payload: JoinPayload, ack?: (res: AckResponse) => void) => {
    const nickname = sanitizeNickname(payload?.nickname);
    if (!nickname) return ack?.({ ok: false, error: "invalid_nickname" });
    const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";

    const current = findRoomByPlayer(playerId);
    if (current && current.id !== roomId.toUpperCase()) leaveRoomNow(io, playerId);

    const result = joinRoom(roomId, playerId, nickname);
    if (typeof result === "string") return ack?.({ ok: false, error: result });

    socket.join(result.id);
    ack?.({ ok: true, room: result });
    broadcastRoom(io, result);
    if (result.status === "playing") sendGameTo(io, result.id, playerId);
  });

  socket.on("room:start", (payload: StartPayload, ack?: (res: AckResponse) => void) => {
    const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
    const result = startRoom(roomId, playerId);
    if (typeof result === "string") return ack?.({ ok: false, error: result });

    ack?.({ ok: true, room: result });
    broadcastRoom(io, result);
    startGameForRoom(io, result.id);
  });

  socket.on("room:restart", (payload: StartPayload, ack?: (res: AckResponse) => void) => {
    const roomId = typeof payload?.roomId === "string" ? payload.roomId.toUpperCase() : "";
    if (!isGameOver(roomId)) return ack?.({ ok: false, error: "game_in_progress" });

    const result = restartRoom(roomId, playerId);
    if (typeof result === "string") return ack?.({ ok: false, error: result });

    endGameForRoom(roomId);
    ack?.({ ok: true, room: result });
    broadcastRoom(io, result);
  });

  socket.on("room:leave", () => {
    cancelTimer(lobbyRemovalTimers, playerId);
    const room = findRoomByPlayer(playerId);
    leaveRoomNow(io, playerId);
    if (room) {
      // 같은 플레이어의 모든 탭을 방 채널에서 뺀다
      io.in(playerId).socketsLeave(room.id);
    }
  });

  socket.on("disconnect", async () => {
    // 같은 토큰으로 열린 다른 탭이 남아 있으면 연결 유지로 본다
    const stillConnected = (await io.in(playerId).fetchSockets()).length > 0;
    if (stillConnected) return;

    const room = findRoomByPlayer(playerId);
    if (!room) return;

    setConnected(room, playerId, false);
    broadcastRoom(io, room);

    if (room.status === "waiting") {
      lobbyRemovalTimers.set(
        playerId,
        setTimeout(() => {
          lobbyRemovalTimers.delete(playerId);
          const r = findRoomByPlayer(playerId);
          if (r && r.status === "waiting" && !r.players.find((p) => p.id === playerId)?.connected) {
            leaveRoomNow(io, playerId);
          }
        }, config.lobbyReconnectGraceMs)
      );
      return;
    }

    // 게임 중: 자리는 유지. 전원이 끊긴 상태가 오래 지속되면 방을 정리한다.
    if (room.players.every((p) => !p.connected)) {
      const roomId = room.id;
      idleRoomTimers.set(
        roomId,
        setTimeout(() => {
          idleRoomTimers.delete(roomId);
          const r = findRoomByPlayer(playerId);
          if (r && r.id === roomId && r.players.every((p) => !p.connected)) {
            endGameForRoom(roomId);
            deleteRoom(roomId);
          }
        }, config.idleRoomTimeoutMs)
      );
    }
  });
}
