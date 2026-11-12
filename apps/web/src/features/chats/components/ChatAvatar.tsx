'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ChatRooms.module.css';

export default function ChatAvatar({
  src,
  nickname,
  size = 40,
}: {
  src: string | null;
  nickname: string | null;
  size?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);
  const initial = nickname?.trim().charAt(0) ?? '';
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size }}
      data-fallback={!showImage && Boolean(initial)}
      aria-hidden="true"
    >
      {src && showImage ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
