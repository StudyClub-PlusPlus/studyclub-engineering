'use client';

import { Toaster as HotToaster, toast } from 'react-hot-toast';
import type { Toast as HotToast, ToasterProps } from 'react-hot-toast';

export { toast };
export type { HotToast as Toast, ToasterProps };

/**
 * design-system.md §9-8 Toast.
 * bg 흰색(--color-bg) · shadow-lg · 자동 4s · 타입별 아이콘 색(semantic 토큰).
 * toastOptions 를 넘기면 기본값 위에 병합된다.
 */
export function Toaster({ toastOptions, ...rest }: ToasterProps) {
  return (
    <HotToaster
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-surface-raised)',
          color: 'var(--color-ink)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          padding: '12px 16px',
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: 'var(--color-success-fg)',
            secondary: 'var(--color-surface-raised)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--color-danger-fg)',
            secondary: 'var(--color-surface-raised)',
          },
        },
        ...toastOptions,
      }}
      {...rest}
    />
  );
}
