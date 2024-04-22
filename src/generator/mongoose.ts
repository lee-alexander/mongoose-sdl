import { DbDefinition, Schema, SchemaField, SchemaDataTypeWithoutArray, Document } from '../types';
import { assertUnreachable, notNullOrUndefined } from '../util';
import { getSchemaTypeName } from './types';

export function generateMongoose(sdl: DbDefinition): string {
  // TODO - DAG ordering for schemas by dependencies
  // TODO handle recursive schemas

  const schemas = Object.entries(sdl.schemas).map(([name, data]) =>
    generateSchema(getSchemaName(name), getSchemaTypeName(name), data)
  );
  const documents = Object.entries(sdl.documents).map(([name, data]) => generateDocument(name, data));

  return [`import { Schema, model } from 'mongoose';`, ...schemas, ...documents].join('\n');
}

function generateDocument(name: string, document: Document) {
  const schema = generateSchema(getSchemaName(name), getDocumentName(name), document.schema);
  const model = `export const ${name}Model = model<${getDocumentName(name)}>('${name}', ${getSchemaName(name)});`;
  return `${schema}\n\n${model}\n`;
}

function generateSchema(name: string, typeName: string, data: Schema) {
  return `const ${name} = new Schema<${typeName}>(
  {\n${Object.entries(data)
    .map(([name, data]) => `    ${name}: ${getSchemaFieldDefinition(data)},`)
    .join('\n')}
  },
  { timestamps: true }
)`;
}

function getSchemaFieldDefinition(field: SchemaField): string {
  const baseDefinition = [
    field.isRequired ? 'required: true' : null,
    field.isIndex ? 'index: true' : null,
    field.isUnique ? 'unique: true' : null,
  ];

  let customDefinition: string;
  if (field.dataType.type === 'Array') {
    const childType = getSchemaFieldDataDefinition(field.dataType.elementType);
    const childFields = [childType, field.dataType.elementRequired ? 'required: true' : ''].join(', ');
    customDefinition = `type: [{ ${childFields} }]`;
  } else {
    customDefinition = getSchemaFieldDataDefinition(field.dataType);
  }

  return `{ ${[...baseDefinition, customDefinition].filter(notNullOrUndefined).join(', ')} }`;
}

function getSchemaFieldDataDefinition(data: SchemaDataTypeWithoutArray): string {
  switch (data.type) {
    case 'String':
    case 'Boolean':
    case 'Number':
      return `type: ${data.type}`;
    case 'Enum':
      return `type: String, enum: ${data.refEnum}`;
    case 'ObjectId':
      return `type: Schema.Types.ObjectId, ref: '${data.refDocument}'`;
    case 'Schema':
      return `type: ${getSchemaName(data.refSchema)}`;
    default:
      assertUnreachable(data);
  }
}

function getSchemaName(name: string) {
  return `${name}Schema`;
}
function getDocumentName(name: string) {
  return `${name}Document`;
}
