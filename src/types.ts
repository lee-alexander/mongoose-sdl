export interface DbDefinition {
  schemas: {
    [schemaName: string]: Schema;
  };
  enums: {
    [enumName: string]: Enum;
  };
  documents: {
    [documentName: string]: Document;
  };
}

export interface Enum {
  values: string[];
}

export interface Document {
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
}

export type SchemaDataType =
  | {
      type: 'String' | 'Number' | 'Boolean';
    }
  | {
      type: 'Enum';
      refEnum: string;
    }
  | {
      type: 'ObjectId';
      refDocument: string;
    }
  | {
      type: 'Schema';
      refSchema: string;
    }
  | {
      type: 'Array';
      elementType: SchemaDataTypeWithoutArray;
      elementRequired: boolean;
    };

export type SchemaDataTypeWithoutArray = Exclude<SchemaDataType, { type: 'Array' }>;
