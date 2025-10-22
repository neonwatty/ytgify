import Image from 'next/image';

const basePath = process.env.NODE_ENV === 'production' ? '/ytgify' : '';

export default function Logo() {
  return (
    <div className="flex justify-center mb-16">
      <div className="relative p-4 rounded-3xl bg-gradient-to-br from-[#E91E8C]/10 to-[#7B2FBE]/10 border-2 border-pink-200/50 shadow-lg">
        <Image
          src={`${basePath}/ytgify-logo.svg`}
          alt="YTgify"
          width={120}
          height={120}
          className="w-20 h-20 sm:w-24 sm:h-24 lg:w-[120px] lg:h-[120px]"
        />
      </div>
    </div>
  );
}
