# 스터디클럽 디자인 시스템 v1.0

> 사회인 스터디클럽 플랫폼 · 사용자 사이트 + 운영자 콘솔 공용
> 톤: 친근·따뜻한 전문성 (Toss 계열) · Primary: Indigo-Violet · Light 전용(MVP)
> 모든 색상은 OKLCH로 설계 후 sRGB(HEX)로 변환, WCAG 2.2 대비비 검증 완료

---

## 📌 작업 요약

사회인 스터디클럽의 **사용자 사이트**와 **운영자 콘솔**이 하나의 토큰을 공유하도록 설계한 디자인 시스템입니다. 지금처럼 두 곳이 색을 따로 들고 있으면 시간이 지날수록 반드시 어긋나기 때문에, 이 문서의 핵심 원칙은 **"토큰은 한 파일(`tokens.css`)에만 있고, 모든 컴포넌트는 raw HEX가 아니라 semantic 토큰만 참조한다"** 입니다. 색을 바꿔야 할 때 한 파일만 고치면 두 앱이 함께 바뀝니다.

브랜드 방향은 "친근하지만 전문적"입니다. 신뢰를 주는 Indigo-Violet(`primary-600 #4856F5`)을 중심축으로, 채도를 절제한 cool-neutral 그레이 위에 넉넉한 여백과 부드러운 라운딩(카드 16px)을 얹었습니다. 정보 밀도가 높은 콘솔(출석부·대시보드)에서도 읽기 편하도록 타입 스케일은 Minor Third(1.2)로 잡아 위계를 촘촘하지 않게 유지했고, 한글 광학 보정(자간 조임·line-height 여유)을 반영했습니다.

---

## 1. 브랜드 디렉션

### 1-1. 브랜드 퍼스널리티 (5)

| 형용사 | 의미 | 디자인 반영 |
|---|---|---|
| **신뢰할 수 있는 (Trustworthy)** | 내 출석·이력 데이터가 정확하다는 안심 | 절제된 채도, 명확한 대비, 일관된 상태 색 |
| **따뜻한 (Warm)** | 혼자가 아니라 함께 공부한다는 감각 | 부드러운 라운딩, 넉넉한 여백, tonal 강조색 |
| **명료한 (Clear)** | 지금 뭘 해야 하는지 바로 보임 | 뚜렷한 정보 위계, 1 화면 1 주요 액션 |
| **함께하는 (Communal)** | 스터디·역할·동료가 중심 | 역할/상태 색 시스템, 아바타·진행률 시각화 |
| **성장 지향 (Growth-oriented)** | 완주율·출석률이 곧 성취 | 진행률/달성 지표를 success 색으로 축하 |

### 1-2. 브랜드 보이스 (Do / Don't)

| 상황 | Do ✅ | Don't ❌ |
|---|---|---|
| 안내 문구 | "이번 주 세션은 목요일 저녁 8시예요" | "세션 일정 정보를 확인하시기 바랍니다" |
| 버튼/CTA | "스터디 신청하기", "출석 체크" | "제출", "확인" |
| 빈 상태 | "아직 신청한 스터디가 없어요. 둘러볼까요?" | "데이터가 없습니다" |
| 오류 | "정원이 방금 찼어요. 대기자로 신청할 수 있어요" | "Error: 요청 실패" |
| 운영진 콘솔 | 간결·사실 위주 ("출석률 82% · 12명 활동") | 사용자 사이트의 감성 카피를 콘솔에 그대로 복붙 |

> 사용자 사이트는 **친근한 반말톤에 가까운 존댓말(~해요체)**, 운영자 콘솔은 **간결한 정보 전달체(~함/~됨, 수치 우선)**. 같은 색·컴포넌트를 쓰되 카피 톤만 문맥에 맞춥니다.

### 1-3. 디자인 원칙 (5)

1. **모든 값은 토큰이다.** 컴포넌트 코드에 HEX·px 리터럴을 직접 쓰지 않는다. 색·간격·라운딩·그림자는 반드시 semantic 토큰을 참조한다. (두 앱 동기화의 전제)
2. **8pt 그리드를 지킨다.** 모든 spacing은 4px의 배수. 정렬이 눈에 보이지 않아도 시스템이 리듬을 만든다.
3. **위계는 크기가 아니라 대비로 만든다.** 폰트를 키우기 전에 weight·색(neutral-900/700/600)·여백으로 위계를 준다. 화면당 히어로 사이즈는 하나만.
4. **상태는 색 하나로 말하지 않는다.** 색 + 아이콘 + 텍스트를 함께 쓴다(색맹 대응). 모집중/출석/결석을 색만으로 구분하지 않는다.
5. **밀도는 앱마다 다르되, 색은 같다.** 콘솔은 더 촘촘하게(작은 라운딩·조밀한 행), 사이트는 더 여유롭게. 하지만 두 앱의 브랜드/상태 색은 100% 동일하다.

