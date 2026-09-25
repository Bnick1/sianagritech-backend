import mongoose from 'mongoose';

const mineralBatchSchema = new mongoose.Schema({
    batchId: { type: String, unique: true, required: true },
    mineralType: { type: String, required: true },
    quantity: { type: Number, required: true },
    location: { type: String },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const MineralBatch = mongoose.model('MineralBatch', mineralBatchSchema);
export default MineralBatch;
