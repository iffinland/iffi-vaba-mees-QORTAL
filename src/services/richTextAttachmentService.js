import { requestQortal } from '../utils/qortalClient';
import { sanitizeHtml } from '../utils/htmlSanitizer';
import {
  ATTACHMENT_SELECTOR, ATTACHMENT_SERVICES, MAX_ATTACHMENTS, MAX_ATTACHMENT_MB, readAttachment,
} from '../utils/richTextAttachments';

const browserMiB = 1024 * 1024;
const publishedFiles = new WeakMap();

export const validateAttachmentFile = (file, kind) => {
  if (!kind) throw new Error(`${file.name}: unsupported attachment format.`);
  if (!file.size) throw new Error(`${file.name}: this file is empty.`);
  const limit = MAX_ATTACHMENT_MB[kind];
  if (file.size > limit * browserMiB) {
    throw new Error(`${file.name}: maximum size is ${limit} MB.`);
  }
};

const asBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = () => reject(reader.error || new Error('File could not be read.'));
  reader.onabort = () => reject(new Error('File reading was cancelled.'));
  reader.readAsDataURL(file);
});

export const publishRichText = async (html, files, authorName) => {
  const sanitized = sanitizeHtml(html);
  if (!files?.size) return sanitized;

  const template = document.createElement('template');
  template.innerHTML = sanitized;
  const attachments = new Map();
  for (const node of template.content.querySelectorAll(ATTACHMENT_SELECTOR)) {
    const attachment = readAttachment(node);
    if (attachment && files.has(attachment.id)) attachments.set(attachment.id, attachment);
  }
  if (attachments.size > MAX_ATTACHMENTS) {
    throw new Error(`Select at most ${MAX_ATTACHMENTS} new attachments per publish.`);
  }

  for (const { id, kind, filename } of attachments.values()) {
    const file = files.get(id);
    if (file.name !== filename) throw new Error('An attachment filename changed. Add the file again.');
    validateAttachmentFile(file, kind);
  }

  for (const { id, kind, filename } of attachments.values()) {
    const file = files.get(id);
    const published = publishedFiles.get(file) ?? new Set();
    const resourceKey = JSON.stringify([authorName, id]);
    if (published.has(resourceKey)) continue;

    try {
      // The base64 path avoids the multipart failure observed for gallery images.
      const data = file.size <= 5 * browserMiB
        ? { data64: await asBase64(file), encoding: 'base64' }
        : { file };
      const result = await requestQortal({
        action: 'PUBLISH_QDN_RESOURCE', name: authorName,
        service: ATTACHMENT_SERVICES[kind], identifier: id,
        filename, title: Array.from(filename).slice(0, 60).join(''),
        ...data,
      });
      if (!result || result.error) throw new Error(result?.error || 'Qortal did not confirm publishing.');
      published.add(resourceKey);
      publishedFiles.set(file, published);
    } catch (error) {
      throw new Error(`${filename}: ${error?.message || error || 'Unable to publish attachment.'}`, { cause: error });
    }
  }

  return sanitized;
};
