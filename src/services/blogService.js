import { publishRichText } from './richTextAttachmentService';
import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';
import { APP_QORTAL_NAME, isOwnerName, OWNER_QORTAL_NAME } from '../utils/siteConfig';
import { getQdnResourceUrl } from './qdnResourceService';
import { getCurrentUserProfile } from './videoService';

export { getCurrentUserProfile };

export const BLOG_METADATA_PREFIX = 'ivm_blog_';
const BLOG_SERVICE = 'DOCUMENT';
const COVER_SERVICE = 'THUMBNAIL';
const MAX_QDN_IDENTIFIER_LENGTH = 60;
const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_COVER_BYTES = 500000;
const COVER_CANVAS_MAX_SIZE = 1600;
const MAX_QDN_METADATA_TITLE_LENGTH = 80;
const MAX_QDN_METADATA_DESCRIPTION_LENGTH = 240;

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

const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toQdnMetadataText = (value, maxLength) => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const toQdnTitle = (value, fallback) =>
  toQdnMetadataText(value || fallback, MAX_QDN_METADATA_TITLE_LENGTH) || fallback;

const toQdnDescription = (value, fallback = '') =>
  toQdnMetadataText(value || fallback, MAX_QDN_METADATA_DESCRIPTION_LENGTH);

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12);
  }

  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve blog resource URL', resource.identifier, error);
    return '';
  }
};

export const buildBlogIdentifier = ({ title, authorName }) => {
  const rawBase =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'post';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_QDN_IDENTIFIER_LENGTH - BLOG_METADATA_PREFIX.length - suffix.length - 1,
  );
  const base = rawBase.slice(0, maxBaseLength).replace(/-+$/g, '') || 'post';

  return `${BLOG_METADATA_PREFIX}${base}_${suffix}`;
};

export const sanitizeBlogPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(BLOG_METADATA_PREFIX)) {
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
  const excerpt =
    typeof payload.excerpt === 'string' && payload.excerpt.trim()
      ? payload.excerpt.trim()
      : toQdnDescription(contentText, '');
  const created = Number(payload.created ?? summary.created ?? Date.now());

  return {
    id: identifier,
    identifier,
    title,
    excerpt,
    contentHtml,
    contentText,
    category: typeof payload.category === 'string' ? payload.category.trim() : '',
    tags: normalizeTags(payload.tags),
    publishedDate: normalizeDate(payload.publishedDate) || normalizeDate(created),
    coverResource: payload.coverResource || null,
    coverUrl: typeof payload.coverUrl === 'string' ? payload.coverUrl : '',
    authorName: OWNER_QORTAL_NAME,
    authorAddress: typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
  };
};

const fetchSummaries = async ({ limit, offset, sortOrder }) =>
  requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: BLOG_SERVICE,
    mode: 'ALL',
    identifier: BLOG_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchBlogPostFromSummary = async (summary) => {
  if (!isOwnerName(summary?.name)) return null;

  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: BLOG_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  const post = sanitizeBlogPayload(resource ?? {}, summary);
  if (!post?.coverResource || post.coverUrl) {
    return post;
  }

  return {
    ...post,
    coverUrl: await resolveResourceUrl(post.coverResource),
  };
};

export const fetchBlogByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: BLOG_SERVICE,
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

  return fetchBlogPostFromSummary(ownerSummary);
};