---

## 2. Color System

설계 방식: 명도(Lightness)를 인지적으로 균일하게 배치하기 위해 **OKLCH**로 램프를 생성한 뒤 sRGB(HEX)로 변환했습니다. `tokens.css`에는 호환성을 위해 HEX를 canonical 값으로 넣되, 다크모드 재설계 시 재사용할 수 있도록 이 문서에 OKLCH를 병기합니다.

### 2-1. Primary — Indigo-Violet (H≈272)

신뢰(블루)와 프리미엄(바이올렛)의 접점. 채도가 높지만 차갑지 않아 "친근한 전문성"에 맞습니다. `600`이 브랜드 기준색(솔리드 버튼·링크), `700`이 hover/pressed·텍스트용입니다.

| Token | HEX | OKLCH | 용도 |
|---|---|---|---|
| primary-50 | `#F5F7FF` | oklch(0.977 0.011 272) | 최연한 배경, tonal 버튼 bg |
| primary-100 | `#E8EEFF` | oklch(0.949 0.024 272) | hover된 tonal, 선택된 필터 bg |
| primary-200 | `#D5DFFF` | oklch(0.905 0.046 272) | 연한 보더, 스켈레톤 |
| primary-300 | `#B6C6FF` | oklch(0.835 0.082 272) | disabled 강조, 차트 연한 영역 |
| primary-400 | `#8BA3FF` | oklch(0.735 0.137 272) | 아이콘 보조, 그라디언트 |
| primary-500 | `#647CFF` | oklch(0.635 0.196 272) | 액센트(**큰 텍스트/그래픽만**, 흰글씨 본문 ✕) |
| **primary-600** | `#4856F5` | oklch(0.545 0.235 272) | **브랜드 기준. 솔리드 버튼 bg, 링크, 포커스링** |
| primary-700 | `#3A44D3` | oklch(0.478 0.215 272) | hover/pressed, 흰 배경 위 텍스트 |
| primary-800 | `#2F39AA` | oklch(0.415 0.178 272) | active/pressed 깊게 |
| primary-900 | `#263087` | oklch(0.360 0.145 272) | 헤딩 강조(브랜드 톤) |
| primary-950 | `#171E58` | oklch(0.270 0.105 272) | 최심도, 히어로 배경 |

**대비비**: 흰글씨/primary-600 = **5.35:1 (AA)**, 흰글씨/primary-700 = 7.12:1, primary-700/흰배경 = 7.12:1(링크 텍스트 AA), primary-700/primary-50 = 6.66:1(tonal 버튼).

### 2-2. Neutral — Cool Slate (H≈270, 저채도)

파란기가 아주 약하게 들어간 중립 그레이. 순수 회색보다 모던하고 Indigo와 톤이 맞습니다. `neutral-0`(흰색)부터 `neutral-950`까지.

| Token | HEX | OKLCH | 용도 · 대비비(흰배경) |
|---|---|---|---|
| neutral-0 | `#FFFFFF` | oklch(1 0 0) | 기본 배경, 카드 bg |
| neutral-50 | `#F9FAFC` | oklch(0.985 0.003 270) | surface-1 (앱 배경) |
| neutral-100 | `#F4F5F9` | oklch(0.970 0.005 270) | surface-2 (테이블 헤더, 입력 disabled) |
| neutral-200 | `#E6E8ED` | oklch(0.930 0.008 270) | **border** (구분선·카드 외곽) |
| neutral-300 | `#D4D7DE` | oklch(0.878 0.011 270) | border-strong (입력 resting) |
| neutral-400 | `#A6A9B2` | oklch(0.735 0.014 270) | 아이콘 비활성, 보더 강조 |
| neutral-500 | `#7E818C` | oklch(0.605 0.016 270) | placeholder·disabled 텍스트 (3.88 = **큰 텍스트만**) |
| neutral-600 | `#5D616A` | oklch(0.492 0.016 270) | muted 텍스트 (6.21 AA) |
| neutral-700 | `#464951` | oklch(0.405 0.014 270) | secondary 텍스트 (9.00 AA) |
| neutral-800 | `#2D2F35` | oklch(0.305 0.012 270) | 본문 강조 (13.38 AA) |
| neutral-900 | `#1C1E23` | oklch(0.235 0.011 270) | **기본 본문/헤딩 (16.68 AA)** |
| neutral-950 | `#0D0E13` | oklch(0.165 0.010 270) | 최고 강조, 다크 확장 대비 |

### 2-3. Semantic — Success / Warning / Error / Info

