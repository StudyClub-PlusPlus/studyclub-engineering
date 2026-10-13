"use client";

import { useState } from "react";

import {
  AutoTextarea,
  Avatar,
  Badge,
  Button,
  CapacityBar,
  Card,
  Checkbox,
  DiscordGlyph,
  EmptyState,
  FilterChip,
  HotBadge,
  Input,
  Modal,
  Pagination,
  Segmented,
  Select,
  StatCard,
  Tabs,
  Textarea,
  Toaster,
  toast,
} from "@studyclub/ui";
import type { BadgeTone, ButtonSize, ButtonVariant } from "@studyclub/ui";
import { Search, Users } from "lucide-react";

const VARIANTS: ButtonVariant[] = ["primary", "tonal", "secondary", "ghost", "destructive"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const STATUS_TONES: BadgeTone[] = ["recruiting", "closingsoon", "inprogress", "closed", "ended"];
const ROLE_TONES: BadgeTone[] = ["captain", "navigator", "member"];

/** 카탈로그 한 칸. 제목 + 짧은 설명 + 실물. */
function Case({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--color-border)] pt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ComponentsCatalog() {
  const [modalOpen, setModalOpen] = useState(false);
  const [chip, setChip] = useState("all");
  const [checked, setChecked] = useState(true);
  const [autoText, setAutoText] = useState("");
  const [singleLineText, setSingleLineText] = useState("");
  const [activeTab, setActiveTab] = useState("studies");
  const [segVal, setSegVal] = useState("all");
  const [segView, setSegView] = useState("grid");
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-10">
      <Toaster />
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">컴포넌트 카탈로그</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-fg-muted)]">
          <code>@studyclub/ui</code> 의 프리미티브를 상태별로 늘어놓았습니다.{" "}
          <strong>여기 보이는 것이 실제 서비스에 나가는 컴포넌트</strong>입니다 — 정적 목업이 아니라 코드를 그대로 렌더합니다.
        </p>
      </header>

      <Case title="Button" note="variant 5종 × size 3종. disabled 상태도 함께.">
        <div className="space-y-3">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-2">
              <span className="w-8 text-xs font-semibold text-[var(--color-fg-muted)]">{size}</span>
              {VARIANTS.map((v) => (
                <Button key={v} variant={v} size={size}>
                  {v}
                </Button>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="w-8 text-xs font-semibold text-[var(--color-fg-muted)]">off</span>
            {VARIANTS.map((v) => (
              <Button key={v} variant={v} disabled>
                {v}
              </Button>
            ))}
          </div>
        </div>
      </Case>

      <Case title="Badge" note="스터디 상태 5종 · 역할 3종. dot 을 켜면 앞에 점이 붙는다.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TONES.map((t) => (
              <Badge key={t} tone={t} dot>
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLE_TONES.map((t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </Case>

      <Case title="HotBadge · DiscordGlyph" note="마감 임박 뱃지와 디스코드 공식 아이콘. 배너·버튼 등에 사용한다.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-card bg-[var(--color-surface-2)] p-3">
            <span className="text-xs font-semibold text-[var(--color-fg-muted)]">HotBadge:</span>
            <HotBadge />
          </div>
          <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] p-3">
            <span className="text-xs font-semibold text-[var(--color-fg-muted)]">DiscordGlyph:</span>
            <DiscordGlyph size={16} />
            <DiscordGlyph size={24} />
          </div>
        </div>
      </Case>

      <Case title="Card" note="padding none · md · lg. interactive 를 켜면 hover 반응이 붙는다.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card padding="none" className="p-4">
            <p className="text-sm font-semibold">padding none</p>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">여백을 직접 준다.</p>
          </Card>
          <Card padding="md">
            <p className="text-sm font-semibold">padding md</p>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">기본값.</p>
          </Card>
          <Card padding="lg" interactive>
            <p className="text-sm font-semibold">interactive</p>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">마우스를 올려보세요.</p>
          </Card>
        </div>
      </Case>

      <Case
        title="Input"
        note="텍스트 입력 필드. sm(h-8) · md(h-10) · lg(h-12) 크기와 required · helper · error 상태 조합."
      >
        <div className="space-y-6 max-w-2xl">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">크기 3종 (sm · md · lg)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="sm (h-8)" size="sm" placeholder="Small (32px)" />
              <Input label="md / 기본 (h-10)" size="md" placeholder="Medium (40px)" />
              <Input label="lg (h-12)" size="lg" placeholder="Large (48px)" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">상태 및 옵션 조합</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="스터디 이름" placeholder="예: 시스템 디자인 스터디" required />
              <Input label="이메일" helper="가입에 쓴 주소를 적어주세요" defaultValue="test@test.com" />
              <Input label="닉네임" error="이미 사용 중인 닉네임입니다" defaultValue="중복닉네임" />
              <Input label="비활성" disabled defaultValue="수정할 수 없습니다" />
            </div>
          </div>
        </div>
      </Case>

      <Case
        title="Select"
        note="드롭다운 선택 필드. sm(h-8) · md(h-10) · lg(h-12) 크기와 helper · error 상태 조합."
      >
        <div className="space-y-6 max-w-2xl">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">크기 3종 (sm · md · lg)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="sm (h-8)" size="sm" defaultValue="online">
                <option value="online">온라인 (sm / 32px)</option>
                <option value="offline">오프라인</option>
              </Select>
              <Select label="md / 기본 (h-10)" size="md" defaultValue="online">
                <option value="online">온라인 (md / 40px)</option>
                <option value="offline">오프라인</option>
              </Select>
              <Select label="lg (h-12)" size="lg" defaultValue="online">
                <option value="lg">온라인 (lg / 48px)</option>
                <option value="offline">오프라인</option>
              </Select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">상태 및 옵션 조합</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="진행 방식" helper="주요 모임 방식을 선택하세요" defaultValue="hybrid">
                <option value="hybrid">하이브리드</option>
                <option value="online">온라인</option>
                <option value="offline">오프라인</option>
              </Select>
              <Select label="지역" error="지역을 선택해 주세요" defaultValue="">
                <option value="" disabled>지역 선택</option>
                <option value="gangnam">강남</option>
                <option value="pangyo">판교</option>
              </Select>
            </div>
          </div>
        </div>
      </Case>

      <Case
        title="Textarea"
        note="여러 줄 텍스트 입력 필드. rows 행 수 지정 및 label · helper · error 상태 조합."
      >
        <div className="space-y-4 max-w-xl">
          <Textarea label="소개" helper="200자 이내로 입력해 주세요." rows={3} placeholder="어떤 스터디인지 적어주세요" />
          <Textarea label="활동 목표" error="목표를 최소 10자 이상 작성해 주세요." rows={2} defaultValue="짧은 목표" />
        </div>
      </Case>

      <Case
        title="AutoTextarea"
        note="내용 길이에 맞춰 높이가 자동 조절되는 텍스트 영역. 멀티라인 확장과 한 줄 인라인(singleLine) 형태를 모두 지원한다."
      >
        <div className="space-y-6 max-w-xl">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">멀티라인 자동 높이 확장</p>
            <AutoTextarea
              label="자동 높이 조절 텍스트"
              placeholder="텍스트를 여러 줄 입력해보세요. 내용에 따라 높이가 자동으로 늘어납니다."
              value={autoText}
              onChange={setAutoText}
              minRows={2}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">인라인 한 줄 입력 (singleLine · 엔터 방지)</p>
            <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <span className="shrink-0 text-sm font-medium text-neutral-800">스터디 규칙:</span>
              <div className="flex-1 min-w-0">
                <AutoTextarea
                  label="인라인 스터디 규칙 입력"
                  placeholder="제목이나 규칙처럼 한 줄 인라인으로 늘어나며, 엔터는 공백으로 치환됩니다."
                  value={singleLineText}
                  onChange={setSingleLineText}
                  singleLine
                  className="py-1 px-2.5 text-sm"
                />
              </div>
              <Button size="sm">저장</Button>
            </div>
          </div>
        </div>
      </Case>

      <Case title="Checkbox" note="label 조합. disabled 상태도 함께.">
        <div className="space-y-2">
          <Checkbox label="매주 알림 받기" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <Checkbox label="비활성" disabled />
        </div>
      </Case>

      <Case title="FilterChip" note="선택 상태를 가진 필터 칩. 목록 상단 필터에 쓴다.">
        <div className="flex flex-wrap gap-2">
          {["all", "recruiting", "inprogress", "closed"].map((c) => (
            <FilterChip key={c} selected={chip === c} onClick={() => setChip(c)}>
              {c}
            </FilterChip>
          ))}
        </div>
      </Case>

      <Case title="Avatar" note="size 24 · 32 · 40. 이미지가 없으면 이름 이니셜.">
        <div className="flex items-center gap-3">
          <Avatar name="김연지" size={24} />
          <Avatar name="이가온" size={32} />
          <Avatar name="김리나" size={40} role="captain" />
        </div>
      </Case>

      <Case title="StatCard" note="운영자 콘솔 대시보드용. delta 부호로 ▲▼ 가 갈린다.">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="전체 스터디" value="24" sub="전체 코호트" leadingIcon={<Users size={16} />} />
          <StatCard label="이번 달 신규" value="6" delta={3} deltaSuffix="건" deltaLabel="지난달 대비" />
          <StatCard label="완주율" value="72%" delta={-4} deltaSuffix="%p" deltaLabel="지난 기수 대비" />
        </div>
      </Case>

      <Case title="CapacityBar" note="정원 대비 신청 인원. 80% 이상이면 경고색으로 바뀐다.">
        <div className="max-w-md space-y-4">
          <CapacityBar taken={4} total={20} showLabel />
          <CapacityBar taken={17} total={20} showLabel />
          <CapacityBar taken={20} total={20} showLabel />
        </div>
      </Case>

      <Case title="Tabs · Segmented" note="언더라인형 탭과 세그먼트 컨트롤. 목록 필터링이나 뷰 전환에 쓴다.">
        <div className="space-y-6 max-w-xl">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">Tabs</p>
            <Tabs
              items={[
                { key: "studies", label: "스터디 목록", badge: <Badge tone="recruiting">12</Badge> },
                { key: "schedule", label: "주간 일정" },
                { key: "notices", label: "공지사항" },
              ]}
              activeKey={activeTab}
              onChange={setActiveTab}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg-muted)]">Segmented</p>
            <div className="flex flex-wrap items-center gap-4">
              <Segmented
                size="md"
                options={[
                  { value: "all", label: "전체" },
                  { value: "online", label: "온라인" },
                  { value: "offline", label: "오프라인" },
                ]}
                value={segVal}
                onChange={setSegVal}
              />
              <Segmented
                size="sm"
                shape="pill"
                options={[
                  { value: "grid", label: "격자" },
                  { value: "list", label: "목록" },
                ]}
                value={segView}
                onChange={setSegView}
              />
            </div>
          </div>
        </div>
      </Case>

      <Case
        title="Pagination"
        note="페이지 번호 창. 7페이지를 넘기면 중간에 gap(…)을 두고 윈도우를 계산한다."
      >
        <div className="max-w-md">
          <Pagination page={page} total={12} onChange={setPage} />
        </div>
      </Case>

      <Case title="Toast" note="semantic 토큰 기반 경량 토스트 알림. 버튼을 눌러 확인하세요.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.success("신청이 성공적으로 접수되었습니다.")}
          >
            성공 토스트
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.error("모집 정원이 마감되었습니다.")}
          >
            에러 토스트
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast("기본 안내 알림입니다.")}>
            기본 토스트
          </Button>
        </div>
      </Case>

      <Case title="EmptyState" note="목록이 비었을 때. action 으로 버튼을 넣는다.">
        <EmptyState
          icon={<Search size={24} />}
          title="조건에 맞는 스터디가 없어요"
          description="필터를 줄이거나 다른 키워드로 찾아보세요."
          action={<Button variant="tonal">필터 초기화</Button>}
        />
      </Case>

      <Case title="Modal" note="열어서 확인하세요. ESC · 배경 클릭으로 닫힙니다.">
        <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="스터디 신청"
          description="신청하면 캡틴에게 알림이 갑니다."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setModalOpen(false)}>신청</Button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-fg-muted)]">모달 본문이 들어가는 자리입니다.</p>
        </Modal>
      </Case>
    </div>
  );
}
