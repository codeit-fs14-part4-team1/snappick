export type ReviewBooking = {
  photographerId?: string;
  reservationId: string;
  photographerName: string;
  representativeImageUrl?: string | null;
  quoteName: string;
  shootDate: string;
};

export type MyReview = {
  id: string;
  booking: ReviewBooking;
  rating: number;
  comment: string;
  createdAt: string;
  reply: { comment: string; createdAt: string } | null;
};
