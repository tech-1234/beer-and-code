import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from 'mongoose';
import { User } from '../models/user.model.js';


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = 1, userId } = req.query;

    // Ensure sortType is a number
    const sortDirection = parseInt(sortType, 10);

    // Match condition for the aggregation pipeline
    const matchCondition = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }

    let videoAggregate;
    try {
        videoAggregate = Video.aggregate([
            {
                $match: matchCondition
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
                                _id: 1,
                                fullName: 1,
                                avatar: "$avatar.url",
                                username: 1,
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner",
                    },
                },
            },
            {
                $sort: {
                    [sortBy]: sortDirection
                }
            }
        ]);
    } catch (error) {
        console.error("Error in aggregation:", error);
        throw new ApiError(500, error.message || "Internal server error in video aggregation");
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos",
        },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    };

    Video.aggregatePaginate(videoAggregate, options)
        .then(result => {
            if (result?.videos?.length === 0 && userId) {
                return res.status(200).json(new ApiResponse(200, [], "No videos found"));
            }

            return res.status(200).json(new ApiResponse(200, result, "Video fetched successfully"));
        })
        .catch(error => {
            console.log("Error:", error);
            throw new ApiError(500, error?.message || "Internal server error in video aggregate paginate");
        });
});


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

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "VideoId is required")
    }

    const findVideo = await Video.findById(videoId);
    if (!findVideo) {
        throw new ApiError(404, "Video not found")
    }
    const user = await User.findById(req.user?._id, { watchHistory: 1 });
    if (!user) throw new ApiError(404, "User not found");

    // increment count based on watchHistory
    if (!user?.watchHistory.includes(videoId)) {
        await Video.findByIdAndUpdate(
            videoId,
            {

                $inc: { views: 1 },
            },
            {
                new: true
            }

        )
    }
    // adding video to user watch history
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $addToSet: {
                watchHistory: videoId
            }
        },
        {
            new: true
        }
    )
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
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
            $addFields: {
                videoFile: "$videoFile.url",
            },
        },
        {
            $addFields: {
                thumbnail: "$thumbnail.url",
            },
        },
    ])
    // console.log("video :: ", video[0])
    if (!video) throw new ApiError(500, "Video detail not found");
    return res.status(200).json(
        new ApiResponse(
            200,
            video[0],
            "Fetched video successfully"
        )
    );

})


export {
    getAllVideos,
    publishAVideo,
    getVideoById
}