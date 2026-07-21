# Copilot Instructions

## Git workflow
Default to local-first development.
Do not commit or push after every change.
Only run git add/commit/push when the user explicitly asks, or at end-of-day batch release.

## Primary objective

Use the minimum amount of work, context, files, commands, and generated code required to solve the requested task correctly.

Do not explore the whole repository unless it is necessary. Do not rewrite working code unless directly required. Do not perform broad refactors, formatting sweeps, dependency upgrades, or architectural changes unless explicitly requested.

## Credit-efficient workflow

Before making changes:

1. Identify the smallest set of files likely to be relevant.
2. Read only those files first.
3. Make the smallest safe change.
4. Avoid generating large explanations unless asked.
5. Avoid repeating the same reasoning in multiple messages.
6. Prefer targeted diffs over full-file rewrites.
7. Do not scan unrelated folders.
8. Do not run expensive commands unless they are necessary to verify the change.

If the request is ambiguous, make the most reasonable assumption and state it briefly. Do not ask unnecessary questions.

## Editing rules

* Preserve the existing architecture, naming style, folder structure, and coding conventions.
* Do not introduce new libraries unless there is a clear need.
* Do not duplicate logic. Reuse existing utilities, hooks, services, components, and types where available.
* Do not change public APIs, database schemas, environment variables, routes, or authentication flows unless specifically requested.
* Do not remove comments, tests, logging, or error handling unless they are clearly obsolete.
* Keep changes focused on the user’s request only.

## Output rules

When responding:

* Start with the answer or the change made.
* Be concise.
* Do not explain basic concepts unless asked.
* Do not include long summaries of files inspected.
* Do not paste entire files unless requested.
* When giving code, provide only the relevant changed sections unless a full file is necessary.
* When suggesting next steps, list only the most important one or two.

## Verification rules

After changing code:

1. Check for obvious type, syntax, import, and runtime errors.
2. Run the smallest relevant test, build, lint, or typecheck command if available and practical.
3. If verification is not run, say exactly why.
4. Do not run the full test suite unless the change is broad or risky.

## Safety and quality rules

* Prefer simple, boring, maintainable code.
* Avoid clever abstractions.
* Avoid speculative improvements.
* Avoid adding TODOs unless they are genuinely necessary.
* Avoid making the project “better” in unrelated ways.
* Do not silently ignore errors.
* Do not fake test results.
* If unsure, say so briefly and explain the risk.

## Project assumptions

This project may use modern web tooling such as TypeScript, React, Next.js, Vite, Express, Supabase, PostgreSQL, Tailwind, Railway, Vercel, or similar tools.

Respect the project’s actual files over these assumptions. Do not force patterns that are not already present in the codebase.

## Preferred implementation style

* TypeScript-first.
* Strong types where useful, but avoid over-engineering.
* Small functions.
* Clear component boundaries.
* Server-side validation where relevant.
* Secure handling of authentication, permissions, user data, secrets, payments, and database access.
* Use environment variables for secrets.
* Never expose private keys or service-role credentials to the client.

## Forbidden behaviours unless explicitly requested

* Whole-project rewrites.
* Mass formatting.
* Dependency upgrades.
* Framework migrations.
* Changing database schema.
* Replacing styling systems.
* Moving files around.
* Adding new state management libraries.
* Adding new UI component libraries.
* Creating new abstractions for one-off logic.
* Generating large amounts of boilerplate.
* Running broad searches repeatedly after relevant files have already been found.

## When working in agent mode

Operate like a careful senior developer, not an enthusiastic junior developer.

The goal is not to produce the most code.
The goal is to solve the task with the least safe change.

I dont use Railway anymore, I use fly.io

When working on the tenant website aspect of the site always remember that this is a templated structure and that changes made should be made at a mastertemplate level and not at a tenant level. The tenant website is a template that is used to generate the tenant websites and any changes made to the tenant website should be made at the master template level and not at a tenant level.