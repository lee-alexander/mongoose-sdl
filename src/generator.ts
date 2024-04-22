import { generateMongoose } from './generator/mongoose';
import { generateTypes } from './generator/types';
import { DbDefinition } from './types';

export function generate(sdl: DbDefinition): string {
  const types = generateTypes(sdl);
  const mongoose = generateMongoose(sdl);

  return `${types}\n\n${mongoose}`;
}
