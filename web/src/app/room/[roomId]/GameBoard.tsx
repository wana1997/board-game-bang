"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/lib/RoomProvider";
import { useGame } from "@/lib/GameProvider";
import {
  BLUE_CARDS,
  CARD_ICON,
  CARD_LABEL,
  GAME_ERROR_MESSAGES,
  ROLE_ICON,
  ROLE_LABEL,
  SUIT_IS_RED,
  SUIT_SYMBOL,
  TEAM_LABEL,
  WEAPON_CARDS,
  cardValueLabel,
  effectiveDistance,
  weaponRangeOf,
  type Card,
  type CardName,
  type EquipmentSlot,
  type GameActionResponse,
  type GameView,
  type PublicEquipmentView,
  type PublicPlayerView,
} from "@/lib/types";
import styles from "./GameBoard.module.css";

const NO_TARGET_PLAYABLE = new Set<CardName>([
  "beer",
  "barrel",
  "mustang",
  "scope",
  "dynamite",
  "indians",
  "gatling",
  "stagecoach",
  "wells_fargo",
  "saloon",
  "general_store",
]);
const TARGETED_PLAYABLE = new Set<CardName>(["bang", "jail", "duel"]);
const STEAL_PLAYABLE = new Set<CardName>(["panic", "cat_balou"]);
const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "scope", "mustang", "barrel", "jail", "dynamite"];

const TARGET_PICKER_TITLE: Partial<Record<CardName, string>> = {
  jail: "⛓️ 누구를 가둘까요?",
  duel: "⚔️ 누구와 결투할까요?",
  bang: "🎯 대상을 조준하세요",
  panic: "😱 누구의 카드를 강탈할까요?",
  cat_balou: "🐈 누구의 카드를 파괴할까요?",
};

const RESPONSE_TITLE: Record<string, string> = {
  bang: "🔫 뱅! 맞았습니다",
  duel: "⚔️ 결투 중입니다",
  indians: "🏹 인디언의 습격입니다",
  gatling: "⚙️ 기관총 난사입니다",
};

const RESPONSE_PLAY_LABEL: Record<"bang" | "missed", string> = {
  missed: "🛡️ 빗나감! 사용",
  bang: "🔫 뱅! 사용",
};

type MyResponse = {
  kind: "bang" | "duel" | "indians" | "gatling";
  requiredCard: "bang" | "missed";
};

function getMyResponse(game: GameView, selfId: string | null): MyResponse | null {
  const pending = game.pending;
  if (!pending || !selfId) return null;
  if (pending.kind === "bang") {
    return pending.targetId === selfId ? { kind: "bang", requiredCard: "missed" } : null;
  }
  if (pending.kind === "duel") {
    return pending.currentResponderId === selfId ? { kind: "duel", requiredCard: "bang" } : null;
  }
  if (pending.kind === "indians" || pending.kind === "gatling") {
    return pending.targets.includes(selfId)
      ? { kind: pending.kind, requiredCard: pending.requiredCard }
      : null;
  }
  return null;
}

function getWaitingText(game: GameView, selfId: string | null): string | null {
  const pending = game.pending;
  if (!pending) return null;
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.nickname ?? "";

  if (pending.kind === "bang") {
    return pending.targetId === selfId ? null : `${nameOf(pending.targetId)}의 응답을 기다리는 중...`;
  }
  if (pending.kind === "duel") {
    return pending.currentResponderId === selfId
      ? null
      : `${nameOf(pending.currentResponderId)}의 응답을 기다리는 중...`;
  }
  if (pending.kind === "general_store") {
    return pending.pickOrder[0] === selfId ? null : `${nameOf(pending.pickOrder[0])}가 카드를 고르는 중...`;
  }
  if (pending.targets.includes(selfId ?? "")) return null;
  return `${pending.targets.map(nameOf).join(", ")}의 응답을 기다리는 중...`;
}

function hasStealableCard(p: PublicPlayerView): boolean {
  return (
    p.handCount > 0 ||
    p.equipment.weapon !== null ||
    p.equipment.scope ||
    p.equipment.mustang ||
    p.equipment.barrel ||
    p.equipment.jail ||
    p.equipment.dynamite
  );
}

function equipmentOptions(
  equipment: PublicEquipmentView
): { slot: EquipmentSlot; icon: string; label: string }[] {
  const out: { slot: EquipmentSlot; icon: string; label: string }[] = [];
  if (equipment.weapon) {
    out.push({ slot: "weapon", icon: CARD_ICON[equipment.weapon], label: CARD_LABEL[equipment.weapon] });
  }
  for (const slot of ["scope", "mustang", "barrel", "jail", "dynamite"] as const) {
    if (equipment[slot]) out.push({ slot, icon: CARD_ICON[slot], label: CARD_LABEL[slot] });
  }
  return out;
}

