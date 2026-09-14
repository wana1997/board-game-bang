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

export interface ServerToClientEvents {
  "room:update": (room: Room) => void;
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
