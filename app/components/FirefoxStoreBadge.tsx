import Image from 'next/image';

export default function FirefoxStoreBadge() {
  return (
    <div className="inline-block opacity-60">
      <div className="relative">
        <Image
          src="/firefox-addons-badge.png"
          alt="Get the Firefox Add-on"
          width={172}
          height={60}
          className="h-20 sm:h-[90px] w-auto"
        />
        <p className="text-center text-sm text-white/70 mt-2 font-medium">Coming Soon</p>
      </div>
    </div>
  );
}
