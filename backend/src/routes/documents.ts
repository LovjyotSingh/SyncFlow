import { Router, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import type { Server } from 'socket.io';
import { Document } from '../models/Document';
import { SharedFile } from '../models/SharedFile';
import { User } from '../models/User';
import { requireAuth, AuthRequest } from './auth';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_PAGE = 40;
const PREVIEW_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const router = Router();

router.use(requireAuth);

function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) || '';
}

function accessFilter(userId: string, id?: string) {
  const filter: Record<string, unknown> = {
    $or: [{ owner: userId }, { collaborators: userId }],
  };
  if (id) filter._id = id;
  return filter;
}

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const title = String(req.body?.title || 'Untitled').trim().slice(0, 180) || 'Untitled';
    const document = await Document.create({ title, owner: req.userId });
    res.status(201).json(document);
  } catch (error) {
    console.error('create document failed', error);
    res.status(500).json({ message: 'Could not create the page' });
  }
});

router.get('/user/me', async (req: AuthRequest, res: Response) => {
  try {
    const documents = await Document.find(accessFilter(req.userId!))
      .sort({ updatedAt: -1 })
      .select('title owner collaborators shareToken invitedEmails createdAt updatedAt');
    res.json(documents);
  } catch (error) {
    console.error('list documents failed', error);
    res.status(500).json({ message: 'Could not load your pages' });
  }
});

router.get('/share/:token', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({ shareToken: param(req.params.token) });
    if (!document) {
      return res.status(404).json({ message: 'This link does not match a page' });
    }

    const userId = req.userId!;
    const isOwner = document.owner?.toString() === userId;
    const isCollaborator = document.collaborators.some((id) => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      document.collaborators.push(userId as never);
      await document.save();
    }

    res.json(document);
  } catch (error) {
    console.error('share join failed', error);
    res.status(500).json({ message: 'Could not open the shared page' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id)));
    if (!document) return res.status(404).json({ message: 'Page not found' });
    res.json(document);
  } catch (error) {
    console.error('get document failed', error);
    res.status(500).json({ message: 'Could not open the page' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 180);
    if (!title) return res.status(400).json({ message: 'Title cannot be empty' });

    const document = await Document.findOneAndUpdate(
      accessFilter(req.userId!, param(req.params.id)),
      { title },
      { returnDocument: 'after' },
    );
    if (!document) return res.status(404).json({ message: 'Page not found' });
    res.json(document);
  } catch (error) {
    console.error('rename document failed', error);
    res.status(500).json({ message: 'Could not rename the page' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: param(req.params.id),
      owner: req.userId,
    });
    if (!document) {
      return res.status(403).json({ message: 'Only the owner can delete this page' });
    }
    res.json({ id: param(req.params.id) });
  } catch (error) {
    console.error('delete document failed', error);
    res.status(500).json({ message: 'Could not delete the page' });
  }
});

router.get('/:id/collaborators', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id)))
      .populate('owner', 'name email avatarColor')
      .populate('collaborators', 'name email avatarColor');
    if (!document) return res.status(404).json({ message: 'Page not found' });
    res.json({
      owner: document.owner,
      collaborators: document.collaborators,
      invitedEmails: document.invitedEmails,
      shareToken: document.shareToken,
    });
  } catch (error) {
    console.error('collaborators failed', error);
    res.status(500).json({ message: 'Could not load people on this page' });
  }
});

router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email' });
    }

    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id)));
    if (!document) return res.status(404).json({ message: 'Page not found' });

    const target = await User.findOne({ email });
    if (target) {
      const targetId = String(target._id);
      const alreadyIn = document.owner?.toString() === targetId
        || document.collaborators.some((id) => id.toString() === targetId);
      if (!alreadyIn) document.collaborators.push(target._id as never);
      document.invitedEmails = document.invitedEmails.filter((item) => item !== email);
    } else if (!document.invitedEmails.includes(email)) {
      document.invitedEmails.push(email);
    }
    await document.save();

    const populated = await Document.findById(document._id)
      .populate('owner', 'name email avatarColor')
      .populate('collaborators', 'name email avatarColor');

    res.json({
      message: target ? `${target.name} can edit this page` : `Invite saved for ${email}`,
      owner: populated?.owner,
      collaborators: populated?.collaborators,
      invitedEmails: populated?.invitedEmails || [],
      shareToken: document.shareToken,
    });
  } catch (error) {
    console.error('invite failed', error);
    res.status(500).json({ message: 'Could not invite that person' });
  }
});

router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(param(req.params.id));
    if (!document) return res.status(404).json({ message: 'Page not found' });
    if (document.owner?.toString() === req.userId) {
      return res.status(400).json({ message: 'Owners delete a page instead of leaving it' });
    }
    document.collaborators = document.collaborators.filter((id) => id.toString() !== req.userId);
    await document.save();
    res.json({ id: String(document._id) });
  } catch (error) {
    console.error('leave failed', error);
    res.status(500).json({ message: 'Could not leave the page' });
  }
});

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180);
  return cleaned || 'file';
}

