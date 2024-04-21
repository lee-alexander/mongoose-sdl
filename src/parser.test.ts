import { parseDbDefinitionFile } from './parser';

test('parse example.mgsdl', async () => {
  const result = await parseDbDefinitionFile('./sample-data/example.mgsdl');
  expect(result).toMatchSnapshot();
});
