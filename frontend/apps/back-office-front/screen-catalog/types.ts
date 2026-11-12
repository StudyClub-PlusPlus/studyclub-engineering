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

export interface Recipe {
  /** PRD catalog: explicit local API responses, overriding browser MSW. */
  api?: { path: string; query?: Record<string, string>; method?: string; status?: number; json?: unknown; pending?: boolean }[];
  storage?: StorageSeed[];
  steps?: ScreenStep[];
  render: RenderSpec;
}

export interface ScreenshotSpec {
  clip?: { x: number; y: number; width: number; height: number };
  fullPage?: boolean;
}

export interface Assertions {
  disabled?: string[];
  visible?: string[];
  hidden?: string[];
  text?: Record<string, string>;
}

export interface ScreenStateDef {
  /** Traceability only; a screenshot does not prove the whole behavior scenario. */
  prdScenarios?: string[];
  id: SdfId;
  label: string;
  pageId: SdfId;
  rationale: string;
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
