import asyncHandler from 'express-async-handler';
import Admin from '../models/admin.model.js';
import generateToken from '../utils/generateToken.js';

// @desc    Auth admin & get token
// @route   POST /api/admins/login
// @access  Public
const authAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });

  if (admin && (await admin.matchPassword(password))) {
    generateToken(res, admin._id);

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new admin
// @route   POST /api/admins
// @access  Private/SuperAdmin
const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, isSuperAdmin } = req.body;

  const adminExists = await Admin.findOne({ email });

  if (adminExists) {
    res.status(400);
    throw new Error('Admin already exists');
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    isSuperAdmin: isSuperAdmin || false,
  });

  if (admin) {
    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
    });
  } else {
    res.status(400);
    throw new Error('Invalid admin data');
  }
});

// @desc    Logout admin / clear cookie
// @route   POST /api/admins/logout
// @access  Private
const logoutAdmin = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Get admin profile
// @route   GET /api/admins/profile
// @access  Private
const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id);

  if (admin) {
    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
    });
  } else {
    res.status(404);
    throw new Error('Admin not found');
  }
});

// @desc    Update admin profile
// @route   PUT /api/admins/profile
// @access  Private
const updateAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id);

  if (admin) {
    admin.name = req.body.name || admin.name;
    admin.email = req.body.email || admin.email;

    if (req.body.password) {
      admin.password = req.body.password;
    }

    const updatedAdmin = await admin.save();

    res.json({
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      isSuperAdmin: updatedAdmin.isSuperAdmin,
    });
  } else {
    res.status(404);
    throw new Error('Admin not found');
  }
});

// @desc    Get all admins
// @route   GET /api/admins
// @access  Private/SuperAdmin
const getAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({});
  res.json(admins);
});

export {
  authAdmin,
  registerAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  getAdmins,
};