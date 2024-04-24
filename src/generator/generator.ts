import { generateMongoose } from './mongoose';
import { generateTypes } from './types';
import { DbDefinition } from '../types';

export function generate(sdl: DbDefinition): string {
  const types = generateTypes(sdl);
  const mongoose = generateMongoose(sdl);

  return `${types}\n\n${mongoose}`;
}
