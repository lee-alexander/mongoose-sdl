import { parseDbDefinitionFile } from './parser/parser';
import { generate } from './generator/generator';
import { CodegenConfig, CodegenConfigSchema } from './types';
import { promises as fs } from 'fs';

export async function parseCodegenConfig(configFile: string): Promise<CodegenConfig> {
  const configData = await fs.readFile(configFile);
  return CodegenConfigSchema.parse(JSON.parse(configData.toString()));
}

export async function parseAndGenerate(config: CodegenConfig) {
  const sdl = await parseDbDefinitionFile(config.inputFile);
  return generate(sdl, config);
}
