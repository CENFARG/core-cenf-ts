/**
 * Node.js file reader adapter — uses fs/promises for all operations.
 *
 * Implements the FileReaderPort using Node.js built-in `fs/promises`
 * and `path` modules with zero external dependencies.
 *
 * @module managers/file-reader/adapters/node-file-reader.adapter
 */

import { readFile as fsReadFile, access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { FileReaderPort } from '../ports.js';

// ---------------------------------------------------------------------------
// NodeFileReaderAdapter
// ---------------------------------------------------------------------------

/**
 * File reader adapter backed by Node.js `fs/promises`.
 *
 * All operations use the real filesystem. Suitable for production
 * use in Node.js applications where local file access is needed.
 *
 * Use this adapter:
 * - In Node.js services that read configuration files
 * - For template loading, static asset reading
 * - For directory scanning and log file parsing
 */
export class NodeFileReaderAdapter implements FileReaderPort {
  // -----------------------------------------------------------------------
  // FileReaderPort — readFile
  // -----------------------------------------------------------------------

  async readFile(filePath: string): Promise<string> {
    return await fsReadFile(filePath, 'utf-8');
  }

  // -----------------------------------------------------------------------
  // FileReaderPort — fileExists
  // -----------------------------------------------------------------------

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // FileReaderPort — listFiles
  // -----------------------------------------------------------------------

  async listFiles(globPattern: string): Promise<string[]> {
    const baseDir = this.resolveBaseDir(globPattern);
    const pattern = globPattern.slice(baseDir.length).replace(/^[/\\]/, '') || '**/*';
    const regex = this.patternToRegex(pattern);

    const results: string[] = [];
    await this.walkDir(baseDir, regex, results);
    return results;
  }

  // -----------------------------------------------------------------------
  // FileReaderPort — readLines
  // -----------------------------------------------------------------------

  async readLines(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    return content.split(/\r?\n/);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Extract the base directory from a glob pattern.
   *
   * Everything before the first wildcard character.
   */
  private resolveBaseDir(pattern: string): string {
    const wildcardIndex = pattern.search(/[*?]/);
    if (wildcardIndex === -1) {
      return path.dirname(pattern);
    }
    // Find the last path separator before the first wildcard
    const sepIndex = pattern.lastIndexOf(path.sep, wildcardIndex);
    const altSepIndex = pattern.lastIndexOf('/', wildcardIndex);
    const bestIndex = Math.max(sepIndex, altSepIndex);
    if (bestIndex === -1) return '.';
    const base = pattern.slice(0, bestIndex);
    return base || '.';
  }

  /**
   * Convert a glob pattern to a RegExp.
   *
   * Supports `**` (recursive), `*` (single-segment), `?` (single char).
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '[@]RECURSIVE')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/\[@\]RECURSIVE/g, '.*');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Recursively walk a directory collecting matching paths.
   */
  private async walkDir(
    dirPath: string,
    regex: RegExp,
    results: string[],
  ): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const entryStat = await stat(fullPath);
        if (entryStat.isDirectory()) {
          await this.walkDir(fullPath, regex, results);
        } else if (regex.test(fullPath)) {
          results.push(fullPath);
        }
      } catch {
        // Skip entries that can't be stated (permission issues, broken symlinks)
      }
    }
  }
}
