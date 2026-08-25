import { assertResearchComplete, researchCompleteness } from "./daily-operations.mjs";
import { beijingDate } from "./game-lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => {
  const index = arg.indexOf("=");
  return index === -1 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
const date = args.date || beijingDate();
const channels = args.channel ? [args.channel] : ["minsheng", "game"];
const output = { date, channels: {} };
let failed = false;
for (const channel of channels) {
  output.channels[channel] = await researchCompleteness(process.cwd(), date, channel);
  try { await assertResearchComplete(process.cwd(), date, channel); }
  catch { failed = true; }
}
console.log(JSON.stringify(output, null, 2));
if (failed) process.exitCode = 1;