export const fetchBlogPage = async ({
  page = 1,
  pageSize = 9,
  category = '',
  searchQuery = '',
  sortOrder = 'newest',
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();
  const offset = Math.max(0, page - 1) * pageSize;

  if (normalizedQuery || normalizedCategory) {
    const matches = [];
    let qdnOffset = 0;
    let hasMore = true;
    const scanLimit = 50;
    const requiredMatches = offset + pageSize + 1;

    while (hasMore && matches.length < requiredMatches) {
      const summaries = await fetchSummaries({
        limit: scanLimit,
        offset: qdnOffset,
        sortOrder,
      });
      const pageItems = Array.isArray(summaries) ? summaries : [];
      if (!pageItems.length) break;

      for (const summary of pageItems) {
        try {
          const post = await fetchBlogPostFromSummary(summary);
          if (!post) continue;

          const searchable = `${post.title} ${post.excerpt} ${post.contentText} ${post.tags.join(' ')}`.toLowerCase();
          const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
          const matchesCategory =
            !normalizedCategory || post.category.toLowerCase() === normalizedCategory;

          if (matchesQuery && matchesCategory) {
            matches.push(post);
          }
        } catch (error) {
          console.error('Failed to fetch blog post metadata', summary?.identifier, error);
        }
      }

      hasMore = pageItems.length === scanLimit;
      qdnOffset += pageItems.length;
    }

    return {
      posts: matches.slice(offset, offset + pageSize),
      hasNextPage: matches.length > offset + pageSize,
    };
  }

  const posts = [];
  let ownerPostCount = 0;
  let qdnOffset = 0;
  let hasMore = true;
  const scanLimit = 50;

  while (hasMore && posts.length < pageSize + 1) {
    const summaries = await fetchSummaries({
      limit: scanLimit,
      offset: qdnOffset,
      sortOrder,
    });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summary of pageItems) {
      try {
        const post = await fetchBlogPostFromSummary(summary);
        if (!post) continue;

        if (ownerPostCount >= offset) {
          posts.push(post);
        }
        ownerPostCount += 1;

        if (posts.length >= pageSize + 1) break;
      } catch (error) {
        console.error('Failed to fetch blog post metadata', summary?.identifier, error);
      }
    }

    hasMore = pageItems.length === scanLimit;
    qdnOffset += pageItems.length;
  }

  return {
    posts: posts.slice(0, pageSize),
    hasNextPage: posts.length > pageSize,
  };
};

export const fetchBlogCategories = async () => {
  const categories = new Set();
  let offset = 0;
  const scanLimit = 50;

  while (true) {
    const summaries = await fetchSummaries({
      limit: scanLimit,
      offset,
      sortOrder: 'newest',
    });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summary of pageItems) {
      try {
        const post = await fetchBlogPostFromSummary(summary);
        if (post?.category) {
          categories.add(post.category);
        }
      } catch (error) {
        console.error('Failed to fetch blog category metadata', summary?.identifier, error);
      }
    }

    if (pageItems.length < scanLimit) break;
    offset += pageItems.length;
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
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
    title: toQdnTitle(title, 'Blog cover'),
    description: toQdnDescription(`Cover image for ${title || 'blog post'}`),
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

export const publishBlogPost = async ({ form, authorName, authorAddress }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can publish blog posts.');
  }

  const contentHtml = await publishRichText(form.contentHtml, form.attachments, authorName);

  const now = Date.now();
  const identifier = buildBlogIdentifier({ title: form.title, authorName });
  const cover = await publishCover({
    file: form.coverFile,
    identifier,
    authorName,
    title: form.title,
  });

  const payload = sanitizeBlogPayload(
    {
      id: identifier,
      identifier,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml,
      contentText: toPlainText(contentHtml),
      category: form.category,
      tags: normalizeTags(form.tags),
      publishedDate: form.publishedDate,
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
    service: BLOG_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: toQdnTitle(payload.title, 'Untitled blog post'),
    description: toQdnDescription(payload.excerpt || payload.contentText, 'Blog post'),
  });

  return payload;
};

export const updateBlogPost = async ({ post, form, authorName }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can edit blog posts.');
  }

  const contentHtml = await publishRichText(form.contentHtml, form.attachments, authorName);

  let coverResource = post.coverResource || null;
  let coverUrl = post.coverUrl || '';

  if (form.coverFile) {
    const cover = await publishCover({
      file: form.coverFile,
      identifier: post.identifier,
      authorName,
      title: form.title || post.title,
    });
    coverResource = cover.coverResource || coverResource;
    coverUrl = cover.coverUrl || coverUrl;
  }

  const updatedPost = sanitizeBlogPayload(
    {
      ...post,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml,
      contentText: toPlainText(contentHtml),
      category: form.category,
      tags: normalizeTags(form.tags),
      publishedDate: form.publishedDate,
      coverResource,
      coverUrl,
      updated: Date.now(),
    },
    { name: authorName, identifier: post.identifier },
  );

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: BLOG_SERVICE,
    identifier: updatedPost.identifier,
    data64: encodeObjectToBase64(updatedPost),
    encoding: 'base64',
    title: toQdnTitle(updatedPost.title, 'Untitled blog post'),
    description: toQdnDescription(updatedPost.excerpt || updatedPost.contentText, 'Blog post'),
  });

  return updatedPost;
};

export const buildBlogPageLink = (post) =>
  `qortal://APP/${encodeURIComponent(APP_QORTAL_NAME)}#/blog/${encodeURIComponent(post.identifier)}`;
