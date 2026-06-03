// Notification Service
class NotificationService {
  async initialize() {
    console.log("✅ Notification Service: Ready");
    return true;
  }

  async sendAlert(farmerId, title, message) {
    console.log(`🔔 Alert to farmer ${farmerId}: ${title} - ${message.substring(0, 50)}...`);
    return { success: true, alertId: Date.now().toString() };
  }

  async healthCheck() {
    return {
      service: "NotificationService",
      status: "healthy",
      timestamp: new Date().toISOString()
    };
  }
}

export default new NotificationService();
