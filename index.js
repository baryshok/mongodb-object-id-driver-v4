const MongoClient = require("mongodb").MongoClient;
const v8Profiler = require("v8-profiler-next");
const fs = require("fs");

const url = "mongodb://localhost:27017";
const client = new MongoClient(url, {
  enableUtf8Validation: false,
  ignoreUndefined: true,
});

let db;

async function main() {
  await client.connect();
  db = client.db("loadtest");

  await clearDb();
  await populateDb();

  const requestCount = 100;
  const cpuProfileDuration = 20 * 1000;
  const tag = `fetch 50k docs ${requestCount} times in parallel (driver 4.3.1)`;

  console.time(tag);

  profileCpu(cpuProfileDuration);
  await benchmark(requestCount);

  console.timeEnd(tag);
}

main()
  .catch(console.error)
  .finally(() => client.close());

async function populateDb() {
  const docsCount = 50 * 1000;
  const operations = [];

  for (let i = 0; i < docsCount; i += 1) {
    const operation = { insertOne: { field1: "value1" } };
    operations.push(operation);
  }

  await db.collection("test").bulkWrite(operations);
}

function clearDb() {
  return db.collection("test").drop();
}

function profileCpu(duration) {
  const cpuProfileTitle = "driver-431-fetch-50k-docs-100-times";

  v8Profiler.setGenerateType(1);
  v8Profiler.setSamplingInterval(100);
  v8Profiler.startProfiling(cpuProfileTitle, true);

  setTimeout(() => {
    const profile = v8Profiler.stopProfiling(cpuProfileTitle);
    profile.export(function (error, result) {
      fs.writeFileSync(`${cpuProfileTitle}.cpuprofile`, result);
      profile.delete();
    });
  }, duration);
}

async function benchmark(requestCount) {
  const promises = [];

  for (let i = 0; i < requestCount; i += 1) {
    const promise = db.collection("test").find({}).toArray();
    promises.push(promise);
  }

  return Promise.all(promises);
}
