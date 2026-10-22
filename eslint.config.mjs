import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/src/generated.ts", "supabase/.temp/**", ".venv-ai/**", ".cache-ai/**", ".local-test/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/*", "*/apps/*", "**/apps/**"],
              message: "Packages must not import from apps."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/src/**/*.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Web components must call @reboxe/api-client instead of fetch directly." }
      ],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@reboxe/backend", message: "The web runtime must not import server-only implementation." }] }
      ]
    }
  }
);
