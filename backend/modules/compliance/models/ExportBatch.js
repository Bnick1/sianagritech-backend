import mongoose from 'mongoose';

const exportBatchSchema = new mongoose.Schema({
    batchId: { type: String, unique: true, required: true },
    farmId: { type: String, required: true },
    productType: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const ExportBatch = mongoose.model('ExportBatch', exportBatchSchema);
export default ExportBatch;
