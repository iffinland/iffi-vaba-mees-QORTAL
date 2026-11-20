import { publishRichText } from './richTextAttachmentService';
import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';
import { isOwnerName, OWNER_QORTAL_NAME } from '../utils/siteConfig';
import { getQdnResourceUrl } from './qdnResourceService';
import { getCurrentUserProfile } from './videoService';

export { getCurrentUserProfile };

export const LIFE_STORY_PREFIX = 'ivm_ls_';
const LIFE_STORY_SERVICE = 'DOCUMENT';
const COVER_SERVICE = 'THUMBNAIL';
const MAX_QDN_IDENTIFIER_LENGTH = 60;
const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_COVER_BYTES = 500000;
const COVER_CANVAS_MAX_SIZE = 1600;

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const loadImageFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cover image could not be processed.'));
    };
    image.src = url;
  });

const getBase64ByteSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const renderCoverBase64 = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Cover must be an image file.');
  }

  if (file.size > MAX_COVER_UPLOAD_BYTES) {
    throw new Error('Cover image is too large. Maximum upload size is 5 MB.');
  }

  const image = await loadImageFile(file);
  const ratio = Math.min(1, COVER_CANVAS_MAX_SIZE / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cover image processing is not available.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';

      if (getBase64ByteSize(base64) <= MAX_QDN_COVER_BYTES) {
        return base64;
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new Error('Cover image could not be optimized for QDN.');
};

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toQdnText = (value, maxLength) => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const toNumberInRange = (value, min, max, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
};

const buildSortKey = ({ storyYear, storyMonth, storyDay }) => {
  const year = toNumberInRange(storyYear, 1, 9999, 9999);
  const month = toNumberInRange(storyMonth, 1, 12, 1);
  const day = toNumberInRange(storyDay, 1, 31, 1);
  return year * 10000 + month * 100 + day;
};

export const formatStoryPeriod = ({ storyYear, storyMonth, storyDay, periodLabel }) => {
  if (periodLabel) return periodLabel;
  const year = toNumberInRange(storyYear, 1, 9999, 0);
  const month = toNumberInRange(storyMonth, 1, 12, 0);
  const day = toNumberInRange(storyDay, 1, 31, 0);

  if (!year) return 'Unknown period';
  if (month && day) return `${MONTH_NAMES[month]} ${day}, ${year}`;
  if (month) return `${MONTH_NAMES[month]} ${year}`;
  return `${year}`;
};

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve life story resource URL', resource.identifier, error);
    return '';
  }
};

export const buildLifeStoryIdentifier = ({ title, storyYear, authorName }) => {
  const rawBase =
    sanitizeIdentifierSegment(`${storyYear || ''}-${title || ''}`) ||
    sanitizeIdentifierSegment(authorName) ||
    'story';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_QDN_IDENTIFIER_LENGTH - LIFE_STORY_PREFIX.length - suffix.length - 1,
  );
  const base = rawBase.slice(0, maxBaseLength).replace(/-+$/g, '') || 'story';

  return `${LIFE_STORY_PREFIX}${base}_${suffix}`;
};

export const sanitizeLifeStoryPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(LIFE_STORY_PREFIX)) {
    return null;
  }

  const resourceOwner = typeof summary.name === 'string' ? summary.name : payload.authorName;
  if (!isOwnerName(resourceOwner)) {
    return null;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const contentHtml = typeof payload.contentHtml === 'string' ? payload.contentHtml : '';
  const contentText =
    typeof payload.contentText === 'string' ? payload.contentText : toPlainText(contentHtml);
  const storyYear = toNumberInRange(payload.storyYear, 1, 9999, 0);
  const storyMonth = toNumberInRange(payload.storyMonth, 1, 12, 0);
  const storyDay = toNumberInRange(payload.storyDay, 1, 31, 0);
  const created = Number(payload.created ?? summary.created ?? Date.now());
  const periodLabel =
    typeof payload.periodLabel === 'string' ? payload.periodLabel.trim() : '';

  return {
    id: identifier,
    identifier,
    title,
    contentHtml,
    contentText,
    excerpt:
      typeof payload.excerpt === 'string' && payload.excerpt.trim()
        ? payload.excerpt.trim()
        : toQdnText(contentText, 220),
    storyYear,
    storyMonth,
    storyDay,
    sortKey: buildSortKey({ storyYear, storyMonth, storyDay }),
    periodLabel,
    periodText: formatStoryPeriod({ storyYear, storyMonth, storyDay, periodLabel }),
    location: typeof payload.location === 'string' ? payload.location.trim() : '',
    coverResource: payload.coverResource || null,
    coverUrl: typeof payload.coverUrl === 'string' ? payload.coverUrl : '',
    authorName: OWNER_QORTAL_NAME,
    authorAddress: typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
  };
};

const fetchSummaries = async ({ limit, offset, sortOrder = 'oldest' }) =>
  requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: LIFE_STORY_SERVICE,
    mode: 'ALL',
    identifier: LIFE_STORY_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchEntryFromSummary = async (summary) => {
  if (!isOwnerName(summary?.name)) return null;

  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: LIFE_STORY_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  const entry = sanitizeLifeStoryPayload(resource ?? {}, summary);
  if (!entry?.coverResource || entry.coverUrl) {
    return entry;
  }

  return {
    ...entry,
    coverUrl: await resolveResourceUrl(entry.coverResource),
  };
};

