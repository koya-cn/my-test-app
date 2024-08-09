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
    const { start_date, end_date, include_publication, max_pages, topicname } = c.req.query();

    // デフォルト値設定
    const includePublication = include_publication === 'on';
    const maxPages = parseInt(max_pages as string, 10) || 10;
    const topic = topicname || '';

    // 日付のパース
    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    // APIから記事を取得するためのヘルパー関数
    async function fetchArticles(page: number) {
        // topicname が指定されている場合はクエリに追加
        const url = new URL(`https://zenn.dev/api/articles`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('order', 'latest');
        if (topic) {
            url.searchParams.append('topicname', topic);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Error fetching page ${page}`);
        }
        return response.json();
    }

    // 記事をフィルタリングするヘルパー関数
    function filterArticles(articles: any[], startDate: Date, endDate: Date, includePublication: boolean) {
        return articles.filter(article => {
            const articleDate = new Date(article.published_at);
            return (includePublication ? article.publication !== null : true) &&
                startDate <= articleDate && articleDate <= endDate;
        });
    }

    // 記事をソートするヘルパー関数
    function sortArticlesByLikes(articles: any[]) {
        return articles.sort((a, b) => b.liked_count - a.liked_count);
    }

    let articlesList: any[] = [];
    let page = 1;

    while (page <= maxPages) {
        const articlesData = await fetchArticles(page);
        const filteredArticles = filterArticles(
            articlesData.articles,
            startDate,
            endDate,
            includePublication
        );
        articlesList = articlesList.concat(filteredArticles);
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
