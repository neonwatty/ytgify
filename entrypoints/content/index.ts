export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_end',
  main() {
    console.log('Hello content script!');
  },
});
