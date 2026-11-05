import type { Metadata } from 'next';
import ConnectedChatRoom from '@/features/chats/components/ConnectedChatRoom';

export const metadata: Metadata = { title: '채팅방 | SnapPick' };

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ chatRoomId: string }>;
}) {
  const { chatRoomId } = await params;
  return <ConnectedChatRoom roomId={chatRoomId} />;
}
