import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './VideoPublishModal.module.css';

const initialForm = {
  title: '',
  performer: '',
  descriptionHtml: '',
  playlist: '',
  newPlaylist: '',
  publishedDate: '',
  sourceType: 'qtube',
  sourceUrl: '',
  thumbnailFile: null,
  videoFile: null,
};

const toEditForm = (video) => ({
  title: video?.title || '',
  performer: video?.performer || '',
  descriptionHtml: video?.descriptionHtml || '',
  playlist: video?.playlist || '',
  newPlaylist: '',
  publishedDate: video?.publishedDate || '',
  sourceType: video?.sourceType || 'qtube',
  sourceUrl: video?.sourceUrl || '',
  thumbnailFile: null,
  videoFile: null,
});

function VideoPublishModal({
  editVideo,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
  playlists,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editVideo);

  const playlistOptions = useMemo(() => Array.from(new Set(playlists.filter(Boolean))), [playlists]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editVideo ? toEditForm(editVideo) : initialForm);
    setError('');
  }, [editVideo, isOpen]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSourceType = (sourceType) => {
    setForm((current) => ({
      ...current,
      sourceType,
      sourceUrl: sourceType === 'upload' ? '' : current.sourceUrl,
      videoFile: sourceType === 'upload' ? current.videoFile : null,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onPublish({
        ...form,
        playlist: form.newPlaylist.trim() || form.playlist,
      });
      if (!isEditMode) {
        setForm(initialForm);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to publish video.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit video' : 'Publish video'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.sourceTabs}>
            {[
              ['qtube', 'Q-Tube link'],
              ['bridge', 'Qortal video bridge'],
              ['upload', 'Upload file'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={form.sourceType === value ? styles.activeSource : ''}
                onClick={() => updateSourceType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.sourceHint}>
            All fields are optional. Playback needs an uploaded video file or a working
            QDN video link.
          </p>

          {form.sourceType === 'upload' ? (
            <label>
              Video file
              <input
                type="file"
                accept="video/*"
                onChange={(event) => updateField('videoFile', event.target.files?.[0] || null)}
              />
              {isEditMode && (
                <span className={styles.fieldHint}>
                  Leave empty to keep the current uploaded video.
                </span>
              )}
            </label>
          ) : (
            <label>
              {form.sourceType === 'bridge' ? 'Qortal video bridge QDN URI' : 'Video link'}
              <input
                type="text"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                placeholder={
                  form.sourceType === 'bridge'
                    ? 'Paste qortal://VIDEO/Qortal-Video-Bridge/video-identifier'
                    : 'Paste a Q-Tube video link'
                }
              />
            </label>
          )}

          <div className={styles.grid}>
            <label>
              Thumbnail image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => updateField('thumbnailFile', event.target.files?.[0] || null)}
              />
              {isEditMode && (
                <span className={styles.fieldHint}>
                  Leave empty to keep the current thumbnail.
                </span>
              )}
              <span className={styles.fieldHint}>
                Image file only. Maximum upload size: 5 MB.
              </span>
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

          <div className={styles.grid}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Video title"
              />
            </label>
            <label>
              Performer
              <input
                type="text"
                value={form.performer}
                onChange={(event) => updateField('performer', event.target.value)}
                placeholder="Performer or creator"
              />
            </label>
          </div>

          <div className={styles.grid}>
            <label>
              Playlist
              <select value={form.playlist} onChange={(event) => updateField('playlist', event.target.value)}>
                <option value="">No playlist</option>
                {playlistOptions.map((playlist) => (
                  <option key={playlist} value={playlist}>
                    {playlist}
                  </option>
                ))}
              </select>
            </label>
            <label>
              New playlist
              <input
                type="text"
                value={form.newPlaylist}
                onChange={(event) => updateField('newPlaylist', event.target.value)}
                placeholder="Create a playlist"
              />
            </label>
          </div>

          <div className={styles.fieldGroup}>
            <span>Description</span>
            <RichTextEditor
              value={form.descriptionHtml}
              enhanced
              disabled={isPublishing}
              onChange={(value, attachments) => setForm((current) => ({ ...current, descriptionHtml: value, attachments }))}
              placeholder="Add notes, links, or context"
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

export default VideoPublishModal;
