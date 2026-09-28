import mongoose from 'mongoose';

const SharedFileSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  name: { type: String, required: true },
  mime: { type: String, default: 'application/octet-stream' },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const SharedFile = mongoose.model('SharedFile', SharedFileSchema);
