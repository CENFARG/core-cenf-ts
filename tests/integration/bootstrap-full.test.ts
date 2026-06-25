/**
 * DEPRECATED: Split into bootstrap-orch-a.test.ts and bootstrap-orch-b.test.ts
 * to prevent OOM on limited-memory platforms (Node 24 + Windows).
 *
 * Run both parts:
 *   npx vitest run tests/integration/bootstrap-orch-a.test.ts tests/integration/bootstrap-orch-b.test.ts --config vitest.integration.config.ts
 *
 * The split is platform-required; both files combined cover all 9 orchestrator
 * managers as originally specified.
 */
