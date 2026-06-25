import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3StorageAdapter } from '../s3.adapter.js';
import type { StorageManager } from '../../ports.js';
import type { StorageObject } from '../../types.js';
import {
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
} from '../../../../shared/errors.js';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-s3 — using vi.hoisted for hoisted mock factory
// ---------------------------------------------------------------------------

const {
  mockSend,
  mockGetSignedUrl,
  mockS3Client,
  MockS3Client,
} = vi.hoisted(() => {
  const send = vi.fn();
  const s3Instance = { send, destroy: vi.fn() };
  const S3Client = vi.fn().mockImplementation(() => s3Instance);
  const getSignedUrl = vi.fn();
  return {
    mockSend: send,
    mockGetSignedUrl: getSignedUrl,
    mockS3Client: s3Instance,
    MockS3Client: S3Client,
    MockGetSignedUrl: getSignedUrl,
  };
});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const VALID_OPTIONS = {
  region: 'us-east-1',
  bucket: 'test-bucket',
};

const TEST_KEY = 'path/to/object.txt';
const TEST_DATA = Buffer.from('hello s3');
const TEST_DATA_STR = 'hello s3 string';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock S3 GetObject response. */
function mockGetObjectResponse(body: Buffer | string): Record<string, unknown> {
  const content = typeof body === 'string' ? Buffer.from(body) : body;
  return {
    Body: {
      transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(content)),
      transformToString: vi.fn().mockResolvedValue(
        typeof body === 'string' ? body : body.toString('utf-8'),
      ),
    },
    ContentType: 'text/plain',
    ContentLength: content.length,
    LastModified: new Date('2024-01-01'),
  };
}

/** Build a mock S3 HeadObject response. */
function mockHeadObjectResponse(): Record<string, unknown> {
  return {
    ContentType: 'text/plain',
    ContentLength: 42,
    LastModified: new Date('2024-01-01'),
  };
}

// ---------------------------------------------------------------------------
// S3StorageAdapter — Connection & Lifecycle
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — connection & lifecycle', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
  });

  it('creates an S3Client on construction', () => {
    expect(MockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('throws StorageUploadError when bucket is empty', () => {
    expect(
      () => new S3StorageAdapter({ region: 'us-east-1', bucket: '' }),
    ).toThrow(StorageUploadError);
  });

  it('start() resolves successfully', async () => {
    await expect(adapter.start()).resolves.toBeUndefined();
  });

  it('stop() destroys the S3 client', async () => {
    mockS3Client.destroy = vi.fn().mockResolvedValue(undefined);
    await adapter.stop();
    expect(mockS3Client.destroy).toHaveBeenCalled();
  });

  it('health() reports connection status using HeadObject', async () => {
    mockSend.mockResolvedValueOnce(mockHeadObjectResponse());
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — put
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — put', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
    mockSend.mockResolvedValue({});
  });

  it('uploads a Buffer to S3', async () => {
    await adapter.put(TEST_KEY, TEST_DATA);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uploads a string to S3', async () => {
    await adapter.put(TEST_KEY, TEST_DATA_STR);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uploads with metadata (contentType, size)', async () => {
    await adapter.put(TEST_KEY, TEST_DATA, {
      contentType: 'application/json',
      size: 100,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('propagates S3 errors as StorageUploadError', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(adapter.put(TEST_KEY, TEST_DATA)).rejects.toThrow(
      StorageUploadError,
    );
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — get
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — get', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
  });

  it('retrieves an object from S3', async () => {
    mockSend.mockResolvedValueOnce(mockGetObjectResponse(TEST_DATA));
    const result: StorageObject | null = await adapter.get(TEST_KEY);
    expect(result).not.toBeNull();
    expect(result!.key).toBe(TEST_KEY);
    expect(result!.data).toBeInstanceOf(Buffer);
  });

  it('returns null for a missing object (NoSuchKey)', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    mockSend.mockRejectedValueOnce(err);
    const result = await adapter.get('missing/key.txt');
    expect(result).toBeNull();
  });

  it('wraps non-NoSuchKey errors as StorageDownloadError', async () => {
    mockSend.mockRejectedValueOnce(new Error('NetworkError'));
    await expect(adapter.get(TEST_KEY)).rejects.toThrow(StorageDownloadError);
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — delete
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — delete', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
    mockSend.mockResolvedValue({});
  });

  it('deletes an existing object', async () => {
    await expect(adapter.delete(TEST_KEY)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — deleting a non-existent key does not throw', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    mockSend.mockRejectedValueOnce(err);
    await expect(adapter.delete('nonexistent/key.txt')).resolves.toBeUndefined();
  });

  it('propagates non-NoSuchKey errors as StorageDeleteError', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(adapter.delete(TEST_KEY)).rejects.toThrow(StorageDeleteError);
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — exists
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — exists', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
  });

  it('returns true when HeadObject succeeds', async () => {
    mockSend.mockResolvedValueOnce(mockHeadObjectResponse());
    const exists = await adapter.exists(TEST_KEY);
    expect(exists).toBe(true);
  });

  it('returns false when HeadObject throws NotFound', async () => {
    const err = Object.assign(new Error('NotFound'), { name: 'NotFound' });
    mockSend.mockRejectedValueOnce(err);
    const exists = await adapter.exists('missing/key.txt');
    expect(exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — list
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — list', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
  });

  it('lists all objects when no prefix is given', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'file1.txt', Size: 10, LastModified: new Date() },
        { Key: 'file2.txt', Size: 20, LastModified: new Date() },
      ],
    });
    const result = await adapter.list();
    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe('file1.txt');
    expect(result[1]!.key).toBe('file2.txt');
  });

  it('returns empty array when bucket is empty', async () => {
    mockSend.mockResolvedValueOnce({});
    const result = await adapter.list();
    expect(result).toEqual([]);
  });

  it('filters by prefix', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [{ Key: 'folder/file.txt', Size: 10, LastModified: new Date() }],
    });
    const result = await adapter.list('folder/');
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('folder/file.txt');
  });
});

// ---------------------------------------------------------------------------
// S3StorageAdapter — presigned URLs (TASK_015 prep — tests fail until impl)
// ---------------------------------------------------------------------------

describe('S3StorageAdapter — presigned URLs', () => {
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new S3StorageAdapter(VALID_OPTIONS);
  });

  it('getPresignedUrl returns a URL string', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://test-bucket.s3.us-east-1.amazonaws.com/path/to/object.txt?X-Amz-Expires=3600&...');
    const url = await adapter.getPresignedUrl(TEST_KEY);
    expect(url).toContain('https://');
    expect(url).toContain('test-bucket');
  });

  it('getPresignedUrl accepts custom expiry seconds', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://test-bucket.s3.us-east-1.amazonaws.com/path/to/object.txt?X-Amz-Expires=600&...');
    const url = await adapter.getPresignedUrl(TEST_KEY, 600);
    expect(url).toContain('X-Amz-Expires=600');
  });

  it('getPresignedUrl default expiry is 3600 seconds', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://test-bucket.s3.us-east-1.amazonaws.com/path/to/object.txt?X-Amz-Expires=3600&...');
    const url = await adapter.getPresignedUrl(TEST_KEY);
    expect(url).toContain('X-Amz-Expires=3600');
  });
});
