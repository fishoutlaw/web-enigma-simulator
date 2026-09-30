// 외부 패키지 없이 ES 모듈을 두 개의 일반 스크립트로 묶습니다.
// 일반 defer 스크립트는 로컬 index.html에서도 모듈 서버 없이 실행됩니다.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = 'core/enigma.js';
const site = ['experiment/state.js', 'ui/geometry.js', 'ui/diagram.js', 'ui/app.js'];
const ids = new Map([engine, ...site].map((name, index) =>
  [resolve(root, 'src', name), `module${index}`]));

// 두 파일이 동일한 모듈 변환 함수를 공유합니다. 엔진 구현은 한 번만 출력합니다.
async function compileModule(name) {
  const path = resolve(root, 'src', name);
  let source = await readFile(path, 'utf8');
  const exports = [...source.matchAll(/export (?:class|function|const) (\w+)/g)].map(match => match[1]);
  source = source.replace(/import \{([^}]+)\} from ['"]([^'"]+)['"];?/g, (_, bindings, relative) => {
    const id = ids.get(resolve(dirname(path), relative));
    if (!id) throw new Error(`Unknown module ${relative}`);
    return `const {${bindings.replace(/\s+as\s+/g, ':')}} = ${id};`;
  }).replace(/\bexport (?=class|function|const)/g, '');
  return `const ${ids.get(path)} = (() => {\n${source}\nreturn {${exports.join(', ')}};\n})();\n`;
}
const wrap = body => `(() => {\n"use strict";\n${body}})();\n`;
const coreId = ids.get(resolve(root, 'src', engine));
const engineBundle = '/* Enigma Lab — Py-Enigma-derived engine; MIT notice in licenses/. */\n' +
  wrap(await compileModule(engine) + `globalThis.EnigmaEngine = Object.freeze(${coreId});\n`);
const siteBundle = '/* Enigma Lab — 화면, 입력 대기열, 기록 및 SVG 재생. 연산은 enigma.js에 위임합니다. */\n' +
  wrap(`const ${coreId} = globalThis.EnigmaEngine;\n` +
    `if (!${coreId}) throw new Error('enigma.js를 app.js보다 먼저 불러와야 합니다.');\n` +
    (await Promise.all(site.map(compileModule))).join(''));

await mkdir(resolve(root, 'dist/licenses'), {recursive: true});
await writeFile(resolve(root, 'dist/enigma.js'), engineBundle);
await writeFile(resolve(root, 'dist/app.js'), siteBundle);
for (const name of ['index.html', 'style.css']) {
  await copyFile(resolve(root, 'src/ui', name), resolve(root, 'dist', name));
}
for (const [from, to] of [
  ['LICENSE', 'LICENSE'],
  ['licenses/Py-Enigma-MIT.txt', 'licenses/Py-Enigma-MIT.txt'],
  ['docs/DISTRIBUTION.md', 'README.md'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
]) await copyFile(resolve(root, from), resolve(root, 'dist', to));
console.log('Built dist/index.html + enigma.js + app.js + style.css (no runtime dependencies).');
