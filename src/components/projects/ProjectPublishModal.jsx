import { useEffect, useState } from 'react';
import { FaTimes, FaTrash } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './ProjectPublishModal.module.css';

const initialForm = {
  title: '',
  type: 'own',
  status: 'idea',
  summary: '',
  descriptionHtml: '',
  role: '',
  goals: '',
  roadmap: '',
  startDate: '',
  coverFile: null,
  links: [{ label: '', url: '' }],
};

const toEditForm = (project) => ({
  title: project?.title || '',
  type: project?.type || 'own',
  status: project?.status || 'idea',
  summary: project?.summary || '',
  descriptionHtml: project?.descriptionHtml || '',
  role: project?.role || '',
  goals: (project?.goals || []).join('\n'),
  roadmap: (project?.roadmap || []).join('\n'),
  startDate: project?.startDate || '',
  coverFile: null,
  links: project?.links?.length ? project.links.map((link) => ({ ...link })) : [{ label: '', url: '' }],
});

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function ProjectPublishModal({
  fixedType,
  editProject,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editProject);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...(editProject ? toEditForm(editProject) : initialForm),
      type: fixedType || editProject?.type || 'own',
    });
    setError('');
  }, [editProject, fixedType, isOpen]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLink = (index, field, value) => {
    setForm((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: value } : link,
      ),
    }));
  };

  const addLink = () => {
    setForm((current) => ({
      ...current,
      links: [...current.links, { label: '', url: '' }].slice(0, 6),
    }));
  };

  const removeLink = (index) => {
    setForm((current) => ({
      ...current,
      links: current.links.filter((_, linkIndex) => linkIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!form.summary.trim() && !stripHtml(form.descriptionHtml)) {
      setError('Add a summary or project description before publishing.');
      return;
    }

    try {
      await onPublish(form);
      if (!isEditMode) {
        setForm(initialForm);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to save project.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit project' : 'Publish project'}</h2>
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
                placeholder="Project title"
              />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                <option value="idea">Idea</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="released">Released</option>
              </select>
            </label>
          </div>

          <div className={styles.grid}>
            <label>
              Role
              <input
                type="text"
                value={form.role}
                onChange={(event) => updateField('role', event.target.value)}
                placeholder="Owner, contributor, translator..."
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
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
            Summary
            <textarea
              value={form.summary}
              onChange={(event) => updateField('summary', event.target.value)}
              placeholder="Short project overview"
              rows={3}
            />
          </label>

          <div className={styles.fieldGroup}>
            <span>Description</span>
            <RichTextEditor
              value={form.descriptionHtml}
              enhanced
              disabled={isPublishing}
              onChange={(value, attachments) => setForm((current) => ({ ...current, descriptionHtml: value, attachments }))}
              placeholder="Describe the project"
            />
          </div>

          <div className={styles.grid}>
            <label>
              Goals
              <textarea
                value={form.goals}
                onChange={(event) => updateField('goals', event.target.value)}
                placeholder="One goal per line"
                rows={5}
              />
            </label>
            <label>
              Roadmap
              <textarea
                value={form.roadmap}
                onChange={(event) => updateField('roadmap', event.target.value)}
                placeholder="One roadmap item per line"
                rows={5}
              />
            </label>
          </div>

          <div className={styles.linkGroup}>
            <div className={styles.linkHeader}>
              <span>Links</span>
              <button type="button" onClick={addLink} disabled={form.links.length >= 6}>
                Add link
              </button>
            </div>
            {form.links.map((link, index) => (
              <div className={styles.linkRow} key={`${index}-${link.label}`}>
                <input
                  type="text"
                  value={link.label}
                  onChange={(event) => updateLink(index, 'label', event.target.value)}
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={link.url}
                  onChange={(event) => updateLink(index, 'url', event.target.value)}
                  placeholder="qortal:// or https://"
                />
                <button type="button" onClick={() => removeLink(index)} aria-label="Remove link">
                  <FaTrash />
                </button>
              </div>
            ))}
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

export default ProjectPublishModal;
