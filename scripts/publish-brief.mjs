import { publishChannel } from './publish-channel.mjs';
const runId=process.argv.find(arg=>arg.startsWith('--run-id='))?.slice(9);
const result=await publishChannel({channel:'game',runId});
console.log(JSON.stringify(result,null,2));