각 색은 `50`(tonal 배경) / `100`(hover) / `500`(그래픽·차트) / `600`(솔리드 보조) / `700`(솔리드 버튼 텍스트·흰글씨 위) 단계를 갖습니다.

| 역할 | 50 | 100 | 500 | 600 | 700 | 규칙 |
|---|---|---|---|---|---|---|
| **success** (초록) | `#E6F9EA` | `#CEF3D6` | `#43B16A` | `#2A9754` | `#227C45` | 솔리드 흰글씨는 **-700**(5.20 AA). 뱃지=50/700(4.73 AA) |
| **warning** (앰버) | `#FFF3E4` | `#FFE7C9` | `#E9A128` | `#D08B00` | `#9D6800` | **흰글씨 금지.** 솔리드는 -400/500 위 **neutral-900 텍스트**(9.24 AA) |
| **error** (레드) | `#FFEFEE` | `#FFDFDC` | `#F1383E` | `#DB0C26` | `#B5081E` | 솔리드 흰글씨 -600(5.13 AA)/-700(6.96). 뱃지=50/700(6.24) |
| **info** (블루) | `#E9F5FF` | `#D6EDFF` | `#0095DB` | `#007CB7` | `#006799` | 솔리드 흰글씨 -700(6.18 AA). 뱃지=50/700(5.58) |

> warning-400 = `#F4B64A` (솔리드 앰버 배경용, 위에 neutral-900 텍스트).

### 2-4. Surface & Border (semantic)

라이트 모드 표면 위계. 콘솔의 데이터 밀집 화면에서도 층위가 구분되도록 3단계 surface를 둡니다.

| Semantic 토큰 | 값(참조) | 용도 |
|---|---|---|
| `--color-bg` | neutral-0 `#FFFFFF` | 카드·모달 바닥, 기본 콘텐츠 배경 |
| `--surface-1` | neutral-50 `#F9FAFC` | 앱 전체 배경(카드가 뜨는 바닥) |
| `--surface-2` | neutral-100 `#F4F5F9` | 테이블 헤더, 코드블록, 입력 disabled |
| `--surface-3` | neutral-200 `#E6E8ED` | 강조 구획, 진행바 트랙 |
| `--border` | neutral-200 `#E6E8ED` | 카드/구분선(장식적) |
| `--border-strong` | neutral-300 `#D4D7DE` | 입력 resting 보더 |
| `--border-interactive` | neutral-400 `#A6A9B2` | 3:1이 필요한 상호작용 경계(강조 시) |

### 2-5. 도메인 매핑 — 스터디 상태 / 역할 / 출석

색을 "빨강=나쁨"이 아니라 **도메인 의미**에 고정합니다. 반드시 색 + 텍스트(+아이콘/dot) 함께.

**모집/진행 상태 (Study Status)**

| 상태 | 배경 | 텍스트 | dot |
|---|---|---|---|
| 모집중 | success-50 | success-700 | success-500 |
| 마감임박 (정원 80%↑ or D-3) | warning-50 | warning-700 | warning-500 |
| 모집마감 | neutral-100 | neutral-600 | neutral-400 |
| 진행중 | info-50 | info-700 | info-500 |
| 종료 | neutral-100 | neutral-500 | neutral-400 |

**역할 (Role)**

| 역할 | 스타일 | 배경 / 텍스트 |
|---|---|---|
| 캡틴 (운영진) | 브랜드 강조 | primary-50 / primary-700 |
| 네비게이터 (스터디장) | 정보 강조 | info-50 / info-700 |
| 멤버 | 중립 | neutral-100 / neutral-700 |

**출석 상태 (Attendance)**

| 상태 | 배경 / 텍스트 | 아이콘 |
|---|---|---|
| 출석 | success-50 / success-700 | ● 체크 |
| 지각 | warning-50 / warning-700 | ◐ 시계 |
| 결석 | error-50 / error-700 | ○ 엑스 |
| 휴가(허가) | info-50 / info-700 | ✈ 비행기 |
| 미체크 | neutral-100 / neutral-500 | — 대시 |

**출석률 임계 색(텍스트/미터)**: ≥80% → success-700, 60–79% → warning-700, <60% → error-700.

### 2-6. 차트 카테고리 팔레트 (대시보드 분야별)

명도(L≈0.64)·채도를 맞춰 인지적으로 균일한 6색. 색맹 대응을 위해 **한 차트당 5색 이하 + 라벨 병기**를 권장합니다.

| 순서 | 이름 | HEX | 예시 매핑 |
|---|---|---|---|
| 1 | indigo | `#6D83E6` | 개발 |
| 2 | amber | `#BC7D00` | 어학 |
| 3 | teal | `#00A0A6` | 디자인 |
| 4 | magenta | `#B36BC4` | 자격증 |
| 5 | green | `#2EA55C` | 독서/교양 |
| 6 | coral | `#D8625C` | 기타 |

