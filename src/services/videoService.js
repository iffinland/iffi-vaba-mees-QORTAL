import { publishRichText } from './richTextAttachmentService';
import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';
import { getQdnResourceUrl } from './qdnResourceService';

export const VIDEO_METADATA_PREFIX = 'iffivabamees_video_';
const VIDEO_SERVICE = 'DOCUMENT';
const THUMBNAIL_SERVICE = 'THUMBNAIL';
const MAX_QDN_IDENTIFIER_LENGTH = 60;
const MAX_THUMBNAIL_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_THUMBNAIL_BYTES = 500000;
const THUMBNAIL_CANVAS_MAX_SIZE = 1280;
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
      reject(new Error('Thumbnail image could not be processed.'));
    };
    image.src = url;
  });

const getBase64ByteSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const renderThumbnailBase64 = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Thumbnail must be an image file.');
  }

  if (file.size > MAX_THUMBNAIL_UPLOAD_BYTES) {
    throw new Error('Thumbnail image is too large. Maximum upload size is 5 MB.');
  }

  const image = await loadImageFile(file);
  const ratio = Math.min(1, THUMBNAIL_CANVAS_MAX_SIZE / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Thumbnail image processing is not available.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';

      if (getBase64ByteSize(base64) <= MAX_QDN_THUMBNAIL_BYTES) {
        return base64;
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new Error('Thumbnail image could not be optimized for QDN. Try a smaller image.');
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

export const buildVideoIdentifier = ({ title, authorName }) => {
  const rawBase =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'untitled-video';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_QDN_IDENTIFIER_LENGTH - VIDEO_METADATA_PREFIX.length - suffix.length - 1,
  );
  const base = rawBase.slice(0, maxBaseLength).replace(/-+$/g, '') || 'video';

  return `${VIDEO_METADATA_PREFIX}${base}_${suffix}`;
};

export const sanitizeVideoPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(VIDEO_METADATA_PREFIX)) {
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
    performer: typeof payload.performer === 'string' ? payload.performer.trim() : '',
    descriptionHtml,
    descriptionText,
    playlist: typeof payload.playlist === 'string' ? payload.playlist.trim() : '',
    publishedDate: normalizeDate(payload.publishedDate) || normalizeDate(created),
    sourceType: payload.sourceType || 'qtube',
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim() : '',
    thumbnailUrl:
      typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl.trim() : '',
    qdnThumbnail: payload.qdnThumbnail || null,
    qdnVideo: payload.qdnVideo || null,
    authorName:
      typeof payload.authorName === 'string' && payload.authorName.trim()
        ? payload.authorName.trim()
        : summary.name || '',
    authorAddress:
      typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
    likes: Number(payload.likes ?? 0),
  };
};

export const getCurrentUserProfile = async () => {
  const account = await requestQortal({ action: 'GET_USER_ACCOUNT' });
  if (!account?.address) {
    return { address: '', name: '', names: [] };
  }

  const namesResponse = await requestQortal({
    action: 'GET_ACCOUNT_NAMES',
    address: account.address,
    limit: 20,
    offset: 0,
    reverse: false,
  });

  const names = Array.isArray(namesResponse)
    ? namesResponse
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
        .filter(Boolean)
    : [];

  return {
    address: account.address,
    name: names[0] ?? '',
    names,
  };
};

const fetchSummaries = async ({ limit, offset, sortOrder }) =>
  requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: VIDEO_SERVICE,
    mode: 'ALL',
    identifier: VIDEO_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchVideoFromSummary = async (summary) => {
  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: VIDEO_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  const video = sanitizeVideoPayload(resource ?? {}, summary);
  if (!video?.qdnThumbnail || video.thumbnailUrl) {
    return video;
  }

  try {
    const thumbnailUrl = await getQdnResourceUrl(video.qdnThumbnail);
    return {
      ...video,
      thumbnailUrl,
    };
  } catch (error) {
    console.warn('Failed to resolve video thumbnail URL', video.identifier, error);
    return video;
  }
};

