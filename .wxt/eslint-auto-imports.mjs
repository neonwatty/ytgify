const globals = {
  "ContentScriptContext": true,
  "InvalidMatchPattern": true,
  "KeyboardShortcutManager": true,
  "MatchPattern": true,
  "browser": true,
  "copyToClipboard": true,
  "createIframeUi": true,
  "createIntegratedUi": true,
  "createShadowRootUi": true,
  "defineAppConfig": true,
  "defineBackground": true,
  "defineConfig": true,
  "defineContentScript": true,
  "defineUnlistedScript": true,
  "defineWxtPlugin": true,
  "fakeBrowser": true,
  "generateTwitterShareUrl": true,
  "getDiscordTemplate": true,
  "getRedditTemplate": true,
  "getResolutionDimensions": true,
  "getTwitterTemplates": true,
  "isOriginalResolution": true,
  "parseResolution": true,
  "storage": true,
  "useAppConfig": true
}

export default {
  name: "wxt/auto-imports",
  languageOptions: {
    globals,
    sourceType: "module",
  },
};
