import type { MDXComponents } from 'mdx/types';
import ImageCarousel from '@/app/components/blog/ImageCarousel';
import DemoVideo from '@/app/components/DemoVideo';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ImageCarousel,
    DemoVideo,
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold mb-6 text-white">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold mb-4 mt-10 text-white">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold mb-3 mt-8 text-white">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-[#a0a0a0] mb-4 leading-relaxed">{children}</p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-ytg-pink hover:text-ytg-red transition-colors underline"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-4 text-[#a0a0a0] space-y-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-4 text-[#a0a0a0] space-y-2">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-ytg-pink pl-4 my-4 text-[#808080] italic">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm text-ytg-pink">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-[#1a1a1a] p-4 rounded-lg overflow-x-auto mb-4 text-sm">
        {children}
      </pre>
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || ''}
        className="rounded-lg my-6 max-w-full h-auto"
      />
    ),
    hr: () => <hr className="border-[#2a2a2a] my-8" />,
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-[#2a2a2a]">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-[#1a1a1a]">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="text-left py-2 px-3 text-white font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="py-2 px-3 text-[#a0a0a0]">{children}</td>
    ),
    ...components,
  };
}
