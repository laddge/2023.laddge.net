import fs from 'fs'

import type { ImageMetadata } from 'astro'
import { getImage } from 'astro:assets'
import { getCollection } from 'astro:content'
import axios from 'axios'
import { JSDOM } from 'jsdom'

export interface Article {
  slug: string
  href: string
  title: string
  tags: string[]
  pubDate: Date
  image: string | ImageMetadata
  articleType: number
}

const fetchData = async () => {
  const blogEntries = await getCollection('blog', ({ data }) => {
    return data.hidden !== true
  })
  const articles: Article[] = blogEntries.map((entry) => ({
    slug: entry.slug,
    href: '/blog/' + entry.slug,
    title: entry.data.title,
    tags: entry.data.tags,
    pubDate: entry.data.pubDate,
    image: entry.data.image,
    articleType: 0,
  }))

  const qRes = await axios.get('https://qiita.com/api/v2/items?perpage=100;query=user:laddge', {
    headers: { Authorization: 'Bearer 072114f0c0c2cb62d76729b19dba8ce6534cc3dd' },
  })
  for (const item of qRes.data) {
    const image = `https://qiita-ogimage.dev-laddge.workers.dev/laddge/${item.id}`

    articles.push({
      slug: item.id,
      href: item.url,
      title: item.title,
      tags: item.tags.map((tag: { name: string }) => tag.name),
      pubDate: new Date(item.created_at),
      image,
      articleType: 1,
    })
  }

  const zaRes = await axios.get('https://zenn.dev/api/articles?username=laddge')
  for (const item of zaRes.data.articles) {
    const doc = (await JSDOM.fromURL(`https://zenn.dev${item.path}`)).window.document
    const tags: string[] = Array.from(
      doc.querySelectorAll('a[href^="/topics"] > div[class^="View_topicName"]')
    )
      .map((el) => (el.textContent ? el.textContent : ''))
      .filter((tag) => tag != '')
    const meta = doc.querySelector('meta[property="og:image"]') as HTMLMetaElement
    const image = meta ? meta.content : ''

    articles.push({
      slug: item.id,
      href: `https://zenn.dev${item.path}`,
      title: item.title,
      tags,
      pubDate: new Date(item.published_at),
      image,
      articleType: 2,
    })
  }

  const zsRes = await axios.get('https://zenn.dev/api/scraps?username=laddge')
  for (const item of zsRes.data.scraps) {
    const meta = (
      await JSDOM.fromURL(`https://zenn.dev${item.path}`)
    ).window.document.querySelector('meta[property="og:image"]') as HTMLMetaElement
    const image = meta ? meta.content : ''

    articles.push({
      slug: item.id,
      href: `https://zenn.dev${item.path}`,
      title: item.title,
      tags: item.topics.map((topic: { display_name: string }) => topic.display_name),
      pubDate: new Date(item.last_comment_created_at),
      image,
      articleType: 3,
    })
  }

  return articles.sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf())
}

const optimizeImage = async (articles: Article[]) => {
  for (const article of articles) {
    article.image = (await getImage({ src: article.image, inferSize: true })).src
  }
  return articles
}

export const getArticles = async () => {
  try {
    const data = fs.readFileSync('./.articles.json', 'utf-8')
    const articles = JSON.parse(data).articles
    for (const article of articles) {
      article.pubDate = new Date(article.pubDate)
    }
    return await optimizeImage(articles)
  } catch (err) {
    const articles = await fetchData()
    fs.writeFileSync('./.articles.json', JSON.stringify({ articles }))
    return await optimizeImage(articles)
  }
}
