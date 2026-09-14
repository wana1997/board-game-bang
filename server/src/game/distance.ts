import type { CardName, GameState, PlayerState } from "./types";

export function aliveOrder(state: GameState): string[] {
  return state.order.filter((id) => state.players[id].alive);
}

/** 생존자만 놓고 원탁에서 몇 칸 떨어져 있는지 (양옆 = 1). */
export function seatDistance(state: GameState, aId: string, bId: string): number {
  const order = aliveOrder(state);
  const n = order.length;
  const ai = order.indexOf(aId);
  const bi = order.indexOf(bId);
  if (ai === -1 || bi === -1) return Infinity;
  const diff = Math.abs(ai - bi);
  return Math.min(diff, n - diff);
}

export const WEAPON_NAMES = new Set<CardName>([
  "schofield",
  "volcanic",
  "remington",
  "carabine",
  "winchester",
]);

const WEAPON_RANGE: Partial<Record<CardName, number>> = {
  schofield: 2,
  volcanic: 1,
  remington: 3,
  carabine: 4,
  winchester: 5,
};

/** 무기 미장착 시 기본 사거리 1 (콜트 .45). */
export function weaponRange(player: PlayerState): number {
  const weapon = player.equipment.weapon;
  if (!weapon) return 1;
  return WEAPON_RANGE[weapon.name] ?? 1;
}

/** 조준경(-1)/야생마(+1) 반영한 실질 거리. 최소 1. */
export function effectiveDistance(state: GameState, fromId: string, toId: string): number {
  const base = seatDistance(state, fromId, toId);
  const attacker = state.players[fromId];
  const target = state.players[toId];
  const scopeBonus = attacker.equipment.scope ? 1 : 0;
  const mustangBonus = target.equipment.mustang ? 1 : 0;
  return Math.max(1, base - scopeBonus + mustangBonus);
}

export function canShoot(state: GameState, fromId: string, toId: string): boolean {
  return effectiveDistance(state, fromId, toId) <= weaponRange(state.players[fromId]);
}
