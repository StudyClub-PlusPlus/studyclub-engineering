# 스터디클럽 디자인 시스템 v2.0

> 사회인 스터디클럽 플랫폼 · 사용자 사이트 + 운영자 콘솔 공용
> 톤: 친근·명료한 전문성 · Primary: Cobalt · Highlight: Tangerine · Light 전용
> 모든 본문·상태·인터랙션 컬러는 WCAG 2.2 대비비 검증 완료

---

## 📌 작업 요약

사회인 스터디클럽의 **사용자 사이트**와 **운영자 콘솔**이 하나의 토큰을 공유하도록 설계한 디자인 시스템입니다. 지금처럼 두 곳이 색을 따로 들고 있으면 시간이 지날수록 반드시 어긋나기 때문에, 이 문서의 핵심 원칙은 **"토큰은 한 파일(`tokens.css`)에만 있고, 모든 컴포넌트는 raw HEX가 아니라 semantic 토큰만 참조한다"** 입니다. 색을 바꿔야 할 때 한 파일만 고치면 두 앱이 함께 바뀝니다.

브랜드 방향은 "친근하지만 전문적"입니다. 신뢰를 주는 Cobalt(`--color-primary #5267D8`)를 중심축으로, Tangerine highlight는 알림과 제한적인 강조에만 사용합니다. 상태는 success/warning/danger/info/neutral 체계를 사용하며 highlight와 혼용하지 않습니다.

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
3. **위계는 크기가 아니라 대비로 만든다.** 폰트를 키우기 전에 weight·색(ink/secondary/muted)·여백으로 위계를 준다. 화면당 히어로 사이즈는 하나만.
4. **상태는 색 하나로 말하지 않는다.** 색 + 아이콘 + 텍스트를 함께 쓴다(색맹 대응). 모집중/출석/결석을 색만으로 구분하지 않는다.
5. **밀도는 앱마다 다르되, 색은 같다.** 콘솔은 더 촘촘하게(작은 라운딩·조밀한 행), 사이트는 더 여유롭게. 하지만 두 앱의 브랜드/상태 색은 100% 동일하다.

---

## 2. Color System

모든 색은 Tailwind v4의 `--color-*` 네임스페이스를 사용합니다. 컴포넌트는 단계값보다 역할 토큰을 우선하고, 기존 `primary-600` 같은 scale은 마이그레이션 호환용으로만 유지합니다.

### 2-1. Brand & Highlight

| Token | HEX | 용도 |
|---|---|---|
| `--color-primary` | `#5267D8` | 주요 CTA, 선택 상태, 진행률 |
| `--color-primary-hover` | `#485BCB` | Primary hover |
| `--color-primary-active` | `#4053BF` | Primary pressed |
| `--color-primary-dark` | `#344183` | 링크, 강조 배경, 진한 라벨 |
| `--color-primary-light` | `#E9ECFF` | 선택 영역과 보조 배경 |
| `--color-highlight` | `#FF805C` | 알림, 제한적인 강조, 아이콘 버튼 |
| `--color-highlight-hover` | `#EF704F` | Highlight hover |

흰색 텍스트 대비는 Primary `4.89:1`, hover `5.78:1`, active `6.55:1`로 모두 AA를 통과합니다. Highlight 위에는 흰색 대신 `--color-on-highlight`(`#282A43`, `5.65:1`)를 사용합니다. 모집 중 chip은 highlight가 아니라 success를 사용합니다.

### 2-2. Text

| Token | HEX | 용도 |
|---|---|---|
| `--color-ink` | `#282A43` | 제목과 기본 본문 |
| `--color-text-secondary` | `#626476` | 설명과 helper text |
| `--color-text-muted` | `#6C6D7F` | 메타데이터, 타임스탬프, 보조 내비게이션 |
| `--color-text-placeholder` | `#717384` | placeholder. page-bg 위 `4.56:1` |
| `--color-text-tertiary` | `#9798A8` | 비정보성 장식·대비 면제 상태 전용 |

### 2-3. Border, Focus & Surface

| Token | HEX | 용도 |
|---|---|---|
| `--color-border` | `#E2E1E9` | 기본 경계, 구분선, 비선택 컨트롤 |
| `--color-border-strong` | `#8D90A3` | 선택된 input·control 경계 |
| `--color-border-interactive` | `#7A8BD8` | hover와 focus 경계 |
| `--color-focus-ring` | `#7183DA` | 키보드 focus 전용 3px ring |
| `--color-page-bg` | `#FBFCFF` | 페이지 기본 배경 |
| `--color-surface-raised` | `#FFFFFF` | 카드, popover, dialog |
| `--color-cloud` | `#F7F5FB` | 표 헤더와 보조 영역 |
| `--color-disabled-bg` | `#EFF0F5` | disabled 배경 |
| `--color-disabled-fg` | `#77798A` | disabled 전경 |

