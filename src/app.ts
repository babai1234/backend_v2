import express from "express";
import indexRouter from "./route/index.route";
import { databaseClient, initDB } from "./models/index.model";
import errorHandler from "./middleware/error.middleware";
import "dotenv/config";
import { initMediaConvert } from "./utils/functions";
import { initS3Client } from "./utils/s3Client";

const app = express();
// Initialize the database
(async () => {
	try {
		await initDB();
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
// Intialize the AWS S3 client
initS3Client();
initMediaConvert();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(indexRouter);
// app.use(exampleHandler);
app.use(errorHandler);

app.listen("3000", () => {
	console.log("App started at http://localhost:3000");
});

process.on("SIGINT", async () => {
	console.log("Shutting down gracefully...");
	await databaseClient.close();
	process.exit(0);
});
