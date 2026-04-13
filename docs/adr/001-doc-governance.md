# ADR-001: Three-Tier Documentation & Hooks

## Status
Accepted

## Decision
Adopt a three-tier documentation stack (Tier 1 hot index, Tier 2 trigger-based specs, Tier 3 ADRs) with hook support to prevent task/document updates from being forgotten.

## Context
- `agent-plans/docs/adr/006-three-tier-documentation.md` proposes CLAUDE.md + specs with triggers + ADRs, plus reminder hooks and freshness checks.
- The paper *Codified Context: Infrastructure for AI Agents in a Complex Codebase* (arXiv:2602.20478) reports a similar tiered architecture (hot constitution, domain-specialist specs, cold knowledge base) with trigger tables, MCP retrieval, and drift detectors. It highlights that stale specs mislead agents, and trigger-based routing reduces human omission.
- Our project (read-only AI code reading tutor on localhost) needs persistent, machine-consumable knowledge so agents can align explanations, UI actions, and navigation. A single manifest is insufficient as features grow.

## Consideration
| Option | Pros | Cons |
| --- | --- | --- |
| Single manifest (one file) | Simple, always loaded | Context bloat or shallowness; no triggers; staleness risk |
| Ad-hoc docs without triggers | Low overhead | High omission risk; no guidance for agents/users |
| **Three-tier + hooks (chosen)** | Scales depth; triggerable; maintains rationale; supports reminders | Requires maintenance and trigger curation |

## Consequences
- **Tier 1**: `CLAUDE.md` kept short, always loaded, links to specs/ADRs/handover.
- **Tier 2**: Specs in `docs/specs/` with `Trigger:` header and `Last updated:`. Current: `doc-governance`.
- **Tier 3**: ADRs in `docs/adr/` following template; this ADR is seed.
- **Hooks**: `scripts/doc-hooks/doc-reminder.mjs` reads `docs/specs/triggers.json` and suggests specs for changed files. Future: drift detector to compare file changes vs spec `Last updated`.
- Agents should load Tier 1, then surface relevant Tier 2 via triggers; Tier 3 for rationale.

## References
- agent-plans ADR-006 Three-Tier Documentation
- *Codified Context: Infrastructure for AI Agents in a Complex Codebase* (arXiv:2602.20478)
