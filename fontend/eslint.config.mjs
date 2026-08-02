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
    rules: {
      // Existing consoles initiate an async loader from effects; state updates
      // happen after the request resolves, but the React 19 heuristic cannot
      // see through the wrapper and flags the call site synchronously. New
      // shared loaders retain stale-response guards in hooks/use-resource.tsx.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
