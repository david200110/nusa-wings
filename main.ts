// Nusa Wings — make.fun entry program (best-flight-game-20261126-0057).
//
// Copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, else /output) and writes
// dossier.json there with buildDossier from vendor/makefun-game.ts.
// Node 22, standard library only. Deterministic: the same repository
// always writes the same bytes, so the grader's two runs agree.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true, dereference: false });
}

mkdirSync(outDir, { recursive: true });
// Clear anything a previous run left behind, so a stale dossier or
// screenshot can never survive into this run's output.
rmSync(join(outDir, 'dossier.json'), { force: true });
copyTree('game');
copyTree('screenshots');
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));
