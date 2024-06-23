import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";


const toggleSubscription = asyncHandler(async (req, res) => {
    // TODO: toggle subscription
    const { channelId } = req.params;
    if (!isValidObjectId(channelId)) throw new ApiError(401, "Invalid channel Id");
    if (!req.user?._id) throw new ApiError(401, "Unauthorized user");
    const subscriberId = req.user?._id;

    const isSubscribed = await Subscription.findOne({ channel: channelId, subscriber: subscriberId });
    var response;
    try {
        response = isSubscribed
            ?
            await Subscription.deleteOne({ channel: channelId, subscriber: subscriberId })
            :
            await Subscription.create({ channel: channelId, subscriber: subscriberId });
    } catch (error) {
        console.log("toggleSubscription error ::", error)
        throw new ApiError(500, error?.message || "Internal server error in toggleSubscription")

    }

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                response,
                isSubscribed === null ? "Subscribed successfully" : "Unsubscribed successfully"

            )
        )
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if (!isValidObjectId(subscriberId)) throw new ApiError(400, "Channel id is not a valid id");
    if (!req.user?._id) throw new ApiError(404, "Unauthorized user")

    const pipeline = [
        // searching subscriberId as 'subscriber' from Subscription collections 
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
            },
        },
        {
            // joining users and subscriptions collection with users._id and subscription.channel and naming as subscribedTo field
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedTo",
                pipeline: [
                    {
                        // extracting the user i.e subscribers details like (fullName, username, avatar.url)
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: "$avatar.url",
                        }
                    }
                ]
            }
        },
        // deconstructing the subscribedTo array in object
        {
            $unwind: "$subscribedTo"
        },
        // renaming subscribedTo object as subscribed channel
        {
            $project: {
                subscribedChannel: "$subscribedTo"
            }
        }
    ]
    try {
        const channelSubscribedTo = await Subscription.aggregate(pipeline);
        const channelSubsByOwnerList = channelSubscribedTo.map(item => item.subscribedChannel)
        console.log(channelSubsByOwnerList);
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    channelSubsByOwnerList,
                    "Channels Subscribed By owner fetched successfully"
                )
            )

    } catch (error) {
        console.log("getSubscribedChannelsByOwner error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getSubscribedChannelsByOwner"
        )
    }
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id")
    if (!req.user?._id) throw new ApiError(404, "Unauthorized user")
    const pipeline = [
        {
            // searching for channelId from subscriptions collection
            $match: {
                channel: new mongoose.Types.ObjectId(channelId),
            }
        },
        {
            // joining users and subscription collection with users._id and subscriptions.subscriber and naming the document as subscriber
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: "$avatar.url",
                        }
                    }
                ]
            }
        },
        // adding subscriber field as first document
        {
            $addFields: {
                subscriber: {
                    $first: "$subscriber"
                }
            }
        }
    ]
    try {
        const subscribers = await Subscription.aggregate(pipeline);
        const subscribersList = subscribers.map(item => item.subscriber)
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    subscribersList,
                    "Subscribers List fetched successfully"
                )

            )

    } catch (error) {
        console.log("getUserSubscribedChannels error ::", error)
        throw new ApiError(
            500,
            error?.message || "Internal server error in getUserSubscribedChannels"
        )
    }
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}