class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map();
  }

  async checkLimit(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove expired timestamps
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }

  getRemainingRequests(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Create rate limiters with different configurations
const aiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
const imageRateLimiter = new RateLimiter(5, 300000); // 5 requests per 5 minutes

module.exports = {
  aiRateLimiter,
  imageRateLimiter
}; 