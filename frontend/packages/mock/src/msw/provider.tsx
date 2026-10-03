'use client';

import { useEffect, useRef, useState } from 'react';
import type { SetupWorker } from 'msw/browser';

import { MSWContext, type HandlerConfig } from './context';
import { MSWDevtool } from './devtool';
import { registerHandlers, handlerKey, type MockHandler, type MockHandlerGroup } from './utils';

const STORAGE_KEY = 'msw-handler-config';

function defaultConfig(groups: MockHandlerGroup[]): HandlerConfig {
  const config: HandlerConfig = {};
  for (const group of groups) {
    for (const handler of group.handlers) {
      config[handlerKey(handler)] = { presetLabel: handler.presets[0].label, enabled: true };
    }
  }
  return config;
}

function loadConfig(groups: MockHandlerGroup[]): HandlerConfig {
  const defaults = defaultConfig(groups);
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    return { ...defaults, ...(JSON.parse(stored) as Partial<HandlerConfig>) } as HandlerConfig;
  } catch {
    return defaults;
  }
}

function buildActiveHandlers(groups: MockHandlerGroup[], config: HandlerConfig) {
  return groups.flatMap((group) =>
    group.handlers
      .filter((h) => config[handlerKey(h)]?.enabled !== false)
      .map((h) => {
        const state = config[handlerKey(h)];
        const preset = h.presets.find((p) => p.label === state?.presetLabel) ?? h.presets[0];
        return { ...h, preset };
      }),
  );
}

interface MSWProviderProps {
  mockHandlerGroups: MockHandlerGroup[];
  loadWorker: () => Promise<SetupWorker>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** 기본은 개발 서버에서만 켠다. 백엔드 없이 배포되는 앱(playground)은 true 로 넘긴다. */
  enabled?: boolean;
}

export function MSWProvider({
  mockHandlerGroups,
  loadWorker,
  children,
  fallback = null,
  enabled = process.env.NODE_ENV === 'development',
}: MSWProviderProps) {
  const [ready, setReady] = useState(!enabled);
  const [handlerConfig, setHandlerConfig] = useState<HandlerConfig>(() =>
    enabled ? defaultConfig(mockHandlerGroups) : {},
  );
  const workerRef = useRef<SetupWorker | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const config = loadConfig(mockHandlerGroups);
    setHandlerConfig(config);

    let isSubscribed = true;

    loadWorker().then((worker) => {
      if (!isSubscribed) return;
      workerRef.current = worker;
      worker.start({ onUnhandledRequest: 'bypass' }).then(() => {
        if (!isSubscribed) return;
        worker.resetHandlers(...registerHandlers(buildActiveHandlers(mockHandlerGroups, config)));
        setReady(true);
      });
    });

    return () => {
      isSubscribed = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const applyConfig = (next: HandlerConfig) => {
    setHandlerConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* noop */ }
    workerRef.current?.resetHandlers(
      ...registerHandlers(buildActiveHandlers(mockHandlerGroups, next)),
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('msw:config-change', { detail: next }));
    }
  };

  const setPreset = (handler: MockHandler, presetLabel: string) => {
    const key = handlerKey(handler);
    applyConfig({ ...handlerConfig, [key]: { ...handlerConfig[key], presetLabel } });
  };

  const toggleHandler = (handler: MockHandler) => {
    const key = handlerKey(handler);
    applyConfig({
      ...handlerConfig,
      [key]: { ...handlerConfig[key], enabled: !handlerConfig[key]?.enabled },
    });
  };

  if (!ready) return <>{fallback}</>;

  return (
    <MSWContext.Provider value={{ mockHandlerGroups, handlerConfig, setPreset, toggleHandler }}>
      {children}
      {enabled && <MSWDevtool />}
    </MSWContext.Provider>
  );
}
