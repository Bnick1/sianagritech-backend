import express from 'express';
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ message: 'Gateway API working', timestamp: new Date().toISOString() });
});

router.post('/ussd', (req, res) => {
  res.json({ message: 'USSD endpoint received', data: req.body });
});

export default router;