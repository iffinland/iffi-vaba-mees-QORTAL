import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchVideoPage,
  fetchVideoPlaylists,
  getCurrentUserProfile,
  publishVideo,
  updateVideoDescription,
} from '../services/videoService';
import { fetchVideoLikeCount, publishVideoLike } from '../services/videoEngagementService';

const PAGE_SIZE = 9;

export const useVideos = () => {
  const [videos, setVideos] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);
  const [likeCounts, setLikeCounts] = useState({});

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchVideoPage({
        page,
        pageSize: PAGE_SIZE,
        playlist: selectedPlaylist,
        searchQuery,
        sortOrder,
      });
      setVideos(result.videos);
      setHasNextPage(result.hasNextPage);

      const counts = await Promise.all(
        result.videos.map(async (video) => {
          try {
            return [video.identifier, await fetchVideoLikeCount(video.identifier)];
          } catch {
            return [video.identifier, 0];
          }
        }),
      );
      setLikeCounts(Object.fromEntries(counts));
    } catch (err) {
      setError(err?.message || 'Unable to load videos.');
      setVideos([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, selectedPlaylist, sortOrder]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const nextProfile = await getCurrentUserProfile();
        setProfile(nextProfile);
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

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
    setPage(1);
  }, [searchQuery, selectedPlaylist, sortOrder]);

  const filteredVideos = useMemo(() => {
    return videos;
  }, [videos]);

  const publishNewVideo = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedVideo = await publishVideo({
          form,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setVideos((current) => [savedVideo, ...current].slice(0, PAGE_SIZE));
        if (savedVideo.playlist) {
          setPlaylists((current) =>
            current.includes(savedVideo.playlist)
              ? current
              : [...current, savedVideo.playlist].sort((a, b) => a.localeCompare(b)),
          );
        }
        return savedVideo;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name],
  );

  const likeVideo = useCallback(
    async (video) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      await publishVideoLike({
        videoId: video.identifier,
        videoTitle: video.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });

      setLikeCounts((current) => ({
        ...current,
        [video.identifier]: (current[video.identifier] || 0) + 1,
      }));
    },
    [profile.address, profile.name],
  );

  const saveVideoDescription = useCallback(
    async ({ video, descriptionHtml, attachments }) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsUpdatingVideo(true);
      try {
        const updatedVideo = await updateVideoDescription({
          video,
          descriptionHtml,
          attachments,
          authorName: profile.name,
        });
        setVideos((current) =>
          current.map((item) =>
            item.identifier === updatedVideo.identifier ? updatedVideo : item,
          ),
        );
        return updatedVideo;
      } finally {
        setIsUpdatingVideo(false);
      }
    },
    [profile.address, profile.name],
  );

  return {
    error,
    filteredVideos,
    hasNextPage,
    isLoading,
    isPublishing,
    isUpdatingVideo,
    likeCounts,
    loadVideos,
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
  };
};
