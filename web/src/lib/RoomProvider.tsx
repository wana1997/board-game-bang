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
import { getPlayerToken } from "./socket";
import type { AckResponse, Room } from "./types";

const NICKNAME_STORAGE_KEY = "bang_nickname";

type RoomContextValue = {
  room: Room | null;
  selfId: string | null;
  createRoom: (nickname: string, capacity: number) => Promise<AckResponse>;
  joinRoom: (roomId: string, nickname: string) => Promise<AckResponse>;
  startRoom: () => Promise<AckResponse>;
  restartRoom: () => Promise<AckResponse>;
  leaveRoom: () => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [room, setRoom] = useState<Room | null>(null);
  // 서버는 탭별 토큰을 플레이어 id로 쓴다
  const [selfId] = useState<string | null>(() => getPlayerToken() || null);

  useEffect(() => {
    const onUpdate = (nextRoom: Room) => {
      setRoom((current) => (current && current.id !== nextRoom.id ? current : nextRoom));
    };
    // 연결이 잠깐 끊겨도 방 정보는 유지하고, 재접속 시 서버가 알려주는 세션으로 판단한다
    const onSession = ({ roomId }: { roomId: string | null }) => {
      if (!roomId) setRoom(null);
    };

    socket.on("room:update", onUpdate);
    socket.on("session", onSession);

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("session", onSession);
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

  const restartRoom = useCallback(
    () =>
      new Promise<AckResponse>((resolve) => {
        if (!room) return resolve({ ok: false, error: "not_found" });
        socket.emit("room:restart", { roomId: room.id }, (res) => {
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
      value={{ room, selfId, createRoom, joinRoom, startRoom, restartRoom, leaveRoom }}
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
