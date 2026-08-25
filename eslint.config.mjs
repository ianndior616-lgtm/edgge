import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Existing client views intentionally start asynchronous data loading from
// effects. The React 19 compiler diagnostic flags the initial loading-state
// update as synchronous even though the request itself is asynchronous.
const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: ["drizzle/**", "coverage/**"],
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // Аватары и баннеры поступают как Telegram/пользовательские URL и data URL;
      // для них Next/Image без дополнительного remotePatterns неприменим.
      "@next/next/no-img-element": "off",
      // Шрифт подключён единожды в root layout для всего приложения.
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default config;
