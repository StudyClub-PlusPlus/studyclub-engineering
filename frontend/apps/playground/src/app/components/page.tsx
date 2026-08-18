"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  CapacityBar,
  Card,
  Checkbox,
  EmptyState,
  FilterChip,
  Input,
  Modal,
  Select,
  StatCard,
  Textarea,
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

  return (
    <div className="space-y-10">
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

      <Case title="Field — Input · Select · Textarea" note="label · helper · error · required 조합.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="스터디 이름" placeholder="예: 시스템 디자인 스터디" required />
          <Input label="이메일" helper="가입에 쓴 주소를 적어주세요" defaultValue="not-an-email" error="이메일 형식이 아닙니다" />
          <Select label="형식" defaultValue="online">
            <option value="online">온라인</option>
            <option value="offline">오프라인</option>
            <option value="hybrid">하이브리드</option>
          </Select>
          <Textarea label="소개" helper="200자 이내" rows={3} placeholder="어떤 스터디인지 적어주세요" />
        </div>
      </Case>

      <Case title="Checkbox">
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