> 상태별 차트(모집중/진행중/마감)는 카테고리 팔레트가 아니라 **2-5의 상태 색**을 그대로 사용. 그리드선 neutral-200, 축 텍스트 neutral-500(sm).

---

## 3. Typography

### 3-1. Font Family

| 역할 | 폰트 | 비고 |
|---|---|---|
| Display / Body | **Pretendard Variable** (한글+라틴 통합) | 국내 IT 표준, 가변폰트 1개로 100~900 커버. 별도 영문 폰트 불필요 |
| Mono / 숫자 | `"Pretendard", ui-monospace` + `font-feature-settings: "tnum" 1` | 출석부·대시보드 수치는 **tabular-nums**로 자리 고정. 코드는 `"JetBrains Mono", "D2Coding"` |

**웹폰트 로딩 전략**
- Pretendard를 **self-host**(woff2)하고 한글은 dynamic subset로 분할 로드. CDN 직링크보다 안정적·빠름.
- 대표 weight(400/600/700)는 `<link rel="preload" as="font" ... crossorigin>`로 프리로드, 나머지는 lazy.
- `font-display: swap`으로 FOIT 방지. fallback: `-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`.

### 3-2. Type Scale (base 16px · ratio ≈ 1.2 Minor Third)

밀도 높은 콘솔에서도 위계가 과하지 않도록 1.2 비율. 헤딩 line-height는 1.05~1.33, 본문은 1.5~1.6.

| Token | px | line-height | letter-spacing | weight | 용도 |
|---|---|---|---|---|---|
| text-xs | 12 | 16px (1.33) | +0.01em | 500 | 뱃지, 캡션, 메타, 테이블 라벨 |
| text-sm | 14 | 20px (1.43) | +0.005em | 400/500 | 보조 텍스트, 테이블 셀, 폼 헬프 |
| text-base | 16 | 26px (1.63) | 0 | 400 | **기본 본문** |
| text-lg | 18 | 28px (1.56) | −0.005em | 400/500 | 리드 문단, 카드 본문 강조 |
| text-xl | 20 | 28px (1.40) | −0.01em | 600 | 카드 제목, 소제목 |
| text-2xl | 24 | 32px (1.33) | −0.015em | 600 | 섹션 소제목 |
| text-3xl | 30 | 38px (1.27) | −0.02em | 700 | 섹션 제목 |
| text-4xl | 36 | 44px (1.22) | −0.02em | 700 | 페이지 타이틀 |
| text-5xl | 48 | 56px (1.17) | −0.025em | 800 | 히어로 |
| text-6xl | 60 | 66px (1.10) | −0.03em | 800 | 대형 히어로 |
| text-7xl | 72 | 76px (1.06) | −0.03em | 800 | 마케팅 히어로 |

### 3-3. 한글 광학 사이즈 보정 (필수)

Pretendard 기준, 한글은 같은 px에서 라틴보다 크고 빽빽하게 보입니다. 다음을 규칙화합니다.

1. **자간(letter-spacing)**: 헤딩(20px↑)은 한글 자간이 벌어져 보이므로 **음수 자간**(−0.01 ~ −0.03em)으로 조입니다. 위 표에 반영됨. 본문(16px)은 0, 12~14px 작은 한글은 오히려 **+0.005~0.01em**로 살짝 벌려 가독성 확보.
2. **밀도 높은 UI −1px**: 테이블 셀·뱃지 등 조밀한 영역의 한글은 라틴 기준보다 1px 작게(예: 라틴 14 → 한글 UI 13) 잡으면 균형이 맞습니다. 콘솔 본문 base를 15px로 낮추는 것도 허용(사이트는 16 유지).
3. **line-height 여유**: 한글은 받침 때문에 세로로 더 큽니다. 라틴 권장 대비 **+0.05~0.1** 여유(본문 1.6 이상 유지). 짧은 헤딩만 1.1~1.2 허용.
4. **weight 인지 보정**: 한글은 굵기가 강하게 보여 라틴 Bold(700) 대신 **SemiBold(600)**가 헤딩에 더 적절한 경우가 많음. 800은 히어로 한정.

---

## 4. Spacing (8pt Grid, 4px base)

| Token | px | | Token | px |
|---|---|---|---|---|
| space-0 | 0 | | space-6 | 24 |
| space-px | 1 | | space-8 | 32 |
| space-0.5 | 2 | | space-10 | 40 |
| space-1 | 4 | | space-12 | 48 |
| space-2 | 8 | | space-16 | 64 |
| space-3 | 12 | | space-20 | 80 |
| space-4 | 16 | | space-24 | 96 |
| space-5 | 20 | | space-32 | 128 |

