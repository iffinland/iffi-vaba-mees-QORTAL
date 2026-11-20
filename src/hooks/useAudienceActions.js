import { useMemo, useState } from 'react';
import {
  canUseFollowAction,
  followWebsiteNames,
  getFollowNames,
} from '../services/audienceActionsService';

function formatNameList(names) {
  return names.join(', ');
}

export function useAudienceActions() {
  const [isFollowOpen, setIsFollowOpen] = useState(false);
  const [isSubmittingFollow, setIsSubmittingFollow] = useState(false);
  const [followMessage, setFollowMessage] = useState('');
  const [notice, setNotice] = useState('');
  const followNames = useMemo(() => getFollowNames(), []);
  const canFollow = canUseFollowAction();

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const openFollow = () => {
    setFollowMessage('');
    setIsFollowOpen(true);
  };

  const closeFollow = () => {
    setIsFollowOpen(false);
  };

  const follow = async () => {
    setIsSubmittingFollow(true);
    setFollowMessage('');

    try {
      const names = await followWebsiteNames();
      const message = `Following ${formatNameList(names)}. Qortal Core can now mirror this website's resources.`;
      setFollowMessage(message);
      showNotice('Follow added to Qortal.');
    } catch (error) {
      setFollowMessage(error instanceof Error ? error.message : 'Unable to follow this website.');
    } finally {
      setIsSubmittingFollow(false);
    }
  };

  return {
    canFollow,
    closeFollow,
    follow,
    followMessage,
    followNames,
    isFollowOpen,
    isSubmittingFollow,
    notice,
    openFollow,
  };
}
