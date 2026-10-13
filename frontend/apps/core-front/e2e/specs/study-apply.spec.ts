import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ── 세션 주입 헬퍼 ──────────────────────────────────────────────────────────

async function seedSession(
  page: Page,
  options: {
    authenticated?: boolean;
    discordLinked?: boolean;
    appliedStudyIds?: string[];
  } = {},
) {
  const { authenticated = true, discordLinked = true, appliedStudyIds = [] } = options;

  await page.addInitScript(
    ({ auth, discord, applied }) => {
      if (auth) {
        localStorage.setItem(
          'sc_user',
          JSON.stringify({
            id: 1,
            email: 'test@test.com',
            nickname: '테스트크루',
            picture: null,
            role: 'MEMBER',
          }),
        );
      } else {
        localStorage.removeItem('sc_user');
      }

      if (discord) {
        localStorage.setItem('sc_discord', JSON.stringify({ linked: true, username: 'test#0001' }));
        localStorage.setItem('sc_discord_nickname', JSON.stringify('테스트크루'));
      } else {
        localStorage.removeItem('sc_discord');
        localStorage.removeItem('sc_discord_nickname');
      }

      if (applied.length > 0) {
        localStorage.setItem(
          'sc_applications',
          JSON.stringify(
            applied.map((studyId: string) => ({
              studyId,
              appliedAt: new Date().toISOString().slice(0, 10),
              status: 'pending',
              region: 'KR',
            })),
          ),
        );
      } else {
        localStorage.removeItem('sc_applications');
      }
    },
    { auth: authenticated, discord: discordLinked, applied: appliedStudyIds },
  );
}

// ── E2E 스터디 신청 시나리오 ──────────────────────────────────────────────────

