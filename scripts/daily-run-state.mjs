import process from "node:process";
import { appendResearchLedger, checkpointRunState, initializeRunState, mergeSourceAudits, operationPaths, researchCompleteness } from "./daily-operations.mjs";
import { beijingDate } from "./game-lib.mjs";

const root = process.cwd();
const [command = "status"] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => {
  const index = arg.indexOf("=");
  return index === -1 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
const date = args.date || beijingDate();

if (command === "init") {
  console.log(JSON.stringify(await initializeRunState(root, {
    date,
    runId: args["run-id"],
    kind: args.kind || "main",
    minshengIssue: numberOrUndefined(args["minsheng-issue"]),
    gameIssue: numberOrUndefined(args["game-issue"])
  }), null, 2));
} else if (command === "record") {
  console.log(JSON.stringify(await appendResearchLedger(root, {
    date,
    runId: args["run-id"],
    channel: args.channel,
    section: args.section,
    source: args.source,
    tier: args.tier,
    url: args.url,
    status: args.status,
    availableCount: args.available,
    rejectedCount: args.rejected,
    reasons: args.reason,
    candidateIds: args.candidates
  }), null, 2));
} else if (command === "checkpoint") {
  console.log(JSON.stringify(await checkpointRunState(root, date, {
    stage: args.stage,
    channel: args.channel,
    status: args.status,
    published: args.published === undefined ? undefined : args.published === "true",
    missingSections: args.missing === undefined ? undefined : args.missing.split(",").filter(Boolean),
    runId: args["run-id"],
    runStatus: args["run-status"]
  }), null, 2));
} else if (command === "merge-audit") {
  console.log(JSON.stringify(await mergeSourceAudits(root, date), null, 2));
} else if (command === "status") {
  const output = { date, paths: operationPaths(root, date), channels: {} };
  for (const channel of ["minsheng", "game"]) output.channels[channel] = await researchCompleteness(root, date, channel);
  console.log(JSON.stringify(output, null, 2));
} else {
  throw new Error(`未知命令：${command}`);
}

function numberOrUndefined(value) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error("期号必须为正整数");
  return number;
}
