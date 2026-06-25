/**
 * StorageManager-specific types.
 *
 * Types for storage objects, metadata, and configuration.
 *
 * @module managers/storage/types
 */

// ---------------------------------------------------------------------------
// StorageObject — a stored object with key, data, and metadata
// ---------------------------------------------------------------------------

/**
 * Represents an object stored in the storage system.
 */
export interface StorageObject {
  /** The object key (path/identifier). */
  key: string;

  /** The object data as a Buffer or string. */
  data: Buffer | string;

  /** Optional metadata about the object. */
  metadata?: StorageMetadata;
}

// ---------------------------------------------------------------------------
// StorageMetadata — metadata for a stored object
// ---------------------------------------------------------------------------

/**
 * Metadata associated with a storage object.
 *
 * Common fields like content type, size, and modification
 * time are typed; additional properties can be added.
 */
export interface StorageMetadata {
  /** MIME content type (e.g., "text/plain", "application/json"). */
  contentType?: string;

  /** Size of the object in bytes. */
  size?: number;

  /** Last modified timestamp. */
  lastModified?: Date;

  /** Allow additional metadata properties. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// S3StorageOptions — S3 adapter configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for the S3 storage adapter.
 *
 * Supports both AWS S3 and S3-compatible services (e.g., MinIO).
 */
export interface S3StorageOptions {
  /** AWS region or S3-compatible endpoint region. */
  region: string;

  /** S3 bucket name. */
  bucket: string;

  /**
   * Custom S3-compatible endpoint URL.
   * Leave undefined for standard AWS S3.
   * Example: `http://localhost:9000` for MinIO.
   */
  endpoint?: string;

  /**
   * AWS access key ID. Falls back to `AWS_ACCESS_KEY_ID` env var.
   */
  accessKeyId?: string;

  /**
   * AWS secret access key. Falls back to `AWS_SECRET_ACCESS_KEY` env var.
   */
  secretAccessKey?: string;

  /** Force path-style addressing (required for MinIO). Default: false. */
  forcePathStyle?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const STORAGE_TYPES_VERSION = '0.1.0';
