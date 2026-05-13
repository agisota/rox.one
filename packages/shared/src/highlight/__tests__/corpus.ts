/**
 * Fixed corpus of 20 representative code samples (10 languages × small + medium).
 *
 * Used by `highlight-corpus.test.ts` to detect token-class regressions after
 * an engine swap. Each entry pins a token class (e.g. `keyword`, `string`)
 * that the engine must emit for the snippet to count as correctly highlighted.
 *
 * Keep entries small (<= 40 lines). Larger snippets stress the regex engine
 * without adding fidelity coverage.
 */

export type CorpusSample = {
  id: string
  lang: string
  size: 'small' | 'medium'
  code: string
  /** A substring expected to appear in the rendered HTML, anchoring the token-class assertion. */
  expectedToken: string
}

export const HIGHLIGHT_CORPUS: ReadonlyArray<CorpusSample> = [
  // TypeScript
  {
    id: 'ts-small',
    lang: 'typescript',
    size: 'small',
    code: `const greet = (name: string): string => \`Hello, \${name}\`;`,
    expectedToken: '<span',
  },
  {
    id: 'ts-medium',
    lang: 'typescript',
    size: 'medium',
    code: [
      'interface User { id: number; name: string; admin?: boolean }',
      '',
      'export function describe(u: User): string {',
      '  if (u.admin) return `admin ${u.name}`;',
      '  return `user ${u.name}`;',
      '}',
    ].join('\n'),
    expectedToken: 'interface',
  },
  // JavaScript (with JSX)
  {
    id: 'js-small',
    lang: 'jsx',
    size: 'small',
    code: `const Hello = ({ name }) => <h1>Hello {name}</h1>;`,
    expectedToken: '<span',
  },
  {
    id: 'js-medium',
    lang: 'jsx',
    size: 'medium',
    code: [
      'import { useState } from "react";',
      '',
      'export function Counter() {',
      '  const [n, setN] = useState(0);',
      '  return <button onClick={() => setN(n + 1)}>Count: {n}</button>;',
      '}',
    ].join('\n'),
    expectedToken: 'import',
  },
  // Python
  {
    id: 'py-small',
    lang: 'python',
    size: 'small',
    code: `def greet(name: str) -> str:\n    return f"Hello, {name}"`,
    expectedToken: 'def',
  },
  {
    id: 'py-medium',
    lang: 'python',
    size: 'medium',
    code: [
      'from dataclasses import dataclass',
      '',
      '@dataclass',
      'class User:',
      '    name: str',
      '    age: int = 0',
      '',
      '    def is_adult(self) -> bool:',
      '        return self.age >= 18',
    ].join('\n'),
    expectedToken: 'class',
  },
  // Rust
  {
    id: 'rs-small',
    lang: 'rust',
    size: 'small',
    code: `fn greet(name: &str) -> String { format!("Hello, {name}") }`,
    expectedToken: 'fn',
  },
  {
    id: 'rs-medium',
    lang: 'rust',
    size: 'medium',
    code: [
      'use std::collections::HashMap;',
      '',
      'pub fn count_words(text: &str) -> HashMap<String, usize> {',
      '    let mut counts = HashMap::new();',
      '    for word in text.split_whitespace() {',
      '        *counts.entry(word.to_string()).or_insert(0) += 1;',
      '    }',
      '    counts',
      '}',
    ].join('\n'),
    expectedToken: 'pub',
  },
  // Go
  {
    id: 'go-small',
    lang: 'go',
    size: 'small',
    code: `func greet(name string) string { return "Hello, " + name }`,
    expectedToken: 'func',
  },
  {
    id: 'go-medium',
    lang: 'go',
    size: 'medium',
    code: [
      'package main',
      '',
      'import "fmt"',
      '',
      'type User struct {',
      '    Name string',
      '    Age  int',
      '}',
      '',
      'func (u User) Greet() { fmt.Println("Hi", u.Name) }',
    ].join('\n'),
    expectedToken: 'package',
  },
  // Bash
  {
    id: 'bash-small',
    lang: 'bash',
    size: 'small',
    code: `echo "Hello, $USER"`,
    expectedToken: 'echo',
  },
  {
    id: 'bash-medium',
    lang: 'bash',
    size: 'medium',
    code: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      'name="${1:-world}"',
      'if [[ -n "$name" ]]; then',
      '  echo "Hello, $name"',
      'fi',
    ].join('\n'),
    expectedToken: 'echo',
  },
  // JSON
  {
    id: 'json-small',
    lang: 'json',
    size: 'small',
    code: `{ "name": "Ada", "age": 36 }`,
    expectedToken: '"name"',
  },
  {
    id: 'json-medium',
    lang: 'json',
    size: 'medium',
    code: [
      '{',
      '  "users": [',
      '    { "id": 1, "name": "Ada", "admin": true },',
      '    { "id": 2, "name": "Linus", "admin": false }',
      '  ],',
      '  "total": 2',
      '}',
    ].join('\n'),
    expectedToken: '"users"',
  },
  // YAML
  {
    id: 'yaml-small',
    lang: 'yaml',
    size: 'small',
    code: `name: Ada\nage: 36`,
    expectedToken: 'name',
  },
  {
    id: 'yaml-medium',
    lang: 'yaml',
    size: 'medium',
    code: [
      'services:',
      '  web:',
      '    image: nginx:latest',
      '    ports:',
      '      - "80:80"',
      '  db:',
      '    image: postgres:16',
      '    environment:',
      '      POSTGRES_PASSWORD: secret',
    ].join('\n'),
    expectedToken: 'services',
  },
  // Markdown
  {
    id: 'md-small',
    lang: 'markdown',
    size: 'small',
    code: `# Hello\n\nThis is **bold** and _italic_.`,
    expectedToken: 'Hello',
  },
  {
    id: 'md-medium',
    lang: 'markdown',
    size: 'medium',
    code: [
      '# Title',
      '',
      '- item one',
      '- item two',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '[link](https://example.com)',
    ].join('\n'),
    expectedToken: 'Title',
  },
  // SQL
  {
    id: 'sql-small',
    lang: 'sql',
    size: 'small',
    code: `SELECT id, name FROM users WHERE age >= 18;`,
    expectedToken: 'SELECT',
  },
  {
    id: 'sql-medium',
    lang: 'sql',
    size: 'medium',
    code: [
      'CREATE TABLE users (',
      '  id   SERIAL PRIMARY KEY,',
      '  name TEXT NOT NULL,',
      '  age  INT  NOT NULL DEFAULT 0',
      ');',
      '',
      'INSERT INTO users (name, age) VALUES (\'Ada\', 36);',
    ].join('\n'),
    expectedToken: 'CREATE',
  },
]
