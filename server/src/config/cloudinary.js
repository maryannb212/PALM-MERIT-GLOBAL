import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const cleanEnv = (key) => process.env[key]?.trim().replace(/^["']|["']$/g, '') || '';

// Cloudinary Configuration
const cloud_name = cleanEnv('CLOUDINARY_CLOUD_NAME');
const api_key = cleanEnv('CLOUDINARY_API_KEY');
const api_secret = cleanEnv('CLOUDINARY_API_SECRET');

if (process.env.NODE_ENV === 'production') {
  console.log(`[Cloudinary] Configured with cloud_name: ${cloud_name}, api_key: ${api_key.substring(0, 5)}..., api_secret: ${api_secret.substring(0, 3)}...`);
}

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'palm_merit_global',
    // Removed allowed_formats from here as it's handled by fileFilter and can cause signature issues
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export { cloudinary, upload };
