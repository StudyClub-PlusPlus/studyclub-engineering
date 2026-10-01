import { createContext, useContext } from 'react';

import type { MockHandler, MockHandlerGroup } from './utils';

export type HandlerState = { presetLabel: string; enabled: boolean };
export type HandlerConfig = Record<string, HandlerState>;

export type MSWContextValue = {
  mockHandlerGroups: MockHandlerGroup[];
  handlerConfig: HandlerConfig;
  setPreset: (handler: MockHandler, presetLabel: string) => void;
  toggleHandler: (handler: MockHandler) => void;
};

export const MSWContext = createContext<MSWContextValue | null>(null);

export function useMSWContext() {
  const ctx = useContext(MSWContext);
  if (!ctx) throw new Error('useMSWContext must be used within MSWProvider');
  return ctx;
}
