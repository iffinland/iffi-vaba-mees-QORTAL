import RichTextContent from '../../components/common/RichTextContent';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FaCommentDots,
  FaEdit,
  FaHeart,
  FaLink,
  FaPaperPlane,
  FaShareAlt,
} from 'react-icons/fa';
import InlineComments from '../../components/common/InlineComments';
import VideoPublishModal from '../../components/videos/VideoPublishModal';
import VideoTipModal from '../../components/videos/VideoTipModal';
import { useQortTip } from '../../hooks/useQortTip';
import { useVideoComments } from '../../hooks/useVideoComments';
import { useVideoResource } from '../../hooks/useVideoResource';
import {
  fetchVideoLikeCount,
  publishVideoLike,
} from '../../services/videoEngagementService';
import {
  fetchVideoByIdentifier,
  fetchVideoPlaylists,
  getCurrentUserProfile,
  updateVideo,
} from '../../services/videoService';
import {
  buildVideoChatEmbedLink,
  buildVideoPageLink,
  copyTextToClipboard,
} from '../../utils/videoLinks';
import styles from './VideoDetailPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

const formatDate = (value) => {
  if (!value) return 'No date selected';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function VideoDetailPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const commentsRef = useRef(null);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useVideoComments({ profile, notify });
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
    const loadPlaylists = async () => {
      try {
        setPlaylists(await fetchVideoPlaylists());
      } catch (err) {
        console.warn('Unable to load video playlists', err);
      }
    };

    loadPlaylists();
  }, []);

  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextVideo = await fetchVideoByIdentifier(decodeURIComponent(videoId || ''));
        setVideo(nextVideo);
      } catch (err) {
        setError(err?.message || 'Unable to load video details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  useEffect(() => {
    if (video) {
      comments.openComments(video, 5);
    }
  }, [video]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const loadLikes = async () => {
      if (!video) {
        setLikeCount(0);
        return;
      }

      try {
        const count = await fetchVideoLikeCount(video.identifier);
        if (!cancelled) setLikeCount(count);
      } catch {
        if (!cancelled) setLikeCount(0);
      }
    };

    loadLikes();

    return () => {
      cancelled = true;
    };
  }, [video]);

  const canEditVideo = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;
  const videoResource = useVideoResource(video);

  const saveVideoEdits = async (form) => {
    if (!video || !canEditVideo) {
      throw new Error('Only the site owner can edit this video.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedVideo = await updateVideo({
        video,
        form,
        authorName: profile.name,
      });
      setVideo(updatedVideo);
      if (updatedVideo.playlist) {
        setPlaylists((current) =>
          current.includes(updatedVideo.playlist)
            ? current
            : [...current, updatedVideo.playlist].sort((a, b) => a.localeCompare(b)),
        );
      }
      setIsEditVideoOpen(false);
    } catch (err) {
      setError(err?.message || 'Unable to update video.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleLike = async () => {
    if (!video) return;
    if (!profile.name || !profile.address) {
      notify('A Qortal account with a registered name is required.');
      return;
    }

    setIsLiking(true);

    try {
      await publishVideoLike({
        videoId: video.identifier,
        videoTitle: video.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });
      setLikeCount((current) => current + 1);
      notify('Video liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like video.');
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    try {
      await copyTextToClipboard(buildVideoPageLink(video));
      notify('Video link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const handlePostToChat = async () => {
    const chatLink = buildVideoChatEmbedLink(video);

    if (!chatLink) {
      notify('Chat embed link is unavailable for this video.');
      return;
    }

    try {
      await copyTextToClipboard(chatLink);
      notify('Chat embed link copied.');
    } catch {
      notify('Unable to copy chat embed link.');
    }
  };

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return <p className={styles.status}>Loading video details...</p>;
  }

  if (!video) {
    return (
      <section className={styles.page}>
        <Link to="/videos" className={styles.backLink}>Back to videos</Link>
        <p className={styles.status}>{error || 'Video not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <Link to="/videos" className={styles.backLink}>Back to videos</Link>

      <article className={styles.detail}>
        <div className={styles.mediaPanel}>
          {videoResource.resourceUrl ? (
            <video
              aria-label={video.title || 'Video player'}
              className={styles.videoPlayer}
              controls
              poster={video.thumbnailUrl || undefined}
              preload="metadata"
              src={videoResource.resourceUrl}
            />
          ) : (
            <>
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
              ) : (
                <div className={styles.placeholder}>Video</div>
              )}
              <div className={styles.playerStatus}>
                {videoResource.isLoading ? (
                  <span>
                    Video is syncing from QDN
                    {videoResource.progress ? ` (${videoResource.progress}%)` : '...'}
                  </span>
                ) : (
                  <span>
                    {videoResource.error ||
                      'This source cannot be played directly in the video player yet.'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.infoPanel}>
          <h1>{video.title || 'Untitled video'}</h1>
          <p className={styles.meta}>{formatDate(video.publishedDate)}</p>
          {video.performer && <p className={styles.strongMeta}>{video.performer}</p>}
          {video.playlist && <p className={styles.strongMeta}>{video.playlist}</p>}
          <div className={styles.quickActions}>
            <button type="button" onClick={handleLike} disabled={isLiking} aria-label="Like video" title="Like">
              <FaHeart />
              <span>{likeCount || 0}</span>
            </button>
            <button type="button" onClick={handleShare} aria-label="Share video" title="Share">
              <FaShareAlt />
            </button>
            <button type="button" onClick={handlePostToChat} aria-label="Copy chat embed link" title="Copy chat embed link">
              <FaLink />
            </button>
            <button type="button" onClick={() => tip.openTip(video)} aria-label="Send tip" title="Send tip">
              <FaPaperPlane />
            </button>
            <button type="button" onClick={scrollToComments} aria-label="Comments" title="Comments">
              <FaCommentDots />
            </button>
          </div>
          {canEditVideo && (
            <button
              type="button"
              className={styles.editVideoButton}
              onClick={() => setIsEditVideoOpen(true)}
            >
              <FaEdit />
              <span>Edit video</span>
            </button>
          )}
        </div>
      </article>

      <section className={styles.descriptionSection}>
        <h2>Description</h2>
        {video.descriptionHtml ? (
          <RichTextContent className={styles.description} html={video.descriptionHtml} authorName={video.authorName} />
        ) : (
          <p className={styles.status}>No description added yet.</p>
        )}
      </section>

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

      <VideoPublishModal
        editVideo={video}
        isOpen={canEditVideo && isEditVideoOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditVideoOpen(false)}
        onPublish={saveVideoEdits}
        playlists={playlists}
      />
    </section>
  );
}

export default VideoDetailPage;
