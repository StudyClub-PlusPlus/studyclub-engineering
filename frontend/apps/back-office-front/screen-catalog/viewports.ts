export const VIEWPORTS = {
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export function resolveViewports(vp?: ViewportName[]): ViewportName[] {
  return vp ?? ['desktop'];
}
