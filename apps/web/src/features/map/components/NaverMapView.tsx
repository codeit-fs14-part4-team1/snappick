'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import {
  NAVER_MAP_CLIENT_ID,
  naverMapScriptUrl,
  type NaverMap,
  type NaverMarker,
} from '../naver-maps';
import styles from './NaverMapView.module.css';

type NaverMapViewProps = {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
};

const DEFAULT_ZOOM = 16;

/**
 * 좌표 위치를 마커로 보여 주는 읽기 전용 지도
 * 견적 모달의 선택 위치 확인, 예약 상세의 촬영 장소 표시에 사용
 */
export default function NaverMapView({
  lat,
  lng,
  zoom = DEFAULT_ZOOM,
  className,
}: NaverMapViewProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMap | null>(null);
  const marker = useRef<NaverMarker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(
    NAVER_MAP_CLIENT_ID
      ? null
      : '지도 설정(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)이 없어요.',
  );

  // script가 준비되면 지도를 만들고, 좌표가 바뀌면 중심과 마커를 옮긴다
  useEffect(() => {
    const maps = window.naver?.maps;
    if (!loaded || !maps || !mapElement.current) return;
    const position = new maps.LatLng(lat, lng);

    if (!map.current) {
      map.current = new maps.Map(mapElement.current, {
        center: position,
        zoom,
      });
      marker.current = new maps.Marker({ position, map: map.current });
      return;
    }
    map.current.setCenter(position);
    marker.current?.setPosition(position);
  }, [loaded, lat, lng, zoom]);

  // 언마운트 시 지도 정리
  useEffect(
    () => () => {
      map.current?.destroy();
      map.current = null;
      marker.current = null;
    },
    [],
  );

  return (
    <>
      {NAVER_MAP_CLIENT_ID && (
        <Script
          src={naverMapScriptUrl(NAVER_MAP_CLIENT_ID)}
          strategy="afterInteractive"
          onReady={() => setLoaded(true)}
          onError={() => setError('네이버 지도를 불러오지 못했어요.')}
        />
      )}
      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : (
        <div
          ref={mapElement}
          className={[styles.map, className].filter(Boolean).join(' ')}
          role="img"
          aria-label="촬영 장소 지도"
        />
      )}
    </>
  );
}
