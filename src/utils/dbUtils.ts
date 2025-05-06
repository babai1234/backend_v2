import {
	ClientSession,
	MongoClient,
	MongoError,
	ObjectId,
	TransactionOptions,
	WithId,
} from "mongodb";
import {
	Account,
	AccountBlock,
	AccountContacts,
	AccountFollow,
} from "../types/collection/account.type";
import {
	ChatMessage,
	GroupChat,
	GroupMessage,
	OneToOneChat,
} from "../types/collection/chat.type";
import { AccountAttachmentResponseParams } from "../types/response/account.type";
// import { appDatabase } from "../models/index.model";
import {
	ClipPostResponseParams,
	MomentPostResponseParams,
	PhotoPostResponseParams,
} from "../types/response/post.type";
import { MessageResponseParams } from "../types/response/chat.type";
import { AudioAttachmentResponseParams } from "../types/response/audio.type";
import { Audio } from "../types/collection/audio.type";
import { ClipPost, MomentPost, PhotoPost } from "../types/collection/post.type";
import {
	HighlightAttachmentResponseParams,
	HighlightMemoryResponseParams,
	MemoryAttachmentResponseParams,
	MemoryResponseParams,
} from "../types/response/memory.type";
import { Memory } from "../types/collection/memory.type";
import { LocationData } from "../types/util.type";
import { Location } from "../types/collection/location.type";
import { delay, isTransientError } from "./functions";
import {
	accountBlockCollection,
	accountCollection,
	accountFollowCollection,
	audioCollection,
	clipCollection,
	groupChatCollection,
	groupMessageCollection,
	memoryCollection,
	momentCollection,
	oneToOneChatCollection,
	oneToOneMessageCollection,
	photoCollection,
} from "../models/index.model";

/**
 * Checks if there is a block relationship between two accounts.
 * This checks if either the user has blocked the client or the client has blocked the user.
 * @param {string} userAccountId - The ID of the user account to check for a block relationship.
 * @param {string} clientAccountId - The ID of the client account to check for a block relationship.
 * @returns {Promise<WithId<AccountBlock>[] | null>} A promise that resolves to an array of block information if a block exists, or null if no block is found.
 */

export async function isAccountBlocked(
	userAccountId: string,
	clientAccountId: string
): Promise<WithId<AccountBlock>[] | null> {
	try {
		let blockInfo = await accountBlockCollection
			.find({
				$or: [
					{
						accountId: new ObjectId(userAccountId),
						blockedBy: new ObjectId(clientAccountId),
					},
					{
						accountId: new ObjectId(clientAccountId),
						blockedBy: new ObjectId(userAccountId),
					},
				],
			})
			.toArray();

		return blockInfo.length ? blockInfo : null;
	} catch (error) {
		throw error;
	}
}

/**
 * Checks if a one-to-one chat is available between two accounts.
 * @param {string} userAccountId - The ID of the user account to check for participation in the chat.
 * @param {string} clientAccountId - The ID of the client account to check for participation in the chat.
 * @returns {Promise<WithId<OneToOneChat> | null>} A promise that resolves to the one-to-one chat information if both accounts are participants, or null if not.
 */

