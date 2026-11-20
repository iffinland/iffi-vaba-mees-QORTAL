import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './VideoDescriptionEditModal.module.css';

function VideoDescriptionEditModal({ isOpen, isSaving, onClose, onSave, video }) {
  const [draft, setDraft] = useState({ descriptionHtml: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraft({ descriptionHtml: video?.descriptionHtml || '' });
      setError('');
    }
  }, [isOpen, video]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onSave({ video, ...draft });
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to update description.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>Edit description</h2>
            <p>{video?.title || 'Untitled video'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <span>Description</span>
            <RichTextEditor
              value={draft.descriptionHtml}
              enhanced
              disabled={isSaving}
              onChange={(descriptionHtml, attachments) => setDraft({ descriptionHtml, attachments })}
              placeholder="Update the video description"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save description'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VideoDescriptionEditModal;
