import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllPosts } from '@/lib/blog';
import { generateBlogIndexSchema } from '@/lib/schema';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import BlogCard from '@/app/components/blog/BlogCard';
import SiteFooter from '@/app/components/SiteFooter';

export const metadata: Metadata = {
  title: `Blog | ${SITE_NAME} - GIF Creation Tips & Tutorials`,
  description:
    'Learn how to create GIFs from YouTube videos. Tips, tutorials, and guides for the YTgify Chrome extension.',
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    type: 'website',
    title: `${SITE_NAME} Blog - GIF Creation Tips & Tutorials`,
    description:
      'Learn how to create GIFs from YouTube videos. Tips, tutorials, and guides.',
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const jsonLd = generateBlogIndexSchema(posts);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-[800px] mx-auto px-6 sm:px-12 pt-12 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <header className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Blog</h1>
            <p className="text-[#a0a0a0] text-lg">
              Tips, tutorials, and guides for creating GIFs from YouTube videos.
            </p>
          </header>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#606060] text-lg">
                No blog posts yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
