# CI/CD Pipeline Specification

## Purpose

GitHub Actions CI pipeline with npm audit for supply chain security, Vitest coverage threshold enforcement, and CycloneDX SBOM generation.

## Requirements

### Requirement: npm Audit in CI

The CI pipeline MUST run `npm audit` and fail the build if any HIGH or CRITICAL severity vulnerabilities are found. The audit MUST check production dependencies only (not devDependencies).

#### Scenario: CI fails on HIGH vulnerability

- GIVEN a dependency with a HIGH severity vulnerability is installed
- WHEN the CI pipeline runs `npm audit --audit-level=high`
- THEN the audit exits with non-zero status
- AND the CI job fails with the vulnerability report

#### Scenario: CI passes with no HIGH/CRITICAL vulnerabilities

- GIVEN all dependencies have LOW or MODERATE vulnerabilities at most
- WHEN the CI pipeline runs `npm audit --audit-level=high`
- THEN the audit exits with zero status
- AND the CI job proceeds to the next step

### Requirement: Vitest Coverage Threshold Enforcement

The CI pipeline MUST run `npx vitest run --coverage` and enforce a minimum 80% branch coverage threshold. The coverage report MUST be generated in both text and lcov formats.

#### Scenario: CI fails below 80% coverage

- GIVEN the codebase has 75% branch coverage
- WHEN `npx vitest run --coverage` is executed in CI
- THEN vitest exits with non-zero status
- AND the CI job fails with the coverage report showing 75%

#### Scenario: CI passes at or above 80% coverage

- GIVEN the codebase has 85% branch coverage
- WHEN `npx vitest run --coverage` is executed in CI
- THEN vitest exits with zero status
- AND lcov.info is generated for downstream tools

### Requirement: CycloneDX SBOM Generation

The CI pipeline MUST generate a CycloneDX Software Bill of Materials (SBOM) in JSON format using `@cyclonedx/cyclonedx-npm`. The SBOM MUST be saved as an artifact and include all production dependencies.

#### Scenario: SBOM generated in CI

- GIVEN `@cyclonedx/cyclonedx-npm` is installed as a devDependency
- WHEN the CI pipeline runs `npx cyclonedx-npm --output-file sbom.json`
- THEN `sbom.json` is a valid CycloneDX 1.4 JSON document
- AND it includes all production dependencies with versions

#### Scenario: SBOM artifact uploaded

- GIVEN the SBOM is generated
- WHEN the CI pipeline completes
- THEN `sbom.json` is uploaded as a GitHub Actions artifact
- AND the artifact is downloadable from the workflow run page
