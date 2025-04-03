const Event = require('../models/event.model');
const path = require('path');
const fs = require('fs');

const eventController = {
  // Get all events
getAllEvents: async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    
    // Add full image URLs to each event
    const eventsWithFullImageUrls = events.map(event => ({
      ...event._doc,
      image: event.image ? `${req.protocol}://${req.get('host')}${event.image}` : null
    }));
    
    res.status(200).json({ 
      status: 'success', 
      data: eventsWithFullImageUrls,
      count: events.length
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch events',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
},

  // Create new event
  createEvent: async (req, res) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "Event image is required" });
      }
  
      // Prepare event data
      const eventData = {
        eventName: req.body.eventName,
        eventDescription: req.body.eventDescription,
        eventDate: req.body.eventDate,
        eventTime: req.body.eventTime,
        venue: req.body.venue,
        totalTickets: req.body.totalTickets,
        status: req.body.status || "Upcoming",
        image: `/images/${req.file.filename}`, // This is the path that will be saved in DB
      };
  
      // Handle ticket types
      if (req.body.ticketTypes && typeof req.body.ticketTypes === 'string') {
        eventData.ticketTypes = JSON.parse(req.body.ticketTypes);
      } else if (req.body.ticketTypes) {
        eventData.ticketTypes = req.body.ticketTypes;
      }
  
      // Create and save the event
      const newEvent = new Event(eventData);
      const savedEvent = await newEvent.save();
  
      res.status(201).json(savedEvent);
    } catch (err) {
      // Delete the uploaded file if error occurs
      if (req.file) {
        fs.unlink(path.join(__dirname, '../public', req.file.path), (err) => {
          if (err) console.error('Error deleting uploaded file:', err);
        });
      }
      res.status(500).json({ error: err.message });
    }
  },

  // Get single event
getEvent: async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Event not found' 
      });
    }

    // Create a proper image URL
    const eventWithFullImageUrl = {
      ...event._doc,
      image: event.image ? `${req.protocol}://${req.get('host')}${event.image}` : null
    };
    
    res.status(200).json({ 
      status: 'success', 
      data: eventWithFullImageUrl 
    });
  } catch (err) {
    console.error('Error fetching event:', err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid event ID format'
      });
    }
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch event',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
},

  // Update event
  updateEvent: async (req, res) => {
    try {
      const eventId = req.params.id;
      let updates = {};
  
      // Process non-file fields
      if (req.body.eventName) updates.eventName = req.body.eventName;
      if (req.body.eventDescription) updates.eventDescription = req.body.eventDescription;
      if (req.body.eventDate) updates.eventDate = req.body.eventDate;
      if (req.body.eventTime) updates.eventTime = req.body.eventTime;
      if (req.body.venue) updates.venue = req.body.venue;
      if (req.body.totalTickets) updates.totalTickets = req.body.totalTickets;
      if (req.body.status) updates.status = req.body.status;
  
      // Process ticket types
      if (req.body.ticketTypes) {
        try {
          updates.ticketTypes = typeof req.body.ticketTypes === 'string' 
            ? JSON.parse(req.body.ticketTypes)
            : req.body.ticketTypes;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid ticketTypes format' });
        }
      }
  
      // Process image if uploaded
      if (req.file) {
        const newImagePath = `/images/${req.file.filename}`;
        
        // Get old image path to delete it later
        const oldEvent = await Event.findById(eventId);
        const oldImagePath = oldEvent?.image;
        
        updates.image = newImagePath;
  
        // Delete old image file
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '../public', oldImagePath);
          if (fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        }
      }
  
      const updatedEvent = await Event.findByIdAndUpdate(
        eventId,
        { $set: updates },
        { new: true, runValidators: true }
      );
  
      if (!updatedEvent) {
        // Clean up if we uploaded a new image but event wasn't found
        if (req.file) {
          fs.unlinkSync(path.join(__dirname, '../public/images', req.file.filename));
        }
        return res.status(404).json({ message: 'Event not found' });
      }
  
      res.status(200).json(updatedEvent);
    } catch (error) {
      // Clean up uploaded file if error occurred
      if (req.file) {
        fs.unlinkSync(path.join(__dirname, '../public/images', req.file.filename));
      }
      
      console.error('Error updating event:', error);
      res.status(500).json({ 
        message: 'Failed to update event',
        error: error.message 
      });
    }
  },

  // Delete event
  deleteEvent: async (req, res) => {
    try {
      const deletedEvent = await Event.findByIdAndDelete(req.params.id);
      
      if (!deletedEvent) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Event not found' 
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Event deleted successfully',
        data: {
          id: deletedEvent._id,
          title: deletedEvent.title
        }
      });
    } catch (err) {
      console.error('Error deleting event:', err);
      
      if (err.name === 'CastError') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid event ID format'
        });
      }
      
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to delete event',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
};

module.exports = eventController;