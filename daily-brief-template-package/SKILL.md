---
name: artifact-template-daily-brief
description: "Create a current, high-resolution Chinese 民生日报 using the 每日民生日报 Daily Brief template. Use when the user selects this template, asks for today's 民生日报, names 每日民生日报 Daily Brief, or explicitly invokes $artifact-template-daily-brief. Research current Beijing-time news and market data, verify every item against authoritative sources, typeset real Chinese text with HTML/CSS, and render a crisp PNG rather than asking an image model to draw the dense-text page."
---

# 每日民生日报 Daily Brief

Create a current, source-backed Chinese daily briefing as a sharp, zoomable PNG. The retained reference PNG controls the visual language; the retained HTML/CSS controls geometry and typography.

## Required files

1. Read `artifact-template.json` and resolve every path relative to this skill directory.
2. Read `references/editorial-rules.md` and `references/layout-spec.md` completely before researching or editing.
3. Use `assets/reference.png` as the visual target and `assets/template.html` as the editable layout source.
4. Use `scripts/render.mjs` to render and validate the final PNG.

## Workflow

1. Determine the current date, weekday, lunar date and the current/previous-day window in `Asia/Shanghai`. Browse the web because freshness is mandatory.
2. Leave the weather area completely blank. Do not detect location and do not call any weather, IP-geolocation or device-location service.
3. Research every news and data item under the authority, recency, count and metadata rules in `references/editorial-rules.md`. Never invent a story, quotation, number, source, publication time or paper.
4. Build exactly 35 news items: 10 中国时政与民生, 10 全球国际, 10 中国科技 and 5 AI科技. “今日3件大事” must be selected from those 35 items and must not be counted as extra stories.
5. Use the fixed output root `C:\Users\Lacr1me\Desktop\日报\民生日报`. Create it only if it does not exist. Under that root, derive the month folder from the current Beijing date as `YYYY-M` with no leading zero on the month, for example `2026-8`. Reuse an existing month folder; never create a duplicate month folder.
6. Save both daily files inside that month folder as `YYYY-MM-DD-民生日报.html` and `YYYY-MM-DD-民生日报.png`. When regenerating the same date, update the same dated pair instead of creating numbered duplicates. Do not modify unrelated files in the folder.
7. Copy `assets/template.html` to the dated working HTML file. Do not edit the retained template in place. Replace every placeholder, including the masthead count, date, top stories, all 35 news entries, data panel, observation, source line and production time. Keep the weather area empty.
8. Keep every title, summary, date, source and number as browser-rendered text. Do not use ImageGen or another raster model to draw the full page or its body text.
9. Preserve the four-column order and semantics: red 中国时政与民生; purple 全球国际; green 中国科技; blue AI科技 in the upper-right; 数据速览 in the lower-right.
10. Render through the bundled Node runtime:

   `node <skill-directory>/scripts/render.mjs --html <working-html> --out <output-png> --scale 2 --validate true`

11. The validation pass must succeed. Then inspect the PNG with `view_image` at original detail and verify counts, dates, the intentionally blank weather area, source labels, text wrapping, borders, panel balance and page edges.
12. If anything is clipped, blurry, crowded or missing, edit the working HTML and render again. Never solve a dense-text defect by upscaling a low-resolution screenshot.
13. Return the final PNG and editable HTML from `C:\Users\Lacr1me\Desktop\日报\民生日报\YYYY-M`. State the Beijing-time retrieval cutoff, final pixel dimensions and saved month folder.

## Typography and resolution

- Use `Microsoft YaHei`, `Noto Sans CJK SC`, `PingFang SC` or a comparable installed Chinese sans-serif font. Use a Chinese Song/Ming serif only for the “民生日报” masthead.
- Final PNG width must be at least 3600 pixels. The default 1800 CSS-pixel page rendered at scale 2 produces 3600 pixels.
- Keep a clean white paper background, restrained borders, generous inner padding and strong typographic hierarchy.
- Informative text must remain editable HTML text.

## Fidelity

User instructions control requested content and explicit deviations. Otherwise preserve the retained reference’s composition, semantic colors, hierarchy, density, numbered story system, top summary, bottom observation and recurring card language.
