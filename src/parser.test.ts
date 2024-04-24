import { parseDbDefinitionFile } from './parser';

test('parse example.mgsdl', async () => {
  const result = await parseDbDefinitionFile('./sample-data/example.mgsdl');
  expect(result).toMatchSnapshot();
});

test('parse invalid cases', async () => {
  for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await expect(() => parseDbDefinitionFile(`./sample-data/invalid/${index}.mgsdl`)).rejects.toMatchSnapshot();
  }
});
