//긴 변 2048px로 줄임. 이미 작거나 오히려 커지면 원본 그대로
export async function resizeImage(file: File): Promise<File> {
  const MAX_EDGE = 2048;
  const QUALITY = 0.9;
  const bitmap = await createImageBitmap(file);
  try {
    //이미 작으면 원본 (다시 인코딩하면 화질만 떨어짐)
    if (Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const newWidth = Math.max(1, Math.round(bitmap.width * scale));
    const newHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS 2D Context 생성 실패');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 변환 실패'));
            return;
          }
          resolve(blob);
        },
        file.type,
        QUALITY,
      );
    });
    //형식이 바뀌었거나 오히려 커졌으면 원본
    if (blob.type !== file.type || blob.size >= file.size) {
      return file;
    }
    const resizedFile = new File([blob], file.name, { type: blob.type });
    return resizedFile;
  } finally {
    bitmap.close();
  }
}
