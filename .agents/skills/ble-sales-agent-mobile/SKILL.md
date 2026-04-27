```markdown
# ble-sales-agent-mobile Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `ble-sales-agent-mobile` TypeScript codebase. You'll learn about file naming, import/export styles, commit message conventions, and how to write and run tests. While no automated workflows were detected, this guide suggests helpful commands for common development tasks.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `salesAgentScreen.ts`, `userProfileManager.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { getUserProfile } from './userProfileManager';
    ```

### Export Style
- Use **named exports** for functions, classes, and constants.
  - Example:
    ```typescript
    // userProfileManager.ts
    export function getUserProfile(id: string) { ... }
    export const PROFILE_TYPE = 'agent';
    ```

### Commit Messages
- Use **Conventional Commits** with prefixes like `ci`.
  - Example:
    ```
    ci: update build pipeline for release
    ```
- Commit messages are concise, averaging around 78 characters.

## Workflows

_No automated workflows detected in this repository. Below are suggested manual workflows._

### Running Tests
**Trigger:** When you want to verify your code changes.
**Command:** `/run-tests`

1. Locate test files matching the `*.test.*` pattern.
2. Use your preferred test runner (e.g., Jest, Mocha) to execute tests.
   - Example:
     ```
     npx jest
     ```
3. Review test results and fix any failing tests.

### Adding a New Module
**Trigger:** When creating a new feature or utility.
**Command:** `/add-module`

1. Create a new file using camelCase naming.
2. Implement your logic using named exports.
3. Import the module using a relative path where needed.
4. Write a corresponding test file named `yourModule.test.ts`.

### Writing Commits
**Trigger:** When committing code changes.
**Command:** `/commit`

1. Write a commit message using the Conventional Commits format.
   - Example: `ci: add sales agent onboarding script`
2. Keep the message under 80 characters for readability.

## Testing Patterns

- Test files follow the `*.test.*` naming convention.
  - Example: `userProfileManager.test.ts`
- The specific test framework is not defined, but typical TypeScript test runners include Jest or Mocha.
- Place test files alongside or near the modules they test.

**Sample Test File:**
```typescript
// userProfileManager.test.ts
import { getUserProfile } from './userProfileManager';

test('should return user profile for valid id', () => {
  const profile = getUserProfile('123');
  expect(profile).toBeDefined();
});
```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /run-tests   | Run all test files in the project            |
| /add-module  | Create a new module following conventions    |
| /commit      | Make a commit using Conventional Commits     |
```
