# Tetris - WORKFLOW

## 배포 URL
https://mtl-007.github.io/tetris/

## 배포 방법
```bash
# 소스 → 배포 디렉터리 복사 후 push
cp src/exercise/mtl-007/day03/tetris/<file> /home/ubuntu/work/tetris/
cd /home/ubuntu/work/tetris
git add . && git commit -m "..." && git push
```
- 배포 저장소: `git@github.com:mtl-007/tetris.git`
- 스테이징 디렉터리: `/home/ubuntu/work/tetris/`
- 캐시 무효화: `index.html`의 스크립트·CSS에 `?v=N` 쿼리 파라미터 사용

---

## 기술 스택
- Vanilla JS (프레임워크 없음)
- Canvas 2D API (게임 보드: 300×600 내부, 모바일 CSS 스케일)
- Supabase (`tetris_plays` 테이블: `player_name`, `score`, `created_at`)
- GitHub Pages

## 파일 구조
| 파일 | 역할 |
|------|------|
| `index.html` | 레이아웃, 버전 파라미터 관리 |
| `style.css` | 스타일, 반응형(`@media max-width: 700px`) |
| `auth.js` | 이름 입력 로그인, localStorage 세션 유지 |
| `game.js` | 게임 로직, Canvas 렌더링, 랭킹 모달 |
| `db.js` | Supabase CRUD (`savePlay`, `fetchLeaderboard`, `fetchTop3`) |
| `config.js` | Supabase URL/Key |

---

## 게임 상수 (game.js)
| 상수 | 값 | 설명 |
|------|----|------|
| `BASE_DROP_INTERVAL` | 550ms | 레벨 1 낙하 간격 |
| `MIN_DROP_INTERVAL` | 100ms | 최소 낙하 간격 (상한 속도) |
| `LEVEL_STEPS` | [60,60,60,55,45,40,35,30,25] | 레벨별 간격 단축량(ms) |
| `LEVEL_UP_INTERVAL_MS` | 20,000ms | 시간 기반 레벨업 주기 (20초마다) |

### 레벨별 낙하 속도
레벨 5부터 감소폭을 축소해 고레벨 체감 속도 급증 완화.
레벨 9 이후: 기본 20ms 감소, MIN_DROP_INTERVAL(100ms) 하한.

| 레벨 | 간격 | 감소폭 | 체감 증가율 |
|------|------|--------|------------|
| 1 | 550ms | - | - |
| 2 | 490ms | 60ms | 11% |
| 3 | 430ms | 60ms | 12% |
| 4 | 370ms | 60ms | 14% |
| 5 | 315ms | 55ms | 15% |
| 6 | 270ms | 45ms | 14% |
| 7 | 230ms | 40ms | 15% |
| 8 | 195ms | 35ms | 15% |
| 9 | 165ms | 30ms | 15% |
| 10 | 140ms | 25ms | 15% |
| 11 | 120ms | 20ms | 14% |
| 12 | 100ms | 20ms | 17% |
| 13+ | 100ms | — | MIN 도달 |

---

## 주요 구현 이력

### 세션 유지
- `localStorage('tetris_player')` — 로그인 상태 유지, 새로고침 시 게임 화면 복원
- `localStorage('leaderboard_open')` — 랭킹 모달 열림 상태 복원

### 모바일 대응 (Galaxy S25 Ultra 기준)
- `@media (max-width: 700px)` 브레이크포인트
- 게임 보드: 210×420px (내부 300×600 CSS 스케일)
- 레이아웃: 보드(좌) + 사이드패널(우) 가로 배치
- 모바일 컨트롤 버튼: 2행 구성
  - 1행: ◀(88px) / ↺(142px) / ▶(88px) — 버튼 간 gap 17px
  - 2행: ▼(142px) — 하드드롭, 1행과 margin-top 17px
- 전체 `user-select: none` (이름 입력란 제외)
- 버튼 중복 입력 방지: 200ms 쿨다운 (`addTapBtn`)
- 좌/우 버튼: `touchstart` 홀드 시 120ms 반복 (`addTouchBtn`)

### 게임 기능
- 3D 블록 렌더링 (`drawCell3D` — bevel 효과)
- 댄싱 스틱맨 애니메이션 (게임 시작/종료 시)
- 행 클리어 플래시 애니메이션 (흰색↔원래색 4회, 35ms 간격)
- 하드드롭 (▼ 버튼 또는 ↑/Space — 바닥까지 즉시 낙하)
- 레벨업: **20초마다** 자동 상승 (시간 기반)
- 넥스트 피스 유지: 행 클리어 시 nextPiece 변경 없이 유지 (`spawnPiece(keepNext=true)`)

### 점수 체계
| 클리어 줄 수 | 점수 |
|-------------|------|
| 1줄 | 100 |
| 2줄 | 300 |
| 3줄 | 500 |
| 4줄 (테트리스) | 800 |

### 랭킹(리더보드)
- 점수 내림차순 TOP 10
- 표시 항목: 순위, 플레이어, 점수, 일시(`YYYY.MM.DD - HH:MM:SS` 24시간)
- 모달 열림 상태 새로고침 후에도 유지
- 최고점수 패널: 🥇🥈🥉 메달 이모지로 TOP 3 표시
- 저장 실패 시 1초 간격으로 최대 3회 재시도 (`savePlay`)

### 버그 수정 이력
| 증상 | 원인 | 해결 |
|------|------|------|
| 로그인 버튼 동작 안 함 | 세션 복원 시 `return`으로 이벤트 리스너 미등록 | 리스너 등록 후 세션 복원 체크 순서 변경 |
| 자동완성 시작 불가 | 클릭 시 value 미반영 | `setTimeout(0)` 지연 + debounce |
| 우측 이동 불가 | 버튼·패널 텍스트 드래그 선택 | `user-select: none` 전체 적용 |
| 시작 버튼 포커스 잔존 | 클릭 후 포커스 해제 안 됨 | `startBtn.blur()` 추가 |
| 게임 중 시작 버튼 재작동 | `running` 플래그가 GAME START 애니메이션 중 false | `canStart` 플래그로 함수 진입 즉시 차단 |
| 행 클리어 후 보드 깨짐 | 클리어 애니메이션 중 `lockPiece` 재진입 | `locking` 플래그로 재진입 차단 |
| 행 클리어 시각적 미반영 | `scheduleDrop`의 `render()` 가 플래시 덮어씀 | `locking` 중 `render()` 호출 건너뜀 |
| 2줄 이상 동시 클리어 시 일부 행이 사라지지 않음 | `clearLines`에서 `splice`와 `unshift`를 교대 실행 → `unshift`가 배열 인덱스를 밀어 다음 `splice`가 엉뚱한 행을 제거 | `splice` 전체 완료 후 `unshift` 실행하도록 분리 |
