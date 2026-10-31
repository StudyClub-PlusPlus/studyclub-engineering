import type { Metadata } from 'next';

import { MyFeedbackDetail } from '@/features/feedback/MyFeedbackDetail';

export const metadata: Metadata = { title: '내 문의' };

export default function MyFeedbackPage() {
  return <MyFeedbackDetail />;
}
