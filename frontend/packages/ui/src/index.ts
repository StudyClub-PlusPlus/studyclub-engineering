/**
 * @studyclub/ui — design-system.md §9 구현. 사용자 사이트 + 운영자 콘솔 공용.
 *
 * 규칙:
 * - 색·간격·라운딩은 @studyclub/design 의 semantic 토큰만 참조한다 (raw HEX 금지).
 * - Tailwind v4 는 소스를 정적 스캔하므로 클래스명을 동적으로 조립하지 않는다.
 */
export { cx } from "./cx";

export { Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { FieldShell, Input, Select, Textarea } from "./Field";
export type { FieldShellProps, InputProps, SelectProps, TextareaProps } from "./Field";

export { FilterChip } from "./Chip";
export type { FilterChipProps } from "./Chip";

export { Avatar } from "./Avatar";
export type { AvatarProps, AvatarSize } from "./Avatar";

export { StatCard, rateToneClass } from "./StatCard";
export type { StatCardProps } from "./StatCard";

export {
  CapacityBar,
  CAPACITY_WARN_THRESHOLD,
  capacityPercent,
  isClosingSoon,
} from "./CapacityBar";
export type { CapacityBarProps } from "./CapacityBar";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
