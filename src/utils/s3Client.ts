import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

export var s3Client: S3Client;

export const initS3Client = () => {
	const config: S3ClientConfig = {
		region: process.env.AWS_S3_BUCKET_REGION,
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
		},
	};
	s3Client = new S3Client(config);
};
