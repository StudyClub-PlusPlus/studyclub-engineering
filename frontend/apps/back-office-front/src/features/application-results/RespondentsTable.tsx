import { TableCard } from '@/components/ui';
import { answerText } from '@/features/application-results/answers';
import type { ApplicationResultsResponse } from '@/features/application-results/types';

export function RespondentsTable({ data }: { data: ApplicationResultsResponse }) {
  return (
    <TableCard>
      <thead>
        <tr>
          <th className='whitespace-nowrap'>디스코드 별명</th>
          <th>이메일</th>
          {data.questions.map((question) => (
            <th key={question.id} className='min-w-48 whitespace-normal break-words'>
              {question.label || '(제목 없음)'}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.applications.map((application) => (
          <tr key={application.id}>
            <td>
              <span className='block w-48 truncate font-semibold' title={application.discordNickname ?? undefined}>
                {application.discordNickname || '-'}
              </span>
            </td>
            <td>
              <span className='block w-56 truncate' title={application.email ?? undefined}>
                {application.email || '-'}
              </span>
            </td>
            {data.questions.map((question) => (
              <td key={question.id} className='whitespace-pre-wrap break-words'>
                <div className='w-64'>{answerText(application.answers[question.id])}</div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}
