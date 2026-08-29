---
description: "Use when editing the tenant website renderer, site templates, page blocks or anything under artifacts/website-renderer."
applyTo: "artifacts/website-renderer/**"
---

# Tenant Website Template Rules

The tenant website is a **templated structure**. Tenant sites are generated from
a master template.

Make changes at the master-template level, never at an individual tenant level.
A fix applied to one tenant's site is a bug — it will not propagate, and it will
be overwritten on the next generation.
