debugger;


var Queue = require('bull');

// const Redis = require('ioredis')
//
// const redis = new Redis({
//   port: 6379,
//   host: '52.86.55.47'
// })

// const objectQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

const objectQueue = new Queue('objectQueue', {
  redis: {
    port: 6379,
    host: "34.229.161.96",
    // maxRetriesPerRequest: null,
    // enableReadyCheck: false,
    enableOfflineQueue: false
  }
});

var objectQueue = new Queue('objectQueue', 'redis://52.86.55.47:6379');

for (var x = 0;x<10;x++){

// objectQueue.add({video: 'http://example.com/video1.mov'}, { removeOnComplete: true }).then(res=>{
objectQueue.add({video: 'http://example.com/video1.mov'}).then(res=>{
  console.log("job added");
}).catch(error => {
  console.log(error.message);
});

}



objectQueue.on('drained', async (job, result) => {
 console.log("now local drained");

 // objectQueue.close();

})

objectQueue.on('global:drained', function(jobId, progress) {
  console.log("now global drained")

  // objectQueue.close();
});
