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

// GET /:id/share-link — Get the invite link for a document (owner only)
router.get('/:id/share-link', async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, owner: req.userId });
    if (!document) {
      return res.status(403).json({ message: 'Only the document owner can get the share link' });
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({ shareUrl: `${frontendUrl}/doc/${document.shareToken}` });
  } catch (error) {
    res.status(500).json({ message: 'Error getting share link' });
  }
});

export default router;
