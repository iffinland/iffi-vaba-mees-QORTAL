# Iffi Vaba Mees Project Roadmap

Last updated: 2026-11-20

## Purpose

This file keeps the current product direction, implementation decisions, and task status in one place so future work can continue without rediscovering the project state.

The website should remain a Qortal/QDN-powered personal website with modal-based publishing tools. It should not become a traditional WordPress/Joomla-style CMS.

## Working Rules

- Keep the current frontend layout mostly intact for now.
- Add features through the existing React + QDN publishing pattern.
- Keep user-facing project content in English.
- Use Estonian only when communicating directly with the project owner.
- Owner-only publishing controls should be shown only for the Qortal name `iffi vaba mees`.
- Prefer short QDN identifier prefixes because long prefixes can conflict with longer titles.

## Current Architecture Summary

- Framework: Vite + React.
- Routing: React Router with `HashRouter`.
- Dynamic publishing covers the blog, projects, the life storybook, videos, galleries, comments, likes, and guestbook entries.
- Existing dynamic content is stored through Qortal/QDN `DOCUMENT`, `IMAGE`, `VIDEO`, `THUMBNAIL`, and `FILE` resources.
- Static content still exists in React code and data files, especially home page text, post pages, and projects.

## QDN Prefix Decisions

- Blog posts: `ivm_blog_`
- Blog comments: `ivm_bc_`
- Blog likes: `ivm_bl_`
- Project entries: `ivm_prj_`
- Life story entries: `ivm_ls_`
- Gallery metadata: `iffivabamees_gallery_`
- Video metadata: `iffivabamees_video_`
- Inline rich text attachments: `ivm_att_`

## Phase 1: Blog

Status: Implemented

Goal: Replace the external Q-Blog navigation link with an internal blog section that works like the existing video and gallery sections.

Routes:

- `/blog`
- `/blog/:postId`

Implementation files:

- `src/pages/BlogPage/BlogPage.jsx`
- `src/pages/BlogPage/BlogPage.module.css`
- `src/pages/BlogDetailPage/BlogDetailPage.jsx`
- `src/pages/BlogDetailPage/BlogDetailPage.module.css`
- `src/components/blog/BlogCard.jsx`
- `src/components/blog/BlogCard.module.css`
- `src/components/blog/BlogPublishModal.jsx`
- `src/components/blog/BlogPublishModal.module.css`
- `src/hooks/useBlogPosts.js`
- `src/hooks/useBlogComments.js`
- `src/services/blogService.js`
- `src/services/blogEngagementService.js`

Blog post fields:

- `id`
- `identifier`
- `title`
- `excerpt`
- `contentHtml`
- `category`
- `tags`
- `publishedDate`
- `coverResource`
- `coverUrl`
- `authorName`
- `authorAddress`
- `created`
- `updated`

Blog page features:

- List blog posts from QDN. Implemented.
- Search by title, excerpt, body text, and tags. Implemented.
- Filter by category. Implemented.
- Sort newest/oldest. Implemented.
- Owner-only `Publish post` button. Implemented.
- Detail page with owner-only `Edit post`. Implemented.
- Publish and edit using the shared rich text editor with inline attachments. The owner verified the update in Qortal.
- Reuse the existing comments/likes pattern where practical. Implemented.
- Only trust blog posts published by the owner name `iffi vaba mees`. Implemented through QDN summary owner filtering.

Implementation notes:

- Use `ivm_blog_` as the QDN identifier prefix.
- Keep the blog implementation close to `videoService.js` and `galleryService.js`.
- Sanitize rich text before rendering it in blog posts, project descriptions, story chapters, gallery descriptions, and video descriptions.
- Replace the current Q-Blog external nav link with an internal `/blog` route. Implemented.

Blog implementation notes:

- Blog comments use `ivm_bc_`.
- Blog likes use `ivm_bl_`.
- Blog cover images use QDN `THUMBNAIL`.
- Blog post identifiers are capped around the current QDN identifier length pattern and use the short `ivm_blog_` prefix.
- `npm run build` and `npm run lint` pass after the blog implementation.

## Phase 2: Projects

Status: Implemented

Goal: Keep the current projects overview page, but make the two main choices open richer project sections.

Preferred direction: project portfolio / roadmap board, not a blog clone.

Routes:

- `/projects`
- `/projects/own`
- `/projects/collaboration`
- `/projects/item/:projectId`

Project fields:

