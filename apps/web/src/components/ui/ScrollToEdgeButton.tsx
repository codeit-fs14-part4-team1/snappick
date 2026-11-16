'use client';

import { useEffect, useState, type RefObject } from 'react';
import styles from './ScrollToEdgeButton.module.css';

type Props = {
  /** direction: 스크롤 이동 방향 / top이면 최상단, bottom이면 최하단으로 이동 */
  direction: 'top' | 'bottom';
  /** targetRef: 스크롤할 대상 요소의 ref / 생략하면 페이지 전체 스크롤 */
  targetRef?: RefObject<HTMLElement | null>;
  /** threshold: 어느 시점/거리(px)에서부터 버튼을 표시할지에 대한 수치 */
  threshold?: number;
  /** className: 버튼에 추가할 CSS 클래스 */
  className?: string;
  /** onScrollStart: 스크롤 이동 전에 호출되는 함수 / 위치 고정 등 사용하는 화면의 스크롤 제어 해제 */
  onScrollStart?: () => void;
};

export default function ScrollToEdgeButton({
  direction,
  targetRef,
  threshold = 300,
  className,
  onScrollStart,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = targetRef ? targetRef.current : document.scrollingElement;
    if (!target) return;
    let frame = 0;
    const scrollSource = targetRef ? target : window;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distance =
          direction === 'top'
            ? target.scrollTop
            : target.scrollHeight - target.clientHeight - target.scrollTop;
        setVisible(distance > Math.max(0, threshold));
      });
    };
    const resize = new ResizeObserver(update);
    const observeContent = () => {
      resize.disconnect();
      resize.observe(target);
      for (const child of target.children) resize.observe(child);
      update();
    };
    const mutation = new MutationObserver(observeContent);
    mutation.observe(target, { childList: true, subtree: true });
    observeContent();
    scrollSource.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      scrollSource.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [direction, targetRef, threshold]);

  if (!visible) return null;
  const label = direction === 'top' ? '최상단으로 이동' : '최하단으로 이동';
  return (
    <button
      type="button"
      className={[styles.button, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      onClick={() => {
        const target = targetRef
          ? targetRef.current
          : document.scrollingElement;
        if (!target) return;
        onScrollStart?.();
        const top = direction === 'top' ? 0 : target.scrollHeight;
        const behavior =
          direction === 'bottom' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth';
        if (targetRef) target.scrollTo({ top, behavior });
        else window.scrollTo({ top, behavior });
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={
            direction === 'top'
              ? 'M12 19V5m-6 6 6-6 6 6'
              : 'M12 5v14m-6-6 6 6 6-6'
          }
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
