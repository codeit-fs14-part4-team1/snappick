export async function resizeImage(file: File): Promise<File> {
  const MAX_EDGE = 2048;
  const QUALITY = 0.9;
  //1) 디코딩: createImageBitmap(file) → bitmap.width, bitmap.height
  const bitmap = await createImageBitmap(file);
  //2) 이미 작으면 원본 반환 (다시 인코딩하면 화질만 떨어짐)
  //3) 비율 유지한 새 크기: scale = maxEdge / Math.max(w, h)
  try {
    if (Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const newWidth = Math.max(1, Math.round(bitmap.width * scale));
    const newHeight = Math.max(1, Math.round(bitmap.height * scale));

    //4) canvas에 그리기: canvas.width/height 설정 → ctx.drawImage(bitmap, 0, 0, newW, newH)
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CANVAS 2D Context 생성 실패');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    //5) 파일로: canvas.toBlob(cb, file.type, quality) → new File([blob], file.name, { type: file.type })
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
    if (blob.type !== file.type || blob.size >= file.size) {
      return file;
    }
    const resizedFile = new File([blob], file.name, { type: blob.type });
    return resizedFile;
  } finally {
    bitmap.close();
  }
}
