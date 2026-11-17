import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

for (const name of ['IconButton', 'Select', 'Rating']) {
  test(`generator handles ${name} without overwriting exports`, () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ui-generator-'));
    try {
      const ui = path.join(root, 'frontend/packages/ui');
      const catalog = path.join(root, 'frontend/apps/playground/src/app/(site)/components/page.tsx');
      mkdirSync(path.join(ui, 'scripts'), { recursive: true });
      mkdirSync(path.join(ui, 'src'), { recursive: true });
      mkdirSync(path.dirname(catalog), { recursive: true });
      cpSync(new URL('./new-component.mjs', import.meta.url), path.join(ui, 'scripts/new-component.mjs'));
      symlinkSync(path.resolve(import.meta.dirname, '../node_modules'), path.join(ui, 'node_modules'));
      const exports =
        "export { Button, IconButton } from './Button';\nexport { NativeSelect as Select } from './Field';\n";
      const page = "import { Button } from '@studyclub/ui';\n{/* new-component: insert here */}\n";
      writeFileSync(path.join(ui, 'src/index.ts'), exports);
      writeFileSync(catalog, page);
      const result = spawnSync(process.execPath, [path.join(ui, 'scripts/new-component.mjs'), name], {
        encoding: 'utf8',
      });
      if (name === 'Rating') {
        assert.equal(result.status, 0, result.stderr);
        assert.ok(existsSync(path.join(ui, 'src/Rating.tsx')));
        assert.match(readFileSync(catalog, 'utf8'), /<Rating \/>/);
      } else {
        assert.equal(result.status, 1, result.stdout);
        assert.equal(readFileSync(path.join(ui, 'src/index.ts'), 'utf8'), exports);
        assert.equal(readFileSync(catalog, 'utf8'), page);
        assert.equal(existsSync(path.join(ui, `src/${name}.tsx`)), false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
