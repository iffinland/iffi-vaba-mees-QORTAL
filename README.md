# iffi vaba mees

A personal website and Q-App on the Qortal Data Network. It includes a blog, photo galleries, videos, a project portfolio, a life storybook, a guestbook, and voluntary QORT contributions.

**[Download the latest Qortal app ZIP](https://github.com/iffinland/iffi-vaba-mees-QORTAL/raw/refs/heads/main/downloads/iffi-vaba-mees-latest.zip)**. The link always points to the current approved build on `main`. Use this ZIP as-is when publishing or updating the Qortal `APP` resource. In Qortal, open `qortal://APP/iffi%20vaba%20mees` to visit the deployed app.

## Using the app

- **Publishing:** Sign in with the publishing name `iffi vaba mees` to use the publishing and edit controls. On a gallery, add up to ten new photos per save, set their captions, and arrange them before publishing.
- **Rich text:** The blog, storybook, project, gallery, and video editors support emoji, text color, highlighting, and inline file attachments. The comment composer keeps its basic formatting tools.
- **Attachments:** Photos open from a thumbnail. Videos play inline and can be viewed fullscreen. Text and DOCX files can be previewed and downloaded. ZIP files can be downloaded. One save accepts up to ten new attachments. Per-file limits are 5 MiB for images and text documents, 100 MiB for video, and 50 MiB for ZIP files.
- **By Me a Pizza:** Choose a slice (5 QORT), half a pizza (10 QORT), a whole pizza (25 QORT), or pizza boxes (any amount from 1 QORT). Confirm the one-time payment and network fee in the Qortal wallet. The gift goes to the wallet that owns the registered publishing name.

## Development

Use Node.js 22.12 or later with npm.

```sh
npm ci
npm run dev
```

Use a Qortal client for actions that depend on the Qortal bridge, including QDN publishing and wallet payments. Run the following checks before packaging:

```sh
npm run lint
node --test tests/gallery-publishing.test.mjs
npm run build
```

The production build is written to `dist/`. The app ZIP must contain `index.html` at its root, alongside the assets.

## Updating the download

After runtime approval, update `downloads/iffi-vaba-mees-latest.zip` on `main` in the same commit as the approved source and release notes. Copy the tested ZIP there, or verify that the files in a fresh build match that ZIP. Leave the download URL unchanged so existing links continue to serve the latest build.

See the [changelog](CHANGELOG.md) for release notes and the [project roadmap](PROJECT_ROADMAP.md) for routes, QDN conventions, and future work.
