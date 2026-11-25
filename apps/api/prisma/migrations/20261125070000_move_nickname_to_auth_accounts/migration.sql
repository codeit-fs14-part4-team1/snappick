-- 닉네임을 users, photographers에서 auth_accounts로 옮긴다
ALTER TABLE "auth_accounts" ADD COLUMN "nickname" TEXT;

UPDATE "auth_accounts" AS a
SET "nickname" = u."nickname"
FROM "users" AS u
WHERE u."auth_account_id" = a."id" AND a."account_type" = 'USER';

UPDATE "auth_accounts" AS a
SET "nickname" = p."nickname"
FROM "photographers" AS p
WHERE p."auth_account_id" = a."id" AND a."account_type" = 'PHOTOGRAPHER';

-- 프로필이 없거나, 대소문자 구분 없이 겹치는 닉네임(먼저 가입한 계정 제외)은 임시 닉네임으로 바꾼다
UPDATE "auth_accounts" AS a
SET "nickname" = '스냅픽_' || substr(md5(a."id"::text), 1, 12)
FROM (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY lower("nickname")
      ORDER BY "created_at", "id"
    ) AS "order"
  FROM "auth_accounts"
) AS ranked
WHERE ranked."id" = a."id" AND (a."nickname" IS NULL OR ranked."order" > 1);

ALTER TABLE "auth_accounts" ALTER COLUMN "nickname" SET NOT NULL;

-- 대소문자를 구분하지 않고 유저·작가 전체에서 중복을 막는다 (Prisma 스키마로는 표현할 수 없다)
CREATE UNIQUE INDEX "auth_accounts_nickname_lower_key" ON "auth_accounts" (lower("nickname"));

ALTER TABLE "users" DROP COLUMN "nickname";
ALTER TABLE "photographers" DROP COLUMN "nickname";
