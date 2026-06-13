const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const host = fs.readFileSync(path.join(rootDir, 'CNAME'), 'utf8').trim() || 'oldblog.smallyu.net';
const siteUrl = `http://${host}/`;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value) {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function absolutizeUrl(url) {
  if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('#')) {
    return url;
  }
  if (url.startsWith('/')) {
    return siteUrl.replace(/\/$/, '') + url;
  }
  return siteUrl + url.replace(/^\.\//, '');
}

function absolutizeHtml(html) {
  return html.replace(/\b(src|href)=(['"])(?!https?:\/\/|\/\/|mailto:|#)([^'"]+)\2/gi, (_match, attr, quote, url) => {
    return `${attr}=${quote}${absolutizeUrl(url)}${quote}`;
  });
}

function pubDate(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${String(day).padStart(2, '0')} ${months[month - 1]} ${year} 00:00:00 +0800`;
}

const articles = [];
const files = fs.readdirSync(rootDir).filter((file) => /^index.*\.html$/.test(file));

for (const file of files) {
  const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
  const canonical = html.match(/<link rel='canonical' href='([^']+\?id=(\d+))'\s*\/>/);
  if (!canonical) {
    continue;
  }

  const titleMatch = html.match(/<h1>\s*<a href="[^"]+">([\s\S]*?)<\/a>\s*<\/h1>/);
  const dateMatch = html.match(/<time><i class="fa fa-clock-o"><\/i>\s*([0-9]{4}-[0-9]{2}-[0-9]{2})<\/time>/);
  const articleMatch = html.match(/<article>[\s\S]*?<div class="article-meta">[\s\S]*?<\/div>\s*([\s\S]*?)\s*<\/article>/);
  if (!titleMatch || !dateMatch || !articleMatch) {
    throw new Error(`Cannot parse article metadata from ${file}`);
  }

  const id = Number(canonical[2]);
  const title = decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim());
  const link = absolutizeUrl(canonical[1]);
  const description = absolutizeHtml(articleMatch[1].trim());
  const guid = `${siteUrl}?id=${id}`;

  articles.push({ id, title, link, guid, description, date: dateMatch[1] });
}

articles.sort((left, right) => {
  const byDate = right.date.localeCompare(left.date);
  return byDate || right.id - left.id;
});

const lastBuildDate = articles.length ? pubDate(articles[0].date) : new Date().toUTCString().replace('GMT', '+0000');
const items = articles.map((article) => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.link)}</link>
      <guid isPermaLink="false">${escapeXml(article.guid)}</guid>
      <description>${cdata(article.description)}</description>
      <pubDate>${pubDate(article.date)}</pubDate>
      <dc:creator>smallyu</dc:creator>
    </item>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>smallyu</title>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(siteUrl)}auto.xml" rel="self" type="application/rss+xml" />
    <description>Hello World</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;

fs.writeFileSync(path.join(rootDir, 'auto.xml'), xml, 'utf8');
console.log(`Generated auto.xml with ${articles.length} items.`);
