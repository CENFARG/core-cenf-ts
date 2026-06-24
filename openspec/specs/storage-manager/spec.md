# StorageManager Specification

## Purpose

Manages object storage operations (upload, download, delete, list) with S3 for production and local filesystem for development/testing.

## Port Interface

```typescript
interface IStorageManager {
  upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `S3StorageAdapter` | Wraps `@aws-sdk/client-s3` for S3-compatible storage |
| `LocalStorageAdapter` | Filesystem-based storage for dev/testing |

## Error Types

- `StorageUploadError` — Upload failed (network, permissions, size)
- `StorageDownloadError` — Object not found or download failed
- `StorageDeleteError` — Delete operation failed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_STORAGE_PROVIDER` | `s3\|local` | `local` | Storage backend |
| `CENF_STORAGE_BUCKET` | `string` | `""` | S3 bucket name |
| `CENF_STORAGE_REGION` | `string` | `us-east-1` | S3 region |
| `CENF_STORAGE_LOCAL_PATH` | `string` | `./storage` | Local storage directory |

## Lifecycle

- `start()`: Validates bucket exists (S3) or creates local directory
- `stop()`: No-op (stateless operations)
- `health()`: Returns `{ status: 'healthy', details: { provider, bucket } }`

## Testing Strategy

- **Unit**: `LocalStorageAdapter` — file CRUD with temp directories
- **Integration**: `S3StorageAdapter` with MinIO or localstack
- **Edge cases**: Large file streaming, concurrent uploads, missing objects

## Requirements

### Requirement: Object Upload and Download

The system MUST upload binary data to storage and retrieve it. Uploads MUST support streaming via `Readable` for large files.

#### Scenario: Upload buffer to local storage

- GIVEN `CENF_STORAGE_PROVIDER=local` and a local path configured
- WHEN `await storage.upload("docs/report.pdf", Buffer.from("content"))` is called
- THEN the file is written to `{localPath}/docs/report.pdf`
- AND the returned URL is a file:// path

#### Scenario: Download existing object

- GIVEN an object exists at key `docs/report.pdf`
- WHEN `await storage.download("docs/report.pdf")` is called
- THEN it returns a Buffer with the object's content
- AND the content matches what was uploaded

#### Scenario: Download non-existent object

- GIVEN no object exists at key `missing/file.txt`
- WHEN `await storage.download("missing/file.txt")` is called
- THEN it throws `StorageDownloadError`
- AND the error indicates the object was not found

### Requirement: Object Listing and Deletion

The system MUST list objects by prefix and delete individual objects. Delete MUST be idempotent.

#### Scenario: List objects by prefix

- GIVEN objects `docs/a.pdf`, `docs/b.pdf`, `images/c.png` exist
- WHEN `await storage.list("docs/")` is called
- THEN it returns `["docs/a.pdf", "docs/b.pdf"]`
- AND `images/c.png` is NOT included

#### Scenario: Delete existing object

- GIVEN an object exists at key `temp/file.txt`
- WHEN `await storage.delete("temp/file.txt")` is called
- THEN the object is removed
- AND subsequent `exists("temp/file.txt")` returns `false`

#### Scenario: Delete non-existent object is idempotent

- GIVEN no object exists at key `already-deleted.txt`
- WHEN `await storage.delete("already-deleted.txt")` is called
- THEN no error is thrown
- AND the operation completes successfully
