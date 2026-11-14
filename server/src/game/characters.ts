import { shuffle } from "./deck";

// 프로젝트 오리지널 캐릭터. 능력은 엔진 곳곳의 훅(characterHas)으로 적용된다.
// 새 캐릭터를 추가하려면 CharacterId/CHARACTERS에 정의하고, 필요한 훅 지점에서 characterHas로 분기하면 된다.
export type CharacterId =
  | "doc_hamilton"
  | "river_john"
  | "cass_molina"
  | "sadie_crow"
  | "elias_grey"
  | "tom_reynolds"
  | "lucy_fairweather"
  | "maggie_hale";

export type CharacterDef = {
  id: CharacterId;
  name: string;
  maxHp: number;
  description: string;
  /** 능동 스킬 보유 여부 (UI에서 스킬 버튼 노출용) */
  active?: boolean;
};

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  doc_hamilton: {
    id: "doc_hamilton",
    name: "도크 해밀턴",
    maxHp: 4,
    description: "떠돌이 의사. 맥주 한 잔으로 체력을 2 회복한다 (쓰러지기 직전 마시는 맥주 포함).",
  },
  river_john: {
    id: "river_john",
    name: "리버 존",
    maxHp: 3,
    description: "강가의 사냥꾼. 빗나감! 또는 술통으로 공격을 막을 때마다 카드 1장을 뽑는다.",
  },
  cass_molina: {
    id: "cass_molina",
    name: "카스 몰리나",
    maxHp: 4,
    description: "맨손 총잡이. 무기를 장착하지 않은 동안 뱅!을 턴당 2번까지 쓸 수 있다.",
  },
  sadie_crow: {
    id: "sadie_crow",
    name: "새디 크로우",
    maxHp: 4,
    description: "장의사. 다른 플레이어가 쓰러질 때마다 카드 2장을 뽑는다.",
  },
  elias_grey: {
    id: "elias_grey",
    name: "엘리아스 그레이",
    maxHp: 4,
    description: "도박사. 자기 턴에 한 번, 손패 1장을 버리고 카드 1장을 뽑을 수 있다.",
    active: true,
  },
  tom_reynolds: {
    id: "tom_reynolds",
    name: "톰 레이놀즈",
    maxHp: 4,
    description: "짐꾼. 턴 종료 시 손패를 체력 +2장까지 보유할 수 있다.",
  },
  lucy_fairweather: {
    id: "lucy_fairweather",
    name: "루시 페어웨더",
    maxHp: 3,
    description: "역마차 마부. 드로우 단계에 카드를 3장 뽑는다.",
  },
  maggie_hale: {
    id: "maggie_hale",
    name: "매기 헤일",
    maxHp: 4,
    description: "명사수. 뱅!의 사거리가 1 늘어난다.",
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

export function assignCharacters(playerIds: string[]): Record<string, CharacterId> {
  const pool = shuffle(CHARACTER_IDS);
  const out: Record<string, CharacterId> = {};
  playerIds.forEach((id, i) => {
    out[id] = pool[i % pool.length];
  });
  return out;
}

export function characterHas(player: { character: CharacterId }, id: CharacterId): boolean {
  return player.character === id;
}
