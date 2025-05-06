export type HashTag = {
	name: string;
	createdAt: Date;
	meta: {
		noOfPostUse: number;
		noOfMemoryUse: number;
		noOfBioUse: number;
	};
};
