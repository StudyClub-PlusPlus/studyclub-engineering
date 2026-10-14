'use client';

import { useState } from 'react';

import { handlerKey } from './utils';
import { useMSWContext } from './context';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// tokens.css neutral scale
const N = {
  0: '#FFFFFF',
  50: '#F9FAFC',
  100: '#F4F5F9',
  200: '#E6E8ED',
  300: '#D4D7DE',
  400: '#A6A9B2',
  500: '#7E818C',
  600: '#5D616A',
  700: '#464951',
  800: '#2D2F35',
  900: '#1C1E23',
  950: '#0D0E13',
};

const METHOD_COLOR: Record<string, string> = {
  GET: '#3b82f6',
  POST: '#22c55e',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#8b5cf6',
};

function stripBase(path: string) {
  return path.replace(API_BASE, '') || '/';
}

export function MSWDevtool() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { mockHandlerGroups, handlerConfig, setPreset, toggleHandler } = useMSWContext();

  function toggleGroup(baseUrl: string) {
    setCollapsed((prev) => ({ ...prev, [baseUrl]: !prev[baseUrl] }));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="MSW 설정"
        style={{
          position: 'fixed',
          bottom: 60,
          left: 20,
          zIndex: 9999,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: open ? N[700] : N[800],
          border: `1px solid ${N[700]}`,
          color: N[300],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        ⚙
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            left: 20,
            zIndex: 9998,
            width: 360,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: N[900],
            border: `1px solid ${N[800]}`,
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            color: N[100],
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: `1px solid ${N[800]}`,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13, color: N[50] }}>MSW Devtool</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: N[400],
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {mockHandlerGroups.map((group) => {
            const isCollapsed = collapsed[group.baseUrl] ?? false;
            return (
              <div key={group.baseUrl}>
                {/* 그룹 헤더 — 클릭 시 아코디언 */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.baseUrl)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    color: N[400],
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: N[950],
                    border: 'none',
                    borderBottom: `1px solid ${N[800]}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{stripBase(group.baseUrl)}</span>
                  <span style={{ fontSize: 9, color: N[500] }}>{isCollapsed ? '▶' : '▼'}</span>
                </button>

                {/* 핸들러 목록 */}
                {!isCollapsed &&
                  group.handlers.map((handler) => {
                    const key = handlerKey(handler);
                    const state = handlerConfig[key];
                    const enabled = state?.enabled !== false;
                    const activePreset = state?.presetLabel ?? handler.presets[0].label;
                    const relativePath =
                      stripBase(handler.path).replace(stripBase(group.baseUrl), '') || '/';

                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 12px',
                          borderBottom: `1px solid ${N[800]}`,
                          opacity: enabled ? 1 : 0.45,
                        }}
                      >
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: METHOD_COLOR[handler.method] ?? N[600],
                            color: N[0],
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {handler.method}
                        </span>

                        <span
                          style={{
                            flex: 1,
                            color: N[300],
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {relativePath}
                        </span>

                        <select
                          value={activePreset}
                          onChange={(e) => setPreset(handler, e.target.value)}
                          disabled={!enabled}
                          style={{
                            background: N[800],
                            border: `1px solid ${N[700]}`,
                            borderRadius: 4,
                            color: N[100],
                            fontSize: 11,
                            padding: '2px 4px',
                            cursor: enabled ? 'pointer' : 'default',
                            maxWidth: 90,
                          }}
                        >
                          {handler.presets.map((p) => (
                            <option key={p.label} value={p.label}>
                              {p.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => toggleHandler(handler)}
                          title={enabled ? '끄기' : '켜기'}
                          style={{
                            width: 28,
                            height: 16,
                            borderRadius: 8,
                            background: enabled ? '#2A9754' : N[700],
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            flexShrink: 0,
                            transition: 'background 0.15s',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: enabled ? 14 : 2,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: N[0],
                              transition: 'left 0.15s',
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
