# TWD Block System Rules

Blocks are reusable React TypeScript components for the TradeWorkDesk website builder.

Rules:
- Blocks live in src/twd/blocks.
- Stories live in src/twd/stories.
- Registry lives in src/twd/registry/blockRegistry.ts.
- Every block exports its Props type.
- Editable content must come from props.
- Do not hardcode business names inside components.
- Do not call APIs, Supabase, routing logic or database functions from blocks.
- Use Tailwind classes only.
- Do not use external UI libraries.
- Blocks must suit UK trade and local-service websites.
- Stories should use realistic UK plumbing/heating example content.
- Do not invent block types outside the registry.
- Any new block must have a story and a registry entry.
