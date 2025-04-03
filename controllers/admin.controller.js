const Admin = require('../models/admin.model');
const bcrypt = require('bcryptjs');

const adminController = {
  // Get all admins (excluding passwords)
  getAllAdmins: async (req, res) => {
    try {
      const admins = await Admin.find().select('-password');
      res.json({ 
        status: 'success', 
        data: { admins } 
      });
    } catch (err) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to fetch admins' 
      });
    }
  },

  // Create new admin
  createAdmin: async (req, res) => {
    try {
      const { userName, email, password, mobile, role } = req.body;
      
      // Check if email or userName already exists
      const existingAdmin = await Admin.findOne({ $or: [{ email }, { userName }] });
      if (existingAdmin) {
        return res.status(400).json({ 
          status: 'error', 
          message: existingAdmin.email === email ? 'Email already in use' : 'Username already in use'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create admin
      const admin = new Admin({ 
        userName,
        email, 
        password: hashedPassword, 
        mobile,
        role
      });
      
      await admin.save();

      // Return admin data without password
      const adminData = admin.toObject();
      delete adminData.password;

      res.status(201).json({ 
        status: 'success', 
        data: { admin: adminData } 
      });
    } catch (err) {
      res.status(400).json({ 
        status: 'error', 
        message: err.message 
      });
    }
  },

  // Get single admin
  getAdmin: async (req, res) => {
    try {
      const admin = await Admin.findById(req.params.id).select('-password');
      if (!admin) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Admin not found' 
        });
      }
      res.json({ 
        status: 'success', 
        data: { admin } 
      });
    } catch (err) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to fetch admin' 
      });
    }
  },

  // Update admin
  updateAdmin: async (req, res) => {
    try {
      const { userName, mobile, role } = req.body;
      
      const admin = await Admin.findByIdAndUpdate(
        req.params.id,
        { userName, mobile, role },
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!admin) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Admin not found' 
        });
      }
      
      res.json({ 
        status: 'success', 
        data: { admin } 
      });
    } catch (err) {
      res.status(400).json({ 
        status: 'error', 
        message: err.message 
      });
    }
  },

  // Delete admin
  deleteAdmin: async (req, res) => {
    try {
      const admin = await Admin.findByIdAndDelete(req.params.id);
      if (!admin) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Admin not found' 
        });
      }
      res.json({ 
        status: 'success', 
        message: 'Admin deleted successfully' 
      });
    } catch (err) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to delete admin' 
      });
    }
  },

  // Change password
  changePassword: async (req, res) => {
    try {
      const { newPassword } = req.body;
      const adminId = req.params.id;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters'
        });
      }

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          status: 'error',
          message: 'Admin not found'
        });
      }

      // Hash new password
      admin.password = await bcrypt.hash(newPassword, 10);
      await admin.save();

      res.json({
        status: 'success',
        message: 'Password updated successfully'
      });
    } catch (err) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to update password' 
      });
    }
  }
};

module.exports = adminController;