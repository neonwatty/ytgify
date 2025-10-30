import Image from 'next/image';

export default function Logo() {
  return (
    <div className="flex justify-center">
      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-[#E91E8C]/10 to-[#7B2FBE]/10 border-2 border-pink-200/50 shadow-lg">
        <Image
          src="/ytgify-logo.svg"
          alt="YTgify"
          width={64}
          height={64}
          className="w-14 h-14 sm:w-16 sm:h-16"
        />
      </div>
    </div>
  );
}
