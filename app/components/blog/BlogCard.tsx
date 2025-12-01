import Link from 'next/link';
import { BlogPostMeta, formatDate } from '@/lib/blog';
import TagBadge from './TagBadge';
import { Clock } from 'lucide-react';

interface BlogCardProps {
  post: BlogPostMeta;
}

export default function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group bg-[#111111] rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-ytg-pink/50 transition-all duration-300">
      <Link href={`/blog/${post.slug}`}>
        <div className="aspect-video overflow-hidden">
          <img
            src={post.thumbnail}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>
      <div className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {post.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-ytg-pink transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>
        <p className="text-[#808080] text-sm mb-3 line-clamp-2">
          {post.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-[#606060]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {post.readTime} min read
          </span>
          <span>{formatDate(post.date)}</span>
        </div>
      </div>
    </article>
  );
}
