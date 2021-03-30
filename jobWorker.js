var Queue = require('bull');

const objectQueue = new Queue('objectQueue', {
  redis: {
    port: 6379,
    host: "54.152.26.74",
    enableOfflineQueue: false
  }
});

objectQueue.process(function(job, done) {

  console.log(job.data);

  done();

  console.log("now done");

}).catch(error => alert(error.message));

objectQueue.on('completed', async (job, result) => {
  console.log("now completed")

})

objectQueue.on('drained', function(jobId, progress) {
  objectQueue.close();
});
