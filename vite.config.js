import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function readPackageName() {
  const p = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return pkg.name || 'app';
}

export default defineConfig(({ command }) => {
  // En dev: base "/"
  if (command === 'serve') return { base: '/' };

  // En build: base "/<repo>/" para GitHub Pages
  // Se puede sobreescribir con BASE=/mi-repo/ npm run build
  const repo = readPackageName();
  const base = process.env.BASE ?? `/${repo}/`;

    return {
    base,
    build: {
      target: 'es2020'
    }
  };
});
