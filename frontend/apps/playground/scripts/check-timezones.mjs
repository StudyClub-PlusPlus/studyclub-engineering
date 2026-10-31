import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(tmpdir(), 'study-timezones-'));
try {
  const output = path.join(temp, 'check.cjs');
  await build({
    entryPoints: [path.join(root, 'src/proto/core/lib/schedule-timezone.test.ts')],
    outfile: output,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
  });
  execFileSync(process.execPath, [output], { stdio: 'inherit' });
} finally {
  await rm(temp, { recursive: true, force: true });
}
