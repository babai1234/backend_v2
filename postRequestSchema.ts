interface PhotoPostMetaData {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	usedAudio?: {
		audioId: string;
		usedSection: [number, number];
	};
	taggedAccounts?: {
		account: string;
		position: {
			index: number;
			coord: {
				x: number;
				y: number;
			};
		}[];
	}[];
	topics?: string[];
	photos: Photo[];
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
}

type Photo = {
	width: number;
	height: number;
	fileSize: number;
};

interface MomentPostMetaData {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	usedAudioId?: {
		audioId: string;
		usedSection: [number, number];
	};
	taggedAccounts?: string[];
	topics?: string[];
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
	video: VideoMetaData;
	videoCategory?: string;
}
type VideoMetaData = {
	duration: number;
	size: number;
	width: number;
	height: number;
	isMute: boolean;
};

interface ClipPostMetaData {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	taggedAccounts?: string[];
	topics?: string[];
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
	video: VideoMetaData;
	videoCategory?: string;
}
/*	Photo
    1. Check if the number of photos uploaded doesnot exceed 10 photos.
    2. Check if each file is more than 240 kb and less than 5 mb.
    3. Check if the extension is jpeg or jpg.
    4. Check if the aspect-ratio of each is 9:16.
    5. Check if the caption if present can have atmost 400 characters and cannot contain only spaces
    6. Check if the location id exists in the open street map api and if the location id exists then return the relevent details
       like full address and coordinates of that location.
    7. Check if the audio id existence of the audio and the the start and end time exists within the duration, if not return an error
    8. Check all the mentions in the caption if they exists or not if the account document exists check if public mention is enabled or
       if the mentioned accounts are followed by the user
    9. Check if the accounts that have been tagged, the user has the authority to tag those accounts based on blocking relationship,
       or following relationship based on privacy settings of the tagged users.
    10. 
    NOTE: If the resolution is more than fullHd it will be converted to a fullHd
*/

/*	Moment
    1. Check if each file is more than 5Mb and less than 25 mb.
    2. Check if the extension is mp4.
    3. Check if the aspect-ratio of each is 9:16.
	4. Check if video-codec h264 or h265 and the audio codec will be aac
    5. Check if the caption if present can have atmost 400 characters and cannot contain only spaces
    6. Check if the location id exists in the open street map api and if the location id exists then return the relevent details
       like full address and coordinates of that location.
    7. Check if the audio id existence of the audio and the start and end time exists within the duration, if not return an error
    8. Check all the mentions in the caption if they exists or not if the account document exists check if public mention is enabled or
       if the mentioned accounts are followed by the user
    9. Check if the accounts that have been tagged, the user has the authority to tag those accounts based on blocking relationship,
       or following relationship based on privacy settings of the tagged users.
    10. 
    NOTE: If the resolution is more than fullHd it will be converted to a fullHd
	NOTE: The video codec will be transcoded to vp9 and fmp4 format
*/

/*	Clip
    1. Check if each file is more than 5Mb and less than 25 mb.
    2. Check if the extension is mp4.
    3. Check if the aspect-ratio of video is 9:16 or 16:9 or 4:3 or 3:4 or 1:1.
	4. Check if video-codec h264 or h265 and the audio codec will be aac
    5. Check if the caption if present can have atmost 400 characters and cannot contain only spaces
    6. Check if the location id exists in the open street map api and if the location id exists then return the relevent details
       like full address and coordinates of that location.
    7. Check if the audio id existence of the audio and the the start and end time exists within the duration, if not return an error
    8. Check all the mentions in the caption if they exists or not if the account document exists check if public mention is enabled or
       if the mentioned accounts are followed by the user
    9. Check if the accounts that have been tagged, the user has the authority to tag those accounts based on blocking relationship,
       or following relationship based on privacy settings of the tagged users.
    10. 
    NOTE: If the resolution is more than fullHd it will be converted to a fullHd
*/

/* Video Processing
	1. All the file and post meta-data is sent to the server, using the multipart form-data
	2. File data is sent to the s3 bucket(remote url is pre-configured).
	3. AWS Lambda function is triggered by the server with the post meta-data and remote file url and also the account topic of the
	   client.
	4. After invoking the lambda request-response cycle is closed.
	5. Lambda needs to complete the following task:
		- Create a output.mp4 file which will be a transcoded version of the original file itself.
		- Create all the playlist and segment file from the input file for streaming purpose.
		- Create the post document in the post collection with the given metadata and the file url.
		- Inform the client that the post has been uploaded and send the post document as the payload of the message.
	
	NOTE: All the updates related to post upload will be done under a single transaction operation.
*/
