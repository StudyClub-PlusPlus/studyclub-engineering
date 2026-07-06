// Operator(운영진 · 캡틴) 도메인 모델.
import type { L10n } from "./common";

export type Operator = {
  id: string;
  name: L10n;
  role: L10n;
  bio: L10n;
  avatar?: string;
  links?: Record<string, string>;
  order?: number;
};

export function byOperatorOrder(a: Operator, b: Operator): number {
  return (a.order ?? 999) - (b.order ?? 999);
}
