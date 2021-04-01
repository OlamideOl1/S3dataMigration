# All values except AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be provided.
# Key details are only necessary for local / docker-compose deployment option.

# Repository name for s3jobproducer image in ECR.  Example: "s3jobproducer"
ECR_S3_JOB_PRODUCER_REPOSITORY_NAME=""
# Repository name for s3jobconsumer image in ECR.   Example: "s3jobconsumer"
ECR_S3_JOB_CONSUMER_REPOSITORY_NAME=""
# Name of target / destinaton bucket to migrate objects from.   Example: "newproductionbucket"
TARGET_S3_BUCKET=""
# Name of source / legacy bucket to migrate objects to.   Example: "legacybucket"
SOURCE_S3_BUCKET=""
# Image prefix (folder) in legacy bucket to migrate.    Example: "image"
LEGACY_S3_OBJECT_PREFIX=""
# Image prefix to be used in target bucket.    Example: "avatar/"
TARGET_OBJECT_PREFIX=""
# A temporary table to be used for this migration. Should be a table name does not already exist. A default value has been provided.
TEMP_TABLE_FOR_UPDATE=""
# Database host detail.     Example: "54.55.44.33"
DATABASE_HOST=""
# Database user to be used for migration operation.     Example: "root"
DB_USER=""
# Password for database user for migration operation.     Example: "Ab@123456"
DB_PASSWORD=""
# Name of database for migration operation.     Example: "ImageDataDatabase"
DATABASE_NAME=""
# Name of Table in database that contains the image prefixes to be updated.     Example: "ImageDataTable"
DATABASE_TABLE_TO_UPDATE=""
# Name of Column in the provided database table contains the image prefixes to be updated.     Example: "ImagePath"
TABLE_COLUMN_NAME_TO_UPDATE=""
# Default AWS Region to use for migration. A default value has been provided.
AWS_REGION=""

# Please Note!
# The AWS Access key details below should only be provided when using the local / docker-compse deployment option.
# for ECS deployment option, do not specify these details, neccessary roles are provided in terraform template
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
