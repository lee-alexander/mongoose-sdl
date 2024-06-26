import { DbDefinition, Enum, Schema, SchemaDataType, Model, CodegenConfig, SchemaField } from '../types';
import { assertUnreachable, groupItemsBy } from '../util';

export function generateTypes(sdl: DbDefinition, config: CodegenConfig): string {
  const enums = Object.entries(sdl.enums).map(([name, data]) => generateEnumType(name, data));
  const models = Object.entries(sdl.models).map(([name, data]) => generateModelType(getModelTypeName(name), data));
  const schemas = Object.entries(sdl.schemas).map(([name, data]) =>
    generateSchemaType(getSchemaTypeName(name), data, false)
  );

  const missingExternals = sdl.externals.filter((external) => !config.externalImportPaths?.[external]);
  if (missingExternals.length > 0) {
    throw new Error(`Missing externals in input config: ${missingExternals.join(',')}`);
  }

  const externalImports = groupItemsBy(
    Object.entries(config.externalImportPaths ?? {}),
    ([, path]) => path,
    ([type]) => type
  );

  return [
    [
      `import { Types, Document, Schema, model } from 'mongoose';`,
      ...Object.entries(externalImports).map(([path, types]) => `import { ${types.join(', ')} } from '${path}';`),
    ].join('\n'),
    ...enums,
    ...models,
    ...schemas,
  ].join('\n\n');
}

function generateEnumType(name: string, data: Enum) {
  const enumValues = data.values.map((value) => `${value} = '${value}',`).join('\n');
  return `export enum ${name} {\n${enumValues}\n}`;
}

function generateSchemaType(name: string, data: Schema, includeTimestamps: boolean) {
  const defaultFields = ['id: string;']
    .concat(includeTimestamps ? ['createdAt: Date;', 'updatedAt: Date;'] : [])
    .join('\n');
  const customFields = Object.entries(data)
    .map(([name, data]) => `${data.isImmutable ? 'readonly ' : ''}${name}: ${getTypeNameWithNullability(data)};`)
    .join('\n');

  return `export interface ${name} extends Document {\n${defaultFields}\n${customFields}\n}`;
}

function generateModelType(name: string, model: Model) {
  return generateSchemaType(name, model.schema, true);
}

export function getTypeNameWithNullability(field: SchemaField) {
  return `${getTypeName(field.dataType)}${field.isRequired ? '' : ' | null | undefined'}`;
}

export function getTypeName(field: SchemaDataType): string {
  switch (field.type) {
    case 'String':
      return 'string';
    case 'Boolean':
      return 'boolean';
    case 'Number':
      return 'number';
    case 'Date':
      return 'Date';
    case 'Enum':
      return field.refEnum;
    case 'Schema':
      return getSchemaTypeName(field.refSchema);
    case 'ObjectId':
      return 'Types.ObjectId';
    case 'External':
      return field.refType;
    case 'Array': {
      const elementType = getTypeName(field.elementType);
      return field.elementRequired ? `${elementType}[]` : `(${elementType} | null)[]`;
    }
    case 'Map': {
      const elementType = getTypeName(field.elementType);
      return `Map<string, ${elementType}${field.elementRequired ? '' : ' | null'}>`;
    }
    default:
      assertUnreachable(field);
  }
}

export function getSchemaTypeName(name: string) {
  return `${name}SchemaDocument`;
}

export function getModelTypeName(name: string) {
  return `${name}Document`;
}
