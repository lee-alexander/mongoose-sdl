import { sortSchemasTopologically } from './util/topological-sort';
import { DbDefinition, Schema, SchemaField, FlatSchemaDataType, Model, SchemaDataType } from '../types';
import { assertUnreachable, notNullOrUndefined } from '../util';
import { getModelTypeName, getSchemaTypeName } from './types';

export function generateMongoose(sdl: DbDefinition): string {
  const sortedSchemas = sortSchemasTopologically(sdl.schemas);
  const schemaContent = sortedSchemas.map(({ name, schema }) =>
    generateSchema(name, getSchemaTypeName(name), schema, false)
  );
  const modelContent = Object.entries(sdl.models).map(([name, data]) => generateModel(name, data));

  return [`import { Schema, model } from 'mongoose';`, ...schemaContent, ...modelContent].join('\n\n');
}

function generateModel(name: string, model: Model) {
  const schemaContent = generateSchema(name, getModelTypeName(name), model.schema, true);
  const modelContent = `export const ${getModelName(name)} = model<${getModelTypeName(
    name
  )}>('${name}', ${getSchemaName(name)});`;
  return `${schemaContent}\n\n${modelContent}`;
}

function generateSchema(name: string, typeName: string, schema: Schema, includeTimestamps: boolean) {
  const schemaFieldContent = Object.entries(schema)
    .map(([fieldName, data]) =>
      getSchemaRef(data.dataType) === name ? null : `    ${fieldName}: ${getSchemaFieldDefinition(data)},`
    )
    .filter(notNullOrUndefined)
    .join('\n');

  const recursivePatchContent = Object.entries(schema)
    .filter(([, data]) => getSchemaRef(data.dataType) === name)
    .map(([fieldName, data]) => `${getSchemaName(name)}.add({ ${fieldName}: ${getSchemaFieldDefinition(data)} });`)
    .join('\n');

  const timestampsContent = includeTimestamps ? `,\n{ timestamps: true }` : '';

  return `const ${getSchemaName(name)} = new Schema<${typeName}>(
  {\n${schemaFieldContent}
  }${timestampsContent}\n);${recursivePatchContent ? `\n${recursivePatchContent}` : ''}`;
}

function getSchemaFieldDefinition(field: SchemaField): string {
  const baseDefinition = [
    field.isRequired ? 'required: true' : null,
    field.isIndex ? 'index: true' : null,
    field.isUnique ? 'unique: true' : null,
    field.isImmutable ? 'immutable: true' : null,
  ];

  let customDefinition: string;
  if (field.dataType.type === 'Array' || field.dataType.type === 'Map') {
    const childType = getSchemaFieldDataDefinition(field.dataType.elementType);
    const childFields = [childType, field.dataType.elementRequired ? 'required: true' : null]
      .filter(notNullOrUndefined)
      .join(', ');
    customDefinition =
      field.dataType.type === 'Array' ? `type: [{ ${childFields} }]` : `type: Map, of: { ${childFields} }`;
  } else {
    customDefinition = getSchemaFieldDataDefinition(field.dataType);
  }

  return `{ ${[...baseDefinition, customDefinition].filter(notNullOrUndefined).join(', ')} }`;
}

function getSchemaFieldDataDefinition(data: FlatSchemaDataType): string {
  switch (data.type) {
    case 'String':
    case 'Boolean':
    case 'Number':
    case 'Date':
      return `type: ${data.type}`;
    case 'Enum':
      return `type: String, enum: ${data.refEnum}`;
    case 'ObjectId':
      return `type: Schema.Types.ObjectId${data.refModel ? `, ref: '${data.refModel}'` : ``}`;
    case 'Schema':
      return `type: ${getSchemaName(data.refSchema)}`;
    default:
      assertUnreachable(data);
  }
}

export function getSchemaRef(schema: SchemaDataType): string | null {
  switch (schema.type) {
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Date':
    case 'Enum':
    case 'ObjectId':
      return null;
    case 'Schema':
      return schema.refSchema;
    case 'Array':
      return getSchemaRef(schema.elementType);
    case 'Map':
      return getSchemaRef(schema.elementType);
    default:
      assertUnreachable(schema);
  }
}

function getSchemaName(name: string) {
  return `${name}Schema`;
}

function getModelName(name: string) {
  return `${name}Model`;
}
