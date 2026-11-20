import { useEffect, useMemo, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaTimes, FaTrash } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './GalleryPublishModal.module.css';

const initialForm = {
  title: '',
  descriptionHtml: '',
  coverFile: null,
  existingImages: [],
  images: [],
};

const toEditForm = (gallery) => ({
  title: gallery?.title || '',
  descriptionHtml: gallery?.descriptionHtml || '',
  coverFile: null,
  existingImages: (gallery?.images || []).map((image) => ({ ...image })),
  images: [],
});

const buildNewImageRows = (files) =>
  files.slice(0, 10).map((file) => ({
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    description: '',
    previewUrl: URL.createObjectURL(file),
  }));

function GalleryPublishModal({
  editGallery,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editGallery);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editGallery ? toEditForm(editGallery) : initialForm);
    setError('');
  }, [editGallery, isOpen]);

  const totalNewImages = useMemo(() => form.images.length, [form.images.length]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const moveExistingImage = (index, direction) => {
    setForm((current) => {
      const next = [...current.existingImages];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, existingImages: next };
    });
  };

  const moveNewImage = (index, direction) => {
    setForm((current) => {
      const next = [...current.images];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, images: next };
    });
  };

  const removeExistingImage = (imageId) => {
    setForm((current) => ({
      ...current,
      existingImages: current.existingImages.filter((image) => image.id !== imageId),
    }));
  };

  const removeNewImage = (imageId) => {
    setForm((current) => {
      const image = current.images.find((item) => item.id === imageId);
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      return {
        ...current,
        images: current.images.filter((item) => item.id !== imageId),
      };
    });
  };

  const updateExistingImageDescription = (imageId, description) => {
    setForm((current) => ({
      ...current,
      existingImages: current.existingImages.map((image) =>
        image.id === imageId ? { ...image, description } : image,
      ),
    }));
  };

  const updateNewImageDescription = (imageId, description) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, description } : image,
      ),
    }));
  };

  const addImages = (files) => {
    setForm((current) => {
      const availableSlots = Math.max(0, 10 - current.images.length);
      const rows = buildNewImageRows(Array.from(files).slice(0, availableSlots));
      return {
        ...current,
        images: [...current.images, ...rows],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onPublish(form);
      form.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setForm(initialForm);
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to publish gallery.');
    }
  };

  const handleClose = () => {
    form.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    onClose();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit gallery' : 'Publish gallery'}</h2>
          <button type="button" onClick={handleClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Title
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Gallery title"
            />
          </label>

          <label>
            Cover thumbnail
            <input
              type="file"
              accept="image/*"
              onChange={(event) => updateField('coverFile', event.target.files?.[0] || null)}
            />
            <span className={styles.fieldHint}>Image file only. Maximum upload size: 5 MB.</span>
            {isEditMode && (
              <span className={styles.fieldHint}>Leave empty to keep the current cover.</span>
            )}
          </label>

          <div className={styles.fieldGroup}>
            <span>Description</span>
            <RichTextEditor
              value={form.descriptionHtml}
              enhanced
              disabled={isPublishing}
              onChange={(value, attachments) => setForm((current) => ({ ...current, descriptionHtml: value, attachments }))}
              placeholder="Add gallery context"
            />
          </div>

          <label>
            Images
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => addImages(event.target.files || [])}
            />
            <span className={styles.fieldHint}>
              Select up to 10 new images per publish action. Existing images can be reordered below.
            </span>
          </label>

          {form.existingImages.length > 0 && (
            <div className={styles.imageRows}>
              <h3>Existing images</h3>
              {form.existingImages.map((image, index) => (
                <div key={image.id} className={styles.imageRow}>
                  <img src={image.thumbnailUrl || image.src} alt="" />
                  <textarea
                    value={image.description}
                    onChange={(event) =>
                      updateExistingImageDescription(image.id, event.target.value)
                    }
                    placeholder="Image description"
                  />
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => moveExistingImage(index, -1)}>
                      <FaArrowUp />
                    </button>
                    <button type="button" onClick={() => moveExistingImage(index, 1)}>
                      <FaArrowDown />
                    </button>
                    <button type="button" onClick={() => removeExistingImage(image.id)}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {form.images.length > 0 && (
            <div className={styles.imageRows}>
              <h3>New images ({totalNewImages}/10)</h3>
              {form.images.map((image, index) => (
                <div key={image.id} className={styles.imageRow}>
                  <img src={image.previewUrl} alt="" />
                  <textarea
                    value={image.description}
                    onChange={(event) => updateNewImageDescription(image.id, event.target.value)}
                    placeholder="Image description"
                  />
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => moveNewImage(index, -1)}>
                      <FaArrowUp />
                    </button>
                    <button type="button" onClick={() => moveNewImage(index, 1)}>
                      <FaArrowDown />
                    </button>
                    <button type="button" onClick={() => removeNewImage(image.id)}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={handleClose} disabled={isPublishing}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isPublishing}>
              {isPublishing ? 'Saving...' : isEditMode ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GalleryPublishModal;
