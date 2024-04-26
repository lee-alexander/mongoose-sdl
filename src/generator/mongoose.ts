import { sortSchemasTopologically } from './util/topological-sort';
import { DbDefinition, Schema, SchemaField, FlatSchemaDataType, Model, SchemaDataType } from '../types';
import { assertUnreachable, notNullOrUndefined } from '../util';
import { getModelTypeName, getSchemaTypeName, getTypeNameWithNullability } from './types';

export function generateMongoose(sdl: DbDefinition): string {
  const sortedSchemas = sortSchemasTopologically(sdl.schemas);
  const schemaContent = sortedSchemas.map(({ name, schema }) =>
    generateSchema(name, getSchemaTypeName(name), schema, false)
  );
  const modelContent = Object.entries(sdl.models).map(([name, data]) => generateModel(name, data));
  const returnContent = [
    `return {`,
    `schemas: { ${Object.keys(sdl.models).concat(Object.keys(sdl.schemas)).join(', ')} }`,
    `models: { ${Object.keys(sdl.models).join(', ')} }`,
    `};`,
  ].join('\n');

  return [
    generateFactoryConfigType(sdl),
    `export function initializeMongoose(config: MongooseFactoryConfig) {`,
    ...schemaContent,
    ...modelContent,
    returnContent,
    `}`,
  ].join('\n\n');
}

function generateFactoryConfigType(sdl: DbDefinition) {
  const schemas = Object.entries(sdl.models)
    .map(([name, { schema }]) => ({ name, schema }))
    .concat(Object.entries(sdl.schemas).map(([name, schema]) => ({ name, schema })))
    .map(({ name, schema }) =>
      [
        `${name}${Object.values(schema).some((data) => data.isVirtual) ? '' : '?'}: {`,
        ...Object.entries(schema).flatMap(([fieldName, data]) =>
          data.isVirtual || data.isValidatable
            ? [
                `${fieldName}${data.isVirtual || data.isValidatable ? '' : '?'}: {`,
                ...(data.isValidatable
                  ? [
                      `validate: {`,
                      `validator: (val: ${getTypeNameWithNullability(data)}) => any,`,
                      `message?: string,`,
                      `},`,
                    ]
                  : []),
                ...(data.isVirtual
                  ? [
                      `virtual: {`,
                      `get?: (doc: ${getSchemaName(name)}) => ${getTypeNameWithNullability(data)}`,
                      `set?: (doc: ${getSchemaName(name)}, value: ${getTypeNameWithNullability(data)}) => void`,
                      `},`,
                    ]
                  : []),
                `},`,
              ]
            : []
        ),
        `}`,
      ].join('\n')
    )
    .join(',\n');

  return [`export interface MongooseFactoryConfig {`, `schemas: {`, schemas, `}`, `}`].join('\n');
}

function generateModel(name: string, model: Model) {
  const schemaContent = generateSchema(name, getModelTypeName(name), model.schema, true);
  const modelContent = `const ${getModelName(name)} = model<${getModelTypeName(name)}>('${name}', ${getSchemaName(
    name
  )});`;
  return `${schemaContent}\n\n${modelContent}`;
}

function generateSchema(name: string, typeName: string, schema: Schema, includeTimestamps: boolean) {
  const schemaName = getSchemaName(name);

  const fields = Object.entries(schema).map(([fieldName, data]) => ({ fieldName, data }));
  const virtualFields = fields.filter((f) => f.data.isVirtual);
  const regularFields = fields.filter((f) => !f.data.isVirtual && getSchemaRef(f.data.dataType) !== name);
  const recursiveFields = fields.filter((f) => !f.data.isVirtual && getSchemaRef(f.data.dataType) === name);

  const schemaFieldContent =
    regularFields
      .map(({ fieldName, data }) => `${fieldName}: ${getSchemaFieldDefinition(name, fieldName, data)},`)
      .join('\n') || null;
  const recursiveFieldContent =
    recursiveFields
      .map(
        ({ fieldName, data }) =>
          `${schemaName}.add({ ${fieldName}: ${getSchemaFieldDefinition(name, fieldName, data)} });`
      )
      .join('\n') || null;
  const virtualFieldContent =
    virtualFields
      .flatMap(({ fieldName }) => [
        `if (config.schemas.${name}.${fieldName}.virtual.get) {`,
        `${schemaName}.virtual('${fieldName}').get((_, __, doc) => config.schemas.${name}.virtual.get(doc))`,
        `}`,
        `if (config.schemas.${name}.${fieldName}.virtual.set) {`,
        `${schemaName}.virtual('${fieldName}').set((value, _, doc) => { config.schemas.${name}.virtual.set(doc, value); })`,
        `}`,
      ])
      .join('\n') || null;

  return [
    `const ${schemaName} = new Schema<${typeName}>(`,
    `{`,
    schemaFieldContent,
    `}${includeTimestamps ? ',' : ''}`,
    includeTimestamps ? `{ timestamps: true }` : null,
    `);`,
    recursiveFieldContent,
    virtualFieldContent,
  ]
    .filter(notNullOrUndefined)
    .join('\n');
}

function getSchemaFieldDefinition(schemaName: string, fieldName: string, field: SchemaField): string {
  if (field.isVirtual) {
    throw new Error('Cannot create schema field definition for virtual field');
  }

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

  return `{ ${[
    ...baseDefinition,
    customDefinition,
    field.isValidatable ? `validate: config.schemas.${schemaName}.${fieldName}.validate` : null,
  ]
    .filter(notNullOrUndefined)
    .join(', ')} }`;
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
    case 'External':
      throw new Error('Cannot use external types for non-virtual fields');
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
    case 'External':
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
