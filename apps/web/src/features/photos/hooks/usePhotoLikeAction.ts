import { useGuestLoginModal } from '@/components/ui/GuestLoginProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AUTH_UNKNOWN_MESSAGE } from '@/features/auth/messages';
import { usePhotoLike, type UsePhotoLikeParams } from './usePhotoLike';
import { getViewerKind } from '@/features/feed/viewerKind';

export function usePhotoLikeAction({ photoId, liked }: UsePhotoLikeParams) {
  const { authStatus, user } = useAuth();
  const { openGuestLoginModal } = useGuestLoginModal();
  const { showToast } = useToast();
  const { toggleLike } = usePhotoLike({ photoId, liked });
  const viewerKind = getViewerKind(authStatus, user);

  function handleLikeClick() {
    if (viewerKind === 'pending') return;
    if (viewerKind === 'unknown') {
      showToast(AUTH_UNKNOWN_MESSAGE, 'error');
      return;
    }
    if (viewerKind === 'guest') {
      openGuestLoginModal();
      return;
    }
    if (viewerKind === 'user') toggleLike();
  }

  return { viewerKind, handleLikeClick };
}
