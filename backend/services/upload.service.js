const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const { cloudinaryFolder } = require('../config/env');
async function uploadLocalImageToCloudinary(localFilePath, folder = cloudinaryFolder) {
  try {
    const result = await cloudinary.uploader.upload(localFilePath, { folder });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    fs.unlink(localFilePath, () => {});
  }
}

module.exports = { uploadLocalImageToCloudinary };