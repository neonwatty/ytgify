import Link from 'next/link';
import { BlogPostMeta, formatDate } from '@/lib/blog';
import TagBadge from './TagBadge';

interface RelatedPostsProps {
  posts: BlogPostMeta[];
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 pt-8 border-t border-[#2a2a2a]">
      <h2 className="text-xl font-bold text-white mb-6">Related Articles</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block bg-[#111111] rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-ytg-pink/50 transition-all"
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {post.tags.slice(0, 2).map((tag) => (
                  <TagBadge key={tag} tag={tag} clickable={false} />
                ))}
              </div>
              <h3 className="text-sm font-medium text-white group-hover:text-ytg-pink transition-colors line-clamp-2">
                {post.title}
              </h3>
              <p className="text-xs text-[#606060] mt-1">
                {formatDate(post.date)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
