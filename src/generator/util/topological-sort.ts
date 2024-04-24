import { Schema } from '../../types';
import { uniqueValues, notNullOrUndefined, unwrap, toDictionary } from '../../util';
import { getSchemaRef } from '../mongoose';

export interface SortedSchemaDetails {
  name: string;
  schema: Schema;
}

export function sortSchemasTopologically(schemas: { [schemaName: string]: Schema }): SortedSchemaDetails[] {
  const deps = Object.entries(schemas).flatMap(([name, schema]) => {
    const destinations = uniqueValues(
      Object.values(schema)
        .map((s) => getSchemaRef(s.dataType))
        .filter(notNullOrUndefined)
        // Recursive references are special cased elsewhere to not cause cycles in our topological sort and break things
        .filter((ref) => ref !== name)
    );
    return { from: name, to: destinations };
  });
  const depsBySchema = toDictionary(
    deps,
    (d) => d.from,
    (d) => d.to
  );

  const results: SortedSchemaDetails[] = [];
  const noDepsQueue: string[] = Object.entries(depsBySchema)
    .filter(([, to]) => to.length === 0)
    .map(([from]) => from);

  while (noDepsQueue.length > 0) {
    const name = unwrap(noDepsQueue.pop());
    results.push({ name, schema: schemas[name] });

    for (const [otherName, remainingDeps] of Object.entries(depsBySchema)) {
      if (remainingDeps.includes(name)) {
        const updatedDeps = remainingDeps.filter((d) => d !== name);
        if (updatedDeps.length === 0) {
          noDepsQueue.unshift(otherName);
        }
        depsBySchema[otherName] = updatedDeps;
      }
    }
  }

  if (results.length !== Object.keys(schemas).length) {
    throw new Error('Cycle detected between schemas');
  }

  return results;
}
