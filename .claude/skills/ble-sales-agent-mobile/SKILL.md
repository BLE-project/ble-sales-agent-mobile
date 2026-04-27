```markdown
# ble-sales-agent-mobile Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `ble-sales-agent-mobile` TypeScript codebase. You'll learn about file naming, import/export styles, commit message conventions, and how to write and run tests. This guide is ideal for contributors looking to maintain consistency and quality in this repository.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `bleService.ts`, `deviceManager.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { connectToDevice } from './bleService';
    ```

### Export Style
- Use **named exports** rather than default exports.
  - Example:
    ```typescript
    // bleService.ts
    export function connectToDevice() { ... }
    export function disconnectDevice() { ... }
    ```

### Commit Messages
- Follow **conventional commit** style.
- Use prefixes like `fix` and `feat`.
- Keep commit messages concise (average ~73 characters).
  - Example:
    ```
    feat: add BLE device scanning functionality
    fix: resolve connection timeout issue
    ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing new functionality  
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Write your feature using TypeScript, following relative import and named export conventions.
3. Write corresponding tests in a `.test.ts` file.
4. Commit your changes using the `feat:` prefix.
    ```
    feat: implement device pairing screen
    ```
5. Open a pull request for review.

### Fixing a Bug
**Trigger:** When resolving a bug or issue  
**Command:** `/fix-bug`

1. Identify the bug and update the relevant files.
2. Ensure all changes follow coding conventions.
3. Update or add tests in `.test.ts` files to cover the fix.
4. Commit your changes using the `fix:` prefix.
    ```
    fix: correct BLE disconnection handling
    ```
5. Open a pull request for review.

## Testing Patterns

- Test files use the pattern: `*.test.*` (e.g., `bleService.test.ts`)
- The specific testing framework is **unknown**; check existing test files for patterns.
- Place test files alongside or near the files they test.
- Example test file structure:
    ```typescript
    // bleService.test.ts
    import { connectToDevice } from './bleService';

    test('connectToDevice establishes connection', () => {
      // Test implementation
    });
    ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /add-feature   | Start the workflow for adding a new feature  |
| /fix-bug       | Start the workflow for fixing a bug          |
```
