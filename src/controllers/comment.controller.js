import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Video } from '../models/video.model.js';

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const { content } = req.body;
    const { videoId } = req.params
    if (!content) throw new ApiError(400, "content is required");

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Video id is not valid id")

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "Video not found")

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User is not authorized")

    const comment = await Comment.create({
        content,
        video: video._id,
        owner: user._id
    })

    if (!comment) throw new ApiError(400, "Something went wrong while creating comment")
    return res
        .status(201)
        .json(
            new ApiResponse(
                200,
                comment,
                "Comment created successfully"
            )
        )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const { commentId } = req.params;
    if (!isValidObjectId(commentId)) throw new ApiError(404, "Not found comment for this id")

    const comment = await Comment.findById(commentId, { _id: 1 });
    if (!comment) throw new ApiError(404, "Not found comment for this id")

    const user = await User.findById(req.user?._id, { _id: 1 });
    if (!user) throw new ApiError(404, "User is not authorized")

    const { content } = req.body;
    if (content?.trim() === "") throw new ApiError(404, "content is required")

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )

    if (!updateComment) throw new ApiError(500, "Something went wrong while updating comment")

    return res.status(200)
        .json(new ApiResponse(
            200,
            updatedComment,
            "Comment Updated Successfully"
        ))
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    try {
        const { commentId } = req.params;
        if (!isValidObjectId(commentId)) throw new ApiError(404, "Not found comment for this id")

        const comment = await Comment.findById(commentId, { _id: 1 });
        if (!comment) throw new ApiError(404, "Not found comment for this id")

        await Comment.findByIdAndDelete(commentId);
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "Comment deleted successfully"
                )
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong while deleting the comment")
    }

})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}