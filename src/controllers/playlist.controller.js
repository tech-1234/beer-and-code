import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body
    //TODO: create playlist
    if (!(name || description)) {
        throw new ApiError(400, "name and description is required")
    }
    try {
        // const owner = await User.findById(req.user?._id)
        const owner = await User.findById(req.user?._id, { _id: 1 });
        if (!owner) {
            throw new ApiError(401, "Unauthorized user");
        }
        const playlist = await Playlist.create({
            name,
            description,
            owner: owner?._id,
        })
        if (!playlist) throw new ApiError(500, "Playlist not created");

        return res.status(200)
            .json(
                new ApiResponse(201,
                    playlist,
                    "Playlist created successfully"
                )
            )

    } catch (error) {
        throw new ApiError(404, error?.message || "Something went wrong while creating playlist")
    }
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params
    //TODO: get user playlists
    if (!isValidObjectId(userId)) throw new ApiError("Unauthorized user");

    try {
        const user = await User.findById(userId, { _id: 1 });
        if (!user) throw new ApiError(404, "User not found");
        const playlistAggregate = await Playlist.aggregate(
            [
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(userId)
                    },
                },
                {
                    $lookup: {
                        from: "videos",
                        localField: "videos",
                        foreignField: "_id",
                        as: "videos",
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
                                    videoOwner: {
                                        $first: "$owner"
                                    }
                                },
                            },

                            {
                                $unset: "owner"
                            },

                            {
                                $addFields: {
                                    videoFile: "$videoFile.url"
                                },
                            },

                            {
                                $addFields: {
                                    thumbnail: "$thumbnail.url"
                                },
                            },

                        ]
                    },

                },
                {
                    $unwind: "$videos"
                },
            ]
        )

        console.log(playlistAggregate)
        if (!playlistAggregate) throw new ApiError(404, "Playlist not found");

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    playlistAggregate,
                    "User playlists found successfully"
                )
            )

    } catch (error) {
        throw new ApiError(404, "Playlist not found")
    }

})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    if (!(isValidObjectId(playlistId) || isValidObjectId(videoId))) throw new ApiError(400, "Playlist or video id is not valid id")

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "video not found");

    const playlist = await Playlist.findById(playlistId, { _id: 1 });
    if (!playlist) throw new ApiError(404, "Playlist Not found");

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )
    if (!updatedPlaylist) throw new ApiError(500, "playlist not updated");

    return res.status(200)
        .json(new ApiResponse(
            200,
            updatedPlaylist,
            "Video added to playlist successfully"
        ))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    //TODO: get playlist by id
    if (!isValidObjectId(playlistId)) throw new ApiError(400, "playlist id is not valid")

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "playlist not found");
    const playlistAggregate = await Playlist.aggregate(
        [
            // searching for exact document which has the '_id' as same as 'playlistId'
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(playlistId)
                }
            },
            // videos array and in each video object - 
            // video details (_id, videoFile, thumbnail, title, duration, views, isPublished, timestamps, description) 
            // video owner details as (videoOwner) object inside each video object
            // video owner details (_id, fullName, username, avatar.url)
            {
                // In videos document searching for video id
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    // now the new document as 'videos' after getting videoList
                    pipeline: [
                        {
                            $match: { deleted: { $ne: true } } // Filter out deleted videos
                        },
                        // In users document searching for video owners
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                // now the new document as 'owner' after getting video ownerList
                                pipeline: [
                                    {
                                        // getting video owner details like (_id, fullName, avatar.url, username)
                                        $project: {
                                            fullName: 1,
                                            _id: 1,
                                            avatar: "$avatar.url",
                                            username: 1
                                        },
                                    }
                                ]
                            }
                        },
                        // adding new field videoOwner object which will consist of owner object
                        {
                            $addFields: {
                                videoOwner: {
                                    $first: "$owner"
                                }
                            }
                        },
                        // removing the owner object now
                        {
                            $project: {
                                owner: 0
                            }
                        },
                        // extract videoFile.url from videoFile object and name as videoFile
                        {
                            $addFields: {
                                videoFile: "$videoFile.url",
                            }
                        },
                        // extract thumbnail.url from thumbnail object and name as thumbnail
                        {
                            $addFields: {
                                thumbnail: "$thumbnail.url"
                            }
                        }

                    ]
                }
            },
            // playlist owner array with only 1 object
            // playlist onwer details(_id, username, fullname, avatar.url)
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            // getting playlist owner details like (_id, fullName, avatar.url, username)
                            $project: {
                                fullName: 1,
                                _id: 1,
                                avatar: "$avatar.url",
                                username: 1
                            },
                        }
                    ]
                }
            },
            // desconstruct playlist owner array in 1 object as owner
            {
                $addFields: {
                    owner: {
                        $first: "$owner"
                    }
                }
            }

        ]
    )

    if (!playlistAggregate) throw new ApiError(404, "playlist not found");

    return res.status(200)
        .json(new ApiResponse(
            201,
            playlistAggregate,
            "Playlist fetched successfully"))

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    // TODO: remove video from playlist
    const { playlistId, videoId } = req.params
    if (!(isValidObjectId(playlistId) || isValidObjectId(videoId))) throw new ApiError(400, "Playlist or video id is not valid id")

    const video = await Video.findById(videoId, { _id: 1 });
    if (!video) throw new ApiError(404, "video not found");

    const playlist = await Playlist.findById(playlistId, { _id: 1 });
    if (!playlist) throw new ApiError(404, "Playlist Not found");

    const isVideoInPlaylist = await Playlist.findOne({
        _id: playlistId,
        videos: videoId
    })

    if (!isVideoInPlaylist) throw new ApiError(404, "Video not found in playlist");

    const removedVideoPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )


    if (!removedVideoPlaylist) throw new ApiError(500, "playlist not updated");
    return res.status(200)
        .json(new ApiResponse(
            200,
            removedVideoPlaylist,
            "Video removed from playlist successfully"
        ))

})

export {
    createPlaylist,
    getUserPlaylists,
    addVideoToPlaylist,
    getPlaylistById,
    removeVideoFromPlaylist
}