#!/usr/bin/env node
import { generate, parseDbDefinitionFile } from './dist/index.js';
import { promises } from 'fs';

const args = process.argv.slice(2);
if (args[0] !== '-input' || !args[1]) {
  throw new Error(`Expected '-input' argument`);
}
if (args[2] !== '-output' || !args[3]) {
  throw new Error(`Expected '-output' argument`);
}

const sdl = await parseDbDefinitionFile(args[1]);
const output = generate(sdl);
await promises.writeFile(args[3], output);
