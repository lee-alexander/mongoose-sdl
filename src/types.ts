import { z } from 'zod';

export interface DbDefinition {
  schemas: {
    [schemaName: string]: Schema;
  };
  enums: {
    [enumName: string]: Enum;
  };
  models: {
    [modelName: string]: Model;
  };
  externals: string[];
}

export interface Enum {
  values: string[];
}

export interface Model {
  schema: Schema;
}

export interface Schema {
  [fieldName: string]: SchemaField;
}

export interface SchemaField {
  dataType: SchemaDataType;
  isRequired: boolean;
  isIndex: boolean;
  isUnique: boolean;
  isImmutable: boolean;
  isVirtual: boolean;
}

export type SchemaDataType =
  | {
      type: 'String' | 'Number' | 'Boolean' | 'Date';
    }
  | {
      type: 'Enum';
      refEnum: string;
    }
  | {
      type: 'ObjectId';
      refModel: string | null;
    }
  | {
      type: 'Schema';
      refSchema: string;
    }
  | {
      type: 'External';
      refType: string;
    }
  | {
      type: 'Array';
      elementType: FlatSchemaDataType;
      elementRequired: boolean;
    }
  | {
      type: 'Map';
      elementType: FlatSchemaDataType;
      elementRequired: boolean;
    };

export type FlatSchemaDataType = Exclude<SchemaDataType, { type: 'Array' | 'Map' }>;

export const CodegenConfigSchema = z.object({
  inputFile: z.string(),
  outputFile: z.string(),
  externalImportPaths: z.record(z.string(), z.string()).optional(),
});

export type CodegenConfig = z.infer<typeof CodegenConfigSchema>;
