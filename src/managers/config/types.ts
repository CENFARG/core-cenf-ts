/**
 * ConfigManager-specific types.
 *
 * Types used by config adapters and consumers.
 *
 * @module managers/config/types
 */

/**
 * Internal configuration store — a flat key-value map.
 *
 * Values can be any type (string, number, boolean, etc.).
 * Type safety is enforced by Zod schemas at the boundary.
 */
export type ConfigStore = Record<string, unknown>;

/**
 * Options for the environment-based config adapter.
 *
 * Controls dotenv file loading behavior.
 */
export interface EnvConfigOptions {
  /** Path to the .env file. Default: process.cwd()/.env */
  dotenvPath?: string;
  /** Whether to override existing process.env values. Default: false. */
  override?: boolean;
}

/** Runtime version constant — ensures module existence for TDD. */
export const CONFIG_TYPES_VERSION = '0.1.0';
