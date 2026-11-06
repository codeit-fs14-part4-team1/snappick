import sharp from 'sharp';

// PF-05: 긴 변 2048px WebP 보관본. 위치 정보 등 메타데이터는 sharp가 기본으로 뺀다
const MAX_LONG_EDGE = 2048;
const WEBP_QUALITY = 82;

const FORMATS: Record<string, string> = {
  jpg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

// 사진을 연달아 처리하므로 메모리에 캐시를 쌓지 않는다
sharp.cache(false);

export type StoredImage = {
  data: Buffer;
  width: number;
  height: number;
};

/**
 * 원본을 보관본으로 바꾼다. 이미지가 아니거나 실제 형식이 확장자와 다르면 null
 */
export async function toStoredWebp(
  input: Uint8Array,
  extension: string,
): Promise<StoredImage | null> {
  try {
    const image = sharp(input);
    const { format } = await image.metadata();
    if (format !== FORMATS[extension]) {
      return null;
    }
    const { data, info } = await image
      .rotate() // EXIF 방향대로 돌린다. 메타데이터를 지우면 방향 정보도 사라지므로 먼저 적용
      .resize({
        width: MAX_LONG_EDGE,
        height: MAX_LONG_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

let queue: Promise<unknown> = Promise.resolve();

// 여러 요청이 동시에 들어와도 차례대로 처리한다 (staging 메모리 1GB)
export function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
