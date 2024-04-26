import { generateMongoose } from './mongoose';
import { generateTypes } from './types';
import { CodegenConfig, DbDefinition } from '../types';

export function generate(sdl: DbDefinition, config: CodegenConfig): string {
  const types = generateTypes(sdl, config);
  const mongoose = generateMongoose(sdl);

  return indent(`${types}\n\n${mongoose}`);
}

function indent(input: string) {
  const lines = input.split('\n').map((i) => i.trim());

  let indentLevel = 0;
  return lines
    .map((line) => {
      if (line.startsWith('}') || line.startsWith(')')) {
        indentLevel -= 1;
      }

      if (indentLevel < 0) {
        throw new Error('Failed to apply indentation to output');
      }
      const indentedLine = '  '.repeat(indentLevel) + line;

      if (line.endsWith('{') || line.endsWith('(')) {
        indentLevel += 1;
      }

      return indentedLine;
    })
    .join('\n');
}
