import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } = req.body;
    if (!content) throw new ApiError(400, "content is required");

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");

    const tweet = await Tweet.create({
        content,
        owner: user?._id
    })
    if (!tweet) throw new ApiError(400, "Something went wrong while creating tweet")
    return res.status(201).json(
        new ApiResponse(
            200,
            tweet,
            "Tweet created successfully"
        )
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;
    if (!userId) throw new ApiError(404, "userId is required");
    if (!isValidObjectId(userId)) throw new ApiError(404, "UserId not valid");

    const { page = 1, limit = 10 } = req.query;

    const user = await User.findById(userId).select("_id");
    if (!user) throw new ApiError(404, "User not found");

    const tweetAggregate = Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user?._id)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: "$avatar.url",
                            fullName: 1,
                            _id: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ])

    if (!tweetAggregate) throw new ApiError(404, "Tweet not found");

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
            totalDocs: "totalTweets",
            docs: "tweets"
        },
        $skip: (page - 1) * limit

    }

    Tweet.aggregatePaginate(
        tweetAggregate,
        options
    )
        .then(
            result => {
                if (result.length === 0) {
                    return res.status(200)
                        .json(new ApiResponse(
                            200,
                            [],
                            "No tweets found"
                        ))
                }
                return res.status(200)
                    .json(new ApiResponse(
                        200,
                        result,
                        "Tweets fetched successfully"
                    )
                    )
            }

        )
        .catch(error => {
            console.error("Error in aggregation:", error);
            throw new ApiError(500, error?.message || "Internal server error in tweet aggregation");
        })
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { content } = req.body;
    const { tweetId } = req.params;
    if (!content) throw new ApiError(400, "content is required");

    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Not a valid tweet id")

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User not found");

    const tweet = await Tweet.findById(tweetId)
    if (!tweet) throw new ApiError(400, "Tweet not found")

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )
    if (!updatedTweet) throw new ApiError(400, "Something went wrong while updating tweet")
    return res.status(201).json(
        new ApiResponse(
            200,
            updatedTweet,
            "Tweet updated successfully"
        )
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    try {
        const { tweetId } = req.params;
        if (!isValidObjectId(tweetId)) throw new ApiError(400, "Not a valid tweet id");

        const user = await User.findById(req.user?._id, { _id: 1 });
        if (!user) throw new ApiError(404, "User not found");

        const tweet = await Tweet.findById(tweetId)
        if (!tweet) throw new ApiError(400, "Tweet not found")

        await Tweet.findByIdAndDelete(tweetId);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    201,
                    {},
                    "Tweet deleted successfully"
                )
            )
    } catch (error) {
        throw new ApiError(400, error?.message || "Something went wrong while deleting tweet")
    }
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}