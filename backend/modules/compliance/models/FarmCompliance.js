import mongoose from 'mongoose';

const farmComplianceSchema = new mongoose.Schema({
    farmId: { type: String, required: true },
    status: { type: String, default: 'pending' },
    score: { type: Number, default: 0 },
    checks: [{ type: String }],
    recommendations: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const FarmCompliance = mongoose.model('FarmCompliance', farmComplianceSchema);
export default FarmCompliance;
