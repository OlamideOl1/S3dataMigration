const mariadb = require('mariadb');
const Queue = require('bull');
const AWS = require('aws-sdk');

s3 = new AWS.S3({
  region: 'us-east-1'
});

// process.env.NODE_ENV
// var lag = GetEnvironmentVar("NODE_ENV","dev");
const targetS3Bucket = "newproductionbucket77";
const sourceS3Bucket = "legacybucket77";
const targetObjectPrefix = "avatar/";
var connectionLimit = 10;
var stageTableforUpdate = "stageTableforUpdate";

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

var redisParam = {
  port: redisPort,
  host: redisHost,
  enableOfflineQueue: false
}

const objectQueue = new Queue('objectQueue', {
  redis: redisParam
});
const objectQueueSecondary = new Queue('objectQueue', {
  redis: redisParam
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

objectQueue.process(function(job, done) {

  var pool = mariadb.createPool(dbConfig);
  pushBucket = [];
  startDateTime = new Date();
  var params = {
    Bucket: targetS3Bucket
  };

  if (job.data.bucketObjects == "migrationcompleted") {
    console.log("migration is completed, will end gracefully.")
    objectQueue.close();
    pool.end();
    done();
    objectQueueSecondary.add({
        bucketObjects: "migrationcompleted"
      }).then(res => {
        console.log("migrationcompleted indicator sent successfully");
        objectQueueSecondary.close();
      })
      .catch(error => {
        console.log("add to queue failed see error = " + error.message);
      });
  }

  var promiseAll = job.data.bucketObjects.map(eachSourceObjectList => copyObjectToDestinationBucket(params, eachSourceObjectList));

  Promise.allSettled(promiseAll).then(function() {

    console.log("All objects pushed to destination bucket");
    batchQuery = "INSERT INTO " + stageTableforUpdate + " (OldImageName,NewImageName) values (?, ?)";

    if (pushBucket.length > 0) {
      processBatchQuery(batchQuery, pushBucket).then(function(res) {
        done();
        pool.end();
      });
    } else {
      pool.end();
      done();
    }
  });
}).catch(error => console.log("Error occured, have a look " + error.message));


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

    if (err.code == "ER_GET_CONNECTION_TIMEOUT" || err.code == "ER_CONNECTION_TIMEOUT") {
      console.log("now retrying");
      return processBatchQuery(batchQuery, bulkList);
    } else {
      console.log("error has occured in reconnect and will not retry, please see details " + err.code + " // " + err.message)
      return err;
    }
  });

  if (res) {
    console.log("Batch insert successful, records affected = " + res.affectedRows);
    return res;
  }
}

function GetEnvironmentVar(varname, defaultvalue)
{
    var result = process.env[varname];
    if(result!=undefined)
        return result;
    else
        return defaultvalue;
}
