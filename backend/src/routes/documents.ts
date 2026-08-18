import { Router } from 'express';
import { Document } from '../models/Document';

const router = Router();

// Create a new document
router.post('/', async (req, res) => {
  try {
    const { title, ownerId } = req.body;
    const document = new Document({ title, owner: ownerId });
    await document.save();
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document' });
  }
});

// Get all documents for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const documents = await Document.find({ owner: req.params.userId }).sort({ updatedAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// Get a single document by ID
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document' });
  }
});

export default router;
