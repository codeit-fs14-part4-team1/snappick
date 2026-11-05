'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ChatRooms.module.css';

export default function ChatAvatar({
  src,
  size = 40,
}: {
  src: string | null;
  size?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src && failedSrc !== src && (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}
