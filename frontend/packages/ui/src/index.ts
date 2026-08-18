// @studyclub/ui — 공유 표현 컴포넌트.
// 소비자: core-front · back-office-front · playground
//
// 규칙: 여기 있는 것은 **세션·라우팅·데이터 페칭에 의존하지 않는다.**
// 그런 게 필요하면 슬롯(ReactNode prop)으로 앱에서 주입한다 (Nav 의 `auth` 참고).

export { LOCALES, DEFAULT_LOCALE, isLocale, t, m, MESSAGES } from "./i18n";

export { StatusBadge, Pill } from "./Badge";
export { Tabs, type TabItem } from "./Tabs";
export { Nav } from "./Nav";
export { Footer } from "./Footer";
export { JoinCta } from "./JoinCta";
export { StudyCard } from "./StudyCard";
export { StudyThumb } from "./StudyThumb";
export { StudyBrowser } from "./StudyBrowser";
export { EventCard, EventRow } from "./EventCard";
export { EventBrowser } from "./EventBrowser";
export { RegionClocks } from "./RegionClocks";
