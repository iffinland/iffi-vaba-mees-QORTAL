import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import VideoCard from '../../components/videos/VideoCard';
import VideoCommentsModal from '../../components/videos/VideoCommentsModal';
import VideoDescriptionEditModal from '../../components/videos/VideoDescriptionEditModal';
import VideoPublishModal from '../../components/videos/VideoPublishModal';
import VideoTipModal from '../../components/videos/VideoTipModal';
import { useQortTip } from '../../hooks/useQortTip';
import { useVideoComments } from '../../hooks/useVideoComments';
import { useVideos } from '../../hooks/useVideos';
import {
  buildVideoChatEmbedLink,
  buildVideoPageLink,
  copyTextToClipboard,
} from '../../utils/videoLinks';
import styles from './VideosPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

function VideosPage() {
  const navigate = useNavigate();
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [editingDescriptionVideo, setEditingDescriptionVideo] = useState(null);
  const [toast, setToast] = useState('');
  const {
    error,
    filteredVideos,
    hasNextPage,
    isLoading,
    isPublishing,
    isUpdatingVideo,
    likeCounts,
    page,
    playlists,
    profile,
    publishNewVideo,
    saveVideoDescription,
    searchQuery,
    selectedPlaylist,
    setPage,
    setSelectedPlaylist,
    setSearchQuery,
    setSortOrder,
    sortOrder,
    likeVideo,
  } = useVideos();

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useVideoComments({ profile, notify });
  const tip = useQortTip({ notify });
  const canPublishVideos = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;

  const handlePublish = async (form) => {
    await publishNewVideo(form);
    notify('Video published successfully.');
  };

  const handleShare = async (video) => {
    try {
      await copyTextToClipboard(buildVideoPageLink(video));
      notify('Video link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const handlePostToChat = async (video) => {
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

  const handleLike = async (video) => {
    try {
      await likeVideo(video);
      notify('Video liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like video.');
    }
  };

  const handleDescriptionSave = async ({ video, descriptionHtml, attachments }) => {
    await saveVideoDescription({ video, descriptionHtml, attachments });
    notify('Video description updated.');
  };

  const openVideoDetail = (video) => {
    navigate(`/videos/${encodeURIComponent(video.identifier)}`);
  };

  const handleCommentPublished = (video) => {
    comments.closeComments();
    openVideoDetail(video);
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.hero}>
        <div>
          <h1>Videos</h1>
          <p>
            Watch videos I've recorded at different moments and in various situations throughout my life.
          </p>
        </div>
        {canPublishVideos && (
          <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
            <FaPlus />
            <span>Publish video</span>
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <FaSearch />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search videos"
          />
        </label>

        <label className={styles.sortBox}>
          Sort
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        <label className={styles.sortBox}>
          Playlists
          <select
            value={selectedPlaylist}
            onChange={(event) => setSelectedPlaylist(event.target.value)}
          >
            <option value="">All playlists</option>
            {playlists.map((playlist) => (
              <option key={playlist} value={playlist}>
                {playlist}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.status}>Loading videos...</p>
      ) : filteredVideos.length === 0 ? (
        <p className={styles.status}>No videos found.</p>
      ) : (
        <div className={styles.grid}>
          {filteredVideos.map((video) => (
            <VideoCard
              canEditDescription={canPublishVideos}
              key={video.identifier}
              video={video}
              likeCount={likeCounts[video.identifier] || 0}
              onComment={comments.openComments}
              onEditDescription={setEditingDescriptionVideo}
              onLike={handleLike}
              onOpenDetail={openVideoDetail}
              onPostToChat={handlePostToChat}
              onShare={handleShare}
              onTip={tip.openTip}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || isLoading}>
          Previous
        </button>
        <span>Page {page}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={!hasNextPage || isLoading}>
          Next
        </button>
      </div>

      <VideoPublishModal
        isOpen={canPublishVideos && isPublishOpen}
        isPublishing={isPublishing}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
        playlists={playlists}
      />

      <VideoDescriptionEditModal
        isOpen={canPublishVideos && Boolean(editingDescriptionVideo)}
        isSaving={isUpdatingVideo}
        onClose={() => setEditingDescriptionVideo(null)}
        onSave={handleDescriptionSave}
        video={editingDescriptionVideo}
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

      <VideoCommentsModal
        comments={comments.comments}
        error={comments.error}
        isLoading={comments.isLoading}
        isOpen={Boolean(comments.activeVideo)}
        isSaving={comments.isSaving}
        onAddComment={comments.addComment}
        onCommentPublished={handleCommentPublished}
        onClose={comments.closeComments}
        onEditComment={comments.editComment}
        profile={profile}
        video={comments.activeVideo}
      />
    </section>
  );
}

export default VideosPage;