- `title`
- `slug`
- `type`: `own` or `collaboration`
- `status`: `idea`, `active`, `paused`, `released`, or similar
- `summary`
- `descriptionHtml`
- `coverResource`
- `coverUrl`
- `role`
- `goals`
- `roadmap`
- `links`
- `created`
- `updated`

Design direction:

- `/projects` remains a general introduction. Implemented.
- `My Own Projects` opens a list/detail section for projects created by the owner. Implemented.
- `Collaboration Projects` opens a separate list/detail section for projects where the owner contributes. Implemented.
- Each project should show its purpose, current status, role, plans, and useful links. Implemented.

Project implementation notes:

- Project entries use QDN `DOCUMENT` resources with prefix `ivm_prj_`.
- Project cover images use QDN `THUMBNAIL`.
- Project sections support owner-only publish buttons.
- Project detail pages support owner-only editing.
- Current project statuses: `idea`, `active`, `paused`, `released`.
- Current project types: `own`, `collaboration`.

Open questions:

- Should project entries support comments?
- Should projects have progress updates as separate child entries?
- Should collaboration projects show contributor roles or only the owner's role?

## Phase 3: Life Storybook

Status: Implemented

Goal: Build a separate book-like chronological reading experience for life story entries.

Preferred direction: memoir / chronological book, not a standard blog list.

Routes:

- `/storybook`
- `/storybook/:entryId`

Story entry fields:

- `title`
- `storyDate`
- `year`
- `month`
- `contentHtml`
- `coverResource`
- `coverUrl`
- `location`
- `periodLabel`
- `created`
- `updated`

Core behavior:

- The owner can add story entries in any writing order. Implemented.
- Visitors always see entries sorted chronologically by life date. Implemented.
- Layout should feel like reading a book or memoir. Implemented baseline.
- A timeline or chapter navigation can help readers move through life periods. Implemented as a year rail in entry cards.

Life story implementation notes:

- Life story entries use QDN `DOCUMENT` resources with prefix `ivm_ls_`.
- Story cover images use QDN `THUMBNAIL`.
- Story entries support year, optional month, optional day, optional custom period label, and optional location.
- Sorting uses the life period, not publish time.
- Storybook list supports search and pagination.
- Story detail pages support owner-only editing.

Open layout ideas:

- Book page reading view.
- Timeline plus chapter content.
- Year/month grouped chapter list.
- Optional images per chapter.

## Future Cleanup

- Move remaining hardcoded static content into QDN-backed content models over time.
- Centralize owner-name checks so `iffi vaba mees` is not duplicated across pages.
- Consider extracting common QDN publishing helpers to reduce duplication across video, gallery, blog, and future content types.
- Add focused tests for content sanitization and identifier generation.

## Galleries and rich text

- Gallery uploads publish the original image as base64 to QDN `IMAGE`; each image has a separate `THUMBNAIL`. Creating galleries with images and adding images to existing galleries passed the owner’s runtime test.
- The shared publishing editor adds emoji, text color, highlighting, and inline file references. The comment editor retains the basic toolbar.
- Inline images and videos use QDN `IMAGE` and `VIDEO`. Text documents and ZIP archives use `FILE`. The published markup stores references so the app can resolve attachments on the reader’s node.
- Rich text attachment behavior passed the owner’s runtime test.

## Reusable UI Notes

- Footer social actions are implemented as a standalone `FooterSocialBar` component.
- Footer social action state and link definitions live in `useFooterSocialActions`.
- Current footer actions: Q-Blog, Q-Tube, Q-Music, Q-Mail, and Let's chat.
- The Let's chat footer action reuses `DirectMessageModal`.
- Header audience actions are implemented as a standalone `AudienceActions` component above the main navigation.
- Header audience action state lives in `useAudienceActions`.
- Current header audience actions: Follow and By Me a Pizza.
- Follow adds the configured website names to Qortal's `followedNames` list through `ADD_LIST_ITEMS`.
- By Me a Pizza opens `/support`. Presets are 5, 10, and 25 QORT; custom amounts start at 1 QORT. The app resolves the address of its registered publisher and lets the Qortal wallet confirm and send the one-time payment. It publishes no support records to QDN.
- The owner verified the payment flow in Qortal.

## Current Verification Baseline

As of 2026-11-20:

- `npm run build` passes.
- `npm run lint` passes.
- `node --test tests/gallery-publishing.test.mjs` passes.
- The [README](README.md) gives the stable download link for the latest approved app ZIP.
