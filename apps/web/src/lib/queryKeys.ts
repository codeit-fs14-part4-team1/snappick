import type { Category, Style, Region } from '@snappick/shared';

//도메인을 리터럴 유니온 타입으로 관리
export const QUERY_DOMAINS = [
  'users',
  'photos',
  'photographers',
  'products',
  'chats',
  'quotes',
  'payments',
  'reservations',
  'reviews',
  'notifications',
] as const;
export type QueryDomain = (typeof QUERY_DOMAINS)[number];

export const QUERY_TYPES = ['list', 'infinite', 'detail', 'summary'] as const;
export type QueryType = (typeof QUERY_TYPES)[number];

//도메인 전체 무효화용 루트 접두사
const createQueryRoot = <D extends QueryDomain>(domain: D) => [domain] as const;

//[domain, queryType, ...] 앞부분 문법만 강제, 나머지는 도메인 팩토리가 책임
const createQueryKey = <
  D extends QueryDomain,
  T extends QueryType,
  R extends readonly unknown[],
>(
  domain: D,
  type: T,
  ...rest: R
) => [domain, type, ...rest] as const;

//키 구조 규칙
// 목록(list·infinite): [domain, type, 세부 구분, 기준 ID, 조건]
// 단건(detail):        [domain, type, 대상 ID, 세부 구분, 조건]
// 요약(summary):       [domain, type, 세부 구분, 조건]
// 같은 domain·type 아래 키가 2개 이상이면 모두 세부 구분을 둔다 (접두사 무효화 범위 분리)

//캐시 삭제 정책
// 개인 데이터 키(me, liked, saved, chats, reservations 등)에는 계정 ID를 넣지 않는다
// 대신 인증 상태가 바뀔 때(로그인·로그아웃·토큰 만료) queryClient.clear()로 전체 캐시를 비운다
// viewerId는 비로그인도 볼 수 있는 공개 응답이 조회자에 따라 달라질 때만 키에 넣는다

//TODO: 임시 기본값, API 기본값 확정 후 수정
const DEFAULT_LIMIT = 20;
const DEFAULT_MESSAGE_LIMIT = 30;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

//공개 응답이 조회자의 좋아요·저장 상태에 따라 달라질 때만 부여 (null: 비로그인)
type ViewerId = string | null;

type PhotoSort = 'latest' | 'random' | 'favorite';
type PhotoExploreFilters = {
  viewerId: ViewerId;
  category?: Category;
  styles?: Style[];
  regions?: Region[];
  sort?: PhotoSort;
  limit?: number;
  keyword?: string;
};

const normalizePhotoExploreFilters = ({
  viewerId,
  category,
  styles,
  regions,
  sort = 'random',
  limit = DEFAULT_LIMIT,
  keyword,
}: PhotoExploreFilters) => ({
  viewerId,
  category,
  styles: styles && styles.length > 0 ? [...new Set(styles)].sort() : undefined,
  regions:
    regions && regions.length > 0 ? [...new Set(regions)].sort() : undefined,
  sort,
  limit,
  keyword: keyword?.trim() || undefined,
});

//페이지네이션 타입 정의
type PageFilters = {
  page?: number;
  pageSize?: number;
};

const normalizePageFilters = ({
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
}: PageFilters) => ({
  page,
  pageSize,
});

//예약 내역의 탭(임시지정)
type ReservationListStatus =
  'scheduled' | 'inProgress' | 'completed' | 'canceled';

type ReservationListFilters = PageFilters & {
  status: ReservationListStatus;
};

