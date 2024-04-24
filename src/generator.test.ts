import { generate } from './generator';
import { parseDbDefinitionFile } from './parser';

test('generate example.mgsdl', async () => {
  const definition = await parseDbDefinitionFile('./sample-data/example.mgsdl');
  const result = generate(definition);
  expect(result).toMatchSnapshot();
});

test('generate topological-ordering.mgsdl', async () => {
  const definition = await parseDbDefinitionFile('./sample-data/topological-ordering.mgsdl');
  const result = generate(definition);
  expect(result).toMatchSnapshot();
});

test('generate cycles.mgsdl', async () => {
  const definition = await parseDbDefinitionFile('./sample-data/invalid/cycles.mgsdl');
  expect(() => generate(definition)).toThrowErrorMatchingInlineSnapshot(`"Cycle detected between schemas"`);
});
