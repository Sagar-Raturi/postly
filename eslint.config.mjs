import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next.
    //
    // Each is `**/`-prefixed so it matches at any depth, not just at the
    // repo root. Without that, a build directory inside a git worktree —
    // `.claude/worktrees/<name>/.next/` — is linted as if it were source,
    // which buries the real findings under ~19k problems from minified
    // vendor chunks and makes `npm run lint` useless.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // The Django project. Its virtualenv vendors minified JS (jQuery,
    // select2, xregexp) that ESLint would otherwise try to lint.
    "postly-backend/**",
  ]),
]);

export default eslintConfig;
