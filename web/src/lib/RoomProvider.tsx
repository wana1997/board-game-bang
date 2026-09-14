"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSocket } from "./SocketProvider";
import type { AckResponse, Room } from "./types";

const NICKNAME_STORAGE_KEY = "bang_nickname";

type RoomContextValue = {
  room: Room | null;
  selfId: string | null;
  createRoom: (nickname: string, capacity: number) => Promise<AckResponse>;
  joinRoom: (roomId: string, nickname: string) => Promise<AckResponse>;
  startRoom: () => Promise<AckResponse>;
  leaveRoom: () => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [room, setRoom] = useState<Room | null>(null);
  const [selfId, setSelfId] = useState<string | null>(socket.id ?? null);

  useEffect(() => {
    const onUpdate = (nextRoom: Room) => {
      setRoom((current) => (current && current.id !== nextRoom.id ? current : nextRoom));
    };
    const onConnect = () => setSelfId(socket.id ?? null);
    const onDisconnect = () => setRoom(null);

    socket.on("room:update", onUpdate);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const createRoom = useCallback(
    (nickname: string, capacity: number) =>
      new Promise<AckResponse>((resolve) => {
        socket.emit("room:create", { nickname, capacity }, (res) => {
          if (res.ok) {
            setRoom(res.room);
            localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
          }
          resolve(res);
        });
      }),
    [socket]
  );

  const joinRoom = useCallback(
    (roomId: string, nickname: string) =>
      new Promise<AckResponse>((resolve) => {
        socket.emit("room:join", { roomId, nickname }, (res) => {
          if (res.ok) {
            setRoom(res.room);
            localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
          }
          resolve(res);
        });
      }),
    [socket]
  );

  const startRoom = useCallback(
    () =>
      new Promise<AckResponse>((resolve) => {
        if (!room) return resolve({ ok: false, error: "not_found" });
        socket.emit("room:start", { roomId: room.id }, (res) => {
          if (res.ok) setRoom(res.room);
          resolve(res);
        });
      }),
    [socket, room]
  );

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
    setRoom(null);
  }, [socket]);

  return (
    <RoomContext.Provider
      value={{ room, selfId, createRoom, joinRoom, startRoom, leaveRoom }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}

export function getSavedNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
}
