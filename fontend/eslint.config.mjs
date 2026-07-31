import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** Flat config — ESLint 10 + eslint-config-next 16 */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    // Pin the React version: the bundled eslint-plugin-react's auto-detection
    // is not compatible with ESLint 10's rule context API.
    settings: { react: { version: "19.2" } },
  },
];

export default eslintConfig;