**Component spacing (내부 패딩·요소 간격)**
- 뱃지: py 2 / px 8 · 아이콘-텍스트 gap 4
- 버튼 md: py 10 / px 16 · 아이콘-라벨 gap 8
- 입력 md: py 10 / px 14
- 카드 패딩: 20(콘솔) ~ 24(사이트)
- 폼 필드 간 세로 간격: 16 · 라벨-필드 gap 6
- 리스트 아이템 간격: 8~12

**Layout spacing (섹션·페이지)**
- 컨테이너 max-width: 1200(콘솔) / 1280(사이트) · 좌우 gutter 24(desktop) / 16(mobile)
- 섹션 세로 여백: 64~96(desktop) / 40~56(mobile)
- 카드 그리드 gap: 20~24
- 사이드바 폭(콘솔): 240~260

---

## 5. Border Radius

부드러운 인상을 위해 컨트롤은 8, 카드는 16으로 잡습니다(Toss 계열의 친근함). 콘솔은 밀도를 위해 컨트롤을 6~8로 낮춰도 되지만 **색은 절대 바꾸지 않습니다**.

| Token | px | | 컴포넌트 권장(semantic) |
|---|---|---|---|
| radius-none | 0 | | `--radius-control` (버튼·입력·셀렉트) = **8** |
| radius-xs | 2 | | `--radius-chip` (필터칩·태그) = 8 |
| radius-sm | 4 | | `--radius-card` = **16** |
| radius-md | 8 | | `--radius-modal` = 20 (모바일 바텀시트 상단 24) |
| radius-lg | 12 | | `--radius-pill` (상태뱃지·아바타그룹) = 9999 |
| radius-xl | 16 | | `--radius-avatar` = 9999 |
| radius-2xl | 24 | | 체크박스 = 4 / 스위치 트랙 = 9999 |
| radius-full | 9999 | | |

---

## 6. Elevation (Shadow)

라이트 모드용, neutral-950(`23 25 35`) 기반의 저채도·저투명 2겹 그림자. 색이 아니라 y-offset과 blur로 높이를 표현합니다.

| Token | box-shadow | 용도 |
|---|---|---|
| shadow-none | `none` | flat 요소, 인풋 resting |
| shadow-xs | `0 1px 2px rgba(23,25,35,.06)` | 버튼, 인풋 hover, 작은 칩 |
| shadow-sm | `0 1px 2px rgba(23,25,35,.06), 0 2px 6px rgba(23,25,35,.08)` | 카드 resting |
| shadow-md | `0 2px 4px rgba(23,25,35,.06), 0 6px 16px rgba(23,25,35,.10)` | 카드 hover, 드롭다운 |
| shadow-lg | `0 4px 8px rgba(23,25,35,.06), 0 12px 28px rgba(23,25,35,.12)` | 팝오버, 중앙 모달 |
| shadow-xl | `0 8px 16px rgba(23,25,35,.08), 0 24px 56px rgba(23,25,35,.16)` | 다이얼로그, 커맨드 팔레트 |

**포커스 링(별도 토큰)**: `--ring: 0 0 0 3px rgba(72,86,245,.35)` (primary-600 35%) · 에러 링 `0 0 0 3px rgba(219,12,38,.30)`. 키보드 포커스는 항상 링으로 3:1 이상 확보.

---

## 7. Motion

| Duration | ms | 용도 |
|---|---|---|
| instant | 0 | 즉시 |
| fast | 150 | hover, 토글, 색 전환(micro) |
| base | 250 | 대부분의 전환, 드롭다운/툴팁 |
| slow | 400 | 모달·바텀시트·페이지 전환 |
| slower | 600 | 온보딩·완주 축하 등 큰 연출 |

| Easing | cubic-bezier | 용도 |
|---|---|---|
| ease-out | `(0.22, 1, 0.36, 1)` | 등장(기본). 요소가 나타날 때 |
| ease-in-out | `(0.65, 0, 0.35, 1)` | 상태 간 이동·리사이즈 |
| ease-in | `(0.4, 0, 1, 1)` | 퇴장. 요소가 사라질 때 |
| spring | `(0.34, 1.56, 0.64, 1)` | 토글·체크·완주 배지 등 살짝 튕기는 확인 |

> **접근성**: `@media (prefers-reduced-motion: reduce)` 에서 모든 duration → 0~1ms, transform 애니메이션 제거. 출석 체크 같은 필수 피드백은 애니메이션 없이도 색·아이콘으로 전달되어야 함.

---

## 8. Semantic 토큰 레이어 — 두 앱 동기화의 핵심

