// One-off dump of the CURRENT hardcoded catalogs, used to generate the
// golden fixtures consumed by model-metadata/resolver.test.ts.
import { writeFileSync } from 'node:fs';
import { OpenCodeZenProvider } from '../src/providers/opencode-zen';
import { OpenCodeGoProvider } from '../src/providers/opencode-go';

const zen = new OpenCodeZenProvider('dump-key');
const go = new OpenCodeGoProvider('dump-key');

writeFileSync(
  new URL('./golden-zen.json', import.meta.url),
  JSON.stringify({ asOf: new Date().toISOString(), models: zen.models }, null, 2) + '\n',
);
writeFileSync(
  new URL('./golden-go.json', import.meta.url),
  JSON.stringify({ asOf: new Date().toISOString(), models: go.models }, null, 2) + '\n',
);
console.log('zen:', zen.models.length, 'go:', go.models.length);
