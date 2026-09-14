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
  cardValueLabel,
  type Card,
  type GameActionResponse,
} from "@/lib/types";
import styles from "./GameBoard.module.css";

export default function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { leaveRoom } = useRoom();
  const { game, playCard, respondBang, discardCards, endTurn } = useGame();

  const [targetingCardId, setTargetingCardId] = useState<string | null>(null);
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
    if (card.name === "bang") {
      setTargetingCardId(card.id);
      return;
    }
    if (card.name === "beer") {
      handleAction(playCard(roomId, card.id));
    }
  }

  function handlePickTarget(targetId: string) {
    if (!targetingCardId) return;
    const cardId = targetingCardId;
    setTargetingCardId(null);
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

        {targetingCardId && (
          <div className={styles.bangOverlay}>
            <div className={styles.bangCard}>
              <p className={styles.bangCardTitle}>🎯 대상을 조준하세요</p>
              <div className={styles.targetGrid}>
                {game.players
                  .filter((p) => p.id !== selfId && p.alive)
                  .map((p) => (
                    <button
                      key={p.id}
                      className={styles.targetButton}
                      onClick={() => handlePickTarget(p.id)}
                    >
                      <span className={styles.avatar}>{p.nickname.slice(0, 1)}</span>
                      {p.nickname}
                    </button>
                  ))}
              </div>
              <button className={styles.woodButtonGhost} onClick={() => setTargetingCardId(null)}>
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
              const disabled =
                !isDiscardTurn &&
                (card.name === "missed" ||
                  !isMyTurn ||
                  game.turnPhase !== "play" ||
                  !!game.pendingBang);
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
  return (
    <button
      className={`${styles.card} ${styles[`card_${card.name}`]} ${selected ? styles.cardSelected : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={`${styles.cardIndex} ${red ? styles.cardIndexRed : ""}`}>
        {cardValueLabel(card.value)}
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className={styles.cardIcon}>{CARD_ICON[card.name]}</span>
      <span className={styles.cardLabel}>{CARD_LABEL[card.name]}</span>
    </button>
  );
}
