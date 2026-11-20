import RichTextContent from '../../components/common/RichTextContent';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaEdit, FaMapMarkerAlt } from 'react-icons/fa';
import StoryEntryPublishModal from '../../components/storybook/StoryEntryPublishModal';
import {
  fetchLifeStoryByIdentifier,
  getCurrentUserProfile,
  updateLifeStoryEntry,
} from '../../services/lifeStoryService';
import { isOwnerName } from '../../utils/siteConfig';
import styles from './StoryEntryDetailPage.module.css';

function StoryEntryDetailPage() {
  const { entryId } = useParams();
  const [entry, setEntry] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await getCurrentUserProfile());
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadEntry = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextEntry = await fetchLifeStoryByIdentifier(decodeURIComponent(entryId || ''));
        setEntry(nextEntry);
      } catch (err) {
        setError(err?.message || 'Unable to load story entry.');
      } finally {
        setIsLoading(false);
      }
    };

    loadEntry();
  }, [entryId]);

  const canEditEntry = isOwnerName(profile.name);

  const saveEntryEdits = async (form) => {
    if (!entry || !canEditEntry) {
      throw new Error('Only the site owner can edit this story entry.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedEntry = await updateLifeStoryEntry({
        entry,
        form,
        authorName: profile.name,
      });
      setEntry(updatedEntry);
      setIsEditOpen(false);
      notify('Story entry updated.');
      return updatedEntry;
    } catch (err) {
      setError(err?.message || 'Unable to update story entry.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.status}>Loading story entry...</p>;
  }

  if (!entry) {
    return (
      <section className={styles.page}>
        <Link to="/storybook" className={styles.backLink}>Back to storybook</Link>
        <p className={styles.status}>{error || 'Story entry not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <Link to="/storybook" className={styles.backLink}>Back to storybook</Link>

      <article className={styles.bookPage}>
        {entry.coverUrl && (
          <div className={styles.cover}>
            <img src={entry.coverUrl} alt={entry.title || 'Life story cover'} />
          </div>
        )}

        <header className={styles.header}>
          <div>
            <p className={styles.period}>{entry.periodText}</p>
            <h1>{entry.title || 'Untitled chapter'}</h1>
            {entry.location && (
              <p className={styles.location}>
                <FaMapMarkerAlt />
                <span>{entry.location}</span>
              </p>
            )}
            {entry.excerpt && <p className={styles.excerpt}>{entry.excerpt}</p>}
          </div>

          {canEditEntry && (
            <button type="button" className={styles.editButton} onClick={() => setIsEditOpen(true)}>
              <FaEdit />
              <span>Edit entry</span>
            </button>
          )}
        </header>

        <RichTextContent className={styles.content} html={entry.contentHtml} authorName={entry.authorName}
          fallback={<p>No story content added yet.</p>} />
      </article>

      <StoryEntryPublishModal
        editEntry={entry}
        isOpen={canEditEntry && isEditOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditOpen(false)}
        onPublish={saveEntryEdits}
      />
    </section>
  );
}

export default StoryEntryDetailPage;
