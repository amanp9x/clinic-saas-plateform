import type { ArticleDto } from '@clinic/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

/** Preview-only teaser — no article detail page exists yet, so these are intentionally not links. */
export function ArticleCard({ article }: { article: ArticleDto }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        {article.category && (
          <Badge variant="secondary" className="w-fit">
            {article.category}
          </Badge>
        )}
        <p className="font-semibold leading-snug">{article.title}</p>
        <p className="text-muted-foreground line-clamp-3 flex-1 text-sm">{article.excerpt}</p>
        <div className="text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
          {article.authorName && <span>{article.authorName}</span>}
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
