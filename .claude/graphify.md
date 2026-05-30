# graphify — Knowledge Graph Tooling

Third-party tool (https://github.com/safishamsi/graphify), kept separate from
the Manga app's own instructions. Turns this repo into a queryable knowledge
graph under `graphify-out/` (god nodes, community structure, cross-file links).

## Rules
- For codebase questions, run `graphify query "<question>"` when
  `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for
  relationships and `graphify explain "<concept>"` for focused concepts. These
  return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw
  grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead
  of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when
  query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only, no API cost).

## Generated artifacts
`graphify-out/` is tool output, not source — it is gitignored.
