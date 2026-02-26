/**
 * lib/content.ts
 * 
 * Reads markdown content files, parses frontmatter, renders to HTML.
 * Used by Next.js pages to serve articles.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface ArticleMeta {
  title: string;
  slug: string;
  description: string;
  bucket: string;
  category: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  dateCreated: string;
  dateUpdated: string;
  author: string;
  schemaType: string;
  internalLinks: { slug: string; anchor: string }[];
  affiliateLinks: { platform: string; url?: string; promoCode?: string }[];
  status: string;
}

export interface Article extends ArticleMeta {
  contentHtml: string;
  rawContent: string;
}

// Recursively find all .md files in a directory
function findMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(data: Record<string, any>): ArticleMeta {
  return {
    title: data.title || '',
    slug: data.slug || '',
    description: data.description || '',
    bucket: data.bucket || '',
    category: data.category || '',
    targetKeyword: data.target_keyword || '',
    secondaryKeywords: data.secondary_keywords || [],
    dateCreated: data.date_created || '',
    dateUpdated: data.date_updated || '',
    author: data.author || 'PredictionScope',
    schemaType: data.schema_type || 'Article',
    internalLinks: data.internal_links || [],
    affiliateLinks: data.affiliate_links || [],
    status: data.status || 'draft',
  };
}

// Get all articles across all content directories
export async function getAllArticles(): Promise<ArticleMeta[]> {
  const articles: ArticleMeta[] = [];

  for (const bucket of ['learn', 'markets', 'best']) {
    const dir = path.join(CONTENT_DIR, bucket);
    const files = findMarkdownFiles(dir);

    for (const filepath of files) {
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const { data } = matter(fileContent);
      const meta = parseFrontmatter(data);

      // Only include published articles (not drafts) in production
      if (meta.status === 'published' || process.env.NODE_ENV === 'development') {
        articles.push(meta);
      }
    }
  }

  return articles.sort((a, b) =>
    new Date(b.dateUpdated || b.dateCreated).getTime() -
    new Date(a.dateUpdated || a.dateCreated).getTime()
  );
}

// Get recent articles (for homepage)
export async function getRecentArticles(limit: number = 10): Promise<ArticleMeta[]> {
  const all = await getAllArticles();
  return all.slice(0, limit);
}

// Get a single article by bucket and slug
export async function getArticle(bucket: string, slug: string): Promise<Article | null> {
  const dir = path.join(CONTENT_DIR, bucket);
  const files = findMarkdownFiles(dir);

  for (const filepath of files) {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const { data, content } = matter(fileContent);

    if (data.slug === slug) {
      const meta = parseFrontmatter(data);
      const processed = await remark().use(html).process(content);
      const contentHtml = processed.toString();

      return {
        ...meta,
        contentHtml,
        rawContent: content,
      };
    }
  }

  return null;
}

// Get all slugs for a bucket (for static generation)
export async function getSlugsForBucket(bucket: string): Promise<string[]> {
  const dir = path.join(CONTENT_DIR, bucket);
  const files = findMarkdownFiles(dir);
  const slugs: string[] = [];

  for (const filepath of files) {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const { data } = matter(fileContent);
    if (data.slug) slugs.push(data.slug);
  }

  return slugs;
}

// Get articles by category (for market category pages)
export async function getArticlesByCategory(category: string): Promise<ArticleMeta[]> {
  const all = await getAllArticles();
  return all.filter(a => a.category === category);
}

// Generate JSON-LD schema for an article
export function generateSchema(article: ArticleMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': article.schemaType || 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.dateCreated,
    dateModified: article.dateUpdated || article.dateCreated,
    author: {
      '@type': 'Organization',
      name: 'PredictionScope',
      url: 'https://predictionscope.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'PredictionScope',
      url: 'https://predictionscope.com',
    },
  };
}
