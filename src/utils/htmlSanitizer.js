import { cleanAttachmentElement, readAttachment } from './richTextAttachments';

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'font', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'u', 'ul',
]);
const DROP_TAGS = new Set(['embed', 'iframe', 'object', 'script', 'style', 'template']);
const LINK_ATTRS = new Set(['href', 'title', 'target', 'rel']);
const COLOR = /^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;
const SAFE_URL = /^(?:https?:\/\/|qortal:\/\/|mailto:)/i;

export const sanitizeHtml = (html = '') => {
  const source = String(html || '');
  if (!source || typeof document === 'undefined') return '';

  const template = document.createElement('template');
  template.innerHTML = source;

  const clean = (parent) => {
    for (const element of Array.from(parent.children)) {
      const tag = element.localName;
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || DROP_TAGS.has(tag)) {
        element.remove();
        continue;
      }
      clean(element);
      if (!ALLOWED_TAGS.has(tag)) {
        element.replaceWith(...element.childNodes);
        continue;
      }

      const attachment = readAttachment(element);
      const color = element.style.color || (tag === 'font' ? element.getAttribute('color') || '' : '');
      const background = element.style.backgroundColor;
      for (const { name } of Array.from(element.attributes)) {
        if (tag !== 'a' || !LINK_ATTRS.has(name)) element.removeAttribute(name);
      }

      if (attachment) {
        cleanAttachmentElement(element, attachment);
      } else {
        if (COLOR.test(color)) element.style.color = color;
        if (COLOR.test(background)) element.style.backgroundColor = background;
      }

      if (tag === 'a') {
        const href = element.getAttribute('href');
        if (!href || !SAFE_URL.test(href.trim())) {
          element.removeAttribute('href');
          element.removeAttribute('target');
          element.removeAttribute('rel');
        } else {
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
        }
      }
    }
  };

  clean(template.content);
  return template.innerHTML;
};
