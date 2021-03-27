
var Queue = require('bull');

var cntres = 1;

const redisHost = "34.229.161.96";
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost,
}

var videoQueue = new Queue('objectQueue', {
  redis: redisParam
});

/////////
videoQueue.getJobCounts().then(res => {
  console.log('All count variable is :\n', res);
  videoQueue.close();
}).catch(err => {
  console.log('Redis server is not running, review it is available on: ' + redisHost + " : " + redisPort);
  videoQueue.close();
});
////////
