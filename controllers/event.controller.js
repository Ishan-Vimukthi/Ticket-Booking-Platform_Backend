const Event = require('../models/event.model');
const Booking = require('../models/booking.model');
const Venue = require('../models/venue.model'); // Import Venue model
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const sendEmail = require(path.resolve(__dirname, '../utils/email.js'));
const fs = require('fs').promises; // Use promises version of fs
const { generateQrCodeBuffer } = require(path.resolve(__dirname, '../utils/qrCodeGenerator.js'));

const eventController = {
  // Get all events
  getAllEvents: async (req, res) => {
    try {
      const { search } = req.query;
      let query = {};

      if (search) {
        query.eventName = { $regex: search, $options: 'i' }; // Case-insensitive search
      }

      // Populate venue name directly in the initial query
      const events = await Event.find(query)
        .sort({ createdAt: -1 })
        .populate('venue', 'name') // Populate venue and select only its name
        .lean();

      const eventsWithDetails = await Promise.all(events.map(async (event) => {
        const bookingsForEvent = await Booking.find({ eventId: event._id }).lean();
        
        let eventRevenue = 0;
        let eventTicketsSold = 0;

        bookingsForEvent.forEach(booking => {
          eventRevenue += booking.totalAmount || 0;
          eventTicketsSold += booking.seats ? booking.seats.length : 0;
        });

        return {
          ...event,
          image: event.image ? `${req.protocol}://${req.get('host')}${event.image}` : null,
          eventRevenue,
          eventTicketsSold,
        };
      }));

      res.status(200).json({
        status: 'success',
        data: eventsWithDetails,
        count: eventsWithDetails.length
      });
    } catch (err) {
      console.error('Error fetching events with details:', err);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch events with details',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },

  // Create new event
  createEvent: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Event image is required" });
      }

      const eventData = {
        eventName: req.body.eventName,
        eventDescription: req.body.eventDescription,
        eventDate: req.body.eventDate,
        eventTime: req.body.eventTime,
        venue: req.body.venue,
        totalTickets: req.body.totalTickets,
        status: req.body.status || "Upcoming",
        image: `/images/${req.file.filename}`
      };

      if (req.body.ticketTypes) {
        eventData.ticketTypes = typeof req.body.ticketTypes === 'string'
          ? JSON.parse(req.body.ticketTypes)
          : req.body.ticketTypes;
      }

      // Seat handling logic with detailed logging
      console.log('[createEvent] Initial req.body.venue:', req.body.venue);
      console.log('[createEvent] Initial req.body.seats provided?:', !!req.body.seats);

      if (req.body.seats) {
        console.log('[createEvent] Using seats provided in req.body.seats');
        try {
          eventData.seats = typeof req.body.seats === 'string'
            ? JSON.parse(req.body.seats)
            : req.body.seats;
          console.log('[createEvent] Parsed req.body.seats:', eventData.seats.length, 'seats');
        } catch (e) {
          console.error('[createEvent] Error parsing req.body.seats:', e);
          return res.status(400).json({ error: 'Invalid seat data format in request body' });
        }
      } else if (eventData.venue) {
        console.log(`[createEvent] Attempting to generate seats from venue ID: ${eventData.venue}`);
        try {
          const venueDoc = await Venue.findById(eventData.venue);
          console.log('[createEvent] Fetched venueDoc:', venueDoc ? `ID: ${venueDoc._id}, Name: ${venueDoc.name}` : 'Not found');

          if (venueDoc && venueDoc.seatMap && venueDoc.seatMap.rows > 0 && venueDoc.seatMap.cols > 0) {
            const seats = [];
            const totalRows = venueDoc.seatMap.rows;
            const totalCols = venueDoc.seatMap.cols;
            console.log(`[createEvent] Generating seats for venue: ${venueDoc.name}, Rows: ${totalRows}, Cols: ${totalCols}`);
            
            for (let i = 0; i < totalRows; i++) {
              const rowLetter = String.fromCharCode('A'.charCodeAt(0) + i);
              for (let j = 1; j <= totalCols; j++) {
                seats.push({
                  id: `${rowLetter}${j}`,
                  isBooked: false
                });
              }
            }
            eventData.seats = seats;
            console.log('[createEvent] Generated seats count:', seats.length);
          } else {
            eventData.seats = [];
            console.warn(`[createEvent] Venue ${eventData.venue} found, but no valid seatMap (rows/cols missing or zero). Event will have no seats generated from venue.`);
            if(venueDoc && venueDoc.seatMap) {
              console.warn(`[createEvent] Venue seatMap details: Rows: ${venueDoc.seatMap.rows}, Cols: ${venueDoc.seatMap.cols}`);
            } else if (venueDoc) {
              console.warn(`[createEvent] Venue ${eventData.venue} does not have a seatMap defined.`);
            }
          }
        } catch (venueError) {
          console.error(`[createEvent] Error fetching venue ${eventData.venue} for seat generation:`, venueError);
          eventData.seats = []; // Default to empty if venue fetch fails
          console.warn('[createEvent] Event will have no seats due to venue fetch/processing error.');
        }
      } else {
        eventData.seats = [];
        console.log('[createEvent] No req.body.seats and no eventData.venue. Event will have no seats.');
      }

      console.log('[createEvent] Final eventData before saving (seats preview):', 
        eventData.seats ? `${eventData.seats.length} seats` : 'No seats array', 
        eventData.seats && eventData.seats.length > 0 ? eventData.seats.slice(0, 5) : ''); // Log first 5 seats if any

      const newEvent = new Event(eventData);
      const savedEvent = await newEvent.save();

      res.status(201).json(savedEvent);
    } catch (err) {
      console.error('[createEvent] CRITICAL ERROR in createEvent:', err); // Enhanced error logging
      if (req.file) {
        fs.unlink(path.join(__dirname, '../public', req.file.path), (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting uploaded file after error:', unlinkErr);
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

      if (req.body.eventName) updates.eventName = req.body.eventName;
      if (req.body.eventDescription) updates.eventDescription = req.body.eventDescription;
      if (req.body.eventDate) updates.eventDate = req.body.eventDate;
      if (req.body.eventTime) updates.eventTime = req.body.eventTime;
      if (req.body.venue) updates.venue = req.body.venue;
      if (req.body.totalTickets) updates.totalTickets = req.body.totalTickets;
      if (req.body.status) updates.status = req.body.status;

      if (req.body.ticketTypes) {
        try {
          updates.ticketTypes = typeof req.body.ticketTypes === 'string'
            ? JSON.parse(req.body.ticketTypes)
            : req.body.ticketTypes;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid ticketTypes format' });
        }
      }

      // Handle seat updates - Note: This does NOT regenerate seats if venue changes.
      // Seat regeneration on venue change is a more complex feature.
      if (req.body.seats) {
        try {
          updates.seats = typeof req.body.seats === 'string'
            ? JSON.parse(req.body.seats)
            : req.body.seats;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid seats format' });
        }
      }

      if (req.file) {
        const newImagePath = `/images/${req.file.filename}`;
        const oldEvent = await Event.findById(eventId);
        if (oldEvent && oldEvent.image) {
          const fullOldPath = path.join(__dirname, '../public', oldEvent.image);
          if (fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        }
        updates.image = newImagePath;
      }

      const updatedEvent = await Event.findByIdAndUpdate(
        eventId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!updatedEvent) {
        if (req.file) {
          // If event not found, and new image was uploaded, delete it.
          fs.unlinkSync(path.join(__dirname, '../public/images', req.file.filename));
        }
        return res.status(404).json({ message: 'Event not found' });
      }

      res.status(200).json(updatedEvent);
    } catch (error) {
      if (req.file) {
        // If any error occurs and new image was uploaded, delete it.
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
      // Optionally, delete associated image if it exists
      if (deletedEvent.image) {
        const imagePath = path.join(__dirname, '../public', deletedEvent.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      res.status(200).json({
        status: 'success',
        message: 'Event deleted successfully',
        data: {
          id: deletedEvent._id,
          eventName: deletedEvent.eventName // Corrected from title to eventName
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
  },

  // Create Booking
  createBooking: async (req, res) => {
    const { eventId, selectedSeats, ticketHolderDetails, paymentMethodId, totalPrice } = req.body;

    if (!eventId || !selectedSeats || !selectedSeats.length || !ticketHolderDetails || !paymentMethodId || totalPrice === undefined) {
      return res.status(400).json({ message: 'Missing required booking information.' });
    }

    try {
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
      }

      // Pre-check: Ensure the event has a seating plan defined
      if (!event.seats || event.seats.length === 0) {
        console.warn(`[createBooking] Event ${eventId} has no seats or empty seats array. Aborting booking.`);
        return res.status(400).json({ message: 'This event has no seating plan defined. Please configure seats for this event.' });
      }

      // 1. Verify seat availability (critical section)
      const seatsToBookDetails = []; // Store details for booking
      for (const selectedSeat of selectedSeats) {
        const seat = event.seats.find(s => s.id === selectedSeat.seatId);
        if (!seat) {
          return res.status(400).json({ message: `Seat ${selectedSeat.seatId} not found in this event.` });
        }
        if (seat.isBooked) {
          return res.status(400).json({ message: `Seat ${selectedSeat.seatId} is already booked. Please select different seats.` });
        }
        seatsToBookDetails.push({ seatId: seat.id, ticketType: selectedSeat.ticketType });
      }

      // Backend price calculation
      let calculatedTotalPrice = 0;
      for (const selectedSeat of selectedSeats) {
        const ticketType = event.ticketTypes.find(tt => tt.type === selectedSeat.ticketType);
        if (ticketType) {
          calculatedTotalPrice += ticketType.price;
        }
      }

      // Apply discount based on the number of seats
      const numberOfSeats = selectedSeats.length;
      let discountPercentage = 0;
      if (numberOfSeats > 10) {
        discountPercentage = 0.25; // 25% discount
      } else if (numberOfSeats >= 5) {
        discountPercentage = 0.10; // 10% discount
      }

      const discountedPrice = calculatedTotalPrice * (1 - discountPercentage);


      // 2. Create Stripe PaymentIntent
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(discountedPrice * 100), // Amount in cents
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true, // Confirm the payment immediately
          automatic_payment_methods: { // Explicitly disable redirects
            enabled: true,
            allow_redirects: 'never',
          },
          description: `Booking for ${event.eventName} - Seats: ${seatsToBookDetails.map(s => s.seatId).join(', ')}`,
          metadata: {
            eventId: eventId,
            seats: seatsToBookDetails.map(s => s.seatId).join(', '),
            customer_name: ticketHolderDetails.name,
            customer_email: ticketHolderDetails.email,
          },
        });

      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        // Send a more generic message to client, but log specific error
        return res.status(500).json({ message: 'Payment processing failed.', errorDetail: stripeError.message }); 
      }

      // 3. If payment is successful (paymentIntent.status === 'succeeded')
      if (paymentIntent.status === 'succeeded') {
        // Mark seats as booked
        for (const seatDetail of seatsToBookDetails) {
          const seat = event.seats.find(s => s.id === seatDetail.seatId);
          if (seat) { 
            seat.isBooked = true;
          }
        }
        await event.save();

        // 4. Create and save the Booking document
        const newBooking = new Booking({
          eventId: eventId,
          seats: seatsToBookDetails, // Storing as an array of objects with seatId and ticketType
          ticketHolderName: ticketHolderDetails.name,
          ticketHolderEmail: ticketHolderDetails.email,
          ticketHolderPhone: ticketHolderDetails.phone,
          totalAmount: discountedPrice,
          paymentId: paymentIntent.id,
          bookingDate: new Date(),
        });
        await newBooking.save();

        res.status(201).json({
          message: 'Booking successful!',
          bookingId: newBooking._id,
          event: { eventName: event.eventName, eventDate: event.eventDate },
          bookedSeats: seatsToBookDetails.map(s => s.seatId),
          ticketHolder: ticketHolderDetails,
          totalPaid: discountedPrice
        });

        // Send confirmation email with QR code
        try {
          // 1. Gather all necessary data
          const venue = await Venue.findById(event.venue);
          const venueName = venue ? venue.name : 'N/A';
          const formattedEventDate = new Date(event.eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const formattedTotalPrice = discountedPrice.toFixed(2);
          const currentYear = new Date().getFullYear();
          const qrCodeText = `BookingID:${newBooking._id}|Event:${event.eventName}|User:${ticketHolderDetails.email}`; // Example text for QR

          // 2. Generate QR code
          const qrCodeBuffer = await generateQrCodeBuffer(qrCodeText);

          // 3. Read HTML email template
          const templatePath = path.resolve(__dirname, '../email_templates/ticket_template.html');
          let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

          // 4. Replace placeholders
          htmlTemplate = htmlTemplate
            .replace(/{{eventName}}/g, event.eventName)
            .replace(/{{eventDate}}/g, formattedEventDate)
            .replace(/{{eventTime}}/g, event.eventTime || 'N/A') // Assuming event might not have a time
            .replace(/{{venueName}}/g, venueName)
            .replace(/{{ticketHolderName}}/g, ticketHolderDetails.name)
            .replace(/{{ticketHolderEmail}}/g, ticketHolderDetails.email)
            .replace(/{{bookingId}}/g, newBooking._id.toString())
            .replace(/{{seats}}/g, seatsToBookDetails.map(s => s.seatId).join(', '))
            .replace(/{{totalPrice}}/g, formattedTotalPrice)
            .replace(/{{currentYear}}/g, currentYear);
            // Note: The QR code image is embedded using cid, so no placeholder for its src in the template content itself.

          // 5. Prepare attachment for QR code
          const attachments = [{
            filename: 'qr_code.png',
            content: qrCodeBuffer,
            encoding: 'base64', // Not strictly necessary for buffer, but good practice
            cid: 'qr_code_image' // This CID must match the one in <img src="cid:qr_code_image">
          }];

          // 6. Send email
          const emailSubject = `Your Ticket for ${event.eventName} - Booking ID: ${newBooking._id}`;
          await sendEmail(ticketHolderDetails.email, emailSubject, htmlTemplate, attachments);
          console.log(`[createBooking] Confirmation email sent successfully to ${ticketHolderDetails.email} for booking ${newBooking._id}`);

        } catch (emailError) {
          console.error(`[createBooking] CRITICAL: Failed to send confirmation email for booking ${newBooking._id}:`, emailError);
          // Important: Do not let email failure roll back the booking or fail the request.
          // Log it for monitoring and potential manual follow-up.
        }

      } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
        // This case should ideally not be hit frequently if allow_redirects is 'never'
        // and confirm:true is used with a valid synchronous payment method.
        // However, Stripe might still require action for some card types or risk assessments.
        console.warn('[createBooking] PaymentIntent requires action/confirmation. Client secret sent.');
        return res.status(400).json({
            message: 'Further action required to complete payment. Please handle on client-side.',
            clientSecret: paymentIntent.client_secret, 
            requiresAction: true
        });
      } else {
        // Other statuses (e.g., 'processing', 'canceled')
        console.error('Unhandled PaymentIntent status:', paymentIntent.status);
        // Attempt to provide a reason if available from paymentIntent
        const failureReason = paymentIntent.last_payment_error ? paymentIntent.last_payment_error.message : 'Unknown payment issue.';
        return res.status(500).json({ message: `Payment processing issue. Status: ${paymentIntent.status}. Reason: ${failureReason}` });
      }

    } catch (error) {
      console.error('Booking creation error:', error);
      // Consider refunding or voiding if paymentIntent was created but subsequent steps failed.
      // This is complex and depends on the exact point of failure.
      if (paymentIntent && paymentIntent.id && paymentIntent.status !== 'succeeded') {
        // stripe.paymentIntents.cancel(paymentIntent.id).catch(cancelError => console.error("Failed to cancel PI after error:", cancelError));
      }
      res.status(500).json({ message: 'Booking creation failed.', error: error.message });
    }
  },

  // Get all bookings
  getAllBookings: async (req, res) => {
    try {
      console.log('[getAllBookings] Attempting to fetch and populate bookings.');
      const bookings = await Booking.find().populate('eventId', 'eventName eventDate');
      console.log(`[getAllBookings] Successfully fetched ${bookings ? bookings.length : 'null/undefined'} bookings.`);

      if (bookings && bookings.length > 0 && bookings[0].eventId && typeof bookings[0].eventId === 'object' && !bookings[0].eventId.eventName) {
        // Check if eventId is an object (populated) but lacks expected fields.
        // ObjectId.prototype.eventName would be undefined, so this check is primarily for actual populated objects.
        console.warn('[getAllBookings] Warning: eventId might not have been populated correctly for the first booking or eventName is missing:', bookings[0].eventId);
      }

      res.status(200).json({
        status: 'success',
        data: bookings,
        count: bookings.length
      });
    } catch (err) {
      console.error('-----------------------------------------------------');
      console.error('[getAllBookings] CRITICAL ERROR in getAllBookings:', err);
      console.error('Error Name:', err.name);
      console.error('Error Message:', err.message);
      console.error('Error Stack:', err.stack);
      if (err.reason) console.error('Error Reason (Mongoose):', err.reason);
      if (err.value) console.error('Error Value (Mongoose):', err.value);
      if (err.path) console.error('Error Path (Mongoose):', err.path);
      console.error('-----------------------------------------------------');

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch bookings due to an internal server error.',
        errorDetails: {
          name: err.name,
          message: err.message,
        },
        ...(process.env.NODE_ENV === 'development' && { fullErrorStack: err.stack })
      });
    }
  },

  // Get event report
  getEventReport: async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await Event.findById(eventId).lean();

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const venue = await Venue.findById(event.venue).lean();
      if (!venue || !venue.seatMap || !venue.seatMap.categories) {
        // If venue details are crucial for categorization, handle error.
        // Alternatively, could proceed with a default categorization or skip categorization.
        console.error(`Venue or seatMap not found for event ${eventId}, venueId ${event.venue}`);
        return res.status(500).json({ message: 'Venue information for categorization is missing.' });
      }

      const bookings = await Booking.find({ eventId }).lean();

      let totalRevenueCalculated = 0; // To sum up revenue based on per-seat calculation
      let totalTicketsSold = 0;
      const ticketSalesByCategory = {};
      const uniqueAttendees = new Set();

      // Initialize ticketSalesByCategory with all event ticket types
      if (event.ticketTypes && event.ticketTypes.length > 0) {
        event.ticketTypes.forEach(tt => {
          if (!ticketSalesByCategory[tt.type]) {
            ticketSalesByCategory[tt.type] = {
              count: 0,
              revenue: 0,
            };
          }
        });
      }

      bookings.forEach(booking => {
        totalTicketsSold += booking.seats.length;
        uniqueAttendees.add(booking.ticketHolderEmail);

        booking.seats.forEach(bookedSeat => {
          const ticketType = bookedSeat.ticketType;
          const ticketPrice = event.ticketTypes.find(tt => tt.type === ticketType)?.price || 0;

          if (ticketSalesByCategory[ticketType]) {
            ticketSalesByCategory[ticketType].count += 1;
            ticketSalesByCategory[ticketType].revenue += ticketPrice;
            totalRevenueCalculated += ticketPrice;
          } else {
            // Handle cases where a ticket type from a booking might not be in the event's ticketTypes array
            // This could happen if the event's ticket types were changed after the booking was made
            const unknownCategoryKey = `Unknown Category (${ticketType})`;
            if (!ticketSalesByCategory[unknownCategoryKey]) {
              ticketSalesByCategory[unknownCategoryKey] = {
                count: 0,
                revenue: 0,
              };
            }
            ticketSalesByCategory[unknownCategoryKey].count += 1;
          }
        });
      });

      const overallTotalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);

      res.status(200).json({
        status: 'success',
        data: {
          eventName: event.eventName,
          eventDate: event.eventDate,
          totalRevenue: overallTotalRevenue,
          totalTicketsSold,
          numberOfUniqueAttendees: uniqueAttendees.size,
          ticketSalesByCategory,
        },
      });
    } catch (err) {
      console.error('Error generating event report:', err);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate event report',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  },

  // Get total unique users (customers) based on bookings
  getTotalUsers: async (req, res) => {
    try {
      // Get distinct ticketHolderEmail values in the Booking collection
      const distinctUsers = await Booking.distinct('ticketHolderEmail');
      const totalUsers = distinctUsers.length;
      console.log('Distinct users:', distinctUsers);
      console.log('Total users:', totalUsers);
      res.json({
        status: 'success',
        data: { totalUsers }
      });
    } catch (err) {
      console.error('Error fetching total users:', err);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch total users count'
      });
    }
  }
};

module.exports = eventController;