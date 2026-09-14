# 프로젝트 뱅 - 시스템 아키텍처 (Full-Spec)

## 1. 통신 아키텍처 및 배포 스택 (분리형 구조)
* **프론트엔드 (클라이언트):** Next.js (React 기반 풀스펙 프레임워크) ➔ **Vercel** 배포 (UI 렌더링 및 정적 최적화)
* **백엔드 (실시간 서버):** Node.js + Express + Socket.io ➔ **Render / Railway** 배포 (웹소켓 세션 및 게임 룰 검증)
* **아키텍처 핵심:** Vercel의 서버리스 환경 제약을 피하기 위해 실시간 상태를 쥐고 있는 백엔드 서버를 독립 분리하고, 클라이언트가 소켓으로 원격 접속하는 구조 채택.

## 2. 카드 및 캐릭터 데이터 구조 (JSON)
카드의 문양과 숫자 정보가 필수로 포함되어야 합니다.
```json
// Card Data Example
{
  "id": "card_01",
  "name": "bang",
  "type": "brown",
  "suit": "hearts",
  "value": "A",
  "range_required": true // 거리가 닿아야만 사용 가능
}

// Character Data Example
{
  "id": "char_bart_cassidy",
  "name": "Bart Cassidy",
  "maxHp": 4,
  "skill": "take_damage_draw" // 데미지를 입을 때마다 카드 1장 드로우
}
```

## 3. 핵심 상태 관리 (Server State)
상태 객체에 장착물(파란색 카드)과 캐릭터 정보가 추가됩니다.
```json
"players": [
  {
    "socketId": "xyz123",
    "role": "sheriff",
    "character": "char_bart_cassidy",
    "hp": 5, "maxHp": 5,
    "hand": [...],
    "equipped": {
      "weapon": "winchester_5",
      "horse": "mustang",
      "item": "barrel",
      "trap": ["dynamite"] // 다이너마이트나 감옥 등
    }
  }
]
```

## 4. 고도화된 비동기 처리 로직 (인터럽트 & 체인)
* **단일 타겟 공격 (뱅!):** A -> B 공격. B에게 빗나감/술통 체크 타이머 팝업.
* **광역 공격 (인디언/기관총):** A가 사용. 서버는 A를 제외한 **모든 플레이어**에게 동시에 방어 타이머를 전송하고, 모두의 응답(혹은 타임아웃)을 취합한 뒤에 일괄적으로 데미지 처리를 진행해야 함 (Promise.all 활용).
* **문양 체크 (Draw/Check):** 다이너마이트 등 판정 시, 서버가 덱 상단의 카드를 뽑아 전체 클라이언트에 `{"action": "check_result", "card": {"suit": "spades", "value": "8"}}` 이벤트를 브로드캐스트하여 애니메이션 재생 후 로직 처리.