import mongoose from 'mongoose';
import Farmer from './models/Farmer.js';

const MONGODB_URI = 'mongodb+srv://nkiremire9_db_user:MutesiMeghan%4098@cluster0.ksslca9.mongodb.net/sian-fintech?retryWrites=true&w=majority';

async function createFarmer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('? Connected to MongoDB');
        
        const nin = 'CM1234567890';
        const phone = '+256700000001';
        
        // Check if farmer already exists
        const existing = await Farmer.findOne({ 
            nationalId: nin 
        });
        
        if (existing) {
            console.log('Farmer already exists!');
            console.log('Farmer ID:', existing._id.toString());
            console.log('Name:', existing.name);
            console.log('Phone:', existing.phone);
            process.exit(0);
        }
        
        // Check by phone
        const existingPhone = await Farmer.findOne({ phone: phone });
        if (existingPhone) {
            console.log('Farmer with this phone already exists!');
            console.log('Farmer ID:', existingPhone._id.toString());
            console.log('Name:', existingPhone.name);
            process.exit(0);
        }
        
        // Generate unique digitalId
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        const digitalId = 'FARM-' + timestamp + '-' + random;
        
        // Create new farmer
        const farmer = new Farmer({
            phone: phone,
            name: 'John Farmer',
            nationalId: nin,
            password: 'password123',
            digitalId: digitalId,
            location: {
                district: 'Kabale',
                village: 'Mukoni',
                coordinates: [29.99, -1.25]
            },
            status: 'active',
            isVerified: true
        });
        
        await farmer.save();
        console.log('? Farmer created successfully!');
        console.log('Farmer ID:', farmer._id.toString());
        console.log('Digital ID:', farmer.digitalId);
        console.log('Name:', farmer.name);
        console.log('Phone:', farmer.phone);
        console.log('NIN:', farmer.nationalId);
        process.exit(0);
        
    } catch (error) {
        console.error('? Error:', error.message);
        if (error.code === 11000) {
            console.log('?? Duplicate key error - farmer may already exist');
        }
        process.exit(1);
    }
}

createFarmer();