**문제**: 지금 사용자 사이트와 운영자 콘솔이 색 설정을 각자(95줄 / 104줄) 들고 있어 새 디자인을 넣으면 두 곳을 맞춰야 하고, 이후에도 계속 어긋납니다.

**해결**: 아래 3계층으로 나누고, **팔레트(1계층)와 semantic(2계층)은 `tokens.css` 한 파일에만** 둡니다. 두 앱은 이 파일을 import만 하고, 컴포넌트는 오직 2계층 semantic 토큰만 참조합니다.

```
[1] Primitive 팔레트   → primary-600, neutral-200 ...  (진실의 원천, 한 곳)
        ↓ 별칭
[2] Semantic 토큰      → --color-brand, --color-text, --surface-1, --border ...
        ↓ 참조
[3] 컴포넌트           → .btn { background: var(--color-brand) }  ← HEX 금지
```

**주요 semantic 토큰(발췌)** — 전체는 `tokens.css` 참고.

| Semantic | = 팔레트 | 의미 |
|---|---|---|
| `--color-brand` | primary-600 | 브랜드 기준 액션 |
| `--color-brand-hover` | primary-700 | hover/pressed |
| `--color-brand-subtle` | primary-50 | tonal 배경 |
| `--color-text` | neutral-900 | 본문·헤딩 |
| `--color-text-secondary` | neutral-700 | 보조 |
| `--color-text-muted` | neutral-600 | 약한 텍스트(최소 AA) |
| `--color-text-placeholder` | neutral-500 | placeholder/disabled 전용 |
| `--color-bg` | neutral-0 | 카드/모달 바닥 |
| `--surface-1/2/3` | neutral-50/100/200 | 표면 위계 |
| `--border` / `--border-strong` | neutral-200 / 300 | 구분선 / 입력 보더 |
| `--ring` | primary-600 @35% | 포커스 링 |
| `--status-recruiting-*` 등 | 2-5 도메인 색 | 상태/역할/출석 |

**두 앱의 허용 차이 = 밀도 뿐(색 아님).** 콘솔이 더 촘촘해야 하면 아래처럼 **밀도 토큰만** override 하고 색 토큰은 건드리지 않습니다.

```css
/* console.overrides.css — 색은 절대 재정의하지 않음 */
:root {
  --radius-control: 6px;   /* 사이트 8 → 콘솔 6 */
  --radius-card: 12px;     /* 사이트 16 → 콘솔 12 */
  --font-size-base: 15px;  /* 콘솔 밀도 (사이트 16 유지) */
  --row-height: 44px;      /* 출석부/테이블 조밀 */
}
```

**마이그레이션 순서** (기존 95줄/104줄 → 단일 소스)
1. 두 파일의 색 값을 뽑아 이 시스템의 가장 가까운 토큰에 매핑(예: 기존 `--main:#4a5cf2` → `--color-brand`).
2. 컴포넌트에서 HEX 리터럴을 전부 semantic 토큰 참조로 치환.
3. 두 앱의 색 정의 파일을 삭제하고 공용 `tokens.css` 하나를 import.
4. 콘솔에만 필요한 밀도 차이는 `console.overrides.css`(색 없음)로 분리.
> 실제 두 파일을 공유해 주시면 "기존 변수 → 새 토큰" 1:1 매핑 표를 만들어 드립니다.

---

## 9. Components

각 컴포넌트는 semantic 토큰으로만 정의합니다. (실제 CSS는 `tokens.css` + 스타일가이드 HTML 참고)

### 9-1. Button

| 변형 | 배경 | 텍스트 | hover | 용도 |
|---|---|---|---|---|
| Primary (solid) | brand(600) | 흰색 | brand-hover(700) | 화면당 1개 주요 액션 |
| Tonal | brand-subtle(50) | primary-700 | primary-100 | 보조 주요 액션(친근) |
| Secondary (outline) | 흰색 + border-strong | neutral-800 | surface-1 / border neutral-400 | 취소·보조 |
| Ghost | 투명 | neutral-700 | surface-2 | 아이콘 버튼, 3차 액션 |
| Destructive | error-600 | 흰색 | error-700 | 삭제·거절 |

**사이즈**: sm h32/px12/text-sm · md h40/px16/text-sm~15 · lg h48/px20/text-base. 라운딩 `--radius-control`(8). 모바일 터치 타깃 **최소 44px**(sm는 hit-area 패딩으로 보정). **disabled**: bg neutral-200 / text neutral-400 / 그림자 없음. **loading**: 스피너 + 라벨 유지, 폭 고정.

### 9-2. Input / Select / Textarea

