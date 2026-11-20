# 화면 레이아웃과 콘텐츠 폭

2026-10-31 작업 트리 기준. core-front와 백오피스의 레이아웃은 서로 다르다. 아래는 현재 코드의 적용 상태와 새 화면 작성 기준이다. 실제 브라우저에서 모든 폭의 표시를 검증했다는 의미는 아니다.

## core-front 기본 틀

루트 레이아웃은 [`src/app/[locale]/layout.tsx`](../../frontend/apps/core-front/src/app/[locale]/layout.tsx)다. `app/layout.tsx`는 없으며 로케일 레이아웃이 `<html lang>`과 Providers, 내비게이션, 본문, 푸터를 구성한다.

- 전체는 `flex min-h-screen flex-col`, 본문은 `flex-1 overflow-x-clip`이다. 본문에 공통 폭을 자동으로 씌우지 않으므로 각 페이지가 자신의 콘텐츠 틀을 정한다.
- 일반 화면은 `SiteHeader`, 로그인·온보딩은 `RegistrationNavigation`의 로고·언어 전환 헤더를 사용한다. 푸터는 공통 레이아웃에 유지된다.
- 장식이 본문 밖으로 넘치는 것을 `overflow-x-clip`으로 자른다. 이것만으로 내부 표·모달·긴 문자열의 가로 넘침까지 해결됐다고 보지 않는다.
- CSS 진입점은 `src/app/globals.css`이며 `@studyclub/design/core.css`를 가져온다.

## 폭 상수와 실제 사용

상수 정의는 [`src/lib/layout.ts`](../../frontend/apps/core-front/src/lib/layout.ts)에 있다. 사용자 사이트의 화면 규칙이므로 공용 타입·유틸 패키지가 아니라 앱에 둔다.

| 상수 | 클래스 | 현재 적용 |
|---|---|---|
| `PAGE` | `mx-auto w-full max-w-6xl px-6` | 스터디·행사 상세, 공지, 약관, 마이페이지 등 일반 콘텐츠 틀 |
| `READ` | `max-w-3xl` | 약관·개인정보 본문, 공지 상세 본문 |
| `FORM` | `max-w-2xl` | 정의되어 있지만 현재 core-front 화면에서 참조하지 않음 |
| `DETAIL_GRID` | `grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]` | 스터디·행사 상세. `lg`부터 본문과 340px 정보 칸으로 나뉨 |
| `DETAIL_ASIDE` | `lg:sticky lg:top-24` | 스터디·행사 상세 정보 칸. `lg`부터 상단 간격을 두고 따라옴 |

`DETAIL_GRID`는 작은 화면에서 한 열이다. 공지 상세에는 이 상수를 사용하지 않는다. 공지는 `PAGE` 안에 제목·메타 정보·`READ` 본문·이전/다음 글을 배치한다.

실제 사용 코드는 [스터디 상세](../../frontend/apps/core-front/src/features/studies/StudyDetailView.tsx), [행사 상세](../../frontend/apps/core-front/src/app/[locale]/events/[id]/page.tsx), [공지 상세](../../frontend/apps/core-front/src/app/[locale]/notices/[id]/page.tsx), [약관 공통 화면](../../frontend/apps/core-front/src/features/legal/LegalDoc.tsx)을 참고한다.

## 페이지별 구성과 예외

| 화면 | 현재 구성 |
|---|---|
| 홈·스터디 목록·행사 목록·가이드 | `max-w-6xl px-6` 계열 클래스를 직접 사용. 모두 `PAGE` import로 통일된 상태는 아님 |
| 스터디 목록·추천 스터디 | `grid-cols-2`, `lg:grid-cols-3`. 모바일 2열, 넓은 화면 3열 |
| 행사 목록 | `EventBrowser`가 `EventRow`를 나열하는 행 목록 |
| 공지 목록 | 제목·날짜 등의 행 목록. 카드 3열 그리드가 아님 |
| 스터디·행사 상세 | 본문과 정보·주 행동 칸. 넓은 화면에서 2단·sticky 적용 |
| 공지 상세·약관 | 읽기 중심 단일 본문 |
| 로그인 | `max-w-md px-6`의 가운데 정렬 틀 |
| 온보딩 | 바깥 `px-4 sm:px-6`, 안쪽 `mx-auto max-w-[540px]` |

