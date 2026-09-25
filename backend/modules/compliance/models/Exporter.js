import mongoose from 'mongoose';

const exporterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    location: { type: String },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

const Exporter = mongoose.model('Exporter', exporterSchema);
export default Exporter;