- 기본: h40, px14, radius `--radius-control`, bg 흰색, border `--border-strong`(neutral-300), text neutral-900, placeholder neutral-500.
- 포커스: border **brand(600)** + `--ring`. 에러: border error-600 + error 링 + helper error-700.
- disabled: bg surface-2(neutral-100), text neutral-400.
- 라벨 text-sm/500 neutral-800 · helper text-xs neutral-600 · 필수표시 error-600 `*`.

### 9-3. Card

- bg `--color-bg`(흰색), border `--border`(neutral-200) 1px, radius `--radius-card`(16), 패딩 20~24, `shadow-sm` resting.
- **인터랙티브 카드**(스터디 카드 등): hover 시 `shadow-md` + `translateY(-2px)`(base/ease-out). 포커스 가능하면 `--ring`.
- 구조: (선택)썸네일/컬러 스트립 → 헤더(태그+상태) → 타이틀 → 본문 → 메타 → 푸터(CTA).

### 9-4. Badge / Status Pill

- 패딩 py2/px8, text-xs/500, radius `--radius-pill`. tonal 스타일: bg `{semantic}-50`, text `{semantic}-700`, 선행 dot `{semantic}-500`(6px).
- 상태/역할/출석 매핑은 **2-5** 그대로. 색만으로 구분 금지 → 텍스트 라벨 필수.

### 9-5. Study Card (핵심)

```
┌───────────────────────────────┐
│ [카테고리 컬러 스트립 4px]       │
│ 🏷 개발   ● 모집중        🔖    │  ← 태그(neutral) + 상태 pill + 북마크
│ React 딥다이브 스터디            │  ← text-xl/600 neutral-900 (2줄 clamp)
│ 매주 목 20:00 · 8주 과정         │  ← text-sm neutral-600
│ ─────────────────────────────  │
│ 👥 6/8명  👁 124   [신청하기]    │  ← 메타 text-xs neutral-500 + Primary sm
│ ▓▓▓▓▓▓░░ 정원 75%               │  ← 진행바(75%↑=warning tint)
└───────────────────────────────┘
```
- 정원 진행바: 트랙 surface-3, 채움 brand(600); 80%↑이면 채움 warning-500 + "마감임박" 상태로 승격.
- 조회수/정원 숫자는 tabular-nums.

### 9-6. Attendance Table (출석부 · 구글시트 대체)

- 구조: 좌측 **멤버 열 고정**, 상단 **세션(회차) 행 고정**. 셀 = 출석 chip.
- 셀 탭 시 순환: 출석 → 지각 → 결석 → 휴가 → 미체크. 각 상태는 2-5 색 + 아이콘.
- 행 높이 48~56(콘솔은 44). 헤더 bg surface-2, 셀 text-sm neutral-800, 구분선 border.
- 우측 고정 **출석률 열**: tabular-nums + 임계 색(≥80 success / 60–79 warning / <60 error). 즉시 집계.
- 정정/휴가는 별도 모달(사유·허가 토글). 변경 이력은 툴팁으로.

### 9-7. Dashboard Stat Card

- 라벨 text-sm neutral-600 → 값 text-3xl~4xl/700 neutral-900 tabular-nums → 델타 text-sm(success-700 ▲ / error-700 ▼).
- 예: "활성 인원 128명 ▲12", "평균 출석률 82% ▲3%p", "운영 스터디 24개".
- 차트: 분야별=2-6 카테고리 팔레트, 상태별=2-5 상태 색, 추이=brand 라인 + primary-100 area.

### 9-8. 기타 컴포넌트 요약

| 컴포넌트 | 핵심 스펙 |
|---|---|
| Tabs | 언더라인형. active text primary-700 + 2px underline brand(600), inactive neutral-600 |
| Filter Chip | pill. 미선택 border-strong/neutral-700/흰bg · 선택 brand-subtle bg + primary-700(다중) 또는 brand solid(단일) |
| Modal/Dialog | radius `--radius-modal`, `shadow-xl`, 오버레이 rgba(23,25,35,.48), 등장 base/ease-out, 모바일은 바텀시트(상단 radius 24) |
| Toast | 좌측 상태 색 스트립 4px + 아이콘, bg 흰색, shadow-lg, 자동 4s |
| Avatar | radius-full, 사이즈 24/32/40, 이니셜 fallback bg primary-100/text primary-700, 역할 링(캡틴=primary-600) |
| Nav | 사이트=상단 가로 네비(흰bg + border 하단), 콘솔=좌측 사이드바(surface-1, active brand-subtle bg + primary-700) |
| Empty State | 일러스트/아이콘 + 안내 카피(~해요체) + 주요 CTA. 예: "아직 신청한 스터디가 없어요" |
| Pagination / Segmented | segmented control은 track surface-2, active 흰bg + shadow-xs |

---

## 10. Layout & 적용 가이드

