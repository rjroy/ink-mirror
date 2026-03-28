---
status: approved
custom_directories:
  commissions: [pending, active, completed, abandoned]
  meetings: [open, closed, deferred]
  reviews: [open, resolved]
  art: [draft, approved]
  generated: []

archive_directory: _archive

filename_exemptions:
  - "^commission-.+-\\d{8}-\\d{6}\\.md$"
  - "^audience-.+-\\d{8}-\\d{6}.*\\.md$"

custom_fields:
  commissions: [worker, workerDisplayTitle, prompt, dependencies, linked_artifacts, activity_timeline, current_progress, projectName, type]
  meetings: [worker, workerDisplayTitle, agenda, deferred_until, linked_artifacts, meeting_log]
  reviews: [reviewer, resolver]
  issues: [type, origin]
  research: [addresses, resolves, issue]
---

# Project Lore Configuration

This file tells `/tend` what's intentional about this project's `.lore/` structure.

## Custom Directories

- **commissions/** - Guild Hall async work items. Machine-generated filenames with timestamps.
- **meetings/** - Guild Hall audience records. Machine-generated filenames with timestamps.
- **reviews/** - Code review artifacts from implementation phases.
- **art/** - Visual direction documents and reference images.
- **generated/** - AI-generated image assets (not lore documents, no frontmatter expected).

## Notes

The `generated/` directory holds binary image files only. Tend should skip it entirely for frontmatter checks.

Research documents previously used `addresses`, `resolves`, and `issue` fields to link to their parent issues. These have been normalized to `related` arrays as of 2026-03-27. The custom_fields entry for research preserves backward compatibility if any are re-introduced.