`border-strong`, `border-interactive`, `focus-ring`은 page-bg 위에서 각각 `3.08:1`, `3.14:1`, `3.43:1`입니다. Focus ring에는 primary-light를 사용하지 않습니다.

### 2-4. Semantic feedback

| 역할 | 배경 | 전경 | 도메인 |
|---|---|---|---|
| Success | `#E6F4EC` | `#357553` | 출석, 모집 중 |
| Warning | `#FFF1D8` | `#8A5D18` | 지각, 마감 임박 |
| Danger | `#FCE9E6` | `#A94740` | 결석, 오류 |
| Info | `#E4F0F5` | `#356F86` | 내비게이터, 조퇴 |
| Neutral | `#F0EFF4` | `#696A7C` | 미확인, 마감, 종료 |

### 2-5. 도메인 매핑 — 스터디 상태 / 역할 / 출석

색을 "빨강=나쁨"이 아니라 **도메인 의미**에 고정합니다. 반드시 색 + 텍스트(+아이콘/dot) 함께.

**모집/진행 상태 (Study Status)**

| 상태 | 배경 | 텍스트 | dot |
|---|---|---|---|
| 모집중 | success-bg | success-fg | success-fg |
| 마감임박 (정원 80%↑ or D-3) | warning-bg | warning-fg | warning-fg |
| 모집마감 | neutral-bg | neutral-fg | neutral-fg |
| 진행중 | info-bg | info-fg | info-fg |
| 종료 | neutral-bg | neutral-fg | neutral-fg |

**역할 (Role)**

| 역할 | 스타일 | 배경 / 텍스트 |
|---|---|---|
| 캡틴 (운영진) | 브랜드 강조 | primary-light / primary-dark |
| 네비게이터 (스터디장) | 정보 강조 | info-bg / info-fg |
| 멤버 | 중립 | neutral-bg / neutral-fg |

**출석 상태 (Attendance)**

| 상태 | 배경 / 텍스트 | 아이콘 |
|---|---|---|
| 출석 | success-bg / success-fg | ● 체크 |
| 지각 | warning-bg / warning-fg | ◐ 시계 |
| 결석 | danger-bg / danger-fg | ○ 엑스 |
| 휴가(허가) | info-bg / info-fg | ✈ 비행기 |
| 미체크 | neutral-bg / neutral-fg | — 대시 |

**출석률 임계 색(텍스트/미터)**: ≥80% → success-fg, 60–79% → warning-fg, <60% → danger-fg.

### 2-6. 차트 카테고리 팔레트 (대시보드 분야별)

순서를 고정한 6색입니다. Semantic 색상을 데이터 카테고리 색으로 재사용하지 않으며, 색맹 대응을 위해 라벨을 병기합니다.

| 순서 | 이름 | HEX | 예시 매핑 |
|---|---|---|---|
| 1 | cobalt | `#5267D8` | 개발 |
| 2 | coral | `#D86645` | 어학 |
| 3 | green | `#3F8460` | 디자인 |
| 4 | amber | `#B1781B` | 자격증 |
| 5 | teal | `#397D8F` | 독서/교양 |
| 6 | violet | `#765AB5` | 기타 |

> 상태별 차트(모집중/진행중/마감)는 카테고리 팔레트가 아니라 **2-5의 상태 색**을 그대로 사용. 그리드선 border, 축 텍스트 text-muted(sm).

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

기본 elevation에 더해 floating card에는 Cobalt 계열 tint를 사용합니다.

| Token | box-shadow | 용도 |
|---|---|---|
| shadow-none | `none` | flat 요소, 인풋 resting |
| shadow-xs | `0 1px 2px rgba(23,25,35,.06)` | 버튼, 인풋 hover, 작은 칩 |
| shadow-sm | `0 1px 2px rgba(23,25,35,.06), 0 2px 6px rgba(23,25,35,.08)` | 카드 resting |
| shadow-md | `0 2px 4px rgba(23,25,35,.06), 0 6px 16px rgba(23,25,35,.10)` | 카드 hover, 드롭다운 |
| shadow-lg | `0 4px 8px rgba(23,25,35,.06), 0 12px 28px rgba(23,25,35,.12)` | 팝오버, 중앙 모달 |
| shadow-xl | `0 8px 16px rgba(23,25,35,.08), 0 24px 56px rgba(23,25,35,.16)` | 다이얼로그, 커맨드 팔레트 |
| shadow-card | `0 16px 40px rgba(52,65,131,.14)` | floating card, raised surface |

