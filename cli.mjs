#!/usr/bin/env node
import { parseAndGenerate, parseCodegenConfig } from './dist/index.js';
import { promises } from 'fs';

const args = process.argv.slice(2);
if (args[0] !== '--configFile' || !args[1]) {
  throw new Error(`Expected '--configFile' argument`);
}

const config = await parseCodegenConfig(args[1]);
const output = await parseAndGenerate(config);

await promises.writeFile(config.outputFile, output);
