# Authority Product Grammar Decision Records

This directory stores one accepted product-grammar decision per file.

Capture protocol:
- each accepted decision gets its own markdown file
- the file records the canonical rule, rationale, and status
- `INDEX.md` is updated as the navigation surface
- each accepted decision is mirrored into ByteRover via the local `brv swarm`
  `local-markdown:decision-records` provider

Working rule for this shaping thread:
- after every accepted choice, update the relevant decision file set
- keep wording canonical and compact
- treat these files as the source-of-truth artifact for accepted grammar
