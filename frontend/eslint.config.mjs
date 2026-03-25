import {dirname} from "node:path";
import {fileURLToPath} from "node:url";

import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default tseslint.defineConfig(
  {
    ignores: [".next/**", "next-env.d.ts", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  prettierConfig,
);