헤더·푸터의 최대 폭은 `max-w-6xl`이지만 모바일 좌우 여백은 동일하지 않다.

- [`SiteHeader`](../../frontend/apps/core-front/src/components/SiteHeader.tsx): `px-4 sm:px-6`
- [`RegistrationNavigation`](../../frontend/apps/core-front/src/components/RegistrationNavigation.tsx): `px-5 sm:px-6`
- [`Footer`](../../frontend/apps/core-front/src/components/Footer.tsx): `px-6`

따라서 “모든 페이지의 바깥은 PAGE”, “좌우 여백은 항상 px-6”, “모든 목록은 모바일 1열”이라고 현재 구현을 설명하지 않는다.

## 새 화면 작성 기준

1. 일반 콘텐츠 페이지는 `PAGE`를 재사용한다. 긴 본문은 그 안에 `READ`를 적용한다. 기존과 같은 폭을 새 숫자로 중복 정의하지 않는다.
2. `FORM`은 입력 단의 폭이 필요할 때 선택할 수 있다. 기존 로그인·온보딩의 별도 틀을 자동으로 바꾸는 규칙은 아니다.
3. 본문과 정보·행동 칸이 함께 필요한 상세에 `DETAIL_GRID`·`DETAIL_ASIDE`를 사용한다. 공지처럼 읽기가 중심인 상세를 반드시 2단으로 만들지는 않는다.
4. 목록의 열 수와 행 구성은 해당 기능의 PRD·현재 화면을 기준으로 정한다. 스터디·행사·공지에 동일한 카드 그리드를 일괄 적용하지 않는다.
5. 문서 전체의 가로 스크롤은 피하되, 출석부·시간표·코드 블록처럼 넓은 콘텐츠는 해당 영역 안의 스크롤을 허용한다. 스크롤로 가려진 정보와 행동에 접근할 수 있는지도 확인한다.

기능 전용 구성은 `features/<기능>/`, 앱 공통 헤더·푸터는 `components/`에 둔다. 패키지와 앱의 경계는 [프로젝트 구조](project-structure.md#공용-코드의-소유권)를 따른다.

## 백오피스

[`src/app/layout.tsx`](../../frontend/apps/back-office-front/src/app/layout.tsx)가 Providers와 [`AppShell`](../../frontend/apps/back-office-front/src/components/AppShell.tsx)을 구성한다. `body`의 `data-app='console'`로 콘솔 스타일을 구분한다.

- 일반 화면: 사이드바와 본문 영역을 가로로 배치한다. 본문 영역은 `min-w-0 flex-1`이며 헤더는 `sticky top-0 h-16`이다.
- 콘텐츠 틀: `mx-auto w-full max-w-5xl flex-1 px-6 py-8`.
- [`Sidebar`](../../frontend/apps/back-office-front/src/components/Sidebar.tsx): `w-56`, `sticky top-0 h-screen`, `hidden lg:flex`. 작은 화면에서는 숨긴다.
- `/login`: 사이드바·헤더 없이 `min-h-screen` 본문만 렌더한다.

core-front의 `PAGE`나 상세 2단 상수를 백오피스 전체에 적용하지 않는다. playground의 프로토타입도 별도 구현이므로 실제 서비스와 폭이 같다고 전제하지 않는다.

## 검증

현재 화면 카탈로그 뷰포트는 두 앱 모두 desktop **1280×900**, mobile **390×844**다. 정의는 [core-front viewports](../../frontend/apps/core-front/screen-catalog/viewports.ts)와 [백오피스 viewports](../../frontend/apps/back-office-front/screen-catalog/viewports.ts)에 있다.

레이아웃 변경 시 [E2E 가이드](e2e-guide.md)에 따라 해당 화면의 기본·빈 상태·오류·모달을 확인한다. **375px에서도 문서 전체의 가로 스크롤이 없는지 별도로 확인**한다. 390px 카탈로그 통과가 375px 검증을 대신하지 않는다. sticky 칸, 내부 가로 스크롤, 긴 제목·URL, 한국어·영어 줄바꿈도 함께 점검한다.

이번 문서 갱신은 코드 대조를 기준으로 했으며 화면 코드·스크린샷은 변경하지 않았다.
