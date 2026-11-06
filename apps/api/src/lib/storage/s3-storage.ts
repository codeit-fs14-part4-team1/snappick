import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from '../../utils/http-error.js';
import type { Storage } from './storage.js';

/**
 * S3 저장소. 버킷은 S3_BUCKET, 리전은 AWS_REGION
 * 자격 증명은 EB 인스턴스 역할(IAM)을 쓴다
 * 설정이 없으면 서버는 뜨고, 업로드 요청만 503으로 막는다
 */
export function createS3Storage(): Storage {
  let client: S3Client | undefined;

  function connect(): { client: S3Client; bucket: string } {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new HttpError(
        503,
        'STORAGE_NOT_CONFIGURED',
        '사진 저장소가 아직 설정되지 않았어요.',
      );
    }
    // 리전은 SDK가 AWS_REGION에서 읽는다
    // S3_ENDPOINT는 MinIO 같은 S3 호환 저장소로 로컬에서 시험할 때만 넣는다
    const endpoint = process.env.S3_ENDPOINT;
    client ??= new S3Client(endpoint ? { endpoint, forcePathStyle: true } : {});
    return { client, bucket };
  }

  return {
    async createUploadUrl({ key, contentType, size, expiresAt }) {
      const { client, bucket } = connect();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      });
      // 형식과 크기를 서명에 넣어, 발급할 때와 다른 파일은 S3가 거부하게 한다
      return getSignedUrl(client, command, {
        expiresIn: Math.round((expiresAt.getTime() - Date.now()) / 1000),
        signableHeaders: new Set(['content-type', 'content-length']),
      });
    },

    async head(key) {
      const { client, bucket } = connect();
      try {
        const object = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return {
          size: object.ContentLength ?? 0,
          contentType: object.ContentType ?? null,
        };
      } catch (error) {
        if (error instanceof NotFound) {
          return null;
        }
        throw error;
      }
    },

    async read(key) {
      const { client, bucket } = connect();
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      return object.Body
        ? object.Body.transformToByteArray()
        : new Uint8Array();
    },

    async write(key, body, contentType) {
      const { client, bucket } = connect();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async delete(key) {
      const { client, bucket } = connect();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
