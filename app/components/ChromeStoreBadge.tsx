import Image from 'next/image';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function ChromeStoreBadge() {
  return (
    <a
      href={CHROME_EXTENSION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block hover:opacity-90 transition-opacity"
    >
      <Image
        src="/chrome-web-store-badge.png"
        alt="Available in the Chrome Web Store"
        width={309}
        height={87}
        className="h-20 sm:h-[90px] w-auto"
      />
    </a>
  );
}