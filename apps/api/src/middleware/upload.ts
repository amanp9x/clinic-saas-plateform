import multer from 'multer';
import { ValidationError } from '../utils/app-error.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new ValidationError('Only JPEG, PNG, or WEBP images are allowed'));
      return;
    }
    cb(null, true);
  },
});
