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

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/** Clinic verification documents — PDFs or scanned images, up to 10MB. Stored privately (see
 * storage.service.ts::savePrivateFile), never under the public `/uploads` static mount. */
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      cb(new ValidationError('Only PDF, JPEG, PNG, or WEBP documents are allowed'));
      return;
    }
    cb(null, true);
  },
});
