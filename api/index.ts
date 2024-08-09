import { Hono } from 'hono'
import { handle } from 'hono/vercel'

export const config = {
  runtime: 'edge'
}

const app = new Hono().basePath('/api')

app.get('/', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

app.get('/fetch', async (c) => {
    const { start_date, end_date, include_publication, max_pages } = c.req.query();
    const includePublication = include_publication === 'on';
    const maxPages = parseInt(max_pages, 10);

    function parseDate(dateStr: string): Date {
        return new Date(dateStr);
    }

    async function fetchArticles(page: number) {
        const url = `https://zenn.dev/api/articles?page=${page}&order=latest`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching page ${page}`);
        }
        return response.json();
    }

    function filterArticles(
        articles: any[],
        startDate: Date,
        endDate: Date,
        includePublication: boolean
    ) {
        return articles.filter(article => {
            const articleDate = new Date(article.published_at);
            return (
                (includePublication ? article.publication !== null : true) &&
                startDate <= articleDate &&
                articleDate <= endDate
            );
        });
    }

    function sortArticlesByLikes(articles: any[]) {
        return articles.sort((a, b) => b.liked_count - a.liked_count);
    }

    let articlesList: any[] = [];
    let page = 1;
    let totalPages = 0;

    while (page <= maxPages) {
        const articlesData = await fetchArticles(page);
        const filteredArticles = filterArticles(
            articlesData.articles,
            parseDate(start_date),
            parseDate(end_date),
            includePublication
        );
        articlesList = articlesList.concat(filteredArticles);
        totalPages += 1;
        if (articlesData.next_page) {
            page = articlesData.next_page;
        } else {
            break;
        }
    }

    articlesList = sortArticlesByLikes(articlesList);

    return c.json({
        total_articles: articlesList.length,
        articles: articlesList.map((article, index) => ({
            rank: index + 1,
            title: article.title,
            liked_count: article.liked_count,
            url: `https://zenn.dev${article.path}`
        }))
    });
});

export default handle(app)
