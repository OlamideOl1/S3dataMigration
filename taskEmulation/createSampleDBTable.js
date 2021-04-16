// This is a program to Create a sample table to mimicking the production table in the provided task
// This program will also upload sample legacy image paths to the table


//number of sample images to upload
var numberOfObjectsToUpload = 100;

const mariadb = require('mariadb');

let pool;

try {
  pool = mariadb.createPool({
    host: process.env.dbHost,
    user: process.env.dbUser,
    password: process.env.password,
    database: process.env.database,
    connectionLimit: 10
  });
  pool.query("SELECT 1").catch(err => {
    console.log("Connection to database failed, please review database connection details.");
    process.exit(1);
  });
} catch (err) {
  console.log("error occured => " + err.message);
  process.exit(1);
}

// Name of sample table to use
var tableName = "ImageData";

// Name of column in sample table to use
var tableColumnName = "Imagepath";

var pushList = [];

for (var i = 0; i < numberOfObjectsToUpload; i++) {
  pushList.push("image/avatar" + i + ".jpg");
}

var objectUpdateQuery = "INSERT INTO " + tableName + "(" + tableColumnName + ") VALUES (?)";

pool.query("CREATE TABLE IF NOT EXISTS " + tableName + " (ID int NOT NULL AUTO_INCREMENT , " + tableColumnName + " VARCHAR(255) , PRIMARY KEY (ID))")
  .then(res => {
    // Bulk insert objects to sample table
    return pool.batch(objectUpdateQuery, pushList);
  })
  .then(res => {
    console.log("completed");
    pool.end();
  })
  .catch(err => console.log("error occured " + err.message))