export async function isOneToOneChatAvailable(
	userAccountId: string,
	clientAccountId: string
): Promise<WithId<OneToOneChat> | null> {
	try {
		const chatInfo = await oneToOneChatCollection.findOne({
			$and: [
				{
					participants: {
						$elemMatch: { accountId: new ObjectId(userAccountId) },
					},
				},
				{
					participants: {
						$elemMatch: { accountId: new ObjectId(clientAccountId) },
					},
				},
			],
		});
		return chatInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Checks if a group chat is available to a given client account.
 * @param {string} chatId - The ID of the group chat to check availability for.
 * @param {string} clientAccountId - The ID of the client account to check for participation in the group chat.
 * @returns {Promise<WithId<GroupChat> | null>} A promise that resolves to the group chat information if the client is a participant, or null if not.
 */

export async function getGroupChatById(
	chatId: string,
	clientAccountId: string
): Promise<WithId<GroupChat> | null> {
	try {
		const chatInfo = await groupChatCollection.findOne({
			_id: new ObjectId(chatId),
			participants: {
				$elemMatch: { accountId: new ObjectId(clientAccountId) },
			},
		});

		return chatInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Checks if a given account is followed by another account.
 * @param {string} userAccountId - The ID of the account to check if it is followed.
 * @param {string} clientAccountId - The ID of the account that might be following the user account.
 * @returns {Promise<WithId<AccountFollow> | null>} A promise that resolves to the account follow information if the user is followed by the client, or null if not.
 */

export async function isAccountFollower(
	userAccountId: string,
	clientAccountId: string
): Promise<WithId<AccountFollow> | null> {
	try {
		const followingInfo = await accountFollowCollection.findOne({
			accountId: new ObjectId(userAccountId),
			followedBy: new ObjectId(clientAccountId),
		});
		return followingInfo;
	} catch (error) {
		throw error;
	}
}

export async function getAccountContacts(
	userAccountId: string,
	clientAccountId: string
): Promise<WithId<AccountContacts> | null> {
	try {
		return {} as WithId<AccountContacts>;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a photo post.
 * @param {string} postId - The ID of the photo post to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the photo post details.
 * @returns {Promise<PhotoPostResponseParams | null>} A promise that resolves to the photo post response parameters if found, or null if the post does not exist.
 */

export async function getPhotoPostResponse(
	postId: string,
	clientAccountId: string
): Promise<PhotoPostResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(postId),
				isDeleted: false,
			},
		},
		{
			$lookup: {
				from: "photoPostLike",
				let: { photoPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$photoPostId"],
									},
									{
										$eq: ["$likedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postLikeInfo",
			},
		},
		{
			$lookup: {
				from: "photoPostLike",
				let: { photoPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$postId", "$$photoPostId"],
							},
						},
					},
					{
						$lookup: {
							from: "account",
							let: { userAccountId: "$likedBy" },
							pipeline: [
								{
									$match: {
										$expr: {
											$eq: ["$_id", "$$userAccountId"],
										},
									},
								},
								{
									$lookup: {
										from: "accountFollow",
										pipeline: [
											{
												$match: {
													$expr: {
														$and: [
															{
																$eq: [
																	"$accountId",
																	"$$userAccountId",
																],
															},
															{
																$eq: [
																	"$followedBy",
																	new ObjectId(
																		clientAccountId
																	),
																],
															},
															{
																$eq: [
																	"isRequested",
																	false,
																],
															},
														],
													},
												},
											},
										],
										as: "accountFollowingInfo",
									},
								},
								{
									$project: {
										_id: 0,
										id: { $toString: "$_id" },
										userId: "$userId",
										profilePictureUri: "$profilePictureUri",
										isFollowed: {
											$cond: [
												{
													$eq: ["$accountFollowingInfo", []],
												},
												false,
												true,
											],
										},
										isAvailable: {
											$cond: [
												{
													$and: [
														{
															$eq: ["$isDeleted", false],
														},
														{
															$eq: ["$isDisabled", false],
														},
													],
												},
												true,
												false,
											],
										},
									},
								},
								{
									$match: {
										isFollowed: true,
										isAvailable: true,
									},
								},
								{
									$limit: 3,
								},
							],
							as: "followedAccountInfo",
						},
					},
					{
						$unwind: {
							path: "$followedAcountInfo",
							preserveNullAndEmptyArrays: true,
						},
					},
					{
						$project: {
							_id: 0,
							id: "$followedAcountInfo.id",
							userId: "$followedAcountInfo.userId",
							profilePictureUri: "$followedAcountInfo.profilePictureUri",
							isFollowed: "$followedAcountInfo.isFollowed",
							isAvailable: "$followedAcountInfo.isAvailable",
						},
					},
				],
				as: "mutualLikeInfo",
			},
		},
		{
			$lookup: {
				from: "photoPostView",
				let: { photoPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$photoPostId"],
									},
									{
										$eq: ["$viewedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postViewInfo",
			},
		},
		{
			$lookup: {
				from: "photoPostSave",
				let: { photoPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$photoPostId"],
									},
									{
										$eq: ["$savedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postSaveInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$author" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$userAccountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$lookup: {
							from: "memory",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: ["$author", "$$userAccountId"],
												},
												{
													$gt: ["$expiredAt", "$$NOW"],
												},
											],
										},
									},
								},
								{
									$lookup: {
										from: "memoryView",
										let: { memoryId: "$_id" },
										pipeline: [
											{
												$match: {
													memoryId: "$$memoryId",
													viewedBy: new ObjectId(
														clientAccountId
													),
												},
											},
										],
										as: "memoryViewInfo",
									},
								},
								{
									$set: {
										isViewed: {
											$cond: [
												{
													$eq: ["$memoryViewInfo", []],
												},
												false,
												true,
											],
										},
									},
								},
								{
									$unset: "memoryViewInfo",
								},
							],
							as: "memoryInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							name: "$name",
							isFollowed: {
								$cond: [
									{
										$eq: ["$accountFollowingInfo", []],
									},
									false,
									true,
								],
							},
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$eq: ["$isPrivate", false],
													},
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
							"memoryInfo.noOfAvailableMemories": {
								$size: "$memoryInfo",
							},
							"memoryInfo.noOfUnseenMemories": {
								$size: {
									$filter: {
										input: "memoryInfo",
										as: "memory",
										cond: {
											"$$memory.isViewed": false,
										},
									},
								},
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$lookup: {
				from: "audio",
				let: {
					audioId: "$usedAudioInfo.id",
					usedSection: "$usedAudioInfo.usedSection",
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$audioId"],
									},
									{
										$eq: ["$isAvailable", true],
									},
									{
										$eq: ["$isDeleted", false],
									},
								],
							},
						},
					},
					{
						$project: {
							id: "$_id",
							uri: "$uri",
							usedSection: "$$usedSection",
							title: "$title",
						},
					},
				],
				as: "usedAudioInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { accountTags: "$taggedAccounts" },
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$accountTags.account.id"],
							},
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$accountId", "$$accountId"],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$accountId",
																"$$accountId",
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$project: {
							_id: 0,
							account: {
								id: "$_id",
								userId: "$userId",
								profilePictureUri: "$profilePictureUri",
								name: "$name",
								isBlocked: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountBlockInfo",
															as: "item",
															cond: {
																$and: [
																	{
																		$eq: [
																			"$$item.accountId",
																			"$userAccountId",
																		],
																	},
																	{
																		$eq: [
																			"$$item.blockedBy",
																			clientAccountId,
																		],
																	},
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
								isAvailable: {
									$cond: [
										{
											$and: [
												{
													$eq: ["$isDeleted", false],
												},
												{
													$eq: ["$isDeActivated", false],
												},
												{
													$lt: ["$supendedTill", new Date()],
												},
												{
													$eq: [
														{
															$size: {
																$filter: {
																	input: "$accountBlockInfo",
																	as: "item",
																	cond: {
																		$and: [
																			{
																				$eq: [
																					"$$item.accountId",
																					clientAccountId,
																				],
																			},
																			{
																				$eq: [
																					"$$item.blockedBy",
																					"$$userAccountId",
																				],
																			},
																		],
																	},
																},
															},
														},
														0,
													],
												},
											],
										},
										true,
										false,
									],
								},
								isFollowed: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountFollowingInfo",
															as: "item",
															cond: {
																$eq: [
																	"$$item.isRequested",
																	false,
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
								isRequestedToFollow: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountFollowingInfo",
															as: "item",
															cond: {
																$eq: [
																	"$$item.isRequested",
																	true,
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
							},
							position: {
								$arrayElemAt: [
									"$$accountTags.position",
									{
										$indexOfArray: [
											"$$accountTags.account.id",
											"$_id",
										],
									},
								],
							},
						},
					},
				],
				as: "taggedAccountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$unwind: {
				path: "$usedAudioInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"accountInfo.isAvailable": true,
				"accountInfo.isBlocked": false,
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				createdAt: { $toLong: "$createdAt" },
				caption: "$caption.text",
				taggedLocation: "$location",
				engagementSummary: "$engagementSummary",
				advancedSettings: "$advancedSettings",
				"metaData.href": "$postLink",
				"metaData.isLiked": {
					$cond: [
						{
							$eq: ["$postLikeInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isViewed": {
					$cond: [
						{
							$eq: ["$postViewInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isSaved": {
					$cond: [
						{
							$eq: ["$postSaveInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isPinned": "$isPinned",
				"metaData.mutualLikes": "$mutualLikeInfo",
				author: "$accountInfo",
				photos: "$photos",
				usedAudio: "$usedAudioInfo",
				taggedAccounts: "$taggedAccountInfo",
			},
		},
	];
	try {
		const postInfo = await photoCollection
			.aggregate<PhotoPostResponseParams>(pipeline)
			.next();
		return postInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a moment post.
 * @param {string} postId - The ID of the moment post to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the moment post details.
 * @returns {Promise<MomentPostResponseParams | null>} A promise that resolves to the moment post response parameters if found, or null if the post does not exist.
 */

export async function getMomentPostResponse(
	postId: string,
	clientAccountId: string
): Promise<MomentPostResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(postId),
				isDeleted: false,
			},
		},
		{
			$lookup: {
				from: "momentPostLike",
				let: { momentPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$momentPostId"],
									},
									{
										$eq: ["$likedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postLikeInfo",
			},
		},
		{
			$lookup: {
				from: "momentPostLike",
				let: { momentPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$postId", "$$momentPostId"],
							},
						},
					},
					{
						$lookup: {
							from: "account",
							let: { userAccountId: "$likedBy" },
							pipeline: [
								{
									$match: {
										$expr: {
											$eq: ["$_id", "$$userAccountId"],
										},
									},
								},
								{
									$lookup: {
										from: "accountFollow",
										pipeline: [
											{
												$match: {
													$expr: {
														$and: [
															{
																$eq: [
																	"$accountId",
																	"$$userAccountId",
																],
															},
															{
																$eq: [
																	"$followedBy",
																	new ObjectId(
																		clientAccountId
																	),
																],
															},
															{
																$eq: [
																	"isRequested",
																	false,
																],
															},
														],
													},
												},
											},
										],
										as: "accountFollowingInfo",
									},
								},
								{
									$project: {
										_id: 0,
										id: { $toString: "$_id" },
										userId: "$userId",
										profilePictureUri: "$profilePictureUri",
										isFollowed: {
											$cond: [
												{
													$eq: ["$accountFollowingInfo", []],
												},
												false,
												true,
											],
										},
										isAvailable: {
											$cond: [
												{
													$and: [
														{
															$eq: ["$isDeleted", false],
														},
														{
															$eq: ["$isDisabled", false],
														},
													],
												},
												true,
												false,
											],
										},
									},
								},
								{
									$match: {
										isFollowed: true,
										isAvailable: true,
									},
								},
								{
									$limit: 3,
								},
							],
							as: "followedAccountInfo",
						},
					},
					{
						$unwind: {
							path: "$followedAcountInfo",
							preserveNullAndEmptyArrays: true,
						},
					},
					{
						$project: {
							_id: 0,
							id: "$followedAcountInfo.id",
							userId: "$followedAcountInfo.userId",
							profilePictureUri: "$followedAcountInfo.profilePictureUri",
							isFollowed: "$followedAcountInfo.isFollowed",
							isAvailable: "$followedAcountInfo.isAvailable",
						},
					},
				],
				as: "mutualLikeInfo",
			},
		},
		{
			$lookup: {
				from: "momentPostView",
				let: { momentPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$momentPostId"],
									},
									{
										$eq: ["$viewedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postViewInfo",
			},
		},
		{
			$lookup: {
				from: "momentPostSave",
				let: { momentPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$momentPostId"],
									},
									{
										$eq: ["$savedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postSaveInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$author" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$userAccountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$lookup: {
							from: "memory",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: ["$author", "$$userAccountId"],
												},
												{
													$gt: ["$expiredAt", "$$NOW"],
												},
											],
										},
									},
								},
								{
									$lookup: {
										from: "memoryView",
										let: { memoryId: "$_id" },
										pipeline: [
											{
												$match: {
													memoryId: "$$memoryId",
													viewedBy: new ObjectId(
														clientAccountId
													),
												},
											},
										],
										as: "memoryViewInfo",
									},
								},
								{
									$set: {
										isViewed: {
											$cond: [
												{
													$eq: ["$memoryViewInfo", []],
												},
												false,
												true,
											],
										},
									},
								},
								{
									$unset: "memoryViewInfo",
								},
							],
							as: "memoryInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							name: "$name",
							isFollowed: {
								$cond: [
									{
										$eq: ["$accountFollowingInfo", []],
									},
									false,
									true,
								],
							},
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$eq: ["$isPrivate", false],
													},
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
							"memoryInfo.noOfAvailableMemories": {
								$size: "$memoryInfo",
							},
							"memoryInfo.noOfUnseenMemories": {
								$size: {
									$filter: {
										input: "memoryInfo",
										as: "memory",
										cond: {
											"$$memory.isViewed": false,
										},
									},
								},
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$lookup: {
				from: "audio",
				let: { audioId: "$audioInfo.id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$audioId"],
									},
									{
										$eq: ["$isAvailable", true],
									},
									{
										$eq: ["$isDeleted", false],
									},
								],
							},
						},
					},
					{
						$project: {
							id: "$_id",
							title: "$title",
						},
					},
				],
				as: "usedAudioInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { accountTags: "$taggedAccounts" },
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$accountTags.id"],
							},
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$accountId", "$$accountId"],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$accountId",
																"$$accountId",
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { $toString: "$_id" },
							userId: "$userId",
							profilePictureUri: "$profilePictureUri",
							name: "$name",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		clientAccountId,
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: ["$isDeleted", false],
											},
											{
												$eq: ["$isDeActivated", false],
											},
											{
												$lt: ["$supendedTill", new Date()],
											},
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				clientAccountId,
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
										],
									},
									true,
									false,
								],
							},
							isFollowed: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountFollowingInfo",
														as: "item",
														cond: {
															$eq: [
																"$$item.isRequested",
																false,
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isRequestedToFollow: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$followInfo",
														as: "item",
														cond: {
															$eq: [
																"$$item.isRequested",
																true,
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
						},
					},
				],
				as: "taggedAccountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$unwind: {
				path: "$usedAudioInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"accountInfo.isAvailable": true,
				"accountInfo.isBlocked": false,
			},
		},
		{
			$project: {
				_id: 0,
				id: { $tostring: "$_id" },
				createdAt: { $toLong: "$createdAt" },
				caption: "$caption.text",
				"taggedLocation.id": { $toString: "$locationInfo.id" },
				"taggedLocation.name": "$locationInfo.name",
				engagementSummary: "$engagementSummary",
				"engagementSummary.mutualLikes": "$mutualLikeInfo",
				advancedSettings: "$advancedSettings",
				"metaData.href": "$postLink",
				"metaData.isLiked": {
					$cond: [
						{
							$eq: ["$postLikeInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isViewed": {
					$cond: [
						{
							$eq: ["$postViewInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isSaved": {
					$cond: [
						{
							$eq: ["$postSaveInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isPinned": "$isPinned",
				author: "$accountInfo",
				video: "$video",
				usedAudio: "$usedAudioInfo",
				taggedAccounts: "$taggedAccountInfo",
			},
		},
	];
	try {
		const postInfo = await momentCollection
			.aggregate<MomentPostResponseParams>(pipeline)
			.next();
		return postInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a clip post.
 * @param {string} postId - The ID of the clip post to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the clip post details.
 * @returns {Promise<ClipPostResponseParams | null>} A promise that resolves to the clip post response parameters if found, or null if the post does not exist.
 */

export async function getClipPostResponse(
	postId: string,
	clientAccountId: string
): Promise<ClipPostResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(postId),
				isDeleted: false,
			},
		},
		{
			$lookup: {
				from: "clipPostLike",
				let: { clipPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$clipPostId"],
									},
									{
										$eq: ["$likedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postLikeInfo",
			},
		},
		{
			$lookup: {
				from: "clipPostLike",
				let: { clipPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$postId", "$$clipPostId"],
							},
						},
					},
					{
						$lookup: {
							from: "account",
							let: { userAccountId: "$likedBy" },
							pipeline: [
								{
									$match: {
										$expr: {
											$eq: ["$_id", "$$userAccountId"],
										},
									},
								},
								{
									$lookup: {
										from: "accountFollow",
										pipeline: [
											{
												$match: {
													$expr: {
														$and: [
															{
																$eq: [
																	"$accountId",
																	"$$userAccountId",
																],
															},
															{
																$eq: [
																	"$followedBy",
																	new ObjectId(
																		clientAccountId
																	),
																],
															},
															{
																$eq: [
																	"isRequested",
																	false,
																],
															},
														],
													},
												},
											},
										],
										as: "accountFollowingInfo",
									},
								},
								{
									$project: {
										_id: 0,
										id: { $toString: "$_id" },
										userId: "$userId",
										profilePictureUri: "$profilePictureUri",
										isFollowed: {
											$cond: [
												{
													$eq: ["$accountFollowingInfo", []],
												},
												false,
												true,
											],
										},
										isAvailable: {
											$cond: [
												{
													$and: [
														{
															$eq: ["$isDeleted", false],
														},
														{
															$eq: ["$isDisabled", false],
														},
													],
												},
												true,
												false,
											],
										},
									},
								},
								{
									$match: {
										isFollowed: true,
										isAvailable: true,
									},
								},
								{
									$limit: 3,
								},
							],
							as: "followedAccountInfo",
						},
					},
					{
						$unwind: {
							path: "$followedAcountInfo",
							preserveNullAndEmptyArrays: true,
						},
					},
					{
						$project: {
							_id: 0,
							id: "$followedAcountInfo.id",
							userId: "$followedAcountInfo.userId",
							profilePictureUri: "$followedAcountInfo.profilePictureUri",
							isFollowed: "$followedAcountInfo.isFollowed",
							isAvailable: "$followedAcountInfo.isAvailable",
						},
					},
				],
				as: "mutualLikeInfo",
			},
		},
		{
			$lookup: {
				from: "clipPostView",
				let: { clipPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$clipPostId"],
									},
									{
										$eq: ["$viewedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postViewInfo",
			},
		},
		{
			$lookup: {
				from: "clipPostSave",
				let: { clipPostId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$postId", "$$clipPostId"],
									},
									{
										$eq: ["$savedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "postSaveInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$author" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							let: { author: "$author" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$accountId", "$$author"],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							let: { author: "$author" },
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$accountId",
																"$$author",
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																"$$author",
															],
														},
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "memory",
							let: { accountId: "$author" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: ["$author", "$$accountId"],
												},
												{
													$gte: ["$expiredAt", "$$NOW"],
												},
												{
													$eq: ["$isDeleted", false],
												},
											],
										},
									},
								},
								{
									$lookup: {
										from: "memoryView",
										let: { memoryId: "$_id" },
										pipeline: [
											{
												$match: {
													$expr: {
														$and: [
															{
																$eq: [
																	"$meoryId",
																	"$$memoryId",
																],
															},
															{
																$eq: [
																	"$viewedBy",
																	new ObjectId(
																		clientAccountId
																	),
																],
															},
														],
													},
												},
											},
										],
										as: "memoryViewInfo",
									},
								},
								{
									$set: {
										isViewed: {
											$cond: [
												{
													$eq: ["$memoryViewInfo", []],
												},
												false,
												true,
											],
										},
									},
								},
								{
									$unset: "memoryViewInfo",
								},
							],
							as: "memoryInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { $toString: "$_id" },
							userId: "$userId",
							profilePicture: "$profilePicture",
							name: "$name",
							isFollowed: {
								$cond: [
									{
										$eq: ["$accountFollowingInfo", []],
									},
									false,
									true,
								],
							},
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$eq: ["$isPrivate", false],
													},
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
							"memoryInfo.noOfAvailableMemories": {
								$size: "$memoryInfo",
							},
							"memoryInfo.noOfUnseenMemories": {
								$size: {
									$filter: {
										input: "memoryInfo",
										as: "memory",
										cond: {
											"$$memory.isViewed": false,
										},
									},
								},
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { accountTags: "$taggedAccounts" },
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$accountTags.id"],
							},
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$accountId", "$$accountId"],
												},
											],
										},
									},
								},
							],
							as: "accountFollowInfo",
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							let: { accountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																clientAccountId,
															],
														},
														{
															$eq: [
																"$accountId",
																"$$accountId",
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$project: {
							account: {
								_id: 0,
								id: { $toString: "$_id" },
								userId: "$userId",
								profilePictureUri: "$profilePictureUri",
								name: "$name",
								isBlocked: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountBlockInfo",
															as: "item",
															cond: {
																$and: [
																	{
																		$eq: [
																			"$$item.accountId",
																			"$userAccountId",
																		],
																	},
																	{
																		$eq: [
																			"$$item.blockedBy",
																			new ObjectId(
																				clientAccountId
																			),
																		],
																	},
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
								isAvailable: {
									$cond: [
										{
											$and: [
												{
													$eq: ["$isDeleted", false],
												},
												{
													$eq: ["$isDeActivated", false],
												},
												{
													$lt: ["$supendedTill", new Date()],
												},
												{
													$eq: [
														{
															$size: {
																$filter: {
																	input: "$accountBlockInfo",
																	as: "item",
																	cond: {
																		$and: [
																			{
																				$eq: [
																					"$$item.accountId",
																					clientAccountId,
																				],
																			},
																			{
																				$eq: [
																					"$$item.blockedBy",
																					"$$userAccountId",
																				],
																			},
																		],
																	},
																},
															},
														},
														0,
													],
												},
											],
										},
										true,
										false,
									],
								},
								isFollowed: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountFollowInfo",
															as: "item",
															cond: {
																$eq: [
																	"$$item.isRequested",
																	false,
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
								isRequestedToFollow: {
									$cond: [
										{
											$eq: [
												{
													$size: {
														$filter: {
															input: "$accountFollowInfo",
															as: "item",
															cond: {
																$eq: [
																	"$$item.isRequested",
																	true,
																],
															},
														},
													},
												},
												0,
											],
										},
										false,
										true,
									],
								},
							},
						},
					},
				],
				as: "taggedAccountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"accountInfo.isAvailable": true,
				"accountInfo.isBlocked": false,
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				createdAt: { $toLong: "$createdAt" },
				caption: "$caption.text",
				"taggedLocation.id": { $toString: "$locationInfo.id" },
				"taggedLocation.name": "$locationInfo.name",
				engagementSummary: "$engagementSummary",
				"engagementSummary.mutualLikes": "$mutualLikeInfo",
				advancedSettings: "$advancedSettings",
				"metaData.href": "$postLink",
				"metaData.isLiked": {
					$cond: [
						{
							$eq: ["$postLikeInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isViewed": {
					$cond: [
						{
							$eq: ["$postViewInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isSaved": {
					$cond: [
						{
							$eq: ["$postSaveInfo", []],
						},
						false,
						true,
					],
				},
				"metaData.isPinned": "$isPinned",
				author: "$accountInfo",
				video: "$video",
				taggedAccounts: "$taggedAccountInfo",
			},
		},
	];
	try {
		const postInfo = await clipCollection
			.aggregate<ClipPostResponseParams>(pipeline)
			.next();
		return postInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for an audio attachment.
 * @param {string} audioId - The ID of the audio attachment to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the audio attachment details.
 * @returns {Promise<AudioAttachmentResponseParams | null>} - A promise that resolves to the audio attachment response parameters if found, or null if the audio attachment does not exist.
 * If the audio was uploaded by an admin, the response includes the admin details.
 * If uploaded by a user, the response includes associated account information.
 */

export async function getAudioAttachmentResponse(
	audioId: string,
	clientAccountId: string
): Promise<AudioAttachmentResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(audioId),
				isDeleted: false,
				isAvailable: true,
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$associatedAccount" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							let: { userAccountId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$userAccountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		"$$userAccountId",
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									true,
									false,
								],
							},
							isPrivate: "$isPrivate",
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				$expr: {
					$or: [
						{
							$and: [
								{
									$eq: ["$uploadedBy", "user"],
								},
								{
									$ne: ["$accountInfo", null],
								},
							],
						},
						{
							$eq: ["$uploadedBy", "admin"],
						},
					],
				},
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				title: "$title",
				uploadedBy: "$uploadedBy",
				type: "$type",
				poster: "$poster",
				noOfMomentUse: "$noOfMomentUse",
				associatedAccountInfo: {
					$cond: [
						{
							$eq: ["$uploadedBy", "user"],
						},
						"$accountInfo",
						undefined,
					],
				},
				artist: {
					$cond: [
						{
							$eq: ["$uploadedBy", "admin"],
						},
						"$artist",
						undefined,
					],
				},
				isSaved: "$isSaved",
			},
		},
	];
	try {
		const audioInfo = await audioCollection
			.aggregate<AudioAttachmentResponseParams>(pipeline)
			.next();
		if (audioInfo) {
			if (audioInfo.uploadedBy === "admin") {
				return {
					id: audioInfo.id,
					title: audioInfo.title,
					poster: audioInfo.poster,
					uploadedBy: audioInfo.uploadedBy,
					type: audioInfo.type,
					artist: audioInfo.artist,
					noOfMomentUse: audioInfo.noOfMomentUse,
				};
			} else {
				return {
					id: audioInfo.id,
					title: audioInfo.title,
					poster: audioInfo.poster,
					uploadedBy: audioInfo.uploadedBy,
					type: audioInfo.type,
					associatedAccountInfo: audioInfo.associatedAccountInfo,
					noOfMomentUse: audioInfo.noOfMomentUse,
				};
			}
		}
		return audioInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for an account attachment.
 * @param {string} accountId - The ID of the account to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the account attachment details.
 * @returns {Promise<AccountAttachmentResponseParams | null>} A promise that resolves to the account attachment response parameters if found, or null if the account does not exist.
 */

export async function getAccountAttachmentResponse(
	accountId: string,
	clientAccountId: string
): Promise<AccountAttachmentResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(accountId),
				isDeleted: false,
				isDeActivated: false,
				suspendedTill: { $exists: false },
			},
		},
		{
			$lookup: {
				from: "accountBlock",
				let: { userAccountId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$or: [
									{
										$and: [
											{
												$eq: ["$accountId", "$$userAccountId"],
											},
											{
												$eq: [
													"$blockedBy",
													new ObjectId(clientAccountId),
												],
											},
										],
									},
									{
										$and: [
											{
												$eq: [
													"$accountId",
													new ObjectId(clientAccountId),
												],
											},
											{
												$eq: ["$blockedBy", "$$userAccountId"],
											},
										],
									},
								],
							},
						},
					},
				],
				as: "accountBlockInfo",
			},
		},
		{
			$match: {
				accountBlockInfo: { $ne: [] },
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				userId: { $toString: "$userId" },
				profilePictureUri: "$profilePictureUri",
				name: "$name",
				noOfPosts: "$noOfPosts",
				noOfFollowers: "$noOfFollowers",
			},
		},
	];
	try {
		const accountInfo = await accountCollection
			.aggregate<AccountAttachmentResponseParams>(pipeline)
			.next();
		return accountInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a memory attachment.
 * @param {string} memoryId - The ID of the memory attachment to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the memory attachment details.
 * @returns {Promise<MemoryAttachmentResponseParams | null>} A promise that resolves to the memory attachment response parameters if found, or null if the memory does not exist.
 */

export async function getMemoryAttachmentResponse(
	memoryId: string,
	clientAccountId: string
): Promise<MemoryAttachmentResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(memoryId),
				isDeleted: false,
				expiredAt: { $lte: new Date() },
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$author" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
													{
														$eq: ["$isPrivate", false],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"$accountInfo.isAvailable": true,
				"$accountInfo.isBlocked": false,
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				author: "$accountInfo",
				thumbnail: "$content.thumbnail",
			},
		},
	];
	try {
		let memoryInfo = await memoryCollection
			.aggregate<MemoryAttachmentResponseParams>(pipeline)
			.next();
		return memoryInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a memory.
 * @param {string} memoryId - The ID of the memory to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the memory details.
 * @returns {Promise<MemoryResponseParams | null>} A promise that resolves to the memory response parameters if found, or null if the memory does not exist.
 */

export async function getMemoryResponse(
	memoryId: string,
	clientAccountId: string
): Promise<MemoryResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(memoryId),
				isDeleted: false,
				expiredAt: { $lte: new Date() },
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$author" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
													{
														$eq: ["$isPrivate", false],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$lookup: {
				from: "audio",
				let: { audioId: "$audioInfo.id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$audioId"],
									},
									{
										$eq: ["$isAvailable", true],
									},
									{
										$eq: ["$isDeleted", false],
									},
								],
							},
						},
					},
					{
						$project: {
							id: "$_id",
							title: "$title",
						},
					},
				],
				as: "usedAudioInfo",
			},
		},
		{
			$lookup: {
				from: "memoryLike",
				let: { memoryId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$memoryId", "$$memoryId"],
									},
									{
										$eq: ["$likedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "memoryLikeInfo",
			},
		},
		{
			$lookup: {
				from: "memoryView",
				let: { memoryId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$memoryId", "$$memoryId"],
									},
									{
										$eq: ["$viewedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "memoryViewInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$unwind: {
				path: "$usedAudioInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"$accountInfo.isAvailable": true,
				"$accountInfo.isBlocked": false,
			},
		},
		{
			$project: {
				_id: 0,
				id: { $toString: "$_id" },
				createdAt: { $toLong: "$createdAt" },
				author: "$accountInfo",
				content: "$content",
				usedAfterEffect: "$usedAfterEffect",
				usedAudio: "$usedAudioInfo.title",
				captions: "$captions",
				sticker: "$sticker",
				taggedLocation: "$taggedLocation",
				link: "$link",
				usedCameraTool: "$usedCameraTool",
				advancedOptions: "$advancedOptions",
				engagementSummary: "$engagementSummary",
				isLiked: {
					$cond: [
						{
							$eq: ["$memoryLikeInfo", []],
						},
						false,
						true,
					],
				},
				isViewed: {
					$cond: [
						{
							$eq: ["$memoryViewInfo", []],
						},
						false,
						true,
					],
				},
			},
		},
	];
	try {
		let memoryInfo = await memoryCollection
			.aggregate<MemoryResponseParams>(pipeline)
			.next();
		return memoryInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a highlight attachment within a memory.
 * @param {string} memoryId - The ID of the memory containing the highlight attachment.
 * @param {string} highlightId - The ID of the highlight attachment to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the highlight attachment details.
 * @returns {Promise<HighlightAttachmentResponseParams | null>} A promise that resolves to the highlight attachment response parameters if found, or null if the highlight does not exist.
 */

export async function getHighlightAttachmentResponse(
	memoryId: string,
	highlightId: string,
	clientAccountId: string
): Promise<HighlightAttachmentResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(memoryId),
				isDeleted: false,
			},
		},
		{
			$lookup: {
				from: "highlight",
				let: {
					memoryId: "$_id",
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", highlightId],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$in: ["$$memoryId", "$associatedMemories"],
									},
								],
							},
						},
					},
					{
						$project: {
							_id: 0,
							id: { $toString: "$_id" },
							name: 1,
						},
					},
				],
				as: "highlightInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$createdBy" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
													{
														$eq: ["$isPrivate", false],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$unwind: {
				path: "$highlightInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"$accountInfo.isAvailable": true,
				"$accountInfo.isBlocked": false,
				highlightInfo: { $ne: null },
			},
		},
		{
			$project: {
				_id: 0,
				id: "$highlightInfo.id",
				name: "$highlightInfo.name",
				"memoryInfo.id": { $toString: "$_id" },
				"memoryInfo.author": "$accountInfo",
				"memoryInfo.thumbnail": "$content.thumbnail",
			},
		},
	];
	try {
		let memoryInfo = await memoryCollection
			.aggregate<HighlightAttachmentResponseParams>(pipeline)
			.next();
		return memoryInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a highlight within a memory.
 * @param {string} memoryId - The ID of the memory containing the highlight.
 * @param {string} highlightId - The ID of the highlight to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the highlight attachment details.
 * @returns {Promise<HighlightMemoryResponseParams | null>} A promise that resolves to the highlight response parameters if found, or null if the highlight does not exist.
 */

export async function getHighlightResponse(
	memoryId: string,
	highlightId: string,
	clientAccountId: string
): Promise<HighlightMemoryResponseParams | null> {
	let pipeline = [
		{
			$match: {
				_id: new ObjectId(memoryId),
				isDeleted: false,
			},
		},
		{
			$lookup: {
				from: "highlight",
				let: {
					memoryId: "$_id",
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", highlightId],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$in: ["$$memoryId", "$associatedMemories"],
									},
								],
							},
						},
					},
					{
						$lookup: {
							from: "memory",
							let: { memoryId: "$selectedThumbnailMemoryId" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: ["$_id", "$$memoryId"],
												},
												{
													$eq: ["$isDeleted", false],
												},
											],
										},
									},
								},
								{
									$project: {
										_id: 0,
										thumbnail: "$content.thumbnail",
									},
								},
							],
							as: "selectedThumbnailMemoryInfo",
						},
					},
					{
						$unwind: {
							path: "$selectedThumbnailMemoryInfo",
							preserveNullAndEmptyArrays: true,
						},
					},
					{
						$project: {
							_id: 0,
							id: { $toString: "$_id" },
							name: "$name",
							poster: "$poster",
							selectedThumbnailMemoryInfo:
								"$selectedThumbnailMemoryInfo.thumbnail",
						},
					},
				],
				as: "highlightInfo",
			},
		},
		{
			$lookup: {
				from: "account",
				let: { userAccountId: "$createdBy" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$userAccountId"],
									},
									{
										$eq: ["$isDeleted", false],
									},
									{
										$eq: ["$isDeActivated", false],
									},
								],
							},
							suspendedTill: { $exists: false },
						},
					},
					{
						$lookup: {
							from: "accountBlock",
							pipeline: [
								{
									$match: {
										$expr: {
											$or: [
												{
													$and: [
														{
															$eq: [
																"$accountId",
																"$$userAccountId",
															],
														},
														{
															$eq: [
																"$blockedBy",
																new ObjectId(
																	clientAccountId
																),
															],
														},
													],
												},
												{
													$and: [
														{
															$eq: [
																"$accountId",
																new ObjectId(
																	clientAccountId
																),
															],
														},
														{
															$eq: [
																"$blockedBy",
																"$$accountId",
															],
														},
													],
												},
											],
										},
									},
								},
							],
							as: "accountBlockInfo",
						},
					},
					{
						$lookup: {
							from: "accountFollow",
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{
													$eq: [
														"$accountId",
														"$$userAccountId",
													],
												},
												{
													$eq: [
														"$followedBy",
														new ObjectId(clientAccountId),
													],
												},
												{
													$eq: ["$isRequested", false],
												},
											],
										},
									},
								},
							],
							as: "accountFollowingInfo",
						},
					},
					{
						$project: {
							_id: 0,
							id: { toString: "$_id" },
							userId: { $toString: "$userId" },
							profilePictureUri: "$profilePictureUri",
							isBlocked: {
								$cond: [
									{
										$eq: [
											{
												$size: {
													$filter: {
														input: "$accountBlockInfo",
														as: "item",
														cond: {
															$and: [
																{
																	$eq: [
																		"$$item.accountId",
																		"$$userAccountId",
																	],
																},
																{
																	$eq: [
																		"$$item.blockedBy",
																		new ObjectId(
																			clientAccountId
																		),
																	],
																},
															],
														},
													},
												},
											},
											0,
										],
									},
									false,
									true,
								],
							},
							isAvailable: {
								$cond: [
									{
										$and: [
											{
												$eq: [
													{
														$size: {
															$filter: {
																input: "$accountBlockInfo",
																as: "item",
																cond: {
																	$and: [
																		{
																			$eq: [
																				"$$item.accountId",
																				new ObjectId(
																					clientAccountId
																				),
																			],
																		},
																		{
																			$eq: [
																				"$$item.blockedBy",
																				"$$userAccountId",
																			],
																		},
																	],
																},
															},
														},
													},
													0,
												],
											},
											{
												$or: [
													{
														$and: [
															{
																$eq: ["$isPrivate", true],
															},
															{
																$ne: [
																	"$accountFollowingInfo",
																	[],
																],
															},
														],
													},
													{
														$eq: ["$isPrivate", false],
													},
												],
											},
										],
									},
									true,
									false,
								],
							},
						},
					},
				],
				as: "accountInfo",
			},
		},
		{
			$lookup: {
				from: "audio",
				let: { audioId: "$audioInfo.id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$_id", "$$audioId"],
									},
									{
										$eq: ["$isAvailable", true],
									},
									{
										$eq: ["$isDeleted", false],
									},
								],
							},
						},
					},
					{
						$project: {
							id: "$_id",
							title: "$title",
						},
					},
				],
				as: "usedAudioInfo",
			},
		},
		{
			$lookup: {
				from: "memoryLike",
				let: { memoryId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$memoryId", "$$memoryId"],
									},
									{
										$eq: ["$likedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "memoryLikeInfo",
			},
		},
		{
			$lookup: {
				from: "memoryView",
				let: { memoryId: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$memoryId", "$$memoryId"],
									},
									{
										$eq: ["$viewedBy", new ObjectId(clientAccountId)],
									},
								],
							},
						},
					},
				],
				as: "memoryViewInfo",
			},
		},
		{
			$unwind: {
				path: "$accountInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$unwind: {
				path: "$highlightInfo",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$match: {
				"$accountInfo.isAvailable": true,
				"$accountInfo.isBlocked": false,
				highlightInfo: { $ne: null },
			},
		},
		{
			$project: {
				_id: 0,
				id: "$highlightInfo.id",
				name: "$highlightInfo.name",
				poster: "$highlightInfo.poster",
				selectedThumbnailMemoryInfo: "$highlightInfo.selectedThumbnailMemoryInfo",
				"memoryInfo.id": { $toString: "$_id" },
				"memoryInfo.createdAt": { $toLong: "$createdAt" },
				"memoryInfo.author": "$accountInfo",
				"memoryInfo.content": "$content",
				"memoryInfo.usedAfterEffect": "$usedAfterEffect",
				"memoryInfo.usedAudio": "$usedAudioInfo.title",
				"memoryInfo.captions": "$captions",
				"memoryInfo.sticker": "$sticker",
				"memoryInfo.taggedLocation": "$taggedLocation",
				"memoryInfo.link": "$link",
				"memoryInfo.usedCameraTool": "$usedCameraTool",
				"memoryInfo.advancedOptions": "$advancedOptions",
				"memoryInfo.isLiked": {
					$cond: [
						{
							$eq: ["$memoryLikeInfo", []],
						},
						false,
						true,
					],
				},
				"memoryInfo.isViewed": {
					$cond: [
						{
							$eq: ["$memoryViewInfo", []],
						},
						false,
						true,
					],
				},
			},
		},
	];
	try {
		let memoryInfo = await memoryCollection
			.aggregate<HighlightMemoryResponseParams>(pipeline)
			.next();
		return memoryInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the response details for a chat message.
 * @param {string} messageId - The ID of the chat message to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the chat message details.
 * @returns {Promise<MessageResponseParams | null>} - A promise that resolves to the message response parameters if found, or null if the message does not exist.
 * The response structure varies based on the type of the message:
 * - If the message is a reply, it may include various types of attachments (e.g., account, audio, clip, file, highlight, memory, moment, photo).
 * - If the message is an attachment, it may also include different types of attachments.
 * - If the message is plain text, the response includes the text content.
 */

export async function getChatMessageResponseData(
	messageId: string,
	clientAccountId: string
): Promise<MessageResponseParams | null> {
	try {
		const messageInfo = await getChatMessageData(messageId, clientAccountId);
		if (messageInfo) {
			let messageData: MessageResponseParams;
			if (messageInfo.data.type === "reply") {
				if (messageInfo.data.attachment.type === "account") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								accountInfo: await getAccountAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "audio") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								audioInfo: await getAudioAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "clip") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								clipPostInfo: await getClipPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "file") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								file: messageInfo.data.attachment.file,
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "highlight") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								highlightInfo: await getHighlightAttachmentResponse(
									messageInfo.data.attachment.highlightInfo.memoryId.toString(),
									messageInfo.data.attachment.highlightInfo.highlightId.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "memory") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),

						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								memoryInfo: await getMemoryAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "moment") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								momentPostInfo: await getMomentPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "photo") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),

						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								photoPostInfo: await getPhotoPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				} else {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "reply",
							attachment: {
								type: messageInfo.data.attachment.type,
								content: messageInfo.data.content.text,
							},
							repliedInfo: {
								messageId:
									messageInfo.data.repliedInfo.messageId.toString(),
								repliedTo:
									messageInfo.data.repliedInfo.repliedTo.toString(),
							},
							content: messageInfo.data.content.text,
						},
					};
				}
			} else if (messageInfo.data.type === "attachment") {
				if (messageInfo.data.attachment.type === "account") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								accountInfo: await getAccountAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "audio") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								audioInfo: await getAudioAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "clip") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								clipPostInfo: await getClipPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "file") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								file: messageInfo.data.attachment.file,
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "highlight") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								highlightInfo: await getHighlightAttachmentResponse(
									messageInfo.data.attachment.highlightInfo.memoryId.toString(),
									messageInfo.data.attachment.highlightInfo.highlightId.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "memory") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),

						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								memoryInfo: await getMemoryAttachmentResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else if (messageInfo.data.attachment.type === "moment") {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),
						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								momentPostInfo: await getMomentPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				} else {
					messageData = {
						id: messageInfo._id.toString(),
						author: messageInfo.sender.toString(),
						seenBy: messageInfo.seenBy.map((accountId) =>
							accountId.toString()
						),
						sentAt: messageInfo.sentAt.valueOf(),

						data: {
							type: "attachment",
							attachment: {
								type: messageInfo.data.attachment.type,
								photoPostInfo: await getPhotoPostResponse(
									messageInfo.data.attachment.id.toString(),
									clientAccountId
								),
							},
							caption: messageInfo.data.content?.text,
						},
					};
				}
			} else {
				messageData = {
					id: messageInfo._id.toString(),
					author: messageInfo.sender.toString(),
					seenBy: messageInfo.seenBy.map((accountId) => accountId.toString()),
					sentAt: messageInfo.sentAt.valueOf(),
					data: {
						type: "text",
						content: messageInfo.data.content.text,
					},
				};
			}
			return messageData;
		} else {
			return null;
		}
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the details of a chat message by its ID.
 * @param {string} messageId - The ID of the chat message to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the chat message details.
 * @returns {Promise<WithId<ChatMessage> | null>} - A promise that resolves to the chat message details if found and not deleted by the client, or null if the message does not exist or has been deleted by the client.
 */

