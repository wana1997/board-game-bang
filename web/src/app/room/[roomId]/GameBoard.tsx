"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/lib/RoomProvider";
import { useGame } from "@/lib/GameProvider";
import {
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
  type GameActionResponse,
  type PublicEquipmentView,
} from "@/lib/types";
import styles from "./GameBoard.module.css";

const SELF_EQUIP_CARDS = new Set(["beer", "barrel", "mustang", "scope", "dynamite"]);

export default function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { leaveRoom } = useRoom();
  const { game, playCard, respondBang, discardCards, endTurn } = useGame();

  const [targetingCard, setTargetingCard] = useState<Card | null>(null);
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selfId = game?.self.id ?? null;
  const isMyTurn = !!game && game.currentPlayerId === selfId;
  const isDiscardTurn = isMyTurn && game?.turnPhase === "discard";
  const isTargetOfBang = !!game?.pendingBang && game.pendingBang.targetId === selfId;
  const hasMissedCard = useMemo(
    () => game?.self.hand.some((c) => c.name === "missed") ?? false,
    [game]
  );
  const myWeaponRange = useMemo(() => {
    const me = game?.players.find((p) => p.id === selfId);
    return weaponRangeOf(me?.equipment.weapon ?? null);
  }, [game, selfId]);

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
    if (!isMyTurn || game!.turnPhase !== "play" || game!.pendingBang || pending) return;
    if (card.name === "bang" || card.name === "jail") {
      setTargetingCard(card);
      return;
    }
    if (SELF_EQUIP_CARDS.has(card.name) || WEAPON_CARDS.has(card.name)) {
      handleAction(playCard(roomId, card.id));
    }
  }

  function handlePickTarget(targetId: string) {
    if (!targetingCard) return;
    const cardId = targetingCard.id;
    setTargetingCard(null);
    handleAction(playCard(roomId, cardId, targetId));
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

  const targetCandidates =
    targetingCard?.name === "jail"
      ? game.players.filter((p) => p.id !== selfId && p.alive && p.role !== "sheriff")
      : game.players.filter((p) => p.id !== selfId && p.alive);

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

        {game.pendingBang && !isTargetOfBang && (
          <p className={styles.waitingLine}>
            {game.players.find((p) => p.id === game.pendingBang!.targetId)?.nickname}의 응답을
            기다리는 중...
          </p>
        )}

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

        {isTargetOfBang && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>🔫 뱅! 맞았습니다</p>
              <p className={styles.bangCardSub}>어떻게 대응하시겠습니까?</p>
              <div className={styles.bangCardActions}>
                <button
                  className={styles.woodButton}
                  disabled={!hasMissedCard || pending}
                  onClick={() => handleAction(respondBang(roomId, true))}
                >
                  🛡️ 빗나감! 사용
                </button>
                <button
                  className={styles.woodButtonGhost}
                  onClick={() => handleAction(respondBang(roomId, false))}
                  disabled={pending}
                >
                  그냥 맞기
                </button>
              </div>
            </div>
          </div>
        )}

        {targetingCard && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>
                {targetingCard.name === "jail" ? "⛓️ 누구를 가둘까요?" : "🎯 대상을 조준하세요"}
              </p>
              {targetingCard.name === "bang" && (
                <p className={styles.bangCardSub}>내 사거리: {myWeaponRange}</p>
              )}
              <div className={styles.targetGrid}>
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
              <button className={styles.woodButtonGhost} onClick={() => setTargetingCard(null)}>
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
              const playable = card.name === "bang" || card.name === "jail" ||
                SELF_EQUIP_CARDS.has(card.name) || WEAPON_CARDS.has(card.name);
              const disabled =
                !isDiscardTurn &&
                (!playable || !isMyTurn || game.turnPhase !== "play" || !!game.pendingBang);
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
            {isMyTurn && game.turnPhase === "play" && !game.pendingBang && (
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
  if (equipment.scope) badges.push({ key: "scope", icon: CARD_ICON.scope, label: "조준경" });
  if (equipment.mustang) badges.push({ key: "mustang", icon: CARD_ICON.mustang, label: "야생마" });
  if (equipment.barrel) badges.push({ key: "barrel", icon: CARD_ICON.barrel, label: "술통" });
  if (equipment.jail) badges.push({ key: "jail", icon: CARD_ICON.jail, label: "감옥" });
  if (equipment.dynamite) badges.push({ key: "dynamite", icon: CARD_ICON.dynamite, label: "다이너마이트" });

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
  return (
    <button
      className={`${styles.card} ${styles[`card_${card.name}`] ?? styles.card_blue} ${selected ? styles.cardSelected : ""}`}
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