**포커스 링**: `--shadow-focus-ring: 0 0 0 3px var(--color-focus-ring)`. 키보드 포커스 전용이며 page-bg 위 `3.43:1`을 확보합니다. 기존 컴포넌트용 `--ring`은 이 토큰을 가리키는 호환 alias입니다.

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
[1] 역할 기반 컬러      → primary, ink, page-bg, success-bg ... (진실의 원천)
        ↓ 별칭
[2] 호환 별칭           → --color-brand, --color-fg, --color-surface-1 ...
        ↓ 참조
[3] 컴포넌트           → .btn { background: var(--color-brand) }  ← HEX 금지
```

**주요 semantic 토큰(발췌)** — 전체는 `tokens.css` 참고.

| Semantic | = 팔레트 | 의미 |
|---|---|---|
| `--color-primary` | `#5267D8` | 브랜드 기준 액션 |
| `--color-primary-hover/active` | Cobalt 단계 | hover / pressed |
| `--color-primary-light` | `#E9ECFF` | 선택·tonal 배경 |
| `--color-highlight` | `#FF805C` | 제한적 강조. 상태색으로 사용 금지 |
| `--color-ink` | `#282A43` | 본문·헤딩 |
| `--color-text-secondary/muted` | Cool neutral | 설명 / 메타데이터 |
| `--color-text-placeholder` | `#717384` | placeholder |
| `--color-page-bg` | `#FBFCFF` | 페이지 바닥 |
| `--color-surface-raised` | `#FFFFFF` | 카드·모달 |
| `--color-cloud` | `#F7F5FB` | 표 헤더·보조 영역 |
| `--color-border*` | Fog / interactive Cobalt | 구분선 / 입력 / 선택 경계 |
| `--shadow-focus-ring` | focus-ring 3px | 키보드 포커스 |
| `--color-recruiting-*` 등 | 2-5 도메인 색 | 상태/역할/출석 |

**두 앱의 허용 차이 = 밀도 뿐(색 아님).** 콘솔이 더 촘촘해야 하면 아래처럼 **밀도 토큰만** override 하고 색 토큰은 건드리지 않습니다.

```css
/* console.css — 색은 절대 재정의하지 않음 */
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
4. 콘솔에만 필요한 밀도 차이는 `console.css`(색 없음)로 통합 관리.
> 실제 두 파일을 공유해 주시면 "기존 변수 → 새 토큰" 1:1 매핑 표를 만들어 드립니다.

### 8-1. CSS 진입점 파일 구조 (`@studyclub/design`)

개별 앱에서 토큰과 공통 셸 클래스(`.card`, `html`, 기본 앵커 등)를 중복 정의하지 않도록 `@studyclub/design`에서 정본 CSS를 제공합니다.

| 파일 | 내용 | 사용처 |
|---|---|---|
| `tokens.css` | 1계층 Primitive + 2계층 Semantic 토큰 원천 (Tailwind v4 `@theme`) | 공용 원천 |
| `compat.css` | 구 토큰 점진적 마이그레이션 별칭 브리지 | 공용 |
| `base.css` | `tokens` + `compat` + `html`/`body`/`.card`/`.card-hover`/`.no-scrollbar` | 공통 베이스 (Storybook 등) |
| `core.css` | `base.css` + `.hero-glow` | `core-front`, `playground proto/core` |
| `console.css` | `base.css` + 콘솔 밀도 오버라이드 + `.bo-table` / `.btn` | `back-office-front`, `playground proto/console` |

**앱별 `globals.css` 적용 형태**:
```css
/* core-front / playground */
@import '@studyclub/design/core.css';
@source "../../../../packages/ui/src";