export const queryKeys = {
  photos: {
    all: createQueryRoot('photos'),

    //전체 사진 탐색화면 조회
    feed: (filters: PhotoExploreFilters) =>
      createQueryKey(
        'photos',
        'infinite',
        'feed',
        normalizePhotoExploreFilters(filters),
      ),

    //특정 작가프로필 내 포트폴리오 | 작가 사진관리 내 목록 | 작가의 다른 사진 목록
    portfolio: (
      photographerId: string,
      viewerId: ViewerId,
      limit = DEFAULT_LIMIT,
    ) =>
      createQueryKey('photos', 'infinite', 'portfolio', photographerId, {
        viewerId,
        limit,
      }),

    //좋아요한 사진
    liked: (limit = DEFAULT_LIMIT) =>
      createQueryKey('photos', 'infinite', 'liked', { limit }),

    //클릭한 사진 하나에 대한 정보 - Like정보
    detail: (photoId: string, viewerId: ViewerId) =>
      createQueryKey('photos', 'detail', photoId, { viewerId }),

    //사진 하나에 대한 수정용 정보
    metadata: (photoId: string) =>
      createQueryKey('photos', 'detail', photoId, 'metadata'),
  },

  users: {
    all: createQueryRoot('users'),

    me: () => createQueryKey('users', 'detail', 'me'),

    account: () => createQueryKey('users', 'detail', 'me', 'account'),
  },

  photographers: {
    all: createQueryRoot('photographers'),

    //저장한 작가
    saved: (limit = DEFAULT_LIMIT) =>
      createQueryKey('photographers', 'infinite', 'saved', { limit }),

    detail: (photographerId: string, viewerId: ViewerId) =>
      createQueryKey('photographers', 'detail', photographerId, { viewerId }),

    me: () => createQueryKey('photographers', 'detail', 'me'),

    readiness: () => createQueryKey('photographers', 'summary', 'readiness'),
  },

  //상품
  products: {
    all: createQueryRoot('products'),

    list: (photographerId: string) =>
      createQueryKey('products', 'list', photographerId),
  },

  //문의채팅방
  chats: {
    all: createQueryRoot('chats'),

    rooms: (limit = DEFAULT_LIMIT) =>
      createQueryKey('chats', 'infinite', 'rooms', { limit }),

    messages: (chatRoomId: string, limit = DEFAULT_MESSAGE_LIMIT) =>
      createQueryKey('chats', 'infinite', 'messages', chatRoomId, { limit }),

    detail: (chatRoomId: string) =>
      createQueryKey('chats', 'detail', chatRoomId),
  },

  //견적
  quotes: {
    all: createQueryRoot('quotes'),

    detail: (quoteId: string) => createQueryKey('quotes', 'detail', quoteId),
  },

  //결제
  payments: {
    all: createQueryRoot('payments'),

    result: (paymentId: string) =>
      createQueryKey('payments', 'detail', paymentId),
  },

  //예약
  reservations: {
    all: createQueryRoot('reservations'),

    list: (filters: ReservationListFilters) =>
      createQueryKey('reservations', 'list', {
        ...normalizePageFilters(filters),
        status: filters.status,
      }),

    //상세에서 작가 정보를 제외한 모든 정보를 캐시
    detail: (reservationId: string) =>
      createQueryKey('reservations', 'detail', reservationId),
  },

  //리뷰
  reviews: {
    all: createQueryRoot('reviews'),

    eligible: (filters: PageFilters = {}) =>
      createQueryKey(
        'reviews',
        'list',
        'eligible',
        normalizePageFilters(filters),
      ),

    me: (filters: PageFilters = {}) =>
      createQueryKey('reviews', 'list', 'me', normalizePageFilters(filters)),

    byPhotographer: (photographerId: string, filters: PageFilters = {}) =>
      createQueryKey(
        'reviews',
        'list',
        'byPhotographer',
        photographerId,
        normalizePageFilters(filters),
      ),
  },

  //알림
  notifications: {
    all: createQueryRoot('notifications'),

    infinite: (limit = DEFAULT_LIMIT) =>
      createQueryKey('notifications', 'infinite', { limit }),

    hasUnread: () => createQueryKey('notifications', 'summary', 'hasUnread'),
  },
} satisfies {
  [D in QueryDomain]: { all: readonly [D] } & Record<string, unknown>;
};
