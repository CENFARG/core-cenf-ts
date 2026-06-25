# S3StorageAdapter Specification

## Purpose

Production S3 storage adapter using `@aws-sdk/client-s3`, supporting S3-compatible endpoints (MinIO, LocalStack), presigned URLs for GET operations, and S3 error classification.

## Port Interface

```typescript
interface IStorageManager {
  upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  presignUrl(key: string, expiresIn?: number): Promise<string>;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `S3StorageAdapter` | @aws-sdk/client-s3 wrapper with presigned URLs, MinIO support |
| `LocalStorageAdapter` | Filesystem-based storage for dev/testing |

## Error Types

- `StorageUploadError` — Upload failed (network, permissions, size)
- `StorageDownloadError` — Object not found or download failed
- `StorageDeleteError` — Delete operation failed
- `StoragePresignError` — Presigned URL generation failed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_STORAGE_BUCKET` | `string` | `""` | S3 bucket name |
| `CENF_STORAGE_REGION` | `string` | `us-east-1` | S3 region |
| `CENF_STORAGE_ENDPOINT` | `string` | `""` | Custom endpoint (MinIO/LocalStack) |
| `CENF_STORAGE_ACCESS_KEY` | `string` | `""` | AWS access key ID |
| `CENF_STORAGE_SECRET_KEY` | `string` | `""` | AWS secret access key |

## Requirements

### Requirement: S3 Connection and Bucket Validation

The system MUST initialize an S3 client with configurable region, endpoint, and credentials. On `start()`, it MUST verify the configured bucket exists or is accessible.

#### Scenario: Successful S3 connection with default endpoint

- GIVEN valid AWS credentials and `CENF_STORAGE_BUCKET=my-bucket`
- WHEN `await adapter.start()` is called
- THEN the S3 client initializes with `us-east-1` region
- AND bucket existence is verified via `HeadBucket`

#### Scenario: MinIO custom endpoint connection

- GIVEN `CENF_STORAGE_ENDPOINT=http://localhost:9000` and MinIO running
- WHEN `await adapter.start()` is called
- THEN the S3 client uses the custom endpoint
- AND `forcePathStyle: true` is set for MinIO compatibility

#### Scenario: Bucket not found on startup

- GIVEN `CENF_STORAGE_BUCKET=nonexistent-bucket`
- WHEN `await adapter.start()` is called
- THEN it throws `StorageUploadError` indicating bucket not found
- AND the adapter does not proceed to operations

### Requirement: Object Upload with Streaming Support

The system MUST upload `Buffer` or `Readable` stream data to S3. Uploads MUST support content-type and metadata options. The returned value MUST be the object's S3 URL.

#### Scenario: Upload buffer to S3

- GIVEN S3 is connected and bucket exists
- WHEN `await adapter.upload("docs/report.pdf", Buffer.from("content"))` is called
- THEN the object is stored at key `docs/report.pdf` in the bucket
- AND the returned URL is `https://{bucket}.s3.{region}.amazonaws.com/docs/report.pdf`

#### Scenario: Upload with content-type metadata

- GIVEN S3 is connected
- WHEN `await adapter.upload("image.png", buffer, { contentType: "image/png" })` is called
- THEN the object is stored with `Content-Type: image/png`
- AND the upload succeeds

#### Scenario: Upload streaming data

- GIVEN a `Readable` stream with 10MB of data
- WHEN `await adapter.upload("large/file.bin", stream)` is called
- THEN the stream is piped to S3 `PutObject`
- AND the full content is uploaded without loading into memory

### Requirement: Object Download and Existence Check

The system MUST download objects as `Buffer` and check existence without downloading. Missing objects MUST throw `StorageDownloadError`.

#### Scenario: Download existing object

- GIVEN an object exists at key `docs/report.pdf`
- WHEN `await adapter.download("docs/report.pdf")` is called
- THEN it returns a Buffer with the object's content
- AND the content matches what was uploaded

#### Scenario: Download non-existent object

- GIVEN no object exists at key `missing/file.txt`
- WHEN `await adapter.download("missing/file.txt")` is called
- THEN it throws `StorageDownloadError`
- AND the error indicates `NoSuchKey` from S3

#### Scenario: Existence check without download

- GIVEN an object may or may not exist
- WHEN `await adapter.exists("docs/report.pdf")` is called
- THEN it returns `true` if the object exists
- AND it returns `false` without downloading the content

### Requirement: Presigned URL Generation

The system MUST generate presigned GET URLs with configurable expiry. Presigned URLs MUST allow direct download without credentials.

#### Scenario: Generate presigned URL with default expiry

- GIVEN an object exists at key `docs/report.pdf`
- WHEN `await adapter.presignUrl("docs/report.pdf")` is called
- THEN it returns a valid presigned URL
- AND the URL expires in 3600 seconds (1 hour) by default

#### Scenario: Generate presigned URL with custom expiry

- GIVEN an object exists at key `temp/upload.csv`
- WHEN `await adapter.presignUrl("temp/upload.csv", 300)` is called
- THEN the URL expires in 300 seconds (5 minutes)
- AND the URL grants GET access only

### Requirement: S3 Error Classification

The system MUST map AWS SDK error codes to `CenfError` subtypes. `NoSuchKey` → `StorageDownloadError`, `AccessDenied` → `StorageUploadError`, network errors → `StorageDownloadError`.

#### Scenario: NoSuchKey maps to StorageDownloadError

- GIVEN a download request for a non-existent key
- WHEN S3 returns `NoSuchKey` error
- THEN the adapter throws `StorageDownloadError`
- AND the error message includes the key name

#### Scenario: AccessDenied maps to StorageUploadError

- GIVEN insufficient IAM permissions for PutObject
- WHEN an upload is attempted
- THEN the adapter throws `StorageUploadError`
- AND the error indicates permission denial

#### Scenario: Network error classification

- GIVEN S3 endpoint is unreachable
- WHEN any operation is attempted
- THEN the adapter throws the appropriate `Storage*Error`
- AND the underlying network error is preserved as cause

### Requirement: Object Listing and Deletion

The system MUST list objects by prefix and delete individual objects. Delete MUST be idempotent.

#### Scenario: List objects by prefix

- GIVEN objects `docs/a.pdf`, `docs/b.pdf`, `images/c.png` exist in bucket
- WHEN `await adapter.list("docs/")` is called
- THEN it returns `["docs/a.pdf", "docs/b.pdf"]`
- AND `images/c.png` is NOT included

#### Scenario: Delete is idempotent

- GIVEN no object exists at key `already-deleted.txt`
- WHEN `await adapter.delete("already-deleted.txt")` is called
- THEN no error is thrown
- AND the operation completes successfully
