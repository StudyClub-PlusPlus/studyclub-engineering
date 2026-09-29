import { StudyManageShell } from '@core/components/StudyManageShell';

export default function StudyManageLayout({ children }: { children: React.ReactNode }) {
  return <StudyManageShell>{children}</StudyManageShell>;
}
