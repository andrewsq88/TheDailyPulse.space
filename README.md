TheDailyPulse.space

## Search indexing

`/sitemap.xml` and `/news-sitemap.xml` are generated on each request from the live feed. The sitemap lists the homepage, the privacy policy, and a permalink for every story currently in the feed. The news sitemap lists stories published in the last 48 hours, with the publication name, language, publication date, and title. `robots.txt` points at both. `www.thedailypulse.space` redirects to the apex, so every URL uses `https://thedailypulse.space`.

Story permalinks are `/stories/<id>`. They are rendered on the server. Homepage cards are unchanged and still open the original article.

IndexNow reads the public key from `INDEXNOW_KEY`. The key is not a secret — it is served at `/<key>.txt` — and it is not stored in this repo. Generate one, set it in Netlify for both builds and functions, then redeploy:

```
npm run indexnow:key
```

The build writes the key file and notifies `api.indexnow.org` with the current public URLs. A running server also notifies IndexNow about stories published in the last hour, and about any story that appears after that server has already loaded the feed once. This repo does not register the site with Google Search Console or Bing Webmaster.
