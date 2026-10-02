# ARKPOINT native packs for IYEN

Definitions and pack validation were synced byte-for-byte from Ark-Point/gisul-skills `9f4edf6797336b73e80d7b44c100681b9e77bcce`. The architecture, backend and frontend packs reference the existing IYEN catalog; changeroa-specific skills are retained.

Packs are JSON resources separate from SKILL.md bodies. Publication includes pack files in Git parity and content change detection, derives pack registration from GitHub account-linked Git history, verifies version-pinned definitions and member digests before activation, then checks active publication status. Existing skill registration fields are unchanged. `registration-accounts.json` contains only explicitly reviewed historical account overrides; normal publication uses GitHub commit attribution.

The runtime must expose native pack tools before this content is published. Validation pins the pack-aware changeroa/gisul runtime. Tests cover malformed definitions, missing references, combined membership, pack-only publication, immutable artifacts and actual workerd stage/promote/readback.

The loader resolves definitions first. Required members are subject to user scope and explicit invocation; conditional members need their stated condition. Resolution is not execution or completed review.
