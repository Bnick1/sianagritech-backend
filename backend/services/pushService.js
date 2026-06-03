// Push Service
class PushService {
  async initialize() {
    console.log("📱 Push Service: Console mode");
    return true;
  }

  async sendToFarmer(farmerId, title, message) {
    console.log(`📱 Push to farmer ${farmerId}: ${title}`);
    return { success: true, delivered: true };
  }

  async healthCheck() {
    return { status: "healthy", mode: "console" };
  }
}

export default new PushService();
