import { generate } from './generator';
import { parseDbDefinitionFile } from './parser';

test('generate example.mgsdl', async () => {
  const definition = await parseDbDefinitionFile('./sample-data/example.mgsdl');
  const result = generate(definition);
  expect(result).toMatchSnapshot();
});
