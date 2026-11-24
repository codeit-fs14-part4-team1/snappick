import { useGuestLoginModal } from '@/components/ui/GuestLoginProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePhotoLike, type UsePhotoLikeParams } from './usePhotoLike';
import { getViewerKind } from '@/features/feed/viewerKind';

export function usePhotoLikeAction({ photoId, liked }: UsePhotoLikeParams) {
  const { authStatus, user } = useAuth();
  const { openGuestLoginModal } = useGuestLoginModal();
  const { toggleLike } = usePhotoLike({ photoId, liked });
  const viewerKind = getViewerKind(authStatus, user);

  function handleLikeClick() {
    if (viewerKind === 'pending') return;
    if (viewerKind === 'guest') {
      openGuestLoginModal();
      return;
    }
    if (viewerKind === 'user') toggleLike();
  }

  return { viewerKind, handleLikeClick };
}
