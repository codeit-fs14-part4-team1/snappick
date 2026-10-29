import {
  CancelStatus,
  Category,
  Provider,
  Region,
  ReservationStatus,
  Style,
} from '@snappick/shared';

export const ProviderLabel = {
  [Provider.BASIC]: '이메일',
  [Provider.GOOGLE]: 'Google',
  [Provider.KAKAO]: '카카오',
  [Provider.NAVER]: '네이버',
} as const satisfies Record<Provider, string>;

export const ReservationStatusLabel = {
  [ReservationStatus.CONFIRMED]: '예약 확정',
  [ReservationStatus.SHOOT_COMPLETED]: '촬영 완료',
  [ReservationStatus.DELIVERED]: '결과물 전달',
  [ReservationStatus.PURCHASE_CONFIRMED]: '구매 확정',
  [ReservationStatus.CANCELED]: '예약 취소',
} as const satisfies Record<ReservationStatus, string>;

//시안에서 표시가 확인된 PENDING만 제공
export const CancelStatusLabel = {
  [CancelStatus.PENDING]: '취소 요청 중',
} as const satisfies Partial<Record<CancelStatus, string>>;

export const CategoryLabel = {
  [Category.WEDDING]: '웨딩 스냅',
  [Category.COUPLE]: '커플 스냅',
  [Category.FAMILY]: '가족 스냅',
  [Category.FRIENDS]: '우정 스냅',
  [Category.GRADUATION]: '졸업 스냅',
  [Category.PROFILE]: '프로필',
  [Category.EVENT]: '행사',
  [Category.PET]: '펫',
  [Category.ETC]: '기타',
} as const satisfies Record<Category, string>;

export const StyleLabel = {
  [Style.NATURAL]: '자연스러운',
  [Style.BRIGHT]: '화사한',
  [Style.FILM]: '필름 감성',
  [Style.VINTAGE]: '빈티지',
  [Style.CINEMATIC]: '시네마틱',
  [Style.MONOCHROME]: '흑백',
  [Style.MINIMAL]: '미니멀',
  [Style.DREAMY]: '몽환적인',
} as const satisfies Record<Style, string>;

export const RegionLabel = {
  [Region.SEOUL]: '서울',
  [Region.DAEGU]: '대구',
  [Region.GWANGJU]: '광주',
  [Region.ULSAN]: '울산',
  [Region.GYEONGGI]: '경기',
  [Region.CHUNGBUK]: '충북',
  [Region.JEONBUK]: '전북',
  [Region.GYEONGBUK]: '경북',
  [Region.JEJU]: '제주',
  [Region.BUSAN]: '부산',
  [Region.INCHEON]: '인천',
  [Region.DAEJEON]: '대전',
  [Region.SEJONG]: '세종',
  [Region.GANGWON]: '강원',
  [Region.CHUNGNAM]: '충남',
  [Region.JEONNAM]: '전남',
  [Region.GYEONGNAM]: '경남',
} as const satisfies Record<Region, string>;
