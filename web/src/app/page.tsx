"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import styles from "./page.module.css";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();

    let lastPingSentAt = 0;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onPong = () => setLatencyMs(Date.now() - lastPingSentAt);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("pong", onPong);
    socket.connect();

    const interval = setInterval(() => {
      lastPingSentAt = Date.now();
      socket.emit("ping");
    }, 2000);

    return () => {
      clearInterval(interval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("pong", onPong);
      socket.disconnect();
    };
  }, []);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>프로젝트 뱅 — Phase 0 연결 테스트</h1>
        <p>
          서버 상태:{" "}
          <strong style={{ color: connected ? "green" : "crimson" }}>
            {connected ? "연결됨" : "연결 안 됨"}
          </strong>
        </p>
        <p>왕복 지연시간(RTT): {latencyMs !== null ? `${latencyMs}ms` : "-"}</p>
      </main>
    </div>
  );
}
