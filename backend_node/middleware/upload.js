const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from env
cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });

// Use memory storage so we can pass the buffer to Cloudinary and face-api
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder
 * @returns {Promise<string>} Cloudinary secure URL
 */
function uploadToCloudinary(buffer, folder = 'employees') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { upload, uploadToCloudinary };
