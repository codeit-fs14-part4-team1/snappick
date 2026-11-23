import type { MyReview, ReviewBooking } from './types';

// UI 확인용 데이터. API 연결 시 데이터 공급 부분을 교체합니다.
export const mockReviewBookings: ReviewBooking[] = [
  {
    reservationId: 'booking-1',
    photographerName: '오후의 사진관',
    quoteName: '가족 스냅',
    shootDate: '2026-09-28',
  },
  {
    reservationId: 'booking-2',
    photographerName: '봄날로그',
    quoteName: '우정 스냅',
    shootDate: '2026-09-14',
  },
];

export const mockMyReviews: MyReview[] = [
  {
    id: 'review-1',
    booking: {
      reservationId: 'booking-3',
      photographerName: '하루필름',
      quoteName: '우정 스냅 기본 1시간',
      shootDate: '2026-09-27',
    },
    rating: 5,
    comment:
      '사진 찍는 게 어색해서 걱정이었는데 작가님이 편하게 이끌어 주셔서 자연스러운 사진을 많이 건졌어요. 결과물도 약속보다 빨리 받았어요!',
    createdAt: '2026-10-02',
    reply: {
      comment: '소중한 후기 감사합니다! 다음 촬영 때도 편하게 찾아 주세요 :)',
      createdAt: '2026-10-03',
    },
  },
  {
    id: 'review-2',
    booking: {
      reservationId: 'booking-4',
      photographerName: '봄날스튜디오',
      quoteName: '커플 스냅',
      shootDate: '2026-09-20',
    },
    rating: 5,
    comment:
      '촬영 내내 편안한 분위기로 진행해 주셨어요. 함께한 순간을 예쁘게 남길 수 있어서 좋았습니다.',
    createdAt: '2026-10-02',
    reply: null,
  },
];
