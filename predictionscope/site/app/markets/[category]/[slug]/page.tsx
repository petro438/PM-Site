import { getArticle, generateSchema } from '@/lib/content';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: { category: string; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle('markets', params.slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.dateCreated,
      modifiedTime: article.dateUpdated,
    },
  };
}

export default async function MarketsArticlePage({ params }: Props) {
  // Try to find the article in the markets content directory
  const article = await getArticle('markets', params.slug);
  if (!article) notFound();

  const schema = generateSchema(article);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-slate-500 mb-6">
          <a href="/" className="hover:text-brand-400 transition-colors">Home</a>
          <span className="mx-2">/</span>
          <a href="/markets" className="hover:text-brand-400 transition-colors">Markets</a>
          <span className="mx-2">/</span>
          <a href={`/markets/${params.category}`} className="hover:text-brand-400 transition-colors capitalize">
            {params.category}
          </a>
          <span className="mx-2">/</span>
          <span className="text-slate-400">{article.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-brand-500 uppercase tracking-wider bg-brand-500/10 px-2 py-1 rounded">
              {article.category}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Last updated: {new Date(article.dateUpdated || article.dateCreated).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight mb-3">
            {article.title}
          </h1>
          <p className="text-lg text-slate-400">
            {article.description}
          </p>
        </header>

        {/* Content */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        {/* Affiliate disclosure */}
        <div className="mt-12 pt-6 border-t border-slate-800/50 text-xs text-slate-600">
          PredictionScope may earn a commission when you sign up through our links. This doesn&apos;t affect our editorial independence.
        </div>
      </article>
    </>
  );
}
