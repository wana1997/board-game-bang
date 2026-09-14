import type { Server, Socket } from "socket.io";
import {
  createRoom,
  isValidCapacity,
  joinRoom,
  removePlayer,
  sanitizeNickname,
  startRoom,
  type Room,
  type RoomError,
} from "./rooms";
import { startGameForRoom } from "./gameHandlers";

export type AckResponse =
  | { ok: true; room: Room }
  | { ok: false; error: RoomError };

type CreatePayload = { nickname?: unknown; capacity?: unknown };
type JoinPayload = { roomId?: unknown; nickname?: unknown };
type StartPayload = { roomId?: unknown };

function broadcastRoom(io: Server, room: Room) {
  io.to(room.id).emit("room:update", room);
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on(
    "room:create",
    (payload: CreatePayload, ack?: (res: AckResponse) => void) => {
      const nickname = sanitizeNickname(payload?.nickname);
      if (!nickname) return ack?.({ ok: false, error: "invalid_nickname" });
      if (!isValidCapacity(payload?.capacity)) {
        return ack?.({ ok: false, error: "invalid_capacity" });
      }

      const room = createRoom(payload.capacity, socket.id, nickname);
      socket.join(room.id);
      ack?.({ ok: true, room });
    }
  );

  socket.on(
    "room:join",
    (payload: JoinPayload, ack?: (res: AckResponse) => void) => {
      const nickname = sanitizeNickname(payload?.nickname);
      if (!nickname) return ack?.({ ok: false, error: "invalid_nickname" });
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";

      const result = joinRoom(roomId, socket.id, nickname);
      if (typeof result === "string") return ack?.({ ok: false, error: result });

      socket.join(result.id);
      ack?.({ ok: true, room: result });
      broadcastRoom(io, result);
    }
  );

  socket.on(
    "room:start",
    (payload: StartPayload, ack?: (res: AckResponse) => void) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const result = startRoom(roomId, socket.id);
      if (typeof result === "string") return ack?.({ ok: false, error: result });

      ack?.({ ok: true, room: result });
      broadcastRoom(io, result);
      startGameForRoom(io, result.id);
    }
  );

  socket.on("room:leave", () => {
    const room = removePlayer(socket.id);
    socket.rooms.forEach((r) => {
      if (r !== socket.id) socket.leave(r);
    });
    if (room) broadcastRoom(io, room);
  });

  socket.on("disconnect", () => {
    const room = removePlayer(socket.id);
    if (room) broadcastRoom(io, room);
  });
}
