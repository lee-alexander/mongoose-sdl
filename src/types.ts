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
      refModel: string;
    }
  | {
      type: 'Schema';
      refSchema: string;
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
