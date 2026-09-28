import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Document } from '../models/Document';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'syncflow-dev-secret';

const AVATAR_COLORS = [
  '#9a4d24', '#2f5d50', '#3d4f8a', '#7a3e55',
  '#3f5f2a', '#6b4c2a', '#1f4e5f', '#5c3d73',
];

export interface AuthRequest extends Request {
  userId?: string;
}

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user: { _id: unknown; name: string; email: string; avatarColor: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Sign in to continue' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (name.length > 80) {
      return res.status(400).json({ message: 'Name is too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      avatarColor: randomColor(),
    });

    await Document.updateMany(
      { invitedEmails: email },
      { $addToSet: { collaborators: user._id }, $pull: { invitedEmails: email } },
    );

    res.status(201).json({ token: signToken(String(user._id)), user: publicUser(user) });
  } catch (error) {
    console.error('register failed', error);
    res.status(500).json({ message: 'Could not create the account' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    res.json({ token: signToken(String(user._id)), user: publicUser(user) });
  } catch (error) {
    console.error('login failed', error);
    res.status(500).json({ message: 'Could not sign in' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId).select('name email avatarColor');
  if (!user) return res.status(401).json({ message: 'Account not found' });
  res.json({ user: publicUser(user) });
});

export default router;
