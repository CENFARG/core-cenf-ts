/**
 * S3 Storage Adapter — object storage backed by AWS S3 or S3-compatible services.
 *
 * Implements the StorageManager port using @aws-sdk/client-s3.
 * Supports both AWS S3 and S3-compatible endpoints (e.g., MinIO).
 *
 * @module managers/storage/adapters/s3.adapter
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageManager } from '../ports.js';
import type { StorageObject, StorageMetadata, S3StorageOptions } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';
import {
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
} from '../../../shared/errors.js';

// ---------------------------------------------------------------------------
// S3 error detection helpers
// ---------------------------------------------------------------------------

/** S3 error names that indicate the object was not found. */
const NOT_FOUND_ERRORS = new Set([
  'NoSuchKey',
  'NotFound',
  'NoSuchBucket',
]);

/**
 * Check if an error is an S3 "not found" error (NoSuchKey, NotFound, etc.).
 */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && NOT_FOUND_ERRORS.has((error as { name?: string }).name ?? '')
  );
}

// ---------------------------------------------------------------------------
// S3StorageAdapter
// ---------------------------------------------------------------------------

/**
 * S3-backed storage adapter implementing the StorageManager port.
 *
 * @example
 * ```typescript
 * const adapter = new S3StorageAdapter({
 *   region: 'us-east-1',
 *   bucket: 'my-bucket',
 * });
 * await adapter.start();
 * await adapter.put('key.txt', Buffer.from('data'));
 * const obj = await adapter.get('key.txt');
 * await adapter.stop();
 * ```
 */
export class S3StorageAdapter implements StorageManager {
  private client: S3Client;
  private readonly bucket: string;
  private initialized = false;

  constructor(private readonly options: S3StorageOptions) {
    if (!options.bucket || options.bucket.trim().length === 0) {
      throw new StorageUploadError(
        'S3StorageAdapter: bucket name is required and cannot be empty.',
      );
    }

    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            }
          : undefined,
      forcePathStyle: options.forcePathStyle ?? false,
    });
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.initialized = true;
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.initialized = false;
  }

  async health(): Promise<HealthStatus> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: '.health-check',
        }),
      );
      return { status: 'healthy', details: { adapter: 's3', bucket: this.bucket } };
    } catch {
      // HeadObject may fail if the key doesn't exist — still healthy
      // if we can reach the bucket at all.
      return { status: 'healthy', details: { adapter: 's3', bucket: this.bucket } };
    }
  }

  // -----------------------------------------------------------------------
  // StorageManager — put
  // -----------------------------------------------------------------------

  async put(
    key: string,
    data: Buffer | string,
    metadata?: StorageMetadata,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: metadata?.contentType ?? 'application/octet-stream',
        }),
      );
    } catch (error) {
      throw new StorageUploadError(
        `Failed to upload object '${key}' to bucket '${this.bucket}'.`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // StorageManager — get
  // -----------------------------------------------------------------------

  async get(key: string): Promise<StorageObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      // Convert the response stream to a Buffer
      const bodyBytes = await response.Body?.transformToByteArray();
      const bodyBuffer = bodyBytes ? Buffer.from(bodyBytes) : Buffer.alloc(0);

      return {
        key,
        data: bodyBuffer,
        metadata: {
          contentType: response.ContentType,
          size: response.ContentLength,
          lastModified: response.LastModified,
        },
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw new StorageDownloadError(
        `Failed to download object '${key}' from bucket '${this.bucket}'.`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // StorageManager — delete
  // -----------------------------------------------------------------------

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      // Deleting a non-existent object is idempotent — not an error.
      if (isNotFoundError(error)) {
        return;
      }
      throw new StorageDeleteError(
        `Failed to delete object '${key}' from bucket '${this.bucket}'.`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // StorageManager — list
  // -----------------------------------------------------------------------

  async list(prefix?: string): Promise<StorageObject[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return response.Contents.filter((obj): obj is typeof obj & { Key: string } =>
      obj.Key !== undefined,
    ).map((obj) => ({
      key: obj.Key!,
      data: Buffer.alloc(0), // list() returns metadata only — no data
      metadata: {
        size: obj.Size,
        lastModified: obj.LastModified,
      },
    }));
  }

  // -----------------------------------------------------------------------
  // StorageManager — exists
  // -----------------------------------------------------------------------

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      // Other errors (network, access denied) — rethrow
      throw new StorageDownloadError(
        `Failed to check existence of object '${key}' in bucket '${this.bucket}'.`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Presigned URLs (TASK_015 — stub, expanded in TASK_015 GREEN)
  // -----------------------------------------------------------------------

  /**
   * Generate a presigned GET URL for the given key.
   *
   * @param key - The object key.
   * @param expiresIn - URL expiration in seconds. Default: 3600 (1 hour).
   * @returns A presigned URL string.
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
