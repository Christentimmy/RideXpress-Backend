import cloudinary from "../config/cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";


const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: "profile_pictures",
        format: "png",
        public_id: file.originalname.split(".")[0],
    }),
});

const uploadProfile = multer({
    limits: {
        fileSize: 3 * 1024 * 1024,
    },
    storage: profileStorage
});


const morestorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: "driver_documents",
        format: "png",
        public_id: file.originalname.split(".")[0],
    }),
});


const uploadMore = multer({ storage: morestorage });

const messageMediaStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        return {
            folder: "message_media",
            resource_type: "auto",
            public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
        };
    },
});


const uploadMessageMedia = multer({
    storage: messageMediaStorage,
    limits: { fileSize: 150 * 1024 * 1024 }
});


export const uploadToCloudinary = async (
    file: Express.Multer.File,
    folder: string
) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder,
                    format: "png",
                    public_id: (file.originalname?.split(".")[0]) || Date.now().toString(),
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            )
            .end(file.buffer);
    });
};



const upStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        return {
            folder: "support-storage",
            resource_type: "auto",
            public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
        };
    },
});

export const uploadImage = multer({
    storage: upStorage,
    limits: { fileSize: 3 * 1024 * 1024 },
});



export { uploadProfile, uploadMore, uploadMessageMedia };



