export type SdfId = string;
export type ViewportName = 'desktop' | 'mobile';
export type ScreenStateTag = 'excluded' | 'wip' | 'visual-only';

export interface StorageSeed {
  key: string;
  value: unknown;
}

export interface ScreenStep {
  action: 'click' | 'fill' | 'wait';
  selector?: string;
  value?: string;
  ms?: number;
}

export interface RenderSpec {
  url: string;
}

/** 화면이 부르는 API 의 고정 응답. MSW 목에 없는 API(로컬 백엔드로 새어 나가는 것)를 카탈로그에서 고정할 때 쓴다. */
export interface ApiFixture {
  /** 경로만 비교한다(쿼리 무시). 예: '/api/me/feedbacks' */
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  status?: number;
  json?: unknown;
}

export interface Recipe {
  storage?: StorageSeed[];
  steps?: ScreenStep[];
  api?: ApiFixture[];
  render: RenderSpec;
}

export interface ScreenshotSpec {
  clip?: { x: number; y: number; width: number; height: number };
  fullPage?: boolean;
}

export interface Assertions {
  visible?: string[];
  hidden?: string[];
  text?: Record<string, string>;
}

export interface ScreenStateDef {
  id: SdfId;
  label: string;
  pageId: SdfId;
  rationale: string;
  /** PRD 시나리오의 부분 화면 근거. 완료 판정이 아니다. */
  prdScenarios?: string[];
  recipe: Recipe;
  viewports?: ViewportName[];
  assertions?: Assertions;
  screenshot?: ScreenshotSpec;
  tags?: ScreenStateTag[];
  deprecation?: string;
}

export interface PageDef {
  id: SdfId;
  label: string;
  path: string;
}

export interface ScreenCatalog {
  pages: PageDef[];
  screenStates: ScreenStateDef[];
}
