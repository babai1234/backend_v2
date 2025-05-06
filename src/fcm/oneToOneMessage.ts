import { FCMMessaging, getMessaging } from "./messaging";

export async function sendMessageToTopic(message: FCMMessaging): Promise<void> {
	try {
		await getMessaging().send(message);
	} catch (error) {
		throw new Error();
	}
}
