'use client';

import Tabs from '@/components/ui/Tabs';
import StateMessage from '@/components/ui/StateMessage';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useLikedPhotos } from '../hooks/useLikedPhotos';
import { useSavedPhotographers } from '../hooks/useSavedPhotographers';
import { useState } from 'react';
import LikedPhotoList from './LikedPhotoList';
import SavedPhotographerList from './SavedPhotographerList';
import styles from './MyPickContent.module.css';

export default function MyPickContent() {
  const { user } = useAuth();

  if (user?.accountType !== 'USER') {
    return (
      <StateMessage
        title="일반 회원만 이용할 수 있어요"
        link={{ label: '홈으로', href: '/' }}
        role="status"
      />
    );
  }

  return <MyPickTabs />;
}

function MyPickTabs() {
  const { data: likedPhotos } = useLikedPhotos();
  const { data: savedPhotographers } = useSavedPhotographers();
  const [tab, setTab] = useState('photos');

  const mypickItems = [
    {
      value: 'photos',
      label: '좋아요한 사진',
      count: likedPhotos?.pages[0]?.totalCount,
    },
    {
      value: 'photographers',
      label: '저장한 작가',
      count: savedPhotographers?.pages[0]?.totalCount,
    },
  ];

  return (
    <>
      <Tabs
        items={mypickItems}
        value={tab}
        onValueChange={setTab}
        aria-label="MY 픽 목록"
        className={styles.tabs}
      />

      {tab === 'photos' ? <LikedPhotoList /> : <SavedPhotographerList />}
    </>
  );
}
