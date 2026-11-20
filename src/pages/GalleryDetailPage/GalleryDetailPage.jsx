import RichTextContent from '../../components/common/RichTextContent';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCommentDots,
  FaEdit,
  FaExpand,
  FaHeart,
  FaPaperPlane,
  FaShareAlt,
} from 'react-icons/fa';
import InlineComments from '../../components/common/InlineComments';
import GalleryPublishModal from '../../components/gallery/GalleryPublishModal';
import VideoTipModal from '../../components/videos/VideoTipModal';
import { useGalleryComments } from '../../hooks/useGalleryComments';
import { useQortTip } from '../../hooks/useQortTip';
import {
  fetchGalleryByIdentifier,
  getCurrentUserProfile,
  updateGallery,
} from '../../services/galleryService';
import {
  fetchGalleryLikeCount,
  publishGalleryLike,
} from '../../services/galleryEngagementService';
import styles from './GalleryDetailPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

function GalleryDetailPage() {
  const { galleryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gallery, setGallery] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullView, setIsFullView] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLikeCount, setImageLikeCount] = useState(0);
  const [isLikingImage, setIsLikingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const commentsRef = useRef(null);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useGalleryComments({ profile, notify });
  const tip = useQortTip({ notify });

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
    const loadGallery = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextGallery = await fetchGalleryByIdentifier(decodeURIComponent(galleryId || ''));
        setGallery(nextGallery);
      } catch (err) {
        setError(err?.message || 'Unable to load gallery.');
      } finally {
        setIsLoading(false);
      }
    };

    loadGallery();
  }, [galleryId]);

  useEffect(() => {
    if (!gallery?.images.length) return;
    const imageId = searchParams.get('image');
    const imageIndex = gallery.images.findIndex((image) => image.id === imageId);
    setActiveIndex(imageIndex >= 0 ? imageIndex : 0);
  }, [gallery, searchParams]);

  const canEditGallery = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;
  const activeImage = gallery?.images[activeIndex] || null;
  const activeEntity = useMemo(() => {
    if (!gallery || !activeImage) return null;
    return {
      identifier: `${gallery.identifier}_${activeImage.id}`,
      title: activeImage.description || gallery.title || 'Gallery image',
      authorName: gallery.authorName,
      authorAddress: gallery.authorAddress,
    };
  }, [activeImage, gallery]);

  useEffect(() => {
    if (activeEntity) {
      comments.openComments(activeEntity, 5);
    }
  }, [activeEntity]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const loadImageLikes = async () => {
      if (!activeEntity) {
        setImageLikeCount(0);
        return;
      }

      try {
        const count = await fetchGalleryLikeCount(activeEntity.identifier);
        if (!cancelled) setImageLikeCount(count);
      } catch {
        if (!cancelled) setImageLikeCount(0);
      }
    };

    loadImageLikes();

    return () => {
      cancelled = true;
    };
  }, [activeEntity]);

  const setImageIndex = (nextIndex) => {
    if (!gallery?.images.length) return;
    const normalizedIndex = (nextIndex + gallery.images.length) % gallery.images.length;
    setActiveIndex(normalizedIndex);
    setSearchParams({ image: gallery.images[normalizedIndex].id });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!gallery?.images.length) return;
      if (event.key === 'ArrowLeft') setImageIndex(activeIndex - 1);
      if (event.key === 'ArrowRight') setImageIndex(activeIndex + 1);
      if (event.key === 'Escape') setIsFullView(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleShare = async () => {
    const route = `${window.location.origin}${window.location.pathname}#/gallery/${encodeURIComponent(gallery.identifier)}?image=${encodeURIComponent(activeImage?.id || '')}`;
    try {
      await navigator.clipboard.writeText(route);
      notify('Image link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLikeImage = async () => {
    if (!activeEntity) return;
    if (!profile.name || !profile.address) {
      notify('A Qortal account with a registered name is required.');
      return;
    }

    setIsLikingImage(true);
    try {
      await publishGalleryLike({
        entityId: activeEntity.identifier,
        entityTitle: activeEntity.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });
      setImageLikeCount((current) => current + 1);
      notify('Image liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like image.');
    } finally {
      setIsLikingImage(false);
    }
  };

  const saveGalleryEdits = async (form) => {
    if (!gallery || !canEditGallery) {
      throw new Error('Only the site owner can edit this gallery.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updated = await updateGallery({
        gallery,
        form,
        authorName: profile.name,
      });
      setGallery(updated);
      setActiveIndex(0);
      setIsEditOpen(false);
      notify('Gallery updated.');
      return updated;
    } catch (err) {
      setError(err?.message || 'Unable to update gallery.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.status}>Loading gallery...</p>;
  }

  if (!gallery) {
    return (
      <section className={styles.page}>
        <Link to="/gallery" className={styles.backLink}>Back to galleries</Link>
        <p className={styles.status}>{error || 'Gallery not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <Link to="/gallery" className={styles.backLink}>Back to galleries</Link>

      <header className={styles.header}>
        <div>
          <h1>{gallery.title || 'Untitled gallery'}</h1>
          <RichTextContent className={styles.description} html={gallery.descriptionHtml} authorName={gallery.authorName}
            fallback="No description added yet." />
        </div>
        {canEditGallery && (
          <button type="button" className={styles.editButton} onClick={() => setIsEditOpen(true)}>
            <FaEdit />
            <span>Edit gallery</span>
          </button>
        )}
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {activeImage ? (
        <div className={styles.viewer}>
          <div className={styles.stage}>
            <button type="button" className={styles.navButton} onClick={() => setImageIndex(activeIndex - 1)}>
              <FaArrowLeft />
            </button>
            <img src={activeImage.src} alt={activeImage.description || gallery.title} />
            <button type="button" className={styles.navButton} onClick={() => setImageIndex(activeIndex + 1)}>
              <FaArrowRight />
            </button>
          </div>

          <aside className={styles.thumbnails}>
            {gallery.images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className={index === activeIndex ? styles.activeThumbnail : ''}
                onClick={() => setImageIndex(index)}
                aria-label={`Open image ${index + 1}`}
              >
                <img src={image.thumbnailUrl || image.src} alt="" />
              </button>
            ))}
          </aside>
        </div>
      ) : (
        <p className={styles.status}>No images in this gallery yet.</p>
      )}

      {activeImage && (
        <div className={styles.imageMeta}>
          <p>{activeImage.description || 'No image description added yet.'}</p>
          <div className={styles.imageActions}>
            <button type="button" onClick={handleLikeImage} disabled={isLikingImage}>
              <FaHeart />
              <span>{imageLikeCount}</span>
            </button>
            <button type="button" onClick={() => setIsFullView((current) => !current)}>
              <FaExpand />
            </button>
            <button type="button" onClick={handleShare}>
              <FaShareAlt />
            </button>
            <button type="button" onClick={() => tip.openTip(gallery)}>
              <FaPaperPlane />
            </button>
            <button type="button" onClick={scrollToComments}>
              <FaCommentDots />
            </button>
          </div>
        </div>
      )}

      {activeImage && (
        <div ref={commentsRef}>
          <InlineComments
            canLoadMore={comments.canLoadMoreComments}
            comments={comments.comments}
            error={comments.error}
            isLoading={comments.isLoading}
            isSaving={comments.isSaving}
            onAddComment={comments.addComment}
            onEditComment={comments.editComment}
            onLoadMore={comments.loadMoreComments}
            profile={profile}
          />
        </div>
      )}

      {isFullView && activeImage && (
        <div className={styles.fullscreenOverlay} role="dialog" aria-modal="true">
          <button type="button" className={styles.fullscreenClose} onClick={() => setIsFullView(false)}>
            Close
          </button>
          <button type="button" className={styles.fullscreenNavLeft} onClick={() => setImageIndex(activeIndex - 1)}>
            <FaArrowLeft />
          </button>
          <img src={activeImage.src} alt={activeImage.description || gallery.title} />
          <button type="button" className={styles.fullscreenNavRight} onClick={() => setImageIndex(activeIndex + 1)}>
            <FaArrowRight />
          </button>
        </div>
      )}

      <GalleryPublishModal
        editGallery={gallery}
        isOpen={canEditGallery && isEditOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditOpen(false)}
        onPublish={saveGalleryEdits}
      />

      <VideoTipModal
        amount={tip.amount}
        balance={tip.balance}
        error={tip.error}
        isLoading={tip.isLoading}
        isOpen={tip.isOpen}
        isSending={tip.isSending}
        onAmountChange={tip.setAmount}
        onClose={tip.closeTip}
        onSend={tip.sendTip}
        recipientAddress={tip.recipientAddress}
        video={tip.video}
      />

    </section>
  );
}

export default GalleryDetailPage;
