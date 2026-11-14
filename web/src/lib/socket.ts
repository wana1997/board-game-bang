import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const PLAYER_TOKEN_KEY = "bang_player_token";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | undefined;

/**
 * 탭별 플레이어 토큰. sessionStorage라서 새로고침해도 유지되고(재접속),
 * 탭마다 달라서 한 브라우저에서 여러 탭으로 테스트할 수도 있다.
 */
export function getPlayerToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = sessionStorage.getItem(PLAYER_TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem(PLAYER_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return "";
  }
}

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: getPlayerToken() }),
    });
  }
  return socket;
}
