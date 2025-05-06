import { Photo } from "../util.type";
import { AccountResponseParams } from "./account.type";

export type AudioResponseParams = {
	id: string;
	type: "original" | "song";
	uploadedBy: "admin" | "user";
	noOfMomentUse: number;
	isSaved: boolean;
	isDeleted: boolean;
	isAvailable: boolean;
	url?: string;
	duration?: number;
	createdAt?: string;
	associatedAccountInfo?: AccountResponseParams;
	title?: string;
	artist?: string;
	poster?: Photo;
	preview?: {
		url: string;
		start: number;
		end: number;
	};
};

export type AudioAttachmentResponseParams = {
	id: string;
	type: "original" | "song";
	uploadedBy: "admin" | "user";
	noOfMomentUse: number;
	associatedAccountInfo?: AccountResponseParams;
	title?: string;
	artist?: string;
	poster?: Photo;
};
