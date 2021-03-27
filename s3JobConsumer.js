const mariadb = require('mariadb');
const Queue = require('bull');
const util = require('util')
const AWS = require('aws-sdk');
var timediff = require('timediff');

s3 = new AWS.S3({
  region: 'us-east-1'
});

const targetS3Bucket = "newproductionbucket77";
const sourceS3Bucket = "legacybucket77";
const targetObjectPrefix = "avatar/";

var connectionLimit = 10;

var stageTableforMerge = "stageTableforMerge";

var pushBucket = [];

var tempObjectList = [];

const dbConfig = {
  host: "34.229.161.96",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: connectionLimit,
  waitForConnections: true, // Default value.
  queueLimit: 0 // Unlimited - default value.
};



const redisHost = "34.229.161.96";
const redisPort = 6379;

var startDateTime = new Date();

var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

var redisParamOffline = {
  port: redisPort,
  host: redisHost,
}

const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});

const objectQueueChecker = new Queue('objectQueue', {
  redis: redisParamOffline
});

const s3CopyObject = (params) => {
  return new Promise((resolve, reject) => {
    s3.copyObject(params, (err, data) => {
      if (err) {
        console.log("error occured =>" + err.message);
        // return reject(err);
        // throw err;
        reject(err);
      } else {
        resolve(data);
      }

    });
  });
}

var pool = mariadb.createPool(dbConfig);



objectQueue.process(function(job, done) {

  pool = mariadb.createPool(dbConfig);

  startDateTime = new Date();

  var params = {
    Bucket: targetS3Bucket
  };

  if(job.data == "migrationcompleted"){
    job.retry()
    objectQueue.close();
    pool.end();
    done();
    process.exit();
  }

  // console.log("before map = " + job.data.bucketObjects);

  var promiseAll = job.data.bucketObjects.map(eachSourceObjectList => copyObjectToDestinationBucket(params, eachSourceObjectList));

  // console.log("after map = ");
  // console.log("promise all value "+promiseAll);

  Promise.allSettled(promiseAll).then(function() {

    console.log("All objects pushed to destination bucket");

    // objectQueue.close();

    batchQuery = "INSERT INTO " + stageTableforMerge + " (OldImageName,NewImageName) values (?, ?)";

    if (pushBucket.length > 0) {

      processBatchQuery(batchQuery, pushBucket);

    } else {
      // console.log("pushBucket list is empty");
      pool.end();
    }

    done();

  });

}).catch(error => console.log("Error occured, have a look " + error.message));

objectQueueChecker.on('drained', function() {
  // Emitted every time the queue has processed all the waiting jobs (even if there can be some delayed jobs not yet processed)

  console.log("All jobs in the queue have now been completed.");

});

async function copyObjectToDestinationBucket(params, eachSourceObjectList) {

  sourceObject = eachSourceObjectList.oldImagePath;

  params = {
    Bucket: targetS3Bucket
  };

  params.CopySource = "/" + sourceS3Bucket + "/" + sourceObject;


  var sourceObjectSplit = sourceObject.split('/');

  params.Key = targetObjectPrefix + sourceObjectSplit[sourceObjectSplit.length - 1];

  return s3CopyObject(params).then(function(res) {

    tempObjectList = [];

    tempObjectList.push(eachSourceObjectList.oldImagePath);
    tempObjectList.push(eachSourceObjectList.newImagePath);

    pushBucket.push(tempObjectList);
  }).catch(function(err) {

    console.log("Error occured during s3 bucket upload " + err);

  });

}

async function processBatchQuery(batchQuery, bulkList) {

  console.log("now attempting to send query");

  var res = await pool.batch(batchQuery, bulkList).catch(err => {

    //console.log("Batch insert failed, error = " + err.code);  //ER_GET_CONNECTION_TIMEOUT

    if (err.code == "ER_GET_CONNECTION_TIMEOUT" || err.code == "ER_CONNECTION_TIMEOUT") {

      console.log("now retrying");

      return processBatchQuery(batchQuery, bulkList);

    } else {
      console.log("error has occured in reconnect and will not retry, please see details " + err.code + " // " + err.message)

      return err;
    }
  });

  console.log("Batch insert successful, records affected = " + res.affectedRows);

  var endDateTime = new Date();

  var expended = timediff(startDateTime, endDateTime, 'YDHmS');

  console.log("process expended: " + expended.hours + ":" + expended.minutes + ":" + expended.seconds);

  pool.end();

}