export default function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { leaveRoom } = useRoom();
  const { game, playCard, respond, discardCards, endTurn, pickGeneralStore } = useGame();

  const [targetingCard, setTargetingCard] = useState<Card | null>(null);
  const [stealTargetId, setStealTargetId] = useState<string | null>(null);
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selfId = game?.self.id ?? null;
  const isMyTurn = !!game && game.currentPlayerId === selfId;
  const isDiscardTurn = isMyTurn && game?.turnPhase === "discard";
  const myResponse = useMemo(() => (game ? getMyResponse(game, selfId) : null), [game, selfId]);
  const hasRequiredCard = useMemo(
    () => (myResponse ? (game?.self.hand.some((c) => c.name === myResponse.requiredCard) ?? false) : false),
    [game, myResponse]
  );
  const myWeaponRange = useMemo(() => {
    const me = game?.players.find((p) => p.id === selfId);
    return weaponRangeOf(me?.equipment.weapon ?? null);
  }, [game, selfId]);
  const myGeneralStorePick =
    game?.pending?.kind === "general_store" && game.pending.pickOrder[0] === selfId ? game.pending : null;

  if (!game) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.loading}>말 안장을 올리는 중...</p>
        </main>
      </div>
    );
  }

  async function handleAction(promise: Promise<GameActionResponse>) {
    setError(null);
    setPending(true);
    const result = await promise;
    setPending(false);
    if (!result.ok) {
      setError(GAME_ERROR_MESSAGES[result.error]);
    }
  }

  function handleCardClick(card: Card) {
    if (!isMyTurn || game!.turnPhase !== "play" || game!.pending || pending) return;
    if (TARGETED_PLAYABLE.has(card.name) || STEAL_PLAYABLE.has(card.name)) {
      setTargetingCard(card);
      return;
    }
    if (NO_TARGET_PLAYABLE.has(card.name) || WEAPON_CARDS.has(card.name)) {
      handleAction(playCard(roomId, card.id));
    }
  }

  function handlePickTarget(targetId: string) {
    if (!targetingCard) return;
    if (STEAL_PLAYABLE.has(targetingCard.name)) {
      setStealTargetId(targetId);
      return;
    }
    const cardId = targetingCard.id;
    setTargetingCard(null);
    handleAction(playCard(roomId, cardId, targetId));
  }

  function handlePickSteal(option: "hand" | EquipmentSlot) {
    if (!targetingCard || !stealTargetId) return;
    const cardId = targetingCard.id;
    const targetId = stealTargetId;
    setTargetingCard(null);
    setStealTargetId(null);
    handleAction(playCard(roomId, cardId, targetId, option === "hand" ? undefined : option));
  }

  function cancelTargeting() {
    setTargetingCard(null);
    setStealTargetId(null);
  }

  function toggleDiscard(cardId: string) {
    setSelectedDiscards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }

  async function confirmDiscard() {
    await handleAction(discardCards(roomId, selectedDiscards));
    setSelectedDiscards([]);
  }

  function handleLeave() {
    leaveRoom();
    router.push("/");
  }

  if (game.winner) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.posterBadge}>GAME OVER</div>
          <h1 className={styles.title}>{TEAM_LABEL[game.winner]} 승리!</h1>
          <ul className={styles.seats}>
            {game.players.map((p) => (
              <li key={p.id} className={`${styles.seat} ${!p.alive ? styles.seatDead : ""}`}>
                <div className={styles.avatar}>{p.nickname.slice(0, 1)}</div>
                <div className={styles.seatInfo}>
                  <span className={styles.seatName}>{p.nickname}</span>
                  {p.role && (
                    <span className={styles.roleBadge} data-role={p.role}>
                      {ROLE_ICON[p.role]} {ROLE_LABEL[p.role]}
                    </span>
                  )}
                  <span className={styles.seatStatus}>{p.alive ? "생존" : "탈락"}</span>
                </div>
              </li>
            ))}
          </ul>
          <button className={styles.woodButton} onClick={handleLeave}>
            홈으로
          </button>
        </main>
      </div>
    );
  }

  const currentPlayerNickname =
    game.players.find((p) => p.id === game.currentPlayerId)?.nickname ?? "";
  const waitingText = getWaitingText(game, selfId);

  const isSteal = !!targetingCard && STEAL_PLAYABLE.has(targetingCard.name);
  const targetCandidates = !targetingCard
    ? []
    : targetingCard.name === "jail"
      ? game.players.filter((p) => p.id !== selfId && p.alive && p.role !== "sheriff")
      : targetingCard.name === "panic"
        ? game.players.filter(
            (p) =>
              p.id !== selfId &&
              p.alive &&
              hasStealableCard(p) &&
              effectiveDistance(game.order, game.players, selfId!, p.id) <= 1
          )
        : targetingCard.name === "cat_balou"
          ? game.players.filter((p) => p.id !== selfId && p.alive && hasStealableCard(p))
          : game.players.filter((p) => p.id !== selfId && p.alive);

  const stealTarget = stealTargetId ? game.players.find((p) => p.id === stealTargetId) : null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <span className={styles.roomTag}>방 {roomId}</span>
          <div className={styles.turnBanner}>
            <span className={styles.turnBannerLabel}>
              {isMyTurn ? "당신의 차례" : `${currentPlayerNickname}의 차례`}
            </span>
            <span className={styles.turnBannerPhase}>
              {game.turnPhase === "discard" ? "버리기 단계" : "플레이 단계"} · 드로우 더미 {game.deckCount}장
            </span>
          </div>
        </div>

        {waitingText && <p className={styles.waitingLine}>{waitingText}</p>}

        <ul className={styles.seats}>
          {game.players.map((p) => (
            <li
              key={p.id}
              className={`${styles.seat} ${p.id === game.currentPlayerId ? styles.seatActive : ""} ${!p.alive ? styles.seatDead : ""} ${p.id === selfId ? styles.seatSelf : ""}`}
            >
              <div className={styles.avatar}>{p.alive ? p.nickname.slice(0, 1) : "💀"}</div>
              <div className={styles.seatInfo}>
                <span className={styles.seatName}>
                  {p.nickname}
                  {p.id === selfId && <span className={styles.youTag}>나</span>}
                </span>
                {p.role && (
                  <span className={styles.roleBadge} data-role={p.role}>
                    {ROLE_ICON[p.role]} {ROLE_LABEL[p.role]}
                  </span>
                )}
                <HpPips hp={p.hp} maxHp={p.maxHp} />
                <span className={styles.handCountTag}>🂠 {p.handCount}</span>
                <EquipmentBadges equipment={p.equipment} />
              </div>
            </li>
          ))}
        </ul>

        {myResponse && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>{RESPONSE_TITLE[myResponse.kind]}</p>
              <p className={styles.bangCardSub}>어떻게 대응하시겠습니까?</p>
              <div className={styles.bangCardActions}>
                <button
                  className={styles.woodButton}
                  disabled={!hasRequiredCard || pending}
                  onClick={() => handleAction(respond(roomId, true))}
                >
                  {RESPONSE_PLAY_LABEL[myResponse.requiredCard]}
                </button>
                <button
                  className={styles.woodButtonGhost}
                  onClick={() => handleAction(respond(roomId, false))}
                  disabled={pending}
                >
                  {myResponse.kind === "duel" ? "포기하기" : "그냥 맞기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {myGeneralStorePick && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>🏪 카드를 하나 고르세요</p>
              <div className={styles.hand}>
                {myGeneralStorePick.cards.map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    selected={false}
                    disabled={pending}
                    onClick={() => handleAction(pickGeneralStore(roomId, c.id))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {targetingCard && !stealTargetId && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>
                {TARGET_PICKER_TITLE[targetingCard.name] ?? "🎯 대상을 선택하세요"}
              </p>
              {targetingCard.name === "bang" && (
                <p className={styles.bangCardSub}>내 사거리: {myWeaponRange}</p>
              )}
              {targetingCard.name === "panic" && <p className={styles.bangCardSub}>거리 1 이내만 가능</p>}
              <div className={styles.targetGrid}>
                {targetCandidates.length === 0 && (
                  <p className={styles.bangCardSub}>대상이 없습니다.</p>
                )}
                {targetCandidates.map((p) => {
                  if (targetingCard.name !== "bang") {
                    return (
                      <button
                        key={p.id}
                        className={styles.targetButton}
                        onClick={() => handlePickTarget(p.id)}
                      >
                        <span className={styles.avatar}>{p.nickname.slice(0, 1)}</span>
                        {p.nickname}
                      </button>
                    );
                  }
                  const dist = effectiveDistance(game.order, game.players, selfId!, p.id);
                  const inRange = dist <= myWeaponRange;
                  return (
                    <button
                      key={p.id}
                      className={styles.targetButton}
                      disabled={!inRange}
                      onClick={() => handlePickTarget(p.id)}
                    >
                      <span className={styles.avatar}>{p.nickname.slice(0, 1)}</span>
                      {p.nickname}
                      <span className={styles.targetDistance}>거리 {dist}</span>
                    </button>
                  );
                })}
              </div>
              <button className={styles.woodButtonGhost} onClick={cancelTargeting}>
                취소
              </button>
            </div>
          </div>
        )}

        {targetingCard && isSteal && stealTargetId && stealTarget && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>
                {stealTarget.nickname}의 무엇을 {targetingCard.name === "panic" ? "가져올까요" : "파괴할까요"}?
              </p>
              <div className={styles.targetGrid}>
                {equipmentOptions(stealTarget.equipment).map((opt) => (
                  <button
                    key={opt.slot}
                    className={styles.targetButton}
                    onClick={() => handlePickSteal(opt.slot)}
                  >
                    <span className={styles.cardIcon}>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
                {stealTarget.handCount > 0 && (
                  <button className={styles.targetButton} onClick={() => handlePickSteal("hand")}>
                    <span className={styles.cardIcon}>🂠</span>
                    손패에서 무작위 ({stealTarget.handCount}장)
                  </button>
                )}
              </div>
              <button className={styles.woodButtonGhost} onClick={cancelTargeting}>
                취소
              </button>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.selfPanel}>
          <div className={styles.selfHeader}>
            <span>
              내 역할: <strong>{ROLE_ICON[game.self.role]} {ROLE_LABEL[game.self.role]}</strong>
            </span>
            {isDiscardTurn && (
              <span className={styles.discardCounter}>
                {selectedDiscards.length}/{game.requiredDiscardCount}장 선택됨
              </span>
            )}
          </div>

          <div className={styles.hand}>
            {game.self.hand.map((card) => {
              const selected = selectedDiscards.includes(card.id);
              const playable =
                TARGETED_PLAYABLE.has(card.name) ||
                STEAL_PLAYABLE.has(card.name) ||
                NO_TARGET_PLAYABLE.has(card.name) ||
                WEAPON_CARDS.has(card.name);
              const disabled =
                !isDiscardTurn &&
                (!playable || !isMyTurn || game.turnPhase !== "play" || !!game.pending);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => (isDiscardTurn ? toggleDiscard(card.id) : handleCardClick(card))}
                />
              );
            })}
          </div>

          <div className={styles.actionBar}>
            {isDiscardTurn && (
              <button
                className={styles.woodButton}
                disabled={selectedDiscards.length !== game.requiredDiscardCount || pending}
                onClick={confirmDiscard}
              >
                선택한 카드 버리기
              </button>
            )}
            {isMyTurn && game.turnPhase === "play" && !game.pending && (
              <button
                className={styles.woodButton}
                onClick={() => handleAction(endTurn(roomId))}
                disabled={pending}
              >
                턴 종료
              </button>
            )}
          </div>
        </div>

        <div className={styles.logBox}>
          <ul className={styles.log}>
            {game.log
              .slice()
              .reverse()
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
        </div>

        <button className={styles.woodButtonGhost} onClick={handleLeave}>
          나가기
        </button>
      </main>
    </div>
  );
}

function HpPips({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <span className={styles.hpPips} aria-label={`체력 ${hp}/${maxHp}`}>
      {Array.from({ length: maxHp }, (_, i) => (
        <span key={i} className={i < hp ? styles.pipFull : styles.pipEmpty}>
          ●
        </span>
      ))}
    </span>
  );
}

function EquipmentBadges({ equipment }: { equipment: PublicEquipmentView }) {
  const badges: { key: string; icon: string; label: string }[] = [];
  if (equipment.weapon) {
    badges.push({
      key: "weapon",
      icon: CARD_ICON[equipment.weapon],
      label: `${CARD_LABEL[equipment.weapon]} (사거리 ${weaponRangeOf(equipment.weapon)})`,
    });
  }
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === "weapon") continue;
    if (equipment[slot]) badges.push({ key: slot, icon: CARD_ICON[slot], label: CARD_LABEL[slot] });
  }

  if (badges.length === 0) return null;

  return (
    <span className={styles.equipRow}>
      {badges.map((b) => (
        <span key={b.key} className={styles.equipBadge} title={b.label}>
          {b.icon}
        </span>
      ))}
    </span>
  );
}

function PlayingCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: Card;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const red = SUIT_IS_RED[card.suit];
  const range = weaponRangeOf(card.name);
  const isWeapon = WEAPON_CARDS.has(card.name);
  const familyFallback = BLUE_CARDS.has(card.name) ? styles.card_blue : styles.card_brown;
  return (
    <button
      className={`${styles.card} ${styles[`card_${card.name}`] ?? familyFallback} ${selected ? styles.cardSelected : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={`${styles.cardIndex} ${red ? styles.cardIndexRed : ""}`}>
        {cardValueLabel(card.value)}
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className={styles.cardIcon}>{CARD_ICON[card.name]}</span>
      <span className={styles.cardLabel}>{CARD_LABEL[card.name]}</span>
      {isWeapon && <span className={styles.cardSub}>사거리 {range}</span>}
    </button>
  );
}
