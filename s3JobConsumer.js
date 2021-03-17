const mariadb = require('mariadb');
const Queue = require('bull');
const util = require('util')
const AWS = require('aws-sdk');

s3 = new AWS.S3({
  region: 'us-east-1'
});

const targetS3Bucket = "newproductionbucket77";
const sourceS3Bucket = "legacybucket77"
const targetObjectPrefix = "avatar/"
const dbConfig = {
  host: "100.25.102.220",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: connectionLimit,
  waitForConnections: true, // Default value.
  queueLimit: 0 // Unlimited - default value.
};

const redisHost = "100.25.102.220";
const redisPort = 6379;

var redisParam = {
  port: redisPort,
  host: redisHost
}

var redisParamOffline = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});

const objectQueueChecker = new Queue('objectQueue', {
  redis: redisParamOffline
});

objectQueueChecker.count().then(res => {

  if (!res) {

    console.log('objectQueue count is empty :\n');

    console.log('No jobs are pending processing:\n');

  }

  objectQueueChecker.close();

}).catch(err => {

  console.log('Redis server is not running, review it is available on: ' + redisHost + " : " + redisPort);

  objectQueueChecker.close();

  process.exit();

});

const s3CopyObject = util.promisify(s3.copyObject);

videoQueue.process(function(job, done) {

  var params = {
    Bucket: targetS3Bucket
  };

  var promiseAll = job.data.bucketObjects.map(eachSourceObject => copyObjectToDestinationBucket(params, eachObjectlist));

  Promise.allSettled(promiseAll).then(function() {

    console.log("All objects pushed to destination bucket");

  });

}).catch(error => console.log(error.message));

objectQueueChecker.on('drained', function() {
  // Emitted every time the queue has processed all the waiting jobs (even if there can be some delayed jobs not yet processed)

  console.log("All jobs in the queue have now been completed.");

});


async function copyObjectToDestinationBucket(params, sourceObject) {

  try {

    params.CopySource = "/" + sourceS3Bucket + "/" + sourceObject;

    var sourceObjectSplit = sourceObject.split('/');

    params.Key = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

    var s3Response = await s3CopyObject(params).catch(err => {

      console.log("Error occured during s3 bucket upload " + err);

      return err;

    });

    return s3Response;

  } catch (e) {

    console.log("caught exception " + err);

    return err;

  }

}
