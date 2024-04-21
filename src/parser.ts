import { promises as fs } from 'fs';
import { groupItemsBy, toDictionary, uniqueValues, unwrap } from './util';
import { Enum, Schema, Document, DbDefinition, SchemaDataTypeWithoutArray } from './types';

// Break overall document down into key sections - enums, documents, schemas
const TopLevelRegex = /(enum|document|schema) ([^{]*) {([^}]*)}/g;

export async function parseDbDefinitionFile(path: string): Promise<DbDefinition> {
  const fileBuffer = await fs.readFile(path);
  const contents = fileBuffer.toString();
  const parsedContent = [...contents.matchAll(TopLevelRegex)];

  const namesWithType = parsedContent.map(([, type, name]) => `${name}${type}`);
  if (namesWithType.length !== uniqueValues(namesWithType).length) {
    throw new Error('Duplicate type name detected');
  }

  const contentByType = groupItemsBy(
    parsedContent,
    ([, type]) => type as 'enum' | 'document' | 'schema',
    ([, , name, contents]) => ({ name, contents })
  );

  const namedTypes: NamedTypes = {
    enums: new Set((contentByType['enum'] ?? []).map((d) => d.name)),
    documents: new Set((contentByType['document'] ?? []).map((d) => d.name)),
    schemas: new Set((contentByType['schema'] ?? []).map((d) => d.name)),
  };

  const enums = toDictionary(
    contentByType['enum'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseEnumContents(contents)
  );

  const schemas = toDictionary(
    contentByType['schema'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseSchemaContents(contents, namedTypes)
  );

  const documents = toDictionary(
    contentByType['document'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseDocumentContents(contents, namedTypes)
  );

  return { enums, schemas, documents };
}

function parseEnumContents(contents: string): Enum {
  return {
    values: contents.trim().split(/\s+/g),
  };
}

// Break down "key: type @directive1 @directive2" lines into
// (1) key
// (2) array element type, if array
// (3) array element type is required (!), if array
// (4) type, if not array
// (5) type is required (!)
// (6) directives
const KeyValueDirectiveRegex = /(\w+): (?:\[(\w+)(!?)\]|(\w+))(!?)([^\n]*)/g;

// Break down @directive1 @directive2 into (1) directive1 (2) directive2
const DirectiveRegex = /@(\w+)/g;

function parseSchemaContents(contents: string, namedTypes: NamedTypes): Schema {
  const parsedContent = [...contents.matchAll(KeyValueDirectiveRegex)];
  const parsedFields = parsedContent.map(
    ([, fieldName, arrayElementType, arrayElementRequired, nonArrayType, required, directives]) => ({
      fieldName,
      fieldType: unwrap(nonArrayType || arrayElementType),
      isArray: Boolean(arrayElementType),
      isArrayElementRequired: arrayElementRequired === '!',
      isRequired: required === '!',
      directives: directives ? [...directives.matchAll(DirectiveRegex)].map(([, directive]) => directive) : [],
    })
  );

  return toDictionary(
    parsedFields,
    (f) => f.fieldName,
    (f) => ({
      dataType: f.isArray
        ? {
            type: 'Array' as const,
            elementType: parseDataType(f.fieldName, f.fieldType, namedTypes),
            elementRequired: f.isArrayElementRequired,
          }
        : parseDataType(f.fieldName, f.fieldType, namedTypes),
      isRequired: f.isRequired,
      isIndex: f.directives.includes('index'),
      isUnique: f.directives.includes('unique'),
    })
  );
}

function parseDocumentContents(contents: string, namedTypes: NamedTypes): Document {
  return {
    schema: parseSchemaContents(contents, namedTypes),
  };
}

function parseDataType(fieldName: string, fieldType: string, namedTypes: NamedTypes): SchemaDataTypeWithoutArray {
  if (fieldType === 'String' || fieldType === 'Boolean' || fieldType === 'Number') {
    return { type: fieldType };
  }

  if (namedTypes.enums.has(fieldType)) {
    return {
      type: 'Enum',
      refEnum: fieldType,
    };
  }

  if (namedTypes.documents.has(fieldType)) {
    return {
      type: 'ObjectId',
      refDocument: fieldType,
    };
  }

  if (namedTypes.schemas.has(fieldType)) {
    return {
      type: 'Schema',
      refSchema: fieldType,
    };
  }

  throw new Error(`Field ${fieldName} has unknown type ${fieldType}`);
}

interface NamedTypes {
  enums: Set<string>;
  schemas: Set<string>;
  documents: Set<string>;
}
