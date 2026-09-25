import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, unique: true, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'UGX' },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
