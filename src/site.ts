// One place for the product's public identity, so a rename or a repo move is a one-line change.
export const SITE = {
  name: "Qelvo",
  tagline: "Typeset, not templated",
  /** Public source repository. Leave empty until it exists; the UI hides the link. */
  repo: "https://github.com/SalmanDeveloperz/qelvo",
  linkedin: "https://www.linkedin.com/in/msalman199/",
  /**
   * AI import needs the Node server (server/index.ts) and an Anthropic key. Static hosts
   * build with VITE_AI_IMPORT=off: files are then parsed only in the browser and never uploaded.
   */
  aiImport: (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_AI_IMPORT !== "off",
};
