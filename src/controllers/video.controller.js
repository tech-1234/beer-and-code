import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
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

const updateVideo = asyncHandler(async (req, res) => {
    //TODO: update video details like title, description, thumbnail
    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;


    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");

    const oldVideo = await Video.findById(videoId, { thumbnail: 1 });
    if (!oldVideo) throw new ApiError(404, "No Video Found");

    if (
        !(thumbnailLocalPath || !(!title || title?.trim() === "") || !(!description || description?.trim() === ""))
    ) {
        throw new ApiError(400, "update fields are required")
    }

    const updatedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!updatedThumbnail) throw new ApiError(500, "thumbnail not uploaded on cloudinary");


    const { publicId, url } = oldVideo?.thumbnail;
    if (!(publicId || url)) throw new ApiError(500, "old thumbnail url or publicId not found");

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    publicId: updatedThumbnail?.public_id,
                    url: updatedThumbnail?.url
                }
            }

        },
        {
            new: true
        }
    )

    if (!video) {
        await deleteOnCloudinary(updatedThumbnail?.url, updatedThumbnail?.public_id);
        console.error("video not updated successfully", error)
        throw new ApiError(500, "updated video not uploaded on database");
    }

    if (url) {
        try {
            await deleteOnCloudinary(url, publicId)
        } catch (error) {

            console.log(`Failed to Delete Old thumbnail From Cloudinary Server ${error}`);
            throw new ApiError(500, error?.message || 'Server Error');
        }
    }
    return res.status(200)
        .json(new ApiResponse(
            201,
            video,
            "Video Updated Successfully"
        ))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    var deleteVideoFilePromise;
    var deleteThumbnailPromise;
    try {
        // 1. Validate videoId and fetch video details (optimized query)
        const video = await Video.findById(videoId, { videoFile: 1, thumbnail: 1 })
            .select('_id videoFile thumbnail'); // Use aggregation pipeline for efficiency

        if (!video) throw new ApiError(404, "No Video Found");

        // 2. Delete video file and thumbnail from Cloudinary (concurrent calls)
        [deleteVideoFilePromise, deleteThumbnailPromise] = await Promise.all([
            deleteOnCloudinary(video.videoFile.url, video.videoFile.publicId),
            deleteOnCloudinary(video.thumbnail.url, video.thumbnail.publicId)
        ]);

        // 3. Delete video from database
        await Video.findByIdAndDelete(videoId);

        // 4. Remove video from related collections (optimized updates)
        const updatePromises = [
            User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } })
        ];

        await Promise.all(updatePromises);


        // 5. Handle any remaining tasks (e.g., removing likes)
        // ...

        return res.status(200).json(new ApiResponse(201, {}, "Video Deleted Successfully"));

    } catch (error) {
        console.error("Error while deleting video:", error);

        // Rollback Cloudinary actions if necessary
        try {
            if (deleteVideoFilePromise?.error) await deleteVideoFilePromise.retry(); // Attempt retry
            if (deleteThumbnailPromise?.error) await deleteThumbnailPromise.retry();
        } catch (cloudinaryError) {
            console.error("Failed to rollback Cloudinary deletions:", cloudinaryError);
        }

        throw new ApiError(500, error.message || 'Server Error while deleting video');
    }
})


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo
}