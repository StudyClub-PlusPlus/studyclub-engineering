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
  storage?: StorageSeed[];
  steps?: ScreenStep[];
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
