# All values except AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be provided.
# Key details are only necessary for local / docker-compose deployment option.

# Repository name for s3jobproducer image in ECR.  Example: "s3jobproducer"
ECR_S3_JOB_PRODUCER_REPOSITORY_NAME="s3jobproducer"
# Repository name for s3jobconsumer image in ECR.   Example: "s3jobconsumer"
ECR_S3_JOB_CONSUMER_REPOSITORY_NAME="s3jobconsumer"
# Name of target / destinaton bucket to migrate objects from.   Example: "newproductionbucket"
TARGET_S3_BUCKET="newproductionbucket77"
# Name of source / legacy bucket to migrate objects to.   Example: "legacybucket"
SOURCE_S3_BUCKET="legacybucket77"
# Image prefix (folder) in legacy bucket to migrate.    Example: "image"
LEGACY_S3_OBJECT_PREFIX="image"
# Image prefix to be used in target bucket.    Example: "avatar/"
TARGET_OBJECT_PREFIX="avatar/"
# A temporary table to be used for this migration. Should be a table name does not already exist. A default value has been provided.
TEMP_TABLE_FOR_UPDATE="tempTableforUpdate"
# Database host detail.     Example: "54.55.44.33"
DATABASE_HOST="54.152.26.74"
# Database user to be used for migration operation.     Example: "root"
DB_USER="root"
# Password for database user for migration operation.     Example: "123456"
DB_PASSWORD="Ab@123456"
# Name of database for migration operation.     Example: "ImageDataDatabase"
DATABASE_NAME="userImageData"
# Name of Table in database that contains the image prefixes to be updated.     Example: "ImageDataTable"
DATABASE_TABLE_TO_UPDATE="ImageData"
# Name of Column in the provided database table contains the image prefixes to be updated.     Example: "ImagePath"
TABLE_COLUMN_NAME_TO_UPDATE="Imagepath"
# Default AWS Region to use for migration. A default value has been provided.
AWS_REGION="us-east-1"
# Number of tasks to be started by the consumer service. A default value of 1 has been provided.
CONSUMER_TASK_COUNT = 1
