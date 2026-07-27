/**
 * ConfigManager-specific types.
 *
 * @module @cenf/config/types
 */

/** Internal configuration store — a flat key-value map. */
export type ConfigStore = Record<string, unknown>;

/** Options for the environment-based config adapter. */
export interface EnvConfigOptions {
  /** Path to the .env file. Default: process.cwd()/.env */
  dotenvPath?: string;
  /** Whether to override existing process.env values. Default: false. */
  override?: boolean;
}

/** Runtime version constant — ensures module existence for TDD. */
export const CONFIG_TYPES_VERSION = '0.1.0';
