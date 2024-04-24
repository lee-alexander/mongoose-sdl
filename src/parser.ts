import { promises as fs } from 'fs';
import { groupItemsBy, toDictionary, uniqueValues, unwrap } from './util';
import { Enum, Schema, Model, DbDefinition, FlatSchemaDataType } from './types';

// Break overall document down into key sections - enums, models, schemas
const TopLevelRegex = /(enum|model|schema) ([^{]*) {([^}]*)}/g;

export async function parseDbDefinitionFile(path: string): Promise<DbDefinition> {
  const fileBuffer = await fs.readFile(path);
  const contents = fileBuffer.toString();
  const parsedContent = parseContent(contents, TopLevelRegex);

  const namesWithType = parsedContent.map(([, type, name]) => `${name}${type}`);
  if (namesWithType.length !== uniqueValues(namesWithType).length) {
    throw new Error('Duplicate type name detected');
  }

  const contentByType = groupItemsBy(
    parsedContent,
    ([, type]) => type as 'enum' | 'model' | 'schema',
    ([, , name, contents]) => ({ name, contents })
  );

  const namedTypes: NamedTypes = {
    enums: new Set((contentByType['enum'] ?? []).map((d) => d.name)),
    models: new Set((contentByType['model'] ?? []).map((d) => d.name)),
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

  const models = toDictionary(
    contentByType['model'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseModelContents(contents, namedTypes)
  );

  return { enums, schemas, models };
}

const EnumRegex = /(\w+)/g;
function parseEnumContents(contents: string): Enum {
  const values = parseContent(contents, EnumRegex);

  return {
    values: values.map(([value]) => value),
  };
}

// Break down "key: type @directive1 @directive2" lines into
// (1) key
// (2) array element type, if array
// (3) array element type is required (!), if array
// (4) map element type, if map
// (5) map element type is required (!), if map
// (6) type, if not array or map
// (7) type is required (!)
// (8) directives
const KeyValueDirectiveRegex = /(\w+): (?:\[(\w+)(!?)\]|Map<(\w+)(!?)>|(\w+))(!?)([^\n]*)/g;

// Break down @directive1 @directive2 into (1) directive1 (2) directive2
const DirectiveRegex = /@(\w+)/g;

function parseSchemaContents(contents: string, namedTypes: NamedTypes): Schema {
  const parsedContent = parseContent(contents, KeyValueDirectiveRegex);
  const parsedFields = parsedContent.map(
    ([
      ,
      fieldName,
      arrayElementType,
      arrayElementRequired,
      mapElementType,
      mapElementRequired,
      nonArrayType,
      required,
      directives,
    ]) => ({
      fieldName,
      fieldType: unwrap(nonArrayType || arrayElementType || mapElementType),
      isArray: Boolean(arrayElementType),
      isArrayElementRequired: arrayElementRequired === '!',
      isMap: Boolean(mapElementType),
      isMapElementRequired: mapElementRequired === '!',
      isRequired: required === '!',
      directives: directives ? parseContent(directives, DirectiveRegex).map(([, directive]) => directive) : [],
    })
  );

  const invalidDirectives = parsedFields
    .flatMap((f) => f.directives)
    .filter((d) => d !== 'index' && d !== 'unique' && d !== 'immutable');
  if (invalidDirectives.length > 0) {
    throw new Error('Unknown directives: ' + invalidDirectives);
  }

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
        : f.isMap
        ? {
            type: 'Map' as const,
            elementType: parseDataType(f.fieldName, f.fieldType, namedTypes),
            elementRequired: f.isMapElementRequired,
          }
        : parseDataType(f.fieldName, f.fieldType, namedTypes),
      isRequired: f.isRequired,
      isIndex: f.directives.includes('index'),
      isUnique: f.directives.includes('unique'),
      isImmutable: f.directives.includes('immutable'),
    })
  );
}

function parseModelContents(contents: string, namedTypes: NamedTypes): Model {
  return {
    schema: parseSchemaContents(contents, namedTypes),
  };
}

function parseDataType(fieldName: string, fieldType: string, namedTypes: NamedTypes): FlatSchemaDataType {
  if (fieldType === 'String' || fieldType === 'Boolean' || fieldType === 'Number' || fieldType === 'Date') {
    return { type: fieldType };
  }

  if (namedTypes.enums.has(fieldType)) {
    return {
      type: 'Enum',
      refEnum: fieldType,
    };
  }

  if (namedTypes.models.has(fieldType)) {
    return {
      type: 'ObjectId',
      refModel: fieldType,
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
  models: Set<string>;
}

function parseContent(content: string, regex: RegExp) {
  const result = content.matchAll(regex);
  const unmatched = content.replaceAll(regex, '').trim();
  if (unmatched.length > 0) {
    throw new Error('Unexpected syntax near:\n' + unmatched);
  }
  return [...result];
}
