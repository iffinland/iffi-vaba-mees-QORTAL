import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

let server;
let galleryService;
let calls;
let readFailure;
let publishFailure;

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  galleryService = await server.ssrLoadModule('/src/services/galleryService.js');
  // Browser file/canvas APIs and the wallet bridge are simulated; no live publishes.
  globalThis.FileReader = class {
    readAsDataURL(file) {
      if (readFailure) return this.onerror();
      this.result = `data:${file.type};base64,${Buffer.from(file.bytes).toString('base64')}`;
      this.onload();
    }
  };
  globalThis.Image = class {
    width = 600;
    height = 400;
    set src(_value) { this.onload(); }
  };
  globalThis.document = {
    createElement: (tag) => tag === 'template' ? { content: { children: [] } } : ({
      getContext: () => ({ drawImage() {} }),
      toDataURL: () => 'data:image/jpeg;base64,/9j/AA==',
    }),
  };
  globalThis.qortalRequest = async (payload) => {
    calls.push(payload);
    if (payload.action === 'GET_QDN_RESOURCE_URL') return `blob:${payload.identifier}`;
    if (payload.service === 'IMAGE') {
      assert.equal(typeof payload.data64, 'string');
      assert.equal(payload.encoding, 'base64');
      assert.equal('file' in payload, false, 'must not enter the failing chunk-upload path');
      if (publishFailure) throw new Error('Node unavailable');
    }
    return { name: payload.name, identifier: payload.identifier };
  };
});
after(async () => {
  await server?.close();
  for (const key of ['FileReader', 'Image', 'document', 'qortalRequest']) delete globalThis[key];
});
beforeEach(() => {
  calls = [];
  readFailure = false;
  publishFailure = false;
});

const makeFile = (bytes = [0, 255, 128, 1, 2, 13, 10]) => {
  const file = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  file.name = 'photo.png';
  file.bytes = bytes;
  return file;
};
const makeForm = (files = [makeFile()]) => ({
  title: 'Gallery', descriptionHtml: '<p>Photos</p>', coverFile: null,
  existingImages: [], images: files.map((file, index) => ({ file, description: `Photo ${index}` })),
});
const publish = (form) => galleryService.publishGallery({ form, authorName: 'iffi', authorAddress: 'Q-address' });
const metadata = () => JSON.parse(Buffer.from(calls.findLast((call) => call.service === 'DOCUMENT').data64, 'base64').toString());

test('new gallery preserves original binary images and publishes metadata after images and thumbnails', async () => {
  const files = [makeFile(), makeFile([255, 216, 0, 240])];
  const gallery = await publish(makeForm(files));
  const imageCalls = calls.filter((call) => call.action === 'PUBLISH_QDN_RESOURCE' && call.service === 'IMAGE');
  assert.equal(imageCalls.length, 2);
  imageCalls.forEach((call, index) => {
    assert.deepEqual([...Buffer.from(call.data64, 'base64')], files[index].bytes);
    assert.equal(call.filename, 'photo.png');
    assert.equal(call.name, 'iffi');
  });
  assert.equal(gallery.images.length, 2);
  assert.deepEqual(metadata().images.map((image) => image.description), ['Photo 0', 'Photo 1']);
  assert.equal(metadata().coverResource.identifier, gallery.images[0].thumbnailResource.identifier);
  assert.equal(calls.at(-1).service, 'DOCUMENT');
});

test('editing retains existing images and appends the new image to the same gallery', async () => {
  const original = await publish(makeForm());
  calls = [];
  const form = makeForm();
  form.existingImages = original.images;
  const updated = await galleryService.updateGallery({ gallery: original, form, authorName: 'iffi' });
  assert.equal(updated.identifier, original.identifier);
  assert.equal(updated.images.length, 2);
  assert.deepEqual(updated.images[0], original.images[0]);
  assert.equal(calls.filter((call) => call.action === 'PUBLISH_QDN_RESOURCE' && call.service === 'IMAGE').length, 1);
  assert.deepEqual(metadata().images.map((image) => image.order), [0, 1]);
});

test('file read failure stops before publishing any resource', async () => {
  readFailure = true;
  await assert.rejects(publish(makeForm()), /could not be read/);
  assert.equal(calls.length, 0);
});

test('image publish failure stops before publishing gallery metadata', async () => {
  publishFailure = true;
  await assert.rejects(publish(makeForm()), /Node unavailable/);
  assert.equal(calls.filter((call) => call.service === 'DOCUMENT').length, 0);
});

test('empty gallery can still be created without image uploads', async () => {
  const gallery = await publish(makeForm([]));
  assert.equal(gallery.images.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, 'DOCUMENT');
});
