/**
 * 네이버 지도 JS API v3 (NCP Maps) 연동에 필요한 최소 타입과 설정
 * 클라이언트 ID: NCP 콘솔 > Maps > Application의 Client ID (NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)
 * 웹 서비스 URL(예: http://localhost:3000)을 콘솔에 등록해야 인증된다
 */

export const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

// geocoder: 주소 ↔ 좌표 변환 (검색, 지도 클릭 위치의 주소)
export const naverMapScriptUrl = (clientId: string) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;

// 네이버 지도 웹에서 주소를 검색한 화면 (별도 API 키 없이 열리는 일반 링크)
export const naverMapSearchUrl = (address: string) =>
  `https://map.naver.com/p/search/${encodeURIComponent(address)}`;

// 지도 팝업에서 고른 위치 (opener로 postMessage)
export type PickedLocation = {
  address: string;
  lat: number;
  lng: number;
};

export const MAP_PICKER_PATH = '/map-picker';
export const MAP_PICKER_MESSAGE = 'snappick:map-picker:select';

export type MapPickerMessage = {
  type: typeof MAP_PICKER_MESSAGE;
  location: PickedLocation;
};

// ---- 사용하는 부분만 선언한 네이버 지도 타입 ----
export type NaverLatLng = { lat(): number; lng(): number };
export type NaverMap = {
  setCenter(center: NaverLatLng): void;
  destroy(): void;
};
export type NaverMarker = { setPosition(position: NaverLatLng): void };

// 실패 응답에는 v2가 없을 수 있다 (status 확인 후 접근)
type ServiceResponse<T> = { v2?: T };
type ReverseGeocodeResult = {
  address: { roadAddress: string; jibunAddress: string };
};
type GeocodeResult = {
  addresses: {
    roadAddress: string;
    jibunAddress: string;
    x: string; // 경도
    y: string; // 위도
  }[];
};

export type NaverMaps = {
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
      zoomControl?: boolean;
      zoomControlOptions?: { position?: number; style?: number };
    },
  ) => NaverMap;
  // 지도 컨트롤 위치 (zoomControlOptions.position 등에 사용)
  Position: { TOP_LEFT: number; TOP_RIGHT: number };
  // 줌 컨트롤 모양: SMALL은 +, - 버튼만, LARGE는 단계 슬라이더 포함
  ZoomControlStyle: { SMALL: number; LARGE: number };
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
  }) => NaverMarker;
  Event: {
    addListener(
      target: NaverMap,
      name: 'click',
      listener: (event: { coord: NaverLatLng }) => void,
    ): unknown;
  };
  Service: {
    Status: { OK: number };
    reverseGeocode(
      options: { coords: NaverLatLng; orders: string },
      callback: (
        status: number,
        response: ServiceResponse<ReverseGeocodeResult>,
      ) => void,
    ): void;
    geocode(
      options: { query: string },
      callback: (
        status: number,
        response: ServiceResponse<GeocodeResult>,
      ) => void,
    ): void;
  };
};

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
    /** 클라이언트 ID나 서비스 URL 인증에 실패하면 네이버 지도 script가 호출한다 */
    navermap_authFailure?: () => void;
  }
}
