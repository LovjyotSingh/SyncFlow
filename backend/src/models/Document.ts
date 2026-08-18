import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const DocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, default: 'Untitled Document' },
  content: { type: Object, default: {} },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shareToken: { type: String, default: () => randomUUID(), unique: true, index: true },
  invitedEmails: [{ type: String }],
}, { timestamps: true });

export const Document = mongoose.model('Document', DocumentSchema);
