/**
 * @cenf/file-reader — read files, check existence, list by glob, read lines.
 *
 * @module @cenf/file-reader
 */

// Port
export { type FileReaderPort, FILE_READER_PORT_VERSION } from './ports.js';

// Adapters
export { NodeFileReaderAdapter } from './adapters/node-file-reader.adapter.js';
