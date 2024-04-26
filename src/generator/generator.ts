import { generateMongoose } from './mongoose';
import { generateTypes } from './types';
import { CodegenConfig, DbDefinition } from '../types';

export function generate(sdl: DbDefinition, config: CodegenConfig): string {
  const types = generateTypes(sdl, config);
  const mongoose = generateMongoose(sdl);

  return `${types}\n\n${mongoose}`;
}
