import Image from 'next/image';
import { FIREFOX_ADDON_URL } from '@/lib/constants';

export default function FirefoxStoreBadge() {
  return (
    <a
      href={FIREFOX_ADDON_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block hover:opacity-90 transition-opacity"
    >
      <Image
        src="/firefox-addons-badge.png"
        alt="Get the Firefox Add-on"
        width={172}
        height={60}
        className="h-20 sm:h-[90px] w-auto"
      />
    </a>
  );
}
