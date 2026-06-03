// SMS Service
class SMSService {
  async initialize() {
    console.log("📨 SMS Service: Console mode");
    return true;
  }

  async sendSMS(to, message) {
    console.log(`📨 SMS to ${to}: ${message.substring(0, 50)}...`);
    return { success: true, messageId: `sms-${Date.now()}` };
  }

  async healthCheck() {
    return { status: "healthy", mode: "console" };
  }
}

export default new SMSService();
