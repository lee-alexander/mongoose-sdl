import { CodegenConfig } from '../types';
import { parseAndGenerate } from '..';

test('generate example.mgsdl', async () => {
  const config: CodegenConfig = {
    inputFile: './sample-data/example.mgsdl',
    outputFile: '',
    externalImportPaths: { UserDetailsInterface: '../externals' },
  };
  const result = await parseAndGenerate(config);
  expect(result).toMatchSnapshot();
});

test('generate topological-ordering.mgsdl', async () => {
  const config: CodegenConfig = {
    inputFile: './sample-data/topological-ordering.mgsdl',
    outputFile: '',
  };
  const result = await parseAndGenerate(config);
  expect(result).toMatchSnapshot();
});

test('generate cycles.mgsdl', async () => {
  const config: CodegenConfig = {
    inputFile: './sample-data/invalid/cycles.mgsdl',
    outputFile: '',
  };
  expect(() => parseAndGenerate(config)).rejects.toMatchInlineSnapshot(`"Cycle detected between schemas"`);
});

test('generate non-virtual-external.mgsdl', async () => {
  const config: CodegenConfig = {
    inputFile: './sample-data/invalid/non-virtual-external.mgsdl',
    outputFile: '',
    externalImportPaths: { UserDetailsInterface: '../externals' },
  };
  expect(() => parseAndGenerate(config)).rejects.toMatchInlineSnapshot(
    `"Cannot use external types for non-virtual fields"`
  );
});

test('generate example.mgsdl without external', async () => {
  const config: CodegenConfig = {
    inputFile: './sample-data/example.mgsdl',
    outputFile: '',
  };
  expect(() => parseAndGenerate(config)).rejects.toMatchInlineSnapshot(
    `"Missing externals in input config: UserDetailsInterface"`
  );
});
