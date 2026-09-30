'use client';

import { useState } from 'react';

import { handlerKey } from './utils';
import { useMSWContext } from './context';
import React from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

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
  const { mockHandlerGroups, handlerConfig, setPreset, toggleHandler } = useMSWContext();

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
          background: open ? '#334155' : '#1e293b',
          border: '1px solid #334155',
          color: '#94a3b8',
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
            width: 340,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            color: '#e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid #1e293b',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>MSW Devtool</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {mockHandlerGroups.map((group) => (
            <div key={group.baseUrl}>
              <div
                style={{
                  padding: '5px 12px',
                  color: '#64748b',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: '#0a1122',
                }}
              >
                {stripBase(group.baseUrl)}
              </div>
              {group.handlers.map((handler) => {
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
                      borderBottom: '1px solid #0a1122',
                      opacity: enabled ? 1 : 0.45,
                    }}
                  >
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: METHOD_COLOR[handler.method] ?? '#475569',
                        color: '#fff',
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
                        color: '#94a3b8',
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
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 4,
                        color: '#e2e8f0',
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
                        background: enabled ? '#16a34a' : '#374151',
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
                          background: '#fff',
                          transition: 'left 0.15s',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
