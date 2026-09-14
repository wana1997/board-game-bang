import type { Role } from "./types";
import { shuffle } from "./deck";

// GAME_RULE.MD 1절: 인원별 직업 배정 룰
const ROLE_TABLE: Record<number, Role[]> = {
  4: ["sheriff", "outlaw", "outlaw", "renegade"],
  5: ["sheriff", "deputy", "outlaw", "outlaw", "renegade"],
  6: ["sheriff", "deputy", "outlaw", "outlaw", "outlaw", "renegade"],
  7: ["sheriff", "deputy", "deputy", "outlaw", "outlaw", "outlaw", "renegade"],
};

export function assignRoles(playerIds: string[]): Record<string, Role> {
  const roles = shuffle(ROLE_TABLE[playerIds.length]);
  const assignment: Record<string, Role> = {};
  playerIds.forEach((id, i) => {
    assignment[id] = roles[i];
  });
  return assignment;
}

/** 보안관이 선 플레이어, 나머지는 무작위 순서. */
export function buildTurnOrder(playerIds: string[], roles: Record<string, Role>): string[] {
  const sheriffId = playerIds.find((id) => roles[id] === "sheriff")!;
  const rest = shuffle(playerIds.filter((id) => id !== sheriffId));
  return [sheriffId, ...rest];
}
