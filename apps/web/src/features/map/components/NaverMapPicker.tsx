'use client';

import Script from 'next/script';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
export default function NaverMapPicker() {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMap | null>(null);
  const marker = useRef<NaverMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    NAVER_MAP_CLIENT_ID
      ? null
      : '지도 설정(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)이 없어요.',
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PickedLocation | null>(null);

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

  // 좌표의 주소를 찾아 선택 위치로 둔다
  function pickCoord(lat: number, lng: number, knownAddress?: string) {
    const maps = window.naver?.maps;
    if (!maps || !map.current) return;
    const position = new maps.LatLng(lat, lng);

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
        const found = response.v2.address;
        const address =
          status === maps.Service.Status.OK
            ? found.roadAddress || found.jibunAddress
            : '';
        setPicked({ address: address || '주소를 찾을 수 없는 위치', lat, lng });
      },
    );
  }

  function initMap() {
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
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maps = window.naver?.maps;
    const keyword = query.trim();
    if (!maps || !map.current || !keyword) return;

    maps.Service.geocode({ query: keyword }, (status, response) => {
      const first = response.v2.addresses[0];
      if (status !== maps.Service.Status.OK || !first) {
        setError(null);
        setPicked(null);
        window.alert(
          '검색 결과가 없어요. 도로명이나 지번 주소로 검색해 주세요.',
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
    <div className={styles.picker}>
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
        <p className={styles.address}>
          {picked
            ? picked.address
            : '지도를 클릭하거나 주소를 검색해 위치를 골라 주세요.'}
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
