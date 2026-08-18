import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // optional for future OAuth
  avatarColor: { type: String, default: '#6366f1' },
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
