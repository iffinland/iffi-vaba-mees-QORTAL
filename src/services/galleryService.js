import { publishRichText } from './richTextAttachmentService';
import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';
import { getQdnResourceUrl } from './qdnResourceService';
import { getCurrentUserProfile } from './videoService';

export { getCurrentUserProfile };

export const GALLERY_METADATA_PREFIX = 'iffivabamees_gallery_';
const GALLERY_IMAGE_PREFIX = 'ivm_gi_';
const GALLERY_SERVICE = 'DOCUMENT';
const IMAGE_SERVICE = 'IMAGE';
const THUMBNAIL_SERVICE = 'THUMBNAIL';
const PAGE_SIZE_SCAN = 50;
const MAX_GALLERY_THUMBNAIL_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_THUMBNAIL_BYTES = 500000;
const THUMBNAIL_CANVAS_MAX_SIZE = 1280;

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
      reject(new Error('Image could not be processed.'));
    };
    image.src = url;
  });

const getBase64ByteSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

// Send image bytes directly, avoiding the host's multipart chunk-upload path.
const readImageBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const separator = typeof result === 'string' ? result.indexOf(',') : -1;
      if (separator < 0 || !result.slice(separator + 1)) {
        reject(new Error('Image file is empty or could not be read.'));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.onerror = () => reject(new Error('Image file could not be read. Please select it again.'));
    reader.onabort = () => reject(new Error('Image file reading was cancelled.'));
    reader.readAsDataURL(file);
  });

const renderThumbnailBase64 = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Thumbnail must be an image file.');
  }

  if (file.size > MAX_GALLERY_THUMBNAIL_UPLOAD_BYTES) {
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
      throw new Error('Image processing is not available.');
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

  throw new Error('Image could not be optimized for QDN thumbnail publishing.');
};

const buildGalleryIdentifier = ({ title, authorName }) => {
  const base =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'gallery';
  const timestamp = Date.now().toString(36);

  return `${GALLERY_METADATA_PREFIX}${base.slice(0, 18)}_${timestamp}_${createShortId()}`;
};

const buildImageIdentifier = (index) =>
  `${GALLERY_IMAGE_PREFIX}${Date.now().toString(36)}_${index}_${createShortId()}`;

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve gallery resource URL', resource.identifier, error);
    return '';
  }
};

const sanitizeGalleryPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(GALLERY_METADATA_PREFIX)) {
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
  const images = Array.isArray(payload.images)
    ? payload.images
        .filter((image) => image?.id && image?.imageResource)
        .map((image, index) => ({
          id: image.id,
          title: typeof image.title === 'string' ? image.title : '',
          description: typeof image.description === 'string' ? image.description : '',
          imageResource: image.imageResource,
          thumbnailResource: image.thumbnailResource || null,
          src: typeof image.src === 'string' ? image.src : '',
          thumbnailUrl: typeof image.thumbnailUrl === 'string' ? image.thumbnailUrl : '',
          order: Number(image.order ?? index),
          created: Number(image.created ?? created),
        }))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id: identifier,
    identifier,
    title,
    descriptionHtml,
    descriptionText,
    coverResource: payload.coverResource || null,
    coverUrl: typeof payload.coverUrl === 'string' ? payload.coverUrl : '',
    images,
    authorName:
      typeof payload.authorName === 'string' && payload.authorName.trim()
        ? payload.authorName.trim()
        : summary.name || '',
    authorAddress: typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
  };
};

const publishThumbnail = async ({ file, identifier, authorName, title }) => {
  if (!file) return null;

  const data64 = await renderThumbnailBase64(file);
  const response = await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: THUMBNAIL_SERVICE,
    identifier,
    data64,
    encoding: 'base64',
    title: title || 'Gallery thumbnail',
    description: `Thumbnail for ${title || 'gallery image'}`.slice(0, 4000),
  });

  return {
    service: THUMBNAIL_SERVICE,
    name: response?.name || authorName,
    identifier: response?.identifier || identifier,
    filename: file.name || '',
  };
};

const publishImage = async ({ file, index, authorName, title }) => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Gallery images must be image files.');
  }

  const imageId = buildImageIdentifier(index);
  const data64 = await readImageBase64(file);
  const response = await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: IMAGE_SERVICE,
    identifier: imageId,
    data64,
    encoding: 'base64',
    filename: file.name || `${imageId}.jpg`,
    title: title || 'Gallery image',
    description: `Image for ${title || 'gallery'}`.slice(0, 4000),
  });

  const imageResource = {
    service: IMAGE_SERVICE,
    name: response?.name || authorName,
    identifier: response?.identifier || imageId,
    filename: file.name || '',
  };
  const thumbnailResource = await publishThumbnail({
    file,
    identifier: `${imageId}_thumb`,
    authorName,
    title,
  });

  return {
    id: imageId,
    title: '',
    description: '',
    imageResource,
    thumbnailResource,
    src: await resolveResourceUrl(imageResource),
    thumbnailUrl: await resolveResourceUrl(thumbnailResource),
    order: index,
    created: Date.now(),
  };
};

const publishGalleryMetadata = async ({ gallery, authorName }) => {
  const metadata = {
    ...gallery,
    coverUrl: '',
    images: gallery.images.map((image) => ({
      ...image,
      src: '',
      thumbnailUrl: '',
    })),
  };

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: GALLERY_SERVICE,
    identifier: gallery.identifier,
    data64: encodeObjectToBase64(metadata),
    encoding: 'base64',
    title: gallery.title || 'Untitled gallery',
    description: gallery.descriptionText.slice(0, 4000),
  });
};

