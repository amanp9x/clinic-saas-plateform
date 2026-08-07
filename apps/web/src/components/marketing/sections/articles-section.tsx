import type { ArticleDto } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { ArticleCard } from '../article-card';

export function ArticlesSection({ articles }: { articles: ArticleDto[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading eyebrow="Health library" title="Health articles" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
