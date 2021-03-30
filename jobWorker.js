//This is a program to consume sample jobs from redis queue to test queue operation

var Queue = require('bull');

// redis connection detaila
const redisHost = process.env.redisHost;
const redisPort = 6379;

//number of jobs to upload
const numberOfJobsUpload = 10;

var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

let objectQueue;

//initiate new Quee
try {
  objectQueue = new Queue('objectQueue', {
    redis: redisParam
  });
} catch (err) {
  console.log("error occured => " + err.message);
  process.exit(1);
}

//event to process jobs as they are received

objectQueue.process(function(job, done) {

  console.log(job.data);

  done();

  console.log("now done");

}).catch(error => console.log(error.message));


objectQueue.on('drained', function(jobId, progress) {
  objectQueue.close();
});
