import { describe, it, expect } from 'vitest';
import {
  FILE_READER_PORT_VERSION,
  type FileReaderPort,
} from '../ports.js';

// ---------------------------------------------------------------------------
// Test implementation of FileReaderPort for contract verification
// ---------------------------------------------------------------------------

class TestFileReaderAdapter implements FileReaderPort {
  private files = new Map<string, string>();

  constructor() {
    this.files.set('/test/hello.txt', 'Hello, World!');
    this.files.set('/test/multi-line.txt', 'line1\nline2\nline3');
    this.files.set('/logs/app.log', 'INFO: started');
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async listFiles(_glob: string): Promise<string[]> {
    return Array.from(this.files.keys());
  }

  async readLines(path: string): Promise<string[]> {
    const content = await this.readFile(path);
    return content.split('\n');
  }
}

// ---------------------------------------------------------------------------
// FileReaderPort contract
// ---------------------------------------------------------------------------

describe('FileReaderPort', () => {
  it('exports a runtime version constant', () => {
    expect(FILE_READER_PORT_VERSION).toBe('0.1.0');
  });

  it('has readFile/fileExists/listFiles/readLines methods', () => {
    const reader: FileReaderPort = new TestFileReaderAdapter();
    expect(reader.readFile).toBeDefined();
    expect(reader.fileExists).toBeDefined();
    expect(reader.listFiles).toBeDefined();
    expect(reader.readLines).toBeDefined();
  });

  it('readFile() returns file content as string', async () => {
    const reader = new TestFileReaderAdapter();
    const content = await reader.readFile('/test/hello.txt');
    expect(content).toBe('Hello, World!');
  });

  it('readFile() throws for nonexistent file', async () => {
    const reader = new TestFileReaderAdapter();
    await expect(reader.readFile('/nonexistent.txt')).rejects.toThrow();
  });

  it('fileExists() returns true for existing files', async () => {
    const reader = new TestFileReaderAdapter();
    const exists = await reader.fileExists('/test/hello.txt');
    expect(exists).toBe(true);
  });

  it('fileExists() returns false for missing files', async () => {
    const reader = new TestFileReaderAdapter();
    const exists = await reader.fileExists('/missing.txt');
    expect(exists).toBe(false);
  });

  it('listFiles() returns an array of paths', async () => {
    const reader = new TestFileReaderAdapter();
    const files = await reader.listFiles('**/*');
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => typeof f === 'string')).toBe(true);
  });

  it('readLines() returns content split by newline', async () => {
    const reader = new TestFileReaderAdapter();
    const lines = await reader.readLines('/test/multi-line.txt');
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  it('readLines() on single-line file returns one element', async () => {
    const reader = new TestFileReaderAdapter();
    const lines = await reader.readLines('/test/hello.txt');
    expect(lines).toEqual(['Hello, World!']);
  });
});
