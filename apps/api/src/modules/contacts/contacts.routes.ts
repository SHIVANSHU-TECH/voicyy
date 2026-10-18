import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import type { ContactsService } from './contacts.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const ConfirmSchema = z.object({
  previewId: z.string().min(1),
  rowIndexes: z.array(z.number().int().positive()).min(1),
  corrections: z
    .array(
      z.object({
        rowIndex: z.number().int().positive(),
        name: z.string().optional(),
        phoneRaw: z.string().optional(),
        email: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
        consentCaptured: z.boolean().optional(),
      }),
    )
    .optional(),
});

export function createContactsRouter(service: ContactsService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ contacts: service.list(q) });
  });

  router.post('/preview', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw new ValidationError('file is required');
      const preview = await service.previewUpload({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mime: req.file.mimetype,
      });
      res.status(201).json({
        previewId: preview.id,
        sourceFile: preview.sourceFile,
        sourceKind: preview.sourceKind,
        scriptText: preview.scriptText,
        rows: preview.rows,
        summary: {
          total: preview.rows.length,
          valid: preview.rows.filter((r) => r.valid).length,
          invalid: preview.rows.filter((r) => !r.valid).length,
          duplicates: preview.rows.filter((r) => r.duplicateOfContactId || r.duplicateInBatch)
            .length,
        },
        requiresConfirmation: true,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/preview/:previewId', (req, res) => {
    const preview = service.getPreview(String(req.params.previewId));
    res.json({ preview });
  });

  router.post('/confirm', (req, res) => {
    const parsed = ConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid confirm payload', parsed.error.flatten());
    }
    const result = service.confirmImport(parsed.data);
    res.status(201).json({
      savedCount: result.saved.length,
      skipped: result.skipped,
      invalid: result.invalid,
      contacts: result.saved,
    });
  });

  router.get('/:id', (req, res) => {
    res.json({ contact: service.get(String(req.params.id)) });
  });

  return router;
}
