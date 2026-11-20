export const ATTACHMENT_SELECTOR = 'span[data-attachment][data-kind]';
export const ATTACHMENT_SERVICES = {
  image: 'IMAGE',
  video: 'VIDEO',
  text: 'FILE',
  zip: 'FILE',
};

const extensions = {
  image: /\.(?:jpe?g|png|gif|webp|avif|bmp|ico)$/i,
  video: /\.(?:mp4|webm|mov|m4v|ogv)$/i,
  text: /\.(?:txt|md|csv|tsv|log|json|xml|docx)$/i,
  zip: /\.zip$/i,
};

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_MB = { image: 5, video: 100, text: 5, zip: 50 };
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,.ico,video/mp4,video/webm,video/quicktime,.m4v,.ogv,.txt,.md,.csv,.tsv,.log,.json,.xml,.docx,.zip';

export const getAttachmentKind = (filename) =>
  Object.keys(extensions).find((kind) => extensions[kind].test(filename));

export const readAttachment = (element) => {
  if (!element.matches?.(ATTACHMENT_SELECTOR)) return null;
  const id = element.getAttribute('data-attachment');
  const kind = element.getAttribute('data-kind');
  const filename = element.textContent.trim();
  if (!/^ivm_att_[a-z0-9]{20,40}$/.test(id) || filename.length > 255 ||
      /[\\/]/.test(filename) || Array.from(filename).some((char) => char.charCodeAt(0) < 32) || getAttachmentKind(filename) !== kind) return null;
  return { id, kind, filename };
};

export const cleanAttachmentElement = (element, { id, kind, filename }) => {
  element.setAttribute('data-attachment', id);
  element.setAttribute('data-kind', kind);
  element.setAttribute('contenteditable', 'false');
  element.textContent = filename;
};
