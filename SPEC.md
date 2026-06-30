---
# WCF Reading Tracker — Product Specification

## 1. Overview

A web application for tracking reading progress through the Westminster Confession of Faith (WCF), chapter by chapter, section by section. Users can:
- Mark sections complete in any order
- Navigate linearly (next/previous) or via chapter/section picker
- View WCF text one section at a time
- Sync progress in real-time across devices
- Mark sections incomplete (unmark)
- Reset all progress with confirmation
- Mark sections complete offline, with sync resuming when back online

**Stack:** Next.js + Supabase + Vercel
**Auth:** Passwordless/magic link
**Devices:** Phone + desktop with real-time sync

---

## 2. Data Model

### Supabase Schema

#### `users`
```sql
id (uuid, pk)
email (text, unique)
created_at (timestamp)
last_login (timestamp)

reading_progress

id (uuid, pk)
user_id (uuid, fk → users.id)
chapter (int)
section (int)
completed (boolean, default false)
marked_complete_at (timestamp, nullable) -- for conflict resolution
updated_at (timestamp) -- tracks last update for sync
unique(user_id, chapter, section)

Indexes:
- (user_id, updated_at) — for fetching all changes since last sync
- (user_id, chapter, section) — for quick lookups

Authentication: Magic Links

Supabase Auth with passwordless email flow. No password field; users receive a magic link via email.

---
3. Architecture

3.1 Content Loading (Abstraction Layer)

- Single module: lib/contentLoader.ts
- Loads WCF structure from current source (JSON, flat text, API, etc.)
- Returns standardized format:
interface WCFContent {
  chapters: Chapter[];
}

interface Chapter {
  number: int;
  title: string;
  sections: Section[];
}

interface Section {
  number: int;
  text: string;
  footnotes?: string[];
  crossReferences?: string[];
}
- Swappable implementation without touching UI/data layer

3.2 Real-Time Sync

Client-side sync strategy:
- On app load, fetch all reading progress from Supabase
- Listen to real-time updates via Supabase subscriptions
- When user marks/unmarks a section:
  a. Optimistically update local state
  b. Attempt to send to Supabase
  c. If offline, queue changes locally (IndexedDB)
  d. Resume sync when connection restored

Conflict resolution (Last-Write-Wins):
- Each reading_progress row has marked_complete_at timestamp
- If two devices mark the same section concurrently:
  - Compare timestamps on Supabase
  - Winner (later timestamp) wins
  - Loser client refetches and updates local state

Offline queue:
- Store pending updates in IndexedDB during offline periods
- Use a pendingChanges table: { chapter, section, completed, timestamp }
- On reconnection, batch upload and resolve conflicts

3.3 Authentication Flow

Magic Link:
1. User enters email
2. Supabase Auth sends email with magic link
3. Link opens app with session token
4. App verifies token, creates users record if new
5. User is logged in (persistent session via Supabase)

---
4. UI Structure

4.1 Main Reading View

Primary navigation (linear):
- Current section displayed in full (with scrolling if needed)
- "Previous" / "Next" buttons at bottom
- Checkbox to mark section complete/incomplete
- Small progress indicator (e.g., "3/156 sections complete")

Secondary navigation (chapter/section picker):
- Modal/sidebar with collapsible chapter list
- Click any chapter to jump to section 1 of that chapter
- Click any section within a chapter to jump directly to it
- Visual indicator (checkmark) for completed sections

4.2 Mobile vs. Desktop

- Mobile: Full-width section text, buttons stack vertically
- Desktop: Optional sidebar with chapter picker always visible
- Responsive design (Tailwind + mobile-first)

4.3 Navigation Context

Current location always shown: "Chapter X, Section Y"

---
5. User Flows

5.1 Happy Path: Mark Complete

1. User opens app (auto-login if session exists)
2. Lands on last viewed section (or section 1 on first visit)
3. Reads section text
4. Clicks "Mark Complete" checkbox
5. UI updates immediately (optimistic)
6. Supabase syncs in background
7. Next/previous button jumps to next unread section

5.2 Jump Between Sections

1. User clicks chapter picker (button/icon in header)
2. Modal/sidebar opens showing all chapters
3. User clicks chapter → jumps to section 1 of that chapter
4. Or clicks specific section → jumps directly to it
5. Modal closes, section loads

5.3 Unmark a Section

1. User views a completed section (has checkmark)
2. Clicks checkbox to unmark
3. completed flips to false, syncs to Supabase
4. Progress counter updates

5.4 Offline Usage

1. User marks sections complete while offline
2. Changes queued in IndexedDB (no network call)
3. When connection returns, app detects and syncs queued changes
4. Conflicts resolved by timestamp (last-write-wins)

5.5 Reset Progress

1. User clicks "Settings" or "Reset" button
2. Confirmation modal: "Delete all progress? This cannot be undone."
3. User confirms
4. All reading_progress rows for that user deleted
5. Local state reset, UI returns to section 1

5.6 Cross-Device Sync

1. User marks section 5 complete on phone
2. Desktop app (already open or opens later) receives real-time update via Supabase subscription
3. Section 5 shows checkmark on desktop automatically
4. If user was viewing section 5 on desktop, it updates in place

---
6. Data Persistence & Syncing

Local State Management

- React Context + hooks for reading progress
- IndexedDB for offline queue (pendingChanges)

Sync Logic

┌─────────────────┐
│  User Action    │
└────────┬────────┘
         │
         ├─→ Update Local State (optimistic)
         │
         ├─→ Check Connection
         │   ├─ Online: POST to Supabase (via RPC/update)
         │   └─ Offline: Queue to IndexedDB
         │
         └─→ Listen for Real-Time Updates
             └─ Other devices' changes sync automatically

Supabase Functions

- mark_section_complete(chapter, section, completed) — RPC that handles insert/update with conflict resolution
- Row-level security (RLS): Users can only see/modify their own progress

---
7. Edge Cases & Conflict Resolution

Concurrent Edits (Last-Write-Wins)

- Scenario: User marks section 5 complete on phone at 10:00:01, and desktop at 10:00:02 (before sync).
- Resolution: Both devices attempt update. Supabase keeps row with latest marked_complete_at timestamp (10:00:02). Other device refetches and sees the desktop's version won.

Offline then Reconnect

- Scenario: User marks sections 5, 6, 7 offline. Reconnects.
- Resolution: App batches all 3 updates and sends to Supabase. If conflicts exist (e.g., section 5 was also marked on another device), last-write-wins applies.

Unmarking Sections

- Simply flip completed to false. Timestamp updates. Syncs normally.

Reset During Sync

- Scenario: User hits reset while offline changes are queued.
- Resolution: Delete all rows from reading_progress, clear IndexedDB queue. Next sync on reconnect finds nothing to upload.

Session Loss

- If user logs out, session cleared. On next login, data refetches. No progress loss (stored on Supabase).

---
8. Authentication & Security

Passwordless Magic Link

- Email-based login via Supabase Auth
- No passwords stored
- Session tokens stored in cookies (secure, httpOnly if possible in Next.js)

Row-Level Security (RLS)

-- reading_progress table
CREATE POLICY reading_progress_users_can_read_own
  ON reading_progress
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY reading_progress_users_can_insert_own
  ON reading_progress
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reading_progress_users_can_update_own
  ON reading_progress
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY reading_progress_users_can_delete_own
  ON reading_progress
  FOR DELETE
  USING (user_id = auth.uid());

---
9. Tech Stack & Dependencies

Frontend

- Next.js 14+ (App Router)
- React 18+
- TailwindCSS (styling)
- Supabase Client (real-time, auth)
- IndexedDB (offline queue, no extra lib needed or use idb)

Backend

- Supabase (PostgreSQL + Auth + Realtime)
- RLS for authorization

Deployment

- Vercel (Next.js hosting)
- Supabase (Cloud or self-hosted)

---
10. Project Structure

wcf-reading-tracker/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (main reading view)
│   ├── auth/
│   │   └── callback.tsx (magic link redirect)
│   └── api/
│       └── (optional: internal endpoints if needed)
├── components/
│   ├── ReadingView.tsx (section text + navigation)
│   ├── ChapterPicker.tsx (secondary nav modal/sidebar)
│   ├── ProgressBar.tsx
│   └── ResetConfirmation.tsx
├── lib/
│   ├── contentLoader.ts (WCF content abstraction)
│   ├── supabaseClient.ts
│   ├── offlineQueue.ts (IndexedDB helpers)
│   ├── syncManager.ts (orchestrates sync)
│   └── authHelpers.ts
├── hooks/
│   ├── useReadingProgress.ts (fetch + real-time subscribe)
│   ├── useOfflineQueue.ts
│   └── useSync.ts
├── public/
│   └── wcf-content.json (or fetch from external source)
├── SPEC.md (this file)
└── README.md

---
11. Future Considerations (Out of Scope)

- Public progress sharing
- Notes/annotations on sections
- Reading streaks or gamification
- Mobile app (native)
- Collaboration (reading together)
- Multiple reading plans
- Content versioning/updates

---
12. Success Criteria

✓ Users can mark sections complete in any order
✓ Progress persists across devices in real-time
✓ Offline marking works and syncs on reconnect
✓ Last-write-wins conflict resolution
✓ Unmarking sections supported
✓ Reset with confirmation works
✓ Linear (next/prev) and chapter/section picker navigation
✓ Full section text displayed at once (scrolling OK)
✓ Passwordless magic link auth
✓ Mobile-friendly responsive design
✓ Deployed to Vercel + Supabase

---
