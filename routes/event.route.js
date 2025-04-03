const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const upload = require('../middleware/multer');
const fs = require('fs');
const path = require('path');


// Add this route before module.exports
router.get('/images/:filename', (req, res) => {
    const filePath = path.join(__dirname, '../public/images', req.params.filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ 
        status: 'error',
        message: 'Image not found'
      });
    }
  });

router.post('/', upload.single('image'), eventController.createEvent);

// GET /api/events - Get all events
router.get('/', eventController.getAllEvents);

// GET /api/events/:id - Get single event
router.get('/:id', eventController.getEvent);

// PUT /api/events/:id - Update event
// router.put('/:id', eventController.updateEvent);
router.put('/:id', upload.single('image'), eventController.updateEvent);

// DELETE /api/events/:id - Delete event
router.delete('/:id', eventController.deleteEvent);

module.exports = router;