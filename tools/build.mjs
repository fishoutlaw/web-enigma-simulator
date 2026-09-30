// Zero-dependency packager for this project's named, acyclic ES modules.
// Node is only a development tool. dist/ uses classic scripts and works on file://.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['core/enigma.js','experiment/state.js','ui/geometry.js','ui/diagram.js','ui/app.js'];
const ids=new Map(files.map((name,i)=>[resolve(root,'src',name),`module${i}`]));
let bundle='/* Enigma Lab Web Edition — Py-Enigma-derived engine, MIT notice in licenses/. */\n(()=>{\n"use strict";\n';
for(const name of files){
  const path=resolve(root,'src',name);let source=await readFile(path,'utf8');
  const exports=[...source.matchAll(/export (?:class|function|const) (\w+)/g)].map(m=>m[1]);
  source=source.replace(/import \{([^}]+)\} from ['"]([^'"]+)['"];?/g,(_,bindings,relative)=>{
    const id=ids.get(resolve(dirname(path),relative));
    if(!id)throw new Error(`Unknown module ${relative}`);
    return `const {${bindings.replace(/\s+as\s+/g,':')}}=${id};`;
  }).replace(/\bexport (?=class|function|const)/g,'');
  bundle+=`const ${ids.get(path)}=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();\n`;
}
bundle+='})();\n';
await mkdir(resolve(root,'dist'),{recursive:true});
await writeFile(resolve(root,'dist/app.js'),bundle);
for(const name of ['index.html','style.css'])await copyFile(resolve(root,'src/ui',name),resolve(root,'dist',name));
await mkdir(resolve(root,'dist/licenses'),{recursive:true});
await copyFile(resolve(root,'licenses/Py-Enigma-MIT.txt'),resolve(root,'dist/licenses/Py-Enigma-MIT.txt'));
await copyFile(resolve(root,'docs/DISTRIBUTION.md'),resolve(root,'dist/README.md'));
await copyFile(resolve(root,'THIRD_PARTY_NOTICES.md'),resolve(root,'dist/THIRD_PARTY_NOTICES.md'));
console.log('Built dist/index.html + app.js + style.css (no runtime dependencies).');
