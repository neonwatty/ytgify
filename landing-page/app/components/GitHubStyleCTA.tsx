import ChromeStoreBadge from './ChromeStoreBadge';

export default function GitHubStyleCTA() {
  return (
    <section className="relative py-16 sm:py-24 grid-pattern">
      {/* Gradient background effect */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-purple-500/15 via-blue-500/10 to-transparent blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
          Ready to get started?
        </h2>

        <p className="text-base sm:text-lg text-[#7d8590] mb-10 max-w-2xl mx-auto">
          Install the extension and start creating GIFs in seconds
        </p>

        <div className="flex justify-center">
          <ChromeStoreBadge />
        </div>
      </div>
    </section>
  );
}
