-- 기존 견적 제목은 유지하고, 작가가 작성하는 견적명으로 의미를 명확히 합니다.
ALTER TABLE "quotes" RENAME COLUMN "product_name" TO "quote_name";
