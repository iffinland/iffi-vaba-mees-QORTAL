import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './BlogPublishModal.module.css';

const initialForm = {
  title: '',
  excerpt: '',
  contentHtml: '',
  category: '',
  newCategory: '',
  tags: '',
  publishedDate: '',
  coverFile: null,
};

const toEditForm = (post) => ({
  title: post?.title || '',
  excerpt: post?.excerpt || '',
  contentHtml: post?.contentHtml || '',
  category: post?.category || '',
  newCategory: '',
  tags: (post?.tags || []).join(', '),
  publishedDate: post?.publishedDate || '',
  coverFile: null,
});

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function BlogPublishModal({
  categories,
  editPost,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editPost);

  const categoryOptions = useMemo(
    () => Array.from(new Set(categories.filter(Boolean))),
    [categories],
  );

  useEffect(() => {
    if (!isOpen) return;
    setForm(editPost ? toEditForm(editPost) : initialForm);
    setError('');
  }, [editPost, isOpen]);

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

    if (!stripHtml(form.contentHtml)) {
      setError('Write the blog post content before publishing.');
      return;
    }

    try {
      await onPublish({
        ...form,
        category: form.newCategory.trim() || form.category,
      });
      if (!isEditMode) {
        setForm(initialForm);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to save blog post.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit blog post' : 'Publish blog post'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Blog post title"
              />
            </label>
            <label>
              Published date
              <input
                type="date"
                value={form.publishedDate}
                onChange={(event) => updateField('publishedDate', event.target.value)}
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
            {isEditMode && (
              <span className={styles.fieldHint}>Leave empty to keep the current cover.</span>
            )}
          </label>

          <label>
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={(event) => updateField('excerpt', event.target.value)}
              placeholder="Short intro shown on the blog list"
              rows={3}
            />
          </label>

          <div className={styles.grid}>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
              >
                <option value="">No category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              New category
              <input
                type="text"
                value={form.newCategory}
                onChange={(event) => updateField('newCategory', event.target.value)}
                placeholder="Create a category"
              />
            </label>
          </div>

          <label>
            Tags
            <input
              type="text"
              value={form.tags}
              onChange={(event) => updateField('tags', event.target.value)}
              placeholder="forest, qortal, life"
            />
            <span className={styles.fieldHint}>Separate tags with commas.</span>
          </label>

          <div className={styles.fieldGroup}>
            <span>Content</span>
            <RichTextEditor
              value={form.contentHtml}
              enhanced
              disabled={isPublishing}
              onChange={(value, attachments) => setForm((current) => ({ ...current, contentHtml: value, attachments }))}
              placeholder="Write your blog post"
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

export default BlogPublishModal;
