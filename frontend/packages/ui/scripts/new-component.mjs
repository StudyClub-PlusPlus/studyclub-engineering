#!/usr/bin/env node
/**
 * 새 ui 부품의 뼈대를 만든다 — 부품 · 스토리 · index export 를 한 번에.
 *
 *   pnpm --filter @studyclub/ui new-component Rating
 *
 * 1. src/{Name}.tsx          부품 본체 (design-system.md §9 를 가리키는 주석, cx, Props 타입)
 * 2. src/{Name}.stories.tsx  Storybook — meta + Default 스토리 (stories-guide.md 형식)
 * 3. src/index.ts            export 두 줄을 맨 끝에 붙인다
 * 4. playground /components   카탈로그(apps/playground/src/app/(site)/components/page.tsx)에 import 와 칸 하나
 *
 * 만든 뒤에는 design-system.md §9 에 이 부품의 스펙을 추가하고, 본체 · 스토리 · 카탈로그 칸을 채운다.
 * 스토리가 없거나 카탈로그에 안 보이는 부품은 scripts/check-component-drift.mjs 가 막는다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(import.meta.dirname, '../src');
const CATALOG = path.resolve(import.meta.dirname, '../../../apps/playground/src/app/(site)/components/page.tsx');
const CATALOG_MARKER = '{/* new-component:';
const name = process.argv[2];

if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
  console.error('사용법: pnpm --filter @studyclub/ui new-component {Name}   (PascalCase, 예: Rating)');
  process.exit(1);
}

const component = path.join(SRC, `${name}.tsx`);
const stories = path.join(SRC, `${name}.stories.tsx`);
const index = path.join(SRC, 'index.ts');
const before = readFileSync(index, 'utf8');
const program = ts.createProgram([index], {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
});
const checker = program.getTypeChecker();
const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(index));
const exportedNames = new Set(checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.name));
if (exportedNames.has(name) || exportedNames.has(`${name}Props`)) {
  console.error(`이미 export 중인 이름이다: ${name} 또는 ${name}Props`);
  process.exit(1);
}
const catalog = readFileSync(CATALOG, 'utf8');
if (!catalog.includes(CATALOG_MARKER) || !catalog.includes("} from '@studyclub/ui';")) {
  console.error(
    `카탈로그에 넣을 자리를 못 찾았다: ${CATALOG} 에 '${CATALOG_MARKER} …' 줄과 @studyclub/ui import 가 있어야 한다`,
  );
  process.exit(1);
}
for (const f of [component, stories]) {
  if (existsSync(f)) {
    console.error(`이미 있다: ${path.relative(process.cwd(), f)}`);
    process.exit(1);
  }
}

writeFileSync(
  component,
  `'use client';

import type { HTMLAttributes } from 'react';

import { cx } from './cx';

/** design-system.md §9-? — TODO: 스펙 절 번호. 색 · 간격 · 라운딩은 semantic 토큰만 쓴다. */
export type ${name}Props = HTMLAttributes<HTMLDivElement>;

export function ${name}({ className, ...rest }: ${name}Props) {
  return <div {...rest} className={cx(className)} />;
}
`,
);

writeFileSync(
  stories,
  `import type { Meta, StoryObj } from '@storybook/react-vite';

import { ${name} } from './${name}';

const meta = {
  title: 'UI/${name}',
  component: ${name},
  tags: ['autodocs'],
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
`,
);

writeFileSync(
  index,
  `${before.trimEnd()}\n\nexport { ${name} } from './${name}';\nexport type { ${name}Props } from './${name}';\n`,
);

// 카탈로그 — import 목록 끝과 표시 줄 바로 위에 넣는다
const markerLine = catalog.lastIndexOf('\n', catalog.indexOf(CATALOG_MARKER)) + 1;
// 표시 줄과 같은 들여쓰기로 넣는다 — 카탈로그 짜임새가 바뀌어도 칸이 어긋나지 않게
const indent = catalog.slice(markerLine, catalog.indexOf(CATALOG_MARKER));
const withCase = `${catalog.slice(0, markerLine)}${indent}<Case title='${name}' note='TODO: 언제 쓰는지 한 줄. 상태별(기본 · 비활성 · 오류 …)로 늘어놓는다.'>
${indent}  <${name} />
${indent}</Case>

${catalog.slice(markerLine)}`;
writeFileSync(CATALOG, withCase.replace("} from '@studyclub/ui';", `  ${name},\n} from '@studyclub/ui';`));

console.log(`만들었다:
  src/${name}.tsx
  src/${name}.stories.tsx
  src/index.ts  (export 추가)
  playground /components 카탈로그 (import · 칸 추가)

다음:
  1. packages/design/docs/design-system.md §9 에 ${name} 스펙을 추가한다 (9-8 표 한 줄 또는 새 절)
  2. 본체의 TODO 를 채우고, 스토리에 상태별(기본 · 비활성 · 오류 …) 스토리를 더한다
  3. 카탈로그 칸의 note 와 실물을 채운다 — pnpm run dev:playground 후 http://localhost:4702/components`);
