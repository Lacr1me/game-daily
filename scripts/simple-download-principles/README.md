# Simple Download principle page source

Regenerate from the repository root:

```sh
node scripts/build-simple-download-principles.mjs
```

The approved 69-solid diagram is defined by `geometry.mjs`. Its geometry and
depth ordering are unchanged. `content.mjs` holds the explanation; the build
includes its six steps and four system notes, without release snapshot text.

Runtime files are `works/simple-download/index.html`, `live.js`, and
`site/css/pages-simple-download.css`. The diagram inherits the shared SHARD
theme. Only the HTML is generated; CSS and the runtime script are edited directly.

The original geometry toolkit is [Anatomy](https://github.com/wheresryan22/anatomy)
(MIT, Copyright 2026 Ryan). Icons are from
[Lucide](https://github.com/lucide-icons/lucide) (ISC / MIT). Vendor licenses are
kept beside the source and copied to `works/simple-download/licenses/` for the
published page. Build dependencies under this directory are not shipped.
