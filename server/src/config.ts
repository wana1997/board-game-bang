// 전역 게임 설정값. 환경변수로 덮어쓸 수 있음.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  // 뱅!/체크 등 인터럽트 응답 제한 시간 (ms). Phase 4 인터럽트 엔진에서 사용.
  responseTimeoutMs: Number(process.env.RESPONSE_TIMEOUT_MS ?? 10000),
  // 대기실에서 연결이 끊긴 플레이어를 내보내기 전 유예 시간 (새로고침 대비)
  lobbyReconnectGraceMs: Number(process.env.LOBBY_RECONNECT_GRACE_MS ?? 15000),
  // 게임 중 전원이 연결을 끊은 방을 정리하기까지의 시간
  idleRoomTimeoutMs: Number(process.env.IDLE_ROOM_TIMEOUT_MS ?? 10 * 60 * 1000),
  // 허용할 클라이언트 주소. 쉼표로 여러 개 지정 가능 (예: 운영 도메인 + Vercel 프리뷰 도메인)
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