function publicFile(file: {
  _id: unknown;
  name: string;
  mime?: string;
  size: number;
  createdAt?: Date;
  uploadedBy?: { _id?: unknown; name?: string } | string | null;
}) {
  const person = file.uploadedBy && typeof file.uploadedBy === 'object'
    ? { _id: String(file.uploadedBy._id || ''), name: file.uploadedBy.name || 'Someone' }
    : { _id: String(file.uploadedBy || ''), name: 'Someone' };
  return {
    _id: String(file._id),
    name: file.name,
    mime: file.mime || 'application/octet-stream',
    size: file.size,
    createdAt: file.createdAt,
    uploadedBy: person,
  };
}

function notifyFiles(req: AuthRequest, documentId: string) {
  const io = req.app.get('io') as Server | undefined;
  io?.to(documentId).emit('files-changed');
}

function readUpload(req: AuthRequest, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Files must be 10 MB or smaller' });
    }
    return res.status(400).json({ message: 'Could not read that file' });
  });
}

router.get('/:id/files', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id))).select('_id');
    if (!document) return res.status(404).json({ message: 'Page not found' });
    const files = await SharedFile.find({ document: document._id })
      .sort({ createdAt: -1 })
      .select('-data')
      .populate('uploadedBy', 'name');
    res.json(files.map((file) => publicFile(file)));
  } catch (error) {
    console.error('list files failed', error);
    res.status(500).json({ message: 'Could not load shared files' });
  }
});

router.post('/:id/files', readUpload, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file || req.file.size < 1) {
      return res.status(400).json({ message: 'Choose a file to share' });
    }
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id)));
    if (!document) return res.status(404).json({ message: 'Page not found' });

    const count = await SharedFile.countDocuments({ document: document._id });
    if (count >= MAX_FILES_PER_PAGE) {
      return res.status(400).json({ message: 'This page already has 40 shared files' });
    }

    const saved = await SharedFile.create({
      document: document._id,
      name: safeFileName(req.file.originalname),
      mime: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      data: req.file.buffer,
      uploadedBy: req.userId,
    });
    await Document.updateOne({ _id: document._id }, { $set: { updatedAt: new Date() } });

    const created = await SharedFile.findById(saved._id).select('-data').populate('uploadedBy', 'name');
    notifyFiles(req, String(document._id));
    res.status(201).json(publicFile(created || saved));
  } catch (error) {
    console.error('upload file failed', error);
    res.status(500).json({ message: 'Could not share that file' });
  }
});

router.get('/:id/files/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id))).select('_id');
    if (!document) return res.status(404).json({ message: 'Page not found' });
    if (!mongoose.isValidObjectId(param(req.params.fileId))) {
      return res.status(404).json({ message: 'File not found' });
    }
    const file = await SharedFile.findOne({ _id: param(req.params.fileId), document: document._id });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const mime = file.mime || 'application/octet-stream';
    const ascii = file.name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const disposition = PREVIEW_MIME.has(mime) ? 'inline' : 'attachment';
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(file.data);
  } catch (error) {
    console.error('download file failed', error);
    res.status(500).json({ message: 'Could not open that file' });
  }
});

router.delete('/:id/files/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne(accessFilter(req.userId!, param(req.params.id)));
    if (!document) return res.status(404).json({ message: 'Page not found' });
    if (!mongoose.isValidObjectId(param(req.params.fileId))) {
      return res.status(404).json({ message: 'File not found' });
    }
    const file = await SharedFile.findOne({ _id: param(req.params.fileId), document: document._id });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const isOwner = document.owner?.toString() === req.userId;
    const isUploader = file.uploadedBy?.toString() === req.userId;
    if (!isOwner && !isUploader) {
      return res.status(403).json({ message: 'Only the owner or the person who shared it can remove this file' });
    }

    await file.deleteOne();
    await Document.updateOne({ _id: document._id }, { $set: { updatedAt: new Date() } });
    notifyFiles(req, String(document._id));
    res.json({ id: String(file._id) });
  } catch (error) {
    console.error('delete file failed', error);
    res.status(500).json({ message: 'Could not remove that file' });
  }
});

router.post('/:id/revoke-link', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({ _id: param(req.params.id), owner: req.userId });
    if (!document) return res.status(403).json({ message: 'Only the owner can reset the link' });
    document.shareToken = randomUUID();
    await document.save();
    res.json({ shareToken: document.shareToken });
  } catch (error) {
    console.error('revoke link failed', error);
    res.status(500).json({ message: 'Could not reset the link' });
  }
});

export default router;
