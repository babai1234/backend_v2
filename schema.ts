type MusicResponse = {
	id: string;
	title: string;
	artist: string;
	duration: number; // in seconds
	poster: string; // URL to the poster image
	noOfPostUse: number; // number of times the music has been used
	isSaved: boolean; // whether the music is saved by the user
	mostUsedSection?: {
		from: number; // start time in seconds
		to: number; // end time in seconds
	};
	audioUrl: string; // URL to the music file
	downloadUrl: string; // URL to download the music file
	isOriginal: boolean; // whether the music is original or not
};
