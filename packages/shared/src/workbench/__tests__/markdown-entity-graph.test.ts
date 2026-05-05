import { describe, expect, it } from 'bun:test';
import {
  buildMarkdownEntityGraph,
  summarizeMarkdownEntityGraph,
} from '../markdown-entity-graph';

describe('Markdown Entity Graph', () => {
  it('extracts document, heading, entity, tag, and reference nodes with deterministic edges', () => {
    const graph = buildMarkdownEntityGraph({
      documentId: 'Spec 01',
      title: 'Spec One',
      markdown: [
        '# Launch Plan',
        '',
        'Coordinate with [[Design Team]] and [[Design Team]] for #release.',
        'Use [source memo](docs/source.md) before rollout.',
        '',
        '## Risks',
        '',
        'Escalate [[Security]] before #release.',
      ].join('\n'),
    });

    expect(graph.documentId).toBe('Spec 01');
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'document:spec-01',
      'entity:design-team',
      'entity:security',
      'heading:launch-plan',
      'heading:risks',
      'reference:docs-source-md',
      'tag:release',
    ]);

    expect(graph.edges).toEqual([
      {
        id: 'heading:launch-plan->entity:design-team:mentions',
        from: 'heading:launch-plan',
        to: 'entity:design-team',
        type: 'mentions',
      },
      {
        id: 'heading:launch-plan->reference:docs-source-md:references',
        from: 'heading:launch-plan',
        to: 'reference:docs-source-md',
        type: 'references',
      },
      {
        id: 'heading:launch-plan->tag:release:tags',
        from: 'heading:launch-plan',
        to: 'tag:release',
        type: 'tags',
      },
      {
        id: 'heading:risks->entity:security:mentions',
        from: 'heading:risks',
        to: 'entity:security',
        type: 'mentions',
      },
      {
        id: 'heading:risks->tag:release:tags',
        from: 'heading:risks',
        to: 'tag:release',
        type: 'tags',
      },
    ]);
  });

  it('attaches pre-heading references to the document node and ignores fenced code blocks', () => {
    const graph = buildMarkdownEntityGraph({
      documentId: 'Research Note',
      markdown: [
        'Preface mentions [[Inbox]] and #triage.',
        '',
        '```md',
        'Ignore [[Code Entity]], #code, and [code link](https://example.test).',
        '```',
        '',
        '# Sources',
        'Read [public docs](https://example.com/docs).',
      ].join('\n'),
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'document:research-note',
      'entity:inbox',
      'heading:sources',
      'reference:https-example-com-docs',
      'tag:triage',
    ]);

    expect(graph.edges.map((edge) => edge.id)).toEqual([
      'document:research-note->entity:inbox:mentions',
      'document:research-note->tag:triage:tags',
      'heading:sources->reference:https-example-com-docs:references',
    ]);
  });

  it('summarizes graph counts without exposing markdown content', () => {
    const graph = buildMarkdownEntityGraph({
      documentId: 'Brief',
      markdown: '# One\n\n[[Alpha]] [[Beta]] #tag [Memo](memo.md)',
    });

    expect(summarizeMarkdownEntityGraph(graph)).toEqual({
      documentId: 'Brief',
      nodeCount: 6,
      edgeCount: 4,
      nodesByType: {
        document: 1,
        entity: 2,
        heading: 1,
        reference: 1,
        tag: 1,
      },
      edgesByType: {
        mentions: 2,
        references: 1,
        tags: 1,
      },
    });
  });

  it('ignores inline code spans and normalizes wikilink anchors with aliases', () => {
    const graph = buildMarkdownEntityGraph({
      documentId: 'Design Brief',
      markdown: [
        '# Graph Notes',
        'Keep `[[Hidden Entity]] #hidden [Hidden](hidden.md)` out of graph extraction.',
        'Connect [[Design System#Tokens|token map]] and [[Design System#Tokens]] to #visible.',
      ].join('\n'),
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'document:design-brief',
      'entity:design-system',
      'heading:graph-notes',
      'tag:visible',
    ]);

    expect(graph.edges.map((edge) => edge.id)).toEqual([
      'heading:graph-notes->entity:design-system:mentions',
      'heading:graph-notes->tag:visible:tags',
    ]);
  });
});
