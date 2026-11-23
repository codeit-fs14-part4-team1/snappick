'use client';

import Script from 'next/script';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  MAP_PICKER_MESSAGE,
  NAVER_MAP_CLIENT_ID,
  naverMapScriptUrl,
  type MapPickerMessage,
  type NaverMap,
  type NaverMarker,
  type PickedLocation,
} from '../naver-maps';
import styles from './NaverMapPicker.module.css';

// 처음 보여 줄 위치: 서울시청
const DEFAULT_CENTER = { lat: 37.5666, lng: 126.9784 };
const DEFAULT_ZOOM = 15;

/**
 * 지도 팝업 (/map-picker)
 * 검색하거나 지도를 클릭해 위치를 고르고, 선택하면 연 창(opener)으로 보내고 닫는다
 */
export default function NaverMapPicker({
  onSelect,
}: {
  /** 전달하면 팝업을 닫는 대신 선택한 위치를 호출부에 전달합니다. */
  onSelect?: (location: PickedLocation) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMap | null>(null);
  const marker = useRef<NaverMarker | null>(null);
  // 위치를 고를 때마다 늘린다. 응답이 늦게 와도 최신 요청의 응답만 반영하기 위함
  const requestSeq = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    NAVER_MAP_CLIENT_ID
      ? null
      : '지도 설정(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)이 없어요.',
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // 모달이 열린 뒤 확정된 크기와 반응형 크기 변경을 지도에 반영합니다.
  useEffect(() => {
    const element = mapElement.current;
    if (!ready || !element) return;

    let frame = 0;
    let previousWidth = 0;
    let previousHeight = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (
          width === 0 ||
          height === 0 ||
          (width === previousWidth && height === previousHeight)
        ) {
          return;
        }
        map.current?.setSize({ width, height });
        previousWidth = width;
        previousHeight = height;
      });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  // 클라이언트 ID·서비스 URL 인증 실패 시 네이버 지도 script가 호출한다
  useEffect(() => {
    window.navermap_authFailure = () =>
      setError(
        '네이버 지도 인증에 실패했어요. 클라이언트 ID와 서비스 URL을 확인해 주세요.',
      );
    return () => {
      window.navermap_authFailure = undefined;
    };
  }, []);

  // 새 위치 요청 시작: 요청 번호를 올리고 이전 선택을 먼저 비운다
  // 응답을 기다리는 동안 이전 좌표가 전송되지 않도록 선택 버튼을 비활성화하기 위함
  const beginRequest = useCallback(() => {
    setPicked(null);
    setSelectionError(null);
    return ++requestSeq.current;
  }, []);

  // 좌표의 주소를 찾아 선택 위치로 둔다
  const pickCoord = useCallback(
    (lat: number, lng: number, knownAddress?: string) => {
      const maps = window.naver?.maps;
      if (!maps || !map.current) return;
      const position = new maps.LatLng(lat, lng);
      const seq = beginRequest();

      if (marker.current) {
        marker.current.setPosition(position);
      } else {
        marker.current = new maps.Marker({ position, map: map.current });
      }

      if (knownAddress) {
        setPicked({ address: knownAddress, lat, lng });
        return;
      }
      maps.Service.reverseGeocode(
        { coords: position, orders: 'roadaddr,addr' },
        (status, response) => {
          if (seq !== requestSeq.current) return;
          // 실패 응답에는 v2가 없을 수 있어 status를 먼저 확인한다
          const found =
            status === maps.Service.Status.OK
              ? response?.v2?.address
              : undefined;
          const address = (
            found?.roadAddress ||
            found?.jibunAddress ||
            ''
          ).trim();
          if (!address) {
            setSelectionError(
              '주소를 조회하지 못했어요. 지도를 다시 클릭하거나 주소를 검색해 주세요.',
            );
            return;
          }
          setPicked({ address, lat, lng });
        },
      );
    },
    [beginRequest],
  );

  const initMap = useCallback(() => {
    const maps = window.naver?.maps;
    if (!maps || !mapElement.current || map.current) return;
    map.current = new maps.Map(mapElement.current, {
      center: new maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
    });
    maps.Event.addListener(map.current, 'click', (event) =>
      pickCoord(event.coord.lat(), event.coord.lng()),
    );
    setReady(true);
  }, [pickCoord]);

  useEffect(() => {
    // SDK가 이미 로드된 경우와 Strict Mode 재설정에서도 초기화합니다.
    const frame = requestAnimationFrame(initMap);
    return () => {
      cancelAnimationFrame(frame);
      // 닫기 전에 시작한 주소 조회 응답은 무시합니다.
      requestSeq.current += 1;
      map.current?.destroy();
      map.current = null;
      marker.current = null;
    };
  }, [initMap]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maps = window.naver?.maps;
    const keyword = query.trim();
    if (!maps || !map.current || !keyword) return;
    const seq = beginRequest();

    maps.Service.geocode({ query: keyword }, (status, response) => {
      if (seq !== requestSeq.current) return;
      // 실패 응답에는 v2가 없을 수 있어 status를 먼저 확인한다
      const first =
        status === maps.Service.Status.OK
          ? response?.v2?.addresses?.[0]
          : undefined;
      if (!first) {
        setSelectionError(
          '주소를 찾지 못했어요. 도로명이나 지번 주소로 다시 검색해 주세요.',
        );
        return;
      }
      const lat = Number(first.y);
      const lng = Number(first.x);
      map.current?.setCenter(new maps.LatLng(lat, lng));
      pickCoord(lat, lng, first.roadAddress || first.jibunAddress);
    });
  }

  function confirm() {
    if (!picked) return;
    if (onSelect) {
      onSelect(picked);
      return;
    }
    if (!window.opener) {
      window.alert(
        '위치를 받을 창이 없어요. 견적 작성 화면에서 다시 열어 주세요.',
      );
      return;
    }
    const message: MapPickerMessage = {
      type: MAP_PICKER_MESSAGE,
      location: picked,
    };
    (window.opener as Window).postMessage(message, window.location.origin);
    window.close();
  }

  return (
    <div className={`${styles.picker} ${onSelect ? styles.embedded : ''}`}>
      {NAVER_MAP_CLIENT_ID && (
        <Script
          src={naverMapScriptUrl(NAVER_MAP_CLIENT_ID)}
          strategy="afterInteractive"
          onReady={initMap}
          onError={() => setError('네이버 지도를 불러오지 못했어요.')}
        />
      )}

      <form className={styles.search} onSubmit={search}>
        <input
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="주소로 검색 (예: 서울 성동구 뚝섬로 273)"
          aria-label="주소 검색"
          disabled={!ready}
        />
        <button type="submit" className={styles.button} disabled={!ready}>
          검색
        </button>
      </form>

      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : (
        <div ref={mapElement} className={styles.map} aria-label="지도" />
      )}

      <div className={styles.footer}>
        <p
          className={`${styles.address} ${selectionError ? styles.addressError : ''}`}
          aria-live="polite"
        >
          {selectionError ||
            picked?.address ||
            (!onSelect &&
              '지도를 클릭하거나 주소를 검색해 위치를 골라 주세요.')}
        </p>
        <button
          type="button"
          className={styles.button}
          disabled={!picked}
          onClick={confirm}
        >
          이 위치로 선택
        </button>
      </div>
    </div>
  );
}
