/**
 * FileReaderPort interface — read files, check existence, list by glob, read lines.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/file-reader/ports
 */

/**
 * File reader port for filesystem interaction.
 *
 * Provides a clean abstraction over filesystem reads, enabling
 * the same business logic to work with local files, virtual
 * filesystems, or remote storage without changes.
 */
export interface FileReaderPort {
  /**
   * Read the entire contents of a file as a UTF-8 string.
   *
   * @param path - Absolute or relative path to the file.
   * @returns The file contents as a string.
   * @throws If the file does not exist or cannot be read.
   */
  readFile(path: string): Promise<string>;

  /**
   * Check whether a file exists at the given path.
   *
   * Returns `true` for both files and directories.
   *
   * @param path - The path to check.
   * @returns `true` if the path exists, `false` otherwise.
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * List file paths matching a glob pattern.
   *
   * Supports `*` (single-segment wildcard) and `**`
   * (recursive wildcard) patterns.
   *
   * @param glob - Glob pattern (e.g., `src/**\/*.ts`, `*.txt`).
   * @returns An array of matching absolute or relative paths.
   */
  listFiles(glob: string): Promise<string[]>;

  /**
   * Read a file and split its content into lines.
   *
   * Handles both LF and CRLF line endings.
   *
   * @param path - Path to the file.
   * @returns An array of lines from the file.
   */
  readLines(path: string): Promise<string[]>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const FILE_READER_PORT_VERSION = '0.1.0';
