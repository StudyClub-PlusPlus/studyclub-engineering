import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(tmpdir(), 'user-dormancy-'));
try {
  const output = path.join(temp, 'check.cjs');
  await build({
    entryPoints: [path.join(root, 'src/proto/console/lib/user-dormancy.test.ts')],
    outfile: output,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
  });
  execFileSync(process.execPath, ['--test', output], { stdio: 'inherit' });
} finally {
  await rm(temp, { recursive: true, force: true });
}
