// This is a program to count number of jobs currently in redis queue
var Queue = require('bull');

// redis connection detaila
const redisHost = process.env.redisHost;
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost,
}

let objectQueue;

//initiate new Queue
try {
  objectQueue = new Queue('objectQueue', {
    redis: redisParam
  });
} catch (err) {
  console.log("error occured => " + err.message);
  process.exit(1);
}

//check number of jobs in quque

objectQueue.getJobCounts().then(res => {
  console.log('All count variable is :\n', res);
  objectQueue.close();
}).catch(err => {
  console.log('Redis server is not running, confirm it is available on: ' + redisHost + " : " + redisPort);
  objectQueue.close();
});
