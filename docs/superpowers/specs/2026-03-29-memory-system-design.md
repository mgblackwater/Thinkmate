# Thinkmate Memory System — Design Spec

## Goal

Personalize coaching based on who the user is, their recurring patterns, and recent conversation context. All local, no account needed. Storage abstraction ready for Supabase Phase 2.

## Storage Architecture

| Layer | Storage | Scope | Data |
|-------|---------|-------|------|
| User Profile | `chrome.storage.sync` | Cross-device | Name, nationality, goals, etc. |
| Auto-learned Memory | `chrome.storage.local` | This device | Error patterns, strong areas, coach/site usage |
| Session Context | In-memory JS variable | Per tab | Last 3 message/response pairs |

### User Profile

Stored in `chrome.storage.sync` under `user_profile` key:

```js
{
  name: '',
  nationality: '',
  native_language: '',
  profession: '',
  seniority: '',
  goals: '',
  work_context: '',
  communication_style: 'direct'
}
```

### Auto-learned Memory

Stored in `chrome.storage.local` under `learned_memory` key:

```js
{
  error_patterns: [
    { category: 'grammar', pattern: 'subject-verb agreement', count: 5, last_seen: '2026-03-29' }
  ],
  strong_areas: [
    { category: 'vocabulary', streak: 3, since: '2026-03-27' }
  ],
  coach_usage: {
    'english-coach': { count: 42, last_used: '2026-03-29' }
  },
  site_usage: {
    'web.whatsapp.com': 15,
    'mail.google.com': 8
  }
}
```

### Session Context

In-memory map keyed by tab domain:

```js
{ 'web.whatsapp.com': [
    { role: 'user', text: '...' },
    { role: 'assistant', response: '...' }
  ] // max 3 pairs, FIFO
}
```

Cleared on domain change. Passed as conversation history in API call.

## Memory Update Flow

After each coaching response:
1. Parse response JSON for error categories (grammar has items → grammar errors, etc.)
2. For each error found: find or create an `error_patterns` entry, increment `count`, update `last_seen`
3. For each category with no errors: increment a per-category "clean" counter (stored in-memory). When a category hits 3 consecutive clean sessions → add to `strong_areas`.
4. Increment `coach_usage` count for the active coach
5. Increment `site_usage` count for current domain
6. Prune: remove entries with `last_seen` older than 90 days

## Context Injection

Every API call prepends to the system prompt:

```
About the user: {name}, {nationality}, native language: {native_language}.
Profession: {profession} ({seniority}). Goals: {goals}.
Work context: {work_context}. Style preference: {communication_style}.
Known weak areas: {top 5 error patterns by count}.
Strong areas: {strong areas list}.
Tailor feedback to this profile.
```

Empty fields omitted. No profile → no prefix.

Session context (last 3 pairs) included as conversation history in the messages array sent to the API.

## Options Page Changes

### New section: "Your Profile" (top of page)

Form fields:
- Name (text)
- Nationality (text)
- Native Language (text)
- Profession (text)
- Seniority (select: Junior / Mid / Senior / Lead / Manager)
- Current Goals (textarea)
- Work Context (textarea)
- Communication Style (select: Formal / Casual / Direct)

Auto-saves on change (same pattern as existing settings).

### New section: "Insights" (below coaches)

Read-only panel:
- **Weak Areas**: list of top error patterns with frequency count. Each has a delete (×) button.
- **Strong Areas**: list of categories with streak count.
- **Most Used Coaches**: bar or list with counts.
- **Most Used Sites**: bar or list with counts.
- **Export Data**: button that downloads all memory as JSON file.
- **Clear All Data**: button with confirmation to wipe learned memory.

## Files

| File | Action |
|------|--------|
| `core/memory.js` | Create — profile CRUD, learned memory CRUD, session context manager, context injection builder, pruning |
| `core/storage.js` | Modify — add `user_profile` default, add `getLocal`/`setLocal` for learned memory |
| `content.js` | Modify — inject context prefix, pass session history, call memory update after response |
| `options.html` | Modify — add profile form + insights panel |
| `options.js` | Modify — profile save/load, insights rendering, export/clear |

## UI Changes (bundled)

### Light Theme

Replace dark theme with a clean light theme across panel.css and options.html.

### Brain Trigger Icon

Replace "T" text in trigger button with 🧠 emoji.

## Constraints

- Never store full message content in persistent storage — only error patterns and counts
- Profile stored in sync (cross-device), learned memory in local (device-only)
- Storage interface abstracted in memory.js for future Supabase drop-in
- Prune entries older than 90 days on every memory update
