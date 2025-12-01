import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import { getAllPosts, getPostBySlug, getRelatedPosts, formatDate } from '@/lib/blog';
import { generateArticleSchema, generateBreadcrumbSchema } from '@/lib/schema';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import TagBadge from '@/app/components/blog/TagBadge';
import RelatedPosts from '@/app/components/blog/RelatedPosts';
import SiteFooter from '@/app/components/SiteFooter';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {};
  }

  const ogImage = post.thumbnail.startsWith('http')
    ? post.thumbnail
    : `${SITE_URL}${post.thumbnail}`;

  return {
    title: `${post.title} | ${SITE_NAME} Blog`,
    description: post.description,
    keywords: post.tags.join(', '),
    alternates: {
      canonical: `${SITE_URL}/blog/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: SITE_NAME,
      publishedTime: post.date,
      authors: [SITE_NAME],
      tags: post.tags,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post.slug, post.tags, 3);

  const articleSchema = generateArticleSchema(post);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ]);

  // Dynamic import of MDX content
  let Content: React.ComponentType;
  try {
    const mdxModule = await import(`@/content/blog/${slug}.mdx`);
    Content = mdxModule.default;
  } catch {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="min-h-screen bg-[#0a0a0a]">
        <article className="max-w-[800px] mx-auto px-6 sm:px-12 pt-12 pb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Back to Blog
          </Link>

          <header className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-[#606060]">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {post.readTime} min read
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(post.date)}
              </span>
            </div>
          </header>

          {post.thumbnail && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          <div className="prose prose-invert max-w-none">
            <Content />
          </div>

          <RelatedPosts posts={relatedPosts} />
        </article>
        <SiteFooter />
      </main>
    </>
  );
}
