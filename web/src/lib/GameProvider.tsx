"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSocket } from "./SocketProvider";
import type { GameActionResponse, GameView } from "./types";

type GameContextValue = {
  game: GameView | null;
  playCard: (
    roomId: string,
    cardId: string,
    targetId?: string,
    option?: string
  ) => Promise<GameActionResponse>;
  respond: (roomId: string, play: boolean) => Promise<GameActionResponse>;
  discardCards: (roomId: string, cardIds: string[]) => Promise<GameActionResponse>;
  endTurn: (roomId: string) => Promise<GameActionResponse>;
  pickGeneralStore: (roomId: string, cardId: string) => Promise<GameActionResponse>;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [game, setGame] = useState<GameView | null>(null);

  useEffect(() => {
    const onUpdate = (view: GameView) => setGame(view);
    const onDisconnect = () => setGame(null);
    socket.on("game:update", onUpdate);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("game:update", onUpdate);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const playCard = useCallback(
    (roomId: string, cardId: string, targetId?: string, option?: string) =>
      new Promise<GameActionResponse>((resolve) => {
        socket.emit("game:play_card", { roomId, cardId, targetId, option }, resolve);
      }),
    [socket]
  );

  const respond = useCallback(
    (roomId: string, play: boolean) =>
      new Promise<GameActionResponse>((resolve) => {
        socket.emit("game:respond", { roomId, play }, resolve);
      }),
    [socket]
  );

  const discardCards = useCallback(
    (roomId: string, cardIds: string[]) =>
      new Promise<GameActionResponse>((resolve) => {
        socket.emit("game:discard_cards", { roomId, cardIds }, resolve);
      }),
    [socket]
  );

  const endTurn = useCallback(
    (roomId: string) =>
      new Promise<GameActionResponse>((resolve) => {
        socket.emit("game:end_turn", { roomId }, resolve);
      }),
    [socket]
  );

  const pickGeneralStore = useCallback(
    (roomId: string, cardId: string) =>
      new Promise<GameActionResponse>((resolve) => {
        socket.emit("game:pick_general_store", { roomId, cardId }, resolve);
      }),
    [socket]
  );

  return (
    <GameContext.Provider
      value={{ game, playCard, respond, discardCards, endTurn, pickGeneralStore }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
