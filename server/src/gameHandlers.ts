import type { Server, Socket } from "socket.io";
import { getRoom } from "./rooms";
import { createGame } from "./game/state";
import { discardCards, endTurn, pickGeneralStore, playCard, respondPending } from "./game/actions";
import { buildGameView } from "./game/view";
import type { GameState } from "./game/types";

const games = new Map<string, GameState>();
const responseTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
  if (state.pending) {
    scheduleResponseTimer(io, state);
  } else {
    clearResponseTimer(state.roomId);
  }
}

function clearResponseTimer(roomId: string) {
  const timer = responseTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    responseTimers.delete(roomId);
  }
}

function scheduleResponseTimer(io: Server, state: GameState) {
  clearResponseTimer(state.roomId);
  const pending = state.pending;
  if (!pending) return;

  const delay = Math.max(0, pending.respondBy - Date.now());
  const timer = setTimeout(() => {
    if (state.pending !== pending) return; // 이미 응답/타임아웃 처리됨

    if (pending.kind === "bang") {
      respondPending(state, pending.targetId, false);
    } else if (pending.kind === "duel") {
      respondPending(state, pending.currentResponderId, false);
    } else if (pending.kind === "general_store") {
      const firstCard = pending.cards[0];
      if (firstCard) pickGeneralStore(state, pending.pickOrder[0], firstCard.id);
    } else {
      for (const id of [...pending.targets]) {
        respondPending(state, id, false);
      }
    }
    broadcastGame(io, state);
  }, delay);
  responseTimers.set(state.roomId, timer);
}

function resolveRoomId(payload: unknown): string {
  const roomId = (payload as { roomId?: unknown } | undefined)?.roomId;
  return typeof roomId === "string" ? roomId.toUpperCase() : "";
}

export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on(
    "game:play_card",
    (
      payload: { roomId?: unknown; cardId?: unknown; targetId?: unknown; option?: unknown },
      ack?: (res: unknown) => void
    ) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const cardId = typeof payload?.cardId === "string" ? payload.cardId : "";
      const targetId = typeof payload?.targetId === "string" ? payload.targetId : undefined;
      const option = typeof payload?.option === "string" ? payload.option : undefined;

      const result = playCard(state, socket.id, cardId, targetId, option);
      ack?.(result);
      if (result.ok) broadcastGame(io, state);
    }
  );

  socket.on(
    "game:pick_general_store",
    (payload: { roomId?: unknown; cardId?: unknown }, ack?: (res: unknown) => void) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const cardId = typeof payload?.cardId === "string" ? payload.cardId : "";

      const result = pickGeneralStore(state, socket.id, cardId);
      ack?.(result);
      if (result.ok) broadcastGame(io, state);
    }
  );

  socket.on(
    "game:respond",
    (payload: { roomId?: unknown; play?: unknown }, ack?: (res: unknown) => void) => {
      const state = games.get(resolveRoomId(payload));
      if (!state) return ack?.({ ok: false, error: "game_not_found" });

      const result = respondPending(state, socket.id, payload?.play === true);
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
