# Mongoose SDL

Codegen util for generating Mongoose TS types and Schemas from a custom SDL format similar to GraphQL - MGSDL.

Turn this -

```graphql
enum UserStatus {
  Pending
  Active
  Inactive
}

model User {
  email: String! @index @unique
  name: String
  status: UserStatus!
}

model Project {
  creator: User! @index
  details: ProjectDetails!
}

schema ProjectDetails {
  name: String!
  alternateNames: [String!]!
  number: Number
}
```

Into this -

```typescript
import { Types, Document } from 'mongoose';

export enum UserStatus {
  Pending = 'Pending',
  Active = 'Active',
  Inactive = 'Inactive',
}

export interface UserDocument extends Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  name: string | null | undefined;
  status: UserStatus;
}

export interface ProjectDocument extends Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  creator: Types.ObjectId;
  details: ProjectDetailsSchemaDocument;
}

export interface ProjectDetailsSchemaDocument extends Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  alternateNames: string[];
  number: number | null | undefined;
}

import { Schema, model } from 'mongoose';

const ProjectDetailsSchema = new Schema<ProjectDetailsSchemaDocument>({
  name: { required: true, type: String },
  alternateNames: { required: true, type: [{ type: String, required: true }] },
  number: { type: Number },
});

const UserSchema = new Schema<UserDocument>({
  email: { required: true, index: true, unique: true, type: String },
  name: { type: String },
  status: { required: true, type: String, enum: UserStatus },
});

export const UserModel = model<UserDocument>('User', UserSchema);

const ProjectSchema = new Schema<ProjectDocument>(
  {
    creator: { required: true, index: true, type: Schema.Types.ObjectId, ref: 'User' },
    details: { required: true, type: ProjectDetailsSchema },
  },
  { timestamps: true }
);

export const ProjectModel = model<ProjectDocument>('Project', ProjectSchema);
```

By installing this package and adding a script to your project's package.json

```json
{
  "scripts": {
    "generate-mongoose-schemas": "mongoose-sdl --config mgsdl.json"
  }
}
```

## Data modeling primitives

There are a few top-level keywords:

- `model` - a Mongoose model plus schema definition
- `schema`- a standalone Mongoose schema that can be embedded into another schema or a model
- `enum` - a TS enum
- `union` - a union of several models for the purpose of supporting dynamic refs to varying kinds of models
- `external` - link to a custom type in your own code so you can reference it in a virtual field definition in the SDL. Requires specifying the import path in the config file.

There are a few built-in data types for fields. `!` can be appended to indicate required / non-nullable.

- `Number`
- `Boolean`
- `String`
- `Date`
- Arrays use GQL syntax - e.g. `[T]` or `[T!]` where `T` is any built-in type or custom type (no nesting arrays/maps)
- Maps use a custom syntax - e.g. `Map<T>` or `Map<T!>` where `T` is any built-in type or custom type (no nesting arrays/maps)

## Models

Models can be referenced directly by their `model` name. This will create an `ObjectId` with a hardcoded ref to the model name.

If your field can point to multiple kinds of models dynamically, create a `union` of those models and reference that in your field definition. This will create an `ObjectId` and require you specify a custom ref function when calling the auto-generated initializer function.

`ObjectId` can be used directly when the type of the referenced model is unknown.

## Schemas

Schemas can be referenced directly by their `schema` name. A reference to the schema instance will be directly embedded in the parent schema or model. See below section on Schemas for more detais.

- Recursive schema definitions are supported. The schema is emitted without recursive fields first, then the recursive fields are patched on one at a time via schema.add()
- Cyclical references across schemas are not supported.
- "Nested paths" where the schema contents are directly inlined instead of referenced by instance are not supported, due to confusing Mongoose runtime behavior that is difficult to type safely and usefully.

Schemas will be emitted into the generated code according to a topological sort of their dependencies.

## Directives

Directives customize generation behavior on fields:

- `@index` - Pass-thru to Mongoose schema config
- `@unique` - Pass-thru to Mongoose schema config
- `@immutable` - Pass-thru to Mongoose schema config
- `@virtual` - Indicates the field will be virtual. Allows for using external types. Requires specifying an implementation of the virtual field when calling the auto-generated initializer function.
- `@validate` - Indicates the field will have a custom validator added on. Requires specifying the validator implementation for the field when calling the auto-generated initializer function.
