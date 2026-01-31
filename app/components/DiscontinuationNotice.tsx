export default function DiscontinuationNotice() {
  return (
    <>
      {/* Discontinuation Notice Banner */}
      <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-red-300 mb-2">YTgify Has Been Removed from the Chrome Web Store</h3>
            <p className="text-gray-300 mb-4">
              After 8 months in the Chrome Web Store and being a featured extension for 4 months, Google has informed us that YTgify violates their terms of service regarding the transformation of YouTube video frames into GIFs.
            </p>
            <p className="text-gray-300 mb-4">
              We&apos;re disappointed by this decision, but we understand. <strong className="text-white">You can still use YTgify</strong> by installing it locally as an unpacked extension.
            </p>
          </div>
        </div>
      </div>

      {/* Local Installation Section */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8">
        <h3 className="text-2xl font-bold text-white mb-4">Install YTgify Locally</h3>

        <p className="text-gray-300 mb-6">
          You can still use YTgify by installing it as an &ldquo;unpacked extension&rdquo; in Chrome. This is the same extension, just installed directly instead of through the Chrome Web Store.
        </p>

        {/* Download Button */}
        <div className="mb-8">
          <a
            href="/downloads/ytgify-v1.0.19-chrome.zip"
            download
            className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download YTgify v1.0.19 (Chrome)
          </a>
          <p className="text-gray-500 text-sm mt-2">ZIP file, ~330 KB</p>
        </div>

        {/* Installation Steps */}
        <h4 className="text-lg font-semibold text-white mb-4">Installation Steps</h4>

        <ol className="space-y-4 text-gray-300">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
            <div>
              <p className="font-medium text-white">Download and extract the ZIP file</p>
              <p className="text-gray-400 text-sm">Extract the downloaded ZIP to a folder on your computer. Remember where you put it!</p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
            <div>
              <p className="font-medium text-white">Open Chrome Extensions</p>
              <p className="text-gray-400 text-sm">
                Go to <code className="bg-gray-800 px-2 py-0.5 rounded text-blue-300">chrome://extensions</code> in your browser, or click Menu → More Tools → Extensions
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
            <div>
              <p className="font-medium text-white">Enable Developer Mode</p>
              <p className="text-gray-400 text-sm">Toggle the &ldquo;Developer mode&rdquo; switch in the top-right corner of the extensions page</p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
            <div>
              <p className="font-medium text-white">Load the extension</p>
              <p className="text-gray-400 text-sm">Click &ldquo;Load unpacked&rdquo; and select the folder where you extracted YTgify</p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">✓</span>
            <div>
              <p className="font-medium text-white">Done! Start creating GIFs</p>
              <p className="text-gray-400 text-sm">Go to any YouTube video and you&apos;ll see the YTgify button. Happy GIF-making!</p>
            </div>
          </li>
        </ol>

        {/* Note about updates */}
        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
          <p className="text-yellow-200 text-sm">
            <strong>Note:</strong> Unpacked extensions won&apos;t auto-update. Check back here for new versions, or follow us on{' '}
            <a href="https://x.com/neonwatty" target="_blank" rel="noopener noreferrer" className="text-yellow-300 hover:underline">X/Twitter</a>
            {' '}for updates.
          </p>
        </div>
      </div>
    </>
  );
}
