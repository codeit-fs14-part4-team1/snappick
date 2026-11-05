//팝오버 공통 동작: 열면 첫 요소로 포커스, ESC · 바깥 클릭 · Tab으로 나가면 닫기
//가두지 않음 (Modal과 다름). 포커스 이동 · 복귀 방식은 Modal과 맞춤
//추후 방향키이동으로 개선 필요

//타입불러오기
import { type RefObject, useEffect, useRef } from 'react';
import { tabbable } from 'tabbable';

//팝오바 타입 정의
type UsePopoverOptions = {
  isOpen: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>; // 트리거 + 패널을 감싸는 요소 (바깥 판정 범위), 바깥클릭 종료와 중복되지 않도록 처리
  panelRef: RefObject<HTMLElement | null>; // 첫 요소를 찾을 패널
  triggerRef: RefObject<HTMLElement | null>; // 포커스를 돌려줄 버튼
};

//팝오버훅 (props로 이런 상태들을 받음)
export function usePopover({
  isOpen,
  onClose,
  containerRef,
  panelRef,
  triggerRef,
}: UsePopoverOptions) {
  //최신함수를 보관 + 재랜더링시 동기화
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  //열릴 때 : 첫 요소로 포커스, 열림상태와 첫요소위치 변화를 감지
  useEffect(() => {
    if (!isOpen) return;
    if (!panelRef.current) return;
    const first = tabbable(panelRef.current)[0];
    first?.focus();
  }, [isOpen, panelRef]);

  //닫기 :  감지 (열려 있을 때만 등록)
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    //바깥영역클릭
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!container || !(target instanceof Node)) return;
      if (!container.contains(target)) onCloseRef.current();
    }
    //esc
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onCloseRef.current();
      triggerRef.current?.focus();
    }
    //마지막요소 tab
    function handleFocusOut(event: FocusEvent) {
      const next = event.relatedTarget;
      if (!(next instanceof Node)) return;
      if (!container?.contains(next)) onCloseRef.current();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen, containerRef, triggerRef]);

  //적용 · 항목 선택 후 컴포넌트가 부름 (누른 버튼이 사라지므로 트리거로 포커스)
  function closeAndRestoreFocus() {
    onCloseRef.current();
    triggerRef.current?.focus();
  }

  return { closeAndRestoreFocus };
}
