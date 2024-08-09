import { Hono } from 'hono';
import fetch from 'node-fetch';

const app = new Hono();

app.get('/zenn', async (c) => {
  // クエリパラメータからフォームデータを取得
  const { start_date, end_date, include_publication, max_pages } = c.req.query();
  
  const includePublication = include_publication === 'on';
  const maxPages = parseInt(max_pages, 10);

  // 日付をISOフォーマットに変換するヘルパー関数
  function parseDate(dateStr) {
    return new Date(dateStr).toISOString();
  }

  // 記事を指定ページから取得する関数
  async function fetchArticles(page) {
    const url = `https://zenn.dev/api/articles?page=${page}&order=latest`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching page ${page}`);
    }
    return response.json();
  }

  // 記事をフィルタリングする関数
  function filterArticles(articles, startDate, endDate, includePublication) {
    return articles.filter(article => {
      const articleDate = new Date(article.published_at);
      return (includePublication ? article.publication !== null : true) &&
             startDate <= articleDate && articleDate <= endDate;
    });
  }

  // 記事をいいね数でソートする関数
  function sortArticlesByLikes(articles) {
    return articles.sort((a, b) => b.liked_count - a.liked_count);
  }

  let articlesList = [];
  let page = 1;

  // 最大ページ数まで記事を取得して処理
  while (page <= maxPages) {
    const articlesData = await fetchArticles(page);
    const filteredArticles = filterArticles(
      articlesData.articles,
      new Date(start_date),
      new Date(end_date),
      includePublication
    );
    articlesList = articlesList.concat(filteredArticles);

    if (articlesData.next_page) {
      page = articlesData.next_page;
    } else {
      break;
    }
  }

  // 記事リストをいいね数でソート
  articlesList = sortArticlesByLikes(articlesList);

  // JSON形式でレスポンスを返す
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

// デフォルトエクスポートとして関数をエクスポート
export default app.fetch;

