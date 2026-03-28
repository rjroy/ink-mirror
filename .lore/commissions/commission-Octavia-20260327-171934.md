---
title: "Commission: Lore development tend: full maintenance pass"
date: 2026-03-28
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Run a full lore-development tend pass on the `.lore/` directory.\n\nThis is a maintenance task. You are deciding and executing, not asking. Process everything:\n\n- **Status fields:** Update status on all documents (specs, plans, issues, research) to reflect current reality. If something is done, mark it done. If something is stale, mark it stale.\n- **Tags:** Normalize and update tags across all documents. Add missing tags, remove irrelevant ones.\n- **Files:** Clean up any orphaned or outdated files. If a document references files that no longer exist, fix the references.\n- **Directories:** Ensure the directory structure is consistent and nothing is misplaced.\n- **Frontmatter:** Ensure all documents have proper frontmatter (title, date, status, tags).\n- **Cross-references:** Verify that related/linked documents actually exist and links are correct.\n\nDo not ask whether to process something. Process it. Make the updates directly. If you're unsure about a status change, use your best judgment based on the current state of the codebase and commit history.\n\nUse `/lore-development:tend` as your methodology guide."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-28T00:19:34.596Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T00:19:34.603Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
