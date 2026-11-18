'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  MAP_PICKER_MESSAGE,
  MAP_PICKER_PATH,
  type MapPickerMessage,
  type PickedLocation,
} from './naver-maps';

const POPUP_NAME = 'snappick-map-picker';
const POPUP_FEATURES = 'width=720,height=720,noopener=no';

/**
 * 네이버 지도 팝업을 열고, 팝업에서 고른 위치를 onSelect로 받는다
 * 같은 출처(origin)에서 온 메시지만 받는다
 */
export function useMapPicker(onSelect: (location: PickedLocation) => void) {
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MapPickerMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== MAP_PICKER_MESSAGE) return;
      onSelectRef.current(event.data.location);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return useCallback(() => {
    const popup = window.open(MAP_PICKER_PATH, POPUP_NAME, POPUP_FEATURES);
    popup?.focus();
  }, []);
}
