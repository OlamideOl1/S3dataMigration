var Queue = require('bull');

var videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');
// var videoQueue = new Queue('video transcoding', 'redis://52.86.55.47:6379');

// var fs = require('fs');

var AWS = require('aws-sdk');
var targetS3Bucket = "newproductionbucket77";
var sourceS3Bucket = "legacybucket77"
var targetObjectPrefix = "avatar/"

var s3CopyFlag = new Boolean(false);

var dbUpdateFlag = new Boolean(false);



s3 = new AWS.S3({
  region: 'us-east-1'
});


videoQueue.process(function(job, done) {

  var params = {
    Bucket: targetS3Bucket
  };

  // console.log("job data received is "+job.data.bucketObjects);

  copyObjectToDestinationBucket(params,job.data.bucketObjects);



  if (s3CopyFlag) {

    // send update to database

    // updateDatabase()

    // mark job comletion after object has been copied

    // console.log(job.data.bucketObjects + " DONE");

    done();

    if (dbUpdateFlag) {

      // all processes completed

      // updateDatabase()

    }

  }

  // done();

  // console.log(job.data.bucketObjects + " now migrated");

}).catch(error => console.log(error.message));


function copyObjectToDestinationBucket(params,sourceObject) {

  try {

    params.CopySource = "/" + sourceS3Bucket + "/" + sourceObject;

    var sourceObjectSplit = sourceObject.split('/');

    // params.Key = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    params.Key = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    // console.log("this is the key value before copy " + params.Key)

    s3.copyObject(params, function(err, data) {

      if (err) {
        console.log(err, err.stack); // an error occurred
      } else {
        // successful response
        s3CopyFlag = true;
        // console.log(data);
      }
    });
  } catch (e) {

    console.log("caught exception " + e);

  }
}
