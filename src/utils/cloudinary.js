import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'
import { ApiError } from './ApiError.js'

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // upload the file on cloudinary
        const response = await cloudinary.uploader
            .upload(localFilePath, {
                resource_type: "auto"
            }
            )
        // console.log("File is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        throw new ApiError(500, error?.message || "Server error")
    }
}

const deleteOnCloudinary = async (oldImageUrl, publicId) => {
    try {
        if (!(oldImageUrl || publicId)) {
            throw new ApiError(404, "OldImageUrl or publicId required")
        }
        const response = await cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: `${oldImageUrl.includes("image") ? "image" : "video"}`
            }
        )
        return response;
    } catch (error) {
        throw new ApiError(500, error?.message || "Server error");
    }
}

export { uploadOnCloudinary, deleteOnCloudinary }