export const fetchLifeStoryByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: LIFE_STORY_SERVICE,
    mode: 'ALL',
    identifier,
    prefix: false,
    limit: 20,
    offset: 0,
    reverse: true,
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

  const ownerSummary = Array.isArray(summaries)
    ? summaries.find((summary) => summary.identifier === identifier && isOwnerName(summary.name))
    : null;
  if (!ownerSummary) return null;

  return fetchEntryFromSummary(ownerSummary);
};

export const fetchLifeStoryEntries = async ({ page = 1, pageSize = 10, searchQuery = '' }) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const entries = [];
  let offset = 0;
  const scanLimit = 50;

  while (true) {
    const summaries = await fetchSummaries({ limit: scanLimit, offset });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summary of pageItems) {
      try {
        const entry = await fetchEntryFromSummary(summary);
        if (!entry) continue;

        const searchable = `${entry.title} ${entry.excerpt} ${entry.contentText} ${entry.periodText} ${entry.location}`.toLowerCase();
        if (!normalizedQuery || searchable.includes(normalizedQuery)) {
          entries.push(entry);
        }
      } catch (error) {
        console.error('Failed to fetch life story entry', summary?.identifier, error);
      }
    }

    if (pageItems.length < scanLimit) break;
    offset += pageItems.length;
  }

  entries.sort((a, b) => a.sortKey - b.sortKey || a.created - b.created);

  const start = Math.max(0, page - 1) * pageSize;
  return {
    entries: entries.slice(start, start + pageSize),
    hasNextPage: entries.length > start + pageSize,
  };
};

const publishCover = async ({ file, identifier, authorName, title }) => {
  if (!file) {
    return {
      coverResource: null,
      coverUrl: '',
    };
  }

  const data64 = await renderCoverBase64(file);
  const response = await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: COVER_SERVICE,
    identifier,
    data64,
    encoding: 'base64',
    title: toQdnText(title || 'Life story cover', 80),
    description: toQdnText(`Cover image for ${title || 'life story entry'}`, 240),
  });

  const coverResource = {
    service: COVER_SERVICE,
    name: response?.name || authorName,
    identifier: response?.identifier || identifier,
    filename: file.name || '',
  };

  return {
    coverResource,
    coverUrl: await resolveResourceUrl(coverResource),
  };
};

export const publishLifeStoryEntry = async ({ form, authorName, authorAddress }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can publish life story entries.');
  }

  const contentHtml = await publishRichText(form.contentHtml, form.attachments, authorName);

  const now = Date.now();
  const identifier = buildLifeStoryIdentifier({
    title: form.title,
    storyYear: form.storyYear,
    authorName,
  });
  const cover = await publishCover({
    file: form.coverFile,
    identifier,
    authorName,
    title: form.title,
  });

  const payload = sanitizeLifeStoryPayload(
    {
      id: identifier,
      identifier,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml,
      contentText: toPlainText(contentHtml),
      storyYear: form.storyYear,
      storyMonth: form.storyMonth,
      storyDay: form.storyDay,
      periodLabel: form.periodLabel,
      location: form.location,
      coverResource: cover.coverResource,
      coverUrl: cover.coverUrl,
      authorName,
      authorAddress,
      created: now,
      updated: now,
    },
    { name: authorName, identifier, created: now, updated: now },
  );

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: LIFE_STORY_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: toQdnText(payload.title, 80) || 'Untitled life story entry',
    description: toQdnText(payload.excerpt || payload.contentText, 240) || 'Life story entry',
  });

  return payload;
};

export const updateLifeStoryEntry = async ({ entry, form, authorName }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can edit life story entries.');
  }

  const contentHtml = await publishRichText(form.contentHtml, form.attachments, authorName);

  let coverResource = entry.coverResource || null;
  let coverUrl = entry.coverUrl || '';

  if (form.coverFile) {
    const cover = await publishCover({
      file: form.coverFile,
      identifier: entry.identifier,
      authorName,
      title: form.title || entry.title,
    });
    coverResource = cover.coverResource || coverResource;
    coverUrl = cover.coverUrl || coverUrl;
  }

  const updatedEntry = sanitizeLifeStoryPayload(
    {
      ...entry,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml,
      contentText: toPlainText(contentHtml),
      storyYear: form.storyYear,
      storyMonth: form.storyMonth,
      storyDay: form.storyDay,
      periodLabel: form.periodLabel,
      location: form.location,
      coverResource,
      coverUrl,
      updated: Date.now(),
    },
    { name: authorName, identifier: entry.identifier },
  );

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: LIFE_STORY_SERVICE,
    identifier: updatedEntry.identifier,
    data64: encodeObjectToBase64(updatedEntry),
    encoding: 'base64',
    title: toQdnText(updatedEntry.title, 80) || 'Untitled life story entry',
    description:
      toQdnText(updatedEntry.excerpt || updatedEntry.contentText, 240) || 'Life story entry',
  });

  return updatedEntry;
};
