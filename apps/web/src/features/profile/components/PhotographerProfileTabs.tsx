'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PhotographerProfileTabs.module.css';

type PhotographerProfileTabsProps = {
  portfolioCount: number;
  productCount: number;
  reviewCount: number;
};

// 각 탭과 연결되는 콘텐츠 영역의 ID를 정의함
const SECTION_IDS = ['portfolio', 'products', 'reviews'] as const;

type SectionId = (typeof SECTION_IDS)[number];

// 고정된 탭 아래 콘텐츠가 가려지지 않도록 추가 여백을 설정함
const SCROLL_GAP = 16;

// Header와 고정 탭의 높이를 반영하여 스크롤 위치를 계산함
function getScrollOffset() {
  const tabs = document.getElementById('photographer-profile-tabs');

  if (!tabs) return 96;

  const stickyTop = Number.parseFloat(window.getComputedStyle(tabs).top);

  return (
    (Number.isFinite(stickyTop) ? stickyTop : 0) +
    tabs.getBoundingClientRect().height +
    SCROLL_GAP
  );
}

export default function PhotographerProfileTabs({
  portfolioCount,
  productCount,
  reviewCount,
}: PhotographerProfileTabsProps) {
  // 현재 활성화된 탭을 관리함
  const [activeTab, setActiveTab] = useState<SectionId>('portfolio');

  // 탭 클릭에 따른 자동 스크롤 중 활성 상태가 변경되지 않도록 관리함
  const clickedTabRef = useRef<SectionId | null>(null);

  // 작가 프로필 콘텐츠 항목을 정의함
  const tabs = [
    { id: 'portfolio', label: '포트폴리오', count: portfolioCount },
    { id: 'products', label: '촬영 상품', count: productCount },
    { id: 'reviews', label: '리뷰', count: reviewCount },
  ] as const;

  // 탭 클릭 시 해당 콘텐츠 영역으로 부드럽게 이동함
  const handleTabClick = (sectionId: SectionId) => {
    const section = document.getElementById(sectionId);

    if (!section) return;

    // 클릭한 탭을 기억하여 자동 스크롤 중 활성 상태를 유지함
    clickedTabRef.current = sectionId;

    // 클릭한 메뉴를 즉시 활성화함
    setActiveTab(sectionId);

    // 고정된 Header와 탭의 높이를 고려하여 이동 위치를 계산함
    const sectionTop =
      window.scrollY + section.getBoundingClientRect().top - getScrollOffset();

    // 사용자 환경의 애니메이션 감소 설정을 확인함
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // 해당 콘텐츠 영역으로 이동함
    window.scrollTo({
      top: Math.max(0, sectionTop),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  // 사용자가 직접 스크롤할 때 활성 탭을 변경함
  useEffect(() => {
    let animationFrameId: number | null = null;

    // 현재 스크롤 위치를 기준으로 활성 탭을 결정함
    const updateActiveTab = () => {
      animationFrameId = null;

      // 탭 클릭에 의한 자동 스크롤 중에는 활성 상태를 변경하지 않음
      if (clickedTabRef.current !== null) return;

      let currentSection: SectionId = 'portfolio';

      // 고정 탭 아래의 콘텐츠 영역을 기준으로 활성 위치를 계산함
      const activationLine =
        getScrollOffset() + Math.min(120, window.innerHeight * 0.18);

      // 각 콘텐츠 영역의 위치를 확인함
      for (const sectionId of SECTION_IDS) {
        const section = document.getElementById(sectionId);

        if (!section) continue;

        const sectionTop = section.getBoundingClientRect().top;

        // 기준선에 도달한 마지막 콘텐츠를 활성화함
        if (sectionTop <= activationLine) {
          currentSection = sectionId;
        }
      }

      // 페이지 끝까지 직접 스크롤하면 리뷰 탭을 활성화함
      const isAtBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2;

      if (isAtBottom && document.getElementById('reviews')) {
        currentSection = 'reviews';
      }

      // 실제 활성 탭이 달라졌을 때만 상태를 변경함
      setActiveTab((previous) =>
        previous === currentSection ? previous : currentSection,
      );
    };

    // 스크롤 이벤트 처리를 브라우저 렌더링 주기에 맞춰 실행함
    const handleScroll = () => {
      if (animationFrameId !== null) return;

      animationFrameId = window.requestAnimationFrame(updateActiveTab);
    };

    // 사용자의 직접적인 스크롤 동작이 시작되면 자동 스크롤 잠금을 해제함
    const resumeScrollTracking = () => {
      if (clickedTabRef.current === null) return;

      clickedTabRef.current = null;
    };

    // 키보드를 사용한 직접 스크롤을 감지함
    const handleKeyDown = (event: KeyboardEvent) => {
      const scrollKeys = [
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        ' ',
      ];

      if (!scrollKeys.includes(event.key)) return;

      // 입력 필드에서 사용하는 방향키는 스크롤 조작으로 처리하지 않음
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches('input, textarea, select') ||
          event.target.isContentEditable)
      ) {
        return;
      }

      resumeScrollTracking();
    };

    // 스크롤바 드래그 등 마우스 조작을 감지함
    const handlePointerDown = (event: PointerEvent) => {
      const tabsElement = document.getElementById('photographer-profile-tabs');

      // 탭을 직접 클릭한 경우에는 선택 상태를 유지함
      if (event.target instanceof Node && tabsElement?.contains(event.target)) {
        return;
      }

      resumeScrollTracking();
    };

    // 스크롤과 화면 크기 변경을 감지함
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    // 마우스 휠과 터치 스크롤을 감지함
    window.addEventListener('wheel', resumeScrollTracking, {
      passive: true,
    });
    window.addEventListener('touchstart', resumeScrollTracking, {
      passive: true,
    });

    // 키보드 및 마우스 조작을 감지함
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    // 최초 렌더링 시 현재 스크롤 위치를 확인함
    handleScroll();

    // 컴포넌트가 제거되면 이벤트 리스너를 정리함
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('wheel', resumeScrollTracking);
      window.removeEventListener('touchstart', resumeScrollTracking);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    // 작가 프로필 콘텐츠 이동 메뉴를 표시함
    <nav
      id="photographer-profile-tabs"
      className={styles.tabs}
      aria-label="작가 프로필 콘텐츠"
    >
      {tabs.map(({ id, label, count }) => {
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${isActive ? styles.activeTab : ''}`}
            onClick={() => handleTabClick(id)}
            aria-current={isActive ? 'location' : undefined}
          >
            <span>{label}</span>

            <span className={styles.tabCount}>
              {count.toLocaleString('ko-KR')}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