const resolveGalleryUrls = async (gallery, includeImages = false) => {
  if (!gallery) return null;

  const coverUrl = gallery.coverUrl || (await resolveResourceUrl(gallery.coverResource));
  if (!includeImages) {
    return { ...gallery, coverUrl };
  }

  const images = await Promise.all(
    gallery.images.map(async (image) => ({
      ...image,
      src: image.src || (await resolveResourceUrl(image.imageResource)),
      thumbnailUrl: image.thumbnailUrl || (await resolveResourceUrl(image.thumbnailResource)),
    })),
  );

  return { ...gallery, coverUrl, images };
};

const fetchGalleryFromSummary = async (summary, includeImages = false) => {
  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: GALLERY_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  return resolveGalleryUrls(sanitizeGalleryPayload(resource ?? {}, summary), includeImages);
};

const fetchGallerySummaries = async ({ limit, offset, sortOrder }) =>
  requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: GALLERY_SERVICE,
    mode: 'ALL',
    identifier: GALLERY_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

export const fetchGalleryPage = async ({ page = 1, pageSize = 12, sortOrder = 'newest' }) => {
  const offset = Math.max(0, page - 1) * pageSize;
  const summaries = await fetchGallerySummaries({ limit: pageSize, offset, sortOrder });
  const items = Array.isArray(summaries) ? summaries : [];
  const galleries = [];

  for (const summary of items) {
    try {
      const gallery = await fetchGalleryFromSummary(summary, false);
      if (gallery) galleries.push(gallery);
    } catch (error) {
      console.error('Failed to fetch gallery metadata', summary?.identifier, error);
    }
  }

  return {
    galleries,
    hasNextPage: items.length === pageSize,
  };
};

export const fetchGalleryByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: GALLERY_SERVICE,
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
  if (!summary) return null;

  return fetchGalleryFromSummary(summary, true);
};

export const publishGallery = async ({ form, authorName, authorAddress }) => {
  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  const now = Date.now();
  const identifier = buildGalleryIdentifier({ title: form.title, authorName });
  const imageRows = form.images.slice(0, 10);
  const images = [];

  for (let index = 0; index < imageRows.length; index += 1) {
    const row = imageRows[index];
    const image = await publishImage({
      file: row.file,
      index,
      authorName,
      title: form.title,
    });
    images.push({
      ...image,
      description: row.description || '',
      order: index,
    });
  }

  let coverResource = await publishThumbnail({
    file: form.coverFile,
    identifier: `${identifier}_c`,
    authorName,
    title: form.title,
  });
  if (!coverResource && images[0]?.thumbnailResource) {
    coverResource = images[0].thumbnailResource;
  }

  const gallery = sanitizeGalleryPayload({
    id: identifier,
    identifier,
    title: form.title,
    descriptionHtml,
    descriptionText: toPlainText(descriptionHtml),
    coverResource,
    coverUrl: await resolveResourceUrl(coverResource),
    images,
    authorName,
    authorAddress,
    created: now,
    updated: now,
  });

  await publishGalleryMetadata({ gallery, authorName });
  return gallery;
};

export const updateGallery = async ({ gallery, form, authorName }) => {
  const descriptionHtml = await publishRichText(form.descriptionHtml, form.attachments, authorName);

  let coverResource = gallery.coverResource || null;
  let coverUrl = gallery.coverUrl || '';

  if (form.coverFile) {
    coverResource = await publishThumbnail({
      file: form.coverFile,
      identifier: `${gallery.identifier}_c`,
      authorName,
      title: form.title || gallery.title,
    });
    coverUrl = await resolveResourceUrl(coverResource);
  }

  const existingImages = form.existingImages.map((image, index) => ({
    ...image,
    description: image.description || '',
    order: index,
  }));
  const newImages = [];

  for (let index = 0; index < form.images.length; index += 1) {
    const row = form.images[index];
    const image = await publishImage({
      file: row.file,
      index: existingImages.length + index,
      authorName,
      title: form.title || gallery.title,
    });
    newImages.push({
      ...image,
      description: row.description || '',
      order: existingImages.length + index,
    });
  }

  const images = [...existingImages, ...newImages].map((image, index) => ({
    ...image,
    order: index,
  }));

  if (!coverResource && images[0]?.thumbnailResource) {
    coverResource = images[0].thumbnailResource;
    coverUrl = images[0].thumbnailUrl || (await resolveResourceUrl(coverResource));
  }

  const updatedGallery = sanitizeGalleryPayload({
    ...gallery,
    title: form.title,
    descriptionHtml,
    descriptionText: toPlainText(descriptionHtml),
    coverResource,
    coverUrl,
    images,
    updated: Date.now(),
  });

  await publishGalleryMetadata({ gallery: updatedGallery, authorName });
  return updatedGallery;
};

export const scanAllGalleryIdentifiers = async () => {
  const identifiers = [];
  let offset = 0;

  while (true) {
    const summaries = await fetchGallerySummaries({
      limit: PAGE_SIZE_SCAN,
      offset,
      sortOrder: 'newest',
    });
    const items = Array.isArray(summaries) ? summaries : [];
    if (!items.length) break;
    identifiers.push(...items.map((item) => item.identifier).filter(Boolean));
    if (items.length < PAGE_SIZE_SCAN) break;
    offset += items.length;
  }

  return identifiers;
};
