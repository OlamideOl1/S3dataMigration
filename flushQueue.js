// This is a program to flush all jobs in a provided queue

var Queue = require('bull');

// redis connection detaila
const redisHost = process.env.redisHost;
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost
}

//initiate new Quee

try {

  var objectQueue = new Queue('objectQueue', {
    redis: redisParam
  });

  objectQueue.empty().then(res => objectQueue.clean(1).then(res => objectQueue.clean(1, 'failed').then(res => objectQueue.close())));

} catch (err) {
  console.log("error occured => " + err.mesage);
}

// objectQueue.close();
