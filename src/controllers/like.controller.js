import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"
import { Tweet } from '../models/tweet.model.js';
import { Comment } from "../models/comment.model.js"

const toggleLike = async (Model, resourceId, userId) => {

    if (!isValidObjectId(resourceId)) throw new ApiError(400, "Invalid Resource Id")
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid  UserId")

    const resource = await Model.findById(resourceId);
    if (!resource) throw new ApiError(404, "No Resource Found");

    const resourceField = Model.modelName.toLowerCase();

    const isLiked = await Like.findOne({ [resourceField]: resourceId, likedBy: userId })

    var response;
    try {
        response = isLiked ?
            await Like.deleteOne({ [resourceField]: resourceId, likedBy: userId }) :
            await Like.create({ [resourceField]: resourceId, likedBy: userId })
    } catch (error) {
        console.error("toggleLike error ::", error);
        throw new ApiError(500, error?.message || "Internal server error in toggleLike")
    }

    const totalLikes = await Like.countDocuments({ [resourceField]: resourceId });

    return { response, isLiked, totalLikes };

}
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: toggle like on video
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Not a valid video id")

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "Video not found")

    const userId = req.user?._id

    const user = await User.findById(userId, { _id: 1 });
    if (!user) throw new ApiError(404, "User unauthorized")

    const { response, isLiked, totalLikes } = await toggleLike(Video, videoId, userId);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { response, totalLikes },
                isLiked === null ? "Liked successfully" : "remove liked successfully"
            )
        )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    //TODO: toggle like on comment
    const userId = req.user?._id

    const user = await User.findById(userId, { _id: 1 });
    if (!user) throw new ApiError(404, "User unauthorized")

    const { response, isLiked, totalLikes } = await toggleLike(Comment, commentId, userId);
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { response, totalLikes },
                isLiked === null ? "Liked successfully" : "remove liked successfully"
            )
        )


})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    //TODO: toggle like on tweet
    const userId = req.user?._id

    const user = await User.findById(userId, { _id: 1 });
    if (!user) throw new ApiError(404, "User unauthorized")

    const { response, isLiked, totalLikes } = await toggleLike(Tweet, tweetId, userId);
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { response, totalLikes },
                isLiked === null ? "Liked successfully" : "remove liked successfully"
            )
        )
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos

    const userId = req.user?._id;
    const user = await User.findById(userId, { _id: 1 });
    if (!user) throw new ApiError(404, "User unauthorized")
    const videoPipeline = [
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId)
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: "$avatar.url",
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",
                            },
                        },
                    },
                    {
                        $addFields: {
                            videoFile: "$videoFile.url",
                        },
                    },
                    {
                        $addFields: {
                            thumbnail: "$thumbnail.url",
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$video",
        },

        {
            $replaceRoot: {
                newRoot: "$video",
            },
        },
    ]

    try {
        const likedVideos = await Like.aggregate(videoPipeline);
        return res.status(200)
            .json(
                new ApiResponse(
                    200,
                    likedVideos,
                    "liked videos fetched successfully"
                )
            )

    } catch (error) {
        console.error("getLikedVideos error ::", error);
        throw new ApiError(500, error?.message || "Internal server error in getLikedVideos")
    }

})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}