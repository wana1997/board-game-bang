import type { Server, Socket } from "socket.io";
import { getRoom } from "./rooms";
import { createGame } from "./game/state";
import { discardCards, endTurn, playCard, respondBang } from "./game/actions";
import { buildGameView } from "./game/view";
import type { GameState } from "./game/types";

const games = new Map<string, GameState>();
const bangTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function startGameForRoom(io: Server, roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  const state = createGame(room);
  games.set(roomId, state);
  broadcastGame(io, state);
}

function broadcastGame(io: Server, state: GameState) {
  for (const id of state.order) {
    io.to(id).emit("game:update", buildGameView(state, id));
  }
  if (state.pendingBang) {
    scheduleBangTimer(io, state);
  } else {
    clearBangTimer(state.roomId);
  }
}

function clearBangTimer(roomId: string) {
  const timer = bangTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    bangTimers.delete(roomId);
  }
}

function scheduleBangTimer(io: Server, state: GameState) {
  clearBangTimer(state.roomId);
  const pending = state.pendingBang;
  if (!pending) return;

  const delay = Math.max(0, pending.respondBy - Date.now());
  const timer = setTimeout(() => {
    if (state.pendingBang !== pending) return; // 이미 응답/타임아웃 처리됨
    respondBang(state, pending.targetId, false);
    broadcastGame(io, state);
  }, delay);
  bangTimers.set(state.roomId, timer);
}

function resolveRoomId(payload: unknown): string {
  const roomId = (payload as { roomId?: unknown } | undefined)?.roomId;
  return typeof roomId === "string" ? roomId.toUpperCase() : "";
}

export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on(
    "game:play_card",
    (payload: { roomId?: unknown; cardId?: unknown; targetId?: unknown }, ack?: (res: unknown) => void) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const cardId = typeof payload?.cardId === "string" ? payload.cardId : "";
      const targetId = typeof payload?.targetId === "string" ? payload.targetId : undefined;

      const result = playCard(state, socket.id, cardId, targetId);
      ack?.(result);
      if (result.ok) broadcastGame(io, state);
    }
  );

  socket.on(
    "game:respond_bang",
    (payload: { roomId?: unknown; play?: unknown }, ack?: (res: unknown) => void) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const result = respondBang(state, socket.id, payload?.play === true);
      ack?.(result);
      if (result.ok) broadcastGame(io, state);
    }
  );

  socket.on(
    "game:discard_cards",
    (payload: { roomId?: unknown; cardIds?: unknown }, ack?: (res: unknown) => void) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const cardIds = Array.isArray(payload?.cardIds)
        ? payload.cardIds.filter((c): c is string => typeof c === "string")
        : [];

      const result = discardCards(state, socket.id, cardIds);
      ack?.(result);
      if (result.ok) broadcastGame(io, state);
    }
  );

  socket.on("game:end_turn", (payload: { roomId?: unknown }, ack?: (res: unknown) => void) => {
    const state = games.get(resolveRoomId(payload));
    if (!state) return ack?.({ ok: false, error: "game_not_found" });

    const result = endTurn(state, socket.id);
    ack?.(result);
    if (result.ok) broadcastGame(io, state);
  });
}