/* back-office-front */
@import '@studyclub/design/console.css';
@source "../../../../packages/ui/src";
```

---

## 9. Components

각 컴포넌트는 semantic 토큰으로만 정의합니다. (실제 CSS는 `tokens.css` + 스타일가이드 HTML 참고)

### 9-1. Button

| 변형 | 배경 | 텍스트 | hover | 용도 |
|---|---|---|---|---|
| Primary (solid) | brand(600) | 흰색 | brand-hover(700) | 화면당 1개 주요 액션 |
| Tonal | primary-light | primary-dark | brightness 97% | 보조 주요 액션 |
| Secondary (outline) | surface-raised + border | ink | page-bg / border-interactive | 취소·보조 |
| Ghost | 투명 | text-secondary | cloud | 아이콘 버튼, 3차 액션 |
| Destructive | danger-fg | on-primary | brightness 90% | 삭제·거절 |

**사이즈**: sm h32/px12/text-sm · md h40/px16/text-sm~15 · lg h48/px20/text-base. 라운딩 `--radius-control`(8). 모바일 터치 타깃 **최소 44px**(sm는 hit-area 패딩으로 보정). **disabled**: disabled-bg / disabled-fg / 그림자 없음. **loading**: 스피너 + 라벨 유지, 폭 고정.

### 9-2. Input / Select / Textarea

- 기본: h40, px14, radius `--radius-control`, bg surface-raised, border `--color-border`, text ink, placeholder text-placeholder.
- 선택된 control: border `--color-border-strong`. 포커스: border-interactive + `--shadow-focus-ring`. 에러: border danger-fg + error 링 + helper danger-fg.
- disabled: disabled-bg / disabled-fg.
- 라벨 text-sm/500 ink · helper text-xs text-muted · 필수표시 danger-fg `*`.

### 9-3. Card

- bg surface-raised, border `--color-border` 1px, radius `--radius-card`(16), 패딩 20~24, `shadow-sm` resting.
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
│ React 딥다이브 스터디            │  ← text-xl/600 ink (2줄 clamp)
│ 매주 목 20:00 · 8주 과정         │  ← text-sm text-muted
│ ─────────────────────────────  │
│ 👥 6/8명  👁 124   [신청하기]    │  ← 메타 text-xs text-muted + Primary sm
│ ▓▓▓▓▓▓░░ 정원 75%               │  ← 진행바(75%↑=warning tint)
└───────────────────────────────┘
```
- 정원 진행바: 트랙 disabled-bg, 채움 primary; 80%↑이면 채움 warning-fg + "마감임박" 상태로 승격.
- 조회수/정원 숫자는 tabular-nums.

### 9-6. Attendance Table (출석부 · 구글시트 대체)

- 구조: 좌측 **멤버 열 고정**, 상단 **세션(회차) 행 고정**. 셀 = 출석 chip.
- 셀 탭 시 순환: 출석 → 지각 → 결석 → 휴가 → 미체크. 각 상태는 2-5 색 + 아이콘.
- 행 높이 48~56(콘솔은 44). 헤더 bg cloud, 셀 text-sm ink, 구분선 border.
- 우측 고정 **출석률 열**: tabular-nums + 임계 색(≥80 success / 60–79 warning / <60 error). 즉시 집계.
- 정정/휴가는 별도 모달(사유·허가 토글). 변경 이력은 툴팁으로.

### 9-7. Dashboard Stat Card

- 라벨 text-sm text-muted → 값 text-3xl~4xl/700 ink tabular-nums → 델타 text-sm(success-fg ▲ / danger-fg ▼).
- 예: "활성 인원 128명 ▲12", "평균 출석률 82% ▲3%p", "운영 스터디 24개".
- 차트: 분야별=2-6 카테고리 팔레트, 상태별=2-5 상태 색, 추이=primary 라인 + primary-light area.

### 9-8. 기타 컴포넌트 요약

| 컴포넌트 | 핵심 스펙 |
|---|---|
| Tabs | 언더라인형. active text primary-dark + 2px underline primary, inactive text-muted |
| Filter Chip | pill. 미선택 border/text-secondary/surface-raised · 선택 border-strong + primary-light/primary-dark(다중) 또는 primary solid(단일) |
| Modal/Dialog | radius `--radius-modal`, `shadow-xl`, 오버레이 rgba(23,25,35,.48), 등장 base/ease-out, 모바일은 바텀시트(상단 radius 24) |
| Toast | 좌측 상태 색 스트립 4px + 아이콘, bg 흰색, shadow-lg, 자동 4s |
| Avatar | radius-full, 사이즈 24/32/40, 이니셜 fallback primary-light/primary-dark, 역할 링(캡틴=primary) |
| Nav | 사이트=상단 가로 네비(surface-raised + border 하단), 콘솔=좌측 사이드바(page-bg, active primary-light/primary-dark) |
| Empty State | 일러스트/아이콘 + 안내 카피(~해요체) + 주요 CTA. 예: "아직 신청한 스터디가 없어요" |
| Pagination / Segmented | segmented control은 track cloud, active surface-raised + shadow-xs |

---

## 10. Layout & 적용 가이드

