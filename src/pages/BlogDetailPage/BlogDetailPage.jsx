import RichTextContent from '../../components/common/RichTextContent';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaCommentDots, FaEdit, FaHeart, FaShareAlt } from 'react-icons/fa';
import BlogPublishModal from '../../components/blog/BlogPublishModal';
import InlineComments from '../../components/common/InlineComments';
import { useBlogComments } from '../../hooks/useBlogComments';
import {
  buildBlogPageLink,
  fetchBlogByIdentifier,
  fetchBlogCategories,
  getCurrentUserProfile,
  updateBlogPost,
} from '../../services/blogService';
import { fetchBlogLikeCount, publishBlogLike } from '../../services/blogEngagementService';
import { isOwnerName } from '../../utils/siteConfig';
import { copyTextToClipboard } from '../../utils/videoLinks';
import styles from './BlogDetailPage.module.css';

const formatDate = (value) => {
  if (!value) return 'No date selected';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date selected';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function BlogDetailPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [categories, setCategories] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const commentsRef = useRef(null);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useBlogComments({ profile, notify });

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
    const loadCategories = async () => {
      try {
        setCategories(await fetchBlogCategories());
      } catch (err) {
        console.warn('Unable to load blog categories', err);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadPost = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextPost = await fetchBlogByIdentifier(decodeURIComponent(postId || ''));
        setPost(nextPost);
      } catch (err) {
        setError(err?.message || 'Unable to load blog post.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  useEffect(() => {
    if (post) {
      comments.openComments(post, 5);
    }
  }, [post]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const loadLikes = async () => {
      if (!post) {
        setLikeCount(0);
        return;
      }

      try {
        const count = await fetchBlogLikeCount(post.identifier);
        if (!cancelled) setLikeCount(count);
      } catch {
        if (!cancelled) setLikeCount(0);
      }
    };

    loadLikes();

    return () => {
      cancelled = true;
    };
  }, [post]);

  const canEditPost = isOwnerName(profile.name);

  const savePostEdits = async (form) => {
    if (!post || !canEditPost) {
      throw new Error('Only the site owner can edit this blog post.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedPost = await updateBlogPost({
        post,
        form,
        authorName: profile.name,
      });
      setPost(updatedPost);
      if (updatedPost.category) {
        setCategories((current) =>
          current.includes(updatedPost.category)
            ? current
            : [...current, updatedPost.category].sort((a, b) => a.localeCompare(b)),
        );
      }
      setIsEditOpen(false);
      notify('Blog post updated.');
      return updatedPost;
    } catch (err) {
      setError(err?.message || 'Unable to update blog post.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;
    if (!profile.name || !profile.address) {
      notify('A Qortal account with a registered name is required.');
      return;
    }

    setIsLiking(true);

    try {
      await publishBlogLike({
        postId: post.identifier,
        postTitle: post.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });
      setLikeCount((current) => current + 1);
      notify('Blog post liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like blog post.');
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      await copyTextToClipboard(buildBlogPageLink(post));
      notify('Blog post link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return <p className={styles.status}>Loading blog post...</p>;
  }

  if (!post) {
    return (
      <section className={styles.page}>
        <Link to="/blog" className={styles.backLink}>Back to blog</Link>
        <p className={styles.status}>{error || 'Blog post not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <Link to="/blog" className={styles.backLink}>Back to blog</Link>

      <article className={styles.article}>
        {post.coverUrl && (
          <div className={styles.cover}>
            <img src={post.coverUrl} alt={post.title || 'Blog post cover'} />
          </div>
        )}

        <header className={styles.header}>
          <div>
            <div className={styles.meta}>
              <span>{formatDate(post.publishedDate)}</span>
              {post.category && <span>{post.category}</span>}
            </div>
            <h1>{post.title || 'Untitled blog post'}</h1>
            {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
            {post.tags.length > 0 && (
              <div className={styles.tags}>
                {post.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {canEditPost && (
            <button type="button" className={styles.editButton} onClick={() => setIsEditOpen(true)}>
              <FaEdit />
              <span>Edit post</span>
            </button>
          )}
        </header>

        <div className={styles.quickActions}>
          <button type="button" onClick={handleLike} disabled={isLiking} aria-label="Like blog post" title="Like">
            <FaHeart />
            <span>{likeCount || 0}</span>
          </button>
          <button type="button" onClick={handleShare} aria-label="Share blog post" title="Share">
            <FaShareAlt />
          </button>
          <button type="button" onClick={scrollToComments} aria-label="Comments" title="Comments">
            <FaCommentDots />
          </button>
        </div>

        <RichTextContent className={styles.content} html={post.contentHtml} authorName={post.authorName}
          fallback={<p>No content added yet.</p>} />
      </article>

      <div ref={commentsRef} className={styles.commentsWrap}>
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

      <BlogPublishModal
        categories={categories}
        editPost={post}
        isOpen={canEditPost && isEditOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditOpen(false)}
        onPublish={savePostEdits}
      />
    </section>
  );
}

export default BlogDetailPage;
