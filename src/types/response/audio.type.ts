import { Photo } from "../util.type";
import { AccountResponseParams } from "./account.type";

export type AudioAttachmentResponseParams = {
	id: string;
	type: "original" | "music";
	noOfMomentUse: number;
	associatedAccountInfo?: AccountResponseParams;
	title?: string;
	artist?: string;
	poster?: Photo;
};

export type FullMusicApiResponseParams = {
	success: boolean;
	data: {
		total: number;
		start: number;
		results: MusicApiResponseResult[];
	};
};

export type MusicApiResponseResult = {
	id: string;
	name: string;
	type: string;
	year: string | null;
	releaseDate: string | null;
	duration: number; // in seconds
	label: string;
	explicitContent: boolean;
	playCount: number;
	language: string;
	hasLyrics: boolean;
	lyricsId: string | null;
	url: string;
	copyright: null;
	album: {
		id: string | null;
		name: string | null;
		url: string | null;
	};
	artists: {
		primary: {
			id: string;
			name: string;
			role: string;
			type: string;
			image: [
				{
					quality: string;
					url: string;
				}
			];
			url: string;
		}[];
		featured: {
			id: string;
			name: string;
			role: string;
			type: string;
			image: [
				{
					quality: string;
					url: string;
				}
			];
			url: string;
		}[];
		all: {
			id: string;
			name: string;
			role: string;
			type: string;
			image: {
				quality: string;
				url: string;
			}[];
			url: string;
		}[];
	};
	image: {
		quality: string;
		url: string;
	}[];
	downloadUrl: {
		quality: string;
		url: string;
	}[];
};

export type MusicAudioResponseParams = {
	id: string;
	title: string;
	artists: string;
	duration: number; // in seconds
	poster: Photo; // URL to the poster image
	noOfMomentUse: number; // number of times the music has been used
	isSaved: boolean; // whether the music is saved by the user
	mostUsedSection?: {
		from: number; // start time in seconds
		to: number; // end time in seconds
	};
	audioUrl: string; // URL to the music file
};

export type SavedAudioResponseParams = {
	id: string;
	type: "original" | "music";
	noOfMomentUse: number;
	isSaved: boolean;
	audioUrl: string;
	duration?: number;
	associatedAccountInfo?: AccountResponseParams;
	title?: string;
	artist?: string;
	poster?: Photo;
};
