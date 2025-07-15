# 🇦🇺 **AUSTRALIAN ADDRESS SYSTEM BACKEND UPDATE**
*Updated: January 2025*

## 🎯 **OVERVIEW**

Your backend has been successfully updated to support the Australian checkout system with proper address validation, state codes, and postal code formatting.

---

## ✅ **COMPLETED UPDATES**

### **1. Customer Schema Updated** ✅
- **Address Structure**: Changed from separate fields to nested object
- **State Codes**: Now uses Australian state codes (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
- **Postal Code**: 4-digit validation for Australian format
- **Country**: Fixed to 'AU' for Australia

### **2. Order Schema Updated** ✅
- **Address Format**: Aligned with new Australian structure
- **Postal Code**: Changed from 'zipCode' to 'postalCode'
- **Country Default**: Changed from 'USA' to 'AU'
- **State Validation**: Australian state codes only

### **3. Payment Controller Enhanced** ✅
- **Address Handling**: Updated to support nested address objects
- **Validation**: Added Australian state and postal code validation
- **Backward Compatibility**: Handles both old and new address formats

### **4. Customer Controller Enhanced** ✅
- **Add Customer**: Updated for new address structure
- **Update Customer**: Added validation for Australian addresses
- **State Validation**: Australian state codes only
- **Postal Code**: 4-digit validation

### **5. Validation Utilities** ✅
- **Address Validator**: Complete Australian address validation utility
- **State Codes**: Mapping between codes and full state names
- **Postal Code**: 4-digit format validation
- **Standardization**: Address format standardization

---

## 🗂️ **NEW ADDRESS STRUCTURE**

### **Frontend Data Format**
```javascript
{
  customerInfo: {
    name: "John Smith",
    email: "john.smith@example.com", 
    phone: "+61 2 1234 5678",
    address: {
      street: "123 Collins Street",
      city: "Melbourne",
      state: "VIC",           // State code
      postalCode: "3000",     // 4-digit code
      country: "AU"
    }
  }
}
```

### **Database Schema**
```javascript
// Customer Model
address: {
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { 
    type: String, 
    required: true,
    enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']
  },
  postalCode: { 
    type: String, 
    required: true,
    validate: /^\d{4}$/
  },
  country: { type: String, default: 'AU', enum: ['AU'] }
}
```

---

## 🔧 **VALIDATION FEATURES**

### **Australian State Codes**
- ✅ **NSW** - New South Wales
- ✅ **VIC** - Victoria
- ✅ **QLD** - Queensland
- ✅ **WA** - Western Australia
- ✅ **SA** - South Australia
- ✅ **TAS** - Tasmania
- ✅ **ACT** - Australian Capital Territory
- ✅ **NT** - Northern Territory

### **Postal Code Validation**
- ✅ **Format**: Must be exactly 4 digits
- ✅ **Examples**: 2000, 3000, 4000, 6000
- ❌ **Invalid**: 123, 12345, ABC1, 12AB

### **Error Messages**
```javascript
// Invalid state
"Invalid Australian state code 'XYZ'. Must be one of: NSW, VIC, QLD, WA, SA, TAS, ACT, NT"

// Invalid postal code  
"Invalid Australian postal code. Must be 4 digits (e.g., 2000)"
```

---

## 🧪 **TESTING EXAMPLES**

### **Valid Australian Address**
```javascript
{
  address: {
    street: "456 Swanston Street",
    city: "Melbourne", 
    state: "VIC",
    postalCode: "3000",
    country: "AU"
  }
}
```

### **Test State Codes**
```javascript
// Valid examples
"NSW" // ✅ New South Wales
"VIC" // ✅ Victoria
"QLD" // ✅ Queensland

// Invalid examples  
"NY"  // ❌ Not Australian
"New South Wales" // ❌ Use code, not full name
"vic" // ❌ Must be uppercase
```

### **Test Postal Codes**
```javascript
// Valid examples
"2000" // ✅ Sydney CBD
"3000" // ✅ Melbourne CBD  
"4000" // ✅ Brisbane CBD

// Invalid examples
"123"   // ❌ Too short
"12345" // ❌ Too long
"20AB"  // ❌ Contains letters
```

---

## 🔄 **BACKWARD COMPATIBILITY**

The payment controller handles both old and new address formats:

### **Old Format (Still Supported)**
```javascript
{
  customerInfo: {
    name: "John Smith",
    email: "john@example.com",
    address: "123 Collins Street",  // String
    city: "Melbourne",              // Separate field
    state: "VIC",                   // Separate field
    postalCode: "3000"             // Separate field
  }
}
```

### **New Format (Recommended)**
```javascript
{
  customerInfo: {
    name: "John Smith", 
    email: "john@example.com",
    address: {                     // Nested object
      street: "123 Collins Street",
      city: "Melbourne",
      state: "VIC", 
      postalCode: "3000",
      country: "AU"
    }
  }
}
```

---

## 📁 **FILES UPDATED**

### **Models**
- ✅ `models/ecom/Customer.js` - Australian address schema
- ✅ `models/ecom/Order.js` - Updated address structure

### **Controllers** 
- ✅ `controllers/ecom/paymentController.js` - Address handling
- ✅ `controllers/ecom/customerController.js` - Validation updates

### **Utilities**
- ✅ `utils/ecom/australianAddressValidator.js` - New validation utility

### **Examples**
- ✅ `frontend-examples/EcommerceCheckout.jsx` - Australian format example

---

## 🚀 **FRONTEND INTEGRATION**

Your frontend can now send addresses in either format:

### **Using New Address Object**
```javascript
const orderData = {
  cartItems: [...],
  customerInfo: {
    name: "Sarah Johnson",
    email: "sarah@example.com",
    phone: "+61 3 9876 5432",
    address: {
      street: "789 Burke Street",
      city: "Melbourne",
      state: "VIC",
      postalCode: "3000", 
      country: "AU"
    }
  }
};
```

### **State Code Reference**
```javascript
const australianStates = {
  'NSW': 'New South Wales',
  'VIC': 'Victoria',
  'QLD': 'Queensland', 
  'WA': 'Western Australia',
  'SA': 'South Australia',
  'TAS': 'Tasmania',
  'ACT': 'Australian Capital Territory',
  'NT': 'Northern Territory'
};
```

---

## ✅ **VALIDATION RESULTS**

The backend now validates:
- ✅ **Australian state codes only**
- ✅ **4-digit postal codes**
- ✅ **Required address fields**
- ✅ **Country set to 'AU'**
- ✅ **Proper error messages**

---

## 🎉 **READY FOR AUSTRALIAN CHECKOUT!**

Your backend now supports:
- ✅ **Australian address validation**
- ✅ **State code system (NSW, VIC, etc.)**
- ✅ **4-digit postal codes** 
- ✅ **Nested address objects**
- ✅ **Backward compatibility**
- ✅ **Clear error messages**

**The system is ready for Australian customers!** 🇦🇺
