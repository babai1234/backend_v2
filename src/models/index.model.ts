import { MongoClient, MongoClientOptions } from "mongodb";
import path from "node:path";
import { createSecureContext } from "node:tls";
import fs from "node:fs";
import { Account, AccountBlock, AccountFollow } from "../types/collection/account.type";
import {
	TrendingAudio,
	MusicAudio,
	NewAudio,
	OriginalAudio,
	AudioSave,
	AudioUse,
} from "../types/collection/audio.type";
import { ClipPost, Comment, MomentPost, PhotoPost } from "../types/collection/post.type";
import {
	ChatMessage,
	GroupChat,
	GroupMessage,
	OneToOneChat,
} from "../types/collection/chat.type";
import { HashTag } from "../types/collection/hashtag.type";
import { HighLight, Memory } from "../types/collection/memory.type";
import { Location } from "../types/collection/location.type";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";
import { app } from "firebase-admin";

// const database_username = "";

// const database_password = "";

// const connection_string = `mongodb+srv://${database_username}:${database_password}@test-cluster-1.g7jcj9i.mongodb.net/appdatabase-dev`;

const connection_string =
	"mongodb+srv://cluster0.ssap4qe.mongodb.net/?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&w=majority&appName=Cluster0";

const certPath = path.join(__dirname, "../../X509-cert-4683232581442136754.pem");
if (!fs.existsSync(certPath)) {
	throw new AppError("Something went wrong", HttpStatusCodes.INTERNAL_SERVER_ERROR);
}

const secureContext = createSecureContext({
	cert: fs.readFileSync(certPath),
	key: fs.readFileSync(certPath),
});

const options = { tls: true, secureContext: secureContext } as MongoClientOptions;

export const databaseClient = new MongoClient(connection_string, options);

export async function initDB() {
	try {
		await databaseClient.connect();
		console.log(
			await databaseClient
				.db("myDB")
				.command({ ping: 1 })
				.then(() => "Database connected successfully")
		);
	} catch (error) {
		console.error("Database connection error:", error);
		throw new AppError("Something went wrong", HttpStatusCodes.INTERNAL_SERVER_ERROR);
	}
}

const appDatabase = databaseClient.db("myDB");

export const accountCollection = appDatabase.collection<Account>("account");

export const accountFollowCollection =
	appDatabase.collection<AccountFollow>("account_follow");

export const originalAudioCollection =
	appDatabase.collection<OriginalAudio>("original_audio");

export const musicAudioCollection = appDatabase.collection<MusicAudio>("music_audio");

export const audioNewCollection = appDatabase.collection<NewAudio>("new_audio");

export const audioTrendingCollection =
	appDatabase.collection<TrendingAudio>("trending_audio");

export const audioSaveCollection = appDatabase.collection<AudioSave>("audio_save");

export const audioUseCollection = appDatabase.collection<AudioUse>("audio_use");

export const clipCollection = appDatabase.collection<ClipPost>("clip");

export const clipCommentCollection = appDatabase.collection<Comment>("clip_comment");

export const groupChatCollection = appDatabase.collection<GroupChat>("group_chat");

export const groupMessageCollection =
	appDatabase.collection<GroupMessage>("group_message");

export const hashTagCollection = appDatabase.collection<HashTag>("hashtag");

export const highlightCollection = appDatabase.collection<HighLight>("highlight");

export const memoryCollection = appDatabase.collection<Memory>("memory");

export const momentCommentCollection = appDatabase.collection<Comment>("moment_comment");

export const momentCollection = appDatabase.collection<MomentPost>("moment");

export const oneToOneChatCollection =
	appDatabase.collection<OneToOneChat>("one_to_one_chat");

export const oneToOneMessageCollection =
	appDatabase.collection<ChatMessage>("one_to_one_message");

export const photoCollection = appDatabase.collection<PhotoPost>("photo");

export const photoCommentCollection = appDatabase.collection<Comment>("photo_comment");

export const accountBlockCollection =
	appDatabase.collection<AccountBlock>("account_block");

export const locationCollection = appDatabase.collection<Location>("location");
