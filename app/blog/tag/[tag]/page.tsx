import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllTags, getPostsByTag } from '@/lib/blog';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import BlogCard from '@/app/components/blog/BlogCard';
import SiteFooter from '@/app/components/SiteFooter';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
  const tags = getAllTags();
  return tags.map((tag) => ({
    tag: encodeURIComponent(tag.toLowerCase()),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const formattedTag = decodedTag.charAt(0).toUpperCase() + decodedTag.slice(1);

  return {
    title: `${formattedTag} Articles | ${SITE_NAME} Blog`,
    description: `Browse all articles about ${decodedTag}. GIF creation tips and tutorials from YTgify.`,
    alternates: {
      canonical: `${SITE_URL}/blog/tag/${tag}`,
    },
    openGraph: {
      type: 'website',
      title: `${formattedTag} Articles | ${SITE_NAME} Blog`,
      description: `Browse all articles about ${decodedTag}. GIF creation tips and tutorials.`,
      url: `${SITE_URL}/blog/tag/${tag}`,
      siteName: SITE_NAME,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const formattedTag = decodedTag.charAt(0).toUpperCase() + decodedTag.slice(1);
  const posts = getPostsByTag(decodedTag);

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[800px] mx-auto px-6 sm:px-12 pt-12 pb-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {formattedTag} Articles
          </h1>
          <p className="text-[#a0a0a0] text-lg">
            {posts.length} article{posts.length !== 1 ? 's' : ''} tagged with &quot;{decodedTag}&quot;
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#606060] text-lg">
              No articles found with this tag.
            </p>
            <Link
              href="/blog"
              className="inline-block mt-4 text-ytg-pink hover:underline"
            >
              View all articles
            </Link>
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
  );
}