- **그리드**: 12컬럼. 사이트 컨테이너 1280 / gutter 24 / 컬럼 gap 24. 콘솔 1200 + 좌측 사이드바 240.
- **스터디 목록**: 상단 필터바(검색 + 카테고리 칩 + 상태 칩) → 카드 그리드(3열 desktop / 2열 tablet / 1열 mobile, gap 24). 정렬·조회수·북마크.
- **스터디 상세**: 좌 2/3 본문(설명·일정·회차) + 우 1/3 sticky 신청 카드(정원·상태·CTA). 조회수/북마크 상단.
- **대시보드(콘솔)**: 상단 stat 카드 4개 → 분야별/상태별 차트 2열 → 인기 스터디·최근 활동 리스트.
- **출석부(콘솔)**: 상단 스터디·회차 선택 → 고정 헤더/열 테이블 → 우측 출석률 요약.
- **마이페이지/수강**: 참여 중 스터디 카드 + "다음 세션" 하이라이트 배너(brand-subtle bg) + 참여 이력 타임라인.
- **모바일 앱**: 동일 토큰 사용. 하단 탭바(홈·탐색·수강·마이), 상단 라운딩 바텀시트, 터치 타깃 44px, 푸시 알림 배지 error-600.

---

## 11. 접근성 체크리스트 (WCAG 2.2 AA)

| 항목 | 페어 | 대비비 | 판정 |
|---|---|---|---|
| 본문 | neutral-900 / 흰색 | 16.68 | ✅ AA |
| 보조 텍스트 | neutral-700 / 흰색 | 9.00 | ✅ AA |
| 약한 텍스트 | neutral-600 / 흰색 | 6.21 | ✅ AA |
| Primary 버튼 | 흰색 / primary-600 | 5.35 | ✅ AA |
| 링크 텍스트 | primary-700 / 흰색 | 7.12 | ✅ AA |
| Success 버튼 | 흰색 / success-700 | 5.20 | ✅ AA |
| Error 버튼 | 흰색 / error-600 | 5.13 | ✅ AA |
| Info 버튼 | 흰색 / info-700 | 6.18 | ✅ AA |
| Warning 솔리드 | **neutral-900** / warning-400 | 9.24 | ✅ AA (흰글씨 ✕) |
| 상태 뱃지 | success-700 / success-50 | 4.73 | ✅ AA |
| placeholder | neutral-500 / 흰색 | 3.88 | △ 큰텍스트/비필수만 |
| primary-500 | 흰색 / primary-500 | 3.58 | △ 큰 그래픽만, 본문 ✕ |

**규칙**: ① 상태는 색+텍스트+아이콘 3중 인코딩. ② 포커스는 항상 `--ring`(3:1↑). ③ resting 장식 보더는 3:1 미만 허용(1.4.11은 상태 전달 요소에 적용) — **포커스/에러/선택 보더**는 3:1↑(brand·error). ④ disabled 요소는 대비 요건 면제(1.4.3). ⑤ 터치 타깃 24px↑(2.5.8), 주요 액션 44px 권장.

---

## 12. ⚠️ 주의사항 / 트레이드오프

- **primary-500은 흰글씨 본문 불가**(3.58, 큰 텍스트만). 솔리드 버튼·본문은 **-600 이상** 사용.
- **neutral-500은 placeholder/disabled 전용.** 의미 있는 회색 텍스트는 최소 neutral-600.
- **warning에 흰글씨 절대 금지.** 앰버는 항상 어두운 텍스트(neutral-900). 이는 이 계열의 물리적 한계.
- **장식 보더의 낮은 대비는 의도된 것.** 미니멀한 인상을 위해 resting 보더는 연하게, 대신 포커스/에러/선택 등 **상태를 전달하는 경계는 반드시 3:1↑**.
- **라이트 전용이지만 구조는 다크 확장 대비 완료.** 확장 시 단순 invert 금지 — surface는 순수 검정 대신 `#0D0E13`/`#16181F` 계열, primary는 채도 낮추고 명도 올린 버전으로 **재설계**. semantic 레이어 덕에 컴포넌트 수정 없이 토큰만 교체하면 됨.
- **밀도 차이는 밀도 토큰으로만.** 콘솔을 촘촘하게 만들 때 색을 새로 정의하지 말 것 — `console.overrides.css`에서 radius/폰트/행높이만 조정.
- **한글 우선 검수.** 자간·line-height는 라틴 기준으로 짜면 한글에서 답답해 보임. 실제 한글 문장으로 QA 필수.

---

*Design System v1.0 · 색상은 OKLCH 설계 → sRGB 변환 → WCAG 검증 완료 · Light 전용(MVP), 다크 확장 구조 내장*