export async function getChatMessageData(
	messageId: string,
	clientAccountId: string
): Promise<WithId<ChatMessage> | null> {
	try {
		const messageInfo = await oneToOneMessageCollection.findOne({
			_id: new ObjectId(messageId),
			deletedBy: { $nin: [new ObjectId(clientAccountId)] },
		});
		return messageInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the details of a group chat message by its ID.
 * @param {string} messageId - The ID of the group chat message to retrieve.
 * @param {string} clientAccountId - The ID of the client requesting the group chat message details.
 * @returns {Promise<WithId<GroupMessage> | null>} - A promise that resolves to the group chat message details if found and not deleted by the client, or null if the message does not exist or has been deleted by the client.
 */

export async function getGroupChatMessageData(
	messageId: string,
	clientAccountId: string
): Promise<WithId<GroupMessage> | null> {
	try {
		const messageInfo = await groupMessageCollection.findOne({
			_id: new ObjectId(messageId),
			deletedBy: { $nin: [new ObjectId(clientAccountId)] },
		});
		return messageInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves and formats a group chat message for the client based on message type and attachment type.
 *
 * @param {string} messageId - The ID of the message to fetch.
 * @param {string} clientAccountId - The account ID of the client requesting the message (used for context and access control).
 * @returns {Promise<MessageResponseParams | null>} A Promise that resolves to the formatted message response or null if the message is a banner or not found.
 */
export async function getGroupChatMessageResponseData(
	messageId: string,
	clientAccountId: string
): Promise<MessageResponseParams | null> {
	try {
		// Fetch raw message data from the DB with client-specific access info
		const messageInfo = await getGroupChatMessageData(messageId, clientAccountId);

		// Skip processing if the message is not found or is a banner type
		if (messageInfo && messageInfo.data.type !== "banner") {
			let messageData: MessageResponseParams;

			// Handle reply-type messages
			if (messageInfo.data.type === "reply") {
				const repliedInfo = {
					messageId: messageInfo.data.repliedInfo.messageId.toString(),
					repliedTo: messageInfo.data.repliedInfo.repliedTo.toString(),
				};

				// Process each attachment type within a reply message
				switch (messageInfo.data.attachment.type) {
					case "account":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "account",
									accountInfo: await getAccountAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "audio":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "audio",
									audioInfo: await getAudioAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "clip":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "clip",
									clipPostInfo: await getClipPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "file":
						// Directly use file object without additional lookup
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "file",
									file: messageInfo.data.attachment.file,
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "highlight":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "highlight",
									highlightInfo: await getHighlightAttachmentResponse(
										messageInfo.data.attachment.highlightInfo.memoryId.toString(),
										messageInfo.data.attachment.highlightInfo.highlightId.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "memory":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "memory",
									memoryInfo: await getMemoryAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "moment":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "moment",
									momentPostInfo: await getMomentPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					case "photo":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: "photo",
									photoPostInfo: await getPhotoPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
						break;

					default:
						// Fallback for unknown attachment type
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "reply",
								attachment: {
									type: messageInfo.data.attachment.type,
									content: messageInfo.data.content.text,
								},
								repliedInfo,
								content: messageInfo.data.content.text,
							},
						};
				}
			}
			// Handle attachment messages (not replies)
			else if (messageInfo.data.type === "attachment") {
				const caption = messageInfo.data.content?.text;

				switch (messageInfo.data.attachment.type) {
					case "account":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "account",
									accountInfo: await getAccountAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					case "audio":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "audio",
									audioInfo: await getAudioAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					case "clip":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "clip",
									clipPostInfo: await getClipPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					case "file":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "file",
									file: messageInfo.data.attachment.file,
								},
								caption,
							},
						};
						break;

					case "highlight":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "highlight",
									highlightInfo: await getHighlightAttachmentResponse(
										messageInfo.data.attachment.highlightInfo.memoryId.toString(),
										messageInfo.data.attachment.highlightInfo.highlightId.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					case "memory":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "memory",
									memoryInfo: await getMemoryAttachmentResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					case "moment":
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: "moment",
									momentPostInfo: await getMomentPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
						break;

					default:
						// Assume it's a photo post for any unmatched types
						messageData = {
							id: messageInfo._id.toString(),
							author: messageInfo.sender.toString(),
							seenBy: messageInfo.seenBy.map((id) => id.toString()),
							sentAt: messageInfo.sentAt.valueOf(),
							data: {
								type: "attachment",
								attachment: {
									type: messageInfo.data.attachment.type,
									photoPostInfo: await getPhotoPostResponse(
										messageInfo.data.attachment.id.toString(),
										clientAccountId
									),
								},
								caption,
							},
						};
				}
			}
			// Fallback for plain text messages
			else {
				messageData = {
					id: messageInfo._id.toString(),
					author: messageInfo.sender.toString(),
					seenBy: messageInfo.seenBy.map((id) => id.toString()),
					sentAt: messageInfo.sentAt.valueOf(),
					data: {
						type: "text",
						content: messageInfo.data.content.text,
					},
				};
			}

			return messageData;
		} else {
			// Message is a banner or not found
			return null;
		}
	} catch (error) {
		// Let the error propagate to the caller
		throw error;
	}
}

/**
 * Executes a MongoDB transaction with automatic retry logic for transient errors.
 *
 * @template T - The type of value returned by the operation.
 * @param {MongoClient} client - The MongoDB client instance.
 * @param {(session: ClientSession) => Promise<T>} operation - The operation to execute inside the transaction. It receives a session and must return a promise.
 * @param {number} [maxRetries=3] - The maximum number of retries for transient errors.
 * @returns {Promise<T>} - The result of the operation if successful.
 * @throws Will throw an error if the transaction fails after the maximum number of retries or encounters a non-retryable error.
 */
export const executeTransactionWithRetry = async <T>(
	client: MongoClient,
	operation: (session: ClientSession) => Promise<T>,
	maxRetries = 3
): Promise<T> => {
	let retries = 0;
	let session: ClientSession | null = null;

	while (retries < maxRetries) {
		// Start a new session for each retry attempt
		session = client.startSession();

		try {
			// Begin a transaction with desired options
			session.startTransaction({
				readConcern: { level: "local" },
				writeConcern: { w: "majority" },
				readPreference: "primary",
			} as TransactionOptions);

			// Execute the user-defined operation within the transaction
			const value = await operation(session);

			// Attempt to commit the transaction
			await commitWithRetry(session);

			// If commit succeeds, return the operation's result
			return value;
		} catch (error) {
			console.error(error);

			// Abort the transaction on any error
			if (session) await session.abortTransaction();

			if (error instanceof MongoError) {
				// Handle transient (retryable) errors
				if (isTransientError(error) && retries < maxRetries - 1) {
					retries++;
					console.warn(
						`Transient error occurred. Retrying transaction... (Attempt ${
							retries + 1
						}/${maxRetries})`
					);

					// Use exponential backoff strategy before retrying
					await delay(2 ** retries * 100);
				} else {
					// If error is not retryable or retries exceeded, rethrow
					console.error("Transaction failed after retries:", error);
					throw error;
				}
			} else {
				// Re-throw non-Mongo errors
				console.log("Transaction aborted. Caught exception during transaction.");
				throw error;
			}
		} finally {
			// Always end the session to avoid leaks
			if (session) await session.endSession();
		}
	}

	// Final fallback if loop exits unexpectedly
	throw new Error("Transaction failed after maximum retries");
};

/**
 * Attempts to commit a MongoDB transaction with retry logic for transient commit errors.
 *
 * Specifically handles the `UnknownTransactionCommitResult` error label, which indicates
 * the commit result is unknown and may require a retry to ensure consistency.
 *
 * @param {ClientSession} session - The MongoDB client session associated with the transaction.
 * @returns {Promise<void>} - Resolves once the transaction is successfully committed.
 * @throws Will rethrow any non-retryable commit error or if retries are exhausted.
 */
async function commitWithRetry(session: ClientSession): Promise<void> {
	let retries = 0;

	while (retries < 3) {
		try {
			// Attempt to commit the transaction
			await session.commitTransaction();
			console.log("Transaction committed.");
			break; // Exit loop on success
		} catch (error) {
			console.error(error);

			// Retry if commit result is unknown (transient error)
			if (
				error instanceof MongoError &&
				error.hasErrorLabel("UnknownTransactionCommitResult")
			) {
				console.log(
					"UnknownTransactionCommitResult, retrying commit operation ..."
				);
				retries++;

				// Apply exponential backoff before retrying
				await delay(2 ** retries * 100);
			} else {
				// Non-retryable error — rethrow immediately
				console.log("Error during commit ...");
				throw error;
			}
		}
	}
}
