import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function readPackageName() {
  const p = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return pkg.name || 'app';
}

export default defineConfig(({ command }) => {
  if (command === 'serve') return { base: '/' };

  const repo = readPackageName();
  const base = process.env.BASE ?? `/${repo}/`;

  return {
    base
  };
});
