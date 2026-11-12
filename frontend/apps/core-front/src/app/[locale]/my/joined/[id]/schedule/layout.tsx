import { StudyManageShell } from '@/features/schedule/StudyManageShell';

export default function StudyManageLayout({ children }: { children: React.ReactNode }) {
  return <StudyManageShell>{children}</StudyManageShell>;
}
