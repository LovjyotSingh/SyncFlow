import { Router, Response } from 'express';
import { Document } from '../models/Document';
import { requireAuth, AuthRequest } from './auth';

const router = Router();

// All document routes require authentication
router.use(requireAuth);

// POST / — Create a new document (owner = logged-in user from JWT)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const document = new Document({ title: title || 'Untitled Document', owner: req.userId });
    await document.save();
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document' });
  }
});

// GET /user/me — Get all documents for the logged-in user
router.get('/user/me', async (req: AuthRequest, res: Response) => {
  try {
    const documents = await Document.find({
      $or: [
        { owner: req.userId },
        { collaborators: req.userId },
      ],
    }).sort({ updatedAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// GET /share/:token — Join a document via share link
// Anyone with the link (and a valid JWT) is granted access and added as collaborator
router.get('/share/:token', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const document = await Document.findOne({ shareToken: token });

    if (!document) {
      return res.status(404).json({ message: 'Document not found or link has expired' });
    }

    // Auto-add as collaborator if not already owner or collaborator
    const isOwner = document.owner?.toString() === req.userId;
    const isCollaborator = document.collaborators.some(
      (c: any) => c.toString() === req.userId
    );

    if (!isOwner && !isCollaborator) {
      document.collaborators.push(req.userId as any);
      await document.save();
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error accessing shared document' });
  }
});

// GET /:id — Get a single document by ID (owner or collaborator only)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.userId },
        { collaborators: req.userId },
      ],
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document' });
  }
});

// PUT /:id — Update document title
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const document = await Document.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ owner: req.userId }, { collaborators: req.userId }],
      },
      { title },
      { new: true }
    );
    if (!document) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document' });
  }
});

// DELETE /:id — Delete document (owner only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!document) {
      return res.status(403).json({ message: 'Only the document owner can delete this document' });
    }
    res.json({ message: 'Document deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document' });
  }
});

// POST /:id/invite — Invite a user/friend by email
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const document = await Document.findOne({
      _id: req.params.id,
      $or: [{ owner: req.userId }, { collaborators: req.userId }],
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists in the system
    const { User } = await import('../models/User');
    const targetUser = await User.findOne({ email: normalizedEmail });

    if (targetUser) {
      const isAlreadyCollaborator = document.collaborators.some(
        (c: any) => c.toString() === targetUser._id.toString()
      );
      const isOwner = document.owner?.toString() === targetUser._id.toString();

      if (!isAlreadyCollaborator && !isOwner) {
        document.collaborators.push(targetUser._id as any);
      }
    }

    if (!document.invitedEmails.includes(normalizedEmail)) {
      document.invitedEmails.push(normalizedEmail);
    }

    await document.save();

    // Return populated collaborators
    const populated = await Document.findById(document._id)
      .populate('owner', 'name email avatarColor')
      .populate('collaborators', 'name email avatarColor');

    res.json({
      message: targetUser ? `Added ${targetUser.name} as collaborator` : `Invited ${normalizedEmail}`,
      document: populated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error inviting collaborator' });
  }
});

// GET /:id/collaborators — Get populated list of collaborators & owner
router.get('/:id/collaborators', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      $or: [{ owner: req.userId }, { collaborators: req.userId }],
    })
      .populate('owner', 'name email avatarColor')
      .populate('collaborators', 'name email avatarColor');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({
      owner: document.owner,
      collaborators: document.collaborators,
      invitedEmails: document.invitedEmails,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching collaborators' });
  }
});

// POST /:id/leave — Exit collaboration / leave a shared workspace
router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const isOwner = document.owner?.toString() === req.userId;
    if (isOwner) {
      return res.status(400).json({ message: 'Owner cannot leave their own document. Delete it instead.' });
    }

    // Remove user from collaborators
    document.collaborators = document.collaborators.filter(
      (c: any) => c.toString() !== req.userId
    );
    await document.save();

    res.json({ message: 'Left workspace successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Error leaving workspace' });
  }
});

// DELETE /:id/collaborators/:userId — Remove a collaborator (owner only)
router.delete('/:id/collaborators/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.userId,
    });

    if (!document) {
      return res.status(403).json({ message: 'Only the document owner can remove collaborators' });
    }

    const targetId = req.params.userId;
    document.collaborators = document.collaborators.filter(
      (c: any) => c.toString() !== targetId
    );
    await document.save();

    const populated = await Document.findById(document._id)
      .populate('owner', 'name email avatarColor')
      .populate('collaborators', 'name email avatarColor');

    res.json({
      message: 'Collaborator removed successfully',
      owner: populated?.owner,
      collaborators: populated?.collaborators,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error removing collaborator' });
  }
});

// POST /:id/revoke-link — Revoke & regenerate share link (owner only)
router.post('/:id/revoke-link', async (req: AuthRequest, res: Response) => {
  try {
    const { randomUUID } = await import('crypto');
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.userId,
    });

    if (!document) {
      return res.status(403).json({ message: 'Only the document owner can revoke the share link' });
    }

    document.shareToken = randomUUID();
    await document.save();

    res.json({
      message: 'Share link revoked and regenerated',
      shareToken: document.shareToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error revoking share link' });
  }
});

// POST /:id/kick-all — Kick all collaborators / make workspace private (owner only)
router.post('/:id/kick-all', async (req: AuthRequest, res: Response) => {
  try {
    const { randomUUID } = await import('crypto');
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.userId,
    });

    if (!document) {
      return res.status(403).json({ message: 'Only the document owner can kick collaborators' });
    }

    document.collaborators = [];
    document.shareToken = randomUUID();
    await document.save();

    res.json({
      message: 'All collaborators have been kicked and workspace made private',
      shareToken: document.shareToken,
      collaborators: [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error kicking collaborators' });
  }
});

export default router;

