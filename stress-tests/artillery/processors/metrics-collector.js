/**
 * Artillery processor for custom metrics collection
 */

module.exports = {
    trackConnectionTime,
    trackBroadcastLatency,
    trackMemoryUsage,
    initMetrics,
};

const metrics = {
    connectionTimes: [],
    broadcastLatencies: [],
    memorySnapshots: [],
};

/**
 * Initialize metrics collection
 */
function initMetrics(context, events, done) {
    context.vars.connectStartTime = Date.now();
    return done();
}

/**
 * Track Socket.IO connection establishment time
 */
function trackConnectionTime(context, events, done) {
    if (context.vars.connectStartTime) {
        const connectionTime = Date.now() - context.vars.connectStartTime;
        events.emit("histogram", "stress.connection.time_ms", connectionTime);
        metrics.connectionTimes.push(connectionTime);
        context.vars.connectStartTime = null;
    }
    return done();
}

/**
 * Track broadcast latency (for multi-client scenarios)
 */
function trackBroadcastLatency(context, events, done) {
    if (context.vars.broadcastStartTime) {
        const latency = Date.now() - context.vars.broadcastStartTime;
        events.emit("histogram", "stress.broadcast.latency_ms", latency);
        metrics.broadcastLatencies.push(latency);
        context.vars.broadcastStartTime = null;
    }
    return done();
}

/**
 * Track memory usage (approximate client-side tracking)
 */
function trackMemoryUsage(context, events, done) {
    if (global.gc) {
        global.gc();
    }

    const usage = process.memoryUsage();
    const memoryMB = Math.round(usage.heapUsed / 1024 / 1024);

    events.emit("histogram", "stress.memory.heap_mb", memoryMB);
    metrics.memorySnapshots.push({
        timestamp: Date.now(),
        heapUsed: memoryMB,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    });

    return done();
}
