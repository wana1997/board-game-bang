"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/SocketProvider";
import { useRoom, getSavedNickname } from "@/lib/RoomProvider";
import { ROOM_ERROR_MESSAGES } from "@/lib/types";
import styles from "./page.module.css";

const CAPACITIES = [4, 5, 6, 7];

export default function Home() {
  const router = useRouter();
  const { connected } = useSocket();
  const { createRoom, joinRoom } = useRoom();

  const [nickname, setNickname] = useState(getSavedNickname);
  const [capacity, setCapacity] = useState(4);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await createRoom(nickname, capacity);
    setPending(false);
    if (!result.ok) return setError(ROOM_ERROR_MESSAGES[result.error]);
    router.push(`/room/${result.room.id}`);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await joinRoom(roomCode, nickname);
    setPending(false);
    if (!result.ok) return setError(ROOM_ERROR_MESSAGES[result.error]);
    router.push(`/room/${result.room.id}`);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>🤠 프로젝트 뱅!</h1>
        <p className={styles.tagline}>서부의 무법자들이 모이는 곳</p>
        <p className={styles.status}>
          서버 <span className={connected ? styles.statusOk : styles.statusBad}>{connected ? "연결됨" : "연결 중..."}</span>
        </p>

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

        <div className={styles.panels}>
          <form className={styles.panel} onSubmit={handleCreate}>
            <h2>방 만들기</h2>
            <label className={styles.field}>
              인원수
              <select
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              >
                {CAPACITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}명
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!connected || pending || !nickname.trim()}>
              방 만들기
            </button>
          </form>

          <form className={styles.panel} onSubmit={handleJoin}>
            <h2>방 참가하기</h2>
            <label className={styles.field}>
              방 코드
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="4자리 코드"
              />
            </label>
            <button
              type="submit"
              disabled={!connected || pending || !nickname.trim() || roomCode.length !== 4}
            >
              참가하기
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
