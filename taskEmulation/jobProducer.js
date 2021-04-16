//This is a program to push sample jobs to redis queue to test queue operation

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

//upload jobs to objectQueue queue
for (var x = 0; x < numberOfJobsUpload; x++) {

  objectQueue.add({
    objectQueue: 'sample job upload content'
  }).then(res => {
    console.log("job added");
    objectQueue.close();
  }).catch(error => {
    console.log(error.message);
    objectQueue.close();
  });

}



// objectQueue.on('global:drained', function(jobId, progress) {
//   console.log("now global drained")
//
// });
