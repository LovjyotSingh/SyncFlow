import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { Document } from '../models/Document';
import { User } from '../models/User';
import { requireAuth, AuthRequest } from './auth';

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
