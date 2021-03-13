debugger;



var Queue = require('bull');

var videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

videoQueue.process(function(job, done) {

  // job.data contains the custom data passed when the job was created
  // job.id contains id of this job.

  // transcode video asynchronously and report progress
  // job.progress(42);



  console.log(job.data);

  done();

  console.log("now done");
  // videoQueue.close().then(jobDone);

  // return Promise.resolve({ framerate: 29.5 /* etc... */ });

  // call done when finished
  // done(null, { framerate: 29.5 /* etc... */ });

  // done();


  // or give a error if error
  // done(new Error('error transcoding'));
  //
  // // or pass it a result
  // done(null, { framerate: 29.5 /* etc... */ });
  //
  // // If the job throws an unhandled exception it is also handled correctly
  // throw new Error('some unexpected error');


  //   var after100 = _.after(1, function() {
  //   videoQueue.close().then(function() {
  //     console.log('done');
  //   });
  // });

  // videoQueue.on('drained', videoQueue.close().then(function() {console.log('done');}));
videoQueue.getJobCounts().then(res => console.log('second Job Count:\n',res["waiting"]+res["active"]));

videoQueue.count().then(res => console.log('new count variable is :\n',res));




  videoQueue.on("waiting", console.log("now waiting"));

videoQueue.getJobCounts().then(res => console.log('third Job Count:\n',res));

}).catch(error => alert(error.message));
