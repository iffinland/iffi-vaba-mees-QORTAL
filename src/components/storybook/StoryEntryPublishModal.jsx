import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './StoryEntryPublishModal.module.css';

const initialForm = {
  title: '',
  excerpt: '',
  contentHtml: '',
  storyYear: '',
  storyMonth: '',
  storyDay: '',
  periodLabel: '',
  location: '',
  coverFile: null,
};

const toEditForm = (entry) => ({
  title: entry?.title || '',
  excerpt: entry?.excerpt || '',
  contentHtml: entry?.contentHtml || '',
  storyYear: entry?.storyYear || '',
  storyMonth: entry?.storyMonth || '',
  storyDay: entry?.storyDay || '',
  periodLabel: entry?.periodLabel || '',
  location: entry?.location || '',
  coverFile: null,
});

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function StoryEntryPublishModal({
  editEntry,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editEntry);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editEntry ? toEditForm(editEntry) : initialForm);
    setError('');
  }, [editEntry, isOpen]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!Number(form.storyYear)) {
      setError('Story year is required for chronological sorting.');
      return;
    }

    if (!stripHtml(form.contentHtml)) {
      setError('Write the story entry before publishing.');
      return;
    }

    try {
      await onPublish(form);
      if (!isEditMode) {
        setForm(initialForm);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to save life story entry.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit story entry' : 'Publish story entry'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
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
              placeholder="Chapter title"
            />
          </label>

          <div className={styles.dateGrid}>
            <label>
              Year
              <input
                type="number"
                min="1"
                max="9999"
                value={form.storyYear}
                onChange={(event) => updateField('storyYear', event.target.value)}
                placeholder="1998"
              />
            </label>
            <label>
              Month
              <select
                value={form.storyMonth}
                onChange={(event) => updateField('storyMonth', event.target.value)}
              >
                <option value="">Unknown</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </label>
            <label>
              Day
              <input
                type="number"
                min="1"
                max="31"
                value={form.storyDay}
                onChange={(event) => updateField('storyDay', event.target.value)}
                placeholder="Unknown"
              />
            </label>
          </div>

          <div className={styles.grid}>
            <label>
              Period label
              <input
                type="text"
                value={form.periodLabel}
                onChange={(event) => updateField('periodLabel', event.target.value)}
                placeholder="Optional custom label"
              />
            </label>
            <label>
              Location
              <input
                type="text"
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                placeholder="Optional place"
              />
            </label>
          </div>

          <label>
            Cover image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => updateField('coverFile', event.target.files?.[0] || null)}
            />
            <span className={styles.fieldHint}>Image file only. Maximum upload size: 5 MB.</span>
            {isEditMode && <span className={styles.fieldHint}>Leave empty to keep the current cover.</span>}
          </label>

          <label>
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={(event) => updateField('excerpt', event.target.value)}
              placeholder="Short chapter intro"
              rows={3}
            />
          </label>

          <div className={styles.fieldGroup}>
            <span>Story</span>
            <RichTextEditor
              value={form.contentHtml}
              enhanced
              disabled={isPublishing}
              onChange={(value, attachments) => setForm((current) => ({ ...current, contentHtml: value, attachments }))}
              placeholder="Write the life story chapter"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isPublishing}>
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

export default StoryEntryPublishModal;
