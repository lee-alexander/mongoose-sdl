# Mongoose SDL

Codegen util for generating Mongoose TS types and Schemas from a custom SDL format similar to GraphQL (MGSDL - Mongoose SDL).

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

const ProjectDetailsSchema = new Schema<ProjectDetailsSchemaDocument>(
  {
    name: { required: true, type: String },
    alternateNames: { required: true, type: [{ type: String, required: true }] },
    number: { type: Number },
  },
  { timestamps: true }
);

const UserSchema = new Schema<UserDocument>(
  {
    email: { required: true, index: true, unique: true, type: String },
    name: { type: String },
    status: { required: true, type: String, enum: UserStatus },
  },
  { timestamps: true }
);

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
    "generate-mongoose-schemas": "mongoose-sdl -input your-file.mgsdl -output models.ts"
  }
}
```

## Data modeling primitives

There are three top-level keywords:

- `model` - a Mongoose model plus schema definition
- `schema`- a Mongoose schema that can be embedded into another schema or a model
- `enum` - a TS enum

There are a few built-in data types for fields. `!` can be appended to indicate required / non-nullable.

- `Number`
- `Boolean`
- `String`
- `Date`
- Arrays use GQL syntax - e.g. `[Number]` or `[Number!]`. Elements can be any built-in type or custom model, schema, enum
- Maps use a custom syntax - e.g. `Map<Number>` or `Map<Number!>`. Elements can be any built-in type of custom model, schema, enum

## Relationships

When a schema is specified as the type of a field, it will be directly embedded in the parent schema or model. Recursive schema definitions are supported.

When a model is specified as the type of a field, it will be turned into an ObjectId under the hood that has a ref to the model name.
