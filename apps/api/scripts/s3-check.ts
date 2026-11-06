import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { storage, storageDriver } from '../src/lib/storage/index.js';

/**
 * S3 연결과 권한 확인 (pnpm --filter api s3:check)
 * 작은 시험 파일로 업로드 URL 발급, PUT, 확인, 읽기, 쓰기, 삭제를 차례로 해 보고 지운다
 * 필요한 값: STORAGE_DRIVER=s3, S3_BUCKET, AWS_REGION, AWS 자격 증명
 */
const ORIGIN = process.env.S3_CHECK_ORIGIN ?? 'http://localhost:5500';

if (storageDriver !== 's3') {
  console.error('STORAGE_DRIVER=s3로 실행해 주세요.');
  process.exit(1);
}

const id = randomUUID();
const uploadKey = `uploads/s3-check/${id}.webp`;
const photoKey = `photos/s3-check/${id}.webp`;
const contentType = 'image/webp';
const body = await sharp({
  create: { width: 8, height: 8, channels: 3, background: '#336699' },
})
  .webp()
  .toBuffer();

let failed = 0;
const report = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail && ` (${detail})`}`);
};

try {
  const url = await storage.createUploadUrl({
    key: uploadKey,
    contentType,
    size: body.length,
    expiresAt: new Date(Date.now() + 60_000),
    apiOrigin: '',
  });
  report('업로드 URL 발급', true, new URL(url).host);

  const wrongType = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body,
  });
  report('다른 형식 PUT 거부', !wrongType.ok, `HTTP ${wrongType.status}`);

  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  report('업로드 URL로 PUT', put.ok, `HTTP ${put.status}`);

  const object = await storage.head(uploadKey);
  report('파일 확인', object?.size === body.length, `${object?.size} bytes`);

  const read = await storage.read(uploadKey);
  report('파일 읽기', Buffer.compare(body, Buffer.from(read)) === 0);

  await storage.write(photoKey, body, contentType);
  const written = await storage.head(photoKey);
  report('서버에서 쓰기', written?.contentType === contentType);

  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  const allowed = preflight.headers.get('access-control-allow-origin');
  console.log(
    `${allowed ? 'PASS' : 'WARN'} 브라우저 업로드 CORS ${ORIGIN} (${allowed ?? '허용 안 됨, 버킷 CORS 설정 필요'})`,
  );
} catch (error) {
  report('S3 요청', false, error instanceof Error ? error.message : '');
} finally {
  await Promise.allSettled([
    storage.delete(uploadKey),
    storage.delete(photoKey),
  ]);
}

try {
  const left = await Promise.all([
    storage.head(uploadKey),
    storage.head(photoKey),
  ]);
  report(
    '시험 파일 삭제',
    left.every((object) => object === null),
  );
} catch (error) {
  report('시험 파일 삭제', false, error instanceof Error ? error.message : '');
}

console.log(failed === 0 ? '\nS3 연결 정상' : `\n실패 ${failed}개`);
process.exit(failed === 0 ? 0 : 1);
