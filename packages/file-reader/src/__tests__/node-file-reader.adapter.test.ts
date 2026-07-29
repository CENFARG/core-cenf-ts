import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeFileReaderAdapter } from '../adapters/node-file-reader.adapter.js';
import type { FileReaderPort } from '../ports.js';

// ---------------------------------------------------------------------------
// Test fixtures — real files in a temp directory
// ---------------------------------------------------------------------------

let tmpDir: string;
let reader: FileReaderPort;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'filereader-test-'));
  reader = new NodeFileReaderAdapter();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// NodeFileReaderAdapter
// ---------------------------------------------------------------------------

describe('NodeFileReaderAdapter', () => {
  describe('readFile', () => {
    it('reads file content as string', async () => {
      const filePath = join(tmpDir, 'hello.txt');
      await writeFile(filePath, 'Hello, World!');
      const content = await reader.readFile(filePath);
      expect(content).toBe('Hello, World!');
    });

    it('reads UTF-8 content correctly', async () => {
      const filePath = join(tmpDir, 'unicode.txt');
      await writeFile(filePath, 'café ñoño — 日本語');
      const content = await reader.readFile(filePath);
      expect(content).toContain('café');
      expect(content).toContain('日本語');
    });

    it('throws for nonexistent file', async () => {
      await expect(
        reader.readFile(join(tmpDir, 'nonexistent.txt')),
      ).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('returns true when file exists', async () => {
      const filePath = join(tmpDir, 'exists.txt');
      await writeFile(filePath, 'present');
      const exists = await reader.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      const exists = await reader.fileExists(
        join(tmpDir, 'missing.txt'),
      );
      expect(exists).toBe(false);
    });

    it('returns true for directories', async () => {
      const dirPath = join(tmpDir, 'subdir');
      await mkdir(dirPath);
      const exists = await reader.fileExists(dirPath);
      expect(exists).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('lists files matching a simple glob', async () => {
      await writeFile(join(tmpDir, 'a.txt'), 'a');
      await writeFile(join(tmpDir, 'b.txt'), 'b');
      await writeFile(join(tmpDir, 'c.json'), '{}');

      const files = await reader.listFiles(join(tmpDir, '*.txt'));
      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('.txt'))).toBe(true);
    });

    it('lists files recursively with ** glob', async () => {
      await writeFile(join(tmpDir, 'root.txt'), 'root');
      const nested = join(tmpDir, 'nested');
      await mkdir(nested);
      await writeFile(join(nested, 'deep.txt'), 'deep');

      const files = await reader.listFiles(join(tmpDir, '**/*.txt'));
      expect(files).toHaveLength(2);
    });

    it('returns empty array when no files match', async () => {
      const files = await reader.listFiles(
        join(tmpDir, '*.nonexistent'),
      );
      expect(files).toEqual([]);
    });

    it('returns absolute paths', async () => {
      await writeFile(join(tmpDir, 'abs.txt'), 'abs');
      const files = await reader.listFiles(join(tmpDir, '*.txt'));
      expect(files[0]).toBe(join(tmpDir, 'abs.txt'));
    });
  });

  describe('readLines', () => {
    it('returns lines as array', async () => {
      const filePath = join(tmpDir, 'lines.txt');
      await writeFile(filePath, 'a\nb\nc');
      const lines = await reader.readLines(filePath);
      expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('handles CRLF line endings', async () => {
      const filePath = join(tmpDir, 'crlf.txt');
      await writeFile(filePath, 'a\r\nb\r\nc');
      const lines = await reader.readLines(filePath);
      expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('returns single-element array for one-line file', async () => {
      const filePath = join(tmpDir, 'single.txt');
      await writeFile(filePath, 'only line');
      const lines = await reader.readLines(filePath);
      expect(lines).toEqual(['only line']);
    });

    it('returns empty array for empty file', async () => {
      const filePath = join(tmpDir, 'empty.txt');
      await writeFile(filePath, '');
      const lines = await reader.readLines(filePath);
      expect(lines).toEqual(['']);
    });
  });
});