- **그리드**: 12컬럼. 사이트 컨테이너 1280 / gutter 24 / 컬럼 gap 24. 콘솔 1200 + 좌측 사이드바 240.
- **스터디 목록**: 상단 필터바(검색 + 카테고리 칩 + 상태 칩) → 카드 그리드(3열 desktop / 2열 tablet / 1열 mobile, gap 24). 정렬·조회수·북마크.
- **스터디 상세**: 좌 2/3 본문(설명·일정·회차) + 우 1/3 sticky 신청 카드(정원·상태·CTA). 조회수/북마크 상단.
- **대시보드(콘솔)**: 상단 stat 카드 4개 → 분야별/상태별 차트 2열 → 인기 스터디·최근 활동 리스트.
- **출석부(콘솔)**: 상단 스터디·회차 선택 → 고정 헤더/열 테이블 → 우측 출석률 요약.
- **마이페이지/수강**: 참여 중 스터디 카드 + "다음 세션" 하이라이트 배너(brand-subtle bg) + 참여 이력 타임라인.
- **모바일 앱**: 동일 토큰 사용. 하단 탭바(홈·탐색·수강·마이), 상단 라운딩 바텀시트, 터치 타깃 44px, 푸시 알림 배지 danger-fg.

---

## 11. 접근성 체크리스트 (WCAG 2.2 AA)

| 항목 | 페어 | 대비비 | 판정 |
|---|---|---|---|
| 본문 | ink / page-bg | 13.62 | ✅ AA |
| 보조 텍스트 | text-secondary / page-bg | 5.68 | ✅ AA |
| muted 텍스트 | text-muted / page-bg | 4.95 | ✅ AA |
| placeholder | text-placeholder / page-bg | 4.56 | ✅ AA |
| Primary 버튼 | on-primary / primary | 4.89 | ✅ AA |
| Primary hover | on-primary / primary-hover | 5.78 | ✅ AA |
| Primary pressed | on-primary / primary-active | 6.55 | ✅ AA |
| Highlight | on-highlight / highlight | 5.65 | ✅ AA |
| Success chip | success-fg / success-bg | 4.85 | ✅ AA |
| Warning chip | warning-fg / warning-bg | 5.14 | ✅ AA |
| Danger chip | danger-fg / danger-bg | 4.90 | ✅ AA |
| Info chip | info-fg / info-bg | 4.80 | ✅ AA |
| Neutral chip | neutral-fg / neutral-bg | 4.64 | ✅ AA |
| 선택된 입력 경계 | border-strong / page-bg | 3.08 | ✅ UI 3:1 |
| Focus ring | focus-ring / page-bg | 3.43 | ✅ UI 3:1 |

**규칙**: ① 상태는 색+텍스트+아이콘 3중 인코딩. ② 모집 중 chip은 success, 비상태 강조만 highlight. ③ 포커스는 항상 `--shadow-focus-ring`. ④ 장식 border는 3:1 미만을 허용하지만 입력·포커스·선택 경계는 3:1 이상. ⑤ disabled 요소는 대비 요건 면제(1.4.3). ⑥ 터치 타깃 24px 이상, 주요 액션 44px 권장.

---

## 12. ⚠️ 주의사항 / 트레이드오프

- **Highlight 위 흰글씨 금지.** 반드시 `--color-on-highlight`를 사용합니다.
- **text-tertiary는 일반 텍스트 금지.** placeholder는 AA를 통과하는 `--color-text-placeholder`를 사용합니다.
- **Semantic 컬러는 상태 피드백 전용.** 차트 카테고리 팔레트와 혼용하지 않습니다.
- **장식 보더의 낮은 대비는 의도된 것.** 미니멀한 인상을 위해 resting 보더는 연하게, 대신 포커스/에러/선택 등 **상태를 전달하는 경계는 반드시 3:1↑**.
- **라이트 전용이지만 구조는 다크 확장 대비 완료.** 확장 시 단순 invert 금지 — surface는 순수 검정 대신 `#0D0E13`/`#16181F` 계열, primary는 채도 낮추고 명도 올린 버전으로 **재설계**. semantic 레이어 덕에 컴포넌트 수정 없이 토큰만 교체하면 됨.
- **밀도 차이는 밀도 토큰으로만.** 콘솔을 촘촘하게 만들 때 색을 새로 정의하지 말 것 — `console.css`에서 radius/폰트/행높이만 조정.
- **한글 우선 검수.** 자간·line-height는 라틴 기준으로 짜면 한글에서 답답해 보임. 실제 한글 문장으로 QA 필수.

---

*Design System v2.0 · Cobalt + Tangerine highlight · WCAG 2.2 AA 검증 · Light 전용*