export const fetchVideoByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: VIDEO_SERVICE,
    mode: 'ALL',
    identifier,
    prefix: false,
    limit: 1,
    offset: 0,
    reverse: true,
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

  const summary = Array.isArray(summaries) ? summaries[0] : null;
  if (!summary) {
    return null;
  }

  return fetchVideoFromSummary(summary);
};

export const fetchVideoPage = async ({
  page = 1,
  pageSize = 9,
  playlist = '',
  searchQuery = '',
  sortOrder = 'newest',
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedPlaylist = playlist.trim().toLowerCase();
  const offset = Math.max(0, page - 1) * pageSize;

  if (normalizedQuery || normalizedPlaylist) {
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
          const video = await fetchVideoFromSummary(summary);
          if (!video) continue;

          const searchable = `${video.title} ${video.descriptionText}`.toLowerCase();
          const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
          const matchesPlaylist =
            !normalizedPlaylist || video.playlist.toLowerCase() === normalizedPlaylist;

          if (matchesQuery && matchesPlaylist) {
            matches.push(video);
          }
        } catch (error) {
          console.error('Failed to fetch video metadata', summary?.identifier, error);
        }
      }

      hasMore = pageItems.length === scanLimit;
      qdnOffset += pageItems.length;
    }

    return {
      videos: matches.slice(offset, offset + pageSize),
      hasNextPage: matches.length > offset + pageSize,
    };
  }

  const summaries = await fetchSummaries({
    limit: pageSize,
    offset,
    sortOrder,
  });

  const pageItems = Array.isArray(summaries) ? summaries : [];
  const videos = [];

  for (const summary of pageItems) {
    try {
      const video = await fetchVideoFromSummary(summary);
      if (video) videos.push(video);
    } catch (error) {
      console.error('Failed to fetch video metadata', summary?.identifier, error);
    }
  }

  return {
    videos,
    hasNextPage: pageItems.length === pageSize,
  };
};

export const fetchVideoPlaylists = async () => {
  const playlists = new Set();
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
        const video = await fetchVideoFromSummary(summary);
        if (video?.playlist) {
          playlists.add(video.playlist);
        }
      } catch (error) {
        console.error('Failed to fetch video playlist metadata', summary?.identifier, error);
      }
    }

    if (pageItems.length < scanLimit) break;
    offset += pageItems.length;
  }

  return Array.from(playlists).sort((a, b) => a.localeCompare(b));
};

const publishVideoThumbnail = async ({ file, identifier, authorName, title }) => {
  if (!file) {
    return {
      qdnThumbnail: null,
      thumbnailUrl: '',
    };
  }

  const data64 = await renderThumbnailBase64(file);

  const thumbnailResponse = await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: THUMBNAIL_SERVICE,
    identifier,
    data64,
    encoding: 'base64',
    title: toQdnTitle(title, 'Video thumbnail'),
    description: toQdnDescription(`Thumbnail for ${title || 'untitled video'}`),
  });

  const qdnThumbnail = {
    service: THUMBNAIL_SERVICE,
    name: thumbnailResponse?.name || authorName,
    identifier: thumbnailResponse?.identifier || identifier,
    filename: file.name || '',
  };

  let thumbnailUrl = '';
  try {
    thumbnailUrl = await getQdnResourceUrl(qdnThumbnail);
  } catch (error) {
    console.warn('Failed to resolve published thumbnail URL', identifier, error);
  }

  return {
    qdnThumbnail,
    thumbnailUrl,
  };
};

