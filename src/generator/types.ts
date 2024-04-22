import { DbDefinition, Enum, Schema, SchemaDataType, Document } from '../types';
import { assertUnreachable } from '../util';

export function generateTypes(sdl: DbDefinition): string {
  const enums = Object.entries(sdl.enums).map(([name, data]) => generateEnumType(name, data));
  const documents = Object.entries(sdl.documents).map(([name, data]) =>
    generateDocumentType(getDocumentTypeName(name), data)
  );
  const schemas = Object.entries(sdl.schemas).map(([name, data]) => generateSchemaType(getSchemaTypeName(name), data));

  return [`import { Types, Document } from 'mongoose';`, ...enums, ...documents, ...schemas].join('\n\n');
}

function generateEnumType(name: string, data: Enum) {
  const enumValues = data.values.map((value) => `  ${value} = '${value}',`).join('\n');
  return `export enum ${name} {\n${enumValues}\n}`;
}

function generateSchemaType(name: string, data: Schema) {
  const defaultFields = ['  id: string;', '  createdAt: Date;', '  updatedAt: Date;'].join('\n');
  const customFields = Object.entries(data)
    .map(([name, data]) => `  ${name}: ${getTypeName(data.dataType)}${data.isRequired ? '' : ' | null | undefined'};`)
    .join('\n');

  return `export interface ${name} extends Document {\n${defaultFields}\n${customFields}\n}`;
}

function generateDocumentType(name: string, document: Document) {
  return generateSchemaType(name, document.schema);
}

function getTypeName(field: SchemaDataType): string {
  switch (field.type) {
    case 'String':
      return 'string';
    case 'Boolean':
      return 'boolean';
    case 'Number':
      return 'number';
    case 'Enum':
      return field.refEnum;
    case 'Schema':
      return getSchemaTypeName(field.refSchema);
    case 'ObjectId':
      return 'Types.ObjectId';
    case 'Array': {
      const elementType = getTypeName(field.elementType);
      return field.elementRequired ? `${elementType}[]` : `(${elementType} | null)[]`;
    }
    default:
      assertUnreachable(field);
  }
}

export function getSchemaTypeName(name: string) {
  return `${name}SchemaDocument`;
}

function getDocumentTypeName(name: string) {
  return `${name}Document`;
}
