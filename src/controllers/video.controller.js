import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!(title || description)) {
        throw new ApiError(400, "Title and description is required");
    }

    // TODO: get video, upload to cloudinary, create video
    const videoFileLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
    if (!(videoFileLocalPath || thumbnailLocalPath)) {
        throw new ApiError(400, "Required files are missing");
    }

    const [videoFile, thumbnail] = await Promise.all(
        [
            uploadOnCloudinary(req.files?.videoFile?.[0]?.path),
            uploadOnCloudinary(req.files?.thumbnail?.[0]?.path)
        ]
    );
    if (!(videoFile || thumbnail)) {
        throw new ApiError(400, "Required files are missing");
    }

    const video = await Video.create({
        title,
        description,
        videoFile: { publicId: videoFile?.public_id, url: videoFile?.url },
        thumbnail: { publicId: thumbnail?.public_id, url: thumbnail?.url },
        duration: videoFile.duration,
        owner: req.user._id
    })

    return res.status(201)
        .json(new ApiResponse(201,
            {
                ...video._doc,
                videoFile: videoFile?.url, // Only send the URL of the video file
                thumbnail: thumbnail?.url    // Only send the URL of the thumbnail
            },
            "Video Published Successfully"
        ))
})

export {
    getAllVideos,
    publishAVideo
}