export const publishVideo = async ({ form, authorName, authorAddress }) => {
  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  const now = Date.now();
  const identifier = buildVideoIdentifier({ title: form.title, authorName });
  let qdnVideo = null;
  const thumbnail = await publishVideoThumbnail({
    file: form.thumbnailFile,
    identifier,
    authorName,
    title: form.title,
  });

  if (form.sourceType === 'upload' && form.videoFile) {
    const videoResponse = await requestQortal({
      action: 'PUBLISH_QDN_RESOURCE',
      name: authorName,
      service: 'VIDEO',
      identifier,
      file: form.videoFile,
      filename: form.videoFile.name || `${identifier}.mp4`,
      title: toQdnTitle(form.title, 'Untitled video'),
      description: toQdnDescription(toPlainText(descriptionHtml), 'Uploaded video'),
    });

    qdnVideo = {
      service: 'VIDEO',
      name: videoResponse?.name || authorName,
      identifier: videoResponse?.identifier || identifier,
      filename: form.videoFile.name || '',
    };
  }

  const payload = sanitizeVideoPayload({
    id: identifier,
    identifier,
    title: form.title,
    performer: form.performer,
    descriptionHtml,
    descriptionText: toPlainText(descriptionHtml),
    playlist: form.playlist,
    publishedDate: form.publishedDate,
    sourceType: form.sourceType,
    sourceUrl: form.sourceUrl,
    thumbnailUrl: thumbnail.thumbnailUrl,
    qdnThumbnail: thumbnail.qdnThumbnail,
    qdnVideo,
    authorName,
    authorAddress,
    created: now,
    updated: now,
  });

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: VIDEO_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: toQdnTitle(payload.title, 'Untitled video'),
    description: toQdnDescription(payload.descriptionText, 'Video metadata'),
  });

  return payload;
};

export const updateVideo = async ({ video, form, authorName }) => {
  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  let qdnVideo = video.qdnVideo || null;
  let qdnThumbnail = video.qdnThumbnail || null;
  let thumbnailUrl = video.thumbnailUrl || '';
  const nextSourceType = form.sourceType || video.sourceType || 'qtube';

  if (form.thumbnailFile) {
    const thumbnail = await publishVideoThumbnail({
      file: form.thumbnailFile,
      identifier: video.identifier,
      authorName,
      title: form.title || video.title,
    });
    qdnThumbnail = thumbnail.qdnThumbnail || qdnThumbnail;
    thumbnailUrl = thumbnail.thumbnailUrl || thumbnailUrl;
  }

  if (nextSourceType === 'upload' && form.videoFile) {
    const videoResponse = await requestQortal({
      action: 'PUBLISH_QDN_RESOURCE',
      name: authorName,
      service: 'VIDEO',
      identifier: video.identifier,
      file: form.videoFile,
      filename: form.videoFile.name || `${video.identifier}.mp4`,
      title: toQdnTitle(form.title || video.title, 'Untitled video'),
      description: toQdnDescription(
        toPlainText(descriptionHtml),
        'Uploaded video',
      ),
    });

    qdnVideo = {
      service: 'VIDEO',
      name: videoResponse?.name || authorName,
      identifier: videoResponse?.identifier || video.identifier,
      filename: form.videoFile.name || video.qdnVideo?.filename || '',
    };
  }

  const updatedVideo = sanitizeVideoPayload({
    ...video,
    title: form.title,
    performer: form.performer,
    descriptionHtml,
    descriptionText: toPlainText(descriptionHtml),
    playlist: form.playlist,
    publishedDate: form.publishedDate,
    sourceType: nextSourceType,
    sourceUrl: nextSourceType === 'upload' ? form.sourceUrl || video.sourceUrl : form.sourceUrl,
    thumbnailUrl,
    qdnThumbnail,
    qdnVideo,
    updated: Date.now(),
  });

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: VIDEO_SERVICE,
    identifier: updatedVideo.identifier,
    data64: encodeObjectToBase64(updatedVideo),
    encoding: 'base64',
    title: toQdnTitle(updatedVideo.title, 'Untitled video'),
    description: toQdnDescription(updatedVideo.descriptionText, 'Video metadata'),
  });

  return updatedVideo;
};

export const updateVideoDescription = async ({ video, descriptionHtml, attachments, authorName }) => {
  const content = await publishRichText(descriptionHtml, attachments, authorName);
  const updatedVideo = sanitizeVideoPayload({
    ...video,
    descriptionHtml: content,
    descriptionText: toPlainText(content),
    updated: Date.now(),
  });

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: VIDEO_SERVICE,
    identifier: updatedVideo.identifier,
    data64: encodeObjectToBase64(updatedVideo),
    encoding: 'base64',
    title: toQdnTitle(updatedVideo.title, 'Untitled video'),
    description: toQdnDescription(updatedVideo.descriptionText, 'Video metadata'),
  });

  return updatedVideo;
};
