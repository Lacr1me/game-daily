import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'file:///C:/Users/Lacr1me/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]]);return a},[]));
if (!args.html || !args.out) throw new Error('Usage: render.mjs --html <file> --out <png> [--scale 2] [--validate true]');
const html = path.resolve(args.html), out = path.resolve(args.out), scale = Number(args.scale || 2);
const source = fs.readFileSync(html,'utf8');
if (args.validate === 'true') {
  const placeholders = source.match(/\{\{[A-Z0-9_]+\}\}/g) || [];
  if (placeholders.length) throw new Error(`Unresolved placeholders: ${[...new Set(placeholders)].join(', ')}`);
  const expected = {red:10,purple:10,green:10,blue:5};
  for (const [cls,count] of Object.entries(expected)) {
    const block = source.match(new RegExp(`<section class="card column ${cls}">[\\s\\S]*?<\\/section>`));
    if (!block) throw new Error(`Missing ${cls} story column`);
    const actual = (block[0].match(/class="story"/g)||[]).length;
    if (actual !== count) throw new Error(`${cls} column has ${actual} stories; expected ${count}`);
  }
}
fs.mkdirSync(path.dirname(out),{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page = await browser.newPage({viewport:{width:1880,height:3800},deviceScaleFactor:scale});
await page.goto(pathToFileURL(html).href,{waitUntil:'networkidle'});
await page.locator('.page').screenshot({path:out});
await browser.close();
const stat = fs.statSync(out);
process.stdout.write(JSON.stringify({out,bytes:stat.size,scale}));
