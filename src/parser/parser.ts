import { promises as fs } from 'fs';
import { groupItemsBy, toDictionary, uniqueValues, unwrap } from '../util';
import { Enum, Schema, Model, DbDefinition, FlatSchemaDataType, Union, Unions } from '../types';

// Break overall document down into key sections - enums, models, schemas
const TopLevelRegex = /(?:(enum|model|schema) ([^{]*) {([^}]*)})|(?:external (\w*))|(?:union (\w*) = ([\w |]*))/g;

export async function parseDbDefinitionFile(path: string): Promise<DbDefinition> {
  const fileBuffer = await fs.readFile(path);
  const contents = fileBuffer.toString();
  const parsedContent = parseContent(contents, TopLevelRegex);

  const topLevelNames = parsedContent.map(
    ([, , name, _, externalTypeName, unionName]) => name || externalTypeName || unionName
  );
  if (topLevelNames.length !== uniqueValues(topLevelNames).length) {
    throw new Error('Duplicate schema/model/enum/external/union name detected');
  }

  const contentByType = groupItemsBy(
    parsedContent,
    ([, type, , , externalTypeName, unionName]) =>
      externalTypeName ? 'external' : unionName ? 'union' : (type as 'enum' | 'model' | 'schema'),
    ([, , name, contents, externalTypeName, unionName, unionContents]) => ({
      name: name || externalTypeName || unionName,
      contents: contents || unionContents || '',
    })
  );

  const namedTypes: NamedTypes = {
    enums: new Set((contentByType['enum'] ?? []).map((d) => d.name)),
    models: new Set((contentByType['model'] ?? []).map((d) => d.name)),
    schemas: new Set((contentByType['schema'] ?? []).map((d) => d.name)),
    externals: new Set((contentByType['external'] ?? []).map((d) => d.name)),
    unions: new Set((contentByType['union'] ?? []).map((d) => d.name)),
  };

  const unions = toDictionary(
    contentByType['union'] ?? [],
    ({ name }) => name,
    ({ name, contents }) => parseUnionContents(name, contents, namedTypes)
  );

  const enums = toDictionary(
    contentByType['enum'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseEnumContents(contents)
  );

  const schemas = toDictionary(
    contentByType['schema'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseSchemaContents(contents, namedTypes, unions)
  );

  const models = toDictionary(
    contentByType['model'] ?? [],
    ({ name }) => name,
    ({ contents }) => parseModelContents(contents, namedTypes, unions)
  );

  const externals = (contentByType['external'] ?? []).map((c) => c.name);

  return { enums, schemas, models, unions, externals };
}

const EnumRegex = /(\w+)/g;
function parseEnumContents(contents: string): Enum {
  const values = parseContent(contents, EnumRegex);

  return {
    values: values.map(([value]) => value),
  };
}

function parseUnionContents(name: string, contents: string, namedTypes: NamedTypes): Union {
  const refModels = contents.split('|').map((m) => m.trim());
  const unknownModels = refModels.filter((model) => !namedTypes.models.has(model));
  if (unknownModels.length > 0) {
    throw new Error(`Unknown model names in union ${name}: ${unknownModels.join(', ')}`);
  }
  return { refModels };
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

function parseSchemaContents(contents: string, namedTypes: NamedTypes, unions: Unions): Schema {
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
    .filter((d) => d !== 'index' && d !== 'unique' && d !== 'immutable' && d !== 'virtual' && d !== 'validate');
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
            elementType: parseDataType(f.fieldName, f.fieldType, namedTypes, unions),
            elementRequired: f.isArrayElementRequired,
          }
        : f.isMap
        ? {
            type: 'Map' as const,
            elementType: parseDataType(f.fieldName, f.fieldType, namedTypes, unions),
            elementRequired: f.isMapElementRequired,
          }
        : parseDataType(f.fieldName, f.fieldType, namedTypes, unions),
      isRequired: f.isRequired,
      isIndex: f.directives.includes('index'),
      isUnique: f.directives.includes('unique'),
      isImmutable: f.directives.includes('immutable'),
      isVirtual: f.directives.includes('virtual'),
      isValidatable: f.directives.includes('validate'),
    })
  );
}

function parseModelContents(contents: string, namedTypes: NamedTypes, unions: Unions): Model {
  return {
    schema: parseSchemaContents(contents, namedTypes, unions),
  };
}

function parseDataType(
  fieldName: string,
  fieldType: string,
  namedTypes: NamedTypes,
  unions: Unions
): FlatSchemaDataType {
  if (fieldType === 'String' || fieldType === 'Boolean' || fieldType === 'Number' || fieldType === 'Date') {
    return { type: fieldType };
  }

  if (namedTypes.enums.has(fieldType)) {
    return {
      type: 'Enum',
      refEnum: fieldType,
    };
  }

  if (fieldType === 'ObjectId') {
    return {
      type: 'ObjectId',
      refModels: [],
    };
  }

  if (namedTypes.externals.has(fieldType)) {
    return {
      type: 'External',
      refType: fieldType,
    };
  }

  if (namedTypes.models.has(fieldType)) {
    return {
      type: 'ObjectId',
      refModels: [fieldType],
    };
  }

  if (unions[fieldType]) {
    return {
      type: 'ObjectId',
      refModels: unions[fieldType].refModels,
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
  externals: Set<string>;
  unions: Set<string>;
}

function parseContent(content: string, regex: RegExp) {
  const result = content.matchAll(regex);
  const unmatched = content.replaceAll(regex, '').trim();
  if (unmatched.length > 0) {
    throw new Error('Unexpected syntax near:\n' + unmatched);
  }
  return [...result];
}
