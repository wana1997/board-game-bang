// 전역 게임 설정값. 환경변수로 덮어쓸 수 있음.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  // 뱅!/체크 등 인터럽트 응답 제한 시간 (ms). Phase 4 인터럽트 엔진에서 사용.
  responseTimeoutMs: Number(process.env.RESPONSE_TIMEOUT_MS ?? 10000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
};
