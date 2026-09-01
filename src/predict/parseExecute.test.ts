import { expect, test } from 'vitest';
import { parseExecute } from './parseExecute';

test('true turns execution on', () => {
  expect(parseExecute('true')).toEqual({ execute: true, legacy: null });
});

test('false leaves execution off', () => {
  expect(parseExecute('false')).toEqual({ execute: false, legacy: null });
});

test('an absent input leaves execution off', () => {
  expect(parseExecute('')).toEqual({ execute: false, legacy: null });
});

test('whitespace-only input leaves execution off', () => {
  expect(parseExecute('  \n ')).toEqual({ execute: false, legacy: null });
});

test('surrounding whitespace is ignored', () => {
  expect(parseExecute('  true\n')).toEqual({ execute: true, legacy: null });
});

test('case is ignored, since YAML spells booleans several ways', () => {
  expect(parseExecute('True')).toEqual({ execute: true, legacy: null });
  expect(parseExecute('FALSE')).toEqual({ execute: false, legacy: null });
});

test('the retired grant spelling means true, and comes back for the caller to warn about', () => {
  expect(parseExecute('o/conventions:detect')).toEqual({
    execute: true,
    legacy: 'o/conventions:detect',
  });
});

test('several grants are still one switch', () => {
  expect(parseExecute(' o/a:one\no/b:two three/c:x,y ')).toEqual({
    execute: true,
    legacy: 'o/a:one\no/b:two three/c:x,y',
  });
});

test('one bad entry refuses the input even when others are fine', () => {
  expect(parseExecute('o/a:one nope o/b:two')).toEqual({ malformed: 'nope' });
});

test('a word that is neither a boolean nor a grant → refused', () => {
  expect(parseExecute('yes')).toEqual({ malformed: 'yes' });
});
