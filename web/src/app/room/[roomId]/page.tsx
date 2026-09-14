"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/lib/SocketProvider";
import { useRoom, getSavedNickname } from "@/lib/RoomProvider";
import { ROOM_ERROR_MESSAGES } from "@/lib/types";
import styles from "./page.module.css";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId ?? "").toUpperCase();
  const router = useRouter();
  const { connected } = useSocket();
  const { room, selfId, joinRoom, startRoom, leaveRoom } = useRoom();

  const alreadyInRoom = room?.id === roomId;

  const [nickname, setNickname] = useState(getSavedNickname);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [autoJoining, setAutoJoining] = useState(
    () => !alreadyInRoom && getSavedNickname().length > 0
  );

  useEffect(() => {
    if (!connected || alreadyInRoom || !autoJoining) return;
    joinRoom(roomId, getSavedNickname()).then((result) => {
      setAutoJoining(false);
      if (!result.ok) setError(ROOM_ERROR_MESSAGES[result.error]);
    });
  }, [connected, alreadyInRoom, autoJoining, roomId, joinRoom]);

  async function handleJoinSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await joinRoom(roomId, nickname);
    setPending(false);
    if (!result.ok) return setError(ROOM_ERROR_MESSAGES[result.error]);
  }

  async function handleStart() {
    setError(null);
    setPending(true);
    const result = await startRoom();
    setPending(false);
    if (!result.ok) setError(ROOM_ERROR_MESSAGES[result.error]);
  }

  function handleLeave() {
    leaveRoom();
    router.push("/");
  }

  if (!alreadyInRoom) {
    if (autoJoining) {
      return (
        <div className={styles.page}>
          <main className={styles.main}>
            <p className={styles.status}>참가하는 중...</p>
          </main>
        </div>
      );
    }

    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <h1>방 {roomId} 참가</h1>
          <form className={styles.joinForm} onSubmit={handleJoinSubmit}>
            <label className={styles.field}>
              닉네임
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
                placeholder="닉네임을 입력하세요"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={!connected || pending || !nickname.trim()}>
              참가하기
            </button>
          </form>
          <Link className={styles.backLink} href="/">
            홈으로
          </Link>
        </main>
      </div>
    );
  }

  const self = room.players.find((p) => p.id === selfId);
  const isHost = self?.isHost ?? false;
  const isFull = room.players.length === room.capacity;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>
          방 코드 <span className={styles.code}>{room.id}</span>
        </h1>
        <p className={styles.status}>
          {room.players.length}/{room.capacity}명 참가 중
        </p>

        <ul className={styles.players}>
          {room.players.map((p) => (
            <li key={p.id} className={styles.player}>
              <span>{p.nickname}</span>
              {p.isHost && <span className={styles.hostBadge}>방장</span>}
              {p.id === selfId && <span className={styles.selfBadge}>나</span>}
            </li>
          ))}
        </ul>

        {error && <p className={styles.error}>{error}</p>}

        {isHost ? (
          <button
            className={styles.startButton}
            onClick={handleStart}
            disabled={!isFull || pending}
          >
            {isFull ? "게임 시작" : `정원이 찰 때까지 대기 중 (${room.players.length}/${room.capacity})`}
          </button>
        ) : (
          <p className={styles.waiting}>방장이 게임을 시작하기를 기다리는 중...</p>
        )}

        <button className={styles.leaveButton} onClick={handleLeave}>
          나가기
        </button>
      </main>
    </div>
  );
}
