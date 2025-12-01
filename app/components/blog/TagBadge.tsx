import Link from 'next/link';

interface TagBadgeProps {
  tag: string;
  clickable?: boolean;
}

const tagColors: Record<string, string> = {
  tutorial: 'bg-ytg-pink/20 text-ytg-pink',
  gif: 'bg-ytg-purple/20 text-ytg-purple',
  youtube: 'bg-ytg-red/20 text-ytg-red',
  meme: 'bg-yellow-500/20 text-yellow-400',
  tips: 'bg-green-500/20 text-green-400',
  howto: 'bg-blue-500/20 text-blue-400',
};

function getTagColor(tag: string): string {
  const normalizedTag = tag.toLowerCase();
  return tagColors[normalizedTag] || 'bg-[#2a2a2a] text-[#a0a0a0]';
}

export default function TagBadge({ tag, clickable = true }: TagBadgeProps) {
  const className = `inline-block px-2 py-0.5 text-xs rounded-full ${getTagColor(tag)} transition-opacity hover:opacity-80`;

  if (clickable) {
    return (
      <Link
        href={`/blog/tag/${encodeURIComponent(tag.toLowerCase())}`}
        className={className}
      >
        {tag}
      </Link>
    );
  }

  return <span className={className}>{tag}</span>;
}