test.describe('크루 스터디 신청 E2E 플로우 (PRD: crew-submit-application)', () => {
  const STUDY_ID = 3;
  const STUDY_PATH = `/ko/studies/${STUDY_ID}`;

  // ── [시나리오 1] 비로그인 유저 진입 흐름 ──────────────────────────────────────
  test('비로그인 사용자가 신청하기 클릭 시 로그인 페이지로 리다이렉트된다', async ({ page }) => {
    await seedSession(page, { authenticated: false });
    await page.goto(STUDY_PATH);

    const applyBtn = page.getByRole('button', { name: /신청하기|Apply/i }).first();
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    await expect(page).toHaveURL(new RegExp(`/ko/login\\?next=%2Fko%2Fstudies%2F${STUDY_ID}`));
  });

  // ── [시나리오 2] 디스코드 미연동 게이트 흐름 ─────────────────────────────────
  test('로그인은 되었으나 디스코드 미연동 시 연동 게이트 모달이 뜨고, 취소 시 모달이 닫힌다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: false });
    await page.goto(STUDY_PATH);

    const applyBtn = page.getByRole('button', { name: /신청하기|Apply/i }).first();
    await applyBtn.click();

    // 디스코드 연동 모달 오픈 확인
    const discordModal = page.getByRole('dialog');
    await expect(discordModal).toBeVisible();
    await expect(discordModal.getByRole('heading', { name: /디스코드 연동/i })).toBeVisible();
    await expect(discordModal.getByText(/스터디 신청 전 디스코드 연동은 필수입니다/i)).toBeVisible();

    // 취소 클릭 시 다이얼로그 닫힘
    await discordModal.getByRole('button', { name: /취소|Cancel/i }).click();
    await expect(discordModal).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(STUDY_PATH));
  });

  test('디스코드 연동 게이트에서 "디스코드 연동하기"를 완료하면 신청 폼이 열린다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: false });
    await page.goto(STUDY_PATH);

    await page
      .getByRole('button', { name: /신청하기|Apply/i })
      .first()
      .click();
    const discordModal = page.getByRole('dialog');
    await expect(discordModal).toBeVisible();

    // 디스코드 연동하기 버튼 클릭 (모의 연동 완료)
    const linkBtn = discordModal.getByRole('button', { name: /디스코드 연동하기/i });
    await linkBtn.click();

    // 연동 후 신청 폼 다이얼로그로 자동 전환
    const formModal = page.getByRole('dialog');
    await expect(formModal).toBeVisible();
    await expect(formModal.getByRole('heading', { name: /스터디 신청/i })).toBeVisible();
  });

  // ── [시나리오 3] 신청 폼 렌더링 및 UI 확인 ────────────────────────────────────
  test('신청 폼에 기본 문항(별명, 요일, 일정) 및 추가 질문이 정상 렌더링된다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: true });
    await page.goto(STUDY_PATH);

    await page
      .getByRole('button', { name: /신청하기|Apply/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 기본 문항 확인
    await expect(dialog.getByLabel(/디스코드 서버 별명/i)).toBeVisible();
    await expect(dialog.getByText(/참여 가능한 요일/i)).toBeVisible();

    // 추가 문항 (DEMO_APPLICATION_FORM) 확인
    await expect(dialog.getByText(/지원 사유/i)).toBeVisible();
    await expect(dialog.getByText(/하고 싶은 말/i)).toBeVisible();
    await expect(dialog.getByText(/참여 가능 시간을 모두 선택하세요/i)).toBeVisible();
    await expect(dialog.getByText(/희망 난이도를 선택하세요/i)).toBeVisible();

    // 마크다운 안내문 렌더링 확인
    await expect(dialog.getByText(/자유롭게/i)).toBeVisible();
  });

  // ── [시나리오 4] 유효성 검증 실패 (Validation Failure) ───────────────────────
  test('필수 요일 미선택 시 인라인 에러가 노출되고 제출되지 않는다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: true });
    await page.goto(STUDY_PATH);

    await page
      .getByRole('button', { name: /신청하기|Apply/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 요일을 선택하지 않고 신청 클릭
    await dialog.getByRole('button', { name: /^신청$|^Apply$/i }).click();

    // 에러 알림 노출 확인
    const alerts = dialog.getByRole('alert');
    await expect(alerts.first()).toBeVisible();

    // 다이얼로그 유지 확인
    await expect(dialog).toBeVisible();
  });

  // ── [시나리오 5] 객관식 "기타" (allowOther) 유효성 검증 ──────────────────────
  test('객관식 문항에서 기타 선택 시 텍스트 미입력 시 에러가 노출된다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: true });
    await page.goto(STUDY_PATH);

    await page
      .getByRole('button', { name: /신청하기|Apply/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 1. 참여 가능한 요일 선택
    await dialog.getByRole('checkbox', { name: /월요일/i }).check();

    // 2. 고정 일정 동의 (있는 경우)
    const scheduleAgree = dialog.getByRole('checkbox', { name: /참여 가능합니다/i });
    if (await scheduleAgree.isVisible()) {
      await scheduleAgree.check();
    }

    // 3. 지원 사유(필수 text) 입력
    const reasonInput = dialog.getByRole('textbox', { name: /지원 사유/i });
    await reasonInput.fill('열심히 스터디에 참여하겠습니다.');

    // 4. 참여 가능 시간 문항에서 "기타" 체크박스 선택
    const otherCheckbox = dialog.getByRole('checkbox', { name: /기타/i });
    await otherCheckbox.check();

    // 5. 기타 텍스트 필드를 비운 채 제출 시도
    await dialog.getByRole('button', { name: /^신청$|^Apply$/i }).click();

    // 기타 입력 필수 에러 메시지 확인
    await expect(dialog.getByText(/기타 내용을 입력해 주세요/i)).toBeVisible();
  });

  // ── [시나리오 6] 정상 제출 및 완료 팝업, 딥링크 확인 ─────────────────────────
  test('모든 필드를 유효하게 작성 후 제출하면 신청 완료 모달이 뜨고 내 스터디 이동 링크를 제공한다', async ({
    page,
  }) => {
    await seedSession(page, { authenticated: true, discordLinked: true });
    await page.goto(STUDY_PATH);

    await page
      .getByRole('button', { name: /신청하기|Apply/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 1. 디스코드 별명 입력
    const nickInput = dialog.getByLabel(/디스코드 서버 별명/i);
    await nickInput.fill('테스트크루');

    // 2. 참여 가능한 요일 체크
    await dialog.getByRole('checkbox', { name: /월요일/i }).check();

    // 3. 고정 일정 동의 (있는 경우)
    const scheduleAgree = dialog.getByRole('checkbox', { name: /참여 가능합니다/i });
    if (await scheduleAgree.isVisible()) {
      await scheduleAgree.check();
    }

    // 4. 추가 질문 — 지원 사유 (단문 텍스트)
    const reasonInput = dialog.getByRole('textbox', { name: /지원 사유/i });
    await reasonInput.fill('해당 분야의 기초를 단단히 다지고 싶어 지원합니다.');

    // 5. 추가 질문 — 참여 가능 시간 (체크박스)
    await dialog.getByRole('checkbox', { name: /주말 오전/i }).check();

    // 6. 추가 질문 — 희망 난이도 (라디오)
    await dialog.getByRole('radio', { name: /중급/i }).check();

    // 7. 추가 질문 — 드롭다운 선택 문항
    const selectQuestions = dialog.getByRole('combobox');
    if ((await selectQuestions.count()) > 0) {
      await selectQuestions.first().selectOption({ index: 1 });
    }

    // 신청 제출 클릭
    await dialog.getByRole('button', { name: /^신청$|^Apply$/i }).click();

    // 완료 다이얼로그 오픈 확인 (PRD: "스터디 신청 완료")
    const completeDialog = page.getByRole('dialog');
    await expect(completeDialog).toBeVisible();
    await expect(completeDialog.getByRole('heading', { name: /스터디 신청 완료/i })).toBeVisible();
    await expect(completeDialog.getByText(/내 스터디로 이동할까요/i)).toBeVisible();

    // "내 스터디 보러 가기" 버튼 확인
    const myStudiesBtn = completeDialog.getByRole('button', { name: /내 스터디 보러 가기/i });
    await expect(myStudiesBtn).toBeVisible();

    // 닫기 버튼 클릭 시 완료 다이얼로그 닫힘
    await completeDialog.getByRole('button', { name: /닫기|Close/i }).first().click();
    await expect(completeDialog).not.toBeVisible();

    // 신청 후 상세 화면의 버튼이 '신청 완료'로 변경되었는지 확인
    const appliedBtn = page.getByRole('button', { name: /신청 완료/i });
    await expect(appliedBtn).toBeVisible();
    await expect(appliedBtn).toBeDisabled();
  });

  // ── [시나리오 7] 기신청자 접근 제어 ──────────────────────────────────────────
  test('이미 신청한 스터디 페이지에 접속하면 "신청 완료" 버튼이 비활성화 상태로 표시된다', async ({ page }) => {
    // 3번 스터디(id: '3')를 기신청 상태로 주입
    await seedSession(page, {
      authenticated: true,
      discordLinked: true,
      appliedStudyIds: ['3'],
    });

    await page.goto(STUDY_PATH);

    const doneBtn = page.getByRole('button', { name: /신청 완료/i });
    await expect(doneBtn).toBeVisible();
    await expect(doneBtn).toBeDisabled();
  });

  // ── [시나리오 8] 진행 중 / 마감된 스터디 ─────────────────────────────────────
  test('마감되거나 진행 중인 스터디(study_id=19)는 신청하기 버튼이 노출되지 않는다', async ({ page }) => {
    await seedSession(page, { authenticated: true, discordLinked: true });
    await page.goto('/ko/studies/19');

    await expect(page.getByRole('button', { name: /신청하기|Apply/i })).not.toBeVisible();
  });
});
