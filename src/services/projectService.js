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

export const PROJECT_METADATA_PREFIX = 'ivm_prj_';
const PROJECT_SERVICE = 'DOCUMENT';
const COVER_SERVICE = 'THUMBNAIL';
const MAX_QDN_IDENTIFIER_LENGTH = 60;
const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_COVER_BYTES = 500000;
const COVER_CANVAS_MAX_SIZE = 1600;
const PROJECT_TYPES = new Set(['own', 'collaboration']);
const PROJECT_STATUSES = new Set(['idea', 'active', 'paused', 'released']);

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

const normalizeProjectType = (value) =>
  PROJECT_TYPES.has(value) ? value : 'own';

const normalizeProjectStatus = (value) =>
  PROJECT_STATUSES.has(value) ? value : 'idea';

const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeLines = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeLinks = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((link) => ({
      label: typeof link?.label === 'string' ? link.label.trim() : '',
      url: typeof link?.url === 'string' ? link.url.trim() : '',
    }))
    .filter((link) => link.label && link.url)
    .slice(0, 8);
};

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve project resource URL', resource.identifier, error);
    return '';
  }
};

export const buildProjectIdentifier = ({ title, authorName }) => {
  const rawBase =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'project';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_QDN_IDENTIFIER_LENGTH - PROJECT_METADATA_PREFIX.length - suffix.length - 1,
  );
  const base = rawBase.slice(0, maxBaseLength).replace(/-+$/g, '') || 'project';

  return `${PROJECT_METADATA_PREFIX}${base}_${suffix}`;
};

export const sanitizeProjectPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(PROJECT_METADATA_PREFIX)) {
    return null;
  }

  const resourceOwner = typeof summary.name === 'string' ? summary.name : payload.authorName;
  if (!isOwnerName(resourceOwner)) {
    return null;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const descriptionHtml =
    typeof payload.descriptionHtml === 'string' ? payload.descriptionHtml : '';
  const descriptionText =
    typeof payload.descriptionText === 'string'
      ? payload.descriptionText
      : toPlainText(descriptionHtml);
  const created = Number(payload.created ?? summary.created ?? Date.now());

  return {
    id: identifier,
    identifier,
    title,
    type: normalizeProjectType(payload.type),
    status: normalizeProjectStatus(payload.status),
    summary: typeof payload.summary === 'string' ? payload.summary.trim() : '',
    descriptionHtml,
    descriptionText,
    role: typeof payload.role === 'string' ? payload.role.trim() : '',
    goals: normalizeLines(payload.goals),
    roadmap: normalizeLines(payload.roadmap),
    links: normalizeLinks(payload.links),
    startDate: normalizeDate(payload.startDate),
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
    service: PROJECT_SERVICE,
    mode: 'ALL',
    identifier: PROJECT_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchProjectFromSummary = async (summary) => {
  if (!isOwnerName(summary?.name)) return null;

  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: PROJECT_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  const project = sanitizeProjectPayload(resource ?? {}, summary);
  if (!project?.coverResource || project.coverUrl) {
    return project;
  }

  return {
    ...project,
    coverUrl: await resolveResourceUrl(project.coverResource),
  };
};

export const fetchProjectByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: PROJECT_SERVICE,
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

  return fetchProjectFromSummary(ownerSummary);
};

export const fetchProjectPage = async ({
  page = 1,
  pageSize = 9,
  projectType = 'own',
  searchQuery = '',
  sortOrder = 'newest',
  status = '',
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedStatus = status.trim().toLowerCase();
  const normalizedType = normalizeProjectType(projectType);
  const offset = Math.max(0, page - 1) * pageSize;
  const matches = [];
  let ownerMatchCount = 0;
  let qdnOffset = 0;
  let hasMore = true;
  const scanLimit = 50;

  while (hasMore && matches.length < pageSize + 1) {
    const summaries = await fetchSummaries({
      limit: scanLimit,
      offset: qdnOffset,
      sortOrder,
    });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summaryItem of pageItems) {
      try {
        const project = await fetchProjectFromSummary(summaryItem);
        if (!project || project.type !== normalizedType) continue;

        const searchable = `${project.title} ${project.summary} ${project.descriptionText} ${project.role} ${project.goals.join(' ')} ${project.roadmap.join(' ')}`.toLowerCase();
        const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
        const matchesStatus = !normalizedStatus || project.status === normalizedStatus;
        if (!matchesQuery || !matchesStatus) continue;

        if (ownerMatchCount >= offset) {
          matches.push(project);
        }
        ownerMatchCount += 1;

        if (matches.length >= pageSize + 1) break;
      } catch (error) {
        console.error('Failed to fetch project metadata', summaryItem?.identifier, error);
      }
    }

    hasMore = pageItems.length === scanLimit;
    qdnOffset += pageItems.length;
  }

  return {
    projects: matches.slice(0, pageSize),
    hasNextPage: matches.length > pageSize,
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
    title: toQdnText(title || 'Project cover', 80),
    description: toQdnText(`Cover image for ${title || 'project'}`, 240),
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

export const publishProject = async ({ form, authorName, authorAddress }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can publish projects.');
  }

  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  const now = Date.now();
  const identifier = buildProjectIdentifier({ title: form.title, authorName });
  const cover = await publishCover({
    file: form.coverFile,
    identifier,
    authorName,
    title: form.title,
  });

  const payload = sanitizeProjectPayload(
    {
      id: identifier,
      identifier,
      title: form.title,
      type: form.type,
      status: form.status,
      summary: form.summary,
      descriptionHtml,
      descriptionText: toPlainText(descriptionHtml),
      role: form.role,
      goals: normalizeLines(form.goals),
      roadmap: normalizeLines(form.roadmap),
      links: normalizeLinks(form.links),
      startDate: form.startDate,
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
    service: PROJECT_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: toQdnText(payload.title, 80) || 'Untitled project',
    description: toQdnText(payload.summary || payload.descriptionText, 240) || 'Project',
  });

  return payload;
};

export const updateProject = async ({ project, form, authorName }) => {
  if (!isOwnerName(authorName)) {
    throw new Error('Only the site owner can edit projects.');
  }

  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  let coverResource = project.coverResource || null;
  let coverUrl = project.coverUrl || '';

  if (form.coverFile) {
    const cover = await publishCover({
      file: form.coverFile,
      identifier: project.identifier,
      authorName,
      title: form.title || project.title,
    });
    coverResource = cover.coverResource || coverResource;
    coverUrl = cover.coverUrl || coverUrl;
  }

  const updatedProject = sanitizeProjectPayload(
    {
      ...project,
      title: form.title,
      type: form.type,
      status: form.status,
      summary: form.summary,
      descriptionHtml,
      descriptionText: toPlainText(descriptionHtml),
      role: form.role,
      goals: normalizeLines(form.goals),
      roadmap: normalizeLines(form.roadmap),
      links: normalizeLinks(form.links),
      startDate: form.startDate,
      coverResource,
      coverUrl,
      updated: Date.now(),
    },
    { name: authorName, identifier: project.identifier },
  );

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: PROJECT_SERVICE,
    identifier: updatedProject.identifier,
    data64: encodeObjectToBase64(updatedProject),
    encoding: 'base64',
    title: toQdnText(updatedProject.title, 80) || 'Untitled project',
    description:
      toQdnText(updatedProject.summary || updatedProject.descriptionText, 240) || 'Project',
  });

  return updatedProject;
};
